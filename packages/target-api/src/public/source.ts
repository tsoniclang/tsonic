// @tsonic/target-api/source: the target-facing Source surface (C-2542, invariant I1).
// Targets read SourceProgramFacts (via TargetSourceProgramFacts) and authored syntax only. No checker Type, Signature,
// Symbol or Resolved*Info is reachable from this entry; Node and SourceFile appear as site keys only.
// Host-internal services (semantics, raw navigation, checker witnesses) are not exported here.

// The published fact contract. The program is built by the composition root through @tsonic/target-api/host
// (createTargetSourceProgram takes the checked program, whose type exposes the checker: K-2668, I1).
export * from "./source/index.js";
export type { SourceJsApiFactsFactory, SourceJsApiFactsInput } from "./source/assembly.js";
export type {
  SourceAuthoredOccurrence, SourceDocument, SourceOccurrence, SourceOccurrenceLookup, SourceProgramDocuments,
  SourceSyntheticOccurrence,
} from "../source-semantics/documents-model.js";

// Descriptor vocabulary and pure descriptor helpers (no program state).
export type {
  SourceClosedSum, SourceEffectiveTypeArgument, SourceEffectiveTypeOutcome, SourceEffectiveTypeProvenance,
  SourceLiteralMemberCorrespondence, SourceMemberKey, SourceMethodValueUse, SourceSlotAdmission, SourceSumIdentity, SourceTypeDescriptor,
  SourceTypeDescriptorIndex, SourceTypeDescriptorMember, SourceTypeDescriptorSignature, SourceTypeDescriptorTupleElement,
  SourceTypeFlowFixedRule, SourceTypeFlowRefusal, SourceTypeFlowRefusalCode,
} from "../source-semantics/descriptor-model.js";
export { sourceTypeDescriptorMemberOriginsEqual } from "../source-semantics/local-type-flow/member-origins.js";
export { sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue }
  from "../source-semantics/descriptor-model.js";

// Literal vocabulary and pure literal / integer rules.
export type { SourceArrayLiteralValue, SourceLiteralForm, SourceLiteralValue, SourceNumericLiteralEvidence,
  SourceNumericLiteralToken, SourceNumericLiteralValue, SourceScalarLiteralValue, SourceTextLiteralValue,
} from "../source-semantics/literal-values-model.js";
export { compareSourceNumericLiteralMagnitude, sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat }
  from "../source-semantics/literal-token.js";
export { parseBigIntLiteral, parseFiniteNumberLiteral } from "../source-semantics/literal-text.js";
export { sourceIntegerTruncationFits } from "../source-semantics/integer-truncation.js";
export { sourceIntegerLiteralValue } from "../source-semantics/integer-literal.js";
export { orderEnumerableOwnStringProperties } from "../source-semantics/enumerable-own-properties.js";

// Provider declaration selections (declaration facts, no checker types).
export type { SourceProviderSignatureSelection, SourceProviderTypeParameterSelection }
  from "../source-semantics/provider-signature.js";

// Authored-syntax readers (structure, names, text). Never used to answer a Source type question.
export { asSourceNode, Node_Name, Node_Expression, ClassStaticBlock_Body, ExportAssignment_IsExportEquals, SpreadAssignment_Expression, ConditionalExpression_Condition, ConditionalExpression_WhenTrue, ConditionalExpression_WhenFalse, TemplateExpression_Head, TemplateExpression_TemplateSpans, TemplateSpan_Expression, TemplateSpan_Literal, Node_Type, TypeOperatorNode_Type, Node_Initializer, ObjectLiteralProperty_Value, ObjectLiteralProperty_SourceName, BindingElement_PropertyName, BindingElement_IsRest, VariableDeclarationList_Declarations, VariableStatement_DeclarationList, BinaryExpression_Left, BinaryExpression_Right, BinaryExpression_OperatorToken, PrefixUnaryExpression_Operand, IfStatement_ThenStatement, DoStatement_Statement, LabeledStatement_Label, LabeledStatement_Statement, SwitchStatement_Expression, SwitchStatement_CaseBlock, CaseBlock_Clauses, CaseOrDefaultClause_Expression, CaseOrDefaultClause_Statements, IfStatement_ElseStatement, ForStatement_Initializer, ForStatement_Condition, ForStatement_Incrementor, ElementAccessExpression_ArgumentExpression, ArrayTypeNode_ElementType, ForInOrOfStatement_Initializer, ForInOrOfStatement_Statement, IterationStatement_Statement, TypeReferenceNode_TypeName, Node_Operand, TryStatement_TryBlock, TryStatement_CatchClause, TryStatement_FinallyBlock, CatchClause_VariableDeclaration, CatchClause_Block, BreakOrContinueStatement_Label } from "../source-model/ast.js";
export type { ObjectLiteralPropertySourceNameResult } from "../source-model/ast.js";
export * from "../source-navigation/kinds.js";
export * from "../source-navigation/node-access.js";
export * from "../source-navigation/checked-casts.js";
export * from "../source-model/class-members.js";
export { projectSourceNodeIdentity, sourceFileIdentity, sourceNodesEqual } from "../source-navigation/identity.js";
export { sourceBindingWriteAtReference } from "../source-navigation/references-usage.js";
export type { SourceBindingWrite, SourceBindingWriteValue } from "../source-navigation/records.js";
export { referenceQueryNode } from "../source-model/syntax.js";
export { forEachSourceImmediateEvaluationChild } from "../source-navigation/immediate-evaluation.js";
export { generatedTypeParameterNames, authoredTypeParameterNames } from "../source-navigation/generic-bindings.js";
export { sourceNodesOutsideErasedSubtrees } from "../source-navigation/callable-invocations.js";
export type { SourceSubtreeParticipation } from "../source-navigation/callable-invocations.js";
export { sourceCallableValueExpression } from "../source-navigation/callable-values.js";
export { sourceSequenceInputChoice, sourceSequenceConsumptionRoot, sourceSequenceInputIsEmpty }
  from "../source-navigation/sequence-inputs.js";
export type { SourceSequenceInputChoice } from "../source-navigation/sequence-inputs.js";
export { sourceLabeledStatementTarget, sourceNodeIsIteration } from "../source-navigation/control-targets.js";
export type { SourceLabeledStatementTarget } from "../source-navigation/control-targets.js";
export { sourceTypeSyntaxIsCompositional, sourceTypeSyntaxRoot } from "../source-semantics/type-syntax.js";
export { sourceExpressionSequence } from "../source-semantics/expression-sequence.js";
export { sourceBooleanShortCircuitBranch } from "../source-semantics/boolean-short-circuit.js";
export type { SourceBooleanShortCircuitBranch } from "../source-semantics/boolean-short-circuit.js";
export { createSourceDiagnosticSpanReader } from "../source-semantics/diagnostic-spans.js";

// Navigation records named by SourceRoleModel (declaration-keyed; no Symbol).
export type {
  SourceDeclarationUse, SourceDeclarationUseSummary, SourceExpressionEffects, SourceExpressionValueFlowSummary,
  SourceParameterUseSummary, SourceProjectModuleDependency, SourceProjectModuleSpecifierResolution, SourceValueEscapeKind,
} from "../source-navigation/records.js";
export type { SourceExpressionResultDisposition } from "../source-navigation/expression-use-model.js";
