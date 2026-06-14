import type { GoPtr, TstsNode, TstsNodeList } from "@tsonic/tsts";
import {
  getTstsContainingSourceFileName,
  getTstsDeclaredTypeNode,
  getTstsIdentifierText,
  getTstsInitializerNode,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsNodeText,
  getTstsParameters,
  getTstsPropertyNameText,
  getTstsTypeParameterNodes,
  getTstsTypeReferenceName,
  hasTstsReadonlyModifier,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import {
  extensionReceiverSemanticsFactKey,
  fieldSemanticsFactKey,
  isExtensionReceiverFact,
  isFieldStorageFact,
  parameterPassingFactKey,
  parameterPassingModeFromFact,
  type IrParameterPassingMode,
  type SourceSemanticFactKey,
} from "../../../../source-frontend/index.js";

export type ConverterNode = TstsNode;
export type ConverterTypeNode = TstsNode;
export type ConverterDeclarationNode = TstsNode;
export type ConverterExpressionNode = TstsNode;

type NodeListLike<T extends TstsNode = TstsNode> =
  | TstsNodeList
  | { readonly Nodes?: readonly GoPtr<T>[] }
  | undefined;

export const asConverterNode = (node: unknown): ConverterNode | undefined =>
  node && typeof node === "object" && "Kind" in node
    ? (node as ConverterNode)
    : undefined;

export const assertConverterNode = (node: unknown): ConverterNode => {
  const tstsNode = asConverterNode(node);
  if (!tstsNode) {
    throw new Error("Expected TSTS AST node");
  }
  return tstsNode;
};

export const nodeListNodes = <T extends TstsNode = TstsNode>(
  list: NodeListLike<T>
): readonly T[] =>
  ((list as { readonly Nodes?: readonly GoPtr<T>[] } | undefined)?.Nodes ?? [])
    .filter((node): node is T => node !== undefined);

export const nodeType = (node: GoPtr<TstsNode>): GoPtr<TstsNode> =>
  getTstsDeclaredTypeNode(node);

export const nodeTypeArguments = (
  node: GoPtr<TstsNode>
): readonly TstsNode[] =>
  (node ? (TstsSyntax.Node_TypeArguments(node) ?? []) : []).filter(
    (typeArgument): typeArgument is TstsNode => typeArgument !== undefined
  );

export const nodeTypeParameters = (
  node: GoPtr<TstsNode>
): readonly TstsNode[] =>
  getTstsTypeParameterNodes(node).filter(
    (typeParameter): typeParameter is TstsNode => typeParameter !== undefined
  );

export const nodeParameters = (node: GoPtr<TstsNode>): readonly TstsNode[] =>
  getTstsParameters(node).filter(
    (parameter): parameter is TstsNode => parameter !== undefined
  );

export const nodeMembers = (node: GoPtr<TstsNode>): readonly TstsNode[] =>
  getTstsMemberNodes(node).filter(
    (member): member is TstsNode => member !== undefined
  );

export const nodeNameText = (node: GoPtr<TstsNode>): string | undefined =>
  getTstsNodeNameText(node);

export const nodePropertyNameText = (
  node: GoPtr<TstsNode>
): string | undefined => getTstsPropertyNameText(node);

export const identifierText = (node: GoPtr<TstsNode>): string | undefined =>
  getTstsIdentifierText(node);

export const nodeText = (node: GoPtr<TstsNode>): string =>
  getTstsNodeText(node) ?? "";

export const containingSourceFileName = (
  node: GoPtr<TstsNode>
): string | undefined => getTstsContainingSourceFileName(node);

export const isDeclarationFileNode = (node: GoPtr<TstsNode>): boolean =>
  containingSourceFileName(node)?.endsWith(".d.ts") === true;

export const typeReferenceName = (node: GoPtr<TstsNode>): string | undefined =>
  getTstsTypeReferenceName(node);

export const expressionName = (node: GoPtr<TstsNode>): string | undefined => {
  if (!node) return undefined;
  const identifier = identifierText(node);
  if (identifier) return identifier;
  if (TstsSyntax.IsPropertyAccessExpression(node)) return nodeNameText(node);
  if (TstsSyntax.IsQualifiedName(node)) {
    const qualified = TstsSyntax.AsQualifiedName(node);
    const left = expressionName(qualified?.Left);
    const right = identifierText(qualified?.Right);
    return left && right ? `${left}.${right}` : undefined;
  }
  return undefined;
};

export const entityNameToText = (node: GoPtr<TstsNode>): string =>
  expressionName(node) ?? nodeText(node);

export const typeOperatorKind = (node: TstsNode): TstsSyntax.Kind | undefined =>
  TstsSyntax.AsTypeOperatorNode(node)?.Operator;

export const literalNodeValue = (
  literalNode: TstsNode
): string | number | boolean | null | undefined => {
  if (TstsSyntax.IsStringLiteral(literalNode)) {
    return nodeText(literalNode);
  }
  if (TstsSyntax.IsNumericLiteral(literalNode)) {
    return Number(nodeText(literalNode));
  }
  if (TstsSyntax.IsPrefixUnaryExpression(literalNode)) {
    const expression = TstsSyntax.AsPrefixUnaryExpression(literalNode);
    const operand = expression?.Operand;
    if (
      operand &&
      TstsSyntax.IsNumericLiteral(operand) &&
      (expression.Operator === TstsSyntax.KindMinusToken ||
        expression.Operator === TstsSyntax.KindPlusToken)
    ) {
      const magnitude = Number(nodeText(operand));
      return expression.Operator === TstsSyntax.KindMinusToken
        ? -magnitude
        : magnitude;
    }
  }
  if (literalNode.Kind === TstsSyntax.KindTrueKeyword) return true;
  if (literalNode.Kind === TstsSyntax.KindFalseKeyword) return false;
  if (literalNode.Kind === TstsSyntax.KindNullKeyword) return null;
  return undefined;
};

export const isOptionalParameter = (node: GoPtr<TstsNode>): boolean =>
  isTstsOptionalParameter(node);

export const isRestParameter = (node: GoPtr<TstsNode>): boolean =>
  isTstsRestParameter(node);

export const parameterNameText = (node: TstsNode, index: number): string =>
  nodePropertyNameText(node) ?? nodeNameText(node) ?? `arg${index}`;

export const isReadonlyMember = (node: GoPtr<TstsNode>): boolean =>
  hasTstsReadonlyModifier(node);

export const initializerNode = (node: GoPtr<TstsNode>): GoPtr<TstsNode> =>
  getTstsInitializerNode(node);

export type TstsSourceFactReader = <T>(
  node: TstsNode,
  key: SourceSemanticFactKey<T>
) => T | undefined;

export type TstsSourceParameterTypeUnwrap = {
  readonly typeNode: TstsNode | undefined;
  readonly passing: IrParameterPassingMode;
  readonly isExtensionReceiver: boolean;
};

export type TstsSourceWrapperTypeReference =
  | {
      readonly kind: "extension-receiver";
      readonly innerType: TstsNode;
    }
  | {
      readonly kind: "field-storage";
      readonly innerType: TstsNode;
    }
  | {
      readonly kind: "parameter-passing";
      readonly innerType: TstsNode;
      readonly passing: Exclude<IrParameterPassingMode, "value">;
      readonly referenceName: "ref" | "out" | "inref";
    };

export const sourceParameterPassingReferenceName = (
  passing: IrParameterPassingMode
): "ref" | "out" | "inref" | undefined => {
  switch (passing) {
    case "value":
      return undefined;
    case "in":
      return "inref";
    case "ref":
      return "ref";
    case "out":
      return "out";
  }
};

export const classifySourceWrapperTypeReference = (
  node: TstsNode,
  readFact: TstsSourceFactReader
): TstsSourceWrapperTypeReference | undefined => {
  const innerType = nodeTypeArguments(node)[0];
  if (!innerType) {
    return undefined;
  }

  if (
    isExtensionReceiverFact(readFact(node, extensionReceiverSemanticsFactKey))
  ) {
    return { kind: "extension-receiver", innerType };
  }

  if (isFieldStorageFact(readFact(node, fieldSemanticsFactKey))) {
    return { kind: "field-storage", innerType };
  }

  const passing = parameterPassingModeFromFact(
    readFact(node, parameterPassingFactKey)
  );
  const referenceName = sourceParameterPassingReferenceName(passing ?? "value");
  if (!referenceName || passing === undefined || passing === "value") {
    return undefined;
  }

  return {
    kind: "parameter-passing",
    innerType,
    passing,
    referenceName,
  };
};

export const unwrapSourceParameterType = (
  typeNode: TstsNode | undefined,
  readFact: TstsSourceFactReader
): TstsSourceParameterTypeUnwrap => {
  let current = typeNode;
  let passing: IrParameterPassingMode = "value";
  let isExtensionReceiver = false;

  while (current) {
    if (TstsSyntax.IsParenthesizedTypeNode(current)) {
      current = TstsSyntax.AsParenthesizedTypeNode(current)?.Type;
      continue;
    }

    if (!TstsSyntax.IsTypeReferenceNode(current)) {
      break;
    }

    const wrapper = classifySourceWrapperTypeReference(current, readFact);
    if (!wrapper) {
      break;
    }

    if (wrapper.kind === "extension-receiver") {
      isExtensionReceiver = true;
      current = wrapper.innerType;
      continue;
    }

    if (wrapper.kind === "parameter-passing") {
      passing = wrapper.passing;
      current = wrapper.innerType;
      continue;
    }

    break;
  }

  return { typeNode: current, passing, isExtensionReceiver };
};
