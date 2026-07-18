import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Kind } from "../internal/ast/generated/kinds.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { ResolvedCallEvidence, Type } from "../internal/checker/types.js";
import type { CheckedIterationKind, CheckedOperationObservationPointName, PostCheckAssignabilityObservationRequest } from "./observations.js";
import type { CheckedAccessMode } from "./facts.js";
export declare function hasExtensionCheckedOperationHost(checker: GoPtr<Checker>, observation: CheckedOperationObservationPointName): boolean;
export declare function retainExtensionCheckedIdentifierCalleeSelection(checker: GoPtr<Checker>, identifier: GoPtr<Node>, sourceSymbol: GoPtr<Symbol>, sourceSelectedSymbol: GoPtr<Symbol>): void;
export declare function recordExtensionCheckedCallMapping(checker: GoPtr<Checker>, callExpression: GoPtr<Node>, resolvedCallEvidence: ResolvedCallEvidence): void;
export interface CheckedPropertyAccessSourceEvidence {
    readonly selectedSymbol: GoPtr<Symbol>;
    readonly resultType: GoPtr<Type>;
    readonly receiverType: GoPtr<Type>;
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
export declare function recordExtensionCheckedIterationMapping(checker: GoPtr<Checker>, statement: GoPtr<Node>, kind: CheckedIterationKind, sourceIterableType: GoPtr<Type>, sourceElementType: GoPtr<Type>): void;
export declare function recordExtensionTargetConstraintValidation(checker: GoPtr<Checker>, typeReference: GoPtr<Node>, symbol: GoPtr<Symbol>): boolean;
export declare function recordExtensionRuntimeCarrierFact(checker: GoPtr<Checker>, typeReference: GoPtr<Node>, type: GoPtr<Type>, symbol: GoPtr<Symbol>): void;
export declare function recordExtensionContextualTargetTypeFact(checker: GoPtr<Checker>, expression: GoPtr<Node>, contextualType: GoPtr<Type>): void;
export declare function recordExtensionPostCheckAssignabilityObservation(checker: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, errorNode: GoPtr<Node>, expression: GoPtr<Node>, relation: PostCheckAssignabilityObservationRequest["relation"]): void;
export declare function recordExtensionFlowUseValidation(checker: GoPtr<Checker>, useSite: GoPtr<Node>, symbol: GoPtr<Symbol>): void;
//# sourceMappingURL=checker-integration.d.ts.map