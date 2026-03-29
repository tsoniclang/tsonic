/**
 * tsonic add npm - install an npm bindings package and apply its .NET dependency
 * manifest to the workspace.
 *
 * Usage:
 *   tsonic add npm <packageSpec>
 *
 * Supported manifest contracts (airplane-grade):
 * - `tsonic.package.json` (native source-package metadata)
 * - `tsonic.bindings.json` (CLR bindings metadata)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Result } from "../types.js";
import { loadWorkspaceConfig } from "../config.js";
import {
  npmInstallDevDependency,
  resolvePackageRoot,
  writeTsonicJson,
  type AddCommandOptions,
} from "./add-common.js";
import {
  discoverWorkspaceBindingsManifests,
  hasInstalledSourcePackageManifest,
  mergeManifestIntoWorkspaceConfig,
  resolveInstalledPackageBindingsManifest,
  type ManifestDotnet,
  type NormalizedBindingsManifest,
} from "../package-manifests/bindings.js";

export type AddNpmOptions = AddCommandOptions;

const parseNpmPackageName = (rawSpec: string): string | null => {
  const spec = rawSpec.trim();
  if (!spec) return null;

  if (
    spec.startsWith("file:") ||
    spec.startsWith(".") ||
    spec.startsWith("/") ||
    spec.includes("\\")
  ) {
    return null;
  }

  if (spec.startsWith("@")) {
    const match = spec.match(/^(@[^/]+\/[^@/]+)(?:@.+)?$/);
    return match?.[1] ?? null;
  }

  const match = spec.match(/^([^@/]+)(?:@.+)?$/);
  return match?.[1] ?? null;
};

const resolvePathSpec = (
  workspaceRoot: string,
  rawSpec: string
): string | null => {
  const spec = rawSpec.trim();
  if (!spec) return null;

  const asPath = spec.startsWith("file:") ? spec.slice("file:".length) : spec;
  if (
    asPath.startsWith(".") ||
    asPath.startsWith("/") ||
    asPath.startsWith("..")
  ) {
    return resolve(workspaceRoot, asPath);
  }
  return null;
};

const readLocalPackageName = (pkgDir: string): Result<string, string> => {
  const pkgJson = join(pkgDir, "package.json");
  if (!existsSync(pkgJson)) {
    return { ok: false, error: `package.json not found at: ${pkgJson}` };
  }

  try {
    const parsed = JSON.parse(readFileSync(pkgJson, "utf-8")) as {
      readonly name?: unknown;
    };
    if (typeof parsed.name !== "string" || !parsed.name.trim()) {
      return {
        ok: false,
        error: `Invalid package.json (missing "name"): ${pkgJson}`,
      };
    }
    return { ok: true, value: parsed.name.trim() };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse package.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const resolvePackageNameFromSpec = (
  workspaceRoot: string,
  packageSpec: string
): Result<string, string> => {
  const direct = parseNpmPackageName(packageSpec);
  if (direct) return { ok: true, value: direct };

  const pathSpec = resolvePathSpec(workspaceRoot, packageSpec);
  if (pathSpec) return readLocalPackageName(pathSpec);

  return {
    ok: false,
    error:
      `Cannot determine npm package name from spec: ${packageSpec}\n` +
      `Use a standard npm spec (e.g., @scope/pkg@1.2.3) or a local directory (file:./path).`,
  };
};

const writeNormalizedBindingsManifest = (
  workspaceRoot: string,
  packageName: string,
  manifest: NormalizedBindingsManifest
): Result<void, string> => {
  const outDir = join(
    workspaceRoot,
    ".tsonic",
    "manifests",
    "npm",
    packageName
  );
  const outPath = join(outDir, "tsonic.bindings.normalized.json");
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write normalized bindings manifest: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const writeNormalizedBindingsManifests = (
  workspaceRoot: string,
  manifests: readonly NormalizedBindingsManifest[]
): Result<void, string> => {
  for (const manifest of manifests) {
    const writeResult = writeNormalizedBindingsManifest(
      workspaceRoot,
      manifest.packageName,
      manifest
    );
    if (!writeResult.ok) return writeResult;
  }
  return { ok: true, value: undefined };
};

const installTypesPackages = (
  workspaceRoot: string,
  manifest: ManifestDotnet | undefined,
  selfPackageName: string,
  options: AddNpmOptions
): Result<void, string> => {
  const typesToInstall = new Set<string>();

  for (const ref of manifest?.frameworkReferences ?? []) {
    if (typeof ref === "string") continue;
    if (typeof ref.types === "string") typesToInstall.add(ref.types);
  }

  for (const p of manifest?.packageReferences ?? []) {
    if (typeof p.types === "string") typesToInstall.add(p.types);
  }

  typesToInstall.delete(selfPackageName);

  for (const pkg of typesToInstall) {
    const r = npmInstallDevDependency(workspaceRoot, pkg, options);
    if (!r.ok) return r;
  }

  return { ok: true, value: undefined };
};

const installTypesPackagesForManifests = (
  workspaceRoot: string,
  manifests: readonly NormalizedBindingsManifest[],
  options: AddNpmOptions
): Result<void, string> => {
  for (const manifest of manifests) {
    const dotnetTypesResult = installTypesPackages(
      workspaceRoot,
      manifest.dotnet,
      manifest.packageName,
      options
    );
    if (!dotnetTypesResult.ok) return dotnetTypesResult;

    const testTypesResult = installTypesPackages(
      workspaceRoot,
      manifest.testDotnet,
      manifest.packageName,
      options
    );
    if (!testTypesResult.ok) return testTypesResult;
  }

  return { ok: true, value: undefined };
};

export const addNpmCommand = (
  packageSpec: string,
  configPath: string,
  options: AddNpmOptions = {}
): Result<{ readonly packageName: string }, string> => {
  const workspaceRoot = dirname(configPath);
  const configResult = loadWorkspaceConfig(configPath);
  if (!configResult.ok) return configResult;

  const nameResult = resolvePackageNameFromSpec(workspaceRoot, packageSpec);
  if (!nameResult.ok) return nameResult;
  const requestedPackageName = nameResult.value;

  const preinstalledPackageRoot = resolvePackageRoot(
    workspaceRoot,
    requestedPackageName
  );
  const shouldSkipInstall =
    options.skipInstallIfPresent === true && preinstalledPackageRoot.ok;

  if (!shouldSkipInstall) {
    const installResult = npmInstallDevDependency(
      workspaceRoot,
      packageSpec,
      options
    );
    if (!installResult.ok) return installResult;
  }

  const pkgRootResult = shouldSkipInstall
    ? preinstalledPackageRoot
    : resolvePackageRoot(workspaceRoot, requestedPackageName);
  if (!pkgRootResult.ok) return pkgRootResult;
  const pkgRoot = pkgRootResult.value;

  const manifestResult = resolveInstalledPackageBindingsManifest(pkgRoot);
  if (!manifestResult.ok) return manifestResult;
  const manifest = manifestResult.value;
  if (!manifest) {
    const sourcePackageResult = hasInstalledSourcePackageManifest(pkgRoot);
    if (!sourcePackageResult.ok) return sourcePackageResult;
    if (sourcePackageResult.value) {
      return { ok: true, value: { packageName: requestedPackageName } };
    }
    return {
      ok: false,
      error:
        `Missing manifest in npm package: ${pkgRoot}\n` +
        `Expected one of:\n` +
        `- tsonic.package.json\n` +
        `- tsonic.bindings.json`,
    };
  }

  const discovered = discoverWorkspaceBindingsManifests(
    workspaceRoot,
    configResult.value.surface
  );
  if (!discovered.ok) return discovered;

  const resolvedManifests = discovered.value;
  const requestedResolved = resolvedManifests.some(
    (m) =>
      m.packageName === manifest.packageName &&
      m.packageVersion === manifest.packageVersion
  );
  if (!requestedResolved) {
    return {
      ok: false,
      error:
        `Installed npm package '${manifest.packageName}@${manifest.packageVersion}' ` +
        `was not found during workspace manifest discovery.`,
    };
  }

  const writeAllResult = writeNormalizedBindingsManifests(
    workspaceRoot,
    resolvedManifests
  );
  if (!writeAllResult.ok) return writeAllResult;

  let mergedConfig = configResult.value;
  for (const item of resolvedManifests) {
    const merged = mergeManifestIntoWorkspaceConfig(
      mergedConfig,
      item,
      undefined,
      { workspaceRoot }
    );
    if (!merged.ok) return merged;
    mergedConfig = merged.value;
  }

  const writeResult = writeTsonicJson(configPath, mergedConfig);
  if (!writeResult.ok) return writeResult;

  const typesResult = installTypesPackagesForManifests(
    workspaceRoot,
    resolvedManifests,
    options
  );
  if (!typesResult.ok) return typesResult;

  return { ok: true, value: { packageName: manifest.packageName } };
};
