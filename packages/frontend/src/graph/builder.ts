/**
 * Dependency graph builder - Main orchestrator
 */

import * as path from "node:path";
import type {
  ExtensionExportBinding,
  ExtensionModuleImport,
} from "@tsonic/tsts";
import { TsonicProgram } from "../program.js";
import { createModuleGraph, Export, Import, ModuleInfo } from "../types/module.js";
import {
  addDiagnostic,
  createDiagnosticsCollector,
} from "../types/diagnostic.js";
import { createSymbolTable } from "../symbol-table.js";
import { DependencyAnalysis } from "./types.js";
import { checkCircularDependencies } from "./circular.js";
import { getNamespaceFromPath, getClassNameFromPath } from "../resolver.js";

const toImportedName = (
  binding: ExtensionModuleImport["bindings"][number]
): { readonly name: string; readonly alias?: string } =>
  binding.localName === binding.importedName
    ? { name: binding.importedName }
    : { name: binding.importedName, alias: binding.localName };

const importKindFor = (module: ExtensionModuleImport): Import["kind"] => {
  if (module.specifier.startsWith(".") || module.specifier.startsWith("/")) {
    return "local";
  }
  if (module.specifier.startsWith("@tsonic/")) {
    return "source_package";
  }
  return module.resolvedModule?.isExternalLibraryImport === true
    ? "node_module"
    : "node_module";
};

const toFrontendImport = (module: ExtensionModuleImport): Import => ({
  kind: importKindFor(module),
  specifier: module.specifier,
  resolvedPath: module.resolvedModule?.resolvedFileName,
  namespace: module.resolvedModule?.packageName,
  importedNames: module.bindings.map(toImportedName),
});

const toFrontendExport = (
  binding: ExtensionExportBinding
): Export | undefined => {
  switch (binding.kind) {
    case "named": {
      if (!binding.exportedName || !binding.localName) return undefined;
      return {
        kind: "named",
        name: binding.exportedName,
        localName: binding.localName,
      };
    }
    case "default":
    case "export-equals":
      return {
        kind: "default",
        localName: binding.localName ?? "default",
      };
    case "namespace": {
      if (!binding.exportedName) return undefined;
      return {
        kind: "namespace",
        name: binding.exportedName,
        localName: binding.localName ?? binding.exportedName,
      };
    }
    case "star":
      return {
        kind: "reexport",
        fromModule: binding.sourceSpecifier ?? "",
        exports: [],
      };
  }
};

const toModuleInfo = (
  module: TsonicProgram["sourceProgram"]["moduleGraph"]["modules"][number],
  program: TsonicProgram
): ModuleInfo => ({
  filePath: module.fileName,
  sourceText: module.text,
  imports: module.imports.map(toFrontendImport),
  exports: module.exports
    .map(toFrontendExport)
    .filter((exp): exp is Export => exp !== undefined),
  hasTopLevelCode: module.hasTopLevelCode,
  namespace: getNamespaceFromPath(
    module.fileName,
    program.options.sourceRoot,
    program.options.rootNamespace
  ),
  className: getClassNameFromPath(module.fileName),
});

/**
 * Build a complete dependency graph for a Tsonic program
 */
export const buildDependencyGraph = (
  program: TsonicProgram,
  entryPoints: readonly string[]
): DependencyAnalysis => {
  const modules = new Map();
  const dependencies = new Map();
  const dependents = new Map();
  const symbolTable = createSymbolTable();
  let diagnostics = createDiagnosticsCollector();

  for (const sourceModule of program.sourceProgram.moduleGraph.modules) {
    modules.set(sourceModule.fileName, toModuleInfo(sourceModule, program));
  }

  // Build dependency relationships
  modules.forEach((module, modulePath) => {
    const deps: string[] = [];

    module.imports.forEach((imp: Import) => {
      if (imp.resolvedPath) {
        deps.push(imp.resolvedPath);

        // Add to dependents map
        const currentDependents = dependents.get(imp.resolvedPath) ?? [];
        dependents.set(imp.resolvedPath, [...currentDependents, modulePath]);
      }
    });

    dependencies.set(modulePath, deps);
  });

  // Check for circular dependencies
  const circularCheck = checkCircularDependencies(dependencies);
  if (!circularCheck.ok) {
    diagnostics = addDiagnostic(diagnostics, circularCheck.error);
  }

  const graph = createModuleGraph(
    modules,
    dependencies,
    dependents,
    entryPoints.map((ep) => path.resolve(ep))
  );

  return {
    graph,
    symbolTable,
    diagnostics,
  };
};
