import type { CompilerExtension } from "@tsonic/tsts";
import type {
  TargetPack,
  TargetSelection,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";

export interface CreateTargetCompilerExtensionsOptions {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedSurfaces?: readonly TargetSurfaceImplementation[];
}

export interface TargetCompilerExtensionComposition {
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly extensions: readonly CompilerExtension[];
}

export function createTargetCompilerExtensions(options: CreateTargetCompilerExtensionsOptions): TargetCompilerExtensionComposition {
  const selectedSurfaces = options.selectedSurfaces ?? getSelectedSurfaceImplementations(options.targetPack, options.target);
  const extensions = options.targetPack.provider?.createExtensions({
    project: options.project,
    target: options.target,
    selectedSurfaces,
  }) ?? [];
  return {
    selectedSurfaces,
    extensions,
  };
}

export function getSelectedSurfaceImplementations(
  targetPack: TargetPack,
  target: TargetSelection,
): readonly TargetSurfaceImplementation[] {
  const requestedSurfaces = target.surfaces ?? [];
  const surfaceById = new Map<string, TargetSurfaceImplementation>();
  for (const surface of targetPack.surfaces ?? []) {
    if (surfaceById.has(surface.id)) {
      throw new Error(`target '${target.id}' declares surface '${surface.id}' more than once`);
    }
    surfaceById.set(surface.id, surface);
  }
  const selectedIds = new Set<string>();
  const selectedSurfaces: TargetSurfaceImplementation[] = [];
  for (const surfaceId of requestedSurfaces) {
    if (selectedIds.has(surfaceId)) {
      throw new Error(`target '${target.id}' requests surface '${surfaceId}' more than once`);
    }
    const surface = surfaceById.get(surfaceId);
    if (surface === undefined) {
      throw new Error(`target '${target.id}' does not implement requested surface '${surfaceId}'`);
    }
    selectedIds.add(surfaceId);
    selectedSurfaces.push(surface);
  }
  for (const surface of selectedSurfaces) {
    for (const requiredSurfaceId of surface.requiredSurfaces ?? []) {
      if (!selectedIds.has(requiredSurfaceId)) {
        throw new Error(`target '${target.id}' surface '${surface.id}' requires surface '${requiredSurfaceId}'`);
      }
    }
  }
  return selectedSurfaces;
}
