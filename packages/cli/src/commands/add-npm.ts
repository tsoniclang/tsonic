/**
 * tsonic add npm - install an npm bindings package and apply its .NET dependency
 * manifest to the workspace.
 *
 * Usage:
 *   tsonic add npm <packageSpec>
 *
 * The npm package must include `tsonic.bindings.json` at its package root.
 * That manifest is the ONLY mechanism used to discover .NET deps (airplane-grade).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
  Result,
  TsonicWorkspaceConfig,
} from "../types.js";
import { loadWorkspaceConfig } from "../config.js";
import {
  npmInstallDevDependency,
  resolvePackageRoot,
  writeTsonicJson,
  type AddCommandOptions,
} from "./add-common.js";

export type AddNpmOptions = AddCommandOptions;

type ManifestDotnet = {
  readonly frameworkReferences?: readonly FrameworkReferenceConfig[];
  readonly packageReferences?: readonly PackageReferenceConfig[];
  readonly msbuildProperties?: Readonly<Record<string, string>>;
};

type TsonicBindingsManifest = {
  readonly dotnet?: ManifestDotnet;
  readonly testDotnet?: ManifestDotnet;
};

const normalizeId = (id: string): string => id.trim().toLowerCase();

const parseNpmPackageName = (rawSpec: string): string | null => {
  const spec = rawSpec.trim();
  if (!spec) return null;

  // Reject path-ish specs; these are handled separately.
  if (
    spec.startsWith("file:") ||
    spec.startsWith(".") ||
    spec.startsWith("/") ||
    spec.includes("\\")
  ) {
    return null;
  }

  // Scoped: @scope/pkg[@ver]
  if (spec.startsWith("@")) {
    const match = spec.match(/^(@[^/]+\/[^@/]+)(?:@.+)?$/);
    return match?.[1] ?? null;
  }

  // Unscoped: pkg[@ver]
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

const readBindingsManifest = (
  pkgRoot: string
): Result<TsonicBindingsManifest, string> => {
  const manifestPath = join(pkgRoot, "tsonic.bindings.json");
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      error:
        `Missing tsonic.bindings.json in npm package: ${pkgRoot}\n` +
        `This package does not declare its .NET dependency graph for Tsonic.`,
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as unknown;
    if (parsed === null || typeof parsed !== "object") {
      return {
        ok: false,
        error: `Invalid tsonic.bindings.json (must be an object): ${manifestPath}`,
      };
    }
    return { ok: true, value: parsed as TsonicBindingsManifest };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse tsonic.bindings.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const mergeFrameworkReferences = (
  existing: readonly FrameworkReferenceConfig[],
  incoming: readonly FrameworkReferenceConfig[]
): Result<FrameworkReferenceConfig[], string> => {
  const out: FrameworkReferenceConfig[] = [...existing];

  const byId = new Map<string, FrameworkReferenceConfig>();
  for (const ref of out) {
    const id = typeof ref === "string" ? ref : ref.id;
    byId.set(normalizeId(id), ref);
  }

  for (const ref of incoming) {
    const id = typeof ref === "string" ? ref : ref.id;
    const key = normalizeId(id);
    const current = byId.get(key);
    if (!current) {
      out.push(ref);
      byId.set(key, ref);
      continue;
    }

    const currentTypes =
      typeof current === "string" ? undefined : current.types;
    const nextTypes = typeof ref === "string" ? undefined : ref.types;

    if (
      nextTypes !== undefined &&
      currentTypes !== undefined &&
      currentTypes !== nextTypes
    ) {
      return {
        ok: false,
        error:
          `Conflicting framework types mapping for '${id}'.\n` +
          `Existing: ${String(currentTypes)}\n` +
          `Manifest: ${String(nextTypes)}\n` +
          `Refusing to change automatically (airplane-grade). Update tsonic.workspace.json manually if intended.`,
      };
    }

    // If existing is string and incoming has types, upgrade entry to object.
    if (typeof current === "string" && typeof ref !== "string") {
      const idx = out.findIndex(
        (x) =>
          (typeof x === "string" ? x : x.id).toLowerCase() ===
          current.toLowerCase()
      );
      if (idx >= 0) out[idx] = { id: current, types: ref.types };
      byId.set(key, out[idx] as FrameworkReferenceConfig);
    }
  }

  return { ok: true, value: out };
};

const mergePackageReferences = (
  existing: readonly PackageReferenceConfig[],
  incoming: readonly PackageReferenceConfig[]
): Result<PackageReferenceConfig[], string> => {
  const out: PackageReferenceConfig[] = [...existing];
  const byId = new Map<string, PackageReferenceConfig>();
  for (const p of out) byId.set(normalizeId(p.id), p);

  for (const p of incoming) {
    const key = normalizeId(p.id);
    const current = byId.get(key);
    if (!current) {
      out.push(p);
      byId.set(key, p);
      continue;
    }

    if (current.version !== p.version) {
      return {
        ok: false,
        error:
          `NuGet package already present with a different version: ${current.id} ${current.version}\n` +
          `Manifest requested: ${p.id} ${p.version}\n` +
          `Refusing to change versions automatically (airplane-grade). Update tsonic.workspace.json manually if intended.`,
      };
    }

    if (
      p.types !== undefined &&
      current.types !== undefined &&
      current.types !== p.types
    ) {
      return {
        ok: false,
        error:
          `NuGet package already present with a different types mapping:\n` +
          `- ${current.id} ${current.version}\n` +
          `- existing: ${String(current.types)}\n` +
          `- manifest: ${String(p.types)}\n` +
          `Refusing to change automatically (airplane-grade). Update tsonic.workspace.json manually if intended.`,
      };
    }

    if (current.types === undefined && p.types !== undefined) {
      const idx = out.findIndex((x) => normalizeId(x.id) === key);
      if (idx >= 0) out[idx] = { ...current, types: p.types };
      byId.set(key, out[idx] as PackageReferenceConfig);
    }
  }

  return { ok: true, value: out };
};

const mergeMsbuildProperties = (
  existing: Readonly<Record<string, string>>,
  incoming: Readonly<Record<string, string>>
): Result<Record<string, string>, string> => {
  const out: Record<string, string> = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    const current = out[k];
    if (current !== undefined && current !== v) {
      return {
        ok: false,
        error:
          `Conflicting msbuildProperties for key '${k}'.\n` +
          `Existing: ${current}\n` +
          `Manifest: ${v}\n` +
          `Refusing to change automatically (airplane-grade). Update tsonic.workspace.json manually if intended.`,
      };
    }
    out[k] = v;
  }
  return { ok: true, value: out };
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

  // If the manifest points back at itself, avoid re-installing redundantly.
  typesToInstall.delete(selfPackageName);

  for (const pkg of typesToInstall) {
    const r = npmInstallDevDependency(workspaceRoot, pkg, options);
    if (!r.ok) return r;
  }

  return { ok: true, value: undefined };
};

export const addNpmCommand = (
  packageSpec: string,
  configPath: string,
  options: AddNpmOptions = {}
): Result<{ readonly packageName: string }, string> => {
  const workspaceRoot = dirname(configPath);

  const nameResult = resolvePackageNameFromSpec(workspaceRoot, packageSpec);
  if (!nameResult.ok) return nameResult;
  const packageName = nameResult.value;

  const installResult = npmInstallDevDependency(
    workspaceRoot,
    packageSpec,
    options
  );
  if (!installResult.ok) return installResult;

  const pkgRootResult = resolvePackageRoot(workspaceRoot, packageName);
  if (!pkgRootResult.ok) return pkgRootResult;
  const pkgRoot = pkgRootResult.value;

  const manifestResult = readBindingsManifest(pkgRoot);
  if (!manifestResult.ok) return manifestResult;
  const manifest = manifestResult.value;

  const configResult = loadWorkspaceConfig(configPath);
  if (!configResult.ok) return configResult;
  const config = configResult.value;

  const dotnet = config.dotnet ?? {};
  const testDotnet = config.testDotnet ?? {};

  const mergedFramework = mergeFrameworkReferences(
    (dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[],
    (manifest.dotnet?.frameworkReferences ?? []) as FrameworkReferenceConfig[]
  );
  if (!mergedFramework.ok) return mergedFramework;

  const mergedPackages = mergePackageReferences(
    (dotnet.packageReferences ?? []) as PackageReferenceConfig[],
    (manifest.dotnet?.packageReferences ?? []) as PackageReferenceConfig[]
  );
  if (!mergedPackages.ok) return mergedPackages;

  const mergedMsbuild = mergeMsbuildProperties(
    (dotnet.msbuildProperties ?? {}) as Record<string, string>,
    (manifest.dotnet?.msbuildProperties ?? {}) as Record<string, string>
  );
  if (!mergedMsbuild.ok) return mergedMsbuild;

  const mergedTestFramework = mergeFrameworkReferences(
    (testDotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[],
    (manifest.testDotnet?.frameworkReferences ??
      []) as FrameworkReferenceConfig[]
  );
  if (!mergedTestFramework.ok) return mergedTestFramework;

  const mergedTestPackages = mergePackageReferences(
    (testDotnet.packageReferences ?? []) as PackageReferenceConfig[],
    (manifest.testDotnet?.packageReferences ?? []) as PackageReferenceConfig[]
  );
  if (!mergedTestPackages.ok) return mergedTestPackages;

  const mergedTestMsbuild = mergeMsbuildProperties(
    (testDotnet.msbuildProperties ?? {}) as Record<string, string>,
    (manifest.testDotnet?.msbuildProperties ?? {}) as Record<string, string>
  );
  if (!mergedTestMsbuild.ok) return mergedTestMsbuild;

  const nextConfig: TsonicWorkspaceConfig = {
    ...config,
    dotnet: {
      ...dotnet,
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
  };

  const writeResult = writeTsonicJson(configPath, nextConfig);
  if (!writeResult.ok) return writeResult;

  const dotnetTypesResult = installTypesPackages(
    workspaceRoot,
    manifest.dotnet,
    packageName,
    options
  );
  if (!dotnetTypesResult.ok) return dotnetTypesResult;

  const testTypesResult = installTypesPackages(
    workspaceRoot,
    manifest.testDotnet,
    packageName,
    options
  );
  if (!testTypesResult.ok) return testTypesResult;

  return { ok: true, value: { packageName } };
};
