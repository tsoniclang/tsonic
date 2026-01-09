/**
 * tsonic add package - add a local DLL to the project, plus bindings.
 *
 * Usage:
 *   tsonic add package ./path/to/MyLib.dll [typesPackage]
 *
 * Airplane-grade rules:
 * - DLL dependencies are copied by transitive closure (no "copy everything" modes)
 * - If typesPackage is omitted, bindings are auto-generated via tsbindgen
 * - Any unresolved dependency is a hard failure with actionable diagnostics
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import type { Result, TsonicConfig } from "../types.js";
import {
  defaultBindingsPackageNameForDll,
  detectTsbindgenNaming,
  ensurePackageJson,
  listDotnetRuntimes,
  npmInstallDevDependency,
  readTsonicJson,
  resolveFromProjectRoot,
  resolveTsbindgenDllPath,
  tsbindgenGenerate,
  tsbindgenResolveClosure,
  type AddCommandOptions,
  writeTsonicJson,
} from "./add-common.js";

export type AddPackageOptions = AddCommandOptions;

const sha256File = (path: string): string => {
  const data = readFileSync(path);
  // crypto.update's types are stricter than Buffer's ArrayBufferLike surface.
  // Convert to a standard Uint8Array backed by ArrayBuffer.
  return createHash("sha256").update(new Uint8Array(data)).digest("hex");
};

const addUnique = (arr: string[], value: string): void => {
  if (!arr.includes(value)) arr.push(value);
};

const isValidTypesPackageName = (name: string): boolean => {
  if (!name.startsWith("@") && !name.includes("/")) return true;
  return /^@[a-z0-9-]+\/[a-z0-9-]+$/i.test(name);
};

const pathIsWithin = (path: string, dir: string): boolean => {
  const normalizedDir = dir.endsWith("/") ? dir : `${dir}/`;
  const normalizedPath = path.replace(/\\/g, "/");
  const normalizedBase = normalizedDir.replace(/\\/g, "/");
  return normalizedPath.startsWith(normalizedBase);
};

export const addPackageCommand = (
  dllPath: string,
  typesPackage: string | undefined,
  projectRoot: string,
  options: AddPackageOptions = {}
): Result<{ dllsCopied: number; bindings: string }, string> => {
  const dllAbs = resolveFromProjectRoot(projectRoot, dllPath);

  if (!existsSync(dllAbs)) {
    return { ok: false, error: `DLL not found: ${dllAbs}` };
  }
  if (!dllAbs.toLowerCase().endsWith(".dll")) {
    return {
      ok: false,
      error: `Invalid DLL path: ${dllAbs} (must end with .dll)`,
    };
  }

  if (typesPackage !== undefined && !isValidTypesPackageName(typesPackage)) {
    return { ok: false, error: `Invalid types package name: ${typesPackage}` };
  }

  const tsonicConfigResult = readTsonicJson(projectRoot);
  if (!tsonicConfigResult.ok) return tsonicConfigResult;
  const { path: configPath, config } = tsonicConfigResult.value;

  const tsbindgenDllResult = resolveTsbindgenDllPath(projectRoot);
  if (!tsbindgenDllResult.ok) return tsbindgenDllResult;
  const tsbindgenDll = tsbindgenDllResult.value;

  const runtimesResult = listDotnetRuntimes(projectRoot);
  if (!runtimesResult.ok) return runtimesResult;
  const runtimeDirs = runtimesResult.value;

  const userDeps = (options.deps ?? []).map((d) =>
    resolveFromProjectRoot(projectRoot, d)
  );

  const refDirs = [
    ...runtimeDirs.map((r) => r.dir),
    join(projectRoot, "lib"),
    ...userDeps,
  ];

  const closureResult = tsbindgenResolveClosure(
    projectRoot,
    tsbindgenDll,
    [dllAbs],
    refDirs
  );
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
  const dllsToCopy: string[] = [];

  for (const asm of closure.resolvedAssemblies) {
    const runtimeDir = runtimeDirs.find((rt) => pathIsWithin(asm.path, rt.dir));
    if (runtimeDir) {
      if (runtimeDir.name !== "Microsoft.NETCore.App") {
        requiredFrameworkRefs.add(runtimeDir.name);
      }
      continue; // framework-provided
    }
    dllsToCopy.push(asm.path);
  }

  const libDir = join(projectRoot, "lib");
  mkdirSync(libDir, { recursive: true });

  let copiedCount = 0;
  const copiedRelPaths: string[] = [];
  for (const srcPath of dllsToCopy) {
    const fileName = basename(srcPath);
    const destPath = join(libDir, fileName);

    if (existsSync(destPath)) {
      const a = sha256File(srcPath);
      const b = sha256File(destPath);
      if (a !== b) {
        return {
          ok: false,
          error:
            `Conflict: lib/${fileName} already exists and differs from the resolved dependency closure.\n` +
            `Resolve this conflict (remove/rename the existing DLL) and retry.`,
        };
      }
    } else {
      copyFileSync(srcPath, destPath);
      copiedCount++;
    }

    copiedRelPaths.push(`lib/${fileName}`);
  }

  const dotnet = config.dotnet ?? {};
  const libraries = [...(dotnet.libraries ?? [])];
  for (const rel of copiedRelPaths) {
    addUnique(libraries, rel);
  }

  const frameworkRefs = [...(dotnet.frameworkReferences ?? [])];
  for (const fr of requiredFrameworkRefs) {
    addUnique(frameworkRefs, fr);
  }

  const nextConfig: TsonicConfig = {
    ...config,
    dotnet: {
      ...dotnet,
      libraries,
      frameworkReferences: frameworkRefs,
    },
  };

  const writeResult = writeTsonicJson(configPath, nextConfig);
  if (!writeResult.ok) return writeResult;

  // Install or generate bindings.
  if (typesPackage) {
    const installResult = npmInstallDevDependency(projectRoot, typesPackage, options);
    if (!installResult.ok) return installResult;
    return {
      ok: true,
      value: { dllsCopied: copiedCount, bindings: typesPackage },
    };
  }

  const naming = detectTsbindgenNaming(nextConfig);
  const generatedPackage = defaultBindingsPackageNameForDll(dllAbs);
  const bindingsDir = join(projectRoot, "bindings", generatedPackage);

  const packageJsonResult = ensurePackageJson(bindingsDir, generatedPackage);
  if (!packageJsonResult.ok) return packageJsonResult;

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

  const rootDllName = basename(dllAbs);
  const rootDllInLib = join(libDir, rootDllName);
  if (!existsSync(rootDllInLib)) {
    return {
      ok: false,
      error: `Internal error: expected ${rootDllInLib} to exist after copy.`,
    };
  }

  const generateArgs: string[] = [
    "-a",
    rootDllInLib,
    "-o",
    bindingsDir,
    "--naming",
    naming,
    "--lib",
    dotnetLib,
    "--lib",
    coreLib,
  ];
  for (const dir of runtimeDirs) {
    generateArgs.push("--ref-dir", dir.dir);
  }
  for (const dep of userDeps) {
    generateArgs.push("--ref-dir", dep);
  }
  generateArgs.push("--ref-dir", libDir);

  const genResult = tsbindgenGenerate(projectRoot, tsbindgenDll, generateArgs, options);
  if (!genResult.ok) return genResult;

  const ensurePkg = ensurePackageJson(bindingsDir, generatedPackage);
  if (!ensurePkg.ok) return ensurePkg;

  const installLocal = npmInstallDevDependency(
    projectRoot,
    `file:bindings/${generatedPackage}`,
    options
  );
  if (!installLocal.ok) return installLocal;

  return {
    ok: true,
    value: { dllsCopied: copiedCount, bindings: generatedPackage },
  };
};
