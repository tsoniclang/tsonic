import { dirname } from "node:path";
import type { PackageReferenceConfig, Result } from "../../types.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForNuget,
} from "../add-common.js";
import {
  collectPackageTargets,
  findTargetKey,
  normalizePkgId,
  pickPackageFolder,
  type PackageTarget,
  type ProjectAssets,
} from "./shared.js";
import type { MetaPlan, NugetRestorePlan } from "./nuget-types.js";

const topologicallySortDependencies = (
  closure: ReadonlySet<string>,
  depsByLibKey: ReadonlyMap<string, readonly string[]>
): Result<readonly string[], string> => {
  const topo: string[] = [];
  const state = new Map<string, "visiting" | "done">();

  const visit = (libKey: string): Result<void, string> => {
    const current = state.get(libKey);
    if (current === "done") return { ok: true, value: undefined };
    if (current === "visiting") {
      return {
        ok: false,
        error: `Cycle detected in NuGet dependency graph at: ${libKey}`,
      };
    }

    state.set(libKey, "visiting");
    for (const dep of depsByLibKey.get(libKey) ?? []) {
      const result = visit(dep);
      if (!result.ok) return result;
    }
    state.set(libKey, "done");
    topo.push(libKey);
    return { ok: true, value: undefined };
  };

  for (const libKey of closure) {
    const result = visit(libKey);
    if (!result.ok) return result;
  }

  return { ok: true, value: topo };
};

const collectTransitiveDeps = (
  topo: readonly string[],
  depsByLibKey: ReadonlyMap<string, readonly string[]>
): ReadonlyMap<string, ReadonlySet<string>> => {
  const transitiveDeps = new Map<string, Set<string>>();

  for (const libKey of topo) {
    const transitive = new Set<string>();
    for (const dep of depsByLibKey.get(libKey) ?? []) {
      transitive.add(dep);
      const depTransitive = transitiveDeps.get(dep);
      if (!depTransitive) continue;
      for (const nested of depTransitive) transitive.add(nested);
    }
    transitiveDeps.set(libKey, transitive);
  }

  return transitiveDeps;
};

const buildMetaPlans = (
  workspaceRoot: string,
  roots: readonly string[],
  packagesByLibKey: ReadonlyMap<string, PackageTarget>,
  packageReferencesAll: readonly PackageReferenceConfig[],
  transitiveDeps: ReadonlyMap<string, ReadonlySet<string>>,
  typesFalsePkgIds: ReadonlySet<string>,
  typesPackageByPkgId: ReadonlyMap<string, string>
): Result<{
  readonly metaPlanByLibKey: ReadonlyMap<string, MetaPlan>;
  readonly claimedByLibKey: ReadonlyMap<string, string>;
  readonly bindingsDirByLibKey: ReadonlyMap<string, string>;
}, string> => {
  const rootsSet = new Set<string>(roots);
  const rootReachCount = new Map<string, number>();
  for (const root of roots) {
    rootReachCount.set(root, (rootReachCount.get(root) ?? 0) + 1);
    for (const dep of transitiveDeps.get(root) ?? []) {
      rootReachCount.set(dep, (rootReachCount.get(dep) ?? 0) + 1);
    }
  }

  const metaPlanByLibKey = new Map<string, MetaPlan>();
  const claimedByLibKey = new Map<string, string>();
  const bindingsDirByLibKey = new Map<string, string>();

  for (const rootLibKey of roots) {
    const node = packagesByLibKey.get(rootLibKey);
    if (!node || node.dlls.length > 0) continue;

    const declared = packageReferencesAll.find(
      (pkg) => normalizePkgId(pkg.id) === normalizePkgId(node.packageId)
    );
    if (!declared || declared.types !== undefined) continue;

    const packageName = defaultBindingsPackageNameForNuget(node.packageId);
    const outDir = bindingsStoreDir(workspaceRoot, "nuget", packageName);
    const claimed = new Set<string>();
    const seedDlls = new Set<string>();

    for (const depKey of transitiveDeps.get(rootLibKey) ?? []) {
      if (rootsSet.has(depKey)) continue;
      const depNode = packagesByLibKey.get(depKey);
      if (!depNode || depNode.dlls.length === 0) continue;

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

      if (typesPackageByPkgId.has(depPkgNorm)) continue;
      if ((rootReachCount.get(depKey) ?? 0) > 1) continue;

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
      for (const dll of depNode.dlls) seedDlls.add(dll);
    }

    const sortedSeedDlls = Array.from(seedDlls).sort((left, right) =>
      left.localeCompare(right)
    );
    if (sortedSeedDlls.length === 0) {
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
      seedDlls: sortedSeedDlls,
    });

    for (const depKey of claimed) {
      bindingsDirByLibKey.set(depKey, outDir);
    }
  }

  return {
    ok: true,
    value: { metaPlanByLibKey, claimedByLibKey, bindingsDirByLibKey },
  };
};

