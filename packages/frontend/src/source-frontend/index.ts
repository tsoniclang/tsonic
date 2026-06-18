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
  sourceInitializerReferencesDeclarationFactKey,
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
  SourceInitializerReferencesDeclarationFact,
  SourceTypeSemanticsFact,
} from "./source-facts.js";
export {
  isExtensionReceiverFact,
  isFieldSemanticsFact,
  isHeritageInterfaceErasure,
  isIntrinsicKind,
  isMarkerApiKind,
  isSourceTypeKind,
  markerApiKindFromFact,
} from "./source-fact-queries.js";
export {
  createEmptyTstsSourceProgramForTests,
  createTstsSourceProgram,
} from "./tsts-source-program.js";
export type {
  CreateTstsSourceProgramOptions,
  TstsSourceProgram,
} from "./tsts-source-program.js";
