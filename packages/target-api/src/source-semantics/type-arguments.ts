import type { AstReader, Node, SourceFileQueries, Type } from "@tsonic/tsts";

export interface SourceTypeArgumentBinding {
  readonly declaration: Node;
  readonly parameterType: Type;
  readonly argumentType: Type;
  readonly scope: "outer" | "local";
}

export function getSourceTypeArgumentBindings(
  ast: AstReader,
  queries: SourceFileQueries,
  type: Type,
): readonly SourceTypeArgumentBinding[] | undefined {
  const selected = queries.typeShape.getTypeReferenceArgumentInfos(type);
  if (selected === undefined) return undefined;
  const bindings: SourceTypeArgumentBinding[] = [];
  for (const entry of selected) {
    const symbol = queries.checker.getTypeSymbol(entry.parameter);
    const declarations = queries.checker.getSymbolDeclarations(symbol).filter(
      (candidate): candidate is Node => candidate !== undefined && ast.is.IsTypeParameterDeclaration(candidate),
    );
    if (declarations.length !== 1 || bindings.some(binding => binding.declaration === declarations[0])) return undefined;
    bindings.push(Object.freeze({ declaration: declarations[0]!, parameterType: entry.parameter,
      argumentType: entry.argument, scope: entry.scope }));
  }
  return Object.freeze(bindings);
}
