import { accountFailure, chargeResultEntries, chargeWork, refuseAccount } from "../dataflow/index.js";
import type { Cause, ErrorValue, UnitAnswerPosition, UnitRef } from "../diag/contract.js";
import { unitPositionData } from "../diag/index.js";
import type { NodeId, NodeRef } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { LivenessFacts, RelationalOwner, Summary, SummaryAnswer, SummaryKey } from "../ir-facts/contract.js";
import { admitSummaryIdentity, summaryEquals, summaryKey, verifyFacts, verifySummary } from "../ir-facts/index.js";
import { executionKey, sameInstance } from "../ir-types/index.js";
import type { ConvergenceDeps, ConvergenceMember, ConvergeComponent, StableBody } from "./contract.js";

type RoundCallRead = ReturnType<Parameters<ConvergenceDeps["analyzeBodyRound"]>[0]["summaryOf"]>;
type RoundLeast = Extract<RoundCallRead, { readonly kind: "least" }>;
type DeclaredTarget = Extract<SummaryKey, { readonly kind: "declared" }>;
const noDeclaredCall = () => null;

interface PreparedMember {
  readonly member: ConvergenceMember;
  readonly liveness: LivenessFacts;
  readonly key: string;
  readonly identity: string;
  readonly declaredAt: (at: NodeRef) => DeclaredTarget | null;
  readonly least: RoundLeast | null;
}

