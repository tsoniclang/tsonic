export type {
  SourceFrontend,
  SourceFrontendEngine,
  SourceProgramBuildOptions,
  SourceTranspiler,
  SourceTranspileOptions,
  SourceTranspileResult,
} from "./source-frontend.js";
export { createSourceSemanticFactStore } from "./semantic-view.js";
export {
  extensionReceiverSemanticsFactKey,
  fieldSemanticsFactKey,
  heritageWrapperSemanticsFactKey,
  intrinsicSemanticsFactKey,
  markerApiSemanticsFactKey,
  numericPrimitiveFactKey,
  parameterPassingFactKey,
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
export type {
  SourceSemanticEngine,
  SourceSemanticFactKey,
  SourceSemanticFactStore,
  SourceSemanticView,
} from "./semantic-view.js";
export type {
  TstsSourceCallLikeExpression,
  TstsSourceSemanticView,
} from "./tsts-semantic-view.js";
export { createTstsSemanticView } from "./tsts-semantic-view.js";
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
