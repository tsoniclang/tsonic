import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { DefId } from "../ids/contract.js";
import { decodeBodyId } from "../ids/index.js";
import type { ConditionLimits, SummaryKey } from "../ir-facts/contract.js";
import { admitSummaryIdentity, staticInitializationCellOf, staticInitializationOf, summaryKey } from "../ir-facts/index.js";
import type { Execution } from "../ir-types/contract.js";
import { executionKey } from "../ir-types/index.js";
import type { ProgramIndex, ProgramInitialization, ProgramRule } from "./contract.js";
import type { ProgramLookup } from "./work.js";
import type { ProgramViolation } from "./work-data.js";
import { numberDetail } from "./program-values.js";

export function verifyInitialization(index: ProgramIndex, lookup: ProgramLookup, expected: ProgramInitialization,
  account: DataflowAccount): DataflowResult<readonly ProgramViolation[]> {
  const start = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (start !== null) return start;
  const actual = index.initialization;
  const violations: ProgramViolation[] = [];
  const report = (rule: ProgramRule, position: number | null): DataflowStop | null => {
    const stop = chargeResultEntries(account, position === null ? 3 : 4);
    if (stop !== null) return stop;
    violations.push({ rule, site: { kind: "index" }, detail: position === null ? [] : [numberDetail(position)] });
    return null;
  };
  if (actual.entry !== expected.entry || lookup.modules.get(actual.entry)?.package !== index.rootPackage) {
    const stop = report("initialization-entry-exact", null);
    if (stop !== null) return stop;
  }
  if (actual.external.length !== expected.external.length) {
    const stop = report("initialization-exposure-exact", null);
    if (stop !== null) return stop;
  }
  for (let position = 0; position < actual.external.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const selection = actual.external[position];
    const authorized = expected.external[position];
    let exact = selection !== undefined && authorized !== undefined && selection.module === authorized.module
      && selection.name === authorized.name && lookup.modules.get(selection.module) != null
      && selection.definitions.length !== 0 && selection.definitions.length === authorized.definitions.length
      && selection.storage.length === authorized.storage.length;
    if (exact && selection !== undefined && authorized !== undefined) {
      for (let member = 0; member < selection.definitions.length; member += 1) {
        const definitionRead = chargeWork(account, 1);
        if (definitionRead !== null) return definitionRead;
        const definition = selection.definitions[member];
        if (definition === undefined || definition !== authorized.definitions[member] || lookup.definitions.get(definition) == null) {
          exact = false;
          break;
        }
      }
      for (let member = 0; exact && member < selection.storage.length; member += 1) {
        const cellRead = chargeWork(account, 1);
        if (cellRead !== null) return cellRead;
        const reference = selection.storage[member];
        const original = authorized.storage[member];
        if (reference === undefined || original === undefined || reference.owner.kind !== "summary"
          || reference.owner.key.kind !== "body" || !Object.is(reference.cell, original.cell)
          || !Number.isSafeInteger(reference.cell) || reference.cell < 0 || Object.is(reference.cell, -0)) {
          exact = false;
          break;
        }
        const key = reference.owner.key;
        const identity = admitSummaryIdentity(key, account) ?? admitSummaryIdentity(original.owner.key, account);
        if (identity !== null) return identity;
        exact = summaryKey(key) === summaryKey(original.owner.key);
      }
    }
    if (!exact) {
      const stop = report("initialization-exposure-exact", position);
      if (stop !== null) return stop;
    }
  }
  const executions = (published: readonly Execution[], authorized: readonly Execution[], module: boolean): DataflowStop | null => {
    if (published.length !== authorized.length) {
      const stop = report("initialization-executions-exact", null);
      if (stop !== null) return stop;
    }
    for (let position = 0; position < published.length; position += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const execution = published[position];
      const original = authorized[position];
      if (execution !== undefined && original !== undefined) {
        const admitted = admitSummaryIdentity({ kind: "body", execution }, account)
          ?? admitSummaryIdentity({ kind: "body", execution: original }, account);
        if (admitted !== null) return admitted;
        const key = executionKey(execution);
        const decoded = decodeBodyId(execution.instance.body);
        if (key === executionKey(original) && lookup.executions.get(key) != null
          && decoded.kind === "decoded" && (decoded.value.role === "module") === module
          && (!module || execution.provided === 0)) continue;
      }
      const stop = report("initialization-executions-exact", position);
      if (stop !== null) return stop;
    }
    return null;
  };
  const stopped = executions(actual.modules, expected.modules, true) ?? executions(actual.entries, expected.entries, false);
  return stopped === null ? { kind: "complete", value: violations } : stopped;
}

