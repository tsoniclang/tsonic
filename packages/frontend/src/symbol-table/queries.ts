/**
 * Symbol table query functions
 */

import { Symbol, SymbolTable } from "./types.js";

/**
 * Find symbols by name, optionally filtered by module
 */
export const findSymbol = (
  table: SymbolTable,
  name: string,
  module?: string
): readonly Symbol[] => {
  if (module) {
    const moduleSymbols = table.moduleSymbols.get(module) ?? [];
    return moduleSymbols.filter((s) => s.name === name);
  }
  return table.symbols.get(name) ?? [];
};

/**
 * Get all exported symbols from a module
 */
export const getExportedSymbols = (
  table: SymbolTable,
  module: string
): readonly Symbol[] => {
  return table.exportedSymbols.get(module) ?? [];
};

/**
 * Check if a module exports a symbol with the given name
 */
export const hasExportedSymbol = (
  table: SymbolTable,
  module: string,
  name: string
): boolean => {
  const exported = getExportedSymbols(table, module);
  return exported.some((s) => s.name === name);
};
