import type {
  DecodeBodyId, DecodeComponentId, DecodeDefId, DecodeGroupId, DecodeModuleId,
  DecodePackageId, EncodeBodyId, EncodeComponentId, EncodeDefId, EncodeGroupId,
  EncodeKey, EncodeModuleId, EncodePackageId,
} from "./contract.js";
import {
  decodeBodyIdentity, decodeComponentIdentity, decodeDefinitionIdentity,
  decodeGroupIdentity, decodeModuleIdentity, decodePackageIdentity,
  encodeBodyIdentity, encodeComponentIdentity, encodeDefinitionIdentity,
  encodeGroupIdentity, encodeModuleIdentity, encodePackageIdentity,
} from "./identity.js";
import { encodeCanonicalKey } from "./key.js";

export const encodeKey: EncodeKey = encodeCanonicalKey;
export const encodePackageId: EncodePackageId = encodePackageIdentity;
export const decodePackageId: DecodePackageId = decodePackageIdentity;
export const encodeModuleId: EncodeModuleId = encodeModuleIdentity;
export const decodeModuleId: DecodeModuleId = decodeModuleIdentity;
export const encodeDefId: EncodeDefId = encodeDefinitionIdentity;
export const decodeDefId: DecodeDefId = decodeDefinitionIdentity;
export const encodeBodyId: EncodeBodyId = encodeBodyIdentity;
export const decodeBodyId: DecodeBodyId = decodeBodyIdentity;
export const encodeGroupId: EncodeGroupId = encodeGroupIdentity;
export const decodeGroupId: DecodeGroupId = decodeGroupIdentity;
export const encodeComponentId: EncodeComponentId = encodeComponentIdentity;
export const decodeComponentId: DecodeComponentId = decodeComponentIdentity;
