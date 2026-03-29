import { join } from "node:path";
import type { PackageReferenceConfig, Result } from "../../types.js";
import { type AddCommandOptions, type DotnetRuntime } from "../add-common.js";
import {
  writeRestoreProject,
  dotnetRestore,
  parseProjectAssets,
} from "./shared.js";
import { prepareNugetRestorePlan } from "./nuget-planning.js";
import { generateNugetBindings } from "./nuget-generation.js";

type RestoreNugetBindingsOptions = {
  readonly workspaceRoot: string;
  readonly targetFramework: string;
  readonly nugetConfigFile: string;
  readonly packageReferencesAll: readonly PackageReferenceConfig[];
  readonly runtimes: readonly DotnetRuntime[];
  readonly dotnetLib: string;
  readonly tsbindgenDll: string;
  readonly options: AddCommandOptions;
};

export const restoreNugetBindings = ({
  workspaceRoot,
  targetFramework,
  nugetConfigFile,
  packageReferencesAll,
  runtimes,
  dotnetLib,
  tsbindgenDll,
  options,
}: RestoreNugetBindingsOptions): Result<void, string> => {
  if (packageReferencesAll.length === 0) {
    return { ok: true, value: undefined };
  }

  const restoreDir = join(workspaceRoot, ".tsonic", "nuget");
  const restoreProject = writeRestoreProject(
    restoreDir,
    targetFramework,
    packageReferencesAll.map((pkg) => ({ id: pkg.id, version: pkg.version }))
  );
  if (!restoreProject.ok) return restoreProject;

  const assetsPathResult = dotnetRestore(
    restoreProject.value,
    nugetConfigFile,
    options,
    workspaceRoot
  );
  if (!assetsPathResult.ok) return assetsPathResult;

  const assetsResult = parseProjectAssets(assetsPathResult.value);
  if (!assetsResult.ok) return assetsResult;

  const planResult = prepareNugetRestorePlan(
    workspaceRoot,
    targetFramework,
    packageReferencesAll,
    assetsResult.value
  );
  if (!planResult.ok) return planResult;

  return generateNugetBindings({
    workspaceRoot,
    dotnetLib,
    runtimes,
    tsbindgenDll,
    options,
    plan: planResult.value,
  });
};
