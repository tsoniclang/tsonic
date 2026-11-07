// The Source type descriptor vocabulary and its pure algebra (structure, equality, literal keys): the checker-free
// model every Host producer and the public contract share (I1). No program state, no checker input. The value model
// (local-type-flow) builds descriptors; this module only names and compares them.
import type { Node, SourceFile, SourcePrimitiveKind } from "@tsonic/tsts";

export type SourceTypeDescriptor =
  | { readonly kind: "primitive"; readonly primitive: SourcePrimitiveKind }
  | { readonly kind: "string" }
  | { readonly kind: "intrinsic"; readonly intrinsic: "any" | "unknown" | "object" | "void" | "never" | "absence" | "bigint" | "symbol" }
  | { readonly kind: "union"; readonly types: readonly SourceTypeDescriptor[] }
  | { readonly kind: "array"; readonly readonly: boolean; readonly element: SourceTypeDescriptor }
  | { readonly kind: "tuple"; readonly readonly: boolean; readonly elements: readonly SourceTypeDescriptorTupleElement[] }
  | { readonly kind: "shape"; readonly members: readonly SourceTypeDescriptorMember[]; readonly indexes: readonly SourceTypeDescriptorIndex[];
      readonly calls: readonly SourceTypeDescriptorSignature[]; readonly constructs: readonly SourceTypeDescriptorSignature[] }
  | { readonly kind: "callable"; readonly calls: readonly SourceTypeDescriptorSignature[]; readonly constructs: readonly SourceTypeDescriptorSignature[] }
  | {
      readonly kind: "declared";
      readonly declaration: Node;
      readonly typeArguments: readonly SourceTypeDescriptor[];
      readonly definition?: SourceTypeDescriptor;
      // Present exactly when a class, interface or alias reference has no definition (C-2263, K-2447):
      // "recursion" = the reference is a recursion cut of a definition already being described;
      // "unexpressible" = a declaration-file type whose structure the descriptor cannot express (C29 floor).
      // A consumer that needs the structure of an "unexpressible" reference refuses; it never rebuilds it.
      // Enum and type-parameter references carry neither definition nor cut.
      readonly cut?: "recursion" | "unexpressible";
      // Present exactly on a FixedArray<T, N> reference (the declaration carries the canonical "fixed-array" type marker):
      // the extent N, read from the authored type argument (through aliases), never from a checked type (R-C4-1, R3).
      // FixedArray<T, 4> and FixedArray<T, 8> are distinct descriptors.
      readonly extent?: { readonly length: bigint; readonly lengthRuntimeBase: "number" | "bigint" };
    }
  | { readonly kind: "optional"; readonly value: SourceTypeDescriptor };

export interface SourceTypeDescriptorSignature {
  readonly declaration?: Node;
  readonly typeParameters: readonly Node[];
  readonly parameters: readonly {
    readonly declaration?: Node;
    readonly kind: "required" | "optional" | "rest";
    readonly type: SourceTypeDescriptor;
  }[];
  readonly result: SourceTypeDescriptor;
}

export interface SourceTypeDescriptorTupleElement {
  readonly kind: "required" | "optional" | "rest";
  readonly type: SourceTypeDescriptor;
  readonly declaration?: Node;
}

export interface SourceLiteralMemberCorrespondence {
  readonly property: Node;
  readonly origin: SourceTypeDescriptorMember["origin"];
}

export type SourceMemberKey =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "unique-symbol"; readonly declaration: Node };

export interface SourceTypeDescriptorMember {
  readonly name: string;
  readonly optional: boolean;
  readonly type: SourceTypeDescriptor;
  readonly origin:
    | { readonly kind: "declared"; readonly declaration: Node }
    | { readonly kind: "class-prototype"; readonly owner: Node }
    | { readonly kind: "mapped"; readonly owner: Node; readonly key: SourceMemberKey };
  readonly readonly?: boolean;
  // Present exactly when the member's declared type in this arm is a literal type or a union of literal types (string,
  // number, bigint, boolean; enum members by value; the full `boolean` domain is not literal): its distinct literal values,
  // a set sorted by value key (05 §2a D-2, R6). `type` stays the erased base type: the canonical descriptor has no literal
  // types, so the literal evidence is carried with the member identity. Literals are part of the shape's equality and
  // identity, so two otherwise-equal arms with different discriminator literals stay two arms; substitution keeps them.
  readonly literals?: readonly SourceTypeDescriptorLiteral[];
}

export type SourceTypeDescriptorLiteral =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "bigint"; readonly value: bigint }
  | { readonly kind: "boolean"; readonly value: boolean };

