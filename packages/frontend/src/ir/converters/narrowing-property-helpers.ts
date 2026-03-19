import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import { normalizedUnionType } from "../types/type-ops.js";
import type { BoundDecl } from "./narrowing-resolvers.js";

export const getCurrentTypeForDecl = (
  declId: BoundDecl,
  ctx: ProgramContext
): IrType => ctx.typeEnv?.get(declId.id) ?? ctx.typeSystem.typeOfValueRead(declId);

const getMemberTypeForNarrowing = (
  type: IrType,
  propertyName: string,
  ctx: ProgramContext
): IrType | undefined => {
  if (type.kind === "objectType") {
    const member = type.members.find(
      (candidate) =>
        candidate.kind === "propertySignature" &&
        candidate.name === propertyName
    );
    return member?.kind === "propertySignature" ? member.type : undefined;
  }

  if (
    type.kind === "referenceType" &&
    type.structuralMembers &&
    type.structuralMembers.length > 0
  ) {
    const member = type.structuralMembers.find(
      (candidate) =>
        candidate.kind === "propertySignature" &&
        candidate.name === propertyName
    );
    return member?.kind === "propertySignature" ? member.type : undefined;
  }

  const memberType = ctx.typeSystem.typeOfMember(type, {
    kind: "byName",
    name: propertyName,
  });
  return memberType.kind === "unknownType" ? undefined : memberType;
};

const collectPropertyNarrowingCandidates = (
  currentType: IrType,
  ctx: ProgramContext
): readonly IrType[] => {
  const expanded = ctx.typeSystem.collectNarrowingCandidates(currentType);
  return expanded.length > 0 ? expanded : [currentType];
};

export const narrowTypeByPropertyPresence = (
  currentType: IrType,
  propertyName: string,
  wantPresent: boolean,
  ctx: ProgramContext
): IrType | undefined => {
  const kept = collectPropertyNarrowingCandidates(currentType, ctx).filter(
    (member): member is IrType => {
      const hasMember =
        member !== undefined &&
        getMemberTypeForNarrowing(member, propertyName, ctx) !== undefined;
      return hasMember === wantPresent;
    }
  );

  if (kept.length === 0) return undefined;
  if (kept.length === 1) return kept[0];
  return normalizedUnionType(kept);
};

export const narrowTypeByPropertyTruthiness = (
  currentType: IrType,
  propertyName: string,
  wantTruthy: boolean,
  ctx: ProgramContext
): IrType | undefined => {
  const kept = collectPropertyNarrowingCandidates(currentType, ctx).filter(
    (member): member is IrType => {
      if (!member) return false;
      const memberType = getMemberTypeForNarrowing(member, propertyName, ctx);
      if (!memberType || memberType.kind !== "literalType") {
        return false;
      }
      return wantTruthy ? memberType.value === true : memberType.value === false;
    }
  );

  if (kept.length === 0) return undefined;
  if (kept.length === 1) return kept[0];
  return normalizedUnionType(kept);
};
