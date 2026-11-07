// SourceProgramFacts: the one surface a target reads (nextgen plan §2, C-2542).
// Invariant I1: no checker Type / Signature / Symbol / Resolved*Info appears in any type reachable from here.
// Node and SourceFile are site keys only. Every record is frozen and owned by one Host producer (R1).
import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceLiteralValue } from "../../source-semantics/literal-values-model.js";
import type {
  SourceClosedSum,
  SourceEffectiveTypeArgument,
  SourceEffectiveTypeOutcome,
  SourceMethodValueUse,
  SourceSlotAdmission,
  SourceSumIdentity,
  SourceTypeDescriptor,
  SourceTypeFlowRefusal,
} from "../../source-semantics/descriptor-model.js";
import type { SourceProgramDocuments } from "../../source-semantics/documents-model.js";
import type { SourceAnalysisFacts, SourceObligation } from "./analyses.js";
import type { SourceJsApiFacts, SourceObjectFacts } from "./objects.js";
import type { SourceRoleModel } from "./roles.js";
import type { SourceSelectionFacts } from "./selections.js";

/** Every Source refusal, Host-originated (R5). Targets forward code, message and site unchanged. */
export interface SourceRefusal {
  readonly kind: "refused";
  readonly code: string;            // TSONIC_* (never CSHARP_*)
  readonly message: string;
  readonly site: Node;
  readonly related?: Node;
}

/** Outcome for a value node: a descriptor with provenance, or a refusal. Never undefined for a value node (I4). */
export type SourceTypeOutcome = SourceEffectiveTypeOutcome;

/** Declared or inferred slot type with its broadness (C-2462), or a refusal. */
export type SourceSlotOutcome =
  | {
      readonly kind: "slot";
      readonly slot: Node;
      readonly type: SourceTypeDescriptor;
      readonly broad: boolean;        // broadness only; not constructibility, binders or physical scalar
      readonly authority: "declared" | "inferred";
      /**
       * The openness of `type` (FX-CC #23): `sourceTypeDescriptorOpenness(type)`, the one top / type-parameter
       * classifier ("top": any or unknown; "type-parameter": a type parameter reference; else "closed").
       */
      readonly openness: "top" | "type-parameter" | "closed";
    }
  | SourceTypeFlowRefusal;

/**
 * The Host destination slot of a value use (Q69, K-2683): the slot node, its published descriptor (the identical object
 * as `values.contextual(use).type`) and the Host broadness decision. For an admitted use, `slot` is `admission.slot`.
 */
export interface SourceDestination {
  readonly kind: "slot";
  readonly slot: Node;
  readonly type: SourceTypeDescriptor;
  readonly broad: boolean;
}

/** Operator record: the existing operator decision, published once (E6-2, E6-3, F6, B1). */
export interface SourceOperatorRecord {
  readonly node: Node;
  readonly operator: string;                       // syntax token text, e.g. "+", ">>>", "??", "typeof"
  readonly operands: readonly SourceTypeDescriptor[];
  readonly result: SourceTypeDescriptor;
  readonly primitive?: {                            // present when both sides are primitives
    readonly result: SourcePrimitiveKind;
    readonly operands: readonly SourcePrimitiveKind[];
  };
  readonly admission: "admitted" | SourceRefusal;
  /** `a ?? b` only: whether the left operand can be absent at runtime. */
  readonly coalesce?: { readonly leftAbsence: "never" | "possible" | "always" };
}

/** Element access selection, as for property access (E1-2, E1-3). */
export interface SourceElementAccessRecord {
  readonly node: Node;
  readonly receiver: Node;
  readonly receiverType: SourceTypeDescriptor;
  /** The index expression (`r[argument]`), whose Host type is `index` (R3 #23). */
  readonly argument: Node;
  readonly index: SourceTypeDescriptor;
  readonly selected:
    /** `declaration`: the index signature the checker selected (the lib `[n: number]: T`), when it names one. */
    | { readonly kind: "element"; readonly declaration?: Node }      // array / typed array element
    | { readonly kind: "tuple"; readonly position: number }
    | { readonly kind: "member"; readonly declaration: Node; readonly name: string }
    | { readonly kind: "index-signature"; readonly declaration: Node }
    | { readonly kind: "string-character"; readonly declaration?: Node };
  readonly result: SourceTypeDescriptor;
  readonly readonly: boolean;
  /** "call": the access is the callee of a call through transparent wrappers (as SourceMemberAccessSelection.access). */
  readonly access: "read" | "write" | "read-write" | "call";
  /** The access is part of an optional chain (`a?.[i]`), as SourceMemberAccessSelection.optionalChain. */
  readonly optionalChain: boolean;
}

