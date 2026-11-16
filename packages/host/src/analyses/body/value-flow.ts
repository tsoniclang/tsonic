import type { DataflowResult, DataflowStop, FlowSolution, ForwardProblem } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, solve } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BlockId, LocalId, OriginsId } from "../../ids/contract.js";
import type { CaptureLocation, RelationalArena } from "../../ir-facts/contract.js";
import type { MirOperand, MirStatement } from "../../ir-mir/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { callSummary, isCallError, referenceCallResult } from "./calls.js";
import { bodyFrontier, readLocal } from "./places.js";
import { joinOrigins, valueKind } from "./values.js";
import type { AdmitOrigins, ValueOrigins } from "./values.js";
import { primitiveExitLocals } from "./writes.js";

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

function mergeContents(deps: BodyRoundDeps, state: ReadonlySet<LocalId>, locals: Iterable<LocalId>,
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

export function collectExitContents(deps: BodyRoundDeps, origins: readonly OriginsId[], contents: ReadonlySet<LocalId>, cells: readonly LocalId[],
  output: Map<number, OriginsId>, values: ValueOrigins, admit: AdmitOrigins): DataflowStop | null {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  for (let cell = 0; cell < cells.length; cell += 1) {
    const read = chargeWork(deps.account, 2);
    if (read !== null) return read;
    const local = requirePresent(cells[cell], { owner: "analyses/body", query: null, origin: null,
      message: "A finite exit retains the actual local of every owned cell." });
    if (!contents.has(local)) continue;
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
        let next = state;
        let writtenLocal: LocalId | null = null;
        if (terminator.destination !== null) {
          const destination = readLocal(input.mir, { kind: "place", place: terminator.destination });
          const result = referenceCallResult(deps, input, terminator, { block, statement: null }, selected.value,
            arena, state.origins, constants, values, admit, requirePresent(initial[destination], { owner: "analyses/body", query: null,
              origin: terminator.origin, message: "A call destination retains its actual storage disposition." }),
            terminator.callee.kind !== "body" ? [] : requirePresent(captures.get(block), { owner: "analyses/body", query: null,
              origin: terminator.origin, message: "A selected body call retains its actual slot-location inventory." }));
          if (result.kind !== "complete") return outgoing;
          if (chargeWork(account, state.origins.length + 1) !== null || chargeResultEntries(account, state.origins.length + 1) !== null) return outgoing;
          const written = [...state.origins];
          written[destination] = result.value;
          writtenLocal = tracked.has(destination) ? destination : null;
          next = { origins: written, contents: state.contents };
        }
        const returned = primitiveExitLocals(deps, input, terminator, selected.value);
        if (returned.kind !== "complete") return outgoing;
        const contents = mergeContents(deps, next.contents, returned.value, writtenLocal);
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
