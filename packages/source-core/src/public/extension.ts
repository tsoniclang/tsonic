export { analyzeNativePointerOperations } from "../pointers/operations.js";
export type { NativePointerOperationAnalysisContract } from "../pointers/operations.js";
export {
  forEachSelectedProviderSourceCall,
  selectedProviderCallMatches,
} from "../analysis/source-call.js";
export type {
  ProviderSourceCallSelector,
  SelectedProviderSourceCall,
} from "../analysis/source-call.js";
export type { TsonicSourceFileAnalysisContext } from "../analysis/context.js";
export { analyzeSafetyBuilderCalls } from "../safety/builder-analysis.js";
export type { SafetyBuilderAnalysisContract } from "../safety/builder-analysis.js";
export { analyzeUnsafeContextCalls } from "../safety/unsafe-context-analysis.js";
export type { UnsafeContextAnalysisContract } from "../safety/unsafe-context-analysis.js";
export {
  nativePointerOperationProviderDeclarations,
  nativePointerProviderDeclaration,
} from "../pointers/provider-declarations.js";
export {
  safetyProviderDeclarations,
  unsafeContextProviderDeclaration,
} from "../safety/declarations.js";
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
} from "../providers/declarations.js";
export { createSourceSemanticsVirtualModuleProvider } from "../extension/semantics-virtual-modules.js";
export type {
  SourceSemanticsProviderDiagnosticIdentity,
  SourceSemanticsVirtualModuleProviderOptions,
} from "../extension/semantics-virtual-modules.js";
export type { TsonicCoreSourceExtensionOptions } from "../extension/source-extension.js";
export { memoryOperationDeclarations, memoryTypeDeclarations, tsonicMemorySignatureIds, tsonicMemoryTypeExports } from "../memory-layout/declarations.js";
export type { TsonicDataLayoutRegistration } from "../memory-layout/facts.js";
