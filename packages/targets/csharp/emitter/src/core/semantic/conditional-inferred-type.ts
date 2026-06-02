import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { matchesExpectedEmissionType } from "./expected-type-matching.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import { isAssignableToType } from "./type-compatibility.js";

const typeFitsInferredConditionalType = (
  actualType: IrType | undefined,
  inferredConditionalType: IrType,
  context: EmitterContext
): boolean =>
  !!actualType &&
  (areIrTypesEquivalent(actualType, inferredConditionalType, context) ||
    isAssignableToType(actualType, inferredConditionalType, context) ||
    matchesExpectedEmissionType(actualType, inferredConditionalType, context));

export const selectFrontendInferredConditionalType = (
  expression: Extract<IrExpression, { kind: "conditional" }>,
  context: EmitterContext
): IrType | undefined => {
  if (!expression.inferredType) {
    return undefined;
  }

  return typeFitsInferredConditionalType(
    expression.whenTrue.inferredType,
    expression.inferredType,
    context
  ) &&
    typeFitsInferredConditionalType(
      expression.whenFalse.inferredType,
      expression.inferredType,
      context
    )
    ? expression.inferredType
    : undefined;
};
