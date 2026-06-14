import {
  getTstsExpressionWithTypeArgumentsName,
  getTstsHeritageTypeNodes,
  getTstsContainingSourceFile,
  getTstsTypeReferenceDetails,
  TstsSyntax,
} from "@tsonic/tsts";
import type { TstsNode, TstsSourceFile, TstsType } from "@tsonic/tsts";
import {
  intrinsicSemanticsFactKey,
  numericPrimitiveFactKey,
  parameterPassingFactKey,
  selectedSignatureFactKey,
} from "../source-frontend/source-facts.js";
import type {
  LoweringBindingAccessPlan,
  LoweringBindingElementPlan,
  LoweringBuildContext,
  LoweringCallPlan,
  LoweringDeclarationPlan,
  LoweringEnumMemberPlan,
  LoweringExpressionPlan,
  LoweringIndexAccessPlan,
  LoweringIntrinsicTypeName,
  LoweringMemberAccessPlan,
  LoweringNarrowingPlan,
  LoweringObjectPropertyPlan,
  LoweringParameterPlan,
  LoweringStatementPlan,
  LoweringSyntheticDeclarationPlan,
  LoweringTemplatePartPlan,
  LoweringTypeMemberPlan,
  LoweringTypePlan,
  LoweringTypeRefPlan,
  LoweringVariablePlan,
} from "./types.js";
import {
  isDeclarationNode,
  isExpressionNode,
  isStatementNode,
  isTypeNode,
  visitTstsNodes,
} from "./tsts-node-classification.js";

const nodeSourceText = (
  sourceFile: TstsSourceFile,
  node: TstsNode
): string => {
  const text = sourceFile.Text();
  const pos = Math.max(0, Math.min(TstsSyntax.Node_Pos(node), text.length));
  const end = Math.max(pos, Math.min(TstsSyntax.Node_End(node), text.length));
  return text.slice(pos, end);
};

const nodeTokenText = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): string | undefined => {
  if (!node) return undefined;
  try {
    const text = TstsSyntax.Node_Text(node);
    return text === "" ? undefined : text;
  } catch {
    const text = nodeSourceText(sourceFile, node);
    return text === "" ? undefined : text;
  }
};

type NodeNameInfo = {
  readonly name?: string;
  readonly sourceKindName?: string;
  readonly sourceText?: string;
  readonly computed: boolean;
  readonly computedName?: "symbol-iterator" | "symbol-async-iterator";
};

const computedWellKnownName = (
  node: TstsNode | undefined
): NodeNameInfo["computedName"] => {
  if (!node || node.Kind !== TstsSyntax.KindComputedPropertyName) return undefined;
  const expression = TstsSyntax.Node_Expression(node);
  if (expression?.Kind !== TstsSyntax.KindPropertyAccessExpression) return undefined;
  const receiver = TstsSyntax.Node_Expression(expression);
  const member = TstsSyntax.Node_Name(expression);
  if (receiver?.Kind !== TstsSyntax.KindIdentifier || member?.Kind !== TstsSyntax.KindIdentifier) {
    return undefined;
  }
  if (TstsSyntax.Node_Text(receiver) !== "Symbol") return undefined;
  switch (TstsSyntax.Node_Text(member)) {
    case "iterator":
      return "symbol-iterator";
    case "asyncIterator":
      return "symbol-async-iterator";
    default:
      return undefined;
  }
};

const nodeNameInfo = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
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
      computedName: computedWellKnownName(nameNode),
    };
  }
  return {
    name: nodeTokenText(sourceFile, nameNode),
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
  node: TstsNode | undefined
): NodeNameInfo => {
  if (!node) return { computed: false };
  const nameNode = TstsSyntax.Node_PropertyNameOrName(node);
  if (!nameNode) return nodeNameInfo(sourceFile, node);
  const sourceKindName = TstsSyntax.Node_KindString(nameNode);
  const sourceText = nodeSourceText(sourceFile, nameNode);
  if (nameNode.Kind === TstsSyntax.KindComputedPropertyName) {
    return {
      sourceKindName,
      sourceText,
      computed: true,
      computedName: computedWellKnownName(nameNode),
    };
  }
  return {
    name: nodeTokenText(sourceFile, nameNode),
    sourceKindName,
    sourceText,
    computed: false,
  };
};

const modifierFlags = (node: TstsNode): number =>
  Number(TstsSyntax.Node_ModifierFlags(node));

const nodeHasModifier = (node: TstsNode, flag: number): boolean =>
  (modifierFlags(node) & flag) !== 0;

