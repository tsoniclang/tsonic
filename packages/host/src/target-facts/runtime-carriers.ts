import type {
  AstReader,
  ExtensionConsumerQueries,
  ExtensionFactSubject,
  Node,
  SourceFile,
  Symbol,
  TargetTypeRef,
  Type,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import {
  getDeclarationCarrierSubject,
  getDeclarationTypeNode,
  getProjectSourceReferenceForNode,
} from "../analysis/project-source.js";
import {
  getResolvedSymbolForReferenceNode,
  getSemanticTypeForNode,
  getSymbolAtReferenceNode,
} from "../analysis/symbols.js";
import {
  asSymbol,
} from "../analysis/guards.js";

export function getRuntimeCarrier(
  facts: ExtensionConsumerQueries,
  subject: ExtensionFactSubject | undefined,
): TargetTypeRef | undefined {
  if (asSymbol(subject) !== undefined) {
    return getSourcePrimitiveCarrier(facts, subject);
  }
  const runtimeCarrier = facts.getRuntimeCarrierFact(subject)?.carrier;
  if (runtimeCarrier !== undefined) {
    return runtimeCarrier;
  }
  const selectedCallCarrier = getSelectedCallReturnCarrier(facts, subject);
  if (selectedCallCarrier !== undefined) {
    return selectedCallCarrier;
  }
  return getSourcePrimitiveCarrier(facts, subject);
}

function getSourcePrimitiveCarrier(
  facts: ExtensionConsumerQueries,
  subject: ExtensionFactSubject | undefined,
): TargetTypeRef | undefined {
  const primitive = facts.getSourcePrimitiveFact(subject);
  return primitive === undefined ? undefined : { kind: "source-primitive", name: primitive.kind };
}

function getSelectedCallReturnCarrier(
  facts: ExtensionConsumerQueries,
  subject: ExtensionFactSubject | undefined,
): TargetTypeRef | undefined {
  const selectedCall = facts.getSelectedTargetCall(subject);
  if (selectedCall === undefined) {
    return undefined;
  }
  const targetTypeArguments = selectedCall.targetTypeArguments ?? [];
  const targetTypeParameters = selectedCall.member.typeParameters ?? [];
  if (targetTypeArguments.length === 0) {
    return selectedCall.member.returnType;
  }
  if (targetTypeArguments.length !== targetTypeParameters.length) {
    return undefined;
  }
  const substitutions = new Map<string, TargetTypeRef>();
  for (let index = 0; index < targetTypeParameters.length; index += 1) {
    const parameter = targetTypeParameters[index];
    const argument = targetTypeArguments[index];
    if (parameter === undefined || argument === undefined) {
      return undefined;
    }
    substitutions.set(parameter.name, argument);
  }
  return substituteTargetTypeParameters(selectedCall.member.returnType, substitutions);
}

export function getRuntimeCarrierFromDeclaredFactGraph(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node> = new Set(),
): TargetTypeRef | undefined {
  if (seen.has(node)) {
    return undefined;
  }
  const nextSeen = new Set(seen).add(node);
  const direct = getRuntimeCarrier(facts, node) ??
    getSourcePrimitiveCarrier(facts, getSymbolAtReferenceNode(ast, checker, node, options)) ??
    getSourcePrimitiveCarrier(facts, getResolvedSymbolForReferenceNode(ast, checker, node, options));
  const valueDeclarationCarrier = getValueDeclarationCarrier(
    ast,
    checker,
    types,
    facts,
    node,
    options,
    sourceFiles,
    nextSeen,
  );
  if (valueDeclarationCarrier !== undefined) {
    return valueDeclarationCarrier;
  }
  const projectSourceReferenceCarrier = getProjectSourceReferenceDeclarationCarrier(
    ast,
    checker,
    types,
    facts,
    node,
    options,
    sourceFiles,
    nextSeen,
  );
  if (projectSourceReferenceCarrier !== undefined) {
    return projectSourceReferenceCarrier;
  }
  if (direct !== undefined && !(direct.kind === "target-named" && ast.is.IsTypeReferenceNode(node) && ast.typeArguments(node).length > 0)) {
    const semanticCarrier = getRuntimeCarrierForSemanticType(ast, checker, types, facts, node, options);
    return semanticCarrier ?? direct;
  }
  if (ast.is.IsTypeReferenceNode(node)) {
    const aliasCarrier = getRuntimeCarrierFromTypeAliasFactGraph(
      ast,
      checker,
      types,
      facts,
      getSymbolAtReferenceNode(ast, checker, node, options),
      node,
      options,
      sourceFiles,
      nextSeen,
    );
    if (aliasCarrier !== undefined) {
      return typeSyntaxContainsSourcePrimitiveEvidence(ast, checker, facts, node, options) && !targetTypeRefContainsSourcePrimitive(aliasCarrier)
        ? undefined
        : aliasCarrier;
    }
    const type = getSemanticTypeForNode(ast, checker, node, options);
    const binding = facts.getTargetBindingFact(type) ?? facts.getTargetBindingFact(type?.symbol);
    if (binding !== undefined) {
      const typeArguments = ast.typeArguments(node)
        .map((argument) => argument === undefined
          ? undefined
          : getTargetTypeRefFromDeclaredTypeNode(ast, checker, types, facts, argument, options, sourceFiles, nextSeen));
      if (typeArguments.some((argument) => argument === undefined)) {
        return undefined;
      }
      return {
        kind: "target-named",
        id: binding.id,
        ...(typeArguments.length > 0 ? { typeArguments: typeArguments as readonly TargetTypeRef[] } : {}),
      };
    }
    const syntaxInstantiatedDirect = instantiateDirectTypeReferenceCarrierFromSyntax(
      ast,
      checker,
      types,
      facts,
      node,
      direct,
      options,
      sourceFiles,
      nextSeen,
    );
    if (syntaxInstantiatedDirect !== undefined) {
      return syntaxInstantiatedDirect;
    }
    return direct;
  }
  const reference = getProjectSourceReferenceForNode(ast, checker, types, node, options, sourceFiles);
  const declarationSubject = getDeclarationCarrierSubject(ast, reference?.declaration);
  return declarationSubject === undefined
    ? direct
    : getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, declarationSubject, options, sourceFiles, nextSeen) ?? direct;
}

