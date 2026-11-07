export {
  sourcePrimitiveBindingId,
  tsonicCoreLangModule,
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
  tsonicCoreTypesModule,
  tsonicCoreVirtualModulesProviderId,
} from "../identity.js";
export { tsonicAttributeBuilderFactKey } from "../attributes/facts.js";
export { createTsonicAttributeApplicationFactIndex } from "../attributes/application-index.js";
export type { TsonicAttributeApplicationFactIndex } from "../attributes/application-index.js";
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
export { tsonicCompileTimeFactKey } from "../compile-time/facts.js";
export type { TsonicCompileTimeFact } from "../compile-time/facts.js";
export {
  isTsonicFixedArrayProviderType,
  tsonicFixedArrayProviderIds,
  tsonicFixedArrayProviderMember,
} from "../fixed-arrays/provider.js";
export type { TsonicFixedArrayProviderMember } from "../fixed-arrays/provider.js";
// Memory and pointer facts reach targets only as Host records (I1, K-2662): the Legacy witness keys, fact types and
// readers are source-core-internal. The data layout fact is checker-free (ABI identity and descriptor values).
export { tsonicDataLayoutFactKey, dataLayoutsEqual } from "../memory-layout/facts.js";
export type { TsonicDataLayoutDescriptor, TsonicDataLayoutIdentity, TsonicDataLayoutRegistration } from "@tsonic/target-api/provider";
export type { TsonicDataLayoutFact } from "../memory-layout/facts.js";
export type { TsonicAddressIntegerDomain } from "../pointers/raw-memory/facts.js";
export { countTsonicMemoryLayoutRecordValues } from "../analysis/host-records.js";
export type {
  TsonicRejectedRecord, TsonicTypedOperand, TsonicMemoryFixedArrayRecord, TsonicMemoryFieldRecord,
  TsonicValueMemoryLayoutRecord, TsonicArrayMemoryLayoutRecord, TsonicMemoryLayoutRecord, TsonicRawLocationRecord,
  TsonicReinterpretRecord, TsonicRawAddressRecord, TsonicLayoutObservationRecord, TsonicKeepAliveRecord, TsonicMemoryFacts,
  TsonicMemoryFieldBindingRecord, TsonicMemoryRecordBindingRecord, TsonicMemoryBindings, TsonicPointerViewRecord,
  TsonicNativePointerRecord, TsonicPointerFacts, TsonicRawAddressRejection, TsonicNativePointerRejection,
} from "../analysis/host-records.js";
export type {
  TsonicPointerStorageOperation, TsonicPointerStorageProducer, TsonicPointerStorageIssue,
  TsonicPointerStorageSelection, TsonicPointerStorageRelation,
} from "../pointers/storage-relation.js";
export type { TsonicClosedArrayStorage } from "../pointers/backing/array-storage.js";
export type { TsonicPointerReturnEvidence, TsonicPointerReturnQueries } from "../pointers/return-evidence.js";
export { foldTsonicProviderPointerResult } from "../pointers/provider-return-evidence.js";
export type { TsonicProviderPointerResult, TsonicProviderPointerCarrierPolicy, TsonicProviderPointerSelection,
  TsonicProviderPointerShape } from "../pointers/provider-return-evidence.js";
// Program analyses are published as facts.analyses.extension(tsonicCoreAnalysisKey); their factories are Host-internal.
export { tsonicCoreAnalysisKey, tsonicClosedArrayStorageValueBudget } from "../analysis/host-analyses.js";
export type { TsonicCoreSourceAnalyses } from "../analysis/host-analyses.js";
export type { TsonicMemoryMetadata, TsonicMemoryMetadataIndex } from "../memory-layout/metadata-index.js";
export type {
  TsonicPointerBackingOrigin, TsonicPointerBackingIssue,
  TsonicPointerBackingResolution, TsonicPointerBackingQueries,
} from "../pointers/backing/requirements.js";
