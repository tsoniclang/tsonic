import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { isAssignable } from "./index.js";
import { resolveComparableType } from "./comparable-types.js";
import {
  isDefinitelyValueType,
  splitRuntimeNullishUnionMembers,
} from "./type-resolution.js";
import { unwrapParameterModifierType } from "./parameter-modifier-types.js";

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

  if (isAssignable(actualComparableType, expectedComparableType)) {
    return true;
  }

  return (
    stableIrTypeKey(resolveComparableType(actualComparableType, context)) ===
    stableIrTypeKey(resolveComparableType(expectedComparableType, context))
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
