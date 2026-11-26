import { requirePresent, throwInvariant } from "../diag/index.js";
import type { MirSite, MirUnwind } from "../ir-mir/contract.js";
import { arithmetic, evaluationFault } from "./budget.js";
import type { EvaluateDeps } from "./contract.js";
import type { EvaluationResult } from "./data.js";
import type { Frame, Machine as EvaluationMachine } from "./pause.js";

type Machine = EvaluationMachine<EvaluateDeps>;

export function current(machine: Machine): Frame {
  return requirePresent(machine.frames.at(-1), { owner: "evaluate", query: null, origin: null,
    message: "An active evaluation must have an executing frame." });
}

export function finish(machine: Machine, value: EvaluationResult): void {
  machine.result = { kind: "ok", value, diagnostics: [], positions: [{ position: { kind: "result" }, error: null }], emissions: [] };
}

export function notConstant(machine: Machine, site: MirSite, reason: Extract<EvaluationResult, { readonly kind: "not-constant" }>["reason"]): void {
  finish(machine, { kind: "not-constant", at: site.tir, reason });
}

export function enterUnwind(machine: Machine, failure: MirUnwind, site: MirSite, nativeFault: string | null):
  Extract<MirUnwind, { readonly kind: "handler" }> | null {
  if (nativeFault !== null && failure.kind === "abort") {
    evaluationFault(machine, site.origin, `A process-ending ${nativeFault} occurred during constant evaluation.`);
    return null;
  }
  for (;;) {
    if (nativeFault !== null && !arithmetic(machine, 1, site.origin)) return null;
    if (failure.kind !== "handler" && failure.kind !== "escape") {
      const message = nativeFault === null && failure.kind === "none"
        ? "An operation marked unable to fail reached its failure arm." : "An unwinding operation must retain its actual unwinding arm.";
      return throwInvariant({ owner: "evaluate", query: null, origin: site.origin, message });
    }
    const frame = current(machine);
    if (failure.kind === "handler") {
      if (nativeFault !== null && failure.exception !== null) {
        notConstant(machine, site, "external-operation");
        return null;
      }
      frame.work.length = 0;
      frame.values = [];
      frame.block = failure.target;
      frame.statement = 0;
      return failure;
    }
    const caller = frame.caller;
    if (caller === null) {
      evaluationFault(machine, site.origin, nativeFault === null ? "A thrown value escaped constant evaluation."
        : `An ${nativeFault} escaped constant evaluation.`);
      return null;
    }
    machine.frames.pop();
    failure = caller.unwind;
  }
}
