import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
  Result,
} from "../../../types.js";
import {
  PACKAGE_MANIFEST_DIAGNOSTIC,
  errorWithCode,
  normalizeId,
  readJsonObject,
} from "../shared.js";
import type {
  ManifestDotnet,
  NormalizedBindingsManifest,
  PackageManifestProducer,
} from "../types.js";
import {
  canonicalizeManifestDotnet,
  collectNugetDependencies,
  mergeFrameworkReferences,
  mergePackageReferences,
  parseManifestDotnet,
  parseRequiredTypeRoots,
} from "./dotnet.js";
import {
  parsePackageManifestProducer,
  parseRuntimeFrameworkReferences,
  parseRuntimeNugetPackages,
  parseRuntimePackages,
} from "./runtime.js";

const parseRuntimeObject = (
  value: unknown,
  path: string
): Result<Record<string, unknown> | undefined, string> => {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.missingRuntimeMapping,
      `${path} must be an object`
    );
  }
  return { ok: true, value: value as Record<string, unknown> };
};

const parseOptionalRuntimeSections = (
  value: unknown,
  path: string
): Result<
  {
    readonly runtimeNuget: readonly PackageReferenceConfig[];
    readonly runtimeFramework: readonly FrameworkReferenceConfig[];
    readonly runtimePackages: readonly string[];
  },
  string
> => {
  const runtimeObject = parseRuntimeObject(value, path);
  if (!runtimeObject.ok) return runtimeObject;
  const runtime = runtimeObject.value;
  if (!runtime) {
    return {
      ok: true,
      value: {
        runtimeNuget: [],
        runtimeFramework: [],
        runtimePackages: [],
      },
    };
  }

  const runtimeNuget =
    runtime.nugetPackages !== undefined
      ? parseRuntimeNugetPackages(runtime.nugetPackages)
      : { ok: true as const, value: [] as readonly PackageReferenceConfig[] };
  if (!runtimeNuget.ok) return runtimeNuget;

  const runtimeFramework = parseRuntimeFrameworkReferences(
    runtime.frameworkReferences
  );
  if (!runtimeFramework.ok) return runtimeFramework;

  return {
    ok: true,
    value: {
      runtimeNuget: runtimeNuget.value,
      runtimeFramework: runtimeFramework.value,
      runtimePackages: parseRuntimePackages(runtime.runtimePackages),
    },
  };
};

const buildNormalizedManifest = (
  packageName: string,
  packageVersion: string,
  requiredTypeRoots: readonly string[],
  producer: PackageManifestProducer | undefined,
  dotnetParsed: ManifestDotnet | undefined,
  testDotnetParsed: ManifestDotnet | undefined,
  runtimeNuget: readonly PackageReferenceConfig[],
  runtimeFramework: readonly FrameworkReferenceConfig[],
  runtimePackages: readonly string[],
  bindingsRoot?: string
): Result<NormalizedBindingsManifest, string> => {
  const mergedDotnetPackages = mergePackageReferences(
    (dotnetParsed?.packageReferences ?? []) as PackageReferenceConfig[],
    runtimeNuget as PackageReferenceConfig[],
    PACKAGE_MANIFEST_DIAGNOSTIC.conflictingRuntime
  );
  if (!mergedDotnetPackages.ok) return mergedDotnetPackages;

  const mergedDotnetFramework = mergeFrameworkReferences(
    (dotnetParsed?.frameworkReferences ?? []) as FrameworkReferenceConfig[],
    runtimeFramework as FrameworkReferenceConfig[],
    PACKAGE_MANIFEST_DIAGNOSTIC.conflictingRuntime
  );
  if (!mergedDotnetFramework.ok) return mergedDotnetFramework;

  const dotnet = canonicalizeManifestDotnet({
    frameworkReferences: mergedDotnetFramework.value,
    packageReferences: mergedDotnetPackages.value,
    msbuildProperties: dotnetParsed?.msbuildProperties,
  });
  const testDotnet = canonicalizeManifestDotnet(testDotnetParsed);

  const runtimeSet = new Set<string>();
  runtimeSet.add(packageName);
  for (const pkg of runtimePackages) runtimeSet.add(pkg);

  return {
    ok: true,
    value: {
      bindingVersion: 1,
      sourceManifest: "package-manifest",
      packageName,
      packageVersion,
      surfaceMode: "clr",
      requiredTypeRoots,
      ...(bindingsRoot ? { bindingsRoot } : {}),
      runtimePackages: [...runtimeSet].sort((a, b) =>
        normalizeId(a).localeCompare(normalizeId(b))
      ),
      ...(producer ? { producer } : {}),
      dotnet,
      testDotnet,
      nugetDependencies: collectNugetDependencies(dotnet, testDotnet),
    },
  };
};

