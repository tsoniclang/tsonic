import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
  Result,
  TsonicWorkspaceConfig,
} from "../types.js";
import { resolveSurfaceCapabilities } from "../surface/profiles.js";
import {
  PACKAGE_MANIFEST_DIAGNOSTIC,
  manifestIsSatisfiedByLocalLibrary,
  normalizeId,
} from "./bindings/shared.js";
import {
  mergeFrameworkReferences,
  mergeMsbuildProperties,
  mergePackageReferences,
} from "./bindings/manifest-parsing.js";
import {
  discoverWorkspaceBindingsManifests,
  hasInstalledSourcePackageManifest,
  resolveInstalledPackageBindingsManifest,
} from "./bindings/installed-manifests.js";
import type { NormalizedBindingsManifest } from "./bindings/types.js";

export type {
  PackageManifestProducer,
  ManifestDotnet,
  ManifestSurfaceMode,
  NormalizedBindingsManifest,
  NormalizedNugetDependency,
} from "./bindings/types.js";
export {
  discoverWorkspaceBindingsManifests,
  hasInstalledSourcePackageManifest,
  resolveInstalledPackageBindingsManifest,
};

type MergeManifestOptions = {
  readonly workspaceRoot?: string;
};

const shouldMergeManifestTypeRoots = (
  config: TsonicWorkspaceConfig,
  manifest: NormalizedBindingsManifest,
  options: MergeManifestOptions
): boolean => {
  const workspaceRoot = options.workspaceRoot;
  if (!workspaceRoot) return true;

  const surfacePackages = new Set(
    resolveSurfaceCapabilities(config.surface, {
      workspaceRoot,
    }).requiredNpmPackages.map((pkg) => normalizeId(pkg))
  );
  return !surfacePackages.has(normalizeId(manifest.packageName));
};

export const mergeManifestIntoWorkspaceConfig = (
  config: TsonicWorkspaceConfig,
  manifest: NormalizedBindingsManifest,
  conflictCode: string | undefined = undefined,
  options: MergeManifestOptions = {}
): Result<TsonicWorkspaceConfig, string> => {
  const dotnet = config.dotnet ?? {};
  const testDotnet = config.testDotnet ?? {};
  const localRuntimeOverride = manifestIsSatisfiedByLocalLibrary(
    config,
    manifest
  );
  const manifestTypeRoots = shouldMergeManifestTypeRoots(
    config,
    manifest,
    options
  )
    ? manifest.requiredTypeRoots
    : [];
  const mergedTypeRoots = [
    ...new Set([
      ...((dotnet.typeRoots ?? []) as readonly string[]),
      ...manifestTypeRoots,
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const mergedFramework = mergeFrameworkReferences(
    (dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[],
    (manifest.dotnet?.frameworkReferences ?? []) as FrameworkReferenceConfig[],
    conflictCode
  );
  if (!mergedFramework.ok) return mergedFramework;

  const mergedPackages = mergePackageReferences(
    (dotnet.packageReferences ?? []) as PackageReferenceConfig[],
    (localRuntimeOverride
      ? []
      : (manifest.dotnet?.packageReferences ?? [])) as PackageReferenceConfig[],
    conflictCode
  );
  if (!mergedPackages.ok) return mergedPackages;

  const mergedMsbuild = mergeMsbuildProperties(
    (dotnet.msbuildProperties ?? {}) as Record<string, string>,
    (manifest.dotnet?.msbuildProperties ?? {}) as Record<string, string>,
    conflictCode
  );
  if (!mergedMsbuild.ok) return mergedMsbuild;

  const mergedTestFramework = mergeFrameworkReferences(
    (testDotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[],
    (manifest.testDotnet?.frameworkReferences ??
      []) as FrameworkReferenceConfig[],
    conflictCode
  );
  if (!mergedTestFramework.ok) return mergedTestFramework;

  const mergedTestPackages = mergePackageReferences(
    (testDotnet.packageReferences ?? []) as PackageReferenceConfig[],
    (localRuntimeOverride
      ? []
      : (manifest.testDotnet?.packageReferences ??
        [])) as PackageReferenceConfig[],
    conflictCode
  );
  if (!mergedTestPackages.ok) return mergedTestPackages;

  const mergedTestMsbuild = mergeMsbuildProperties(
    (testDotnet.msbuildProperties ?? {}) as Record<string, string>,
    (manifest.testDotnet?.msbuildProperties ?? {}) as Record<string, string>,
    conflictCode
  );
  if (!mergedTestMsbuild.ok) return mergedTestMsbuild;

  return {
    ok: true,
    value: {
      ...config,
      dotnet: {
        ...dotnet,
        ...(mergedTypeRoots.length > 0 ? { typeRoots: mergedTypeRoots } : {}),
        frameworkReferences: mergedFramework.value,
        packageReferences: mergedPackages.value,
        msbuildProperties:
          Object.keys(mergedMsbuild.value).length > 0
            ? mergedMsbuild.value
            : undefined,
      },
      testDotnet: manifest.testDotnet
        ? {
            ...testDotnet,
            frameworkReferences: mergedTestFramework.value,
            packageReferences: mergedTestPackages.value,
            msbuildProperties:
              Object.keys(mergedTestMsbuild.value).length > 0
                ? mergedTestMsbuild.value
                : undefined,
          }
        : config.testDotnet,
    },
  };
};

export const applyPackageManifestWorkspaceOverlay = (
  workspaceRoot: string,
  config: TsonicWorkspaceConfig
): Result<
  {
    readonly config: TsonicWorkspaceConfig;
    readonly manifests: readonly NormalizedBindingsManifest[];
  },
  string
> => {
  const manifests = discoverWorkspaceBindingsManifests(
    workspaceRoot,
    config.surface
  );
  if (!manifests.ok) return manifests;

  let current = config;
  for (const manifest of manifests.value) {
    const merged = mergeManifestIntoWorkspaceConfig(
      current,
      manifest,
      PACKAGE_MANIFEST_DIAGNOSTIC.conflictingRuntime,
      { workspaceRoot }
    );
    if (!merged.ok) return merged;
    current = merged.value;
  }

  return { ok: true, value: { config: current, manifests: manifests.value } };
};
