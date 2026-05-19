import type { IrExpression, IrType } from "@tsonic/frontend";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import {
  getPropertyType,
  resolveTypeAlias,
  stripNullish,
} from "./type-resolution.js";
import type { EmitterContext } from "../../types.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import { getCanonicalRuntimeUnionMembers } from "./runtime-union-frame.js";
import { collectRuntimeUnionRawMembers } from "./runtime-union-expansion.js";
import { getRuntimeUnionReferenceMembers } from "./runtime-union-shared.js";
import { isAssignable, isAssignableToType } from "./type-compatibility.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import { tryContextualTypeIdentityKey } from "./deterministic-type-keys.js";
import {
  getRuntimeUnionAliasReferenceKey,
  runtimeUnionAliasReferencesMatch,
} from "./runtime-union-alias-identity.js";

const withOptionalUndefined = (type: IrType): IrType => {
  if (
    type.kind === "unionType" &&
    type.types.some(
      (member) => member.kind === "primitiveType" && member.name === "undefined"
    )
  ) {
    return type;
  }

  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

const maybeWrapOptionalMemberAccessType = (
  expr: IrExpression,
  type: IrType | undefined
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  if (expr.kind !== "memberAccess" || !expr.isOptional) {
    return type;
  }

  return withOptionalUndefined(type);
};

const unwrapProjectionAst = (
  exprAst: CSharpExpressionAst
): CSharpExpressionAst => {
  let target: CSharpExpressionAst = exprAst;
  while (
    target.kind === "parenthesizedExpression" ||
    target.kind === "castExpression"
  ) {
    target = target.expression;
  }
  return target;
};

const tryResolveIdentifierExpressionType = (
  identifier: string,
  context: EmitterContext
): IrType | undefined => {
  const direct = context.localSemanticTypes?.get(identifier);
  if (direct) {
    return direct;
  }

  for (const [sourceName, emittedName] of context.localNameMap ?? []) {
    if (emittedName === identifier) {
      return context.localSemanticTypes?.get(sourceName);
    }
  }

  return undefined;
};

const selectIdentifierSemanticType = (
  registeredType: IrType | undefined,
  inferredType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!registeredType) {
    return inferredType;
  }

  if (!inferredType) {
    return registeredType;
  }

  if (inferredType.kind === "anyType" || inferredType.kind === "unknownType") {
    return registeredType;
  }

  const registeredBase = stripNullish(registeredType);
  const inferredBase = stripNullish(inferredType);
  const isTypeParameterLike = (type: IrType): boolean =>
    type.kind === "typeParameterType" ||
    (type.kind === "referenceType" &&
      (context.typeParameters?.has(type.name) ?? false) &&
      (!type.typeArguments || type.typeArguments.length === 0));
  if (
    isTypeParameterLike(inferredBase) &&
    !isTypeParameterLike(registeredBase)
  ) {
    return registeredType;
  }

  const equivalent =
    areIrTypesEquivalent(inferredBase, registeredBase, context) ||
    areIrTypesEquivalent(
      resolveTypeAlias(inferredBase, context),
      resolveTypeAlias(registeredBase, context),
      context
    );
  if (equivalent) {
    return registeredType;
  }

  if (
    isAssignableToType(registeredBase, inferredBase, context) &&
    !isAssignableToType(inferredBase, registeredBase, context)
  ) {
    return registeredType;
  }

  return inferredType;
};

const runtimeCarrierFamilyForType = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "unionType") {
    return undefined;
  }

  if (resolved.runtimeCarrierFamilyKey) {
    return resolved.runtimeCarrierFamilyKey;
  }

  const canonicalMembers =
    getCanonicalRuntimeUnionMembers(resolved, context) ?? resolved.types;
  const memberKeys = canonicalMembers.map((member) =>
    tryContextualTypeIdentityKey(member, context)
  );
  if (memberKeys.some((key) => key === undefined)) {
    return undefined;
  }

  const orderedKeys =
    resolved.runtimeUnionLayout === "carrierSlotOrder"
      ? memberKeys
      : [...memberKeys].sort();
  return `runtime-union:${
    resolved.runtimeUnionLayout === "carrierSlotOrder"
      ? "carrier-slots"
      : "canonical"
  }:${orderedKeys.join("|")}`;
};

const projectionCarrierTypesMatch = (
  baseType: IrType,
  receiverType: IrType,
  context: EmitterContext
): boolean => {
  const baseFamily = runtimeCarrierFamilyForType(baseType, context);
  const receiverFamily = runtimeCarrierFamilyForType(receiverType, context);
  if (baseFamily || receiverFamily) {
    return baseFamily !== undefined && baseFamily === receiverFamily;
  }

  return areIrTypesEquivalent(
    stripNullish(baseType),
    stripNullish(receiverType),
    context
  );
};

