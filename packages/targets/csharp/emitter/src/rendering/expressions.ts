import type {
  LoweringExpressionPlan,
  LoweringObjectPropertyPlan,
  LoweringParameterPlan,
  LoweringStatementPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { requiredIdentifier, sanitizeIdentifier } from "./names.js";
import { renderStatement } from "./statements.js";
import {
  arrayTypeFromTypePlan,
  isBooleanLikeTypePlan,
  isDoubleRuntimeTypePlan,
  isExternalBindingArrayType,
  isNullishType,
  isOpaqueRuntimeTypePlan,
  isRecursiveRuntimeArrayArm,
  isStringLikeTypePlan,
  isTaskLikeTypePlan,
  isVoidLikeTypePlan,
  nonNullishUnionTypes,
  renderExternalTargetExpressionName,
  renderCSharpRuntimeExpressionName,
  renderCSharpType,
  renderFunctionReturnType,
  renderNullableCSharpType,
  renderRequiredCSharpType,
  renderRequiredNullableCSharpType,
  renderTypeParameters,
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

const booleanLiteralExpression = (
  plan: LoweringExpressionPlan | undefined
): LoweringExpressionPlan | undefined =>
  plan?.expressionKind === "literal" && plan.literalKind === "boolean"
    ? plan
    : undefined;

const renderBooleanObjectEquality = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  if (
    plan.binaryOperator !== "equal" &&
    plan.binaryOperator !== "strict-equal" &&
    plan.binaryOperator !== "not-equal" &&
    plan.binaryOperator !== "strict-not-equal"
  ) {
    return undefined;
  }
  const leftBoolean = booleanLiteralExpression(plan.left);
  const rightBoolean = booleanLiteralExpression(plan.right);
  const booleanSide = leftBoolean ?? rightBoolean;
  const valueSide = leftBoolean ? plan.right : rightBoolean ? plan.left : undefined;
  if (!booleanSide || !valueSide) return undefined;
  if (isBooleanLikeTypePlan(valueSide.storageTypePlan ?? valueSide.type)) {
    return undefined;
  }
  const comparison = `global::System.Object.Equals(${renderExpression(valueSide, context)}, ${renderExpressionWithUseSiteCast(booleanSide, context, { kind: "intrinsic", name: "boolean" })})`;
  return plan.binaryOperator === "not-equal" ||
    plan.binaryOperator === "strict-not-equal"
    ? `!(${comparison})`
    : comparison;
};

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
  context: RenderContext,
  useSiteType?: LoweringTypeRefPlan
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
    useSiteType ?? property.expression.contextualTypePlan
  );
  return `${sanitizeIdentifier(property.name)} = ${renderedExpression}`;
};

const renderEnumerableElementConversion = (
  rendered: string,
  sourceElementType: LoweringTypeRefPlan,
  targetElementType: LoweringTypeRefPlan,
  context: RenderContext
): string => {
  const sourceElementText = renderCSharpType(sourceElementType, context);
  const targetElementText = renderCSharpType(targetElementType, context);
  const targetCarrier = runtimeUnionCarrierType(targetElementType, context);
  const targetArmIndex =
    runtimeUnionArmIndexForTargetType(
      targetCarrier,
      sourceElementType,
      context
    ) ??
    runtimeUnionArmIndexAssignableToTargetType(
      targetCarrier,
      sourceElementType,
      context
    );
  if (targetCarrier && targetArmIndex) {
    return `global::System.Linq.Enumerable.Select<${sourceElementText}, ${targetElementText}>(${rendered}, (${sourceElementText} item) => ${targetElementText}.From${targetArmIndex}(item))`;
  }
  if (
    isCallableStorageType(sourceElementType) &&
    isCallableStorageType(targetElementType)
  ) {
    return `global::System.Linq.Enumerable.Select<${sourceElementText}, ${targetElementText}>(${rendered}, (${sourceElementText} item) => new ${targetElementText}(item.Invoke))`;
  }
  if (
    shouldConvertSequenceElementsByProjection(
      sourceElementType,
      targetElementType
    )
  ) {
    return `global::System.Linq.Enumerable.Select<${sourceElementText}, ${targetElementText}>(${rendered}, (${sourceElementText} item) => ((${targetElementText})(item)))`;
  }
  return `global::System.Linq.Enumerable.Cast<${targetElementText}>(${rendered})`;
};

