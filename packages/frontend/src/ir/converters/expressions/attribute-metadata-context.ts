import * as ts from "typescript";
import type { FrontendSourceSemanticView } from "../../../source-frontend/index.js";
import { markerApiSemanticsFactKey } from "../../../source-frontend/index.js";

const stripParentheses = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

const isAttributesApiIdentifier = (
  expression: ts.Identifier,
  sourceSemantics: FrontendSourceSemanticView
): boolean =>
  sourceSemantics.getFact(expression, markerApiSemanticsFactKey)?.kind ===
  "attributes";

const isAttributesApiRootExpression = (
  expression: ts.Expression,
  sourceSemantics: FrontendSourceSemanticView
): boolean => {
  const current = stripParentheses(expression);

  if (ts.isIdentifier(current)) {
    return isAttributesApiIdentifier(current, sourceSemantics);
  }

  if (ts.isCallExpression(current)) {
    return isAttributesApiRootExpression(current.expression, sourceSemantics);
  }

  if (ts.isPropertyAccessExpression(current)) {
    return isAttributesApiRootExpression(current.expression, sourceSemantics);
  }

  return false;
};

export const isAttributeMetadataNamedArgumentPosition = (
  call: ts.CallExpression,
  argumentIndex: number,
  expression: ts.Expression,
  sourceSemantics: FrontendSourceSemanticView
): boolean => {
  const unwrapped = stripParentheses(expression);
  if (!ts.isObjectLiteralExpression(unwrapped)) {
    return false;
  }

  if (argumentIndex === 0) {
    return false;
  }

  const callee = stripParentheses(call.expression);
  if (!ts.isPropertyAccessExpression(callee)) {
    return false;
  }

  if (callee.name.text !== "add" && callee.name.text !== "attr") {
    return false;
  }

  return isAttributesApiRootExpression(callee.expression, sourceSemantics);
};

export const isAttributeMetadataNamedArgumentObjectLiteral = (
  node: ts.ObjectLiteralExpression,
  sourceSemantics: FrontendSourceSemanticView
): boolean => {
  let expression: ts.Expression = node;
  let parent = node.parent;
  while (parent && ts.isParenthesizedExpression(parent)) {
    expression = parent;
    parent = parent.parent;
  }

  if (!parent || !ts.isCallExpression(parent)) {
    return false;
  }

  const argumentIndex = parent.arguments.findIndex(
    (argument) => stripParentheses(argument) === node
  );
  if (argumentIndex < 0) {
    return false;
  }

  return isAttributeMetadataNamedArgumentPosition(
    parent,
    argumentIndex,
    expression,
    sourceSemantics
  );
};
