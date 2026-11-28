import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, graphOfMir, orderGraph, orderRows, predecessors } from "../dataflow/index.js";
import type { BlockId, LocalId, NodeId, NodeRef, PlaceId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { MirBlock, MirBody, MirOperand, MirTerminator } from "../ir-mir/contract.js";
import { visitMirControlEdges, visitMirStorageExposures } from "../ir-mir/index.js";
import type { MemberSelection } from "../ir-tir/contract.js";
import type { FieldRefinementInputs, FieldRefinementsOf, RefinementFact, RefinementInvalidation, Summary } from "./contract.js";
import type { PlacedCapture, PlacedCaptures } from "./apply-summary.js";
import { admitPlacedCapture, projectCallFields, refinementWriteSteps } from "./apply-summary.js";
import { admitSelectionIdentity } from "./verification.js";
import { fieldProjectionIdentityData } from "./verify-relations.js";

type Call = Extract<MirTerminator, { readonly kind: "call" }>;
type Check = Extract<MirTerminator, { readonly kind: "check" }>;

interface Field {
  readonly receiver: LocalId;
  readonly path: readonly { readonly identity: string; readonly node: NodeId }[];
}

type FieldRead = "sample" | "effect-address";

interface FieldAddress {
  readonly block: MirBlock;
  readonly place: PlaceId;
  readonly before: number;
}

type FieldProofTask<Value> = Generator<FieldAddress, DataflowResult<Value>, Field | null>;

const missing: { readonly kind: "complete"; readonly value: null } = { kind: "complete", value: null };
const unavailable: { readonly kind: "complete"; readonly value: false } = { kind: "complete", value: false };
const available: { readonly kind: "complete"; readonly value: true } = { kind: "complete", value: true };
const noFields: readonly [] = [];

function denseRow<Row>(rows: readonly Row[], index: number): Row {
  const row = rows[index];
  if (row === undefined) throw new TypeError("A field proof requires its actual dense input row.");
  return row;
}

function identity(member: MemberSelection, account: DataflowAccount): DataflowResult<string> {
  const stop = admitSelectionIdentity(member, account);
  return stop ?? { kind: "complete", value: encodeKey(fieldProjectionIdentityData(member)) };
}

interface ReachingCopy {
  readonly block: MirBlock;
  readonly operand: MirOperand;
  readonly position: number;
  readonly fieldsOutsideCopy: number;
}

function writesOnEdge(term: MirTerminator, current: number, writes: (place: PlaceId) => DataflowResult<boolean>,
  account: DataflowAccount): DataflowStop | boolean {
  let effectStop: DataflowStop | null = null;
  let overwritten = false;
  const stopped = visitMirControlEdges(term, { kind: "edges", admit: () => effectStop ?? chargeWork(account, 1),
    visit: (_role, target, destination) => {
      if (effectStop !== null || overwritten || target !== current || destination === null) return;
      const effect = writes(destination);
      if (effect.kind !== "complete") effectStop = effect;
      else overwritten = effect.value;
    } });
  return stopped ?? effectStop ?? overwritten;
}

function* receiverCurrent(mir: MirBody, local: LocalId, path: Field["path"] | null, resolution: FieldRead, useBlock: MirBlock, before: number,
  copies: ReadonlyMap<LocalId, ReachingCopy> | null, flow: Flow, account: DataflowAccount): FieldProofTask<boolean> {
  if (copies === null) return available;
  const writes = (block: MirBlock, position: number, place: PlaceId, first: number): DataflowResult<boolean> => {
    const base = mir.places[place]?.base;
    if (base?.kind === "local") return base.local === local ? available : unavailable;
    if (path === null || first >= path.length) return unavailable;
    if (resolution === "effect-address" || (base?.kind !== "place" && base?.kind !== "checked") || base.projection.kind !== "field")
      return available;
    return writesProjectedField(mir, block, position, place, local, path, flow, account, first);
  };
  const scan = (block: MirBlock, start: number, end: number, first: number): DataflowStop | boolean => {
    for (let index = start; index < end; index += 1) {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      const row = denseRow(block.statements, index);
      if (row.kind === "assign") {
        const effect = writes(block, index, row.place, first);
        if (effect.kind !== "complete") return effect;
        if (effect.value) return false;
      } else if ((row.kind === "storage-live" || row.kind === "storage-dead") && row.local === local) return false;
    }
    return true;
  };
  const uses = copies.values();
  for (let segment = 0; segment < copies.size; segment += 1) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const use = uses.next();
    if (use.done) return unavailable;
    const { block: sampled, position, fieldsOutsideCopy: first } = use.value;
    const protectsSample = path !== null && first < path.length;
    const same = sampled === useBlock && position <= before;
    const tail = scan(useBlock, same ? position : 0, before, first);
    if (typeof tail !== "boolean") return tail;
    if (!tail) return unavailable;
    if (!same) {
      const setup = chargeResultEntries(account, 3);
      if (setup !== null) return setup;
      const seen = new Set<number>();
      const pending: number[] = [useBlock.id];
      while (pending.length !== 0) {
        const read = chargeWork(account, 1);
        if (read !== null) return read;
        const current = pending.pop();
        if (current === undefined || current === flow.entry) return unavailable;
        const incoming = flow.predecessor[current] ?? [];
        for (let index = 0; index < incoming.length; index += 1) {
          const paid = chargeWork(account, 1);
          if (paid !== null) return paid;
          const predecessor = denseRow(incoming, index);
          if (flow.reachable[predecessor] !== true) continue;
          const block = denseRow(mir.blocks, predecessor);
          const term = block.terminator;
          if (protectsSample && (term.kind === "await" || term.kind === "yield" || term.kind === "delegate"
            || term.kind === "invoke" && term.operation.decision.execution.kind === "invocation" && term.operation.decision.execution.writesStorage))
            return unavailable;
          if (protectsSample && term.kind === "call") {
            const lookup = chargeWork(account, 1);
            if (lookup !== null) return lookup;
            const summary = effectSummary(flow, block.id, term);
            if (summary.kind !== "complete") return summary;
            const interference = yield* appliedWrite(block, term, summary.value, local, path, flow, account, first);
            if (interference.kind !== "complete") return interference;
            if (interference.value) return unavailable;
          }
          const overwritten = writesOnEdge(term, current, place => writes(block, block.statements.length, place, first), account);
          if (typeof overwritten !== "boolean") return overwritten;
          if (overwritten) return unavailable;
          if (seen.has(predecessor)) continue;
          const kept = chargeResultEntries(account, block === sampled ? 1 : 2);
          if (kept !== null) return kept;
          seen.add(predecessor);
          const whole = scan(block, block === sampled ? position : 0, block.statements.length, first);
          if (typeof whole !== "boolean") return whole;
          if (!whole) return unavailable;
          if (block !== sampled) pending.push(predecessor);
        }
      }
      if (!seen.has(sampled.id)) return unavailable;
    }
    useBlock = sampled;
    before = position;
  }
  return available;
}