const compactNodeSourceText = (
  sourceFile: TstsSourceFile,
  node: TstsNode
): string => nodeSourceText(sourceFile, node).replace(/\s+/g, " ").trim();

const templateFragmentText = (
  sourceFile: TstsSourceFile,
  node: TstsNode
): string => {
  const text = nodeSourceText(sourceFile, node);
  return text
    .replace(/^`/, "")
    .replace(/^\}/, "")
    .replace(/\$\{$/, "")
    .replace(/`$/, "");
};

const nodeListNodes = (
  list: { readonly Nodes?: readonly (TstsNode | undefined)[] } | undefined
): readonly TstsNode[] =>
  (list?.Nodes ?? []).filter((node): node is TstsNode => node !== undefined);

const nodeArrayNodes = (
  nodes: readonly (TstsNode | undefined)[] | undefined
): readonly TstsNode[] =>
  (nodes ?? []).filter((node): node is TstsNode => node !== undefined);

const typeParameterNames = (
  sourceFile: TstsSourceFile,
  node: TstsNode
): readonly string[] =>
  nodeArrayNodes(TstsSyntax.Node_TypeParameters(node))
    .map((typeParameter) => nodeTokenText(sourceFile, TstsSyntax.Node_Name(typeParameter)))
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

const checkerTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  type: TstsType | undefined
): LoweringTypeRefPlan | undefined => {
  if (!type) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const unionMembers = checker.getUnionMembers(type);
  if (unionMembers && unionMembers.length > 0) {
    return {
      kind: "union",
      types: unionMembers
        .map((member) => checkerTypePlan(context, sourceFile, member))
        .filter((member): member is LoweringTypeRefPlan => member !== undefined),
    };
  }
  const intersectionMembers = checker.getIntersectionMembers(type);
  if (intersectionMembers && intersectionMembers.length > 0) {
    return {
      kind: "intersection",
      types: intersectionMembers
        .map((member) => checkerTypePlan(context, sourceFile, member))
        .filter((member): member is LoweringTypeRefPlan => member !== undefined),
    };
  }
  const arrayElement = checker.getElementTypeOfArrayType(type);
  if (arrayElement) {
    return {
      kind: "array",
      elementType:
        checkerTypePlan(context, sourceFile, arrayElement) ??
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
          type: checkerTypePlan(context, sourceFile, parameterType),
          optional: false,
          rest: false,
        };
      }),
      returnType: checkerTypePlan(
        context,
        sourceFile,
        checker.getReturnTypeOfSignature(signature)
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
        .map((argument) => checkerTypePlan(context, sourceFile, argument))
        .filter((argument): argument is LoweringTypeRefPlan => argument !== undefined),
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
          type: checkerTypePlan(
            context,
            sourceFile,
            declaration
              ? checker.getTypeOfSymbolAtLocation(property, declaration)
              : undefined
          ),
        };
      }),
    };
  }

  return intrinsicTypePlan("unknown");
};

const typePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  type: TstsType | undefined
): LoweringTypeRefPlan | undefined => {
  if (node) {
    return sourceTypePlan(context, sourceFile, node);
  }
  return checkerTypePlan(context, sourceFile, type);
};

