import type { Result } from "../../types.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForNuget,
  ensureGeneratedBindingsPackageJson,
  installGeneratedBindingsPackage,
  resolveFromProjectRoot,
  resolvePackageRoot,
  tsbindgenGenerate,
  type AddCommandOptions,
  type DotnetRuntime,
} from "../add-common.js";
import { normalizePkgId } from "./shared.js";
import type { NugetRestorePlan } from "./nuget-types.js";

type GenerateNugetBindingsOptions = {
  readonly workspaceRoot: string;
  readonly dotnetLib: string;
  readonly runtimes: readonly DotnetRuntime[];
  readonly tsbindgenDll: string;
  readonly options: AddCommandOptions;
  readonly plan: NugetRestorePlan;
};

const appendCommonRefDirs = (
  generateArgs: string[],
  runtimes: readonly DotnetRuntime[],
  compileDirs: readonly string[],
  workspaceRoot: string,
  options: AddCommandOptions
): void => {
  for (const runtime of runtimes) generateArgs.push("--ref-dir", runtime.dir);
  for (const compileDir of compileDirs)
    generateArgs.push("--ref-dir", compileDir);
  for (const dep of options.deps ?? []) {
    generateArgs.push("--ref-dir", resolveFromProjectRoot(workspaceRoot, dep));
  }
};