function copyInBlock(mir: MirBody, block: MirBlock, position: number, local: LocalId, fieldsOutsideCopy: number,
  account: DataflowAccount): DataflowResult<ReachingCopy | "entry" | null> {
  while (position > 0) {
    const stop = chargeWork(account, 1);
    if (stop !== null) return stop;
    position -= 1;
    const statement = block.statements[position];
    if (statement === undefined) return missing;
    if (statement.kind === "storage-live" || statement.kind === "storage-dead") {
      if (statement.local === local) return missing;
    } else if (statement.kind === "assign") {
      const base = mir.places[statement.place]?.base;
      if (base?.kind !== "local" || base.local !== local) continue;
      if (statement.value.kind !== "use") return missing;
      const held = chargeResultEntries(account, 1);
      return held ?? { kind: "complete", value: { block, operand: statement.value.operand, position, fieldsOutsideCopy } };
    }
  }
  return { kind: "complete", value: "entry" };
}

function reachesCopy(mir: MirBody, block: MirBlock, position: number, local: LocalId, fieldsOutsideCopy: number, flow: Flow,
  account: DataflowAccount): DataflowResult<ReachingCopy | null> {
  const initial = copyInBlock(mir, block, position, local, fieldsOutsideCopy, account);
  if (initial.kind !== "complete") return initial;
  if (initial.value !== "entry") return { kind: "complete", value: initial.value };
  const setup = chargeResultEntries(account, 2);
  if (setup !== null) return setup;
  const seen = new Set<number>();
  const pending: number[] = [];
  const enqueue = (id: BlockId): boolean | DataflowStop => {
    if (id === flow.entry) return false;
    const incoming = flow.predecessor[id] ?? [];
    for (let position = 0; position < incoming.length; position += 1) {
      const paid = chargeWork(account, 1);
      if (paid !== null) return paid;
      const earlier = denseRow(incoming, position);
      if (flow.reachable[earlier] !== true || seen.has(earlier)) continue;
      const retained = chargeResultEntries(account, 2);
      if (retained !== null) return retained;
      seen.add(earlier);
      pending.push(earlier);
    }
    return true;
  };
  let possible = enqueue(block.id);
  if (typeof possible !== "boolean") return possible;
  if (!possible) return missing;
  let known: ReachingCopy | null = null;
  while (pending.length !== 0) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const id = pending.pop();
    const prior = id === undefined ? undefined : mir.blocks[id];
    if (prior === undefined) return missing;
    const term = prior.terminator;
    const destinations = "destination" in term && term.destination !== null && mir.places[term.destination]?.base;
    if (destinations && destinations.kind === "local" && destinations.local === local) {
      if (term.kind !== "call") return missing;
      const result = flow.captures?.get(term);
      if (result == null || "kind" in result || known !== null && (known.block !== prior || known.position !== prior.statements.length)) return missing;
      const retained = chargeResultEntries(account, 2);
      if (retained !== null) return retained;
      known = { block: prior, operand: { kind: "place", place: result.place }, position: prior.statements.length, fieldsOutsideCopy };
      continue;
    }
    if ("unwind" in term && term.unwind.kind === "handler" && term.unwind.exception !== null) {
      const destination = mir.places[term.unwind.exception]?.base;
      if (destination?.kind === "local" && destination.local === local) return missing;
    }
    const found = copyInBlock(mir, prior, prior.statements.length, local, fieldsOutsideCopy, account);
    if (found.kind !== "complete") return found;
    if (found.value === null) return missing;
    if (found.value === "entry") {
      possible = enqueue(prior.id);
      if (typeof possible !== "boolean") return possible;
      if (!possible) return missing;
    } else {
      if (known !== null && (known.block !== found.value.block || known.position !== found.value.position)) return missing;
      known = found.value;
    }
  }
  return { kind: "complete", value: known };
}

