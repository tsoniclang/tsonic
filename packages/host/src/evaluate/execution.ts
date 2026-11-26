import { requirePresent, throwInvariant } from "../diag/index.js";
import type { MirCleanupTerminator, MirSite, MirUnwind } from "../ir-mir/contract.js";
import { transferMirCompletion } from "../ir-mir/index.js";
import { arithmetic, evaluationFault } from "./budget.js";
import type { EvaluateDeps } from "./contract.js";
import type { EvaluationResult } from "./data.js";
import type { Frame, Machine as EvaluationMachine, UnwindSignal } from "./pause.js";
import type { BlockId } from "../ids/contract.js";

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

export function enterUnwind(machine: Machine, failure: MirUnwind, signal: UnwindSignal):
  Extract<MirUnwind, { readonly kind: "handler" }> | null {
  const { site } = signal;
  for (;;) {
    if (signal.kind === "native" && !arithmetic(machine, 1, site.origin)) return null;
    if (failure.kind !== "handler" && failure.kind !== "escape" && failure.kind !== "carry") {
      const message = signal.kind === "value" && failure.kind === "none"
        ? "An operation marked unable to fail reached its failure arm." : "An unwinding operation must retain its actual unwinding arm.";
      return throwInvariant({ owner: "evaluate", query: null, origin: site.origin, message });
    }
    const frame = current(machine);
    if (failure.kind === "carry") {
      if (frame.carriedFailure !== null) return cleanupDefect(site, "An unwind landing cannot overwrite a carried failure.");
      frame.carriedFailure = signal;
      resetForUnwind(frame, failure.target);
      return null;
    }
    if (failure.kind === "handler") {
      if (signal.kind === "native" && failure.exception !== null) {
        notConstant(machine, site, "external-operation");
        return null;
      }
      resetForUnwind(frame, failure.target);
      return failure;
    }
    const caller = frame.caller;
    if (caller === null) {
      evaluationFault(machine, site.origin, signal.kind === "value" ? "A thrown value escaped constant evaluation."
        : `An ${signal.description} escaped constant evaluation.`);
      return null;
    }
    machine.frames.pop();
    failure = caller.unwind;
  }
}

function cleanupDefect(site: MirSite, message: string): never {
  return throwInvariant({ owner: "evaluate", query: null, origin: site.origin, message });
}

function resetForUnwind(frame: Frame, target: BlockId): void {
  frame.work.length = 0;
  frame.values = [];
  frame.block = target;
  frame.statement = 0;
}

export function takeCarriedFailure(frame: Frame, site: MirSite): UnwindSignal {
  const failure = frame.carriedFailure;
  if (failure === null) return cleanupDefect(site, "A failure propagation requires the original carried failure.");
  frame.carriedFailure = null;
  return failure;
}

export function transferCleanup(frame: Frame, terminator: MirCleanupTerminator): void {
  const result = transferMirCompletion(terminator, { active: frame.cleanups, carried: frame.carriedFailure });
  if (result.kind === "failure") return cleanupDefect(terminator, `A cleanup transition violates its ${result.reason} relation.`);
  frame.cleanups = result.state.active;
  frame.carriedFailure = result.state.carried;
  frame.block = result.target;
  frame.statement = 0;
}
