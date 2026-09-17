import type {
  AstReader,
  Node,
  SourceFileQueries,
  Type,
} from "@tsonic/tsts";

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

export function getEffectiveSourceTypeArguments(
  ast: AstReader,
  queries: SourceFileQueries,
  type: Type,
): readonly Type[] | undefined {
  const bindings = queries.typeShape.getTypeReferenceArgumentInfos(type);
  if (bindings !== undefined) {
    return Object.freeze(bindings.filter(binding => binding.scope === "local").map(binding => binding.argument));
  }
  if (!queries.typeShape.isTypeReference(type)) {
    return Object.freeze([]);
  }
  const target = queries.typeShape.getTypeReferenceTarget(type);
  const symbol = queries.checker.getTypeSymbol(target ?? type);
  const declarations = queries.checker.getSymbolDeclarations(symbol);
  if (declarations.some(declaration => declaration !== undefined && (
    ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) ||
    ast.is.IsInterfaceDeclaration(declaration)))) {
    return undefined;
  }
  const arguments_ = queries.typeShape.getTypeArguments(type);
  return arguments_.every((argument): argument is Type => argument !== undefined)
    ? Object.freeze([...arguments_])
    : undefined;
}
