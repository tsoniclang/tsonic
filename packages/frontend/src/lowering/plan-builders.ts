import {
  getTstsExpressionWithTypeArgumentsName,
  getTstsHeritageTypeNodes,
  getTstsIdentifierText,
  getTstsContainingSourceFile,
  getTstsNodeText,
  getTstsTypeReferenceDetails,
  TstsSyntax,
} from "@tsonic/tsts";
import { resolveSourceFileIdentity } from "../program/source-file-identity.js";
import type {
  TstsNode,
  TstsSignature,
  TstsSourceFile,
  TstsSymbol,
  TstsType,
} from "@tsonic/tsts";
import {
  expressionSemanticsFactKey,
  genericFunctionAliasFactKey,
  intrinsicSemanticsFactKey,
  markerApiSemanticsFactKey,
  numericPrimitiveFactKey,
  parameterPassingFactKey,
  sourceBindingIdentityFactKey,
  sourceRuntimeOperationFactKey,
  wellKnownComputedNameFactKey,
} from "../source-frontend/source-facts.js";
import type { SourceBindingIdentityFact } from "../source-frontend/source-facts.js";
import type {
  LoweringBinaryOperator,
  LoweringBindingAccessPlan,
  LoweringBindingElementPlan,
  LoweringBuildContext,
  LoweringDeclarationPlan,
  LoweringEnumMemberPlan,
  LoweringExpressionPlan,
  LoweringIntrinsicTypeName,
  LoweringObjectPropertyPlan,
  LoweringParameterPlan,
  LoweringRuntimeNamePlan,
  LoweringStatementPlan,
  LoweringTemplatePartPlan,
  LoweringTypeDeclarationBinding,
  LoweringTypeMemberPlan,
  LoweringTypePlan,
  LoweringTypeRefPlan,
  LoweringUnaryOperator,
  LoweringVariablePlan,
} from "./types.js";
import {
  isDeclarationNode,
  isExpressionNode,
  isStatementNode,
  isTypeNode,
  visitTstsNodes,
} from "./tsts-node-classification.js";

const nodeSourceText = (sourceFile: TstsSourceFile, node: TstsNode): string => {
  void sourceFile;
  return getTstsNodeText(node) ?? TstsSyntax.Node_KindString(node);
};

const nodeTokenText = (node: TstsNode | undefined): string | undefined => {
  if (!node) return undefined;
  if (node.Kind === TstsSyntax.KindPrivateIdentifier) {
    const text = TstsSyntax.AsPrivateIdentifier(node)?.Text;
    if (!text) return undefined;
    const privateName = text.startsWith("#") ? text.slice(1) : text;
    return `__private_${privateName}`;
  }
  return getTstsIdentifierText(node);
};

const nodeLiteralText = (node: TstsNode | undefined): string | undefined =>
  node ? getTstsNodeText(node) : undefined;

type NodeNameInfo = {
  readonly name?: string;
  readonly sourceKindName?: string;
  readonly sourceText?: string;
  readonly computed: boolean;
  readonly computedName?:
    | "symbol-iterator"
    | "symbol-async-iterator"
    | "symbol-to-string-tag";
};

const nodeNameInfo = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context?: LoweringBuildContext
): NodeNameInfo => {
  if (!node) return { computed: false };
  const nameNode = TstsSyntax.Node_Name(node);
  if (!nameNode) return { computed: false };
  const sourceKindName = TstsSyntax.Node_KindString(nameNode);
  const sourceText = nodeSourceText(sourceFile, nameNode);
  if (nameNode.Kind === TstsSyntax.KindComputedPropertyName) {
    return {
      sourceKindName,
      sourceText,
      computed: true,
      computedName: context?.input.facts.get(
        wellKnownComputedNameFactKey,
        nameNode
      )?.kind,
    };
  }
  return {
    name: nodeTokenText(nameNode),
    sourceKindName,
    sourceText,
    computed: false,
  };
};

const nodeName = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): string | undefined => nodeNameInfo(sourceFile, node).name;

const propertyNameInfo = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context?: LoweringBuildContext
): NodeNameInfo => {
  if (!node) return { computed: false };
  const nameNode = TstsSyntax.Node_PropertyNameOrName(node);
  if (!nameNode) return nodeNameInfo(sourceFile, node, context);
  const sourceKindName = TstsSyntax.Node_KindString(nameNode);
  const sourceText = nodeSourceText(sourceFile, nameNode);
  if (nameNode.Kind === TstsSyntax.KindComputedPropertyName) {
    return {
      sourceKindName,
      sourceText,
      computed: true,
      computedName: context?.input.facts.get(
        wellKnownComputedNameFactKey,
        nameNode
      )?.kind,
    };
  }
  return {
    name: nodeTokenText(nameNode),
    sourceKindName,
    sourceText,
    computed: false,
  };
};

const modifierFlags = (node: TstsNode): number =>
  Number(TstsSyntax.Node_ModifierFlags(node));

const nodeHasModifier = (node: TstsNode, flag: number): boolean =>
  (modifierFlags(node) & flag) !== 0;

const nodeHasModifierToken = (node: TstsNode, kind: number): boolean =>
  (TstsSyntax.Node_ModifierNodes(node) ?? []).some(
    (modifier) => modifier?.Kind === kind
  );

const nodeAccessibility = (
  node: TstsNode
): LoweringDeclarationPlan["accessibility"] => {
  if (nodeHasModifierToken(node, TstsSyntax.KindPrivateKeyword)) return "private";
  if (nodeHasModifierToken(node, TstsSyntax.KindProtectedKeyword)) {
    return "protected";
  }
  return "public";
};

const nodeHasExplicitAccessibility = (node: TstsNode): boolean =>
  nodeHasModifierToken(node, TstsSyntax.KindPublicKeyword) ||
  nodeHasModifierToken(node, TstsSyntax.KindPrivateKeyword) ||
  nodeHasModifierToken(node, TstsSyntax.KindProtectedKeyword);

const nodeOrAncestorHasModifier = (node: TstsNode, flag: number): boolean => {
  let current: TstsNode | undefined = node;
  while (current) {
    if (nodeHasModifier(current, flag)) return true;
    current = current.Parent;
  }
  return false;
};

const binaryOperatorFromKind = (
  kind: number | undefined
): LoweringBinaryOperator | undefined => {
  switch (kind) {
    case TstsSyntax.KindEqualsEqualsToken:
      return "equal";
    case TstsSyntax.KindEqualsEqualsEqualsToken:
      return "strict-equal";
    case TstsSyntax.KindExclamationEqualsToken:
      return "not-equal";
    case TstsSyntax.KindExclamationEqualsEqualsToken:
      return "strict-not-equal";
    case TstsSyntax.KindAmpersandAmpersandToken:
      return "logical-and";
    case TstsSyntax.KindBarBarToken:
      return "logical-or";
    case TstsSyntax.KindQuestionQuestionToken:
      return "nullish-coalesce";
    case TstsSyntax.KindPlusToken:
      return "add";
    case TstsSyntax.KindMinusToken:
      return "subtract";
    case TstsSyntax.KindAsteriskToken:
      return "multiply";
    case TstsSyntax.KindSlashToken:
      return "divide";
    case TstsSyntax.KindPercentToken:
      return "remainder";
    case TstsSyntax.KindAmpersandToken:
      return "bitwise-and";
    case TstsSyntax.KindBarToken:
      return "bitwise-or";
    case TstsSyntax.KindCaretToken:
      return "bitwise-xor";
    case TstsSyntax.KindLessThanLessThanToken:
      return "left-shift";
    case TstsSyntax.KindGreaterThanGreaterThanToken:
      return "signed-right-shift";
    case TstsSyntax.KindGreaterThanGreaterThanGreaterThanToken:
      return "unsigned-right-shift";
    case TstsSyntax.KindLessThanToken:
      return "less-than";
    case TstsSyntax.KindLessThanEqualsToken:
      return "less-than-or-equal";
    case TstsSyntax.KindGreaterThanToken:
      return "greater-than";
    case TstsSyntax.KindGreaterThanEqualsToken:
      return "greater-than-or-equal";
    case TstsSyntax.KindEqualsToken:
      return "assign";
    case TstsSyntax.KindPlusEqualsToken:
      return "add-assign";
    case TstsSyntax.KindMinusEqualsToken:
      return "subtract-assign";
    case TstsSyntax.KindAsteriskEqualsToken:
      return "multiply-assign";
    case TstsSyntax.KindSlashEqualsToken:
      return "divide-assign";
    case TstsSyntax.KindPercentEqualsToken:
      return "remainder-assign";
    case TstsSyntax.KindAmpersandEqualsToken:
      return "bitwise-and-assign";
    case TstsSyntax.KindBarEqualsToken:
      return "bitwise-or-assign";
    case TstsSyntax.KindCaretEqualsToken:
      return "bitwise-xor-assign";
    case TstsSyntax.KindLessThanLessThanEqualsToken:
      return "left-shift-assign";
    case TstsSyntax.KindGreaterThanGreaterThanEqualsToken:
      return "signed-right-shift-assign";
    case TstsSyntax.KindGreaterThanGreaterThanGreaterThanEqualsToken:
      return "unsigned-right-shift-assign";
    case TstsSyntax.KindInstanceOfKeyword:
      return "instanceof";
    default:
      return undefined;
  }
};

const unaryOperatorFromKind = (
  kind: number | undefined
): LoweringUnaryOperator | undefined => {
  switch (kind) {
    case TstsSyntax.KindPlusToken:
      return "plus";
    case TstsSyntax.KindMinusToken:
      return "minus";
    case TstsSyntax.KindExclamationToken:
      return "logical-not";
    case TstsSyntax.KindTildeToken:
      return "bitwise-not";
    case TstsSyntax.KindPlusPlusToken:
      return "increment";
    case TstsSyntax.KindMinusMinusToken:
      return "decrement";
    default:
      return undefined;
  }
};

const compactNodeSourceText = (
  sourceFile: TstsSourceFile,
  node: TstsNode
): string => nodeSourceText(sourceFile, node).replace(/\s+/g, " ").trim();

const templateFragmentText = (
  _sourceFile: TstsSourceFile,
  node: TstsNode
): string => nodeTokenText(node) ?? "";

const nodeListNodes = (
  list: { readonly Nodes?: readonly (TstsNode | undefined)[] } | undefined
): readonly TstsNode[] =>
  (list?.Nodes ?? []).filter((node): node is TstsNode => node !== undefined);

const nodeArrayNodes = (
  nodes: readonly (TstsNode | undefined)[] | undefined
): readonly TstsNode[] =>
  (nodes ?? []).filter((node): node is TstsNode => node !== undefined);

const typeParameterNames = (
  _sourceFile: TstsSourceFile,
  node: TstsNode
): readonly string[] =>
  nodeArrayNodes(TstsSyntax.Node_TypeParameters(node))
    .map((typeParameter) => nodeTokenText(TstsSyntax.Node_Name(typeParameter)))
    .filter((name): name is string => name !== undefined);

const intrinsicTypePlan = (
  name: LoweringIntrinsicTypeName,
  sourceText?: string
): LoweringTypeRefPlan => ({
  kind: "intrinsic",
  name,
  sourceText,
});

const unsupportedTypePlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode
): LoweringTypeRefPlan => ({
  kind: "unsupported",
  sourceKindName: TstsSyntax.Node_KindString(node),
  sourceText: compactNodeSourceText(sourceFile, node),
});

type CheckerTypePlanState = {
  readonly types: Set<TstsType>;
};

const createCheckerTypePlanState = (): CheckerTypePlanState => ({
  types: new Set<TstsType>(),
});

const checkerTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  type: TstsType | undefined,
  state: CheckerTypePlanState = createCheckerTypePlanState()
): LoweringTypeRefPlan | undefined => {
  if (!type) return undefined;
  if (state.types.has(type)) return intrinsicTypePlan("unknown");
  state.types.add(type);
  try {
  const checker = context.checkerForSourceFile(sourceFile);
  const unionMembers = checker.getUnionMembers(type);
  if (unionMembers && unionMembers.length > 0) {
    return {
      kind: "union",
      types: unionMembers
        .map((member) => checkerTypePlan(context, sourceFile, member, state))
        .filter(
          (member): member is LoweringTypeRefPlan => member !== undefined
        ),
    };
  }
  const intersectionMembers = checker.getIntersectionMembers(type);
  if (intersectionMembers && intersectionMembers.length > 0) {
    return {
      kind: "intersection",
      types: intersectionMembers
        .map((member) => checkerTypePlan(context, sourceFile, member, state))
        .filter(
          (member): member is LoweringTypeRefPlan => member !== undefined
        ),
    };
  }
  const arrayElement = checker.getElementTypeOfArrayType(type);
  if (arrayElement) {
    return {
      kind: "array",
      elementType:
        checkerTypePlan(context, sourceFile, arrayElement, state) ??
        intrinsicTypePlan("unknown"),
      readonly: false,
    };
  }
  if (checker.isAnyType(type)) return intrinsicTypePlan("any");
  if (checker.isUnknownType(type)) return intrinsicTypePlan("unknown");
  if (checker.isVoidType(type)) return intrinsicTypePlan("void");
  if (checker.isNeverType(type)) return intrinsicTypePlan("never");
  if (checker.isUndefinedType(type)) return intrinsicTypePlan("undefined");
  if (checker.isNullType(type)) return intrinsicTypePlan("null");
  if (checker.isStringLikeType(type)) return intrinsicTypePlan("string");
  if (checker.isNumberLikeType(type)) return intrinsicTypePlan("number");
  if (checker.isBooleanLikeType(type)) return intrinsicTypePlan("boolean");
  if (checker.isBigIntLikeType(type)) return intrinsicTypePlan("bigint");

  const callSignatures = checker.getCallSignatures(type);
  if (callSignatures.length === 1) {
    const signature = callSignatures[0];
    return {
      kind: "function",
      parameters: checker.getSignatureParameters(signature).map((parameter) => {
        const declaration =
          checker.getSymbolValueDeclaration(parameter) ??
          checker.getSymbolDeclarations(parameter)[0];
        const parameterType = declaration
          ? checker.getTypeOfSymbolAtLocation(parameter, declaration)
          : undefined;
        return {
          name: checker.getSymbolName(parameter) || "arg",
          type:
            declarationSourceTypePlan(context, sourceFile, declaration) ??
            checkerTypePlan(context, sourceFile, parameterType, state),
          optional: false,
          rest: false,
        };
      }),
      returnType:
        signatureReturnSourceTypePlan(context, sourceFile, signature) ??
        checkerTypePlan(
          context,
          sourceFile,
          checker.getReturnTypeOfSignature(signature),
          state
        ),
      typeParameters: [],
    };
  }

  const typeSymbol = checker.getTypeAliasOrSymbol(type);
  const name =
    checker.getTypeAliasSymbolName(type) ??
    checker.getTypeSymbolName(type) ??
    (typeSymbol ? checker.getSymbolName(typeSymbol) : undefined);
  if (name) {
    const typeArguments = [
      ...checker.getAliasTypeArguments(type),
      ...checker.getReferenceTypeArguments(type),
    ];
    return {
      kind: "named",
      name,
      typeArguments: typeArguments
        .map((argument) => checkerTypePlan(context, sourceFile, argument, state))
        .filter(
          (argument): argument is LoweringTypeRefPlan => argument !== undefined
        ),
      runtimeName: runtimeNameForType(
        context,
        sourceFile,
        type,
        name
      ),
      declaration: typeDeclarationBindingForType(context, sourceFile, type),
      declarationKind: namedDeclarationKindForType(context, sourceFile, type),
      aliasTarget: checkerTypeAliasTargetPlan(context, sourceFile, type),
    };
  }

  const properties = checker.getProperties(type);
  if (properties.length > 0) {
    return {
      kind: "object",
      members: properties.map((property) => {
        const declaration =
          checker.getSymbolValueDeclaration(property) ??
          checker.getSymbolDeclarations(property)[0];
        return {
          kind: "property",
          name: checker.getSymbolName(property),
          optional: false,
          type:
            declarationSourceTypePlan(context, sourceFile, declaration) ??
            checkerTypePlan(
              context,
              sourceFile,
              declaration
                ? checker.getTypeOfSymbolAtLocation(property, declaration)
                : undefined,
              state
            ),
        };
      }),
    };
  }

  return intrinsicTypePlan("unknown");
  } finally {
    state.types.delete(type);
  }
};

const typePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  type: TstsType | undefined,
  state: SourceTypePlanState = createSourceTypePlanState()
): LoweringTypeRefPlan | undefined => {
  if (node) {
    return sourceTypePlan(context, sourceFile, node, state);
  }
  return checkerTypePlan(context, sourceFile, type);
};

const sourceFileForNode = (
  node: TstsNode | undefined,
  defaultSourceFile: TstsSourceFile
): TstsSourceFile =>
  node
    ? (getTstsContainingSourceFile(node) ?? defaultSourceFile)
    : defaultSourceFile;

const namespaceTypeDeclarationKinds = new Set([
  TstsSyntax.KindClassDeclaration,
  TstsSyntax.KindEnumDeclaration,
  TstsSyntax.KindInterfaceDeclaration,
  TstsSyntax.KindTypeAliasDeclaration,
]);

const staticContainerValueDeclarationKinds = new Set([
  TstsSyntax.KindFunctionDeclaration,
  TstsSyntax.KindVariableDeclaration,
]);

const isTopLevelStaticValueDeclaration = (declaration: TstsNode): boolean => {
  if (declaration.Kind === TstsSyntax.KindFunctionDeclaration) {
    return declaration.Parent?.Kind === TstsSyntax.KindSourceFile;
  }
  if (declaration.Kind !== TstsSyntax.KindVariableDeclaration) {
    return false;
  }
  const list = declaration.Parent;
  const statement = list?.Parent;
  return (
    statement?.Kind === TstsSyntax.KindVariableStatement &&
    statement.Parent?.Kind === TstsSyntax.KindSourceFile
  );
};

const isRuntimeTypeDeclaration = (
  declaration: TstsNode | undefined
): declaration is TstsNode =>
  declaration?.Kind === TstsSyntax.KindClassDeclaration ||
  declaration?.Kind === TstsSyntax.KindEnumDeclaration ||
  declaration?.Kind === TstsSyntax.KindInterfaceDeclaration ||
  declaration?.Kind === TstsSyntax.KindTypeAliasDeclaration;

const typeDeclarationBindingForDeclaration = (
  declaration: TstsNode | undefined,
  fallbackSourceFile: TstsSourceFile
): LoweringTypeDeclarationBinding | undefined => {
  if (!isRuntimeTypeDeclaration(declaration)) return undefined;
  return {
    sourceFile: sourceFileForNode(declaration, fallbackSourceFile),
    sourceNode: declaration,
  };
};

const typeDeclarationBindingForSymbol = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  symbol: TstsSymbol | undefined
): LoweringTypeDeclarationBinding | undefined => {
  if (!symbol) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const declaration = checker
    .getSymbolDeclarations(symbol)
    .find(isRuntimeTypeDeclaration);
  return typeDeclarationBindingForDeclaration(declaration, sourceFile);
};

const typeDeclarationBindingForType = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  type: TstsType | undefined
): LoweringTypeDeclarationBinding | undefined => {
  if (!type) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  return typeDeclarationBindingForSymbol(
    context,
    sourceFile,
    checker.getTypeAliasOrSymbol(type)
  );
};

const typeDeclarationBindingForNode = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): LoweringTypeDeclarationBinding | undefined => {
  if (!node) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const symbol = checker.getSymbolAtLocation(node);
  const resolved = symbol ? checker.resolveAlias(symbol) : undefined;
  return typeDeclarationBindingForSymbol(context, sourceFile, resolved);
};

const runtimeNameForSourceBindingFact = (
  context: LoweringBuildContext,
  fact: SourceBindingIdentityFact | undefined,
  target: "type" | "value"
): LoweringRuntimeNamePlan | undefined => {
  if (!fact) return undefined;
  const identity = resolveSourceFileIdentity(
    fact.sourceFileName,
    context.options.sourceRoot,
    context.options.rootNamespace
  );
  switch (fact.declarationKind) {
    case "class":
    case "enum":
    case "interface":
    case "type-alias":
      return { namespace: identity.namespace, name: fact.name };
    case "function":
    case "variable":
      return target === "value" && fact.topLevelStaticValue
        ? {
            namespace: identity.namespace,
            container: identity.className,
            name: fact.name,
          }
        : undefined;
  }
};

const runtimeNameForSourceBindingNode = (
  context: LoweringBuildContext,
  node: TstsNode | undefined,
  target: "type" | "value"
): LoweringRuntimeNamePlan | undefined =>
  node
    ? runtimeNameForSourceBindingFact(
        context,
        context.input.facts.get(sourceBindingIdentityFactKey, node),
        target
      )
    : undefined;

const runtimeNameForDeclaration = (
  context: LoweringBuildContext,
  declaration: TstsNode | undefined,
  exportedName: string,
  target: "type" | "value"
): LoweringRuntimeNamePlan | undefined => {
  if (!declaration) return undefined;
  if (declaration.Kind === TstsSyntax.KindTypeParameter) return undefined;
  const declarationSourceFile = getTstsContainingSourceFile(declaration);
  if (!declarationSourceFile) return undefined;
  if (declarationSourceFile.IsDeclarationFile === true) return undefined;
  const identity = resolveSourceFileIdentity(
    declarationSourceFile.FileName(),
    context.options.sourceRoot,
    context.options.rootNamespace
  );
  if (target === "type") {
    if (!namespaceTypeDeclarationKinds.has(declaration.Kind)) {
      return undefined;
    }
    return { namespace: identity.namespace, name: exportedName };
  }
  if (namespaceTypeDeclarationKinds.has(declaration.Kind)) {
    return { namespace: identity.namespace, name: exportedName };
  }
  if (
    staticContainerValueDeclarationKinds.has(declaration.Kind) &&
    isTopLevelStaticValueDeclaration(declaration)
  ) {
    return {
      namespace: identity.namespace,
      container: identity.className,
      name: exportedName,
    };
  }
  return undefined;
};

const runtimeNameForType = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  type: TstsType | undefined,
  name: string
): LoweringRuntimeNamePlan | undefined => {
  if (!type) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const symbol = checker.getTypeAliasOrSymbol(type);
  const declaration = symbol
    ? checker.getSymbolDeclarations(symbol).find(
        (candidate): candidate is TstsNode => candidate !== undefined
      )
    : undefined;
  return runtimeNameForDeclaration(context, declaration, name, "type");
};

const namedDeclarationKindForDeclaration = (
  declaration: TstsNode | undefined
): Extract<
  LoweringTypeRefPlan,
  { readonly kind: "named" }
>["declarationKind"] => {
  switch (declaration?.Kind) {
    case TstsSyntax.KindClassDeclaration:
      return "class";
    case TstsSyntax.KindEnumDeclaration:
      return "enum";
    case TstsSyntax.KindInterfaceDeclaration:
      return "interface";
    case TstsSyntax.KindTypeAliasDeclaration:
      return "type-alias";
    default:
      return undefined;
  }
};

const namedDeclarationKindForType = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  type: TstsType | undefined
): Extract<
  LoweringTypeRefPlan,
  { readonly kind: "named" }
>["declarationKind"] => {
  if (!type) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const symbol = checker.getTypeAliasOrSymbol(type);
  const declaration = symbol
    ? checker.getSymbolDeclarations(symbol).find(
        (candidate): candidate is TstsNode => candidate !== undefined
      )
    : undefined;
  return namedDeclarationKindForDeclaration(declaration);
};

const runtimeNameForSymbol = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  symbol: TstsSymbol | undefined,
  exportedName: string
): LoweringRuntimeNamePlan | undefined => {
  if (!symbol) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const declaration =
    checker.getSymbolValueDeclaration(symbol) ??
    checker
      .getSymbolDeclarations(symbol)
      .find((candidate): candidate is TstsNode => candidate !== undefined);
  return runtimeNameForDeclaration(
    context,
    declaration,
    exportedName,
    "value"
  );
};

type SourceTypePlanState = {
  readonly aliasTargets: Set<TstsNode>;
  readonly aliasKeys: Set<string>;
};

const createSourceTypePlanState = (): SourceTypePlanState => ({
  aliasTargets: new Set<TstsNode>(),
  aliasKeys: new Set<string>(),
});

type TypeSubstitutionMap = ReadonlyMap<string, LoweringTypeRefPlan>;

const withoutSubstitutions = (
  substitutions: TypeSubstitutionMap,
  names: readonly string[]
): TypeSubstitutionMap => {
  if (names.length === 0 || substitutions.size === 0) return substitutions;
  const next = new Map(substitutions);
  for (const name of names) {
    next.delete(name);
  }
  return next;
};

const substituteTypePlan = (
  type: LoweringTypeRefPlan | undefined,
  substitutions: TypeSubstitutionMap
): LoweringTypeRefPlan | undefined => {
  if (!type || substitutions.size === 0) return type;
  switch (type.kind) {
    case "named": {
      const replacement =
        !type.aliasTarget &&
        !type.runtimeName &&
        type.declarationKind === undefined &&
        type.typeArguments.length === 0
          ? substitutions.get(type.name)
          : undefined;
      if (replacement) return replacement;
      return {
        ...type,
        typeArguments: type.typeArguments
          .map((argument) => substituteTypePlan(argument, substitutions))
          .filter(
            (argument): argument is LoweringTypeRefPlan => argument !== undefined
          ),
        aliasTarget: substituteTypePlan(type.aliasTarget, substitutions),
      };
    }
    case "array":
      return {
        ...type,
        elementType:
          substituteTypePlan(type.elementType, substitutions) ?? type.elementType,
      };
    case "tuple":
      return {
        ...type,
        elements: type.elements
          .map((element) => substituteTypePlan(element, substitutions))
          .filter(
            (element): element is LoweringTypeRefPlan => element !== undefined
          ),
      };
    case "union":
      return {
        ...type,
        types: type.types
          .map((member) => substituteTypePlan(member, substitutions))
          .filter((member): member is LoweringTypeRefPlan => member !== undefined),
      };
    case "intersection":
      return {
        ...type,
        types: type.types
          .map((member) => substituteTypePlan(member, substitutions))
          .filter((member): member is LoweringTypeRefPlan => member !== undefined),
      };
    case "function": {
      const scoped = withoutSubstitutions(substitutions, type.typeParameters);
      return {
        ...type,
        parameters: type.parameters.map((parameter) =>
          substituteParameterPlan(parameter, scoped)
        ),
        returnType: substituteTypePlan(type.returnType, scoped),
      };
    }
    case "object":
      return {
        ...type,
        members: type.members.map((member) =>
          substituteTypeMemberPlan(member, substitutions)
        ),
      };
    case "predicate":
      return {
        ...type,
        assertedType: substituteTypePlan(type.assertedType, substitutions),
      };
    case "intrinsic":
    case "source-primitive":
    case "literal":
    case "unsupported":
      return type;
  }
};

const substituteParameterPlan = (
  parameter: LoweringParameterPlan,
  substitutions: TypeSubstitutionMap
): LoweringParameterPlan => ({
  ...parameter,
  type: substituteTypePlan(parameter.type, substitutions),
});

const substituteTypeMemberPlan = (
  member: LoweringTypeMemberPlan,
  substitutions: TypeSubstitutionMap
): LoweringTypeMemberPlan => {
  switch (member.kind) {
    case "property":
      return { ...member, type: substituteTypePlan(member.type, substitutions) };
    case "method": {
      const scoped = withoutSubstitutions(substitutions, member.typeParameters);
      return {
        ...member,
        parameters: member.parameters.map((parameter) =>
          substituteParameterPlan(parameter, scoped)
        ),
        returnType: substituteTypePlan(member.returnType, scoped),
      };
    }
    case "index-signature":
      return {
        ...member,
        keyType: substituteTypePlan(member.keyType, substitutions),
        valueType: substituteTypePlan(member.valueType, substitutions),
      };
  }
};

const aliasTypeSubstitutions = (
  parameters: readonly string[],
  arguments_: readonly LoweringTypeRefPlan[]
): TypeSubstitutionMap => {
  const substitutions = new Map<string, LoweringTypeRefPlan>();
  parameters.forEach((parameter, index) => {
    const argument = arguments_[index];
    if (argument) substitutions.set(parameter, argument);
  });
  return substitutions;
};

const checkerTypeArgumentPlans = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  type: TstsType | undefined
): readonly LoweringTypeRefPlan[] => {
  if (!type) return [];
  const checker = context.checkerForSourceFile(sourceFile);
  return [
    ...checker.getAliasTypeArguments(type),
    ...checker.getReferenceTypeArguments(type),
  ]
    .map((argument) => checkerTypePlan(context, sourceFile, argument))
    .filter((argument): argument is LoweringTypeRefPlan => argument !== undefined);
};

const sourceTypeArgumentPlans = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode,
  type: TstsType | undefined,
  state: SourceTypePlanState
): readonly LoweringTypeRefPlan[] => {
  const reference = getTstsTypeReferenceDetails(node);
  const sourceArguments = (reference?.typeArguments ?? [])
    .map((argument) => sourceTypePlan(context, sourceFile, argument, state))
    .filter((argument): argument is LoweringTypeRefPlan => argument !== undefined);
  return sourceArguments.length > 0
    ? sourceArguments
    : checkerTypeArgumentPlans(context, sourceFile, type);
};

const sourceTypeAliasKey = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  declaration: TstsNode,
  symbol: TstsSymbol | undefined
): string => {
  const declarationSourceFile = sourceFileForNode(declaration, sourceFile);
  const checker = context.checkerForSourceFile(declarationSourceFile);
  const name =
    (symbol ? checker.getSymbolName(symbol) : undefined) ??
    nodeName(declarationSourceFile, declaration) ??
    TstsSyntax.Node_KindString(declaration);
  return `${declarationSourceFile.FileName()}\0${name}`;
};

const singleInterfaceCallSignature = (
  declaration: TstsNode
): TstsNode | undefined => {
  if (declaration.Kind !== TstsSyntax.KindInterfaceDeclaration) {
    return undefined;
  }
  const callSignatures = (TstsSyntax.Node_Members(declaration) ?? []).filter(
    (member): member is TstsNode =>
      member !== undefined && member.Kind === TstsSyntax.KindCallSignature
  );
  return callSignatures.length === 1 ? callSignatures[0] : undefined;
};

const interfaceCallSignatureTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  callSignature: TstsNode,
  state: SourceTypePlanState
): LoweringTypeRefPlan => ({
  kind: "function",
  parameters: parameterPlans(sourceFile, callSignature, context, [], state),
  returnType: sourceTypePlan(
    context,
    sourceFile,
    TstsSyntax.Node_Type(callSignature),
    state
  ),
  typeParameters: typeParameterNames(sourceFile, callSignature),
});