const objectMemberUseSiteType = (
  type: LoweringTypeRefPlan | undefined,
  propertyName: string | undefined,
  seen: ReadonlySet<LoweringTypeRefPlan> = new Set()
): LoweringTypeRefPlan | undefined => {
  if (!type || !propertyName || seen.has(type)) return undefined;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  if (type.kind === "named") {
    return objectMemberUseSiteType(type.aliasTarget, propertyName, nextSeen);
  }
  if (type.kind !== "object") return undefined;
  const members = type.members.filter(
    (member) => member.kind === "property" && member.name === propertyName
  );
  const member = members.length === 1 ? members[0] : undefined;
  return member?.kind === "property" ? member.type : undefined;
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
    isOpaqueRuntimeTypePlan(valueTypePlan)
      ? rendered
      : castExpression(rendered, valueType)
  }`;
};

const renderObjectLiteral = (
  plan: LoweringExpressionPlan,
  context: RenderContext,
  useSiteType?: LoweringTypeRefPlan
): string => {
  const recordElementPlan =
    recordValueType(useSiteType) ??
    recordValueType(plan.contextualTypePlan) ??
    recordValueType(plan.type);
  const targetTypePlan = objectLiteralTargetTypePlan(
    plan,
    context,
    useSiteType
  );
  const targetType = targetTypePlan
    ? renderCSharpType(targetTypePlan, context)
    : undefined;
  const dictionaryValueType =
    recordElementPlan ??
    (isOpaqueRuntimeTypePlan(targetTypePlan) ? targetTypePlan : undefined);
  if (dictionaryValueType) {
    const dictionaryValueTypeText = renderCSharpType(
      dictionaryValueType,
      context
    );
    return `new global::System.Collections.Generic.Dictionary<string, ${dictionaryValueTypeText}> { ${plan.properties
      .map((property) =>
        renderDictionaryObjectProperty(property, dictionaryValueType, context)
      )
      .filter((rendered): rendered is string => rendered !== undefined)
      .join(", ")} }`;
  }
  const constructor = targetType ? `new ${targetType}` : "new";
  return `${constructor} { ${plan.properties
    .map((property) =>
      renderObjectProperty(
        property,
        context,
        objectMemberUseSiteType(targetTypePlan, property.name)
      )
    )
    .filter((rendered): rendered is string => rendered !== undefined)
    .join(", ")} }`;
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

const requiredArrayLiteralElementType = (
  plan: LoweringExpressionPlan,
  context: RenderContext,
  elementType: string | undefined
): string => {
  if (elementType) return elementType;
  context.reportUnsupported(
    "array literal element type",
    plan.sourceKindName,
    plan.sourceText
  );
  return "object?";
};

const isCharType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type?.kind === "source-primitive" && type.fact.kind === "char";

const isArithmeticRuntimeType = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "source-primitive"
    ? type.fact.kind !== "bool" && type.fact.kind !== "char"
    : type?.kind === "intrinsic" &&
      (type.name === "number" || type.name === "bigint");

const arithmeticResultType = (
  plan: LoweringExpressionPlan
): LoweringTypeRefPlan | undefined => {
  const contextualType = plan.contextualTypePlan;
  if (isArithmeticRuntimeType(contextualType)) return contextualType;
  return isArithmeticRuntimeType(plan.type) ? plan.type : undefined;
};

const charRuntimeType = (
  plan: LoweringExpressionPlan | undefined,
  seen: ReadonlySet<LoweringExpressionPlan> = new Set()
): LoweringTypeRefPlan | undefined => {
  if (!plan || seen.has(plan)) return undefined;
  const direct =
    (isCharType(plan.storageTypePlan) ? plan.storageTypePlan : undefined) ??
    (isCharType(plan.type) ? plan.type : undefined) ??
    (isCharType(arrayElementAccessElementType(plan))
      ? arrayElementAccessElementType(plan)
      : undefined) ??
    (isCharType(plan.contextualTypePlan) ? plan.contextualTypePlan : undefined);
  if (direct) return direct;
  if (
    plan.expressionKind === "erased-wrapper" ||
    plan.expressionKind === "non-null" ||
    plan.expressionKind === "parenthesized"
  ) {
    const nextSeen = new Set(seen);
    nextSeen.add(plan);
    return charRuntimeType(plan.expression, nextSeen);
  }
  return undefined;
};

const actualCharRuntimeType = (
  plan: LoweringExpressionPlan | undefined,
  seen: ReadonlySet<LoweringExpressionPlan> = new Set()
): LoweringTypeRefPlan | undefined => {
  if (!plan || seen.has(plan)) return undefined;
  const direct =
    (isCharType(plan.storageTypePlan) ? plan.storageTypePlan : undefined) ??
    (isCharType(plan.type) ? plan.type : undefined) ??
    (isCharType(arrayElementAccessElementType(plan))
      ? arrayElementAccessElementType(plan)
      : undefined);
  if (direct) return direct;
  if (
    plan.expressionKind === "erased-wrapper" ||
    plan.expressionKind === "non-null" ||
    plan.expressionKind === "parenthesized"
  ) {
    const nextSeen = new Set(seen);
    nextSeen.add(plan);
    return actualCharRuntimeType(plan.expression, nextSeen);
  }
  return undefined;
};

const hasCharRuntimeType = (
  plan: LoweringExpressionPlan | undefined
): boolean => charRuntimeType(plan) !== undefined;

const shouldRenderStringLiteralAsChar = (
  plan: LoweringExpressionPlan
): boolean =>
  plan.literalText?.length === 1 &&
  (isCharType(plan.contextualTypePlan) || isCharType(plan.type));

const shouldConvertSequenceElementsByProjection = (
  sourceElementType: LoweringTypeRefPlan,
  targetElementType: LoweringTypeRefPlan
): boolean => {
  const source = unwrapAliasTarget(sourceElementType);
  const target = unwrapAliasTarget(targetElementType);
  return (
    ((source?.kind === "intrinsic" && source.name === "number") ||
      (source?.kind === "literal" && source.literalKind === "number") ||
      (source?.kind === "source-primitive" &&
        (source.fact.runtimeBase === "number" ||
          source.fact.runtimeBase === "decimal"))) &&
    ((target?.kind === "intrinsic" && target.name === "number") ||
      (target?.kind === "literal" && target.literalKind === "number") ||
      (target?.kind === "source-primitive" &&
        (target.fact.runtimeBase === "number" ||
          target.fact.runtimeBase === "decimal")))
  );
};

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
    const renderedArray = renderArrayLiteral(nestedArray, context, arrayArmType);
    return `${renderCSharpType(carrier, context)}.From${arrayArmIndex}(${castExpression(renderedArray, renderCSharpType(arrayArmType, context))})`;
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
      const listElementType = requiredArrayLiteralElementType(
        plan,
        context,
        elementType
      );
      return `new global::System.Collections.Generic.List<${listElementType}> { ${plan.elements
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

  const segmentType = requiredArrayLiteralElementType(
    plan,
    context,
    elementType
  );
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
      const spreadExpression = element.expression;
      const renderedSpread = renderExpression(spreadExpression, context);
      const spreadArray =
        arrayTypeFromUseSite(spreadExpression?.storageTypePlan) ??
        arrayTypeFromUseSite(spreadExpression?.contextualTypePlan) ??
        arrayTypeFromUseSite(spreadExpression?.type);
      segments.push(
        segmentTypePlan &&
          spreadArray &&
          !sameRuntimeTypePlan(segmentTypePlan, spreadArray.elementType)
          ? renderEnumerableElementConversion(
              renderedSpread,
              spreadArray.elementType,
              segmentTypePlan,
              context
            )
          : renderedSpread
      );
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

const renderTupleLiteral = (
  plan: LoweringExpressionPlan,
  context: RenderContext,
  tuplePlan: Extract<LoweringTypeRefPlan, { readonly kind: "tuple" }>
): string =>
  `(${plan.elements
    .map((element, index) =>
      renderExpressionWithUseSiteCast(element, context, tuplePlan.elements[index])
    )
    .join(", ")})`;

const objectLiteralTargetTypePlan = (
  plan: LoweringExpressionPlan,
  context: RenderContext,
  useSiteType?: LoweringTypeRefPlan
): LoweringTypeRefPlan | undefined => {
  const contextualType = useSiteType ?? plan.contextualTypePlan;
  const carrier = runtimeUnionCarrierType(contextualType, context);
  const armIndex = carrier
    ? runtimeUnionArmIndexForExpression(plan, carrier, context)
    : undefined;
  if (carrier && armIndex) {
    return runtimeUnionCarrierArms(carrier, context)[armIndex - 1];
  }
  return contextualType?.kind === "named" || contextualType?.kind === "object"
    ? contextualType
    : undefined;
};

const objectTypeFromArm = (
  type: LoweringTypeRefPlan
): Extract<LoweringTypeRefPlan, { readonly kind: "object" }> | undefined => {
  const unwrapped = unwrapAliasTarget(type);
  return unwrapped?.kind === "object" ? unwrapped : undefined;
};

const literalExpressionMatchesType = (
  expression: LoweringExpressionPlan,
  type: LoweringTypeRefPlan | undefined
): boolean => {
  if (!type || type.kind !== "literal") return true;
  return (
    expression.literalKind === type.literalKind &&
    expression.literalText === type.valueText
  );
};

const objectLiteralMatchesArm = (
  plan: LoweringExpressionPlan,
  arm: LoweringTypeRefPlan
): boolean => {
  if (plan.expressionKind !== "object-literal") return false;
  const objectType = objectTypeFromArm(arm);
  if (!objectType) return false;
  const properties = new Map<string, LoweringObjectPropertyPlan>();
  for (const property of plan.properties) {
    if (!property.name || property.computed) return false;
    properties.set(property.name, property);
  }
  for (const property of properties.values()) {
    const member = objectType.members.find(
      (candidate) =>
        candidate.kind === "property" && candidate.name === property.name
    );
    if (!member || member.kind !== "property") return false;
    if (!literalExpressionMatchesType(property.expression, member.type)) {
      return false;
    }
  }
  for (const member of objectType.members) {
    if (
      member.kind === "property" &&
      !member.optional &&
      !properties.has(member.name)
    ) {
      return false;
    }
  }
  return true;
};

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

const isVoidLikeExpressionType = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext
): boolean =>
  (type?.kind === "intrinsic" &&
    (type.name === "void" ||
      type.name === "undefined" ||
      type.name === "never")) ||
  (isTaskLikeTypePlan(type, context) &&
    type?.kind === "named" &&
    (type.typeArguments.length === 0 ||
      isVoidLikeExpressionType(type.typeArguments[0], context))) ||
  (type?.kind === "union" &&
    nonNullishUnionTypes(type).every(
      (member) =>
        isVoidLikeExpressionType(member, context) ||
        (isTaskLikeTypePlan(member, context) &&
          member.kind === "named" &&
          (member.typeArguments.length === 0 ||
            isVoidLikeExpressionType(member.typeArguments[0], context)))
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
  if ((plan.typeParameters ?? []).length > 0) {
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
  const returnType = renderFunctionReturnType(
    plan.returnType,
    plan.async ?? false,
    context,
    plan.sourceKindName,
    plan.sourceText
  );
  return !plan.async && isVoidLikeExpressionType(plan.returnType, context)
    ? parameterTypes.length === 0
      ? "global::System.Action"
      : `global::System.Action<${parameterTypes.join(", ")}>`
    : `global::System.Func<${[...parameterTypes, returnType].join(", ")}>`;
};

const withTypeParameterScope = <T>(
  context: RenderContext,
  typeParameters: readonly string[],
  render: () => T
): T => {
  if (typeParameters.length === 0) return render();
  const previous = context.currentTypeParameters;
  const next = new Set(previous ?? []);
  for (const typeParameter of typeParameters) {
    next.add(typeParameter);
  }
  context.currentTypeParameters = next;
  try {
    return render();
  } finally {
    context.currentTypeParameters = previous;
  }
};

export const isFunctionExpressionPlan = (
  plan: LoweringExpressionPlan | undefined
): plan is LoweringExpressionPlan & {
  readonly expressionKind: "arrow-function" | "function-expression";
} =>
  plan?.expressionKind === "arrow-function" ||
  plan?.expressionKind === "function-expression";

export const isGenericFunctionExpression = (
  plan: LoweringExpressionPlan | undefined
): boolean =>
  isFunctionExpressionPlan(plan) && (plan.typeParameters ?? []).length > 0;

export const renderFunctionExpressionMethodDeclaration = (
  name: string,
  plan: LoweringExpressionPlan,
  context: RenderContext,
  modifiers = ""
): string =>
  withTypeParameterScope(context, plan.typeParameters ?? [], () => {
    const parameters = plan.parameters
      .map((parameter) => renderLambdaParameter(parameter, context, true))
      .join(", ");
    const returnType = renderFunctionReturnType(
      plan.returnType,
      plan.async ?? false,
      context,
      plan.sourceKindName,
      plan.sourceText
    );
    const bodyReturnType = plan.async
      ? lambdaContextReturnType(plan)
      : plan.returnType;
    const body = plan.body
      ? renderLambdaStatementBody(plan, context)
      : isVoidLikeExpressionType(bodyReturnType, context)
        ? renderVoidLambdaExpressionBody(plan.expression, context)
        : [
            "{",
            `    return ${renderExpressionWithUseSiteCast(
              plan.expression,
              context,
              bodyReturnType
            )};`,
            "}",
          ].join("\n");
    return `${modifiers}${returnType} ${sanitizeIdentifier(name)}${renderTypeParameters(plan.typeParameters ?? [])}(${parameters})\n${body}`;
  });

const lambdaBodyEndsControlFlow = (
  statement: LoweringStatementPlan | undefined
): boolean => {
  if (!statement) return false;
  switch (statement.statementKind) {
    case "return":
    case "throw":
    case "break":
    case "continue":
      return true;
    case "block":
      return lambdaBodyEndsControlFlow(statement.statements.at(-1));
    default:
      return false;
  }
};

const renderLambdaStatementBody = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string => {
  const previousReturnType = context.currentReturnType;
  context.currentReturnType = lambdaContextReturnType(plan);
  const body = (() => {
    try {
      return renderStatement(plan.body, context);
    } finally {
      context.currentReturnType = previousReturnType;
    }
  })();
  if (
    !plan.async ||
    isVoidLikeExpressionType(lambdaContextReturnType(plan), context) ||
    lambdaBodyEndsControlFlow(plan.body)
  ) {
    return body;
  }
  if (plan.body?.statementKind === "block") {
    const lines = body.split("\n");
    return [
      ...lines.slice(0, -1),
      "    return default;",
      lines.at(-1) ?? "}",
    ].join("\n");
  }
  return [
    "{",
    ...body.split("\n").map((line) => `    ${line}`),
    "    return default;",
    "}",
  ].join("\n");
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
    case "literal":
    case "property-access":
    case "element-access":
    case "call":
    case "new":
    case "parenthesized":
    case "erased-wrapper":
    case "non-null":
    case "binary":
    case "array-literal":
    case "object-literal":
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
      return isOpaqueRuntimeTypePlan(type)
        ? undefined
        : renderCSharpType(type, context);
    case "literal":
      return undefined;
    default: {
      return isOpaqueRuntimeTypePlan(type) || isVoidLikeTypePlan(type)
        ? undefined
        : renderCSharpType(type, context);
    }
  }
};

const renderStringLiteralAsUseSiteChar = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext,
  useSiteType: LoweringTypeRefPlan | undefined
): string | undefined => {
  if (
    plan?.expressionKind !== "literal" ||
    plan.literalKind !== "string" ||
    !isCharType(useSiteType) ||
    plan.literalText?.length !== 1
  ) {
    return undefined;
  }
  const literalText = requiredPlanText(
    plan,
    context,
    "string literal text",
    plan.literalText
  );
  return literalText === undefined
    ? ""
    : escapeChar(literalText, context, plan);
};

const renderArrayUseSiteConversion = (
  rendered: string,
  sourceArray: Extract<LoweringTypeRefPlan, { readonly kind: "array" }>,
  targetArray: Extract<LoweringTypeRefPlan, { readonly kind: "array" }>,
  context: RenderContext
): string | undefined => {
  const needsElementConversion = !sameRuntimeTypePlan(
    sourceArray.elementType,
    targetArray.elementType
  );
  const needsNativeArray = isExternalBindingArrayType(targetArray);
  const needsMutableList =
    !targetArray.readonly &&
    !isExternalBindingArrayType(targetArray) &&
    (sourceArray.readonly || isExternalBindingArrayType(sourceArray));
  if (!needsElementConversion && !needsNativeArray && !needsMutableList) {
    return undefined;
  }
  const targetElementType = renderCSharpType(targetArray.elementType, context);
  const sequence = needsElementConversion
    ? renderEnumerableElementConversion(
        rendered,
        sourceArray.elementType,
        targetArray.elementType,
        context
      )
    : rendered;
  return needsNativeArray
    ? `global::System.Linq.Enumerable.ToArray(${sequence})`
    : `new global::System.Collections.Generic.List<${targetElementType}>(${sequence})`;
};

const renderUseSiteCast = (
  castType: string,
  rendered: string,
  plan: LoweringExpressionPlan | undefined,
  useSiteType: LoweringTypeRefPlan | undefined
): string =>
  plan?.expressionKind === "identifier" && useSiteType?.kind === "named"
    ? `(${castType})${rendered}`
    : `((${castType})(${rendered}))`;

const renderNullableDelegateAdapter = (
  source: string,
  targetType: string,
  sourceCanBeNull: boolean,
  context: RenderContext
): string => {
  if (!sourceCanBeNull) return `new ${targetType}(${source}.Invoke)`;
  const delegateName = context.allocateTempName("delegate");
  return `${source} is { } ${delegateName} ? new ${targetType}(${delegateName}.Invoke) : null`;
};

const identifierAliasType = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext
): LoweringTypeRefPlan | undefined => {
  if (plan?.expressionKind !== "identifier") return undefined;
  const rawName = plan.literalText ?? plan.name;
  return rawName ? context.currentIdentifierAliasTypes?.get(rawName) : undefined;
};

