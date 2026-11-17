import { readOriginalSignature, type CheckedSourceProgram, type Node, type Signature } from "@tsonic/tsts";
import type { SourceClassConstructorParameter, SourceClassConstructorResult, SourceClassConstructorSignature, SourceDeclaredHeritageResult } from "./types.js";

export function createSourceClassConstructorNavigation(
  source: CheckedSourceProgram,
  isProjectDeclaration: (node: Node | undefined) => boolean,
  declaredHeritage: (node: Node) => SourceDeclaredHeritageResult,
): (declaration: Node) => SourceClassConstructorResult {
  const cache = new WeakMap<Node, SourceClassConstructorResult>();

  return (declaration: Node): SourceClassConstructorResult => {
    const existing = cache.get(declaration);
    if (existing !== undefined) {
      return existing;
    }
    const result = resolveSourceClassConstructors(
      source,
      isProjectDeclaration,
      declaration,
      declaredHeritage,
    );
    cache.set(declaration, result);
    return result;
  };
}

function resolveSourceClassConstructors(
  source: CheckedSourceProgram,
  isProjectDeclaration: (node: Node | undefined) => boolean,
  declaration: Node,
  declaredHeritage: (node: Node) => SourceDeclaredHeritageResult,
): SourceClassConstructorResult {
  if (
    (!source.ast.is.IsClassDeclaration(declaration) && !source.ast.is.IsClassExpression(declaration)) ||
    !isProjectDeclaration(declaration)
  ) {
    return unresolved(
      declaration,
      "Effective constructors require an exact project class declaration.",
    );
  }
  const name = source.ast.name(declaration);
  const sourceFile = source.ast.getSourceFile(declaration);
  const expression = source.ast.is.IsClassExpression(declaration);
  if ((!expression && name === undefined) || sourceFile === undefined) {
    return unresolved(
      declaration,
      "The project class has no exact source declaration.",
    );
  }
  const queries = source.getSourceFileQueries(sourceFile);
  const symbol = name === undefined ? undefined : queries.checker.getSymbolAtLocation(name);
  const valueType = expression ? queries.checker.getTypeAtLocation(declaration) : symbol === undefined
    ? undefined
    : queries.checker.getTypeOfSymbol(symbol);
  const rawSignatures = valueType === undefined
    ? []
    : queries.checker.getConstructSignaturesOfType(valueType);
  const signatures = rawSignatures.filter(
    (signature): signature is NonNullable<typeof signature> =>
      signature !== undefined,
  );
  if (
    valueType === undefined ||
    signatures.length === 0 ||
    signatures.length !== rawSignatures.length
  ) {
    return unresolved(
      declaration,
      "The checked source program did not provide an effective constructor signature for the project class.",
    );
  }
  const resolved: SourceClassConstructorSignature[] = [];
  const declaredConstructors = source.ast.members(declaration).filter(
    (member): member is Node => member !== undefined && source.ast.is.IsConstructorDeclaration(member));
  const heritage = declaredConstructors.length === 0 ? declaredHeritage(declaration) : undefined;
  if (heritage?.kind === "unresolved") return unresolved(declaration, heritage.reason);
  const bases = heritage?.edges.filter(edge => edge.kind === "extends") ?? [];
  if (bases.length > 1) return unresolved(declaration, "An implicit constructor requires one exact original base constructor owner.");
  const base = bases[0];
  const baseExpression = base === undefined ? undefined : source.ast.as.AsExpressionWithTypeArguments(base.heritage)?.Expression;
  const baseType = baseExpression === undefined ? undefined : queries.checker.getTypeAtLocation(baseExpression);
  const baseSignatures = baseType === undefined ? [] : queries.checker.getConstructSignaturesOfType(baseType)
    .filter((value): value is Signature => value !== undefined);
  const chain = (signature: Signature): ReadonlySet<Signature> => {
    const selected = new Set<Signature>();
    let current: Signature | undefined = signature;
    while (current !== undefined && !selected.has(current)) {
      selected.add(current);
      current = readOriginalSignature(current).target;
    }
    return selected;
  };
  for (const signature of signatures) {
    const originalChain = chain(signature);
    const inherited = baseSignatures.filter(candidate => [...chain(candidate)].some(original => originalChain.has(original)));
    if (base !== undefined && inherited.length !== 1)
      return unresolved(declaration, "An implicit constructor requires its exact original inherited base signature identity.");
    const parameters: SourceClassConstructorParameter[] = [];
    const effectiveParameters = queries.typeShape.getSignatureParameterInfos(signature);
    const signatureParameters = queries.checker.getSignatureParameters(
      signature,
    );
    for (let index = 0; index < signatureParameters.length; index += 1) {
      const parameterSymbol = signatureParameters[index];
      if (parameterSymbol === undefined) {
        return unresolved(
          declaration,
          "An effective constructor signature contains an absent selected parameter symbol.",
        );
      }
      const parameterDeclaration = queries.checker
        .getPrimarySymbolDeclaration(parameterSymbol);
      const selectedParameter = effectiveParameters[index];
      if (selectedParameter === undefined || selectedParameter.sourceSymbol !== parameterSymbol ||
        parameterDeclaration !== undefined && !source.ast.is.IsParameterDeclaration(parameterDeclaration)) {
        return unresolved(
          declaration,
          "An effective constructor signature requires its exact checked parameter and original declaration when present.",
        );
      }
      const parameter = parameterDeclaration === undefined ? undefined : source.ast.as.AsParameterDeclaration(parameterDeclaration);
      const selectedType = selectedParameter.type;
      const parameterName = queries.checker.getSymbolName(parameterSymbol);
      if (selectedType === undefined || parameterName.length === 0) {
        return unresolved(
          parameterDeclaration ?? declaration,
          "The selected constructor parameter has no exact semantic type or name.",
        );
      }
      const rest = selectedParameter.parameterKind === "rest";
      parameters.push(Object.freeze({
        parameterIndex: index,
        parameterName,
        parameterSymbol,
        parameterDeclaration,
        ...(parameter?.Type === undefined
          ? {}
          : { authoredTypeNode: parameter.Type }),
        selectedType,
        acceptsOmission: selectedParameter.acceptsOmission,
        rest,
      }));
    }
    const signatureDeclaration = queries.checker
      .getSignatureDeclaration(signature);
    resolved.push(Object.freeze({
      signature,
      ...(signatureDeclaration === undefined
        ? {}
        : { declaration: signatureDeclaration }),
      parameters: Object.freeze(parameters),
      base: base === undefined ? undefined : Object.freeze({ declaration: base.target.declaration, signature: inherited[0]! }),
    }));
  }
  return Object.freeze({
    kind: "resolved",
    declaration,
    implicit: declaredConstructors.length === 0,
    signatures: Object.freeze(resolved),
  });
}

function unresolved(
  declaration: Node,
  reason: string,
): SourceClassConstructorResult {
  return Object.freeze({
    kind: "unresolved",
    declaration,
    reason,
  });
}