function* fieldTask(mir: MirBody, block: MirBlock, initial: MirOperand, before: number, read: FieldRead,
  flow: Flow, account: DataflowAccount): FieldProofTask<Field | null> {
  let operand = initial;
  let position = before;
  let cursor = block;
  let aliases: Map<LocalId, ReachingCopy> | null = null;
  let selected: { readonly identity: string; readonly node: NodeId }[] | null = null;
  let firstSampledField: number | null = null;
  let current: Field | null = null;
  const receiver = (local: LocalId): DataflowResult<Field | null> => {
    const retained = chargeResultEntries(account, 1);
    return retained ?? { kind: "complete", value: { receiver: local, path: selected ?? noFields } };
  };
  const known = (): DataflowResult<Field | null> => ({ kind: "complete", value: current });
  while (operand.kind === "place") {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const base = mir.places[operand.place]?.base;
    if (current !== null && base?.kind !== "local") return known();
    if (base?.kind === "place" && base.projection.kind === "field") {
      const member = base.projection.member;
      if (base.place >= operand.place || base.tir.body !== mir.body || member.decision.primary === null || member.decision.location.kind !== "data"
        || member.decision.location.receiver !== "by-reference" || member.decision.location.check.kind !== "none") return missing;
      const selectedKey = identity(member, account);
      if (selectedKey.kind !== "complete") return selectedKey;
      const retained = chargeResultEntries(account, selected === null ? 3 : 2);
      if (retained !== null) return retained;
      (selected ??= []).push({ identity: selectedKey.value, node: base.tir.node });
      operand = { kind: "place", place: base.place };
      continue;
    }
    if (base?.kind === "checked" && base.projection.kind === "refined" && base.place < operand.place) {
      operand = { kind: "place", place: base.place };
      continue;
    }
    if (base?.kind !== "local") return known();
    const location = flow.locations.get(base.local);
    if (location === "exposed") return known();
    const local = mir.locals[base.local];
    const parameter = local?.role.kind === "parameter" && local.mode === "by-value";
    const protectPath = firstSampledField !== null && selected !== null && firstSampledField < selected.length ? selected : null;
    const replaced = parameter && location === "reassigned";
    if (parameter && !replaced && protectPath === null) return receiver(base.local);
    if (parameter && replaced && current !== null) return known();
    if (parameter || current === null && local?.role.kind === "user" && local.mode === "local") {
      const stable = yield* receiverCurrent(mir, base.local, protectPath, read, block, before, aliases, flow, account);
      if (stable.kind !== "complete") return stable;
      if (stable.value && (current === null || parameter)) {
        const resolved = receiver(base.local);
        if (resolved.kind !== "complete" || parameter) return resolved;
        current = resolved.value;
      }
      if (parameter) return known();
    }
    if (local?.role.kind !== "temporary" && local?.role.kind !== "user") return known();
    if (aliases?.has(base.local)) return known();
    const retained = chargeResultEntries(account, aliases === null ? 2 : 1);
    if (retained !== null) return retained;
    const copy = reachesCopy(mir, cursor, position, base.local, selected?.length ?? 0, flow, account);
    if (copy.kind !== "complete") return copy;
    if (copy.value === null) return known();
    if (local.role.kind === "user" && (copy.value.operand.kind !== "place" || mir.places[copy.value.operand.place]?.base.kind !== "local"))
      return known();
    (aliases ??= new Map()).set(base.local, copy.value);
    firstSampledField ??= copy.value.fieldsOutsideCopy;
    ({ operand, position, block: cursor } = copy.value);
  }
  return known();
}

