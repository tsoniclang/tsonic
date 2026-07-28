import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { Symbol } from "../../ast/symbol.js";
import type { Type } from "../types.js";
import type { IterationTypes } from "./state.js";
export declare const sourceIterationEvidenceLimits: Readonly<{
    maxUnionAlternatives: 4096;
    maxUnionDepth: 64;
}>;
export interface ExtensionSelectedIterationTypes {
    readonly yieldType: GoPtr<Type>;
    readonly returnType: GoPtr<Type>;
    readonly nextType: GoPtr<Type>;
}
interface ExtensionSelectedIterationProtocolBase {
    readonly sourceIterableType: Type;
    readonly iterationTypes: ExtensionSelectedIterationTypes;
}
export type ExtensionSelectedIterationProtocol = ExtensionSelectedIterationProtocolBase & {
    readonly resolutionKind: "known-iterable-instantiation";
    readonly iterableTargetType: Type;
    readonly iterableSymbol: GoPtr<Symbol>;
    readonly iterableValueDeclaration: GoPtr<Node>;
    readonly iterableDeclarations: readonly GoPtr<Node>[];
    readonly iteratorMethodSymbol?: never;
    readonly iteratorMethodValueDeclaration?: never;
    readonly iteratorMethodDeclarations?: never;
    readonly iteratorMethodType?: never;
    readonly iteratorType?: never;
} | ExtensionSelectedIterationProtocolBase & {
    readonly resolutionKind: "selected-iterator-member";
    readonly iteratorMethodSymbol: Symbol;
    readonly iteratorMethodValueDeclaration: GoPtr<Node>;
    readonly iteratorMethodDeclarations: readonly GoPtr<Node>[];
    readonly iteratorMethodType: Type;
    readonly iteratorType: Type;
    readonly iterableTargetType?: never;
    readonly iterableSymbol?: never;
    readonly iterableValueDeclaration?: never;
    readonly iterableDeclarations?: never;
};
export type ExtensionForOfAtomicIterationMechanism = {
    readonly kind: "synchronous-iterator-protocol";
    readonly sourceIterableType: Type;
    readonly protocol: ExtensionSelectedIterationProtocol;
} | {
    readonly kind: "array-like-index";
    readonly sourceIterableType: Type;
    readonly selectedIndexType: Type;
} | {
    readonly kind: "string-code-unit-index";
    readonly sourceIterableType: Type;
} | {
    readonly kind: "untyped-dynamic-iteration";
    readonly sourceIterableType: Type;
};
export type ExtensionForAwaitOfAtomicIterationMechanism = {
    readonly kind: "asynchronous-iterator-protocol";
    readonly sourceIterableType: Type;
    readonly protocol: ExtensionSelectedIterationProtocol;
} | {
    readonly kind: "synchronous-iterator-adapted-to-async";
    readonly sourceIterableType: Type;
    readonly protocol: ExtensionSelectedIterationProtocol;
} | {
    readonly kind: "array-like-index-adapted-to-async";
    readonly sourceIterableType: Type;
    readonly selectedIndexType: Type;
} | {
    readonly kind: "string-code-unit-index-adapted-to-async";
    readonly sourceIterableType: Type;
} | {
    readonly kind: "untyped-dynamic-iteration";
    readonly sourceIterableType: Type;
};
export type ExtensionForOfIterationMechanism = ExtensionForOfAtomicIterationMechanism | {
    readonly kind: "union";
    readonly alternatives: readonly [ExtensionForOfAtomicIterationMechanism, ...ExtensionForOfAtomicIterationMechanism[]];
};
export type ExtensionForAwaitOfIterationMechanism = ExtensionForAwaitOfAtomicIterationMechanism | {
    readonly kind: "union";
    readonly alternatives: readonly [ExtensionForAwaitOfAtomicIterationMechanism, ...ExtensionForAwaitOfAtomicIterationMechanism[]];
};
export type ExtensionCheckedIterationSelection = {
    readonly iterationKind: "for-in";
    readonly sourceIterableType: Type;
    readonly sourceElementType: Type;
    readonly mechanism: {
        readonly kind: "property-key-enumeration";
    };
} | {
    readonly iterationKind: "for-of";
    readonly sourceIterableType: Type;
    readonly sourceElementType: Type;
    readonly mechanism: ExtensionForOfIterationMechanism;
} | {
    readonly iterationKind: "for-await-of";
    readonly sourceIterableType: Type;
    readonly sourceElementType: Type;
    readonly mechanism: ExtensionForAwaitOfIterationMechanism;
};
export interface ExtensionCheckedIterationResult {
    readonly elementType: Type;
    readonly selection: ExtensionCheckedIterationSelection | undefined;
}
export declare function freezeExtensionCheckedIterationSelection(selection: ExtensionCheckedIterationSelection): ExtensionCheckedIterationSelection;
export interface ExtensionIterationSelectionBudget {
    remainingUnionAlternatives: number;
    exhausted: boolean;
}
export interface ExtensionIterationProtocolSelectionCapture {
    readonly budget: ExtensionIterationSelectionBudget;
    mechanism: ExtensionForOfIterationMechanism | ExtensionForAwaitOfIterationMechanism | undefined;
}
export declare function extensionIterationTypesMatch(left: IterationTypes, right: IterationTypes): boolean;
export declare function captureKnownIterableInstantiation(capture: ExtensionIterationProtocolSelectionCapture, sourceIterableType: GoPtr<Type>, iterationTypes: IterationTypes): void;
export declare function captureSelectedIteratorMember(capture: ExtensionIterationProtocolSelectionCapture, sourceIterableType: GoPtr<Type>, iteratorMethodSymbol: GoPtr<Symbol>, iteratorMethodType: GoPtr<Type>, iteratorType: GoPtr<Type>, iterationTypes: IterationTypes): void;
export declare function setExtensionProtocolMechanismKind(capture: ExtensionIterationProtocolSelectionCapture, kind: "synchronous-iterator-protocol" | "asynchronous-iterator-protocol" | "synchronous-iterator-adapted-to-async", iterationTypes: IterationTypes): void;
export declare function isForOfIterationMechanism(mechanism: ExtensionForOfIterationMechanism | ExtensionForAwaitOfIterationMechanism): mechanism is ExtensionForOfIterationMechanism;
export declare function isForAwaitOfIterationMechanism(mechanism: ExtensionForOfIterationMechanism | ExtensionForAwaitOfIterationMechanism): mechanism is ExtensionForAwaitOfIterationMechanism;
export declare function combineExtensionProtocolMechanisms(capture: ExtensionIterationProtocolSelectionCapture, children: readonly ExtensionIterationProtocolSelectionCapture[], forAwaitOf: boolean): void;
export declare function createChildExtensionIterationCapture(capture: ExtensionIterationProtocolSelectionCapture): ExtensionIterationProtocolSelectionCapture;
export declare function captureExtensionArrayOrStringIteration(capture: ExtensionIterationProtocolSelectionCapture, forAwaitOf: boolean, arrayType: GoPtr<Type>, selectedIndexType: GoPtr<Type>, stringType: GoPtr<Type>): void;
export declare function createExtensionIterationProtocolSelectionCapture(): ExtensionIterationProtocolSelectionCapture;
export declare function createExtensionForInIterationSelection(sourceIterableType: Type, sourceElementType: Type): ExtensionCheckedIterationSelection;
export {};
//# sourceMappingURL=iteration-evidence.d.ts.map