export const prepareNugetRestorePlan = (
  workspaceRoot: string,
  targetFramework: string,
  packageReferencesAll: readonly PackageReferenceConfig[],
  assets: ProjectAssets
): Result<NugetRestorePlan, string> => {
  const packageFolder = pickPackageFolder(assets);
  if (!packageFolder) {
    return {
      ok: false,
      error: "project.assets.json missing packageFolders (unexpected)",
    };
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
  for (const pkg of packageReferencesAll.filter((candidate) => candidate.types === undefined)) {
    const root = libKeyByPkgId.get(normalizePkgId(pkg.id));
    if (!root) {
      return {
        ok: false,
        error:
          `Restore did not produce a target library entry for ${pkg.id} ${pkg.version}.\n` +
          `This may indicate the package is incompatible with ${targetFramework}.`,
      };
    }
    roots.push(root);
  }

  const closure = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const libKey = queue.pop();
    if (!libKey || closure.has(libKey)) continue;
    closure.add(libKey);
    const node = packagesByLibKey.get(libKey);
    if (!node) continue;
    for (const depId of node.dependencies) {
      const depLibKey = libKeyByPkgId.get(normalizePkgId(depId));
      if (depLibKey) queue.push(depLibKey);
    }
  }

  const depsByLibKey = new Map<string, readonly string[]>();
  for (const libKey of closure) {
    const node = packagesByLibKey.get(libKey);
    if (!node) continue;
    const deps = node.dependencies
      .map((depId) => libKeyByPkgId.get(normalizePkgId(depId)))
      .filter((depLibKey): depLibKey is string => typeof depLibKey === "string")
      .filter((depLibKey) => closure.has(depLibKey));
    depsByLibKey.set(libKey, Array.from(new Set(deps)));
  }

  const topoResult = topologicallySortDependencies(closure, depsByLibKey);
  if (!topoResult.ok) return topoResult;
  const topo = topoResult.value;

  const compileDirs = Array.from(
    new Set(
      topo.flatMap((libKey) => {
        const node = packagesByLibKey.get(libKey);
        return node ? node.dlls.map((dll) => dirname(dll)) : [];
      })
    )
  ).sort((left, right) => left.localeCompare(right));

  const typesFalsePkgIds = new Set<string>();
  const typesPackageByPkgId = new Map<string, string>();
  for (const pkg of packageReferencesAll) {
    if (pkg.types === false) {
      typesFalsePkgIds.add(normalizePkgId(pkg.id));
      continue;
    }
    if (typeof pkg.types === "string" && pkg.types.trim().length > 0) {
      typesPackageByPkgId.set(normalizePkgId(pkg.id), pkg.types);
    }
  }

  const transitiveDeps = collectTransitiveDeps(topo, depsByLibKey);
  const metaPlanResult = buildMetaPlans(
    workspaceRoot,
    roots,
    packagesByLibKey,
    packageReferencesAll,
    transitiveDeps,
    typesFalsePkgIds,
    typesPackageByPkgId
  );
  if (!metaPlanResult.ok) return metaPlanResult;

  return {
    ok: true,
    value: {
      packageReferencesAll,
      packagesByLibKey,
      topo,
      compileDirs,
      transitiveDeps,
      typesFalsePkgIds,
      typesPackageByPkgId,
      bindingsDirByLibKey: metaPlanResult.value.bindingsDirByLibKey,
      metaPlanByLibKey: metaPlanResult.value.metaPlanByLibKey,
      claimedByLibKey: metaPlanResult.value.claimedByLibKey,
    },
  };
};
