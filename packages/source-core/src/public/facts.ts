export {
  sourcePrimitiveBindingId,
  tsonicCoreLangModule,
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
  tsonicCoreTypesModule,
  tsonicCoreVirtualModulesProviderId,
} from "../identity.js";
export { tsonicAttributeBuilderFactKey } from "../attributes/facts.js";
export type {
  TsonicAttributeApplicationFact,
  TsonicAttributeApplicationMemberKind,
  TsonicAttributeApplicationPlacement,
  TsonicAttributeBuilderFact,
  TsonicAttributeBuilderStateFact,
} from "../attributes/facts.js";
export {
  sourceNativePointerSignatureIds,
  tsonicCoreNativePointerProviderNames,
} from "../pointers/provider-declarations.js";
export type { SourceNativePointerProviderNames } from "../pointers/provider-declarations.js";
export { tsonicNativePointerOperationFactKey } from "../pointers/facts.js";
export type { TsonicNativePointerOperationFact } from "../pointers/facts.js";
export {
  sourceSafetySignatureIds,
  tsonicCoreSafetyProviderNames,
} from "../safety/declarations.js";
export type { SourceSafetyProviderNames } from "../safety/declarations.js";
export {
  tsonicSafetyBuilderFactKey,
  tsonicUnsafeContextFactKey,
} from "../safety/facts.js";
export type {
  TsonicSafetyApplicationFact,
  TsonicSafetyApplicationPlacement,
  TsonicSafetyBuilderFact,
  TsonicSafetyBuilderStateFact,
  TsonicSafetyContract,
  TsonicSafetyMemberKind,
  TsonicUnsafeContextFact,
} from "../safety/facts.js";
export { tsonicFixedArrayFactKey } from "../fixed-arrays/facts.js";
export type { TsonicFixedArrayFact } from "../fixed-arrays/facts.js";
export { selectTsonicFixedArray, selectTsonicFixedArrayFromSource } from "../fixed-arrays/selection.js";
export type { TsonicFixedArraySelection, TsonicFixedArraySyntax } from "../fixed-arrays/selection.js";
export { tsonicCompileTimeFactKey } from "../compile-time/facts.js";
export type { TsonicCompileTimeFact } from "../compile-time/facts.js";
export {
  isTsonicFixedArrayProviderType,
  tsonicFixedArrayProviderIds,
  tsonicFixedArrayProviderMember,
} from "../fixed-arrays/provider.js";
export type { TsonicFixedArrayProviderMember } from "../fixed-arrays/provider.js";
export {
  tsonicDataLayoutFactKey, tsonicMemoryFieldLayoutFactKey,
  tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey,
} from "../memory-layout/facts.js";
export type {
  TsonicDataLayoutDescriptor, TsonicDataLayoutFact, TsonicDataLayoutIdentity,
  TsonicDataLayoutRegistration, TsonicMemoryFieldLayoutFact,
  TsonicMemoryLayoutFact, TsonicValueMemoryLayoutFact, TsonicArrayMemoryLayoutFact, TsonicMemoryLayoutQueryFact,
} from "../memory-layout/facts.js";
export { tsonicKeepAliveFactKey, tsonicRawMemoryOperationFactKey } from "../pointers/raw-memory/facts.js";
export type { TsonicAddressIntegerDomain, TsonicKeepAliveFact, TsonicRawMemoryOperationFact } from "../pointers/raw-memory/facts.js";
export {
  readTsonicDataLayout, readTsonicMemoryFieldLayout, readTsonicMemoryLayout,
  readTsonicMemoryLayoutQuery, readTsonicRawMemoryOperation, readTsonicKeepAlive,
  countTsonicMemoryLayoutValues,
} from "../memory-layout/readers.js";
export { createTsonicPointerBackingQueries } from "../pointers/backing/requirements.js";
export { createTsonicClosedArrayStorageQueries } from "../pointers/backing/array-storage.js";
export type { TsonicClosedArrayStorage } from "../pointers/backing/array-storage.js";
export { createTsonicPointerReturnQueries } from "../pointers/return-evidence.js";
export type { TsonicPointerReturnEvidence, TsonicPointerReturnQueries } from "../pointers/return-evidence.js";
export { selectTsonicRawLocationOperation } from "../pointers/raw-memory/selection.js";
export type { TsonicRawLocationSelection } from "../pointers/raw-memory/selection.js";
export { readTsonicMemoryType, tsonicMemoryTypeFactKey } from "../memory-layout/type-contract/facts.js";
export type { TsonicMemoryTypeFact, TsonicMemoryTypeIdentity } from "../memory-layout/type-contract/facts.js";
export { selectTsonicProviderPointerResult } from "../pointers/provider-return-evidence.js";
export type { TsonicProviderPointerResult, TsonicProviderPointerCarrierPolicy } from "../pointers/provider-return-evidence.js";
export { createTsonicPointerBackingDemands } from "../pointers/backing/demands.js";
export type { TsonicPointerBackingDemand, TsonicPointerBackingDemands } from "../pointers/backing/demands.js";
export { createTsonicMemoryMetadataIndex } from "../memory-layout/metadata-index.js";
export { resolveTsonicMemoryLayoutObservation } from "../memory-layout/readers.js";
export type { TsonicMemoryMetadata, TsonicMemoryMetadataIndex } from "../memory-layout/metadata-index.js";
export type {
  TsonicPointerBackingOrigin, TsonicPointerBackingIssue,
  TsonicPointerBackingResolution, TsonicPointerBackingQueries,
} from "../pointers/backing/requirements.js";
