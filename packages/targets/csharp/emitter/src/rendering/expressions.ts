import type {
  LoweringExpressionPlan,
  LoweringObjectPropertyPlan,
  LoweringParameterPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { sanitizeIdentifier } from "./names.js";
import { renderStatement } from "./statements.js";
import { renderCSharpType, renderNullableCSharpType } from "./types.js";

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
  const renderedExpression = renderExpression(property.expression, context);
  const targetArray = arrayTypeFromUseSite(property.expression.contextualTypePlan);
  const sourceArray = arrayTypeFromUseSite(property.expression.type);
  if (targetArray && sourceArray) {
    const targetElementType = renderCSharpType(targetArray.elementType, context);
    const sourceElementType = renderCSharpType(sourceArray.elementType, context);
    if (targetElementType !== sourceElementType) {
      return `${sanitizeIdentifier(property.name)} = new global::System.Collections.Generic.List<${targetElementType}>(global::System.Linq.Enumerable.Cast<${targetElementType}>(${renderedExpression}))`;
    }
  }
  return `${sanitizeIdentifier(property.name)} = ${renderedExpression}`;
};

const renderDictionaryObjectProperty = (
  property: LoweringObjectPropertyPlan,
  valueType: string,
  context: RenderContext
): string | undefined => {
  if (property.computed || !property.name) {
    context.reportUnsupported(
      "dictionary object property name",
      property.sourceKindName,
      property.sourceText
    );
    return undefined;
  }
  return `["${property.name}"] = ${castExpression(renderExpression(property.expression, context), valueType)}`;
};

const arrayLiteralElementType = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  const arrayPlan =
    arrayTypeFromUseSite(plan.contextualTypePlan) ??
    arrayTypeFromUseSite(plan.type);
  if (arrayPlan) {
    const rendered = renderCSharpType(arrayPlan.elementType, context);
    return rendered === "void" ? "object?" : rendered;
  }
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
  arrayTypeFromUseSite(plan.contextualTypePlan) ??
  arrayTypeFromUseSite(plan.type);

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
  const tuplePlan =
    plan.contextualTypePlan?.kind === "tuple"
      ? plan.contextualTypePlan
      : plan.type?.kind === "tuple"
        ? plan.type
        : undefined;
  if (tuplePlan) {
    return `(${plan.elements
      .map((element) => renderExpression(element, context))
      .join(", ")})`;
  }
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
    ? `${parameter.rest ? "params " : ""}${parameter.optional ? renderNullableCSharpType(parameter.type, context) : renderCSharpType(parameter.type, context)} ${sanitizeIdentifier(parameter.name)}`
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
    parameter.optional
      ? renderNullableCSharpType(parameter.type, context)
      : renderCSharpType(parameter.type, context)
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

const isCastableUseSiteExpression = (
  plan: LoweringExpressionPlan | undefined
): boolean => {
  switch (plan?.expressionKind) {
    case "identifier":
    case "property-access":
    case "element-access":
    case "call":
    case "parenthesized":
    case "erased-wrapper":
      return true;
    default:
      return false;
  }
};

const useSiteCastType = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext
): string | undefined => {
  if (!type) return undefined;
  switch (type.kind) {
    case "intrinsic":
      switch (type.name) {
        case "any":
        case "unknown":
        case "object":
        case "undefined":
        case "null":
        case "void":
        case "never":
        case "this":
          return undefined;
        default:
          return renderCSharpType(type, context);
      }
    case "unsupported":
      return undefined;
    case "named":
      if (type.name === "_") return undefined;
      if (type.name.includes("\uFFFD")) return undefined;
      if (type.qualifiedRuntimeName?.endsWith("._")) return undefined;
      {
        const rendered = renderCSharpType(type, context);
        return rendered === "object?" ? undefined : rendered;
      }
    case "literal":
      return undefined;
    default: {
      const rendered = renderCSharpType(type, context);
      return rendered === "object?" || rendered === "void" || rendered === "this"
        ? undefined
        : rendered;
    }
  }
};

