import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptor, SourceTypeDescriptorTupleElement } from "../../source-semantics/descriptor-model.js";
import type { SourceRefusal } from "./facts.js";
/** A native pointer marker call (writer A2 value model): operation, Host pointee and result, operands in marker order. */
export interface SourcePointerOperationRecord {
    readonly call: Node;
    readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer";
    readonly pointee: SourceTypeDescriptor;
    readonly result: SourceTypeDescriptor;
    /** The operand expressions in marker parameter order (storage, initial value, pointer, value, identity/read/write ...). */
    readonly operands: readonly Node[];
    /** address-of / allocate / bind-pointer: the storage location identity. */
    readonly location?: Node;
    readonly storageDeclaration?: Node;
}
/**
 * One selected argument binding, in effective (spread-expanded) order. A spread of a tuple-typed value binds one entry
 * per tuple element ("spread-element", `spreadElement` = the element index); a spread of an open sequence binds one
 * "spread-sequence" entry with mode "spread".
 */
export interface SourceArgumentCorrespondence {
    readonly argument: Node;
    readonly argumentIndex: number;
    readonly effectiveIndex: number;
    readonly parameterIndex: number;
    readonly mode: "positional" | "rest-element" | "spread";
    readonly form: "value" | "spread-element" | "spread-sequence";
    readonly spreadElement?: number;
}
/** A slot of the selected signature: its declaration and arity kind. */
export interface SourceCallSignatureParameter {
    readonly declaration: Node;
    readonly kind: "required" | "optional" | "rest";
}
/** A selected signature parameter at this use: the slot plus its name and instantiated descriptor. */
export interface SourceCallParameter extends SourceCallSignatureParameter {
    readonly name: string;
    readonly type: SourceTypeDescriptor;
}
/** Selected callee of a call, `new` or tagged template. Generic arguments: SourceProgramFacts.instantiations. */
export interface SourceCallSelection {
    readonly use: Node;
    readonly kind: "call" | "construction" | "tagged-template" | "super-call";
    readonly callee: Node;
    readonly declaration?: Node;
    readonly signature: Node;
    readonly overloadIndex: number;
    readonly receiver?: Node;
    readonly arguments: readonly SourceArgumentCorrespondence[];
    /** The selected signature's slots (declaration, kind), aligned with `parameters`. */
    readonly signatureParameters: readonly SourceCallSignatureParameter[];
    /** The selected signature's parameters at this use, instantiated, aligned with `signatureParameters`. */
    readonly parameters: readonly SourceCallParameter[];
    readonly result: SourceTypeDescriptor;
    readonly optionalChain: boolean;
}
export interface SourceMemberAccessSelection {
    readonly use: Node;
    readonly receiver: Node;
    readonly receiverType: SourceTypeDescriptor;
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
    readonly result: SourceTypeDescriptor;
    readonly access: "read" | "write" | "read-write" | "call";
    readonly optionalChain: boolean;
    /**
     * The access is not writable (FX-CC #7): the selected member has a readonly modifier (also through a readonly mapped
     * modifier), is a getter without a setter, or the selected index signature is readonly. Every receiver kind (class,
     * interface, array, primitive, union), as SourceElementAccessRecord.readonly.
     */
    readonly readonly: boolean;
}
/** An object literal element and the destination member it fills. */
export interface SourceObjectLiteralElementSelection {
    readonly objectLiteral: Node;
    readonly element: Node;
    readonly elementKind: "property" | "shorthand" | "method" | "get" | "set" | "spread";
    readonly destination?: {
        readonly declarations: readonly Node[];
        readonly type: SourceTypeDescriptor;
    };
    readonly value: SourceTypeDescriptor;
}
export interface SourceIterationSelection {
    readonly statement: Node;
    readonly protocol: "array" | "string" | "iterator" | "async-iterator";
    readonly iterable: SourceTypeDescriptor;
    readonly element: SourceTypeDescriptor;
    readonly iteratorMethod?: Node;
}
/**
 * A for-await whose iterable has no single iteration protocol (Q94): "mixed" = a union whose arms select different
 * protocols (one entry per arm protocol, checker order), "untyped" = no typed protocol. The Host raises no Source code;
 * the target refuses the loop with its own code (C# CSHARP_ITERATION_PROTOCOL, baseline texts).
 */
