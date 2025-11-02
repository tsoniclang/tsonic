/**
 * Symbol table for tracking cross-module references
 * Main dispatcher - re-exports from symbol-table/ subdirectory
 */

export type { SymbolKind, Symbol, SymbolTable } from "./symbol-table/index.js";
export {
  createSymbolTable,
  addSymbol,
  buildSymbolTable,
  findSymbol,
  getExportedSymbols,
  hasExportedSymbol,
} from "./symbol-table/index.js";
