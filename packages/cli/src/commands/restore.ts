/**
 * tsonic restore - restore .NET dependencies and (re)generate local bindings.
 *
 * This is the "clone a repo and get to green" command:
 * - Runs dotnet restore for NuGet PackageReferences from tsonic.workspace.json
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
import type {
  FrameworkReferenceConfig,
  LibraryReferenceConfig,
  PackageReferenceConfig,
  Result,
  TsonicWorkspaceConfig,
} from "../types.js";
import { isBuiltInRuntimeDllPath } from "../dotnet/runtime-dlls.js";
import { loadWorkspaceConfig } from "../config.js";
import { resolveNugetConfigFile } from "../dotnet/nuget-config.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForDll,
  defaultBindingsPackageNameForFramework,
  defaultBindingsPackageNameForNuget,
  ensureGeneratedBindingsPackageJson,
  installGeneratedBindingsPackage,
  listDotnetRuntimes,
  resolveFromProjectRoot,
  resolvePackageRoot,
  resolveTsonicRuntimeDllDir,
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

const normalizeLibraryKey = (pathLike: string): string =>
  pathLike.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();

export const restoreCommand = (
  configPath: string,
  options: RestoreOptions = {}
): Result<void, string> => {
  const configResult = loadWorkspaceConfig(configPath);
  if (!configResult.ok) return configResult;
  const workspaceRoot = dirname(configPath);
  const nugetConfigResult = resolveNugetConfigFile(workspaceRoot);
  if (!nugetConfigResult.ok) return nugetConfigResult;
  const nugetConfigFile = nugetConfigResult.value;
  const rawConfig = configResult.value;
  let config = rawConfig;

  const tsbindgenDllResult = resolveTsbindgenDllPath(workspaceRoot);
  if (!tsbindgenDllResult.ok) return tsbindgenDllResult;
  const tsbindgenDll = tsbindgenDllResult.value;

  const runtimesResult = listDotnetRuntimes(workspaceRoot);
  if (!runtimesResult.ok) return runtimesResult;
  const runtimes = runtimesResult.value;

  const dotnetRoot = resolvePackageRoot(workspaceRoot, "@tsonic/dotnet");
  if (!dotnetRoot.ok) return dotnetRoot;
  const dotnetLib = dotnetRoot.value;

  const dotnet = config.dotnet ?? {};
  const testDotnet = config.testDotnet ?? {};

  const normalizeFrameworkId = (id: string): string => id.trim().toLowerCase();

  const mergeFrameworkReferences = (
    a: readonly FrameworkReferenceConfig[],
    b: readonly FrameworkReferenceConfig[]
  ): Result<readonly FrameworkReferenceConfig[], string> => {
    const out: FrameworkReferenceConfig[] = [];
    const byId = new Map<string, FrameworkReferenceConfig>();

    const upsert = (ref: FrameworkReferenceConfig): Result<void, string> => {
      const id = typeof ref === "string" ? ref : ref.id;
      const key = normalizeFrameworkId(id);
      const existing = byId.get(key);
      if (!existing) {
        byId.set(key, ref);
        return { ok: true, value: undefined };
      }

      const existingId = typeof existing === "string" ? existing : existing.id;
      const existingTypes = typeof existing === "string" ? undefined : existing.types;
      const nextTypes = typeof ref === "string" ? undefined : ref.types;
      if (
        existingTypes !== undefined &&
        nextTypes !== undefined &&
        existingTypes !== nextTypes
      ) {
        return {
          ok: false,
          error:
            `Conflicting FrameworkReference 'types' mapping for '${existingId}'.\n` +
            `Existing: ${String(existingTypes)}\n` +
            `New: ${String(nextTypes)}\n` +
            `Use a single mapping at the workspace level.`,
        };
      }
      const mergedTypes = existingTypes !== undefined ? existingTypes : nextTypes;

      byId.set(
        key,
        mergedTypes === undefined ? existingId : { id: existingId, types: mergedTypes }
      );
      return { ok: true, value: undefined };
    };

    for (const r of a) {
      const res = upsert(r);
      if (!res.ok) return res;
    }
    for (const r of b) {
      const res = upsert(r);
      if (!res.ok) return res;
    }

    out.push(
      ...Array.from(byId.values()).sort((x, y) => {
        const xi = typeof x === "string" ? x : x.id;
        const yi = typeof y === "string" ? y : y.id;
        return xi.localeCompare(yi);
      })
    );
    return { ok: true, value: out };
  };

  const mergePackageReferences = (
    a: readonly PackageReferenceConfig[],
    b: readonly PackageReferenceConfig[]
  ): Result<readonly PackageReferenceConfig[], string> => {
    const byId = new Map<string, PackageReferenceConfig>();
    for (const p of [...a, ...b]) {
      const key = normalizePkgId(p.id);
      const existing = byId.get(key);
      if (!existing) {
        byId.set(key, p);
        continue;
      }
      if (existing.version !== p.version) {
        return {
          ok: false,
          error:
            `Conflicting PackageReference versions for '${p.id}': '${existing.version}' vs '${p.version}'.\n` +
            `Use a single version at the workspace level.`,
        };
      }
      if (
        existing.types !== undefined &&
        p.types !== undefined &&
        existing.types !== p.types
      ) {
        return {
          ok: false,
          error:
            `Conflicting PackageReference 'types' mapping for '${existing.id}'.\n` +
            `Existing: ${String(existing.types)}\n` +
            `New: ${String(p.types)}\n` +
            `Use a single mapping at the workspace level.`,
        };
      }
      const mergedTypes =
        existing.types !== undefined ? existing.types : p.types;
      byId.set(
        key,
        mergedTypes === undefined
          ? existing
          : { id: existing.id, version: existing.version, types: mergedTypes }
      );
    }

    return {
      ok: true,
      value: Array.from(byId.values()).sort((x, y) => x.id.localeCompare(y.id)),
    };
  };

  const frameworkReferencesAll = mergeFrameworkReferences(
    (dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[],
    (testDotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[]
  );
  if (!frameworkReferencesAll.ok) return frameworkReferencesAll;

  const packageReferencesAllResult = mergePackageReferences(
    (dotnet.packageReferences ?? []) as PackageReferenceConfig[],
    (testDotnet.packageReferences ?? []) as PackageReferenceConfig[]
  );
  if (!packageReferencesAllResult.ok) return packageReferencesAllResult;

  // 1) FrameworkReferences bindings
  for (const entry of frameworkReferencesAll.value) {
    const frameworkRef = typeof entry === "string" ? entry : entry.id;
    const typesPackage = typeof entry === "string" ? undefined : entry.types;
    if (typesPackage !== undefined) {
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
    const outDir = bindingsStoreDir(workspaceRoot, "framework", packageName);

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
      "--lib",
      dotnetLib,
    ];
    for (const rt of runtimes) generateArgs.push("--ref-dir", rt.dir);
    for (const dep of options.deps ?? []) {
      generateArgs.push("--ref-dir", resolveFromProjectRoot(workspaceRoot, dep));
    }

    const genResult = tsbindgenGenerate(workspaceRoot, tsbindgenDll, generateArgs, options);
    if (!genResult.ok) return genResult;

    const installResult = installGeneratedBindingsPackage(workspaceRoot, packageName, outDir);
    if (!installResult.ok) return installResult;
  }

  // 2) NuGet PackageReferences bindings (including transitive deps)
  const packageReferencesAll = packageReferencesAllResult.value;
  if (packageReferencesAll.length > 0) {
    const targetFramework = config.dotnetVersion;
    const restoreDir = join(workspaceRoot, ".tsonic", "nuget");
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
      p.types === undefined;

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

    const typesFalsePkgIds = new Set<string>();
    const typesPackageByPkgId = new Map<string, string>();
    for (const pr of packageReferencesAll) {
      if (pr.types === false) {
        typesFalsePkgIds.add(normalizePkgId(pr.id));
        continue;
      }
      if (typeof pr.types === "string" && pr.types.trim().length > 0) {
        typesPackageByPkgId.set(normalizePkgId(pr.id), pr.types);
      }
    }

    const typesLibDirByPkgId = new Map<string, string>();

    const resolveTypesLibDir = (packageId: string): Result<string, string> => {
      const norm = normalizePkgId(packageId);
      const existing = typesLibDirByPkgId.get(norm);
      if (existing) return { ok: true, value: existing };

      const typesPkg = typesPackageByPkgId.get(norm);
      if (!typesPkg) {
        return { ok: false, error: `Internal error: missing types package for ${packageId}` };
      }

      const root = resolvePackageRoot(workspaceRoot, typesPkg);
      if (!root.ok) return root;
      typesLibDirByPkgId.set(norm, root.value);
      return { ok: true, value: root.value };
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

    const bindingsDirByLibKey = new Map<string, string>();

    // Meta-package planning
    //
    // Some NuGet packages ship no compile-time DLLs (e.g., `xunit`), but are still
    // the ergonomic package ID that users expect to reference.
    //
    // Airplane-grade rule: imports must resolve to real CLR bindings via bindings.json.
    // Therefore meta packages must produce a bindings package with real bindings.json
    // (not merely `.d.ts` re-exports).
    //
    // Approach:
    // - For each declared meta root (direct PackageReference with no DLLs), claim a
    //   subset of its dependency closure to generate into the meta root’s bindings
    //   package.
    // - We only claim packages that are:
    //   - not direct roots themselves (so roots remain independently addressable), and
    //   - not explicitly mapped to external bindings (types: "<pkg>"), and
    //   - not shared by multiple roots (to preserve unambiguous ownership).
    //
    // Any remaining dependencies are referenced via `--lib` (external mappings or
    // their own generated bindings packages).
    const rootsSet = new Set<string>(roots);
    const rootReachCount = new Map<string, number>();
    for (const root of roots) {
      rootReachCount.set(root, (rootReachCount.get(root) ?? 0) + 1);
      for (const dep of transitiveDeps.get(root) ?? []) {
        rootReachCount.set(dep, (rootReachCount.get(dep) ?? 0) + 1);
      }
    }

    type MetaPlan = {
      readonly outDir: string;
      readonly claimedLibKeys: ReadonlySet<string>;
      readonly seedDlls: readonly string[];
    };
    const metaPlanByLibKey = new Map<string, MetaPlan>();
    const claimedByLibKey = new Map<string, string>(); // dep libKey -> meta root libKey

    for (const rootLibKey of roots) {
      const node = packagesByLibKey.get(rootLibKey);
      if (!node) continue;
      if (node.dlls.length > 0) continue; // not a meta package

      const declared = packageReferencesAll.find(
        (p) => normalizePkgId(p.id) === normalizePkgId(node.packageId)
      );
      if (!declared || declared.types !== undefined) continue;

      const packageName = defaultBindingsPackageNameForNuget(node.packageId);
      const outDir = bindingsStoreDir(workspaceRoot, "nuget", packageName);

      const claimed = new Set<string>();
      const seedSet = new Set<string>();

      for (const depKey of transitiveDeps.get(rootLibKey) ?? []) {
        if (rootsSet.has(depKey)) continue; // other direct roots remain independent
        const depNode = packagesByLibKey.get(depKey);
        if (!depNode) continue;
        if (depNode.dlls.length === 0) continue; // nothing to emit for meta deps

        const depPkgNorm = normalizePkgId(depNode.packageId);
        if (typesFalsePkgIds.has(depPkgNorm)) {
          return {
            ok: false,
            error:
              `NuGet dependency '${depNode.packageId}' is marked as 'types: false' but it contains CLR assemblies.\n` +
              `It is required by meta-package root '${node.packageId}', which must produce real CLR bindings.\n` +
              `Fix: remove 'types: false' or provide an external bindings package via 'types: \"<pkg>\"'.`,
          };
        }

        // If user provided an external bindings package, do not claim it.
        if (typesPackageByPkgId.has(depPkgNorm)) continue;

        // If multiple roots depend on this package, keep it generated independently.
        const reach = rootReachCount.get(depKey) ?? 0;
        if (reach > 1) continue;

        const existingOwner = claimedByLibKey.get(depKey);
        if (existingOwner && existingOwner !== rootLibKey) {
          return {
            ok: false,
            error:
              `Cannot auto-generate meta-package bindings for '${node.packageId}': shared dependency ownership conflict.\n` +
              `Dependency '${depNode.packageId}' is claimed by multiple meta roots:\n` +
              `- ${packagesByLibKey.get(existingOwner)?.packageId ?? existingOwner}\n` +
              `- ${node.packageId}\n` +
              `Fix: provide explicit 'types' mappings for one of the roots to avoid auto-generation ambiguity.`,
          };
        }

        claimedByLibKey.set(depKey, rootLibKey);
        claimed.add(depKey);
        for (const dll of depNode.dlls) seedSet.add(dll);
      }

      const seedDlls = Array.from(seedSet).sort((a, b) => a.localeCompare(b));
      if (seedDlls.length === 0) {
        return {
          ok: false,
          error:
            `Cannot auto-generate meta-package bindings for '${node.packageId}': no seed DLLs found.\n` +
            `This package contains no compile-time DLLs and none of its dependency DLLs are eligible for claiming.\n` +
            `Fix: provide an explicit bindings package via 'types: \"<pkg>\"' or reference a non-meta package that contains the required APIs.`,
        };
      }

      metaPlanByLibKey.set(rootLibKey, {
        outDir,
        claimedLibKeys: claimed,
        seedDlls,
      });

      // Expose claimed packages as being provided by the meta root bindings dir so
      // any later generators can resolve constraints deterministically.
      for (const depKey of claimed) {
        bindingsDirByLibKey.set(depKey, outDir);
      }
    }

    for (const libKey of topo) {
      const node = packagesByLibKey.get(libKey);
      if (!node) continue;
      if (claimedByLibKey.has(libKey) && !metaPlanByLibKey.has(libKey)) {
        // This package’s types are generated into its meta root’s bindings package.
        continue;
      }
      const seedDlls = [...node.dlls];

      const declared = packageReferencesAll.find(
        (p) => normalizePkgId(p.id) === normalizePkgId(node.packageId)
      );
      if (declared?.types === false) {
        return {
          ok: false,
          error:
            `PackageReference '${declared.id}' is marked as 'types: false' but it contains CLR assemblies.\n` +
            `This package is part of the bindings dependency closure and therefore requires bindings.\n` +
            `Fix: remove 'types: false' or provide an external bindings package via 'types: \"<pkg>\"'.`,
        };
      }
      if (declared?.types !== undefined) {
        continue; // bindings supplied externally; do not auto-generate.
      }

      if (seedDlls.length === 0) {
        // Meta-package root generation (e.g., xunit): emit real bindings by
        // generating from claimed dependency DLLs.
        const plan = metaPlanByLibKey.get(libKey);
        if (!plan) {
          // Meta package not declared as a root (not user-facing); ignore.
          continue;
        }

        const packageName = defaultBindingsPackageNameForNuget(node.packageId);
        const outDir = plan.outDir;
        bindingsDirByLibKey.set(libKey, outDir);

        const pkgJsonResult = ensureGeneratedBindingsPackageJson(outDir, packageName, {
          kind: "nuget",
          source: { packageId: node.packageId, version: node.version },
        });
        if (!pkgJsonResult.ok) return pkgJsonResult;

        const generateArgs: string[] = [
          ...plan.seedDlls.flatMap((p) => ["-a", p]),
          "-o",
          outDir,
          "--lib",
          dotnetLib,
        ];

        const libDirs = new Set<string>();
        for (const depKey of transitiveDeps.get(libKey) ?? []) {
          if (plan.claimedLibKeys.has(depKey)) continue;
          const depNode = packagesByLibKey.get(depKey);
          if (!depNode) continue;

          const depPkgNorm = normalizePkgId(depNode.packageId);
          if (typesFalsePkgIds.has(depPkgNorm) && depNode.dlls.length > 0) {
            return {
              ok: false,
              error:
                `NuGet dependency '${depNode.packageId}' is marked as 'types: false' but it contains CLR assemblies.\n` +
                `It is required by '${node.packageId}' and therefore requires bindings.\n` +
                `Fix: remove 'types: false' or provide an external bindings package via 'types: \"<pkg>\"'.`,
            };
          }

          const typesPkg = typesPackageByPkgId.get(depPkgNorm);
          if (typesPkg) {
            const dirRes = resolveTypesLibDir(depNode.packageId);
            if (!dirRes.ok) return dirRes;
            libDirs.add(dirRes.value);
            continue;
          }

          const generated = bindingsDirByLibKey.get(depKey);
          if (generated) libDirs.add(generated);
        }

        for (const depDir of Array.from(libDirs).sort((a, b) => a.localeCompare(b))) {
          generateArgs.push("--lib", depDir);
        }

        for (const rt of runtimes) generateArgs.push("--ref-dir", rt.dir);
        for (const d of compileDirs) generateArgs.push("--ref-dir", d);
        for (const dep of options.deps ?? []) {
          generateArgs.push("--ref-dir", resolveFromProjectRoot(workspaceRoot, dep));
        }

        const genResult = tsbindgenGenerate(workspaceRoot, tsbindgenDll, generateArgs, options);
        if (!genResult.ok) return genResult;

        const installResult = installGeneratedBindingsPackage(workspaceRoot, packageName, outDir);
        if (!installResult.ok) return installResult;

        continue;
      }

      const packageName = defaultBindingsPackageNameForNuget(node.packageId);
      const outDir = bindingsStoreDir(workspaceRoot, "nuget", packageName);
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
        "--lib",
        dotnetLib,
      ];

      const libDirs = new Set<string>();
      for (const depKey of transitiveDeps.get(libKey) ?? []) {
        const depNode = packagesByLibKey.get(depKey);
        if (!depNode) continue;

        const depPkgNorm = normalizePkgId(depNode.packageId);
        if (typesFalsePkgIds.has(depPkgNorm) && depNode.dlls.length > 0) {
          return {
            ok: false,
            error:
              `NuGet dependency '${depNode.packageId}' is marked as 'types: false' but it contains CLR assemblies.\n` +
              `It is required by '${node.packageId}' and therefore requires bindings.\n` +
              `Fix: remove 'types: false' or provide an external bindings package via 'types: \"<pkg>\"'.`,
          };
        }
        const typesPkg = typesPackageByPkgId.get(depPkgNorm);
        if (typesPkg) {
          const dirRes = resolveTypesLibDir(depNode.packageId);
          if (!dirRes.ok) return dirRes;
          libDirs.add(dirRes.value);
          continue;
        }

        const generated = bindingsDirByLibKey.get(depKey);
        if (generated) libDirs.add(generated);
      }
      for (const depDir of Array.from(libDirs).sort((a, b) => a.localeCompare(b))) {
        generateArgs.push("--lib", depDir);
      }

      for (const rt of runtimes) generateArgs.push("--ref-dir", rt.dir);
      for (const d of compileDirs) generateArgs.push("--ref-dir", d);
      for (const dep of options.deps ?? []) {
        generateArgs.push("--ref-dir", resolveFromProjectRoot(workspaceRoot, dep));
      }

      const genResult = tsbindgenGenerate(workspaceRoot, tsbindgenDll, generateArgs, options);
      if (!genResult.ok) return genResult;

      const installResult = installGeneratedBindingsPackage(workspaceRoot, packageName, outDir);
      if (!installResult.ok) return installResult;
    }
    }
  }

  // 3) Local DLL bindings (dotnet.libraries)
  const typesPackageByLibraryPathKey = new Map<string, string | false>();
  const libraryPaths: string[] = [];
  for (const entry of (dotnet.libraries ?? []) as LibraryReferenceConfig[]) {
    if (typeof entry === "string") {
      libraryPaths.push(entry);
      continue;
    }

    libraryPaths.push(entry.path);
    if (entry.types === undefined) continue;

    const key = normalizeLibraryKey(entry.path);
    if (!key.endsWith(".dll")) {
      return {
        ok: false,
        error:
          `tsonic.workspace.json: dotnet.libraries entry has 'types' but is not a DLL: ${entry.path}`,
      };
    }

    const existing = typesPackageByLibraryPathKey.get(key);
    if (existing !== undefined && existing !== entry.types) {
      return {
        ok: false,
        error:
          `tsonic.workspace.json: conflicting 'types' mapping for '${entry.path}'.\n` +
          `Existing: ${existing}\n` +
          `New: ${entry.types}`,
      };
    }
    typesPackageByLibraryPathKey.set(key, entry.types);
  }

  const dllLibraries = libraryPaths.filter((p) => {
    const normalized = p.replace(/\\/g, "/").toLowerCase();
    if (!normalized.endsWith(".dll")) return false;
    if (isBuiltInRuntimeDllPath(p)) return false;
    // Only DLLs copied into ./libs are eligible for bindings generation.
    return normalized.startsWith("libs/") || normalized.startsWith("./libs/");
  });
  if (dllLibraries.length > 0) {
    const dllAbs = dllLibraries.map((p) => resolveFromProjectRoot(workspaceRoot, p));
    for (const p of dllAbs) {
      if (!existsSync(p)) {
        return {
          ok: false,
          error: `Missing DLL from tsonic.workspace.json dotnet.libraries: ${p}`,
        };
      }
    }

    const userDeps = (options.deps ?? []).map((d) => resolveFromProjectRoot(workspaceRoot, d));
    const refDirs = [...runtimes.map((r) => r.dir), join(workspaceRoot, "libs"), ...userDeps];

    const closureResult = tsbindgenResolveClosure(workspaceRoot, tsbindgenDll, dllAbs, refDirs);
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
      const nextConfig: TsonicWorkspaceConfig = {
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

      const destPath = resolveFromProjectRoot(workspaceRoot, join("libs", basename(asm.path)));
      if (!existsSync(destPath)) {
        return { ok: false, error: `Missing DLL dependency in libs/: ${destPath}` };
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

    const libDirById = new Map<string, string>();
    const noTypesIds = new Set<string>();
    for (const id of order) {
      const asm = byId.get(id);
      const destPath = destPathById.get(id);
      if (!asm || !destPath) return { ok: false, error: `Internal error: missing assembly info for ${id}` };

      const typesPkg = typesPackageByLibraryPathKey.get(
        normalizeLibraryKey(`libs/${basename(destPath)}`)
      );
      if (typesPkg !== undefined) {
        if (typesPkg === false) {
          noTypesIds.add(id);
          continue; // csproj-only dependency; do not generate bindings.
        }
        const typesRoot = resolvePackageRoot(workspaceRoot, typesPkg);
        if (!typesRoot.ok) {
          return {
            ok: false,
            error:
              `Bindings package not found for '${basename(destPath)}': ${typesPkg}\n` +
              `Install it in the workspace and retry (e.g. npm install -D ${typesPkg}).`,
          };
        }
        libDirById.set(id, typesRoot.value);
        continue; // bindings supplied externally; do not auto-generate.
      }

      const packageName = defaultBindingsPackageNameForDll(destPath);
      const outDir = bindingsStoreDir(workspaceRoot, "dll", packageName);
      libDirById.set(id, outDir);

      const pkgJsonResult = ensureGeneratedBindingsPackageJson(outDir, packageName, {
        kind: "dll",
        source: { assemblyName: asm.name, version: asm.version, path: `libs/${basename(destPath)}` },
      });
      if (!pkgJsonResult.ok) return pkgJsonResult;

      const generateArgs: string[] = [
        "-a",
        destPath,
        "-o",
        outDir,
        "--lib",
        dotnetLib,
      ];

      const transitive = Array.from(transitiveDeps.get(id) ?? []);
      for (const depId of transitive) {
        if (noTypesIds.has(depId)) {
          const depAsm = byId.get(depId);
          return {
            ok: false,
            error:
              `Assembly '${asm.name}' depends on '${depAsm?.name ?? depId}', but that dependency is configured with 'types: false'.\n` +
              `Bindings generation for '${asm.name}' requires bindings for all referenced assemblies.\n` +
              `Fix: remove 'types: false' for '${depAsm?.name ?? depId}' or provide an external bindings package via 'types: \"<pkg>\"'.`,
          };
        }
      }

      const libs = transitive
        .map((depId) => libDirById.get(depId))
        .filter((p): p is string => typeof p === "string")
        .sort((a, b) => a.localeCompare(b));
      for (const lib of libs) generateArgs.push("--lib", lib);

      for (const rt of runtimes) generateArgs.push("--ref-dir", rt.dir);
      for (const dep of userDeps) generateArgs.push("--ref-dir", dep);
      generateArgs.push("--ref-dir", join(workspaceRoot, "libs"));
      const runtimeDirResult = resolveTsonicRuntimeDllDir(workspaceRoot);
      if (!runtimeDirResult.ok) return runtimeDirResult;
      generateArgs.push("--ref-dir", runtimeDirResult.value);

      const genResult = tsbindgenGenerate(workspaceRoot, tsbindgenDll, generateArgs, options);
      if (!genResult.ok) return genResult;

      const installResult = installGeneratedBindingsPackage(workspaceRoot, packageName, outDir);
      if (!installResult.ok) return installResult;
    }
  }

  return { ok: true, value: undefined };
};
