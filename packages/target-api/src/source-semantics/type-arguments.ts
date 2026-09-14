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
  const bindings = getSourceTypeArgumentBindings(ast, queries, type);
  if (bindings !== undefined) {
    return Object.freeze(bindings.filter(binding => binding.scope === "local").map(binding => binding.argumentType));
  }
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