/** A typeof result category (E23, N3'). "undefined" appears only for an absence arm whose admission proves it. */
export type SourceTypeofCategoryName = "undefined" | "number" | "bigint" | "string" | "boolean" | "symbol" | "function" | "object";

/**
 * typeof / nullish admission per operation and operand (C-2479 decision 2 (c), N3', N7; WP0 A1, A7; K-2657), taken
 * from the authored or solved component and the per-use number origin BEFORE the Q1 projection, never from the int64
 * descriptor. Scalar operand: `category` (absent when unproven) and `sum: undefined`. Closed-sum operand: `sum` with
 * every original role and, per role, every closed arm with its own category; `category` is then absent. A site where
 * physically coincident values have incompatible origin categories is refused (`typeofCategory` returns the refusal).
 */
export interface SourceNullishAdmission {
  readonly kind: "typeof-site";
  readonly operation: Node;
  readonly operand: Node;
  readonly admission: "none" | "undefined-only" | "null-only" | "both" | "unavailable";
  /** The typeof category of an absent value (Q20): "undefined" for undefined-only, else "object"; absent only for "none". */
  readonly absentCategory?: "undefined" | "object";
  /** Scalar operand: the typeof category of the non-nullish part. */
  readonly category?: Exclude<SourceTypeofCategoryName, "undefined">;
  readonly sum: {
    readonly identity: SourceSumIdentity;
    readonly roles: readonly {
      readonly role: number;
      /** The distinct proven categories of the role's arms, in arm order. */
      readonly categories: readonly SourceTypeofCategoryName[];
      /** Every closed arm of the role (required, A7); "unproven" = the arm's values prove no single category. */
      readonly arms: readonly { readonly arm: number; readonly category: SourceTypeofCategoryName | "unproven" }[];
    }[];
  } | undefined;
}

export interface SourceValueFacts {
  /** Every value expression, declaration, parameter, element and member read: descriptor or refusal (I4). */
  type(node: Node): SourceTypeOutcome;
  /**
   * Whether `node` is in the domain of `type`: value nodes, declarations, slots and authored type nodes. Inside the
   * domain `type` answers or fails as an invariant; this is never a probe for a fallback.
   */
  has(node: Node): boolean;
  /**
   * The Host destination a value use is typed against: the declared, parameter or return slot it flows into (Host slots
   * and instantiations, never the checker's contextual type). undefined: the use flows into no Host slot.
   */
  contextual(node: Node): SourceTypeOutcome | undefined;
  /**
   * The destination slot of a use (Q69): undefined when the use flows into no Host slot; the refusal of a refused
   * destination; otherwise the slot node, the contextual descriptor and `broad` (the Host broad-slot decision).
   */
  destination(use: Node): SourceDestination | SourceRefusal | undefined;
  callableReturn(declaration: Node): SourceTypeOutcome;
  slot(slot: Node): SourceSlotOutcome;
  /** Semantic permission of a value at a slot (incl. Q14, exact number erasure); not a CLR conversion proof. */
  admission(use: Node): SourceSlotAdmission;
  /** The operator decision, or the refusal of the operator node (the same refusal as `type(node)`). */
  operator(node: Node): SourceOperatorRecord | SourceRefusal;
  elementAccess(node: Node): SourceElementAccessRecord;
  typeofCategory(operation: Node, operand: Node): SourceNullishAdmission | SourceRefusal;
  /** Result of `await e` and of awaited callable results (replaces target Type walking). */
  awaited(node: Node): SourceTypeOutcome;
  /**
   * The awaited-arm relation (FX-HV, R-FXCR-AWAIT) at the same nodes as `awaited`: which arm of the awaited sum each
   * payload arm of each operand arm resolves to. undefined when the awaited result is not a closed sum.
   */
  awaitedArms(node: Node): SourceAwaitedArms | undefined;
  /**
   * The canonical method value use (WP0 A8, K-2659): a read (or an unannotated, never-written alias of one) that selects a
   * single callable method and is not the callee of a call or `new` (through transparent wrappers). Carries the
   * occurrence, the member read, its receiver, the method declaration, the exact Host type and provenance, and the alias
   * principal/initializer. undefined for every other node (a called method, a slot, a written or annotated alias, an
   * index, a getter, a foreign selection).
   */
  methodValueUse(occurrence: Node): SourceMethodValueUse | undefined;
  /** Constant value of a literal or constant expression, when it has one. */
  literal(node: Node): SourceLiteralValue | undefined;
  /**
   * The literal domain of a value (Q79): the distinct constants it can hold when every value that reaches it is a
   * constant (conditional and `??` operands, an unannotated unwritten local's initializer). undefined otherwise.
   */
  literalDomain(node: Node): readonly SourceLiteralValue[] | undefined;
}

