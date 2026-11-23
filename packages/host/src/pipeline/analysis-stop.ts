import type { DataflowStop } from "../dataflow/contract.js";
import type { Result, UnitRequest } from "../diag/contract.js";
import { resourceLimitDiagnostic } from "../diag/index.js";

export function analysisStop(stop: DataflowStop, unit: UnitRequest): Extract<Result<never>, { readonly kind: "refused" }> {
  if (stop.kind === "refused") return stop;
  return { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline", limit: stop.dimension,
    maximum: stop.maximum, site: { kind: "none" }, unit: { request: unit, position: { kind: "result" } } })] };
}
