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
import { basename, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import type { Result, TsonicConfig } from "../types.js";
import { loadConfig } from "../config.js";
import { isBuiltInRuntimeDllPath } from "../dotnet/runtime-dlls.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForDll,
  detectTsbindgenNaming,
  ensureGeneratedBindingsPackageJson,
  installGeneratedBindingsPackage,
  listDotnetRuntimes,
  npmInstallDevDependency,
  resolveFromProjectRoot,
  resolvePackageRoot,
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

type FrameworkReferenceConfig =
  | string
  | { readonly id: string; readonly types?: string };

const hasFrameworkReference = (
  arr: readonly FrameworkReferenceConfig[],
  value: string
): boolean =>
  arr.some(
    (r) => (typeof r === "string" ? r : r.id).toLowerCase() === value.toLowerCase()
  );

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
  configPath: string,
  options: AddPackageOptions = {}
): Result<{ dllsCopied: number; bindings: string }, string> => {
  const projectRoot = dirname(configPath);
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
  if (isBuiltInRuntimeDllPath(dllAbs)) {
    const dllName = basename(dllAbs);
    const lower = dllName.toLowerCase();
    if (lower === "tsonic.runtime.dll") {
      return {
        ok: false,
        error:
          `Refusing to add ${dllName}.\n` +
          `Tsonic always references its core runtime automatically; do not list it in dotnet.libraries.`,
      };
    }
    if (lower === "tsonic.jsruntime.dll") {
      return {
        ok: false,
        error:
          `Refusing to add ${dllName} via 'tsonic add package'.\n` +
          `Use 'tsonic add js' (or 'tsonic project init --js') to install @tsonic/js and add the DLL reference.`,
      };
    }
    if (lower === "nodejs.dll") {
      return {
        ok: false,
        error:
          `Refusing to add ${dllName} via 'tsonic add package'.\n` +
          `Use 'tsonic add nodejs' (or 'tsonic project init --nodejs') to install @tsonic/nodejs and add the DLL reference.`,
      };
    }
    return {
      ok: false,
      error:
        `Refusing to add runtime DLL: ${dllName}.\n` +
        `Use the dedicated 'tsonic add ...' command for runtime-provided assemblies.`,
    };
  }

  if (typesPackage !== undefined && !isValidTypesPackageName(typesPackage)) {
    return { ok: false, error: `Invalid types package name: ${typesPackage}` };
  }

  const tsonicConfigResult = loadConfig(configPath);
  if (!tsonicConfigResult.ok) return tsonicConfigResult;
  const config = tsonicConfigResult.value;

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

  const frameworkRefs: FrameworkReferenceConfig[] = [
    ...((dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[]),
  ];
  for (const fr of requiredFrameworkRefs) {
    if (!hasFrameworkReference(frameworkRefs, fr)) {
      frameworkRefs.push(fr);
    }
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

  const dotnetRoot = resolvePackageRoot(projectRoot, "@tsonic/dotnet");
  if (!dotnetRoot.ok) return dotnetRoot;
  const coreRoot = resolvePackageRoot(projectRoot, "@tsonic/core");
  if (!coreRoot.ok) return coreRoot;
  const dotnetLib = dotnetRoot.value;
  const coreLib = coreRoot.value;

  const nonFramework = closure.resolvedAssemblies.filter((asm) => {
    const runtimeDir = runtimeDirs.find((rt) => pathIsWithin(asm.path, rt.dir));
    return !runtimeDir;
  });

  const identityKey = (asm: (typeof nonFramework)[number]): string =>
    `${asm.name}|${asm.publicKeyToken}|${asm.culture}`;

  const byId = new Map<string, (typeof nonFramework)[number]>();
  const destPathById = new Map<string, string>();
  const directDeps = new Map<string, string[]>();

  for (const asm of nonFramework) {
    const id = identityKey(asm);
    if (byId.has(id)) {
      return {
        ok: false,
        error:
          `Ambiguous assembly identity in closure: ${asm.name} (${asm.publicKeyToken}, ${asm.culture}).\n` +
          `This indicates multiple assemblies with the same identity were resolved, which is not supported.`,
      };
    }
    byId.set(id, asm);

    const destPath = join(libDir, basename(asm.path));
    if (!existsSync(destPath)) {
      return {
        ok: false,
        error: `Internal error: expected copied DLL to exist: ${destPath}`,
      };
    }
    destPathById.set(id, destPath);
  }

  const ids = new Set(byId.keys());
  for (const asm of nonFramework) {
    const id = identityKey(asm);
    const refs = asm.references ?? [];
    const deps: string[] = [];
    for (const r of refs) {
      const depId = `${r.name}|${r.publicKeyToken}|${r.culture}`;
      if (ids.has(depId)) deps.push(depId);
    }
    // De-dup while preserving order.
    directDeps.set(id, Array.from(new Set(deps)));
  }

  // Topological order (deps first).
  const order: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string): Result<void, string> => {
    const s = state.get(id);
    if (s === "done") return { ok: true, value: undefined };
    if (s === "visiting") {
      return { ok: false, error: `Cycle detected in DLL dependency graph at: ${id}` };
    }
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

  // Compute transitive deps for --lib.
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
  const packageNameById = new Map<string, string>();

  for (const id of order) {
    const asm = byId.get(id);
    const destPath = destPathById.get(id);
    if (!asm || !destPath) {
      return { ok: false, error: `Internal error: missing assembly info for ${id}` };
    }

    const packageName = defaultBindingsPackageNameForDll(destPath);
    const bindingsDir = bindingsStoreDir(projectRoot, "dll", packageName);

    bindingsDirById.set(id, bindingsDir);
    packageNameById.set(id, packageName);

    const pkgJsonResult = ensureGeneratedBindingsPackageJson(bindingsDir, packageName, {
      kind: "dll",
      source: {
        assemblyName: asm.name,
        version: asm.version,
        path: `lib/${basename(destPath)}`,
      },
    });
    if (!pkgJsonResult.ok) return pkgJsonResult;

    const generateArgs: string[] = [
      "-a",
      destPath,
      "-o",
      bindingsDir,
      "--naming",
      naming,
      "--lib",
      dotnetLib,
      "--lib",
      coreLib,
    ];

    const libs = Array.from(transitiveDeps.get(id) ?? [])
      .map((depId) => bindingsDirById.get(depId))
      .filter((p): p is string => typeof p === "string");
    libs.sort((a, b) => a.localeCompare(b));
    for (const lib of libs) generateArgs.push("--lib", lib);

    for (const dir of runtimeDirs) generateArgs.push("--ref-dir", dir.dir);
    for (const dep of userDeps) generateArgs.push("--ref-dir", dep);
    generateArgs.push("--ref-dir", libDir);

    const genResult = tsbindgenGenerate(projectRoot, tsbindgenDll, generateArgs, options);
    if (!genResult.ok) return genResult;

    const installResult = installGeneratedBindingsPackage(projectRoot, packageName, bindingsDir);
    if (!installResult.ok) return installResult;
  }

  const rootId = Array.from(order).find((id) => {
    const dest = destPathById.get(id);
    return dest ? basename(dest).toLowerCase() === basename(dllAbs).toLowerCase() : false;
  });
  const rootPackage =
    (rootId ? packageNameById.get(rootId) : undefined) ??
    defaultBindingsPackageNameForDll(dllAbs);

  return {
    ok: true,
    value: { dllsCopied: copiedCount, bindings: rootPackage },
  };
};
