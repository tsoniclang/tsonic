import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/ast.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { Type } from "../internal/checker/types.js";
export interface TypeAliasConditionalStep {
    readonly conditional: Node;
    readonly branch: "true" | "false" | "deferred";
    readonly selectedNode?: Node;
    readonly selectedType?: Type;
    readonly bindings: readonly {
        readonly declarations: readonly Node[];
        readonly parameter: Type;
        readonly argument: Type;
        readonly applicationParameter?: Type;
    }[];
}
export interface TypeAliasApplicationInfo {
    readonly kind: "direct" | "conditional";
    readonly declaration: Node;
    readonly typeNode: Node;
    readonly bindings: readonly {
        readonly declaration: Node;
        readonly parameter: Type;
        readonly argument: Type;
    }[];
    readonly result: Type;
    readonly conditionalSteps: readonly TypeAliasConditionalStep[];
}
export declare function readTypeAliasApplication(queryChecker: GoPtr<Checker>, type: GoPtr<Type>): TypeAliasApplicationInfo | undefined;
export declare function resolveTypeAliasApplication(queryChecker: GoPtr<Checker>, declaration: GoPtr<Node>, arguments_: readonly Type[]): TypeAliasApplicationInfo | undefined;
//# sourceMappingURL=type-applications.d.ts.map