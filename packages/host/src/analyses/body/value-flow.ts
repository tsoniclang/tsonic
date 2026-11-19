import type { DataflowResult, DataflowStop, FlowSolution, ForwardProblem } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, solve } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BlockId, LocalId, OriginsId } from "../../ids/contract.js";
import type { AppliedSummary, CaptureLocation, RelationalArena, Summary } from "../../ir-facts/contract.js";
import type { MirOperand, MirStatement, MirTerminator } from "../../ir-mir/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { callSummary, callValueEffects, isCallError } from "./calls.js";
import { bodyFrontier, readLocal } from "./places.js";
import { appliedOrigins, joinOrigins, valueKind } from "./values.js";
import type { AdmitOrigins, ValueOrigins } from "./values.js";
import { captureLocalAtCall } from "./initialization.js";

export interface CurrentValues {
  readonly origins: readonly OriginsId[];
  readonly contents: ReadonlySet<LocalId>;
}
export type ValueState = CurrentValues | null;

function currentContent(deps: BodyRoundDeps, state: ReadonlySet<LocalId>, local: LocalId,
  written: boolean): DataflowResult<ReadonlySet<LocalId>> {
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  if (state.has(local) === written) return { kind: "complete", value: state };
  const copy = chargeWork(deps.account, state.size + 1) ?? chargeResultEntries(deps.account, state.size + 2);
  if (copy !== null) return copy;
  const next = new Set(state);
  if (written) next.add(local); else next.delete(local);
  return { kind: "complete", value: next };
}

export function mergeContents(deps: BodyRoundDeps, state: ReadonlySet<LocalId>, locals: Iterable<LocalId>,
  destination: LocalId | null): DataflowResult<ReadonlySet<LocalId>> {
  const setup = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 2);
  if (setup !== null) return setup;
  let next: Set<LocalId> | null = null;
  const add = (local: LocalId): DataflowStop | null => {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    if ((next ?? state).has(local)) return null;
    if (next === null) {
      const copy = chargeWork(deps.account, state.size) ?? chargeResultEntries(deps.account, state.size + 1);
      if (copy !== null) return copy;
      next = new Set(state);
    }
    const growth = chargeResultEntries(deps.account, 1);
    if (growth !== null) return growth;
    next.add(local);
    return null;
  };
  if (destination !== null) {
    const written = add(destination);
    if (written !== null) return written;
  }
  for (const local of locals) {
    const written = add(local);
    if (written !== null) return written;
  }
  return { kind: "complete", value: next ?? state };
}

export function applyExitContents(deps: BodyRoundDeps, input: BodyRoundInput,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, summary: Summary, application: AppliedSummary,
  kind: "return" | "unwind", state: ValueState | undefined, values: ValueOrigins, admit: AdmitOrigins,
  destination: { readonly local: LocalId; readonly tracked: boolean } | null): DataflowResult<CurrentValues> {
  const setup = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 2);
  if (setup !== null) return setup;
  const origins = requirePresent(state?.origins, { owner: "analyses/body", query: null, origin: operation.origin,
    message: "An applied exit retains its actual solved pre-call value state." });
  const previousContents = requirePresent(state?.contents, { owner: "analyses/body", query: null, origin: operation.origin,
    message: "An applied exit retains its actual solved pre-call content state." });
  const source = kind === "return" ? summary.contentsOnReturn : summary.contentsOnUnwind;
  const applied = kind === "return" ? application.contentsOnReturn : application.contentsOnUnwind;
  const locals: LocalId[] = [];
  let next: OriginsId[] | null = null;
  const store = (local: LocalId, value: OriginsId): DataflowStop | null => {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    const previous = requirePresent((next ?? origins)[local], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "An applied cell content retains its actual executing local." });
    if (previous === value) return null;
    if (next === null) {
      const copy = chargeWork(deps.account, origins.length) ?? chargeResultEntries(deps.account, origins.length + 1);
      if (copy !== null) return copy;
      next = [...origins];
    }
    next[local] = value;
    return null;
  };
  for (let index = 0; index < applied.length; index += 1) {
    const read = chargeWork(deps.account, 2);
    if (read !== null) return read;
    const selected = requirePresent(source[index], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "An applied finite content retains its actual source cell." });
    const row = requirePresent(applied[index], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "An applied finite content retains its actual value." });
    const local = captureLocalAtCall(deps, input.mir, operation, summary, selected.target);
    if (local.kind !== "complete") return local;
    const value = appliedOrigins(deps, values, row.value, admit);
    if (typeof value !== "number") return value;
    const stored = store(local.value, value);
    if (stored !== null) return stored;
    const growth = chargeResultEntries(deps.account, 1);
    if (growth !== null) return growth;
    locals.push(local.value);
  }
  if (destination !== null) {
    const value = appliedOrigins(deps, values, application.result, admit);
    if (typeof value !== "number") return value;
    const stored = store(destination.local, value);
    if (stored !== null) return stored;
  }
  const contents = mergeContents(deps, previousContents, locals, destination?.tracked === true ? destination.local : null);
  if (contents.kind !== "complete") return contents;
  const output = chargeResultEntries(deps.account, 1);
  if (output !== null) return output;
  return { kind: "complete", value: { origins: next ?? origins, contents: contents.value } };
}

