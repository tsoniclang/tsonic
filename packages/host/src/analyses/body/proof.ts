import type { ErrorValue } from "../../diag/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { sameInstance } from "../../ir-types/index.js";
import { admitSummaryIdentity } from "../../ir-facts/index.js";
import type { InitializationProofDeps, InitializationProofInput, ProveInitialization } from "./contract.js";
import { bodyFrontier } from "./places.js";

export const proveModuleInitialization: ProveInitialization = (deps: InitializationProofDeps, input: InitializationProofInput) => {
  const initial = chargeWork(deps.account, 1);
  if (initial !== null) return initial;
  if (input.storage.length !== 0)
    return bodyFrontier("Initialization proof requires the actual exposed-storage cell binding for these obligations.");
  for (const executions of [input.modules, input.entries]) {
    for (const execution of executions) {
      const step = chargeWork(deps.account, 1);
      if (step !== null) return step;
      const answer = deps.summaryOf({ kind: "body", execution });
      const stopped = accountFailure(deps.account);
      if (stopped !== null) return stopped;
      const summary = answer.value;
      if ("kind" in summary) {
        const output = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 8);
        if (output !== null) return output;
        const error: ErrorValue = { kind: "error", causes: [{ kind: "unit", unit: answer.unit }] };
        return { kind: "complete", value: { kind: "ok", value: error, diagnostics: [], emissions: [],
          positions: [{ position: { kind: "result" }, error }] } };
      }
      const identity = admitSummaryIdentity(summary.key, deps.account)
        ?? admitSummaryIdentity({ kind: "body", execution }, deps.account);
      if (identity !== null) return identity;
      if (summary.key.kind !== "body" || summary.key.execution.provided !== execution.provided
        || !sameInstance(summary.key.execution.instance, execution.instance))
        return bodyFrontier("Initialization proof reads the stable summary of its exact selected execution.");
      if (summary.callbacks.length !== 0 || summary.initialization.cells.length !== 0 || summary.initialization.events.length !== 0)
        return bodyFrontier("Initialization proof requires actual callback/event/caller-cell application for these obligations.");
      for (const point of summary.initialization.points) {
        const work = chargeWork(deps.account, 1);
        if (work !== null) return work;
        if (point.kind === "need" || point.kind === "before" || point.kind === "completed")
          return bodyFrontier("Initialization proof requires the genuine supplied cell/event bindings of this stable obligation.");
      }
    }
  }
  const output = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 8);
  if (output !== null) return output;
  return { kind: "complete", value: { kind: "ok", value: { modules: input.modules, entries: input.entries },
    diagnostics: [], emissions: [], positions: [{ position: { kind: "result" }, error: null }] } };
};
