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

type LoweringBinaryOperator = NonNullable<
  LoweringExpressionPlan["binaryOperator"]
>;
type LoweringUnaryOperator = NonNullable<
  LoweringExpressionPlan["unaryOperator"]
>;
type SourceRuntimeOperation = NonNullable<
  LoweringExpressionPlan["sourceOperation"]
>;

const escapeString = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");

const escapeChar = (
  value: string,
  context: RenderContext,
  plan: LoweringExpressionPlan
): string => {
  if (value.length !== 1) {
    context.reportUnsupported(
      "char literal",
      plan.sourceKindName,
      plan.sourceText
    );
    return "'\\0'";
  }
  switch (value) {
    case "\\":
      return "'\\\\'";
    case "'":
      return "'\\''";
    case "\r":
      return "'\\r'";
    case "\n":
      return "'\\n'";
    case "\t":
      return "'\\t'";
    case "\0":
      return "'\\0'";
    default: {
      const codeUnit = value.charCodeAt(0);
      return codeUnit < 0x20 || codeUnit === 0x7f
        ? `'\\u${codeUnit.toString(16).padStart(4, "0")}'`
        : `'${value}'`;
    }
  }
};

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
): string | undefined =>
  operator ? binaryOperatorMap.get(operator) : undefined;

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
      context.reportUnsupported(
        "unary operator",
        plan.sourceKindName,
        plan.sourceText
      );
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

const arrayLiteralTypePlan = (
  plan: LoweringExpressionPlan
): LoweringTypeRefPlan | undefined =>
  plan.contextualTypePlan?.kind === "array"
    ? plan.contextualTypePlan
    : plan.type?.kind === "array"
      ? plan.type
      : undefined;

const isCharType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type?.kind === "source-primitive" && type.fact.kind === "char";

const shouldRenderStringLiteralAsChar = (
  plan: LoweringExpressionPlan
): boolean => isCharType(plan.contextualTypePlan) || isCharType(plan.type);

const renderArraySegment = (
  elementType: string,
  elements: readonly LoweringExpressionPlan[],
  context: RenderContext
): string =>
  elements.length === 0
    ? `global::System.Array.Empty<${elementType}>()`
    : `new ${elementType}[] { ${elements
        .map((element) => renderExpression(element, context))
        .join(", ")} }`;

const renderArrayLiteral = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string => {
  const arrayPlan = arrayLiteralTypePlan(plan);
  const elementType = arrayLiteralElementType(plan, context);
  if (!plan.elements.some((element) => element.expressionKind === "spread")) {
    if (arrayPlan?.kind === "array" && !arrayPlan.readonly) {
      return `new global::System.Collections.Generic.List<${elementType ?? "object?"}> { ${plan.elements
        .map((element) => renderExpression(element, context))
        .join(", ")} }`;
    }
    const constructor = elementType ? `new ${elementType}[]` : "new[]";
    return `${constructor} { ${plan.elements
      .map((element) => renderExpression(element, context))
      .join(", ")} }`;
  }

  const segmentType = elementType ?? "object?";
  const segments: string[] = [];
  let currentElements: LoweringExpressionPlan[] = [];
  const flushCurrentElements = (): void => {
    if (currentElements.length === 0) return;
    segments.push(renderArraySegment(segmentType, currentElements, context));
    currentElements = [];
  };

  for (const element of plan.elements) {
    if (element.expressionKind === "spread") {
      flushCurrentElements();
      segments.push(renderExpression(element.expression, context));
    } else {
      currentElements.push(element);
    }
  }
  flushCurrentElements();

  const firstSegment =
    segments.shift() ?? `global::System.Array.Empty<${segmentType}>()`;
  const concatenated = segments.reduce(
    (current, segment) =>
      `global::System.Linq.Enumerable.Concat(${current}, ${segment})`,
    firstSegment
  );
  return arrayPlan?.kind === "array" && !arrayPlan.readonly
    ? `new global::System.Collections.Generic.List<${segmentType}>(${concatenated})`
    : `global::System.Linq.Enumerable.ToArray(${concatenated})`;
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
  context: RenderContext,
  includeType: boolean
): string =>
  includeType
    ? `${parameter.rest ? "params " : ""}${renderCSharpType(parameter.type, context)} ${sanitizeIdentifier(parameter.name)}`
    : sanitizeIdentifier(parameter.name);

