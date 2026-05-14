import type { IrType } from "./ir-types.js";

/**
 * Canonical overload-family metadata shared across lowered declarations and
 * serialized public surfaces.
 *
 * The ids here are deterministic within the declaration owner that carries the
 * family member. They are not backend/runtime names.
 */

export type IrOverloadOwnerKind = "function" | "method" | "constructor";

export type IrOverloadFamilyMember = {
  /**
   * Stable family identity within the containing declaration owner.
   *
   * Example:
   * - `method:instance:get`
   * - `method:static:parse`
   */
  readonly familyId: string;
  /**
   * Stable member identity within the containing declaration owner.
   *
   * Example:
   * - `method:instance:get:public:0`
   * - `method:instance:get:implementation`
   */
  readonly memberId: string;
  readonly ownerKind: IrOverloadOwnerKind;
  readonly publicName: string;
  readonly isStatic: boolean;
  readonly publicSignatureCount: number;
  readonly publicSignatureIndex: number;
};

export type IrOverloadFamily = {
  readonly familyId: string;
  readonly ownerKind: IrOverloadOwnerKind;
  readonly publicName: string;
  readonly publicMembers: readonly IrOverloadFamilyMember[];
  readonly hiddenImplementation?: IrOverloadFamilyMember;
  readonly modifiers?: readonly (
    | "override"
    | "abstract"
    | "virtual"
    | "static"
  )[];
  readonly resolutionMetadata: {
    readonly resolutionOrder: readonly string[];
    readonly genericConstraints?: Readonly<Record<string, IrType>>;
  };
};

export const getIrMemberPublicName = (member: {
  readonly name: string;
  readonly overloadFamily?: IrOverloadFamilyMember;
}): string => member.overloadFamily?.publicName ?? member.name;
