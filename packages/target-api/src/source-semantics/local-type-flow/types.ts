import type { AstReader, Node, ReadonlySourceFactResolver, SourceFile, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceTypeDescriptorUnions } from "./terms.js";
import type {
  SourceHostArgumentBinding, SourceHostCall, SourceHostCallParameter, SourceHostComponent, SourceHostInput, SourceHostQueries, SourceHostType,
} from "../../host-input/index.js";
import type { SourceProgramNavigation } from "../../source-navigation/types.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type { SourcePlatformFacts } from "../platform-model.js";

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

export interface SourceTypeFlowAssociation {
  readonly occurrence: Node;
  readonly sourceFile: SourceFile;
  readonly component?: SourceHostComponent;
  readonly call?: SourceHostCall;
  readonly binding?: SourceHostArgumentBinding;
  readonly parameter?: SourceHostCallParameter;
}

export type SourceTypeFlowObligationKind =
  | "interface"
  | "read-only"
  | "constraint"
  | "literal-admission"
  | "write-fit";

interface SourceTypeFlowObligationBase {
  readonly site: Node;
  readonly type: SourceTypeDescriptor;
  readonly required: Node;
  readonly requiredType?: SourceTypeDescriptor;
  readonly value?: Node;
  readonly valueType?: SourceTypeDescriptor;
  readonly valueVariable?: SourceTypeFlowVariable;
  readonly association?: SourceTypeFlowAssociation;
}

export type SourceTypeFlowObligation = SourceTypeFlowObligationBase & (
  | { readonly kind: "literal-admission"; readonly authority: "inferred" | "declared" }
  | { readonly kind: Exclude<SourceTypeFlowObligationKind, "literal-admission"> }
);

export interface SourceEffectiveTypeArgument {
  readonly declaration: Node;
  readonly type: SourceTypeDescriptor;
}

