/**
 * Dependency graph type definitions
 */

import { ModuleGraph } from "../types/module.js";
import { DiagnosticsCollector } from "../types/diagnostic.js";
import { SymbolTable } from "../symbol-table.js";

export type DependencyAnalysis = {
  readonly graph: ModuleGraph;
  readonly symbolTable: SymbolTable;
  readonly diagnostics: DiagnosticsCollector;
};
