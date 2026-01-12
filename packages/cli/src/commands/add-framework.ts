/**
 * tsonic add framework - add a FrameworkReference to the project, plus bindings.
 *
 * Usage:
 *   tsonic add framework Microsoft.AspNetCore.App [typesPackage]
 *
 * If typesPackage is omitted, bindings are auto-generated via tsbindgen from the
 * installed shared framework assemblies.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Result, TsonicConfig } from "../types.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForFramework,
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
  writeTsonicJson,
} from "./add-common.js";

export type AddFrameworkOptions = AddCommandOptions;

const addUnique = (arr: string[], value: string): void => {
  if (!arr.includes(value)) arr.push(value);
};

const isValidTypesPackageName = (name: string): boolean => {
  if (!name.startsWith("@") && !name.includes("/")) return true;
  return /^@[a-z0-9-]+\/[a-z0-9-]+$/i.test(name);
};

export const addFrameworkCommand = (
  frameworkReference: string,
  typesPackage: string | undefined,
  projectRoot: string,
  options: AddFrameworkOptions = {}
): Result<{ frameworkReference: string; bindings: string }, string> => {
  if (!frameworkReference.trim()) {
    return { ok: false, error: "Framework reference must be non-empty" };
  }
  if (typesPackage !== undefined && !isValidTypesPackageName(typesPackage)) {
    return { ok: false, error: `Invalid types package name: ${typesPackage}` };
  }

  const tsonicConfigResult = readTsonicJson(projectRoot);
  if (!tsonicConfigResult.ok) return tsonicConfigResult;
  const { path: configPath, config } = tsonicConfigResult.value;

  const dotnet = config.dotnet ?? {};
  const frameworkRefs = [...(dotnet.frameworkReferences ?? [])];
  addUnique(frameworkRefs, frameworkReference);

  const nextConfig: TsonicConfig = {
    ...config,
    dotnet: {
      ...dotnet,
      frameworkReferences: frameworkRefs,
    },
  };

  const writeResult = writeTsonicJson(configPath, nextConfig);
  if (!writeResult.ok) return writeResult;

  if (typesPackage) {
    const installResult = npmInstallDevDependency(projectRoot, typesPackage, options);
    if (!installResult.ok) return installResult;
    return {
      ok: true,
      value: { frameworkReference, bindings: typesPackage },
    };
  }

  const tsbindgenDllResult = resolveTsbindgenDllPath(projectRoot);
  if (!tsbindgenDllResult.ok) return tsbindgenDllResult;
  const tsbindgenDll = tsbindgenDllResult.value;

  const runtimesResult = listDotnetRuntimes(projectRoot);
  if (!runtimesResult.ok) return runtimesResult;
  const runtimes = runtimesResult.value;

  const runtime = runtimes.find((r) => r.name === frameworkReference);
  if (!runtime) {
    const available = runtimes.map((r) => `${r.name} ${r.version}`).join("\n");
    return {
      ok: false,
      error:
        `Framework runtime not found: ${frameworkReference}\n` +
        `Installed runtimes:\n${available}`,
    };
  }

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

  const naming = detectTsbindgenNaming(nextConfig);
  const generatedPackage = defaultBindingsPackageNameForFramework(frameworkReference);
  const bindingsDir = bindingsStoreDir(projectRoot, "framework", generatedPackage);

  const packageJsonResult = ensureGeneratedBindingsPackageJson(bindingsDir, generatedPackage, {
    kind: "framework",
    source: { frameworkReference },
  });
  if (!packageJsonResult.ok) return packageJsonResult;

  const generateArgs: string[] = [
    "-d",
    runtime.dir,
    "-o",
    bindingsDir,
    "--naming",
    naming,
    "--lib",
    dotnetLib,
    "--lib",
    coreLib,
  ];
  for (const rt of runtimes) {
    generateArgs.push("--ref-dir", rt.dir);
  }
  for (const dep of options.deps ?? []) {
    generateArgs.push("--ref-dir", resolveFromProjectRoot(projectRoot, dep));
  }

  const genResult = tsbindgenGenerate(projectRoot, tsbindgenDll, generateArgs, options);
  if (!genResult.ok) return genResult;

  const installResult = installGeneratedBindingsPackage(projectRoot, generatedPackage, bindingsDir);
  if (!installResult.ok) return installResult;

  return {
    ok: true,
    value: { frameworkReference, bindings: generatedPackage },
  };
};