export interface SourceEffectiveCallInstantiation {
  readonly call: SourceHostCall;
  readonly receiver: readonly SourceEffectiveTypeArgument[];
  readonly method: readonly SourceEffectiveTypeArgument[];
  readonly parameters: readonly (SourceTypeDescriptor | undefined)[];
  readonly result?: SourceTypeDescriptor;
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

export interface SourceDeclaredSlot {
  readonly slot: Node;
  readonly type: SourceTypeDescriptor;
  readonly broad: boolean;
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

export interface SourceEffectiveTypes {
  sum(identity: SourceSumIdentity): SourceClosedSum | undefined;
  get(node: Node): SourceEffectiveTypeOutcome | undefined;
  declaredSlot(slot: Node): SourceDeclaredSlot | undefined;
  methodValueUse(occurrence: Node): SourceMethodValueUse | undefined;
  slotAdmission(use: Node): SourceSlotAdmission | undefined;
  callableReturn(declaration: Node): SourceEffectiveTypeOutcome | undefined;
  callInstantiation(call: Node): SourceEffectiveCallInstantiation | undefined;
  obligations(): readonly SourceTypeFlowObligation[];
  refusals(): readonly SourceTypeFlowRefusal[];
}

export interface SourceTypeFlowSource {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly sourceFacts: ReadonlySourceFactResolver;
  readonly navigation: SourceProgramNavigation;
  /** The active target's native integer premise (E24): read only for native-int / native-uint width decisions. */
  readonly platform: SourcePlatformFacts;
}

export interface SourceTypeFlowOrder {
  readonly start: number;
  readonly preorder: number;
}

export interface SourceTypeFlowInheritedBinding {
  readonly value: SourceTypeDescriptor;
  readonly authoredComponent?: SourceHostComponent;
}

export interface SourceTypeFlowAnalysisContext {
  readonly source: SourceTypeFlowSource;
  readonly unions: SourceTypeDescriptorUnions;
  /** The program checker adapter (I3): the only path from type flow to checker witnesses. */
  readonly input: SourceHostInput;
  describe(node: Node, component?: SourceHostComponent,
    arguments_?: readonly SourceEffectiveTypeArgument[]): SourceTypeDescriptor | undefined;
  authoredInheritedBindings(type: SourceHostType, queries: SourceHostQueries, bindings: ReadonlyMap<Node, SourceTypeDescriptor>):
    ReadonlyMap<Node, Required<SourceTypeFlowInheritedBinding>>;
  literal(node: Node): SourceLiteralValue | undefined;
  order(node: Node): SourceTypeFlowOrder;
}

export type SourceTypeFlowPathPart =
  | { readonly kind: "element" }
  | { readonly kind: "optional-value" }
  | { readonly kind: "member"; readonly name: string }
  | { readonly kind: "tuple"; readonly index: number }
  | { readonly kind: "binder"; readonly declaration: Node };

export interface SourceTypeFlowVariable {
  readonly node: Node;
  readonly path: readonly SourceTypeFlowPathPart[];
}

export type SourceTypeFlowTerm =
  | { readonly kind: "numeric"; readonly site: Node; readonly form: "integer" | "fractional"; readonly literal: SourceLiteralValue }
  | { readonly kind: "fixed"; readonly site: Node; readonly type: SourceTypeDescriptor }
  | { readonly kind: "template"; readonly site: Node; readonly type: SourceTypeDescriptor;
      readonly bindings: readonly { readonly declaration: Node; readonly variable: SourceTypeFlowVariable }[] }
  | { readonly kind: "array"; readonly site: Node; readonly element: SourceTypeFlowVariable; readonly readonly: boolean }
  | { readonly kind: "optional"; readonly site: Node; readonly value: SourceTypeFlowVariable; readonly source: SourceHostComponent }
  | { readonly kind: "tuple"; readonly site: Node; readonly elements: readonly {
      readonly kind: "required" | "optional" | "rest";
      readonly variable: SourceTypeFlowVariable;
      readonly declaration?: Node;
    }[]; readonly readonly: boolean }
  | {
      readonly kind: "declared";
      readonly site: Node;
      readonly declaration: Node;
      readonly typeArguments: readonly SourceTypeFlowVariable[];
      readonly source?: SourceHostComponent;
    }
  | { readonly kind: "shape"; readonly site: Node; readonly members: readonly SourceTypeFlowMember[] };

export interface SourceTypeFlowMember {
  readonly name: string;
  readonly optional: boolean;
  readonly variable: SourceTypeFlowVariable;
  readonly declaration?: Node;
  readonly readonly?: boolean;
}

export type SourceTypeFlowNodeKind =
  | "open-local"
  | "value"
  | "read"
  | "parameter"
  | "binder"
  | "derived-local"
  | "fixed";

export interface SourceTypeFlowNode {
  readonly node: Node;
  readonly root: Node;
  readonly variable: SourceTypeFlowVariable;
  readonly kind: SourceTypeFlowNodeKind;
  readonly publish: boolean;
  readonly declaration?: Node;
  readonly initializer?: Node;
  readonly term?: SourceTypeFlowTerm;
  readonly association?: SourceTypeFlowAssociation;
  readonly declaredType?: SourceTypeDescriptor;
  readonly declaredSlotRefusal?: SourceTypeFlowRefusal;
}

export interface SourceTypeFlowLink {
  readonly source: SourceTypeFlowVariable;
  readonly target: SourceTypeFlowVariable;
  readonly site: Node;
}

export type SourceTypeFlowOperator =
  | "add" | "subtract" | "multiply" | "divide" | "remainder" | "power"
  | "bit-and" | "bit-or" | "bit-xor" | "shift-left" | "shift-right" | "shift-right-unsigned"
  | "negate" | "positive" | "bit-not" | "logical-not"
  | "identity" | "await" | "sequence" | "conditional" | "logical-and" | "logical-or" | "coalesce"
  | "less" | "less-equal" | "greater" | "greater-equal" | "equal" | "not-equal";

export interface SourceTypeFlowDerived {
  readonly node: Node;
  readonly result: SourceTypeFlowVariable;
  readonly operator: SourceTypeFlowOperator;
  readonly operands: readonly SourceTypeFlowVariable[];
  readonly required: boolean;
  readonly accumulator?: SourceTypeFlowVariable;
}

export interface SourceTypeFlowBinder {
  readonly declaration: Node;
  readonly variable: SourceTypeFlowVariable;
  readonly constraint?: SourceHostComponent;
}

export interface SourceTypeFlowCall {
  readonly node: Node;
  readonly source: SourceHostCall;
  readonly receiver: readonly SourceTypeFlowBinder[];
  readonly method: readonly SourceTypeFlowBinder[];
  readonly argumentPlaces: readonly SourceTypeFlowArgumentPlace[];
  readonly result?: SourceTypeFlowVariable;
}

export interface SourceTypeFlowArgumentPlace {
  readonly binding: SourceHostArgumentBinding;
  readonly parameter: SourceHostCallParameter;
  readonly binder: Node;
  readonly value: SourceTypeFlowVariable;
}

export interface SourceTypeFlowGraph {
  readonly roots: readonly Node[];
  readonly nodes: readonly SourceTypeFlowNode[];
  readonly links: readonly SourceTypeFlowLink[];
  readonly inferenceInputs: readonly SourceTypeFlowLink[];
  readonly derived: readonly SourceTypeFlowDerived[];
  readonly calls: readonly SourceTypeFlowCall[];
  readonly refusals: readonly SourceTypeFlowRefusal[];
}

interface SourceTypeFlowUseBase {
  readonly site: Node;
  readonly variable: SourceTypeFlowVariable;
  readonly association?: SourceTypeFlowAssociation;
}

export type SourceTypeFlowUse = SourceTypeFlowUseBase & (
  // authority: stated only when the fill comes from the value's own declared slot (C30); otherwise the solver derives it
  // from the fill's authored component.
  | { readonly kind: "fill"; readonly type: SourceTypeDescriptor; readonly authority?: "declared" }
  | {
      readonly kind: "check";
      readonly check: Exclude<SourceTypeFlowObligationKind, "write-fit" | "literal-admission">;
      readonly type: SourceTypeDescriptor;
      readonly required: Node;
    }
  | { readonly kind: "write"; readonly value: Node; readonly required: Node; readonly valueVariable?: SourceTypeFlowVariable }
  | { readonly kind: "refused"; readonly refusal: SourceTypeFlowRefusal }
  | { readonly kind: "none" }
);

export interface SourceTypeFlowSignature {
  readonly site: Node;
  readonly owner: Node;
  readonly variable: SourceTypeFlowVariable;
}

export type SourceTypeFlowUseCollector = (
  context: SourceTypeFlowAnalysisContext,
  graph: SourceTypeFlowGraph,
) => readonly SourceTypeFlowUse[];

export type SourceTypeFlowEdgeCollector = (
  context: SourceTypeFlowAnalysisContext,
) => SourceTypeFlowGraph;

export type SourceTypeFlowSignatureCollector = (
  context: SourceTypeFlowAnalysisContext,
  graph: SourceTypeFlowGraph,
  isInference: (variable: SourceTypeFlowVariable) => boolean,
) => readonly SourceTypeFlowSignature[];
