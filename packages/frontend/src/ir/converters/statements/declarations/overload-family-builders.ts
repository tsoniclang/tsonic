import type {
  IrFunctionDeclaration,
  IrMethodDeclaration,
  IrOverloadFamilyMember,
  IrOverloadOwnerKind,
} from "../../../types.js";

export const OVERLOAD_IMPL_PREFIX = "__tsonic_overload_impl_";

export const getOverloadImplementationName = (memberName: string): string =>
  `${OVERLOAD_IMPL_PREFIX}${memberName}`;

const buildOverloadFamilyId = (
  ownerKind: IrOverloadOwnerKind,
  publicName: string,
  isStatic: boolean
): string => {
  if (ownerKind === "method" || ownerKind === "constructor") {
    return `${ownerKind}:${isStatic ? "static" : "instance"}:${publicName}`;
  }
  return `${ownerKind}:${publicName}`;
};

const buildPublicOverloadMemberId = (
  familyId: string,
  signatureIndex: number
): string => `${familyId}:public:${signatureIndex}`;

const buildImplementationOverloadMemberId = (familyId: string): string =>
  `${familyId}:implementation`;

export const buildPublicOverloadFamilyMember = (opts: {
  readonly ownerKind: IrOverloadOwnerKind;
  readonly publicName: string;
  readonly isStatic: boolean;
  readonly signatureIndex: number;
  readonly publicSignatureCount: number;
  readonly implementationName?: string;
}):
  | NonNullable<IrMethodDeclaration["overloadFamily"]>
  | NonNullable<IrFunctionDeclaration["overloadFamily"]> => {
  const familyId = buildOverloadFamilyId(
    opts.ownerKind,
    opts.publicName,
    opts.isStatic
  );
  const overloadFamily: IrOverloadFamilyMember = {
    familyId,
    memberId: buildPublicOverloadMemberId(familyId, opts.signatureIndex),
    ownerKind: opts.ownerKind,
    publicName: opts.publicName,
    isStatic: opts.isStatic,
    role: "publicOverload",
    publicSignatureIndex: opts.signatureIndex,
    publicSignatureCount: opts.publicSignatureCount,
    implementationName: opts.implementationName,
  };
  return overloadFamily;
};

export const buildImplementationOverloadFamilyMember = (opts: {
  readonly ownerKind: IrOverloadOwnerKind;
  readonly publicName: string;
  readonly isStatic: boolean;
  readonly publicSignatureCount: number;
  readonly implementationName: string;
}):
  | NonNullable<IrMethodDeclaration["overloadFamily"]>
  | NonNullable<IrFunctionDeclaration["overloadFamily"]> => {
  const familyId = buildOverloadFamilyId(
    opts.ownerKind,
    opts.publicName,
    opts.isStatic
  );
  const overloadFamily: IrOverloadFamilyMember = {
    familyId,
    memberId: buildImplementationOverloadMemberId(familyId),
    ownerKind: opts.ownerKind,
    publicName: opts.publicName,
    isStatic: opts.isStatic,
    role: "implementation",
    publicSignatureCount: opts.publicSignatureCount,
    implementationName: opts.implementationName,
  };
  return overloadFamily;
};
