import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/spine.js";
import type { ConditionalRoot, Type } from "../internal/checker/types.js";
import type { TypeMapper } from "../internal/checker/mapper.js";
export interface ExtensionConditionalStep {
    readonly conditional: Node;
    readonly branch: "true" | "false" | "deferred";
    readonly selectedNode: GoPtr<Node>;
    readonly parameters: readonly Type[];
    readonly mapper: GoPtr<TypeMapper>;
}
export interface ExtensionConditionalCapture {
    readonly complete: boolean;
    readonly steps: readonly ExtensionConditionalStep[];
    record(root: GoPtr<ConditionalRoot>, branch: ExtensionConditionalStep["branch"], selectedNode: GoPtr<Node>, mapper: GoPtr<TypeMapper>): void;
}
export declare function createExtensionConditionalCapture(): ExtensionConditionalCapture;
//# sourceMappingURL=conditional-type-evidence.d.ts.map