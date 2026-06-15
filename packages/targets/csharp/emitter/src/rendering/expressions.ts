import type {
  LoweringExpressionPlan,
  LoweringObjectPropertyPlan,
  LoweringParameterPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { requiredIdentifier, sanitizeIdentifier } from "./names.js";
import { renderStatement } from "./statements.js";
import {
  arrayTypeFromTypePlan,
  isBooleanLikeTypePlan,
  isDoubleRuntimeTypePlan,
  isOpaqueRuntimeTypePlan,
  isRecursiveRuntimeArrayArm,
  isStringLikeTypePlan,
  isTaskLikeTypePlan,
  isVoidLikeTypePlan,
  nonNullishUnionTypes,
  renderCSharpRuntimeExpressionName,
  renderCSharpType,
  renderNullableCSharpType,
  renderRequiredCSharpType,
  renderRequiredNullableCSharpType,
  runtimeUnionCarrierArms,
  runtimeUnionTarget,
  sameRuntimeTypePlan,
  shouldEmitAnonymousRuntimeUnionCarrier,
  typePlanKey,
  unwrapAliasTarget,
} from "./types.js";

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

const reportMissingExpressionData = (
  context: RenderContext,
  plan: LoweringExpressionPlan,
  feature: string
): string => {
  context.reportUnsupported(feature, plan.sourceKindName, plan.sourceText);
  return "";
};

const requiredPlanText = (
  plan: LoweringExpressionPlan,
  context: RenderContext,
  feature: string,
  value: string | undefined
): string | undefined => {
  if (value !== undefined) return value;
  reportMissingExpressionData(context, plan, feature);
  return undefined;
};

const requiredCallArgument = (
  plan: LoweringExpressionPlan,
  index: number,
  context: RenderContext,
  feature: string
): LoweringExpressionPlan | undefined => {
  const argument = plan.arguments[index];
  if (argument) return argument;
  reportMissingExpressionData(context, plan, feature);
  return undefined;
};

const requiredRenderedCallArgument = (
  plan: LoweringExpressionPlan,
  index: number,
  context: RenderContext,
  feature: string
): string | undefined => {
  const argument = requiredCallArgument(plan, index, context, feature);
  return argument ? renderCallArgument(argument, context) : undefined;
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
  const renderedExpression = renderExpressionWithUseSiteCast(
    property.expression,
    context,
    property.expression.contextualTypePlan
  );
  const targetArray =
    arrayTypeFromUseSite(property.expression.contextualTypePlan) ??
    arrayTypeFromUseSite(property.expression.storageTypePlan);
  const sourceArray =
    arrayTypeFromUseSite(property.expression.storageTypePlan) ??
    arrayTypeFromUseSite(property.expression.type);
  if (targetArray && sourceArray) {
    const targetElementType = renderCSharpType(targetArray.elementType, context);
    if (!sameRuntimeTypePlan(targetArray.elementType, sourceArray.elementType)) {
      return `${sanitizeIdentifier(property.name)} = new global::System.Collections.Generic.List<${targetElementType}>(global::System.Linq.Enumerable.Cast<${targetElementType}>(${renderedExpression}))`;
    }
  }
  return `${sanitizeIdentifier(property.name)} = ${renderedExpression}`;
};

const renderDictionaryObjectProperty = (
  property: LoweringObjectPropertyPlan,
  valueTypePlan: LoweringTypeRefPlan | undefined,
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
  const rendered = renderExpression(property.expression, context);
  const valueType = renderRequiredCSharpType(
    valueTypePlan,
    context,
    "dictionary value type",
    property.sourceKindName,
    property.sourceText
  );
  return `["${property.name}"] = ${
    isOpaqueRuntimeTypePlan(valueTypePlan) ? rendered : castExpression(rendered, valueType)
  }`;
};

const arrayLiteralElementType = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  const arrayPlan =
    arrayTypeFromUseSite(plan.contextualTypePlan) ??
    arrayTypeFromUseSite(plan.storageTypePlan) ??
    arrayTypeFromUseSite(plan.type);
  if (arrayPlan) {
    const rendered = renderCSharpType(arrayPlan.elementType, context);
    return isVoidLikeTypePlan(arrayPlan.elementType) ? "object?" : rendered;
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
): Extract<LoweringTypeRefPlan, { readonly kind: "array" }> | undefined =>
  arrayTypeFromUseSite(plan.contextualTypePlan) ??
  arrayTypeFromUseSite(plan.storageTypePlan) ??
  arrayTypeFromUseSite(plan.type);

const isCharType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type?.kind === "source-primitive" && type.fact.kind === "char";

const shouldRenderStringLiteralAsChar = (
  plan: LoweringExpressionPlan
): boolean => isCharType(plan.contextualTypePlan) || isCharType(plan.type);

const renderArraySegment = (
  elementType: string,
  elementTypePlan: LoweringTypeRefPlan | undefined,
  elements: readonly LoweringExpressionPlan[],
  context: RenderContext
): string =>
  elements.length === 0
    ? `global::System.Array.Empty<${elementType}>()`
    : `new ${elementType}[] { ${elements
        .map((element) =>
          renderArrayLiteralElement(element, elementTypePlan, context)
        )
        .join(", ")} }`;

const renderArrayLiteralElement = (
  element: LoweringExpressionPlan,
  elementTypePlan: LoweringTypeRefPlan | undefined,
  context: RenderContext
): string => {
  const carrier = runtimeUnionCarrierType(elementTypePlan, context);
  const nestedArray = arrayLiteralExpressionPlan(element);
  const arrayArmIndex = runtimeUnionArrayArmIndex(carrier, context);
  const arrayArm = arrayArmIndex
    ? runtimeUnionCarrierArms(carrier, context)[arrayArmIndex - 1]
    : undefined;
  const arrayArmType = arrayArm
    ? runtimeUnionArrayArmType(arrayArm, carrier ?? arrayArm, context)
    : undefined;
  if (carrier && nestedArray && arrayArmIndex && arrayArmType) {
    return `${renderCSharpType(carrier, context)}.From${arrayArmIndex}(${renderArrayLiteral(nestedArray, context, arrayArmType)})`;
  }
  return renderExpressionWithUseSiteCast(
    element,
    context,
    elementTypePlan ?? element.contextualTypePlan
  );
};

const renderArrayLiteral = (
  plan: LoweringExpressionPlan,
  context: RenderContext,
  useSiteArrayPlan?: Extract<LoweringTypeRefPlan, { readonly kind: "array" }>
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
  const arrayPlan = useSiteArrayPlan ?? arrayLiteralTypePlan(plan);
  const elementType = useSiteArrayPlan
    ? renderCSharpType(useSiteArrayPlan.elementType, context)
    : arrayLiteralElementType(plan, context);
  if (!plan.elements.some((element) => element.expressionKind === "spread")) {
    if (arrayPlan?.kind === "array" && !arrayPlan.readonly) {
      return `new global::System.Collections.Generic.List<${elementType ?? "object?"}> { ${plan.elements
        .map((element) =>
          renderArrayLiteralElement(element, arrayPlan.elementType, context)
        )
        .join(", ")} }`;
    }
    const constructor = elementType ? `new ${elementType}[]` : "new[]";
    return `${constructor} { ${plan.elements
      .map((element) =>
        renderArrayLiteralElement(element, arrayPlan?.elementType, context)
      )
      .join(", ")} }`;
  }

  const segmentType = elementType ?? "object?";
  const segmentTypePlan = arrayPlan?.elementType;
  const segments: string[] = [];
  let currentElements: LoweringExpressionPlan[] = [];
  const flushCurrentElements = (): void => {
    if (currentElements.length === 0) return;
    segments.push(
      renderArraySegment(segmentType, segmentTypePlan, currentElements, context)
    );
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

const objectLiteralTargetTypePlan = (
  plan: LoweringExpressionPlan
): LoweringTypeRefPlan | undefined =>
  plan.contextualTypePlan?.kind === "named" ||
  plan.contextualTypePlan?.kind === "object"
    ? plan.contextualTypePlan
    : undefined;

const renderLambdaParameter = (
  parameter: LoweringParameterPlan,
  context: RenderContext,
  includeType: boolean
): string =>
  includeType
    ? `${parameter.rest ? "params " : ""}${
        parameter.optional
          ? renderRequiredNullableCSharpType(
              parameter.type,
              context,
              "lambda parameter type",
              parameter.sourceKindName,
              parameter.sourceText
            )
          : renderRequiredCSharpType(
              parameter.type,
              context,
              "lambda parameter type",
              parameter.sourceKindName,
              parameter.sourceText
            )
      } ${requiredIdentifier(
        parameter.name,
        context,
        "lambda parameter name",
        parameter.sourceKindName,
        parameter.nameSourceText ?? parameter.sourceText
      )}`
    : requiredIdentifier(
        parameter.name,
        context,
        "lambda parameter name",
        parameter.sourceKindName,
        parameter.nameSourceText ?? parameter.sourceText
      );

const lambdaContextReturnType = (
  plan: LoweringExpressionPlan
): LoweringTypeRefPlan | undefined => {
  if (plan.returnType) return plan.returnType;
  if (plan.contextualTypePlan?.kind === "function") {
    return plan.contextualTypePlan.returnType;
  }
  return plan.type?.kind === "function" ? plan.type.returnType : undefined;
};

const isVoidLikeExpressionType = (type: LoweringTypeRefPlan | undefined): boolean =>
  (type?.kind === "intrinsic" &&
    (type.name === "void" || type.name === "undefined" || type.name === "never")) ||
  (isTaskLikeTypePlan(type) &&
    type?.kind === "named" &&
    (type.typeArguments.length === 0 ||
      isVoidLikeExpressionType(type.typeArguments[0]))) ||
  (type?.kind === "union" &&
    nonNullishUnionTypes(type).every(
      (member) =>
        isVoidLikeExpressionType(member) ||
        (isTaskLikeTypePlan(member) &&
          member.kind === "named" &&
          (member.typeArguments.length === 0 ||
            isVoidLikeExpressionType(member.typeArguments[0])))
    ));

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
      ? renderRequiredNullableCSharpType(
          parameter.type,
          context,
          "lambda parameter type",
          parameter.sourceKindName,
          parameter.sourceText
        )
      : renderRequiredCSharpType(
          parameter.type,
          context,
          "lambda parameter type",
          parameter.sourceKindName,
          parameter.sourceText
        )
  );
  const returnType = renderCSharpType(
    plan.returnType ?? { kind: "intrinsic", name: "void" },
    context
  );
  return isVoidLikeExpressionType(
    plan.returnType ?? { kind: "intrinsic", name: "void" }
  )
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
    case "array-literal":
    case "arrow-function":
    case "function-expression":
      return true;
    default:
      return false;
  }
};