function fieldAddressKey(address: FieldAddress): string {
  return `${address.block.id}:${address.before}:${address.place}`;
}

function addressTask(mir: MirBody, address: FieldAddress, flow: Flow, account: DataflowAccount): FieldProofTask<Field | null> {
  return fieldTask(mir, address.block, { kind: "place", place: address.place }, address.before, "effect-address", flow, account);
}

function resolveFieldAddress(mir: MirBody, initial: FieldAddress, flow: Flow, account: DataflowAccount): DataflowResult<Field | null> {
  const task = addressTask(mir, initial, flow, account);
  const opened = task.next(null);
  if (opened.done) return opened.value;
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
  if (setup !== null) return setup;
  const root = fieldAddressKey(initial);
  const active = new Set<string>();
  active.add(root);
  const pending: { readonly key: string; readonly task: FieldProofTask<Field | null> }[] = [{ key: root, task }];
  let address = opened.value;
  for (;;) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const key = fieldAddressKey(address);
    let answer: Field | null = null;
    if (!active.has(key)) {
      const nested = addressTask(mir, address, flow, account);
      const first = nested.next(null);
      if (!first.done) {
        const retain = chargeResultEntries(account, 3);
        if (retain !== null) return retain;
        pending.push({ key, task: nested });
        active.add(key);
        address = first.value;
        continue;
      }
      if (first.value.kind !== "complete") return first.value;
      answer = first.value.value;
    }
    for (;;) {
      const frame = pending.at(-1);
      if (frame === undefined) return { kind: "complete", value: answer };
      const resume = chargeWork(account, 1);
      if (resume !== null) return resume;
      const step = frame.task.next(answer);
      if (!step.done) {
        address = step.value;
        break;
      }
      if (step.value.kind !== "complete") return step.value;
      answer = step.value.value;
      pending.pop();
      active.delete(frame.key);
    }
  }
}

function finishFieldTask<Value>(task: FieldProofTask<Value>, mir: MirBody, flow: Flow, account: DataflowAccount): DataflowResult<Value> {
  let step = task.next(null);
  while (!step.done) {
    const address = resolveFieldAddress(mir, step.value, flow, account);
    if (address.kind !== "complete") return address;
    step = task.next(address.value);
  }
  return step.value;
}

function fieldOf(mir: MirBody, block: MirBlock, operand: MirOperand, before: number, read: FieldRead,
  flow: Flow, account: DataflowAccount): DataflowResult<Field | null> {
  return read === "effect-address" && operand.kind === "place" ? resolveFieldAddress(mir, { block, before, place: operand.place }, flow, account)
    : finishFieldTask(fieldTask(mir, block, operand, before, read, flow, account), mir, flow, account);
}

