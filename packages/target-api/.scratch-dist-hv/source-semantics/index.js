export { sourceTypeDescriptorMemberOriginsEqual } from "./local-type-flow/member-origins.js";
export { sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue } from "./descriptor-model.js";
// R2 #18: the union builder and the substitution are not exported; Host packages use facts.sums (I6).
export { sourceTypeDescriptorHasTypeVariables } from "./local-type-flow/terms.js";
// The one present-arms / absence classifier (R2 #25), for Host packages (source-core, FX-CORE X1).
export { sourceTypeDescriptorArms, sourceTypeDescriptorIsAbsent, sourceTypeDescriptorIsAbsentArm, sourceTypeDescriptorIsNeverArm, sourceTypeDescriptorMayBeAbsent, sourceTypeDescriptorPresentArms, } from "./descriptor-arms.js";
export { sourceTypeSyntaxIsCompositional, sourceTypeSyntaxRoot, } from "./type-syntax.js";
export { orderEnumerableOwnStringProperties, } from "./enumerable-own-properties.js";
export { sourceCallableUsesLexicalThis, sourceExpressionUsesLexicalThis, } from "./lexical-this.js";
export { createSourceDiagnosticSpanReader } from "./diagnostic-spans.js";
export { sourceExpressionSequence } from "./expression-sequence.js";
export { sourceBooleanShortCircuitBranch } from "./boolean-short-circuit.js";
export { sourceIntegerTruncationFits } from "./integer-truncation.js";
export { sourceIntegerLiteralValue } from "./integer-literal.js";
export { createSourceIntegerConstantReader, sourceIntegerConstantValue } from "./integer-constant.js";
export { analyzeSourceLiteralValues } from "./literal-values.js";
export { compareSourceNumericLiteralMagnitude, sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat } from "./literal-token.js";
export { parseBigIntLiteral, parseFiniteNumberLiteral } from "./literal-text.js";
// Provider declaration facts only (source facts, no checker type): source-core provider-return evidence reads it (R-B4-10).
export { selectSourceProviderSignature } from "./provider-signature.js";
export { sourceInterfaceRepresentationBase } from "./interface-representations.js";
export { selectSourceGuardedValueMembers, selectSourceNativeGuardResult } from "./value-flow-conditions.js";
export { selectSourceNativeValueGuard } from "./native-value-guards.js";
export { sourceNodeIsNativeUnreachable } from "./native-control-flow.js";
//# sourceMappingURL=index.js.map