const localTypeAliasDeclaration = (
  sourceFile: TstsSourceFile,
  name: string
): TstsNode | undefined => {
  let match: TstsNode | undefined;
  visitTstsNodes(sourceFile, (node) => {
    if (match || node.Kind !== TstsSyntax.KindTypeAliasDeclaration) return;
    if (nodeTokenText(TstsSyntax.Node_Name(node)) === name) {
      match = node;
    }
  });
  return match;
};

const sourceTypeAliasTargetPlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode,
  state: SourceTypePlanState
): LoweringTypeRefPlan | undefined => {
  const typeReference = getTstsTypeReferenceDetails(node);
  const localAlias = typeReference
    ? localTypeAliasDeclaration(sourceFile, typeReference.name)
    : undefined;
  const localAliasTarget = localAlias ? TstsSyntax.Node_Type(localAlias) : undefined;
  if (
    localAliasTarget &&
    localAliasTarget !== node &&
    getTstsTypeReferenceDetails(localAliasTarget)
  ) {
    return sourceTypePlan(
      context,
      sourceFileForNode(localAliasTarget, sourceFile),
      localAliasTarget,
      state
    );
  }
  const resolvedDeclaration = typeReference
    ? typeDeclarationBindingForNode(context, sourceFile, node)
    : undefined;
  if (resolvedDeclaration) {
    const targetType = TstsSyntax.Node_Type(resolvedDeclaration.sourceNode);
    const substitutions = aliasTypeSubstitutions(
      typeParameterNames(
        resolvedDeclaration.sourceFile,
        resolvedDeclaration.sourceNode
      ),
      typeReference?.typeArguments
        .map((argument) => sourceTypePlan(context, sourceFile, argument, state))
        .filter(
          (argument): argument is LoweringTypeRefPlan => argument !== undefined
        ) ?? []
    );
    const interfaceCallSignature = singleInterfaceCallSignature(
      resolvedDeclaration.sourceNode
    );
    const aliasKey = sourceTypeAliasKey(
      context,
      resolvedDeclaration.sourceFile,
      resolvedDeclaration.sourceNode,
      undefined
    );
    if (state.aliasKeys.has(aliasKey)) {
      return undefined;
    }
    state.aliasKeys.add(aliasKey);
    try {
      if (interfaceCallSignature) {
        return substituteTypePlan(
          interfaceCallSignatureTypePlan(
            context,
            sourceFileForNode(
              interfaceCallSignature,
              resolvedDeclaration.sourceFile
            ),
            interfaceCallSignature,
            state
          ),
          substitutions
        );
      }
      return targetType
        ? substituteTypePlan(
            sourceTypePlan(
              context,
              sourceFileForNode(targetType, resolvedDeclaration.sourceFile),
              targetType,
              state
            ),
            substitutions
          )
        : undefined;
    } finally {
      state.aliasKeys.delete(aliasKey);
    }
  }
  const checker = context.checkerForSourceFile(sourceFile);
  const type = checker.getTypeFromTypeNode(node);
  const directSymbol = checker.getSymbolAtLocation(node);
  const directTypeAliasDeclaration = directSymbol
    ? checker
        .getSymbolDeclarations(directSymbol)
        .find(
          (candidate): candidate is TstsNode =>
            candidate !== undefined &&
            candidate.Kind === TstsSyntax.KindTypeAliasDeclaration
        )
    : undefined;
  const symbol = directTypeAliasDeclaration
    ? directSymbol
    : type
      ? checker.getTypeAliasOrSymbol(type)
      : undefined;
  const declaration = symbol
    ? directTypeAliasDeclaration ??
      checker
          .getSymbolDeclarations(symbol)
          .find(
            (candidate): candidate is TstsNode =>
              candidate !== undefined &&
              (candidate.Kind === TstsSyntax.KindTypeAliasDeclaration ||
                candidate.Kind === TstsSyntax.KindInterfaceDeclaration)
          )
    : undefined;
  const interfaceCallSignature = declaration
    ? singleInterfaceCallSignature(declaration)
    : undefined;
  const declarationSourceFile = declaration
    ? sourceFileForNode(declaration, sourceFile)
    : sourceFile;
  const substitutions = declaration
    ? aliasTypeSubstitutions(
        typeParameterNames(declarationSourceFile, declaration),
        sourceTypeArgumentPlans(context, sourceFile, node, type, state)
      )
    : new Map<string, LoweringTypeRefPlan>();
  if (declaration && interfaceCallSignature) {
    const aliasKey = sourceTypeAliasKey(context, sourceFile, declaration, symbol);
    if (state.aliasKeys.has(aliasKey)) {
      return undefined;
    }
    state.aliasKeys.add(aliasKey);
    try {
      return substituteTypePlan(
        interfaceCallSignatureTypePlan(
          context,
          sourceFileForNode(interfaceCallSignature, sourceFile),
          interfaceCallSignature,
          state
        ),
        substitutions
      );
    } finally {
      state.aliasKeys.delete(aliasKey);
    }
  }
  const targetType = declaration
    ? TstsSyntax.Node_Type(declaration)
    : undefined;
  if (
    !declaration ||
    !targetType ||
    targetType === node ||
    state.aliasTargets.has(targetType)
  ) {
    return undefined;
  }
  const aliasKey = sourceTypeAliasKey(context, sourceFile, declaration, symbol);
  if (state.aliasKeys.has(aliasKey)) {
    return undefined;
  }
  state.aliasTargets.add(targetType);
  state.aliasKeys.add(aliasKey);
  try {
    return substituteTypePlan(
      sourceTypePlan(
        context,
        sourceFileForNode(targetType, sourceFile),
        targetType,
        state
      ),
      substitutions
    );
  } finally {
    state.aliasTargets.delete(targetType);
    state.aliasKeys.delete(aliasKey);
  }
};

const sourceTypeAliasDeclarationTargetPlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): LoweringTypeRefPlan | undefined => {
  if (!node) return undefined;
  const typeReference = getTstsTypeReferenceDetails(node);
  if (!typeReference) return sourceTypePlan(context, sourceFile, node);
  const checker = context.checkerForSourceFile(sourceFile);
  const sourceType = checker.getTypeFromTypeNode(node);
  const typeNodeSymbol = checker.getSymbolAtLocation(node);
  const resolvedTypeNodeSymbol = typeNodeSymbol
    ? checker.resolveAlias(typeNodeSymbol)
    : undefined;
  const typeName =
    checker.getTypeAliasSymbolName(sourceType) ??
    checker.getTypeSymbolName(sourceType) ??
    typeReference.name;
  const state = createSourceTypePlanState();
  return {
    kind: "named",
    name: typeName,
    typeArguments: typeReference.typeArguments
      .map((argument) => sourceTypePlan(context, sourceFile, argument))
      .filter(
        (argument): argument is LoweringTypeRefPlan => argument !== undefined
      ),
    aliasTarget: sourceTypeAliasTargetPlan(context, sourceFile, node, state),
    runtimeName:
      runtimeNameForSourceBindingNode(context, node, "type") ??
      runtimeNameForType(context, sourceFile, sourceType, typeName) ??
      runtimeNameForSymbol(
        context,
        sourceFile,
        resolvedTypeNodeSymbol,
        typeName
      ),
    declaration: typeDeclarationBindingForNode(context, sourceFile, node),
    declarationKind: namedDeclarationKindForType(context, sourceFile, sourceType),
    sourceText: compactNodeSourceText(sourceFile, node),
  };
};

const checkerTypeAliasTargetPlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  type: TstsType,
  state: SourceTypePlanState = createSourceTypePlanState()
): LoweringTypeRefPlan | undefined => {
  const checker = context.checkerForSourceFile(sourceFile);
  const symbol = checker.getTypeAliasOrSymbol(type);
  const declaration = symbol
    ? checker
        .getSymbolDeclarations(symbol)
        .find(
          (candidate): candidate is TstsNode =>
            candidate !== undefined &&
            (candidate.Kind === TstsSyntax.KindTypeAliasDeclaration ||
              candidate.Kind === TstsSyntax.KindInterfaceDeclaration)
        )
    : undefined;
  const interfaceCallSignature = declaration
    ? singleInterfaceCallSignature(declaration)
    : undefined;
  const declarationSourceFile = declaration
    ? sourceFileForNode(declaration, sourceFile)
    : sourceFile;
  const substitutions = declaration
    ? aliasTypeSubstitutions(
        typeParameterNames(declarationSourceFile, declaration),
        checkerTypeArgumentPlans(context, sourceFile, type)
      )
    : new Map<string, LoweringTypeRefPlan>();
  if (declaration && interfaceCallSignature) {
    const aliasKey = sourceTypeAliasKey(context, sourceFile, declaration, symbol);
    if (state.aliasKeys.has(aliasKey)) {
      return undefined;
    }
    state.aliasKeys.add(aliasKey);
    try {
      return substituteTypePlan(
        interfaceCallSignatureTypePlan(
          context,
          sourceFileForNode(interfaceCallSignature, sourceFile),
          interfaceCallSignature,
          state
        ),
        substitutions
      );
    } finally {
      state.aliasKeys.delete(aliasKey);
    }
  }
  const targetType = declaration
    ? TstsSyntax.Node_Type(declaration)
    : undefined;
  if (!declaration || !targetType || state.aliasTargets.has(targetType)) {
    return undefined;
  }
  const aliasKey = sourceTypeAliasKey(context, sourceFile, declaration, symbol);
  if (state.aliasKeys.has(aliasKey)) {
    return undefined;
  }
  state.aliasTargets.add(targetType);
  state.aliasKeys.add(aliasKey);
  try {
    return substituteTypePlan(
      sourceTypePlan(
        context,
        sourceFileForNode(targetType, sourceFile),
        targetType,
        state
      ),
      substitutions
    );
  } finally {
    state.aliasTargets.delete(targetType);
    state.aliasKeys.delete(aliasKey);
  }
};

const sourceTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  state: SourceTypePlanState = createSourceTypePlanState()
): LoweringTypeRefPlan | undefined => {
  if (!node) return undefined;
  const sourceText = compactNodeSourceText(sourceFile, node);

  const numericPrimitive = context.input.facts.get(
    numericPrimitiveFactKey,
    node
  );
  if (numericPrimitive) {
    return {
      kind: "source-primitive",
      fact: numericPrimitive,
      sourceText,
    };
  }

  const typeReference = getTstsTypeReferenceDetails(node);
  if (typeReference) {
    const checker = context.checkerForSourceFile(sourceFile);
    const sourceType = checker.getTypeFromTypeNode(node);
    const aliasTarget = sourceTypeAliasTargetPlan(
      context,
      sourceFile,
      node,
      state
    );
    const typeName =
      aliasTarget === undefined
        ? (checker.getTypeSymbolName(sourceType) ?? typeReference.name)
        : typeReference.name;
    const typeNodeSymbol = checker.getSymbolAtLocation(node);
    const resolvedTypeNodeSymbol = typeNodeSymbol
      ? checker.resolveAlias(typeNodeSymbol)
      : undefined;
    const runtimeName =
      runtimeNameForSourceBindingNode(context, node, "type") ??
      runtimeNameForType(context, sourceFile, sourceType, typeName) ??
      runtimeNameForSymbol(
        context,
        sourceFile,
        resolvedTypeNodeSymbol,
        typeName
      );
    const declaration = typeDeclarationBindingForNode(context, sourceFile, node);
    return {
      kind: "named",
      name: typeName,
      typeArguments: typeReference.typeArguments
        .map((argument) => sourceTypePlan(context, sourceFile, argument, state))
        .filter(
          (argument): argument is LoweringTypeRefPlan => argument !== undefined
        ),
      aliasTarget,
      runtimeName,
      declaration,
      declarationKind: namedDeclarationKindForType(
        context,
        sourceFile,
        sourceType
      ),
      sourceText,
    };
  }

  switch (node.Kind) {
    case TstsSyntax.KindArrayType: {
      const arrayType = TstsSyntax.AsArrayTypeNode(node);
      const element = sourceTypePlan(
        context,
        sourceFile,
        arrayType?.ElementType,
        state
      );
      return element
        ? {
            kind: "array",
            elementType: element,
            readonly: false,
            sourceText,
          }
        : unsupportedTypePlan(sourceFile, node);
    }
    case TstsSyntax.KindTupleType: {
      const tupleType = TstsSyntax.AsTupleTypeNode(node);
      return {
        kind: "tuple",
        elements: nodeListNodes(tupleType?.Elements)
          .map((element) => sourceTypePlan(context, sourceFile, element, state))
          .filter(
            (element): element is LoweringTypeRefPlan => element !== undefined
          ),
        readonly: false,
        sourceText,
      };
    }
    case TstsSyntax.KindUnionType: {
      const unionType = TstsSyntax.AsUnionTypeNode(node);
      return {
        kind: "union",
        types: nodeListNodes(unionType?.Types)
          .map((part) => sourceTypePlan(context, sourceFile, part, state))
          .filter((part): part is LoweringTypeRefPlan => part !== undefined),
        sourceText,
      };
    }
    case TstsSyntax.KindIntersectionType: {
      const intersectionType = TstsSyntax.AsIntersectionTypeNode(node);
      return {
        kind: "intersection",
        types: nodeListNodes(intersectionType?.Types)
          .map((part) => sourceTypePlan(context, sourceFile, part, state))
          .filter((part): part is LoweringTypeRefPlan => part !== undefined),
        sourceText,
      };
    }
    case TstsSyntax.KindParenthesizedType: {
      const parenthesized = TstsSyntax.AsParenthesizedTypeNode(node);
      return (
        sourceTypePlan(context, sourceFile, parenthesized?.Type, state) ??
        unsupportedTypePlan(sourceFile, node)
      );
    }
    case TstsSyntax.KindTypeOperator: {
      const typeOperator = TstsSyntax.AsTypeOperatorNode(node);
      const inner = sourceTypePlan(
        context,
        sourceFile,
        typeOperator?.Type,
        state
      );
      if (!inner) return unsupportedTypePlan(sourceFile, node);
      if (typeOperator?.Operator !== TstsSyntax.KindReadonlyKeyword)
        return inner;
      if (inner.kind === "array") {
        return { ...inner, readonly: true, sourceText };
      }
      if (inner.kind === "tuple") {
        return { ...inner, readonly: true, sourceText };
      }
      return inner;
    }
    case TstsSyntax.KindExpressionWithTypeArguments: {
      const name = getTstsExpressionWithTypeArgumentsName(node);
      return name
        ? {
            kind: "named",
            name,
            typeArguments: nodeArrayNodes(TstsSyntax.Node_TypeArguments(node))
              .map((argument) =>
                sourceTypePlan(context, sourceFile, argument, state)
              )
              .filter(
                (argument): argument is LoweringTypeRefPlan =>
                  argument !== undefined
              ),
            runtimeName: runtimeNameForSourceBindingNode(
              context,
              node,
              "type"
            ),
            declaration: typeDeclarationBindingForNode(context, sourceFile, node),
            sourceText,
          }
        : unsupportedTypePlan(sourceFile, node);
    }
    case TstsSyntax.KindFunctionType:
    case TstsSyntax.KindConstructorType:
      return {
        kind: "function",
        parameters: parameterPlans(sourceFile, node, context, [], state),
        returnType: sourceTypePlan(
          context,
          sourceFile,
          TstsSyntax.Node_Type(node),
          state
        ),
        typeParameters: typeParameterNames(sourceFile, node),
        sourceText,
      };
    case TstsSyntax.KindTypeLiteral:
      return {
        kind: "object",
        members: (TstsSyntax.Node_Members(node) ?? [])
          .filter((member): member is TstsNode => member !== undefined)
          .map((member) => typeMemberPlan(sourceFile, member, context, state))
          .filter(
            (member): member is LoweringTypeMemberPlan => member !== undefined
          ),
        sourceText,
      };
    case TstsSyntax.KindTypePredicate:
      return {
        kind: "predicate",
        assertedType: sourceTypePlan(
          context,
          sourceFile,
          TstsSyntax.Node_Type(node),
          state
        ),
        sourceText,
      };
    case TstsSyntax.KindLiteralType: {
      const literal = TstsSyntax.AsLiteralTypeNode(node)?.Literal;
      if (!literal) return unsupportedTypePlan(sourceFile, node);
      switch (literal.Kind) {
        case TstsSyntax.KindStringLiteral:
        case TstsSyntax.KindNoSubstitutionTemplateLiteral: {
          const valueText = nodeLiteralText(literal);
          if (valueText === undefined)
            return unsupportedTypePlan(sourceFile, node);
          return {
            kind: "literal",
            literalKind: "string",
            valueText,
            sourceText,
          };
        }
        case TstsSyntax.KindNumericLiteral: {
          const valueText = nodeLiteralText(literal);
          if (valueText === undefined)
            return unsupportedTypePlan(sourceFile, node);
          return {
            kind: "literal",
            literalKind: "number",
            valueText,
            sourceText,
          };
        }
        case TstsSyntax.KindBigIntLiteral: {
          const valueText = nodeLiteralText(literal);
          if (valueText === undefined)
            return unsupportedTypePlan(sourceFile, node);
          return {
            kind: "literal",
            literalKind: "bigint",
            valueText,
            sourceText,
          };
        }
        case TstsSyntax.KindTrueKeyword:
        case TstsSyntax.KindFalseKeyword:
          return {
            kind: "literal",
            literalKind: "boolean",
            valueText:
              literal.Kind === TstsSyntax.KindTrueKeyword ? "true" : "false",
            sourceText,
          };
        case TstsSyntax.KindNullKeyword:
          return {
            kind: "literal",
            literalKind: "null",
            valueText: "null",
            sourceText,
          };
        default:
          return unsupportedTypePlan(sourceFile, node);
      }
    }
    case TstsSyntax.KindVoidKeyword:
      return intrinsicTypePlan("void", sourceText);
    case TstsSyntax.KindStringKeyword:
      return intrinsicTypePlan("string", sourceText);
    case TstsSyntax.KindNumberKeyword:
      return intrinsicTypePlan("number", sourceText);
    case TstsSyntax.KindBooleanKeyword:
      return intrinsicTypePlan("boolean", sourceText);
    case TstsSyntax.KindBigIntKeyword:
      return intrinsicTypePlan("bigint", sourceText);
    case TstsSyntax.KindSymbolKeyword:
      return intrinsicTypePlan("symbol", sourceText);
    case TstsSyntax.KindObjectKeyword:
      return intrinsicTypePlan("object", sourceText);
    case TstsSyntax.KindUndefinedKeyword:
      return intrinsicTypePlan("undefined", sourceText);
    case TstsSyntax.KindAnyKeyword:
      return intrinsicTypePlan("any", sourceText);
    case TstsSyntax.KindUnknownKeyword:
      return intrinsicTypePlan("unknown", sourceText);
    case TstsSyntax.KindNeverKeyword:
      return intrinsicTypePlan("never", sourceText);
    case TstsSyntax.KindThisType:
      return intrinsicTypePlan("this", sourceText);
    default:
      return unsupportedTypePlan(sourceFile, node);
  }
};

const typeMemberPlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext,
  state: SourceTypePlanState = createSourceTypePlanState()
): LoweringTypeMemberPlan | undefined => {
  if (node.Kind === TstsSyntax.KindIndexSignature) {
    const [parameter] = parameterPlans(sourceFile, node, context, [], state);
    return {
      kind: "index-signature",
      keyType: parameter?.type,
      valueType: sourceTypePlan(
        context,
        sourceFile,
        TstsSyntax.Node_Type(node),
        state
      ),
    };
  }

  const name = propertyNameInfo(sourceFile, node, context);
  if (name.computed || !name.name) return undefined;
  switch (node.Kind) {
    case TstsSyntax.KindPropertySignature:
    case TstsSyntax.KindPropertyDeclaration:
      return {
        kind: "property",
        name: name.name,
        optional: TstsSyntax.Node_QuestionToken(node) !== undefined,
        type: sourceTypePlan(
          context,
          sourceFile,
          TstsSyntax.Node_Type(node),
          state
        ),
      };
    case TstsSyntax.KindMethodSignature:
    case TstsSyntax.KindMethodDeclaration:
      return {
        kind: "method",
        name: name.name,
        optional: TstsSyntax.Node_QuestionToken(node) !== undefined,
        parameters: parameterPlans(sourceFile, node, context, [], state),
        returnType: sourceTypePlan(
          context,
          sourceFile,
          TstsSyntax.Node_Type(node),
          state
        ),
        typeParameters: typeParameterNames(sourceFile, node),
      };
    default:
      return undefined;
  }
};

const functionTypeParts = (
  type: LoweringTypeRefPlan | undefined
):
  | {
      readonly parameterTypes: readonly (LoweringTypeRefPlan | undefined)[];
      readonly returnType?: LoweringTypeRefPlan;
    }
  | undefined => {
  if (type?.kind === "named" && type.aliasTarget) {
    return functionTypeParts(type.aliasTarget);
  }
  if (type?.kind !== "function") return undefined;
  return {
    parameterTypes: type.parameters.map((parameter) => parameter.type),
    returnType: type.returnType,
  };
};

const callExpectedArgumentTypes = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): readonly (LoweringTypeRefPlan | undefined)[] => {
  const checker = context.checkerForSourceFile(sourceFile);
  const selected = checker.getResolvedSignature(node);
  if (!selected) return [];
  return checker.getSignatureParameters(selected).map((parameter) => {
    const declaration =
      checker.getSymbolValueDeclaration(parameter) ??
      checker.getSymbolDeclarations(parameter)[0];
    const typeNode = declaration
      ? TstsSyntax.Node_Type(declaration)
      : undefined;
    if (typeNode) {
      return sourceTypePlan(
        context,
        sourceFileForNode(typeNode, sourceFile),
        typeNode
      );
    }
    const parameterType = declaration
      ? checker.getTypeOfSymbolAtLocation(parameter, declaration)
      : undefined;
    return checkerTypePlan(context, sourceFile, parameterType);
  });
};

const declarationSourceTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  declaration: TstsNode | undefined
): LoweringTypeRefPlan | undefined => {
  const typeNode = declaration ? TstsSyntax.Node_Type(declaration) : undefined;
  return typeNode
    ? sourceTypePlan(context, sourceFileForNode(typeNode, sourceFile), typeNode)
    : undefined;
};

const isFunctionLikeDeclaration = (node: TstsNode | undefined): boolean =>
  node?.Kind === TstsSyntax.KindFunctionDeclaration ||
  node?.Kind === TstsSyntax.KindMethodDeclaration ||
  node?.Kind === TstsSyntax.KindConstructor ||
  node?.Kind === TstsSyntax.KindGetAccessor ||
  node?.Kind === TstsSyntax.KindSetAccessor ||
  node?.Kind === TstsSyntax.KindArrowFunction ||
  node?.Kind === TstsSyntax.KindFunctionExpression;

const symbolDeclarationSourceTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  symbol: TstsSymbol | undefined
): LoweringTypeRefPlan | undefined => {
  if (!symbol) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const declaration =
    checker.getSymbolValueDeclaration(symbol) ??
    checker.getSymbolDeclarations(symbol)[0];
  if (isFunctionLikeDeclaration(declaration)) {
    return checkerTypePlan(
      context,
      sourceFileForNode(declaration, sourceFile),
      checker.getTypeOfSymbolAtLocation(symbol, declaration)
    );
  }
  return declarationSourceTypePlan(context, sourceFile, declaration);
};

const storageSymbol = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  symbol: TstsSymbol
): TstsSymbol => {
  const checker = context.checkerForSourceFile(sourceFile);
  return checker.resolveAlias(symbol) ?? symbol;
};

const getStoredSymbolType = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  symbol: TstsSymbol | undefined
): LoweringTypeRefPlan | undefined => {
  if (!symbol) return undefined;
  return (
    context.symbolStorageTypes.get(symbol) ??
    context.symbolStorageTypes.get(storageSymbol(context, sourceFile, symbol))
  );
};

const setStoredSymbolType = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  symbol: TstsSymbol | undefined,
  type: LoweringTypeRefPlan | undefined
): void => {
  if (!symbol || !type) return;
  context.symbolStorageTypes.set(symbol, type);
  context.symbolStorageTypes.set(storageSymbol(context, sourceFile, symbol), type);
};

const symbolStorageTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  symbol: TstsSymbol | undefined
): LoweringTypeRefPlan | undefined => {
  if (!symbol) return undefined;
  const stored = getStoredSymbolType(context, sourceFile, symbol);
  if (stored) return stored;
  const checker = context.checkerForSourceFile(sourceFile);
  const storageKey = storageSymbol(context, sourceFile, symbol);
  if (context.resolvingStorageSymbols.has(storageKey)) return undefined;
  context.resolvingStorageSymbols.add(storageKey);
  try {
  const declaration =
    checker.getSymbolValueDeclaration(symbol) ??
    checker.getSymbolDeclarations(symbol)[0];
  if (!declaration) return undefined;
  const declarationSourceFile = sourceFileForNode(declaration, sourceFile);
  const variable = TstsSyntax.AsVariableDeclaration(declaration);
  const initializerStorage = sourceRuntimeExpressionStorageTypePlan(
    context,
    declarationSourceFile,
    variable?.Initializer
  );
  const initializerCheckerType = variable?.Initializer
    ? checkerTypePlan(
        context,
        declarationSourceFile,
        checker.getNarrowedTypeAtLocation(variable.Initializer)
      )
    : undefined;
  if (isFunctionLikeDeclaration(declaration)) {
    const functionType = checkerTypePlan(
      context,
      declarationSourceFile,
      checker.getTypeOfSymbolAtLocation(symbol, declaration)
    );
    setStoredSymbolType(context, sourceFile, symbol, functionType);
    return functionType;
  }
  const storageType =
    declarationSourceTypePlan(context, declarationSourceFile, declaration) ??
    initializerStorage ??
    (variable?.Initializer
      ? expressionSourceTypePlan(declarationSourceFile, variable.Initializer, context)
      : undefined) ??
    initializerCheckerType ??
    checkerTypePlan(
      context,
      declarationSourceFile,
      checker.getTypeOfSymbolAtLocation(symbol, declaration)
    );
  setStoredSymbolType(context, sourceFile, symbol, storageType);
  return storageType;
  } finally {
    context.resolvingStorageSymbols.delete(storageKey);
  }
};

const signatureReturnSourceTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  signature: TstsSignature | undefined
): LoweringTypeRefPlan | undefined => {
  if (!signature) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  return declarationSourceTypePlan(
    context,
    sourceFile,
    checker.getSignatureDeclaration(signature)
  );
};

const signatureTargetSourceTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  signature: TstsSignature | undefined
): LoweringTypeRefPlan | undefined => {
  if (!signature) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const declaration = checker.getSignatureDeclaration(signature);
  for (
    let owner = declaration?.Parent;
    owner !== undefined;
    owner = owner.Parent
  ) {
    if (
      owner.Kind === TstsSyntax.KindInterfaceDeclaration ||
      owner.Kind === TstsSyntax.KindTypeAliasDeclaration
    ) {
      const ownerSourceFile = sourceFileForNode(owner, sourceFile);
      const ownerChecker = context.checkerForSourceFile(ownerSourceFile);
      return checkerTypePlan(
        context,
        ownerSourceFile,
        ownerChecker.getTypeAtLocation(owner)
      );
    }
  }
  return declarationSourceTypePlan(context, sourceFile, declaration);
};

const expressionSourceTypePlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): LoweringTypeRefPlan | undefined => {
  const checker = context.checkerForSourceFile(sourceFile);
  const sourceOperation = context.input.facts.get(
    sourceRuntimeOperationFactKey,
    node
  );
  if (sourceOperation?.dispatch === "property") {
    if (
      (sourceOperation.owner === "Array" ||
        sourceOperation.owner === "Function" ||
        sourceOperation.owner === "Uint8Array" ||
        sourceOperation.owner === "Uint8ClampedArray" ||
        sourceOperation.owner === "Int8Array" ||
        sourceOperation.owner === "Uint16Array" ||
        sourceOperation.owner === "Int16Array" ||
        sourceOperation.owner === "Uint32Array" ||
        sourceOperation.owner === "Int32Array" ||
        sourceOperation.owner === "Float32Array" ||
        sourceOperation.owner === "Float64Array") &&
      sourceOperation.member === "length"
    ) {
      return intrinsicTypePlan("number");
    }
    if (
      sourceOperation.owner === "String" &&
      sourceOperation.member === "length"
    ) {
      return intrinsicTypePlan("number");
    }
    if (
      sourceOperation.owner === "Object" &&
      sourceOperation.member === "length"
    ) {
      return intrinsicTypePlan("number");
    }
    if (
      sourceOperation.owner === "Error" &&
      sourceOperation.member === "message"
    ) {
      return intrinsicTypePlan("string");
    }
  }

  const explicitType = declarationSourceTypePlan(context, sourceFile, node);
  if (explicitType) return explicitType;

  switch (node.Kind) {
    case TstsSyntax.KindIdentifier:
      return symbolDeclarationSourceTypePlan(
        context,
        sourceFile,
        checker.getSymbolAtLocation(node)
      );
    case TstsSyntax.KindPropertyAccessExpression: {
      const name = TstsSyntax.Node_Name(node);
      return symbolDeclarationSourceTypePlan(
        context,
        sourceFile,
        name
          ? checker.getSymbolAtLocation(name)
          : checker.getSymbolAtLocation(node)
      );
    }
    case TstsSyntax.KindElementAccessExpression:
      return checkerTypePlan(
        context,
        sourceFile,
        checker.getNarrowedTypeAtLocation(node) ?? checker.getTypeAtLocation(node)
      );
    case TstsSyntax.KindCallExpression:
    case TstsSyntax.KindNewExpression:
      return (
        signatureReturnSourceTypePlan(
          context,
          sourceFile,
          checker.getResolvedSignature(node)
        ) ??
        checkerTypePlan(
          context,
          sourceFile,
          checker.getNarrowedTypeAtLocation(node)
        )
      );
    default:
      return undefined;
  }
};

const expressionTypePlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext,
  useSiteType: TstsType | undefined
): LoweringTypeRefPlan | undefined =>
  expressionSourceTypePlan(sourceFile, node, context) ??
  checkerTypePlan(context, sourceFile, useSiteType);

const loweringNonNullishUnionTypes = (
  type: LoweringTypeRefPlan
): readonly LoweringTypeRefPlan[] =>
  type.kind === "union"
    ? type.types.filter(
        (member) =>
          !(
            (member.kind === "intrinsic" &&
              (member.name === "undefined" || member.name === "null")) ||
            (member.kind === "literal" &&
              (member.literalKind === "undefined" ||
                member.literalKind === "null"))
          )
      )
    : [type];