export interface SourceTypeDescriptorIndex {
  readonly declaration: Node;
  readonly key: SourceTypeDescriptor;
  readonly value: SourceTypeDescriptor;
  readonly readonly: boolean;
}

export type SourceTypeFlowRefusalCode =
  | "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE"
  | "TSONIC_LOCAL_TYPE_CONFLICT"
  | "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS"
  | "TSONIC_LOCAL_TYPE_SIGNATURE"
  | "TSONIC_UNTYPED_OBJECT_LITERAL"
  | "TSONIC_UNTYPED_ARRAY_LITERAL"
  | "TSONIC_LOCAL_TYPE_ACCUMULATOR"
  | "TSONIC_LOCAL_TYPE_UNION"
  | "TSONIC_LOCAL_TYPE_SELF_REFERENCE"
  | "TSONIC_LOCAL_TYPE_ADDRESS"
  | "TSONIC_LOCAL_TYPE_LIMIT"
  | "TSONIC_LOCAL_TYPE_GENERIC"
  | "TSONIC_LOCAL_TYPE_NUMBER_ERASURE_INEXACT"
  | "TSONIC_LOCAL_TYPE_UNSUPPORTED"
  | "TSONIC_NATIVE_INTEGER_WIDTH_MISSING"
  | "TSONIC_NATIVE_INTEGER_WIDTH_CONFLICTING";

export interface SourceTypeFlowRefusal {
  readonly kind: "refused";
  readonly source: "tsonic";
  readonly code: SourceTypeFlowRefusalCode;
  readonly site: Node;
  readonly related?: Node;
  readonly reason: string;
}

export interface SourceEffectiveTypeProvenance {
  readonly group: Node;
  readonly occurrence: Node;
  readonly sourceFile: SourceFile;
  readonly principal?: {
    readonly declaration: Node;
    readonly initializer: Node;
  };
  readonly filledBy?: Node;
  readonly component?: {
    readonly declaration?: Node;
    readonly authoredTypeNode?: Node;
  };
  readonly fixedRule?: SourceTypeFlowFixedRule;
}

export type SourceTypeFlowFixedRule = {
  readonly kind: "loop-counter";
  readonly declaration: Node;
};

export type SourceEffectiveTypeOutcome =
  | {
      readonly kind: "resolved" | "default";
      readonly type: SourceTypeDescriptor;
      readonly construction?: SourceTypeDescriptor;
      readonly memberCorrespondence?: readonly SourceLiteralMemberCorrespondence[];
      readonly provenance: SourceEffectiveTypeProvenance;
    }
  | SourceTypeFlowRefusal;

export interface SourceEffectiveTypeArgument {
  readonly declaration: Node;
  readonly type: SourceTypeDescriptor;
}

export interface SourceSumIdentity {
  readonly family: Node;
  readonly application: readonly SourceTypeDescriptor[];
}

export interface SourceClosedSum {
  readonly identity: SourceSumIdentity;
  readonly arms: readonly { readonly role: number; readonly type: SourceTypeDescriptor }[];
  readonly roles: readonly { readonly role: number; readonly arms: readonly number[] }[];
}

export interface SourceMethodValueUse {
  readonly occurrence: Node;
  readonly read: Node;
  readonly receiver: Node;
  readonly declaration: Node;
  readonly type: SourceTypeDescriptor;
  readonly provenance: SourceEffectiveTypeProvenance;
  readonly alias: {
    readonly principal: Node;
    readonly initializer: Node;
    readonly provenance: SourceEffectiveTypeProvenance;
  } | undefined;
}

export type SourceSlotAdmission =
  | {
      readonly kind: "admitted";
      readonly use: Node;
      readonly slot: Node;
      readonly value: SourceTypeDescriptor;
      readonly destination: SourceTypeDescriptor;
      readonly permission: "identity" | "widening";
      readonly conversion:
        | { readonly kind: "identity" }
        | { readonly kind: "exact-number-erasure"; readonly origin: Node; readonly result: SourceTypeDescriptor };
    }
  | { readonly kind: "refused"; readonly use: Node; readonly slot: Node; readonly refusal: SourceTypeFlowRefusal };

export type SourceTypeFlowPathPart =
  | { readonly kind: "element" }
  | { readonly kind: "optional-value" }
  | { readonly kind: "member"; readonly name: string }
  | { readonly kind: "tuple"; readonly index: number }
  | { readonly kind: "binder"; readonly declaration: Node };

