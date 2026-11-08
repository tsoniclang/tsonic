import type { AstReader, SourceFileQueries, Type } from "@tsonic/tsts";

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
