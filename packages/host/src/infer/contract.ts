import type { Diagnostic, Result, UnitAnswerPosition, UnitRequest } from "../diag/contract.js";
import type { BodyId, DefId } from "../ids/contract.js";
import type { Signature, SignatureRequest, TypeEvidence, TypeExpansionLimits, TypeInterner, TypeProductionRequest } from "../ir-types/contract.js";
import type { CheckedPhase, Declaration, HirBody } from "../ir-hir/contract.js";
import type { DataflowLimits } from "../dataflow/contract.js";
import type { AtomicContribution, ConstraintSet, FinalVariable, InferenceGroup, InferredPartRequest, InferredPartType, RecordedCheck, RuleTable, SignaturePlacement, Solution, SolvedConstraint } from "../ir-infer/contract.js";
import type { Step } from "../step/contract.js";

export interface InferenceLimits {
  readonly maximumVariablesPerGroup: number;
  readonly maximumAtomicContributionsPerGroup: number;
}

export interface GroupDeps {
  readonly hirBody: (body: BodyId) => HirBody;
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly graph: DataflowLimits;
}

export interface InferDeps {
  readonly hirBody: (body: BodyId) => HirBody;
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly rules: RuleTable;
  readonly types: TypeInterner;
  readonly typeExpansion: TypeExpansionLimits;
  readonly limits: InferenceLimits;
  readonly graph: DataflowLimits;
}

export interface DeclaredSignatureRequest {
  readonly kind: "declaredSignatureOf";
  readonly request: SignatureRequest;
}

export type ConstraintsRequest =
  | DeclaredSignatureRequest
  | InferredPartRequest
  | { readonly kind: "produceType"; readonly request: TypeProductionRequest };

export type ConstraintsAnswer =
  | { readonly kind: "declaredSignatureOf"; readonly value: Signature }
  | InferredPartType
  | { readonly kind: "produceType"; readonly value: TypeEvidence };

export type SolveRequest =
  | DeclaredSignatureRequest
  | { readonly kind: "placeSignature"; readonly placement: SignaturePlacement };

export type SolveAnswer =
  | { readonly kind: "declaredSignatureOf"; readonly value: Signature }
  | { readonly kind: "placeSignature"; readonly value: Signature };

export interface ConstraintsPaused {
  readonly group: InferenceGroup;
  readonly requestBodies: readonly BodyId[];
  readonly requests: readonly [ConstraintsRequest, ...ConstraintsRequest[]];
}

export interface InferPaused {
  readonly unit: UnitRequest;
  readonly positions: readonly UnitAnswerPosition[];
  readonly group: InferenceGroup;
  readonly constraints: GroupConstraints;
  readonly contributions: readonly AtomicContribution[];
  readonly variables: readonly FinalVariable[];
  readonly solved: readonly SolvedConstraint[];
  readonly checks: readonly RecordedCheck[];
  readonly requests: readonly [SolveRequest, ...SolveRequest[]];
}

export interface GroupConstraints {
  readonly constraints: readonly ConstraintSet[];
  readonly outsideParts: readonly InferredPartType[];
}

export interface GroupSolution {
  readonly positions: readonly UnitAnswerPosition[];
  readonly solution: Solution;
  readonly contributions: readonly AtomicContribution[];
}

export type InferStep<Value, Request, Paused> = Step<Result<Value>, Request, Paused, Diagnostic>;

export type GroupsOf = (
  deps: GroupDeps,
  bodies: readonly BodyId[],
) => Result<readonly InferenceGroup[]>;

export type ConstraintsOf = (
  deps: InferDeps,
  group: InferenceGroup,
) => InferStep<GroupConstraints, ConstraintsRequest, ConstraintsPaused>;

export type ResumeConstraintsOf = (
  deps: InferDeps,
  paused: ConstraintsPaused,
  answers: readonly ConstraintsAnswer[],
) => InferStep<GroupConstraints, ConstraintsRequest, ConstraintsPaused>;

export type SolveGroup = (
  deps: InferDeps,
  group: InferenceGroup,
  constraints: GroupConstraints,
  unit: UnitRequest,
) => InferStep<GroupSolution, SolveRequest, InferPaused>;

export type ResumeSolveGroup = (
  deps: InferDeps,
  paused: InferPaused,
  answers: readonly SolveAnswer[],
) => InferStep<GroupSolution, SolveRequest, InferPaused>;
