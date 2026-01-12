/**
 * tsonic add framework - add a FrameworkReference to the project, plus bindings.
 *
 * Usage:
 *   tsonic add framework Microsoft.AspNetCore.App [typesPackage]
 *
 * If typesPackage is omitted, bindings are auto-generated via tsbindgen from the
 * installed shared framework assemblies.
 */

import type { Result, TsonicConfig } from "../types.js";
import { loadConfig } from "../config.js";
import { dirname } from "node:path";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForFramework,
  detectTsbindgenNaming,
  ensureGeneratedBindingsPackageJson,
  installGeneratedBindingsPackage,
  listDotnetRuntimes,
  npmInstallDevDependency,
  resolveFromProjectRoot,
  resolvePackageRoot,
  resolveTsbindgenDllPath,
  tsbindgenGenerate,
  type AddCommandOptions,
  writeTsonicJson,
} from "./add-common.js";

export type AddFrameworkOptions = AddCommandOptions;

type FrameworkReferenceConfig =
  | string
  | { readonly id: string; readonly types?: string };

const normalizeFrameworkRefId = (value: FrameworkReferenceConfig): string =>
  typeof value === "string" ? value : value.id;

const isValidTypesPackageName = (name: string): boolean => {
  if (!name.startsWith("@") && !name.includes("/")) return true;
  return /^@[a-z0-9-]+\/[a-z0-9-]+$/i.test(name);
};

export const addFrameworkCommand = (
  frameworkReference: string,
  typesPackage: string | undefined,
  configPath: string,
  options: AddFrameworkOptions = {}
): Result<{ frameworkReference: string; bindings: string }, string> => {
  const projectRoot = dirname(configPath);
  if (!frameworkReference.trim()) {
    return { ok: false, error: "Framework reference must be non-empty" };
  }
  if (typesPackage !== undefined && !isValidTypesPackageName(typesPackage)) {
    return { ok: false, error: `Invalid types package name: ${typesPackage}` };
  }

  const tsonicConfigResult = loadConfig(configPath);
  if (!tsonicConfigResult.ok) return tsonicConfigResult;
  const config = tsonicConfigResult.value;

  const dotnet = config.dotnet ?? {};
  const frameworkRefs: FrameworkReferenceConfig[] = [
    ...((dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[]),
  ];

  const idx = frameworkRefs.findIndex(
    (r) =>
      normalizeFrameworkRefId(r).toLowerCase() ===
      frameworkReference.toLowerCase()
  );

  if (idx >= 0) {
    const existing = frameworkRefs[idx] as FrameworkReferenceConfig;
    if (typesPackage) {
      if (typeof existing === "string") {
        frameworkRefs[idx] = { id: existing, types: typesPackage };
      } else if (existing.types && existing.types !== typesPackage) {
        return {
          ok: false,
          error:
            `Framework reference already present with a different types package:\n` +
            `- ${frameworkReference}\n` +
            `- existing: ${existing.types}\n` +
            `- requested: ${typesPackage}\n` +
            `Refusing to change automatically (airplane-grade). Update tsonic.json manually if intended.`,
        };
      } else {
        frameworkRefs[idx] = { ...existing, types: typesPackage };
      }
    }
  } else {
    frameworkRefs.push(
      typesPackage ? { id: frameworkReference, types: typesPackage } : frameworkReference
    );
  }

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

  const dotnetRoot = resolvePackageRoot(projectRoot, "@tsonic/dotnet");
  if (!dotnetRoot.ok) return dotnetRoot;
  const coreRoot = resolvePackageRoot(projectRoot, "@tsonic/core");
  if (!coreRoot.ok) return coreRoot;
  const dotnetLib = dotnetRoot.value;
  const coreLib = coreRoot.value;

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
