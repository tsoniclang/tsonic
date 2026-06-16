import {
  getTstsExpressionWithTypeArgumentsName,
  getTstsHeritageTypeNodes,
  getTstsIdentifierText,
  getTstsContainingSourceFile,
  getTstsNodeText,
  getTstsTypeReferenceDetails,
  TstsSyntax,
} from "@tsonic/tsts";
import {
  externalBindingSourceIdentityForDeclaration,
  isExternalBindingSourceFile,
} from "../program/external-binding-source-identity.js";
import { resolveSourceFileIdentity } from "../program/source-file-identity.js";
import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  expressionSemanticsFactKey,
  extensionReceiverSemanticsFactKey,
  fieldSemanticsFactKey,
  genericFunctionAliasFactKey,
  heritageWrapperSemanticsFactKey,
  intrinsicSemanticsFactKey,
  markerApiSemanticsFactKey,
  numericPrimitiveFactKey,
  parameterPassingFactKey,
  sourceAttributeApplicationsFactKey,
  sourceBindingIdentityFactKey,
  sourceBindingTypeProjectionFactKey,
  sourceCallArgumentTypesFactKey,
  sourceDeclarationTypeProjectionFactKey,
  sourceDictionaryTypeFactKey,
  sourceExpressionTypeProjectionFactKey,
  sourceInitializerReferencesDeclarationFactKey,
  sourceOverloadCallImplementationFactKey,
  sourceRuntimeVisibilityFactKey,
  sourceRuntimeOperationFactKey,
  sourceTypeNodeProjectionFactKey,
  sourceTypeSemanticsFactKey,
  wellKnownComputedNameFactKey,
} from "../source-frontend/source-facts.js";
import {
  isExtensionReceiverFact,
  isFieldSemanticsFact,
  isHeritageInterfaceErasure,
  isSourceTypeKind,
} from "../source-frontend/source-fact-queries.js";
import type {
  SourceBindingIdentityFact,
  SourceBindingProjectedType,
  SourceParameterTypeProjection,
  SourceRuntimeOperationOwner,
} from "../source-frontend/source-facts.js";
import type {
  LoweringBinaryOperator,
  LoweringAttributePlan,
  LoweringBindingAccessPlan,
  LoweringBindingElementPlan,
  LoweringBuildContext,
  LoweringDeclarationPlan,
  LoweringEnumMemberPlan,
  LoweringExpressionPlan,
  LoweringExternalBindingReferencePlan,
  LoweringIntrinsicTypeName,
  LoweringObjectPropertyPlan,
  LoweringParameterPlan,
  LoweringSourceQualifiedNamePlan,
  LoweringStatementPlan,
  LoweringTemplatePartPlan,
  LoweringTypeDeclarationBinding,
  LoweringTypeMemberPlan,
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

const nodeSourceText = (node: TstsNode): string =>
  getTstsNodeText(node) ?? TstsSyntax.Node_KindString(node);

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
  node: TstsNode | undefined,
  context?: LoweringBuildContext
): NodeNameInfo => {
  if (!node) return { computed: false };
  const nameNode = TstsSyntax.Node_Name(node);
  if (!nameNode) return { computed: false };
  const sourceKindName = TstsSyntax.Node_KindString(nameNode);
  const sourceText = nodeSourceText(nameNode);
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

const nodeName = (node: TstsNode | undefined): string | undefined =>
  nodeNameInfo(node).name;

const parameterPlanSource = (
  node: TstsNode
): Pick<
  LoweringParameterPlan,
  "sourceKindName" | "sourceText" | "nameSourceText"
> => {
  const nameNode = TstsSyntax.Node_Name(node);
  return {
    sourceKindName: TstsSyntax.Node_KindString(node),
    sourceText: nodeSourceText(node),
    nameSourceText: nameNode ? nodeSourceText(nameNode) : undefined,
  };
};

const propertyNameInfo = (
  node: TstsNode | undefined,
  context?: LoweringBuildContext
): NodeNameInfo => {
  if (!node) return { computed: false };
  const nameNode = TstsSyntax.Node_PropertyNameOrName(node);
  if (!nameNode) return nodeNameInfo(node, context);
  const sourceKindName = TstsSyntax.Node_KindString(nameNode);
  const sourceText = nodeSourceText(nameNode);
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
  if (nodeHasModifierToken(node, TstsSyntax.KindPrivateKeyword))
    return "private";
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

const compactNodeSourceText = (node: TstsNode): string =>
  nodeSourceText(node).replace(/\s+/g, " ").trim();

const templateFragmentText = (
  _sourceFile: TstsSourceFile,
  node: TstsNode
): string =>
  (node as { readonly Text?: string }).Text ?? nodeTokenText(node) ?? "";

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

const recordTypePlan = (
  keyType: LoweringTypeRefPlan,
  valueType: LoweringTypeRefPlan,
  sourceText?: string
): LoweringTypeRefPlan => ({
  kind: "record",
  keyType,
  valueType,
  sourceText,
});

const unsupportedTypePlan = (node: TstsNode): LoweringTypeRefPlan => ({
  kind: "unsupported",
  sourceKindName: TstsSyntax.Node_KindString(node),
  sourceText: compactNodeSourceText(node),
});

const sourceFileForNode = (
  node: TstsNode | undefined,
  defaultSourceFile: TstsSourceFile
): TstsSourceFile =>
  node
    ? (getTstsContainingSourceFile(node) ?? defaultSourceFile)
    : defaultSourceFile;

const arrayStorageForSourceTypeNode = (
  node: TstsNode | undefined,
  defaultSourceFile: TstsSourceFile
): "native-array" | undefined =>
  isExternalBindingSourceFile(
    sourceFileForNode(node, defaultSourceFile).FileName()
  )
    ? "native-array"
    : undefined;

const namespaceTypeDeclarationKinds = new Set([
  TstsSyntax.KindClassDeclaration,
  TstsSyntax.KindEnumDeclaration,
  TstsSyntax.KindInterfaceDeclaration,
  TstsSyntax.KindTypeAliasDeclaration,
]);

const sourceQualifiedTypeDeclarationKinds = new Set([
  TstsSyntax.KindClassDeclaration,
  TstsSyntax.KindEnumDeclaration,
  TstsSyntax.KindInterfaceDeclaration,
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
  containingSourceFile: TstsSourceFile
): LoweringTypeDeclarationBinding | undefined => {
  if (!isRuntimeTypeDeclaration(declaration)) return undefined;
  return {
    sourceFile: sourceFileForNode(declaration, containingSourceFile),
    sourceNode: declaration,
  };
};

const typeReferenceBindingNode = (node: TstsNode): TstsNode | undefined =>
  TstsSyntax.AsTypeReferenceNode(node)?.TypeName ??
  TstsSyntax.AsExpressionWithTypeArguments(node)?.Expression ??
  TstsSyntax.Node_Name(node);

const sourceBindingFactForNode = (
  context: LoweringBuildContext,
  node: TstsNode | undefined
): SourceBindingIdentityFact | undefined => {
  if (!node) return undefined;
  const direct = context.input.facts.get(sourceBindingIdentityFactKey, node);
  if (direct) return direct;
  const bindingNode = typeReferenceBindingNode(node);
  return bindingNode
    ? context.input.facts.get(sourceBindingIdentityFactKey, bindingNode)
    : undefined;
};

const typeDeclarationBindingForNode = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): LoweringTypeDeclarationBinding | undefined => {
  return typeDeclarationBindingForDeclaration(
    sourceBindingFactForNode(context, node)?.declaration,
    sourceFile
  );
};

const sourceQualifiedNameForSourceBindingFact = (
  context: LoweringBuildContext,
  fact: SourceBindingIdentityFact | undefined,
  target: "type" | "value"
): LoweringSourceQualifiedNamePlan | undefined => {
  if (!fact) return undefined;
  if (externalBindingForSourceBindingFact(fact)) return undefined;
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
      if (target !== "type") return undefined;
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

const externalBindingForSourceBindingFact = (
  fact: SourceBindingIdentityFact | undefined
): LoweringExternalBindingReferencePlan | undefined =>
  fact
    ? externalBindingSourceIdentityForDeclaration(
        fact.sourceFileName,
        fact.name
      )
    : undefined;

const sourceQualifiedNameForSourceBindingNode = (
  context: LoweringBuildContext,
  node: TstsNode | undefined,
  target: "type" | "value"
): LoweringSourceQualifiedNamePlan | undefined =>
  sourceQualifiedNameForSourceBindingFact(
    context,
    sourceBindingFactForNode(context, node),
    target
  );

const externalBindingForSourceBindingNode = (
  context: LoweringBuildContext,
  node: TstsNode | undefined
): LoweringExternalBindingReferencePlan | undefined =>
  externalBindingForSourceBindingFact(sourceBindingFactForNode(context, node));

const isCompileTimeHeritageMarker = (
  context: LoweringBuildContext,
  heritage: TstsNode | undefined
): boolean =>
  heritage !== undefined &&
  (isSourceTypeKind(
    context.input.facts.get(sourceTypeSemanticsFactKey, heritage),
    "struct"
  ) ||
    isHeritageInterfaceErasure(
      context.input.facts.get(heritageWrapperSemanticsFactKey, heritage)
    ));

const runtimeHeritageTypeNodes = (
  context: LoweringBuildContext,
  declaration: TstsNode
): readonly TstsNode[] =>
  getTstsHeritageTypeNodes(declaration).filter(
    (heritage): heritage is TstsNode =>
      heritage !== undefined && !isCompileTimeHeritageMarker(context, heritage)
  );

const hasExtensionReceiverFact = (
  context: LoweringBuildContext,
  node: TstsNode | undefined
): boolean =>
  node !== undefined &&
  isExtensionReceiverFact(
    context.input.facts.get(extensionReceiverSemanticsFactKey, node)
  );

const sourceRuntimeVisibilityForNode = (
  context: LoweringBuildContext,
  node: TstsNode | undefined
): Extract<
  LoweringTypeRefPlan,
  { readonly kind: "named" }
>["runtimeVisibility"] => {
  if (!node) return undefined;
  const direct = context.input.facts.get(sourceRuntimeVisibilityFactKey, node);
  if (direct) return direct.visibility;
  const name = TstsSyntax.Node_Name(node);
  return name
    ? context.input.facts.get(sourceRuntimeVisibilityFactKey, name)?.visibility
    : undefined;
};

const sourceRuntimeVisibilityForDeclaration = (
  context: LoweringBuildContext,
  declaration: TstsNode | undefined
): Extract<
  LoweringTypeRefPlan,
  { readonly kind: "named" }
>["runtimeVisibility"] =>
  declaration
    ? context.input.facts.get(sourceRuntimeVisibilityFactKey, declaration)
        ?.visibility
    : undefined;

const hasSourceDictionaryFactForNode = (
  context: LoweringBuildContext,
  node: TstsNode | undefined
): boolean =>
  node !== undefined &&
  context.input.facts.has(sourceDictionaryTypeFactKey, node);

const recordTypePlanFromTypeArguments = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  typeArguments: readonly (TstsNode | undefined)[],
  sourceText?: string
): LoweringTypeRefPlan | undefined => {
  const [keyTypeNode, valueTypeNode] = typeArguments;
  const keyType = sourceTypePlan(context, sourceFile, keyTypeNode);
  const valueType = sourceTypePlan(context, sourceFile, valueTypeNode);
  return keyType && valueType
    ? recordTypePlan(keyType, valueType, sourceText)
    : undefined;
};

const sourceQualifiedNameForDeclaration = (
  context: LoweringBuildContext,
  declaration: TstsNode | undefined,
  exportedName: string,
  target: "type" | "value"
): LoweringSourceQualifiedNamePlan | undefined => {
  if (!declaration) return undefined;
  if (declaration.Kind === TstsSyntax.KindTypeParameter) return undefined;
  const declarationSourceFile = getTstsContainingSourceFile(declaration);
  if (!declarationSourceFile) return undefined;
  if (declarationSourceFile.IsDeclarationFile === true) {
    if (
      externalBindingSourceIdentityForDeclaration(
        declarationSourceFile.FileName(),
        exportedName
      )
    ) {
      return undefined;
    }
  }
  const identity = resolveSourceFileIdentity(
    declarationSourceFile.FileName(),
    context.options.sourceRoot,
    context.options.rootNamespace
  );
  if (target === "type") {
    if (!sourceQualifiedTypeDeclarationKinds.has(declaration.Kind)) {
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

const sourceQualifiedNameForRuntimeTypeOwner = (
  owner: SourceRuntimeOperationOwner | undefined
): LoweringSourceQualifiedNamePlan | undefined =>
  owner ? { namespace: "js._", name: owner } : undefined;

const externalBindingForDeclaration = (
  declaration: TstsNode | undefined,
  exportedName: string
): LoweringExternalBindingReferencePlan | undefined => {
  if (!declaration || declaration.Kind === TstsSyntax.KindTypeParameter) {
    return undefined;
  }
  const declarationSourceFile = getTstsContainingSourceFile(declaration);
  return declarationSourceFile?.IsDeclarationFile === true
    ? externalBindingSourceIdentityForDeclaration(
        declarationSourceFile.FileName(),
        exportedName
      )
    : undefined;
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
    case TstsSyntax.KindTypeParameter:
      return "type-parameter";
    default:
      return undefined;
  }
};

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
        !type.sourceQualifiedName &&
        (type.declarationKind === undefined ||
          type.declarationKind === "type-parameter") &&
        type.typeArguments.length === 0
          ? substitutions.get(type.name)
          : undefined;
      if (replacement) return replacement;
      return {
        ...type,
        typeArguments: type.typeArguments
          .map((argument) => substituteTypePlan(argument, substitutions))
          .filter(
            (argument): argument is LoweringTypeRefPlan =>
              argument !== undefined
          ),
        aliasTarget: substituteTypePlan(type.aliasTarget, substitutions),
      };
    }
    case "array":
      return {
        ...type,
        elementType:
          substituteTypePlan(type.elementType, substitutions) ??
          type.elementType,
      };
    case "record":
      return {
        ...type,
        keyType:
          substituteTypePlan(type.keyType, substitutions) ?? type.keyType,
        valueType:
          substituteTypePlan(type.valueType, substitutions) ?? type.valueType,
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
          .filter(
            (member): member is LoweringTypeRefPlan => member !== undefined
          ),
      };
    case "intersection":
      return {
        ...type,
        types: type.types
          .map((member) => substituteTypePlan(member, substitutions))
          .filter(
            (member): member is LoweringTypeRefPlan => member !== undefined
          ),
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
      return {
        ...member,
        type: substituteTypePlan(member.type, substitutions),
      };
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

const typeParameterTypePlan = (name: string): LoweringTypeRefPlan => ({
  kind: "named",
  name,
  typeArguments: [],
  declarationKind: "type-parameter",
});

const selfTypeParameterSubstitutions = (
  typeParameters: readonly string[]
): TypeSubstitutionMap =>
  aliasTypeSubstitutions(
    typeParameters,
    typeParameters.map(typeParameterTypePlan)
  );

const sourceTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): LoweringTypeRefPlan | undefined => {
  if (!node) return undefined;
  const sourceText = compactNodeSourceText(node);

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
    if (hasSourceDictionaryFactForNode(context, node)) {
      return (
        recordTypePlanFromTypeArguments(
          context,
          sourceFile,
          typeReference.typeArguments,
          sourceText
        ) ?? unsupportedTypePlan(node)
      );
    }
    const projectedType = context.input.facts.get(
      sourceTypeNodeProjectionFactKey,
      node
    )?.type;
    const projectedPlan = sourceBindingProjectionTypePlan(
      context,
      sourceFile,
      projectedType
    );
    if (projectedPlan) return projectedPlan;
    const typeName = typeReference.name;
    const bindingFact = sourceBindingFactForNode(context, node);
    const sourceQualifiedName =
      sourceQualifiedNameForSourceBindingNode(context, node, "type") ??
      sourceQualifiedNameForDeclaration(
        context,
        bindingFact?.declaration,
        typeName,
        "type"
      );
    const declaration = typeDeclarationBindingForDeclaration(
      bindingFact?.declaration,
      sourceFile
    );
    return {
      kind: "named",
      name: typeName,
      typeArguments: typeReference.typeArguments
        .map((argument) => sourceTypePlan(context, sourceFile, argument))
        .filter(
          (argument): argument is LoweringTypeRefPlan => argument !== undefined
        ),
      sourceQualifiedName,
      externalBinding:
        externalBindingForSourceBindingNode(context, node) ??
        externalBindingForDeclaration(bindingFact?.declaration, typeName),
      runtimeVisibility:
        sourceRuntimeVisibilityForNode(context, node) ??
        sourceRuntimeVisibilityForDeclaration(
          context,
          bindingFact?.declaration
        ),
      declaration,
      declarationKind: namedDeclarationKindForDeclaration(
        bindingFact?.declaration
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
        arrayType?.ElementType
      );
      return element
        ? {
            kind: "array",
            elementType: element,
            readonly: false,
            storage: arrayStorageForSourceTypeNode(node, sourceFile),
            sourceText,
          }
        : unsupportedTypePlan(node);
    }
    case TstsSyntax.KindTupleType: {
      const tupleType = TstsSyntax.AsTupleTypeNode(node);
      return {
        kind: "tuple",
        elements: nodeListNodes(tupleType?.Elements)
          .map((element) => sourceTypePlan(context, sourceFile, element))
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
          .map((part) => sourceTypePlan(context, sourceFile, part))
          .filter((part): part is LoweringTypeRefPlan => part !== undefined),
        sourceText,
      };
    }
    case TstsSyntax.KindIntersectionType: {
      const intersectionType = TstsSyntax.AsIntersectionTypeNode(node);
      return {
        kind: "intersection",
        types: nodeListNodes(intersectionType?.Types)
          .map((part) => sourceTypePlan(context, sourceFile, part))
          .filter((part): part is LoweringTypeRefPlan => part !== undefined),
        sourceText,
      };
    }
    case TstsSyntax.KindParenthesizedType: {
      const parenthesized = TstsSyntax.AsParenthesizedTypeNode(node);
      return (
        sourceTypePlan(context, sourceFile, parenthesized?.Type) ??
        unsupportedTypePlan(node)
      );
    }
    case TstsSyntax.KindTypeOperator: {
      const typeOperator = TstsSyntax.AsTypeOperatorNode(node);
      const inner = sourceTypePlan(
        context,
        sourceFile,
        typeOperator?.Type
      );
      if (!inner) return unsupportedTypePlan(node);
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
      const projectedType = context.input.facts.get(
        sourceTypeNodeProjectionFactKey,
        node
      )?.type;
      const projectedPlan = sourceBindingProjectionTypePlan(
        context,
        sourceFile,
        projectedType
      );
      if (projectedPlan) return projectedPlan;
      const name = getTstsExpressionWithTypeArgumentsName(node);
      if (!name) return unsupportedTypePlan(node);
      const sourceQualifiedName = sourceQualifiedNameForSourceBindingNode(
        context,
        node,
        "type"
      );
      return {
        kind: "named",
        name,
        typeArguments: nodeArrayNodes(TstsSyntax.Node_TypeArguments(node))
          .map((argument) =>
            sourceTypePlan(context, sourceFile, argument)
          )
          .filter(
            (argument): argument is LoweringTypeRefPlan =>
              argument !== undefined
          ),
        sourceQualifiedName,
        externalBinding: externalBindingForSourceBindingNode(context, node),
        runtimeVisibility: sourceRuntimeVisibilityForNode(context, node),
        declaration: typeDeclarationBindingForNode(context, sourceFile, node),
        sourceText,
      };
    }
    case TstsSyntax.KindFunctionType:
    case TstsSyntax.KindConstructorType:
      return {
        kind: "function",
        parameters: parameterPlans(sourceFile, node, context, []),
        returnType: sourceTypePlan(
          context,
          sourceFile,
          TstsSyntax.Node_Type(node)
        ),
        typeParameters: typeParameterNames(sourceFile, node),
        sourceText,
      };
    case TstsSyntax.KindTypeLiteral:
      return {
        kind: "object",
        members: (TstsSyntax.Node_Members(node) ?? [])
          .filter((member): member is TstsNode => member !== undefined)
          .map((member) => typeMemberPlan(sourceFile, member, context))
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
          TstsSyntax.Node_Type(node)
        ),
        sourceText,
      };
    case TstsSyntax.KindLiteralType: {
      const literal = TstsSyntax.AsLiteralTypeNode(node)?.Literal;
      if (!literal) return unsupportedTypePlan(node);
      switch (literal.Kind) {
        case TstsSyntax.KindStringLiteral:
        case TstsSyntax.KindNoSubstitutionTemplateLiteral: {
          const valueText = nodeLiteralText(literal);
          if (valueText === undefined) return unsupportedTypePlan(node);
          return {
            kind: "literal",
            literalKind: "string",
            valueText,
            sourceText,
          };
        }
        case TstsSyntax.KindNumericLiteral: {
          const valueText = nodeLiteralText(literal);
          if (valueText === undefined) return unsupportedTypePlan(node);
          return {
            kind: "literal",
            literalKind: "number",
            valueText,
            sourceText,
          };
        }
        case TstsSyntax.KindBigIntLiteral: {
          const valueText = nodeLiteralText(literal);
          if (valueText === undefined) return unsupportedTypePlan(node);
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
          return unsupportedTypePlan(node);
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
    default: {
      const projectedType = context.input.facts.get(
        sourceTypeNodeProjectionFactKey,
        node
      )?.type;
      return (
        sourceBindingProjectionTypePlan(context, sourceFile, projectedType) ??
        unsupportedTypePlan(node)
      );
    }
  }
};

const typeMemberPlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): LoweringTypeMemberPlan | undefined => {
  if (node.Kind === TstsSyntax.KindIndexSignature) {
    const [parameter] = parameterPlans(sourceFile, node, context, []);
    return {
      kind: "index-signature",
      keyType: parameter?.type,
      valueType: sourceTypePlan(
        context,
        sourceFile,
        TstsSyntax.Node_Type(node)
      ),
    };
  }

  const name = propertyNameInfo(node, context);
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
          TstsSyntax.Node_Type(node)
        ),
      };
    case TstsSyntax.KindMethodSignature:
    case TstsSyntax.KindMethodDeclaration:
      return {
        kind: "method",
        name: name.name,
        optional: TstsSyntax.Node_QuestionToken(node) !== undefined,
        parameters: parameterPlans(sourceFile, node, context, []),
        returnType: sourceTypePlan(
          context,
          sourceFile,
          TstsSyntax.Node_Type(node)
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

const typePlanContainsTypeParameter = (
  type: LoweringTypeRefPlan | undefined
): boolean => {
  if (!type) return false;
  switch (type.kind) {
    case "named":
      return (
        type.declarationKind === "type-parameter" ||
        type.typeArguments.some(typePlanContainsTypeParameter) ||
        typePlanContainsTypeParameter(type.aliasTarget)
      );
    case "array":
      return typePlanContainsTypeParameter(type.elementType);
    case "record":
      return (
        typePlanContainsTypeParameter(type.keyType) ||
        typePlanContainsTypeParameter(type.valueType)
      );
    case "tuple":
      return type.elements.some(typePlanContainsTypeParameter);
    case "union":
    case "intersection":
      return type.types.some(typePlanContainsTypeParameter);
    case "function":
      return (
        type.typeParameters.length > 0 ||
        type.parameters.some((parameter) =>
          typePlanContainsTypeParameter(parameter.type)
        ) ||
        typePlanContainsTypeParameter(type.returnType)
      );
    case "object":
      return type.members.some((member) => {
        switch (member.kind) {
          case "property":
            return typePlanContainsTypeParameter(member.type);
          case "method":
            return (
              member.typeParameters.length > 0 ||
              member.parameters.some((parameter) =>
                typePlanContainsTypeParameter(parameter.type)
              ) ||
              typePlanContainsTypeParameter(member.returnType)
            );
          case "index-signature":
            return (
              typePlanContainsTypeParameter(member.keyType) ||
              typePlanContainsTypeParameter(member.valueType)
            );
        }
      });
    case "predicate":
      return typePlanContainsTypeParameter(type.assertedType);
    default:
      return false;
  }
};

const factCallExpectedArgumentTypes = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode
): readonly (LoweringTypeRefPlan | undefined)[] | undefined => {
  const fact = context.input.facts.get(sourceCallArgumentTypesFactKey, node);
  if (!fact) return undefined;
  return fact.argumentTypes.map((type) =>
    sourceBindingProjectionTypePlan(context, sourceFile, type)
  );
};

const factCallTargetTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode
): LoweringTypeRefPlan | undefined =>
  sourceBindingProjectionTypePlan(
    context,
    sourceFile,
    context.input.facts.get(sourceCallArgumentTypesFactKey, node)?.targetType
  );

const sourceProjectedParameterPlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  parameter: SourceParameterTypeProjection
): LoweringParameterPlan => ({
  name: parameter.name,
  sourceKindName: "SourceParameter",
  sourceText: parameter.name,
  type: sourceBindingProjectionTypePlan(context, sourceFile, parameter.type),
  optional: parameter.optional,
  rest: parameter.rest,
});

const expressionTypePlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): LoweringTypeRefPlan | undefined =>
  sourceExpressionProjectedTypePlan(context, sourceFile, node);