const renderExpressionWithUseSiteCast = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext,
  useSiteTypeOverride?: LoweringTypeRefPlan
): string => {
  const rendered = renderExpression(plan, context);
  if (!isCastableUseSiteExpression(plan)) return rendered;
  if (
    plan?.expressionKind === "call" &&
    plan.expression?.sourceOperation?.dispatch === "static-call" &&
    plan.expression.sourceOperation.owner === "Object" &&
    plan.expression.sourceOperation.member === "entries"
  ) {
    return rendered;
  }
  if (
    useSiteTypeOverride &&
    plan?.type &&
    renderCSharpType(useSiteTypeOverride, context) ===
      renderCSharpType(plan.type, context)
  ) {
    return rendered;
  }
  const castType = useSiteCastType(useSiteTypeOverride ?? plan?.type, context);
  return castType ? `((${castType})(${rendered}))` : rendered;
};

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
  const targetDelegateType = isNamedFunctionAlias(argument.contextualTypePlan)
    ? argument.contextualTypePlan
    : undefined;
  if (
    argument.expressionKind === "arrow-function" ||
    argument.expressionKind === "function-expression"
  ) {
    const renderedLambda = renderLambda(argument, context, false);
    return targetDelegateType
      ? `((${renderCSharpType(targetDelegateType, context)})(${renderedLambda}))`
      : renderedLambda;
  }
  const rendered =
    argument.expressionKind === "spread"
      ? renderExpression(argument.expression, context)
      : renderExpressionWithUseSiteCast(
          argument,
          context,
          argument.contextualTypePlan
        );
  if (
    targetDelegateType &&
    !(
      argument.type?.kind === "named" &&
      argument.type.qualifiedRuntimeName === targetDelegateType.qualifiedRuntimeName
    )
  ) {
    return `new ${renderCSharpType(targetDelegateType, context)}(${rendered}.Invoke)`;
  }
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
      return "global::js.ConsoleModule";
    case "Array":
    case "DataView":
    case "Error":
    case "Float32Array":
    case "Float64Array":
    case "Global":
    case "Int16Array":
    case "Int32Array":
    case "Int8Array":
    case "JSON":
    case "Map":
    case "Object":
    case "RegExp":
    case "String":
    case "Uint16Array":
    case "Uint32Array":
    case "Uint8Array":
    case "Uint8ClampedArray":
      return operation.owner === "Global"
        ? "global::js.Globals"
        : `global::js.${operation.owner}`;
    case "Function":
      return "global::System.Delegate";
  }
  return "global::System.Object";
};

const renderQualifiedRuntimeExpressionName = (qualifiedName: string): string =>
  qualifiedName
    .split(".")
    .map((segment) => {
      const globalPrefix = "global::";
      if (segment.startsWith(globalPrefix)) {
        return `${globalPrefix}${sanitizeIdentifier(segment.slice(globalPrefix.length))}`;
      }
      return sanitizeIdentifier(segment);
    })
    .join(".");

const consoleMemberTarget = (member: string): string =>
  `${renderSourceRuntimeName({
    dispatch: "static-call",
    owner: "Console",
    member,
  })}.${member}`;

const renderConsoleCall = (
  operation: SourceRuntimeOperation,
  args: readonly string[]
): string => `${consoleMemberTarget(operation.member)}(${args.join(", ")})`;

const renderFunctionLength = (
  plan: LoweringExpressionPlan | undefined
): string => {
  void plan;
  return "0";
};

const isTypedArrayRuntimeOwner = (
  owner: SourceRuntimeOperation["owner"]
): boolean =>
  owner === "Uint8Array" ||
  owner === "Uint8ClampedArray" ||
  owner === "Int8Array" ||
  owner === "Uint16Array" ||
  owner === "Int16Array" ||
  owner === "Uint32Array" ||
  owner === "Int32Array" ||
  owner === "Float32Array" ||
  owner === "Float64Array";

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

