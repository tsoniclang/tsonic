import type { Cause, Diagnostic, UnitDiagnostic, UnitRequest, UnitResult, UnitValue } from "../diag/contract.js";
import type { BodyId, DefId, DefinitionPath, ModuleId, Origin, SourceNodeRef, TyId } from "../ids/contract.js";
import type { BindingScope, MemberInventory, MemberKey, MemberTypeRequest, MemberTypes, Signature, SignatureRequest, TypeEvidence, TypeExpansionLimits, TypeInterner, TypeProductionRequest, TypePublicationWork, TypeTerm } from "../ir-types/contract.js";
import type { CheckedTypingCuts, HirDeclarationScopes, HirModule, HirNode, SyntaxKind } from "../ir-hir/contract.js";
import type { InferenceGroup, InferredPartRequest, InferredPartType, MemberRuleAnswer, MemberRuleNeed, PlacedSignature, SignaturePlacement, TypePatternMatchOutcome,
  TypeProductionAnswer, TypeProductionNeed } from "../ir-infer/contract.js";
import type { Step } from "../step/contract.js";

// Decls (COMPONENTS section 2; amendment S2-7). This file states the two operations of checkpoint 2,
// `describeDefinitions` and `declaredSignatureOf`. The other operations of part 1 (`placeSignature`,
// `placeMemberType`, `heritageOf`, `enumOf`, `produceType`, `classifyCycle`) are added
// here when they are written. Decls has no record of synchronous readers: what it needs from another owner is a
// request through Pipeline's driver (part 4), and what Front produced is read as data.

/** An export name of a definition: the projection of Front's export entries onto the definition (part 3, B1). */
export interface DefinitionExport {
  readonly module: ModuleId;
  readonly name: string;
}

/**
 * One definition of a checked module (part 1, `describeDefinitions`): its kind (the tsts node kind of its node), its
 * visibility, its parent, the bodies it owns, its generic environment and its export names.
 */
export interface DefinitionDescription {
  readonly definition: DefId;
  readonly path: DefinitionPath;
  readonly kind: SyntaxKind;
  /**
   * For an actual class member, its authored privacy: `private` for a private name (K-3312), otherwise its
   * accessibility keyword, `public` when neither is written; null for every other definition (K-3291). Export and
   * publication are separate facts.
   */
  readonly visibility: "public" | "protected" | "private" | null;
  readonly parent: DefId | null;
  /** The bodies whose owner is this definition, in the module's body order. */
  readonly bodies: readonly BodyId[];
  /**
   * The type parameters in scope at the definition, partitioned (K-3292): `classParameters` those of the current
   * type-declaration binder, or of the owning class or interface for an instance member; `methodParameters` the
   * current callable's own; `capturedParameters` those of every other enclosing binder still available, outer to inner,
   * each binder's in authored order; `selfOwners` the classes and interfaces whose polymorphic self is in scope, outer
   * to inner. A definition that binds nothing has its enclosing binder's environment.
   */
  readonly generics: BindingScope;
  /** As given by the inverse export names. */
  readonly exports: readonly DefinitionExport[];
}

/** The export names of one definition: the projection of Front's export entries onto it. */
export interface DefinitionExports {
  readonly definition: DefId;
  readonly exports: readonly DefinitionExport[];
}

/** Every definition of one checked module: the module's own definition, then its declaration entries in their order. */
export interface DefinitionTable {
  readonly module: ModuleId;
  readonly definitions: readonly DefinitionDescription[];
}

/**
 * One checked module with the table of its syntax nodes, built once where the module passes the second barrier with
 * ir-hir's `indexSyntaxTree`: node identities are dense in preorder, so node n is at position n. A table built from
 * another module's tree is a caller defect.
 */
export interface DeclsModule {
  readonly module: HirModule;
  readonly nodes: readonly HirNode[];
}

/** What Decls reads: data, and the type interner. */
export interface DeclsDeps {
  /**
   * One per module, in strictly ascending order of module identity. The order is the caller's to keep: whoever
   * assembles this list checks it once there (Pipeline, at the barrier); a list out of order is a caller defect, and
   * Decls, which finds modules by binary search, would then answer for a present module that it is absent.
   */
  readonly modules: readonly DeclsModule[];
  /** The interner of the program's type table: a signature under bindings is interned here. */
  readonly types: TypeInterner;
  readonly typeWork: TypePublicationWork;
  readonly typeExpansion: TypeExpansionLimits;
}

/** Part 1, `describeDefinitions`: one verified checked module and its ready scope and export projections. */
export type DescribeDefinitions = (
  module: DeclsModule,
  scopes: HirDeclarationScopes,
  /** At most one entry per definition; a definition without one has no export name. */
  exportNames: readonly DefinitionExports[],
) => DefinitionTable;

