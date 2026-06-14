import {
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
  LoweringMemberAccessPlan,
  LoweringNarrowingPlan,
  LoweringObjectPropertyPlan,
  LoweringParameterPlan,
  LoweringStatementPlan,
  LoweringSyntheticDeclarationPlan,
  LoweringTemplatePartPlan,
  LoweringTypePlan,
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
    return { sourceKindName, sourceText, computed: true };
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
    return { sourceKindName, sourceText, computed: true };
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

const splitTopLevel = (text: string, delimiter: string): readonly string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "<" || char === "(" || char === "[" || char === "{") depth += 1;
    if (char === ">" || char === ")" || char === "]" || char === "}") {
      depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && text.startsWith(delimiter, index)) {
      parts.push(text.slice(start, index).trim());
      start = index + delimiter.length;
      index += delimiter.length - 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter((part) => part.length > 0);
};

const typeText = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined,
  type: TstsType | undefined
): string | undefined => {
  const checker = context.checkerForSourceFile(sourceFile);
  if (node) {
    return sourceTypeText(context, sourceFile, node);
  }
  if (!type) return undefined;
  return checker.typeToString(type);
};

const sourceTypeText = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): string | undefined => {
  if (!node) return undefined;

  const numericPrimitive = context.input.facts.get(
    numericPrimitiveFactKey,
    node
  );
  if (numericPrimitive) {
    return numericPrimitive.sourceName;
  }

  const typeReference = getTstsTypeReferenceDetails(node);
  if (typeReference) {
    const args = typeReference.typeArguments
      .map((argument) => sourceTypeText(context, sourceFile, argument))
      .filter((argument): argument is string => argument !== undefined);
    return args.length === 0
      ? typeReference.name
      : `${typeReference.name}<${args.join(", ")}>`;
  }

  switch (node.Kind) {
    case TstsSyntax.KindArrayType: {
      const arrayType = TstsSyntax.AsArrayTypeNode(node);
      const element = sourceTypeText(context, sourceFile, arrayType?.ElementType);
      return element ? `${element}[]` : compactNodeSourceText(sourceFile, node);
    }
    case TstsSyntax.KindTupleType: {
      const tupleType = TstsSyntax.AsTupleTypeNode(node);
      const elements = nodeListNodes(tupleType?.Elements)
        .map((element) => sourceTypeText(context, sourceFile, element))
        .filter((element): element is string => element !== undefined);
      return `[${elements.join(", ")}]`;
    }
    case TstsSyntax.KindUnionType: {
      const unionType = TstsSyntax.AsUnionTypeNode(node);
      const types = nodeListNodes(unionType?.Types)
        .map((part) => sourceTypeText(context, sourceFile, part))
        .filter((part): part is string => part !== undefined);
      return types.length > 0 ? types.join(" | ") : compactNodeSourceText(sourceFile, node);
    }
    case TstsSyntax.KindParenthesizedType: {
      const parenthesized = TstsSyntax.AsParenthesizedTypeNode(node);
      const inner = sourceTypeText(context, sourceFile, parenthesized?.Type);
      return inner ? `(${inner})` : compactNodeSourceText(sourceFile, node);
    }
    case TstsSyntax.KindTypeOperator: {
      const typeOperator = TstsSyntax.AsTypeOperatorNode(node);
      const inner = sourceTypeText(context, sourceFile, typeOperator?.Type);
      if (!inner) return compactNodeSourceText(sourceFile, node);
      const operator =
        typeOperator?.Operator === TstsSyntax.KindReadonlyKeyword
          ? "readonly"
          : TstsSyntax.KindString(typeOperator?.Operator ?? node.Kind);
      return `${operator} ${inner}`;
    }
    case TstsSyntax.KindVoidKeyword:
      return "void";
    case TstsSyntax.KindStringKeyword:
      return "string";
    case TstsSyntax.KindNumberKeyword:
      return "number";
    case TstsSyntax.KindBooleanKeyword:
      return "boolean";
    case TstsSyntax.KindAnyKeyword:
      return "any";
    case TstsSyntax.KindUnknownKeyword:
      return "unknown";
    case TstsSyntax.KindNeverKeyword:
      return "never";
    default:
      return compactNodeSourceText(sourceFile, node);
  }
};

const functionTypeParts = (
  typeText: string | undefined
):
  | {
      readonly parameterTypes: readonly string[];
      readonly returnType?: string;
    }
  | undefined => {
  if (!typeText) return undefined;
  const arrowIndex = typeText.indexOf("=>");
  if (arrowIndex < 0) return undefined;
  const parameterText = typeText.slice(0, arrowIndex).trim();
  const returnType = typeText.slice(arrowIndex + 2).trim();
  if (!parameterText.startsWith("(") || !parameterText.endsWith(")")) {
    return undefined;
  }
  return {
    parameterTypes: splitTopLevel(parameterText.slice(1, -1), ",").map(
      (parameter) => {
        const colonIndex = parameter.indexOf(":");
        const rawType =
          colonIndex >= 0 ? parameter.slice(colonIndex + 1).trim() : parameter;
        return rawType.replace(/^\.\.\./, "").replace(/\?$/, "").trim();
      }
    ),
    returnType,
  };
};