function guardOnEdge(mir: MirBody, block: MirBlock, target: BlockId, field: Field, flow: Flow,
  inputs: FieldRefinementInputs, account: DataflowAccount): DataflowResult<NodeRef | null> {
  const paid = chargeWork(account, 2);
  if (paid !== null) return paid;
  const branch = block.terminator;
  if (branch.kind !== "switch" || branch.operand.kind !== "place" || branch.step !== null || branch.targets.length !== 1) return missing;
  const whenTrue = branch.targets[0];
  const assignment = block.statements.at(-1);
  if (whenTrue === undefined || assignment?.kind !== "assign" || assignment.place !== branch.operand.place
    || assignment.tir.body !== mir.body || assignment.value.kind !== "binary") return missing;
  const constant = mir.constants[whenTrue.constant]?.value;
  const operation = assignment.value.operation.decision;
  if (constant?.kind !== "literal" || constant.value.kind !== "boolean" || !constant.value.value
    || whenTrue.target === branch.otherwise || operation.kind !== "selected" || operation.execution.kind !== "pure"
    || operation.operation.kind !== "absence-test") return missing;
  const present = operation.operation.negated ? whenTrue.target : branch.otherwise;
  if (present !== target) return missing;
  const syntax = inputs.sourceOf(assignment.tir.node);
  if (syntax?.kind !== "BinaryExpression" || syntax.tsonic.role !== "comparison") return missing;
  const { left, right } = assignment.value;
  const isAbsent = (operand: MirOperand): boolean => {
    if (operand.kind !== "constant") return false;
    const value = mir.constants[operand.constant]?.value;
    return value?.kind === "literal" && value.value.kind === "absence";
  };
  const leftAbsent = isAbsent(left);
  const operand = leftAbsent ? right : isAbsent(right) ? left : null;
  if (operand === null) return missing;
  let authored = leftAbsent ? syntax.right : syntax.left;
  while (authored.kind === "ParenthesizedExpression") {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    authored = authored.expression;
  }
  if (authored.kind !== "PropertyAccessExpression" || authored.tsonic.role !== "value"
    || authored.tsonic.selection.kind !== "decided") return missing;
  const tested = fieldOf(mir, block, operand, block.statements.length - 1, "sample", flow, account);
  if (tested.kind !== "complete") return tested;
  const actual = tested.value;
  if (actual?.path[0]?.node !== authored.id || actual.receiver !== field.receiver || actual.path.length !== field.path.length) return missing;
  for (let index = 0; index < field.path.length; index += 1) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (actual.path[index]?.identity !== field.path[index]?.identity) return missing;
  }
  return { kind: "complete", value: assignment.tir };
}

function interference(path: Field["path"], first: number) {
  const length = path.length - first;
  let depth = 0;
  let matchesPath = true;
  let matchesParent = true;
  let last: string | null = null;
  return {
    field: (key: string): void => {
      matchesParent = matchesPath;
      if (depth < length && path[path.length - depth - 1]?.identity !== key) matchesPath = false;
      depth += 1;
      last = key;
    },
    writes: (account: DataflowAccount): boolean | DataflowStop => {
      if (matchesPath && depth <= length || !matchesParent && length > 1) return true;
      for (let index = first; index < path.length; index += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return read;
        if (path[index]?.identity === last) return true;
      }
      return false;
    },
  };
}

function writesField(mir: MirBody, block: MirBlock, before: number, place: PlaceId, receiver: LocalId, path: Field["path"],
  flow: Flow, account: DataflowAccount): DataflowResult<boolean> {
  const paid = chargeWork(account, 1);
  if (paid !== null) return paid;
  const base = mir.places[place]?.base;
  if (base?.kind === "local") return base.local === receiver ? available : unavailable;
  if (base?.kind !== "place" && base?.kind !== "checked") return unavailable;
  if (base.projection.kind !== "field") return base.projection.kind === "deref" || base.projection.kind === "capture" ? available : unavailable;
  return writesProjectedField(mir, block, before, place, receiver, path, flow, account);
}

function writesProjectedField(mir: MirBody, block: MirBlock, before: number, place: PlaceId, receiver: LocalId, path: Field["path"],
  flow: Flow, account: DataflowAccount, first = 0): DataflowResult<boolean> {
  const read = fieldOf(mir, block, { kind: "place", place }, before, "effect-address", flow, account);
  if (read.kind !== "complete") return read;
  if (read.value === null || read.value.receiver !== receiver) return available;
  const compare = interference(path, first);
  for (let index = read.value.path.length - 1; index >= 0; index -= 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const field = read.value.path[index];
    if (field === undefined) return available;
    compare.field(field.identity);
  }
  const written = compare.writes(account);
  return typeof written === "boolean" ? { kind: "complete", value: written } : written;
}

