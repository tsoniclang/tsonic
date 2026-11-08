import { type Node } from "@tsonic/tsts";
import { type SourceTypeDescriptorUnions } from "./terms.js";
import type { SourceHostComponent, SourceHostQueries, SourceHostType } from "../../host-input/queries.js";
import type { SourceTypeDescriptor, SourceTypeFlowInheritedBinding, SourceTypeFlowSource } from "./types.js";
type Bindings = ReadonlyMap<Node, SourceTypeDescriptor>;
export interface SourceTypeDescriptorReadFailure {
    readonly kind: "refused";
    readonly code: "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE";
    readonly owner: Node;
    readonly name: string;
}
export type SourceTypeDescriptorReadResult = {
    readonly kind: "resolved";
    readonly type: SourceTypeDescriptor | undefined;
} | SourceTypeDescriptorReadFailure;
/** The descriptor reader of one value-model run (its lifetime, I5). */
export interface SourceTypeDescriptorReader {
    syntax(node: Node, queries: SourceHostQueries, depth?: number, bindings?: Bindings): SourceTypeDescriptorReadResult;
    type(component: SourceHostComponent, queries: SourceHostQueries, depth?: number, bindings?: Bindings): SourceTypeDescriptorReadResult;
    inheritedBindings(type: SourceHostType, queries: SourceHostQueries, bindings: Bindings, authoredBindings?: Bindings): ReadonlyMap<Node, SourceTypeFlowInheritedBinding>;
}
export declare function createSourceTypeDescriptorReader(source: SourceTypeFlowSource, unions: SourceTypeDescriptorUnions, parametersFor: (declaration: Node) => readonly Node[], declaredValue: (declaration: Node, queries: SourceHostQueries, bindings: Bindings) => SourceTypeDescriptor | undefined, refusedSignature: (declaration: Node) => boolean): SourceTypeDescriptorReader;
export {};
//# sourceMappingURL=descriptors.d.ts.map