import type {
  LoweringExpressionPlan,
  LoweringObjectPropertyPlan,
  LoweringParameterPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { sanitizeIdentifier } from "./names.js";
import { renderStatement } from "./statements.js";
import { renderCSharpType } from "./types.js";

type LoweringBinaryOperator = NonNullable<LoweringExpressionPlan["binaryOperator"]>;
type LoweringUnaryOperator = NonNullable<LoweringExpressionPlan["unaryOperator"]>;

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

const binaryOperatorMap: ReadonlyMap<LoweringBinaryOperator, string> = new Map([
  ["equal", "=="],
  ["strict-equal", "=="],
  ["not-equal", "!="],
  ["strict-not-equal", "!="],
  ["logical-and", "&&"],
  ["logical-or", "||"],
  ["nullish-coalesce", "??"],
  ["add", "+"],
  ["subtract", "-"],
  ["multiply", "*"],
  ["divide", "/"],
  ["remainder", "%"],
  ["bitwise-and", "&"],
  ["bitwise-or", "|"],
  ["bitwise-xor", "^"],
  ["left-shift", "<<"],
  ["signed-right-shift", ">>"],
  ["unsigned-right-shift", ">>"],
  ["less-than", "<"],
  ["less-than-or-equal", "<="],
  ["greater-than", ">"],
  ["greater-than-or-equal", ">="],
  ["assign", "="],
  ["add-assign", "+="],
  ["subtract-assign", "-="],
  ["multiply-assign", "*="],
  ["divide-assign", "/="],
  ["remainder-assign", "%="],
  ["bitwise-and-assign", "&="],
  ["bitwise-or-assign", "|="],
  ["bitwise-xor-assign", "^="],
  ["left-shift-assign", "<<="],
  ["signed-right-shift-assign", ">>="],
  ["unsigned-right-shift-assign", ">>="],
  ["instanceof", "is"],
]);

const renderOperator = (
  operator: LoweringBinaryOperator | undefined
): string | undefined => (operator ? binaryOperatorMap.get(operator) : undefined);

const renderUnaryOperator = (
  operator: LoweringUnaryOperator | undefined,
  context: RenderContext,
  plan: LoweringExpressionPlan
): string => {
  switch (operator) {
    case "plus":
      return "+";
    case "minus":
      return "-";
    case "logical-not":
      return "!";
    case "bitwise-not":
      return "~";
    case "increment":
      return "++";
    case "decrement":
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

const arrayLiteralElementType = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  const arrayPlan =
    plan.contextualTypePlan?.kind === "array"
      ? plan.contextualTypePlan
      : plan.type?.kind === "array"
        ? plan.type
        : undefined;
  if (arrayPlan) return renderCSharpType(arrayPlan.elementType, context);
  const tuplePlan =
    plan.type?.kind === "tuple"
      ? plan.type
      : plan.contextualTypePlan?.kind === "tuple"
        ? plan.contextualTypePlan
        : undefined;
  if (tuplePlan) {
    const elementTypes = tuplePlan.elements.map((element) =>
      renderCSharpType(element, context)
    );
    const first = elementTypes[0];
    return first && elementTypes.every((part) => part === first)
      ? first
      : "object?";
  }
  return undefined;
};

const objectLiteralTargetType = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  return plan.contextualTypePlan?.kind === "named" ||
    plan.contextualTypePlan?.kind === "object"
    ? renderCSharpType(plan.contextualTypePlan, context)
    : undefined;
};

const renderLambdaParameter = (
  parameter: LoweringParameterPlan,
  context: RenderContext
): string =>
  `${parameter.rest ? "params " : ""}${renderCSharpType(parameter.type, context)} ${sanitizeIdentifier(parameter.name)}`;

export const renderFunctionExpressionType = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext
): string | undefined => {
  if (
    !plan ||
    (plan.expressionKind !== "arrow-function" &&
      plan.expressionKind !== "function-expression")
  ) {
    return undefined;
  }
  const parameterTypes = plan.parameters.map((parameter) =>
    renderCSharpType(parameter.type, context)
  );
  const returnType = renderCSharpType(
    plan.returnType ?? { kind: "intrinsic", name: "void" },
    context
  );
  return returnType === "void"
    ? parameterTypes.length === 0
      ? "global::System.Action"
      : `global::System.Action<${parameterTypes.join(", ")}>`
    : `global::System.Func<${[...parameterTypes, returnType].join(", ")}>`;
};

