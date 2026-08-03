import type {
  AstReader,
  Node,
  SourceFileQueries,
  Type,
} from "@tsonic/tsts";

export function getEffectiveSourceTypeArguments(
  ast: AstReader,
  queries: SourceFileQueries,
  type: Type,
): readonly Type[] | undefined {
  if (!queries.typeShape.isTypeReference(type)) {
    return Object.freeze([]);
  }
  const rawArguments = queries.typeShape.getTypeArguments(type);
  const arguments_ = rawArguments.filter(
    (argument): argument is Type => argument !== undefined,
  );
  if (arguments_.length !== rawArguments.length) {
    return undefined;
  }
  const target = queries.typeShape.getTypeReferenceTarget(type);
  const symbol = queries.checker.getTypeSymbol(target ?? type);
  const symbols = symbol === undefined ? [] : [symbol];
  const declarations = symbols.flatMap((symbol) =>
    queries.checker.getSymbolDeclarations(symbol).filter(
      (declaration): declaration is Node => declaration !== undefined,
    )
  );
  const arities = new Set(
    declarations.map((declaration) =>
      sourceTypeParameterArity(ast, declaration)),
  );
  arities.delete(undefined);
  if (arities.size === 0) {
    return Object.freeze(arguments_);
  }
  if (arities.size !== 1) {
    return undefined;
  }
  const arity = arities.values().next().value;
  return arity === undefined || arguments_.length < arity
    ? undefined
    : Object.freeze(arguments_.slice(0, arity));
}

function sourceTypeParameterArity(
  ast: AstReader,
  declaration: Node,
): number | undefined {
  if (
    !ast.is.IsClassDeclaration(declaration) &&
    !ast.is.IsClassExpression(declaration) &&
    !ast.is.IsInterfaceDeclaration(declaration) &&
    !ast.is.IsTypeAliasDeclaration(declaration)
  ) {
    return undefined;
  }
  const parameters = ast.typeParameters(declaration);
  return parameters.every((parameter) => parameter !== undefined)
    ? parameters.length
    : undefined;
}
