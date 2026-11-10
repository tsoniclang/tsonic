export * from "./ast.js";
export * from "./class-members.js";
export * from "./checked-casts.js";
export * from "./kinds.js";
export * from "./node-access.js";
export type * from "../source-model/navigation.js";
export { createSourceNodeInventory, createSourceSyntaxDomain } from "./node-inventory.js";
export { sourceCallableValueParameters } from "./callable-parameters.js";
export {
  projectSourceNodeIdentity,
  sourceFileIdentity,
  sourceNodeIdentity,
  sourceNodesEqual,
} from "./identity.js";
export { sourceBindingWriteAtReference, sourceNodeIsWithin } from "./references-usage.js";
export { sourceAnnotationHint } from "./annotation-hints.js";
export type { SourceAnnotationHintBindings } from "./annotation-hints.js";
export { referenceQueryNode, sourceReferenceMeaning, isTypeSyntaxNode } from "./syntax.js";
export type { SourceReferenceMeaning } from "./syntax.js";
export { sourceAbsenceUse } from "./absence-use.js";
export type { SourceAbsenceUse } from "./absence-use.js";
export { sourceDeclarationHasOnlyTypeUses, sourceDeclarationUseSummary, sourceParameterUseSummary } from "./declaration-use-summary.js";
export { sourceDeclarationUses } from "./declaration-uses.js";
export { sourceConstructionExpression, sourceSuperConstructor, sourceInstanceInitializers } from "./class-initialization.js";
export { forEachSourceImmediateEvaluationChild } from "./immediate-evaluation.js";
export { sourceReceiverBoundary, sourceReceiverOwner } from "./receiver-owner.js";
export type { SourceReceiverBoundary } from "./receiver-owner.js";
export { sourceCallableDefinitionIsDiscarded, sourceConstructValueInputs,
  sourceExpressionValueInputs, sourceImmediatelyAwaitedLocal, sourceExpressionResultDisposition,
  sourceExpressionResultUse, sourceExpressionSelectsOperandValue } from "./expression-use.js";
export type { SourceExpressionResultDisposition } from "./expression-use-model.js";
export type { SourceValueInput, SourceValueInputSlot } from "./expression-use.js";
export { generatedTypeParameterNames, authoredTypeParameterNames } from "./generic-bindings.js";
export { sourceLexicalCaptures, sourceDeclarationIsModuleScoped, sourceBindingScope, sourceBindingIterationScope } from "./lexical-captures.js";
export { sourceLexicalEnvironment, type SourceLexicalEnvironment } from "./lexical-environments.js";
export { sourceBindingCapturedBeforeInitialization, sourceBindingCapturedBeforeFirstWrite } from "./deferred-captures.js";
export { sourceLexicalFunctionValueOrder } from "./lexical-value-creation.js";
export { createSourceSingleInvocationQuery, sourceLexicalFunctionIsUnused,
  sourceNodesOutsideErasedSubtrees, createSourceCallableInvocationReferenceQuery } from "./callable-invocations.js";
export type { SourceSubtreeParticipation, SourceCallableInvocationReference } from "./callable-invocations.js";
export { sourceCallableRoles, sourceEnclosing, createSourceEnclosingQuery } from "./callable-boundaries.js";
export { sourceExpressionValueFlow } from "./value-flow.js";
export type { SourceCallableRole, SourceCallableRoles } from "./callable-boundaries.js";
export { sourceBindingHasMutableExposure } from "./binding-mutation-exposure.js";
export type { SourceLexicalCapture, SourceLexicalCaptureSelection, SourceNodeDomain } from "./lexical-captures.js";
export { sourceMayReadBeforeInitialization } from "./initialization-uses.js";
export { createSourceCallOnlyAliasQuery } from "./callable-aliases.js";
export type { SourceCallOnlyAlias } from "./callable-aliases.js";
export { createSourceCallableValueQuery, sourceCallableValueExpression } from "./callable-values.js";
export type { SourceCallableValue } from "./callable-values.js";
export { sourceExpressionCallArgument, sourceCallArgumentCorrespondences } from "./callable-arguments.js";
export type { SourceClosedCallableArgument, SourceCallArgumentCorrespondence } from "./callable-arguments.js";
export { createSourceArrayDensityQuery } from "./array-density.js";
export type { SourceArrayDensityOptions, SourceArrayDensityQueries, SourceArrayMemberEffect } from "./array-density.js";
export { sourceSequenceInputChoice, sourceSequenceConsumptionRoot, sourceSequenceInputIsEmpty } from "./sequence-inputs.js";
export type { SourceSequenceInputChoice } from "./sequence-inputs.js";
export { sourceControlTransferTarget, sourceLabeledStatementTarget, sourceNodeIsIteration } from "./control-targets.js";
export type { SourceLabeledStatementTarget } from "./control-targets.js";
