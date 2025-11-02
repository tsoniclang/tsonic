/**
 * Symbol table type definitions
 */

import * as ts from "typescript";

export type SymbolKind =
  | "class"
  | "interface"
  | "function"
  | "variable"
  | "type"
  | "enum"
  | "namespace";

export type Symbol = {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly isExported: boolean;
  readonly module: string; // File path
  readonly tsSymbol?: ts.Symbol; // Optional reference to TypeScript symbol
};

export type SymbolTable = {
  readonly symbols: ReadonlyMap<string, readonly Symbol[]>; // Name to symbols
  readonly moduleSymbols: ReadonlyMap<string, readonly Symbol[]>; // Module path to symbols
  readonly exportedSymbols: ReadonlyMap<string, readonly Symbol[]>; // Module path to exported symbols
};
