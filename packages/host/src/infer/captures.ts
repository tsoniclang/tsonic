import type { BodyId, LocalId } from "../ids/contract.js";
import type { HirBody, HirParam } from "../ir-hir/contract.js";
import type { CaptureModeEvidence, CaptureRow, CaptureSource } from "../ir-infer/contract.js";
import type { Result } from "../diag/contract.js";
import type { InferDeps } from "./contract.js";
import { callerDefect, notInferredYet } from "./frontier.js";

export function bodyCaptureModes<State>(deps: InferDeps<State>, source: HirBody, take: (work: number) => boolean): Result<readonly CaptureRow[]> | null {
  if (!take(source.captures.length * 6)) return null;
  const input: CaptureModeEvidence[] = [];
  const parameters = new Map<BodyId, ReadonlyMap<LocalId, HirParam>>();
  for (const reference of source.captures) {
    const owner = deps.hirBody(reference.body);
    const local = owner.locals[reference.local];
    if (owner.body !== reference.body || local === undefined || !Object.is(local.id, reference.local) || reference.body === source.body)
      return callerDefect("SolveGroup", "a body capture requires its actual qualified outer local");
    if (local.role === "capture") return notInferredYet("SolveGroup", "the creating body's actual incoming logical capture mode", source.root.origin);
    let incoming: CaptureSource;
    if (local.role === "parameter") {
      let rows = parameters.get(owner.body);
      if (rows === undefined) {
        if (!take(owner.params.length * 2)) return null;
        const indexed = new Map<LocalId, HirParam>();
        for (const row of owner.params) {
          if (indexed.has(row.local)) return callerDefect("SolveGroup", "a demanded formal inventory repeats its actual local");
          indexed.set(row.local, row);
        }
        rows = indexed;
        parameters.set(owner.body, rows);
      }
      const parameter = rows.get(reference.local);
      if (parameter !== undefined) {
        if (!Object.is(parameter.local, reference.local) || local.declaration.kind !== "item"
          || local.declaration.value.owner !== parameter.declaration)
          return callerDefect("SolveGroup", "a captured formal requires its exact checked local and declaration association");
        incoming = { kind: "parameter", passing: parameter.passing };
      } else {
        const declaration = local.declaration.kind === "item" ? deps.itemOf(local.declaration.value.owner) : null;
        if (declaration?.kind !== "BindingElement" || declaration.id !== local.declaration.value.node
          || declaration.tsonic.declaration?.kind !== "local" || declaration.tsonic.declaration.local.body !== reference.body
          || !Object.is(declaration.tsonic.declaration.local.local, reference.local))
          return callerDefect("SolveGroup", "a captured parameter requires its actual formal row or checked pattern-bound declaration");
        incoming = { kind: "binding" };
      }
    } else incoming = { kind: "binding" };
    input.push({ local: reference, reassignable: local.mutable, incoming });
  }
  return deps.rules.decideCaptureModes(input);
}