const isOutOfScopeTypeParameterType = (
  type: LoweringTypeRefPlan | undefined,
  context?: RenderContext
): boolean =>
  type?.kind === "named" &&
  type.declarationKind === "type-parameter" &&
  context?.currentTypeParameters?.has(type.name) !== true;

const containsOutOfScopeTypeParameterTypePlan = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext,
  seen: ReadonlySet<LoweringTypeRefPlan> = new Set()
): boolean => {
  if (!type || seen.has(type)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  if (isOutOfScopeTypeParameterType(type, context)) return true;
  switch (type.kind) {
    case "named":
      return (
        type.typeArguments.some((argument) =>
          containsOutOfScopeTypeParameterTypePlan(argument, context, nextSeen)
        ) ||
        containsOutOfScopeTypeParameterTypePlan(
          type.aliasTarget,
          context,
          nextSeen
        )
      );
    case "record":
      return (
        containsOutOfScopeTypeParameterTypePlan(
          type.keyType,
          context,
          nextSeen
        ) ||
        containsOutOfScopeTypeParameterTypePlan(
          type.valueType,
          context,
          nextSeen
        )
      );
    case "array":
      return containsOutOfScopeTypeParameterTypePlan(
        type.elementType,
        context,
        nextSeen
      );
    case "tuple":
      return type.elements.some((element) =>
        containsOutOfScopeTypeParameterTypePlan(element, context, nextSeen)
      );
    case "union":
    case "intersection":
      return type.types.some((member) =>
        containsOutOfScopeTypeParameterTypePlan(member, context, nextSeen)
      );
    case "function":
      return (
        type.parameters.some((parameter) =>
          containsOutOfScopeTypeParameterTypePlan(
            parameter.type,
            context,
            nextSeen
          )
        ) ||
        containsOutOfScopeTypeParameterTypePlan(
          type.returnType,
          context,
          nextSeen
        )
      );
    case "predicate":
      return containsOutOfScopeTypeParameterTypePlan(
        type.assertedType,
        context,
        nextSeen
      );
    case "intrinsic":
    case "source-primitive":
    case "literal":
    case "object":
    case "unsupported":
      return false;
  }
};

const useSiteCastType = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext
): string | undefined => {
  if (!type) return undefined;
  if (containsOutOfScopeTypeParameterTypePlan(type, context)) return undefined;
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
      if (type.runtimeVisibility === "opaque") return undefined;
      return isOpaqueRuntimeTypePlan(type) ? undefined : renderCSharpType(type, context);
    case "literal":
      return undefined;
    default: {
      return isOpaqueRuntimeTypePlan(type) ||
        isVoidLikeTypePlan(type)
        ? undefined
        : renderCSharpType(type, context);
    }
  }
};

