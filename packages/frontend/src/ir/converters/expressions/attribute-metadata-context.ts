import { getTstsIdentifierText, TstsSyntax, type TstsNode } from "@tsonic/tsts";
import type { TstsFrontendSourceSemanticView } from "../../../source-frontend/index.js";
import {
  isMarkerApiKind,
  markerApiSemanticsFactKey,
} from "../../../source-frontend/index.js";

const stripParentheses = (expr: TstsNode): TstsNode => {
  let current = expr;
  while (current.Kind === TstsSyntax.KindParenthesizedExpression) {
    const inner = TstsSyntax.AsParenthesizedExpression(current)?.Expression;
    if (!inner) break;
    current = inner;
  }
  return current;
};

const isAttributesApiIdentifier = (
  expression: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean =>
  isMarkerApiKind(
    sourceSemantics.getFact(expression, markerApiSemanticsFactKey),
    "attributes"
  );

const isAttributesApiRootExpression = (
  expression: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean => {
  const current = stripParentheses(expression);

  if (current.Kind === TstsSyntax.KindIdentifier) {
    return isAttributesApiIdentifier(current, sourceSemantics);
  }

  if (current.Kind === TstsSyntax.KindCallExpression) {
    const expressionNode = TstsSyntax.AsCallExpression(current)?.Expression;
    return expressionNode
      ? isAttributesApiRootExpression(expressionNode, sourceSemantics)
      : false;
  }

  if (current.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const expressionNode =
      TstsSyntax.AsPropertyAccessExpression(current)?.Expression;
    return expressionNode
      ? isAttributesApiRootExpression(expressionNode, sourceSemantics)
      : false;
  }

  return false;
};

export const isAttributeMetadataNamedArgumentPosition = (
  call: TstsNode,
  argumentIndex: number,
  expression: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean => {
  const unwrapped = stripParentheses(expression);
  if (unwrapped.Kind !== TstsSyntax.KindObjectLiteralExpression) {
    return false;
  }

  if (argumentIndex === 0) {
    return false;
  }

  const callExpression = TstsSyntax.AsCallExpression(call);
  if (!callExpression?.Expression) {
    return false;
  }

  const callee = stripParentheses(callExpression.Expression);
  if (callee.Kind !== TstsSyntax.KindPropertyAccessExpression) {
    return false;
  }

  const calleeName = getTstsIdentifierText(TstsSyntax.Node_Name(callee));
  if (calleeName !== "add" && calleeName !== "attr") {
    return false;
  }

  const receiver = TstsSyntax.AsPropertyAccessExpression(callee)?.Expression;
  return receiver
    ? isAttributesApiRootExpression(receiver, sourceSemantics)
    : false;
};

export const isAttributeMetadataNamedArgumentObjectLiteral = (
  node: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean => {
  let expression: TstsNode = node;
  let parent = node.Parent;
  while (parent?.Kind === TstsSyntax.KindParenthesizedExpression) {
    expression = parent;
    parent = parent.Parent;
  }

  if (!parent || parent.Kind !== TstsSyntax.KindCallExpression) {
    return false;
  }

  const argumentsList = (TstsSyntax.Node_Arguments(parent) ?? []).filter(
    (argument): argument is TstsNode => argument !== undefined
  );
  const argumentIndex = argumentsList.findIndex(
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