export const renderExpressionWithUseSiteCast = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext,
  useSiteTypeOverride?: LoweringTypeRefPlan
): string => {
  const objectLiteral = objectLiteralExpressionPlan(plan);
  if (
    objectLiteral &&
    useSiteTypeOverride &&
    !runtimeUnionCarrierType(useSiteTypeOverride, context)
  ) {
    return renderObjectLiteral(objectLiteral, context, useSiteTypeOverride);
  }
  const useSiteCharLiteral = renderStringLiteralAsUseSiteChar(
    plan,
    context,
    useSiteTypeOverride
  );
  if (useSiteCharLiteral !== undefined) return useSiteCharLiteral;
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
  const useSiteTupleLiteral = arrayLiteralExpressionPlan(plan);
  if (useSiteTypeOverride?.kind === "tuple" && useSiteTupleLiteral) {
    return renderTupleLiteral(useSiteTupleLiteral, context, useSiteTypeOverride);
  }
  const aliasType = identifierAliasType(plan, context);
  const effectivePlan =
    aliasType && plan
      ? { ...plan, type: aliasType, storageTypePlan: aliasType }
      : plan;
  const storageTypePlan = aliasType ?? plan?.storageTypePlan;
  const expressionTypePlan = aliasType ?? plan?.type;
  const runtimeUnionCarrier = renderRuntimeUnionCarrierValue(
    rendered,
    effectivePlan,
    useSiteTypeOverride,
    context
  );
  if (runtimeUnionCarrier) return runtimeUnionCarrier;
  const sourceCarrier =
    runtimeUnionCarrierType(storageTypePlan, context) ??
    runtimeUnionCarrierType(expressionTypePlan, context);
  const storageMatchesUseSite =
    useSiteTypeOverride &&
    storageTypePlan &&
    sameRuntimeTypePlan(useSiteTypeOverride, storageTypePlan);
  const valueMatchesUseSite =
    useSiteTypeOverride &&
    expressionTypePlan &&
    sameRuntimeTypePlan(useSiteTypeOverride, expressionTypePlan);
  const arrayElementType = plan ? arrayElementAccessElementType(plan) : undefined;
  const arrayElementMatchesUseSite =
    useSiteTypeOverride &&
      arrayElementType &&
    sameRuntimeTypePlan(useSiteTypeOverride, arrayElementType);
  const valueStoredAsUseSite =
    !storageTypePlan ||
    !expressionTypePlan ||
    sameRuntimeTypePlan(storageTypePlan, expressionTypePlan);
  if (
    useSiteTypeOverride &&
    (storageMatchesUseSite ||
      arrayElementMatchesUseSite ||
      (valueMatchesUseSite && valueStoredAsUseSite && !sourceCarrier))
  ) {
    return rendered;
  }
  if (runtimeUnionCarrierType(useSiteTypeOverride, context)) {
    context.reportUnsupported(
      "runtime union arm selection",
      plan?.sourceKindName ?? "Expression",
      plan?.sourceText ?? ""
    );
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
  const useSiteArrayType = arrayTypeFromUseSite(useSiteTypeOverride);
  const sourceArrayType =
    arrayTypeFromUseSite(storageTypePlan) ??
    arrayTypeFromUseSite(expressionTypePlan);
  if (useSiteArrayType && sourceArrayType) {
    const converted = renderArrayUseSiteConversion(
      rendered,
      sourceArrayType,
      useSiteArrayType,
      context
    );
    if (converted) return converted;
  }
  if (sourceCarrier && useSiteArrayType) {
    const armIndex =
      runtimeUnionArmIndexForTargetType(
        sourceCarrier,
        useSiteArrayType,
        context
      ) ?? runtimeUnionArrayArmIndex(sourceCarrier, context);
    if (armIndex) return `${rendered}.As${armIndex}()`;
  }
  const delegateAdapter = renderDelegateUseSiteAdapter(
    rendered,
    effectivePlan,
    useSiteTypeOverride ?? plan?.type,
    context
  );
  if (delegateAdapter) return delegateAdapter;
  if (sourceCarrier && useSiteTypeOverride) {
    const armIndex =
      runtimeUnionArmIndexForTargetType(
        sourceCarrier,
        useSiteTypeOverride,
        context
      ) ??
      runtimeUnionArmIndexAssignableToTargetType(
        sourceCarrier,
        useSiteTypeOverride,
        context
      );
    if (armIndex) return `${rendered}.As${armIndex}()`;
  }
  if (isCharType(useSiteTypeOverride) && !actualCharRuntimeType(plan)) {
    return rendered;
  }
  const castType = useSiteCastType(useSiteTypeOverride ?? expressionTypePlan, context);
  return castType
    ? renderUseSiteCast(castType, rendered, plan, useSiteTypeOverride ?? expressionTypePlan)
    : rendered;
};

const runtimeUnionCarrierType = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext
): LoweringTypeRefPlan | undefined => {
  if (
    type?.kind === "named" &&
    runtimeUnionTarget(type) &&
    type.runtimeVisibility !== "opaque" &&
    shouldEmitAnonymousRuntimeUnionCarrier(type.aliasTarget, context)
  ) {
    return type;
  }
  if (shouldEmitAnonymousRuntimeUnionCarrier(type, context)) {
    return type;
  }
  if (type?.kind === "union") {
    const carriers = nonNullishUnionTypes(type)
      .map((member) => runtimeUnionCarrierType(member, context))
      .filter((member): member is LoweringTypeRefPlan => member !== undefined);
    const unique = new Map<string, LoweringTypeRefPlan>();
    for (const carrier of carriers) {
      unique.set(typePlanKey(carrier), carrier);
    }
    return unique.size === 1 ? [...unique.values()][0] : undefined;
  }
  return undefined;
};

const singleRuntimeUnionArmIndex = (
  arms: readonly LoweringTypeRefPlan[],
  predicate: (arm: LoweringTypeRefPlan) => boolean
): number | undefined => {
  const matches = arms
    .map((arm, index) => (predicate(arm) ? index + 1 : undefined))
    .filter((index): index is number => index !== undefined);
  return matches.length === 1 ? matches[0] : undefined;
};

const arrayLiteralExpressionPlan = (
  plan: LoweringExpressionPlan | undefined
): LoweringExpressionPlan | undefined =>
  plan?.expressionKind === "array-literal"
    ? plan
    : (plan?.expressionKind === "erased-wrapper" ||
          plan?.expressionKind === "non-null") &&
        plan.expression !== undefined
      ? arrayLiteralExpressionPlan(plan.expression)
      : undefined;

const objectLiteralExpressionPlan = (
  plan: LoweringExpressionPlan | undefined
): LoweringExpressionPlan | undefined =>
  plan?.expressionKind === "object-literal"
    ? plan
    : (plan?.expressionKind === "erased-wrapper" ||
          plan?.expressionKind === "non-null" ||
          plan?.expressionKind === "parenthesized") &&
        plan.expression !== undefined
      ? objectLiteralExpressionPlan(plan.expression)
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
  const expressionTypes = [plan.storageTypePlan, plan.type].filter(
    (type): type is LoweringTypeRefPlan => type !== undefined
  );
  const exactIndex = singleRuntimeUnionArmIndex(arms, (arm) =>
    expressionTypes.some((type) => sameRuntimeTypePlan(type, arm))
  );
  if (exactIndex) return exactIndex;
  const assignableIndex = singleRuntimeUnionArmIndex(arms, (arm) =>
    expressionTypes.some((type) =>
      runtimeTypePlanAssignableToTarget(type, arm, context, new Set())
    )
  );
  if (assignableIndex) return assignableIndex;
  const arrayLiteral = arrayLiteralExpressionPlan(plan);
  if (arrayLiteral || plan.expressionKind === "spread") {
    const arrayIndex = arrayLiteral
      ? runtimeUnionArrayArmIndexForArrayLiteral(arrayLiteral, carrier, context)
      : singleRuntimeUnionArmIndex(
          arms,
          (arm) => arrayTypeFromTypePlan(arm, context) !== undefined
        );
    if (arrayIndex) return arrayIndex;
  }
  if (
    plan.literalKind === "string" ||
    expressionTypes.some(
      (type) =>
        (type.kind === "intrinsic" && type.name === "string") ||
        (type.kind === "literal" && type.literalKind === "string")
    )
  ) {
    const stringIndex = singleRuntimeUnionArmIndex(
      arms,
      (arm) =>
        (arm.kind === "intrinsic" && arm.name === "string") ||
        (arm.kind === "literal" && arm.literalKind === "string")
    );
    if (stringIndex) return stringIndex;
  }
  if (
    plan.literalKind === "number" ||
    expressionTypes.some(
      (type) =>
        (type.kind === "intrinsic" && type.name === "number") ||
        type.kind === "source-primitive" ||
        (type.kind === "literal" && type.literalKind === "number")
    )
  ) {
    const numberIndex = singleRuntimeUnionArmIndex(
      arms,
      (arm) =>
        (arm.kind === "intrinsic" && arm.name === "number") ||
        arm.kind === "source-primitive" ||
        (arm.kind === "literal" && arm.literalKind === "number")
    );
    if (numberIndex) return numberIndex;
  }
  if (
    plan.expressionKind === "arrow-function" ||
    plan.expressionKind === "function-expression" ||
    expressionTypes.some((type) => type.kind === "function")
  ) {
    const functionIndex = singleRuntimeUnionArmIndex(
      arms,
      (arm) =>
        arm.kind === "function" ||
        (arm.kind === "named" && arm.aliasTarget?.kind === "function")
    );
    if (functionIndex) return functionIndex;
  }
  if (expressionTypes.some((type) => type.kind === "named")) {
    const concreteIndex = singleRuntimeUnionArmIndex(
      arms,
      (arm) =>
        arm.kind === "named" &&
        (arm.declarationKind === "class" || arm.declarationKind === "interface")
    );
    if (concreteIndex) return concreteIndex;
  }
  const objectLiteral = objectLiteralExpressionPlan(plan);
  if (objectLiteral) {
    const objectIndex = singleRuntimeUnionArmIndex(arms, (arm) =>
      objectLiteralMatchesArm(objectLiteral, arm)
    );
    if (objectIndex) return objectIndex;
    const recordIndex = singleRuntimeUnionArmIndex(
      arms,
      (arm) => recordValueType(arm) !== undefined
    );
    if (recordIndex) return recordIndex;
  }
  return undefined;
};

