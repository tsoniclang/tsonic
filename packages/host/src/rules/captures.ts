import type { BodyId, LocalId } from "../ids/contract.js";
import type { CaptureRow } from "../ir-infer/contract.js";
import { captureRequiresLocation } from "../ir-infer/index.js";
import { throwInvariant } from "../diag/index.js";
import type { DecideCaptureModes } from "./contract.js";

export const decideCaptureModes: DecideCaptureModes = (_deps, input) => {
  const seen = new Map<BodyId, Set<LocalId>>();
  const rows: CaptureRow[] = [];
  for (const evidence of input) {
    const reference = evidence.local;
    if (!Number.isSafeInteger(reference.local) || reference.local < 0 || Object.is(reference.local, -0))
      return throwInvariant({ owner: "rules", query: null, origin: null, message: "A capture mode requires its actual qualified local." });
    let locals = seen.get(reference.body);
    if (locals === undefined) { locals = new Set(); seen.set(reference.body, locals); }
    if (locals.has(reference.local))
      return throwInvariant({ owner: "rules", query: null, origin: null, message: "A capture mode inventory cannot repeat a qualified local." });
    locals.add(reference.local);
    rows.push({ local: reference, capture: captureRequiresLocation(evidence.reassignable, evidence.incoming)
      ? "captured-location" : "captured-value" });
  }
  return { kind: "ok", value: rows, diagnostics: [] };
};
