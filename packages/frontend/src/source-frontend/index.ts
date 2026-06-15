export type {
  SourceFrontend,
  SourceFrontendEngine,
  SourceProgramBuildOptions,
} from "./source-frontend.js";
export {
  extensionReceiverSemanticsFactKey,
  fieldSemanticsFactKey,
  heritageWrapperSemanticsFactKey,
  intrinsicSemanticsFactKey,
  markerApiSemanticsFactKey,
  numericPrimitiveFactKey,
  parameterPassingFactKey,
  sourceAttributeApplicationsFactKey,
  sourceAttributeDescriptorFactKey,
  sourceBindingIdentityFactKey,
  sourceTypeSemanticsFactKey,
  visitSourceSemanticFactKeys,
} from "./source-facts.js";
export {
  getSourcePrimitiveFact,
  getSourcePrimitiveNames,
} from "./source-primitive-taxonomy.js";
export {
  CORE_LANG_MODULE_SPECIFIERS,
  CORE_PACKAGE_NAME,
  CORE_TYPES_MODULE_SPECIFIERS,
  GLOBALS_PACKAGE_NAME,
  coreDeclarationFileBaseName,
  canonicalCoreModuleSpecifier,
} from "./core-module-identity.js";
export type { CoreModule } from "./core-module-identity.js";
export type { SourceSemanticFactKey } from "./source-facts.js";
export type {
  ExtensionReceiverSemanticsFact,
  FieldSemanticsFact,
  HeritageWrapperSemanticsFact,
  IntrinsicSemanticsFact,
  MarkerApiSemanticsFact,
  NumericPrimitiveFact,
  NumericPrimitiveKind,
  NumericPrimitiveRuntimeBase,
  ParameterPassingFact,
  ParameterPassingMode,
  SourceAttributeApplicationFact,
  SourceAttributeApplicationsFact,
  SourceAttributeDescriptorFact,
  SourceAttributeTargetKind,
  SourceAttributeTargetSpecifier,
  SourceBindingDeclarationKind,
  SourceBindingIdentityFact,
  SourceTypeSemanticsFact,
} from "./source-facts.js";
export {
  callSitePassingModifierFromFact,
  isExtensionReceiverFact,
  isFieldStorageFact,
  isHeritageInterfaceErasure,
  isIntrinsicKind,
  isMarkerApiKind,
  isSourceTypeKind,
  markerApiKindFromFact,
  parameterPassingModeFromFact,
} from "./source-fact-queries.js";
export type {
  SourceCallSitePassingModifier,
  SourceParameterPassingMode,
} from "./source-fact-queries.js";
export { createTstsSourceFrontend } from "./tsts-source-frontend.js";
export {
  createEmptyTstsSourceProgramForTests,
  createTstsSourceProgram,
} from "./tsts-source-program.js";
export type {
  CreateTstsSourceProgramOptions,
  TstsSourceProgram,
} from "./tsts-source-program.js";