const callExpectedArgumentTypeTexts = (
  sourceFile: TstsSourceFile,
  node: TstsNode,
  context: LoweringBuildContext
): readonly (string | undefined)[] => {
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
      return sourceTypeText(
        context,
        getTstsContainingSourceFile(typeNode) ?? sourceFile,
        typeNode
      );
    }
    const parameterType = declaration
      ? checker.getTypeOfSymbolAtLocation(parameter, declaration)
      : undefined;
    return typeText(context, sourceFile, undefined, parameterType);
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
    typeText: typeText(context, sourceFile, undefined, useSiteType),
    contextualTypeText: typeText(context, sourceFile, undefined, contextualType),
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
  expectedTypeText?: string
): LoweringExpressionPlan | undefined => {
  if (!node) return undefined;
  const checker = context.checkerForSourceFile(sourceFile);
  const useSiteType = checker.getNarrowedTypeAtLocation(node);
  const contextualType = checker.getContextualType(node);
  const base = {
    ...planBase("expression", sourceFile, node),
    typeText: typeText(context, sourceFile, undefined, useSiteType),
    contextualTypeText:
      expectedTypeText ?? typeText(context, sourceFile, undefined, contextualType),
    intrinsicKind: context.input.facts.get(intrinsicSemanticsFactKey, node)
      ?.kind,
    passingMode: context.input.facts.get(parameterPassingFactKey, node)?.mode,
    arguments: [] as readonly LoweringExpressionPlan[],
    typeArguments: [] as readonly string[],
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
          expectedTypeText
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
          expectedTypeText
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
          expectedTypeText
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
          expectedTypeText
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
          expectedTypeText
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
      const expectedArgumentTypes = callExpectedArgumentTypeTexts(
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
          (argument) =>
            sourceTypeText(context, sourceFile, argument) ??
            compactNodeSourceText(sourceFile, argument)
        ),
      };
    }
    case TstsSyntax.KindArrowFunction:
    case TstsSyntax.KindFunctionExpression: {
      const body = TstsSyntax.Node_Body(node);
      const bodyIsStatement = body ? isStatementNode(body) : false;
      const returnTypeText = typeText(
        context,
        sourceFile,
        TstsSyntax.Node_Type(node),
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
          functionTypeParts(expectedTypeText)?.parameterTypes
        ),
        async: nodeHasModifier(node, TstsSyntax.ModifierFlagsAsync),
        returnTypeText,
        body: bodyIsStatement
          ? statementPlan(sourceFile, body, context, returnTypeText)
          : undefined,
        expression: bodyIsStatement
          ? undefined
          : expressionPlan(sourceFile, body, context, returnTypeText),
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
  const declaredTypeText = typeText(context, sourceFile, declaredType, undefined);
  const nameNode = TstsSyntax.Node_Name(node);
  return {
    name: nodeName(sourceFile, node) ?? "value",
    typeText: declaredTypeText,
    initializer: expressionPlan(
      sourceFile,
      variable?.Initializer ?? TstsSyntax.Node_Initializer(node),
      context,
      declaredTypeText
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
  expectedReturnTypeText?: string
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
            statementPlan(sourceFile, statement, context, expectedReturnTypeText)
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
          expectedReturnTypeText
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
          expectedReturnTypeText
        ),
        elseStatement: statementPlan(
          sourceFile,
          statement?.ElseStatement,
          context,
          expectedReturnTypeText
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
          expectedReturnTypeText
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
          expectedReturnTypeText
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
          expectedReturnTypeText
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
                  expectedReturnTypeText
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
          expectedReturnTypeText
        ),
        catchVariable: catchClause?.VariableDeclaration
          ? variablePlan(sourceFile, catchClause.VariableDeclaration, context)
          : undefined,
        catchBlock: statementPlan(
          sourceFile,
          catchClause?.Block,
          context,
          expectedReturnTypeText
        ),
        finallyBlock: statementPlan(
          sourceFile,
          statement?.FinallyBlock,
          context,
          expectedReturnTypeText
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
  expectedParameterTypeTexts: readonly (string | undefined)[] = []
): readonly LoweringParameterPlan[] =>
  (TstsSyntax.Node_Parameters(node) ?? [])
    .filter((parameter): parameter is TstsNode => parameter !== undefined)
    .map((parameter, index): LoweringParameterPlan => {
      const checker = context.checkerForSourceFile(sourceFile);
      const explicitType = TstsSyntax.Node_Type(parameter);
      const nameNode = TstsSyntax.Node_Name(parameter);
      const inferredType =
        explicitType === undefined &&
        expectedParameterTypeTexts[index] === undefined
          ? checker.getTypeAtLocation(nameNode ?? parameter)
          : undefined;
      return {
        name: nodeName(sourceFile, parameter) ?? "arg",
        typeText:
          typeText(context, sourceFile, explicitType, inferredType) ??
          expectedParameterTypeTexts[index],
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

const typeParameterNames = (
  sourceFile: TstsSourceFile,
  node: TstsNode
): readonly string[] =>
  nodeArrayNodes(TstsSyntax.Node_TypeParameters(node))
    .map((typeParameter) => nodeTokenText(sourceFile, TstsSyntax.Node_Name(typeParameter)))
    .filter((name): name is string => name !== undefined);

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
  const returnTypeText = typeText(
    context,
    sourceFile,
    explicitReturnType,
    inferredReturnType
  );
  return {
    ...planBase("declaration", sourceFile, node),
    declarationKind: kind,
    symbol,
    declaredType,
    declaredTypeText: typeText(context, sourceFile, undefined, declaredType),
    parameters: parameterPlans(sourceFile, node, context),
    typeParameters: typeParameterNames(sourceFile, node),
    returnTypeText,
    body: statementPlan(
      sourceFile,
      TstsSyntax.Node_Body(node),
      context,
      returnTypeText
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
