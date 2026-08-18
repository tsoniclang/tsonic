import type {
  ProviderDeclarationIdentity,
} from "@tsonic/tsts";
import {
  tsonicCoreProviderVersion,
  tsonicCoreTypesModule,
  tsonicCoreVirtualModulesProviderId,
} from "./identity.js";

export const tsonicFixedArrayProviderIds = Object.freeze({
  exportId: "FixedArray",
  indexMemberId: "FixedArray.index",
  indexSignatureId: "FixedArray.index(number)",
  lengthMemberId: "FixedArray.length",
  iteratorMemberId: "FixedArray.iterator",
  iteratorSignatureId: "FixedArray.iterator()",
});

export type TsonicFixedArrayProviderMember = "index" | "length" | "iterator";

export function tsonicFixedArrayProviderMember(
  identity: ProviderDeclarationIdentity | undefined,
): TsonicFixedArrayProviderMember | undefined {
  if (
    identity === undefined ||
    identity.providerId !== tsonicCoreVirtualModulesProviderId ||
    identity.providerVersion !== tsonicCoreProviderVersion ||
    identity.providerModuleId !== tsonicCoreTypesModule ||
    identity.moduleSpecifier !== tsonicCoreTypesModule ||
    identity.exportId !== tsonicFixedArrayProviderIds.exportId
  ) {
    return undefined;
  }
  if (
    identity.memberId === tsonicFixedArrayProviderIds.indexMemberId &&
    (
      identity.signatureId === undefined ||
      identity.signatureId === tsonicFixedArrayProviderIds.indexSignatureId
    )
  ) {
    return "index";
  }
  if (
    identity.memberId === tsonicFixedArrayProviderIds.lengthMemberId &&
    identity.signatureId === undefined
  ) {
    return "length";
  }
  if (
    identity.memberId === tsonicFixedArrayProviderIds.iteratorMemberId &&
    (
      identity.signatureId === undefined ||
      identity.signatureId === tsonicFixedArrayProviderIds.iteratorSignatureId
    )
  ) {
    return "iterator";
  }
  return undefined;
}
