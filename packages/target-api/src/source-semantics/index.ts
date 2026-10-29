export * from "./target-source-program.js";
export type { SourceTypeArgumentBinding } from "./type-arguments.js";
export type {
  SourceStructuralMember, SourceStructuralMemberPair, SourceStructuralTypeMembers,
  SourceStructuralMemberCorrespondence,
} from "./structural-members.js";
export {
  sourceTypeSyntaxIsCompositional,
  sourceTypeSyntaxRoot,
} from "./type-syntax.js";
export {
  orderEnumerableOwnStringProperties,
} from "./enumerable-own-properties.js";
export {
  selectSourceObjectLiteralAccessors,
} from "./object-literal-accessors.js";
export {
  sourceCallableUsesLexicalThis,
  sourceExpressionUsesLexicalThis,
} from "./lexical-this.js";
export type {
  SourceObjectLiteralAccessorMember,
  SourceObjectLiteralAccessorOccurrence,
  SourceObjectLiteralAccessorSelection,
} from "./object-literal-accessors.js";
export type {
  SourceCallParameterSlot,
} from "./call-parameter-slots.js";
export {
  sourcePropertyTypeEvidenceNodes,
  sourceIndexedTypeEvidence,
  sourceTransformedTypeFactEvidenceNodes,
  sourceTupleElementTypeEvidenceNodes,
} from "./type-component-evidence.js";
export type {
  ResolvedSourceCallInfo,
  SourceCallResultSelection,
} from "./call-result-selection.js";
export type {
  SourceContextualTupleLiteralSelection,
  SourceAuthoredOccurrence,
  SourceDocument,
  SourceFactSubjectQueries,
  SourceFileSemantics,
  SourceFinalTypeQueries,
  SourceOccurrence,
  SourceOccurrenceLookup,
  SourceOperationEvidenceQueries,
  SourceProgramSemantics,
  SourceProgramDocuments,
  SourceSelectedDeclarationQueries,
  SourceSyntheticOccurrence,
  SourceCallableTypeEvidence,
  SourceCallableParameterEvidence,
  SourceStandardTypeTransformation,
  SourceTypeComponentEvidence,
  SourceValueTypeRefinementSelection,
  TargetSourceProgram,
} from "./types.js";
export type { SourceAuthoredTypeSelection } from "./authored-type-selection.js";
export type { SourceContextualValueTypeSelection } from "./contextual-type-selection.js";
export type { SourceTypeRelationship } from "./type-relationship.js";
export type { SourceTypeRefinement } from "./type-refinement.js";
export { createSourceDiagnosticSpanReader } from "./diagnostic-spans.js";
export { analyzeSourceEnumConstants, selectSourceEnumIntegerWidth } from "../target-analysis/enum-constants.js";
export type {
  SourceEnumConstantIndex, SourceEnumConstantSelection, SourceEnumIntegerWidthSelection, SourceEnumAdmissionIssue,
} from "../target-analysis/enum-constants.js";
export { analyzeSourcePropertyNames } from "../target-analysis/property-names.js";
export type { SourcePropertyNameIndex, SourcePropertyNameSelection, SourcePropertyNameConstant } from "../target-analysis/property-names.js";
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
export { sourceBoundTypeRelationship } from "./bound-type-relationship.js";
export { sourceCallableInterface } from "./callable-interfaces.js";
export { sourceInterfaceRepresentationBase } from "./interface-representations.js";
export { sourceArrayElementType } from "./array-types.js";
export { sourceCallableParameterEvidence } from "./callable-parameters.js";
export { sourcePresentCallableType } from "./present-callables.js";
export { selectSourceGuardedValueMembers, selectSourceGuardedTypeMembers, selectSourceNativeGuardResult } from "../target-analysis/value-flow-conditions.js";
export { selectedSourcePropertyDeclarations } from "./selected-property-declarations.js";
export { selectedSourceIndexedDeclarations } from "./selected-indexed-declarations.js";
export { sourceObjectLiteralDestinationMember } from "./object-literal-correspondence.js";
export { sourceTypeIsAuthoredEmptyObject } from "./empty-object-evidence.js";
export type { SourceNativeGuard, SourceValueFlowQueryContext, SourceGuardedValueProof, SourceGuardedValueSelection } from "../target-analysis/value-flow-conditions.js";
export { selectSourceNativeValueGuard } from "./native-value-guards.js";
export { sourceNodeIsNativeUnreachable } from "../target-analysis/native-control-flow.js";
export type { SourceNativeValueGuard } from "./native-value-guards.js";