export const renderExpressionWithUseSiteCast = (
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
  const useSiteArrayLiteral = arrayLiteralExpressionPlan(plan);
  if (arrayTypeFromUseSite(useSiteTypeOverride) && useSiteArrayLiteral) {
    return renderArrayLiteral(
      useSiteArrayLiteral,
      context,
      arrayTypeFromUseSite(useSiteTypeOverride)
    );
  }
  const sourceCarrier =
    runtimeUnionCarrierType(plan?.storageTypePlan, context) ??
    runtimeUnionCarrierType(plan?.type, context);
  const useSiteArrayType = arrayTypeFromUseSite(useSiteTypeOverride);
  if (sourceCarrier && useSiteArrayType) {
    const armIndex =
      runtimeUnionArmIndexForTargetType(
        sourceCarrier,
        useSiteArrayType,
        context
      ) ?? runtimeUnionArrayArmIndex(sourceCarrier, context);
    if (armIndex) return `${rendered}.As${armIndex}()`;
  }
  const runtimeUnionCarrier = renderRuntimeUnionCarrierValue(
    rendered,
    plan,
    useSiteTypeOverride,
    context
  );
  if (runtimeUnionCarrier) return runtimeUnionCarrier;
  if (
    useSiteTypeOverride &&
    plan?.type &&
    sameRuntimeTypePlan(useSiteTypeOverride, plan.type)
  ) {
    return rendered;
  }
  const castType = useSiteCastType(useSiteTypeOverride ?? plan?.type, context);
  return castType ? `((${castType})(${rendered}))` : rendered;
};

const runtimeUnionCarrierType = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext
): LoweringTypeRefPlan | undefined =>
  type?.kind === "named" && runtimeUnionTarget(type)
    ? type
    : shouldEmitAnonymousRuntimeUnionCarrier(type, context)
    ? type
    : undefined;

const arrayLiteralExpressionPlan = (
  plan: LoweringExpressionPlan | undefined
): LoweringExpressionPlan | undefined =>
  plan?.expressionKind === "array-literal"
    ? plan
    : plan?.expressionKind === "erased-wrapper" &&
        plan.expression?.expressionKind === "array-literal"
      ? plan.expression
      : undefined;