const renderTypeArguments = (
  typeArguments: readonly LoweringTypeRefPlan[] | undefined,
  context: RenderContext
): string =>
  typeArguments && typeArguments.length > 0
    ? `<${typeArguments.map((typeArgument) => renderCSharpType(typeArgument, context)).join(", ")}>`
    : "";

const firstRenderedTypeArgument = (
  plan: LoweringExpressionPlan,
  context: RenderContext,
  feature: string
): string | undefined => {
  const first = plan.typeArguments[0];
  if (!first) {
    context.reportUnsupported(feature, plan.sourceKindName, plan.sourceText);
    return undefined;
  }
  return renderCSharpType(first, context);
};

const renderLambda = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string => {
  const parameters = plan.parameters
    .map((parameter) => renderLambdaParameter(parameter, context))
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
): string => {
  const rendered =
    argument.expressionKind === "spread"
      ? renderExpression(argument.expression, context)
      : renderExpression(argument, context);
  switch (argument.passingMode) {
    case "byref-writeonly-must-init":
      return `out ${rendered}`;
    case "byref-readwrite":
      return `ref ${rendered}`;
    case "byref-readonly":
      return `in ${rendered}`;
    case "by-value":
    case undefined:
      return rendered;
  }
};

const renderIntrinsicCall = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  switch (plan.intrinsicKind) {
    case undefined:
      return undefined;
    case "defaultof": {
      const type = firstRenderedTypeArgument(plan, context, "defaultof intrinsic");
      return type ? `default(${type})` : "";
    }
    case "nameof": {
      const argument = plan.arguments[0];
      return argument ? `nameof(${renderExpression(argument, context)})` : "\"\"";
    }
    case "sizeof": {
      const type = firstRenderedTypeArgument(plan, context, "sizeof intrinsic");
      return type ? `sizeof(${type})` : "";
    }
    case "istype": {
      const type = firstRenderedTypeArgument(plan, context, "istype intrinsic");
      const value = renderExpression(plan.arguments[0], context);
      return type ? `${value} is ${type}` : "";
    }
    case "trycast": {
      const type = firstRenderedTypeArgument(plan, context, "trycast intrinsic");
      const value = renderExpression(plan.arguments[0], context);
      return type ? `${value} as ${type}` : "";
    }
    case "asinterface": {
      const type = firstRenderedTypeArgument(plan, context, "asinterface intrinsic");
      const value = renderExpression(plan.arguments[0], context);
      return type ? `((${type})(${value}))` : "";
    }
    case "stackalloc": {
      const type = firstRenderedTypeArgument(plan, context, "stackalloc intrinsic");
      const length = renderExpression(plan.arguments[0], context);
      return type ? `stackalloc ${type}[${length}]` : "";
    }
  }
};

export const isCompileTimeOnlyExpression = (
  plan: LoweringExpressionPlan | undefined
): boolean => plan?.semantic === "compile-time-marker-call";

