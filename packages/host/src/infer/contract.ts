import type { Diagnostic, Result, UnitAnswerPosition, UnitRequest } from "../diag/contract.js";
import type { BodyId, DefId, ModuleId, NodeRef, Origin, SourceNodeRef } from "../ids/contract.js";
import type { BindingScope, BindingVector, Signature, SignatureRequest, SourceObjectField, TypeExpansionLimits, TypeInterner, TypePublicationWork } from "../ir-types/contract.js";
import type { CheckedPhase, CheckedSourceObjectFieldReader, CheckedTypingCuts, Declaration, HirBindingViews, HirBody, HirCandidateList, HirModuleBinding, HirNode } from "../ir-hir/contract.js";
import type { DataflowLimits } from "../dataflow/contract.js";
import type { AtomicContribution, CaptureRow, ConstraintSet, FinalVariable, InferenceGroup, InferredPartRequest, InferredPartType, MemberRuleAnswer, MemberRuleNeed, PlacedSignature, RecordedCheck, RuleTable, SignaturePlacement, Solution, SolvedConstraint, TypeProductionNeed, TypeProductionAnswer } from "../ir-infer/contract.js";
import type { Step } from "../step/contract.js";
import type { MemberSolvePause, MemberSolveSuspension, ReadyMemberInventory } from "./member-pause.js";

export interface InferenceLimits {
  readonly maximumVariablesPerGroup: number;
  readonly maximumAtomicContributionsPerGroup: number;
}

export interface StructuralTypingCuts {
  readonly syntax: (node: HirNode) => boolean;
  readonly body: (body: BodyId) => boolean;
  readonly declaration: (definition: DefId) => boolean;
  readonly parameterInitializer: (definition: DefId, index: number) => boolean;
}

export interface GroupDeps {
  readonly structuralCuts: StructuralTypingCuts;
  readonly hirBody: (body: BodyId) => HirBody;
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly bindings: readonly (readonly HirModuleBinding[])[];
  readonly graph: DataflowLimits;
}

export interface InferenceInputs extends GroupDeps, HirBindingViews {
  readonly cuts: CheckedTypingCuts;
  readonly bindingScopeOf: (definition: DefId) => BindingScope;
  readonly checkedNodeOf: (reference: SourceNodeRef) => HirNode | null;
  readonly checkerDiagnosticsOf: (module: ModuleId) => readonly Diagnostic[];
  readonly types: TypeInterner;
  readonly typeWork: TypePublicationWork;
  readonly typeExpansion: TypeExpansionLimits;
  readonly limits: InferenceLimits;
}

export interface InferDeps<State> extends InferenceInputs {
  readonly rules: RuleTable<State>;
  readonly sourceFields: (body: BodyId) => CheckedSourceObjectFieldReader | null;
  readonly readySourceField: (occurrence: NodeRef) => SourceObjectField | null;
}

export interface DeclaredSignatureRequest {
  readonly kind: "declaredSignatureOf";
  readonly request: SignatureRequest;
}

export type ConstraintsRequest =
  | DeclaredSignatureRequest
  | { readonly kind: "form-cut"; readonly definition: DefId; readonly at: NodeRef }
  | InferredPartRequest
  | TypeProductionNeed;

export type ConstraintsAnswer =
  | { readonly kind: "declaredSignatureOf"; readonly value: Signature }
  | InferredPartType
  | TypeProductionAnswer;

export type SolveRequest =
  | PlacementRequest
  | MemberRuleNeed;

type PlacementRequest = DeclaredSignatureRequest | { readonly kind: "placeSignature"; readonly placement: SignaturePlacement };
export type PlacementAnswer =
  | { readonly kind: "declaredSignatureOf"; readonly value: Signature }
  | { readonly kind: "placeSignature"; readonly value: PlacedSignature };

export type SolveAnswer = PlacementAnswer | MemberRuleAnswer;

export interface ConstraintsPaused {
  readonly group: InferenceGroup;
  readonly requestBodies: readonly BodyId[];
  readonly eligibleCandidates: readonly (readonly HirCandidateList[])[];
  readonly requests: readonly [ConstraintsRequest, ...ConstraintsRequest[]];
}

export interface PlacementPaused {
  readonly kind: "placement";
  readonly unit: UnitRequest;
  readonly positions: readonly UnitAnswerPosition[];
  readonly group: InferenceGroup;
  readonly constraints: GroupConstraints;
  readonly contributions: readonly AtomicContribution[];
  readonly variables: readonly FinalVariable[];
  readonly solved: readonly SolvedConstraint[];
  readonly checks: readonly RecordedCheck[];
  readonly captures: readonly (readonly CaptureRow[])[];
  readonly requests: readonly [PlacementRequest, ...PlacementRequest[]];
  readonly memberInventories: readonly ReadyMemberInventory[];
}

export type InferPaused<State> = PlacementPaused | MemberSolvePause<MemberSolveContinuation<State>>;

export type MemberSolveContinuation<State> = MemberSolveSuspension<InferDeps<State>, GroupConstraints, State>;

export type SelectionConstraintContext = {
  readonly occurrence: NodeRef;
  readonly origin: Origin;
} & ({ readonly kind: "member" | "index" } | { readonly kind: "call"; readonly scope: BindingScope }
  | { readonly kind: "construction"; readonly bindings: BindingVector });

export interface GroupConstraints {
  readonly constraints: readonly ConstraintSet[];
  readonly outsideParts: readonly InferredPartType[];
  readonly selectionContexts: readonly SelectionConstraintContext[];
}

export interface GroupSolution {
  readonly positions: readonly UnitAnswerPosition[];
  readonly solution: Solution;
  readonly contributions: readonly AtomicContribution[];
  readonly memberInventories: readonly ReadyMemberInventory[];
}

export type InferStep<Value, Request, Paused> = Step<Result<Value>, Request, Paused, Diagnostic>;

export type GroupsOf = (
  deps: GroupDeps,
  bodies: readonly BodyId[],
) => Result<readonly InferenceGroup[]>;

export type ConstraintsOf = <State>(
  deps: InferDeps<State>,
  group: InferenceGroup,
) => InferStep<GroupConstraints, ConstraintsRequest, ConstraintsPaused>;

export type ResumeConstraintsOf = <State>(
  deps: InferDeps<State>,
  paused: ConstraintsPaused,
  answers: readonly ConstraintsAnswer[],
) => InferStep<GroupConstraints, ConstraintsRequest, ConstraintsPaused>;

export type SolveGroup = <State>(
  deps: InferDeps<State>,
  group: InferenceGroup,
  constraints: GroupConstraints,
  unit: UnitRequest,
) => InferStep<GroupSolution, SolveRequest, InferPaused<State>>;

export type ResumeSolveGroup = <State>(
  deps: InferDeps<State>,
  paused: InferPaused<State>,
  answers: readonly SolveAnswer[],
) => InferStep<GroupSolution, SolveRequest, InferPaused<State>>;
