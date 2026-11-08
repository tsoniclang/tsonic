import type { Node } from "@tsonic/tsts";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type { SourceTypeDescriptorUnions } from "./terms.js";
import { createSourceTypeFlowDeclaredSlotReader } from "./declared-slots.js";
import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceTypeDescriptor, SourceTypeFlowAnalysisContext, SourceTypeFlowFixedRule, SourceTypeFlowRefusal, SourceTypeFlowSource } from "./types.js";
export interface SourceTypeFlowDefaults {
    readonly unionComponents: ReadonlyMap<Node, SourceTypeDescriptor>;
    readonly numberOrigins: ReadonlyMap<Node, SourceLiteralValue>;
    readonly context: SourceTypeFlowAnalysisContext;
    readonly nodes: readonly Node[];
    readonly values: readonly Node[];
    readonly signatureRefusals: ReadonlyMap<Node, SourceTypeFlowRefusal>;
    readonly descriptorRefusals: ReadonlyMap<Node, SourceTypeFlowRefusal>;
    readonly declaredSlots: ReturnType<typeof createSourceTypeFlowDeclaredSlotReader>;
    numericCreationRefusal(site: Node, reason: string): SourceTypeFlowRefusal;
    fixedRule(node: Node): SourceTypeFlowFixedRule | undefined;
    hasDeclaredSourceType(node: Node): boolean;
    /**
     * The Host descriptor of an authored type node (annotation, constraint, type argument, provider or marker type syntax):
     * the authored-syntax translation, or its refusal. undefined only for a node that is not type syntax.
     */
    typeSyntax(node: Node): SourceTypeDescriptor | SourceTypeFlowRefusal | undefined;
}
export declare function sourceTypeFlowTypeParameters(ast: SourceTypeFlowSource["ast"], declaration: Node): readonly Node[];
export declare function createSourceTypeFlowAnalysisContext(source: SourceTypeFlowSource, unions: SourceTypeDescriptorUnions, input: SourceHostInput): SourceTypeFlowDefaults;
export type SourceTypeFlowNumericLiteralDecision = {
    readonly kind: "resolved";
    readonly primitive: "int64" | "float64";
} | {
    readonly kind: "refused";
    readonly reason: string;
};
export declare function sourceTypeFlowNumericLiteralKind(literal: SourceLiteralValue): SourceTypeFlowNumericLiteralDecision;
//# sourceMappingURL=defaults.d.ts.map