const runtimeUnionArmIndexForExpression = (
  plan: LoweringExpressionPlan | undefined,
  carrier: LoweringTypeRefPlan,
  context: RenderContext
): number | undefined => {
  if (!plan) return undefined;
  const arms = runtimeUnionCarrierArms(carrier, context);
  if (plan.semantic === "undefined-value" || plan.literalKind === "null") {
    return undefined;
  }
  if (arms.length === 1) return 1;
  const expressionTypes = [
    plan.storageTypePlan,
    plan.type,
  ].filter((type): type is LoweringTypeRefPlan => type !== undefined);
  const exactIndex = arms.findIndex((arm) =>
    expressionTypes.some((type) => sameRuntimeTypePlan(type, arm))
  );
  if (exactIndex >= 0) return exactIndex + 1;
  if (arrayLiteralExpressionPlan(plan) || plan.expressionKind === "spread") {
    const arrayIndex = arms.findIndex((arm) => arm.kind === "array");
    if (arrayIndex >= 0) return arrayIndex + 1;
  }
  if (
    plan.literalKind === "string" ||
    expressionTypes.some(
      (type) =>
        (type.kind === "intrinsic" && type.name === "string") ||
        (type.kind === "literal" && type.literalKind === "string")
    )
  ) {
    const stringIndex = arms.findIndex(
      (arm) =>
        (arm.kind === "intrinsic" && arm.name === "string") ||
        (arm.kind === "literal" && arm.literalKind === "string")
    );
    if (stringIndex >= 0) return stringIndex + 1;
  }
  if (
    plan.expressionKind === "arrow-function" ||
    plan.expressionKind === "function-expression" ||
    expressionTypes.some((type) => type.kind === "function")
  ) {
    const functionIndex = arms.findIndex(
      (arm) =>
        arm.kind === "function" ||
        (arm.kind === "named" && arm.aliasTarget?.kind === "function")
    );
    if (functionIndex >= 0) return functionIndex + 1;
  }
  if (expressionTypes.some((type) => type.kind === "named")) {
    const concreteIndex = arms.findIndex(
      (arm) =>
        arm.kind === "named" &&
        (arm.declarationKind === "class" || arm.declarationKind === "interface")
    );
    if (concreteIndex >= 0) return concreteIndex + 1;
  }
  return undefined;
};

const runtimeUnionArrayArmIndex = (
  carrier: LoweringTypeRefPlan | undefined,
  context: RenderContext
): number | undefined => {
  const arms = runtimeUnionCarrierArms(carrier, context);
  const index = arms.findIndex((arm) => arrayTypeFromUseSite(arm) !== undefined);
  return index >= 0 ? index + 1 : undefined;
};

const runtimeUnionArmIndexForTargetType = (
  carrier: LoweringTypeRefPlan | undefined,
  target: LoweringTypeRefPlan | undefined,
  context: RenderContext
): number | undefined => {
  if (!carrier || !target) return undefined;
  const arms = runtimeUnionCarrierArms(carrier, context);
  const index = arms.findIndex((arm) => sameRuntimeTypePlan(arm, target));
  return index >= 0 ? index + 1 : undefined;
};

const runtimeUnionSourceArmValue = (
  rendered: string,
  sourceCarrier: LoweringTypeRefPlan | undefined,
  targetArm: LoweringTypeRefPlan | undefined,
  context: RenderContext
): string | undefined => {
  const sourceArmIndex = runtimeUnionArmIndexForTargetType(
    sourceCarrier,
    targetArm,
    context
  );
  return sourceArmIndex ? `${rendered}.As${sourceArmIndex}()` : undefined;
};

const runtimeUnionArrayArmType = (
  targetArm: LoweringTypeRefPlan | undefined,
  carrier: LoweringTypeRefPlan,
  _context: RenderContext
): Extract<LoweringTypeRefPlan, { readonly kind: "array" }> | undefined => {
  const direct = arrayTypeFromTypePlan(targetArm);
  if (isRecursiveRuntimeArrayArm(targetArm, carrier)) {
    return {
        kind: "array",
        elementType: carrier,
        readonly: true,
      };
  }
  return direct;
};

const isBroadIntrinsicRuntimeType = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "intrinsic" &&
  (type.name === "any" || type.name === "unknown" || type.name === "object");

