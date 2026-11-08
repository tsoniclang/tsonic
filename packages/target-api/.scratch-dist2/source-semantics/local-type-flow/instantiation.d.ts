import type { Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../../source-navigation/types.js";
import { type SourceTypeDescriptorUnions } from "./terms.js";
import type { SourceEffectiveTypeArgument, SourceTypeDescriptor } from "./types.js";
/** Binder declaration -> its Host descriptor: the one binding representation. */
export type SourceTypeFlowBinderBindings = ReadonlyMap<Node, SourceTypeDescriptor>;
/** The published argument vector of a binder list under bindings (frozen, in binder order). */
export declare function sourceTypeFlowBinderArguments(unions: SourceTypeDescriptorUnions, binders: readonly Node[], bindings: SourceTypeFlowBinderBindings): readonly SourceEffectiveTypeArgument[];
/** A type instantiated under bindings (the one substitution), frozen; undefined when the descriptor is not this program's. */
export declare function sourceTypeFlowInstantiate(unions: SourceTypeDescriptorUnions, bindings: SourceTypeFlowBinderBindings, type: SourceTypeDescriptor): SourceTypeDescriptor | undefined;
/**
 * The receiver binder values of a member selected on `owner` (its type parameters `binders`) for a receiver whose Host
 * descriptor is `receiver` (REVIEW-R1 #5: one rule, by declaration identity, never by name). Through absence and
 * declared definitions:
 * - a declared reference to the owner, or to a declaration merged with it, binds the binders to its type arguments;
 * - an array binds the owner's one binder to its element (an array member's owner has the element as its binder);
 * - a tuple, read as its array view, binds the one binder to the union of its element types (Host order).
 * undefined: the receiver states no type arguments for the owner.
 */
export declare function sourceTypeFlowReceiverBinderValues(inputs: {
    readonly unions: SourceTypeDescriptorUnions;
    readonly navigation: Pick<SourceProgramNavigation, "mergedDeclarations">;
}, receiver: SourceTypeDescriptor | undefined, owner: Node, binders: readonly Node[]): readonly SourceTypeDescriptor[] | undefined;
/**
 * Matches a generic function value's signature (`formal`) against its destination (`actual`), binding the method
 * `binders` it meets into `bound`. Returns false on a conflict (one binder bound to two different descriptors). Union
 * arms are not paired: Host arm order is authored-first per descriptor, not positional across descriptors.
 */
export declare function sourceTypeFlowUnifyBinders(binders: ReadonlySet<Node>, formal: SourceTypeDescriptor, actual: SourceTypeDescriptor, bound: Map<Node, SourceTypeDescriptor>): boolean;
//# sourceMappingURL=instantiation.d.ts.map