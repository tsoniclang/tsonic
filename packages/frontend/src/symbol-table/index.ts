/**
 * Symbol table - Public API
 */

export type { SymbolKind, Symbol, SymbolTable } from "./types.js";
export { createSymbolTable, addSymbol } from "./creation.js";
export { buildSymbolTable } from "./builder.js";
export {
  findSymbol,
  getExportedSymbols,
  hasExportedSymbol,
} from "./queries.js";
export { hasExportModifier } from "./helpers.js";