const tryResolveProjectionReceiverType = (
  receiverAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const receiver = unwrapProjectionAst(receiverAst);
  if (receiver.kind !== "identifierExpression") {
    return undefined;
  }

  return tryResolveIdentifierExpressionType(receiver.identifier, context);
};

const sourceMemberMatchesNarrowedType = (
  sourceMember: IrType,
  narrowedType: IrType,
  context: EmitterContext
): boolean => {
  const strippedSourceMember = stripNullish(sourceMember);
  const strippedNarrowedType = stripNullish(narrowedType);
  const resolvedSourceMember = resolveTypeAlias(strippedSourceMember, context);
  const resolvedNarrowedType = resolveTypeAlias(strippedNarrowedType, context);

  return (
    runtimeUnionAliasReferencesMatch(
      strippedSourceMember,
      strippedNarrowedType,
      context
    ) ||
    runtimeUnionAliasReferencesMatch(
      resolvedSourceMember,
      resolvedNarrowedType,
      context
    ) ||
    areIrTypesEquivalent(strippedSourceMember, strippedNarrowedType, context) ||
    areIrTypesEquivalent(resolvedSourceMember, resolvedNarrowedType, context)
  );
};

const resolveSingleMatchingSourceMemberN = (
  sourceType: IrType | undefined,
  narrowedType: IrType | undefined,
  context: EmitterContext
): number | undefined => {
  if (!sourceType || !narrowedType) {
    return undefined;
  }

  const resolvedSource = resolveTypeAlias(stripNullish(sourceType), context);
  if (resolvedSource.kind !== "unionType") {
    return undefined;
  }

  const matchingMemberNs = resolvedSource.types.flatMap(
    (sourceMember, index) =>
      sourceMemberMatchesNarrowedType(sourceMember, narrowedType, context)
        ? [index + 1]
        : []
  );

  return matchingMemberNs.length === 1 ? matchingMemberNs[0] : undefined;
};

const tryExtractRuntimeUnionProjection = (
  exprAst: CSharpExpressionAst
):
  | { readonly memberN: number; readonly receiverAst?: CSharpExpressionAst }
  | undefined => {
  const target = unwrapProjectionAst(exprAst);
  if (target.kind !== "invocationExpression") {
    return undefined;
  }
  if (target.expression.kind !== "memberAccessExpression") {
    return undefined;
  }

  if (target.arguments.length === 0) {
    const match = target.expression.memberName.match(/^As(\d+)$/);
    if (!match?.[1]) {
      return undefined;
    }

    return {
      memberN: Number.parseInt(match[1], 10),
      receiverAst: target.expression.expression,
    };
  }

  if (target.expression.memberName !== "Match") {
    return undefined;
  }

  let projectedMemberIndex: number | undefined;

  for (let index = 0; index < target.arguments.length; index += 1) {
    const lambda = target.arguments[index];
    if (!lambda || lambda.kind !== "lambdaExpression") {
      return undefined;
    }

    const parameterName = lambda.parameters[0]?.name;
    if (!parameterName) {
      return undefined;
    }

    let body = lambda.body;
    while (
      body.kind === "parenthesizedExpression" ||
      body.kind === "castExpression"
    ) {
      body = body.expression;
    }

    if (
      body.kind === "identifierExpression" &&
      body.identifier === parameterName
    ) {
      if (projectedMemberIndex !== undefined) {
        return undefined;
      }
      projectedMemberIndex = index + 1;
      continue;
    }

    if (body.kind === "throwExpression") {
      continue;
    }

    return undefined;
  }

  return projectedMemberIndex
    ? {
        memberN: projectedMemberIndex,
        receiverAst: target.expression.expression,
      }
    : undefined;
};

const isNullishFallbackAst = (exprAst: CSharpExpressionAst): boolean => {
  const target = unwrapProjectionAst(exprAst);
  return (
    target.kind === "nullLiteralExpression" ||
    target.kind === "defaultExpression"
  );
};

const projectedMemberTypesMatch = (
  left: IrType,
  right: IrType,
  context: EmitterContext
): boolean =>
  runtimeUnionAliasReferencesMatch(left, right, context) ||
  areIrTypesEquivalent(left, right, context);

const selectNullableProjectedMemberType = (
  leftAst: CSharpExpressionAst,
  leftType: IrType | undefined,
  rightAst: CSharpExpressionAst,
  rightType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (leftType && rightType) {
    return projectedMemberTypesMatch(leftType, rightType, context)
      ? leftType
      : undefined;
  }

  if (leftType && isNullishFallbackAst(rightAst)) {
    return leftType;
  }

  if (rightType && isNullishFallbackAst(leftAst)) {
    return rightType;
  }

  return undefined;
};

