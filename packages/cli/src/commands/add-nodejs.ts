/**
 * tsonic add nodejs - add Node.js interop to an existing project.
 *
 * - Installs @tsonic/nodejs (type declarations)
 * - Copies runtime DLLs into ./lib for deterministic builds
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Result } from "../types.js";
import { loadConfig } from "../config.js";
import { copyRuntimeDllsToProjectLib } from "../dotnet/runtime-assets.js";
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

const addUnique = (arr: string[], value: string): void => {
  if (!arr.includes(value)) arr.push(value);
};

export const addNodejsCommand = (
  configPath: string,
  options: AddCommandOptions = {},
  exec: Exec = defaultExec
): Result<void, string> => {
  const projectRoot = dirname(configPath);

  const configResult = loadConfig(configPath);
  if (!configResult.ok) return configResult;
  const config = configResult.value;

  const installResult = ensureDevDependency(
    projectRoot,
    "@tsonic/nodejs",
    options,
    exec
  );
  if (!installResult.ok) return installResult;

  const copyResult = copyRuntimeDllsToProjectLib(projectRoot, {
    includeJsRuntime: true,
    includeNodejs: true,
  });
  if (!copyResult.ok) return copyResult;

  const dotnet = config.dotnet ?? {};
  const libraries = [...(dotnet.libraries ?? [])];
  addUnique(libraries, "lib/Tsonic.JSRuntime.dll");
  addUnique(libraries, "lib/nodejs.dll");

  const writeResult = writeTsonicJson(configPath, {
    ...config,
    dotnet: { ...dotnet, libraries },
  });
  if (!writeResult.ok) return writeResult;

  return { ok: true, value: undefined };
};