const runtimeUnionArrayArmIndexForArrayLiteral = (
  plan: LoweringExpressionPlan,
  carrier: LoweringTypeRefPlan,
  context: RenderContext
): number | undefined => {
  const candidates = runtimeUnionCarrierArms(carrier, context)
    .map((arm, index) => ({
      arm,
      arrayType: arrayTypeFromTypePlan(arm, context),
      index: index + 1,
    }))
    .filter(
      (
        candidate
      ): candidate is {
        readonly arm: LoweringTypeRefPlan;
        readonly arrayType: Extract<
          LoweringTypeRefPlan,
          { readonly kind: "array" }
        >;
        readonly index: number;
      } => candidate.arrayType !== undefined
    );
  const matches = candidates.filter((candidate) =>
    plan.elements.every((element) => {
      const elementTypes = [
        element.storageTypePlan,
        element.type,
      ].filter((type): type is LoweringTypeRefPlan => type !== undefined);
      return (
        elementTypes.length === 0 ||
        elementTypes.some((type) =>
          runtimeTypePlanAssignableToTarget(
            type,
            candidate.arrayType.elementType,
            context,
            new Set()
          )
        )
      );
    })
  );
  if (matches.length === 1) return matches[0]?.index;
  const narrowest = matches.filter((candidate) =>
    matches.every(
      (other) =>
        other === candidate ||
        runtimeTypePlanAssignableToTarget(
          candidate.arrayType.elementType,
          other.arrayType.elementType,
          context,
          new Set()
        )
    )
  );
  return narrowest.length === 1 ? narrowest[0]?.index : undefined;
};

const runtimeUnionArrayArmIndex = (
  carrier: LoweringTypeRefPlan | undefined,
  context: RenderContext
): number | undefined => {
  const arms = runtimeUnionCarrierArms(carrier, context);
  return singleRuntimeUnionArmIndex(
    arms,
    (arm) => arrayTypeFromUseSite(arm) !== undefined
  );
};

const runtimeUnionArmIndexForTargetType = (
  carrier: LoweringTypeRefPlan | undefined,
  target: LoweringTypeRefPlan | undefined,
  context: RenderContext
): number | undefined => {
  if (!carrier || !target) return undefined;
  const arms = runtimeUnionCarrierArms(carrier, context);
  return singleRuntimeUnionArmIndex(arms, (arm) =>
    sameRuntimeTypePlan(arm, target)
  );
};

