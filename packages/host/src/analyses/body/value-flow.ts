import type { DataflowResult, ForwardProblem } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, solve } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BlockId, OriginsId } from "../../ids/contract.js";
import type { CaptureLocation, RelationalArena } from "../../ir-facts/contract.js";
import type { MirOperand, MirStatement } from "../../ir-mir/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { callSummary, isCallError, referenceCallResult } from "./calls.js";
import { bodyFrontier, readLocal } from "./places.js";
import { joinOrigins, valueKind } from "./values.js";
import type { AdmitOrigins, ValueOrigins } from "./values.js";

export type ValueState = readonly OriginsId[] | null;
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
  values: ValueOrigins, constants: readonly OriginsId[], initial: readonly OriginsId[], boundary: readonly OriginsId[],
  reachable: readonly boolean[], admit: AdmitOrigins,
  captures: ReadonlyMap<BlockId, readonly CaptureLocation[]>): ForwardProblem<ValueState> {
  return {
    direction: "forward", boundary,
    lattice: {
      bottom: null, overflow: null, isOverflow: () => false, stateBound: input.mir.locals.length + 1,
      equals: (left, right, account) => {
        if (accountFailure(account) !== null) return true;
        if (left === right) return true;
        if (left === null || right === null) return false;
        for (let local = 0; local < left.length; local += 1) {
          if (chargeWork(account, 1) !== null) return true;
          if (left[local] !== right[local]) return false;
        }
        return true;
      },
      join: (left, right, account) => {
        if (accountFailure(account) !== null) return left;
        if (left === null) return right;
        if (right === null || left === right) return left;
        if (chargeWork(account, left.length) !== null || chargeResultEntries(account, left.length) !== null) return left;
        const next: OriginsId[] = [];
        for (let local = 0; local < left.length; local += 1) {
          const joined = joinOrigins(deps, values, requirePresent(left[local], { owner: "analyses/body", query: null, origin: null,
            message: "A value join retains every actual local." }), requirePresent(right[local], { owner: "analyses/body", query: null,
            origin: null, message: "A value join retains every actual local." }), admit);
          if (typeof joined !== "number") return left;
          next.push(joined);
        }
        return next;
      },
    },
    statement: (statement, state) => {
      if (state === null) return state;
      const next = transferValue(deps, input, constants, initial, state, statement);
      return next.kind === "complete" ? next.value : state;
    },
    terminator: (terminator, state, account, block) => {
      if (state === null) return [];
      const work = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (work !== null) return [];
      const outgoing: { readonly target: typeof block; readonly state: ValueState }[] = [];
      const edge = (target: typeof block, values: readonly OriginsId[]): boolean => {
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
        if (terminator.destination !== null) {
          const destination = readLocal(input.mir, { kind: "place", place: terminator.destination });
          const result = referenceCallResult(deps, input, terminator, { block, statement: null }, selected.value,
            arena, state, constants, values, admit, requirePresent(initial[destination], { owner: "analyses/body", query: null,
              origin: terminator.origin, message: "A call destination retains its actual storage disposition." }),
            terminator.callee.kind !== "body" ? [] : requirePresent(captures.get(block), { owner: "analyses/body", query: null,
              origin: terminator.origin, message: "A selected body call retains its actual slot-location inventory." }));
          if (result.kind !== "complete") return outgoing;
          if (chargeWork(account, state.length) !== null || chargeResultEntries(account, state.length) !== null) return outgoing;
          const written = [...state];
          written[destination] = result.value;
          next = written;
        }
        edge(terminator.next, next);
      }
      return outgoing;
    },
  };
}

export function solveValueOrigins(deps: BodyRoundDeps, input: BodyRoundInput, arena: RelationalArena,
  values: ValueOrigins, constants: readonly OriginsId[], initial: readonly OriginsId[], boundary: readonly OriginsId[],
  reachable: readonly boolean[], admit: AdmitOrigins,
  captures: ReadonlyMap<BlockId, readonly CaptureLocation[]>): DataflowResult<ReadonlyMap<BlockId, readonly OriginsId[]>> {
  const work = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
  if (work !== null) return work;
  const problem = valueProblem(deps, input, arena, values, constants, initial, boundary, reachable, admit, captures);
  const result = solve(input.mir, input.execution.provided, problem, deps.account);
  if (result.kind !== "complete") return result;
  const collection = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
  if (collection !== null) return collection;
  const entries = new Map<BlockId, readonly OriginsId[]>();
  for (const block of input.mir.blocks) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    const state = result.value.entry[block.id];
    if (state === null || state === undefined) continue;
    const growth = chargeResultEntries(deps.account, 1);
    if (growth !== null) return growth;
    entries.set(block.id, state);
  }
  return { kind: "complete", value: entries };
}
