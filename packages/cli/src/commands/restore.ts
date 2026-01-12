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
import { basename, dirname, join } from "node:path";
import type { Result, TsonicConfig } from "../types.js";
import { isBuiltInRuntimeDllPath } from "../dotnet/runtime-dlls.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForDll,
  defaultBindingsPackageNameForFramework,
  defaultBindingsPackageNameForNuget,
  detectTsbindgenNaming,
  ensureGeneratedBindingsPackageJson,
  installGeneratedBindingsPackage,
  listDotnetRuntimes,
  readTsonicJson,
  resolveFromProjectRoot,
  resolveTsbindgenDllPath,
  tsbindgenGenerate,
  tsbindgenResolveClosure,
  type AddCommandOptions,
  type Exec,
  defaultExec,
  writeTsonicJson,
} from "./add-common.js";

export type RestoreOptions = AddCommandOptions;

type PackageReference = { readonly id: string; readonly version: string };

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
  options: RestoreOptions,
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

const addUnique = (arr: string[], value: string): void => {
  if (!arr.includes(value)) arr.push(value);
};

const pathIsWithin = (path: string, dir: string): boolean => {
  const normalizedDir = dir.endsWith("/") ? dir : `${dir}/`;
  const normalizedPath = path.replace(/\\/g, "/");
  const normalizedBase = normalizedDir.replace(/\\/g, "/");
  return normalizedPath.startsWith(normalizedBase);
};

export const restoreCommand = (
  projectRoot: string,
  options: RestoreOptions = {}
): Result<void, string> => {
  const tsonicConfigResult = readTsonicJson(projectRoot);
  if (!tsonicConfigResult.ok) return tsonicConfigResult;
  const { path: configPath, config: rawConfig } = tsonicConfigResult.value;
  let config = rawConfig;

  const tsbindgenDllResult = resolveTsbindgenDllPath(projectRoot);
  if (!tsbindgenDllResult.ok) return tsbindgenDllResult;
  const tsbindgenDll = tsbindgenDllResult.value;

  const runtimesResult = listDotnetRuntimes(projectRoot);
  if (!runtimesResult.ok) return runtimesResult;
  const runtimes = runtimesResult.value;

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

  let dotnet = config.dotnet ?? {};
  const originalLibraries = dotnet.libraries ?? [];
  const filteredLibraries = originalLibraries.filter(
    (p) => !isBuiltInRuntimeDllPath(p)
  );
  if (filteredLibraries.length !== originalLibraries.length) {
    dotnet = { ...dotnet, libraries: filteredLibraries };
    const nextConfig: TsonicConfig = { ...config, dotnet };
    const writeResult = writeTsonicJson(configPath, nextConfig);
    if (!writeResult.ok) return writeResult;
    config = nextConfig;
  }
  const naming = detectTsbindgenNaming(config);

  // 1) FrameworkReferences bindings
  for (const frameworkRef of dotnet.frameworkReferences ?? []) {
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

    const pkgJsonResult = ensureGeneratedBindingsPackageJson(outDir, packageName, {
      kind: "framework",
      source: { frameworkReference: frameworkRef },
    });
    if (!pkgJsonResult.ok) return pkgJsonResult;

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

    const genResult = tsbindgenGenerate(projectRoot, tsbindgenDll, generateArgs, options);
    if (!genResult.ok) return genResult;

    const installResult = installGeneratedBindingsPackage(projectRoot, packageName, outDir);
    if (!installResult.ok) return installResult;
  }

  // 2) NuGet PackageReferences bindings (including transitive deps)
  const packageReferences = dotnet.packageReferences ?? [];
  if (packageReferences.length > 0) {
    const targetFramework = config.dotnetVersion ?? "net10.0";
    const restoreDir = join(projectRoot, ".tsonic", "nuget");
    const restoreProject = writeRestoreProject(restoreDir, targetFramework, packageReferences);
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

    const roots: string[] = [];
    for (const pr of packageReferences) {
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

    const isGenerated = (libKey: string): boolean =>
      (packagesByLibKey.get(libKey)?.dlls.length ?? 0) > 0;

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
      if (seedDlls.length === 0) continue; // meta-package

      const packageName = defaultBindingsPackageNameForNuget(node.packageId);
      const outDir = bindingsStoreDir(projectRoot, "nuget", packageName);
      bindingsDirByLibKey.set(libKey, outDir);

      const pkgJsonResult = ensureGeneratedBindingsPackageJson(outDir, packageName, {
        kind: "nuget",
        source: { packageId: node.packageId, version: node.version },
      });
      if (!pkgJsonResult.ok) return pkgJsonResult;

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

      const installResult = installGeneratedBindingsPackage(projectRoot, packageName, outDir);
      if (!installResult.ok) return installResult;
    }
  }

  // 3) Local DLL bindings (dotnet.libraries)
  const dllLibraries = (dotnet.libraries ?? []).filter((p) => p.toLowerCase().endsWith(".dll"));
  if (dllLibraries.length > 0) {
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
    const refDirs = [...runtimes.map((r) => r.dir), join(projectRoot, "lib"), ...userDeps];

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
      const nextFrameworkRefs = [...(dotnet.frameworkReferences ?? [])];
      for (const fr of requiredFrameworkRefs) addUnique(nextFrameworkRefs, fr);
      const nextConfig: TsonicConfig = {
        ...config,
        dotnet: { ...dotnet, frameworkReferences: nextFrameworkRefs },
      };
      const writeResult = writeTsonicJson(configPath, nextConfig);
      if (!writeResult.ok) return writeResult;
    }

    const identityKey = (asm: (typeof nonFramework)[number]): string =>
      `${asm.name}|${asm.publicKeyToken}|${asm.culture}`;

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

      const destPath = resolveFromProjectRoot(projectRoot, join("lib", basename(asm.path)));
      if (!existsSync(destPath)) {
        return { ok: false, error: `Missing DLL dependency in lib/: ${destPath}` };
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

    const bindingsDirById = new Map<string, string>();
    for (const id of order) {
      const asm = byId.get(id);
      const destPath = destPathById.get(id);
      if (!asm || !destPath) return { ok: false, error: `Internal error: missing assembly info for ${id}` };

      const packageName = defaultBindingsPackageNameForDll(destPath);
      const outDir = bindingsStoreDir(projectRoot, "dll", packageName);
      bindingsDirById.set(id, outDir);

      const pkgJsonResult = ensureGeneratedBindingsPackageJson(outDir, packageName, {
        kind: "dll",
        source: { assemblyName: asm.name, version: asm.version, path: `lib/${basename(destPath)}` },
      });
      if (!pkgJsonResult.ok) return pkgJsonResult;

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
        .map((depId) => bindingsDirById.get(depId))
        .filter((p): p is string => typeof p === "string")
        .sort((a, b) => a.localeCompare(b));
      for (const lib of libs) generateArgs.push("--lib", lib);

      for (const rt of runtimes) generateArgs.push("--ref-dir", rt.dir);
      for (const dep of userDeps) generateArgs.push("--ref-dir", dep);
      generateArgs.push("--ref-dir", join(projectRoot, "lib"));

      const genResult = tsbindgenGenerate(projectRoot, tsbindgenDll, generateArgs, options);
      if (!genResult.ok) return genResult;

      const installResult = installGeneratedBindingsPackage(projectRoot, packageName, outDir);
      if (!installResult.ok) return installResult;
    }
  }

  return { ok: true, value: undefined };
};