const lambdaContextReturnType = (
  plan: LoweringExpressionPlan
): LoweringTypeRefPlan | undefined => {
  if (plan.returnType) return plan.returnType;
  if (plan.contextualTypePlan?.kind === "function") {
    return plan.contextualTypePlan.returnType;
  }
  return plan.type?.kind === "function" ? plan.type.returnType : undefined;
};

const isVoidLikeType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type?.kind === "intrinsic" &&
  (type.name === "void" || type.name === "undefined" || type.name === "never");

const renderVoidLambdaExpressionBody = (
  expression: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  if (!expression || expression.semantic === "undefined-value") return "{ }";
  const rendered = renderExpression(expression, context);
  switch (expression.expressionKind) {
    case "call":
    case "new":
    case "postfix-unary":
    case "prefix-unary":
    case "await":
      return `{ ${rendered}; }`;
    default:
      return `{ _ = ${rendered}; }`;
  }
};

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
  context: RenderContext,
  includeParameterTypes = true
): string => {
  const parameters = plan.parameters
    .map((parameter) =>
      renderLambdaParameter(parameter, context, includeParameterTypes)
    )
    .join(", ");
  const asyncModifier = plan.async ? "async " : "";
  const body = plan.body
    ? renderStatement(plan.body, context)
    : isVoidLikeType(lambdaContextReturnType(plan))
      ? renderVoidLambdaExpressionBody(plan.expression, context)
      : renderExpression(plan.expression, context);
  return `${asyncModifier}(${parameters}) => ${body}`;
};