export const tryResolveRuntimeUnionMemberType = (
  baseType: IrType | undefined,
  exprAst: CSharpExpressionAst,
  context: EmitterContext,
  options: { readonly verifyReceiver?: boolean } = {}
): IrType | undefined => {
  if (!baseType) return undefined;

  const projection = tryExtractRuntimeUnionProjection(exprAst);
  if (!projection) {
    const target = unwrapProjectionAst(exprAst);
    if (target.kind === "binaryExpression" && target.operatorToken === "??") {
      const leftType = tryResolveRuntimeUnionMemberType(
        baseType,
        target.left,
        context,
        options
      );
      const rightType = tryResolveRuntimeUnionMemberType(
        baseType,
        target.right,
        context,
        options
      );
      return selectNullableProjectedMemberType(
        target.left,
        leftType,
        target.right,
        rightType,
        context
      );
    }

    if (target.kind === "conditionalExpression") {
      const whenTrueType = tryResolveRuntimeUnionMemberType(
        baseType,
        target.whenTrue,
        context,
        options
      );
      const whenFalseType = tryResolveRuntimeUnionMemberType(
        baseType,
        target.whenFalse,
        context,
        options
      );
      return selectNullableProjectedMemberType(
        target.whenTrue,
        whenTrueType,
        target.whenFalse,
        whenFalseType,
        context
      );
    }

    return undefined;
  }

  const receiverType = projection.receiverAst
    ? tryResolveProjectionReceiverType(projection.receiverAst, context)
    : undefined;
  if (
    options.verifyReceiver !== false &&
    receiverType &&
    !projectionCarrierTypesMatch(baseType, receiverType, context)
  ) {
    return undefined;
  }

  const { memberN } = projection;
  const rawRuntimeMembers = collectRuntimeUnionRawMembers(baseType, context);
  const rawRuntimeMember =
    memberN >= 1 ? rawRuntimeMembers[memberN - 1] : undefined;
  if (
    rawRuntimeMember &&
    getRuntimeUnionAliasReferenceKey(rawRuntimeMember, context)
  ) {
    return rawRuntimeMember;
  }

  const canonicalRuntimeMembers = getCanonicalRuntimeUnionMembers(
    baseType,
    context
  );
  if (
    canonicalRuntimeMembers &&
    memberN >= 1 &&
    memberN <= canonicalRuntimeMembers.length
  ) {
    return canonicalRuntimeMembers[memberN - 1];
  }

  const resolvedBase = resolveTypeAlias(stripNullish(baseType), context);
  if (resolvedBase.kind === "unionType") {
    return resolvedBase.types[memberN - 1];
  }

  if (resolvedBase.kind === "referenceType") {
    const runtimeMembers = getRuntimeUnionReferenceMembers(resolvedBase);
    if (runtimeMembers && memberN <= runtimeMembers.length) {
      return runtimeMembers[memberN - 1];
    }
  }

  return undefined;
};

export const resolveRuntimeSubsetMemberNs = (
  expr: IrExpression,
  context: EmitterContext
): ReadonlySet<number> | undefined => {
  const narrowKey =
    expr.kind === "identifier"
      ? expr.name
      : expr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(expr)
        : undefined;
  if (!narrowKey) {
    return undefined;
  }

  const narrowed = context.narrowedBindings?.get(narrowKey);
  if (narrowed?.kind === "runtimeSubset") {
    return new Set(narrowed.runtimeMemberNs);
  }

  if (narrowed?.kind !== "expr") {
    return undefined;
  }

  const sourceType =
    narrowed.sourceType ??
    (expr.kind === "identifier"
      ? context.localSemanticTypes?.get(expr.name)
      : undefined) ??
    expr.inferredType;
  const matchingSourceMemberN = resolveSingleMatchingSourceMemberN(
    sourceType,
    narrowed.type,
    context
  );
  if (matchingSourceMemberN !== undefined) {
    return new Set([matchingSourceMemberN]);
  }

  const projection = tryExtractRuntimeUnionProjection(narrowed.exprAst);
  if (!projection) {
    return undefined;
  }

  const receiverType = projection.receiverAst
    ? tryResolveProjectionReceiverType(projection.receiverAst, context)
    : undefined;
  if (
    sourceType &&
    receiverType &&
    !projectionCarrierTypesMatch(sourceType, receiverType, context)
  ) {
    return undefined;
  }

  return new Set([projection.memberN]);
};

