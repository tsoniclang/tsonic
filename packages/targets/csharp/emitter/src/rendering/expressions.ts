import type {
  LoweringExpressionPlan,
  LoweringObjectPropertyPlan,
  LoweringParameterPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { sanitizeIdentifier } from "./names.js";
import { renderStatement } from "./statements.js";
import { renderCSharpType } from "./types.js";

const escapeString = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");

const escapeInterpolatedStringText = (value: string): string =>
  escapeString(value).replace(/\{/g, "{{").replace(/\}/g, "}}");

const unsupportedExpression = (
  context: RenderContext,
  plan: LoweringExpressionPlan
): string => {
  context.reportUnsupported("expression", plan.sourceKindName, plan.sourceText);
  return "";
};

const binaryOperatorMap: ReadonlyMap<string, string> = new Map([
  ["===", "=="],
  ["KindEqualsEqualsEqualsToken", "=="],
  ["==", "=="],
  ["KindEqualsEqualsToken", "=="],
  ["!==", "!="],
  ["KindExclamationEqualsEqualsToken", "!="],
  ["!=", "!="],
  ["KindExclamationEqualsToken", "!="],
  ["&&", "&&"],
  ["KindAmpersandAmpersandToken", "&&"],
  ["||", "||"],
  ["KindBarBarToken", "||"],
  ["??", "??"],
  ["KindQuestionQuestionToken", "??"],
  ["+", "+"],
  ["KindPlusToken", "+"],
  ["-", "-"],
  ["KindMinusToken", "-"],
  ["*", "*"],
  ["KindAsteriskToken", "*"],
  ["/", "/"],
  ["KindSlashToken", "/"],
  ["%", "%"],
  ["KindPercentToken", "%"],
  ["&", "&"],
  ["KindAmpersandToken", "&"],
  ["|", "|"],
  ["KindBarToken", "|"],
  ["^", "^"],
  ["KindCaretToken", "^"],
  ["<<", "<<"],
  ["KindLessThanLessThanToken", "<<"],
  [">>", ">>"],
  ["KindGreaterThanGreaterThanToken", ">>"],
  [">>>", ">>"],
  ["KindGreaterThanGreaterThanGreaterThanToken", ">>"],
  ["<", "<"],
  ["KindLessThanToken", "<"],
  ["<=", "<="],
  ["KindLessThanEqualsToken", "<="],
  [">", ">"],
  ["KindGreaterThanToken", ">"],
  [">=", ">="],
  ["KindGreaterThanEqualsToken", ">="],
  ["=", "="],
  ["KindEqualsToken", "="],
  ["+=", "+="],
  ["KindPlusEqualsToken", "+="],
  ["-=", "-="],
  ["KindMinusEqualsToken", "-="],
  ["*=", "*="],
  ["KindAsteriskEqualsToken", "*="],
  ["/=", "/="],
  ["KindSlashEqualsToken", "/="],
  ["%=", "%="],
  ["KindPercentEqualsToken", "%="],
  ["&=", "&="],
  ["KindAmpersandEqualsToken", "&="],
  ["|=", "|="],
  ["KindBarEqualsToken", "|="],
  ["^=", "^="],
  ["KindCaretEqualsToken", "^="],
  ["<<=", "<<="],
  ["KindLessThanLessThanEqualsToken", "<<="],
  [">>=", ">>="],
  ["KindGreaterThanGreaterThanEqualsToken", ">>="],
  [">>>=", ">>="],
  ["KindGreaterThanGreaterThanGreaterThanEqualsToken", ">>="],
  ["instanceof", "is"],
  ["KindInstanceOfKeyword", "is"],
]);

const renderOperator = (operatorText: string | undefined): string | undefined =>
  operatorText ? binaryOperatorMap.get(operatorText.trim()) : undefined;

const renderUnaryOperator = (
  operatorText: string | undefined,
  context: RenderContext,
  plan: LoweringExpressionPlan
): string => {
  switch (operatorText) {
    case "PlusToken":
    case "KindPlusToken":
      return "+";
    case "MinusToken":
    case "KindMinusToken":
      return "-";
    case "ExclamationToken":
    case "KindExclamationToken":
      return "!";
    case "TildeToken":
    case "KindTildeToken":
      return "~";
    case "PlusPlusToken":
    case "KindPlusPlusToken":
      return "++";
    case "MinusMinusToken":
    case "KindMinusMinusToken":
      return "--";
    default:
      context.reportUnsupported("unary operator", plan.sourceKindName, plan.sourceText);
      return "";
  }
};

const renderObjectProperty = (
  property: LoweringObjectPropertyPlan,
  context: RenderContext
): string | undefined => {
  if (property.computed || !property.name) {
    context.reportUnsupported(
      "object property name",
      property.sourceKindName,
      property.sourceText
    );
    return undefined;
  }
  return `${sanitizeIdentifier(property.name)} = ${renderExpression(property.expression, context)}`;
};

const renderLambdaParameter = (parameter: LoweringParameterPlan): string =>
  `${parameter.rest ? "params " : ""}${renderCSharpType(parameter.typeText)} ${sanitizeIdentifier(parameter.name)}`;

export const renderFunctionExpressionType = (
  plan: LoweringExpressionPlan | undefined
): string | undefined => {
  if (
    !plan ||
    (plan.expressionKind !== "arrow-function" &&
      plan.expressionKind !== "function-expression")
  ) {
    return undefined;
  }
  const parameterTypes = plan.parameters.map((parameter) =>
    renderCSharpType(parameter.typeText)
  );
  const returnType = renderCSharpType(plan.returnTypeText ?? "void");
  return returnType === "void"
    ? parameterTypes.length === 0
      ? "global::System.Action"
      : `global::System.Action<${parameterTypes.join(", ")}>`
    : `global::System.Func<${[...parameterTypes, returnType].join(", ")}>`;
};

const renderTypeArguments = (
  typeArguments: readonly string[] | undefined
): string =>
  typeArguments && typeArguments.length > 0
    ? `<${typeArguments.map((typeArgument) => renderCSharpType(typeArgument)).join(", ")}>`
    : "";

const renderLambda = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string => {
  const parameters = plan.parameters
    .map((parameter) => renderLambdaParameter(parameter))
    .join(", ");
  const asyncModifier = plan.async ? "async " : "";
  const body = plan.body
    ? renderStatement(plan.body, context)
    : renderExpression(plan.expression, context);
  return `${asyncModifier}(${parameters}) => ${body}`;
};

const renderCallArgument = (
  argument: LoweringExpressionPlan,
  context: RenderContext
): string =>
  argument.expressionKind === "spread"
    ? renderExpression(argument.expression, context)
    : renderExpression(argument, context);

const expressionRootName = (
  plan: LoweringExpressionPlan | undefined
): string | undefined => {
  if (!plan) return undefined;
  switch (plan.expressionKind) {
    case "identifier":
      return plan.literalText ?? plan.name;
    case "call":
    case "property-access":
      return expressionRootName(plan.expression);
    default:
      return undefined;
  }
};

export const isCompileTimeOnlyExpression = (
  plan: LoweringExpressionPlan | undefined
): boolean => {
  const rootName = expressionRootName(plan);
  return rootName === "O" || rootName === "overloads";
};

export const renderExpression = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  if (!plan) return "";

  switch (plan.expressionKind) {
    case "identifier":
      if ((plan.literalText ?? plan.name) === "undefined") return "null";
      return sanitizeIdentifier(plan.literalText ?? plan.name ?? "value");
    case "this":
      return "this";
    case "super":
      return "base";
    case "literal":
      switch (plan.literalKind) {
        case "string":
          return `"${escapeString(plan.literalText ?? "")}"`;
        case "number":
          return plan.literalText ?? "0";
        case "bigint":
          context.reportUnsupported("bigint literal", plan.sourceKindName, plan.sourceText);
          return "";
        case "boolean":
          return plan.literalText === "true" ? "true" : "false";
        case "null":
        case "undefined":
          return "null";
        default:
          return unsupportedExpression(context, plan);
      }
    case "parenthesized":
      return `(${renderExpression(plan.expression, context)})`;
    case "template":
      return `$"${plan.templateParts
        .map((part) =>
          part.expression
            ? `{${renderExpression(part.expression, context)}}${escapeInterpolatedStringText(part.text)}`
            : escapeInterpolatedStringText(part.text)
        )
        .join("")}"`;
    case "erased-wrapper":
      return renderExpression(plan.expression, context);
    case "await":
      return `await ${renderExpression(plan.expression, context)}`;
    case "yield":
      context.reportUnsupported("yield expression outside statement", plan.sourceKindName, plan.sourceText);
      return "";
    case "spread":
      context.reportUnsupported("spread expression", plan.sourceKindName, plan.sourceText);
      return "";
    case "binary": {
      const operator = renderOperator(plan.operatorText);
      if (!operator) return unsupportedExpression(context, plan);
      return `${renderExpression(plan.left, context)} ${operator} ${renderExpression(plan.right, context)}`;
    }
    case "prefix-unary":
      return `${renderUnaryOperator(plan.operatorText, context, plan)}${renderExpression(plan.expression, context)}`;
    case "postfix-unary":
      return `${renderExpression(plan.expression, context)}${renderUnaryOperator(plan.operatorText, context, plan)}`;
    case "typeof":
      return `((object?)${renderExpression(plan.expression, context)}) switch { null => "object", string => "string", char => "string", bool => "boolean", sbyte or byte or short or ushort or int or uint or long or ulong or float or double or decimal => "number", global::System.Numerics.BigInteger => "bigint", global::System.Delegate => "function", _ => "object" }`;
    case "property-access": {
      const rawMember = plan.literalText ?? "member";
      if (
        plan.expression?.expressionKind === "identifier" &&
        (plan.expression.literalText ?? plan.expression.name) === "console" &&
        (rawMember === "log" ||
          rawMember === "info" ||
          rawMember === "warn" ||
          rawMember === "error")
      ) {
        return "global::System.Console.WriteLine";
      }
      const member = sanitizeIdentifier(rawMember);
      const renderedMember = member === "length" ? "Length" : member;
      return `${renderExpression(plan.expression, context)}.${renderedMember}`;
    }
    case "element-access":
      return `${renderExpression(plan.expression, context)}[${renderExpression(plan.arguments[0], context)}]`;
    case "call":
      return `${renderExpression(plan.expression, context)}${renderTypeArguments(plan.typeArguments)}(${plan.arguments
        .map((argument) => renderCallArgument(argument, context))
        .join(", ")})`;
    case "new":
      return `new ${renderExpression(plan.expression, context)}${renderTypeArguments(plan.typeArguments)}(${plan.arguments
        .map((argument) => renderCallArgument(argument, context))
        .join(", ")})`;
    case "arrow-function":
    case "function-expression":
      return renderLambda(plan, context);
    case "array-literal":
      if (plan.typeText?.trim().startsWith("[")) {
        return `(${plan.elements
          .map((element) => renderExpression(element, context))
          .join(", ")})`;
      }
      return `new[] { ${plan.elements
        .map((element) => renderExpression(element, context))
        .join(", ")} }`;
    case "object-literal":
      return `new { ${plan.properties
        .map((property) => renderObjectProperty(property, context))
        .filter((rendered): rendered is string => rendered !== undefined)
        .join(", ")} }`;
    case "conditional":
      return `${renderConditionExpression(plan.condition, context)} ? ${renderExpression(
        plan.whenTrue,
        context
      )} : ${renderExpression(plan.whenFalse, context)}`;
    case "unsupported":
      return unsupportedExpression(context, plan);
  }
};

export const renderConditionExpression = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  if (!plan) return "";
  const rendered = renderExpression(plan, context);
  const typeText = plan.typeText?.trim();
  if (
    typeText === undefined ||
    typeText === "boolean" ||
    typeText === "bool" ||
    typeText === "true" ||
    typeText === "false"
  ) {
    return rendered;
  }
  if (
    typeText.includes("undefined") ||
    typeText.includes("null") ||
    typeText.includes("=>") ||
    typeText === "object" ||
    typeText === "unknown" ||
    typeText === "any"
  ) {
    return `${rendered} != null`;
  }
  return rendered;
};
