import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceProgramSemantics } from "./semantics-types.js";
import type { SourceHostInput } from "./index.js";
export interface HostCheckerServices {
    readonly ast: AstReader;
    /**
     * The navigation witnesses this translator reads: merged declarations and the one call witness (host-input
     * navigation input, forwarded by the program navigation), and the reference a callee identifier selects.
     */
    readonly navigation: Pick<SourceNavigationInput, "mergedDeclarations" | "call"> & {
        sourceReferenceFor(node: Node): {
            readonly declaration: Node;
        } | undefined;
    };
    readonly semantics: SourceProgramSemantics;
    /** The program's host-input adapter; its member witness is reused, never re-implemented. */
    readonly input: SourceHostInput;
}
export type HostWitnessRefusal = {
    readonly kind: "refused";
    readonly code: string;
    readonly message: string;
    readonly site: Node;
};
export interface HostCallWitness {
    readonly kind: "call-witness";
    readonly use: Node;
    readonly callKind: "call" | "construction" | "tagged-template" | "super-call";
    readonly callee: Node;
    readonly declaration?: Node;
    readonly signature: Node;
    readonly overloadIndex: number;
    readonly receiver?: Node;
    /** One entry per checker argument binding, in effective order (spread elements expanded). */
    readonly arguments: readonly HostArgumentWitness[];
    /** The selected signature parameters: declaration, authored name and arity kind. */
    readonly parameters: readonly HostParameterWitness[];
    readonly optionalChain: boolean;
}
export interface HostArgumentWitness {
    readonly argument: Node;
    readonly argumentIndex: number;
    readonly effectiveIndex: number;
    readonly parameterIndex: number;
    readonly mode: "positional" | "rest-element" | "spread";
    readonly form: "value" | "spread-element" | "spread-sequence";
    readonly spreadElement?: number;
}
export interface HostParameterWitness {
    readonly declaration: Node;
    readonly name: string;
    readonly kind: "required" | "optional" | "rest";
}
export interface HostMemberAccessWitness {
    readonly use: Node;
    readonly receiver: Node;
    readonly receiverValue?: {
        readonly declaration?: Node;
        readonly intrinsic?: "global-object";
    };
    readonly name: string;
    readonly selected: {
        readonly kind: "member";
        readonly declarations: readonly Node[];
    } | {
        readonly kind: "index-signature";
        readonly declaration: Node;
    };
    readonly access: "read" | "write" | "read-write" | "call";
    readonly optionalChain: boolean;
}
export interface HostObjectLiteralElementWitness {
    readonly objectLiteral: Node;
    readonly element: Node;
    readonly elementKind: "property" | "shorthand" | "method" | "get" | "set" | "spread";
    readonly destinations: readonly Node[];
    readonly value: Node;
}
export type HostIterationWitness = {
    readonly kind: "iteration-witness";
    readonly statement: Node;
    readonly iterable: Node;
    readonly protocol: "array" | "string" | "iterator" | "async-iterator";
    readonly iteratorMethod?: Node;
}
/**
 * A for-await whose iterable has no single protocol (Q94): the per-arm protocols of a union, or no typed protocol.
 * The Host raises no code here; the target refuses it with its own baseline code and texts.
 */
 | {
    readonly kind: "for-await-unresolved";
    readonly statement: Node;
    readonly iterable: Node;
    readonly reason: "mixed" | "untyped";
    readonly alternatives: readonly HostIterationProtocol[];
} | HostWitnessRefusal;
export interface HostResourceWitness {
    readonly kind: "resource-witness";
    readonly async: boolean;
    /** Checker alternatives in checker order; the Host pairs each with an arm of the declaration's Host type. */
    readonly alternatives: readonly {
        readonly kind: "sync" | "async";
        readonly dispose: Node;
    }[];
}
export interface HostYieldWitness {
    readonly expression: Node;
    readonly generator: Node;
    readonly kind: "value" | "delegate";
    readonly operand?: Node;
    /** `yield*` only: the protocol the checker selected over the operand, or its refusal. */
    readonly delegation?: HostIterationProtocol | HostWitnessRefusal;
}
export interface HostIterationProtocol {
    readonly kind: "iteration-protocol";
    readonly protocol: "array" | "string" | "iterator" | "async-iterator";
    readonly iteratorMethod?: Node;
}
export interface HostCheckerInput {
    mergedDeclarations(declaration: Node): readonly Node[];
    call(use: Node): HostCallWitness | HostWitnessRefusal | undefined;
    memberAccess(use: Node): HostMemberAccessWitness | undefined;
    objectLiteralElement(element: Node): HostObjectLiteralElementWitness | undefined;
    iteration(statement: Node): HostIterationWitness | undefined;
    generator(callable: Node): {
        readonly async: boolean;
    } | undefined;
    /** The checker reachability witness of a callable body; undefined for a callable without a body. */
    completion(callable: Node): {
        readonly canFallThrough: boolean;
    } | undefined;
    /** A `using` declaration: per-alternative disposal kind and dispose member, or the untyped-disposal refusal. */
    resource(declaration: Node): HostResourceWitness | HostWitnessRefusal | undefined;
    storage(expression: Node): {
        readonly storageExpression: Node;
        readonly declaration?: Node;
        readonly writable: boolean;
    } | undefined;
    /** A yield expression: its generator declaration, kind and operand. */
    yield(expression: Node): HostYieldWitness | undefined;
    wellKnownSymbol(node: Node): string | undefined;
}
export declare function createHostCheckerInput(services: HostCheckerServices): HostCheckerInput;
//# sourceMappingURL=objects.d.ts.map