const sourceQualifiedNameKey = (
  sourceQualifiedName: LoweringSourceQualifiedNamePlan | undefined
): string | undefined =>
  sourceQualifiedName
    ? [
        sourceQualifiedName.namespace,
        sourceQualifiedName.container,
        sourceQualifiedName.name,
      ]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(".")
    : undefined;

const externalBindingKey = (
  externalBinding: LoweringExternalBindingReferencePlan | undefined
): string | undefined =>
  externalBinding
    ? `${externalBinding.bindingFile}#${externalBinding.sourceName}`
    : undefined;

const loweringTypeIdentityKey = (type: LoweringTypeRefPlan): string => {
  switch (type.kind) {
    case "intrinsic":
      return `intrinsic:${type.name}`;
    case "source-primitive":
      return `source-primitive:${type.fact.kind}:${type.fact.sourceName}`;
    case "named":
      return `named:${sourceQualifiedNameKey(type.sourceQualifiedName) ?? externalBindingKey(type.externalBinding) ?? type.name}<${type.typeArguments.map(loweringTypeIdentityKey).join(",")}>`;
    case "record":
      return `record:${loweringTypeIdentityKey(type.keyType)}:${loweringTypeIdentityKey(type.valueType)}`;
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

const sourceExpressionProjectedStorageTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): LoweringTypeRefPlan | undefined => {
  if (!node) return undefined;
  return sourceExpressionProjectedTypePlan(context, sourceFile, node);
};

const sourceExpressionProjectedTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): LoweringTypeRefPlan | undefined => {
  if (!node) return undefined;
  return sourceBindingProjectionTypePlan(
    context,
    sourceFile,
    context.input.facts.get(sourceExpressionTypeProjectionFactKey, node)?.type
  );
};

const sourceExpressionProjectedContextualTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): LoweringTypeRefPlan | undefined => {
  if (!node) return undefined;
  return sourceBindingProjectionTypePlan(
    context,
    sourceFile,
    context.input.facts.get(sourceExpressionTypeProjectionFactKey, node)
      ?.contextualType
  );
};

const planBase = <TKind extends string>(
  kind: TKind,
  sourceFile: TstsSourceFile,
  sourceNode: TstsNode,
  context?: LoweringBuildContext
) => {
  const name = nodeNameInfo(sourceNode, context);
  return {
    kind,
    sourceFile,
    sourceNode,
    sourceKind: Number(sourceNode.Kind),
    sourceKindName: TstsSyntax.Node_KindString(sourceNode),
    sourceText: nodeSourceText(sourceNode),
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
  return {
    ...planBase("expression", sourceFile, node, context),
    expressionKind: "unsupported",
    type: expressionTypePlan(sourceFile, node, context),
    contextualTypePlan: sourceExpressionProjectedContextualTypePlan(
      context,
      sourceFile,
      node
    ),
    arguments: [],
    typeArguments: [],
    elements: [],
    properties: [],
    templateParts: [],
    parameters: [],
  };
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

const expressionPlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context: LoweringBuildContext
): LoweringExpressionPlan | undefined => {
  if (!node) return undefined;
  const contextualTypePlan = sourceExpressionProjectedContextualTypePlan(
    context,
    sourceFile,
    node
  );
  const base = {
    ...planBase("expression", sourceFile, node, context),
    type: expressionTypePlan(sourceFile, node, context),
    contextualTypePlan,
    semantic: expressionSemantic(node, context),
    sourceOperation: context.input.facts.get(
      sourceRuntimeOperationFactKey,
      node
    ),
    resolvedAliasName: context.input.facts.get(
      genericFunctionAliasFactKey,
      node
    )?.resolvedName,
    sourceQualifiedName: sourceQualifiedNameForSourceBindingNode(
      context,
      node,
      "value"
    ),
    externalBinding: externalBindingForSourceBindingNode(context, node),
    intrinsicKind: context.input.facts.get(intrinsicSemanticsFactKey, node)
      ?.kind,
    passingMode: context.input.facts.get(parameterPassingFactKey, node)?.mode,
    arguments: [] as readonly LoweringExpressionPlan[],
    typeArguments: [] as readonly LoweringTypeRefPlan[],
    elements: [] as readonly LoweringExpressionPlan[],
    properties: [] as readonly LoweringObjectPropertyPlan[],
    templateParts: [] as readonly LoweringTemplatePartPlan[],
    parameters: [] as readonly LoweringParameterPlan[],
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
        storageTypePlan: sourceExpressionProjectedStorageTypePlan(
          context,
          sourceFile,
          node
        ),
        literalText: nodeTokenText(node) ?? nodeName(node),
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
          context
        ),
      };
    case TstsSyntax.KindAsExpression:
    case TstsSyntax.KindSatisfiesExpression:
    case TstsSyntax.KindTypeAssertionExpression: {
      const wrapperType = TstsSyntax.Node_Type(node);
      const assertedType = sourceTypePlan(context, sourceFile, wrapperType);
      const wrappedExpression = TstsSyntax.Node_Expression(node);
      const wrappedType = wrappedExpression
        ? expressionTypePlan(sourceFile, wrappedExpression, context)
        : undefined;
      const erasedWrapperType =
        assertedType ??
        sourceExpressionProjectedStorageTypePlan(
          context,
          sourceFile,
          wrappedExpression
        ) ??
        wrappedType ??
        base.type;
      return {
        ...base,
        type: erasedWrapperType,
        expressionKind: "erased-wrapper",
        passingMode:
          (wrapperType
            ? context.input.facts.get(parameterPassingFactKey, wrapperType)
                ?.mode
            : undefined) ?? base.passingMode,
        expression: expressionPlan(sourceFile, wrappedExpression, context),
      };
    }
    case TstsSyntax.KindNonNullExpression: {
      const wrappedExpression = TstsSyntax.Node_Expression(node);
      const wrappedType = wrappedExpression
        ? expressionTypePlan(sourceFile, wrappedExpression, context)
        : undefined;
      const nonNullType =
        sourceExpressionProjectedStorageTypePlan(
          context,
          sourceFile,
          wrappedExpression
        ) ??
        wrappedType ??
        base.type;
      return {
        ...base,
        type: nonNullType,
        expressionKind: "non-null",
        expression: expressionPlan(sourceFile, wrappedExpression, context),
      };
    }
    case TstsSyntax.KindAwaitExpression:
      return {
        ...base,
        expressionKind: "await",
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context
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
          context
        ),
      };
    case TstsSyntax.KindBinaryExpression: {
      const binary = TstsSyntax.AsBinaryExpression(node);
      if (!binary) return unsupportedExpression(sourceFile, node, context);
      const binaryOperator = binaryOperatorFromKind(binary.OperatorToken?.Kind);
      const left = expressionPlan(sourceFile, binary.Left, context);
      const right = expressionPlan(sourceFile, binary.Right, context);
      return {
        ...base,
        expressionKind: "binary",
        left,
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
          context
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
    case TstsSyntax.KindPropertyAccessExpression: {
      const name = TstsSyntax.Node_Name(node);
      const receiverNode = TstsSyntax.Node_Expression(node);
      const receiverStorageTypePlan = sourceExpressionProjectedStorageTypePlan(
        context,
        sourceFile,
        receiverNode
      );
      return {
        ...base,
        expressionKind: "property-access",
        expression: expressionPlan(sourceFile, receiverNode, context),
        receiverTypePlan: receiverStorageTypePlan,
        storageTypePlan: sourceExpressionProjectedStorageTypePlan(
          context,
          sourceFile,
          node
        ),
        optionalAccess:
          TstsSyntax.AsPropertyAccessExpression(node)?.QuestionDotToken !==
          undefined,
        literalText: nodeTokenText(name) ?? nodeName(node),
      };
    }
    case TstsSyntax.KindElementAccessExpression: {
      const element = TstsSyntax.AsElementAccessExpression(node);
      if (!element) return unsupportedExpression(sourceFile, node, context);
      return {
        ...base,
        expressionKind: "element-access",
        expression: expressionPlan(sourceFile, element.Expression, context),
        receiverTypePlan: sourceExpressionProjectedStorageTypePlan(
          context,
          sourceFile,
          element.Expression
        ),
        storageTypePlan: sourceExpressionProjectedStorageTypePlan(
          context,
          sourceFile,
          node
        ),
        optionalAccess: element.QuestionDotToken !== undefined,
        arguments: [
          expressionPlan(sourceFile, element.ArgumentExpression, context),
        ].filter((item): item is LoweringExpressionPlan => item !== undefined),
      };
    }
    case TstsSyntax.KindCallExpression:
    case TstsSyntax.KindNewExpression: {
      const calleeNode = TstsSyntax.Node_Expression(node);
      const overloadImplementation = context.input.facts.get(
        sourceOverloadCallImplementationFactKey,
        node
      )?.implementation;
      const callee = expressionPlan(sourceFile, calleeNode, context);
      const resolvedCallee =
        overloadImplementation && callee
          ? {
              ...callee,
              resolvedAliasName:
                nodeName(overloadImplementation) ?? callee?.resolvedAliasName,
              type: undefined,
              contextualTypePlan: undefined,
              storageTypePlan: undefined,
            }
          : callee;
      const overloadArgumentTypes = overloadImplementation
        ? parameterPlans(
            sourceFileForNode(overloadImplementation, sourceFile),
            overloadImplementation,
            context
          ).map((parameter) => parameter.type)
        : undefined;
      const argumentUseSiteTypes =
        overloadArgumentTypes ??
        factCallExpectedArgumentTypes(context, sourceFile, node) ??
        [];
      return {
        ...base,
        expressionKind:
          node.Kind === TstsSyntax.KindNewExpression ? "new" : "call",
        expression: resolvedCallee,
        storageTypePlan: sourceExpressionProjectedStorageTypePlan(
          context,
          sourceFile,
          node
        ),
        callTargetTypePlan: overloadImplementation
          ? undefined
          : node.Kind === TstsSyntax.KindCallExpression
            ? (factCallTargetTypePlan(context, sourceFile, node) ??
              sourceExpressionProjectedStorageTypePlan(
                context,
                sourceFile,
                calleeNode
              ))
            : undefined,
        arguments: (TstsSyntax.Node_Arguments(node) ?? [])
          .map((argument) => expressionPlan(sourceFile, argument, context))
          .filter((item): item is LoweringExpressionPlan => item !== undefined),
        argumentUseSiteTypes,
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
      const expectedFunction = functionTypeParts(base.contextualTypePlan);
      const returnType = explicitReturnType
        ? sourceTypePlan(context, sourceFile, explicitReturnType)
        : (expectedFunction?.returnType ??
          sourceExpressionProjectedStorageTypePlan(context, sourceFile, node));
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
          : expressionPlan(sourceFile, body, context),
      };
    }
    case TstsSyntax.KindArrayLiteralExpression: {
      return {
        ...base,
        expressionKind: "array-literal",
        elements: (TstsSyntax.Node_Elements(node) ?? [])
          .map((element) => expressionPlan(sourceFile, element, context))
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
            const name = propertyNameInfo(property, context);
            const value =
              property?.Kind === TstsSyntax.KindShorthandPropertyAssignment
                ? expressionPlan(
                    sourceFile,
                    TstsSyntax.Node_Name(property),
                    context
                  )
                : expressionPlan(
                    sourceFile,
                    TstsSyntax.Node_Initializer(property),
                    context
                  );
            return value
              ? {
                  name: name.name,
                  sourceKindName:
                    name.sourceKindName ?? TstsSyntax.Node_KindString(property),
                  sourceText: name.sourceText ?? nodeSourceText(property),
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
      return {
        ...base,
        expressionKind: "conditional",
        condition: expressionPlan(sourceFile, conditional.Condition, context),
        whenTrue: expressionPlan(sourceFile, conditional.WhenTrue, context),
        whenFalse: expressionPlan(sourceFile, conditional.WhenFalse, context),
      };
    }
    default:
      return unsupportedExpression(sourceFile, node, context);
  }
};

const sourceBindingProjectionTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  type: SourceBindingProjectedType | undefined,
  seen: ReadonlySet<SourceBindingProjectedType> = new Set()
): LoweringTypeRefPlan | undefined => {
  if (!type) return undefined;
  if (seen.has(type)) return undefined;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  switch (type.kind) {
    case "type-node":
      return sourceTypePlan(
        context,
        sourceFileForNode(type.node, sourceFile),
        type.node
      );
    case "intrinsic":
      return {
        kind: "intrinsic",
        name: type.name,
        sourceText: type.sourceNode
          ? compactNodeSourceText(type.sourceNode)
          : undefined,
      };
    case "source-primitive":
      return {
        kind: "source-primitive",
        fact: type.fact,
        sourceText: type.sourceNode
          ? compactNodeSourceText(type.sourceNode)
          : undefined,
      };
    case "named": {
      const declarationSourceFile = type.declaration
        ? sourceFileForNode(type.declaration, sourceFile)
        : sourceFile;
      const declaration = typeDeclarationBindingForDeclaration(
        type.declaration,
        declarationSourceFile
      );
      const typeArguments = type.typeArguments
        .map((argument) =>
          sourceBindingProjectionTypePlan(
            context,
            sourceFile,
            argument,
            nextSeen
          )
        )
        .filter(
          (argument): argument is LoweringTypeRefPlan => argument !== undefined
        );
      const aliasTarget = sourceBindingProjectionTypePlan(
        context,
        sourceFile,
        type.aliasTarget,
        nextSeen
      );
      const substitutions = type.declaration
        ? aliasTypeSubstitutions(
            typeParameterNames(declarationSourceFile, type.declaration),
            typeArguments
          )
        : new Map<string, LoweringTypeRefPlan>();
      return {
        kind: "named",
        name: type.name,
        typeArguments,
        aliasTarget: substituteTypePlan(aliasTarget, substitutions),
        sourceQualifiedName:
          sourceQualifiedNameForRuntimeTypeOwner(type.runtimeTypeOwner) ??
          sourceQualifiedNameForSourceBindingNode(
            context,
            type.declaration,
            "type"
          ) ??
          sourceQualifiedNameForDeclaration(
            context,
            type.declaration,
            type.name,
            "type"
          ),
        externalBinding:
          externalBindingForSourceBindingNode(context, type.declaration) ??
          externalBindingForDeclaration(type.declaration, type.name),
        runtimeVisibility:
          type.runtimeVisibility ??
          sourceRuntimeVisibilityForDeclaration(context, type.declaration),
        declaration,
        declarationKind:
          type.declarationKind ??
          namedDeclarationKindForDeclaration(type.declaration),
        sourceText: type.sourceNode
          ? compactNodeSourceText(type.sourceNode)
          : undefined,
      };
    }
    case "record": {
      const keyType = sourceBindingProjectionTypePlan(
        context,
        sourceFile,
        type.keyType,
        nextSeen
      );
      const valueType = sourceBindingProjectionTypePlan(
        context,
        sourceFile,
        type.valueType,
        nextSeen
      );
      return keyType && valueType
        ? {
            kind: "record",
            keyType,
            valueType,
            sourceText: type.sourceNode
              ? compactNodeSourceText(type.sourceNode)
              : undefined,
          }
        : undefined;
    }
    case "function":
      return {
        kind: "function",
        parameters: type.parameters.map((parameter) =>
          sourceProjectedParameterPlan(context, sourceFile, parameter)
        ),
        returnType: sourceBindingProjectionTypePlan(
          context,
          sourceFile,
          type.returnType,
          nextSeen
        ),
        typeParameters: type.typeParameters,
        sourceText: type.sourceNode
          ? compactNodeSourceText(type.sourceNode)
          : undefined,
      };
    case "array": {
      const elementType = sourceBindingProjectionTypePlan(
        context,
        sourceFile,
        type.elementType,
        nextSeen
      );
      return elementType
        ? {
            kind: "array",
            elementType,
            readonly: type.readonly,
            storage: arrayStorageForSourceTypeNode(type.sourceNode, sourceFile),
            sourceText: type.sourceNode
              ? compactNodeSourceText(type.sourceNode)
              : undefined,
          }
        : undefined;
    }
    case "tuple":
      return {
        kind: "tuple",
        elements: type.elements
          .map((element) =>
            sourceBindingProjectionTypePlan(
              context,
              sourceFile,
              element,
              nextSeen
            )
          )
          .filter(
            (element): element is LoweringTypeRefPlan => element !== undefined
          ),
        readonly: type.readonly,
        sourceText: type.sourceNode
          ? compactNodeSourceText(type.sourceNode)
          : undefined,
      };
    case "object":
      return {
        kind: "object",
        members: type.members.map((member) => ({
          kind: "property",
          name: member.name,
          optional: member.optional,
          type: sourceBindingProjectionTypePlan(
            context,
            sourceFile,
            member.type,
            nextSeen
          ),
        })),
        sourceText: type.sourceNode
          ? compactNodeSourceText(type.sourceNode)
          : undefined,
      };
    case "union": {
      const types = type.types
        .map((member) =>
          sourceBindingProjectionTypePlan(context, sourceFile, member, nextSeen)
        )
        .filter(
          (member): member is LoweringTypeRefPlan => member !== undefined
        );
      const unique = new Map<string, LoweringTypeRefPlan>();
      for (const member of types) {
        unique.set(loweringTypeIdentityKey(member), member);
      }
      const members = [...unique.values()];
      if (members.length === 0) return undefined;
      if (members.length === 1) return members[0];
      return {
        kind: "union",
        types: members,
        sourceText: type.sourceNode
          ? compactNodeSourceText(type.sourceNode)
          : undefined,
      };
    }
    case "intersection": {
      const types = type.types
        .map((member) =>
          sourceBindingProjectionTypePlan(context, sourceFile, member, nextSeen)
        )
        .filter(
          (member): member is LoweringTypeRefPlan => member !== undefined
        );
      return types.length > 0
        ? {
            kind: "intersection",
            types,
            sourceText: type.sourceNode
              ? compactNodeSourceText(type.sourceNode)
              : undefined,
          }
        : undefined;
    }
  }
};

const bindingElementsFromName = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context: LoweringBuildContext,
  accessPath: readonly LoweringBindingAccessPlan[] = []
): readonly LoweringBindingElementPlan[] => {
  if (!node) return [];
  if (node.Kind === TstsSyntax.KindIdentifier) {
    const name = nodeTokenText(node);
    if (!name || accessPath.length === 0) return [];
    const projectedType = sourceBindingProjectionTypePlan(
      context,
      sourceFile,
      context.input.facts.get(sourceBindingTypeProjectionFactKey, node)?.type
    );
    return [
      {
        name,
        type: projectedType,
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
        access
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

const variablePlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): LoweringVariablePlan => {
  const variable = TstsSyntax.AsVariableDeclaration(node);
  const declaredType = variable?.Type ?? TstsSyntax.Node_Type(node);
  const type = sourceTypePlan(context, sourceFile, declaredType);
  const nameNode = TstsSyntax.Node_Name(node);
  const initializerNode =
    variable?.Initializer ?? TstsSyntax.Node_Initializer(node);
  const initializerStorage = sourceExpressionProjectedStorageTypePlan(
    context,
    sourceFile,
    initializerNode
  );
  const storageType = type ?? initializerStorage;
  const genericAlias = context.input.facts.get(
    genericFunctionAliasFactKey,
    node
  );
  return {
    sourceNode: node,
    name: nodeName(node) ?? nodeSourceText(nameNode ?? node),
    type,
    storageType,
    initializer: expressionPlan(sourceFile, initializerNode, context),
    bindingElements: bindingElementsFromName(sourceFile, nameNode, context),
    compileTimeOnly:
      genericAlias !== undefined ||
      nodeOrAncestorHasModifier(node, TstsSyntax.ModifierFlagsAmbient),
    initializerReferencesDeclaration: context.input.facts.get(
      sourceInitializerReferencesDeclarationFactKey,
      node
    )?.referencesDeclaration,
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
        expression: expressionPlan(sourceFile, statement?.Expression, context),
      };
    }
    case TstsSyntax.KindExpressionStatement: {
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
      return "method";
    case TstsSyntax.KindCallSignature:
      return "call-signature";
    case TstsSyntax.KindConstructSignature:
      return "construct-signature";
    case TstsSyntax.KindIndexSignature:
      return "index-signature";
    case TstsSyntax.KindPropertyDeclaration:
    case TstsSyntax.KindPropertySignature:
      return "property";
    case TstsSyntax.KindGetAccessor:
      return "get-accessor";
    case TstsSyntax.KindSetAccessor:
      return "set-accessor";
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
  expectedParameterTypes: readonly (LoweringTypeRefPlan | undefined)[] = []
): readonly LoweringParameterPlan[] =>
  (TstsSyntax.Node_Parameters(node) ?? [])
    .filter((parameter): parameter is TstsNode => parameter !== undefined)
    .map((parameter, index): LoweringParameterPlan => {
      const explicitType = TstsSyntax.Node_Type(parameter);
      const declarationTypeFact = context.input.facts.get(
        sourceDeclarationTypeProjectionFactKey,
        parameter
      );
      const explicitTypePlan = sourceTypePlan(
        context,
        sourceFile,
        explicitType
      );
      const declarationTypePlan = sourceBindingProjectionTypePlan(
        context,
        sourceFile,
        declarationTypeFact?.declaredType
      );
      return {
        name: nodeName(parameter) ?? "",
        ...parameterPlanSource(parameter),
        type:
          explicitTypePlan ??
          expectedParameterTypes[index] ??
          declarationTypePlan,
        initializer: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Initializer(parameter),
          context
        ),
        optional: TstsSyntax.Node_QuestionToken(parameter) !== undefined,
        rest:
          TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken !==
          undefined,
        extensionReceiver:
          hasExtensionReceiverFact(context, parameter) ||
          hasExtensionReceiverFact(context, explicitType),
      };
    });

const enumMembers = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): readonly LoweringEnumMemberPlan[] => {
  const declaration = TstsSyntax.AsEnumDeclaration(node);
  return nodeListNodes(declaration?.Members).map((member) => {
    const nameNode = TstsSyntax.Node_Name(member);
    return {
      name: nodeName(member) ?? "",
      sourceKindName: TstsSyntax.Node_KindString(member),
      sourceText: nodeSourceText(member),
      nameSourceText: nameNode ? nodeSourceText(nameNode) : undefined,
      initializer: expressionPlan(
        sourceFile,
        TstsSyntax.AsEnumMember(member)?.Initializer,
        context
      ),
    };
  });
};

const baseConstructorParameters = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): readonly LoweringParameterPlan[] => {
  return (
    context.input.facts
      .get(sourceDeclarationTypeProjectionFactKey, node)
      ?.baseConstructorParameters?.map((parameter) =>
        sourceProjectedParameterPlan(context, sourceFile, parameter)
      ) ?? []
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

const declarationAttributeTargetKind = (
  kind: LoweringDeclarationPlan["declarationKind"]
): "type" | "constructor" | "method" | "property" | undefined => {
  switch (kind) {
    case "class":
    case "enum":
    case "interface":
    case "type-alias":
      return "type";
    case "constructor":
      return "constructor";
    case "function":
    case "method":
      return "method";
    case "property":
    case "get-accessor":
    case "set-accessor":
      return "property";
    default:
      return undefined;
  }
};

const attributePlans = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext,
  targetKind: ReturnType<typeof declarationAttributeTargetKind>
): readonly LoweringAttributePlan[] => {
  if (!targetKind) return [];
  return (
    context.input.facts.get(sourceAttributeApplicationsFactKey, node)
      ?.applications ?? []
  )
    .filter((application) => application.targetKind === targetKind)
    .map((application): LoweringAttributePlan | undefined => {
      const attributeSourceFile = sourceFileForNode(
        application.attributeType,
        sourceFile
      );
      const attributeType = expressionPlan(
        attributeSourceFile,
        application.attributeType,
        context
      );
      if (!attributeType) return undefined;
      return {
        targetSpecifier: application.targetSpecifier,
        attributeType,
        arguments: application.arguments
          .map((argument) =>
            expressionPlan(
              sourceFileForNode(argument, sourceFile),
              argument,
              context
            )
          )
          .filter(
            (argument): argument is LoweringExpressionPlan =>
              argument !== undefined
          ),
      };
    })
    .filter((plan): plan is LoweringAttributePlan => plan !== undefined);
};

const declarationPlan = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context: LoweringBuildContext
): LoweringDeclarationPlan | undefined => {
  if (!node || !isDeclarationNode(node)) return undefined;
  const kind = declarationKind(node);
  const explicitReturnType = TstsSyntax.Node_Type(node);
  const declarationTypeFact = context.input.facts.get(
    sourceDeclarationTypeProjectionFactKey,
    node
  );
  const initializerNode = TstsSyntax.Node_Initializer(node);
  const typeParameters = typeParameterNames(sourceFile, node);
  const ownTypeParameterSubstitutions =
    selfTypeParameterSubstitutions(typeParameters);
  const projectedTypeAliasTarget =
    kind === "type-alias"
      ? sourceBindingProjectionTypePlan(
          context,
          sourceFile,
          declarationTypeFact?.returnType
        )
      : undefined;
  const typeAliasTarget =
    kind === "type-alias"
      ? substituteTypePlan(projectedTypeAliasTarget, ownTypeParameterSubstitutions)
      : undefined;
  const projectedReturnType =
    sourceBindingProjectionTypePlan(
      context,
      sourceFile,
      declarationTypeFact?.returnType
    ) ?? sourceTypePlan(context, sourceFile, explicitReturnType);
  const projectedDeclaredTypePlan =
    sourceBindingProjectionTypePlan(
      context,
      sourceFile,
      declarationTypeFact?.declaredType
    ) ?? sourceTypePlan(context, sourceFile, TstsSyntax.Node_Type(node));
  const returnType =
    kind === "type-alias"
      ? undefined
      : substituteTypePlan(projectedReturnType, ownTypeParameterSubstitutions);
  const declaredTypePlan =
    kind === "type-alias"
      ? undefined
      : substituteTypePlan(
          projectedDeclaredTypePlan,
          ownTypeParameterSubstitutions
        );
  const attributeTargetKind = declarationAttributeTargetKind(kind);
  return {
    ...planBase("declaration", sourceFile, node, context),
    declarationKind: kind,
    declaredTypePlan,
    typeAliasTarget,
    sourceTypeKind: context.input.facts.get(sourceTypeSemanticsFactKey, node)
      ?.kind,
    fieldSemantics: isFieldSemanticsFact(
      context.input.facts.get(fieldSemanticsFactKey, node)
    )
      ? "field"
      : undefined,
    attributes: attributePlans(sourceFile, node, context, attributeTargetKind),
    constructorAttributes: attributePlans(
      sourceFile,
      node,
      context,
      "constructor"
    ),
    heritageTypes: runtimeHeritageTypeNodes(context, node)
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
    typeParameters,
    returnType,
    body: statementPlan(
      sourceFile,
      TstsSyntax.Node_Body(node),
      context,
      returnType
    ),
    initializer: expressionPlan(sourceFile, initializerNode, context),
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
  readonly statements: LoweringStatementPlan[];
  readonly expressions: LoweringExpressionPlan[];
};

const createBuckets = (): PlanBuckets => ({
  declarations: [],
  statements: [],
  expressions: [],
});

export const buildLoweringPlansForSourceFile = (
  sourceFile: TstsSourceFile,
  context: LoweringBuildContext
): PlanBuckets => {
  const buckets = createBuckets();

  visitTstsNodes(sourceFile, (node) => {
    const declaration = declarationPlan(sourceFile, node, context);
    if (declaration) {
      buckets.declarations.push(declaration);
    }

    if (isTypeNode(node)) return;

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
