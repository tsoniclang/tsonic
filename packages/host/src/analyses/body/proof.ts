import type { DataflowStop } from "../../dataflow/contract.js";
import type { Cause, Diagnostic, DiagnosticCode, DiagnosticIdentity, ErrorValue, RelatedDiagnostic, UnitDiagnostic } from "../../diag/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { hostDiagnosticCode, requirePresent } from "../../diag/index.js";
import { sameInstance } from "../../ir-types/index.js";
import type { StaticInitializationCell, SummaryPosition, UnmetStaticNeed } from "../../ir-facts/contract.js";
import { admitSummaryIdentity, staticInitializationCellOf, staticInitializationOf } from "../../ir-facts/index.js";
import type { InitializationProofDeps, InitializationProofInput, ProveInitialization } from "./contract.js";
import { bodyFrontier } from "./places.js";

function initializationFailure(diagnostics: Diagnostic[], emissions: UnitDiagnostic[], causes: Cause[]): ReturnType<ProveInitialization> {
  const first = requirePresent(causes[0], { owner: "analyses/body", query: null, origin: null,
    message: "A failed module plan must retain its actual initialization need." });
  const value: ErrorValue = { kind: "error", causes: [first, ...causes.slice(1)] };
  return { kind: "complete", value: { kind: "ok", value, diagnostics, emissions, positions: [{ position: { kind: "result" }, error: value }] } };
}

function appendPropagation(deps: InitializationProofDeps, position: SummaryPosition, code: DiagnosticCode,
  related: RelatedDiagnostic[]): DataflowStop | null {
  const admission = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 3);
  if (admission !== null) return admission;
  const location = deps.originAt(position);
  const stopped = accountFailure(deps.account);
  if (stopped !== null) return stopped;
  if (location === null) return bodyFrontier("The initialization witness requires its actual propagation site.");
  related.push({ code, site: { kind: "source", origin: location }, message: "The called execution carries this initialization need." });
  return null;
}

function unmetStaticNeeds(deps: InitializationProofDeps, unmet: readonly UnmetStaticNeed[]): ReturnType<ProveInitialization> {
  const { account } = deps;
  const start = chargeWork(account, 1) ?? chargeResultEntries(account, 7 + unmet.length * 9);
  if (start !== null) return start;
  const name = hostDiagnosticCode("TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  const code: DiagnosticCode = { kind: "host", name, rendered: name };
  const diagnostics: Diagnostic[] = [];
  const emissions: UnitDiagnostic[] = [];
  const causes: Cause[] = [];
  for (const need of unmet) {
    const read = chargeWork(account, 3);
    if (read !== null) return read;
    const origin = deps.originOf(need.witness.read);
    const nodeStop = accountFailure(account);
    if (nodeStop !== null) return nodeStop;
    if (origin === null) return bodyFrontier("The initialization witness requires its actual qualified source read.");
    const related: RelatedDiagnostic[] = [];
    if (need.witness.via.length !== 0) {
      const stopped = appendPropagation(deps, need.at, code, related);
      if (stopped !== null) return stopped;
    }
    for (const [index, link] of need.witness.via.entries()) {
      const admission = chargeWork(account, 2) ?? admitSummaryIdentity(link.key, account);
      if (admission !== null) return admission;
      const summary = deps.summaryOf(link.key).value;
      const lookupStop = accountFailure(account);
      if (lookupStop !== null) return lookupStop;
      const row = "kind" in summary ? undefined : summary.initialization.rows[link.row];
      const point = row === undefined || "kind" in summary ? undefined : summary.initialization.points[row.point];
      if (point?.kind !== "need") return bodyFrontier("The initialization witness requires its actual propagated need.");
      if (index + 1 < need.witness.via.length) {
        const stopped = appendPropagation(deps, point.at, code, related);
        if (stopped !== null) return stopped;
      }
    }
    const declaration = deps.declarationOriginOf(need.declaration.definition);
    const declarationStop = accountFailure(account);
    if (declarationStop !== null) return declarationStop;
    if (declaration === null) return bodyFrontier("The static initialization need retains its actual declaration.");
    related.push({ code, site: { kind: "source", origin: declaration }, message: "The static storage is declared here." });
    const diagnostic: Diagnostic = { code, severity: "error", site: { kind: "source", origin }, source: "initialization",
      evidence: [], message: "Static storage can be read before it is initialized.", arguments: [], related, fix: null };
    const identity: DiagnosticIdentity = { kind: "host", code: name, unit: { request: deps.unit,
      position: { kind: "source-node", node: need.witness.read } } };
    diagnostics.push(diagnostic);
    causes.push({ kind: "diagnostic", diagnostic: identity });
    emissions.push({ identity, diagnostic });
  }
  return initializationFailure(diagnostics, emissions, causes);
}

interface InitializationFailures {
  readonly diagnostics: Diagnostic[];
  readonly emissions: UnitDiagnostic[];
  readonly causes: Cause[];
}

function appendUninitializedExposure(deps: InitializationProofDeps, cell: StaticInitializationCell,
  failures: InitializationFailures): DataflowStop | null {
  const read = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 12);
  if (read !== null) return read;
  const origin = deps.originOf(cell.source);
  const stopped = accountFailure(deps.account);
  if (stopped !== null) return stopped;
  if (origin === null) return bodyFrontier("An exposed static obligation retains its actual declaration source.");
  const name = hostDiagnosticCode("TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  const diagnostic: Diagnostic = { code: { kind: "host", name, rendered: name }, severity: "error",
    site: { kind: "source", origin }, source: "initialization", evidence: [], arguments: [], related: [], fix: null,
    message: "Exported static storage is not initialized on the returning module plan." };
  const identity: DiagnosticIdentity = { kind: "host", code: name, unit: { request: deps.unit,
    position: { kind: "source-node", node: cell.source } } };
  failures.diagnostics.push(diagnostic);
  failures.emissions.push({ identity, diagnostic });
  failures.causes.push({ kind: "diagnostic", diagnostic: identity });
  return null;
}

