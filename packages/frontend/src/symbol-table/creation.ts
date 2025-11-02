/**
 * Symbol table creation and modification
 */

import { Symbol, SymbolTable } from "./types.js";

/**
 * Create an empty symbol table
 */
export const createSymbolTable = (): SymbolTable => ({
  symbols: new Map(),
  moduleSymbols: new Map(),
  exportedSymbols: new Map(),
});

/**
 * Add a symbol to the table (immutable)
 */
export const addSymbol = (table: SymbolTable, symbol: Symbol): SymbolTable => {
  // Add to symbols map (by name)
  const symbolsByName = table.symbols.get(symbol.name) ?? [];
  const newSymbolsByName = new Map(table.symbols);
  newSymbolsByName.set(symbol.name, [...symbolsByName, symbol]);

  // Add to module symbols map
  const moduleSymbols = table.moduleSymbols.get(symbol.module) ?? [];
  const newModuleSymbols = new Map(table.moduleSymbols);
  newModuleSymbols.set(symbol.module, [...moduleSymbols, symbol]);

  // Add to exported symbols if exported
  let newExportedSymbols = new Map(table.exportedSymbols);
  if (symbol.isExported) {
    const exportedSymbols = table.exportedSymbols.get(symbol.module) ?? [];
    newExportedSymbols.set(symbol.module, [...exportedSymbols, symbol]);
  }

  return {
    symbols: newSymbolsByName,
    moduleSymbols: newModuleSymbols,
    exportedSymbols: newExportedSymbols,
  };
};