export const renderExpression = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  if (!plan) return "";

  switch (plan.expressionKind) {
    case "identifier":
      {
        const rawName = plan.literalText ?? plan.name ?? "value";
        return sanitizeIdentifier(plan.resolvedAliasName ?? rawName);
      }
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
      const operator = renderOperator(plan.binaryOperator);
      if (!operator) return unsupportedExpression(context, plan);
      return `${renderExpression(plan.left, context)} ${operator} ${renderExpression(plan.right, context)}`;
    }
    case "prefix-unary":
      return `${renderUnaryOperator(plan.unaryOperator, context, plan)}${renderExpression(plan.expression, context)}`;
    case "postfix-unary":
      return `${renderExpression(plan.expression, context)}${renderUnaryOperator(plan.unaryOperator, context, plan)}`;
    case "typeof":
      return `((object?)${renderExpression(plan.expression, context)}) switch { null => "object", string => "string", char => "string", bool => "boolean", sbyte or byte or short or ushort or int or uint or long or ulong or float or double or decimal => "number", global::System.Numerics.BigInteger => "bigint", global::System.Delegate => "function", _ => "object" }`;
    case "void":
      return renderExpression(plan.expression, context);
    case "property-access": {
      const rawMember = plan.literalText ?? "member";
      if (plan.semantic === "console-write") {
        return "global::System.Console.WriteLine";
      }
      const member = sanitizeIdentifier(rawMember);
      const renderedMember = plan.semantic === "length-property" ? "Length" : member;
      return `${renderExpression(plan.expression, context)}.${renderedMember}`;
    }
    case "element-access":
      return `${renderExpression(plan.expression, context)}[${renderExpression(plan.arguments[0], context)}]`;
    case "call":
      {
        const intrinsic = renderIntrinsicCall(plan, context);
        if (intrinsic !== undefined) return intrinsic;
      }
      return `${renderExpression(plan.expression, context)}${renderTypeArguments(plan.typeArguments, context)}(${plan.arguments
        .map((argument) => renderCallArgument(argument, context))
        .join(", ")})`;
    case "new":
      if (plan.semantic === "error-constructor") {
        return `new global::System.Exception(${plan.arguments
          .map((argument) => renderCallArgument(argument, context))
          .join(", ")})`;
      }
      return `new ${renderExpression(plan.expression, context)}${renderTypeArguments(plan.typeArguments, context)}(${plan.arguments
        .map((argument) => renderCallArgument(argument, context))
        .join(", ")})`;
    case "arrow-function":
    case "function-expression":
      return renderLambda(plan, context);
    case "array-literal":
      {
        const elementType = arrayLiteralElementType(plan, context);
        const constructor = elementType ? `new ${elementType}[]` : "new[]";
        return `${constructor} { ${plan.elements
        .map((element) => renderExpression(element, context))
        .join(", ")} }`;
      }
    case "object-literal":
      {
        const targetType = objectLiteralTargetType(plan, context);
        const constructor = targetType ? `new ${targetType}` : "new";
        return `${constructor} { ${plan.properties
        .map((property) => renderObjectProperty(property, context))
        .filter((rendered): rendered is string => rendered !== undefined)
        .join(", ")} }`;
      }
    case "conditional":
      return `${renderConditionExpression(plan.condition, context)} ? ${renderExpression(
        plan.whenTrue,
        context
      )} : ${renderExpression(plan.whenFalse, context)}`;
    case "unsupported":
      return unsupportedExpression(context, plan);
  }
};

const isBooleanConditionType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type === undefined ||
  (type.kind === "intrinsic" && type.name === "boolean") ||
  (type.kind === "source-primitive" && type.fact.kind === "bool") ||
  (type.kind === "literal" && type.literalKind === "boolean");

const needsNullishConditionCheck = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "union"
    ? type.types.some(
        (member) =>
          (member.kind === "intrinsic" &&
            (member.name === "undefined" || member.name === "null")) ||
          (member.kind === "literal" &&
            (member.literalKind === "undefined" || member.literalKind === "null"))
      )
    : type?.kind === "intrinsic" &&
      (type.name === "any" || type.name === "unknown" || type.name === "object");

export const renderConditionExpression = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  if (!plan) return "";
  const rendered = renderExpression(plan, context);
  if (isBooleanConditionType(plan.type)) return rendered;
  return needsNullishConditionCheck(plan.type) ? `${rendered} != null` : rendered;
};
