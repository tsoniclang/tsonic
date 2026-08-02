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
  const symbols = [
    queries.checker.getTypeAliasSymbol(type),
    queries.checker.getTypeSymbol(type),
  ].filter((symbol) => symbol !== undefined);
  const declarations = symbols.flatMap((symbol) =>
    queries.checker.getSymbolDeclarations(symbol).filter(
      (declaration): declaration is Node => declaration !== undefined,
    )
  );
  const arities = new Set(
    declarations.map((declaration) => {
      const parameters = ast.typeParameters(declaration);
      return parameters.every((parameter) => parameter !== undefined)
        ? parameters.length
        : undefined;
    }),
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