const sourceTypePlan = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
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
    return {
      kind: "named",
      name: typeReference.name,
      typeArguments: typeReference.typeArguments
        .map((argument) => sourceTypePlan(context, sourceFile, argument))
        .filter((argument): argument is LoweringTypeRefPlan => argument !== undefined),
      sourceText,
    };
  }

  switch (node.Kind) {
    case TstsSyntax.KindArrayType: {
      const arrayType = TstsSyntax.AsArrayTypeNode(node);
      const element = sourceTypePlan(context, sourceFile, arrayType?.ElementType);
      return element
        ? { kind: "array", elementType: element, readonly: false, sourceText }
        : unsupportedTypePlan(sourceFile, node);
    }
    case TstsSyntax.KindTupleType: {
      const tupleType = TstsSyntax.AsTupleTypeNode(node);
      return {
        kind: "tuple",
        elements: nodeListNodes(tupleType?.Elements)
          .map((element) => sourceTypePlan(context, sourceFile, element))
          .filter((element): element is LoweringTypeRefPlan => element !== undefined),
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
        unsupportedTypePlan(sourceFile, node)
      );
    }
    case TstsSyntax.KindTypeOperator: {
      const typeOperator = TstsSyntax.AsTypeOperatorNode(node);
      const inner = sourceTypePlan(context, sourceFile, typeOperator?.Type);
      if (!inner) return unsupportedTypePlan(sourceFile, node);
      if (typeOperator?.Operator !== TstsSyntax.KindReadonlyKeyword) return inner;
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
              .map((argument) => sourceTypePlan(context, sourceFile, argument))
              .filter(
                (argument): argument is LoweringTypeRefPlan =>
                  argument !== undefined
              ),
            sourceText,
          }
        : unsupportedTypePlan(sourceFile, node);
    }
    case TstsSyntax.KindFunctionType:
    case TstsSyntax.KindConstructorType:
      return {
        kind: "function",
        parameters: parameterPlans(sourceFile, node, context),
        returnType: sourceTypePlan(context, sourceFile, TstsSyntax.Node_Type(node)),
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
        assertedType: sourceTypePlan(context, sourceFile, TstsSyntax.Node_Type(node)),
        sourceText,
      };
    case TstsSyntax.KindLiteralType: {
      const literal = TstsSyntax.AsLiteralTypeNode(node)?.Literal;
      if (!literal) return unsupportedTypePlan(sourceFile, node);
      switch (literal.Kind) {
        case TstsSyntax.KindStringLiteral:
        case TstsSyntax.KindNoSubstitutionTemplateLiteral:
          return {
            kind: "literal",
            literalKind: "string",
            valueText: nodeTokenText(sourceFile, literal) ?? sourceText,
            sourceText,
          };
        case TstsSyntax.KindNumericLiteral:
          return {
            kind: "literal",
            literalKind: "number",
            valueText: nodeTokenText(sourceFile, literal) ?? sourceText,
            sourceText,
          };
        case TstsSyntax.KindBigIntLiteral:
          return {
            kind: "literal",
            literalKind: "bigint",
            valueText: nodeTokenText(sourceFile, literal) ?? sourceText,
            sourceText,
          };
        case TstsSyntax.KindTrueKeyword:
        case TstsSyntax.KindFalseKeyword:
          return {
            kind: "literal",
            literalKind: "boolean",
            valueText: literal.Kind === TstsSyntax.KindTrueKeyword ? "true" : "false",
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
  context: LoweringBuildContext
): LoweringTypeMemberPlan | undefined => {
  const name = propertyNameInfo(sourceFile, node);
  if (name.computed || !name.name) return undefined;
  switch (node.Kind) {
    case TstsSyntax.KindPropertySignature:
    case TstsSyntax.KindPropertyDeclaration:
      return {
        kind: "property",
        name: name.name,
        optional: TstsSyntax.Node_QuestionToken(node) !== undefined,
        type: sourceTypePlan(context, sourceFile, TstsSyntax.Node_Type(node)),
      };
    case TstsSyntax.KindMethodSignature:
    case TstsSyntax.KindMethodDeclaration:
      return {
        kind: "method",
        name: name.name,
        optional: TstsSyntax.Node_QuestionToken(node) !== undefined,
        parameters: parameterPlans(sourceFile, node, context),
        returnType: sourceTypePlan(context, sourceFile, TstsSyntax.Node_Type(node)),
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
  const selected =
    context.input.facts.get(selectedSignatureFactKey, node)?.signature ??
    checker.getResolvedSignature(node);
  if (!selected) return [];
  return checker.getSignatureParameters(selected).map((parameter) => {
    const declaration =
      checker.getSymbolValueDeclaration(parameter) ??
      checker.getSymbolDeclarations(parameter)[0];
    const typeNode = declaration ? TstsSyntax.Node_Type(declaration) : undefined;
    if (typeNode) {
      return sourceTypePlan(
        context,
        getTstsContainingSourceFile(typeNode) ?? sourceFile,
        typeNode
      );
    }
    const parameterType = declaration
      ? checker.getTypeOfSymbolAtLocation(parameter, declaration)
      : undefined;
    return checkerTypePlan(context, sourceFile, parameterType);
  });
};

const planBase = <TKind extends string>(
  kind: TKind,
  sourceFile: TstsSourceFile,
  sourceNode: TstsNode
) => {
  const name = nodeNameInfo(sourceFile, sourceNode);
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
    ...planBase("expression", sourceFile, node),
    expressionKind: "unsupported",
    type: checkerTypePlan(context, sourceFile, useSiteType),
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
  const base = {
    ...planBase("expression", sourceFile, node),
    type: checkerTypePlan(context, sourceFile, useSiteType),
    contextualTypePlan:
      expectedType ?? checkerTypePlan(context, sourceFile, contextualType),
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
      return {
        ...base,
        expressionKind: "identifier",
        literalText: nodeTokenText(sourceFile, node) ?? nodeName(sourceFile, node),
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
        literalText: nodeTokenText(sourceFile, node),
      };
    case TstsSyntax.KindTemplateExpression: {
      const template = TstsSyntax.AsTemplateExpression(node);
      if (!template?.Head) return unsupportedExpression(sourceFile, node, context);
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
        literalText: nodeTokenText(sourceFile, node),
      };
    case TstsSyntax.KindBigIntLiteral:
      return {
        ...base,
        expressionKind: "literal",
        literalKind: "bigint",
        literalText: nodeTokenText(sourceFile, node),
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
      return {
        ...base,
        expressionKind: "erased-wrapper",
        passingMode:
          (wrapperType
            ? context.input.facts.get(parameterPassingFactKey, wrapperType)?.mode
            : undefined) ??
          base.passingMode,
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context,
          expectedType
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
      if (!yieldExpression) return unsupportedExpression(sourceFile, node, context);
      return {
        ...base,
        expressionKind: "yield",
        expression: expressionPlan(
          sourceFile,
          yieldExpression.Expression,
          context
        ),
        operatorText: yieldExpression.AsteriskToken ? "*" : undefined,
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
      return {
        ...base,
        expressionKind: "binary",
        left: expressionPlan(sourceFile, binary.Left, context),
        operatorText: binary.OperatorToken
          ? TstsSyntax.KindString(binary.OperatorToken.Kind)
          : undefined,
        right: expressionPlan(sourceFile, binary.Right, context),
      };
    }
    case TstsSyntax.KindPrefixUnaryExpression: {
      const unary = TstsSyntax.AsPrefixUnaryExpression(node);
      if (!unary) return unsupportedExpression(sourceFile, node, context);
      return {
        ...base,
        expressionKind: "prefix-unary",
        operatorText: TstsSyntax.KindString(unary.Operator),
        expression: expressionPlan(sourceFile, unary.Operand, context),
      };
    }
    case TstsSyntax.KindPostfixUnaryExpression: {
      const unary = TstsSyntax.AsPostfixUnaryExpression(node);
      if (!unary) return unsupportedExpression(sourceFile, node, context);
      return {
        ...base,
        expressionKind: "postfix-unary",
        operatorText: TstsSyntax.KindString(unary.Operator),
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
      return {
        ...base,
        expressionKind: "property-access",
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context
        ),
        literalText:
          nodeTokenText(sourceFile, TstsSyntax.Node_Name(node)) ??
          nodeName(sourceFile, node),
      };
    case TstsSyntax.KindElementAccessExpression: {
      const element = TstsSyntax.AsElementAccessExpression(node);
      if (!element) return unsupportedExpression(sourceFile, node, context);
      return {
        ...base,
        expressionKind: "element-access",
        expression: expressionPlan(sourceFile, element.Expression, context),
        arguments: [
          expressionPlan(sourceFile, element.ArgumentExpression, context),
        ].filter((item): item is LoweringExpressionPlan => item !== undefined),
      };
    }
    case TstsSyntax.KindCallExpression:
    case TstsSyntax.KindNewExpression: {
      const expectedArgumentTypes = callExpectedArgumentTypes(
        sourceFile,
        node,
        context
      );
      return {
        ...base,
        expressionKind:
          node.Kind === TstsSyntax.KindNewExpression ? "new" : "call",
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context
        ),
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
        typeArguments: nodeArrayNodes(TstsSyntax.Node_TypeArguments(node)).map(
          (argument) => sourceTypePlan(context, sourceFile, argument)
        ).filter(
          (argument): argument is LoweringTypeRefPlan => argument !== undefined
        ),
      };
    }
    case TstsSyntax.KindArrowFunction:
    case TstsSyntax.KindFunctionExpression: {
      const body = TstsSyntax.Node_Body(node);
      const bodyIsStatement = body ? isStatementNode(body) : false;
      const explicitReturnType = TstsSyntax.Node_Type(node);
      const expectedFunction = functionTypeParts(expectedType);
      const returnType = explicitReturnType
        ? sourceTypePlan(context, sourceFile, explicitReturnType)
        : expectedFunction?.returnType ??
          checkerTypePlan(
            context,
            sourceFile,
            functionReturnType(sourceFile, node, context)
          );
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
    case TstsSyntax.KindArrayLiteralExpression:
      return {
        ...base,
        expressionKind: "array-literal",
        elements: (TstsSyntax.Node_Elements(node) ?? [])
          .map((element) => expressionPlan(sourceFile, element, context))
          .filter((item): item is LoweringExpressionPlan => item !== undefined),
      };
    case TstsSyntax.KindObjectLiteralExpression:
      return {
        ...base,
        expressionKind: "object-literal",
        properties: (TstsSyntax.Node_Properties(node) ?? [])
          .filter((property): property is TstsNode => property !== undefined)
          .map((property): LoweringObjectPropertyPlan | undefined => {
            const name = propertyNameInfo(sourceFile, property);
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
                  sourceKindName: name.sourceKindName ?? TstsSyntax.Node_KindString(property),
                  sourceText: name.sourceText ?? nodeSourceText(sourceFile, property),
                  computed: name.computed,
                  expression: value,
                }
              : undefined;
          })
          .filter((item): item is LoweringObjectPropertyPlan => item !== undefined),
      };
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

const bindingElementsFromName = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  context: LoweringBuildContext,
  accessPath: readonly LoweringBindingAccessPlan[] = []
): readonly LoweringBindingElementPlan[] => {
  if (!node) return [];
  if (node.Kind === TstsSyntax.KindIdentifier) {
    const name = nodeTokenText(sourceFile, node);
    return name && accessPath.length > 0 ? [{ name, accessPath }] : [];
  }
  const bindingPattern = TstsSyntax.AsBindingPattern(node);
  if (!bindingPattern?.Elements) return [];
  return nodeListNodes(bindingPattern.Elements).flatMap((elementNode, index) => {
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
                (propertyName
                  ? nodeTokenText(sourceFile, propertyName)
                  : undefined) ??
                nodeTokenText(sourceFile, nameNode) ??
                `item${index}`,
            },
          ];
    const nested = bindingElementsFromName(sourceFile, nameNode, context, access);
    if (nested.length === 0) return [];
    const initializer = bindingElement?.Initializer
      ? expressionPlan(sourceFile, bindingElement.Initializer, context)
      : undefined;
    return initializer
      ? nested.map((binding) => ({ ...binding, initializer }))
      : nested;
  });
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
  return {
    name: nodeName(sourceFile, node) ?? "value",
    type,
    initializer: expressionPlan(
      sourceFile,
      variable?.Initializer ?? TstsSyntax.Node_Initializer(node),
      context,
      type
    ),
    bindingElements: bindingElementsFromName(sourceFile, nameNode, context),
  };
};

const variablesFromList = (
  sourceFile: TstsSourceFile,
  list: TstsNode | undefined,
  context: LoweringBuildContext
): readonly LoweringVariablePlan[] => {
  const variableList = list ? TstsSyntax.AsVariableDeclarationList(list) : undefined;
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
    ...planBase("statement", sourceFile, node),
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
      return {
        ...empty,
        statementKind: "expression",
        expression: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Expression(node),
          context
        ),
      };
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
          statement?.Initializer?.Kind === TstsSyntax.KindVariableDeclarationList
            ? statement.Initializer
            : undefined,
          context
        ),
        expression:
          statement?.Initializer?.Kind === TstsSyntax.KindVariableDeclarationList
            ? undefined
            : expressionPlan(sourceFile, statement?.Initializer, context),
        condition: expressionPlan(sourceFile, statement?.Condition, context),
        incrementor: expressionPlan(sourceFile, statement?.Incrementor, context),
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
          statement?.Initializer?.Kind === TstsSyntax.KindVariableDeclarationList
            ? statement.Initializer
            : undefined,
          context
        ),
        expression:
          statement?.Initializer?.Kind === TstsSyntax.KindVariableDeclarationList
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
  expectedParameterTypes: readonly (LoweringTypeRefPlan | undefined)[] = []
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
          typePlan(context, sourceFile, explicitType, inferredType) ??
          expectedParameterTypes[index],
        initializer: expressionPlan(
          sourceFile,
          TstsSyntax.Node_Initializer(parameter),
          context
        ),
        optional: TstsSyntax.Node_QuestionToken(parameter) !== undefined,
        rest:
          TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined,
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
  const returnType = typePlan(context, sourceFile, explicitReturnType, inferredReturnType);
  return {
    ...planBase("declaration", sourceFile, node),
    declarationKind: kind,
    symbol,
    declaredType,
    declaredTypePlan: checkerTypePlan(context, sourceFile, declaredType),
    typeAliasTarget:
      kind === "type-alias"
        ? sourceTypePlan(context, sourceFile, explicitReturnType)
        : undefined,
    heritageTypes: getTstsHeritageTypeNodes(node)
      .map((heritage) => sourceTypePlan(context, sourceFile, heritage))
      .filter((heritage): heritage is LoweringTypeRefPlan => heritage !== undefined),
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
      context
    ),
    members: memberPlans(sourceFile, node, context),
    enumMembers: enumMembers(sourceFile, node, context),
    exported: nodeHasModifier(node, TstsSyntax.ModifierFlagsExport),
    async: nodeHasModifier(node, TstsSyntax.ModifierFlagsAsync),
    static: nodeHasModifier(node, TstsSyntax.ModifierFlagsStatic),
  };
};

type PlanBuckets = {
  readonly declarations: LoweringDeclarationPlan[];
  readonly types: LoweringTypePlan[];
  readonly statements: LoweringStatementPlan[];
  readonly expressions: LoweringExpressionPlan[];
  readonly calls: LoweringCallPlan[];
  readonly members: LoweringMemberAccessPlan[];
  readonly indexes: LoweringIndexAccessPlan[];
  readonly narrowings: LoweringNarrowingPlan[];
  readonly syntheticDeclarations: LoweringSyntheticDeclarationPlan[];
};

const createBuckets = (): PlanBuckets => ({
  declarations: [],
  types: [],
  statements: [],
  expressions: [],
  calls: [],
  members: [],
  indexes: [],
  narrowings: [],
  syntheticDeclarations: [],
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
          ...planBase("type", sourceFile, node),
          sourceType: type,
          sourceSymbol: checker.getTypeAliasOrSymbol(type),
        });
      }

      const numericPrimitive = context.input.facts.get(
        numericPrimitiveFactKey,
        node
      );
      if (numericPrimitive) {
        const name = nodeNameInfo(sourceFile, node);
        buckets.syntheticDeclarations.push({
          kind: "synthetic-declaration",
          sourceFile,
          sourceNode: node,
          sourceKind: Number(node.Kind),
          sourceKindName: TstsSyntax.Node_KindString(node),
          sourceText: nodeSourceText(sourceFile, node),
          name: name.name,
          nameSourceKindName: name.sourceKindName,
          nameSourceText: name.sourceText,
          nameIsComputed: name.computed,
          computedName: name.computedName,
          stableId: `source-primitive:${numericPrimitive.kind}:${numericPrimitive.sourceName}`,
          sourceFeature: "type",
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
    if (expression) {
      buckets.expressions.push(expression);
      if (node.Kind === TstsSyntax.KindIdentifier && expression.useSiteType) {
        buckets.narrowings.push({
          ...planBase("narrowing", sourceFile, node),
          useSiteType: expression.useSiteType,
        });
      }
    }

    if (
      node.Kind === TstsSyntax.KindCallExpression ||
      node.Kind === TstsSyntax.KindNewExpression
    ) {
      const selected =
        context.input.facts.get(selectedSignatureFactKey, node)?.signature ??
        checker.getResolvedSignature(node);
      buckets.calls.push({
        ...planBase("call", sourceFile, node),
        signature: selected,
        returnType: selected
          ? checker.getReturnTypeOfSignature(selected)
          : undefined,
      });
    }

    if (node.Kind === TstsSyntax.KindPropertyAccessExpression) {
      const receiver = TstsSyntax.Node_Expression(node);
      const receiverType = checker.getNarrowedTypeAtLocation(receiver);
      const name = TstsSyntax.Node_Name(node);
      const memberSymbol = name ? checker.getSymbolAtLocation(name) : undefined;
      buckets.members.push({
        ...planBase("member-access", sourceFile, node),
        receiverType,
        memberSymbol,
        memberType: memberSymbol
          ? checker.getTypeOfSymbolAtLocation(memberSymbol, node)
          : undefined,
      });
    }

    if (node.Kind === TstsSyntax.KindElementAccessExpression) {
      const receiver = TstsSyntax.Node_Expression(node);
      const argument = TstsSyntax.AsElementAccessExpression(node)?.ArgumentExpression;
      buckets.indexes.push({
        ...planBase("index-access", sourceFile, node),
        receiverType: checker.getNarrowedTypeAtLocation(receiver),
        indexType: argument
          ? checker.getNarrowedTypeAtLocation(argument)
          : undefined,
        resultType: checker.getNarrowedTypeAtLocation(node),
      });
    }
  });

  return buckets;
};
