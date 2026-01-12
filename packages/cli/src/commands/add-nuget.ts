/**
 * tsonic add nuget - add a NuGet PackageReference to the project, plus bindings.
 *
 * Usage:
 *   tsonic add nuget <PackageId> <Version> [typesPackage]
 *
 * If typesPackage is omitted, bindings are auto-generated via tsbindgen from the
 * restored compile-time assemblies (including transitive dependencies).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Result, TsonicConfig } from "../types.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForNuget,
  detectTsbindgenNaming,
  ensureGeneratedBindingsPackageJson,
  installGeneratedBindingsPackage,
  listDotnetRuntimes,
  npmInstallDevDependency,
  readTsonicJson,
  resolveFromProjectRoot,
  resolveTsbindgenDllPath,
  tsbindgenGenerate,
  type AddCommandOptions,
  type Exec,
  defaultExec,
  writeTsonicJson,
} from "./add-common.js";

export type AddNugetOptions = AddCommandOptions;

type PackageReference = { readonly id: string; readonly version: string };

type ProjectAssets = {
  readonly targets?: Record<string, unknown>;
  readonly libraries?: Record<string, { readonly type?: string; readonly path?: string }>;
  readonly packageFolders?: Record<string, unknown>;
};

const isValidTypesPackageName = (name: string): boolean => {
  if (!name.startsWith("@") && !name.includes("/")) return true;
  return /^@[a-z0-9-]+\/[a-z0-9-]+$/i.test(name);
};

const normalizePkgId = (id: string): string => id.trim().toLowerCase();

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
  options: AddNugetOptions,
  exec: Exec = defaultExec
): Result<string, string> => {
  const restoreDir = dirname(restoreProjectPath);
  const result = exec(
    "dotnet",
    ["restore", restoreProjectPath],
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

const pickPackageFolder = (assets: ProjectAssets): string | undefined => {
  const folders = assets.packageFolders ? Object.keys(assets.packageFolders) : [];
  if (folders.length === 0) return undefined;
  // Use the first package folder entry (dotnet restore writes an ordered map).
  return folders[0];
};

const findTargetKey = (assets: ProjectAssets, tfm: string): string | undefined => {
  const targets = assets.targets ? Object.keys(assets.targets) : [];
  if (targets.includes(tfm)) return tfm;
  return targets.find((k) => k.startsWith(`${tfm}/`));
};

type PackageTarget = {
  readonly libKey: string;
  readonly packageId: string;
  readonly version: string;
  readonly dlls: readonly string[];
  readonly dependencies: readonly string[]; // Package IDs (no versions)
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

export const addNugetCommand = (
  packageId: string,
  version: string,
  typesPackage: string | undefined,
  projectRoot: string,
  options: AddNugetOptions = {}
): Result<{ packageId: string; version: string; bindings: string }, string> => {
  const id = packageId.trim();
  const ver = version.trim();
  if (!id) return { ok: false, error: "PackageId must be non-empty" };
  if (!ver) return { ok: false, error: "Version must be non-empty" };
  if (typesPackage !== undefined && !isValidTypesPackageName(typesPackage)) {
    return { ok: false, error: `Invalid types package name: ${typesPackage}` };
  }

  const tsonicConfigResult = readTsonicJson(projectRoot);
  if (!tsonicConfigResult.ok) return tsonicConfigResult;
  const { path: configPath, config } = tsonicConfigResult.value;

  const dotnet = config.dotnet ?? {};
  const existing = [...(dotnet.packageReferences ?? [])];
  const existingIdx = existing.findIndex((p) => normalizePkgId(p.id) === normalizePkgId(id));
  if (existingIdx >= 0) {
    if (existing[existingIdx]?.version !== ver) {
      return {
        ok: false,
        error:
          `NuGet package already present with a different version: ${existing[existingIdx]?.id} ${existing[existingIdx]?.version}\n` +
          `Refusing to change versions automatically (airplane-grade). Update tsonic.json manually if intended.`,
      };
    }
  } else {
    existing.push({ id, version: ver });
  }

  const nextConfig: TsonicConfig = {
    ...config,
    dotnet: {
      ...dotnet,
      packageReferences: existing,
    },
  };

  const writeResult = writeTsonicJson(configPath, nextConfig);
  if (!writeResult.ok) return writeResult;

  if (typesPackage) {
    const installResult = npmInstallDevDependency(projectRoot, typesPackage, options);
    if (!installResult.ok) return installResult;
    return {
      ok: true,
      value: { packageId: id, version: ver, bindings: typesPackage },
    };
  }

  const tsbindgenDllResult = resolveTsbindgenDllPath(projectRoot);
  if (!tsbindgenDllResult.ok) return tsbindgenDllResult;
  const tsbindgenDll = tsbindgenDllResult.value;

  const dotnetLib = join(projectRoot, "node_modules/@tsonic/dotnet");
  const coreLib = join(projectRoot, "node_modules/@tsonic/core");
  if (!existsSync(join(dotnetLib, "package.json"))) {
    return {
      ok: false,
      error:
        "Missing @tsonic/dotnet in node_modules. Run 'tsonic project init' (recommended) or install it manually.",
    };
  }
  if (!existsSync(join(coreLib, "package.json"))) {
    return {
      ok: false,
      error:
        "Missing @tsonic/core in node_modules. Run 'tsonic project init' (recommended) or install it manually.",
    };
  }

  const targetFramework = nextConfig.dotnetVersion ?? "net10.0";
  const restoreDir = join(projectRoot, ".tsonic", "nuget");

  const restoreProject = writeRestoreProject(
    restoreDir,
    targetFramework,
    existing
  );
  if (!restoreProject.ok) return restoreProject;

  const assetsPathResult = dotnetRestore(restoreProject.value, options);
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

  const rootLibKeys: string[] = [];
  for (const pr of existing) {
    const root = libKeyByPkgId.get(normalizePkgId(pr.id));
    if (!root) {
      return {
        ok: false,
        error:
          `Restore did not produce a target library entry for ${pr.id} ${pr.version}.\n` +
          `This may indicate the package is incompatible with ${targetFramework}.`,
      };
    }
    rootLibKeys.push(root);
  }

  // Compute closure from direct packageReferences, including transitive deps.
  const closure = new Set<string>();
  const queue: string[] = [...rootLibKeys];
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

  // Build dependency edges within the closure.
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

  // Topological order (deps first).
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

  const runtimesResult = listDotnetRuntimes(projectRoot);
  if (!runtimesResult.ok) return runtimesResult;
  const runtimes = runtimesResult.value;

  const naming = detectTsbindgenNaming(nextConfig);
  const isGenerated = (libKey: string): boolean =>
    (packagesByLibKey.get(libKey)?.dlls.length ?? 0) > 0;

  // Pre-compute transitive deps, propagating through meta packages.
  const transitiveGeneratedDeps = new Map<string, Set<string>>();
  for (const libKey of topo) {
    const set = new Set<string>();
    for (const dep of depsByLibKey.get(libKey) ?? []) {
      if (isGenerated(dep)) set.add(dep);
      const depTrans = transitiveGeneratedDeps.get(dep);
      if (depTrans) for (const t of depTrans) set.add(t);
    }
    transitiveGeneratedDeps.set(libKey, set);
  }

  const bindingsDirByLibKey = new Map<string, string>();

  for (const libKey of topo) {
    const node = packagesByLibKey.get(libKey);
    if (!node) continue;

    const seedDlls = [...node.dlls];
    if (seedDlls.length === 0) continue;

    const packageName = defaultBindingsPackageNameForNuget(node.packageId);
    const bindingsDir = bindingsStoreDir(projectRoot, "nuget", packageName);
    bindingsDirByLibKey.set(libKey, bindingsDir);

    const pkgJsonResult = ensureGeneratedBindingsPackageJson(bindingsDir, packageName, {
      kind: "nuget",
      source: { packageId: node.packageId, version: node.version },
    });
    if (!pkgJsonResult.ok) return pkgJsonResult;

    const generateArgs: string[] = [
      ...seedDlls.flatMap((p) => ["-a", p]),
      "-o",
      bindingsDir,
      "--naming",
      naming,
      "--lib",
      dotnetLib,
      "--lib",
      coreLib,
    ];

    const deps = Array.from(transitiveGeneratedDeps.get(libKey) ?? [])
      .map((depKey) => bindingsDirByLibKey.get(depKey))
      .filter((p): p is string => typeof p === "string")
      .sort((a, b) => a.localeCompare(b));
    for (const depDir of deps) generateArgs.push("--lib", depDir);

    for (const rt of runtimes) generateArgs.push("--ref-dir", rt.dir);
    for (const d of compileDirs) generateArgs.push("--ref-dir", d);
    for (const dep of options.deps ?? []) {
      generateArgs.push("--ref-dir", resolveFromProjectRoot(projectRoot, dep));
    }

    const genResult = tsbindgenGenerate(projectRoot, tsbindgenDll, generateArgs, options);
    if (!genResult.ok) return genResult;

    const installResult = installGeneratedBindingsPackage(projectRoot, packageName, bindingsDir);
    if (!installResult.ok) return installResult;
  }

  return {
    ok: true,
    value: { packageId: id, version: ver, bindings: defaultBindingsPackageNameForNuget(id) },
  };
};