const runtimeUnionTypeAssignableToUnion = (
  source: LoweringTypeRefPlan | undefined,
  target: LoweringTypeRefPlan | undefined,
  context: RenderContext,
  seen: ReadonlySet<string> = new Set()
): boolean => {
  const targetUnion = runtimeUnionTarget(target);
  if (!source || !targetUnion) return false;
  if (sameRuntimeTypePlan(source, targetUnion)) return true;
  const key = `${typePlanKey(source)}=>${typePlanKey(targetUnion)}`;
  if (seen.has(key)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(key);
  const targetArms = runtimeUnionCarrierArms(targetUnion, context);
  const sourceUnion = runtimeUnionTarget(source);
  const sourceArms = sourceUnion
    ? runtimeUnionCarrierArms(sourceUnion, context)
    : [source];
  return (
    sourceArms.length > 0 &&
    sourceArms.every((sourceArm) =>
      targetArms.some(
        (targetArm) =>
          runtimeTypePlanAssignableToTarget(
            sourceArm,
            targetArm,
            context,
            nextSeen
          ) ||
          runtimeUnionTypeAssignableToUnion(
            sourceArm,
            targetArm,
            context,
            nextSeen
          )
      )
    )
  );
};

const runtimeTypePlanAssignableToTarget = (
  source: LoweringTypeRefPlan | undefined,
  target: LoweringTypeRefPlan | undefined,
  context: RenderContext,
  seen: ReadonlySet<string>
): boolean => {
  if (!source || !target) return false;
  if (sameRuntimeTypePlan(source, target)) return true;
  const key = `${typePlanKey(source)}=>${typePlanKey(target)}`;
  if (seen.has(key)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(key);
  if (
    source.kind === "literal" &&
    target.kind === "intrinsic" &&
    ((source.literalKind === "string" && target.name === "string") ||
      (source.literalKind === "number" && target.name === "number") ||
      (source.literalKind === "boolean" && target.name === "boolean") ||
      (source.literalKind === "bigint" && target.name === "bigint"))
  ) {
    return true;
  }
  const sourceArray = arrayTypeFromTypePlan(source, context);
  const targetArray = arrayTypeFromTypePlan(target, context);
  if (sourceArray && targetArray) {
    return runtimeTypePlanAssignableToTarget(
      sourceArray.elementType,
      targetArray.elementType,
      context,
      nextSeen
    );
  }
  const sourceAlias = source.kind === "named" ? source.aliasTarget : undefined;
  if (
    sourceAlias &&
    runtimeTypePlanAssignableToTarget(sourceAlias, target, context, nextSeen)
  ) {
    return true;
  }
  const targetAlias = target.kind === "named" ? target.aliasTarget : undefined;
  if (
    targetAlias &&
    runtimeTypePlanAssignableToTarget(source, targetAlias, context, nextSeen)
  ) {
    return true;
  }
  return runtimeUnionTypeAssignableToUnion(source, target, context, nextSeen);
};

const runtimeUnionArmIndexAssignableToTargetType = (
  carrier: LoweringTypeRefPlan | undefined,
  target: LoweringTypeRefPlan | undefined,
  context: RenderContext
): number | undefined => {
  if (!carrier || !target) return undefined;
  const arms = runtimeUnionCarrierArms(carrier, context);
  return singleRuntimeUnionArmIndex(arms, (arm) =>
    runtimeUnionTypeAssignableToUnion(arm, target, context)
  );
};

const runtimeUnionCarriersOverlap = (
  sourceCarrier: LoweringTypeRefPlan | undefined,
  targetCarrier: LoweringTypeRefPlan | undefined,
  context: RenderContext
): boolean => {
  const sourceArms = runtimeUnionCarrierArms(sourceCarrier, context);
  const targetArms = runtimeUnionCarrierArms(targetCarrier, context);
  return sourceArms.some((sourceArm) =>
    targetArms.some(
      (targetArm) =>
        sameRuntimeTypePlan(sourceArm, targetArm) ||
        runtimeUnionTypeAssignableToUnion(sourceArm, targetArm, context) ||
        runtimeUnionTypeAssignableToUnion(targetArm, sourceArm, context)
    )
  );
};

const runtimeUnionSourceArmValue = (
  rendered: string,
  sourceCarrier: LoweringTypeRefPlan | undefined,
  targetArm: LoweringTypeRefPlan | undefined,
  context: RenderContext
): string | undefined => {
  const sourceArmIndex =
    runtimeUnionArmIndexForTargetType(sourceCarrier, targetArm, context) ??
    runtimeUnionArmIndexAssignableToTargetType(
      sourceCarrier,
      targetArm,
      context
    );
  if (!sourceArmIndex) return undefined;
  const sourceArm = runtimeUnionCarrierArms(sourceCarrier, context)[
    sourceArmIndex - 1
  ];
  const extracted = `${rendered}.As${sourceArmIndex}()`;
  const targetCarrier = runtimeUnionCarrierType(targetArm, context);
  if (
    sourceArm &&
    targetCarrier &&
    !sameRuntimeTypePlan(sourceArm, targetArm)
  ) {
    const extractedValue = runtimeUnionCarrierType(sourceArm, context)
      ? `${extracted}.Value`
      : extracted;
    return `${renderCSharpType(targetCarrier, context)}.FromValue(${extractedValue})`;
  }
  return extracted;
};

const runtimeUnionArrayArmType = (
  targetArm: LoweringTypeRefPlan | undefined,
  carrier: LoweringTypeRefPlan,
  context: RenderContext
): Extract<LoweringTypeRefPlan, { readonly kind: "array" }> | undefined => {
  const direct = arrayTypeFromTypePlan(targetArm, context);
  if (isRecursiveRuntimeArrayArm(targetArm, carrier, context)) {
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
  const sourceCarrier =
    runtimeUnionCarrierType(plan?.storageTypePlan, context) ??
    runtimeUnionCarrierType(plan?.type, context);
  const storageAlreadyCarrier = runtimeUnionValueAlreadyCarrier(
    plan?.storageTypePlan,
    carrier
  );
  const typeAlreadyCarrier = runtimeUnionValueAlreadyCarrier(
    plan?.type,
    carrier
  );
  const typeStoredAsType =
    !plan?.storageTypePlan ||
    !plan?.type ||
    sameRuntimeTypePlan(plan.storageTypePlan, plan.type);
  if (
    storageAlreadyCarrier ||
    (typeAlreadyCarrier && typeStoredAsType)
  ) {
    return rendered;
  }
  const expressionTypeIsCarrier =
    plan?.type !== undefined && sameRuntimeTypePlan(plan.type, carrier);
  const expressionTypeIsKnownArm =
    plan?.type !== undefined && !expressionTypeIsCarrier;
  if (
    plan?.storageTypePlan &&
    sameRuntimeTypePlan(plan.storageTypePlan, carrier) &&
    !expressionTypeIsKnownArm
  ) {
    return rendered;
  }
  if (
    sourceCarrier &&
    sameRuntimeTypePlan(sourceCarrier, carrier) &&
    !expressionTypeIsKnownArm
  ) {
    return rendered;
  }
  const sourceCarrierValue = runtimeUnionSourceArmValue(
    rendered,
    sourceCarrier,
    carrier,
    context
  );
  if (sourceCarrierValue) return sourceCarrierValue;
  const targetUnion = runtimeUnionTarget(carrier);
  if (
    sourceCarrier &&
    targetUnion &&
    (runtimeUnionTypeAssignableToUnion(plan?.type, targetUnion, context) ||
      runtimeUnionCarriersOverlap(sourceCarrier, carrier, context))
  ) {
    return `${renderCSharpType(carrier, context)}.FromValue(${rendered}.Value)`;
  }
  if (plan?.semantic === "undefined-value" || plan?.literalKind === "null") {
    return `${renderCSharpType(carrier, context)}.FromNull()`;
  }
  const armIndex = runtimeUnionArmIndexForExpression(plan, carrier, context);
  if (armIndex) {
    const targetArm = runtimeUnionCarrierArms(carrier, context)[armIndex - 1];
    if (!targetArm) return undefined;
    const targetArmArray = runtimeUnionArrayArmType(
      targetArm,
      carrier,
      context
    );
    const targetArmRecord = recordValueType(targetArm);
    const targetArmObject = objectTypeFromArm(targetArm);
    const targetArmCarrier = runtimeUnionCarrierType(targetArm, context);
    const carrierArrayLiteral = arrayLiteralExpressionPlan(plan);
    const carrierObjectLiteral = objectLiteralExpressionPlan(plan);
    const armRendered =
      targetArmArray && carrierArrayLiteral
        ? renderArrayLiteral(carrierArrayLiteral, context, targetArmArray)
        : (targetArmRecord || targetArmObject) && carrierObjectLiteral
          ? renderObjectLiteral(carrierObjectLiteral, context, targetArm)
          : isNamedFunctionAlias(targetArm) &&
              isCallableStorageType(plan?.storageTypePlan) &&
              !sameRuntimeTypePlan(plan?.storageTypePlan, targetArm)
            ? `new ${renderCSharpType(targetArm, context)}(${renderExpressionWithUseSiteCast(plan, context, targetArm.aliasTarget)}.Invoke)`
          : targetArmCarrier
            ? rendered
            : renderExpressionWithUseSiteCast(plan, context, targetArm);
    const sourceArmValue = runtimeUnionSourceArmValue(
      armRendered,
      sourceCarrier,
      targetArm,
      context
    );
    const renderedArmValue =
      sourceArmValue ??
      (targetArmArray
        ? castExpression(armRendered, renderCSharpType(targetArmArray, context))
        : undefined) ??
      (targetArmCarrier &&
      !sameRuntimeTypePlan(plan?.type, targetArm) &&
      !sameRuntimeTypePlan(plan?.storageTypePlan, targetArm)
        ? `${renderCSharpType(targetArmCarrier, context)}.FromValue(${armRendered})`
        : armRendered);
    return `${renderCSharpType(carrier, context)}.From${armIndex}(${renderedArmValue})`;
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
  includeParameterTypes = true,
  includeContextualMissingParameters = true
): string => {
  const contextualFunction = functionTypeFromUseSite(plan.contextualTypePlan);
  const parameters = [
    ...plan.parameters,
    ...(includeContextualMissingParameters && contextualFunction
      ? contextualFunction.parameters
          .slice(plan.parameters.length)
          .map((parameter, index) => ({
            ...parameter,
            name: `__unused${plan.parameters.length + index}`,
            nameSourceText: `__unused${plan.parameters.length + index}`,
          }))
      : []),
  ]
    .map((parameter) =>
      renderLambdaParameter(parameter, context, includeParameterTypes)
    )
    .join(", ");
  const asyncModifier = plan.async ? "async " : "";
  const body = plan.body
    ? renderLambdaStatementBody(plan, context)
    : isVoidLikeExpressionType(lambdaContextReturnType(plan), context)
      ? renderVoidLambdaExpressionBody(plan.expression, context)
      : renderExpressionWithUseSiteCast(
          plan.expression,
          context,
          lambdaContextReturnType(plan) ?? plan.returnType
        );
  return `${asyncModifier}(${parameters}) => ${body}`;
};

const renderActualLambdaArgument = (
  argument: LoweringExpressionPlan,
  context: RenderContext
): string =>
  argument.expressionKind === "arrow-function" ||
  argument.expressionKind === "function-expression"
    ? renderLambda(argument, context, true, false)
    : renderCallArgument(argument, context);

const renderCallArgument = (
  argument: LoweringExpressionPlan,
  context: RenderContext,
  useSiteType?: LoweringTypeRefPlan
): string => {
  const rawContextualType = useSiteType ?? argument.contextualTypePlan;
  const contextualCarrier = runtimeUnionCarrierType(rawContextualType, context);
  const contextualArm =
    useSiteType === undefined &&
    contextualCarrier &&
    !runtimeUnionCarrierType(argument.storageTypePlan, context) &&
    !runtimeUnionCarrierType(argument.type, context)
      ? runtimeUnionCarrierArms(contextualCarrier, context)[
          (runtimeUnionArmIndexForExpression(
            argument,
            contextualCarrier,
            context
          ) ?? 0) - 1
        ]
      : undefined;
  const contextualType = contextualArm ?? rawContextualType;
  const targetDelegateType =
    isNamedFunctionAlias(contextualType) || contextualType?.kind === "function"
      ? contextualType
      : undefined;
  const renderableTargetDelegateType =
    targetDelegateType &&
    !containsOutOfScopeTypeParameterTypePlan(targetDelegateType, context)
      ? targetDelegateType
      : undefined;
  if (
    argument.expressionKind === "arrow-function" ||
    argument.expressionKind === "function-expression"
  ) {
    const renderedLambda = renderLambda(argument, context, false);
    const runtimeUnionCarrier = renderRuntimeUnionCarrierValue(
      renderedLambda,
      argument,
      contextualType,
      context
    );
    if (runtimeUnionCarrier) return runtimeUnionCarrier;
    return renderableTargetDelegateType
      ? `((${renderCSharpType(renderableTargetDelegateType, context)})(${renderedLambda}))`
      : renderedLambda;
  }
  if (
    renderableTargetDelegateType &&
    !sameRuntimeTypePlan(argument.type, renderableTargetDelegateType)
  ) {
    if (
      isCallableStorageType(argument.storageTypePlan) &&
      !sameRuntimeTypePlan(argument.storageTypePlan, renderableTargetDelegateType)
    ) {
      const delegateSourceType =
        renderableTargetDelegateType.kind === "named"
          ? renderableTargetDelegateType.aliasTarget
          : renderableTargetDelegateType;
      const delegateSource =
        argument.expressionKind === "spread"
          ? renderExpression(argument.expression, context)
          : renderExpressionWithUseSiteCast(argument, context, delegateSourceType);
      return `new ${renderCSharpType(renderableTargetDelegateType, context)}(${delegateSource}.Invoke)`;
    }
    return renderExpressionWithUseSiteCast(
      argument,
      context,
      renderableTargetDelegateType
    );
  }
  const rendered =
    argument.expressionKind === "spread"
      ? renderExpression(argument.expression, context)
      : renderExpressionWithUseSiteCast(argument, context, contextualType);
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

const callExpressionParameterTypes = (
  plan: LoweringExpressionPlan
): readonly (LoweringTypeRefPlan | undefined)[] => {
  if (plan.argumentUseSiteTypes) return plan.argumentUseSiteTypes;
  const callable =
    functionTypeFromUseSite(plan.expression?.storageTypePlan) ??
    functionTypeFromUseSite(plan.callTargetTypePlan) ??
    functionTypeFromUseSite(plan.expression?.type);
  return callable?.parameters.map((parameter) => parameter.type) ?? [];
};

const renderSourceQualifiedName = (
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
  const exhaustiveOwner: never = operation.owner;
  return exhaustiveOwner;
};

const consoleMemberTarget = (member: string): string =>
  `${renderSourceQualifiedName({
    dispatch: "static-call",
    owner: "Console",
    member,
  })}.${member}`;

const renderConsoleCall = (
  operation: SourceRuntimeOperation,
  args: readonly string[]
): string => `${consoleMemberTarget(operation.member)}(${args.join(", ")})`;

const functionRuntimeLength = (
  plan: LoweringExpressionPlan | undefined
): number | undefined => {
  if (
    plan?.expressionKind !== "arrow-function" &&
    plan?.expressionKind !== "function-expression"
  ) {
    return undefined;
  }
  const firstRuntimeLengthBoundary = plan.parameters.findIndex(
    (parameter) => parameter.rest || parameter.initializer !== undefined
  );
  return firstRuntimeLengthBoundary === -1
    ? plan.parameters.length
    : firstRuntimeLengthBoundary;
};

const functionTypeRuntimeLength = (
  type: LoweringTypeRefPlan | undefined
): number | undefined => functionTypeFromUseSite(type)?.parameters.length;

const renderFunctionLength = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string => {
  const length =
    functionRuntimeLength(plan.expression) ??
    functionTypeRuntimeLength(plan.expression?.storageTypePlan) ??
    functionTypeRuntimeLength(plan.expression?.type);
  if (length !== undefined) return String(length);
  context.reportUnsupported(
    "Function.length receiver",
    plan.sourceKindName,
    plan.sourceText
  );
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

const isCallableUseSiteType = (
  type: LoweringTypeRefPlan | undefined
): type is
  | Extract<LoweringTypeRefPlan, { readonly kind: "named" }>
  | Extract<LoweringTypeRefPlan, { readonly kind: "function" }> =>
  type?.kind === "function" || isNamedFunctionAlias(type);

const singleCallableAliasType = (
  type: LoweringTypeRefPlan | undefined
): Extract<LoweringTypeRefPlan, { readonly kind: "named" }> | undefined => {
  if (isNamedFunctionAlias(type)) return type;
  if (type?.kind !== "union") return undefined;
  const callableAliases =
    nonNullishUnionTypes(type).filter(isNamedFunctionAlias);
  return callableAliases.length === 1 ? callableAliases[0] : undefined;
};

const singleCallableUseSiteType = (
  type: LoweringTypeRefPlan | undefined
):
  | Extract<LoweringTypeRefPlan, { readonly kind: "named" }>
  | Extract<LoweringTypeRefPlan, { readonly kind: "function" }>
  | undefined => {
  if (isCallableUseSiteType(type)) return type;
  if (type?.kind !== "union") return undefined;
  const callableTypes = nonNullishUnionTypes(type).filter(isCallableUseSiteType);
  return callableTypes.length === 1 ? callableTypes[0] : undefined;
};

const isCallableStorageType = (
  type: LoweringTypeRefPlan | undefined
): boolean => {
  if (singleCallableAliasType(type)) return true;
  return unwrapAliasTarget(type)?.kind === "function";
};

const typeCanBeNullish = (type: LoweringTypeRefPlan | undefined): boolean =>
  needsNullishConditionCheck(type) ||
  (type?.kind === "union" && type.types.some(isNullishType));

const renderDelegateUseSiteAdapter = (
  rendered: string,
  plan: LoweringExpressionPlan | undefined,
  useSiteType: LoweringTypeRefPlan | undefined,
  context: RenderContext
): string | undefined => {
  if (
    plan?.expressionKind === "arrow-function" ||
    plan?.expressionKind === "function-expression"
  ) {
    return undefined;
  }
  const targetCallable = singleCallableUseSiteType(useSiteType);
  if (
    !targetCallable ||
    containsOutOfScopeTypeParameterTypePlan(targetCallable, context)
  ) {
    return undefined;
  }
  if (
    isNamedFunctionAlias(targetCallable) &&
    isBroadIntrinsicRuntimeType(plan?.storageTypePlan)
  ) {
    return undefined;
  }
  const targetType = renderCSharpType(targetCallable, context);
  const sourceCarrier =
    runtimeUnionCarrierType(plan?.storageTypePlan, context) ??
    runtimeUnionCarrierType(plan?.type, context);
  if (sourceCarrier) {
    const sourceArmIndex =
      runtimeUnionArmIndexForTargetType(sourceCarrier, targetCallable, context) ??
      runtimeUnionArmIndexAssignableToTargetType(
        sourceCarrier,
        targetCallable,
        context
      ) ??
      runtimeUnionArmIndexAssignableToTargetType(
        sourceCarrier,
        useSiteType,
        context
      );
    const sourceArm = sourceArmIndex
      ? runtimeUnionCarrierArms(sourceCarrier, context)[sourceArmIndex - 1]
      : undefined;
    if (!sourceArm || sameRuntimeTypePlan(sourceArm, targetCallable)) {
      return undefined;
    }
    return sourceArmIndex
      ? renderNullableDelegateAdapter(
          `${rendered}.As${sourceArmIndex}()`,
          targetType,
          runtimeUnionCarrierArms(sourceCarrier, context).some(isNullishType),
          context
        )
      : undefined;
  }
  const sourceCallable =
    singleCallableUseSiteType(plan?.storageTypePlan) ??
    singleCallableUseSiteType(plan?.type);
  if (!sourceCallable || sameRuntimeTypePlan(sourceCallable, targetCallable)) {
    return undefined;
  }
  const sourceNeedsCast =
    plan?.storageTypePlan !== undefined &&
    !sameRuntimeTypePlan(plan.storageTypePlan, sourceCallable);
  const sourceValue = sourceNeedsCast
    ? renderUseSiteCast(
        renderCSharpType(sourceCallable, context),
        rendered,
        plan,
        sourceCallable
      )
    : rendered;
  return renderNullableDelegateAdapter(
    sourceValue,
    targetType,
    typeCanBeNullish(plan?.storageTypePlan) || typeCanBeNullish(plan?.type),
    context
  );
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
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext
): boolean => {
  if (isTaskLikeTypePlan(type, context)) {
    return true;
  }
  return type?.kind === "union"
    ? nonNullishUnionTypes(type).some((member) =>
        isTaskLikeUseSiteType(member, context)
      )
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

const runtimeUnionValueAlreadyCarrier = (
  type: LoweringTypeRefPlan | undefined,
  carrier: LoweringTypeRefPlan
): boolean => {
  if (!type) return false;
  if (sameRuntimeTypePlan(type, carrier)) return true;
  if (type.kind !== "union") return false;
  const nonNullish = nonNullishUnionTypes(type);
  return (
    nonNullish.length === 1 &&
    nonNullish[0] !== undefined &&
    sameRuntimeTypePlan(nonNullish[0], carrier)
  );
};

const renderRuntimeUnionArrayReceiver = (
  receiverPlan: LoweringExpressionPlan | undefined,
  context: RenderContext,
  useSiteTypeOverride?: LoweringTypeRefPlan
): string | undefined => {
  const sourceCarrier =
    runtimeUnionCarrierType(receiverPlan?.storageTypePlan, context) ??
    runtimeUnionCarrierType(receiverPlan?.type, context) ??
    runtimeUnionCarrierType(useSiteTypeOverride, context);
  if (!sourceCarrier) return undefined;
  const targetArrayType =
    arrayTypeFromUseSite(useSiteTypeOverride) ??
    arrayReceiverType(receiverPlan);
  const armIndex =
    runtimeUnionArmIndexForTargetType(
      sourceCarrier,
      targetArrayType,
      context
    ) ?? runtimeUnionArrayArmIndex(sourceCarrier, context);
  return armIndex
    ? `${renderExpression(receiverPlan, context)}.As${armIndex}()!`
    : undefined;
};

const renderArrayLength = (
  receiverPlan: LoweringExpressionPlan | undefined,
  context: RenderContext,
  useSiteTypeOverride?: LoweringTypeRefPlan
): string => {
  const runtimeUnionArrayReceiver = renderRuntimeUnionArrayReceiver(
    receiverPlan,
    context,
    useSiteTypeOverride
  );
  if (runtimeUnionArrayReceiver) return `${runtimeUnionArrayReceiver}.Count`;
  const receiverArrayType =
    arrayTypeFromUseSite(receiverPlan?.storageTypePlan) ??
    arrayTypeFromUseSite(useSiteTypeOverride);
  if (isExternalBindingArrayType(receiverArrayType)) {
    const receiver =
      isExternalBindingArrayType(
        arrayTypeFromUseSite(receiverPlan?.storageTypePlan)
      )
        ? renderExpression(receiverPlan, context)
        : renderExpressionWithUseSiteCast(
            receiverPlan,
            context,
            receiverArrayType
          );
    return `${receiver}.Length`;
  }
  if (receiverArrayType) {
    return `${renderExpressionWithUseSiteCast(receiverPlan, context, useSiteTypeOverride)}.Count`;
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
  if (
    !elementTypePlan ||
    !receiverCastType ||
    isOutOfScopeTypeParameterType(elementTypePlan, context)
  ) {
    return `global::System.Linq.Enumerable.Count(${enumerableObjectCast(renderExpression(receiverPlan, context))})`;
  }
  return `global::System.Linq.Enumerable.Count(${typedReceiver})`;
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
  const renderedIndex = renderArrayIndexExpression(indexPlan, context);
  const runtimeUnionArrayReceiver = renderRuntimeUnionArrayReceiver(
    receiverPlan,
    context,
    useSiteTypeOverride
  );
  if (runtimeUnionArrayReceiver) {
    return `${runtimeUnionArrayReceiver}[${renderedIndex}]`;
  }
  const elementTypePlan =
    arrayTypeFromUseSite(useSiteTypeOverride)?.elementType ??
    arrayReceiverElementType(receiverPlan);
  const nativeArrayType =
    arrayTypeFromUseSite(receiverPlan?.storageTypePlan) ??
    arrayTypeFromUseSite(useSiteTypeOverride);
  if (isExternalBindingArrayType(nativeArrayType)) {
    const receiver =
      isExternalBindingArrayType(
        arrayTypeFromUseSite(receiverPlan?.storageTypePlan)
      )
        ? renderExpression(receiverPlan, context)
        : renderExpressionWithUseSiteCast(
            receiverPlan,
            context,
            nativeArrayType
          );
    return `${receiver}[${renderedIndex}]`;
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
    const nullableElementType = renderNullableCSharpType(
      elementTypePlan,
      context
    );
    return `global::System.Linq.Enumerable.ElementAtOrDefault(global::System.Linq.Enumerable.Select(${typedReceiver}, item => (${nullableElementType})item), ${renderedIndex})`;
  }
  if (
    elementTypePlan &&
    receiverCastType &&
    !isOutOfScopeTypeParameterType(elementTypePlan, context)
  ) {
    return `${typedReceiver}[${renderedIndex}]`;
  }
  return `global::System.Linq.Enumerable.ElementAt(${enumerableObjectCast(renderExpression(receiverPlan, context))}, ${renderedIndex})`;
};

const isCSharpIntIndexType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type?.kind === "source-primitive" && type.fact.kind === "int32";

const isIntegerNumberLiteral = (plan: LoweringExpressionPlan): boolean =>
  plan.expressionKind === "literal" &&
  plan.literalKind === "number" &&
  plan.literalText !== undefined &&
  /^(?:0|[1-9]\d*)$/u.test(plan.literalText);

const renderArrayIndexExpression = (
  indexPlan: LoweringExpressionPlan,
  context: RenderContext
): string => {
  const rendered = renderExpression(indexPlan, context);
  const indexType = indexPlan.storageTypePlan ?? indexPlan.type;
  return isIntegerNumberLiteral(indexPlan) || isCSharpIntIndexType(indexType)
    ? rendered
    : `global::System.Convert.ToInt32(${rendered})`;
};

const arrayElementAccessElementType = (
  plan: LoweringExpressionPlan | undefined
): LoweringTypeRefPlan | undefined =>
  plan?.expressionKind === "element-access" &&
  plan.sourceOperation?.dispatch === "index" &&
  plan.sourceOperation.owner === "Array"
    ? (arrayTypeFromUseSite(plan.receiverTypePlan)?.elementType ??
      arrayReceiverElementType(plan.expression))
    : undefined;

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
  const dictionary = castExpression(
    renderExpression(source, context),
    dictionaryType
  );
  return `new global::System.Collections.Generic.List<(string, ${valueType})>(global::System.Linq.Enumerable.Select(${dictionary}, entry => (entry.Key, entry.Value)))`;
};

const functionParameterCountMatches = (
  type: Extract<LoweringTypeRefPlan, { readonly kind: "function" }>,
  argumentCount: number
): boolean => {
  const minimum = type.parameters.filter(
    (parameter) =>
      !parameter.optional &&
      !parameter.rest &&
      parameter.initializer === undefined
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
          readonly member: Extract<
            LoweringTypeRefPlan,
            { readonly kind: "named" }
          >;
          readonly target: Extract<
            LoweringTypeRefPlan,
            { readonly kind: "function" }
          >;
        } => match !== undefined
      )
      .filter((match) =>
        functionParameterCountMatches(match.target, argumentCount)
      );
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
    (isNamedFunctionAlias(callee?.type)
      ? callee?.type
      : (targetType ?? callee?.type));
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
    (type.name === "any" ||
      type.name === "unknown" ||
      type.name === "object")) ||
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
  if (runtimeUnionCarrierType(targetType, context)) {
    return renderExpressionWithUseSiteCast(value, context, targetType);
  }
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
  const targetArrayType: LoweringTypeRefPlan = {
    kind: "array",
    elementType: elementTypePlan,
    readonly: true,
  };
  const sourceCarrier =
    runtimeUnionCarrierType(receiverPlan?.storageTypePlan, context) ??
    runtimeUnionCarrierType(receiverPlan?.type, context);
  const armIndex =
    runtimeUnionArmIndexForTargetType(
      sourceCarrier,
      targetArrayType,
      context
    ) ?? runtimeUnionArrayArmIndex(sourceCarrier, context);
  if (armIndex) return `${receiver}.As${armIndex}()`;
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
  const targetArrayType: LoweringTypeRefPlan = {
    kind: "array",
    elementType: elementTypePlan,
    readonly: false,
  };
  const sourceCarrier =
    runtimeUnionCarrierType(receiverPlan?.storageTypePlan, context) ??
    runtimeUnionCarrierType(receiverPlan?.type, context);
  const armIndex =
    runtimeUnionArmIndexForTargetType(
      sourceCarrier,
      targetArrayType,
      context
    ) ?? runtimeUnionArrayArmIndex(sourceCarrier, context);
  if (armIndex) return `${receiver}.As${armIndex}()`;
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

const renderArrayCallbackArgument = (
  plan: LoweringExpressionPlan,
  argumentIndex: number,
  receiverPlan: LoweringExpressionPlan | undefined,
  context: RenderContext,
  feature: string
): string | undefined => {
  const argument = requiredCallArgument(plan, argumentIndex, context, feature);
  if (!argument) return undefined;
  const elementType = arrayReceiverElementType(receiverPlan);
  if (
    !elementType ||
    (argument.expressionKind !== "arrow-function" &&
      argument.expressionKind !== "function-expression")
  ) {
    return renderActualLambdaArgument(argument, context);
  }
  const contextualFunction = functionTypeFromUseSite(
    argument.contextualTypePlan
  );
  const parameters = argument.parameters.map((parameter, index) =>
    index === 0 ? { ...parameter, type: elementType } : parameter
  );
  return renderActualLambdaArgument(
    {
      ...argument,
      parameters,
      contextualTypePlan: contextualFunction
        ? {
            ...contextualFunction,
            parameters: contextualFunction.parameters.map((parameter, index) =>
              index === 0 ? { ...parameter, type: elementType } : parameter
            ),
          }
        : argument.contextualTypePlan,
    },
    context
  );
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
      return `global::System.String.Join(${operation.member === "join" ? (args[0] ?? '","') : '","'}, ${enumerableReceiver()})`;
    case "map":
      return `global::System.Linq.Enumerable.ToList(global::System.Linq.Enumerable.Select(${enumerableReceiver()}, ${renderArrayCallbackArgument(plan, 0, receiverPlan, context, "Array.map callback") ?? ""}))`;
    case "filter":
      return `global::System.Linq.Enumerable.ToList(global::System.Linq.Enumerable.Where(${enumerableReceiver()}, ${renderArrayCallbackArgument(plan, 0, receiverPlan, context, "Array.filter callback") ?? ""}))`;
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
      return `${listReceiver()}.ForEach(${renderArrayCallbackArgument(plan, 0, receiverPlan, context, "Array.forEach callback") ?? ""})`;
    case "find":
      return `global::System.Linq.Enumerable.FirstOrDefault(${enumerableReceiver()}, ${renderArrayCallbackArgument(plan, 0, receiverPlan, context, "Array.find callback") ?? ""})`;
    case "findIndex":
      return `${listReceiver()}.FindIndex(${renderArrayCallbackArgument(plan, 0, receiverPlan, context, "Array.findIndex callback") ?? ""})`;
    case "every":
      return `global::System.Linq.Enumerable.All(${enumerableReceiver()}, ${renderArrayCallbackArgument(plan, 0, receiverPlan, context, "Array.every callback") ?? ""})`;
    case "some":
      return `global::System.Linq.Enumerable.Any(${enumerableReceiver()}, ${renderArrayCallbackArgument(plan, 0, receiverPlan, context, "Array.some callback") ?? ""})`;
    default:
      return `${receiver}.${operation.member}(${args.join(", ")})`;
  }
};

const sourceRuntimeIntArgumentIndexes = (
  operation: SourceRuntimeOperation
): ReadonlySet<number> => {
  if (operation.owner !== "String") return new Set();
  switch (operation.member) {
    case "charAt":
    case "substring":
    case "slice":
      return new Set([0, 1]);
    default:
      return new Set();
  }
};

const renderSourceRuntimeArgument = (
  argument: LoweringExpressionPlan,
  index: number,
  operation: SourceRuntimeOperation,
  context: RenderContext
): string => {
  const rendered = renderExpression(argument, context);
  return sourceRuntimeIntArgumentIndexes(operation).has(index)
    ? `global::System.Convert.ToInt32(${rendered})`
    : rendered;
};

const renderSourceRuntimeCall = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  const callee = plan.expression;
  const operation = callee?.sourceOperation;
  if (!operation) return undefined;
  const args = plan.arguments.map((argument, index) =>
    renderSourceRuntimeArgument(argument, index, operation, context)
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
    const call = `${renderSourceQualifiedName(operation)}.${operation.member}(${renderedArgs})`;
    return operation.owner === "String" && operation.member === "split"
      ? `new global::System.Collections.Generic.List<string>(${call})`
      : call;
  }

  if (operation.dispatch === "static-call") {
    switch (operation.owner) {
      case "Console":
        return renderConsoleCall(operation, args);
      case "Global":
        if (
          operation.member === "setInterval" ||
          operation.member === "setTimeout"
        ) {
          const handler = requiredCallArgument(
            plan,
            0,
            context,
            `${operation.member} handler`
          );
          if (!handler) return "";
          const renderedHandler = renderActualLambdaArgument(handler, context);
          const renderedArgs = plan.arguments
            .slice(1)
            .map((argument) => renderCallArgument(argument, context));
          return `${renderSourceQualifiedName(operation)}.${operation.member}(${[
            renderedHandler,
            ...renderedArgs,
          ].join(", ")})`;
        }
        break;
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
          return `${renderSourceQualifiedName(operation)}.@is(${args.join(", ")})`;
        }
        break;
      case "JSON":
        if (operation.member === "parse") {
          return `${renderSourceQualifiedName(operation)}.parse<${renderRequiredCSharpType(plan.type, context, "JSON.parse result type", plan.sourceKindName, plan.sourceText)}>(${args.join(", ")})`;
        }
        break;
      case "Promise":
        if (operation.member === "resolve") {
          const argument = plan.arguments[0];
          if (!argument || argument.semantic === "undefined-value") {
            return "global::System.Threading.Tasks.Task.CompletedTask";
          }
          const rendered = renderExpression(argument, context);
          return isTaskLikeUseSiteType(argument.type, context)
            ? rendered
            : `global::System.Threading.Tasks.Task.FromResult(${rendered})`;
        }
        break;
      default:
        break;
    }
    return `${renderSourceQualifiedName(operation)}.${operation.member}(${args.join(", ")})`;
  }

  return undefined;
};

const renderSourceRuntimeNew = (
  plan: LoweringExpressionPlan,
  context: RenderContext
): string | undefined => {
  const operation = plan.sourceOperation;
  if (operation?.dispatch !== "constructor") return undefined;
  return `new ${renderSourceQualifiedName(operation)}${renderTypeArguments(plan.typeArguments, context)}(${plan.arguments
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
        : reportMissingExpressionData(
            context,
            plan,
            "nameof intrinsic argument"
          );
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

const effectiveReceiverUseSiteType = (
  receiverPlan: LoweringExpressionPlan | undefined,
  receiverTypePlan: LoweringTypeRefPlan | undefined,
  context: RenderContext
): LoweringTypeRefPlan | undefined => {
  const aliasType = identifierAliasType(receiverPlan, context);
  if (aliasType) return aliasType;
  const sourceCarrier =
    runtimeUnionCarrierType(receiverPlan?.storageTypePlan, context) ??
    runtimeUnionCarrierType(receiverTypePlan, context);
  const receiverType = receiverPlan?.type;
  if (
    sourceCarrier &&
    receiverType &&
    !runtimeUnionCarrierType(receiverType, context) &&
    (runtimeUnionArmIndexForTargetType(sourceCarrier, receiverType, context) ||
      runtimeUnionArmIndexAssignableToTargetType(
        sourceCarrier,
        receiverType,
        context
      ))
  ) {
    return receiverType;
  }
  if (
    receiverTypePlan &&
    receiverPlan?.storageTypePlan &&
    sameRuntimeTypePlan(receiverTypePlan, receiverPlan.storageTypePlan)
  ) {
    return receiverTypePlan;
  }
  if (
    receiverPlan?.storageTypePlan &&
    receiverType &&
    !sameRuntimeTypePlan(receiverPlan.storageTypePlan, receiverType) &&
    !runtimeUnionCarrierType(receiverPlan.storageTypePlan, context) &&
    !runtimeUnionCarrierType(receiverType, context)
  ) {
    return receiverType;
  }
  return receiverTypePlan;
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
      if (plan.externalBinding) {
        const externalRuntimeName = renderExternalTargetExpressionName(
          plan.externalBinding,
          context
        );
        if (externalRuntimeName) {
          return externalRuntimeName;
        }
        return reportMissingExpressionData(
          context,
          plan,
          "external binding target expression"
        );
      }
      const sourceQualifiedNamePlan =
        plan.resolvedAliasName && plan.sourceQualifiedName
          ? {
              ...plan.sourceQualifiedName,
              name: plan.resolvedAliasName,
            }
          : plan.sourceQualifiedName;
      const sourceQualifiedName = renderCSharpRuntimeExpressionName(
        sourceQualifiedNamePlan
      );
      if (sourceQualifiedName) {
        return sourceQualifiedName;
      }
      if (plan.sourceOperation?.dispatch === "static-call") {
        return plan.sourceOperation.owner === "Console"
          ? consoleMemberTarget(plan.sourceOperation.member)
          : `${renderSourceQualifiedName(plan.sourceOperation)}.${plan.sourceOperation.member}`;
      }
      if (plan.sourceOperation?.dispatch === "constructor") {
        return renderSourceQualifiedName(plan.sourceOperation);
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
            requiredPlanText(
              plan,
              context,
              "number literal text",
              plan.literalText
            ) ?? ""
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
            ? `{(${renderExpression(part.expression, context)})}${escapeInterpolatedStringText(part.text)}`
            : escapeInterpolatedStringText(part.text)
        )
        .join("")}"`;
    case "erased-wrapper":
      return renderExpressionWithUseSiteCast(
        plan.expression,
        context,
        plan.type
      );
    case "non-null":
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
      if (
        plan.binaryOperator === "logical-and" ||
        plan.binaryOperator === "logical-or"
      ) {
        return `${renderConditionExpression(plan.left, context)} ${operator} ${renderConditionExpression(plan.right, context)}`;
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
        const sourceCarrier =
          runtimeUnionCarrierType(plan.left?.storageTypePlan, context) ??
          runtimeUnionCarrierType(plan.left?.type, context);
        const targetType = plan.right?.storageTypePlan ?? plan.right?.type;
        const runtimeConstructor =
          plan.right?.sourceOperation?.dispatch === "constructor"
            ? plan.right.sourceOperation
            : undefined;
        const runtimeOwnerArmIndex = runtimeConstructor
          ? singleRuntimeUnionArmIndex(
              runtimeUnionCarrierArms(sourceCarrier, context),
              (arm) =>
                arm.kind === "named" &&
                arm.sourceQualifiedName?.namespace === "js" &&
                arm.sourceQualifiedName.name === runtimeConstructor.owner
            )
          : undefined;
        const armIndex =
          runtimeUnionArmIndexForTargetType(
            sourceCarrier,
            targetType,
            context
          ) ??
          runtimeUnionArmIndexAssignableToTargetType(
            sourceCarrier,
            targetType,
            context
          ) ??
          runtimeOwnerArmIndex;
        if (armIndex) {
          return `${renderExpression(plan.left, context)}.As${armIndex}() != null`;
        }
        if (runtimeConstructor) {
          return `${renderExpression(plan.left, context)} ${operator} ${renderSourceQualifiedName(runtimeConstructor)}`;
        }
        return targetType
          ? `${renderExpression(plan.left, context)} ${operator} ${renderCSharpType(targetType, context)}`
          : `${renderExpression(plan.left, context)} ${operator} ${renderExpression(plan.right, context)}`;
      }
      if (plan.binaryOperator === "assign") {
        return `${renderExpression(plan.left, context)} ${operator} ${renderAssignmentValue(plan.left, plan.right, context)}`;
      }
      const booleanObjectEquality = renderBooleanObjectEquality(plan, context);
      if (booleanObjectEquality) return booleanObjectEquality;
      if (plan.binaryOperator?.endsWith("assign") === true) {
        return `${renderExpression(plan.left, context)} ${operator} ${renderExpressionWithUseSiteCast(
          plan.right,
          context,
          plan.left?.storageTypePlan ?? plan.left?.type
        )}`;
      }
      if (plan.binaryOperator === "add" && isStringLikeTypePlan(plan.type)) {
        const stringType = { kind: "intrinsic", name: "string" } as const;
        return `${renderExpressionWithUseSiteCast(plan.left, context, stringType)} ${operator} ${renderExpressionWithUseSiteCast(plan.right, context, stringType)}`;
      }
      if (
        (plan.binaryOperator === "add" ||
          plan.binaryOperator === "subtract" ||
          plan.binaryOperator === "multiply" ||
          plan.binaryOperator === "divide" ||
          plan.binaryOperator === "remainder")
      ) {
        const resultType = arithmeticResultType(plan);
        if (resultType) {
          return `${renderExpressionWithUseSiteCast(plan.left, context, resultType)} ${operator} ${renderExpressionWithUseSiteCast(plan.right, context, resultType)}`;
        }
      }
      if (
        (plan.binaryOperator === "equal" ||
          plan.binaryOperator === "strict-equal" ||
          plan.binaryOperator === "not-equal" ||
          plan.binaryOperator === "strict-not-equal") &&
        (hasCharRuntimeType(plan.left) || hasCharRuntimeType(plan.right))
      ) {
        const charType =
          charRuntimeType(plan.left) ?? charRuntimeType(plan.right);
        return `${renderExpressionWithUseSiteCast(plan.left, context, charType)} ${operator} ${renderExpressionWithUseSiteCast(plan.right, context, charType)}`;
      }
      return `${renderExpressionWithUseSiteCast(plan.left, context)} ${operator} ${renderExpressionWithUseSiteCast(plan.right, context)}`;
    }
    case "prefix-unary":
      if (plan.unaryOperator === "logical-not") {
        return `!(${renderConditionExpression(plan.expression, context)})`;
      }
      return `${renderUnaryOperator(plan.unaryOperator, context, plan)}${renderExpression(plan.expression, context)}`;
    case "postfix-unary":
      return `${renderExpression(plan.expression, context)}${renderUnaryOperator(plan.unaryOperator, context, plan)}`;
    case "typeof": {
      const sourceCarrier =
        runtimeUnionCarrierType(plan.expression?.storageTypePlan, context) ??
        runtimeUnionCarrierType(plan.expression?.type, context);
      const rendered = sourceCarrier
        ? `${renderExpression(plan.expression, context)}.Value`
        : renderExpression(plan.expression, context);
      return `((object?)${rendered}) switch { null => "object", string => "string", char => "string", bool => "boolean", sbyte or byte or short or ushort or int or uint or long or ulong or float or double or decimal => "number", global::System.Numerics.BigInteger => "bigint", global::System.Delegate => "function", _ => "object" }`;
    }
    case "void":
      return renderExpression(plan.expression, context);
    case "property-access": {
      const operation = plan.sourceOperation;
      const receiverUseSiteType = effectiveReceiverUseSiteType(
        plan.expression,
        plan.receiverTypePlan,
        context
      );
      if (operation?.dispatch === "property") {
        switch (operation.owner) {
          case "String":
            return `${renderExpressionWithUseSiteCast(plan.expression, context, { kind: "intrinsic", name: "string" })}.Length`;
          case "Array":
            return renderArrayLength(
              plan.expression,
              context,
              receiverUseSiteType
            );
          case "Function":
            return renderFunctionLength(plan, context);
          case "Error":
            if (operation.member === "message") {
              return `${renderExpressionWithUseSiteCast(plan.expression, context, receiverUseSiteType)}.Message`;
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
              return `${castExpression(renderExpression(plan.expression, context), renderSourceQualifiedName(operation))}.Count`;
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
      const member = sanitizeIdentifier(plan.resolvedAliasName ?? rawMember);
      return `${renderExpressionWithUseSiteCast(
        plan.expression,
        context,
        receiverUseSiteType
      )}${plan.optionalAccess ? "?." : "."}${member}`;
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
        return `global::js.String.charAt(${renderExpressionWithUseSiteCast(plan.expression, context, effectiveReceiverUseSiteType(plan.expression, plan.receiverTypePlan, context))}, global::System.Convert.ToInt32(${index}))`;
      }
      if (
        plan.sourceOperation?.dispatch === "index" &&
        plan.sourceOperation.owner === "Array"
      ) {
        const rendered = renderArrayElementAccess(
          plan.expression,
          plan,
          context,
          effectiveReceiverUseSiteType(plan.expression, plan.receiverTypePlan, context)
        );
        if (rendered) return rendered;
      }
      if (
        plan.sourceOperation?.dispatch === "property" &&
        plan.sourceOperation.owner === "Object" &&
        plan.sourceOperation.member === "toStringTag"
      ) {
        return `${renderExpressionWithUseSiteCast(plan.expression, context, effectiveReceiverUseSiteType(plan.expression, plan.receiverTypePlan, context))}.__tsonic_symbol_toStringTag`;
      }
      const index = requiredRenderedCallArgument(
        plan,
        0,
        context,
        "element index expression"
      );
      if (!index) return "";
      if (
        runtimeUnionCarrierType(plan.receiverTypePlan, context) ||
        runtimeUnionCarrierType(plan.expression?.storageTypePlan, context) ||
        runtimeUnionCarrierType(plan.expression?.type, context)
      ) {
        const rendered = renderArrayElementAccess(
          plan.expression,
          plan,
          context,
          effectiveReceiverUseSiteType(plan.expression, plan.receiverTypePlan, context)
        );
        if (rendered) return rendered;
      }
      const arrayReceiverTypeOverride =
        arrayTypeFromUseSite(plan.receiverTypePlan) !== undefined
          ? plan.receiverTypePlan
          : arrayTypeFromUseSite(plan.expression?.storageTypePlan) !== undefined
            ? plan.expression?.storageTypePlan
            : arrayTypeFromUseSite(plan.expression?.type) !== undefined
              ? plan.expression?.type
              : undefined;
      if (arrayReceiverTypeOverride) {
        const rendered = renderArrayElementAccess(
          plan.expression,
          plan,
          context,
          arrayReceiverTypeOverride
        );
        if (rendered) return rendered;
      }
      const renderedIndex =
        arrayTypeFromUseSite(plan.receiverTypePlan) ||
        arrayTypeFromUseSite(plan.expression?.storageTypePlan) ||
        arrayTypeFromUseSite(plan.expression?.type) ||
        isStringLikeTypePlan(plan.receiverTypePlan) ||
        isStringLikeTypePlan(plan.expression?.storageTypePlan) ||
        isStringLikeTypePlan(plan.expression?.type)
          ? plan.arguments[0]
            ? renderArrayIndexExpression(plan.arguments[0], context)
            : index
          : index;
      return `${renderExpressionWithUseSiteCast(plan.expression, context, effectiveReceiverUseSiteType(plan.expression, plan.receiverTypePlan, context))}${plan.optionalAccess ? "?" : ""}[${renderedIndex}]`;
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
      {
        const parameterTypes = callExpressionParameterTypes(plan);
        return `${renderCallableExpression(plan.expression, plan.arguments.length, context, plan.callTargetTypePlan)}${renderTypeArguments(plan.typeArguments, context)}(${plan.arguments
          .map((argument, index) =>
            renderCallArgument(argument, context, parameterTypes[index])
          )
          .join(", ")})`;
      }
    case "new":
      {
        const sourceRuntimeNew = renderSourceRuntimeNew(plan, context);
        if (sourceRuntimeNew !== undefined) return sourceRuntimeNew;
      }
      return `new ${renderRequiredCSharpType(
        plan.storageTypePlan ?? plan.type,
        context,
        "constructor target type",
        plan.sourceKindName,
        plan.sourceText
      )}(${plan.arguments
        .map((argument, index) =>
          renderCallArgument(
            argument,
            context,
            plan.argumentUseSiteTypes?.[index]
          )
        )
        .join(", ")})`;
    case "arrow-function":
    case "function-expression":
      return renderLambda(plan, context);
    case "array-literal":
      return renderArrayLiteral(plan, context);
    case "object-literal":
      return renderObjectLiteral(plan, context);
    case "conditional": {
      const branchUseSiteType = plan.contextualTypePlan ?? plan.type;
      return `${renderConditionExpression(plan.condition, context)} ? ${renderExpressionWithUseSiteCast(
        plan.whenTrue,
        context,
        branchUseSiteType
      )} : ${renderExpressionWithUseSiteCast(
        plan.whenFalse,
        context,
        branchUseSiteType
      )}`;
    }
    case "unsupported":
      return unsupportedExpression(context, plan);
  }
};

const isBooleanConditionType = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type !== undefined &&
  ((type.kind === "intrinsic" && type.name === "boolean") ||
    (type.kind === "source-primitive" && type.fact.kind === "bool") ||
    (type.kind === "literal" && type.literalKind === "boolean"));

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

const sourcePrimitiveUsesNumberTruthiness = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "source-primitive" &&
  (type.fact.runtimeBase === "number" || type.fact.runtimeBase === "decimal");

const sourcePrimitiveUsesStringTruthiness = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "source-primitive" && type.fact.runtimeBase === "string";

const sourcePrimitiveUsesBigIntTruthiness = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "source-primitive" && type.fact.runtimeBase === "bigint";

const renderNumberTruthiness = (
  rendered: string,
  type: LoweringTypeRefPlan | undefined
): string => {
  if (
    type?.kind === "source-primitive" &&
    (type.fact.kind === "float32" || type.fact.kind === "float64")
  ) {
    const runtime = type.fact.kind === "float32" ? "float" : "double";
    return `(${rendered}) != 0 && !${runtime}.IsNaN(${rendered})`;
  }
  if (type?.kind === "intrinsic" && type.name === "number") {
    return `(${rendered}) != 0 && !double.IsNaN(${rendered})`;
  }
  return `(${rendered}) != 0`;
};

const renderRuntimeTruthinessSwitch = (rendered: string): string =>
  `((object?)(${rendered})) switch { null => false, bool __truthy => __truthy, string __truthy => __truthy.Length != 0, char _ => true, sbyte __truthy => __truthy != 0, byte __truthy => __truthy != 0, short __truthy => __truthy != 0, ushort __truthy => __truthy != 0, int __truthy => __truthy != 0, uint __truthy => __truthy != 0, long __truthy => __truthy != 0, ulong __truthy => __truthy != 0, nint __truthy => __truthy != 0, nuint __truthy => __truthy != 0, float __truthy => __truthy != 0 && !float.IsNaN(__truthy), double __truthy => __truthy != 0 && !double.IsNaN(__truthy), decimal __truthy => __truthy != 0, global::System.Numerics.BigInteger __truthy => __truthy != global::System.Numerics.BigInteger.Zero, _ => true }`;

export const renderConditionExpression = (
  plan: LoweringExpressionPlan | undefined,
  context: RenderContext
): string => {
  if (!plan) return "";
  const rendered = renderExpression(plan, context);
  const type = plan.storageTypePlan ?? plan.type;
  if (isBooleanConditionType(type)) return rendered;
  if (type?.kind === "literal") {
    switch (type.literalKind) {
      case "null":
      case "undefined":
        return "false";
      case "string":
        return `!global::System.String.IsNullOrEmpty(${rendered})`;
      case "number":
        return renderNumberTruthiness(rendered, type);
      case "bigint":
        return `(${rendered}) != global::System.Numerics.BigInteger.Zero`;
      case "boolean":
        return rendered;
    }
  }
  if (isStringLikeTypePlan(type) || sourcePrimitiveUsesStringTruthiness(type)) {
    return `!global::System.String.IsNullOrEmpty(${rendered})`;
  }
  if (
    (type?.kind === "intrinsic" && type.name === "number") ||
    sourcePrimitiveUsesNumberTruthiness(type)
  ) {
    return renderNumberTruthiness(rendered, type);
  }
  if (
    (type?.kind === "intrinsic" && type.name === "bigint") ||
    sourcePrimitiveUsesBigIntTruthiness(type)
  ) {
    return `(${rendered}) != global::System.Numerics.BigInteger.Zero`;
  }
  const carrier =
    runtimeUnionCarrierType(plan.storageTypePlan, context) ??
    runtimeUnionCarrierType(type, context);
  if (carrier) {
    return renderRuntimeTruthinessSwitch(`${rendered}.Value`);
  }
  return needsNullishConditionCheck(type)
    ? `${rendered} != null`
    : renderRuntimeTruthinessSwitch(rendered);
};
