/**
 * Dependency graph builder - Main orchestrator
 */

import * as path from "node:path";
import { TsonicProgram } from "../program.js";
import { createModuleGraph, Import } from "../types/module.js";
import {
  addDiagnostic,
  createDiagnosticsCollector,
} from "../types/diagnostic.js";
import {
  createSymbolTable,
  addSymbol,
  buildSymbolTable,
} from "../symbol-table.js";
import { DependencyAnalysis } from "./types.js";
import { extractModuleInfo } from "./extraction.js";
import { checkCircularDependencies } from "./circular.js";

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
  let symbolTable = createSymbolTable();
  let diagnostics = createDiagnosticsCollector();

  // Process all source files
  program.sourceFiles.forEach((sourceFile) => {
    const moduleInfo = extractModuleInfo(sourceFile, program);
    modules.set(sourceFile.fileName, moduleInfo);

    // Build symbol table
    const symbols = buildSymbolTable(sourceFile, program.checker);
    symbols.forEach((symbol) => {
      symbolTable = addSymbol(symbolTable, symbol);
    });
  });

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