const renderRuntimeUnionCarrierValue = (
  rendered: string,
  plan: LoweringExpressionPlan | undefined,
  useSiteType: LoweringTypeRefPlan | undefined,
  context: RenderContext
): string | undefined => {
  const carrier = runtimeUnionCarrierType(useSiteType, context);
  if (!carrier) return undefined;
  if (
    (plan?.type &&
      sameRuntimeTypePlan(plan.type, carrier)) ||
    (plan?.storageTypePlan &&
      sameRuntimeTypePlan(plan.storageTypePlan, carrier))
  ) {
    return rendered;
  }
  if (plan?.semantic === "undefined-value" || plan?.literalKind === "null") {
    return `${renderCSharpType(carrier, context)}.FromNull()`;
  }
  const armIndex = runtimeUnionArmIndexForExpression(plan, carrier, context);
  if (armIndex) {
    const targetArm = runtimeUnionCarrierArms(carrier, context)[armIndex - 1];
    const targetArmArray = runtimeUnionArrayArmType(
      targetArm,
      carrier,
      context
    );
    const carrierArrayLiteral = arrayLiteralExpressionPlan(plan);
    const armRendered =
      targetArmArray && carrierArrayLiteral
        ? renderArrayLiteral(carrierArrayLiteral, context, targetArmArray)
        : rendered;
    const sourceCarrier =
      runtimeUnionCarrierType(plan?.storageTypePlan, context) ??
      runtimeUnionCarrierType(plan?.type, context);
    const sourceArmValue = runtimeUnionSourceArmValue(
      armRendered,
      sourceCarrier,
      targetArm,
      context
    );
    return `${renderCSharpType(carrier, context)}.From${armIndex}(${sourceArmValue ?? armRendered})`;
  }
  return isBroadIntrinsicRuntimeType(plan?.storageTypePlan ?? plan?.type)
    ? `${renderCSharpType(carrier, context)}.FromValue(${rendered})`
    : undefined;
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
  const contextualFunction = functionTypeFromUseSite(plan.contextualTypePlan);
  const parameters = [
    ...plan.parameters,
    ...(contextualFunction
      ? contextualFunction.parameters
          .slice(plan.parameters.length)
          .map((parameter, index) => ({
            ...parameter,
            name: `__unused${plan.parameters.length + index}`,
            nameSourceText: `__unused${plan.parameters.length + index}`,
          }))
      : []),
  ]
    .map((parameter) => renderLambdaParameter(parameter, context, includeParameterTypes))
    .join(", ");
  const asyncModifier = plan.async ? "async " : "";
  const body = plan.body
    ? renderStatement(plan.body, context)
    : isVoidLikeExpressionType(lambdaContextReturnType(plan))
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
    const runtimeUnionCarrier = renderRuntimeUnionCarrierValue(
      renderedLambda,
      argument,
      argument.contextualTypePlan,
      context
    );
    if (runtimeUnionCarrier) return runtimeUnionCarrier;
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
    !sameRuntimeTypePlan(argument.type, targetDelegateType)
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
    case "Promise":
    case "RegExp":
    case "String":
    case "Uint16Array":
    case "Uint32Array":
    case "Uint8Array":
    case "Uint8ClampedArray":
      return operation.owner === "Promise"
        ? "global::System.Threading.Tasks.Task"
        : operation.owner === "Global"
          ? "global::js.Globals"
          : `global::js.${operation.owner}`;
    case "Function":
      return "global::System.Delegate";
  }
  return "global::System.Object";
};

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

const recordValueType = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined => {
  if (type?.kind === "record") {
    return type.valueType;
  }
  const unwrapped = unwrapAliasTarget(type);
  if (!unwrapped) return undefined;
  if (unwrapped.kind === "record") {
    return unwrapped.valueType;
  }
  if (unwrapped.kind === "union") {
    const values = nonNullishUnionTypes(unwrapped)
      .map((member) => recordValueType(member))
      .filter((value): value is LoweringTypeRefPlan => value !== undefined);
    const firstKey = values[0] ? typePlanKey(values[0]) : undefined;
    return firstKey && values.every((value) => typePlanKey(value) === firstKey)
      ? values[0]
      : undefined;
  }
  return undefined;
};

const isNamedFunctionAlias = (
  type: LoweringTypeRefPlan | undefined
): type is Extract<LoweringTypeRefPlan, { readonly kind: "named" }> =>
  type?.kind === "named" && type.aliasTarget?.kind === "function";

const singleCallableAliasType = (
  type: LoweringTypeRefPlan | undefined
): Extract<LoweringTypeRefPlan, { readonly kind: "named" }> | undefined => {
  if (isNamedFunctionAlias(type)) return type;
  if (type?.kind !== "union") return undefined;
  const callableAliases = nonNullishUnionTypes(type).filter(isNamedFunctionAlias);
  return callableAliases.length === 1 ? callableAliases[0] : undefined;
};

const isCallableStorageType = (
  type: LoweringTypeRefPlan | undefined
): boolean => {
  if (singleCallableAliasType(type)) return true;
  return unwrapAliasTarget(type)?.kind === "function";
};

const arrayTypeFromUseSite = arrayTypeFromTypePlan;

const functionTypeFromUseSite = (
  type: LoweringTypeRefPlan | undefined
): Extract<LoweringTypeRefPlan, { readonly kind: "function" }> | undefined => {
  const unwrapped = unwrapAliasTarget(type);
  return unwrapped?.kind === "function" ? unwrapped : undefined;
};

const arrayReceiverType = (
  plan: LoweringExpressionPlan | undefined
): Extract<LoweringTypeRefPlan, { readonly kind: "array" }> | undefined =>
  arrayTypeFromUseSite(plan?.storageTypePlan) ??
  arrayTypeFromUseSite(plan?.type) ??
  arrayTypeFromUseSite(plan?.contextualTypePlan);

const isTaskLikeUseSiteType = (
  type: LoweringTypeRefPlan | undefined
): boolean => {
  if (isTaskLikeTypePlan(type)) {
    return true;
  }
  return type?.kind === "union"
    ? nonNullishUnionTypes(type).some(isTaskLikeUseSiteType)
    : false;
};

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

const enumerableObjectCast = (receiver: string): string =>
  `global::System.Linq.Enumerable.Cast<object?>((global::System.Collections.IEnumerable)(${receiver}))`;

const renderArrayLength = (
  receiverPlan: LoweringExpressionPlan | undefined,
  context: RenderContext,
  useSiteTypeOverride?: LoweringTypeRefPlan
): string => {
  const receiverArrayType =
    arrayTypeFromUseSite(receiverPlan?.storageTypePlan) ??
    arrayTypeFromUseSite(useSiteTypeOverride);
  if (receiverArrayType?.storage === "native-array") {
    const receiver =
      arrayTypeFromUseSite(receiverPlan?.storageTypePlan)?.storage ===
      "native-array"
        ? renderExpression(receiverPlan, context)
        : renderExpressionWithUseSiteCast(receiverPlan, context, receiverArrayType);
    return `${receiver}.Length`;
  }
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
    isOutOfScopeTypeParameterType(elementTypePlan, context)
  ) {
    return `global::System.Linq.Enumerable.Count(${enumerableObjectCast(renderExpression(receiverPlan, context))})`;
  }
  return `${typedReceiver}.Count`;
};

