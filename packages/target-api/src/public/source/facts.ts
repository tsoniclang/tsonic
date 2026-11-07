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
} from "../../source-semantics/local-type-flow/types.js";
import type { SourceProgramDocuments } from "../../source-semantics/types.js";
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
    }
  | SourceTypeFlowRefusal;

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
  readonly index: SourceTypeDescriptor;
  readonly selected:
    | { readonly kind: "element" }                                   // array / typed array element
    | { readonly kind: "tuple"; readonly position: number }
    | { readonly kind: "member"; readonly declaration: Node; readonly name: string }
    | { readonly kind: "index-signature"; readonly declaration: Node }
    | { readonly kind: "string-character" };
  readonly result: SourceTypeDescriptor;
  readonly readonly: boolean;
  readonly access: "read" | "write" | "read-write";
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
   * The canonical method value use (WP0 A8, K-2659): a read (or an unannotated, never-written alias of one) that selects a
   * single callable method and is not the callee of a call or `new` (through transparent wrappers). Carries the
   * occurrence, the member read, its receiver, the method declaration, the exact Host type and provenance, and the alias
   * principal/initializer. undefined for every other node (a called method, a slot, a written or annotated alias, an
   * index, a getter, a foreign selection).
   */
  methodValueUse(occurrence: Node): SourceMethodValueUse | undefined;
  /** Constant value of a literal or constant expression, when it has one. */
  literal(node: Node): SourceLiteralValue | undefined;
}

export interface SourceSumFacts {
  /** The same frozen record for the same identity. Arms in authored-first order (C-2459); void arm = absence (A11). */
  sum(identity: SourceSumIdentity): SourceClosedSum;
  /** The closed sum a union descriptor denotes; undefined only for a non-union descriptor. */
  sumOf(descriptor: SourceTypeDescriptor): SourceClosedSum | undefined;
  /** The sole substitution (I6): binder declaration → descriptor. */
  substitute(type: SourceTypeDescriptor, bindings: ReadonlyMap<Node, SourceTypeDescriptor>): SourceTypeDescriptor;
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
      readonly sum?: SourceSumIdentity; readonly whenTrue: readonly number[] }
  /**
   * A member read or member call applied per arm (at the property access, or the element access with a literal key).
   * `member` is the declaration the arm's member resolves to; absent for an arm whose members are JS API members of a
   * primitive, array, tuple or callable (the profile resolves them by name) and for a mapped member.
   */
  | { readonly kind: "per-arm"; readonly use: Node; readonly sum: SourceSumIdentity;
      readonly arms: readonly { readonly arm: number; readonly member?: Node }[] }
  | SourceRefusal;

export interface SourceRelationFacts {
  /**
   * Relation at a use whose source or destination is a closed sum, at a test node (any operand), or at a spread element
   * whose elements are written into a sum (array literal element, rest parameter). undefined when none applies. One
   * relation per node, by priority: spread write, cast, test, per-arm, narrowed read, write. An object literal's spreads
   * take part in its own write relation (discriminant rule D-8).
   */
  at(use: Node): SourceUnionRelation | undefined;
}

/** Per-use instantiation of a generic callable (G4, E4-7): calls, constructions and generic function values. */
export type SourceInstantiation =
  | {
      readonly kind: "call" | "construction" | "function-value";
      readonly use: Node;
      readonly signature: Node;                                     // selected signature declaration
      readonly receiver: readonly SourceEffectiveTypeArgument[];      // class/interface binders
      readonly method: readonly SourceEffectiveTypeArgument[];        // signature binders, declaration order
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

