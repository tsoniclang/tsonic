import type { UnitRef, UnitRequest, UnitResult, UnitValue } from "../diag/contract.js";
import type { BlockId, BodyId, LocalId, NodeRef, TyId } from "../ids/contract.js";
import type { MirBody, MirOperand, MirSite, MirTerminator, MirUnwind } from "../ir-mir/contract.js";
import type { TypedOperation } from "../ir-tir/contract.js";
import type { BodyInstance, ConstantContext, ConstantReference, ConstValue, SignatureOf, TypeOf } from "../ir-types/contract.js";

export interface EvaluatorLimits {
  readonly maximumSteps: number;
  readonly maximumIntermediateBits: number;
  readonly maximumResultBits: number;
  readonly maximumArithmeticWork: number;
}

export interface EvaluateDeps {
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly limits: EvaluatorLimits;
}

export type EvaluationResult =
  | { readonly kind: "value"; readonly value: ConstValue }
  | { readonly kind: "not-constant"; readonly at: NodeRef;
      readonly reason: "external-operation" | "external-storage" | "suspension" };

export type EvaluateRequest =
  | { readonly kind: "mir-body"; readonly instance: BodyInstance }
  | { readonly kind: "const-value"; readonly reference: ConstantReference }
  | { readonly kind: "observation-value"; readonly instance: BodyInstance; readonly at: NodeRef };

export type EvaluateAnswer =
  | { readonly kind: "mir-body"; readonly body: MirBody }
  | { readonly kind: "const-value"; readonly unit: UnitRef; readonly value: UnitValue<EvaluationResult> }
  | { readonly kind: "observation-value"; readonly unit: UnitRef; readonly value: UnitValue<ObservationValue> };

export type ObservationValue = { readonly kind: "value"; readonly value: bigint } | { readonly kind: "error" };

export interface EvaluationWitness {
  readonly instance: BodyInstance;
  readonly site: MirSite;
  readonly request: EvaluateRequest;
  readonly type: TyId | null;
  /** Only indices below count are available. That prefix is never changed, including after resume. */
  readonly ready: { readonly values: readonly ConstValue[]; readonly count: number };
}

export type Task =
  | { readonly kind: "read"; readonly operand: MirOperand; readonly site: MirSite }
  | { readonly kind: "store"; readonly local: LocalId; readonly site: MirSite }
  | { readonly kind: "return"; readonly site: MirSite }
  | { readonly kind: "throw"; readonly site: MirSite; readonly unwind: MirUnwind }
  | { readonly kind: "jump"; readonly block: BlockId }
  | { readonly kind: "switch"; readonly terminator: Extract<MirTerminator, { readonly kind: "switch" }> }
  | { readonly kind: "call"; readonly terminator: Extract<MirTerminator, { readonly kind: "call" }> }
  | { readonly kind: "apply"; readonly operation: TypedOperation; readonly site: MirSite };

export interface Cell {
  value: ConstValue | null;
}

export interface ReadyCall {
  readonly terminator: Extract<MirTerminator, { readonly kind: "call" }>;
  readonly arguments: readonly (Cell | null)[];
  readonly receiver: Cell | null;
  readonly captures: ReadonlyMap<BodyId, ReadonlyMap<LocalId, Cell>>;
}

export interface Frame {
  readonly instance: BodyInstance;
  readonly body: MirBody;
  readonly cells: Map<LocalId, Cell>;
  readonly work: Task[];
  readonly caller: Extract<MirTerminator, { readonly kind: "call" }> | null;
  values: ConstValue[];
  block: BlockId;
  statement: number;
}

export interface Machine {
  readonly deps: EvaluateDeps;
  readonly context: ConstantContext;
  readonly unit: UnitRequest;
  readonly frames: [Frame, ...Frame[]];
  steps: number;
  arithmetic: number;
  result: UnitResult<EvaluationResult> | null;
  pending: { readonly request: EvaluateRequest; readonly type: TyId | null; readonly site: MirSite; readonly call: ReadyCall | null } | null;
}
