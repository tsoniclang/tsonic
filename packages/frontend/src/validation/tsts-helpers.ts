import type {
  TstsNode,
  TstsSignature,
  TstsSourceFile,
  TstsSymbol,
  TstsType,
} from "@tsonic/tsts";
import {
  getTstsBodyNode,
  getTstsElementNodes,
  getTstsExpressionNode,
  getTstsIdentifierText,
  getTstsInitializerNode,
  getTstsMemberNodes,
  getTstsNodeText,
  getTstsParameters,
  getTstsPropertyNodes,
  getTstsStatementNodes,
  getTstsTypeParameterNodes,
  TstsSyntax,
} from "@tsonic/tsts";
import type { TstsFrontendSourceSemanticView } from "../source-frontend/index.js";

export type SourceType = ReturnType<TstsFrontendSourceSemanticView["getExpressionType"]>;
export type SourceSymbol = NonNullable<
  ReturnType<TstsFrontendSourceSemanticView["getSymbol"]>
>;
export type SourceSignature = NonNullable<
  ReturnType<TstsFrontendSourceSemanticView["getResolvedSignature"]>
>;

export const definedTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

export const nodeParent = (node: TstsNode): TstsNode | undefined =>
  node.Parent;

export const isNodeKind = (node: TstsNode | undefined, kind: number): boolean =>
  node?.Kind === kind;

export const isIdentifier = (node: TstsNode | undefined): boolean =>
  node?.Kind === TstsSyntax.KindIdentifier;

export const identifierText = (node: TstsNode | undefined): string | undefined =>
  getTstsIdentifierText(node);

export const isIdentifierNamed = (
  node: TstsNode | undefined,
  name: string
): boolean => identifierText(node) === name;

export const isStringLiteralLike = (node: TstsNode | undefined): boolean =>
  node?.Kind === TstsSyntax.KindStringLiteral ||
  node?.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral;

export const isStaticPropertyName = (node: TstsNode | undefined): boolean =>
  node?.Kind === TstsSyntax.KindIdentifier ||
  node?.Kind === TstsSyntax.KindStringLiteral ||
  node?.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral ||
  node?.Kind === TstsSyntax.KindNumericLiteral;

export const staticPropertyNameText = (
  node: TstsNode | undefined
): string | undefined =>
  isStaticPropertyName(node) ? getTstsNodeText(node) : undefined;

export const getNodeExpression = (
  node: TstsNode | undefined
): TstsNode | undefined => {
  switch (node?.Kind) {
    case TstsSyntax.KindPropertyAccessExpression:
    case TstsSyntax.KindElementAccessExpression:
    case TstsSyntax.KindParenthesizedExpression:
    case TstsSyntax.KindCallExpression:
    case TstsSyntax.KindNewExpression:
    case TstsSyntax.KindExpressionWithTypeArguments:
    case TstsSyntax.KindComputedPropertyName:
    case TstsSyntax.KindNonNullExpression:
    case TstsSyntax.KindTypeAssertionExpression:
    case TstsSyntax.KindAsExpression:
    case TstsSyntax.KindSatisfiesExpression:
    case TstsSyntax.KindSpreadAssignment:
    case TstsSyntax.KindSpreadElement:
    case TstsSyntax.KindDeleteExpression:
    case TstsSyntax.KindWithStatement:
    case TstsSyntax.KindForInStatement:
    case TstsSyntax.KindForOfStatement:
    case TstsSyntax.KindReturnStatement:
    case TstsSyntax.KindExportAssignment:
    case TstsSyntax.KindExpressionStatement:
      return getTstsExpressionNode(node);
    default:
      return undefined;
  }
};

export const getNodeInitializer = (
  node: TstsNode | undefined
): TstsNode | undefined => {
  switch (node?.Kind) {
    case TstsSyntax.KindVariableDeclaration:
    case TstsSyntax.KindParameter:
    case TstsSyntax.KindBindingElement:
    case TstsSyntax.KindPropertyDeclaration:
    case TstsSyntax.KindPropertySignature:
    case TstsSyntax.KindPropertyAssignment:
    case TstsSyntax.KindForInStatement:
    case TstsSyntax.KindForOfStatement:
      return getTstsInitializerNode(node);
    default:
      return undefined;
  }
};

export const getNodeType = (node: TstsNode | undefined): TstsNode | undefined =>
  node ? TstsSyntax.Node_Type(node) : undefined;

export const getNodeBody = (node: TstsNode | undefined): TstsNode | undefined =>
  node ? getTstsBodyNode(node) : undefined;

export const getNodeParameters = (
  node: TstsNode | undefined
): readonly TstsNode[] => definedTstsNodes(getTstsParameters(node));

export const getNodeTypeParameters = (
  node: TstsNode | undefined
): readonly TstsNode[] => definedTstsNodes(getTstsTypeParameterNodes(node));

export const getNodeMembers = (
  node: TstsNode | undefined
): readonly TstsNode[] => definedTstsNodes(getTstsMemberNodes(node));

export const getNodeStatements = (
  node: TstsNode | TstsSourceFile | undefined
): readonly TstsNode[] => definedTstsNodes(getTstsStatementNodes(node));

export const getNodeProperties = (
  node: TstsNode | undefined
): readonly TstsNode[] => definedTstsNodes(getTstsPropertyNodes(node));

export const getNodeElements = (
  node: TstsNode | undefined
): readonly TstsNode[] => definedTstsNodes(getTstsElementNodes(node));

