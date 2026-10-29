import type { AstReader, Node, ResolvedSourcePropertyAccessInfo, Symbol, Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./types.js";

export function selectedSourcePropertyDeclarations(
  semantics: SourceFileSemantics,
  selectedDeclaration: Node | undefined,
  selectedSymbol: Symbol | undefined,
  sourceTypes?: readonly Type[],
): readonly Node[] | undefined {
  if (sourceTypes === undefined && selectedDeclaration !== undefined) return Object.freeze([selectedDeclaration]);
  if (selectedSymbol === undefined || sourceTypes?.length === 0) return undefined;
  const roots = new Set([selectedSymbol, ...semantics.declarations.rootSymbols(selectedSymbol)]);
  const symbols = new Set<Symbol>();
  if (sourceTypes === undefined) {
    for (const symbol of roots) symbols.add(symbol);
  } else {
    for (const type of sourceTypes) {
      const matches = semantics.types.propertyInfos(type).filter(property =>
        [property.symbol, ...property.rootSymbols].some(symbol => roots.has(symbol)));
      if (matches.length !== 1) return undefined;
      symbols.add(matches[0]!.symbol);
      for (const symbol of matches[0]!.rootSymbols) symbols.add(symbol);
    }
  }
  const declarations = [...new Set([...symbols].flatMap(symbol => semantics.declarations.symbolDeclarations(symbol)))];
  return declarations.length === 0 ? undefined : Object.freeze(declarations);
}

export function selectSourcePropertyDeclaration(
  ast: AstReader,
  declarations: readonly Node[],
  role: "read" | "write",
): Node | undefined {
  const candidates = declarations.filter(declaration => role === "read"
    ? !ast.is.IsSetAccessorDeclaration(declaration)
    : !ast.is.IsGetAccessorDeclaration(declaration));
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function normalizeSourcePropertyAccessDeclarations(
  ast: AstReader,
  semantics: SourceFileSemantics,
  selected: ResolvedSourcePropertyAccessInfo,
): ResolvedSourcePropertyAccessInfo {
  const primaryRole = selected.accessMode === "write" ? "write" : "read";
  if (selected.selectedDeclaration !== undefined && (primaryRole === "read"
    ? !ast.is.IsSetAccessorDeclaration(selected.selectedDeclaration)
    : !ast.is.IsGetAccessorDeclaration(selected.selectedDeclaration))) return selected;
  const declarations = selectedSourcePropertyDeclarations(semantics, undefined, selected.selectedSymbol);
  if (declarations === undefined) return selected;
  const read = selected.accessMode === "write" ? undefined : selected.selectedReadDeclaration ??
    selectSourcePropertyDeclaration(ast, declarations, "read");
  const write = selected.writable && (selected.accessMode === "write" || selected.accessMode === "read-write")
    ? selected.selectedWriteDeclaration ?? selectSourcePropertyDeclaration(ast, declarations, "write")
    : undefined;
  const declaration = primaryRole === "write" ? write : read;
  return declaration === undefined ? selected : Object.freeze({
    ...selected,
    selectedDeclaration: declaration,
    ...(read === undefined ? {} : { selectedReadDeclaration: read }),
    ...(write === undefined ? {} : { selectedWriteDeclaration: write }),
  });
}