const loweringUnwrapAliasTarget = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined =>
  type?.kind === "named" && type.aliasTarget
    ? loweringUnwrapAliasTarget(type.aliasTarget)
    : type;

const runtimeNameKey = (
  runtimeName: LoweringRuntimeNamePlan | undefined
): string | undefined =>
  runtimeName
    ? [
        runtimeName.namespace,
        runtimeName.container,
        runtimeName.name,
      ]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(".")
    : undefined;

const loweringTypeIdentityKey = (type: LoweringTypeRefPlan): string => {
  switch (type.kind) {
    case "intrinsic":
      return `intrinsic:${type.name}`;
    case "source-primitive":
      return `source-primitive:${type.fact.kind}:${type.fact.sourceName}`;
    case "named":
      return `named:${runtimeNameKey(type.runtimeName) ?? type.name}<${type.typeArguments.map(loweringTypeIdentityKey).join(",")}>`;
    case "array":
      return `array:${type.storage ?? (type.readonly ? "readonly" : "mutable")}:${loweringTypeIdentityKey(type.elementType)}`;
    case "tuple":
      return `tuple:${type.elements.map(loweringTypeIdentityKey).join(",")}`;
    case "union":
      return `union:${type.types.map(loweringTypeIdentityKey).join("|")}`;
    case "intersection":
      return `intersection:${type.types.map(loweringTypeIdentityKey).join("&")}`;
    default:
      return type.sourceText ?? type.kind;
  }
};

const loweringRecordValueType = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined => {
  if (type?.kind === "named" && type.name === "Record") {
    return type.typeArguments[1];
  }
  const unwrapped = loweringUnwrapAliasTarget(type);
  if (!unwrapped) return undefined;
  if (unwrapped.kind === "named" && unwrapped.name === "Record") {
    return unwrapped.typeArguments[1];
  }
  if (unwrapped.kind === "union") {
    const values = loweringNonNullishUnionTypes(unwrapped)
      .map((member) => loweringRecordValueType(member))
      .filter((value): value is LoweringTypeRefPlan => value !== undefined);
    const firstKey = values[0] ? loweringTypeIdentityKey(values[0]) : undefined;
    return firstKey &&
      values.every((value) => loweringTypeIdentityKey(value) === firstKey)
      ? values[0]
      : undefined;
  }
  return undefined;
};

const nullableTypePlan = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined =>
  type
    ? {
        kind: "union",
        types: [type, intrinsicTypePlan("undefined")],
      }
    : undefined;

const objectEntriesEntryArrayTypePlan = (
  valueType: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan => ({
  kind: "tuple",
  readonly: false,
  elements: [intrinsicTypePlan("string"), valueType ?? intrinsicTypePlan("object")],
});

const objectLiteralStorageTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode
): LoweringTypeRefPlan | undefined => {
  if (node.Kind !== TstsSyntax.KindObjectLiteralExpression) return undefined;
  const members = (TstsSyntax.Node_Properties(node) ?? []).map(
    (property): LoweringTypeMemberPlan | undefined => {
      if (!property) return undefined;
      if (
        property.Kind !== TstsSyntax.KindPropertyAssignment &&
        property.Kind !== TstsSyntax.KindShorthandPropertyAssignment
      ) {
        return undefined;
      }
      const name = propertyNameInfo(sourceFile, property, context);
      if (name.computed || !name.name) return undefined;
      const valueNode =
        property.Kind === TstsSyntax.KindShorthandPropertyAssignment
          ? TstsSyntax.Node_Name(property)
          : TstsSyntax.Node_Initializer(property);
      const checker = context.checkerForSourceFile(sourceFile);
      return {
        kind: "property",
        name: name.name,
        optional: false,
        type:
          sourceRuntimeExpressionStorageTypePlan(context, sourceFile, valueNode) ??
          (valueNode
            ? expressionTypePlan(
                sourceFile,
                valueNode,
                context,
                checker.getNarrowedTypeAtLocation(valueNode)
              )
            : undefined) ??
          intrinsicTypePlan("unknown"),
      };
    }
  );
  if (members.some((member) => member === undefined)) return undefined;
  return { kind: "object", members: members as readonly LoweringTypeMemberPlan[] };
};

const sourceRuntimeExpressionStorageTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): LoweringTypeRefPlan | undefined => {
  if (!node) return undefined;
  if (node.Kind === TstsSyntax.KindIdentifier) {
    const checker = context.checkerForSourceFile(sourceFile);
    return symbolStorageTypePlan(
      context,
      sourceFile,
      checker.getSymbolAtLocation(node)
    );
  }
  if (node.Kind === TstsSyntax.KindObjectLiteralExpression) {
    return objectLiteralStorageTypePlan(context, sourceFile, node);
  }
  if (node.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const checker = context.checkerForSourceFile(sourceFile);
    const name = TstsSyntax.Node_Name(node);
    return (
      propertyAccessStorageTypePlan(
        context,
        sourceFile,
        node,
        TstsSyntax.Node_Expression(node)
      ) ??
      symbolStorageTypePlan(
        context,
        sourceFile,
        name ? checker.getSymbolAtLocation(name) : checker.getSymbolAtLocation(node)
      )
    );
  }
  if (
    node.Kind === TstsSyntax.KindAsExpression ||
    node.Kind === TstsSyntax.KindSatisfiesExpression ||
    node.Kind === TstsSyntax.KindTypeAssertionExpression ||
    node.Kind === TstsSyntax.KindNonNullExpression
  ) {
    return (
      sourceTypePlan(context, sourceFile, TstsSyntax.Node_Type(node)) ??
      sourceRuntimeExpressionStorageTypePlan(
        context,
        sourceFile,
        TstsSyntax.Node_Expression(node)
      )
    );
  }
  if (node.Kind === TstsSyntax.KindCallExpression) {
    const callee = TstsSyntax.Node_Expression(node);
    const operation = callee
      ? context.input.facts.get(sourceRuntimeOperationFactKey, callee)
      : undefined;
    const calleeStorage = sourceRuntimeExpressionStorageTypePlan(
      context,
      sourceFile,
      callee
    );
    if (calleeStorage?.kind === "function") {
      return calleeStorage.returnType;
    }
    if (
      operation?.dispatch === "static-call" &&
      operation.owner === "Object" &&
      operation.member === "entries"
    ) {
      const argument = TstsSyntax.Node_Arguments(node)?.[0];
      const argumentType = argument
        ? expressionTypePlan(
            sourceFile,
            argument,
            context,
            context.checkerForSourceFile(sourceFile).getNarrowedTypeAtLocation(argument)
          )
        : undefined;
      return {
        kind: "array",
        readonly: false,
        elementType: objectEntriesEntryArrayTypePlan(
          loweringRecordValueType(argumentType)
        ),
      };
    }
    return expressionSourceTypePlan(sourceFile, node, context);
  }
  if (node.Kind === TstsSyntax.KindElementAccessExpression) {
    const element = TstsSyntax.AsElementAccessExpression(node);
    const receiverStorage = sourceRuntimeExpressionStorageTypePlan(
      context,
      sourceFile,
      element?.Expression
    );
    if (receiverStorage?.kind === "array") {
      return receiverStorage.elementType.kind === "tuple"
        ? nullableTypePlan(receiverStorage.elementType)
        : receiverStorage.elementType;
    }
    const recordElement = loweringRecordValueType(receiverStorage);
    if (recordElement) return recordElement;
    if (receiverStorage?.kind === "tuple") return receiverStorage.elements[0];
  }
  if (node.Kind === TstsSyntax.KindConditionalExpression) {
    const condition = TstsSyntax.AsConditionalExpression(node);
    const whenTrue = sourceRuntimeExpressionStorageTypePlan(
      context,
      sourceFile,
      condition?.WhenTrue
    );
    const whenFalse = sourceRuntimeExpressionStorageTypePlan(
      context,
      sourceFile,
      condition?.WhenFalse
    );
    if (
      whenTrue &&
      whenFalse &&
      loweringTypeIdentityKey(whenTrue) === loweringTypeIdentityKey(whenFalse)
    ) {
      return whenTrue;
    }
    if (whenTrue && isBroadLoweringTypePlan(whenFalse)) return whenTrue;
    if (whenFalse && isBroadLoweringTypePlan(whenTrue)) return whenFalse;
  }
  return undefined;
};

const objectMemberExpectedType = (
  type: LoweringTypeRefPlan | undefined,
  propertyName: string | undefined
): LoweringTypeRefPlan | undefined => {
  if (type?.kind === "named" && type.aliasTarget) {
    return objectMemberExpectedType(type.aliasTarget, propertyName);
  }
  if (!propertyName || type?.kind !== "object") return undefined;
  const member = type.members.find(
    (candidate) =>
      candidate.kind === "property" && candidate.name === propertyName
  );
  return member?.kind === "property" ? member.type : undefined;
};

const expectedArrayElementType = (
  type: LoweringTypeRefPlan | undefined,
  index: number
): LoweringTypeRefPlan | undefined => {
  if (type?.kind === "named" && type.aliasTarget) {
    return expectedArrayElementType(type.aliasTarget, index);
  }
  if (type?.kind === "array") return type.elementType;
  if (type?.kind === "tuple") return type.elements[index];
  return undefined;
};

const expectedArraySpreadType = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined =>
  type?.kind === "named" && type.aliasTarget
    ? expectedArraySpreadType(type.aliasTarget)
    : type?.kind === "array" || type?.kind === "tuple"
      ? type
      : undefined;

const arrayElementTypeFromPlan = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined => {
  if (type?.kind === "named" && type.aliasTarget) {
    return arrayElementTypeFromPlan(type.aliasTarget);
  }
  if (type?.kind === "array") return type.elementType;
  if (type?.kind === "union") {
    const elementTypes = type.types
      .map((member) => arrayElementTypeFromPlan(member))
      .filter((member): member is LoweringTypeRefPlan => member !== undefined);
    return elementTypes.length === 1 ? elementTypes[0] : undefined;
  }
  return undefined;
};

const arrayReceiverArgumentExpectedTypes = (
  callee: LoweringExpressionPlan | undefined
): readonly (LoweringTypeRefPlan | undefined)[] | undefined => {
  const operation = callee?.sourceOperation;
  if (
    callee?.expressionKind !== "property-access" ||
    operation?.owner !== "Array" ||
    operation.dispatch !== "receiver-call"
  ) {
    return undefined;
  }
  const elementType =
    arrayElementTypeFromPlan(callee.expression?.type) ??
    arrayElementTypeFromPlan(callee.expression?.contextualTypePlan);
  if (!elementType) return undefined;
  switch (operation.member) {
    case "push":
    case "includes":
    case "indexOf":
    case "lastIndexOf":
      return [elementType];
    default:
      return undefined;
  }
};

const isSourcePrimitiveTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean => type?.kind === "source-primitive";

const binaryOperandExpectedType = (
  operator: LoweringBinaryOperator | undefined,
  operand: LoweringExpressionPlan | undefined
): LoweringTypeRefPlan | undefined => {
  if (!operand) return undefined;
  switch (operator) {
    case "assign":
    case "equal":
    case "strict-equal":
    case "not-equal":
    case "strict-not-equal":
      if (isSourcePrimitiveTypePlan(operand.type)) return operand.type;
      if (operand.type?.kind === "intrinsic") {
        return ["string", "number", "boolean", "bigint"].includes(
          operand.type.name
        )
          ? operand.type
          : undefined;
      }
      if (operand.type?.kind === "literal") {
        switch (operand.type.literalKind) {
          case "string":
            return intrinsicTypePlan("string");
          case "number":
            return intrinsicTypePlan("number");
          case "bigint":
            return intrinsicTypePlan("bigint");
          case "boolean":
            return intrinsicTypePlan("boolean");
          default:
            return undefined;
        }
      }
      return undefined;
    default:
      return undefined;
  }
};

const planBase = <TKind extends string>(
  kind: TKind,
  sourceFile: TstsSourceFile,
  sourceNode: TstsNode,
  context?: LoweringBuildContext
) => {
  const name = nodeNameInfo(sourceFile, sourceNode, context);
  return {
    kind,
    sourceFile,
    sourceNode,
    sourceKind: Number(sourceNode.Kind),
    sourceKindName: TstsSyntax.Node_KindString(sourceNode),
    sourceText: nodeSourceText(sourceFile, sourceNode),
    name: name.name,
    nameSourceKindName: name.sourceKindName,
    nameSourceText: name.sourceText,
    nameIsComputed: name.computed,
    computedName: name.computedName,
  };
};

const unsupportedExpression = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): LoweringExpressionPlan => {
  const checker = context.checkerForSourceFile(sourceFile);
  const useSiteType = checker.getNarrowedTypeAtLocation(node);
  const contextualType = checker.getContextualType(node);
  return {
    ...planBase("expression", sourceFile, node, context),
    expressionKind: "unsupported",
    type: expressionTypePlan(sourceFile, node, context, useSiteType),
    contextualTypePlan: checkerTypePlan(context, sourceFile, contextualType),
    arguments: [],
    typeArguments: [],
    elements: [],
    properties: [],
    templateParts: [],
    parameters: [],
    useSiteType,
    contextualType,
    symbol: checker.getSymbolAtLocation(node),
  };
};

const functionReturnType = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): TstsType | undefined => {
  const checker = context.checkerForSourceFile(sourceFile);
  const signature = checker.getSignatureFromDeclaration(node);
  return signature ? checker.getReturnTypeOfSignature(signature) : undefined;
};

const isCompileTimeMarkerApiExpression = (
  node: TstsNode | undefined,
  context: LoweringBuildContext
): boolean => {
  if (!node) return false;
  if (
    context.input.facts.get(markerApiSemanticsFactKey, node)?.kind ===
    "overloads"
  ) {
    return true;
  }
  switch (node.Kind) {
    case TstsSyntax.KindCallExpression:
    case TstsSyntax.KindNewExpression:
    case TstsSyntax.KindPropertyAccessExpression:
      return isCompileTimeMarkerApiExpression(
        TstsSyntax.Node_Expression(node),
        context
      );
    case TstsSyntax.KindParenthesizedExpression:
      return isCompileTimeMarkerApiExpression(
        TstsSyntax.Node_Expression(node),
        context
      );
    default:
      return false;
  }
};

const expressionSemantic = (
  node: TstsNode,
  context: LoweringBuildContext
): "undefined-value" | "compile-time-marker-call" | undefined => {
  if (isCompileTimeMarkerApiExpression(node, context)) {
    return "compile-time-marker-call";
  }
  return context.input.facts.get(expressionSemanticsFactKey, node)?.kind;
};

const receiverOwnerTypePlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): LoweringTypeRefPlan | undefined => {
  if (node.Kind !== TstsSyntax.KindPropertyAccessExpression) return undefined;
  const name = TstsSyntax.Node_Name(node);
  const checker = context.checkerForSourceFile(sourceFile);
  const symbol = name ? checker.getSymbolAtLocation(name) : undefined;
  const declaration =
    symbol !== undefined
      ? (checker.getSymbolValueDeclaration(symbol) ??
        checker.getSymbolDeclarations(symbol)[0])
      : undefined;
  const owner = declaration?.Parent;
  if (
    owner?.Kind !== TstsSyntax.KindClassDeclaration &&
    owner?.Kind !== TstsSyntax.KindInterfaceDeclaration
  ) {
    return undefined;
  }
  const ownerSourceFile = sourceFileForNode(owner, sourceFile);
  const ownerChecker = context.checkerForSourceFile(ownerSourceFile);
  return checkerTypePlan(
    context,
    ownerSourceFile,
    ownerChecker.getTypeAtLocation(owner)
  );
};

