/**
 * tsonic add nodejs - add Node.js interop to a workspace.
 *
 * - Installs @tsonic/nodejs (type declarations)
 * - Copies runtime DLLs into ./libs for deterministic builds
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { LibraryReferenceConfig, Result } from "../types.js";
import { loadWorkspaceConfig } from "../config.js";
import { copyRuntimeDllsToWorkspaceLibs } from "../dotnet/runtime-assets.js";
import {
  defaultExec,
  npmInstallDevDependency,
  writeTsonicJson,
  type Exec,
  type AddCommandOptions,
} from "./add-common.js";

const hasPackage = (projectRoot: string, name: string): boolean => {
  const pkgJsonPath = join(projectRoot, "package.json");
  if (!existsSync(pkgJsonPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return (
      pkg.dependencies?.[name] !== undefined ||
      pkg.devDependencies?.[name] !== undefined
    );
  } catch {
    return false;
  }
};

const ensureDevDependency = (
  projectRoot: string,
  packageName: string,
  options: AddCommandOptions,
  exec: Exec
): Result<void, string> => {
  if (hasPackage(projectRoot, packageName)) return { ok: true, value: undefined };
  return npmInstallDevDependency(projectRoot, `${packageName}@latest`, options, exec);
};

const normalizeLibraryKey = (pathLike: string): string =>
  pathLike.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();

const getLibraryPath = (entry: LibraryReferenceConfig): string =>
  typeof entry === "string" ? entry : entry.path;

const addUniqueLibraryPath = (
  entries: LibraryReferenceConfig[],
  libraryPath: string
): void => {
  const key = normalizeLibraryKey(libraryPath);
  if (entries.some((e) => normalizeLibraryKey(getLibraryPath(e)) === key)) return;
  entries.push(libraryPath);
};

export const addNodejsCommand = (
  configPath: string,
  options: AddCommandOptions = {},
  exec: Exec = defaultExec
): Result<void, string> => {
  const workspaceRoot = dirname(configPath);

  const configResult = loadWorkspaceConfig(configPath);
  if (!configResult.ok) return configResult;
  const config = configResult.value;

  const installResult = ensureDevDependency(
    workspaceRoot,
    "@tsonic/nodejs",
    options,
    exec
  );
  if (!installResult.ok) return installResult;

  const copyResult = copyRuntimeDllsToWorkspaceLibs(workspaceRoot, {
    includeJsRuntime: true,
    includeNodejs: true,
  });
  if (!copyResult.ok) return copyResult;

  const dotnet = config.dotnet ?? {};
  const libraries: LibraryReferenceConfig[] = [...(dotnet.libraries ?? [])];
  addUniqueLibraryPath(libraries, "libs/Tsonic.JSRuntime.dll");
  addUniqueLibraryPath(libraries, "libs/nodejs.dll");

  const writeResult = writeTsonicJson(configPath, {
    ...config,
    dotnet: { ...dotnet, libraries },
  });
  if (!writeResult.ok) return writeResult;

  return { ok: true, value: undefined };
};
