import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { Symbol } from "../../ast/symbol.js";
import type { Type } from "../types.js";
import type { Checker } from "./state.js";
export interface PropertyCallCalleeEvidence {
    readonly sourceSymbol: GoPtr<Symbol>;
    readonly sourceDeclaration?: GoPtr<Node>;
    readonly selectedSymbol: GoPtr<Symbol>;
    readonly selectedDeclaration?: GoPtr<Node>;
    readonly resultType: GoPtr<Type>;
    readonly receiverType: GoPtr<Type>;
    readonly receiverSymbol?: GoPtr<Symbol>;
    readonly receiverDeclaration?: GoPtr<Node>;
}
export interface ElementCallCalleeEvidence {
    readonly sourceSymbol: GoPtr<Symbol>;
    readonly sourceDeclaration?: GoPtr<Node>;
    readonly selectedSymbol: GoPtr<Symbol>;
    readonly selectedDeclaration?: GoPtr<Node>;
    readonly resultType: GoPtr<Type>;
    readonly selectedElementIndex?: number;
    readonly receiverType: GoPtr<Type>;
    readonly argumentType: GoPtr<Type>;
}
export declare function callEvidenceWantedForCallee(callee: GoPtr<Node>): boolean;
export declare function retainIdentifierCallCalleeEvidence(checker: GoPtr<Checker>, identifier: GoPtr<Node>, sourceSymbol: GoPtr<Symbol>, selectedSymbol: GoPtr<Symbol>): void;
export declare function retainPropertyCallCalleeEvidence(checker: GoPtr<Checker>, propertyAccessExpression: GoPtr<Node>, evidence: PropertyCallCalleeEvidence): void;
export declare function retainElementCallCalleeEvidence(checker: GoPtr<Checker>, elementAccessExpression: GoPtr<Node>, evidence: ElementCallCalleeEvidence): void;
//# sourceMappingURL=call-evidence.d.ts.map