export interface SourceUnresolvedIterationSelection {
    readonly kind: "unresolved-protocol";
    readonly statement: Node;
    readonly iterable: SourceTypeDescriptor;
    readonly reason: "mixed" | "untyped";
    readonly alternatives: readonly {
        readonly protocol: SourceIterationSelection["protocol"];
        readonly iteratorMethod?: Node;
    }[];
}
/**
 * The Host contextual tuple of an array literal (R2 #17; baseline contextual-tuple-literal.ts rules): selected when the
 * literal's Host destination is a tuple of required and optional elements only, with no more present elements than
 * the tuple has and every omitted position an optional one (trailing omission). "unavailable" otherwise: no tuple
 * destination, a rest or variadic element, more present elements than positions, a spread element, or an omitted
 * required position.
 */
export type SourceTupleLiteralSelection = {
    readonly kind: "selected";
    readonly literal: Node;
    readonly type: SourceTypeDescriptor;
    readonly elements: readonly SourceTypeDescriptorTupleElement[];
    readonly omittedOptionalElementIndexes: readonly number[];
} | {
    readonly kind: "unavailable";
};
export interface SourceGeneratorSelection {
    readonly callable: Node;
    readonly kind: "generator" | "async-generator";
    readonly yieldType: SourceTypeDescriptor;
    readonly returnType: SourceTypeDescriptor;
    readonly nextType: SourceTypeDescriptor;
}
export interface SourceCompletionSelection {
    readonly callable: Node;
    readonly kind: "sync" | "async" | "generator" | "async-generator";
    readonly result: SourceTypeDescriptor;
    /** The body can complete normally (fall off its end): the checker reachability witness (R-B4-9). */
    readonly canFallThrough: boolean;
}
/** One disposable arm of a resource: the arm's Host descriptor and the dispose member selected for it. */
export interface SourceResourceAlternative {
    readonly type: SourceTypeDescriptor;
    readonly kind: "sync" | "async";
    readonly dispose: Node;
}
export interface SourceResourceSelection {
    readonly declaration: Node;
    readonly async: boolean;
    /** One entry per present arm of the declaration's Host type, in Host arm order (authored-first). */
    readonly alternatives: readonly SourceResourceAlternative[];
}
export interface SourceStorageSelection {
    readonly expression: Node;
    readonly storageExpression: Node;
    readonly declaration?: Node;
    readonly type: SourceTypeDescriptor;
    /** The location can be assigned (the checker storage witness: not const, readonly or getter-only). */
    readonly writable: boolean;
}
/** A `yield` / `yield*` expression and its generator. */
export interface SourceYieldSelection {
    readonly expression: Node;
    readonly generator: Node;
    readonly kind: "value" | "delegate";
    readonly operand?: Node;
    /** `yield*` only: the iteration selection over the delegated operand. */
    readonly delegation?: SourceIterationSelection;
}
export interface SourceSelectionFacts {
    call(use: Node): SourceCallSelection | SourceRefusal | undefined;
    memberAccess(use: Node): SourceMemberAccessSelection | undefined;
    objectLiteralElement(element: Node): SourceObjectLiteralElementSelection | undefined;
    iteration(statement: Node): SourceIterationSelection | SourceUnresolvedIterationSelection | SourceRefusal | undefined;
    generator(callable: Node): SourceGeneratorSelection | undefined;
    /** The contextual tuple selection of an array literal; never undefined for an array literal (R2 #17). */
    tupleLiteral(arrayLiteral: Node): SourceTupleLiteralSelection;
    completion(callable: Node): SourceCompletionSelection | undefined;
    /** undefined for a declaration that is not `using` / `await using`; untyped (dynamic) disposal is a refusal. */
    resource(declaration: Node): SourceResourceSelection | SourceRefusal | undefined;
    storage(expression: Node): SourceStorageSelection | undefined;
    /** undefined for a node that is not a yield expression; a refused delegation is a refusal. */
    yield(expression: Node): SourceYieldSelection | SourceRefusal | undefined;
    /** Well-known symbol named by a computed key or element access (`Symbol.iterator` ...). */
    wellKnownSymbol(node: Node): string | undefined;
    /** Native pointer marker operation (address-of, allocate, load, store ...): descriptors, operands, location. */
    pointerOperation(call: Node): SourcePointerOperationRecord | SourceRefusal | undefined;
}
//# sourceMappingURL=selections.d.ts.map