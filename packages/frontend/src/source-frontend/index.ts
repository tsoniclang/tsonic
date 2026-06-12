export type {
  SourceFrontend,
  SourceFrontendEngine,
  SourceProgramBuildOptions,
  SourceTranspiler,
  SourceTranspileOptions,
  SourceTranspileResult,
} from "./source-frontend.js";
export {
  createSourceSemanticFactStore,
  defineSourceSemanticFactKey,
} from "./semantic-view.js";
export {
  extensionReceiverSemanticsFactKey,
  fieldSemanticsFactKey,
  heritageWrapperSemanticsFactKey,
  intrinsicSemanticsFactKey,
  markerApiSemanticsFactKey,
  numericPrimitiveFactKey,
  parameterPassingFactKey,
  sourceTypeSemanticsFactKey,
} from "./source-facts.js";
export {
  getSourcePrimitiveFact,
  getSourcePrimitiveNames,
} from "./source-primitive-taxonomy.js";
export type {
  SourceSemanticEngine,
  SourceSemanticFactKey,
  SourceSemanticFactStore,
  SourceSemanticView,
} from "./semantic-view.js";
export type {
  FrontendSourceCallLikeExpression,
  FrontendSourceSemanticView,
} from "./frontend-source-semantic-view.js";
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
  IrCallSitePassingModifier,
  IrParameterPassingMode,
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
export { projectTstsFactsToTypeScriptSource } from "./tsts-fact-projection.js";
export type {
  TstsFactProjectionMiss,
  TstsFactProjectionMissReason,
  TstsFactProjectionResult,
} from "./tsts-fact-projection.js";
export { createTypeScriptSemanticView } from "./typescript-semantic-view.js";