function* appliedWrite(block: MirBlock, call: Call, summary: Summary | null, receiver: LocalId, path: Field["path"],
  flow: Flow, account: DataflowAccount, first = 0): FieldProofTask<boolean> {
  return yield* refinementWriteSteps<FieldAddress, Field | null>(account, summary, function* (subject, paths, selected) {
    let operand: MirOperand;
    let view = null;
    if ("slot" in subject) {
      if (subject.slot.kind !== "parameter" || call.callee.kind !== "direct") return available;
      const { slot } = subject;
      const supplied = call.arguments[slot.index];
      const mapping = call.callee.resolution.decision.parameters[slot.index];
      if (supplied?.kind !== "value" || supplied.passing !== "by-value"
        || mapping?.kind !== "reference-argument" && mapping?.kind !== "argument") return available;
      view = mapping.kind === "reference-argument" ? mapping.view : null;
      operand = supplied.operand;
    } else {
      if (call.callee.kind !== "body") return available;
      const paid = chargeWork(account, 1);
      if (paid !== null) return paid;
      const supplied = call.callee.captures[subject.index];
      if (supplied === undefined || supplied.capture === null) return available;
      operand = { kind: "place", place: supplied.place };
    }
    if (operand.kind !== "place") return available;
    const actual = yield { block, place: operand.place, before: block.statements.length };
    if (actual === null || actual.receiver !== receiver) return available;
    for (let write = 0; write < paths.length; write += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const writePath = denseRow(paths, write);
      const compare = interference(path, first);
      for (let index = actual.path.length - 1; index >= 0; index -= 1) {
        const step = chargeWork(account, 1);
        if (step !== null) return step;
        const field = actual.path[index];
        if (field === undefined) return available;
        compare.field(field.identity);
      }
      const transported = projectCallFields(account, selected.arena.projections, writePath,
        view, flow.callBindings, field => {
          const selected = identity(field, account);
          if (selected.kind !== "complete") return selected;
          compare.field(selected.value);
          return null;
        });
      if (transported.kind !== "complete") return transported;
      if (!transported.value) return available;
      const written = compare.writes(account);
      if (typeof written !== "boolean") return written;
      if (written) return available;
    }
    return unavailable;
  });
}

interface Flow {
  readonly entry: number;
  readonly predecessor: readonly (readonly number[])[];
  readonly reachable: readonly boolean[];
  readonly locations: ReadonlyMap<LocalId, "exposed" | "reassigned">;
  readonly captures: PlacedCaptures | null;
  readonly summaryAt: FieldRefinementInputs["summaryAt"];
  readonly callBindings: FieldRefinementInputs["callBindings"];
}

function effectSummary(flow: Flow, block: BlockId, call: Call): DataflowResult<Summary | null> {
  const placement = flow.captures?.get(call);
  return placement != null && "kind" in placement ? { kind: "complete", value: placement.summary } : flow.summaryAt(block, call);
}

