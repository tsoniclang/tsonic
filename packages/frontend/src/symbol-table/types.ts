/**
 * Symbol table type definitions
 */

import type { DeclId } from "../ir/type-system/types.js";

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
  readonly declId?: DeclId; // Opaque handle to declaration (replaces ts.Symbol)
};

export type SymbolTable = {
  readonly symbols: ReadonlyMap<string, readonly Symbol[]>; // Name to symbols
  readonly moduleSymbols: ReadonlyMap<string, readonly Symbol[]>; // Module path to symbols
  readonly exportedSymbols: ReadonlyMap<string, readonly Symbol[]>; // Module path to exported symbols
};
