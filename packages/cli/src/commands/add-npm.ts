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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

type ManifestSurfaceMode = "clr" | "js" | "nodejs";

type TsonicBindingsManifest = {
  readonly bindingVersion?: number;
  readonly packageName?: string;
  readonly packageVersion?: string;
  readonly surfaceMode?: ManifestSurfaceMode;
  readonly assemblyName?: string;
  readonly assemblyVersion?: string;
  readonly targetFramework?: string;
  readonly runtimePackages?: readonly string[];
  readonly dotnet?: ManifestDotnet;
  readonly testDotnet?: ManifestDotnet;
};

type NormalizedNugetDependency = {
  readonly source:
    | "dotnet.framework"
    | "dotnet.package"
    | "testDotnet.framework"
    | "testDotnet.package";
  readonly id: string;
  readonly version?: string;
};

type NormalizedBindingsManifest = {
  readonly bindingVersion: 1;
  readonly packageName: string;
  readonly packageVersion: string;
  readonly surfaceMode: ManifestSurfaceMode;
  readonly assemblyName?: string;
  readonly assemblyVersion?: string;
  readonly targetFramework?: string;
  readonly runtimePackages: readonly string[];
  readonly nugetDependencies: readonly NormalizedNugetDependency[];
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

const readInstalledPackageInfo = (
  pkgRoot: string
): Result<{ readonly name: string; readonly version: string }, string> => {
  const packageJsonPath = join(pkgRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return {
      ok: false,
      error: `package.json not found for installed npm package: ${pkgRoot}`,
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      readonly name?: unknown;
      readonly version?: unknown;
    };
    if (typeof parsed.name !== "string" || !parsed.name.trim()) {
      return {
        ok: false,
        error: `Invalid package.json (missing name): ${packageJsonPath}`,
      };
    }
    if (typeof parsed.version !== "string" || !parsed.version.trim()) {
      return {
        ok: false,
        error: `Invalid package.json (missing version): ${packageJsonPath}`,
      };
    }
    return {
      ok: true,
      value: { name: parsed.name.trim(), version: parsed.version.trim() },
    };
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

const sortFrameworkReferences = (
  refs: readonly FrameworkReferenceConfig[]
): FrameworkReferenceConfig[] =>
  [...refs].sort((a, b) => {
    const idA = typeof a === "string" ? a : a.id;
    const idB = typeof b === "string" ? b : b.id;
    return normalizeId(idA).localeCompare(normalizeId(idB));
  });

const sortPackageReferences = (
  refs: readonly PackageReferenceConfig[]
): PackageReferenceConfig[] =>
  [...refs].sort((a, b) => {
    const byId = normalizeId(a.id).localeCompare(normalizeId(b.id));
    if (byId !== 0) return byId;
    return a.version.localeCompare(b.version);
  });

const sortMsbuildProperties = (
  props: Readonly<Record<string, string>>
): Record<string, string> => {
  const out: Record<string, string> = {};
  const keys = Object.keys(props).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const value = props[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
};

const canonicalizeManifestDotnet = (
  dotnet: ManifestDotnet | undefined
): ManifestDotnet | undefined => {
  if (!dotnet) return undefined;

  const frameworkReferences = sortFrameworkReferences(
    (dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[]
  );
  const packageReferences = sortPackageReferences(
    (dotnet.packageReferences ?? []) as PackageReferenceConfig[]
  );
  const msbuildProperties = sortMsbuildProperties(
    (dotnet.msbuildProperties ?? {}) as Record<string, string>
  );

  const hasMsbuild = Object.keys(msbuildProperties).length > 0;
  const hasFramework = frameworkReferences.length > 0;
  const hasPackage = packageReferences.length > 0;
  if (!hasMsbuild && !hasFramework && !hasPackage) {
    return undefined;
  }

  return {
    frameworkReferences: hasFramework ? frameworkReferences : undefined,
    packageReferences: hasPackage ? packageReferences : undefined,
    msbuildProperties: hasMsbuild ? msbuildProperties : undefined,
  };
};

const isSurfaceMode = (value: unknown): value is ManifestSurfaceMode =>
  value === "clr" || value === "js" || value === "nodejs";

const validateManifestMetadata = (
  manifest: TsonicBindingsManifest,
  packageName: string,
  packageVersion: string
): Result<void, string> => {
  const bindingVersion = manifest.bindingVersion;
  if (bindingVersion !== undefined && bindingVersion !== 1) {
    return {
      ok: false,
      error:
        `Unsupported tsonic.bindings.json bindingVersion: ${bindingVersion}\n` +
        `Expected: 1`,
    };
  }

  if (
    manifest.packageName !== undefined &&
    normalizeId(manifest.packageName) !== normalizeId(packageName)
  ) {
    return {
      ok: false,
      error:
        `tsonic.bindings.json packageName mismatch.\n` +
        `Installed: ${packageName}\n` +
        `Manifest: ${manifest.packageName}`,
    };
  }

  if (
    manifest.packageVersion !== undefined &&
    manifest.packageVersion !== packageVersion
  ) {
    return {
      ok: false,
      error:
        `tsonic.bindings.json packageVersion mismatch.\n` +
        `Installed: ${packageVersion}\n` +
        `Manifest: ${manifest.packageVersion}`,
    };
  }

  if (
    manifest.surfaceMode !== undefined &&
    !isSurfaceMode(manifest.surfaceMode)
  ) {
    return {
      ok: false,
      error:
        `Invalid tsonic.bindings.json surfaceMode: ${String(manifest.surfaceMode)}\n` +
        `Expected one of: clr, js, nodejs`,
    };
  }

  return { ok: true, value: undefined };
};

const collectRuntimePackages = (
  manifest: TsonicBindingsManifest,
  packageName: string
): string[] => {
  const runtimePkgs = new Set<string>();
  runtimePkgs.add(packageName);

  for (const pkg of manifest.runtimePackages ?? []) {
    if (pkg.trim()) runtimePkgs.add(pkg.trim());
  }

  const collectTypesPackage = (
    refs: readonly FrameworkReferenceConfig[] | readonly PackageReferenceConfig[]
  ): void => {
    for (const ref of refs) {
      if (typeof ref === "string") continue;
      if (typeof ref.types === "string" && ref.types.trim()) {
        runtimePkgs.add(ref.types.trim());
      }
    }
  };

  collectTypesPackage((manifest.dotnet?.frameworkReferences ?? []) as readonly FrameworkReferenceConfig[]);
  collectTypesPackage((manifest.dotnet?.packageReferences ?? []) as readonly PackageReferenceConfig[]);
  collectTypesPackage(
    (manifest.testDotnet?.frameworkReferences ??
      []) as readonly FrameworkReferenceConfig[]
  );
  collectTypesPackage(
    (manifest.testDotnet?.packageReferences ??
      []) as readonly PackageReferenceConfig[]
  );

  return [...runtimePkgs].sort((a, b) => normalizeId(a).localeCompare(normalizeId(b)));
};

const collectNugetDependencies = (
  dotnet: ManifestDotnet | undefined,
  testDotnet: ManifestDotnet | undefined
): NormalizedNugetDependency[] => {
  const dependencies: NormalizedNugetDependency[] = [];

  const addFrameworkRefs = (
    refs: readonly FrameworkReferenceConfig[] | undefined,
    source: "dotnet.framework" | "testDotnet.framework"
  ): void => {
    for (const ref of refs ?? []) {
      const id = typeof ref === "string" ? ref : ref.id;
      dependencies.push({ source, id });
    }
  };

  const addPackageRefs = (
    refs: readonly PackageReferenceConfig[] | undefined,
    source: "dotnet.package" | "testDotnet.package"
  ): void => {
    for (const ref of refs ?? []) {
      dependencies.push({ source, id: ref.id, version: ref.version });
    }
  };

  addFrameworkRefs(dotnet?.frameworkReferences, "dotnet.framework");
  addPackageRefs(dotnet?.packageReferences, "dotnet.package");
  addFrameworkRefs(testDotnet?.frameworkReferences, "testDotnet.framework");
  addPackageRefs(testDotnet?.packageReferences, "testDotnet.package");

  return dependencies.sort((a, b) => {
    const bySource = a.source.localeCompare(b.source);
    if (bySource !== 0) return bySource;
    const byId = normalizeId(a.id).localeCompare(normalizeId(b.id));
    if (byId !== 0) return byId;
    return (a.version ?? "").localeCompare(b.version ?? "");
  });
};

const normalizeBindingsManifest = (
  manifest: TsonicBindingsManifest,
  packageName: string,
  packageVersion: string
): NormalizedBindingsManifest => {
  const dotnet = canonicalizeManifestDotnet(manifest.dotnet);
  const testDotnet = canonicalizeManifestDotnet(manifest.testDotnet);

  return {
    bindingVersion: 1,
    packageName,
    packageVersion,
    surfaceMode: manifest.surfaceMode ?? "clr",
    assemblyName: manifest.assemblyName,
    assemblyVersion: manifest.assemblyVersion,
    targetFramework: manifest.targetFramework,
    runtimePackages: collectRuntimePackages(manifest, packageName),
    nugetDependencies: collectNugetDependencies(dotnet, testDotnet),
    dotnet,
    testDotnet,
  };
};

const writeNormalizedBindingsManifest = (
  workspaceRoot: string,
  packageName: string,
  manifest: NormalizedBindingsManifest
): Result<void, string> => {
  const outDir = join(workspaceRoot, ".tsonic", "manifests", "npm", packageName);
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

  const packageInfoResult = readInstalledPackageInfo(pkgRoot);
  if (!packageInfoResult.ok) return packageInfoResult;
  const packageInfo = packageInfoResult.value;
  if (normalizeId(packageInfo.name) !== normalizeId(packageName)) {
    return {
      ok: false,
      error:
        `Installed package name does not match requested package.\n` +
        `Requested: ${packageName}\n` +
        `Installed: ${packageInfo.name}`,
    };
  }

  const manifestResult = readBindingsManifest(pkgRoot);
  if (!manifestResult.ok) return manifestResult;
  const rawManifest = manifestResult.value;

  const metadataValidation = validateManifestMetadata(
    rawManifest,
    packageInfo.name,
    packageInfo.version
  );
  if (!metadataValidation.ok) return metadataValidation;

  const manifest = normalizeBindingsManifest(
    rawManifest,
    packageInfo.name,
    packageInfo.version
  );

  const writeManifestResult = writeNormalizedBindingsManifest(
    workspaceRoot,
    packageInfo.name,
    manifest
  );
  if (!writeManifestResult.ok) return writeManifestResult;

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
    packageInfo.name,
    options
  );
  if (!dotnetTypesResult.ok) return dotnetTypesResult;

  const testTypesResult = installTypesPackages(
    workspaceRoot,
    manifest.testDotnet,
    packageInfo.name,
    options
  );
  if (!testTypesResult.ok) return testTypesResult;

  return { ok: true, value: { packageName: packageInfo.name } };
};
