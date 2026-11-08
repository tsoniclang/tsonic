import type { AstReader, Node, ReadonlySourceFactResolver, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import { type SourceMemberOriginResult } from "./member-origins.js";
import type { SourceProgramSemantics } from "./semantics-types.js";
import { type SourceHostNullishComponents } from "./nullish-components.js";
import { type SourceHostComponent, type SourceHostPresence, type SourceHostQueries, type SourceHostType } from "./queries.js";
import type { SourcePlatformFacts } from "../source-semantics/platform-model.js";
import type { SourceEnumIntegerWidthSelection } from "../source-semantics/enum-model.js";
/**
 * The checker's selection at a call, `new`, tagged template or `super(...)` use, as declarations only: a projection of
 * the one call witness (SourceNavigationCall, host-input/navigation.ts).
 */
export interface SourceHostCallWitness {
    readonly use: Node;
    /** The selected signature declaration; undefined for a signature with no declaration (an intrinsic). */
    readonly signature: Node | undefined;
    /** The receiver expression of a member call, else the callee expression. */
    readonly receiver: Node | undefined;
    readonly optionalChain: boolean;
}
/**
 * The checker's selection at a property or element access, as declarations only: a projection of the one member-access
 * witness (SourceNavigationMemberAccess, host-input/navigation.ts).
 */
export interface SourceHostMemberWitness {
    readonly use: Node;
    readonly receiver: Node;
    /**
     * The selected member declaration(s), in order: the read declaration (get accessor), the selected declaration, then
     * the write declaration (set accessor). Duplicates appear once.
     */
    readonly declarations: readonly Node[];
    /** The declaration a write through this access targets (the set accessor of an accessor pair); undefined for none. */
    readonly writeDeclaration: Node | undefined;
    readonly accessMode: "read" | "write" | "read-write" | "delete";
    readonly optionalChain: boolean;
    /** The access is the callee of a call through transparent wrappers (checker access witness). */
    readonly callCallee: boolean;
}
/** Authored narrowing witness: the authored arms of a declaration's annotation that remain at a read. */
export interface SourceHostAuthoredNarrowing {
    readonly nodes: readonly Node[];
    /** How many nullish arms the narrowed read keeps (absence when > 0). */
    readonly nullishCount: number;
}
/** The narrowed constituents at a read (narrowed-arms witness). */
export interface SourceHostNarrowedMembers {
    readonly members: readonly SourceHostComponent[];
    readonly absent: boolean;
}
export interface SourceHostInput {
    /** The checker query facade of the file that contains `node` (program or library file). */
    at(node: Node): SourceHostQueries;
    /** The facade of a program file; undefined for a node outside the program's checked files. */
    file(node: Node): SourceHostQueries | undefined;
    /** The facade of the program's first source file (used for library declarations reached from no program use). */
    program(): SourceHostQueries | undefined;
    /** Whether a node lies in a program file the checker views. */
    includes(node: Node): boolean;
    call(use: Node): SourceHostCallWitness | undefined;
    member(use: Node): SourceHostMemberWitness | undefined;
    /** Flow presence witness at a value read; undefined when the checker has no answer for the node. */
    presence(node: Node): SourceHostPresence | undefined;
    /** Presence witness of a selected component (a declared, parameter or result component). */
    componentPresence(component: SourceHostComponent, at: Node): SourceHostPresence;
    /** The intrinsic null / undefined constituents of the value read at node: the presence witness split before the
     * one-absence erasure (E9). The Host admission rule (program-facts.ts) decides from it. */
    nullishComponents(node: Node): SourceHostNullishComponents;
    /**
     * Self-reference witness (an identity answer, never a type): whether the checked type of the returned expression
     * `returned` reaches the checked type of the callable `declaration` itself. The recursive-return rule (which callables,
     * which returned expressions, the refusal) is the Host's (local-type-flow/callable-returns.ts).
     */
    returnReachesCallable(declaration: Node, returned: Node): boolean;
    /**
     * G4 contribution path witness: whether the value at `node` is the union member a recorded inference contribution
     * flowed through ("selected"), another single member ("other"), or an unselected union ("ambiguous"). undefined: no
     * checked answer at the node.
     */
    unionMemberWitness(node: Node, member: SourceHostType): "selected" | "other" | "ambiguous" | undefined;
    /** Whether the value at an argument occurrence already has exactly the formal parameter type (no binder input). */
    argumentHasFormalType(occurrence: Node, formal: SourceHostType): boolean;
    /**
     * The one destination-member selector (R1 #13): the member (canonical origin) an object-literal property fills, by the
     * checker's structural member correspondence (sourceObjectLiteralDestinationMember) between the literal's construction
     * and its destination: the given component, else the checked type at `destinationAt`, else the property's contextual
     * type. A member-selection witness (R3). undefined: no single destination member; a "refused" origin: a mapped member
     * with no single key. The reader decides what an unresolved origin means.
     */
    objectLiteralDestination(literal: Node, property: Node, destination: {
        readonly component?: SourceHostComponent;
        readonly destinationAt?: Node;
    }): SourceMemberOriginResult | undefined;
    /**
     * Declaration witness of a regular expression literal: the library declaration it constructs (the global `RegExp`
     * interface) with that declaration's declared type. An identity answer (R3): the literal's value is that declaration.
     */
    regularExpressionComponent(node: Node): SourceHostComponent | undefined;
    /**
     * Narrowing witness at a project reference: whether control flow narrowed the read below its declared type. The Host
     * keeps its own descriptor; this only says whether narrowing applies.
     */
    narrowed(node: Node): boolean;
    /**
     * Whether the declared type of the reference at `occurrence` (else of `declaration`) admits absence. Declaration input;
     * selects whether a presence witness can drop an absence arm.
     */
    declaredAdmitsAbsence(occurrence: Node, declaration: Node | undefined): boolean;
    /**
     * The authored arms of `annotation` (the declaration's own annotation) that remain at the identifier read `node` after
     * control-flow narrowing. undefined: the read is not narrowed, or the narrowed type is not a selection of authored arms.
     */
    authoredNarrowing(node: Node, declaration: Node, annotation: Node): SourceHostAuthoredNarrowing | undefined;
    /**
     * Narrowed-arms witness at an identifier read whose declared type control flow narrowed: the non-nullish constituents
     * of the narrowed read (each an opaque component the Host describes only to select its OWN arms) and whether a nullish
     * constituent remains. The Host keeps the arms of its declared descriptor that these constituents select (R3: the read
     * descriptor is built from Host arms, never from the checked read type). undefined: not narrowed.
     */
    narrowedMembers(node: Node): SourceHostNarrowedMembers | undefined;
    /**
     * Narrowing witness (a declaration identity, never a type, R3): the project class whose instances control flow
     * narrowed this identifier read to (an `instanceof` guard). The Host describes the read from that class's own declared
     * instance type, the same instance its `instanceof` test relation publishes. undefined otherwise.
     */
    narrowedClass(node: Node): Node | undefined;
    /**
     * Declaration input: the member declarations named `name` on the declared type of a class, interface, alias, enum or
     * type parameter declaration (a type parameter and an enum answer through their apparent members: the constraint, the
     * primitive's library interface). Used where the Host descriptor has no structure for the declaration (a recursion cut,
     * a declaration-file type the descriptor cannot express, an enum, a type parameter). Never an inferred type.
     * undefined: the declared type has no member of that name.
     */
    declaredMembers(declaration: Node, name: string): readonly Node[] | undefined;
}
export interface SourceHostInputServices {
    readonly ast: AstReader;
    readonly semantics: SourceProgramSemantics;
    readonly sourceFacts: ReadonlySourceFactResolver;
    readonly navigation: SourceProgramNavigation;
    readonly sourceFiles: readonly SourceFile[];
    /** The active target's native integer premise (E24); carried into the type-flow source the descriptor reader reads. */
    readonly platform: SourcePlatformFacts;
    /** The integer width of a numeric enum (enum-constants.ts); carried into the type-flow source. */
    enumIntegerWidth(declaration: Node): SourceEnumIntegerWidthSelection | undefined;
}
/** One adapter per program view; lifetime is the program's (I5). */
export declare function createSourceHostInput(services: SourceHostInputServices): SourceHostInput;
//# sourceMappingURL=index.d.ts.map