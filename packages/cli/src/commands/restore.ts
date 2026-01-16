/**
 * tsonic restore - restore .NET dependencies and (re)generate local bindings.
 *
 * This is the "clone a repo and get to green" command:
 * - Runs dotnet restore for NuGet PackageReferences from tsonic.json
 * - Generates bindings for all transitive NuGet package deps (no duplicates)
 * - Generates bindings for all local DLLs in dotnet.libraries (no duplicates)
 * - Generates bindings for FrameworkReferences when present
 *
 * Airplane-grade rules:
 * - Deterministic dependency closure; no "copy everything" modes
 * - No ambiguous ownership: each CLR type must have exactly one bindings owner
 * - Fail fast with actionable errors
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve, relative } from "node:path";
import type { Result, TsonicWorkspaceConfig } from "../types.js";
import { isBuiltInRuntimeDllPath } from "../dotnet/runtime-dlls.js";
import { findWorkspaceConfig, loadConfig, loadWorkspaceConfig } from "../config.js";
import { resolveNugetConfigFile } from "../dotnet/nuget-config.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForDll,
  defaultBindingsPackageNameForFramework,
  defaultBindingsPackageNameForNuget,
  detectTsbindgenNaming,
  ensureGeneratedBindingsPackageJson,
  installGeneratedBindingsPackage,
  listDotnetRuntimes,
  resolveFromProjectRoot,
  resolvePackageRoot,
  resolveTsbindgenDllPath,
  tsbindgenGenerate,
  tsbindgenResolveClosure,
  type AddCommandOptions,
  type Exec,
  defaultExec,
  writeTsonicJson,
} from "./add-common.js";

export type RestoreOptions = AddCommandOptions & {
  /**
   * Skip bindings re-generation when inputs are unchanged.
   * In incremental mode we still verify/install generated packages into node_modules.
   */
  readonly incremental?: boolean;
};

type LibraryConfig = string | { readonly path: string; readonly types?: string };

const normalizeLibraryPathKey = (p: string): string =>
  p.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();

const getLibraryPath = (entry: LibraryConfig): string =>
  typeof entry === "string" ? entry : entry.path;

const getLibraryTypes = (entry: LibraryConfig): string | undefined =>
  typeof entry === "string" ? undefined : entry.types;

const sha256Hex = (data: string): string =>
  createHash("sha256").update(data, "utf-8").digest("hex");