export function collectExitContents(deps: BodyRoundDeps, origins: readonly OriginsId[], entry: readonly OriginsId[], contents: ReadonlySet<LocalId>, cells: readonly LocalId[],
  output: Map<number, OriginsId>, values: ValueOrigins, admit: AdmitOrigins): DataflowStop | null {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  for (let cell = 0; cell < cells.length; cell += 1) {
    const read = chargeWork(deps.account, 4);
    if (read !== null) return read;
    const local = requirePresent(cells[cell], { owner: "analyses/body", query: null, origin: null,
      message: "A finite exit retains the actual local of every owned cell." });
    const initial = requirePresent(entry[local], { owner: "analyses/body", query: null, origin: null,
      message: "A finite exit retains the actual entry value of its cell." });
    const symbol = requirePresent(values.rows[initial], { owner: "analyses/body", query: null, origin: null,
      message: "An entry value retains its actual Origins relation." });
    if (!contents.has(local) && symbol.producers.length === 0) continue;
    const current = requirePresent(origins[local], { owner: "analyses/body", query: null, origin: null,
      message: "A finite exit retains the actual current value of its cell." });
    const previous = output.get(cell);
    const value = previous === undefined ? current : joinOrigins(deps, values, previous, current, admit);
    if (typeof value !== "number") return value;
    const growth = chargeResultEntries(deps.account, previous === undefined ? 1 : 0);
    if (growth !== null) return growth;
    output.set(cell, value);
  }
  return null;
}

export function removeUnchangedContents(deps: BodyRoundDeps, output: Map<number, OriginsId>, cells: readonly LocalId[],
  entry: readonly OriginsId[], values: ValueOrigins): DataflowStop | null {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  for (const [cell, value] of output) {
    const read = chargeWork(deps.account, 3);
    if (read !== null) return read;
    const local = requirePresent(cells[cell], { owner: "analyses/body", query: null, origin: null,
      message: "A finite content retains its actual owning local." });
    const initial = requirePresent(entry[local], { owner: "analyses/body", query: null, origin: null,
      message: "A finite content retains its real entry value." });
    if (value !== initial) continue;
    const symbol = requirePresent(values.rows[initial], { owner: "analyses/body", query: null, origin: null,
      message: "An unchanged finite content retains its real entry symbol." });
    if (symbol.producers.length !== 0) output.delete(cell);
  }
  return null;
}
export function operandOrigins(input: BodyRoundInput, constants: readonly OriginsId[], state: readonly OriginsId[], operand: MirOperand): OriginsId {
  return requirePresent(operand.kind === "constant" ? constants[operand.constant] : state[readLocal(input.mir, operand)],
    { owner: "analyses/body", query: null, origin: null, message: "An executing operand retains its actual value-flow Origins." });
}