export const convergeComponent: ConvergeComponent = (deps, input) => {
  const { account } = deps.resources;
  const initial = accountFailure(account);
  if (initial !== null) return initial;
  if (!Number.isSafeInteger(input.maximumIterations) || input.maximumIterations < 0 || Object.is(input.maximumIterations, -0))
    throw new TypeError("The component iteration bound is a nonnegative safe count.");
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 6);
  if (setup !== null) return setup;
  const component = input.inventory.components[input.component];
  if (!Number.isSafeInteger(input.component) || Object.is(input.component, -0) || component === undefined || component.kind !== "body")
    throw new TypeError("Only an actual body component is converged; declared operations bind separately.");
  if (component.members.length !== input.members.length || component.members.length === 0)
    throw new TypeError("Convergence receives exactly the selected component's members.");
  const members = new Map<string, number>();
  const identitiesByMember: string[] = [];
  for (let position = 0; position < component.members.length; position += 1) {
    const row = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (row !== null) return row;
    const operationIndex = component.members[position];
    const operation = operationIndex === undefined ? undefined : input.inventory.operations[operationIndex];
    const member = input.members[position];
    if (operation === undefined || operation.kind !== "body" || member === undefined)
      throw new TypeError("Component members retain their actual body execution and ready bodies.");
    const exact = operation.execution === member.execution;
    const identities = admitSummaryIdentity(operation, account)
      ?? (exact ? null : admitSummaryIdentity({ kind: "body", execution: member.execution }, account));
    if (identities !== null) return identities;
    const identity = summaryKey(operation);
    if ((!exact && identity !== summaryKey({ kind: "body", execution: member.execution })) || members.has(identity))
      throw new TypeError("Component membership uses complete execution identity exactly once.");
    if (!sameInstance(member.execution.instance, { body: member.mir.body, bindings: member.mir.bindings })
      || !sameInstance(member.execution.instance, { body: member.tir.body, bindings: member.tir.bindings }))
      throw new TypeError("Each member borrows its actual selected MIR and TIR instance.");
    members.set(identity, position);
    identitiesByMember.push(identity);
  }
  const required = new Set<string>();
  let declaredCalls: Map<number, Map<NodeId, DeclaredTarget>> | null = null;
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
    const dependent = members.get(summaryKey(source));
    if (dependent === undefined) throw new TypeError("Every component row is dependent on one of its members.");
    if (dependency.reason === "call" && dependency.target.kind === "declared") {
      if (dependency.at.body !== dependency.dependent.instance.body)
        throw new TypeError("A declared call retains its actual dependent occurrence.");
      const existing = declaredCalls?.get(dependent);
      if (existing?.has(dependency.at.node) === true)
        throw new TypeError("A direct call has one exact declared dependency.");
      const keep = chargeResultEntries(account, (declaredCalls === null ? 1 : 0) + (existing === undefined ? 2 : 0) + 1);
      if (keep !== null) return keep;
      declaredCalls ??= new Map();
      const calls = existing ?? new Map<NodeId, DeclaredTarget>();
      if (existing === undefined) declaredCalls.set(dependent, calls);
      calls.set(dependency.at.node, dependency.target);
    }
    const target = summaryKey(dependency.target);
    if (members.has(target)) internal = true;
    else if (!required.has(target)) {
      const entry = chargeResultEntries(account, 1);
      if (entry !== null) return entry;
      required.add(target);
    }
  }
  const outsideSetup = chargeResultEntries(account, 1);
  if (outsideSetup !== null) return outsideSetup;
  const summaries = new Map<string, SummaryAnswer>();
  const outsideUnits = new Map<UnitRef, string>();
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
    if ("kind" in selected.answer.value) {
      const retained = chargeResultEntries(account, 1);
      if (retained !== null) return retained;
      outsideUnits.set(selected.answer.unit, key);
    }
  }
  if (required.size !== summaries.size) throw new TypeError("Every external dependency has its actual completed stable answer.");
  if (input.maximumIterations === 0) return refuseAccount(account, input.iterationRefusal);
  const initialRows = chargeResultEntries(account, 3);
  if (initialRows !== null) return initialRows;
  const ready: PreparedMember[] = [];
  for (let position = 0; position < input.members.length; position += 1) {
    const row = chargeWork(account, 1);
    if (row !== null) return row;
    const member = input.members[position];
    if (member === undefined) throw new TypeError("The selected member vector is dense.");
    const storage = deps.analyzeStorageUse({ account }, { execution: member.execution, body: member.mir });
    const stoppedStorage = accountFailure(account);
    if (stoppedStorage !== null) return stoppedStorage;
    if (storage.kind === "refused") return refuseAccount(account, storage);
    const grow = chargeResultEntries(account, 2) ?? admitSummaryIdentity({ kind: "body", execution: member.execution }, account);
    if (grow !== null) return grow;
    let least: RoundLeast | null = null;
    if (internal && !member.tir.asynchronous && !member.tir.generator) {
      for (let entryIndex = 0; entryIndex < member.mir.entries.length; entryIndex += 1) {
        const work = chargeWork(account, 1);
        if (work !== null) return work;
        const entry = member.mir.entries[entryIndex];
        if (entry === undefined) throw new TypeError("A verified member has a dense entry inventory.");
        if (entry.provided !== member.execution.provided) continue;
        const entryGrowth = chargeResultEntries(account, 1);
        if (entryGrowth !== null) return entryGrowth;
        least = { kind: "least", execution: member.execution, signature: member.tir.signature, entry };
        break;
      }
      if (least === null) throw new TypeError("A recursive member requires its actual selected MIR entry.");
    }
    const identity = identitiesByMember[position];
    if (identity === undefined) throw new TypeError("Each member retains its exact admitted identity.");
    const calls = declaredCalls?.get(position);
    if (calls !== undefined) {
      const keep = chargeResultEntries(account, 1);
      if (keep !== null) return keep;
    }
    ready.push({ member, liveness: storage.value, key: executionKey(member.execution), identity, least,
      declaredAt: calls === undefined ? noDeclaredCall : at => at.body === member.execution.instance.body ? calls.get(at.node) ?? null : null });
  }
  type Prior = { readonly read: RoundCallRead; readonly keys: readonly string[] };
  let prior: readonly Prior[] | null = null;
  let output: readonly StableBody[];
  const detectorKey = (unit: UnitRef): string | null => unit.position.kind !== "execution-source-node" ? null
    : encodeKey(unitPositionData(unit.position));
  const admitGround = (unit: UnitRef) => unit.position.kind !== "execution-source-node" ? chargeWork(account, 1)
    : chargeWork(account, 1 + unit.position.execution.length + unit.position.node.body.length);
  for (let iteration = 0;; iteration += 1) {
    if (iteration === input.maximumIterations) return refuseAccount(account, input.iterationRefusal);
    const setup = chargeResultEntries(account, 3);
    if (setup !== null) return setup;
    const current: StableBody[] = [];
    const next: Prior[] = [];
    const detectors = new Map<string, UnitRef>();
    const summaryOf = (_key: SummaryKey, admittedKey: string): RoundCallRead => {
      const position = members.get(admittedKey);
      if (position === undefined) {
        const selected = summaries.get(admittedKey);
        if (selected === undefined) throw new TypeError("A body round reads only its closed discovered dependencies.");
        return selected;
      }
      const selected = prior?.[position]?.read ?? ready[position]?.least;
      if (selected === null || selected === undefined) throw new TypeError("An unproved recursive activation cannot borrow ordinary least.");
      return selected;
    };
    for (let position = 0; position < ready.length; position += 1) {
      const row = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
      if (row !== null) return row;
      const selected = ready[position];
      if (selected === undefined) throw new TypeError("The selected ready member vector is dense.");
      const { member, liveness, key, identity } = selected;
      const round = deps.analyzeBodyRound({ ...deps.environment, summaryOf,
        declaredAt: selected.declaredAt,
        account, unit: member.unit }, {
        execution: member.execution, mir: member.mir, tir: member.tir, liveness,
      });
      const stoppedRound = accountFailure(account);
      if (stoppedRound !== null) return stoppedRound;
      if (round.kind !== "complete") return round;
      const result = round.value;
      if (result.kind === "refused") return refuseAccount(account, result);
      if (!("facts" in result.value)) for (let index = 0; index < result.emissions.length; index += 1) {
        const admitted = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (admitted !== null) return admitted;
        const emission = result.emissions[index];
        if (emission?.identity.kind !== "host" || emission.identity.unit.request !== member.unit
          || emission.identity.unit.position.kind !== "execution-source-node" || emission.identity.unit.position.execution !== key)
          throw new TypeError("A round detector must retain its actual qualified execution and originating unit.");
        const paid = admitGround(emission.identity.unit);
        if (paid !== null) return paid;
        const ground = detectorKey(emission.identity.unit);
        if (ground === null || detectors.has(ground)) throw new TypeError("Each executing detector has one distinct actual source position.");
        detectors.set(ground, emission.identity.unit);
      }
      current.push({ execution: member.execution, key, identity, result });
    }
    if (!internal) { output = current; break; }
    let unchanged = prior !== null;
    for (let position = 0; position < current.length; position += 1) {
      const row = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
      if (row !== null) return row;
      const member = current[position];
      if (member?.result.kind !== "ok") throw new TypeError("Only actual round outcomes can enter convergence.");
      const before = prior?.[position];
      const { value } = member.result;
      if ("facts" in value) {
        if (before === undefined || !("kind" in before.read) || before.read.kind !== "prior-summary") unchanged = false;
        else {
          const equal = summaryEquals(before.read.summary, value.summary, account);
          if (equal.kind !== "complete") return equal;
          if (!equal.value) unchanged = false;
        }
        next.push({ read: { kind: "prior-summary", summary: value.summary }, keys: [] });
        continue;
      }
      const setup = chargeResultEntries(account, 3);
      if (setup !== null) return setup;
      const rows: { readonly key: string; readonly unit: UnitRef }[] = [];
      const seen = new Set<string>();
      for (let index = 0; index < value.causes.length; index += 1) {
        const admitted = chargeWork(account, 1);
        if (admitted !== null) return admitted;
        const cause = value.causes[index];
        if (cause?.kind !== "unit") throw new TypeError("A round failure retains actual detector or completed outside grounds.");
        const unit = cause.unit;
        const outside = outsideUnits.get(unit);
        const work = outside === undefined ? admitGround(unit) : chargeWork(account, outside.length);
        if (work !== null) return work;
        const local = outside === undefined ? detectorKey(unit) : null;
        const ground = outside !== undefined ? unit : local === null ? undefined : detectors.get(local);
        if (ground === undefined) { unchanged = false; continue; }
        if (ground.request !== unit.request) throw new TypeError("A local ground must retain its actual component request.");
        const key = outside === undefined ? "detector:" + local : "outside:" + outside;
        if (seen.has(key)) continue;
        const growth = chargeResultEntries(account, 3);
        if (growth !== null) return growth;
        seen.add(key);
        rows.push({ key, unit: ground });
      }
      let sorting: ReturnType<typeof chargeWork> = null;
      const sorted = chargeResultEntries(account, rows.length + 2);
      if (sorted !== null) return sorted;
      rows.sort((left, right) => {
        if (sorting !== null) return 0;
        sorting = chargeWork(account, 1 + left.key.length + right.key.length);
        return sorting !== null || left.key === right.key ? 0 : left.key < right.key ? -1 : 1;
      });
      if (sorting !== null) return sorting;
      let grounds: [UnitRef, ...UnitRef[]] | null = null;
      const keys: string[] = [];
      for (let index = 0; index < rows.length; index += 1) {
        const paid = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
        if (paid !== null) return paid;
        const row = rows[index];
        if (row === undefined) throw new TypeError("Ordered grounds retain their actual paid rows.");
        if (grounds === null) grounds = [row.unit];
        else grounds.push(row.unit);
        keys.push(row.key);
      }
      if (grounds === null) {
        const least = ready[position]?.least;
        if (least === undefined || least === null) throw new TypeError("An ungrounded approximation needs its actual ordinary least.");
        next.push({ read: least, keys });
        unchanged = false;
        continue;
      }
      if (before?.keys.length !== keys.length) unchanged = false;
      else for (let index = 0; index < keys.length; index += 1) {
        const paid = chargeWork(account, 1);
        if (paid !== null) return paid;
        const left = before.keys[index], right = keys[index];
        if (left === undefined || right === undefined) throw new TypeError("Error ground comparison requires complete canonical vectors.");
        const compare = chargeWork(account, left.length + right.length);
        if (compare !== null) return compare;
        if (left !== right) unchanged = false;
      }
      next.push({ read: { kind: "prior-error", grounds }, keys });
    }
    if (unchanged) {
      for (let position = 0; position < current.length; position += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return read;
        const member = current[position];
        const prior = next[position]?.read;
        if (member?.result.kind !== "ok" || prior === undefined || !("kind" in prior))
          throw new TypeError("The final round requires its actual qualified candidate.");
        if (prior.kind !== "prior-error") continue;
        const setup = chargeResultEntries(account, 7);
        if (setup !== null) return setup;
        const causes: [Cause, ...Cause[]] = [{ kind: "unit", unit: prior.grounds[0] }];
        for (let index = 1; index < prior.grounds.length; index += 1) {
          const read = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
          if (read !== null) return read;
          const ground = prior.grounds[index];
          if (ground === undefined) throw new TypeError("A stable grounded failure has complete canonical causes.");
          causes.push({ kind: "unit", unit: ground });
        }
        const value: ErrorValue = { kind: "error", causes };
        const positions: UnitAnswerPosition[] = [];
        for (let index = 0; index < member.result.positions.length; index += 1) {
          const read = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
          if (read !== null) return read;
          const entry = member.result.positions[index];
          if (entry === undefined) throw new TypeError("A stable failure retains its actual detector positions.");
          positions.push(entry.position.kind === "execution-result" ? { position: entry.position, error: value } : entry);
        }
        current[position] = { ...member, result: { ...member.result, value, positions } };
      }
      output = current;
      break;
    }
    prior = next;
  }
  const summaryAt = (key: string): Summary | null => {
    const position = members.get(key);
    if (position === undefined) {
      const answer = summaries.get(key);
      return answer === undefined || "kind" in answer.value ? null : answer.value;
    }
    const answer = output[position]?.result;
    return answer?.kind === "ok" && "facts" in answer.value ? answer.value.summary : null;
  };
  for (let position = 0; position < output.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const member = ready[position]?.member;
    const stable = output[position];
    const result = stable?.result;
    if (member === undefined || stable === undefined || result?.kind !== "ok") throw new TypeError("Only a complete final batch can be verified.");
    if ("facts" in result.value) {
      const pair = result.value;
      const asserted = pair.summary.key;
      const sameSummary = asserted.kind === "body" && asserted.execution === member.execution;
      const sameFacts = pair.facts.execution === member.execution;
      const factsKey: SummaryKey = { kind: "body", execution: pair.facts.execution };
      const identities = (sameSummary ? null : admitSummaryIdentity(asserted, account))
        ?? (sameFacts ? null : admitSummaryIdentity(factsKey, account));
      if (identities !== null) return identities;
      if (!sameSummary && stable.identity !== summaryKey(asserted) || !sameFacts && stable.identity !== summaryKey(factsKey))
        throw new TypeError("The actual round-produced Facts/Summary pair belongs to the complete selected member execution.");
      const growth = chargeResultEntries(account, 1);
      if (growth !== null) return growth;
      const context = { ...deps.verification,
        arenaOf: (owner: RelationalOwner) => {
          const requested = summaryKey(owner.kind === "body" ? { kind: "body", execution: owner.execution } : owner.key);
          if (owner.kind === "summary") return summaryAt(requested)?.arena ?? deps.verification.arenaOf(owner);
          const peer = members.get(requested);
          const answer = peer === undefined ? undefined : output[peer]?.result;
          return answer?.kind === "ok" && "facts" in answer.value ? answer.value.facts.arena : deps.verification.arenaOf(owner);
        },
        summaryOf: (key: SummaryKey) => summaryAt(summaryKey(key)) ?? deps.verification.summaryOf(key),
      };
      const facts = verifyFacts(pair.facts, member.mir, context, account);
      if (facts.kind !== "complete") return facts;
      if (facts.violations.length !== 0) throw new TypeError(`The BodyAnalysis producer failed its Facts handoff: ${facts.violations[0]?.rule}.`);
      const summary = verifySummary(pair.summary, context, deps.resources);
      if (summary.kind !== "complete") return summary;
      if (summary.violations.length !== 0) throw new TypeError(`The BodyAnalysis producer failed its Summary handoff: ${summary.violations[0]?.rule}.`);
    }
  }
  return { kind: "complete", value: output };
};
