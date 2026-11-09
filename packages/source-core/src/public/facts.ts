export {
  sourcePrimitiveBindingId,
  tsonicCoreLangModule,
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
  tsonicCoreTypesModule,
  tsonicCoreVirtualModulesProviderId,
} from "../identity.js";
export {
  sourceNativePointerSignatureIds,
  tsonicCoreNativePointerProviderNames,
} from "../pointers/provider-declarations.js";
export type { SourceNativePointerProviderNames } from "../pointers/provider-declarations.js";
export {
  sourceSafetySignatureIds,
  tsonicCoreSafetyProviderNames,
} from "../safety/declarations.js";
export type { SourceSafetyProviderNames } from "../safety/declarations.js";
export {
  isTsonicFixedArrayProviderType,
  tsonicFixedArrayProviderIds,
  tsonicFixedArrayProviderMember,
} from "../fixed-arrays/provider.js";
export type { TsonicFixedArrayProviderMember } from "../fixed-arrays/provider.js";
export type { TsonicDataLayoutDescriptor, TsonicDataLayoutIdentity, TsonicDataLayoutRegistration } from "@tsonic/target-api/provider";
