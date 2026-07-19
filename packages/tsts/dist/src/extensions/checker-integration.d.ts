import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Kind } from "../internal/ast/generated/kinds.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { ResolvedCallEvidence, SignatureLinks, Type, TypeNodeLinks } from "../internal/checker/types.js";
import type { ExtensionCheckedIterationSelection } from "./checker-iteration-selection.js";
import type { CheckedCallMappingRequest, CheckedCallMappingResult, CheckedConversionMappingRequest, CheckedConversionMappingResult, CheckedElementAccessMappingRequest, CheckedFlowSourceUse, CheckedIterationMappingRequest, CheckedOperationObservationPointName, CheckedOperatorMappingRequest, CheckedPropertyAccessMappingRequest, PostCheckAssignabilityObservationRequest } from "./observations.js";
import type { CheckedConversionSourceOperation, CheckedElementAccessSourceOperation, CheckedIterationSourceOperation, CheckedOperatorSourceOperation, CheckedPropertyAccessSourceOperation, ProviderDeclarationIdentity, SelectedTargetSignatureFact, TargetOperationFact, TargetOperationProposal, TargetOperationProvenance, TargetTypeRef } from "./facts.js";
import type { ExtensionEvidence, ExtensionHost } from "./host.js";
import type { ExtensionSourceDecisionFrame } from "./checker-source-decisions.js";
import type { CheckedOperationRequestSnapshotCache } from "./checked-operation-value-snapshot.js";
export { preserveEquivalentCheckedSourceType } from "./checked-source-type-identity.js";
type CheckedAccessMode = CheckedPropertyAccessSourceOperation["accessMode"];
export declare function hasExtensionCheckedOperationHost(checker: GoPtr<Checker>, observation: CheckedOperationObservationPointName, executionSite: GoPtr<Node>): boolean;
export declare function beginExtensionCheckedSourceFileDecision(checker: GoPtr<Checker>, sourceFile: GoPtr<SourceFile>): ExtensionSourceDecisionFrame | undefined;
export declare function beginExtensionCheckedSourceCandidateDecision(checker: GoPtr<Checker>): ExtensionSourceDecisionFrame | undefined;
export declare function beginExtensionCheckedSourceSignatureDecision(checker: GoPtr<Checker>): ExtensionSourceDecisionFrame | undefined;
export declare function beginExtensionCheckedSourceDiscardDecision(checker: GoPtr<Checker>): ExtensionSourceDecisionFrame | undefined;
export declare function commitExtensionCheckedSourceCandidateDecision(checker: GoPtr<Checker>, frame: ExtensionSourceDecisionFrame | undefined): void;
export declare function commitExtensionCheckedSourceSignatureDecision(checker: GoPtr<Checker>, frame: ExtensionSourceDecisionFrame | undefined): void;
export declare function rollbackExtensionCheckedSourceDecision(checker: GoPtr<Checker>, frame: ExtensionSourceDecisionFrame | undefined): void;
export declare function rollbackExtensionCheckedSourceDiscardDecision(checker: GoPtr<Checker>, frame: ExtensionSourceDecisionFrame | undefined): void;
export declare function commitExtensionCheckedSourceFileDecision(checker: GoPtr<Checker>, frame: ExtensionSourceDecisionFrame | undefined): void;
export declare function journalExtensionCheckedCallEvidence(checker: GoPtr<Checker>, links: SignatureLinks): void;
export declare function extensionCheckedSourceDecisionOwner(checker: GoPtr<Checker>): GoPtr<SourceFile>;
export declare function extensionCheckedSourceDecisionDiscardActive(checker: GoPtr<Checker>): boolean;
export declare function journalExtensionCheckedExpressionCache(checker: GoPtr<Checker>, links: TypeNodeLinks): void;
export declare function retainExtensionCheckedIdentifierCalleeSelection(checker: GoPtr<Checker>, identifier: GoPtr<Node>, sourceSymbol: GoPtr<Symbol>, sourceSelectedSymbol: GoPtr<Symbol>): void;
export declare function recordExtensionCheckedCallMapping(checker: GoPtr<Checker>, callExpression: GoPtr<Node>, resolvedCallEvidence: ResolvedCallEvidence): void;
export interface CheckedPropertyAccessSourceEvidence {
    readonly selectedSymbol: GoPtr<Symbol>;
    readonly resultType: GoPtr<Type>;
    readonly receiverType: GoPtr<Type>;
    readonly selectionMode: "read" | "write";
    readonly accessMode: CheckedAccessMode;
    readonly callCallee: boolean;
}
export declare function recordExtensionCheckedPropertyAccessMapping(checker: GoPtr<Checker>, propertyAccessExpression: GoPtr<Node>, selected: CheckedPropertyAccessSourceEvidence): void;
export interface CheckedElementAccessSourceEvidence {
    readonly selectedSymbol: GoPtr<Symbol>;
    readonly resultType: GoPtr<Type>;
    readonly selectedElementIndex?: number;
    readonly receiverType: GoPtr<Type>;
    readonly argumentType: GoPtr<Type>;
    readonly accessMode: CheckedAccessMode;
    readonly callCallee: boolean;
}
export declare function recordExtensionCheckedElementAccessMapping(checker: GoPtr<Checker>, elementAccessExpression: GoPtr<Node>, selected: CheckedElementAccessSourceEvidence): void;
export declare function recordExtensionCheckedAssertionConversion(checker: GoPtr<Checker>, assertionExpression: GoPtr<Node>, sourceType: GoPtr<Type>, targetType: GoPtr<Type>, assertionKind: "as" | "angle-bracket" | "jsdoc"): void;
export declare function recordExtensionCheckedOperatorMapping(checker: GoPtr<Checker>, expression: GoPtr<Node>, operatorToken: GoPtr<Node>, left: GoPtr<Node>, right: GoPtr<Node>, sourceLeftType: GoPtr<Type>, sourceRightType: GoPtr<Type>, sourceResultType: GoPtr<Type>): void;
export declare function recordExtensionCheckedOperatorKindMapping(checker: GoPtr<Checker>, expression: GoPtr<Node>, operator: Kind | undefined, left: GoPtr<Node>, right: GoPtr<Node>, sourceLeftType: GoPtr<Type>, sourceRightType: GoPtr<Type>, sourceResultType: GoPtr<Type>): void;
export declare function recordExtensionCheckedIterationMapping(checker: GoPtr<Checker>, statement: GoPtr<Node>, selection: ExtensionCheckedIterationSelection | undefined): void;
export declare function recordExtensionTargetConstraintValidation(checker: GoPtr<Checker>, typeReference: GoPtr<Node>, symbol: GoPtr<Symbol>): boolean;
export declare function recordExtensionRuntimeCarrierFact(checker: GoPtr<Checker>, typeReference: GoPtr<Node>, type: GoPtr<Type>, symbol: GoPtr<Symbol>): void;
export declare function recordExtensionContextualTargetTypeFact(checker: GoPtr<Checker>, expression: GoPtr<Node>, contextualType: GoPtr<Type>): void;
export declare function recordExtensionPostCheckAssignabilityObservation(checker: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, errorNode: GoPtr<Node>, expression: GoPtr<Node>, relation: PostCheckAssignabilityObservationRequest["relation"]): void;
export declare function recordExtensionFlowUseValidation(checker: GoPtr<Checker>, useSite: GoPtr<Node>, symbol: GoPtr<Symbol>, sourceUse: CheckedFlowSourceUse): void;
export declare function applyExtensionCheckedConversion(extensionHost: ExtensionHost, value: CheckedConversionMappingResult, evidence: readonly ExtensionEvidence[], acceptedRequest: CheckedConversionMappingRequest): void;
export declare function finalizeSelectedTargetSignatureFact(callResult: Extract<CheckedCallMappingResult, {
    readonly kind: "target";
}>, sourceOperation: CheckedCallMappingRequest, snapshotCache: CheckedOperationRequestSnapshotCache): SelectedTargetSignatureFact;
export declare function finalizeTargetOperationFact(operation: TargetOperationProposal, resultType: TargetTypeRef | undefined, sourceOperation: TargetOperationProvenance["sourceOperation"], providerDeclaration: ProviderDeclarationIdentity | undefined): TargetOperationFact;
export declare function checkedPropertySourceOperationFromRequest(request: CheckedPropertyAccessMappingRequest): CheckedPropertyAccessSourceOperation;
export declare function checkedElementSourceOperationFromRequest(request: CheckedElementAccessMappingRequest): CheckedElementAccessSourceOperation;
export declare function checkedOperatorSourceOperationFromRequest(request: CheckedOperatorMappingRequest): CheckedOperatorSourceOperation;
export declare function checkedConversionSourceOperation(request: CheckedConversionMappingRequest): CheckedConversionSourceOperation;
export declare function checkedIterationSourceOperation(request: CheckedIterationMappingRequest): CheckedIterationSourceOperation;
//# sourceMappingURL=checker-integration.d.ts.map