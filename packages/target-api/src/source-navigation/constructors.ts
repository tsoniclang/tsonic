import type {
  CheckedSourceProgram,
  Node,
} from "@tsonic/tsts";
import type {
  SourceClassConstructorParameter,
  SourceClassConstructorResult,
  SourceClassConstructorSignature,
} from "./types.js";

export function createSourceClassConstructorNavigation(
  source: CheckedSourceProgram,
  isProjectDeclaration: (node: Node | undefined) => boolean,
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
    );
    cache.set(declaration, result);
    return result;
  };
}

function resolveSourceClassConstructors(
  source: CheckedSourceProgram,
  isProjectDeclaration: (node: Node | undefined) => boolean,
  declaration: Node,
): SourceClassConstructorResult {
  if (
    !source.ast.is.IsClassDeclaration(declaration) ||
    !isProjectDeclaration(declaration)
  ) {
    return unresolved(
      declaration,
      "Effective constructors require an exact project class declaration.",
    );
  }
  const name = source.ast.name(declaration);
  const sourceFile = source.ast.getSourceFile(declaration);
  if (name === undefined || sourceFile === undefined) {
    return unresolved(
      declaration,
      "The project class has no exact named source declaration.",
    );
  }
  const queries = source.getSourceFileQueries(sourceFile);
  const symbol = queries.checker.getSymbolAtLocation(name);
  const valueType = symbol === undefined
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
    symbol === undefined ||
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
  for (const signature of signatures) {
    const parameters: SourceClassConstructorParameter[] = [];
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
      if (
        parameterDeclaration === undefined ||
        !source.ast.is.IsParameterDeclaration(parameterDeclaration)
      ) {
        return unresolved(
          declaration,
          "A non-empty effective constructor signature has no exact parameter declaration.",
        );
      }
      const parameter = source.ast.as.AsParameterDeclaration(
        parameterDeclaration,
      );
      if (parameter === undefined) {
        return unresolved(
          declaration,
          "The selected constructor parameter did not satisfy its proven AST kind.",
        );
      }
      const selectedType = queries.checker.getTypeOfSymbol(parameterSymbol);
      const parameterName = queries.checker.getSymbolName(parameterSymbol);
      if (selectedType === undefined || parameterName.length === 0) {
        return unresolved(
          parameterDeclaration,
          "The selected constructor parameter has no exact semantic type or name.",
        );
      }
      const rest = parameter.DotDotDotToken !== undefined;
      parameters.push(Object.freeze({
        parameterIndex: index,
        parameterName,
        parameterSymbol,
        parameterDeclaration,
        ...(parameter.Type === undefined
          ? {}
          : { authoredTypeNode: parameter.Type }),
        selectedType,
        acceptsOmission:
          rest ||
          parameter.QuestionToken !== undefined ||
          parameter.Initializer !== undefined,
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
    }));
  }
  const declaredConstructors = source.ast.members(declaration).filter(
    (member): member is Node =>
      member !== undefined &&
      source.ast.is.IsConstructorDeclaration(member),
  );
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
