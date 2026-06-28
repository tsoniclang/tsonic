import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Signature, Type } from "../internal/checker/types.js";
import type { CheckedIterationKind, PostCheckAssignabilityObservationRequest } from "./observations.js";
interface CheckerWithProgram {
    readonly program: object;
}
export declare function recordExtensionCheckedCallMapping(checker: GoPtr<CheckerWithProgram>, callExpression: GoPtr<Node>, sourceSelectedSignature?: GoPtr<Signature>): void;
export declare function recordExtensionCheckedPropertyAccessMapping(checker: GoPtr<CheckerWithProgram>, propertyAccessExpression: GoPtr<Node>): void;
export declare function recordExtensionCheckedElementAccessMapping(checker: GoPtr<CheckerWithProgram>, elementAccessExpression: GoPtr<Node>): void;
export declare function recordExtensionCheckedOperatorMapping(checker: GoPtr<CheckerWithProgram>, expression: GoPtr<Node>, operatorToken: GoPtr<Node>, left: GoPtr<Node>, right: GoPtr<Node>): void;
export declare function recordExtensionCheckedIterationMapping(checker: GoPtr<CheckerWithProgram>, statement: GoPtr<Node>, kind: CheckedIterationKind, sourceElementType?: GoPtr<Type>): void;
export declare function recordExtensionTargetConstraintValidation(checker: GoPtr<CheckerWithProgram>, typeReference: GoPtr<Node>, symbol: GoPtr<Symbol>): boolean;
export declare function recordExtensionRuntimeCarrierFact(checker: GoPtr<CheckerWithProgram>, typeReference: GoPtr<Node>, type: GoPtr<Type>, symbol: GoPtr<Symbol>): void;
export declare function recordExtensionContextualTargetTypeFact(checker: GoPtr<CheckerWithProgram>, expression: GoPtr<Node>, contextualType: GoPtr<Type>): void;
export declare function recordExtensionPostCheckAssignabilityObservation(checker: GoPtr<CheckerWithProgram>, source: GoPtr<Type>, target: GoPtr<Type>, errorNode: GoPtr<Node>, expression: GoPtr<Node>, relation: PostCheckAssignabilityObservationRequest["relation"]): void;
export declare function recordExtensionFlowUseValidation(checker: GoPtr<CheckerWithProgram>, useSite: GoPtr<Node>, symbol: GoPtr<Symbol>): void;
export {};
//# sourceMappingURL=checker-integration.d.ts.map