export const proveModuleInitialization: ProveInitialization = (deps: InitializationProofDeps, input: InitializationProofInput) => {
  const initial = chargeWork(deps.account, 1);
  if (initial !== null) return initial;
  let written: Set<string> | null = null;
  const writtenOnEntry = (key: string): boolean => written?.has(key) === true;
  let reachesExposure = true;
  for (const [phase, executions] of [input.modules, input.entries].entries()) {
    if (phase !== 0 && reachesExposure && input.storage.length !== 0) {
      let failures: InitializationFailures | null = null;
      for (let position = 0; position < input.storage.length; position += 1) {
        const read = chargeWork(deps.account, 1);
        if (read !== null) return read;
        const reference = input.storage[position];
        if (reference?.owner.kind !== "summary" || reference.owner.key.kind !== "body")
          return bodyFrontier("Initialization proof requires the actual exposed-storage cell binding for these obligations.");
        const key = reference.owner.key;
        const admission = admitSummaryIdentity(key, deps.account);
        if (admission !== null) return admission;
        const answer = deps.summaryOf(key);
        const stopped = accountFailure(deps.account);
        if (stopped !== null) return stopped;
        const summary = answer.value;
        if ("kind" in summary || summary.key.kind !== "body" || summary.key.execution.provided !== key.execution.provided
          || !sameInstance(summary.key.execution.instance, key.execution.instance))
          return bodyFrontier("Initialization proof requires the actual exposed-storage cell binding for these obligations.");
        const selected = staticInitializationCellOf(summary, reference.cell, deps.account);
        if (selected.kind !== "complete") return selected;
        if (selected.value === null)
          return bodyFrontier("Initialization proof requires the actual exposed-storage cell binding for these obligations.");
        const lookup = chargeWork(deps.account, selected.value.key.length);
        if (lookup !== null) return lookup;
        if (writtenOnEntry(selected.value.key)) continue;
        const allocation = chargeResultEntries(deps.account, failures === null ? 4 : 0);
        if (allocation !== null) return allocation;
        failures ??= { diagnostics: [], emissions: [], causes: [] };
        const emission = appendUninitializedExposure(deps, selected.value, failures);
        if (emission !== null) return emission;
      }
      if (failures !== null) {
        const result = chargeResultEntries(deps.account, 8 + failures.causes.length);
        if (result !== null) return result;
        return initializationFailure(failures.diagnostics, failures.emissions, failures.causes);
      }
    }
    for (const execution of executions) {
      if (!reachesExposure) break;
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
      const effect = staticInitializationOf(summary, writtenOnEntry, { account: deps.account, refusal: deps.conditionRefusal,
        maximumConditionAlternatives: deps.maximumConditionAlternatives, eventCount: 0 });
      if (effect.kind !== "complete") return effect;
      if (effect.value.kind === "unbound")
        return bodyFrontier("Initialization proof requires the actual supplied cell and completion-event bindings of this obligation.");
      if (effect.value.unmet.length !== 0) return unmetStaticNeeds(deps, effect.value.unmet);
      if (phase === 0 && effect.value.writes.length !== 0) {
        const setup = chargeResultEntries(deps.account, written === null ? 1 : 0);
        if (setup !== null) return setup;
        written ??= new Set();
        for (const key of effect.value.writes) {
          const lookup = chargeWork(deps.account, key.length + 1);
          if (lookup !== null) return lookup;
          if (written.has(key)) continue;
          const growth = chargeResultEntries(deps.account, 1);
          if (growth !== null) return growth;
          written.add(key);
        }
      }
      if (phase === 0 && !summary.returns) reachesExposure = false;
    }
  }
  const output = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 8);
  if (output !== null) return output;
  return { kind: "complete", value: { kind: "ok", value: { modules: input.modules, entries: input.entries },
    diagnostics: [], emissions: [], positions: [{ position: { kind: "result" }, error: null }] } };
};
