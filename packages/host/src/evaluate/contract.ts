import type { Result } from "../diag/contract.js";
import type { NodeRef, Origin } from "../ids/contract.js";
import type { BodyInstance, ConstantContext, ConstValue, SignatureOf, TypeOf } from "../ir-types/contract.js";
import type { MirBody } from "../ir-mir/contract.js";

export interface EvaluatorLimits {
  readonly maximumSteps: number;
  readonly maximumIntermediateBits: number;
  readonly maximumResultBits: number;
  readonly maximumArithmeticWork: number;
}

export interface EvaluateDeps {
  readonly mirBody: (instance: BodyInstance) => MirBody;
  readonly constValue: (initializer: BodyInstance, context: ConstantContext) => ConstValue;
  readonly observationValue: (instance: BodyInstance, at: NodeRef) => bigint;
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly limits: EvaluatorLimits;
}

export type EvaluationResult =
  | { readonly kind: "value"; readonly value: ConstValue }
  | { readonly kind: "thrown"; readonly value: ConstValue; readonly origin: Origin }
  | { readonly kind: "not-constant"; readonly at: NodeRef;
      readonly reason: "external-operation" | "external-storage" | "suspension" };

export type Evaluate = (
  deps: EvaluateDeps,
  entry: BodyInstance,
  arguments_: readonly ConstValue[],
  context: ConstantContext,
) => Result<EvaluationResult>;