function getProjectSourceReferenceDeclarationCarrier(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node>,
): TargetTypeRef | undefined {
  const reference = getProjectSourceReferenceForNode(ast, checker, types, node, options, sourceFiles);
  const subject = getDeclarationCarrierSubject(ast, reference?.declaration);
  if (reference === undefined || subject === undefined || subject === node) {
    return undefined;
  }
  const referenceOptions = { sourceFile: reference.sourceFile };
  return getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, subject, referenceOptions, sourceFiles, seen) ??
    getRuntimeCarrierForSemanticType(ast, checker, types, facts, subject, referenceOptions);
}

function getValueDeclarationCarrier(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node>,
): TargetTypeRef | undefined {
  if (
    !ast.is.IsVariableDeclaration(node) &&
    !ast.is.IsParameterDeclaration(node) &&
    !ast.is.IsPropertyDeclaration(node) &&
    !ast.is.IsPropertySignatureDeclaration(node)
  ) {
    return undefined;
  }
  const subject = getDeclarationCarrierSubject(ast, node);
  return subject === undefined
    ? undefined
    : getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, subject, options, sourceFiles, seen) ??
      getRuntimeCarrierForSemanticType(ast, checker, types, facts, subject, options);
}

function substituteTargetTypeParameters(
  type: TargetTypeRef | undefined,
  substitutions: ReadonlyMap<string, TargetTypeRef>,
): TargetTypeRef | undefined {
  if (type === undefined || substitutions.size === 0) {
    return type;
  }
  switch (type.kind) {
    case "type-parameter":
      return substitutions.get(type.name) ?? type;
    case "source-global":
    case "target-named":
      return {
        ...type,
        ...(type.typeArguments === undefined
          ? {}
          : { typeArguments: type.typeArguments.map((argument) => substituteTargetTypeParameters(argument, substitutions) ?? argument) }),
      };
    case "array": {
      const element = substituteTargetTypeParameters(type.element, substitutions);
      return element === undefined ? type : { ...type, element };
    }
    case "tuple":
      return {
        ...type,
        elements: type.elements.map((element) => substituteTargetTypeParameters(element, substitutions) ?? element),
      };
    case "pointer": {
      const pointee = substituteTargetTypeParameters(type.pointee, substitutions);
      return pointee === undefined ? type : { ...type, pointee };
    }
    case "function-pointer": {
      const result = substituteTargetTypeParameters(type.result, substitutions);
      return result === undefined
        ? type
        : {
            ...type,
            args: type.args.map((argument) => substituteTargetTypeParameters(argument, substitutions) ?? argument),
            result,
          };
    }
    case "associated-type": {
      const owner = substituteTargetTypeParameters(type.owner, substitutions);
      return owner === undefined ? type : { ...type, owner };
    }
    case "source-primitive":
    case "opaque":
    case "lifetime":
    case "target-specific":
      return type;
  }
}