/**
 * The Host awaited-arm relation of one `await` (or awaited callable result) whose awaited result is a closed sum.
 * Derived from Host descriptors and the declaration awaited rule (local-type-flow/awaited.ts), never from a checker
 * awaited type (R3).
 */
export interface SourceAwaitedArms {
  readonly use: Node;
  /** The operand's closed sum; undefined when the operand is one arm (not a sum). */
  readonly operand?: SourceSumIdentity;
  /** The awaited result's closed sum. */
  readonly awaited: SourceSumIdentity;
  /**
   * One entry per present operand arm (`arm`: its index in the operand sum; 0 for a non-sum operand). `payload`: the
   * closed sum of that arm's awaited payload, when the payload is a sum; payload arm i resolves to awaited arm
   * `mapping[i]`. A payload that is one type has no `payload` sum and `mapping` has its one awaited arm.
   */
  readonly arms: readonly { readonly arm: number; readonly payload?: SourceSumIdentity; readonly mapping: readonly number[] }[];
}

export interface SourceSumFacts {
  /** The same frozen record for the same identity. Arms in authored-first order (C-2459); void arm = absence (A11). */
  sum(identity: SourceSumIdentity): SourceClosedSum;
  /** The closed sum a union descriptor denotes; undefined only for a non-union descriptor. */
  sumOf(descriptor: SourceTypeDescriptor): SourceClosedSum | undefined;
  /** The sole substitution (I6): binder declaration → descriptor. */
  substitute(type: SourceTypeDescriptor, bindings: ReadonlyMap<Node, SourceTypeDescriptor>): SourceTypeDescriptor;
  /**
   * The single descriptor of several per-arm components (the member or element each arm of a union receiver yields),
   * built by the one union builder (I6): equal components give that component; distinct ones give the program's union
   * of them in its recorded authored-first order. undefined only when the program never formed that union. For Host
   * analyses (storage components, equality); a target represents per-arm components from the `per-arm` relation
   * (`arms[i].type`), not from a join.
   */
  join(components: readonly SourceTypeDescriptor[]): SourceTypeDescriptor | undefined;
}

