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
import type { NormalizedBindingsManifest } from "../types.js";
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
    return { ok: true, value: null };
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
  if (
    runtime === null ||
    typeof runtime !== "object" ||
    Array.isArray(runtime)
  ) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.missingRuntimeMapping,
      `runtime must be an object at ${path}`
    );
  }

  const runtimeNuget = parseRuntimeNugetPackages(
    (runtime as { readonly nugetPackages?: unknown }).nugetPackages
  );
  if (!runtimeNuget.ok) return runtimeNuget;

  const runtimeFramework = parseRuntimeFrameworkReferences(
    (runtime as { readonly frameworkReferences?: unknown }).frameworkReferences
  );
  if (!runtimeFramework.ok) return runtimeFramework;

  const runtimePackages = parseRuntimePackages(
    (runtime as { readonly runtimePackages?: unknown }).runtimePackages
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

  const mergedDotnetPackages = mergePackageReferences(
    (dotnetParsed.value?.packageReferences ?? []) as PackageReferenceConfig[],
    runtimeNuget.value as PackageReferenceConfig[],
    PACKAGE_MANIFEST_DIAGNOSTIC.conflictingRuntime
  );
  if (!mergedDotnetPackages.ok) return mergedDotnetPackages;

  const mergedDotnetFramework = mergeFrameworkReferences(
    (dotnetParsed.value?.frameworkReferences ??
      []) as FrameworkReferenceConfig[],
    runtimeFramework.value as FrameworkReferenceConfig[],
    PACKAGE_MANIFEST_DIAGNOSTIC.conflictingRuntime
  );
  if (!mergedDotnetFramework.ok) return mergedDotnetFramework;

  const dotnet = canonicalizeManifestDotnet({
    frameworkReferences: mergedDotnetFramework.value,
    packageReferences: mergedDotnetPackages.value,
    msbuildProperties: dotnetParsed.value?.msbuildProperties,
  });
  const testDotnet = canonicalizeManifestDotnet(testDotnetParsed.value);

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
      requiredTypeRoots: requiredTypeRoots.value,
      bindingsRoot,
      runtimePackages: [...runtimeSet].sort((a, b) =>
        normalizeId(a).localeCompare(normalizeId(b))
      ),
      producer: producer.value,
      dotnet,
      testDotnet,
      nugetDependencies: collectNugetDependencies(dotnet, testDotnet),
    },
  };
};
