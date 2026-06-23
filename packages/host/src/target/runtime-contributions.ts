import type {
  TargetArtifact,
  TargetCompilationPaths,
  TargetPack,
  TargetRuntimeContributions,
  TargetRuntimeReference,
  TargetSelection,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import { requireTargetProvider } from "./extensions.js";

export interface CollectTargetRuntimeContributionsOptions {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly paths: TargetCompilationPaths;
}

export interface CollectedTargetRuntimeContributions {
  readonly artifacts: readonly TargetArtifact[];
  readonly references: readonly TargetRuntimeReference[];
}

export function collectTargetRuntimeContributions(options: CollectTargetRuntimeContributionsOptions): CollectedTargetRuntimeContributions {
  const provider = requireTargetProvider(options.targetPack, options.target);
  const context = {
    project: options.project,
    target: options.target,
    selectedSurfaces: options.selectedSurfaces,
    paths: options.paths,
  };
  return mergeRuntimeContributions([
    provider.runtimeContributions?.(context),
    ...options.selectedSurfaces.map((surface) => surface.runtimeContributions(context)),
  ]);
}

function mergeRuntimeContributions(
  contributions: readonly (TargetRuntimeContributions | undefined)[],
): CollectedTargetRuntimeContributions {
  const artifacts: TargetArtifact[] = [];
  const references: TargetRuntimeReference[] = [];
  const artifactPaths = new Set<string>();
  const referenceKeys = new Set<string>();
  for (const contribution of contributions) {
    for (const artifact of contribution?.artifacts ?? []) {
      if (artifactPaths.has(artifact.path)) {
        throw new Error(`duplicate target runtime artifact '${artifact.path}'`);
      }
      artifactPaths.add(artifact.path);
      artifacts.push(artifact);
    }
    for (const reference of contribution?.references ?? []) {
      const key = `${reference.kind}:${reference.include}`;
      if (referenceKeys.has(key)) {
        throw new Error(`duplicate target runtime reference '${reference.kind}:${reference.include}'`);
      }
      referenceKeys.add(key);
      references.push(reference);
    }
  }
  return { artifacts, references };
}
