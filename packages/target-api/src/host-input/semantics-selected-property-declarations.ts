import { SymbolFlagsAlias, type AstReader, type Node, type ResolvedSourcePropertyAccessInfo, type Symbol, type Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./semantics-types.js";

/**
 * The checker reads of property-declaration selection: symbol identity -> declarations, and the property list of a
 * type. A per-file checker view (SourceFileSemantics) and the navigation input's file queries (navigation.ts) both
 * provide it; the selection rule below is the one rule both apply (R2 #2).
 */
export interface SourcePropertySelectionQueries {
  readonly declarations: Pick<SourceFileSemantics["declarations"], "rootSymbols" | "aliasedSymbol" | "symbolDeclarations">;
  readonly types: Pick<SourceFileSemantics["types"], "propertyInfos">;
}

export function selectedSourcePropertyDeclarations(
  semantics: SourcePropertySelectionQueries,
  selectedDeclaration: Node | undefined,
  selectedSymbol: Symbol | undefined,
  sourceTypes?: readonly Type[],
): readonly Node[] | undefined {
  if (sourceTypes === undefined && selectedDeclaration !== undefined) return Object.freeze([selectedDeclaration]);
  if (selectedSymbol === undefined || sourceTypes?.length === 0) return undefined;
  const selectedRoots = [selectedSymbol, ...semantics.declarations.rootSymbols(selectedSymbol)]
    .map(symbol => selectedSourcePropertySymbol(semantics, symbol));
  if (selectedRoots.some(symbol => symbol === undefined)) return undefined;
  const roots = new Set(selectedRoots);
  const symbols = new Set<Symbol>();
  if (sourceTypes === undefined) {
    for (const symbol of selectedRoots) {
      if (symbol !== undefined) symbols.add(symbol);
    }
  } else {
    for (const type of sourceTypes) {
      const matches = semantics.types.propertyInfos(type).filter(property =>
        [property.symbol, ...property.rootSymbols].some(symbol => roots.has(selectedSourcePropertySymbol(semantics, symbol))));
      if (matches.length !== 1) return undefined;
      symbols.add(matches[0]!.symbol);
      for (const symbol of matches[0]!.rootSymbols) symbols.add(symbol);
    }
  }
  const selectedSymbols = [...symbols].map(symbol => selectedSourcePropertySymbol(semantics, symbol));
  if (selectedSymbols.some(symbol => symbol === undefined)) return undefined;
  const declarations = [...new Set(selectedSymbols.flatMap(symbol =>
    symbol === undefined ? [] : semantics.declarations.symbolDeclarations(symbol)))];
  return declarations.length === 0 ? undefined : Object.freeze(declarations);
}

function selectedSourcePropertySymbol(semantics: SourcePropertySelectionQueries, symbol: Symbol): Symbol | undefined {
  return (symbol.Flags & SymbolFlagsAlias) === 0 ? symbol : semantics.declarations.aliasedSymbol(symbol);
}

export function selectSourcePropertyDeclaration(
  ast: AstReader,
  declarations: readonly Node[],
  role: "read" | "write",
): Node | undefined {
  const candidates = declarations.filter(declaration => role === "read"
    ? !ast.is.IsSetAccessorDeclaration(declaration)
    : !ast.is.IsGetAccessorDeclaration(declaration));
  if (candidates.length !== 1) return undefined;
  const declaration = candidates[0]!;
  if (declarations.length > 1 && (!(role === "read"
    ? ast.is.IsGetAccessorDeclaration(declaration) : ast.is.IsSetAccessorDeclaration(declaration)) ||
    ast.parent(declaration) === undefined ||
    declarations.some(candidate => ast.parent(candidate) !== ast.parent(declaration)))) return undefined;
  return declaration;
}

/**
 * The role normalization of a checker property-access selection: an accessor pair selects the get accessor for reads
 * and the set accessor for writes. Applied once, by the member-access translator (navigation.ts).
 */
export function normalizeSourcePropertyAccessDeclarations(
  ast: AstReader,
  semantics: SourcePropertySelectionQueries,
  selected: ResolvedSourcePropertyAccessInfo,
): ResolvedSourcePropertyAccessInfo {
  const primaryRole = selected.accessMode === "write" ? "write" : "read";
  if (selected.selectedDeclaration !== undefined && (primaryRole === "read"
    ? !ast.is.IsSetAccessorDeclaration(selected.selectedDeclaration)
    : !ast.is.IsGetAccessorDeclaration(selected.selectedDeclaration))) return selected;
  const declarations = selectedSourcePropertyDeclarations(semantics, undefined, selected.selectedSymbol);
  if (declarations === undefined) return selected;
  const read = selected.accessMode === "write" ? undefined :
    selectSourcePropertyDeclaration(ast, declarations, "read");
  const write = selected.writable && (selected.accessMode === "write" || selected.accessMode === "read-write")
    ? selectSourcePropertyDeclaration(ast, declarations, "write")
    : undefined;
  if (selected.selectedReadDeclaration !== undefined && selected.selectedReadDeclaration !== read ||
    selected.selectedWriteDeclaration !== undefined && selected.selectedWriteDeclaration !== write) return selected;
  const declaration = primaryRole === "write" ? write : read;
  return declaration === undefined ? selected : Object.freeze({
    ...selected,
    selectedDeclaration: declaration,
    ...(read === undefined ? {} : { selectedReadDeclaration: read }),
    ...(write === undefined ? {} : { selectedWriteDeclaration: write }),
  });
}
