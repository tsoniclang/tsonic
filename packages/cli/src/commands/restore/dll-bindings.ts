import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type {
  FrameworkReferenceConfig,
  LibraryReferenceConfig,
  Result,
  TsonicWorkspaceConfig,
} from "../../types.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForDll,
  ensureGeneratedBindingsPackageJson,
  installGeneratedBindingsPackage,
  resolveFromProjectRoot,
  resolvePackageRoot,
  resolveTsonicRuntimeDllDir,
  tsbindgenGenerate,
  tsbindgenResolveClosure,
  writeTsonicJson,
  type AddCommandOptions,
  type DotnetRuntime,
} from "../add-common.js";
import {
  addUniqueFrameworkReference,
  normalizeLibraryKey,
  pathIsWithin,
} from "./shared.js";
import {
  isBuiltInRuntimeAssemblyName,
  isBuiltInRuntimeDllPath,
} from "../../dotnet/runtime-dlls.js";

type RestoreDllBindingsOptions = {
  readonly configPath: string;
  readonly config: TsonicWorkspaceConfig;
  readonly workspaceRoot: string;
  readonly dotnet: NonNullable<TsonicWorkspaceConfig["dotnet"]>;
  readonly runtimes: readonly DotnetRuntime[];
  readonly dotnetLib: string;
  readonly tsbindgenDll: string;
  readonly options: AddCommandOptions;
};

