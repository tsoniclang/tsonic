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

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import type {
  LibraryReferenceConfig,
  Result,
  TsonicWorkspaceConfig,
} from "../types.js";
import { loadWorkspaceConfig } from "../config.js";
import { isBuiltInRuntimeDllPath } from "../dotnet/runtime-dlls.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForDll,
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

const normalizeLibraryKey = (pathLike: string): string =>
  pathLike.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();

const getLibraryPath = (entry: LibraryReferenceConfig): string =>
  typeof entry === "string" ? entry : entry.path;

const setLibraryTypesMapping = (
  entries: LibraryReferenceConfig[],
  libraryPath: string,
  typesPackage: string
): Result<void, string> => {
  const key = normalizeLibraryKey(libraryPath);
  const idx = entries.findIndex(
    (e) => normalizeLibraryKey(getLibraryPath(e)) === key
  );
  if (idx === -1) {
    entries.push({ path: libraryPath, types: typesPackage });
    return { ok: true, value: undefined };
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const existing = entries[idx]!;
  if (typeof existing === "string") {
    entries[idx] = { path: existing, types: typesPackage };
    return { ok: true, value: undefined };
  }

  if (existing.types === undefined || existing.types === typesPackage) {
    entries[idx] = { path: existing.path, types: typesPackage };
    return { ok: true, value: undefined };
  }

  return {
    ok: false,
    error:
      `Conflicting types mapping for '${getLibraryPath(existing)}'.\n` +
      `Existing: ${existing.types}\n` +
      `Requested: ${typesPackage}\n` +
      `Remove the existing entry from tsonic.workspace.json and retry.`,
  };
};

const addUniqueLibraryPath = (
  entries: LibraryReferenceConfig[],
  libraryPath: string
): void => {
  const key = normalizeLibraryKey(libraryPath);
  if (entries.some((e) => normalizeLibraryKey(getLibraryPath(e)) === key))
    return;
  entries.push(libraryPath);
};

type FrameworkReferenceConfig =
  | string
  | { readonly id: string; readonly types?: string };

const hasFrameworkReference = (
  arr: readonly FrameworkReferenceConfig[],
  value: string
): boolean =>
  arr.some(
    (r) =>
      (typeof r === "string" ? r : r.id).toLowerCase() === value.toLowerCase()
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
  const workspaceRoot = dirname(configPath);
  const dllAbs = resolveFromProjectRoot(workspaceRoot, dllPath);

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
    return {
      ok: false,
      error:
        `Refusing to add ${dllName}.\n` +
        `Tsonic always references its core runtime automatically; do not list it in dotnet.libraries.`,
    };
  }

  if (typesPackage !== undefined && !isValidTypesPackageName(typesPackage)) {
    return { ok: false, error: `Invalid types package name: ${typesPackage}` };
  }

  const tsonicConfigResult = loadWorkspaceConfig(configPath);
  if (!tsonicConfigResult.ok) return tsonicConfigResult;
  const config = tsonicConfigResult.value;

  const tsbindgenDllResult = resolveTsbindgenDllPath(workspaceRoot);
  if (!tsbindgenDllResult.ok) return tsbindgenDllResult;
  const tsbindgenDll = tsbindgenDllResult.value;

  const runtimesResult = listDotnetRuntimes(workspaceRoot);
  if (!runtimesResult.ok) return runtimesResult;
  const runtimeDirs = runtimesResult.value;

  const userDeps = (options.deps ?? []).map((d) =>
    resolveFromProjectRoot(workspaceRoot, d)
  );

  const refDirs = [
    ...runtimeDirs.map((r) => r.dir),
    join(workspaceRoot, "libs"),
    ...userDeps,
  ];

  const closureResult = tsbindgenResolveClosure(
    workspaceRoot,
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
    return {
      ok: false,
      error: `Failed to resolve DLL dependency closure:\n${details}`,
    };
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

  const libDir = join(workspaceRoot, "libs");
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
            `Conflict: libs/${fileName} already exists and differs from the resolved dependency closure.\n` +
            `Resolve this conflict (remove/rename the existing DLL) and retry.`,
        };
      }
    } else {
      copyFileSync(srcPath, destPath);
      copiedCount++;
    }

    copiedRelPaths.push(`libs/${fileName}`);
  }

  const dotnet = config.dotnet ?? {};
  const libraries: LibraryReferenceConfig[] = [...(dotnet.libraries ?? [])];
  for (const rel of copiedRelPaths) addUniqueLibraryPath(libraries, rel);

  if (typesPackage) {
    const rootRel = `libs/${basename(dllAbs)}`;
    const mappingResult = setLibraryTypesMapping(
      libraries,
      rootRel,
      typesPackage
    );
    if (!mappingResult.ok) return mappingResult;
  }

  const frameworkRefs: FrameworkReferenceConfig[] = [
    ...((dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[]),
  ];
  for (const fr of requiredFrameworkRefs) {
    if (!hasFrameworkReference(frameworkRefs, fr)) {
      frameworkRefs.push(fr);
    }
  }

  const nextConfig: TsonicWorkspaceConfig = {
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
    const installResult = npmInstallDevDependency(
      workspaceRoot,
      typesPackage,
      options
    );
    if (!installResult.ok) return installResult;
    return {
      ok: true,
      value: { dllsCopied: copiedCount, bindings: typesPackage },
    };
  }

  const dotnetRoot = resolvePackageRoot(workspaceRoot, "@tsonic/dotnet");
  if (!dotnetRoot.ok) return dotnetRoot;
  const dotnetLib = dotnetRoot.value;

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
      return {
        ok: false,
        error: `Cycle detected in DLL dependency graph at: ${id}`,
      };
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
      return {
        ok: false,
        error: `Internal error: missing assembly info for ${id}`,
      };
    }

    const packageName = defaultBindingsPackageNameForDll(destPath);
    const bindingsDir = bindingsStoreDir(workspaceRoot, "dll", packageName);

    bindingsDirById.set(id, bindingsDir);
    packageNameById.set(id, packageName);

    const pkgJsonResult = ensureGeneratedBindingsPackageJson(
      bindingsDir,
      packageName,
      {
        kind: "dll",
        source: {
          assemblyName: asm.name,
          version: asm.version,
          path: `libs/${basename(destPath)}`,
        },
      }
    );
    if (!pkgJsonResult.ok) return pkgJsonResult;

    const generateArgs: string[] = [
      "-a",
      destPath,
      "-o",
      bindingsDir,
      "--lib",
      dotnetLib,
    ];

    const libs = Array.from(transitiveDeps.get(id) ?? [])
      .map((depId) => bindingsDirById.get(depId))
      .filter((p): p is string => typeof p === "string");
    libs.sort((a, b) => a.localeCompare(b));
    for (const lib of libs) generateArgs.push("--lib", lib);

    for (const dir of runtimeDirs) generateArgs.push("--ref-dir", dir.dir);
    for (const dep of userDeps) generateArgs.push("--ref-dir", dep);
    generateArgs.push("--ref-dir", libDir);

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
      bindingsDir
    );
    if (!installResult.ok) return installResult;
  }

  const rootId = Array.from(order).find((id) => {
    const dest = destPathById.get(id);
    return dest
      ? basename(dest).toLowerCase() === basename(dllAbs).toLowerCase()
      : false;
  });
  const rootPackage =
    (rootId ? packageNameById.get(rootId) : undefined) ??
    defaultBindingsPackageNameForDll(dllAbs);

  return {
    ok: true,
    value: { dllsCopied: copiedCount, bindings: rootPackage },
  };
};
