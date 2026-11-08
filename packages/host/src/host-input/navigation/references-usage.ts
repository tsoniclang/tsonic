import type { AstReader, Node, Symbol } from "@tsonic/tsts";
import { sourceBindingWriteAtReference, sourceNodeIsWithin } from "@tsonic/target-api/host";
import type { SourceBindingWrite } from "./types.js";

export function sourceSymbolReferencesWithin(ast: AstReader, symbol: Symbol, root: Node,
  references: (symbol: Symbol) => readonly Node[]): readonly Node[] {
  return Object.freeze(references(symbol).filter(node => sourceNodeIsWithin(ast, node, root)));
}

export function sourceSymbolHasReferenceOutside(ast: AstReader, symbol: Symbol, excluded: Node,
  references: (symbol: Symbol) => readonly Node[]): boolean {
  return references(symbol).some(node => !sourceNodeIsWithin(ast, node, excluded));
}

export function sourceBindingWritesWithin(ast: AstReader, symbol: Symbol, root: Node,
  references: (symbol: Symbol) => readonly Node[]): readonly SourceBindingWrite[] {
  return Object.freeze(sourceSymbolReferencesWithin(ast, symbol, root, references)
    .map(node => sourceBindingWriteAtReference(ast, node))
    .filter((value): value is SourceBindingWrite => value !== undefined && value.kind !== "initialization"));
}
