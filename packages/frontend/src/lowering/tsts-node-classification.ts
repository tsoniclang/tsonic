import { TstsSyntax } from "@tsonic/tsts";
import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";

export const visitTstsNodes = (
  root: TstsNode | TstsSourceFile,
  visit: (node: TstsNode) => void
): void => {
  const seen = new WeakSet<object>();

  const walk = (node: TstsNode | undefined): void => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    visit(node);
    TstsSyntax.Node_IterChildren(node)((child: TstsNode | undefined) => {
      walk(child);
      return true;
    });
  };

  walk(root);
};

export const sourceFileStatements = (
  sourceFile: TstsSourceFile
): readonly TstsNode[] =>
  (TstsSyntax.Node_Statements(sourceFile) ?? []).filter(
    (node): node is TstsNode => node !== undefined
  );

export const isDeclarationNode = (node: TstsNode): boolean => {
  switch (node.Kind) {
    case TstsSyntax.KindClassDeclaration:
    case TstsSyntax.KindConstructor:
    case TstsSyntax.KindEnumDeclaration:
    case TstsSyntax.KindEnumMember:
    case TstsSyntax.KindFunctionDeclaration:
    case TstsSyntax.KindInterfaceDeclaration:
    case TstsSyntax.KindMethodDeclaration:
    case TstsSyntax.KindPropertyDeclaration:
    case TstsSyntax.KindTypeAliasDeclaration:
    case TstsSyntax.KindVariableDeclaration:
      return true;
    default:
      return false;
  }
};

export const isStatementNode = (node: TstsNode): boolean => {
  switch (node.Kind) {
    case TstsSyntax.KindBlock:
    case TstsSyntax.KindBreakStatement:
    case TstsSyntax.KindContinueStatement:
    case TstsSyntax.KindDebuggerStatement:
    case TstsSyntax.KindDoStatement:
    case TstsSyntax.KindEmptyStatement:
    case TstsSyntax.KindExpressionStatement:
    case TstsSyntax.KindForInStatement:
    case TstsSyntax.KindForOfStatement:
    case TstsSyntax.KindForStatement:
    case TstsSyntax.KindFunctionDeclaration:
    case TstsSyntax.KindIfStatement:
    case TstsSyntax.KindLabeledStatement:
    case TstsSyntax.KindReturnStatement:
    case TstsSyntax.KindSwitchStatement:
    case TstsSyntax.KindThrowStatement:
    case TstsSyntax.KindTryStatement:
    case TstsSyntax.KindVariableStatement:
    case TstsSyntax.KindWhileStatement:
    case TstsSyntax.KindWithStatement:
      return true;
    default:
      return false;
  }
};

export const isExpressionNode = (node: TstsNode): boolean => {
  switch (node.Kind) {
    case TstsSyntax.KindArrayLiteralExpression:
    case TstsSyntax.KindArrowFunction:
    case TstsSyntax.KindAsExpression:
    case TstsSyntax.KindAwaitExpression:
    case TstsSyntax.KindBigIntLiteral:
    case TstsSyntax.KindBinaryExpression:
    case TstsSyntax.KindCallExpression:
    case TstsSyntax.KindConditionalExpression:
    case TstsSyntax.KindDeleteExpression:
    case TstsSyntax.KindElementAccessExpression:
    case TstsSyntax.KindFalseKeyword:
    case TstsSyntax.KindFunctionExpression:
    case TstsSyntax.KindIdentifier:
    case TstsSyntax.KindNewExpression:
    case TstsSyntax.KindNoSubstitutionTemplateLiteral:
    case TstsSyntax.KindNullKeyword:
    case TstsSyntax.KindNumericLiteral:
    case TstsSyntax.KindObjectLiteralExpression:
    case TstsSyntax.KindParenthesizedExpression:
    case TstsSyntax.KindPostfixUnaryExpression:
    case TstsSyntax.KindPrefixUnaryExpression:
    case TstsSyntax.KindPropertyAccessExpression:
    case TstsSyntax.KindRegularExpressionLiteral:
    case TstsSyntax.KindSatisfiesExpression:
    case TstsSyntax.KindStringLiteral:
    case TstsSyntax.KindTaggedTemplateExpression:
    case TstsSyntax.KindThisKeyword:
    case TstsSyntax.KindTrueKeyword:
    case TstsSyntax.KindTypeAssertionExpression:
    case TstsSyntax.KindYieldExpression:
      return true;
    default:
      return false;
  }
};

export const isTypeNode = (node: TstsNode): boolean => {
  switch (node.Kind) {
    case TstsSyntax.KindAnyKeyword:
    case TstsSyntax.KindArrayType:
    case TstsSyntax.KindBigIntKeyword:
    case TstsSyntax.KindBooleanKeyword:
    case TstsSyntax.KindConditionalType:
    case TstsSyntax.KindConstructorType:
    case TstsSyntax.KindFunctionType:
    case TstsSyntax.KindImportType:
    case TstsSyntax.KindIndexedAccessType:
    case TstsSyntax.KindInferType:
    case TstsSyntax.KindIntersectionType:
    case TstsSyntax.KindLiteralType:
    case TstsSyntax.KindMappedType:
    case TstsSyntax.KindNeverKeyword:
    case TstsSyntax.KindNumberKeyword:
    case TstsSyntax.KindObjectKeyword:
    case TstsSyntax.KindOptionalType:
    case TstsSyntax.KindParenthesizedType:
    case TstsSyntax.KindRestType:
    case TstsSyntax.KindStringKeyword:
    case TstsSyntax.KindThisType:
    case TstsSyntax.KindTupleType:
    case TstsSyntax.KindTypeLiteral:
    case TstsSyntax.KindTypeOperator:
    case TstsSyntax.KindTypePredicate:
    case TstsSyntax.KindTypeQuery:
    case TstsSyntax.KindTypeReference:
    case TstsSyntax.KindUndefinedKeyword:
    case TstsSyntax.KindUnionType:
    case TstsSyntax.KindUnknownKeyword:
    case TstsSyntax.KindVoidKeyword:
      return true;
    default:
      return false;
  }
};