const renderArrayElementAccess = (
  receiverPlan: LoweringExpressionPlan | undefined,
  elementAccessPlan: LoweringExpressionPlan,
  context: RenderContext,
  useSiteTypeOverride?: LoweringTypeRefPlan
): string | undefined => {
  const indexPlan = requiredCallArgument(
    elementAccessPlan,
    0,
    context,
    "array index expression"
  );
  if (!indexPlan) return "";
  const elementTypePlan =
    arrayTypeFromUseSite(useSiteTypeOverride)?.elementType ??
    arrayReceiverElementType(receiverPlan);
  const nativeArrayType =
    arrayTypeFromUseSite(receiverPlan?.storageTypePlan) ??
    arrayTypeFromUseSite(useSiteTypeOverride);
  if (nativeArrayType?.storage === "native-array") {
    const receiver =
      arrayTypeFromUseSite(receiverPlan?.storageTypePlan)?.storage ===
      "native-array"
        ? renderExpression(receiverPlan, context)
        : renderExpressionWithUseSiteCast(receiverPlan, context, nativeArrayType);
    return `${receiver}[${renderExpression(indexPlan, context)}]`;
  }
  const typedReceiver = renderExpressionWithUseSiteCast(
    receiverPlan,
    context,
    useSiteTypeOverride
  );
  const receiverCastType = useSiteCastType(
    useSiteTypeOverride ?? receiverPlan?.type,
    context
  );
  if (elementTypePlan?.kind === "tuple") {
    const nullableElementType = renderNullableCSharpType(elementTypePlan, context);
    return `global::System.Linq.Enumerable.ElementAtOrDefault(global::System.Linq.Enumerable.Select(${typedReceiver}, item => (${nullableElementType})item), ${renderExpression(indexPlan, context)})`;
  }
  if (
    !elementTypePlan ||
    (receiverCastType &&
      !isOutOfScopeTypeParameterType(elementTypePlan, context))
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
  const valueType = renderRequiredCSharpType(
    valuePlan,
    context,
    "Object.entries value type",
    plan.sourceKindName,
    plan.sourceText
  );
  const dictionaryType = `global::System.Collections.Generic.Dictionary<string, ${valueType}>`;
  const dictionary = castExpression(renderExpression(source, context), dictionaryType);
  return `new global::System.Collections.Generic.List<(string, ${valueType})>(global::System.Linq.Enumerable.Select(${dictionary}, entry => (entry.Key, entry.Value)))`;
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
  const effectiveTargetType =
    singleCallableAliasType(callee?.storageTypePlan) ??
    (isNamedFunctionAlias(callee?.type) ? callee?.type : targetType ?? callee?.type);
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
  if (
    isOpaqueRuntimeTypePlan(targetType) ||
    isVoidLikeTypePlan(targetType) ||
    (targetType.kind === "intrinsic" && targetType.name === "this")
  ) {
    return rendered;
  }
  const renderedTargetType = renderCSharpType(targetType, context);
  if (
    isDoubleRuntimeTypePlan(targetType) ||
    isBooleanLikeTypePlan(targetType) ||
    isStringLikeTypePlan(targetType)
  ) {
    return isDoubleRuntimeTypePlan(targetType)
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
  plan: LoweringExpressionPlan,
  argumentIndex: number,
  receiverPlan: LoweringExpressionPlan | undefined,
  context: RenderContext,
  feature: string
): string | undefined => {
  const argument = requiredCallArgument(plan, argumentIndex, context, feature);
  if (!argument) return undefined;
  const elementType = arrayReceiverElementType(receiverPlan);
  if (!elementType) return renderCallArgument(argument, context);
  return renderExpressionWithUseSiteCast(argument, context, elementType);
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
      return `${listReceiver()}.Add(${renderArrayElementArgument(plan, 0, receiverPlan, context, "Array.push argument") ?? ""})`;
    case "pop":
      return `${listReceiver()}[^1]`;
    case "join":
    case "toString":
      return `global::System.String.Join(${operation.member === "join" ? (args[0] ?? "\",\"") : "\",\""}, ${enumerableReceiver()})`;
    case "map":
      return `global::System.Linq.Enumerable.ToList(global::System.Linq.Enumerable.Select(${enumerableReceiver()}, ${requiredRenderedCallArgument(plan, 0, context, "Array.map callback") ?? ""}))`;
    case "filter":
      return `global::System.Linq.Enumerable.ToList(global::System.Linq.Enumerable.Where(${enumerableReceiver()}, ${requiredRenderedCallArgument(plan, 0, context, "Array.filter callback") ?? ""}))`;
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
      return `global::System.Linq.Enumerable.Contains(${enumerableReceiver()}, ${renderArrayElementArgument(plan, 0, receiverPlan, context, "Array.includes argument") ?? ""})`;
    case "indexOf":
      return `${listReceiver()}.IndexOf(${renderArrayElementArgument(plan, 0, receiverPlan, context, "Array.indexOf argument") ?? ""})`;
    case "forEach":
      return `${listReceiver()}.ForEach(${requiredRenderedCallArgument(plan, 0, context, "Array.forEach callback") ?? ""})`;
    case "find":
      return `global::System.Linq.Enumerable.FirstOrDefault(${enumerableReceiver()}, ${requiredRenderedCallArgument(plan, 0, context, "Array.find callback") ?? ""})`;
    case "findIndex":
      return `${listReceiver()}.FindIndex(${requiredRenderedCallArgument(plan, 0, context, "Array.findIndex callback") ?? ""})`;
    case "every":
      return `global::System.Linq.Enumerable.All(${enumerableReceiver()}, ${requiredRenderedCallArgument(plan, 0, context, "Array.every callback") ?? ""})`;
    case "some":
      return `global::System.Linq.Enumerable.Any(${enumerableReceiver()}, ${requiredRenderedCallArgument(plan, 0, context, "Array.some callback") ?? ""})`;
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
        ? castExpression(renderExpression(callee.expression, context), "string")
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
          const argument = plan.arguments[0];
          const renderedArgument = requiredRenderedCallArgument(
            plan,
            0,
            context,
            "Array.isArray argument"
          );
          if (!renderedArgument) return "";
          const sourceCarrier =
            runtimeUnionCarrierType(argument?.storageTypePlan, context) ??
            runtimeUnionCarrierType(argument?.type, context);
          const armIndex = runtimeUnionArrayArmIndex(sourceCarrier, context);
          if (argument && armIndex) {
            return `${renderExpression(argument, context)}.As${armIndex}() != null`;
          }
          return `(${renderedArgument} is global::System.Collections.IEnumerable && ${renderedArgument} is not string)`;
        }
        break;
      case "Object":
        if (operation.member === "is") {
          return `${renderSourceRuntimeName(operation)}.@is(${args.join(", ")})`;
        }
        break;
      case "JSON":
        if (operation.member === "parse") {
          return `${renderSourceRuntimeName(operation)}.parse<${renderRequiredCSharpType(plan.type, context, "JSON.parse result type", plan.sourceKindName, plan.sourceText)}>(${args.join(", ")})`;
        }
        break;
      case "Promise":
        if (operation.member === "resolve") {
          const argument = plan.arguments[0];
          if (!argument || argument.semantic === "undefined-value") {
            return "global::System.Threading.Tasks.Task.CompletedTask";
          }
          const rendered = renderExpression(argument, context);
          return isTaskLikeUseSiteType(argument.type)
            ? rendered
            : `global::System.Threading.Tasks.Task.FromResult(${rendered})`;
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
      return argument
        ? `nameof(${renderExpression(argument, context)})`
        : reportMissingExpressionData(context, plan, "nameof intrinsic argument");
    }
    case "sizeof": {
      const type = firstRenderedTypeArgument(plan, context, "sizeof intrinsic");
      return type ? `sizeof(${type})` : "";
    }
    case "istype": {
      const type = firstRenderedTypeArgument(plan, context, "istype intrinsic");
      const value = requiredRenderedCallArgument(
        plan,
        0,
        context,
        "istype intrinsic value"
      );
      if (!value) return "";
      return type ? `${value} is ${type}` : "";
    }
    case "trycast": {
      const type = firstRenderedTypeArgument(
        plan,
        context,
        "trycast intrinsic"
      );
      const value = requiredRenderedCallArgument(
        plan,
        0,
        context,
        "trycast intrinsic value"
      );
      if (!value) return "";
      return type ? `${value} as ${type}` : "";
    }
    case "asinterface": {
      const type = firstRenderedTypeArgument(
        plan,
        context,
        "asinterface intrinsic"
      );
      const value = requiredRenderedCallArgument(
        plan,
        0,
        context,
        "asinterface intrinsic value"
      );
      if (!value) return "";
      return type ? `((${type})(${value}))` : "";
    }
    case "stackalloc": {
      const type = firstRenderedTypeArgument(
        plan,
        context,
        "stackalloc intrinsic"
      );
      const length = requiredRenderedCallArgument(
        plan,
        0,
        context,
        "stackalloc intrinsic length"
      );
      if (!length) return "";
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
      const sourceRuntimeName = renderCSharpRuntimeExpressionName(
        plan.sourceRuntimeName
      );
      if (sourceRuntimeName) {
        return sourceRuntimeName;
      }
      if (plan.sourceOperation?.dispatch === "static-call") {
        return plan.sourceOperation.owner === "Console"
          ? consoleMemberTarget(plan.sourceOperation.member)
          : `${renderSourceRuntimeName(plan.sourceOperation)}.${plan.sourceOperation.member}`;
      }
      if (plan.sourceOperation?.dispatch === "constructor") {
        return renderSourceRuntimeName(plan.sourceOperation);
      }
      const rawName = requiredPlanText(
        plan,
        context,
        "identifier name",
        plan.literalText ?? plan.name
      );
      if (rawName === undefined) return "";
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
        case "string": {
          const literalText = requiredPlanText(
            plan,
            context,
            "string literal text",
            plan.literalText
          );
          if (literalText === undefined) return "";
          return shouldRenderStringLiteralAsChar(plan)
            ? escapeChar(literalText, context, plan)
            : `"${escapeString(literalText)}"`;
        }
        case "number":
          return (
            requiredPlanText(plan, context, "number literal text", plan.literalText) ??
            ""
          );
        case "bigint":
          context.reportUnsupported(
            "bigint literal",
            plan.sourceKindName,
            plan.sourceText
          );
          return "";
        case "boolean":
          if (plan.literalText !== "true" && plan.literalText !== "false") {
            return reportMissingExpressionData(
              context,
              plan,
              "boolean literal text"
            );
          }
          return plan.literalText;
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
      return renderExpressionWithUseSiteCast(plan.expression, context, plan.type);
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
      if (
        (plan.binaryOperator === "equal" ||
          plan.binaryOperator === "strict-equal" ||
          plan.binaryOperator === "not-equal" ||
          plan.binaryOperator === "strict-not-equal") &&
        (runtimeUnionCarrierType(plan.left?.storageTypePlan, context) ||
          runtimeUnionCarrierType(plan.left?.type, context)) &&
        (plan.right?.semantic === "undefined-value" ||
          plan.right?.literalKind === "null")
      ) {
        const nullCheck = `${renderExpression(plan.left, context)}.IsNull`;
        return plan.binaryOperator === "not-equal" ||
          plan.binaryOperator === "strict-not-equal"
          ? `!${nullCheck}`
          : nullCheck;
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
        isStringLikeTypePlan(plan.type)
      ) {
        const stringType = { kind: "intrinsic", name: "string" } as const;
        return `${renderExpressionWithUseSiteCast(plan.left, context, stringType)} ${operator} ${renderExpressionWithUseSiteCast(plan.right, context, stringType)}`;
      }
      return `${renderExpressionWithUseSiteCast(
        plan.left,
        context,
        plan.left?.contextualTypePlan
      )} ${operator} ${renderExpressionWithUseSiteCast(
        plan.right,
        context,
        plan.right?.contextualTypePlan
      )}`;
    }
    case "prefix-unary":
      if (
        plan.unaryOperator === "logical-not" &&
        !isBooleanConditionType(plan.expression?.type) &&
        needsNullishConditionCheck(plan.expression?.type)
      ) {
        return `${renderExpression(plan.expression, context)} == null`;
      }
      return `${renderUnaryOperator(plan.unaryOperator, context, plan)}${renderExpression(plan.expression, context)}`;
    case "postfix-unary":
      return `${renderExpression(plan.expression, context)}${renderUnaryOperator(plan.unaryOperator, context, plan)}`;
    case "typeof":
      return `((object?)${renderExpression(plan.expression, context)}) switch { null => "object", string => "string", char => "string", bool => "boolean", sbyte or byte or short or ushort or int or uint or long or ulong or float or double or decimal => "number", global::System.Numerics.BigInteger => "bigint", global::System.Delegate => "function", _ => "object" }`;
    case "void":
      return renderExpression(plan.expression, context);
    case "property-access": {
      const operation = plan.sourceOperation;
      if (operation?.dispatch === "property") {
        switch (operation.owner) {
          case "String":
            return `${renderExpressionWithUseSiteCast(plan.expression, context, { kind: "intrinsic", name: "string" })}.Length`;
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
      const rawMember = requiredPlanText(
        plan,
        context,
        "property member name",
        plan.literalText
      );
      if (rawMember === undefined) return "";
      const member = sanitizeIdentifier(rawMember);
      return `${renderExpressionWithUseSiteCast(
        plan.expression,
        context,
        plan.receiverTypePlan
      )}.${member}`;
    }
    case "element-access":
      if (
        plan.sourceOperation?.dispatch === "index" &&
        plan.sourceOperation.owner === "String"
      ) {
        const index = requiredRenderedCallArgument(
          plan,
          0,
          context,
          "string index expression"
        );
        if (!index) return "";
        return `global::js.String.charAt(${renderExpressionWithUseSiteCast(plan.expression, context, plan.receiverTypePlan)}, ${index})`;
      }
      if (
        plan.sourceOperation?.dispatch === "index" &&
        plan.sourceOperation.owner === "Array"
      ) {
        const rendered = renderArrayElementAccess(
          plan.expression,
          plan,
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
        return `${renderExpressionWithUseSiteCast(plan.expression, context, plan.receiverTypePlan)}.__tsonic_symbol_toStringTag`;
      }
      const index = requiredRenderedCallArgument(
        plan,
        0,
        context,
        "element index expression"
      );
      if (!index) return "";
      return `${renderExpressionWithUseSiteCast(plan.expression, context, plan.receiverTypePlan)}[${index}]`;
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
      const targetTypePlan = objectLiteralTargetTypePlan(plan);
      const targetType = targetTypePlan
        ? renderCSharpType(targetTypePlan, context)
        : undefined;
      const dictionaryValueType =
        recordElementPlan ?? (isOpaqueRuntimeTypePlan(targetTypePlan) ? targetTypePlan : undefined);
      if (dictionaryValueType) {
        const dictionaryValueTypeText = renderCSharpType(dictionaryValueType, context);
        return `new global::System.Collections.Generic.Dictionary<string, ${dictionaryValueTypeText}> { ${plan.properties
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
      return `${renderConditionExpression(plan.condition, context)} ? ${renderExpressionWithUseSiteCast(
        plan.whenTrue,
        context,
        plan.contextualTypePlan
      )} : ${renderExpressionWithUseSiteCast(
        plan.whenFalse,
        context,
        plan.contextualTypePlan
      )}`;
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