const recordValueType = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined => {
  const unwrapped = unwrapAliasTarget(type);
  if (!unwrapped) return undefined;
  if (unwrapped.kind === "named" && unwrapped.name === "Record") {
    return unwrapped.typeArguments[1];
  }
  if (unwrapped.kind === "union") {
    const values = nonNullishUnionTypes(unwrapped)
      .map((member) => recordValueType(member))
      .filter((value): value is LoweringTypeRefPlan => value !== undefined);
    const firstKey = values[0] ? renderTypeIdentityKey(values[0]) : undefined;
    return firstKey && values.every((value) => renderTypeIdentityKey(value) === firstKey)
      ? values[0]
      : undefined;
  }
  return undefined;
};

const renderTypeIdentityKey = (type: LoweringTypeRefPlan): string => {
  switch (type.kind) {
    case "intrinsic":
      return `intrinsic:${type.name}`;
    case "source-primitive":
      return `source-primitive:${type.fact.kind}:${type.fact.sourceName}`;
    case "named":
      return `named:${type.qualifiedRuntimeName ?? type.name}<${type.typeArguments.map(renderTypeIdentityKey).join(",")}>`;
    default:
      return type.sourceText ?? type.kind;
  }
};

const isNamedFunctionAlias = (
  type: LoweringTypeRefPlan | undefined
): type is Extract<LoweringTypeRefPlan, { readonly kind: "named" }> =>
  type?.kind === "named" && type.aliasTarget?.kind === "function";

const isCallableStorageType = (
  type: LoweringTypeRefPlan | undefined
): boolean => {
  if (isNamedFunctionAlias(type)) return true;
  return unwrapAliasTarget(type)?.kind === "function";
};

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

const isUnboundGenericPlaceholderType = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "named" &&
  (type.qualifiedRuntimeName?.includes("::js._.") === true ||
    !type.qualifiedRuntimeName) &&
  !type.aliasTarget &&
  type.typeArguments.length === 0 &&
  /^[A-Z]$/.test(type.name);

const enumerableObjectCast = (receiver: string): string =>
  `global::System.Linq.Enumerable.Cast<object?>((global::System.Collections.IEnumerable)(${receiver}))`;

const containsUnboundPlaceholderCast = (receiver: string): boolean =>
  /<\s*[A-Z]\s*[>,]/.test(receiver) || /<\s*[A-Z]\s*>/.test(receiver);

const renderArrayLength = (
  receiverPlan: LoweringExpressionPlan | undefined,
  context: RenderContext,
  useSiteTypeOverride?: LoweringTypeRefPlan
): string => {
  const elementTypePlan =
    arrayReceiverElementType(receiverPlan) ??
    arrayTypeFromUseSite(useSiteTypeOverride)?.elementType;
  const typedReceiver = renderExpressionWithUseSiteCast(
    receiverPlan,
    context,
    useSiteTypeOverride
  );
  const receiverCastType = useSiteCastType(
    useSiteTypeOverride ?? receiverPlan?.type,
    context
  );
  if (receiverPlan?.expressionKind === "property-access") {
    return `${renderExpression(receiverPlan, context)}.Count`;
  }
  if (
    !elementTypePlan ||
    !receiverCastType ||
    isUnboundGenericPlaceholderType(elementTypePlan) ||
    containsUnboundPlaceholderCast(typedReceiver)
  ) {
    return `global::System.Linq.Enumerable.Count(${enumerableObjectCast(renderExpression(receiverPlan, context))})`;
  }
  return `${typedReceiver}.Count`;
};

