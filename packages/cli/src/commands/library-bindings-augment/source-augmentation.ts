import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildModuleDependencyGraph,
  type CompilerOptions,
  type IrModule,
  type IrStatement,
} from "@tsonic/frontend";
import { resolveSurfaceCapabilities } from "../../surface/profiles.js";
import type { ResolvedConfig, Result } from "../../types.js";
import { indexFacadeFiles } from "./facade-patches.js";
import { normalizeModuleFileKey, renderDiagnostics } from "./shared.js";
import {
  discoverSourceModuleInfos,
  renderExportedTypeAlias,
} from "./source-modules.js";
import type { ModuleSourceIndex } from "./types.js";
import {
  ensureFacade,
  writeEntrypointReexports,
  writeExportedAliases,
} from "./source-augmentation/facades.js";
import { applyAugmentationData } from "./source-augmentation/apply-patches.js";
import { collectAugmentationData } from "./source-augmentation/patch-data.js";

export const augmentLibraryBindingsFromSource = (
  config: ResolvedConfig,
  bindingsOutDir: string
): Result<void, string> => {
  const entryPoint = config.entryPoint;
  if (!entryPoint) {
    return { ok: true, value: undefined };
  }

  const absoluteEntryPoint = resolve(config.projectRoot, entryPoint);
  const absoluteSourceRoot = resolve(config.projectRoot, config.sourceRoot);
  const surfaceCapabilities = resolveSurfaceCapabilities(config.surface, {
    workspaceRoot: config.workspaceRoot,
  });

  const typeLibraries = config.libraries.filter((lib) => !lib.endsWith(".dll"));
  const allTypeRoots = [...config.typeRoots, ...typeLibraries].map((p) =>
    resolve(config.workspaceRoot, p)
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

  const sourceModulesResult = discoverSourceModuleInfos({
    absoluteEntryPoint,
    absoluteSourceRoot,
    rootNamespace: config.rootNamespace,
  });
  if (!sourceModulesResult.ok) {
    return sourceModulesResult;
  }

  const sourceModulesByFile = sourceModulesResult.value.modulesByFileKey;
  const entrySourceModule = sourceModulesByFile.get(
    sourceModulesResult.value.entryFileKey
  );
  if (!entrySourceModule) {
    return {
      ok: false,
      error: `Failed to discover entry source module for bindings augmentation: ${absoluteEntryPoint}`,
    };
  }

  const needsFullGraph = sourceModulesResult.value.requiresFullGraph;
  const graphResult = needsFullGraph
    ? buildModuleDependencyGraph(absoluteEntryPoint, compilerOptions)
    : undefined;
  if (graphResult && !graphResult.ok) {
    return {
      ok: false,
      error: `Failed to analyze library sources:\n${renderDiagnostics(graphResult.error)}`,
    };
  }

  const irModules = graphResult?.ok ? graphResult.value.modules : [];
  const entryModule = graphResult?.ok
    ? graphResult.value.entryModule
    : undefined;
  const facadesByNamespace = new Map(indexFacadeFiles(bindingsOutDir));
  const modulesByFile = new Map<string, IrModule>();
  for (const m of irModules) {
    const key = normalizeModuleFileKey(m.filePath);
    modulesByFile.set(key, m);
  }

  const exportedAliasesByNamespace = new Map<
    string,
    {
      readonly lines: string[];
      readonly internalAliasImports: Set<string>;
    }
  >();
  const sourceIndexByFileKeyForAliases = new Map<string, ModuleSourceIndex>();
  if (needsFullGraph) {
    for (const m of irModules) {
      const isExportedTypeAlias = (
        stmt: IrStatement
      ): stmt is Extract<IrStatement, { kind: "typeAliasDeclaration" }> =>
        stmt.kind === "typeAliasDeclaration" && stmt.isExported;

      const exportedAliases = m.body.filter(isExportedTypeAlias);
      if (exportedAliases.length === 0) continue;

      const info = ensureFacade(
        facadesByNamespace,
        bindingsOutDir,
        m.namespace
      );

      const internalIndexDts = existsSync(info.internalIndexDtsPath)
        ? readFileSync(info.internalIndexDtsPath, "utf-8")
        : "";
      const moduleKey = normalizeModuleFileKey(m.filePath);
      const sourceModule = sourceModulesByFile.get(moduleKey);
      if (!sourceModule) {
        return {
          ok: false,
          error: `Failed to locate source module metadata for ${moduleKey} during bindings augmentation.`,
        };
      }
      const sourceIndex = (() => {
        const cached = sourceIndexByFileKeyForAliases.get(moduleKey);
        if (cached) return { ok: true as const, value: cached };
        sourceIndexByFileKeyForAliases.set(moduleKey, sourceModule.sourceIndex);
        return { ok: true as const, value: sourceModule.sourceIndex };
      })();

      for (const stmt of exportedAliases) {
        const rendered = renderExportedTypeAlias(
          stmt,
          internalIndexDts,
          sourceIndex.value.typeAliasesByName.get(stmt.name)
        );
        if (!rendered.ok) return rendered;

        const current = exportedAliasesByNamespace.get(m.namespace) ?? {
          lines: [],
          internalAliasImports: new Set<string>(),
        };
        current.lines.push(rendered.value.line);
        if (rendered.value.internalAliasImport) {
          current.internalAliasImports.add(rendered.value.internalAliasImport);
        }
        exportedAliasesByNamespace.set(m.namespace, current);
      }
    }
  }

  const writtenAliases = writeExportedAliases({
    facadesByNamespace,
    exportedAliasesByNamespace,
  });
  if (!writtenAliases.ok) return writtenAliases;

  const entryFacade = ensureFacade(
    facadesByNamespace,
    bindingsOutDir,
    entrySourceModule.namespace
  );

  if (needsFullGraph && entryModule) {
    const entrypointReexports = writeEntrypointReexports({
      bindingsOutDir,
      entryFacade,
      entryModule,
      modulesByFile,
      facadesByNamespace,
    });
    if (!entrypointReexports.ok) return entrypointReexports;
  }

  const sourceIndexByFileKey = new Map<string, ModuleSourceIndex>();
  for (const sourceModule of sourceModulesByFile.values()) {
    sourceIndexByFileKey.set(sourceModule.fileKey, sourceModule.sourceIndex);
  }

  const collected = collectAugmentationData({
    sourceModulesByFile,
    sourceIndexByFileKey,
    facadesByNamespace,
  });
  if (!collected.ok) return collected;

  const applied = applyAugmentationData(collected.value);
  if (!applied.ok) return applied;

  return { ok: true, value: undefined };
};
