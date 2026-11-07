// Per-use operation selections: the Host translation of checker selection witnesses (host-input/),
// replacing semantics.forNode(n).operations. Declarations and descriptors only (I1).
import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../source-semantics/local-type-flow/types.js";
import type { SourceRefusal } from "./facts.js";
import type { SourcePointerOperationRecord } from "../../source-semantics/local-type-flow/program-facts.js";

export type { SourcePointerOperationRecord };

/**
 * One selected argument binding, in effective (spread-expanded) order. A spread of a tuple-typed value binds one entry
 * per tuple element ("spread-element", `spreadElement` = the element index); a spread of an open sequence binds one
 * "spread-sequence" entry with mode "spread".
 */
export interface SourceArgumentCorrespondence {
  readonly argument: Node;                      // the authored argument expression (the SpreadElement for a spread)
  readonly argumentIndex: number;               // authored position
  readonly effectiveIndex: number;              // position after spread expansion (= index in `arguments`)
  readonly parameterIndex: number;              // selected signature parameter (the rest parameter for rest bindings)
  readonly mode: "positional" | "rest-element" | "spread";
  readonly form: "value" | "spread-element" | "spread-sequence";
  readonly spreadElement?: number;              // element index inside a spread tuple ("spread-element" only)
}

/** A slot of the selected signature: its declaration and arity kind. */
export interface SourceCallSignatureParameter {
  readonly declaration: Node;                   // the parameter declaration of the selected signature
  readonly kind: "required" | "optional" | "rest";
}

/** A selected signature parameter at this use: the slot plus its name and instantiated descriptor. */
export interface SourceCallParameter extends SourceCallSignatureParameter {
  readonly name: string;                        // the authored identifier, or `arg<index>` for a binding pattern
  readonly type: SourceTypeDescriptor;          // after instantiation (instantiations.at(use).parameters[i])
}

/** Selected callee of a call, `new` or tagged template. Generic arguments: SourceProgramFacts.instantiations. */
export interface SourceCallSelection {
  readonly use: Node;
  readonly kind: "call" | "construction" | "tagged-template" | "super-call";
  readonly callee: Node;                       // the callee expression
  readonly declaration?: Node;                 // the called declaration (function, method, class)
  readonly signature: Node;                    // the selected signature declaration
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
  readonly receiverValue?: { readonly declaration?: Node; readonly intrinsic?: "global-object" };
  readonly name: string;
  readonly selected:
    | { readonly kind: "member"; readonly declarations: readonly Node[] }
    | { readonly kind: "index-signature"; readonly declaration: Node };
  readonly result: SourceTypeDescriptor;
  readonly access: "read" | "write" | "read-write" | "call";
  readonly optionalChain: boolean;
}

/** An object literal element and the destination member it fills. */
export interface SourceObjectLiteralElementSelection {
  readonly objectLiteral: Node;
  readonly element: Node;
  readonly elementKind: "property" | "shorthand" | "method" | "get" | "set" | "spread";
  readonly destination?: { readonly declarations: readonly Node[]; readonly type: SourceTypeDescriptor };
  readonly value: SourceTypeDescriptor;
}

export interface SourceIterationSelection {
  readonly statement: Node;                     // for-of / spread / destructuring / yield*
  readonly protocol: "array" | "string" | "iterator" | "async-iterator";
  readonly iterable: SourceTypeDescriptor;
  readonly element: SourceTypeDescriptor;
  readonly iteratorMethod?: Node;               // the [Symbol.iterator] / [Symbol.asyncIterator] declaration
}

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
  readonly result: SourceTypeDescriptor;          // the authored or solved completion value type
  /** The body can complete normally (fall off its end): the checker reachability witness (R-B4-9). */
  readonly canFallThrough: boolean;
}

/** One disposable arm of a resource: the arm's Host descriptor and the dispose member selected for it. */
export interface SourceResourceAlternative {
  readonly type: SourceTypeDescriptor;           // a present (non-absent) arm of the declaration's Host type
  readonly kind: "sync" | "async";
  readonly dispose: Node;                        // the [Symbol.dispose] / [Symbol.asyncDispose] declaration
}

export interface SourceResourceSelection {
  readonly declaration: Node;                    // `using` / `await using` declaration
  readonly async: boolean;                       // `await using`
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
  readonly expression: Node;                     // the YieldExpression
  readonly generator: Node;                      // the generator callable declaration
  readonly kind: "value" | "delegate";
  readonly operand?: Node;
  /** `yield*` only: the iteration selection over the delegated operand. */
  readonly delegation?: SourceIterationSelection;
}

export interface SourceSelectionFacts {
  call(use: Node): SourceCallSelection | SourceRefusal | undefined;
  memberAccess(use: Node): SourceMemberAccessSelection | undefined;
  objectLiteralElement(element: Node): SourceObjectLiteralElementSelection | undefined;
  iteration(statement: Node): SourceIterationSelection | SourceRefusal | undefined;
  generator(callable: Node): SourceGeneratorSelection | undefined;
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