function fieldProof(mir: MirBody, block: MirBlock, check: Check, flow: Flow,
  inputs: FieldRefinementInputs, account: DataflowAccount): DataflowResult<RefinementFact> {
  const unproved = (guards: readonly NodeId[], detail: string): DataflowResult<RefinementFact> =>
    chargeResultEntries(account, 3) ?? { kind: "complete", value: {
      kind: "unproven", node: check.tir.node, guards, reason: { kind: "guard-not-proven", detail },
    } };
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
  if (setup !== null) return setup;
  const base = mir.places[check.place]?.base;
  if (base?.kind !== "checked" || base.projection.kind !== "refined") return unproved([], "No actual narrowed field view.");
  const read = fieldOf(mir, block, { kind: "place", place: base.place }, block.statements.length, "sample", flow, account);
  if (read.kind !== "complete") return read;
  if (read.value?.path[0]?.node !== check.tir.node) return unproved([], "No proved reaching field receiver.");
  const field = read.value;
  const canReassign = flow.locations.get(field.receiver) === "reassigned" || mir.locals[field.receiver]?.role.kind === "user";
  const assignsReceiver = (place: PlaceId): DataflowResult<boolean> => {
    const base = mir.places[place]?.base;
    return base?.kind === "local" && base.local === field.receiver ? available : unavailable;
  };
  const guards = new Set<NodeId>();
  const invalidations = new Map<NodeId, RefinementInvalidation>();
  const visited = new Set<number>();
  const pending: number[] = [block.id];
  let bypass = false;
  const invalidate = (kind: RefinementInvalidation["kind"], at: NodeRef): DataflowStop | null => {
    if (invalidations.has(at.node)) return null;
    const retained = chargeResultEntries(account, 2);
    if (retained !== null) return retained;
    invalidations.set(at.node, { kind, at });
    return null;
  };
  while (pending.length !== 0) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const index = pending.pop();
    if (index === undefined || visited.has(index)) continue;
    const retained = chargeResultEntries(account, 1);
    if (retained !== null) return retained;
    visited.add(index);
    const current = mir.blocks[index];
    if (current === undefined) return unproved([], "No qualified predecessor block.");
    if (current.id === flow.entry) bypass = true;
    const statements = current.statements;
    for (let position = 0; position < statements.length; position += 1) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      const statement = denseRow(statements, position);
      if (statement.kind === "assign") {
        const effect = writesField(mir, current, position, statement.place, field.receiver, field.path, flow, account);
        if (effect.kind !== "complete") return effect;
        if (!effect.value) continue;
      } else if ((statement.kind !== "storage-live" && statement.kind !== "storage-dead") || statement.local !== field.receiver) continue;
      const invalidated = invalidate("write", statement.tir);
      if (invalidated !== null) return invalidated;
    }
    const incoming = flow.predecessor[index] ?? [];
    for (let position = 0; position < incoming.length; position += 1) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      const prior = denseRow(incoming, position);
      if (flow.reachable[prior] !== true) continue;
      const predecessor = mir.blocks[prior];
      if (predecessor === undefined) return unproved([], "No qualified predecessor edge.");
      const guard = guardOnEdge(mir, predecessor, current.id, field, flow, inputs, account);
      if (guard.kind !== "complete") return guard;
      if (guard.value !== null) {
        if (!guards.has(guard.value.node)) {
          const held = chargeResultEntries(account, 1);
          if (held !== null) return held;
          guards.add(guard.value.node);
        }
        continue;
      }
      const term = predecessor.terminator;
      let effectWrites = false;
      if (term.kind === "call") {
        const summary = effectSummary(flow, predecessor.id, term);
        if (summary.kind !== "complete") return summary;
        const effect = finishFieldTask(appliedWrite(predecessor, term, summary.value, field.receiver, field.path, flow, account),
          mir, flow, account);
        if (effect.kind !== "complete") return effect;
        effectWrites = effect.value;
      } else if (term.kind === "await" || term.kind === "yield" || term.kind === "delegate"
        || term.kind === "invoke" && term.operation.decision.execution.kind === "invocation" && term.operation.decision.execution.writesStorage) {
        effectWrites = true;
      }
      if (effectWrites) {
        const invalidated = invalidate("call", term.tir);
        if (invalidated !== null) return invalidated;
      } else if (canReassign) {
        const overwritten = writesOnEdge(term, current.id, assignsReceiver, account);
        if (typeof overwritten !== "boolean") return overwritten;
        if (overwritten) {
          const invalidated = invalidate(term.kind === "call" || term.kind === "invoke" ? "call" : "write", term.tir);
          if (invalidated !== null) return invalidated;
        }
      }
      if (!visited.has(prior)) {
        const held = chargeResultEntries(account, 1);
        if (held !== null) return held;
        pending.push(prior);
      }
    }
  }
  const allocate = chargeWork(account, guards.size + invalidations.size) ?? chargeResultEntries(account, 2);
  if (allocate !== null) return allocate;
  const order = orderRows([...guards], (left, right) => left - right, account);
  if (order.kind !== "complete") return order;
  if (bypass || order.value.length === 0) return unproved(order.value, "No qualifying presence guard on every reaching path.");
  if (invalidations.size === 0)
    return chargeResultEntries(account, 1) ?? { kind: "complete", value: { kind: "proven", node: check.tir.node, guards: order.value } };
  const sites = orderRows([...invalidations.values()], (left, right) => left.at.node - right.at.node, account);
  if (sites.kind !== "complete") return sites;
  const first = sites.value[0];
  if (first === undefined) return unproved(order.value, "No qualified invalidation point.");
  const held = chargeResultEntries(account, 3 + sites.value.length);
  return held ?? { kind: "complete", value: { kind: "unproven", node: check.tir.node, guards: order.value,
    reason: { kind: "invalidated", sites: [first, ...sites.value.slice(1)] } } };
}