const isClassOrInterfaceDeclaration = (
  node: TstsNode | undefined
): node is TstsNode =>
  node?.Kind === TstsSyntax.KindClassDeclaration ||
  node?.Kind === TstsSyntax.KindInterfaceDeclaration;

const classOrInterfaceDeclarationForType = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  type: TstsType | undefined
): TstsNode | undefined => {
  if (!type) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const symbol = checker.getTypeAliasOrSymbol(type);
  return symbol
    ? checker.getSymbolDeclarations(symbol).find(isClassOrInterfaceDeclaration)
    : undefined;
};

const typeSubstitutionsFromDeclarationToOwner = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  declaration: TstsNode,
  actualTypeArguments: readonly LoweringTypeRefPlan[],
  owner: TstsNode,
  seen: Set<TstsNode> = new Set<TstsNode>()
): TypeSubstitutionMap | undefined => {
  if (seen.has(declaration)) return undefined;
  seen.add(declaration);
  const declarationSourceFile = sourceFileForNode(declaration, sourceFile);
  const currentSubstitutions = aliasTypeSubstitutions(
    typeParameterNames(declarationSourceFile, declaration),
    actualTypeArguments
  );
  if (declaration === owner) {
    return currentSubstitutions;
  }
  const checker = context.checkerForSourceFile(declarationSourceFile);
  for (const heritage of getTstsHeritageTypeNodes(declaration)) {
    if (!heritage) continue;
    const heritageSourceFile = sourceFileForNode(heritage, declarationSourceFile);
    const heritageType = checker.getTypeFromTypeNode(heritage);
    const heritageDeclaration = classOrInterfaceDeclarationForType(
      context,
      heritageSourceFile,
      heritageType
    );
    if (!heritageDeclaration) continue;
    const rawHeritageArguments = sourceTypeArgumentPlans(
      context,
      heritageSourceFile,
      heritage,
      heritageType,
      createSourceTypePlanState()
    );
    const heritageArguments = rawHeritageArguments
      .map(
        (argument) =>
          substituteTypePlan(argument, currentSubstitutions) ?? argument
      )
      .filter(
        (argument): argument is LoweringTypeRefPlan => argument !== undefined
      );
    const found = typeSubstitutionsFromDeclarationToOwner(
      context,
      sourceFileForNode(heritageDeclaration, heritageSourceFile),
      heritageDeclaration,
      heritageArguments,
      owner,
      seen
    );
    if (found) return found;
  }
  return undefined;
};

const memberStorageTypeFromMemberPlan = (
  member: LoweringTypeMemberPlan | undefined
): LoweringTypeRefPlan | undefined => {
  if (!member) return undefined;
  switch (member.kind) {
    case "property":
      return member.type;
    case "method":
      return {
        kind: "function",
        parameters: member.parameters,
        returnType: member.returnType,
        typeParameters: member.typeParameters,
      };
    case "index-signature":
      return undefined;
  }
};

const memberStorageTypeFromDeclaration = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  declaration: TstsNode,
  typeArguments: readonly LoweringTypeRefPlan[],
  memberName: string
): LoweringTypeRefPlan | undefined => {
  if (!isClassOrInterfaceDeclaration(declaration)) return undefined;
  const declarationSourceFile = sourceFileForNode(declaration, sourceFile);
  const substitutions = aliasTypeSubstitutions(
    typeParameterNames(declarationSourceFile, declaration),
    typeArguments
  );
  const memberDeclaration = (TstsSyntax.Node_Members(declaration) ?? []).find(
    (member): member is TstsNode =>
      member !== undefined &&
      propertyNameInfo(declarationSourceFile, member, context).name === memberName
  );
  if (!memberDeclaration) return undefined;
  const memberPlan = typeMemberPlan(
    declarationSourceFile,
    memberDeclaration,
    context,
    createSourceTypePlanState()
  );
  return substituteTypePlan(
    memberStorageTypeFromMemberPlan(memberPlan),
    substitutions
  );
};

const memberStorageTypeFromTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  type: LoweringTypeRefPlan | undefined,
  memberName: string,
  seen: Set<string> = new Set<string>()
): LoweringTypeRefPlan | undefined => {
  if (!type) return undefined;
  const key = loweringTypeIdentityKey(type);
  if (seen.has(key)) return undefined;
  seen.add(key);
  switch (type.kind) {
    case "named": {
      const aliasMember = memberStorageTypeFromTypePlan(
        context,
        sourceFile,
        type.aliasTarget,
        memberName,
        seen
      );
      if (aliasMember) return aliasMember;
      return type.declaration
        ? memberStorageTypeFromDeclaration(
            context,
            type.declaration.sourceFile,
            type.declaration.sourceNode,
            type.typeArguments,
            memberName
          )
        : undefined;
    }
    case "intersection":
      for (const member of type.types) {
        const result = memberStorageTypeFromTypePlan(
          context,
          sourceFile,
          member,
          memberName,
          seen
        );
        if (result) return result;
      }
      return undefined;
    case "object": {
      const member = type.members.find(
        (candidate) =>
          (candidate.kind === "property" || candidate.kind === "method") &&
          candidate.name === memberName
      );
      return memberStorageTypeFromMemberPlan(member);
    }
    case "union": {
      const memberTypes = type.types
        .map((member) =>
          memberStorageTypeFromTypePlan(context, sourceFile, member, memberName, seen)
        )
        .filter((member): member is LoweringTypeRefPlan => member !== undefined);
      const firstKey = memberTypes[0]
        ? loweringTypeIdentityKey(memberTypes[0])
        : undefined;
      return firstKey &&
        memberTypes.every((member) => loweringTypeIdentityKey(member) === firstKey)
        ? memberTypes[0]
        : undefined;
    }
    default:
      return undefined;
  }
};

const propertyAccessStorageTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode,
  receiverNode: TstsNode | undefined
): LoweringTypeRefPlan | undefined => {
  if (node.Kind !== TstsSyntax.KindPropertyAccessExpression) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const name = TstsSyntax.Node_Name(node);
  const memberName = nodeTokenText(name);
  const receiverMemberStorage = memberName
    ? memberStorageTypeFromTypePlan(
        context,
        sourceFile,
        sourceRuntimeExpressionStorageTypePlan(context, sourceFile, receiverNode),
        memberName
      )
    : undefined;
  if (receiverMemberStorage) return receiverMemberStorage;
  const symbol = name ? checker.getSymbolAtLocation(name) : undefined;
  if (!symbol) return undefined;
  const declaration =
    checker.getSymbolValueDeclaration(symbol) ??
    checker.getSymbolDeclarations(symbol)[0];
  const owner = declaration?.Parent;
  if (!isClassOrInterfaceDeclaration(owner)) {
    return symbolStorageTypePlan(context, sourceFile, symbol);
  }
  const declaredType = declarationSourceTypePlan(
    context,
    sourceFileForNode(declaration, sourceFile),
    declaration
  );
  if (!declaredType) return undefined;
  const receiverType = receiverNode
    ? checker.getNarrowedTypeAtLocation(receiverNode) ??
      checker.getTypeAtLocation(receiverNode)
    : undefined;
  const receiverDeclaration = classOrInterfaceDeclarationForType(
    context,
    sourceFile,
    receiverType
  );
  if (!receiverDeclaration) return declaredType;
  const substitutions = typeSubstitutionsFromDeclarationToOwner(
    context,
    sourceFileForNode(receiverDeclaration, sourceFile),
    receiverDeclaration,
    checkerTypeArgumentPlans(context, sourceFile, receiverType),
    owner
  );
  return substituteTypePlan(declaredType, substitutions ?? new Map());
};

const isBroadLoweringTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type === undefined ||
  type.kind === "union" ||
  type.kind === "intersection" ||
  (type.kind === "intrinsic" &&
    (type.name === "any" || type.name === "unknown" || type.name === "object"));

const expressionPlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context: LoweringBuildContext,
  expectedType?: LoweringTypeRefPlan
): LoweringExpressionPlan | undefined => {
  if (!node) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const useSiteType = checker.getNarrowedTypeAtLocation(node);
  const contextualType = checker.getContextualType(node);
  const contextualTypePlan = checkerTypePlan(
    context,
    sourceFile,
    contextualType
  );
  const base = {
    ...planBase("expression", sourceFile, node, context),
    type: expressionTypePlan(sourceFile, node, context, useSiteType),
    contextualTypePlan: expectedType ?? contextualTypePlan,
    semantic: expressionSemantic(node, context),
    sourceOperation: context.input.facts.get(
      sourceRuntimeOperationFactKey,
      node
    ),
    resolvedAliasName: context.input.facts.get(
      genericFunctionAliasFactKey,
      node
    )?.resolvedName,
    runtimeName: runtimeNameForSourceBindingNode(context, node, "value"),
    intrinsicKind: context.input.facts.get(intrinsicSemanticsFactKey, node)
      ?.kind,
    passingMode: context.input.facts.get(parameterPassingFactKey, node)?.mode,
    arguments: [] as readonly LoweringExpressionPlan[],
    typeArguments: [] as readonly LoweringTypeRefPlan[],
    elements: [] as readonly LoweringExpressionPlan[],
    properties: [] as readonly LoweringObjectPropertyPlan[],
    templateParts: [] as readonly LoweringTemplatePartPlan[],
    parameters: [] as readonly LoweringParameterPlan[],
    useSiteType,
    contextualType,
    symbol: checker.getSymbolAtLocation(node),
  };

  switch (node.Kind) {
    case TstsSyntax.KindIdentifier:
      if (base.semantic === "undefined-value") {
        return {
          ...base,
          expressionKind: "literal",
          literalKind: "undefined",
          literalText: "undefined",
        };
      }
      return {
        ...base,
        expressionKind: "identifier",
        storageTypePlan: symbolStorageTypePlan(
          context,
          sourceFile,
          base.symbol
        ),
        literalText: nodeTokenText(node) ?? nodeName(sourceFile, node),
      };
    case TstsSyntax.KindThisKeyword:
      return { ...base, expressionKind: "this" };
    case TstsSyntax.KindSuperKeyword:
      return { ...base, expressionKind: "super" };
    case TstsSyntax.KindStringLiteral:
    case TstsSyntax.KindNoSubstitutionTemplateLiteral:
      return {
        ...base,
        expressionKind: "literal",
        literalKind: "string",
        literalText: nodeLiteralText(node),
      };
    case TstsSyntax.KindTemplateExpression: {
      const template = TstsSyntax.AsTemplateExpression(node);
      if (!template?.Head)
        return unsupportedExpression(sourceFile, node, context);
      const parts: LoweringTemplatePartPlan[] = [
        { text: templateFragmentText(sourceFile, template.Head) },
      ];
      for (const spanNode of nodeListNodes(template.TemplateSpans)) {
        const span = TstsSyntax.AsTemplateSpan(spanNode);
        if (!span?.Literal) continue;
        parts.push({
          text: templateFragmentText(sourceFile, span.Literal),
          expression: expressionPlan(sourceFile, span.Expression, context),
        });
      }
      return {
        ...base,
        expressionKind: "template",
        templateParts: parts,
      };
    }
    case TstsSyntax.KindNumericLiteral:
      return {
        ...base,
        expressionKind: "literal",
        literalKind: "number",
        literalText: nodeLiteralText(node),
      };
    case TstsSyntax.KindBigIntLiteral:
      return {
        ...base,
        expressionKind: "literal",
        literalKind: "bigint",
        literalText: nodeLiteralText(node),
      };
    case TstsSyntax.KindTrueKeyword:
      return {
        ...base,
        expressionKind: "literal",
        literalKind: "boolean",
        literalText: "true",
      };
    case TstsSyntax.KindFalseKeyword:
      return {
        ...base,
        expressionKind: "literal",
        literalKind: "boolean",
        literalText: "false",
      };
    case TstsSyntax.KindNullKeyword:
      return {
        ...base,
        expressionKind: "literal",
        literalKind: "null",
        literalText: "null",
      };
    case TstsSyntax.KindUndefinedKeyword:
      return {
        ...base,
        expressionKind: "literal",
        literalKind: "undefined",
        literalText: "undefined",
      };
    case TstsSyntax.KindParenthesizedExpression:
      return {
        ...base,
        expressionKind: "parenthesized",
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context,
          expectedType
        ),
      };
    case TstsSyntax.KindAsExpression:
    case TstsSyntax.KindSatisfiesExpression:
    case TstsSyntax.KindTypeAssertionExpression:
    case TstsSyntax.KindNonNullExpression: {
      const wrapperType = TstsSyntax.Node_Type(node);
      const assertedType = sourceTypePlan(context, sourceFile, wrapperType);
      return {
        ...base,
        type: assertedType ?? base.type,
        expressionKind: "erased-wrapper",
        passingMode:
          (wrapperType
            ? context.input.facts.get(parameterPassingFactKey, wrapperType)
                ?.mode
            : undefined) ?? base.passingMode,
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context,
          assertedType ?? expectedType
        ),
      };
    }
    case TstsSyntax.KindAwaitExpression:
      return {
        ...base,
        expressionKind: "await",
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context,
          expectedType
        ),
      };
    case TstsSyntax.KindYieldExpression: {
      const yieldExpression = TstsSyntax.AsYieldExpression(node);
      if (!yieldExpression)
        return unsupportedExpression(sourceFile, node, context);
      return {
        ...base,
        expressionKind: "yield",
        expression: expressionPlan(
          sourceFile,
          yieldExpression.Expression,
          context
        ),
        yieldDelegates: yieldExpression.AsteriskToken !== undefined,
      };
    }
    case TstsSyntax.KindSpreadElement:
      return {
        ...base,
        expressionKind: "spread",
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context,
          expectedType
        ),
      };
    case TstsSyntax.KindBinaryExpression: {
      const binary = TstsSyntax.AsBinaryExpression(node);
      if (!binary) return unsupportedExpression(sourceFile, node, context);
      const binaryOperator = binaryOperatorFromKind(binary.OperatorToken?.Kind);
      const left = expressionPlan(sourceFile, binary.Left, context);
      const rightExpected =
        binaryOperandExpectedType(binaryOperator, left) ?? expectedType;
      const right = expressionPlan(
        sourceFile,
        binary.Right,
        context,
        rightExpected
      );
      const leftExpected = binaryOperandExpectedType(binaryOperator, right);
      return {
        ...base,
        expressionKind: "binary",
        left: leftExpected
          ? expressionPlan(sourceFile, binary.Left, context, leftExpected)
          : left,
        binaryOperator,
        right,
      };
    }
    case TstsSyntax.KindPrefixUnaryExpression: {
      const unary = TstsSyntax.AsPrefixUnaryExpression(node);
      if (!unary) return unsupportedExpression(sourceFile, node, context);
      return {
        ...base,
        expressionKind: "prefix-unary",
        unaryOperator: unaryOperatorFromKind(unary.Operator),
        expression: expressionPlan(sourceFile, unary.Operand, context),
      };
    }
    case TstsSyntax.KindPostfixUnaryExpression: {
      const unary = TstsSyntax.AsPostfixUnaryExpression(node);
      if (!unary) return unsupportedExpression(sourceFile, node, context);
      return {
        ...base,
        expressionKind: "postfix-unary",
        unaryOperator: unaryOperatorFromKind(unary.Operator),
        expression: expressionPlan(sourceFile, unary.Operand, context),
      };
    }
    case TstsSyntax.KindTypeOfExpression:
      return {
        ...base,
        expressionKind: "typeof",
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context,
          expectedType
        ),
      };
    case TstsSyntax.KindVoidExpression:
      return {
        ...base,
        expressionKind: "void",
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context
        ),
      };
    case TstsSyntax.KindPropertyAccessExpression:
    {
      const name = TstsSyntax.Node_Name(node);
      const receiverNode = TstsSyntax.Node_Expression(node);
      const receiverType = receiverNode
        ? checker.getNarrowedTypeAtLocation(receiverNode) ??
          checker.getTypeAtLocation(receiverNode)
        : undefined;
      const checkerReceiverTypePlan = checkerTypePlan(
        context,
        sourceFile,
        receiverType
      );
      const receiverStorageTypePlan = sourceRuntimeExpressionStorageTypePlan(
        context,
        sourceFile,
        receiverNode
      );
      const ownerReceiverTypePlan = receiverOwnerTypePlan(sourceFile, node, context);
      return {
        ...base,
        expressionKind: "property-access",
        expression: expressionPlan(
          sourceFile,
          receiverNode,
          context
        ),
        receiverTypePlan:
          receiverStorageTypePlan ??
          (isBroadLoweringTypePlan(checkerReceiverTypePlan)
            ? (ownerReceiverTypePlan ?? checkerReceiverTypePlan)
            : (checkerReceiverTypePlan ?? ownerReceiverTypePlan)),
        storageTypePlan:
          propertyAccessStorageTypePlan(
            context,
            sourceFile,
            node,
            receiverNode
          ) ??
          symbolStorageTypePlan(
            context,
            sourceFile,
            name ? checker.getSymbolAtLocation(name) : base.symbol
          ),
        literalText:
          nodeTokenText(name) ??
          nodeName(sourceFile, node),
      };
    }
    case TstsSyntax.KindElementAccessExpression: {
      const element = TstsSyntax.AsElementAccessExpression(node);
      if (!element) return unsupportedExpression(sourceFile, node, context);
      const receiverType =
        checker.getNarrowedTypeAtLocation(element.Expression) ??
        checker.getTypeAtLocation(element.Expression);
      return {
        ...base,
        expressionKind: "element-access",
        expression: expressionPlan(sourceFile, element.Expression, context),
        receiverTypePlan:
          sourceRuntimeExpressionStorageTypePlan(
            context,
            sourceFile,
            element.Expression
          ) ?? checkerTypePlan(context, sourceFile, receiverType),
        storageTypePlan: sourceRuntimeExpressionStorageTypePlan(
          context,
          sourceFile,
          node
        ),
        arguments: [
          expressionPlan(sourceFile, element.ArgumentExpression, context),
        ].filter((item): item is LoweringExpressionPlan => item !== undefined),
      };
    }
    case TstsSyntax.KindCallExpression:
    case TstsSyntax.KindNewExpression: {
      const signature = checker.getResolvedSignature(node);
      const calleeNode = TstsSyntax.Node_Expression(node);
      const calleeNarrowedType = calleeNode
        ? checker.getNarrowedTypeAtLocation(calleeNode)
        : undefined;
      const signatureTarget = signatureTargetSourceTypePlan(
        context,
        sourceFile,
        signature
      );
      const callee = expressionPlan(
        sourceFile,
        calleeNode,
        context
      );
      const expectedArgumentTypes = arrayReceiverArgumentExpectedTypes(callee) ??
        callExpectedArgumentTypes(
        sourceFile,
        node,
        context
      );
      return {
        ...base,
        expressionKind:
          node.Kind === TstsSyntax.KindNewExpression ? "new" : "call",
        expression: callee,
        storageTypePlan: sourceRuntimeExpressionStorageTypePlan(
          context,
          sourceFile,
          node
        ),
        callTargetTypePlan:
          node.Kind === TstsSyntax.KindCallExpression
            ? signatureTarget?.kind === "named"
              ? signatureTarget
              : checkerTypePlan(context, sourceFile, calleeNarrowedType) ??
                signatureTarget
            : undefined,
        arguments: (TstsSyntax.Node_Arguments(node) ?? [])
          .map((argument, index) =>
            expressionPlan(
              sourceFile,
              argument,
              context,
              expectedArgumentTypes[index]
            )
          )
          .filter((item): item is LoweringExpressionPlan => item !== undefined),
        typeArguments: nodeArrayNodes(TstsSyntax.Node_TypeArguments(node))
          .map((argument) => sourceTypePlan(context, sourceFile, argument))
          .filter(
            (argument): argument is LoweringTypeRefPlan =>
              argument !== undefined
          ),
      };
    }
    case TstsSyntax.KindArrowFunction:
    case TstsSyntax.KindFunctionExpression: {
      const body = TstsSyntax.Node_Body(node);
      const bodyIsStatement = body ? isStatementNode(body) : false;
      const explicitReturnType = TstsSyntax.Node_Type(node);
      const expectedFunction =
        functionTypeParts(expectedType) ??
        functionTypeParts(base.contextualTypePlan);
      const returnType = explicitReturnType
        ? sourceTypePlan(context, sourceFile, explicitReturnType)
        : (expectedFunction?.returnType ??
          checkerTypePlan(
            context,
            sourceFile,
            functionReturnType(sourceFile, node, context)
          ));
      return {
        ...base,
        expressionKind:
          node.Kind === TstsSyntax.KindArrowFunction
            ? "arrow-function"
            : "function-expression",
        parameters: parameterPlans(
          sourceFile,
          node,
          context,
          expectedFunction?.parameterTypes
        ),
        async: nodeHasModifier(node, TstsSyntax.ModifierFlagsAsync),
        returnType,
        body: bodyIsStatement
          ? statementPlan(sourceFile, body, context, returnType)
          : undefined,
        expression: bodyIsStatement
          ? undefined
          : expressionPlan(sourceFile, body, context, returnType),
      };
    }
    case TstsSyntax.KindArrayLiteralExpression: {
      const arrayExpectedType = expectedType ?? base.contextualTypePlan;
      return {
        ...base,
        expressionKind: "array-literal",
        elements: (TstsSyntax.Node_Elements(node) ?? [])
          .map((element, index) =>
            expressionPlan(
              sourceFile,
              element,
              context,
              element?.Kind === TstsSyntax.KindSpreadElement
                ? expectedArraySpreadType(arrayExpectedType)
                : expectedArrayElementType(arrayExpectedType, index)
            )
          )
          .filter((item): item is LoweringExpressionPlan => item !== undefined),
      };
    }
    case TstsSyntax.KindObjectLiteralExpression: {
      return {
        ...base,
        expressionKind: "object-literal",
        properties: (TstsSyntax.Node_Properties(node) ?? [])
          .filter((property): property is TstsNode => property !== undefined)
          .map((property): LoweringObjectPropertyPlan | undefined => {
            const name = propertyNameInfo(sourceFile, property, context);
            const propertyExpectedType =
              objectMemberExpectedType(expectedType, name.name) ??
              objectMemberExpectedType(base.contextualTypePlan, name.name);
            const value =
              property?.Kind === TstsSyntax.KindShorthandPropertyAssignment
                ? expressionPlan(
                    sourceFile,
                    TstsSyntax.Node_Name(property),
                    context,
                    propertyExpectedType
                  )
                : expressionPlan(
                    sourceFile,
                    TstsSyntax.Node_Initializer(property),
                    context,
                    propertyExpectedType
                  );
            return value
              ? {
                  name: name.name,
                  sourceKindName:
                    name.sourceKindName ?? TstsSyntax.Node_KindString(property),
                  sourceText:
                    name.sourceText ?? nodeSourceText(sourceFile, property),
                  computed: name.computed,
                  expression: value,
                }
              : undefined;
          })
          .filter(
            (item): item is LoweringObjectPropertyPlan => item !== undefined
          ),
      };
    }
    case TstsSyntax.KindConditionalExpression: {
      const conditional = TstsSyntax.AsConditionalExpression(node);
      if (!conditional) return unsupportedExpression(sourceFile, node, context);
      const branchExpectedType = expectedType ?? base.contextualTypePlan;
      return {
        ...base,
        expressionKind: "conditional",
        condition: expressionPlan(sourceFile, conditional.Condition, context),
        whenTrue: expressionPlan(
          sourceFile,
          conditional.WhenTrue,
          context,
          branchExpectedType
        ),
        whenFalse: expressionPlan(
          sourceFile,
          conditional.WhenFalse,
          context,
          branchExpectedType
        ),
      };
    }
    default:
      return unsupportedExpression(sourceFile, node, context);
  }
};

const bindingElementsFromName = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context: LoweringBuildContext,
  accessPath: readonly LoweringBindingAccessPlan[] = [],
  rootType?: LoweringTypeRefPlan
): readonly LoweringBindingElementPlan[] => {
  if (!node) return [];
  if (node.Kind === TstsSyntax.KindIdentifier) {
    const name = nodeTokenText(node);
    if (!name || accessPath.length === 0) return [];
    const checker = context.checkerForSourceFile(sourceFile);
    return [
      {
        name,
        type:
          typeAtBindingAccess(rootType, accessPath) ??
          checkerTypePlan(
            context,
            sourceFile,
            checker.getNarrowedTypeAtLocation(node)
          ),
        accessPath,
      },
    ];
  }
  const bindingPattern = TstsSyntax.AsBindingPattern(node);
  if (!bindingPattern?.Elements) return [];
  return nodeListNodes(bindingPattern.Elements).flatMap(
    (elementNode, index) => {
      const bindingElement = TstsSyntax.AsBindingElement(elementNode);
      const nameNode = TstsSyntax.Node_Name(elementNode);
      const propertyName =
        bindingElement?.PropertyName ??
        TstsSyntax.Node_PropertyNameOrName(elementNode);
      const access: readonly LoweringBindingAccessPlan[] =
        node.Kind === TstsSyntax.KindArrayBindingPattern
          ? [...accessPath, { kind: "element", index }]
          : [
              ...accessPath,
              {
                kind: "property",
                name:
                  (propertyName ? nodeTokenText(propertyName) : undefined) ??
                  nodeTokenText(nameNode) ??
                  `item${index}`,
              },
            ];
      const nested = bindingElementsFromName(
        sourceFile,
        nameNode,
        context,
        access,
        rootType
      );
      if (nested.length === 0) return [];
      const initializer = bindingElement?.Initializer
        ? expressionPlan(sourceFile, bindingElement.Initializer, context)
        : undefined;
      return initializer
        ? nested.map((binding) => ({ ...binding, initializer }))
        : nested;
    }
  );
};

const typeAtBindingAccess = (
  rootType: LoweringTypeRefPlan | undefined,
  accessPath: readonly LoweringBindingAccessPlan[]
): LoweringTypeRefPlan | undefined => {
  let current = rootType;
  for (const access of accessPath) {
    current = loweringNonNullishUnionTypes(current ?? intrinsicTypePlan("unknown"))[0];
    if (access.kind === "element") {
      if (current?.kind === "tuple") {
        current = current.elements[access.index];
        continue;
      }
      if (current?.kind === "array") {
        current = current.elementType;
        continue;
      }
      return undefined;
    }
    if (current?.kind !== "object") return undefined;
    const member = current.members.find(
      (candidate) =>
        candidate.kind === "property" && candidate.name === access.name
    );
    current = member?.kind === "property" ? member.type : undefined;
  }
  return current;
};

const sameSymbol = (
  checker: ReturnType<LoweringBuildContext["checkerForSourceFile"]>,
  left: TstsSymbol | undefined,
  right: TstsSymbol | undefined
): boolean => {
  if (!left || !right) return false;
  if (left === right) return true;
  const leftDeclarations = checker.getSymbolDeclarations(left);
  const rightDeclarations = checker.getSymbolDeclarations(right);
  return leftDeclarations.some((leftDeclaration) =>
    rightDeclarations.includes(leftDeclaration)
  );
};

const nodeReferencesSymbol = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context: LoweringBuildContext,
  symbol: TstsSymbol | undefined
): boolean => {
  if (!node || !symbol) return false;
  const checker = context.checkerForSourceFile(sourceFile);
  let referenced = false;
  visitTstsNodes(node, (child) => {
    if (referenced || child.Kind !== TstsSyntax.KindIdentifier) return;
    referenced = sameSymbol(
      checker,
      checker.getSymbolAtLocation(child),
      symbol
    );
  });
  return referenced;
};

const variablePlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): LoweringVariablePlan => {
  const checker = context.checkerForSourceFile(sourceFile);
  const variable = TstsSyntax.AsVariableDeclaration(node);
  const declaredType = variable?.Type ?? TstsSyntax.Node_Type(node);
  const type = sourceTypePlan(context, sourceFile, declaredType);
  const nameNode = TstsSyntax.Node_Name(node);
  const initializerNode = variable?.Initializer ?? TstsSyntax.Node_Initializer(node);
  const declarationSymbol = nameNode
    ? checker.getSymbolAtLocation(nameNode)
    : undefined;
  const initializerStorage = sourceRuntimeExpressionStorageTypePlan(
    context,
    sourceFile,
    initializerNode
  );
  const initializerCheckerType = initializerNode
    ? checkerTypePlan(
        context,
        sourceFile,
        checker.getNarrowedTypeAtLocation(initializerNode)
      )
    : undefined;
  const initializerSourceType = initializerNode
    ? expressionSourceTypePlan(sourceFile, initializerNode, context)
    : undefined;
  const storageType =
    type ??
    initializerStorage ??
    initializerSourceType ??
    initializerCheckerType;
  setStoredSymbolType(context, sourceFile, declarationSymbol, storageType);
  const genericAlias = context.input.facts.get(
    genericFunctionAliasFactKey,
    node
  );
  return {
    sourceNode: node,
    name: nodeName(sourceFile, node) ?? "value",
    type,
    storageType,
    initializer: expressionPlan(
      sourceFile,
      initializerNode,
      context,
      storageType
    ),
    bindingElements: bindingElementsFromName(
      sourceFile,
      nameNode,
      context,
      [],
      storageType
    ),
    compileTimeOnly:
      genericAlias !== undefined ||
      nodeOrAncestorHasModifier(node, TstsSyntax.ModifierFlagsAmbient),
    initializerReferencesDeclaration: nodeReferencesSymbol(
      sourceFile,
      initializerNode,
      context,
      declarationSymbol
    ),
  };
};

const variablesFromList = (
  sourceFile: TstsSourceFile,
  list: TstsNode | undefined,
  context: LoweringBuildContext
): readonly LoweringVariablePlan[] => {
  const variableList = list
    ? TstsSyntax.AsVariableDeclarationList(list)
    : undefined;
  return nodeListNodes(variableList?.Declarations).map((node) =>
    variablePlan(sourceFile, node, context)
  );
};

const statementPlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context: LoweringBuildContext,
  expectedReturnType?: LoweringTypeRefPlan
): LoweringStatementPlan | undefined => {
  if (!node) return undefined;
  const empty = {
    ...planBase("statement", sourceFile, node, context),
    statements: [] as readonly LoweringStatementPlan[],
    declarations: [] as readonly LoweringVariablePlan[],
    cases: [],
  };

  switch (node.Kind) {
    case TstsSyntax.KindBlock:
      return {
        ...empty,
        statementKind: "block",
        statements: (TstsSyntax.Node_Statements(node) ?? [])
          .map((statement) =>
            statementPlan(sourceFile, statement, context, expectedReturnType)
          )
          .filter((item): item is LoweringStatementPlan => item !== undefined),
      };
    case TstsSyntax.KindReturnStatement: {
      const statement = TstsSyntax.AsReturnStatement(node);
      return {
        ...empty,
        statementKind: "return",
        expression: expressionPlan(
          sourceFile,
          statement?.Expression,
          context,
          expectedReturnType
        ),
      };
    }
    case TstsSyntax.KindExpressionStatement:
      {
        const expression = expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context
        );
        return {
        ...empty,
        statementKind: "expression",
          expression,
          compileTimeOnly: expression?.semantic === "compile-time-marker-call",
        };
      }
    case TstsSyntax.KindVariableStatement: {
      const statement = TstsSyntax.AsVariableStatement(node);
      return {
        ...empty,
        statementKind: "variable",
        declarations: variablesFromList(
          sourceFile,
          statement?.DeclarationList,
          context
        ),
      };
    }
    case TstsSyntax.KindIfStatement: {
      const statement = TstsSyntax.AsIfStatement(node);
      return {
        ...empty,
        statementKind: "if",
        condition: expressionPlan(sourceFile, statement?.Expression, context),
        thenStatement: statementPlan(
          sourceFile,
          statement?.ThenStatement,
          context,
          expectedReturnType
        ),
        elseStatement: statementPlan(
          sourceFile,
          statement?.ElseStatement,
          context,
          expectedReturnType
        ),
      };
    }
    case TstsSyntax.KindWhileStatement: {
      const statement = TstsSyntax.AsWhileStatement(node);
      return {
        ...empty,
        statementKind: "while",
        condition: expressionPlan(sourceFile, statement?.Expression, context),
        body: statementPlan(
          sourceFile,
          statement?.Statement,
          context,
          expectedReturnType
        ),
      };
    }
    case TstsSyntax.KindForStatement: {
      const statement = TstsSyntax.AsForStatement(node);
      return {
        ...empty,
        statementKind: "for",
        declarations: variablesFromList(
          sourceFile,
          statement?.Initializer?.Kind ===
            TstsSyntax.KindVariableDeclarationList
            ? statement.Initializer
            : undefined,
          context
        ),
        expression:
          statement?.Initializer?.Kind ===
          TstsSyntax.KindVariableDeclarationList
            ? undefined
            : expressionPlan(sourceFile, statement?.Initializer, context),
        condition: expressionPlan(sourceFile, statement?.Condition, context),
        incrementor: expressionPlan(
          sourceFile,
          statement?.Incrementor,
          context
        ),
        body: statementPlan(
          sourceFile,
          statement?.Statement,
          context,
          expectedReturnType
        ),
      };
    }
    case TstsSyntax.KindForOfStatement:
    case TstsSyntax.KindForInStatement: {
      const statement = TstsSyntax.AsForInOrOfStatement(node);
      return {
        ...empty,
        statementKind:
          node.Kind === TstsSyntax.KindForOfStatement ? "for-of" : "for-in",
        declarations: variablesFromList(
          sourceFile,
          statement?.Initializer?.Kind ===
            TstsSyntax.KindVariableDeclarationList
            ? statement.Initializer
            : undefined,
          context
        ),
        expression:
          statement?.Initializer?.Kind ===
          TstsSyntax.KindVariableDeclarationList
            ? undefined
            : expressionPlan(sourceFile, statement?.Initializer, context),
        iterable: expressionPlan(sourceFile, statement?.Expression, context),
        body: statementPlan(
          sourceFile,
          statement?.Statement,
          context,
          expectedReturnType
        ),
      };
    }
    case TstsSyntax.KindBreakStatement:
      return { ...empty, statementKind: "break" };
    case TstsSyntax.KindContinueStatement:
      return { ...empty, statementKind: "continue" };
    case TstsSyntax.KindSwitchStatement: {
      const statement = TstsSyntax.AsSwitchStatement(node);
      const caseBlock = TstsSyntax.AsCaseBlock(statement?.CaseBlock);
      return {
        ...empty,
        statementKind: "switch",
        expression: expressionPlan(sourceFile, statement?.Expression, context),
        cases: nodeListNodes(caseBlock?.Clauses).map((clauseNode) => {
          const clause = TstsSyntax.AsCaseOrDefaultClause(clauseNode);
          return {
            expression: expressionPlan(sourceFile, clause?.Expression, context),
            isDefault: clauseNode.Kind === TstsSyntax.KindDefaultClause,
            statements: nodeListNodes(clause?.Statements)
              .map((statement) =>
                statementPlan(
                  sourceFile,
                  statement,
                  context,
                  expectedReturnType
                )
              )
              .filter(
                (item): item is LoweringStatementPlan => item !== undefined
              ),
          };
        }),
      };
    }
    case TstsSyntax.KindTryStatement: {
      const statement = TstsSyntax.AsTryStatement(node);
      const catchClause = TstsSyntax.AsCatchClause(statement?.CatchClause);
      return {
        ...empty,
        statementKind: "try",
        tryBlock: statementPlan(
          sourceFile,
          statement?.TryBlock,
          context,
          expectedReturnType
        ),
        catchVariable: catchClause?.VariableDeclaration
          ? variablePlan(sourceFile, catchClause.VariableDeclaration, context)
          : undefined,
        catchBlock: statementPlan(
          sourceFile,
          catchClause?.Block,
          context,
          expectedReturnType
        ),
        finallyBlock: statementPlan(
          sourceFile,
          statement?.FinallyBlock,
          context,
          expectedReturnType
        ),
      };
    }
    case TstsSyntax.KindThrowStatement: {
      const statement = TstsSyntax.AsThrowStatement(node);
      return {
        ...empty,
        statementKind: "throw",
        expression: expressionPlan(sourceFile, statement?.Expression, context),
      };
    }
    case TstsSyntax.KindEmptyStatement:
      return { ...empty, statementKind: "empty" };
    case TstsSyntax.KindFunctionDeclaration:
    case TstsSyntax.KindClassDeclaration:
    case TstsSyntax.KindInterfaceDeclaration:
    case TstsSyntax.KindTypeAliasDeclaration:
    case TstsSyntax.KindEnumDeclaration:
      return { ...empty, statementKind: "declaration" };
    default:
      return { ...empty, statementKind: "unsupported" };
  }
};

const declarationKind = (
  node: TstsNode
): LoweringDeclarationPlan["declarationKind"] => {
  switch (node.Kind) {
    case TstsSyntax.KindClassDeclaration:
      return "class";
    case TstsSyntax.KindConstructor:
      return "constructor";
    case TstsSyntax.KindEnumDeclaration:
      return "enum";
    case TstsSyntax.KindFunctionDeclaration:
      return "function";
    case TstsSyntax.KindInterfaceDeclaration:
      return "interface";
    case TstsSyntax.KindMethodDeclaration:
    case TstsSyntax.KindMethodSignature:
    case TstsSyntax.KindCallSignature:
    case TstsSyntax.KindConstructSignature:
      return "method";
    case TstsSyntax.KindIndexSignature:
      return "index-signature";
    case TstsSyntax.KindPropertyDeclaration:
    case TstsSyntax.KindPropertySignature:
    case TstsSyntax.KindGetAccessor:
    case TstsSyntax.KindSetAccessor:
      return "property";
    case TstsSyntax.KindTypeAliasDeclaration:
      return "type-alias";
    case TstsSyntax.KindVariableDeclaration:
      return "variable";
    default:
      return "unknown";
  }
};

const parameterPlans = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext,
  expectedParameterTypes: readonly (LoweringTypeRefPlan | undefined)[] = [],
  sourceTypeState: SourceTypePlanState = createSourceTypePlanState()
): readonly LoweringParameterPlan[] =>
  (TstsSyntax.Node_Parameters(node) ?? [])
    .filter((parameter): parameter is TstsNode => parameter !== undefined)
    .map((parameter, index): LoweringParameterPlan => {
      const checker = context.checkerForSourceFile(sourceFile);
      const explicitType = TstsSyntax.Node_Type(parameter);
      const nameNode = TstsSyntax.Node_Name(parameter);
      const inferredType =
        explicitType === undefined &&
        expectedParameterTypes[index] === undefined
          ? checker.getTypeAtLocation(nameNode ?? parameter)
          : undefined;
      return {
        name: nodeName(sourceFile, parameter) ?? "arg",
        type:
          typePlan(context, sourceFile, explicitType, inferredType, sourceTypeState) ??
          expectedParameterTypes[index],
        initializer: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Initializer(parameter),
          context
        ),
        optional: TstsSyntax.Node_QuestionToken(parameter) !== undefined,
        rest:
          TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken !==
          undefined,
      };
    });

const enumMembers = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): readonly LoweringEnumMemberPlan[] => {
  const declaration = TstsSyntax.AsEnumDeclaration(node);
  return nodeListNodes(declaration?.Members).map((member) => ({
    name: nodeName(sourceFile, member) ?? "Member",
    initializer: expressionPlan(
      sourceFile,
      TstsSyntax.AsEnumMember(member)?.Initializer,
      context
    ),
  }));
};

const baseConstructorParameters = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): readonly LoweringParameterPlan[] => {
  if (node.Kind !== TstsSyntax.KindClassDeclaration) return [];
  const heritage = getTstsHeritageTypeNodes(node)[0];
  if (!heritage) return [];
  const checker = context.checkerForSourceFile(sourceFile);
  const heritageType = checker.getTypeFromTypeNode(heritage);
  const [signature] = heritageType
    ? checker.getConstructSignatures(heritageType)
    : [];
  if (signature) {
    return checker.getSignatureParameters(signature).map((parameter) => {
      const declaration =
        checker.getSymbolValueDeclaration(parameter) ??
        checker.getSymbolDeclarations(parameter)[0];
      const parameterType = checker.getTypeOfSymbolAtLocation(
        parameter,
        declaration ?? heritage
      );
      return {
        name: checker.getSymbolName(parameter) || "arg",
        type: checkerTypePlan(context, sourceFile, parameterType),
        optional: false,
        rest: false,
      };
    });
  }

  const symbol = heritageType
    ? checker.getTypeAliasOrSymbol(heritageType)
    : undefined;
  const baseDeclaration = symbol
    ? checker
        .getSymbolDeclarations(symbol)
        .find(
          (candidate): candidate is TstsNode =>
            candidate !== undefined &&
            candidate.Kind === TstsSyntax.KindClassDeclaration
        )
    : undefined;
  const constructor = (TstsSyntax.Node_Members(baseDeclaration) ?? []).find(
    (member): member is TstsNode =>
      member !== undefined && member.Kind === TstsSyntax.KindConstructor
  );
  if (!baseDeclaration || !constructor || !heritageType) return [];
  const baseSourceFile = sourceFileForNode(baseDeclaration, sourceFile);
  const substitutions = aliasTypeSubstitutions(
    typeParameterNames(baseSourceFile, baseDeclaration),
    sourceTypeArgumentPlans(
      context,
      sourceFile,
      heritage,
      heritageType,
      createSourceTypePlanState()
    )
  );
  return parameterPlans(baseSourceFile, constructor, context).map(
    (parameter) => ({
      ...parameter,
      type: substituteTypePlan(parameter.type, substitutions),
    })
  );
};

const memberPlans = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): readonly LoweringDeclarationPlan[] =>
  (TstsSyntax.Node_Members(node) ?? [])
    .map((member) => declarationPlan(sourceFile, member, context))
    .filter((item): item is LoweringDeclarationPlan => item !== undefined);

const declarationPlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context: LoweringBuildContext
): LoweringDeclarationPlan | undefined => {
  if (!node || !isDeclarationNode(node)) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const symbol = checker.getSymbolAtLocation(node);
  const declaredType = symbol
    ? checker.getDeclaredTypeOfSymbol(symbol)
    : checker.getTypeAtLocation(node);
  const kind = declarationKind(node);
  const signature =
    kind === "function" || kind === "method" || kind === "constructor"
      ? checker.getSignatureFromDeclaration(node)
      : undefined;
  const inferredReturnType = signature
    ? checker.getReturnTypeOfSignature(signature)
    : undefined;
  const explicitReturnType = TstsSyntax.Node_Type(node);
  const returnType = typePlan(
    context,
    sourceFile,
    explicitReturnType,
    inferredReturnType
  );
  return {
    ...planBase("declaration", sourceFile, node, context),
    declarationKind: kind,
    symbol,
    declaredType,
    declaredTypePlan: checkerTypePlan(context, sourceFile, declaredType),
    typeAliasTarget:
      kind === "type-alias"
        ? sourceTypeAliasDeclarationTargetPlan(
            context,
            sourceFile,
            explicitReturnType
          )
        : undefined,
    heritageTypes: getTstsHeritageTypeNodes(node)
      .map((heritage) => sourceTypePlan(context, sourceFile, heritage))
      .filter(
        (heritage): heritage is LoweringTypeRefPlan => heritage !== undefined
      ),
    baseConstructorParameters: baseConstructorParameters(
      sourceFile,
      node,
      context
    ),
    parameters: parameterPlans(sourceFile, node, context),
    typeParameters: typeParameterNames(sourceFile, node),
    returnType,
    body: statementPlan(
      sourceFile,
      TstsSyntax.Node_Body(node),
      context,
      returnType
    ),
    initializer: expressionPlan(
      sourceFile,
      TstsSyntax.Node_Initializer(node),
      context,
      returnType
    ),
    members: memberPlans(sourceFile, node, context),
    enumMembers: enumMembers(sourceFile, node, context),
    compileTimeOnly: nodeHasModifier(node, TstsSyntax.ModifierFlagsAmbient),
    exported: nodeHasModifier(node, TstsSyntax.ModifierFlagsExport),
    async: nodeHasModifier(node, TstsSyntax.ModifierFlagsAsync),
    static: nodeHasModifier(node, TstsSyntax.ModifierFlagsStatic),
    override: nodeHasModifierToken(node, TstsSyntax.KindOverrideKeyword),
    accessibility: nodeAccessibility(node),
    accessibilityExplicit: nodeHasExplicitAccessibility(node),
  };
};

type PlanBuckets = {
  readonly declarations: LoweringDeclarationPlan[];
  readonly types: LoweringTypePlan[];
  readonly statements: LoweringStatementPlan[];
  readonly expressions: LoweringExpressionPlan[];
};

const createBuckets = (): PlanBuckets => ({
  declarations: [],
  types: [],
  statements: [],
  expressions: [],
});

export const buildLoweringPlansForSourceFile = (
  sourceFile: TstsSourceFile,
  context: LoweringBuildContext
): PlanBuckets => {
  const buckets = createBuckets();
  const checker = context.checkerForSourceFile(sourceFile);

  visitTstsNodes(sourceFile, (node) => {
    const declaration = declarationPlan(sourceFile, node, context);
    if (declaration) {
      buckets.declarations.push(declaration);
    }

    if (isTypeNode(node)) {
      const type = checker.getTypeFromTypeNode(node);
      if (type) {
        buckets.types.push({
          ...planBase("type", sourceFile, node, context),
          sourceType: type,
          sourceSymbol: checker.getTypeAliasOrSymbol(type),
        });
      }

    }

    const statement = isStatementNode(node)
      ? statementPlan(sourceFile, node, context)
      : undefined;
    if (statement) buckets.statements.push(statement);

    const expression = isExpressionNode(node)
      ? expressionPlan(sourceFile, node, context)
      : undefined;
    if (expression) buckets.expressions.push(expression);
  });

  return buckets;
};
