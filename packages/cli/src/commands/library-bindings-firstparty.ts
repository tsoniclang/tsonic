import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { CompilerOptions } from "@tsonic/frontend";
import { buildModuleDependencyGraph } from "@tsonic/frontend";
import { resolveSurfaceCapabilities } from "../surface/profiles.js";
import type { ResolvedConfig, Result } from "../types.js";
import { overlayDependencyBindings } from "./library-bindings-augment.js";
import { buildModuleSourceIndex } from "./library-bindings-firstparty/export-resolution.js";
import { normalizeModuleFileKey } from "./library-bindings-firstparty/module-paths.js";
import { writeNamespaceArtifacts } from "./library-bindings-firstparty/namespace-artifacts.js";
import { collectNamespacePlans } from "./library-bindings-firstparty/namespace-planning.js";
import type { ModuleSourceIndex } from "./library-bindings-firstparty/types.js";

export const generateFirstPartyLibraryBindings = (
  config: ResolvedConfig,
  bindingsOutDir: string
): Result<void, string> => {
  if (!config.entryPoint) {
    return {
      ok: false,
      error:
        "Library bindings generation requires an entryPoint in tsonic.json.",
    };
  }

  const absoluteEntryPoint = resolve(config.projectRoot, config.entryPoint);
  const absoluteSourceRoot = resolve(config.projectRoot, config.sourceRoot);
  const surfaceCapabilities = resolveSurfaceCapabilities(config.surface, {
    workspaceRoot: config.workspaceRoot,
  });

  const typeLibraries = config.libraries.filter(
    (library) => !library.endsWith(".dll")
  );
  const allTypeRoots = [...config.typeRoots, ...typeLibraries].map((typeRoot) =>
    resolve(config.workspaceRoot, typeRoot)
  );

  const compilerOptions: CompilerOptions = {
    projectRoot: config.projectRoot,
    sourceRoot: absoluteSourceRoot,
    rootNamespace: config.rootNamespace,
    typeRoots: allTypeRoots,
    surface: config.surface,
    useStandardLib: surfaceCapabilities.useStandardLib,
    verbose: false,
  };

  const graphResult = buildModuleDependencyGraph(
    absoluteEntryPoint,
    compilerOptions
  );
  if (!graphResult.ok) {
    const message = graphResult.error
      .map((diagnostic) =>
        diagnostic.location
          ? `${diagnostic.location.file}:${diagnostic.location.line}:${diagnostic.location.column} ${diagnostic.message}`
          : diagnostic.message
      )
      .join("\n");
    return {
      ok: false,
      error: `Failed to generate first-party bindings from source:\n${message}`,
    };
  }

  rmSync(bindingsOutDir, { recursive: true, force: true });
  mkdirSync(bindingsOutDir, { recursive: true });

  const resolveModuleAbsolutePath = (moduleFilePath: string): string => {
    const moduleKey = normalizeModuleFileKey(moduleFilePath);
    return moduleKey.startsWith("node_modules/")
      ? resolve(config.workspaceRoot, moduleKey)
      : resolve(absoluteSourceRoot, moduleKey);
  };

  const sourceIndexByFileKey = new Map<string, ModuleSourceIndex>();
  for (const module of graphResult.value.modules) {
    if (module.filePath.startsWith("__tsonic/")) continue;
    const moduleKey = normalizeModuleFileKey(module.filePath);
    const absolutePath = resolveModuleAbsolutePath(module.filePath);
    const indexed = buildModuleSourceIndex(absolutePath, moduleKey);
    if (!indexed.ok) return indexed;
    sourceIndexByFileKey.set(moduleKey, indexed.value);
  }

  const plansResult = collectNamespacePlans(
    graphResult.value.modules,
    config.outputName,
    config.rootNamespace,
    sourceIndexByFileKey
  );
  if (!plansResult.ok) return plansResult;

  for (const plan of plansResult.value) {
    const result = writeNamespaceArtifacts(config, bindingsOutDir, plan);
    if (!result.ok) return result;
  }

  const overlayResult = overlayDependencyBindings(config, bindingsOutDir);
  if (!overlayResult.ok) return overlayResult;

  return { ok: true, value: undefined };
};