const renderArrayElementAccess = (
  receiverPlan: LoweringExpressionPlan | undefined,
  indexPlan: LoweringExpressionPlan | undefined,
  context: RenderContext,
  useSiteTypeOverride?: LoweringTypeRefPlan
): string | undefined => {
  const elementTypePlan =
    arrayReceiverElementType(receiverPlan) ??
    arrayTypeFromUseSite(useSiteTypeOverride)?.elementType;
  const typedReceiver = renderExpressionWithUseSiteCast(
    receiverPlan,
    context,
    useSiteTypeOverride
  );
  const receiverCastType = useSiteCastType(
    useSiteTypeOverride ?? receiverPlan?.type,
    context
  );
  if (
    !elementTypePlan ||
    (receiverCastType &&
      !isUnboundGenericPlaceholderType(elementTypePlan) &&
      !containsUnboundPlaceholderCast(typedReceiver))
  ) {
    return undefined;
  }
  return `global::System.Linq.Enumerable.ElementAt(${enumerableObjectCast(renderExpression(receiverPlan, context))}, ${renderExpression(indexPlan, context)})`;
};

const renderObjectEntriesCall = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  const callee = plan.expression;
  if (
    callee?.sourceOperation?.dispatch !== "static-call" ||
    callee.sourceOperation.owner !== "Object" ||
    callee.sourceOperation.member !== "entries"
  ) {
    return undefined;
  }
  const source = plan.arguments[0];
  if (!source) return undefined;
  const valuePlan =
    recordValueType(source.type) ?? recordValueType(source.contextualTypePlan);
  const valueType = renderCSharpType(valuePlan, context);
  const dictionaryType = `global::System.Collections.Generic.Dictionary<string, ${valueType}>`;
  const dictionary = castExpression(renderExpression(source, context), dictionaryType);
  return `new global::System.Collections.Generic.List<object?[]>(global::System.Linq.Enumerable.Select(${dictionary}, entry => new object?[] { entry.Key, entry.Value }))`;
};

const dictionaryValueTypeFromRenderedType = (
  renderedType: string | undefined
): string | undefined => {
  const prefix = "global::System.Collections.Generic.Dictionary<string, ";
  return renderedType?.startsWith(prefix) === true && renderedType.endsWith(">")
    ? renderedType.slice(prefix.length, -1)
    : undefined;
};

const functionParameterCountMatches = (
  type: Extract<LoweringTypeRefPlan, { readonly kind: "function" }>,
  argumentCount: number
): boolean => {
  const minimum = type.parameters.filter(
    (parameter) =>
      !parameter.optional && !parameter.rest && parameter.initializer === undefined
  ).length;
  return (
    argumentCount >= minimum &&
    (type.parameters.some((parameter) => parameter.rest) ||
      argumentCount <= type.parameters.length)
  );
};

const callableDelegateCastType = (
  type: LoweringTypeRefPlan | undefined,
  argumentCount: number,
  context: RenderContext
): string | undefined => {
  const unwrapped = unwrapAliasTarget(type);
  if (type?.kind === "named" && type.aliasTarget?.kind === "function") {
    return functionParameterCountMatches(type.aliasTarget, argumentCount)
      ? renderCSharpType(type, context)
      : undefined;
  }
  if (unwrapped?.kind === "function") {
    return functionParameterCountMatches(unwrapped, argumentCount)
      ? renderCSharpType(unwrapped, context)
      : undefined;
  }
  if (unwrapped?.kind === "union") {
    const matches = nonNullishUnionTypes(unwrapped)
      .map((member) =>
        member.kind === "named" && member.aliasTarget?.kind === "function"
          ? {
              member,
              target: member.aliasTarget,
            }
          : undefined
      )
      .filter(
        (
          match
        ): match is {
          readonly member: Extract<LoweringTypeRefPlan, { readonly kind: "named" }>;
          readonly target: Extract<LoweringTypeRefPlan, { readonly kind: "function" }>;
        } => match !== undefined
      )
      .filter((match) => functionParameterCountMatches(match.target, argumentCount));
    const [match] = matches;
    return matches.length === 1 && match
      ? renderCSharpType(match.member, context)
      : undefined;
  }
  return undefined;
};

