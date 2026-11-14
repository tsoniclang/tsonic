import { throwInvariant } from "../diag/index.js";
import type { Machine } from "./data.js";

interface Suspension {
  readonly machine: Machine;
  consumed: boolean;
}

export class EvaluationSuspension {
  private readonly state: Suspension;
  private constructor(state: Suspension) { this.state = state; }
  static create(machine: Machine): EvaluationSuspension {
    return new EvaluationSuspension({ machine, consumed: false });
  }
  static consume(paused: EvaluationSuspension): Machine {
    if (!(paused instanceof EvaluationSuspension) || paused.state.consumed)
      return throwInvariant({ owner: "evaluate", query: null, origin: null, message: "Evaluate must resume its own unconsumed pause exactly once." });
    paused.state.consumed = true;
    return paused.state.machine;
  }
}
