import type { Diagnostic, UnitRequest, UnitResult } from "../diag/contract.js";
import type { BodyInstance, ConstantContext, ConstValue } from "../ir-types/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { Step } from "../step/contract.js";
import type { EvaluationSuspension } from "./pause.js";
import type { EvaluateAnswer, EvaluateDeps, EvaluateRequest, EvaluationResult, EvaluationWitness } from "./data.js";

export type { EvaluatorLimits, EvaluateDeps, EvaluateRequest, EvaluateAnswer, EvaluationResult, EvaluationWitness, ObservationValue } from "./data.js";
export type EvaluationContinuation = EvaluationSuspension;
export interface EvaluationPaused {
  readonly continuation: EvaluationContinuation;
  readonly witness: EvaluationWitness;
}
export type EvaluationStep = Step<UnitResult<EvaluationResult>, EvaluateRequest, EvaluationPaused, Diagnostic>;

export type Evaluate = (
  deps: EvaluateDeps,
  entry: BodyInstance,
  body: MirBody,
  arguments_: readonly ConstValue[],
  context: ConstantContext,
  unit: UnitRequest,
) => EvaluationStep;

export type ResumeEvaluate = (deps: EvaluateDeps, paused: EvaluationPaused, answers: readonly EvaluateAnswer[]) => EvaluationStep;