const renderCallableExpression = (
  callee: LoweringExpressionPlan | undefined,
  argumentCount: number,
  context: RenderContext,
  targetType?: LoweringTypeRefPlan
): string => {
  const rendered = renderExpression(callee, context);
  const effectiveTargetType = isNamedFunctionAlias(callee?.type)
    ? callee?.type
    : targetType ?? callee?.type;
  const delegateType =
    callee?.expressionKind === "property-access" ||
    isCallableStorageType(callee?.storageTypePlan)
    ? undefined
    : callableDelegateCastType(effectiveTargetType, argumentCount, context);
  return delegateType ? `((${delegateType})(${rendered}))` : rendered;
};

const castExpression = (rendered: string, targetType: string): string =>
  `((${targetType})(${rendered}))`;

const prefixCastExpression = (rendered: string, targetType: string): string =>
  /^[A-Za-z_@][A-Za-z0-9_@]*$/.test(rendered)
    ? `(${targetType})${rendered}`
    : castExpression(rendered, targetType);

const isBroadRuntimeType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type === undefined ||
  (type.kind === "intrinsic" &&
    (type.name === "any" || type.name === "unknown" || type.name === "object")) ||
  type.kind === "unsupported";

const numericObjectConversion = (
  rendered: string,
  targetType: string
): string =>
  `(${targetType})(${rendered} switch { int __tsonic_number => (${targetType})__tsonic_number, uint __tsonic_number => (${targetType})__tsonic_number, long __tsonic_number => (${targetType})__tsonic_number, ulong __tsonic_number => (${targetType})__tsonic_number, short __tsonic_number => (${targetType})__tsonic_number, ushort __tsonic_number => (${targetType})__tsonic_number, byte __tsonic_number => (${targetType})__tsonic_number, sbyte __tsonic_number => (${targetType})__tsonic_number, float __tsonic_number => (${targetType})__tsonic_number, double __tsonic_number => (${targetType})__tsonic_number, decimal __tsonic_number => (${targetType})__tsonic_number, _ => throw new global::System.InvalidCastException("Value is not numeric.") })`;