const renderCallArgument = (
  argument: LoweringExpressionPlan,
  context: RenderContext
): string => {
  if (
    argument.expressionKind === "arrow-function" ||
    argument.expressionKind === "function-expression"
  ) {
    return renderLambda(argument, context, false);
  }
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

const renderSourceRuntimeName = (
  operation: SourceRuntimeOperation
): string => {
  switch (operation.owner) {
    case "Console":
      return "global::System.Console";
    case "Array":
    case "Error":
    case "JSON":
    case "Object":
    case "RegExp":
    case "String":
      return `global::js.${operation.owner}`;
    case "Function":
      return "global::System.Delegate";
  }
  return "global::System.Object";
};

const renderFunctionLength = (
  plan: LoweringExpressionPlan | undefined
): string => {
  const type = plan?.type?.kind === "function" ? plan.type : undefined;
  if (!type) return "0";
  const firstIgnoredParameter = type.parameters.findIndex(
    (parameter) => parameter.optional || parameter.rest || parameter.initializer
  );
  const arity =
    firstIgnoredParameter < 0 ? type.parameters.length : firstIgnoredParameter;
  return String(arity);
};

const nonNullishUnionTypes = (
  type: LoweringTypeRefPlan
): readonly LoweringTypeRefPlan[] =>
  type.kind === "union"
    ? type.types.filter(
        (member) =>
          !(
            (member.kind === "intrinsic" &&
              (member.name === "undefined" || member.name === "null")) ||
            (member.kind === "literal" &&
              (member.literalKind === "undefined" ||
                member.literalKind === "null"))
          )
      )
    : [type];

const unwrapAliasTarget = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined =>
  type?.kind === "named" && type.aliasTarget
    ? unwrapAliasTarget(type.aliasTarget)
    : type;

const arrayTypeFromUseSite = (
  type: LoweringTypeRefPlan | undefined
): Extract<LoweringTypeRefPlan, { readonly kind: "array" }> | undefined => {
  const unwrapped = unwrapAliasTarget(type);
  if (!unwrapped) return undefined;
  if (unwrapped.kind === "array") return unwrapped;
  if (unwrapped.kind === "union") {
    const arrays = nonNullishUnionTypes(unwrapped)
      .map((member) => unwrapAliasTarget(member))
      .filter(
        (
          member
        ): member is Extract<LoweringTypeRefPlan, { readonly kind: "array" }> =>
          member?.kind === "array"
      );
    return arrays.length === 1 ? arrays[0] : undefined;
  }
  return undefined;
};

const arrayReceiverType = (
  plan: LoweringExpressionPlan | undefined
): Extract<LoweringTypeRefPlan, { readonly kind: "array" }> | undefined =>
  arrayTypeFromUseSite(plan?.type) ?? arrayTypeFromUseSite(plan?.contextualTypePlan);

const functionReturnType = (
  plan: LoweringExpressionPlan | undefined
): LoweringTypeRefPlan | undefined => {
  if (!plan) return undefined;
  if (
    (plan.expressionKind === "arrow-function" ||
      plan.expressionKind === "function-expression") &&
    plan.expression?.type
  ) {
    return plan.expression.type;
  }
  if (plan.returnType) return plan.returnType;
  return plan.type?.kind === "function" ? plan.type.returnType : undefined;
};

const arrayOperationResultElementType = (
  plan: LoweringExpressionPlan | undefined
): LoweringTypeRefPlan | undefined => {
  if (plan?.expressionKind !== "call") return undefined;
  const callee = plan.expression;
  const operation = callee?.sourceOperation;
  if (
    !callee ||
    operation?.owner !== "Array" ||
    operation.dispatch !== "receiver-call"
  ) {
    return undefined;
  }
  const receiverType = arrayReceiverType(callee.expression);
  switch (operation.member) {
    case "map":
      return functionReturnType(plan.arguments[0]) ?? receiverType?.elementType;
    case "filter":
    case "slice":
      return receiverType?.elementType;
    default:
      return undefined;
  }
};

const arrayReceiverElementType = (
  plan: LoweringExpressionPlan | undefined
): LoweringTypeRefPlan | undefined =>
  arrayOperationResultElementType(plan) ?? arrayReceiverType(plan)?.elementType;

const castExpression = (rendered: string, targetType: string): string =>
  `((${targetType})(${rendered}))`;

const renderArrayEnumerableReceiver = (
  receiver: string,
  receiverPlan: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  const elementTypePlan = arrayReceiverElementType(receiverPlan);
  if (!elementTypePlan) return receiver;
  const elementType = renderCSharpType(elementTypePlan, context);
  return castExpression(
    receiver,
    `global::System.Collections.Generic.IEnumerable<${elementType}>`
  );
};

const renderArrayListReceiver = (
  receiver: string,
  receiverPlan: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  const elementTypePlan = arrayReceiverElementType(receiverPlan);
  if (!elementTypePlan) return receiver;
  const elementType = renderCSharpType(elementTypePlan, context);
  return castExpression(
    receiver,
    `global::System.Collections.Generic.List<${elementType}>`
  );
};

const renderArrayElementArgument = (
  argument: LoweringExpressionPlan | undefined,
  receiverPlan: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  if (!argument) return "default!";
  const rendered = renderCallArgument(argument, context);
  const elementType = arrayReceiverElementType(receiverPlan);
  if (!elementType) return rendered;
  return castExpression(rendered, renderCSharpType(elementType, context));
};

const renderArrayReceiverCall = (
  receiver: string,
  receiverPlan: LoweringExpressionPlan | undefined,
  operation: SourceRuntimeOperation,
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  const args = plan.arguments.map((argument) =>
    renderCallArgument(argument, context)
  );
  const enumerableReceiver = (): string =>
    renderArrayEnumerableReceiver(receiver, receiverPlan, context);
  const listReceiver = (): string =>
    renderArrayListReceiver(receiver, receiverPlan, context);
  switch (operation.member) {
    case "push":
      if (plan.arguments.length !== 1) {
        context.reportUnsupported(
          "Array.push with multiple arguments",
          plan.sourceKindName,
          plan.sourceText
        );
        return "";
      }
      return `${listReceiver()}.Add(${renderArrayElementArgument(plan.arguments[0], receiverPlan, context)})`;
    case "pop":
      return `${listReceiver()}[^1]`;
    case "join":
    case "toString":
      return `global::System.String.Join(${operation.member === "join" ? (args[0] ?? "\",\"") : "\",\""}, ${enumerableReceiver()})`;
    case "map":
      return `global::System.Linq.Enumerable.ToList(global::System.Linq.Enumerable.Select(${enumerableReceiver()}, ${args[0] ?? "value => value"}))`;
    case "filter":
      return `global::System.Linq.Enumerable.ToList(global::System.Linq.Enumerable.Where(${enumerableReceiver()}, ${args[0] ?? "value => true"}))`;
    case "slice": {
      const start = args[0] ?? "0";
      const end = args[1];
      const skipped = `global::System.Linq.Enumerable.Skip(${enumerableReceiver()}, ${start})`;
      const sliced = end
        ? `global::System.Linq.Enumerable.Take(${skipped}, (${end}) - (${start}))`
        : skipped;
      return `global::System.Linq.Enumerable.ToList(${sliced})`;
    }
    case "includes":
      return `global::System.Linq.Enumerable.Contains(${enumerableReceiver()}, ${renderArrayElementArgument(plan.arguments[0], receiverPlan, context)})`;
    case "indexOf":
      return `${listReceiver()}.IndexOf(${renderArrayElementArgument(plan.arguments[0], receiverPlan, context)})`;
    case "forEach":
      return `${listReceiver()}.ForEach(${args[0] ?? "_ => { }"})`;
    default:
      return `${receiver}.${operation.member}(${args.join(", ")})`;
  }
};

const renderSourceRuntimeCall = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  const callee = plan.expression;
  const operation = callee?.sourceOperation;
  if (!operation) return undefined;
  const args = plan.arguments.map((argument) =>
    renderCallArgument(argument, context)
  );

  if (operation.dispatch === "receiver-call") {
    const receiver = renderExpression(callee.expression, context);
    if (operation.owner === "Array") {
      return renderArrayReceiverCall(
        receiver,
        callee.expression,
        operation,
        plan,
        context
      );
    }
    if (operation.owner === "String" && operation.member === "toString") {
      return receiver;
    }
    if (operation.owner === "Object" && operation.member === "toString") {
      return `(global::System.Convert.ToString(${receiver}) ?? "")`;
    }
    const renderedArgs = [receiver, ...args].join(", ");
    const call = `${renderSourceRuntimeName(operation)}.${operation.member}(${renderedArgs})`;
    return operation.owner === "String" && operation.member === "split"
      ? `new global::System.Collections.Generic.List<string>(${call})`
      : call;
  }

  if (operation.dispatch === "static-call") {
    switch (operation.owner) {
      case "Console":
        return `global::System.Console.WriteLine(${args.join(", ")})`;
      case "Array":
        if (operation.member === "isArray") {
          return `(${args[0] ?? "null"} is global::System.Collections.IEnumerable && ${args[0] ?? "null"} is not string)`;
        }
        break;
      case "Object":
        if (operation.member === "is") {
          return `${renderSourceRuntimeName(operation)}.@is(${args.join(", ")})`;
        }
        break;
      default:
        break;
    }
    return `${renderSourceRuntimeName(operation)}.${operation.member}(${args.join(", ")})`;
  }

  return undefined;
};

