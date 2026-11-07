// Host-internal barrel of the Source services (exported from @tsonic/target-api/host for Host packages only).
// NOT a target surface: targets import @tsonic/target-api/source (public/source.ts), which exposes published facts only
// (I1). Nothing here reads the checker (I3): the checker views live in host-input and are never exported.
export type * from "./local-type-flow/types.js";
export { sourceTypeDescriptorMemberOriginsEqual } from "./local-type-flow/member-origins.js";
export { sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue,
  sourceTypeDescriptorSum, substituteSourceTypeDescriptor } from "./local-type-flow/terms.js";
export {
  sourceTypeSyntaxIsCompositional,
  sourceTypeSyntaxRoot,
} from "./type-syntax.js";
export {
  orderEnumerableOwnStringProperties,
} from "./enumerable-own-properties.js";
export {
  sourceCallableUsesLexicalThis,
  sourceExpressionUsesLexicalThis,
} from "./lexical-this.js";
export type {
  SourceAuthoredOccurrence,
  SourceDocument,
  SourceOccurrence,
  SourceOccurrenceLookup,
  SourceProgramDocuments,
  SourceSyntheticOccurrence,
  HostSourceProgram,
} from "./types.js";
export { createSourceDiagnosticSpanReader } from "./diagnostic-spans.js";
export { selectSourceEnumIntegerWidth } from "./enum-constants.js";
export type {
  SourceEnumConstantIndex, SourceEnumConstantSelection, SourceEnumIntegerWidthSelection, SourceEnumAdmissionIssue,
} from "./enum-model.js";
export type {
  SourcePropertyNameIndex, SourcePropertyNameSelection, SourcePropertyNameConstant, SourceWellKnownSymbolKind,
} from "./property-names-model.js";
export { sourceExpressionSequence } from "./expression-sequence.js";
export { sourceBooleanShortCircuitBranch } from "./boolean-short-circuit.js";
export type { SourceBooleanShortCircuitBranch } from "./boolean-short-circuit.js";
export { sourceIntegerTruncationFits } from "./integer-truncation.js";
export { sourceIntegerLiteralValue } from "./integer-literal.js";
export { createSourceIntegerConstantReader, sourceIntegerConstantValue } from "./integer-constant.js";
export { analyzeSourceLiteralValues } from "./literal-values.js";
export type { SourceLiteralForm, SourceLiteralIndex, SourceLiteralValue, SourceTextLiteralValue,
  SourceArrayLiteralValue, SourceScalarLiteralValue, SourceNumericLiteralValue,
  SourceNumericLiteralEvidence, SourceNumericLiteralToken } from "./literal-values-model.js";
export { compareSourceNumericLiteralMagnitude, sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat } from "./literal-token.js";
export { parseBigIntLiteral, parseFiniteNumberLiteral } from "./literal-text.js";
export type { SourceProviderSignatureSelection, SourceProviderTypeParameterSelection } from "./provider-signature.js";
// Provider declaration facts only (source facts, no checker type): source-core provider-return evidence reads it (R-B4-10).
export { selectSourceProviderSignature } from "./provider-signature.js";
export { sourceInterfaceRepresentationBase } from "./interface-representations.js";
export { selectSourceGuardedValueMembers, selectSourceNativeGuardResult } from "./value-flow-conditions.js";
export type { SourceFlowCondition, SourceFlowConditions, SourceNativeGuard, SourceValueFlowQueryContext } from "./value-flow-model.js";
export { selectSourceNativeValueGuard } from "./native-value-guards.js";
export { sourceNodeIsNativeUnreachable } from "./native-control-flow.js";
export type { SourceNativeValueGuard } from "./native-value-guards.js";
