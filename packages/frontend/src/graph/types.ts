/**
 * Dependency graph type definitions
 */

import { ModuleGraph } from "../types/module.js";
import { DiagnosticsCollector } from "../types/diagnostic.js";

export type DependencyAnalysis = {
  readonly graph: ModuleGraph;
  readonly diagnostics: DiagnosticsCollector;
};