export const restoreDllBindings = ({
  configPath,
  config,
  workspaceRoot,
  dotnet,
  runtimes,
  dotnetLib,
  tsbindgenDll,
  options,
}: RestoreDllBindingsOptions): Result<void, string> => {
  const typesPackageByLibraryPathKey = new Map<string, string | false>();
  const libraryPaths: string[] = [];

  for (const entry of (dotnet.libraries ?? []) as LibraryReferenceConfig[]) {
    if (typeof entry === "string") {
      libraryPaths.push(entry);
      continue;
    }

    libraryPaths.push(entry.path);
    if (entry.types === undefined) continue;

    const key = normalizeLibraryKey(entry.path);
    if (!key.endsWith(".dll")) {
      return {
        ok: false,
        error: `tsonic.workspace.json: dotnet.libraries entry has 'types' but is not a DLL: ${entry.path}`,
      };
    }

    const existing = typesPackageByLibraryPathKey.get(key);
    if (existing !== undefined && existing !== entry.types) {
      return {
        ok: false,
        error:
          `tsonic.workspace.json: conflicting 'types' mapping for '${entry.path}'.\n` +
          `Existing: ${existing}\n` +
          `New: ${entry.types}`,
      };
    }
    typesPackageByLibraryPathKey.set(key, entry.types);
  }

  const dllLibraries = libraryPaths.filter((pathLike) => {
    const normalized = pathLike.replace(/\\/g, "/").toLowerCase();
    if (!normalized.endsWith(".dll")) return false;
    if (isBuiltInRuntimeDllPath(pathLike)) return false;
    return normalized.startsWith("libs/") || normalized.startsWith("./libs/");
  });
  if (dllLibraries.length === 0) return { ok: true, value: undefined };

  const dllAbs = dllLibraries.map((pathLike) =>
    resolveFromProjectRoot(workspaceRoot, pathLike)
  );
  for (const pathLike of dllAbs) {
    if (!existsSync(pathLike)) {
      return {
        ok: false,
        error: `Missing DLL from tsonic.workspace.json dotnet.libraries: ${pathLike}`,
      };
    }
  }

  const userDeps = (options.deps ?? []).map((dep) =>
    resolveFromProjectRoot(workspaceRoot, dep)
  );
  const refDirs = [
    ...runtimes.map((runtime) => runtime.dir),
    join(workspaceRoot, "libs"),
    ...userDeps,
  ];
  const closureResult = tsbindgenResolveClosure(
    workspaceRoot,
    tsbindgenDll,
    dllAbs,
    refDirs
  );
  if (!closureResult.ok) return closureResult;

  const closure = closureResult.value;
  const errorDiagnostics = closure.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "Error"
  );
  if (errorDiagnostics.length > 0) {
    return {
      ok: false,
      error:
        "Failed to resolve DLL dependency closure:\n" +
        errorDiagnostics
          .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
          .join("\n"),
    };
  }

  const requiredFrameworkRefs = new Set<string>();
  const nonFramework = closure.resolvedAssemblies.filter((assembly) => {
    if (isBuiltInRuntimeAssemblyName(assembly.name)) return false;
    const runtimeDir = runtimes.find((runtime) =>
      pathIsWithin(assembly.path, runtime.dir)
    );
    if (!runtimeDir) return true;
    if (runtimeDir.name !== "Microsoft.NETCore.App") {
      requiredFrameworkRefs.add(runtimeDir.name);
    }
    return false;
  });

  if (requiredFrameworkRefs.size > 0) {
    const nextFrameworkRefs: FrameworkReferenceConfig[] = [
      ...((dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[]),
    ];
    for (const frameworkRef of requiredFrameworkRefs) {
      addUniqueFrameworkReference(nextFrameworkRefs, frameworkRef);
    }
    const nextConfig: TsonicWorkspaceConfig = {
      ...config,
      dotnet: { ...dotnet, frameworkReferences: nextFrameworkRefs },
    };
    const writeResult = writeTsonicJson(configPath, nextConfig);
    if (!writeResult.ok) return writeResult;
  }

  type ResolvedAssembly = (typeof nonFramework)[number];
  const identityKey = (assembly: ResolvedAssembly): string =>
    `${assembly.name}|${assembly.publicKeyToken}|${assembly.culture}`;

  const byId = new Map<string, ResolvedAssembly>();
  const destPathById = new Map<string, string>();
  const directDeps = new Map<string, string[]>();

  for (const assembly of nonFramework) {
    const id = identityKey(assembly);
    if (byId.has(id)) {
      return {
        ok: false,
        error:
          `Ambiguous assembly identity in closure: ${assembly.name} (${assembly.publicKeyToken}, ${assembly.culture}).\n` +
          `This indicates multiple assemblies with the same identity were resolved, which is not supported.`,
      };
    }

    const destPath = resolveFromProjectRoot(
      workspaceRoot,
      join("libs", basename(assembly.path))
    );
    if (!existsSync(destPath)) {
      return {
        ok: false,
        error: `Missing DLL dependency in libs/: ${destPath}`,
      };
    }

    byId.set(id, assembly);
    destPathById.set(id, destPath);
  }

  for (const assembly of nonFramework) {
    const id = identityKey(assembly);
    const deps = (assembly.references ?? [])
      .map(
        (reference) =>
          `${reference.name}|${reference.publicKeyToken}|${reference.culture}`
      )
      .filter((depId) => byId.has(depId));
    directDeps.set(id, Array.from(new Set(deps)));
  }

  const order: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string): Result<void, string> => {
    const current = state.get(id);
    if (current === "done") return { ok: true, value: undefined };
    if (current === "visiting") {
      return {
        ok: false,
        error: `Cycle detected in DLL dependency graph at: ${id}`,
      };
    }
    state.set(id, "visiting");
    for (const dep of directDeps.get(id) ?? []) {
      const result = visit(dep);
      if (!result.ok) return result;
    }
    state.set(id, "done");
    order.push(id);
    return { ok: true, value: undefined };
  };

  for (const id of byId.keys()) {
    const result = visit(id);
    if (!result.ok) return result;
  }

  const transitiveDeps = new Map<string, Set<string>>();
  for (const id of order) {
    const deps = new Set<string>();
    for (const dep of directDeps.get(id) ?? []) {
      deps.add(dep);
      const nested = transitiveDeps.get(dep);
      if (!nested) continue;
      for (const depId of nested) deps.add(depId);
    }
    transitiveDeps.set(id, deps);
  }

  const libDirById = new Map<string, string>();
  const noTypesIds = new Set<string>();

  for (const id of order) {
    const assembly = byId.get(id);
    const destPath = destPathById.get(id);
    if (!assembly || !destPath) {
      return {
        ok: false,
        error: `Internal error: missing assembly info for ${id}`,
      };
    }

    const typesPkg = typesPackageByLibraryPathKey.get(
      normalizeLibraryKey(`libs/${basename(destPath)}`)
    );
    if (typesPkg !== undefined) {
      if (typesPkg === false) {
        noTypesIds.add(id);
        continue;
      }
      const typesRoot = resolvePackageRoot(workspaceRoot, typesPkg);
      if (!typesRoot.ok) {
        return {
          ok: false,
          error:
            `Bindings package not found for '${basename(destPath)}': ${typesPkg}\n` +
            `Install it in the workspace and retry (e.g. npm install -D ${typesPkg}).`,
        };
      }
      libDirById.set(id, typesRoot.value);
      continue;
    }

    const packageName = defaultBindingsPackageNameForDll(destPath);
    const outDir = bindingsStoreDir(workspaceRoot, "dll", packageName);
    libDirById.set(id, outDir);

    const pkgJsonResult = ensureGeneratedBindingsPackageJson(
      outDir,
      packageName,
      {
        kind: "dll",
        source: {
          assemblyName: assembly.name,
          version: assembly.version,
          path: `libs/${basename(destPath)}`,
        },
      }
    );
    if (!pkgJsonResult.ok) return pkgJsonResult;

    const generateArgs: string[] = [
      "-a",
      destPath,
      "-o",
      outDir,
      "--lib",
      dotnetLib,
    ];
    const transitive = Array.from(transitiveDeps.get(id) ?? []);
    for (const depId of transitive) {
      if (!noTypesIds.has(depId)) continue;
      const depAssembly = byId.get(depId);
      return {
        ok: false,
        error:
          `Assembly '${assembly.name}' depends on '${depAssembly?.name ?? depId}', but that dependency is configured with 'types: false'.\n` +
          `Bindings generation for '${assembly.name}' requires bindings for all referenced assemblies.\n` +
          `Fix: remove 'types: false' for '${depAssembly?.name ?? depId}' or provide an external bindings package via 'types: "<pkg>"'.`,
      };
    }

    const libs = transitive
      .map((depId) => libDirById.get(depId))
      .filter((libDir): libDir is string => typeof libDir === "string")
      .sort((left, right) => left.localeCompare(right));
    for (const libDir of libs) generateArgs.push("--lib", libDir);

    for (const runtime of runtimes) generateArgs.push("--ref-dir", runtime.dir);
    for (const dep of userDeps) generateArgs.push("--ref-dir", dep);
    generateArgs.push("--ref-dir", join(workspaceRoot, "libs"));
    const runtimeDirResult = resolveTsonicRuntimeDllDir(workspaceRoot);
    if (!runtimeDirResult.ok) return runtimeDirResult;
    generateArgs.push("--ref-dir", runtimeDirResult.value);

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
      outDir
    );
    if (!installResult.ok) return installResult;
  }

  return { ok: true, value: undefined };
};