export const resolveFromPackageManifest = (
  packageRoot: string,
  packageName: string,
  packageVersion: string
): Result<NormalizedBindingsManifest | null, string> => {
  const path = join(packageRoot, "tsonic", "package-manifest.json");
  if (!existsSync(path)) return { ok: true, value: null };

  const parsed = readJsonObject(
    path,
    PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema
  );
  if (!parsed.ok) return parsed;
  const manifest = parsed.value;

  const schemaVersion = manifest.schemaVersion;
  if (schemaVersion !== 1) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `schemaVersion must be 1 at ${path}`
    );
  }

  const kind = manifest.kind;
  if (kind === "tsonic-source-package") {
    const requiredTypeRoots = parseRequiredTypeRoots(
      manifest.requiredTypeRoots,
      "requiredTypeRoots",
      packageName
    );
    if (!requiredTypeRoots.ok) return requiredTypeRoots;

    const producer = parsePackageManifestProducer(manifest.producer);
    if (!producer.ok) return producer;

    const dotnetParsed = parseManifestDotnet(manifest.dotnet, "dotnet");
    if (!dotnetParsed.ok) return dotnetParsed;
    const testDotnetParsed = parseManifestDotnet(
      manifest.testDotnet,
      "testDotnet"
    );
    if (!testDotnetParsed.ok) return testDotnetParsed;

    const runtimeParsed = parseOptionalRuntimeSections(
      manifest.runtime,
      "runtime"
    );
    if (!runtimeParsed.ok) return runtimeParsed;

    const hasOverlayMetadata =
      requiredTypeRoots.value.length > 0 ||
      runtimeParsed.value.runtimeNuget.length > 0 ||
      runtimeParsed.value.runtimeFramework.length > 0 ||
      runtimeParsed.value.runtimePackages.length > 0 ||
      dotnetParsed.value !== undefined ||
      testDotnetParsed.value !== undefined;
    if (!hasOverlayMetadata) {
      return { ok: true, value: null };
    }

    return buildNormalizedManifest(
      packageName,
      packageVersion,
      requiredTypeRoots.value,
      producer.value,
      dotnetParsed.value,
      testDotnetParsed.value,
      runtimeParsed.value.runtimeNuget,
      runtimeParsed.value.runtimeFramework,
      runtimeParsed.value.runtimePackages
    );
  }
  if (kind !== "tsonic-library") {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `kind must be "tsonic-library" at ${path}`
    );
  }

  const npmPackage = manifest.npmPackage;
  if (typeof npmPackage !== "string" || npmPackage.trim().length === 0) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `npmPackage must be a non-empty string at ${path}`
    );
  }
  if (normalizeId(npmPackage) !== normalizeId(packageName)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `npmPackage mismatch in ${path}. Installed: ${packageName}, Manifest: ${npmPackage}`
    );
  }

  const npmVersion = manifest.npmVersion;
  if (typeof npmVersion !== "string" || npmVersion.trim().length === 0) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `npmVersion must be a non-empty string at ${path}`
    );
  }
  if (npmVersion.trim() !== packageVersion) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `npmVersion mismatch in ${path}. Installed: ${packageVersion}, Manifest: ${npmVersion}`
    );
  }

  const typing = manifest.typing;
  if (typing === null || typeof typing !== "object" || Array.isArray(typing)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `typing must be an object at ${path}`
    );
  }
  const bindingsRoot = (typing as { readonly bindingsRoot?: unknown })
    .bindingsRoot;
  if (typeof bindingsRoot !== "string" || bindingsRoot.trim().length === 0) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `typing.bindingsRoot must be a non-empty string at ${path}`
    );
  }
  const bindingsRootPath = join(packageRoot, bindingsRoot);
  if (!existsSync(bindingsRootPath)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.missingBindingsRoot,
      `typing.bindingsRoot does not exist: ${bindingsRootPath}`
    );
  }

  const runtime = manifest.runtime;
  const runtimeObject = parseRuntimeObject(runtime, "runtime");
  if (!runtimeObject.ok) return runtimeObject;
  if (!runtimeObject.value) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.missingRuntimeMapping,
      `runtime must be an object at ${path}`
    );
  }
  const runtimeNuget = parseRuntimeNugetPackages(
    runtimeObject.value.nugetPackages
  );
  if (!runtimeNuget.ok) return runtimeNuget;

  const runtimeFramework = parseRuntimeFrameworkReferences(
    runtimeObject.value.frameworkReferences
  );
  if (!runtimeFramework.ok) return runtimeFramework;

  const runtimePackages = parseRuntimePackages(
    runtimeObject.value.runtimePackages
  );

  const producer = parsePackageManifestProducer(manifest.producer);
  if (!producer.ok) return producer;
  const requiredTypeRoots = parseRequiredTypeRoots(
    manifest.requiredTypeRoots,
    "requiredTypeRoots",
    packageName
  );
  if (!requiredTypeRoots.ok) return requiredTypeRoots;

  const dotnetParsed = parseManifestDotnet(manifest.dotnet, "dotnet");
  if (!dotnetParsed.ok) return dotnetParsed;
  const testDotnetParsed = parseManifestDotnet(
    manifest.testDotnet,
    "testDotnet"
  );
  if (!testDotnetParsed.ok) return testDotnetParsed;

  return buildNormalizedManifest(
    packageName,
    packageVersion,
    requiredTypeRoots.value,
    producer.value,
    dotnetParsed.value,
    testDotnetParsed.value,
    runtimeNuget.value,
    runtimeFramework.value,
    runtimePackages,
    bindingsRoot
  );
};
