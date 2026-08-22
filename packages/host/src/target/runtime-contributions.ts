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
  TargetSourceFile,
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
  const artifactsByPath = new Map<string, TargetArtifact>();
  const referencesByKey = new Map<string, TargetRuntimeReference>();
  for (const contribution of contributions) {
    for (const artifact of contribution?.artifacts ?? []) {
      const existing = artifactsByPath.get(artifact.path);
      if (existing !== undefined) {
        if (targetRuntimeArtifactEquals(existing, artifact)) {
          continue;
        }
        diagnostics.push({
          code: "TARGET_RUNTIME",
          category: "error",
          message: `conflicting target runtime artifact '${artifact.path}'`,
          source,
        });
        continue;
      }
      artifactsByPath.set(artifact.path, artifact);
      artifacts.push(artifact);
    }
    for (const reference of contribution?.references ?? []) {
      const key = `${reference.kind}:${reference.include}`;
      const existing = referencesByKey.get(key);
      if (existing !== undefined) {
        if (targetRuntimeReferenceEquals(existing, reference)) {
          continue;
        }
        diagnostics.push({
          code: "TARGET_RUNTIME",
          category: "error",
          message: `conflicting target runtime reference '${reference.kind}:${reference.include}'`,
          source,
        });
        continue;
      }
      referencesByKey.set(key, reference);
      references.push(reference);
    }
  }
  return { artifacts, references, diagnostics };
}

function targetRuntimeArtifactEquals(
  left: TargetArtifact,
  right: TargetArtifact,
): boolean {
  return left.kind === right.kind &&
    left.path === right.path &&
    left.text === right.text &&
    targetSourceLanguage(left) === targetSourceLanguage(right);
}

function targetSourceLanguage(artifact: TargetArtifact): string | undefined {
  return artifact.kind === "source"
    ? (artifact as Partial<TargetSourceFile>).language
    : undefined;
}

function targetRuntimeReferenceEquals(
  left: TargetRuntimeReference,
  right: TargetRuntimeReference,
): boolean {
  return left.kind === right.kind &&
    left.include === right.include &&
    left.version === right.version &&
    stringRecordsEqual(left.attributes, right.attributes);
}

function stringRecordsEqual(
  left: Readonly<Record<string, string>> | undefined,
  right: Readonly<Record<string, string>> | undefined,
): boolean {
  const leftRecord = left ?? {};
  const rightRecord = right ?? {};
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] && leftRecord[key] === rightRecord[key]);
}