function verifyExposedStorage(plan: ProgramInitialization, lookup: ProgramLookup, limits: ConditionLimits,
  writtenOnEntry: (key: string) => boolean, invalid: (position: number) => DataflowResult<ProgramViolation>):
  DataflowResult<ProgramViolation | null> {
  const { account } = limits;
  let scheduled: Set<string> | undefined;
  for (let position = 0; position < plan.external.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const selection = plan.external[position];
    if (selection === undefined) return invalid(position);
    if (selection.storage.length === 0) continue;
    if (scheduled === undefined) {
      const setup = chargeResultEntries(account, 1);
      if (setup !== null) return setup;
      scheduled = new Set();
      let remaining = plan.modules.length;
      if (remaining !== 0) {
        const first = chargeWork(account, 1);
        if (first !== null) return first;
        for (const execution of plan.modules) {
          const key: SummaryKey = { kind: "body", execution };
          const retain = admitSummaryIdentity(key, account) ?? chargeResultEntries(account, 1);
          if (retain !== null) return retain;
          scheduled.add(summaryKey(key));
          remaining -= 1;
          if (remaining !== 0) {
            const next = chargeWork(account, 1);
            if (next !== null) return next;
          }
        }
      }
    }
    const group = chargeResultEntries(account, 1);
    if (group !== null) return group;
    const definitions = new Set<DefId>();
    for (let member = 0; member < selection.definitions.length; member += 1) {
      const row = chargeWork(account, 1);
      if (row !== null) return row;
      const definition = selection.definitions[member];
      if (definition === undefined) return invalid(position);
      const entry = chargeWork(account, definition.length) ?? chargeResultEntries(account, 1);
      if (entry !== null) return entry;
      definitions.add(definition);
    }
    for (let member = 0; member < selection.storage.length; member += 1) {
      const referenceRead = chargeWork(account, 1);
      if (referenceRead !== null) return referenceRead;
      const reference = selection.storage[member];
      if (reference?.owner.kind !== "summary" || reference.owner.key.kind !== "body") return invalid(position);
      const key = reference.owner.key;
      const admitted = admitSummaryIdentity(key, account);
      if (admitted !== null) return admitted;
      const identity = summaryKey(key);
      const summary = lookup.summaries.get(identity);
      if (summary == null || !scheduled.has(identity)) return invalid(position);
      const body = decodeBodyId(key.execution.instance.body);
      if (body.kind !== "decoded" || body.value.role !== "module") return invalid(position);
      const owner = lookup.definitions.get(body.value.owner);
      if (owner == null) return invalid(position);
      const selected = staticInitializationCellOf(summary, reference.cell, account);
      if (selected.kind !== "complete") return selected;
      if (selected.value === null) return invalid(position);
      const { declaration, key: cellKey } = selected.value;
      const match = chargeWork(account, declaration.definition.length + cellKey.length + 1);
      if (match !== null) return match;
      if (!definitions.delete(declaration.definition) || lookup.definitions.get(declaration.definition)?.module !== owner.module
        || !writtenOnEntry(cellKey)) return invalid(position);
    }
  }
  return { kind: "complete", value: null };
}

export function verifyInitializationEffects(plan: ProgramInitialization, lookup: ProgramLookup, limits: ConditionLimits):
  DataflowResult<ProgramViolation | null> {
  const { account } = limits;
  let written: Set<string> | null = null;
  const writtenOnEntry = (key: string): boolean => written?.has(key) === true;
  const invalid = (position: number): DataflowResult<ProgramViolation> => {
    const emit = chargeResultEntries(account, 4);
    return emit ?? { kind: "complete", value: { rule: "plan-initialized", site: { kind: "index" }, detail: [numberDetail(position)] } };
  };
  for (const [phase, executions] of [plan.modules, plan.entries].entries()) {
    if (phase !== 0) {
      const exposed = verifyExposedStorage(plan, lookup, limits, writtenOnEntry, invalid);
      if (exposed.kind !== "complete" || exposed.value !== null) return exposed;
    }
    for (let position = 0; position < executions.length; position += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const execution = executions[position];
      if (execution === undefined) return invalid(position);
      const key: SummaryKey = { kind: "body", execution };
      const admission = admitSummaryIdentity(key, account);
      if (admission !== null) return admission;
      const summary = lookup.summaries.get(summaryKey(key));
      if (summary == null) return invalid(position);
      const effect = staticInitializationOf(summary, writtenOnEntry, limits);
      if (effect.kind !== "complete") return effect;
      if (effect.value.kind === "unbound" || effect.value.unmet.length !== 0) return invalid(position);
      if (phase === 0 && effect.value.writes.length !== 0) {
        const setup = chargeResultEntries(account, written === null ? 1 : 0);
        if (setup !== null) return setup;
        written ??= new Set();
        for (const writtenKey of effect.value.writes) {
          const lookup = chargeWork(account, writtenKey.length + 1);
          if (lookup !== null) return lookup;
          if (written.has(writtenKey)) continue;
          const growth = chargeResultEntries(account, 1);
          if (growth !== null) return growth;
          written.add(writtenKey);
        }
      }
      if (phase === 0 && !summary.returns) return { kind: "complete", value: null };
    }
  }
  return { kind: "complete", value: null };
}