const sha256FileHex = (path: string): Result<string, string> => {
  try {
    const data = readFileSync(path);
    return {
      ok: true,
      value: createHash("sha256").update(new Uint8Array(data)).digest("hex"),
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to read file for hashing: ${path}\n${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

type GeneratedBindingsMeta = {
  readonly fingerprint?: string;
};

const readNpmPackageIdentity = (
  packageRoot: string
): Result<{ readonly name: string; readonly version: string }, string> => {
  const pkgJsonPath = join(packageRoot, "package.json");
  if (!existsSync(pkgJsonPath)) {
    return { ok: false, error: `package.json not found for npm package at: ${packageRoot}` };
  }
  try {
    const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as {
      name?: unknown;
      version?: unknown;
    };
    const name = typeof parsed.name === "string" ? parsed.name : "";
    const version = typeof parsed.version === "string" ? parsed.version : "";
    if (!name || !version) {
      return { ok: false, error: `Invalid package.json at ${pkgJsonPath} (missing name/version)` };
    }
    return { ok: true, value: { name, version } };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse ${pkgJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const computeExternalTypesFingerprint = (
  projectRoot: string,
  packageName: string
): Result<{ readonly fingerprint: string; readonly packageRoot: string }, string> => {
  const root = resolvePackageRoot(projectRoot, packageName);
  if (!root.ok) return root;
  const identity = readNpmPackageIdentity(root.value);
  if (!identity.ok) return identity;
  return {
    ok: true,
    value: { packageRoot: root.value, fingerprint: `npm:${identity.value.name}@${identity.value.version}` },
  };
};

const readGeneratedBindingsMeta = (dir: string): Result<GeneratedBindingsMeta, string> => {
  const pkgJsonPath = join(dir, "package.json");
  if (!existsSync(pkgJsonPath)) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as Record<string, unknown>;
    const tsonic = (parsed.tsonic ?? {}) as Record<string, unknown>;
    if (tsonic.generated !== true) return { ok: true, value: {} };
    const fingerprint = typeof tsonic.fingerprint === "string" ? tsonic.fingerprint : undefined;
    return { ok: true, value: { fingerprint } };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse ${pkgJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const writeGeneratedBindingsFingerprint = (
  dir: string,
  fingerprint: string,
  signature: Record<string, unknown>
): Result<void, string> => {
  const pkgJsonPath = join(dir, "package.json");
  if (!existsSync(pkgJsonPath)) {
    return { ok: false, error: `Internal error: missing bindings package.json at ${pkgJsonPath}` };
  }
  try {
    const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as Record<string, unknown>;
    const tsonic = (parsed.tsonic ?? {}) as Record<string, unknown>;
    if (tsonic.generated !== true) {
      return {
        ok: false,
        error: `Refusing to write fingerprint into non-generated package.json: ${pkgJsonPath}`,
      };
    }
    parsed.tsonic = { ...tsonic, fingerprint, signature };
    writeFileSync(pkgJsonPath, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write fingerprint into ${pkgJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

type PackageReference = { readonly id: string; readonly version: string };
type PackageReferenceConfig = {
  readonly id: string;
  readonly version: string;
  readonly types?: string;
};

type FrameworkReferenceConfig =
  | string
  | { readonly id: string; readonly types?: string };

type ProjectAssets = {
  readonly targets?: Record<string, unknown>;
  readonly libraries?: Record<string, { readonly type?: string; readonly path?: string }>;
  readonly packageFolders?: Record<string, unknown>;
};

type PackageTarget = {
  readonly libKey: string;
  readonly packageId: string;
  readonly version: string;
  readonly dlls: readonly string[];
  readonly dependencies: readonly string[]; // Package IDs
};

const normalizePkgId = (id: string): string => id.trim().toLowerCase();

const pickPackageFolder = (assets: ProjectAssets): string | undefined => {
  const folders = assets.packageFolders ? Object.keys(assets.packageFolders) : [];
  if (folders.length === 0) return undefined;
  return folders[0];
};

const findTargetKey = (assets: ProjectAssets, tfm: string): string | undefined => {
  const targets = assets.targets ? Object.keys(assets.targets) : [];
  if (targets.includes(tfm)) return tfm;
  return targets.find((k) => k.startsWith(`${tfm}/`));
};

const parseLibKey = (libKey: string): { readonly id: string; readonly version: string } | undefined => {
  const idx = libKey.indexOf("/");
  if (idx <= 0) return undefined;
  const id = libKey.slice(0, idx);
  const version = libKey.slice(idx + 1);
  if (!id || !version) return undefined;
  return { id, version };
};

const collectPackageTargets = (
  assets: ProjectAssets,
  targetKey: string,
  packageFolder: string
): ReadonlyMap<string, PackageTarget> => {
  const targets = assets.targets?.[targetKey];
  const libraries = assets.libraries ?? {};
  const byLibrary = new Map<string, PackageTarget>();

  if (!targets || typeof targets !== "object") return byLibrary;

  for (const [libKey, libValue] of Object.entries(targets as Record<string, unknown>)) {
    if (!libKey || !libValue || typeof libValue !== "object") continue;
    const parsed = parseLibKey(libKey);
    if (!parsed) continue;

    const libInfo = libraries[libKey];
    if (!libInfo || libInfo.type !== "package" || !libInfo.path) continue;

    const depsObj = (libValue as Record<string, unknown>).dependencies;
    const dependencies =
      depsObj && typeof depsObj === "object"
        ? Object.keys(depsObj as Record<string, unknown>).filter(Boolean)
        : [];

    const compile = (libValue as Record<string, unknown>).compile;
    const dlls =
      compile && typeof compile === "object"
        ? Object.keys(compile as Record<string, unknown>)
            .filter((p) => p.toLowerCase().endsWith(".dll"))
            .map((p) => join(packageFolder, libInfo.path as string, p))
        : [];

    if (dlls.length === 0 && dependencies.length === 0) continue;

    byLibrary.set(libKey, {
      libKey,
      packageId: parsed.id,
      version: parsed.version,
      dlls,
      dependencies,
    });
  }

  return byLibrary;
};

const writeRestoreProject = (
  restoreDir: string,
  targetFramework: string,
  packageReferences: readonly PackageReference[]
): Result<string, string> => {
  try {
    mkdirSync(restoreDir, { recursive: true });
    const csprojPath = join(restoreDir, "tsonic.nuget.restore.csproj");
    const itemGroup = packageReferences
      .map((p) => `    <PackageReference Include="${p.id}" Version="${p.version}" />`)
      .join("\n");

    const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>${targetFramework}</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
${itemGroup}
  </ItemGroup>
</Project>
`;
    writeFileSync(csprojPath, csproj, "utf-8");
    return { ok: true, value: csprojPath };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write restore project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const dotnetRestore = (
  restoreProjectPath: string,
  nugetConfigFile: string,
  options: RestoreOptions,
  exec: Exec = defaultExec
): Result<string, string> => {
  const restoreDir = dirname(restoreProjectPath);
  const result = exec(
    "dotnet",
    ["restore", restoreProjectPath, "--configfile", nugetConfigFile],
    restoreDir,
    options.verbose ? "inherit" : "pipe"
  );
  if (result.status !== 0) {
    const msg = result.stderr || result.stdout || "Unknown error";
    return { ok: false, error: `dotnet restore failed:\n${msg}` };
  }

  const assetsPath = join(restoreDir, "obj", "project.assets.json");
  if (!existsSync(assetsPath)) {
    return { ok: false, error: `Restore succeeded but assets file missing: ${assetsPath}` };
  }
  return { ok: true, value: assetsPath };
};

const addUniqueFrameworkReference = (
  arr: FrameworkReferenceConfig[],
  value: string
): void => {
  if (
    !arr.some(
      (r) =>
        (typeof r === "string" ? r : r.id).toLowerCase() === value.toLowerCase()
    )
  ) {
    arr.push(value);
  }
};

const pathIsWithin = (path: string, dir: string): boolean => {
  const normalizedDir = dir.endsWith("/") ? dir : `${dir}/`;
  const normalizedPath = path.replace(/\\/g, "/");
  const normalizedBase = normalizedDir.replace(/\\/g, "/");
  return normalizedPath.startsWith(normalizedBase);
};

export const restoreCommand = (
  configPath: string,
  options: RestoreOptions = {}
): Result<void, string> => {
  const isWorkspaceConfig = basename(configPath) === "tsonic.workspace.json";
  const configResult = isWorkspaceConfig
    ? loadWorkspaceConfig(configPath)
    : loadConfig(configPath);
  if (!configResult.ok) return configResult;

  const projectRoot = dirname(configPath);
  const nugetConfigResult = resolveNugetConfigFile(projectRoot);
  if (!nugetConfigResult.ok) return nugetConfigResult;
  const nugetConfigFile = nugetConfigResult.value;
  const rawConfig = configResult.value;
  let config = rawConfig;

  let workspaceCtx:
    | { readonly root: string; readonly config: TsonicWorkspaceConfig }
    | undefined;
  if (!isWorkspaceConfig) {
    const wsPath = findWorkspaceConfig(projectRoot);
    if (wsPath) {
      const ws = loadWorkspaceConfig(wsPath);
      if (!ws.ok) return ws;
      workspaceCtx = { root: dirname(wsPath), config: ws.value };
    }
  }

  const tsbindgenDllResult = resolveTsbindgenDllPath(projectRoot);
  if (!tsbindgenDllResult.ok) return tsbindgenDllResult;
  const tsbindgenDll = tsbindgenDllResult.value;

  const runtimesResult = listDotnetRuntimes(projectRoot);
  if (!runtimesResult.ok) return runtimesResult;
  const runtimes = runtimesResult.value;

  const dotnetRoot = resolvePackageRoot(projectRoot, "@tsonic/dotnet");
  if (!dotnetRoot.ok) return dotnetRoot;
  const coreRoot = resolvePackageRoot(projectRoot, "@tsonic/core");
  if (!coreRoot.ok) return coreRoot;
  const dotnetLib = dotnetRoot.value;
  const coreLib = coreRoot.value;

  const dotnet = config.dotnet ?? {};
  const naming = detectTsbindgenNaming(config);

  const projectDllDirs = (dotnet.dllDirs ?? ["lib"]).map((d) => d.trim());
  const projectDllDirsAbs = projectDllDirs.map((d) =>
    resolveFromProjectRoot(projectRoot, d)
  );

  const workspaceRoot = isWorkspaceConfig
    ? projectRoot
    : workspaceCtx?.root;
  const workspaceDotnet = isWorkspaceConfig
    ? (config as TsonicWorkspaceConfig).dotnet ?? {}
    : workspaceCtx?.config.dotnet ?? {};
  const workspaceDllDirs = (workspaceDotnet.dllDirs ?? ["lib"]).map((d) => d.trim());
  const workspaceDllDirsAbs = workspaceRoot
    ? workspaceDllDirs.map((d) => resolve(workspaceRoot, d))
    : [];

  const tsbindgenHashResult = sha256FileHex(tsbindgenDll);
  if (!tsbindgenHashResult.ok) return tsbindgenHashResult;
  const tsbindgenSha256 = tsbindgenHashResult.value;

  const dotnetIdentity = readNpmPackageIdentity(dotnetLib);
  if (!dotnetIdentity.ok) return dotnetIdentity;
  const coreIdentity = readNpmPackageIdentity(coreLib);
  if (!coreIdentity.ok) return coreIdentity;

  // 1) FrameworkReferences bindings
  for (const entry of (dotnet.frameworkReferences ??
    []) as FrameworkReferenceConfig[]) {
    const frameworkRef = typeof entry === "string" ? entry : entry.id;
    const typesPackage = typeof entry === "string" ? undefined : entry.types;
    if (typesPackage) {
      const ext = computeExternalTypesFingerprint(projectRoot, typesPackage);
      if (!ext.ok) return ext;
      continue; // bindings supplied externally; do not auto-generate.
    }

    const runtime = runtimes.find((r) => r.name === frameworkRef);
    if (!runtime) {
      const available = runtimes.map((r) => `${r.name} ${r.version}`).join("\n");
      return {
        ok: false,
        error:
          `Framework runtime not found: ${frameworkRef}\n` +
          `Installed runtimes:\n${available}`,
      };
    }

    const packageName = defaultBindingsPackageNameForFramework(frameworkRef);
    const outDir = bindingsStoreDir(projectRoot, "framework", packageName);
    const targetDir = join(projectRoot, "node_modules", packageName);

    const pkgJsonResult = ensureGeneratedBindingsPackageJson(outDir, packageName, {
      kind: "framework",
      source: { frameworkReference: frameworkRef },
    });
    if (!pkgJsonResult.ok) return pkgJsonResult;

    const depsAbs = (options.deps ?? [])
      .map((d) => resolveFromProjectRoot(projectRoot, d))
      .sort((a, b) => a.localeCompare(b));

    const signature: Record<string, unknown> = {
      schemaVersion: 1,
      kind: "framework",
      packageName,
      naming,
      strict: options.strict === true,
      tool: { tsbindgenSha256 },
      libs: {
        dotnet: dotnetIdentity.value,
        core: coreIdentity.value,
      },
      source: { frameworkReference: frameworkRef, runtime: runtime },
      refDirs: [
        ...runtimes
          .map((r) => ({ name: r.name, version: r.version, dir: r.dir }))
          .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)),
        ...depsAbs.map((d) => ({ dir: d })),
      ],
    };
    const fingerprint = `sha256:${sha256Hex(JSON.stringify(signature))}`;

    const generateArgs: string[] = [
      "-d",
      runtime.dir,
      "-o",
      outDir,
      "--naming",
      naming,
      "--lib",
      dotnetLib,
      "--lib",
      coreLib,
    ];
    for (const rt of runtimes) generateArgs.push("--ref-dir", rt.dir);
    for (const dep of options.deps ?? []) {
      generateArgs.push("--ref-dir", resolveFromProjectRoot(projectRoot, dep));
    }

    const meta = readGeneratedBindingsMeta(targetDir);
    if (!meta.ok) return meta;

    const needsGenerate = !options.incremental || meta.value.fingerprint !== fingerprint;

    if (needsGenerate) {
      const genResult = tsbindgenGenerate(projectRoot, tsbindgenDll, generateArgs, options);
      if (!genResult.ok) return genResult;
      const fpWrite = writeGeneratedBindingsFingerprint(outDir, fingerprint, signature);
      if (!fpWrite.ok) return fpWrite;
      const installResult = installGeneratedBindingsPackage(projectRoot, packageName, outDir);
      if (!installResult.ok) return installResult;
    }
  }

  // 2) NuGet PackageReferences bindings (including transitive deps)
  const packageReferencesAll = (dotnet.packageReferences ??
    []) as PackageReferenceConfig[];
  if (packageReferencesAll.length > 0) {
    const targetFramework =
      config.dotnetVersion ?? workspaceCtx?.config.dotnetVersion ?? "net10.0";
    const restoreDir = join(projectRoot, ".tsonic", "nuget");
    const restoreProject = writeRestoreProject(
      restoreDir,
      targetFramework,
      packageReferencesAll.map((p) => ({ id: p.id, version: p.version }))
    );
    if (!restoreProject.ok) return restoreProject;

    const assetsPathResult = dotnetRestore(restoreProject.value, nugetConfigFile, options);
    if (!assetsPathResult.ok) return assetsPathResult;

    let assets: ProjectAssets;
    try {
      assets = JSON.parse(readFileSync(assetsPathResult.value, "utf-8")) as ProjectAssets;
    } catch (error) {
      return {
        ok: false,
        error: `Failed to parse project.assets.json: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const packageFolder = pickPackageFolder(assets);
    if (!packageFolder) {
      return { ok: false, error: "project.assets.json missing packageFolders (unexpected)" };
    }

    const targetKey = findTargetKey(assets, targetFramework);
    if (!targetKey) {
      const available = assets.targets ? Object.keys(assets.targets).join("\n") : "(none)";
      return {
        ok: false,
        error: `No restore target found for ${targetFramework}. Available targets:\n${available}`,
      };
    }

    const packagesByLibKey = collectPackageTargets(assets, targetKey, packageFolder);

    const libKeyByPkgId = new Map<string, string>();
    for (const node of packagesByLibKey.values()) {
      const norm = normalizePkgId(node.packageId);
      const existingKey = libKeyByPkgId.get(norm);
      if (existingKey && existingKey !== node.libKey) {
        return {
          ok: false,
          error:
            `Ambiguous restore result: multiple resolved library keys for package '${node.packageId}'.\n` +
            `- ${existingKey}\n` +
            `- ${node.libKey}\n` +
            `This indicates multiple versions were resolved, which is not supported.`,
        };
      }
      libKeyByPkgId.set(norm, node.libKey);
    }

    const shouldAutoGenerate = (p: PackageReferenceConfig): boolean =>
      p.types === undefined || p.types.trim().length === 0;

    const typesPackageByPkgId = new Map<string, string>();
    const typesInfoByPkgId = new Map<string, { readonly libDir: string; readonly fingerprint: string }>();

    for (const pr of packageReferencesAll) {
      if (!pr.types || pr.types.trim().length === 0) continue;
      const norm = normalizePkgId(pr.id);
      const existing = typesPackageByPkgId.get(norm);
      if (existing && existing !== pr.types) {
        return {
          ok: false,
          error:
            `NuGet package '${pr.id}' is configured with multiple different 'types' packages:\n` +
            `- ${existing}\n` +
            `- ${pr.types}\n` +
            `Refusing to proceed (airplane-grade). Fix your tsonic.json to have a single owner.`,
        };
      }
      typesPackageByPkgId.set(norm, pr.types);
      if (!typesInfoByPkgId.has(norm)) {
        const info = computeExternalTypesFingerprint(projectRoot, pr.types);
        if (!info.ok) return info;
        typesInfoByPkgId.set(norm, { libDir: info.value.packageRoot, fingerprint: info.value.fingerprint });
      }
    }

    const roots: string[] = [];
    for (const pr of packageReferencesAll.filter(shouldAutoGenerate)) {
      const root = libKeyByPkgId.get(normalizePkgId(pr.id));
      if (!root) {
        return {
          ok: false,
          error:
            `Restore did not produce a target library entry for ${pr.id} ${pr.version}.\n` +
            `This may indicate the package is incompatible with ${targetFramework}.`,
        };
      }
      roots.push(root);
    }

    // If all direct package references have explicit types packages, we only
    // perform dotnet restore here (for early error detection) and skip local
    // bindings generation entirely.
    if (roots.length === 0) {
      // Still continue to DLL/framework binding sections if present.
      // (They are independent dependency kinds.)
      // eslint-disable-next-line no-empty
    } else {
    const closure = new Set<string>();
    const queue: string[] = [...roots];
    while (queue.length > 0) {
      const libKey = queue.pop();
      if (!libKey) continue;
      if (closure.has(libKey)) continue;
      closure.add(libKey);
      const node = packagesByLibKey.get(libKey);
      if (!node) continue;
      for (const depId of node.dependencies) {
        const depLibKey = libKeyByPkgId.get(normalizePkgId(depId));
        if (depLibKey) queue.push(depLibKey);
      }
    }

    const depsByLibKey = new Map<string, string[]>();
    for (const libKey of closure) {
      const node = packagesByLibKey.get(libKey);
      if (!node) continue;
      const deps: string[] = [];
      for (const depId of node.dependencies) {
        const depLibKey = libKeyByPkgId.get(normalizePkgId(depId));
        if (depLibKey && closure.has(depLibKey)) deps.push(depLibKey);
      }
      depsByLibKey.set(libKey, Array.from(new Set(deps)));
    }

    const topo: string[] = [];
    const state = new Map<string, "visiting" | "done">();
    const visit = (libKey: string): Result<void, string> => {
      const s = state.get(libKey);
      if (s === "done") return { ok: true, value: undefined };
      if (s === "visiting") return { ok: false, error: `Cycle detected in NuGet dependency graph at: ${libKey}` };
      state.set(libKey, "visiting");
      for (const dep of depsByLibKey.get(libKey) ?? []) {
        const r = visit(dep);
        if (!r.ok) return r;
      }
      state.set(libKey, "done");
      topo.push(libKey);
      return { ok: true, value: undefined };
    };
    for (const libKey of closure) {
      const r = visit(libKey);
      if (!r.ok) return r;
    }

    const compileDirs = new Set<string>();
    for (const libKey of closure) {
      const node = packagesByLibKey.get(libKey);
      if (!node) continue;
      for (const dll of node.dlls) compileDirs.add(dirname(dll));
    }

    const resolveTypesInfo = (
      packageId: string
    ): Result<{ readonly libDir: string; readonly fingerprint: string }, string> => {
      const norm = normalizePkgId(packageId);
      const existing = typesInfoByPkgId.get(norm);
      if (existing) return { ok: true, value: existing };
      return { ok: false, error: `Internal error: missing types package info for ${packageId}` };
    };

    const transitiveDeps = new Map<string, Set<string>>();
    for (const libKey of topo) {
      const set = new Set<string>();
      for (const dep of depsByLibKey.get(libKey) ?? []) {
        set.add(dep);
        const depTrans = transitiveDeps.get(dep);
        if (depTrans) for (const t of depTrans) set.add(t);
      }
      transitiveDeps.set(libKey, set);
    }

    const libDirByLibKey = new Map<string, string>();
    const fingerprintByLibKey = new Map<string, string>();

    for (const libKey of topo) {
      const node = packagesByLibKey.get(libKey);
      if (!node) continue;
      const seedDlls = [...node.dlls];
      if (seedDlls.length === 0) continue; // meta-package

      const declared = packageReferencesAll.find(
        (p) => normalizePkgId(p.id) === normalizePkgId(node.packageId)
      );
      if (declared?.types) {
        const info = resolveTypesInfo(node.packageId);
        if (!info.ok) return info;
        libDirByLibKey.set(libKey, info.value.libDir);
        fingerprintByLibKey.set(libKey, info.value.fingerprint);
        continue; // bindings supplied externally; do not auto-generate.
      }

      const packageName = defaultBindingsPackageNameForNuget(node.packageId);
      const outDir = bindingsStoreDir(projectRoot, "nuget", packageName);
      const targetDir = join(projectRoot, "node_modules", packageName);
      libDirByLibKey.set(libKey, targetDir);

      const pkgJsonResult = ensureGeneratedBindingsPackageJson(outDir, packageName, {
        kind: "nuget",
        source: { packageId: node.packageId, version: node.version },
      });
      if (!pkgJsonResult.ok) return pkgJsonResult;

      const seedInfo: Array<{ readonly path: string; readonly sha256: string }> = [];
      for (const dll of seedDlls) {
        const h = sha256FileHex(dll);
        if (!h.ok) return h;
        seedInfo.push({ path: dll, sha256: h.value });
      }
      seedInfo.sort((a, b) => a.path.localeCompare(b.path));

      const depFingerprints = Array.from(transitiveDeps.get(libKey) ?? [])
        .map((depKey) => {
          const fp = fingerprintByLibKey.get(depKey);
          return fp ? { libKey: depKey, fingerprint: fp } : undefined;
        })
        .filter((x): x is { libKey: string; fingerprint: string } => x !== undefined)
        .sort((a, b) => a.libKey.localeCompare(b.libKey));

      const signature: Record<string, unknown> = {
        schemaVersion: 1,
        kind: "nuget",
        packageName,
        naming,
        strict: options.strict === true,
        tool: { tsbindgenSha256 },
        libs: { dotnet: dotnetIdentity.value, core: coreIdentity.value },
        source: { packageId: node.packageId, version: node.version },
        seeds: seedInfo,
        deps: depFingerprints,
        refDirs: {
          runtimes: runtimes
            .map((r) => ({ name: r.name, version: r.version, dir: r.dir }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)),
          nugetCompileDirs: Array.from(compileDirs).sort((a, b) => a.localeCompare(b)),
          deps: (options.deps ?? [])
            .map((d) => resolveFromProjectRoot(projectRoot, d))
            .sort((a, b) => a.localeCompare(b)),
        },
      };
      const fingerprint = `sha256:${sha256Hex(JSON.stringify(signature))}`;
      fingerprintByLibKey.set(libKey, fingerprint);

      const generateArgs: string[] = [
        ...seedDlls.flatMap((p) => ["-a", p]),
        "-o",
        outDir,
        "--naming",
        naming,
        "--lib",
        dotnetLib,
        "--lib",
        coreLib,
      ];

      const libDirs = new Set<string>();
      for (const depKey of transitiveDeps.get(libKey) ?? []) {
        const depDir = libDirByLibKey.get(depKey);
        if (depDir) libDirs.add(depDir);
      }
      for (const depDir of Array.from(libDirs).sort((a, b) => a.localeCompare(b))) {
        generateArgs.push("--lib", depDir);
      }

      for (const rt of runtimes) generateArgs.push("--ref-dir", rt.dir);
      for (const d of compileDirs) generateArgs.push("--ref-dir", d);
      for (const dep of options.deps ?? []) {
        generateArgs.push("--ref-dir", resolveFromProjectRoot(projectRoot, dep));
      }

      const meta = readGeneratedBindingsMeta(targetDir);
      if (!meta.ok) return meta;

      const needsGenerate = !options.incremental || meta.value.fingerprint !== fingerprint;

      if (needsGenerate) {
        const genResult = tsbindgenGenerate(projectRoot, tsbindgenDll, generateArgs, options);
        if (!genResult.ok) return genResult;
        const fpWrite = writeGeneratedBindingsFingerprint(outDir, fingerprint, signature);
        if (!fpWrite.ok) return fpWrite;
        const installResult = installGeneratedBindingsPackage(projectRoot, packageName, outDir);
        if (!installResult.ok) return installResult;
      }
    }
    }
  }

  // 3) Local DLL bindings (dotnet.libraries)
  const dotnetLibraries = (dotnet.libraries ?? []) as LibraryConfig[];

  for (const entry of dotnetLibraries) {
    const typesPkg = getLibraryTypes(entry);
    if (!typesPkg) continue;
    const path = getLibraryPath(entry);
    if (!path.toLowerCase().endsWith(".dll")) {
      return {
        ok: false,
        error:
          `Invalid dotnet.libraries entry: 'types' is only valid for DLL paths.\n` +
          `- path: ${path}\n` +
          `- types: ${typesPkg}`,
      };
    }
    const ext = computeExternalTypesFingerprint(projectRoot, typesPkg);
    if (!ext.ok) return ext;
  }

  const dllLibraries = dotnetLibraries
    .map(getLibraryPath)
    .filter((p) => {
      const normalized = p.replace(/\\/g, "/").toLowerCase();
      if (!normalized.endsWith(".dll")) return false;
      if (isBuiltInRuntimeDllPath(p)) return false;
      const abs = resolveFromProjectRoot(projectRoot, p);
      return (
        projectDllDirsAbs.some((d) => pathIsWithin(abs, d)) ||
        workspaceDllDirsAbs.some((d) => pathIsWithin(abs, d))
      );
    });
  if (dllLibraries.length > 0) {
    const typesPackageByLibraryKey = new Map<string, string>();
    for (const entry of dotnetLibraries) {
      const typesPkg = getLibraryTypes(entry);
      if (!typesPkg) continue;
      typesPackageByLibraryKey.set(normalizeLibraryPathKey(getLibraryPath(entry)), typesPkg);
    }

    const dllAbs = dllLibraries.map((p) => resolveFromProjectRoot(projectRoot, p));
    for (const p of dllAbs) {
      if (!existsSync(p)) {
        return {
          ok: false,
          error: `Missing DLL from tsonic.json dotnet.libraries: ${p}`,
        };
      }
    }

    const userDeps = (options.deps ?? []).map((d) => resolveFromProjectRoot(projectRoot, d));
    const refDirs = Array.from(
      new Set([
        ...runtimes.map((r) => r.dir),
        ...projectDllDirsAbs,
        ...workspaceDllDirsAbs,
        ...userDeps,
      ])
    );

    const closureResult = tsbindgenResolveClosure(projectRoot, tsbindgenDll, dllAbs, refDirs);
    if (!closureResult.ok) return closureResult;
    const closure = closureResult.value;
    const hasErrors = closure.diagnostics.some((d) => d.severity === "Error");
    if (hasErrors) {
      const details = closure.diagnostics
        .filter((d) => d.severity === "Error")
        .map((d) => `${d.code}: ${d.message}`)
        .join("\n");
      return { ok: false, error: `Failed to resolve DLL dependency closure:\n${details}` };
    }

    const requiredFrameworkRefs = new Set<string>();
    const nonFramework = closure.resolvedAssemblies.filter((asm) => {
      const runtimeDir = runtimes.find((rt) => pathIsWithin(asm.path, rt.dir));
      if (!runtimeDir) return true;
      if (runtimeDir.name !== "Microsoft.NETCore.App") requiredFrameworkRefs.add(runtimeDir.name);
      return false;
    });

    if (requiredFrameworkRefs.size > 0) {
      const nextFrameworkRefs: FrameworkReferenceConfig[] = [
        ...((dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[]),
      ];
      for (const fr of requiredFrameworkRefs) {
        addUniqueFrameworkReference(nextFrameworkRefs, fr);
      }
      const nextConfig = {
        ...(config as Record<string, unknown>),
        dotnet: { ...dotnet, frameworkReferences: nextFrameworkRefs },
      };
      const writeResult = writeTsonicJson(configPath, nextConfig);
      if (!writeResult.ok) return writeResult;
    }

    const identityKey = (asm: (typeof nonFramework)[number]): string =>
      `${asm.name}|${asm.publicKeyToken}|${asm.culture}`;

    type OwnerKind = "workspace" | "project" | "external";
    const classifyOwnerKind = (dllAbsPath: string): OwnerKind => {
      if (workspaceRoot && workspaceDllDirsAbs.some((d) => pathIsWithin(dllAbsPath, d))) {
        return "workspace";
      }
      if (projectDllDirsAbs.some((d) => pathIsWithin(dllAbsPath, d))) {
        return "project";
      }
      return "external";
    };

    const ids = new Set<string>();
    const byId = new Map<string, (typeof nonFramework)[number]>();
    const destPathById = new Map<string, string>();
    const directDeps = new Map<string, string[]>();

    for (const asm of nonFramework) {
      const id = identityKey(asm);
      if (ids.has(id)) {
        return {
          ok: false,
          error:
            `Ambiguous assembly identity in closure: ${asm.name} (${asm.publicKeyToken}, ${asm.culture}).\n` +
            `This indicates multiple assemblies with the same identity were resolved, which is not supported.`,
        };
      }
      ids.add(id);
      byId.set(id, asm);

      const destPath = asm.path;
      if (!existsSync(destPath)) {
        return { ok: false, error: `Missing DLL dependency: ${destPath}` };
      }
      destPathById.set(id, destPath);
    }

    for (const asm of nonFramework) {
      const id = identityKey(asm);
      const refs = asm.references ?? [];
      const deps: string[] = [];
      for (const r of refs) {
        const depId = `${r.name}|${r.publicKeyToken}|${r.culture}`;
        if (ids.has(depId)) deps.push(depId);
      }
      directDeps.set(id, Array.from(new Set(deps)));
    }

    // Airplane-grade: workspace-owned DLLs must be self-contained within workspace dllDirs.
    // If a workspace DLL depends on a project-owned/external DLL, sharing becomes non-deterministic
    // (another project won't see those deps/bindings), so we fail fast.
    if (workspaceRoot) {
      const ownerKindById = new Map<string, OwnerKind>();
      for (const id of ids) {
        const dest = destPathById.get(id);
        if (!dest) continue;
        ownerKindById.set(id, classifyOwnerKind(dest));
      }

      for (const id of ids) {
        if (ownerKindById.get(id) !== "workspace") continue;
        for (const depId of directDeps.get(id) ?? []) {
          const depKind = ownerKindById.get(depId);
          if (depKind === "workspace") continue;

          const ownerPath = destPathById.get(id) ?? id;
          const depPath = destPathById.get(depId) ?? depId;
          const depLabel =
            depKind === "project"
              ? "project-owned"
              : depKind === "external"
                ? "external"
                : "non-workspace";

          return {
            ok: false,
            error:
              `Workspace-owned DLL depends on ${depLabel} DLL, which is not allowed.\n` +
              `Owner: ${ownerPath}\n` +
              `Depends on: ${depPath}\n\n` +
              `Fix:\n` +
              `- Install/copy the dependency into the workspace 'dotnet.dllDirs' so it becomes workspace-owned, OR\n` +
              `- Move the owner DLL out of the workspace dllDirs if it should be project-scoped.\n\n` +
              `Workspace root: ${workspaceRoot}\n` +
              `Workspace dllDirs: ${workspaceDllDirs.join(", ")}`,
          };
        }
      }
    }

    const order: string[] = [];
    const state = new Map<string, "visiting" | "done">();
    const visit = (id: string): Result<void, string> => {
      const s = state.get(id);
      if (s === "done") return { ok: true, value: undefined };
      if (s === "visiting") return { ok: false, error: `Cycle detected in DLL dependency graph at: ${id}` };
      state.set(id, "visiting");
      for (const dep of directDeps.get(id) ?? []) {
        const r = visit(dep);
        if (!r.ok) return r;
      }
      state.set(id, "done");
      order.push(id);
      return { ok: true, value: undefined };
    };
    for (const id of ids) {
      const r = visit(id);
      if (!r.ok) return r;
    }

    const transitiveDeps = new Map<string, Set<string>>();
    for (const id of order) {
      const set = new Set<string>();
      for (const dep of directDeps.get(id) ?? []) {
        set.add(dep);
        const depTrans = transitiveDeps.get(dep);
        if (depTrans) for (const t of depTrans) set.add(t);
      }
      transitiveDeps.set(id, set);
    }

    const libDirById = new Map<string, string>();
    const fingerprintById = new Map<string, string>();
    for (const id of order) {
      const asm = byId.get(id);
      const destPath = destPathById.get(id);
      if (!asm || !destPath) return { ok: false, error: `Internal error: missing assembly info for ${id}` };

      const configRelLibraryPath = relative(projectRoot, destPath).replace(/\\/g, "/");
      const typesPkg = typesPackageByLibraryKey.get(normalizeLibraryPathKey(configRelLibraryPath));
      if (typesPkg) {
        const info = computeExternalTypesFingerprint(projectRoot, typesPkg);
        if (!info.ok) return info;
        libDirById.set(id, info.value.packageRoot);
        fingerprintById.set(id, info.value.fingerprint);
        continue; // bindings supplied externally; do not auto-generate.
      }

      const packageName = defaultBindingsPackageNameForDll(destPath);
      const ownerKind = classifyOwnerKind(destPath);
      let ownerRootForInstall = projectRoot;
      if (ownerKind === "workspace") {
        if (!workspaceRoot) {
          return {
            ok: false,
            error: "Internal error: workspace-owned DLL without workspaceRoot",
          };
        }
        ownerRootForInstall = workspaceRoot;
      }

      const outDir = bindingsStoreDir(ownerRootForInstall, "dll", packageName);
      const targetDir = join(ownerRootForInstall, "node_modules", packageName);
      libDirById.set(id, targetDir);

      const ownerRelLibraryPath = relative(ownerRootForInstall, destPath).replace(/\\/g, "/");
      const pkgJsonResult = ensureGeneratedBindingsPackageJson(outDir, packageName, {
        kind: "dll",
        source: { assemblyName: asm.name, version: asm.version, path: ownerRelLibraryPath },
      });
      if (!pkgJsonResult.ok) return pkgJsonResult;

      const dllHash = sha256FileHex(destPath);
      if (!dllHash.ok) return dllHash;

      const depFingerprints = Array.from(transitiveDeps.get(id) ?? [])
        .map((depId) => {
          const fp = fingerprintById.get(depId);
          return fp ? { id: depId, fingerprint: fp } : undefined;
        })
        .filter((x): x is { id: string; fingerprint: string } => x !== undefined)
        .sort((a, b) => a.id.localeCompare(b.id));

      const signature: Record<string, unknown> = {
        schemaVersion: 1,
        kind: "dll",
        packageName,
        naming,
        strict: options.strict === true,
        tool: { tsbindgenSha256 },
        libs: { dotnet: dotnetIdentity.value, core: coreIdentity.value },
        source: {
          assemblyName: asm.name,
          version: asm.version,
          path: ownerRelLibraryPath,
          sha256: dllHash.value,
        },
        deps: depFingerprints,
        refDirs: {
          runtimes: runtimes
            .map((r) => ({ name: r.name, version: r.version, dir: r.dir }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)),
          deps: userDeps.slice().sort((a, b) => a.localeCompare(b)),
          dllDirs: {
            project:
              ownerKind === "workspace"
                ? []
                : projectDllDirsAbs.slice().sort((a, b) => a.localeCompare(b)),
            workspace: workspaceDllDirsAbs.slice().sort((a, b) => a.localeCompare(b)),
          },
        },
      };
      const fingerprint = `sha256:${sha256Hex(JSON.stringify(signature))}`;
      fingerprintById.set(id, fingerprint);

      const generateArgs: string[] = [
        "-a",
        destPath,
        "-o",
        outDir,
        "--naming",
        naming,
        "--lib",
        dotnetLib,
        "--lib",
        coreLib,
      ];

      const libs = Array.from(transitiveDeps.get(id) ?? [])
        .map((depId) => libDirById.get(depId))
        .filter((p): p is string => typeof p === "string")
        .sort((a, b) => a.localeCompare(b));
      for (const lib of libs) generateArgs.push("--lib", lib);

      for (const rt of runtimes) generateArgs.push("--ref-dir", rt.dir);
      for (const dep of userDeps) generateArgs.push("--ref-dir", dep);
      if (ownerKind === "workspace") {
        for (const dir of workspaceDllDirsAbs) generateArgs.push("--ref-dir", dir);
      } else {
        for (const dir of projectDllDirsAbs) generateArgs.push("--ref-dir", dir);
        for (const dir of workspaceDllDirsAbs) generateArgs.push("--ref-dir", dir);
      }

      const meta = readGeneratedBindingsMeta(targetDir);
      if (!meta.ok) return meta;

      const needsGenerate = !options.incremental || meta.value.fingerprint !== fingerprint;

      if (needsGenerate) {
        const genResult = tsbindgenGenerate(projectRoot, tsbindgenDll, generateArgs, options);
        if (!genResult.ok) return genResult;
        const fpWrite = writeGeneratedBindingsFingerprint(outDir, fingerprint, signature);
        if (!fpWrite.ok) return fpWrite;
        const installResult = installGeneratedBindingsPackage(ownerRootForInstall, packageName, outDir);
        if (!installResult.ok) return installResult;
      }
    }
  }

  return { ok: true, value: undefined };
};