const renderAssignmentValue = (
  target: LoweringExpressionPlan | undefined,
  value: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  const rendered = renderExpression(value, context);
  const targetType = target?.storageTypePlan ?? target?.type;
  const sourceStorageType = value?.storageTypePlan ?? value?.type;
  const shouldCastRuntimeSlot =
    value?.expressionKind === "identifier" ||
    value?.expressionKind === "property-access" ||
    value?.expressionKind === "element-access";
  if (
    !targetType ||
    (!isBroadRuntimeType(sourceStorageType) && !shouldCastRuntimeSlot)
  ) {
    return rendered;
  }
  const renderedTargetType = renderCSharpType(targetType, context);
  if (
    renderedTargetType === "object?" ||
    renderedTargetType === "void" ||
    renderedTargetType === "this"
  ) {
    return rendered;
  }
  if (
    renderedTargetType === "double" ||
    renderedTargetType === "bool" ||
    renderedTargetType === "string"
  ) {
    return renderedTargetType === "double"
      ? numericObjectConversion(rendered, renderedTargetType)
      : prefixCastExpression(rendered, renderedTargetType);
  }
  return castExpression(rendered, renderedTargetType);
};

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
    case "find":
      return `global::System.Linq.Enumerable.FirstOrDefault(${enumerableReceiver()}, ${args[0] ?? "_ => false"})`;
    case "findIndex":
      return `${listReceiver()}.FindIndex(${args[0] ?? "_ => false"})`;
    case "every":
      return `global::System.Linq.Enumerable.All(${enumerableReceiver()}, ${args[0] ?? "_ => true"})`;
    case "some":
      return `global::System.Linq.Enumerable.Any(${enumerableReceiver()}, ${args[0] ?? "_ => false"})`;
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
    renderExpression(argument, context)
  );

  if (operation.dispatch === "receiver-call") {
    const receiver =
      operation.owner === "String"
        ? renderExpressionWithUseSiteCast(
            callee.expression,
            context,
            { kind: "intrinsic", name: "string" }
          )
        : renderExpression(callee.expression, context);
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
    if (operation.owner === "Map") {
      return `${receiver}.${operation.member}(${args.join(", ")})`;
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
        return renderConsoleCall(operation, args);
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
      case "JSON":
        if (operation.member === "parse") {
          return `${renderSourceRuntimeName(operation)}.parse<${renderCSharpType(plan.type, context)}>(${args.join(", ")})`;
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
  return `new ${renderSourceRuntimeName(operation)}${renderTypeArguments(plan.typeArguments, context)}(${plan.arguments
    .map((argument) => renderCallArgument(argument, context))
    .join(", ")})`;
};

const renderMapGetNullishCoalesce = (
  left: LoweringExpressionPlan | undefined,
  right: LoweringExpressionPlan | undefined,
  context: RenderContext
): string | undefined => {
  if (left?.expressionKind !== "call") return undefined;
  const callee = left.expression;
  if (
    callee?.expressionKind !== "property-access" ||
    callee.sourceOperation?.owner !== "Map" ||
    callee.sourceOperation.dispatch !== "receiver-call" ||
    callee.sourceOperation.member !== "get"
  ) {
    return undefined;
  }
  const key = left.arguments[0];
  if (!key) return undefined;
  const receiver = renderExpression(callee.expression, context);
  const renderedKey = renderExpression(key, context);
  return `${receiver}.has(${renderedKey}) ? ${receiver}.get(${renderedKey}) : ${renderExpression(right, context)}`;
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
	      if (plan.qualifiedRuntimeName) {
	        return renderQualifiedRuntimeExpressionName(plan.qualifiedRuntimeName);
	      }
      if (plan.sourceOperation?.dispatch === "static-call") {
        return plan.sourceOperation.owner === "Console"
          ? consoleMemberTarget(plan.sourceOperation.member)
          : `${renderSourceRuntimeName(plan.sourceOperation)}.${plan.sourceOperation.member}`;
      }
      if (plan.sourceOperation?.dispatch === "constructor") {
        return renderSourceRuntimeName(plan.sourceOperation);
      }
      const defaultedName = context.currentDefaultedParameters?.get(rawName);
      if (defaultedName) return defaultedName;
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
      if (plan.binaryOperator === "nullish-coalesce") {
        const mapGet = renderMapGetNullishCoalesce(
          plan.left,
          plan.right,
          context
        );
        if (mapGet) return mapGet;
        const left = renderExpression(plan.left, context);
        const right = renderExpression(plan.right, context);
        return needsNullishConditionCheck(plan.left?.type)
          ? `${left} ?? ${right}`
          : left;
      }
      if (plan.binaryOperator === "instanceof") {
        return `${renderExpression(plan.left, context)} ${operator} ${renderExpression(plan.right, context)}`;
      }
      if (plan.binaryOperator === "assign") {
        return `${renderExpression(plan.left, context)} ${operator} ${renderAssignmentValue(plan.left, plan.right, context)}`;
      }
      if (plan.binaryOperator?.endsWith("assign") === true) {
        return `${renderExpression(plan.left, context)} ${operator} ${renderExpressionWithUseSiteCast(plan.right, context)}`;
      }
      if (
        plan.binaryOperator === "add" &&
        renderCSharpType(plan.type, context) === "string"
      ) {
        const stringType = { kind: "intrinsic", name: "string" } as const;
        return `${renderExpressionWithUseSiteCast(plan.left, context, stringType)} ${operator} ${renderExpressionWithUseSiteCast(plan.right, context, stringType)}`;
      }
      return `${renderExpressionWithUseSiteCast(plan.left, context)} ${operator} ${renderExpressionWithUseSiteCast(plan.right, context)}`;
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
            return `${renderExpressionWithUseSiteCast(plan.expression, context)}.Length`;
          case "Array":
            return renderArrayLength(plan.expression, context, plan.receiverTypePlan);
          case "Function":
            return renderFunctionLength(plan.expression);
          case "Error":
            if (operation.member === "message") {
              return `${renderExpressionWithUseSiteCast(plan.expression, context, plan.receiverTypePlan)}.Message`;
            }
            break;
          case "Object":
            if (operation.member === "length") {
              return `global::js.Globals.length(${renderExpression(plan.expression, context)})`;
            }
            break;
          default:
            if (
              operation.member === "length" &&
              isTypedArrayRuntimeOwner(operation.owner)
            ) {
              return `${castExpression(renderExpression(plan.expression, context), renderSourceRuntimeName(operation))}.Count`;
            }
            break;
        }
      }
      const member = sanitizeIdentifier(rawMember);
      if (
        rawMember === "length" &&
        (arrayTypeFromUseSite(plan.expression?.type) !== undefined ||
          arrayTypeFromUseSite(plan.receiverTypePlan) !== undefined)
      ) {
        return renderArrayLength(plan.expression, context, plan.receiverTypePlan);
      }
      if (rawMember === "length") {
        return `${renderExpressionWithUseSiteCast(plan.expression, context, plan.receiverTypePlan)}.Length`;
      }
      return `${renderExpressionWithUseSiteCast(plan.expression, context, plan.receiverTypePlan)}.${member}`;
    }
    case "element-access":
      if (
        plan.sourceOperation?.dispatch === "index" &&
        plan.sourceOperation.owner === "String"
      ) {
        return `global::js.String.charAt(${renderExpressionWithUseSiteCast(plan.expression, context, plan.receiverTypePlan)}, ${renderExpression(plan.arguments[0], context)})`;
      }
      if (
        plan.sourceOperation?.dispatch === "index" &&
        plan.sourceOperation.owner === "Array"
      ) {
        const rendered = renderArrayElementAccess(
          plan.expression,
          plan.arguments[0],
          context,
          plan.receiverTypePlan
        );
        if (rendered) return rendered;
      }
      if (
        plan.sourceOperation?.dispatch === "property" &&
        plan.sourceOperation.owner === "Object" &&
        plan.sourceOperation.member === "toStringTag"
      ) {
        return `${renderExpressionWithUseSiteCast(plan.expression, context, plan.receiverTypePlan)}.ToStringTag`;
      }
      {
        const rendered = renderArrayElementAccess(
          plan.expression,
          plan.arguments[0],
          context,
          plan.receiverTypePlan
        );
        if (rendered) return rendered;
      }
      return `${renderExpressionWithUseSiteCast(plan.expression, context, plan.receiverTypePlan)}[${renderExpression(plan.arguments[0], context)}]`;
    case "call":
      {
        const intrinsic = renderIntrinsicCall(plan, context);
        if (intrinsic !== undefined) return intrinsic;
      }
      {
        const objectEntries = renderObjectEntriesCall(plan, context);
        if (objectEntries !== undefined) return objectEntries;
      }
      {
        const sourceRuntimeCall = renderSourceRuntimeCall(plan, context);
        if (sourceRuntimeCall !== undefined) return sourceRuntimeCall;
      }
      return `${renderCallableExpression(plan.expression, plan.arguments.length, context, plan.callTargetTypePlan)}${renderTypeArguments(plan.typeArguments, context)}(${plan.arguments
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
      const recordElementPlan =
        recordValueType(plan.contextualTypePlan) ?? recordValueType(plan.type);
      const targetType = objectLiteralTargetType(plan, context);
      const dictionaryValueType =
        recordElementPlan !== undefined
          ? renderCSharpType(recordElementPlan, context)
          : dictionaryValueTypeFromRenderedType(targetType);
      if (dictionaryValueType) {
        return `new global::System.Collections.Generic.Dictionary<string, ${dictionaryValueType}> { ${plan.properties
          .map((property) =>
            renderDictionaryObjectProperty(property, dictionaryValueType, context)
          )
          .filter((rendered): rendered is string => rendered !== undefined)
          .join(", ")} }`;
      }
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
