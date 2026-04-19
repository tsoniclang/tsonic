import { IrType, stableIrTypeKey } from "@tsonic/frontend";
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

const hasRuntimeNullishBranch = (type: IrType): boolean =>
  splitRuntimeNullishUnionMembers(unwrapParameterModifierType(type) ?? type)
    ?.hasRuntimeNullish ?? false;

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
  const resolvedActualComparableType = resolveComparableType(
    actualComparableType,
    context
  );
  const resolvedExpectedComparableType = resolveComparableType(
    expectedComparableType,
    context
  );

  if (
    isAssignable(actualComparableType, expectedComparableType) ||
    isAssignable(
      resolvedActualComparableType,
      resolvedExpectedComparableType
    ) ||
    runtimeUnionMemberCanAcceptValue(
      expectedComparableType,
      actualComparableType,
      context
    ) ||
    runtimeUnionMemberCanAcceptValue(
      resolvedExpectedComparableType,
      resolvedActualComparableType,
      context
    )
  ) {
    return true;
  }

  return (
    stableIrTypeKey(resolvedActualComparableType) ===
    stableIrTypeKey(resolvedExpectedComparableType)
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