export function sourceTypeDescriptorsEqual(left: SourceTypeDescriptor, right: SourceTypeDescriptor): boolean {
  if (left === right) return true;
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "primitive": return right.kind === "primitive" && left.primitive === right.primitive;
    case "string": return right.kind === "string";
    case "intrinsic": return right.kind === "intrinsic" && left.intrinsic === right.intrinsic;
    case "union": return right.kind === "union" && left.types.length === right.types.length &&
      left.types.every(type => right.types.some(selected => sourceTypeDescriptorsEqual(type, selected)));
    case "callable": return right.kind === "callable" && signaturesEqual(left.calls, right.calls) &&
      signaturesEqual(left.constructs, right.constructs);
    case "optional": return right.kind === "optional" && sourceTypeDescriptorsEqual(left.value, right.value);
    case "array": return right.kind === "array" && left.readonly === right.readonly &&
      sourceTypeDescriptorsEqual(left.element, right.element);
    case "tuple": return right.kind === "tuple" && left.readonly === right.readonly &&
      left.elements.length === right.elements.length && left.elements.every((element, index) =>
        element.kind === right.elements[index]?.kind && sourceTypeDescriptorsEqual(element.type, right.elements[index]!.type));
    case "declared": return right.kind === "declared" && left.declaration === right.declaration &&
      left.extent?.length === right.extent?.length && left.extent?.lengthRuntimeBase === right.extent?.lengthRuntimeBase &&
      left.typeArguments.length === right.typeArguments.length &&
      left.typeArguments.every((argument, index) => sourceTypeDescriptorsEqual(argument, right.typeArguments[index]!));
    case "shape": return right.kind === "shape" && left.members.length === right.members.length &&
      indexesEqual(left.indexes, right.indexes) && signaturesEqual(left.calls, right.calls) && signaturesEqual(left.constructs, right.constructs) &&
      left.members.every(member => {
        const selected = right.members.find(candidate => candidate.name === member.name);
        return selected !== undefined && member.optional === selected.optional && !!member.readonly === !!selected.readonly &&
          sourceTypeDescriptorMemberLiteralsKey(member) === sourceTypeDescriptorMemberLiteralsKey(selected) && sourceTypeDescriptorsEqual(member.type, selected.type);
      });
  }
}

/** The value key of a member literal (05 §2a D-2): equal keys are the same literal value. Numbers and bigints share the
 * integer spelling, as literal values do in the discriminant rule; the member's base type keeps them apart. */
export function sourceTypeDescriptorLiteralKey(literal: SourceTypeDescriptorLiteral): string {
  switch (literal.kind) {
    case "string": return `s:${literal.value}`;
    case "boolean": return `b:${String(literal.value)}`;
    case "bigint": return `n:${literal.value.toString()}`;
    case "number": return Number.isInteger(literal.value) ? `n:${BigInt(literal.value).toString()}` : `n:${String(literal.value)}`;
  }
}

// A member's literal set takes part in shape equality and identity as a set: declaration order never separates two arms.
export function sourceTypeDescriptorMemberLiteralsKey(member: SourceTypeDescriptorMember): string {
  return member.literals === undefined ? "" : JSON.stringify([...new Set(member.literals.map(sourceTypeDescriptorLiteralKey))].sort());
}

function indexesEqual(left: readonly SourceTypeDescriptorIndex[], right: readonly SourceTypeDescriptorIndex[]): boolean {
  return left.length === right.length && left.every(index => right.some(selected =>
    index.readonly === selected.readonly && sourceTypeDescriptorsEqual(index.key, selected.key) &&
    sourceTypeDescriptorsEqual(index.value, selected.value)));
}

function signaturesEqual(left: readonly SourceTypeDescriptorSignature[], right: readonly SourceTypeDescriptorSignature[]): boolean {
  return left.length === right.length && left.every((signature, index) => {
    const selected = right[index]!;
    return signature.typeParameters.length === selected.typeParameters.length &&
      signature.typeParameters.every((parameter, offset) => parameter === selected.typeParameters[offset]) &&
      signature.parameters.length === selected.parameters.length && signature.parameters.every((parameter, offset) =>
        parameter.kind === selected.parameters[offset]?.kind &&
        sourceTypeDescriptorsEqual(parameter.type, selected.parameters[offset]!.type)) &&
      sourceTypeDescriptorsEqual(signature.result, selected.result);
  });
}

export function sourceTypeDescriptorTupleValue(type: Extract<SourceTypeDescriptor, { readonly kind: "tuple" }>,
  index: number): SourceTypeDescriptor | undefined {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("A Source tuple position must be a nonnegative safe integer.");
  const element = type.elements[index];
  if (element !== undefined) return element.type;
  const last = type.elements[type.elements.length - 1];
  return last?.kind === "rest" ? last.type : undefined;
}

export function sourceTypeDescriptorStructure(type: SourceTypeDescriptor): SourceTypeDescriptor {
  let selected = type;
  while (selected.kind === "declared" && selected.definition !== undefined) selected = selected.definition;
  return selected;
}