export function transferValue(deps: BodyRoundDeps, input: BodyRoundInput, constants: readonly OriginsId[],
  initial: readonly OriginsId[], state: readonly OriginsId[], statement: MirStatement): DataflowResult<readonly OriginsId[]> {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  const work = chargeWork(deps.account, 1 + state.length) ?? chargeResultEntries(deps.account, state.length);
  if (work !== null) return work;
  const next = [...state];
  if (statement.kind === "assign") {
    const local = readLocal(input.mir, { kind: "place", place: statement.place });
    if (statement.value.kind !== "use") {
      const storage = requirePresent(input.mir.locals[local], { owner: "analyses/body", query: null, origin: statement.origin,
        message: "An executing assignment retains its selected local storage." });
      const kind = valueKind(deps, storage.storage);
      const stopped = accountFailure(deps.account);
      if (stopped !== null) return stopped;
      if (kind === "reference") return bodyFrontier("BodyAnalysis requires the actual selected reference operation value producer.");
    }
    next[local] = statement.value.kind === "use" ? operandOrigins(input, constants, state, statement.value.operand)
      : requirePresent(initial[local], { owner: "analyses/body", query: null, origin: statement.origin,
        message: "A selected pure scalar operation retains its storage disposition." });
  } else next[statement.local] = requirePresent(initial[statement.local], { owner: "analyses/body", query: null,
    origin: statement.origin, message: "A storage reset retains the local's uninitialized value disposition." });
  return { kind: "complete", value: next };
}

