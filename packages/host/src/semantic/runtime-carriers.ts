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
  getDeclarationTypeNode,
  getProjectSourceDeclarationForType,
  getProjectSourceReferenceForNode,
} from "./project-source.js";
import {
  getResolvedSymbolForReferenceNode,
  getSemanticTypeForNode,
  getSymbolAtReferenceNode,
  isTypeReferenceQuery,
} from "./symbols.js";

export function getRuntimeCarrier(
  facts: ExtensionConsumerQueries,
  subject: ExtensionFactSubject | undefined,
): TargetTypeRef | undefined {
  const runtimeCarrier = facts.getRuntimeCarrierFact(subject)?.carrier;
  if (runtimeCarrier !== undefined) {
    return runtimeCarrier;
  }
  const primitive = facts.getSourcePrimitiveFact(subject);
  return primitive === undefined ? undefined : { kind: "source-primitive", name: primitive.kind };
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
    (isTypeReferenceQuery(ast, node)
      ? getRuntimeCarrier(facts, getSymbolAtReferenceNode(ast, checker, node, options))
      : getRuntimeCarrier(facts, getSymbolAtReferenceNode(ast, checker, node, options)) ??
        getRuntimeCarrier(facts, getResolvedSymbolForReferenceNode(ast, checker, node, options)));
  const projectSourceCallReturn = getProjectSourceCallReturnCarrier(
    ast,
    checker,
    types,
    facts,
    node,
    options,
    sourceFiles,
    nextSeen,
  );
  if (projectSourceCallReturn !== undefined) {
    return projectSourceCallReturn;
  }
  const projectSourceConstruction = getProjectSourceConstructionCarrier(
    ast,
    checker,
    types,
    facts,
    node,
    options,
    sourceFiles,
    nextSeen,
  );
  if (projectSourceConstruction !== undefined) {
    return projectSourceConstruction;
  }
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
      return aliasCarrier;
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
  const declaration = reference?.declaration as (Node & { readonly Type?: Node; readonly Initializer?: Node }) | undefined;
  const declarationSubject = declaration?.Type ?? declaration?.Initializer;
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
  const declaration = reference?.declaration as (Node & { readonly Type?: Node; readonly Initializer?: Node }) | undefined;
  const subject = declaration?.Type ?? declaration?.Initializer;
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
  const declaration = node as Node & { readonly Type?: Node; readonly Initializer?: Node };
  const subject = declaration.Type ?? declaration.Initializer;
  return subject === undefined
    ? undefined
    : getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, subject, options, sourceFiles, seen) ??
      getRuntimeCarrierForSemanticType(ast, checker, types, facts, subject, options);
}

function getProjectSourceCallReturnCarrier(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node>,
): TargetTypeRef | undefined {
  if (!ast.is.IsCallExpression(node)) {
    return undefined;
  }
  const callee = ast.as.AsCallExpression(node)?.Expression;
  const reference = getProjectSourceReferenceForNode(ast, checker, types, callee, options, sourceFiles);
  const returnTypeNode = getDeclarationTypeNode(reference?.declaration);
  if (returnTypeNode === undefined || reference === undefined) {
    return undefined;
  }
  const referenceOptions = { sourceFile: reference.sourceFile };
  const returnCarrier = getRuntimeCarrierFromDeclaredFactGraph(
    ast,
    checker,
    types,
    facts,
    returnTypeNode,
    referenceOptions,
    sourceFiles,
    seen,
  ) ?? getRuntimeCarrierForSemanticType(ast, checker, types, facts, returnTypeNode, referenceOptions);
  const substitutions = getProjectSourceCallTypeParameterSubstitutions(
    ast,
    checker,
    types,
    facts,
    node,
    callee,
    reference.declaration,
    options,
    sourceFiles,
    seen,
  );
  return substituteTargetTypeParameters(returnCarrier, substitutions);
}

