import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
export { sourceTypeDescriptorLiteralKey, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue, } from "../descriptor-model.js";
import type { SourceClosedSum, SourceSumIdentity, SourceTypeDescriptor, SourceTypeFlowGraph, SourceTypeFlowNode, SourceTypeFlowRefusal, SourceTypeFlowTerm, SourceTypeFlowVariable } from "./types.js";
export interface SourceUnionPreference {
    readonly keys: readonly number[];
    readonly authored?: Node;
}
export interface SourceUnionRegistry {
    readonly owner: SourceTypeDescriptorUnions;
    /** Sum application of each owned union/optional descriptor (and of its frozen snapshot). */
    readonly applications: WeakMap<SourceTypeDescriptor, SourceUnionApplication>;
    /** Descriptors this program's normalizer produced or accepted. */
    readonly owned: WeakSet<SourceTypeDescriptor>;
    /** Frozen snapshot of each descriptor (identity-stable freezing). */
    readonly snapshots: WeakMap<SourceTypeDescriptor, SourceTypeDescriptor>;
    readonly files: ReadonlyMap<SourceFile, number>;
    readonly preferences: Map<string, SourceUnionPreference>;
    readonly nodes: WeakMap<Node, number>;
    readonly descriptors: WeakMap<SourceTypeDescriptor, number | undefined>;
    readonly structures: Map<string, number>;
    readonly families: Map<Node, SourceUnionFamily>;
    nextIdentity: number;
    sealed: boolean;
    published: boolean;
}
export interface SourceTypeDescriptorUnions {
    readonly ast: AstReader;
    readonly files: readonly SourceFile[];
    readonly registry: SourceUnionRegistry;
}
export interface SourceUnionFamily {
    readonly node: Node;
    readonly origin: "authored" | "inferred";
    readonly parameters: readonly Node[];
    readonly roles: readonly SourceTypeDescriptor[];
    readonly applications: Map<string, SourceUnionApplication>;
    readonly records: Map<string, SourceClosedSum>;
}
export interface SourceUnionApplication {
    readonly registry: SourceUnionRegistry;
    readonly family: SourceUnionFamily;
    readonly arguments: readonly SourceTypeDescriptor[];
    readonly roles: readonly SourceTypeDescriptor[];
    readonly descriptor: SourceTypeDescriptor;
}
export declare function createSourceTypeDescriptorUnions(ast: AstReader, files: readonly SourceFile[]): SourceTypeDescriptorUnions;
/**
 * A value with an absence arm (the one rule for every producer that adds absence to one value): an optional value stays
 * as it is, and `unknown` / `any` already hold null and undefined (Q65), so they absorb it. Every other value becomes
 * optional.
 */
export declare function sourceTypeDescriptorOptional(value: SourceTypeDescriptor): SourceTypeDescriptor;
/** The one "top" predicate (Q103): `unknown` or `any`, through declared aliases. Openness and absence absorption read it. */
export declare function sourceTypeDescriptorIsTop(type: SourceTypeDescriptor): boolean;
export declare function sealSourceTypeDescriptorUnions(owner: SourceTypeDescriptorUnions): void;
export declare function sourceTypeDescriptorUnion(owner: SourceTypeDescriptorUnions, types: readonly SourceTypeDescriptor[], origin?: {
    readonly kind: "authored" | "inferred";
    readonly node: Node;
}, bindings?: ReadonlyMap<Node, SourceTypeDescriptor>): SourceTypeDescriptor | undefined;
export declare function createSourceClosedSumQuery(owner: SourceTypeDescriptorUnions, normalize: (type: SourceTypeDescriptor) => SourceTypeDescriptor): (identity: SourceSumIdentity) => SourceClosedSum | undefined;
export declare function sourceTypeDescriptorSum(owner: SourceTypeDescriptorUnions, descriptor: SourceTypeDescriptor): SourceClosedSum | undefined;
export declare function substituteSourceTypeDescriptor(owner: SourceTypeDescriptorUnions, type: SourceTypeDescriptor, bindings: ReadonlyMap<Node, SourceTypeDescriptor>): SourceTypeDescriptor | undefined;
export declare function createSourceTypeDescriptorNormalizer(owner: SourceTypeDescriptorUnions, bindings: ReadonlyMap<Node, SourceTypeDescriptor>): (type: SourceTypeDescriptor) => SourceTypeDescriptor | undefined;
export declare function freezeSourceTypeDescriptor(owner: SourceTypeDescriptorUnions, type: SourceTypeDescriptor): SourceTypeDescriptor;
export declare function sourceTypeDescriptorDepth(type: SourceTypeDescriptor): number;
export declare function sourceTypeDescriptorHasTypeVariables(ast: AstReader, type: SourceTypeDescriptor, bound?: ReadonlySet<Node>): boolean;
export interface SourceTypeFlowTermGroup {
    readonly variable: SourceTypeFlowVariable;
    readonly nodes: readonly SourceTypeFlowNode[];
    readonly terms: readonly SourceTypeFlowTerm[];
    readonly refusals: readonly SourceTypeFlowRefusal[];
}
export interface SourceTypeFlowTerms {
    group(variable: SourceTypeFlowVariable): SourceTypeFlowTermGroup;
    groups(): readonly SourceTypeFlowTermGroup[];
    isInference(variable: SourceTypeFlowVariable): boolean;
    refuse(variable: SourceTypeFlowVariable, refusal: SourceTypeFlowRefusal): void;
}
export declare function isSourceTypeFlowDeclaredConstruction(node: SourceTypeFlowNode): boolean;
export declare function createSourceTypeFlowTerms(ast: AstReader, graph: SourceTypeFlowGraph): SourceTypeFlowTerms;
//# sourceMappingURL=terms.d.ts.map