const renderSourceRuntimeNew = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  const operation = plan.sourceOperation;
  if (operation?.dispatch !== "constructor") return undefined;
  return `new ${renderSourceRuntimeName(operation)}(${plan.arguments
    .map((argument) => renderCallArgument(argument, context))
    .join(", ")})`;
};

const renderIntrinsicCall = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  switch (plan.intrinsicKind) {
    case undefined:
      return undefined;
    case "defaultof": {
      const type = firstRenderedTypeArgument(
        plan,
        context,
        "defaultof intrinsic"
      );
      return type ? `default(${type})` : "";
    }
    case "nameof": {
      const argument = plan.arguments[0];
      return argument ? `nameof(${renderExpression(argument, context)})` : '""';
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
      const type = firstRenderedTypeArgument(
        plan,
        context,
        "trycast intrinsic"
      );
      const value = renderExpression(plan.arguments[0], context);
      return type ? `${value} as ${type}` : "";
    }
    case "asinterface": {
      const type = firstRenderedTypeArgument(
        plan,
        context,
        "asinterface intrinsic"
      );
      const value = renderExpression(plan.arguments[0], context);
      return type ? `((${type})(${value}))` : "";
    }
    case "stackalloc": {
      const type = firstRenderedTypeArgument(
        plan,
        context,
        "stackalloc intrinsic"
      );
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
    case "identifier": {
      const rawName = plan.literalText ?? plan.name ?? "value";
      if (plan.qualifiedRuntimeName) return plan.qualifiedRuntimeName;
      return sanitizeIdentifier(plan.resolvedAliasName ?? rawName);
    }
    case "this":
      return "this";
    case "super":
      return "base";
    case "literal":
      switch (plan.literalKind) {
        case "string":
          return shouldRenderStringLiteralAsChar(plan)
            ? escapeChar(plan.literalText ?? "", context, plan)
            : `"${escapeString(plan.literalText ?? "")}"`;
        case "number":
          return plan.literalText ?? "0";
        case "bigint":
          context.reportUnsupported(
            "bigint literal",
            plan.sourceKindName,
            plan.sourceText
          );
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
      context.reportUnsupported(
        "yield expression outside statement",
        plan.sourceKindName,
        plan.sourceText
      );
      return "";
    case "spread":
      context.reportUnsupported(
        "spread expression",
        plan.sourceKindName,
        plan.sourceText
      );
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
      const operation = plan.sourceOperation;
      if (operation?.dispatch === "property") {
        switch (operation.owner) {
          case "String":
            return `${renderExpression(plan.expression, context)}.Length`;
          case "Array":
            return `${renderExpression(plan.expression, context)}.Count`;
          case "Function":
            return renderFunctionLength(plan.expression);
          default:
            break;
        }
      }
      const member = sanitizeIdentifier(rawMember);
      return `${renderExpression(plan.expression, context)}.${member}`;
    }
    case "element-access":
      if (
        plan.sourceOperation?.dispatch === "index" &&
        plan.sourceOperation.owner === "String"
      ) {
        return `global::js.String.charAt(${renderExpression(plan.expression, context)}, ${renderExpression(plan.arguments[0], context)})`;
      }
      return `${renderExpression(plan.expression, context)}[${renderExpression(plan.arguments[0], context)}]`;
    case "call":
      {
        const intrinsic = renderIntrinsicCall(plan, context);
        if (intrinsic !== undefined) return intrinsic;
      }
      {
        const sourceRuntimeCall = renderSourceRuntimeCall(plan, context);
        if (sourceRuntimeCall !== undefined) return sourceRuntimeCall;
      }
      return `${renderExpression(plan.expression, context)}${renderTypeArguments(plan.typeArguments, context)}(${plan.arguments
        .map((argument) => renderCallArgument(argument, context))
        .join(", ")})`;
    case "new":
      {
        const sourceRuntimeNew = renderSourceRuntimeNew(plan, context);
        if (sourceRuntimeNew !== undefined) return sourceRuntimeNew;
      }
      return `new ${renderExpression(plan.expression, context)}${renderTypeArguments(plan.typeArguments, context)}(${plan.arguments
        .map((argument) => renderCallArgument(argument, context))
        .join(", ")})`;
    case "arrow-function":
    case "function-expression":
      return renderLambda(plan, context);
    case "array-literal":
      return renderArrayLiteral(plan, context);
    case "object-literal": {
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

const isBooleanConditionType = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
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
            (member.literalKind === "undefined" ||
              member.literalKind === "null"))
      )
    : type?.kind === "intrinsic" &&
      (type.name === "any" ||
        type.name === "unknown" ||
        type.name === "object");

export const renderConditionExpression = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  if (!plan) return "";
  const rendered = renderExpression(plan, context);
  if (isBooleanConditionType(plan.type)) return rendered;
  return needsNullishConditionCheck(plan.type)
    ? `${rendered} != null`
    : rendered;
};
