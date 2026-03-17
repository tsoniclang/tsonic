import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { isAssignable } from "./index.js";
import {
  isDefinitelyValueType,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
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
  if (!hasRuntimeNullishBranch(actualType) || hasRuntimeNullishBranch(expectedType)) {
    return false;
  }

  const resolvedExpected = resolveTypeAlias(
    stripNullish(unwrapParameterModifierType(expectedType) ?? expectedType),
    context
  );
  return isDefinitelyValueType(resolvedExpected);
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

  if (isAssignable(actualComparableType, expectedComparableType)) {
    return true;
  }

  return (
    stableIrTypeKey(
      resolveTypeAlias(stripNullish(actualComparableType), context)
    ) ===
    stableIrTypeKey(
      resolveTypeAlias(stripNullish(expectedComparableType), context)
    )
  );
};
