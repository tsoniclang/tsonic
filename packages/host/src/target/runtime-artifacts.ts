import type {
  TargetArtifact,
  TargetCompilationPaths,
  TargetPack,
  TargetSelection,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import { requireTargetProvider } from "./extensions.js";

export interface CollectTargetRuntimeArtifactsOptions {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly paths: TargetCompilationPaths;
}

export function collectTargetRuntimeArtifacts(options: CollectTargetRuntimeArtifactsOptions): readonly TargetArtifact[] {
  const provider = requireTargetProvider(options.targetPack, options.target);
  const context = {
    project: options.project,
    target: options.target,
    selectedSurfaces: options.selectedSurfaces,
    paths: options.paths,
  };
  return [
    ...(provider.runtimeArtifacts?.(context) ?? []),
    ...options.selectedSurfaces.flatMap((surface) => surface.runtimeArtifacts(context)),
  ];
}