export const getCallArguments = (
  node: TstsNode | undefined
): readonly TstsNode[] =>
  definedTstsNodes(TstsSyntax.AsCallExpression(node)?.Arguments?.Nodes ?? []);

export const getNewArguments = (
  node: TstsNode | undefined
): readonly TstsNode[] =>
  definedTstsNodes(TstsSyntax.AsNewExpression(node)?.Arguments?.Nodes ?? []);

export const getTypeArguments = (
  node: TstsNode | undefined
): readonly TstsNode[] =>
  node ? definedTstsNodes(TstsSyntax.Node_TypeArguments(node) ?? []) : [];

export const isParenthesizedExpression = (
  node: TstsNode | undefined
): boolean => node?.Kind === TstsSyntax.KindParenthesizedExpression;

export const isTypeAssertionExpression = (
  node: TstsNode | undefined
): boolean => node?.Kind === TstsSyntax.KindTypeAssertionExpression;

export const isAssertionOrSatisfiesExpression = (
  node: TstsNode | undefined
): boolean =>
  node?.Kind === TstsSyntax.KindAsExpression ||
  node?.Kind === TstsSyntax.KindTypeAssertionExpression ||
  node?.Kind === TstsSyntax.KindSatisfiesExpression;

export const unwrapExpression = (
  expression: TstsNode | undefined
): TstsNode | undefined => {
  let current = expression;
  while (
    current?.Kind === TstsSyntax.KindParenthesizedExpression ||
    current?.Kind === TstsSyntax.KindNonNullExpression
  ) {
    current = getNodeExpression(current);
  }
  return current;
};

export const unwrapDeterministicExpression = (
  expression: TstsNode | undefined
): TstsNode | undefined => {
  let current = expression;
  for (;;) {
    if (current?.Kind === TstsSyntax.KindParenthesizedExpression) {
      current = getNodeExpression(current);
      continue;
    }
    if (isAssertionOrSatisfiesExpression(current)) {
      current = getNodeExpression(current);
      continue;
    }
    return current;
  }
};

export const isFunctionLikeWithParameters = (
  node: TstsNode | undefined
): boolean => {
  switch (node?.Kind) {
    case TstsSyntax.KindFunctionDeclaration:
    case TstsSyntax.KindMethodDeclaration:
    case TstsSyntax.KindMethodSignature:
    case TstsSyntax.KindFunctionExpression:
    case TstsSyntax.KindArrowFunction:
    case TstsSyntax.KindConstructor:
    case TstsSyntax.KindGetAccessor:
    case TstsSyntax.KindSetAccessor:
      return true;
    default:
      return false;
  }
};

export const isFunctionBoundary = (node: TstsNode | undefined): boolean => {
  switch (node?.Kind) {
    case TstsSyntax.KindFunctionDeclaration:
    case TstsSyntax.KindMethodDeclaration:
    case TstsSyntax.KindFunctionExpression:
    case TstsSyntax.KindArrowFunction:
    case TstsSyntax.KindConstructor:
    case TstsSyntax.KindGetAccessor:
    case TstsSyntax.KindSetAccessor:
      return true;
    default:
      return false;
  }
};

export const isLambdaNode = (node: TstsNode | undefined): boolean =>
  node?.Kind === TstsSyntax.KindArrowFunction ||
  node?.Kind === TstsSyntax.KindFunctionExpression;

export const isAssignmentOperator = (kind: number): boolean => {
  switch (kind) {
    case TstsSyntax.KindEqualsToken:
    case TstsSyntax.KindPlusEqualsToken:
    case TstsSyntax.KindMinusEqualsToken:
    case TstsSyntax.KindAsteriskEqualsToken:
    case TstsSyntax.KindAsteriskAsteriskEqualsToken:
    case TstsSyntax.KindSlashEqualsToken:
    case TstsSyntax.KindPercentEqualsToken:
    case TstsSyntax.KindLessThanLessThanEqualsToken:
    case TstsSyntax.KindGreaterThanGreaterThanEqualsToken:
    case TstsSyntax.KindGreaterThanGreaterThanGreaterThanEqualsToken:
    case TstsSyntax.KindAmpersandEqualsToken:
    case TstsSyntax.KindBarEqualsToken:
    case TstsSyntax.KindCaretEqualsToken:
    case TstsSyntax.KindBarBarEqualsToken:
    case TstsSyntax.KindAmpersandAmpersandEqualsToken:
    case TstsSyntax.KindQuestionQuestionEqualsToken:
      return true;
    default:
      return false;
  }
};

export const isUpdateOperator = (kind: number): boolean =>
  kind === TstsSyntax.KindPlusPlusToken ||
  kind === TstsSyntax.KindMinusMinusToken;

export const getVariableDeclarationListKind = (
  declaration: TstsNode
): { readonly isConst: boolean; readonly isLet: boolean } | undefined => {
  const list = declaration.Parent;
  if (list?.Kind !== TstsSyntax.KindVariableDeclarationList) {
    return undefined;
  }

  const isConst = (list.Flags & TstsSyntax.NodeFlagsConst) !== 0;
  const isLet = (list.Flags & TstsSyntax.NodeFlagsLet) !== 0;
  return isConst || isLet ? { isConst, isLet } : undefined;
};

export const sourceTypeIdentity = (type: TstsType): TstsType => type;
export const sourceSymbolIdentity = (symbol: TstsSymbol): TstsSymbol => symbol;
export const sourceSignatureIdentity = (
  signature: TstsSignature
): TstsSignature => signature;
