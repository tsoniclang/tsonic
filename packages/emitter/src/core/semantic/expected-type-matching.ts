import { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { isAssignable } from "./index.js";
import { resolveComparableType } from "./comparable-types.js";
import {
  isDefinitelyValueType,
  splitRuntimeNullishUnionMembers,
} from "./type-resolution.js";
import { unwrapParameterModifierType } from "./parameter-modifier-types.js";
import { getRuntimeUnionAliasReferenceKey } from "./runtime-union-alias-identity.js";
import { runtimeUnionMemberCanAcceptValue } from "./runtime-union-matching.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import {
  referenceTypeHasClrIdentity,
  typesHaveDeterministicIdentityConflict,
} from "./clr-type-identity.js";

const BROAD_OBJECT_OR_JS_VALUE_CLR_NAMES = new Set([
  "System.Object",
  "global::System.Object",
  "Tsonic.Runtime.JsValue",
  "global::Tsonic.Runtime.JsValue",
]);

const hasRuntimeNullishBranch = (type: IrType): boolean =>
  splitRuntimeNullishUnionMembers(unwrapParameterModifierType(type) ?? type)
    ?.hasRuntimeNullish ?? false;

const isSystemObjectOrJsValueReference = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  (type.name === "object" ||
    type.name === "JsValue" ||
    referenceTypeHasClrIdentity(type, BROAD_OBJECT_OR_JS_VALUE_CLR_NAMES));

const isBroadObjectEmissionSink = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveComparableType(type, context);
  if (resolved.kind === "anyType" || resolved.kind === "unknownType") {
    return true;
  }

  if (isSystemObjectOrJsValueReference(resolved)) {
    return true;
  }

  if (resolved.kind !== "unionType") {
    return false;
  }

  const nonNullishMembers = splitRuntimeNullishUnionMembers(resolved)
    ?.nonNullishMembers;
  const members = nonNullishMembers ?? resolved.types;
  return (
    members.length > 0 &&
    members.every((member) =>
      isBroadObjectEmissionSink(member, context)
    )
  );
};

export const requiresValueTypeMaterialization = (
  actualType: IrType,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  if (
    !hasRuntimeNullishBranch(actualType) ||
    hasRuntimeNullishBranch(expectedType)
  ) {
    return false;
  }

  const resolvedExpected = resolveComparableType(expectedType, context);
  return isDefinitelyValueType(resolvedExpected);
};

const matchesRawSemanticComparableTypes = (
  actualComparableType: IrType,
  expectedComparableType: IrType,
  context: EmitterContext
): boolean =>
  isAssignable(actualComparableType, expectedComparableType) ||
  runtimeUnionMemberCanAcceptValue(
    expectedComparableType,
    actualComparableType,
    context
  ) ||
  areIrTypesEquivalent(actualComparableType, expectedComparableType, context);

export const matchesRawSemanticExpectedType = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!actualType || !expectedType) {
    return false;
  }

  const actualComparableType =
    unwrapParameterModifierType(actualType) ?? actualType;
  const expectedComparableType =
    unwrapParameterModifierType(expectedType) ?? expectedType;
  if (
    typesHaveDeterministicIdentityConflict(
      actualComparableType,
      expectedComparableType
    )
  ) {
    return false;
  }

  return matchesRawSemanticComparableTypes(
    actualComparableType,
    expectedComparableType,
    context
  );
};

export const matchesSemanticExpectedType = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!actualType || !expectedType) {
    return false;
  }

  const actualComparableType =
    unwrapParameterModifierType(actualType) ?? actualType;
  const expectedComparableType =
    unwrapParameterModifierType(expectedType) ?? expectedType;
  if (
    typesHaveDeterministicIdentityConflict(
      actualComparableType,
      expectedComparableType
    )
  ) {
    return false;
  }

  const resolvedActualComparableType = resolveComparableType(
    actualComparableType,
    context
  );
  const resolvedExpectedComparableType = resolveComparableType(
    expectedComparableType,
    context
  );

  if (
    matchesRawSemanticComparableTypes(
      actualComparableType,
      expectedComparableType,
      context
    ) ||
    isAssignable(
      resolvedActualComparableType,
      resolvedExpectedComparableType
    ) ||
    runtimeUnionMemberCanAcceptValue(
      resolvedExpectedComparableType,
      resolvedActualComparableType,
      context
    )
  ) {
    return true;
  }

  return areIrTypesEquivalent(
    resolvedActualComparableType,
    resolvedExpectedComparableType,
    context
  );
};

export const matchesExpectedEmissionType = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!actualType || !expectedType) {
    return false;
  }

  const actualComparableType =
    unwrapParameterModifierType(actualType) ?? actualType;
  const expectedComparableType =
    unwrapParameterModifierType(expectedType) ?? expectedType;

  const actualAliasKey =
    getRuntimeUnionAliasReferenceKey(actualComparableType, context) ??
    getRuntimeUnionAliasReferenceKey(
      resolveComparableType(actualComparableType, context),
      context
    );
  const expectedAliasKey =
    getRuntimeUnionAliasReferenceKey(expectedComparableType, context) ??
    getRuntimeUnionAliasReferenceKey(
      resolveComparableType(expectedComparableType, context),
      context
    );
  if (
    actualAliasKey &&
    actualAliasKey !== expectedAliasKey &&
    !isBroadObjectEmissionSink(expectedComparableType, context)
  ) {
    return false;
  }
  if (expectedAliasKey && actualAliasKey !== expectedAliasKey) {
    return false;
  }

  if (
    requiresValueTypeMaterialization(
      actualComparableType,
      expectedComparableType,
      context
    )
  ) {
    return false;
  }

  return matchesSemanticExpectedType(
    actualComparableType,
    expectedComparableType,
    context
  );
};
