import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/spine.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { ExtensionForAwaitOfIterationMechanism, ExtensionForOfIterationMechanism } from "../internal/checker/checker/iteration-evidence.js";
import type { Type } from "../internal/checker/types.js";
export interface ResolvedSourceGeneratorInfo {
    readonly declaration: Node;
    readonly generatorKind: "sync" | "async";
    readonly sourceReturnType: Type;
    readonly iterationTypes: ResolvedSourceIterationTypes;
}
export interface ResolvedSourceIterationTypes {
    readonly yieldType: Type;
    readonly returnType: Type;
    readonly nextType: Type;
}
export interface ResolvedSourceYieldInfo {
    readonly yieldExpression: Node;
    readonly generator: ResolvedSourceGeneratorInfo;
    readonly yieldKind: "value" | "delegate";
    readonly operand?: {
        readonly expression: Node;
        readonly type: Type;
    };
    readonly sourceYieldType: Type;
    readonly sourceResumeType: Type;
    readonly delegation?: {
        readonly kind: ExtensionForOfIterationMechanism["kind"] | ExtensionForAwaitOfIterationMechanism["kind"];
        readonly sourceIterableType: Type;
        readonly iterationTypes: ResolvedSourceIterationTypes;
        readonly mechanism: ExtensionForOfIterationMechanism | ExtensionForAwaitOfIterationMechanism;
    };
}
export type ResolvedWellKnownSymbolKind = "has-instance" | "is-concat-spreadable" | "iterator" | "async-iterator" | "match" | "match-all" | "replace" | "search" | "species" | "split" | "to-primitive" | "to-string-tag" | "unscopables" | "dispose" | "async-dispose";
export interface ResolvedSourceWellKnownSymbolInfo {
    readonly kind: ResolvedWellKnownSymbolKind;
    readonly expression: Node;
    readonly sourceSymbol?: Symbol;
    readonly sourceDeclaration?: Node;
    readonly wellKnownSymbol: Symbol;
    readonly wellKnownDeclaration?: Node;
    readonly type: Type;
}
export interface ResolvedSourceDisposalAlternative {
    readonly sourceType: Type;
    readonly kind: "sync" | "async";
    readonly selectedSymbol: Symbol;
    readonly selectedDeclaration?: Node;
    readonly selectedType: Type;
}
export interface ResolvedSourceResourceManagementInfo {
    readonly declaration: Node;
    readonly declarationKind: "using" | "await using";
    readonly acquisition: {
        readonly kind: "initializer";
        readonly expression: Node;
        readonly sourceType: Type;
    } | {
        readonly kind: "iteration";
        readonly statement: Node;
        readonly sourceType: Type;
    };
    readonly sourceResourceType: Type;
    readonly acceptsNullish: true;
    readonly disposal: {
        readonly kind: "selected";
        readonly alternatives: readonly ResolvedSourceDisposalAlternative[];
    } | {
        readonly kind: "untyped-dynamic";
        readonly sourceType: Type;
    };
}
export declare function resolveSourceGeneratorInfo(checker: GoPtr<Checker>, declaration: GoPtr<Node>): GoPtr<ResolvedSourceGeneratorInfo>;
export declare function resolveSourceYieldInfo(checker: GoPtr<Checker>, yieldExpression: GoPtr<Node>, generator: GoPtr<ResolvedSourceGeneratorInfo>): GoPtr<ResolvedSourceYieldInfo>;
export declare function resolveSourceWellKnownSymbolInfo(checker: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<ResolvedSourceWellKnownSymbolInfo>;
export declare function resolveSourceResourceManagementInfo(checker: GoPtr<Checker>, declaration: GoPtr<Node>): GoPtr<ResolvedSourceResourceManagementInfo>;
//# sourceMappingURL=source-control-flow-evidence.d.ts.map
