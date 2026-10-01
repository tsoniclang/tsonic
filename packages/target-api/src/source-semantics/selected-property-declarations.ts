import type { Node, Symbol, Type } from "@tsonic/tsts";
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
