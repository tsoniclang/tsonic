import type {
  TargetArtifact,
  TargetCompilationPaths,
  TargetDiagnostic,
  TargetPack,
  TargetCapabilityImplementation,
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
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly runtimeActivatedCapabilities?: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly paths: TargetCompilationPaths;
}

export interface CollectedTargetRuntimeContributions {
  readonly artifacts: readonly TargetArtifact[];
  readonly references: readonly TargetRuntimeReference[];
  readonly diagnostics: readonly TargetDiagnostic[];
}

export function collectTargetRuntimeContributions(options: CollectTargetRuntimeContributionsOptions): CollectedTargetRuntimeContributions {
  const provider = requireTargetProvider(options.targetPack, options.target);
  const context = {
    project: options.project,
    target: options.target,
    selectedCapabilities: options.selectedCapabilities,
    selectedSurfaces: options.selectedSurfaces,
    paths: options.paths,
  };
  const capabilityContext = {
    ...context,
    targetPack: options.targetPack,
  };
  return mergeRuntimeContributions(
    [
      provider.runtimeContributions?.(context),
      ...(options.runtimeActivatedCapabilities ?? options.selectedCapabilities).map((capability) => capability.runtimeContributions?.({
        ...capabilityContext,
        capability,
      })),
      ...options.selectedSurfaces.map((surface) => surface.runtimeContributions(context)),
    ],
    options.targetPack.id,
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