function getProjectSourceConstructionCarrier(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node>,
): TargetTypeRef | undefined {
  if (!ast.is.IsNewExpression(node)) {
    return undefined;
  }
  const expression = ast.as.AsNewExpression(node)?.Expression;
  const reference = getProjectSourceReferenceForNode(ast, checker, types, expression, options, sourceFiles);
  if (reference === undefined || !ast.is.IsClassDeclaration(reference.declaration)) {
    return undefined;
  }
  const baseCarrier = expression === undefined
    ? undefined
    : getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, expression, options, sourceFiles, seen) ??
      getRuntimeCarrierForSemanticType(ast, checker, types, facts, expression, options);
  if (baseCarrier?.kind !== "target-named") {
    return undefined;
  }
  const explicitTypeArguments = ast.typeArguments(node);
  if (explicitTypeArguments.length === 0) {
    return baseCarrier;
  }
  const typeArguments = explicitTypeArguments.map((argument) =>
    argument === undefined
      ? undefined
      : getTargetTypeRefFromDeclaredTypeNode(ast, checker, types, facts, argument, options, sourceFiles, seen));
  return typeArguments.some((argument) => argument === undefined)
    ? undefined
    : {
        ...baseCarrier,
        typeArguments: typeArguments as readonly TargetTypeRef[],
      };
}

function getProjectSourceCallTypeParameterSubstitutions(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  call: Node,
  callee: Node | undefined,
  selectedDeclaration: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node>,
): ReadonlyMap<string, TargetTypeRef> {
  const substitutions = new Map<string, TargetTypeRef>();
  const receiver = callee === undefined ? undefined : ast.as.AsPropertyAccessExpression(callee)?.Expression;
  if (receiver !== undefined) {
    const receiverCarrier = getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, receiver, options, sourceFiles, seen) ??
      getRuntimeCarrierForSemanticType(ast, checker, types, facts, receiver, options);
    const receiverType = getSemanticTypeForNode(ast, checker, receiver, options);
    const receiverDeclaration = getProjectSourceDeclarationForType(ast, types, receiverType, sourceFiles);
    addTypeParameterSubstitutions(ast, substitutions, receiverDeclaration, receiverCarrier);
  }
  const explicitCallTypeArguments = ast.typeArguments(call);
  if (explicitCallTypeArguments.length > 0) {
    const selectedDeclarationSourceFile = ast.getSourceFile(selectedDeclaration) ?? options.sourceFile;
    const selectedOptions = { sourceFile: selectedDeclarationSourceFile };
    const callTypeArguments = explicitCallTypeArguments.map((argument) =>
      argument === undefined
        ? undefined
        : getTargetTypeRefFromDeclaredTypeNode(ast, checker, types, facts, argument, selectedOptions, sourceFiles, seen));
    addTypeArgumentSubstitutions(ast, substitutions, ast.typeParameters(selectedDeclaration), callTypeArguments);
  }
  return substitutions;
}

function addTypeParameterSubstitutions(
  ast: AstReader,
  substitutions: Map<string, TargetTypeRef>,
  declaration: Node | undefined,
  carrier: TargetTypeRef | undefined,
): void {
  if (declaration === undefined || carrier?.kind !== "target-named") {
    return;
  }
  addTypeArgumentSubstitutions(ast, substitutions, ast.typeParameters(declaration), carrier.typeArguments ?? []);
}

function addTypeArgumentSubstitutions(
  ast: AstReader,
  substitutions: Map<string, TargetTypeRef>,
  typeParameters: readonly (Node | undefined)[],
  typeArguments: readonly (TargetTypeRef | undefined)[],
): void {
  for (let index = 0; index < typeParameters.length; index += 1) {
    const name = ast.text(ast.name(typeParameters[index]));
    const typeArgument = typeArguments[index];
    if (name.length > 0 && typeArgument !== undefined) {
      substitutions.set(name, typeArgument);
    }
  }
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
  return getRuntimeCarrierForType(ast, types, facts, type, options);
}

