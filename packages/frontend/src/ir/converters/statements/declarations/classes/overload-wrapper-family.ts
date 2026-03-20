import {
  IrExpression,
  IrMethodDeclaration,
  IrParameter,
  IrType,
} from "../../../../types.js";
import { typesEqualForIsType } from "./overload-specialization.js";

export const OVERLOAD_IMPL_PREFIX = "__tsonic_overload_impl_";

export const getOverloadImplementationName = (memberName: string): string =>
  `${OVERLOAD_IMPL_PREFIX}${memberName}`;

export const buildPublicOverloadFamilyMember = (
  memberName: string,
  signatureIndex: number,
  publicSignatureCount: number,
  implementationName?: string
): NonNullable<IrMethodDeclaration["overloadFamily"]> => ({
  ownerKind: "method",
  publicName: memberName,
  role: "publicOverload",
  publicSignatureIndex: signatureIndex,
  publicSignatureCount,
  implementationName,
});

export const buildImplementationOverloadFamilyMember = (
  memberName: string,
  publicSignatureCount: number,
  implementationName: string
): NonNullable<IrMethodDeclaration["overloadFamily"]> => ({
  ownerKind: "method",
  publicName: memberName,
  role: "implementation",
  publicSignatureCount,
  implementationName,
});

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
  wrapperReturnType: IrType | undefined
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
    sourceSpan: expression.sourceSpan,
  };
};
