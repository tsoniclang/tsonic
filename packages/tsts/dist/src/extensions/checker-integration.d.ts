import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { Signature, Type } from "../internal/checker/types.js";
import type { CheckedIterationKind, PostCheckAssignabilityObservationRequest } from "./observations.js";
export declare function recordExtensionCheckedCallMapping(checker: GoPtr<Checker>, callExpression: GoPtr<Node>, sourceSelectedSignature?: GoPtr<Signature>, resolvedCalleeSymbol?: GoPtr<Symbol>): void;
export declare function recordExtensionCheckedPropertyAccessMapping(checker: GoPtr<Checker>, propertyAccessExpression: GoPtr<Node>, resolvedSelectedSymbol?: GoPtr<Symbol>): void;
export declare function recordExtensionCheckedElementAccessMapping(checker: GoPtr<Checker>, elementAccessExpression: GoPtr<Node>, resolvedSelectedSymbol?: GoPtr<Symbol>): void;
export declare function recordExtensionCheckedOperatorMapping(checker: GoPtr<Checker>, expression: GoPtr<Node>, operatorToken: GoPtr<Node>, left: GoPtr<Node>, right: GoPtr<Node>): void;
export declare function recordExtensionCheckedIterationMapping(checker: GoPtr<Checker>, statement: GoPtr<Node>, kind: CheckedIterationKind, sourceElementType?: GoPtr<Type>): void;
export declare function recordExtensionTargetConstraintValidation(checker: GoPtr<Checker>, typeReference: GoPtr<Node>, symbol: GoPtr<Symbol>): boolean;
export declare function recordExtensionRuntimeCarrierFact(checker: GoPtr<Checker>, typeReference: GoPtr<Node>, type: GoPtr<Type>, symbol: GoPtr<Symbol>): void;
export declare function recordExtensionContextualTargetTypeFact(checker: GoPtr<Checker>, expression: GoPtr<Node>, contextualType: GoPtr<Type>): void;
export declare function recordExtensionPostCheckAssignabilityObservation(checker: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, errorNode: GoPtr<Node>, expression: GoPtr<Node>, relation: PostCheckAssignabilityObservationRequest["relation"]): void;
export declare function recordExtensionFlowUseValidation(checker: GoPtr<Checker>, useSite: GoPtr<Node>, symbol: GoPtr<Symbol>): void;
//# sourceMappingURL=checker-integration.d.ts.map