export function getRuntimeCarrierForType(
  ast: AstReader,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  type: Type | undefined,
  options: { readonly sourceFile: SourceFile },
): TargetTypeRef | undefined {
  return discardSourcePrimitiveSemanticCarrier(getRuntimeCarrier(facts, type)) ??
    discardSourcePrimitiveSemanticCarrier(instantiateSemanticSymbolCarrier(ast, types, facts, type, getRuntimeCarrier(facts, type?.symbol), options)) ??
    discardSourcePrimitiveSemanticCarrier(getTargetTypeRefForSemanticType(ast, types, facts, type, options));
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
  for (const declaration of symbol?.Declarations ?? []) {
    const typeNode = getDeclarationTypeNode(declaration);
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
      return semanticCarrier;
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
  return getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, node, options, sourceFiles, seen) ??
    getRuntimeCarrierForSemanticType(ast, checker, types, facts, node, options);
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

export function targetTypeRefContainsSourcePrimitive(type: TargetTypeRef): boolean {
  switch (type.kind) {
    case "source-primitive":
      return true;
    case "array":
      return targetTypeRefContainsSourcePrimitive(type.element);
    case "tuple":
      return type.elements.some(targetTypeRefContainsSourcePrimitive);
    case "target-named":
      return (type.typeArguments ?? []).some(targetTypeRefContainsSourcePrimitive);
    case "pointer":
      return targetTypeRefContainsSourcePrimitive(type.pointee);
    case "function-pointer":
      return targetTypeRefContainsSourcePrimitive(type.result) ||
        type.args.some(targetTypeRefContainsSourcePrimitive);
    default:
      return false;
  }
}

function getTargetTypeRefForSemanticType(
  ast: AstReader,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  type: Type | undefined,
  options: { readonly sourceFile: SourceFile },
  seen: ReadonlySet<Type> = new Set(),
): TargetTypeRef | undefined {
  if (type === undefined || seen.has(type)) {
    return undefined;
  }
  const typeParameterName = getTypeParameterName(ast, type);
  if (typeParameterName !== undefined) {
    return { kind: "type-parameter", name: typeParameterName };
  }
  const directCarrier = getRuntimeCarrier(facts, type);
  if (directCarrier !== undefined) {
    return directCarrier;
  }
  const symbolCarrier = getRuntimeCarrier(facts, type.symbol);
  if (symbolCarrier !== undefined) {
    return instantiateSemanticSymbolCarrier(ast, types, facts, type, symbolCarrier, options, seen);
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
    .map((argument) => getTargetTypeRefForSemanticType(ast, types, facts, argument, options, nextSeen));
  if (typeArguments.some((argument) => argument === undefined)) {
    return undefined;
  }
  return {
    kind: "target-named",
    id: binding.id,
    ...(typeArguments.length > 0 ? { typeArguments: typeArguments as readonly TargetTypeRef[] } : {}),
  };
}

function instantiateSemanticSymbolCarrier(
  ast: AstReader,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  type: Type | undefined,
  carrier: TargetTypeRef | undefined,
  options: { readonly sourceFile: SourceFile },
  seen: ReadonlySet<Type> = new Set(),
): TargetTypeRef | undefined {
  if (type === undefined || carrier === undefined || carrier.kind !== "target-named" || !types.isTypeReference(type)) {
    return carrier;
  }
  const nextSeen = new Set(seen).add(type);
  const typeArguments = types.getTypeArguments(type, options)
    .map((argument) => getTargetTypeRefForSemanticType(ast, types, facts, argument, options, nextSeen));
  if (typeArguments.some((argument) => argument === undefined)) {
    return undefined;
  }
  return typeArguments.length === 0
    ? carrier
    : {
        ...carrier,
        typeArguments: typeArguments as readonly TargetTypeRef[],
      };
}

function getTypeParameterName(ast: AstReader, type: Type): string | undefined {
  for (const declaration of type.symbol?.Declarations ?? []) {
    if (ast.kindName(declaration) !== "KindTypeParameter") {
      continue;
    }
    const name = ast.text(ast.name(declaration));
    return name.length === 0 ? undefined : name;
  }
  return undefined;
}
