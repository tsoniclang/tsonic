import type { Node } from "@tsonic/tsts";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type { SourceInstantiation, SourceNullishAdmission, SourceRefusal, SourceTypeOutcome, SourceUnionRelation } from "../../public/source/facts.js";
import type { SourceClosedSum, SourceTypeDescriptor, SourceTypeFlowSource } from "./types.js";
import type { SourceHostInput } from "../../host-input/index.js";
export interface SourceRelationInputs {
    readonly source: SourceTypeFlowSource;
    readonly input: SourceHostInput;
    type(node: Node): SourceTypeOutcome;
    /** The Host destination slot a value use flows into (values.contextual). */
    contextual(node: Node): SourceTypeOutcome | undefined;
    sumOf(type: SourceTypeDescriptor): SourceClosedSum | undefined;
    declaredSlotType(declaration: Node): SourceTypeDescriptor | undefined;
    literal(node: Node): SourceLiteralValue | undefined;
    /** The typeof-site record (A1/A7, K-2657): the one owner of every operand and arm category. */
    typeofCategory(operation: Node, operand: Node): SourceNullishAdmission | SourceRefusal;
    instantiation(use: Node): SourceInstantiation | undefined;
}
export interface SourceRelationQuery {
    /** The one relation of a node, by priority (spread write, cast, test, per-arm, narrowed read, write). */
    at(use: Node): SourceUnionRelation | undefined;
    /** The write relation of a value use into its Host slot, whatever other relation the node has (BUILD-FIX Q1). */
    write(use: Node): SourceUnionRelation | undefined;
}
/**
 * The instance a constructor value constructs (the `instanceof` relation's `instance`): the one result of its construct
 * signatures. undefined when the value has no construct signature or its construct signatures disagree.
 */
export declare function sourceTypeDescriptorConstructedInstance(constructor: SourceTypeDescriptor): SourceTypeDescriptor | undefined;
export declare function createSourceRelationQuery(inputs: SourceRelationInputs): SourceRelationQuery;
//# sourceMappingURL=relations.d.ts.map