export {
  sourcePrimitiveBindingId,
  tsonicCoreLangModule,
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
  tsonicCoreTypesModule,
  tsonicCoreVirtualModulesProviderId,
} from "./identity.js";
export {
  tsonicAttributeBuilderFactKey,
} from "./attribute-builder-facts.js";
export {
  nativePointerOperationProviderDeclarations,
  nativePointerProviderDeclaration,
  safetyProviderDeclarations,
  sourceNativePointerSignatureIds,
  sourceSafetySignatureIds,
  tsonicCoreNativePointerProviderNames,
  tsonicCoreSafetyProviderNames,
  unsafeContextProviderDeclaration,
} from "./explicit-safety-declarations.js";
export type {
  SourceNativePointerProviderNames,
  SourceSafetyProviderNames,
} from "./explicit-safety-declarations.js";
export {
  tsonicNativePointerOperationFactKey,
  tsonicSafetyBuilderFactKey,
  tsonicUnsafeContextFactKey,
} from "./explicit-safety-facts.js";
export {
  tsonicFixedArrayFactKey,
} from "./fixed-array-facts.js";
export type {
  TsonicFixedArrayFact,
} from "./fixed-array-facts.js";
export {
  tsonicFixedArrayProviderIds,
  tsonicFixedArrayProviderMember,
} from "./fixed-array-provider.js";
export type {
  TsonicFixedArrayProviderMember,
} from "./fixed-array-provider.js";
export type {
  TsonicNativePointerOperationFact,
  TsonicSafetyApplicationFact,
  TsonicSafetyApplicationPlacement,
  TsonicSafetyBuilderFact,
  TsonicSafetyBuilderStateFact,
  TsonicSafetyContract,
  TsonicSafetyMemberKind,
  TsonicUnsafeContextFact,
} from "./explicit-safety-facts.js";
export {
  analyzeNativePointerOperations,
} from "./native-pointer-operation-analysis.js";
export type {
  NativePointerOperationAnalysisContract,
} from "./native-pointer-operation-analysis.js";
export type {
  TsonicAttributeApplicationFact,
  TsonicAttributeApplicationMemberKind,
  TsonicAttributeApplicationPlacement,
  TsonicAttributeBuilderFact,
  TsonicAttributeBuilderStateFact,
} from "./attribute-builder-facts.js";
export {
  analyzeSafetyBuilderCalls,
} from "./safety-builder-analysis.js";
export type {
  SafetyBuilderAnalysisContract,
} from "./safety-builder-analysis.js";
export {
  analyzeUnsafeContextCalls,
} from "./unsafe-context-analysis.js";
export type {
  UnsafeContextAnalysisContract,
} from "./unsafe-context-analysis.js";
export {
  attributeBuilderDeclaration,
  attributeMemberBuilderDeclaration,
  providerCallMarkerDeclaration,
  providerExportDeclarationsForSemanticsModule,
  providerExportDeclarationsForSourceModule,
  providerPrimitiveDeclaration,
  providerTypeMarkerDeclaration,
  tsonicAttributeBuilderMemberIds,
  tsonicAttributeBuilderSignatureIds,
  tsonicSourceMarkerSignatureIds,
} from "./provider-declarations.js";
export {
  createSourceSemanticsVirtualModuleProvider,
} from "./semantics-virtual-modules.js";
export type {
  SourceSemanticsProviderDiagnosticIdentity,
  SourceSemanticsVirtualModuleProviderOptions,
} from "./semantics-virtual-modules.js";
export { createTsonicCoreSourceExtension } from "./source-extension.js";
export { tsonicCoreSourceSemanticsModules } from "./source-modules.js";
export { createTsonicCoreVirtualModulesProvider } from "./virtual-modules.js";
