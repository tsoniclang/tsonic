import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Result } from "../../../types.js";
import {
  PACKAGE_MANIFEST_DIAGNOSTIC,
  errorWithCode,
  isSurfaceMode,
  normalizeId,
  readJsonObject,
} from "../shared.js";
import type {
  ManifestSurfaceMode,
  NormalizedBindingsManifest,
} from "../types.js";
import {
  canonicalizeManifestDotnet,
  collectNugetDependencies,
  collectRuntimePackagesFromBindingsManifest,
  parseManifestDotnet,
  parseRequiredTypeRoots,
} from "./dotnet.js";

export const resolveFromBindingsManifest = (
  packageRoot: string,
  packageName: string,
  packageVersion: string
): Result<NormalizedBindingsManifest | null, string> => {
  const manifestPath = join(packageRoot, "tsonic.bindings.json");
  if (!existsSync(manifestPath)) return { ok: true, value: null };

  const parsed = readJsonObject(
    manifestPath,
    PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema
  );
  if (!parsed.ok) return parsed;
  const manifest = parsed.value;

  const bindingVersion = manifest.bindingVersion;
  if (bindingVersion !== undefined && bindingVersion !== 1) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `Unsupported tsonic.bindings.json bindingVersion: ${String(bindingVersion)}`
    );
  }

  const manifestPackageName = manifest.packageName;
  if (manifestPackageName !== undefined) {
    if (
      typeof manifestPackageName !== "string" ||
      normalizeId(manifestPackageName) !== normalizeId(packageName)
    ) {
      return errorWithCode(
        PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
        `tsonic.bindings.json packageName mismatch. Installed: ${packageName}, Manifest: ${String(manifestPackageName)}`
      );
    }
  }

  const manifestPackageVersion = manifest.packageVersion;
  if (manifestPackageVersion !== undefined) {
    if (
      typeof manifestPackageVersion !== "string" ||
      manifestPackageVersion !== packageVersion
    ) {
      return errorWithCode(
        PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
        `tsonic.bindings.json packageVersion mismatch. Installed: ${packageVersion}, Manifest: ${String(manifestPackageVersion)}`
      );
    }
  }

  const surfaceModeRaw = manifest.surfaceMode;
  if (surfaceModeRaw !== undefined && !isSurfaceMode(surfaceModeRaw)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `Invalid tsonic.bindings.json surfaceMode: ${String(surfaceModeRaw)}`
    );
  }
  const surfaceMode =
    (surfaceModeRaw as ManifestSurfaceMode | undefined)?.trim() ?? "clr";
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

  const dotnet = canonicalizeManifestDotnet(dotnetParsed.value);
  const testDotnet = canonicalizeManifestDotnet(testDotnetParsed.value);

  const runtimePackages = Array.isArray(manifest.runtimePackages)
    ? manifest.runtimePackages.filter(
        (value: unknown): value is string => typeof value === "string"
      )
    : undefined;

  return {
    ok: true,
    value: {
      bindingVersion: 1,
      sourceManifest: "tsonic-bindings",
      packageName,
      packageVersion,
      surfaceMode,
      requiredTypeRoots: requiredTypeRoots.value,
      assemblyName:
        typeof manifest.assemblyName === "string"
          ? manifest.assemblyName
          : undefined,
      assemblyVersion:
        typeof manifest.assemblyVersion === "string"
          ? manifest.assemblyVersion
          : undefined,
      targetFramework:
        typeof manifest.targetFramework === "string"
          ? manifest.targetFramework
          : undefined,
      runtimePackages: collectRuntimePackagesFromBindingsManifest(
        packageName,
        runtimePackages,
        dotnet,
        testDotnet
      ),
      dotnet,
      testDotnet,
      nugetDependencies: collectNugetDependencies(dotnet, testDotnet),
    },
  };
};
