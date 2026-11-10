import type { Computed, Result } from "../diag/contract.js";
import type { BodyId, DefId, TyId } from "../ids/contract.js";
import type { ArtifactBindings, BodyInstance, ConstantContext, ConstValue, MemberTable, Signature, TypeEvidence, TypeExpansionLimits, TypeInterner, TypeProductionRequest } from "../ir-types/contract.js";
import type { CheckedPhase, Declaration, HirBody } from "../ir-hir/contract.js";
import type { AtomicContribution, ConstraintSet, InferenceGroup, RuleTable, Solution } from "../ir-infer/contract.js";

export interface InferenceLimits {
  readonly maximumVariablesPerGroup: number;
  readonly maximumAtomicContributionsPerGroup: number;
}

export interface GroupDeps {
  readonly hirBody: (body: BodyId) => HirBody;
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
}

export interface InferDeps {
  readonly group: InferenceGroup;
  readonly hirBody: (body: BodyId) => HirBody;
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly signatureOf: (definition: DefId, bindings: ArtifactBindings) => Signature;
  readonly membersOf: (type: TyId) => MemberTable;
  readonly constValue: (initializer: BodyInstance, context: ConstantContext) => ConstValue;
  readonly produceType: (request: TypeProductionRequest) => TypeEvidence;
  readonly types: TypeInterner;
  readonly typeExpansion: TypeExpansionLimits;
  readonly limits: InferenceLimits;
}

export type GroupsOf = (
  deps: GroupDeps,
  bodies: readonly BodyId[],
) => Computed<readonly InferenceGroup[]>;

export type ConstraintsOf = (deps: InferDeps, body: HirBody) => Result<ConstraintSet>;

export type EnumerateContributions = (
  deps: InferDeps,
  rules: RuleTable,
  constraints: readonly ConstraintSet[],
) => Result<readonly AtomicContribution[]>;

export type SolveGroup = (
  deps: InferDeps,
  rules: RuleTable,
  constraints: readonly ConstraintSet[],
) => Result<Solution>;