export function getRuntimeCarrierForSemanticType(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): TargetTypeRef | undefined {
  const type = getSemanticTypeForNode(ast, checker, node, options);
  return getRuntimeCarrierForType(ast, checker, types, facts, type, options);
}

export function getRuntimeCarrierForType(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  type: Type | undefined,
  options: { readonly sourceFile: SourceFile },
): TargetTypeRef | undefined {
  return discardSourcePrimitiveSemanticCarrier(getRuntimeCarrier(facts, type)) ??
    discardSourcePrimitiveSemanticCarrier(getTargetTypeRefForSemanticType(ast, checker, types, facts, type, options));
}

function getRuntimeCarrierFromTypeAliasFactGraph(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  symbol: Symbol | undefined,
  currentNode: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node>,
): TargetTypeRef | undefined {
  for (const declaration of checker.getSymbolDeclarations(symbol)) {
    const typeNode = getDeclarationTypeNode(ast, declaration);
    if (typeNode === undefined || typeNode === currentNode) {
      continue;
    }
    const declarationSourceFile = ast.getSourceFile(typeNode) ?? options.sourceFile;
    const declarationOptions = { sourceFile: declarationSourceFile };
    const declaredCarrier = getRuntimeCarrierFromDeclaredFactGraph(
      ast,
      checker,
      types,
      facts,
      typeNode,
      declarationOptions,
      sourceFiles,
      seen,
    );
    if (declaredCarrier !== undefined) {
      return declaredCarrier;
    }
    const semanticCarrier = getRuntimeCarrierForSemanticType(ast, checker, types, facts, typeNode, declarationOptions);
    if (semanticCarrier !== undefined) {
      return typeSyntaxContainsSourcePrimitiveEvidence(ast, checker, facts, typeNode, declarationOptions)
        ? undefined
        : semanticCarrier;
    }
  }
  return undefined;
}

function getTargetTypeRefFromDeclaredTypeNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node>,
): TargetTypeRef | undefined {
  const declaredCarrier = getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, node, options, sourceFiles, seen);
  if (declaredCarrier !== undefined) {
    return declaredCarrier;
  }
  const semanticCarrier = getRuntimeCarrierForSemanticType(ast, checker, types, facts, node, options);
  return semanticCarrier !== undefined && typeSyntaxContainsSourcePrimitiveEvidence(ast, checker, facts, node, options)
    ? undefined
    : semanticCarrier;
}

function instantiateDirectTypeReferenceCarrierFromSyntax(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  carrier: TargetTypeRef | undefined,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node>,
): TargetTypeRef | undefined {
  if (carrier?.kind !== "target-named") {
    return undefined;
  }
  const typeArguments = ast.typeArguments(node)
    .map((argument) => argument === undefined
      ? undefined
      : getTargetTypeRefFromDeclaredTypeNode(ast, checker, types, facts, argument, options, sourceFiles, seen));
  if (typeArguments.length === 0 || typeArguments.some((argument) => argument === undefined)) {
    return undefined;
  }
  return {
    ...carrier,
    typeArguments: typeArguments as readonly TargetTypeRef[],
  };
}

