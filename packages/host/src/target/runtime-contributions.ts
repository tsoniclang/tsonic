import type {
  TargetCompilationPaths,
  TargetSelection,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import type {
  TargetCapabilityImplementation,
  TargetSurfaceImplementation,
} from "@tsonic/target-api/provider";
import type {
  TargetArtifact,
  TargetDiagnostic,
  TargetRuntimeContributions,
  TargetRuntimeReference,
} from "@tsonic/target-api/artifacts";

export interface CollectTargetRuntimeContributionsOptions {
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly targetPackId: string;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly runtimeActivatedCapabilities?: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly paths: TargetCompilationPaths;
  readonly targetContributions: TargetRuntimeContributions;
}

export interface CollectedTargetRuntimeContributions {
  readonly artifacts: readonly TargetArtifact[];
  readonly references: readonly TargetRuntimeReference[];
  readonly diagnostics: readonly TargetDiagnostic[];
}

export function collectTargetRuntimeContributions(options: CollectTargetRuntimeContributionsOptions): CollectedTargetRuntimeContributions {
  const context = {
    project: options.project,
    projectDirectory: options.projectDirectory,
    target: options.target,
    selectedCapabilityIds: Object.freeze(options.selectedCapabilities.map((capability) => capability.id)),
    selectedSurfaceIds: Object.freeze(options.selectedSurfaces.map((surface) => surface.id)),
    paths: options.paths,
  };
  return mergeRuntimeContributions(
    [
      options.targetContributions,
      ...(options.runtimeActivatedCapabilities ?? options.selectedCapabilities).map((capability) => capability.runtimeContributions?.({
        ...context,
        capability,
      })),
      ...options.selectedSurfaces.map((surface) => surface.runtimeContributions(context)),
    ],
    options.targetPackId,
  );
}

function mergeRuntimeContributions(
  contributions: readonly (TargetRuntimeContributions | undefined)[],
  source: string,
): CollectedTargetRuntimeContributions {
  const artifacts: TargetArtifact[] = [];
  const references: TargetRuntimeReference[] = [];
  const diagnostics: TargetDiagnostic[] = [];
  const artifactPaths = new Set<string>();
  const referenceKeys = new Set<string>();
  for (const contribution of contributions) {
    for (const artifact of contribution?.artifacts ?? []) {
      if (artifactPaths.has(artifact.path)) {
        diagnostics.push({
          code: "TARGET_RUNTIME",
          category: "error",
          message: `duplicate target runtime artifact '${artifact.path}'`,
          source,
        });
        continue;
      }
      artifactPaths.add(artifact.path);
      artifacts.push(artifact);
    }
    for (const reference of contribution?.references ?? []) {
      const key = `${reference.kind}:${reference.include}`;
      if (referenceKeys.has(key)) {
        diagnostics.push({
          code: "TARGET_RUNTIME",
          category: "error",
          message: `duplicate target runtime reference '${reference.kind}:${reference.include}'`,
          source,
        });
        continue;
      }
      referenceKeys.add(key);
      references.push(reference);
    }
  }
  return { artifacts, references, diagnostics };
}
