// Per-use operation selections: the Host translation of checker selection witnesses (host-input/),
// replacing semantics.forNode(n).operations. Declarations and descriptors only (I1).
import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../source-semantics/local-type-flow/types.js";
import type { SourceRefusal } from "./facts.js";
import type { SourcePointerOperationRecord } from "../../source-semantics/local-type-flow/program-facts.js";

export type { SourcePointerOperationRecord };

export interface SourceArgumentCorrespondence {
  readonly argument: Node;
  readonly parameterIndex: number;
  readonly mode: "positional" | "rest-element" | "spread";
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
  readonly parameters: readonly SourceTypeDescriptor[];     // after instantiation
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
}

export interface SourceResourceSelection {
  readonly declaration: Node;                    // `using` / `await using` declaration
  readonly async: boolean;
  readonly dispose: Node;                        // the [Symbol.dispose] / [Symbol.asyncDispose] declaration
}

export interface SourceStorageSelection {
  readonly expression: Node;
  readonly storageExpression: Node;
  readonly declaration?: Node;
  readonly type: SourceTypeDescriptor;
}

export interface SourceSelectionFacts {
  call(use: Node): SourceCallSelection | SourceRefusal | undefined;
  memberAccess(use: Node): SourceMemberAccessSelection | undefined;
  objectLiteralElement(element: Node): SourceObjectLiteralElementSelection | undefined;
  iteration(statement: Node): SourceIterationSelection | SourceRefusal | undefined;
  generator(callable: Node): SourceGeneratorSelection | undefined;
  completion(callable: Node): SourceCompletionSelection | undefined;
  resource(declaration: Node): SourceResourceSelection | undefined;
  storage(expression: Node): SourceStorageSelection | undefined;
  /** Well-known symbol named by a computed key or element access (`Symbol.iterator` ...). */
  wellKnownSymbol(node: Node): string | undefined;
  /** Native pointer marker operation (address-of, allocate, load, store ...): descriptors, operands, location. */
  pointerOperation(call: Node): SourcePointerOperationRecord | SourceRefusal | undefined;
}
