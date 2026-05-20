import type {
  IrClassMember,
  IrInterfaceMember,
  IrParameter,
  IrType,
} from "@tsonic/frontend";
import type { EmitterContext, LocalTypeInfo } from "../../types.js";
import { matchesExpectedEmissionType } from "./expected-type-matching.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";

const parameterTypesMatch = (
  sourceParameter: IrParameter,
  targetParameter: IrParameter,
  context: EmitterContext
): boolean => {
  if (
    sourceParameter.isOptional !== targetParameter.isOptional ||
    sourceParameter.isRest !== targetParameter.isRest ||
    sourceParameter.passing !== targetParameter.passing
  ) {
    return false;
  }

  if (!sourceParameter.type || !targetParameter.type) {
    return sourceParameter.type === targetParameter.type;
  }

  return (
    areIrTypesEquivalent(sourceParameter.type, targetParameter.type, context) ||
    matchesExpectedEmissionType(sourceParameter.type, targetParameter.type, context)
  );
};

const returnTypesMatch = (
  sourceReturnType: IrType | undefined,
  targetReturnType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!sourceReturnType || !targetReturnType) {
    return sourceReturnType === targetReturnType;
  }

  return (
    areIrTypesEquivalent(sourceReturnType, targetReturnType, context) ||
    matchesExpectedEmissionType(sourceReturnType, targetReturnType, context)
  );
};

export const interfaceMembersMatchStructurally = (
  sourceMember: IrInterfaceMember,
  targetMember: IrInterfaceMember,
  context: EmitterContext
): boolean => {
  if (sourceMember.kind !== targetMember.kind) {
    return false;
  }

  if (sourceMember.kind === "propertySignature") {
    return (
      sourceMember.name === targetMember.name &&
      targetMember.kind === "propertySignature" &&
      (areIrTypesEquivalent(sourceMember.type, targetMember.type, context) ||
        matchesExpectedEmissionType(sourceMember.type, targetMember.type, context))
    );
  }

  if (
    targetMember.kind !== "methodSignature" ||
    sourceMember.name !== targetMember.name ||
    sourceMember.parameters.length !== targetMember.parameters.length
  ) {
    return false;
  }

  return (
    sourceMember.parameters.every((sourceParameter, index) => {
      const targetParameter = targetMember.parameters[index];
      return (
        targetParameter !== undefined &&
        parameterTypesMatch(sourceParameter, targetParameter, context)
      );
    }) &&
    returnTypesMatch(sourceMember.returnType, targetMember.returnType, context)
  );
};

export const classMemberMatchesInterfaceMemberStructurally = (
  sourceMember: IrClassMember,
  targetMember: IrInterfaceMember,
  context: EmitterContext
): boolean => {
  if (
    sourceMember.kind === "methodDeclaration" &&
    targetMember.kind === "methodSignature"
  ) {
    return (
      !sourceMember.isStatic &&
      sourceMember.name === targetMember.name &&
      sourceMember.parameters.length === targetMember.parameters.length &&
      sourceMember.parameters.every((sourceParameter, index) => {
        const targetParameter = targetMember.parameters[index];
        return (
          targetParameter !== undefined &&
          parameterTypesMatch(sourceParameter, targetParameter, context)
        );
      }) &&
      returnTypesMatch(sourceMember.returnType, targetMember.returnType, context)
    );
  }

  if (
    sourceMember.kind === "propertyDeclaration" &&
    targetMember.kind === "propertySignature"
  ) {
    return (
      !sourceMember.isStatic &&
      sourceMember.name === targetMember.name &&
      !!sourceMember.type &&
      (areIrTypesEquivalent(sourceMember.type, targetMember.type, context) ||
        matchesExpectedEmissionType(sourceMember.type, targetMember.type, context))
    );
  }

  return false;
};

export const localInfoHasStructuralMember = (
  localInfo: Extract<LocalTypeInfo, { kind: "class" | "interface" }>,
  targetMember: IrInterfaceMember,
  context: EmitterContext
): boolean => {
  if (localInfo.kind === "interface") {
    return localInfo.members.some((sourceMember) =>
      interfaceMembersMatchStructurally(sourceMember, targetMember, context)
    );
  }

  return localInfo.members.some((sourceMember) =>
    classMemberMatchesInterfaceMemberStructurally(
      sourceMember,
      targetMember,
      context
    )
  );
};

export const structuralMemberListsMatch = (
  sourceMembers: readonly IrInterfaceMember[] | undefined,
  targetMembers: readonly IrInterfaceMember[],
  context: EmitterContext
): boolean =>
  !!sourceMembers?.length &&
  targetMembers.every((targetMember) =>
    sourceMembers.some((sourceMember) =>
      interfaceMembersMatchStructurally(sourceMember, targetMember, context)
    )
  );