export const generateNugetBindings = ({
  workspaceRoot,
  dotnetLib,
  runtimes,
  tsbindgenDll,
  options,
  plan,
}: GenerateNugetBindingsOptions): Result<void, string> => {
  const bindingsDirByLibKey = new Map(plan.bindingsDirByLibKey);
  const typesLibDirByPkgId = new Map<string, string>();

  const resolveTypesLibDir = (packageId: string): Result<string, string> => {
    const norm = normalizePkgId(packageId);
    const existing = typesLibDirByPkgId.get(norm);
    if (existing) return { ok: true, value: existing };

    const typesPkg = plan.typesPackageByPkgId.get(norm);
    if (!typesPkg) {
      return {
        ok: false,
        error: `Internal error: missing types package for ${packageId}`,
      };
    }

    const root = resolvePackageRoot(workspaceRoot, typesPkg);
    if (!root.ok) return root;
    typesLibDirByPkgId.set(norm, root.value);
    return { ok: true, value: root.value };
  };

  for (const libKey of plan.topo) {
    const node = plan.packagesByLibKey.get(libKey);
    if (!node) continue;

    if (
      plan.claimedByLibKey.has(libKey) &&
      !plan.metaPlanByLibKey.has(libKey)
    ) {
      continue;
    }

    const declared = plan.packageReferencesAll.find(
      (pkg) => normalizePkgId(pkg.id) === normalizePkgId(node.packageId)
    );
    if (declared?.types === false) {
      return {
        ok: false,
        error:
          `PackageReference '${declared.id}' is marked as 'types: false' but it contains CLR assemblies.\n` +
          `This package is part of the bindings dependency closure and therefore requires bindings.\n` +
          `Fix: remove 'types: false' or provide an external bindings package via 'types: "<pkg>"'.`,
      };
    }
    if (declared?.types !== undefined) continue;

    const packageName = defaultBindingsPackageNameForNuget(node.packageId);
    const defaultOutDir = bindingsStoreDir(workspaceRoot, "nuget", packageName);
    const seedDlls = [...node.dlls];

    if (seedDlls.length === 0) {
      const planForRoot = plan.metaPlanByLibKey.get(libKey);
      if (!planForRoot) continue;

      bindingsDirByLibKey.set(libKey, planForRoot.outDir);
      const pkgJsonResult = ensureGeneratedBindingsPackageJson(
        planForRoot.outDir,
        packageName,
        {
          kind: "nuget",
          source: { packageId: node.packageId, version: node.version },
        }
      );
      if (!pkgJsonResult.ok) return pkgJsonResult;

      const generateArgs: string[] = [
        ...planForRoot.seedDlls.flatMap((pathLike) => ["-a", pathLike]),
        "-o",
        planForRoot.outDir,
        "--lib",
        dotnetLib,
      ];

      const libDirs = new Set<string>();
      for (const depKey of plan.transitiveDeps.get(libKey) ?? []) {
        if (planForRoot.claimedLibKeys.has(depKey)) continue;
        const depNode = plan.packagesByLibKey.get(depKey);
        if (!depNode) continue;

        const depPkgNorm = normalizePkgId(depNode.packageId);
        if (plan.typesFalsePkgIds.has(depPkgNorm) && depNode.dlls.length > 0) {
          return {
            ok: false,
            error:
              `NuGet dependency '${depNode.packageId}' is marked as 'types: false' but it contains CLR assemblies.\n` +
              `It is required by '${node.packageId}' and therefore requires bindings.\n` +
              `Fix: remove 'types: false' or provide an external bindings package via 'types: "<pkg>"'.`,
          };
        }

        const typesPkg = plan.typesPackageByPkgId.get(depPkgNorm);
        if (typesPkg) {
          const dirResult = resolveTypesLibDir(depNode.packageId);
          if (!dirResult.ok) return dirResult;
          libDirs.add(dirResult.value);
          continue;
        }

        const generated = bindingsDirByLibKey.get(depKey);
        if (generated) libDirs.add(generated);
      }

      for (const depDir of Array.from(libDirs).sort((left, right) =>
        left.localeCompare(right)
      )) {
        generateArgs.push("--lib", depDir);
      }
      appendCommonRefDirs(
        generateArgs,
        runtimes,
        plan.compileDirs,
        workspaceRoot,
        options
      );

      const genResult = tsbindgenGenerate(
        workspaceRoot,
        tsbindgenDll,
        generateArgs,
        options
      );
      if (!genResult.ok) return genResult;

      const installResult = installGeneratedBindingsPackage(
        workspaceRoot,
        packageName,
        planForRoot.outDir
      );
      if (!installResult.ok) return installResult;
      continue;
    }

    bindingsDirByLibKey.set(libKey, defaultOutDir);
    const pkgJsonResult = ensureGeneratedBindingsPackageJson(
      defaultOutDir,
      packageName,
      {
        kind: "nuget",
        source: { packageId: node.packageId, version: node.version },
      }
    );
    if (!pkgJsonResult.ok) return pkgJsonResult;

    const generateArgs: string[] = [
      ...seedDlls.flatMap((pathLike) => ["-a", pathLike]),
      "-o",
      defaultOutDir,
      "--lib",
      dotnetLib,
    ];

    const libDirs = new Set<string>();
    for (const depKey of plan.transitiveDeps.get(libKey) ?? []) {
      const depNode = plan.packagesByLibKey.get(depKey);
      if (!depNode) continue;

      const depPkgNorm = normalizePkgId(depNode.packageId);
      if (plan.typesFalsePkgIds.has(depPkgNorm) && depNode.dlls.length > 0) {
        return {
          ok: false,
          error:
            `NuGet dependency '${depNode.packageId}' is marked as 'types: false' but it contains CLR assemblies.\n` +
            `It is required by '${node.packageId}' and therefore requires bindings.\n` +
            `Fix: remove 'types: false' or provide an external bindings package via 'types: "<pkg>"'.`,
        };
      }

      const typesPkg = plan.typesPackageByPkgId.get(depPkgNorm);
      if (typesPkg) {
        const dirResult = resolveTypesLibDir(depNode.packageId);
        if (!dirResult.ok) return dirResult;
        libDirs.add(dirResult.value);
        continue;
      }

      const generated = bindingsDirByLibKey.get(depKey);
      if (generated) libDirs.add(generated);
    }

    for (const depDir of Array.from(libDirs).sort((left, right) =>
      left.localeCompare(right)
    )) {
      generateArgs.push("--lib", depDir);
    }
    appendCommonRefDirs(
      generateArgs,
      runtimes,
      plan.compileDirs,
      workspaceRoot,
      options
    );

    const genResult = tsbindgenGenerate(
      workspaceRoot,
      tsbindgenDll,
      generateArgs,
      options
    );
    if (!genResult.ok) return genResult;

    const installResult = installGeneratedBindingsPackage(
      workspaceRoot,
      packageName,
      defaultOutDir
    );
    if (!installResult.ok) return installResult;
  }

  return { ok: true, value: undefined };
};
