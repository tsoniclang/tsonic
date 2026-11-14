import { throwInvariant } from "../diag/index.js";
import type { UnitRequest, UnitResult } from "../diag/contract.js";
import type { BlockId, BodyId, LocalId, TyId } from "../ids/contract.js";
import type { MirBody, MirOperand, MirSite, MirTerminator, MirUnwind } from "../ir-mir/contract.js";
import type { TypedOperation } from "../ir-tir/contract.js";
import type { BodyInstance, ConstantContext, ConstValue } from "../ir-types/contract.js";
import type { EvaluateRequest, EvaluationResult } from "./data.js";

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
  readonly receiver: { readonly value: ConstValue; readonly cell: Cell | null } | null;
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

export interface Machine<Dependencies> {
  readonly deps: Dependencies;
  readonly context: ConstantContext;
  readonly unit: UnitRequest;
  readonly frames: [Frame, ...Frame[]];
  steps: number;
  arithmetic: number;
  result: UnitResult<EvaluationResult> | null;
  pending: { readonly request: EvaluateRequest; readonly type: TyId | null; readonly site: MirSite; readonly call: ReadyCall | null } | null;
}

interface Suspension<Dependencies> {
  readonly machine: Machine<Dependencies>;
  consumed: boolean;
}

export class EvaluationSuspension<Dependencies> {
  private readonly state: Suspension<Dependencies>;
  private constructor(state: Suspension<Dependencies>) { this.state = state; }
  static create<Dependencies>(machine: Machine<Dependencies>): EvaluationSuspension<Dependencies> {
    return new EvaluationSuspension({ machine, consumed: false });
  }
  static consume<Dependencies>(paused: EvaluationSuspension<Dependencies>): Machine<Dependencies> {
    if (!(paused instanceof EvaluationSuspension) || paused.state.consumed)
      return throwInvariant({ owner: "evaluate", query: null, origin: null, message: "Evaluate must resume its own unconsumed pause exactly once." });
    paused.state.consumed = true;
    return paused.state.machine;
  }
}