export const resolveEffectiveExpressionType = (
  expr: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind === "typeAssertion" || expr.kind === "asinterface") {
    return expr.targetType;
  }

  if (expr.kind === "trycast") {
    return expr.targetType;
  }

  if (expr.kind === "defaultof") {
    return expr.targetType;
  }

  if (expr.kind === "logical" && expr.operator === "??") {
    const leftType =
      resolveEffectiveExpressionType(expr.left, context) ??
      expr.left.inferredType;
    const rightType =
      resolveEffectiveExpressionType(expr.right, context) ??
      expr.right.inferredType;

    if (!leftType) {
      return rightType;
    }

    const nonNullishLeft = stripNullish(leftType) ?? leftType;
    if (!rightType) {
      return nonNullishLeft;
    }

    if (areIrTypesEquivalent(nonNullishLeft, rightType, context)) {
      return nonNullishLeft;
    }

    if (isAssignable(rightType, nonNullishLeft)) {
      return nonNullishLeft;
    }

    if (isAssignable(nonNullishLeft, rightType)) {
      return rightType;
    }
  }

  const baseType = expr.inferredType;
  const registeredSemanticType =
    expr.kind === "identifier"
      ? context.localSemanticTypes?.get(expr.name)
      : undefined;
  const identifierSemanticType = selectIdentifierSemanticType(
    registeredSemanticType,
    baseType,
    context
  );
  if (!context.narrowedBindings) {
    if (
      expr.kind === "memberAccess" &&
      !expr.isComputed &&
      typeof expr.property === "string"
    ) {
      const narrowedReceiverType = resolveEffectiveExpressionType(
        expr.object,
        context
      );
      const narrowedPropertyType = getPropertyType(
        narrowedReceiverType,
        expr.property,
        context
      );
      if (narrowedPropertyType) {
        return maybeWrapOptionalMemberAccessType(expr, narrowedPropertyType);
      }
    }
    return maybeWrapOptionalMemberAccessType(expr, identifierSemanticType);
  }

  const narrowKey =
    expr.kind === "identifier"
      ? expr.name
      : expr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(expr)
        : undefined;

  if (!narrowKey) {
    if (
      expr.kind === "memberAccess" &&
      !expr.isComputed &&
      typeof expr.property === "string"
    ) {
      const narrowedReceiverType = resolveEffectiveExpressionType(
        expr.object,
        context
      );
      const narrowedPropertyType = getPropertyType(
        narrowedReceiverType,
        expr.property,
        context
      );
      if (narrowedPropertyType) {
        return maybeWrapOptionalMemberAccessType(expr, narrowedPropertyType);
      }
    }
    return maybeWrapOptionalMemberAccessType(expr, identifierSemanticType);
  }

  const narrowed = context.narrowedBindings.get(narrowKey);
  if (!narrowed) {
    if (
      expr.kind === "memberAccess" &&
      !expr.isComputed &&
      typeof expr.property === "string"
    ) {
      const narrowedReceiverType = resolveEffectiveExpressionType(
        expr.object,
        context
      );
      const narrowedPropertyType = getPropertyType(
        narrowedReceiverType,
        expr.property,
        context
      );
      if (narrowedPropertyType) {
        return maybeWrapOptionalMemberAccessType(expr, narrowedPropertyType);
      }
    }
    return maybeWrapOptionalMemberAccessType(
      expr,
      registeredSemanticType ?? baseType
    );
  }

  if (
    narrowed.kind === "rename" ||
    narrowed.kind === "expr" ||
    narrowed.kind === "runtimeSubset"
  ) {
    const sourceType =
      narrowed.sourceType ?? registeredSemanticType ?? baseType;
    const resolvedSource =
      narrowed.kind === "expr"
        ? tryResolveRuntimeUnionMemberType(
            sourceType,
            narrowed.exprAst,
            context
          )
        : undefined;

    if (narrowed.type) {
      return maybeWrapOptionalMemberAccessType(expr, narrowed.type);
    }

    if (resolvedSource) {
      return maybeWrapOptionalMemberAccessType(expr, resolvedSource);
    }
  }

  if (
    expr.kind === "memberAccess" &&
    !expr.isComputed &&
    typeof expr.property === "string"
  ) {
    const narrowedReceiverType = resolveEffectiveExpressionType(
      expr.object,
      context
    );
    const narrowedPropertyType = getPropertyType(
      narrowedReceiverType,
      expr.property,
      context
    );
    if (narrowedPropertyType) {
      return maybeWrapOptionalMemberAccessType(expr, narrowedPropertyType);
    }
  }

  return maybeWrapOptionalMemberAccessType(expr, identifierSemanticType);
};
