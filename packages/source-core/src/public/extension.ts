export {
  nativePointerOperationProviderDeclarations,
  nativePointerProviderDeclaration,
} from "../pointers/provider-declarations.js";
export {
  safetyProviderDeclarations,
  unsafeContextProviderDeclaration,
} from "../safety/declarations.js";
export {
  providerCallMarkerDeclaration,
  providerExportDeclarationsForSemanticsModule,
  providerExportDeclarationsForSourceModule,
  providerPrimitiveDeclaration,
  providerTypeMarkerDeclaration,
  tsonicSourceMarkerSignatureIds,
} from "../providers/declarations.js";
export { createSourceSemanticsVirtualModuleProvider } from "../extension/semantics-virtual-modules.js";
export type {
  SourceSemanticsProviderDiagnosticIdentity,
  SourceSemanticsVirtualModuleProviderOptions,
} from "../extension/semantics-virtual-modules.js";
export type { TsonicCoreSourceExtensionOptions } from "../host-input/source-extension.js";
export { memoryOperationDeclarations, memoryTypeDeclarations, tsonicMemorySignatureIds, tsonicMemoryTypeExports } from "../memory-layout/declarations.js";
export { pointerViewDeclaration, tsonicPointerViewSignatureIds } from "../pointers/views/declarations.js";
export type { TsonicDataLayoutRegistration } from "@tsonic/target-api/provider";
export {
  attributeBuilderDeclaration, attributeMemberBuilderDeclaration, tsonicAttributeBuilderMemberIds,
  tsonicAttributeBuilderSignatureIds,
} from "../attributes/provider-declarations.js";
