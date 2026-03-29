import { IrExpression, IrParameter, IrType } from "../../../../types.js";
export {
  OVERLOAD_IMPL_PREFIX,
  getOverloadImplementationName,
  buildPublicOverloadFamilyMember,
  buildImplementationOverloadFamilyMember,
} from "../overload-family-builders.js";
import { typesEqualForIsType } from "./overload-specialization.js";

export const getIdentifierPatternName = (parameter: IrParameter): string => {
  if (parameter.pattern.kind !== "identifierPattern") {
    throw new Error(
      `ICE: overload wrappers currently require identifier parameters (got '${parameter.pattern.kind}')`
    );
  }

  return parameter.pattern.name;
};

const isSuperMemberCall = (expression: IrExpression): boolean =>
  expression.kind === "call" &&
  expression.callee.kind === "memberAccess" &&
  expression.callee.object.kind === "identifier" &&
  expression.callee.object.name === "super";

export const substitutePolymorphicReturn = (
  expression: IrExpression,
  implReturnType: IrType | undefined,
  wrapperReturnType: IrType | undefined,
  selectedRuntimeUnionMembers?: readonly number[]
): IrExpression => {
  if (!wrapperReturnType) {
    return expression;
  }

  if (isSuperMemberCall(expression)) {
    return {
      kind: "typeAssertion",
      expression,
      targetType: wrapperReturnType,
      inferredType: wrapperReturnType,
      ...(selectedRuntimeUnionMembers
        ? { selectedRuntimeUnionMembers }
        : {}),
      sourceSpan: expression.sourceSpan,
    };
  }

  if (
    implReturnType &&
    typesEqualForIsType(implReturnType, wrapperReturnType)
  ) {
    return {
      ...expression,
      inferredType: wrapperReturnType,
    };
  }

  return {
    kind: "typeAssertion",
    expression,
    targetType: wrapperReturnType,
    inferredType: wrapperReturnType,
    ...(selectedRuntimeUnionMembers ? { selectedRuntimeUnionMembers } : {}),
    sourceSpan: expression.sourceSpan,
  };
};
