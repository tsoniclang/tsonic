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
export type {
  TsonicAttributeApplicationFact,
  TsonicAttributeApplicationMemberKind,
  TsonicAttributeApplicationPlacement,
  TsonicAttributeBuilderFact,
  TsonicAttributeBuilderStateFact,
} from "./attribute-builder-facts.js";
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
