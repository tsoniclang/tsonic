import { accountFailure, chargeResultEntries, chargeWork, refuseAccount } from "../dataflow/index.js";
import type { RelationalOwner, SummaryAnswer, SummaryKey } from "../ir-facts/contract.js";
import { admitSummaryIdentity, summaryKey, verifyFacts, verifySummary } from "../ir-facts/index.js";
import { sameInstance } from "../ir-types/index.js";
import type { ConvergeComponent, StableBody } from "./contract.js";

export const convergeComponent: ConvergeComponent = (deps, input) => {
  const { account } = deps.resources;
  const initial = accountFailure(account);
  if (initial !== null) return initial;
  if (!Number.isSafeInteger(input.maximumIterations) || input.maximumIterations < 0 || Object.is(input.maximumIterations, -0))
    throw new TypeError("The component iteration bound is a nonnegative safe count.");
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
  if (setup !== null) return setup;
  const component = input.inventory.components[input.component];
  if (!Number.isSafeInteger(input.component) || Object.is(input.component, -0) || component === undefined || component.kind !== "body")
    throw new TypeError("Only an actual body component is converged; declared operations bind separately.");
  if (component.members.length !== input.members.length || component.members.length === 0)
    throw new TypeError("Convergence receives exactly the selected component's members.");
  const members = new Map<string, number>();
  for (let position = 0; position < component.members.length; position += 1) {
    const row = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (row !== null) return row;
    const operationIndex = component.members[position];
    const operation = operationIndex === undefined ? undefined : input.inventory.operations[operationIndex];
    const member = input.members[position];
    if (operation === undefined || operation.kind !== "body" || member === undefined)
      throw new TypeError("Component members retain their actual body execution and ready bodies.");
    const identities = admitSummaryIdentity(operation, account)
      ?? admitSummaryIdentity({ kind: "body", execution: member.execution }, account);
    if (identities !== null) return identities;
    const identity = summaryKey(operation);
    if (identity !== summaryKey({ kind: "body", execution: member.execution }) || members.has(identity))
      throw new TypeError("Component membership uses complete execution identity exactly once.");
    if (!sameInstance(member.execution.instance, { body: member.mir.body, bindings: member.mir.bindings })
      || !sameInstance(member.execution.instance, { body: member.tir.body, bindings: member.tir.bindings }))
      throw new TypeError("Each member borrows its actual selected MIR and TIR instance.");
    members.set(identity, position);
  }
  const required = new Set<string>();
  let internal = false;
  let previous = -1;
  for (let position = 0; position < component.rows.length; position += 1) {
    const row = chargeWork(account, 1);
    if (row !== null) return row;
    const selected = component.rows[position];
    const dependency = selected === undefined ? undefined : input.inventory.dependencies[selected];
    if (selected === undefined || selected <= previous || dependency === undefined)
      throw new TypeError("A component retains its actual dependency occurrences in inventory order.");
    previous = selected;
    const source: SummaryKey = { kind: "body", execution: dependency.dependent };
    const identities = admitSummaryIdentity(source, account) ?? admitSummaryIdentity(dependency.target, account);
    if (identities !== null) return identities;
    if (!members.has(summaryKey(source))) throw new TypeError("Every component row is dependent on one of its members.");
    const target = summaryKey(dependency.target);
    if (members.has(target)) internal = true;
    else {
      const entry = chargeResultEntries(account, 1);
      if (entry !== null) return entry;
      required.add(target);
    }
  }
  const summaries = new Map<string, SummaryAnswer>();
  for (let position = 0; position < input.outside.length; position += 1) {
    const row = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (row !== null) return row;
    const selected = input.outside[position];
    if (selected === undefined) throw new TypeError("The outside stable-answer vector is dense.");
    const admission = admitSummaryIdentity(selected.key, account);
    if (admission !== null) return admission;
    const key = summaryKey(selected.key);
    if (!required.has(key) || summaries.has(key)) throw new TypeError("Outside answers match exactly the component's actual external dependency keys.");
    if (!("kind" in selected.answer.value)) {
      const identity = admitSummaryIdentity(selected.answer.value.key, account);
      if (identity !== null) return identity;
      if (summaryKey(selected.answer.value.key) !== key) throw new TypeError("A stable answer retains its complete selected Summary key.");
    }
    summaries.set(key, selected.answer);
  }
  if (required.size !== summaries.size) throw new TypeError("Every external dependency has its actual completed stable answer.");
  if (internal) throw new TypeError("Recursive convergence still requires Foundations' genuine least Summary relation; no unknown or empty seed is admitted.");
  if (input.maximumIterations === 0) return refuseAccount(account, input.iterationRefusal);
  const output: StableBody[] = [];
  const summaryOf = (key: SummaryKey): SummaryAnswer => {
    const selected = summaries.get(summaryKey(key));
    if (selected === undefined) throw new TypeError("A body round reads only its closed discovered dependencies.");
    return selected;
  };
  for (let position = 0; position < input.members.length; position += 1) {
    const row = chargeWork(account, 1);
    if (row !== null) return row;
    const member = input.members[position];
    if (member === undefined) throw new TypeError("The selected member vector is dense.");
    const storage = deps.analyzeStorageUse({ account }, { execution: member.execution, body: member.mir });
    const stoppedStorage = accountFailure(account);
    if (stoppedStorage !== null) return stoppedStorage;
    if (storage.kind === "refused") return refuseAccount(account, storage);
    const round = deps.analyzeBodyRound({ ...deps.environment, summaryOf, account, unit: member.unit }, {
      execution: member.execution, mir: member.mir, tir: member.tir, liveness: storage.value,
    });
    const stoppedRound = accountFailure(account);
    if (stoppedRound !== null) return stoppedRound;
    if (round.kind !== "complete") return round;
    const result = round.value;
    if (result.kind === "refused") return refuseAccount(account, result);
    if ("facts" in result.value) {
      const pair = result.value;
      const expected: SummaryKey = { kind: "body", execution: member.execution };
      const identities = admitSummaryIdentity(expected, account)
        ?? admitSummaryIdentity(pair.summary.key, account)
        ?? admitSummaryIdentity({ kind: "body", execution: pair.facts.execution }, account);
      if (identities !== null) return identities;
      const key = summaryKey(expected);
      if (key !== summaryKey(pair.summary.key) || key !== summaryKey({ kind: "body", execution: pair.facts.execution }))
        throw new TypeError("The actual round-produced Facts/Summary pair belongs to the complete selected member execution.");
      const growth = chargeResultEntries(account, 4);
      if (growth !== null) return growth;
      summaries.set(key, { value: pair.summary, unit: { request: member.unit, position: { kind: "result" } } });
      const context = { ...deps.verification,
        arenaOf: (owner: RelationalOwner) => {
          const requested = summaryKey(owner.kind === "body" ? { kind: "body", execution: owner.execution } : owner.key);
          if (owner.kind === "body") return requested === key ? pair.facts.arena : deps.verification.arenaOf(owner);
          const selected = summaries.get(requested);
          return selected !== undefined && !("kind" in selected.value) ? selected.value.arena : deps.verification.arenaOf(owner);
        },
        summaryOf: (requested: SummaryKey) => {
          const selected = summaries.get(summaryKey(requested));
          return selected === undefined || "kind" in selected.value ? null : selected.value;
        },
      };
      const facts = verifyFacts(pair.facts, member.mir, context, account);
      if (facts.kind !== "complete") return facts;
      if (facts.violations.length !== 0) throw new TypeError(`The BodyAnalysis producer failed its Facts handoff: ${facts.violations[0]?.rule}.`);
      const summary = verifySummary(pair.summary, context, deps.resources);
      if (summary.kind !== "complete") return summary;
      if (summary.violations.length !== 0) throw new TypeError(`The BodyAnalysis producer failed its Summary handoff: ${summary.violations[0]?.rule}.`);
    }
    const retained = chargeResultEntries(account, 2);
    if (retained !== null) return retained;
    output.push({ execution: member.execution, result });
  }
  return { kind: "complete", value: output };
};
