import type { CompilerExtension } from "@tsonic/tsts";
import type {
  TargetProvider,
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

export type TargetSurfaceSelectionResult =
  | {
      readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
    }
  | {
      readonly error: string;
    };

export function createTargetCompilerExtensions(options: CreateTargetCompilerExtensionsOptions): TargetCompilerExtensionComposition {
  const selectedSurfaces = options.selectedSurfaces === undefined
    ? getSelectedSurfaceImplementations(options.targetPack, options.target)
    : validateSelectedSurfaceComposition(options.targetPack, options.target, options.selectedSurfaces);
  const provider = requireTargetProvider(options.targetPack, options.target);
  const providerContext = {
    project: options.project,
    target: options.target,
    selectedSurfaces,
  };
  const extensions = [
    ...provider.createExtensions(providerContext),
    ...selectedSurfaces.flatMap((surface) =>
      surface.createExtensions?.({
        ...providerContext,
        targetPack: options.targetPack,
        surface,
      }) ?? []
    ),
  ];
  return {
    selectedSurfaces,
    extensions,
  };
}

export function requireTargetProvider(targetPack: TargetPack, target: TargetSelection): TargetProvider {
  const provider = targetPack.provider;
  if (provider === undefined) {
    throw new Error(getMissingTargetProviderMessage(target));
  }
  return provider;
}

export function getMissingTargetProviderMessage(target: TargetSelection): string {
  return `target '${target.id}' does not declare a provider; Tsonic requires provider-composed TSTS facts before backend emission`;
}

export function getSelectedSurfaceImplementations(
  targetPack: TargetPack,
  target: TargetSelection,
): readonly TargetSurfaceImplementation[] {
  const result = selectTargetSurfaceImplementations(targetPack, target);
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result.selectedSurfaces;
}

export function selectTargetSurfaceImplementations(
  targetPack: TargetPack,
  target: TargetSelection,
): TargetSurfaceSelectionResult {
  const requestedSurfaces = target.surfaces ?? [];
  const surfaceById = new Map<string, TargetSurfaceImplementation>();
  for (const surface of targetPack.surfaces ?? []) {
    if (surfaceById.has(surface.id)) {
      return { error: `target '${target.id}' declares surface '${surface.id}' more than once` };
    }
    surfaceById.set(surface.id, surface);
  }
  const selectedIds = new Set<string>();
  const selectedSurfaces: TargetSurfaceImplementation[] = [];
  for (const surfaceId of requestedSurfaces) {
    if (selectedIds.has(surfaceId)) {
      return { error: `target '${target.id}' requests surface '${surfaceId}' more than once` };
    }
    const surface = surfaceById.get(surfaceId);
    if (surface === undefined) {
      return { error: `target '${target.id}' does not implement requested surface '${surfaceId}'` };
    }
    selectedIds.add(surfaceId);
    selectedSurfaces.push(surface);
  }
  for (const surface of selectedSurfaces) {
    for (const requiredSurfaceId of surface.requiredSurfaces ?? []) {
      if (!selectedIds.has(requiredSurfaceId)) {
        return { error: `target '${target.id}' surface '${surface.id}' requires surface '${requiredSurfaceId}'` };
      }
    }
  }
  return { selectedSurfaces };
}

function validateSelectedSurfaceComposition(
  targetPack: TargetPack,
  target: TargetSelection,
  selectedSurfaces: readonly TargetSurfaceImplementation[],
): readonly TargetSurfaceImplementation[] {
  const expectedSurfaces = getSelectedSurfaceImplementations(targetPack, target);
  const hasExactComposition = selectedSurfaces.length === expectedSurfaces.length &&
    selectedSurfaces.every((surface, index) => surface === expectedSurfaces[index]);
  if (!hasExactComposition) {
    throw new Error(
      `target '${target.id}' selected surface composition is stale or unowned; expected selected target pack surfaces ` +
        `[${formatSurfaceIds(expectedSurfaces)}], received [${formatSurfaceIds(selectedSurfaces)}]`,
    );
  }
  return selectedSurfaces;
}

function formatSurfaceIds(surfaces: readonly TargetSurfaceImplementation[]): string {
  return surfaces.map((surface) => surface.id).join(",");
}