/** Union relation at one use, rooted in the original sum/family/application (§4.3, C-2479 decision 1). */
export type SourceUnionRelation =
  | { readonly kind: "identity"; readonly use: Node; readonly sum: SourceSumIdentity }
  /** A non-union value written into a sum: the single arm it selects (literal discriminant selection included). */
  | { readonly kind: "select-arm"; readonly use: Node; readonly sum: SourceSumIdentity; readonly arm: number;
      readonly discriminant?: { readonly property: string; readonly value: SourceLiteralValue } }
  /** Sum → sum (narrowed read, widening write, cast): source arm i maps to destination arm `mapping[i]`. */
  | { readonly kind: "map"; readonly use: Node; readonly mode: "narrowed-read" | "write" | "cast";
      readonly source: SourceSumIdentity; readonly destination: SourceSumIdentity; readonly mapping: readonly number[] }
  /** Sum → one arm's payload (narrowed read to a non-union). */
  | { readonly kind: "extract-arm"; readonly use: Node; readonly sum: SourceSumIdentity; readonly arm: number }
  /**
   * A typeof / nullish / equality-literal / instanceof / discriminant test at its binary node (A4, supervisor item).
   * `outcome` is "always-true" / "always-false" only where the Host descriptors prove it for every value the operand can
   * hold; a target folds a guard only from a decided outcome. For an operand that is a closed sum, `sum` is present and
   * `whenTrue` lists the arms that can satisfy the test (an arm whose match is unproven is listed); otherwise `whenTrue`
   * is empty.
   */
  | { readonly kind: "test"; readonly use: Node; readonly operand: Node;
      readonly test: "typeof" | "nullish" | "literal" | "instanceof" | "discriminant";
      readonly outcome: "always-true" | "always-false" | "undecided";
      readonly sum?: SourceSumIdentity; readonly whenTrue: readonly number[];
      /** `instanceof` only: the instance the right operand constructs (absent when its construct signatures disagree). */
      readonly instance?: SourceTypeDescriptor }
  /**
   * A member read, member call or element read applied per arm (at the property access or the element access).
   * `member` is the declaration the arm's member resolves to; absent for an arm whose members are JS API members of a
   * primitive, array, tuple or callable (the profile resolves them by name), for a mapped member and for an element read
   * with a computed key. `type` is the component the arm's read yields (member type, index value, array element, tuple
   * position, string character); absent where the arm's descriptor has no structure naming it (a JS API member such as
   * `length`). A single descriptor of the components, where one is needed, is `sums.join`.
   */
  | { readonly kind: "per-arm"; readonly use: Node; readonly sum: SourceSumIdentity;
      readonly arms: readonly { readonly arm: number; readonly member?: Node; readonly type?: SourceTypeDescriptor }[] }
  | SourceRefusal;

export interface SourceRelationFacts {
  /**
   * Relation at a use whose source or destination is a closed sum, at a test node (any operand), or at a spread element
   * whose elements are written into a sum (array literal element, rest parameter). undefined when none applies. One
   * relation per node, by priority: spread write, cast, test, per-arm, narrowed read, write. An object literal's spreads
   * take part in its own write relation (discriminant rule D-8).
   */
  at(use: Node): SourceUnionRelation | undefined;
  /**
   * The write relation of a value use into its Host destination slot (select-arm, map mode "write", identity, or the
   * write refusal), for every use that flows into a sum, also when `at(use)` publishes another relation for the same
   * node (a narrowed read or per-arm access that is also written into a sum). Where the write is the node's only
   * relation, `write(use)` is the same record as `at(use)`. undefined when the use flows into no sum.
   */
  write(use: Node): SourceUnionRelation | undefined;
}

/** Per-use instantiation of a generic callable (G4, E4-7): calls, constructions and generic function values. */
export type SourceInstantiation =
  | {
      readonly kind: "call" | "construction" | "function-value";
      readonly use: Node;
      readonly signature: Node;                                     // selected signature declaration
      readonly receiver: readonly SourceEffectiveTypeArgument[];      // class/interface binders
      /** Signature binders, declaration order; `authored`: the explicit type-argument node, only when written. */
      readonly method: readonly (SourceEffectiveTypeArgument & { readonly authored?: Node })[];
      readonly parameters: readonly SourceTypeDescriptor[];
      readonly result: SourceTypeDescriptor;
    }
  | SourceRefusal;

export interface SourceInstantiationFacts {
  /** Undefined only for a use that has no generic binders on either receiver or signature. */
  at(use: Node): SourceInstantiation | undefined;
}

/** One frozen object per program view. */
export interface SourceProgramFacts {
  readonly documents: SourceProgramDocuments;
  readonly values: SourceValueFacts;
  readonly sums: SourceSumFacts;
  readonly relations: SourceRelationFacts;
  readonly instantiations: SourceInstantiationFacts;
  readonly selections: SourceSelectionFacts;
  readonly navigation: SourceRoleModel;
  readonly objects: SourceObjectFacts;
  readonly profile: SourceJsApiFacts;
  /** Host analyses a target needs (integer ranges, captures, enums, property names, flow, storage, ownership, extensions). */
  readonly analyses: SourceAnalysisFacts;
  /** Type-flow obligations (interface, read-only, constraint, literal admission, write fit), checker-free. */
  obligations(): readonly SourceObligation[];
  refusals(): readonly SourceRefusal[];
}