export const fieldRefinements: FieldRefinementsOf = (account, mir, provided, inputs) => {
  const before = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
  if (before !== null) return before;
  const graph = graphOfMir(mir, account);
  if (graph.kind !== "complete") return graph;
  if (graph.value.qualification !== undefined) return { kind: "complete", value: [] };
  const entryWork = chargeWork(account, mir.entries.length);
  if (entryWork !== null) return entryWork;
  const entry = mir.entries.find(row => row.provided === provided);
  if (entry === undefined) return { kind: "complete", value: [] };
  const order = orderGraph(graph.value, [entry.block], account);
  if (order.kind !== "complete") return order;
  const predecessor = predecessors(graph.value, account);
  if (predecessor.kind !== "complete") return predecessor;
  const locations = new Map<LocalId, "exposed" | "reassigned">();
  const remember = (local: LocalId, status: "exposed" | "reassigned"): DataflowStop | null => {
    const prior = locations.get(local);
    if (prior === "exposed" || prior === status) return null;
    const held = chargeResultEntries(account, 1);
    if (held !== null) return held;
    locations.set(local, status);
    return null;
  };
  const expose = (start: PlaceId): DataflowStop | null => {
    let place = start;
    for (;;) {
      const paid = chargeWork(account, 1);
      if (paid !== null) return paid;
      const base = mir.places[place]?.base;
      if (base?.kind === "local") return remember(base.local, "exposed");
      if (base?.kind !== "place" && base?.kind !== "checked" || base.place >= place) return null;
      place = base.place;
    }
  };
  let captures: Map<Call, PlacedCapture | null> | null = null;
  const exposure = visitMirStorageExposures(mir, {
    admit: () => chargeWork(account, 1), address: expose,
    capture: (capture, block, placed) => {
      if (placed !== null && "destination" in placed && placed.destination !== null && order.value.reachable[block.id] === true) {
        const admitted = admitPlacedCapture(captures, block.id, placed, inputs.summaryAt, account);
        if (admitted.kind !== "complete") return admitted;
        captures = admitted.value;
        if (captures.get(placed) != null) return null;
      }
      return capture.capture === "captured-value" ? null : expose(capture.place);
    },
  });
  if (exposure !== null) return exposure;
  const replaceReceiver = (place: PlaceId): DataflowStop | null => {
    const base = mir.places[place]?.base;
    return base?.kind === "local" && mir.locals[base.local]?.role.kind === "parameter" ? remember(base.local, "reassigned") : null;
  };
  const blocks = mir.blocks;
  for (let position = 0; position < blocks.length; position += 1) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const block = denseRow(blocks, position);
    const statements = block.statements;
    for (let statementPosition = 0; statementPosition < statements.length; statementPosition += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const statement = denseRow(statements, statementPosition);
      const stopped = statement.kind === "assign" ? replaceReceiver(statement.place)
        : (statement.kind === "storage-live" || statement.kind === "storage-dead")
          && mir.locals[statement.local]?.role.kind === "parameter" ? remember(statement.local, "reassigned") : null;
      if (stopped !== null) return stopped;
    }
    let stopped: DataflowStop | null = null;
    const edge = visitMirControlEdges(block.terminator, {
      kind: "edges", admit: () => stopped ?? chargeWork(account, 1),
      visit: (_role, _target, destination) => { if (destination !== null) stopped ??= replaceReceiver(destination); },
    });
    const cut = edge ?? stopped;
    if (cut !== null) return cut;
  }
  const flow = { entry: entry.block, predecessor: predecessor.value, reachable: order.value.reachable, locations, captures,
    summaryAt: inputs.summaryAt, callBindings: inputs.callBindings };
  const rows: RefinementFact[] = [];
  for (let position = 0; position < blocks.length; position += 1) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const block = denseRow(blocks, position);
    const check = block.terminator;
    if (check.kind !== "check" || check.tir.body !== mir.body || flow.reachable[block.id] !== true) continue;
    const source = inputs.sourceOf(check.tir.node);
    if (source?.kind !== "PropertyAccessExpression" || source.tsonic.role !== "value" || source.tsonic.narrowing?.kind !== "narrowed") continue;
    const proved = fieldProof(mir, block, check, flow, inputs, account);
    if (proved.kind !== "complete") return proved;
    const retained = chargeResultEntries(account, 1);
    if (retained !== null) return retained;
    rows.push(proved.value);
  }
  return orderRows(rows, (left, right) => left.node - right.node, account);
};
