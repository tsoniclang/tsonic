import type {
  IrFunctionDeclaration,
  IrMethodDeclaration,
  IrOverloadFamilyMember,
  IrOverloadOwnerKind,
} from "../../../types.js";

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

export const buildPublicOverloadFamilyMember = (opts: {
  readonly ownerKind: IrOverloadOwnerKind;
  readonly publicName: string;
  readonly isStatic: boolean;
  readonly signatureIndex: number;
  readonly publicSignatureCount: number;
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
    publicSignatureIndex: opts.signatureIndex,
    publicSignatureCount: opts.publicSignatureCount,
  };
  return overloadFamily;
};