function discardSourcePrimitiveSemanticCarrier(type: TargetTypeRef | undefined): TargetTypeRef | undefined {
  return type === undefined || targetTypeRefContainsSourcePrimitive(type) ? undefined : type;
}

function typeSyntaxContainsSourcePrimitiveEvidence(
  ast: AstReader,
  checker: TypeCheckerQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): boolean {
  let found = false;
  const visit = (current: Node | undefined): void => {
    if (current === undefined || found) {
      return;
    }
    if (getRuntimeCarrier(facts, current)?.kind === "source-primitive") {
      found = true;
      return;
    }
    const symbol = getSymbolAtReferenceNode(ast, checker, current, options);
    const resolvedSymbol = getResolvedSymbolForReferenceNode(ast, checker, current, options);
    if (
      getSourcePrimitiveCarrier(facts, symbol)?.kind === "source-primitive" ||
      getSourcePrimitiveCarrier(facts, resolvedSymbol)?.kind === "source-primitive"
    ) {
      found = true;
      return;
    }
    ast.forEachChild(current, (child): void => {
      visit(child);
    });
  };
  visit(node);
  return found;
}

export function targetTypeRefContainsSourcePrimitive(type: TargetTypeRef): boolean {
  switch (type.kind) {
    case "source-primitive":
      return true;
    case "array":
      return targetTypeRefContainsSourcePrimitive(type.element);
    case "tuple":
      return type.elements.some(targetTypeRefContainsSourcePrimitive);
    case "source-global":
    case "target-named":
      return (type.typeArguments ?? []).some(targetTypeRefContainsSourcePrimitive);
    case "pointer":
      return targetTypeRefContainsSourcePrimitive(type.pointee);
    case "function-pointer":
      return targetTypeRefContainsSourcePrimitive(type.result) ||
        type.args.some(targetTypeRefContainsSourcePrimitive);
    case "associated-type":
      return targetTypeRefContainsSourcePrimitive(type.owner);
    case "type-parameter":
    case "opaque":
    case "lifetime":
    case "target-specific":
      return false;
  }
}

function getTargetTypeRefForSemanticType(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  type: Type | undefined,
  options: { readonly sourceFile: SourceFile },
  seen: ReadonlySet<Type> = new Set(),
): TargetTypeRef | undefined {
  if (type === undefined || seen.has(type)) {
    return undefined;
  }
  const typeParameterName = getTypeParameterName(ast, checker, type);
  if (typeParameterName !== undefined) {
    return { kind: "type-parameter", name: typeParameterName };
  }
  const directCarrier = getRuntimeCarrier(facts, type);
  if (directCarrier !== undefined) {
    return directCarrier;
  }
  if (!types.isTypeReference(type)) {
    return undefined;
  }
  const target = types.getTypeReferenceTarget(type);
  const binding = facts.getTargetBindingFact(target?.symbol);
  if (binding === undefined) {
    return undefined;
  }
  const nextSeen = new Set(seen).add(type);
  const typeArguments = types.getTypeArguments(type, options)
    .map((argument) => getTargetTypeRefForSemanticType(ast, checker, types, facts, argument, options, nextSeen));
  if (typeArguments.some((argument) => argument === undefined)) {
    return undefined;
  }
  return {
    kind: "target-named",
    id: binding.id,
    ...(typeArguments.length > 0 ? { typeArguments: typeArguments as readonly TargetTypeRef[] } : {}),
  };
}

function getTypeParameterName(ast: AstReader, checker: TypeCheckerQueries, type: Type): string | undefined {
  for (const declaration of checker.getSymbolDeclarations(type.symbol)) {
    if (ast.kindName(declaration) !== "KindTypeParameter") {
      continue;
    }
    const name = ast.text(ast.name(declaration));
    return name.length === 0 ? undefined : name;
  }
  return undefined;
}