/** The state of a paused `declaredSignatureOf`: what it was asked and which parts it waits for, in request order. */
export interface DeclaredSignaturePause {
  readonly request: SignatureRequest;
  readonly signature: Signature;
  readonly parts: readonly [InferredPartRequest, ...InferredPartRequest[]];
}

/** One step of a Decls operation (step foundation, S2-30). Diagnostics earned travel with the step. */
export type DeclsStep<Value, Paused> = Step<UnitResult<Value>, InferredPartRequest, Paused, Diagnostic>;

export interface DeclaredSignatureErrorData {
  readonly kind: "declared-signature";
  readonly state: DeclaredSignaturePause;
  readonly ready: readonly { readonly index: number; readonly answer: InferredPartType }[];
  readonly unavailable: readonly [number, ...number[]];
  readonly signature: Signature;
}

export type DeclarationCycleTarget =
  | { readonly kind: "declared-signature"; readonly request: SignatureRequest }
  | { readonly kind: "inference-solution"; readonly group: InferenceGroup };

export interface DeclarationCycleMember {
  readonly unit: UnitRequest;
  readonly target: DeclarationCycleTarget;
  readonly answerPolicy: "typed-error" | "refusal-only";
  readonly producer:
    | { readonly kind: "declared-signature"; readonly state: DeclaredSignaturePause; readonly ready: readonly InferredPartType[] }
    | { readonly kind: "inference-solution"; readonly group: InferenceGroup };
}

export type DeclarationCycleOutcome =
  | { readonly kind: "refused"; readonly diagnostic: Diagnostic }
  | { readonly kind: "error"; readonly cause: Cause; readonly data: DeclaredSignatureErrorData;
      readonly diagnostics: readonly Diagnostic[]; readonly emissions: readonly UnitDiagnostic[] };

export type ClassifyCycle = (deps: DeclsDeps,
  members: readonly [DeclarationCycleMember, ...DeclarationCycleMember[]]) => readonly DeclarationCycleOutcome[];

export type ErrorSignature = (deps: DeclsDeps, request: SignatureRequest, cause: Cause,
  data: DeclaredSignatureErrorData) => UnitValue<Signature>;

export type PlaceSignature = (deps: DeclsDeps, placement: SignaturePlacement, unit: UnitRequest, cuts: CheckedTypingCuts) => DeclsStep<PlacedSignature, never>;

export type MembersOf = (deps: DeclsDeps, type: TyId) => Step<UnitResult<MemberInventory>, never, never, Diagnostic>;

export type MemberTypeOf = (deps: DeclsDeps, request: MemberTypeRequest) => DeclsStep<MemberTypes, never>;

export interface SelectedIndexedRead {
  readonly type: TyId;
  readonly previous: SelectedIndexedRead | null;
}

export type TypeProductionPause = { readonly root: SourceNodeRef; readonly origin: Origin; readonly unit: UnitRequest } & (
  | { readonly kind: "index"; readonly receiver: TyId; readonly projection: TyId; readonly request: TypeProductionRequest }
  | { readonly kind: "inventory"; readonly receiver: TyId; readonly keys: readonly MemberKey[] }
  | { readonly kind: "keys"; readonly receiver: TyId }
  | { readonly kind: "member"; readonly requests: readonly MemberTypeRequest[]; readonly next: number;
      readonly completed: SelectedIndexedRead | null }
);

export type TypeProductionStep = Step<UnitResult<TypeEvidence>, MemberRuleNeed | TypeProductionNeed, TypeProductionPause, Diagnostic>;
export type ProduceType = (deps: DeclsDeps, request: TypeProductionRequest, checkedOperator: HirNode, unit: UnitRequest,
  match: (check: TypeTerm, pattern: TypeTerm) => TypePatternMatchOutcome) => TypeProductionStep;
export type ResumeProduceType = (deps: DeclsDeps, paused: TypeProductionPause,
  answers: readonly (MemberRuleAnswer | TypeProductionAnswer)[]) => TypeProductionStep;

/**
 * Part 1, `declaredSignatureOf`: the declared signature of the endpoint the request names, under its bindings.
 * A signature whose parts are all declared is answered at once; an inferred part pauses with a request for it.
 */
export type DeclaredSignatureOf = (deps: DeclsDeps, request: SignatureRequest, cuts: CheckedTypingCuts) => DeclsStep<Signature, DeclaredSignaturePause>;

/** Resumes a paused `declaredSignatureOf` once, with one answer per request of the pause, in their order. */
export type ResumeDeclaredSignatureOf = (
  deps: DeclsDeps,
  paused: DeclaredSignaturePause,
  answers: readonly InferredPartType[],
) => DeclsStep<Signature, DeclaredSignaturePause>;