export function valueProblem(deps: BodyRoundDeps, input: BodyRoundInput, arena: RelationalArena,
  values: ValueOrigins, constants: readonly OriginsId[], initial: readonly OriginsId[], boundary: CurrentValues,
  reachable: readonly boolean[], admit: AdmitOrigins,
  captures: ReadonlyMap<BlockId, readonly CaptureLocation[]>, tracked: ReadonlySet<LocalId>): ForwardProblem<ValueState> {
  return {
    direction: "forward", boundary,
    lattice: {
      bottom: null, overflow: null, isOverflow: () => false, stateBound: input.mir.locals.length + 1,
      equals: (left, right, account) => {
        if (accountFailure(account) !== null) return true;
        if (left === right) return true;
        if (left === null || right === null) return false;
        for (let local = 0; local < left.origins.length; local += 1) {
          if (chargeWork(account, 1) !== null) return true;
          if (left.origins[local] !== right.origins[local]) return false;
        }
        if (left.contents.size !== right.contents.size) return false;
        for (const local of left.contents) {
          if (chargeWork(account, 1) !== null) return true;
          if (!right.contents.has(local)) return false;
        }
        return true;
      },
      join: (left, right, account) => {
        if (accountFailure(account) !== null) return left;
        if (left === null) return right;
        if (right === null || left === right) return left;
        if (chargeWork(account, left.origins.length) !== null || chargeResultEntries(account, left.origins.length + 1) !== null) return left;
        const next: OriginsId[] = [];
        for (let local = 0; local < left.origins.length; local += 1) {
          const joined = joinOrigins(deps, values, requirePresent(left.origins[local], { owner: "analyses/body", query: null, origin: null,
            message: "A value join retains every actual local." }), requirePresent(right.origins[local], { owner: "analyses/body", query: null,
            origin: null, message: "A value join retains every actual local." }), admit);
          if (typeof joined !== "number") return left;
          next.push(joined);
        }
        const contents = mergeContents(deps, left.contents, right.contents, null);
        if (contents.kind !== "complete") return left;
        return { origins: next, contents: contents.value };
      },
    },
    statement: (statement, state) => {
      if (state === null) return state;
      const next = transferValue(deps, input, constants, initial, state.origins, statement);
      if (next.kind !== "complete") return state;
      const admission = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
      if (admission !== null) return state;
      const local = statement.kind === "assign" ? readLocal(input.mir, { kind: "place", place: statement.place }) : statement.local;
      const changed = tracked.has(local) ? currentContent(deps, state.contents, local, statement.kind === "assign") : null;
      if (changed !== null && changed.kind !== "complete") return state;
      return { origins: next.value, contents: changed === null ? state.contents : changed.value };
    },
    terminator: (terminator, state, account, block) => {
      if (state === null) return [];
      const work = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (work !== null) return [];
      const outgoing: { readonly target: typeof block; readonly state: ValueState }[] = [];
      const edge = (target: typeof block, values: CurrentValues): boolean => {
        if (chargeWork(account, 1) !== null) return false;
        if (!reachable[target]) return true;
        if (chargeResultEntries(account, 1) !== null) return false;
        outgoing.push({ target, state: values });
        return true;
      };
      if (terminator.kind === "goto") edge(terminator.target, state);
      else if (terminator.kind === "switch") {
        for (const target of terminator.targets) if (!edge(target.target, state)) return outgoing;
        edge(terminator.otherwise, state);
      } else if (terminator.kind === "call") {
        const selected = callSummary(deps, input.mir, terminator);
        if (selected.kind !== "complete") return outgoing;
        if (isCallError(selected.value)) return bodyFrontier("A solved value call retains its already-completed semantic answer.");
        if (!selected.value.returns) return outgoing;
        const destination = terminator.destination === null ? null : readLocal(input.mir, { kind: "place", place: terminator.destination });
        const result = callValueEffects(deps, input, terminator, { block, statement: null }, selected.value,
          arena, state.origins, constants, requirePresent(destination === null ? arena.origins[0]?.id : initial[destination], {
            owner: "analyses/body", query: null, origin: terminator.origin,
            message: "A call retains its actual initial destination or empty value relation." }),
          terminator.callee.kind !== "body" ? [] : requirePresent(captures.get(block), { owner: "analyses/body", query: null,
            origin: terminator.origin, message: "A selected body call retains its actual slot-location inventory." }));
        if (result.kind !== "complete") return outgoing;
        if (result.value.kind === "applied") {
          const descriptor = chargeResultEntries(account, destination === null ? 0 : 1);
          if (descriptor !== null) return outgoing;
          const applied = applyExitContents(deps, input, terminator, selected.value, result.value.value, "return", state, values, admit,
            destination === null ? null : { local: destination, tracked: tracked.has(destination) });
          if (applied.kind !== "complete") return outgoing;
          edge(terminator.next, applied.value);
          return outgoing;
        }
        let next = state;
        let writtenLocal: LocalId | null = null;
        if (destination !== null) {
          if (chargeWork(account, state.origins.length + 1) !== null || chargeResultEntries(account, state.origins.length + 1) !== null) return outgoing;
          const written = [...state.origins];
          written[destination] = result.value.result;
          writtenLocal = tracked.has(destination) ? destination : null;
          next = { origins: written, contents: state.contents };
        }
        const contents = mergeContents(deps, next.contents, result.value.contents, writtenLocal);
        if (contents.kind !== "complete") return outgoing;
        if (chargeResultEntries(account, 1) !== null) return outgoing;
        next = { origins: next.origins, contents: contents.value };
        edge(terminator.next, next);
      }
      return outgoing;
    },
  };
}

export function solveValueOrigins(deps: BodyRoundDeps, input: BodyRoundInput, arena: RelationalArena,
  values: ValueOrigins, constants: readonly OriginsId[], initial: readonly OriginsId[], boundary: readonly OriginsId[],
  reachable: readonly boolean[], admit: AdmitOrigins,
  captures: ReadonlyMap<BlockId, readonly CaptureLocation[]>, cells: readonly LocalId[]): DataflowResult<FlowSolution<ValueState>> {
  const work = chargeWork(deps.account, 1 + cells.length) ?? chargeResultEntries(deps.account, 4 + cells.length);
  if (work !== null) return work;
  const tracked = new Set(cells);
  const problem = valueProblem(deps, input, arena, values, constants, initial, { origins: boundary, contents: new Set() },
    reachable, admit, captures, tracked);
  return solve(input.mir, input.execution.provided, problem, deps.account);
}
