import type { Diagnostic, UnitRequest, UnitResult } from "../diag/contract.js";
import type { BodyInstance, ConstantContext, ConstValue, TypeTable, SelectedNativeFacts, SignatureOf, TypeOf } from "../ir-types/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { Step } from "../step/contract.js";
import type { EvaluationSuspension } from "./pause.js";
import type { EvaluateAnswer, EvaluateRequest, EvaluationResult, EvaluationWitness } from "./data.js";

export type { EvaluateRequest, EvaluateAnswer, EvaluationResult, EvaluationWitness, ObservationValue } from "./data.js";

export interface EvaluatorLimits {
  readonly maximumSteps: number;
  readonly maximumIntermediateBits: number;
  readonly maximumResultBits: number;
  readonly maximumArithmeticWork: number;
}

export interface EvaluateDeps {
  readonly types: TypeTable;
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly selectedNativeFacts: SelectedNativeFacts;
  readonly limits: EvaluatorLimits;
}

export type EvaluationContinuation = EvaluationSuspension<EvaluateDeps>;
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
