import type { Node } from "@tsonic/tsts";
import type { SourceLiteralValue } from "../literal-values-model.js";
import { type SourceTypeDescriptorUnions } from "./terms.js";
import { type SourceNumberOrigin } from "./literal-publication.js";
import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceClosedSum, SourceEffectiveTypeArgument, SourceEffectiveTypeOutcome, SourceEffectiveTypes, SourceTypeDescriptor, SourceTypeFlowRefusal, SourceTypeFlowSource } from "./types.js";
/** The solved value model of one program: the published effective types plus the internal inputs of the fact builders. */
/** The published Host readers the origin tracer reads (values.type and sums.sumOf of the program view). */
export interface SourceNumberOriginInputs {
    typeOf(node: Node): SourceTypeDescriptor | undefined;
    sumOf(type: SourceTypeDescriptor): SourceClosedSum | undefined;
}
export interface SourceSolvedValueModel extends SourceEffectiveTypes {
    readonly owner: SourceTypeDescriptorUnions;
    /** Every value node of the program (the totality domain, I4), in program preorder. */
    readonly valueNodes: readonly Node[];
    literal(node: Node): SourceLiteralValue | undefined;
    /** The number origin of a value: present when its Source type is TS `number` (N3 prime). */
    numberOrigin(node: Node): SourceNumberOrigin | undefined;
    /**
     * The pre-Q1 origin kinds of the values that reach a wide-integer value (N3′, C-2499), per contributing component:
     * the one origin tracer (R1 #8). `typeOf` and `sumOf` are the published Host type and sum readers.
     */
    numberOriginKinds(node: Node, inputs: SourceNumberOriginInputs): ReadonlySet<"number" | "bigint"> | undefined;
    /**
     * The literal domain of a value (Q79, FX-HS #27/#31): the distinct constant values it can hold when every value that
     * reaches it is a literal constant, through parentheses, `satisfies`, non-null, conditional and `??` operands and the
     * initializer of an unannotated, unwritten local. undefined: some reaching value is not a constant.
     */
    literalDomain(node: Node): readonly SourceLiteralValue[] | undefined;
    /** The same, for the values that land in one wide-integer arm of a closed sum (per contributing family operand). */
    armNumberOriginKinds(sum: SourceClosedSum, arm: SourceTypeDescriptor, inputs: SourceNumberOriginInputs): ReadonlySet<"number" | "bigint"> | undefined;
    /** The Host outcome of an authored type node (authored-syntax translation); undefined for a node that is not type syntax. */
    typeSyntax(node: Node): SourceEffectiveTypeOutcome | undefined;
    /** The Host destination a value use flows into (declared, parameter or return slot); undefined when none. */
    contextual(node: Node): SourceEffectiveTypeOutcome | undefined;
    /**
     * The slot node of that destination: the declared slot component's declaration, else its authored type node, else the
     * use itself (the same rule as the slot admission producer, literal-publication.ts createSourceSlotAdmissions).
     */
    contextualSlot(node: Node): Node | undefined;
    /** Every node of the program files, in program preorder. */
    readonly nodes: readonly Node[];
    /** The instantiation of a generic callable read as a value (not a call's callee), or its refusal. */
    functionValueInstantiation(use: Node): SourceSolvedFunctionValue | SourceTypeFlowRefusal | undefined;
    /** The declared value of a non-slot declaration (class, function, method, accessor, library declaration). */
    declarationValue(declaration: Node): SourceTypeDescriptor | undefined;
    /** The declared type of an interface or type alias declaration in any program view file (library files included). */
    typeDeclarationValue(declaration: Node): SourceTypeDescriptor | undefined;
}
/** A generic callable value use instantiated against its Host destination (G4 for values). */
export interface SourceSolvedFunctionValue {
    readonly kind: "function-value";
    readonly use: Node;
    readonly signature: Node;
    readonly receiver: readonly SourceEffectiveTypeArgument[];
    readonly method: readonly SourceEffectiveTypeArgument[];
    readonly parameters: readonly SourceTypeDescriptor[];
    readonly result: SourceTypeDescriptor;
}
export declare function analyzeSourceEffectiveTypes(source: SourceTypeFlowSource, unions: SourceTypeDescriptorUnions, input: SourceHostInput): SourceSolvedValueModel;
//# sourceMappingURL=solver.d.ts.map