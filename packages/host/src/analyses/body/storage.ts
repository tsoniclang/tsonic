import type { DataflowAccount, DataflowResult, DataflowStop, ForwardProblem, Lattice } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, solve } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BlockId, LocalId, PlaceId } from "../../ids/contract.js";
import type { MirBody, MirOperand, MirStatement, MirTerminator } from "../../ir-mir/contract.js";
import type { LogicalCellLifetime, Summary } from "../../ir-facts/contract.js";
import { localOwnershipOfMir } from "../../ir-mir/index.js";
import type { BodyRoundDeps, BodyRoundInput, RoundCallRead } from "./contract.js";
import type { CallError, SelectedCall } from "./calls.js";
import { callSummary, isCallError, isLeastCall } from "./calls.js";
import { callExitAssigned } from "./initialization.js";
import type { StaticCalleeCells } from "./static-calls.js";
import { bodyFrontier, rootSlot } from "./places.js";
import type { StaticSlots } from "./places.js";
import { valueKind } from "./values.js";

interface CellTaint {
  readonly defaultCause: CallError;
  readonly exceptions: ReadonlyMap<number, CallError | null>;
}

export interface AssignedState {
  readonly written: ReadonlySet<number>;
  readonly taint: CellTaint | null;
}

export type Assigned = AssignedState | null;

export function localSlotLifetimes(input: BodyRoundInput, entries: readonly Assigned[],
  account: DataflowAccount): DataflowResult<ReadonlyMap<LocalId, readonly LogicalCellLifetime[]>> {
  const admitted = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (admitted !== null) return admitted;
  const slots = new Map<LocalId, LogicalCellLifetime[]>();
  for (let blockIndex = 0; blockIndex < input.mir.blocks.length; blockIndex += 1) {
    const blockWork = chargeWork(account, 2);
    if (blockWork !== null) return blockWork;
    if (entries[blockIndex] === null || entries[blockIndex] === undefined) continue;
    const block = requirePresent(input.mir.blocks[blockIndex], { owner: "analyses/body", query: null, origin: null,
      message: "A reached storage-marker block remains in the verified MIR." });
    for (let position = 0; position < block.statements.length; position += 1) {
      const statementWork = chargeWork(account, 1);
      if (statementWork !== null) return statementWork;
      const statement = requirePresent(block.statements[position], { owner: "analyses/body", query: null, origin: block.origin,
        message: "A reached storage marker retains its actual statement occurrence." });
      if (statement.kind !== "storage-live" && statement.kind !== "storage-dead") continue;
      const growth = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
      if (growth !== null) return growth;
      let slot = slots.get(statement.local);
      if (slot === undefined) {
        const entry = chargeResultEntries(account, 2);
        if (entry !== null) return entry;
        slot = [];
        slots.set(statement.local, slot);
      }
      const point = { block: block.id, statement: position };
      slot.push({ kind: statement.kind === "storage-live" ? "live" : "dead", execution: input.execution,
        point, local: statement.local });
    }
  }
  return { kind: "complete", value: slots };
}

export type StorageLive = ReadonlySet<LocalId> | null;

export function storageLiveLattice(stateBound: number): Lattice<StorageLive> {
  return {
    bottom: null, overflow: null, stateBound, isOverflow: () => false,
    equals: (left, right, account) => {
      if (left === right) return true;
      if (left === null || right === null || left.size !== right.size) return false;
      for (const local of left) {
        if (chargeWork(account, 1) !== null) return true;
        if (!right.has(local)) return false;
      }
      return true;
    },
    join: (left, right, account) => {
      if (left === null) return right;
      if (right === null || left === right) return left;
      const admitted = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (admitted !== null) return left;
      const common = new Set<LocalId>();
      for (const local of left) {
        if (chargeWork(account, 1) !== null) return left;
        if (!right.has(local)) continue;
        if (chargeResultEntries(account, 1) !== null) return left;
        common.add(local);
      }
      return common;
    },
  };
}

export function solveStorageLive(input: Pick<BodyRoundInput, "execution" | "mir">, entries: readonly Assigned[],
  account: DataflowAccount): DataflowResult<readonly StorageLive[]> {
  const admitted = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (admitted !== null) return admitted;
  const problem: ForwardProblem<StorageLive> = {
    direction: "forward", boundary: new Set(), lattice: storageLiveLattice(input.mir.locals.length + 1),
    statement: (statement, state, borrowed) => {
      if (state === null || statement.kind !== "storage-live" && statement.kind !== "storage-dead") return state;
      const growth = chargeWork(borrowed, state.size + 1)
        ?? chargeResultEntries(borrowed, state.size + (statement.kind === "storage-live" ? 2 : 1));
      if (growth !== null) return state;
      const next = new Set(state);
      if (statement.kind === "storage-live") next.add(statement.local);
      else next.delete(statement.local);
      return next;
    },
    terminator: (terminator, state, borrowed) => {
      if (state === null) return [];
      if (chargeWork(borrowed, 1) !== null || chargeResultEntries(borrowed, 1) !== null) return [];
      const outgoing: { readonly target: BlockId; readonly state: StorageLive }[] = [];
      const edge = (target: BlockId): boolean => {
        if (chargeWork(borrowed, 1) !== null) return false;
        if (entries[target] === null || entries[target] === undefined) return true;
        if (chargeResultEntries(borrowed, 1) !== null) return false;
        outgoing.push({ target, state });
        return true;
      };
      if (terminator.kind === "goto") edge(terminator.target);
      else if (terminator.kind === "call" || terminator.kind === "invoke") edge(terminator.next);
      else if (terminator.kind === "switch") {
        for (let position = 0; position < terminator.targets.length; position += 1) {
          if (chargeWork(borrowed, 1) !== null) return outgoing;
          const target = requirePresent(terminator.targets[position], { owner: "analyses/body", query: null, origin: terminator.origin,
            message: "A verified storage-live switch retains every actual target." });
          if (!edge(target.target)) return outgoing;
        }
        edge(terminator.otherwise);
      } else terminatorOperands(terminator);
      return outgoing;
    },
  };
  const solution = solve(input.mir, input.execution.provided, problem, account);
  return solution.kind === "complete" ? { kind: "complete", value: solution.value.exit } : solution;
}

export function assignedEntry(entries: readonly Assigned[], block: BlockId): AssignedState {
  const entry = entries[block];
  if (entry === undefined || entry === null)
    return bodyFrontier("A reached block has its actual solved initialization entry.");
  return entry;
}

export function selectedCallAt(calls: ReadonlyMap<BlockId, SelectedCall> | null, block: BlockId): SelectedCall {
  return requirePresent(calls?.get(block), { owner: "analyses/body", query: null, origin: null,
    message: "A reached call retains its exact selected answer from initialization." });
}

export function statementOperands(statement: MirStatement): readonly MirOperand[] {
  if (statement.kind !== "assign") return [];
  const value = statement.value;
  switch (value.kind) {
    case "use": case "unary": case "convert": return [value.operand];
    case "binary": return [value.left, value.right];
    default: return bodyFrontier("BodyAnalysis needs the actual aggregate, capture or backing producer for this operation.");
  }
}

export function terminatorOperands(terminator: MirTerminator): readonly MirOperand[] {
  switch (terminator.kind) {
    case "return": return terminator.value === null ? [] : [terminator.value];
    case "throw":
      if (terminator.unwind.kind !== "escape")
        return bodyFrontier("BodyAnalysis requires the actual selected handler or process-ending throw transport.");
      return [terminator.operand];
    case "switch": return [terminator.operand];
    case "invoke": return terminator.operands;
    case "goto": case "unreachable": return [];
    default: return bodyFrontier("BodyAnalysis needs the selected call, failure or suspension transport for this terminator.");
  }
}

export function transferAssigned(body: MirBody, statement: MirStatement, state: AssignedState,
  account: DataflowAccount, statics?: StaticSlots): AssignedState;
export function transferAssigned(body: MirBody, statement: MirStatement, state: Assigned,
  account: DataflowAccount, statics?: StaticSlots): Assigned;
export function transferAssigned(body: MirBody, statement: MirStatement, state: Assigned,
  account: DataflowAccount, statics: StaticSlots = null): Assigned {
  if (state === null || accountFailure(account) !== null) return state;
  if (statement.kind === "assign") return assignDestination(body, statement.place, state, account, statics, true);
  if (chargeWork(account, 1 + state.written.size) !== null || chargeResultEntries(account, state.written.size + 2) !== null) return state;
  const written = new Set(state.written);
  written.delete(statement.local);
  return { written, taint: state.taint };
}

function assignDestination(body: MirBody, place: PlaceId, state: AssignedState, account: DataflowAccount,
  statics: StaticSlots, clearsTaint: boolean): AssignedState {
  if (chargeWork(account, 1) !== null) return state;
  const target = body.places[place]?.base;
  if (target?.kind === "place" && target.projection.kind === "field") return state;
  if (chargeWork(account, state.written.size) !== null || chargeResultEntries(account, state.written.size + 2) !== null) return state;
  const local = rootSlot(body, place, statics);
  const written = new Set(state.written);
  written.add(local);
  let taint = state.taint;
  if (clearsTaint && taint !== null && taintCauseOf(taint, local) !== null) {
    if (chargeWork(account, taint.exceptions.size) !== null || chargeResultEntries(account, taint.exceptions.size + 3) !== null) return state;
    const exceptions = new Map(taint.exceptions);
    exceptions.set(local, null);
    taint = { defaultCause: taint.defaultCause, exceptions };
  }
  return { written, taint };
}

function abortingPrimitiveDestination(deps: BodyRoundDeps, body: MirBody,
  invoke: Extract<MirTerminator, { readonly kind: "invoke" }>): DataflowResult<PlaceId> {
  const { account } = deps;
  const admitted = chargeWork(account, 1);
  if (admitted !== null) return admitted;
  const { operation, execution, result } = invoke.operation.decision;
  const destination = invoke.destination;
  if (operation.kind !== "native-operator" || execution.kind !== "invocation" || execution.failure !== "abort"
    || execution.writesStorage || invoke.unwind.kind !== "abort" || invoke.step !== null || destination === null)
    return bodyFrontier("BodyAnalysis needs the selected call, failure or suspension transport for this terminator.");
  const place = body.places[destination];
  if (place?.base.kind !== "local" || place.storage !== result)
    return bodyFrontier("A process-ending native value operation needs its exact local result place.");
  const localWork = chargeWork(account, 1);
  if (localWork !== null) return localWork;
  const local = body.locals[place.base.local];
  if (local?.role.kind !== "temporary" || local.mode !== "local" || local.storage !== result)
    return bodyFrontier("A process-ending native value operation needs its own temporary result.");
  const kind = valueKind(deps, result);
  const stop = accountFailure(account);
  if (stop !== null) return stop;
  if (kind !== "primitive") return bodyFrontier("A process-ending native value operation needs its selected primitive result.");
  return { kind: "complete", value: destination };
}

function selectError(left: CallError | null, right: CallError, account: DataflowAccount): CallError {
  if (left === null) return right;
  if (left === right) return left;
  if (chargeWork(account, left.key.length + right.key.length) !== null) return left;
  return left.key <= right.key ? left : right;
}

function taintCauseOf(taint: CellTaint | null, local: number): CallError | null {
  if (taint === null) return null;
  const cause = taint.exceptions.get(local);
  return cause === undefined ? taint.defaultCause : cause;
}

export function unwrittenCause(state: AssignedState, local: number): CallError | null {
  return state.written.has(local) ? null : taintCauseOf(state.taint, local);
}

function sameCause(left: CallError | null, right: CallError | null, account: DataflowAccount): boolean {
  if (left === right) return true;
  if (left === null || right === null) return false;
  if (chargeWork(account, left.key.length + right.key.length) !== null) return false;
  return left.key === right.key;
}

function unionCause(left: CallError | null, right: CallError | null, account: DataflowAccount): CallError | null {
  return right === null ? left : selectError(left, right, account);
}

function retainException(exceptions: Map<number, CallError | null>, local: number, cause: CallError | null,
  defaultCause: CallError, account: DataflowAccount): boolean {
  const same = sameCause(cause, defaultCause, account);
  if (accountFailure(account) !== null) return false;
  if (same) return true;
  if (chargeResultEntries(account, 1) !== null) return false;
  exceptions.set(local, cause);
  return true;
}

function joinTaint(left: CellTaint | null, right: CellTaint | null, account: DataflowAccount): CellTaint | null {
  if (left === null || left === right) return right;
  if (right === null) return left;
  const defaultCause = selectError(left.defaultCause, right.defaultCause, account);
  if (chargeResultEntries(account, 2) !== null) return left;
  const exceptions = new Map<number, CallError | null>();
  for (const [local, cause] of left.exceptions) {
    if (chargeWork(account, 1) !== null
      || !retainException(exceptions, local, unionCause(cause, taintCauseOf(right, local), account), defaultCause, account)) return left;
  }
  for (const [local, cause] of right.exceptions) {
    if (chargeWork(account, 1) !== null) return left;
    if (!left.exceptions.has(local)
      && !retainException(exceptions, local, unionCause(left.defaultCause, cause, account), defaultCause, account)) return left;
  }
  return { defaultCause, exceptions };
}

export function taintUnwritten(state: AssignedState, failure: CallError, account: DataflowAccount): AssignedState {
  const previous = state.taint;
  const defaultCause = selectError(previous?.defaultCause ?? null, failure, account);
  if (chargeResultEntries(account, 3) !== null) return state;
  const exceptions = new Map<number, CallError | null>();
  if (previous !== null) for (const [local, cause] of previous.exceptions) {
    if (chargeWork(account, 1) !== null) return state;
    const result = state.written.has(local) ? cause : selectError(cause, failure, account);
    if (!retainException(exceptions, local, result, defaultCause, account)) return state;
  }
  for (const local of state.written) {
    if (chargeWork(account, 1) !== null) return state;
    if (previous?.exceptions.has(local) !== true
      && !retainException(exceptions, local, previous?.defaultCause ?? null, defaultCause, account)) return state;
  }
  return { written: state.written, taint: { defaultCause, exceptions } };
}

function equalTaint(left: CellTaint | null, right: CellTaint | null, account: DataflowAccount): boolean {
  if (left === right) return true;
  if (left === null || right === null || left.exceptions.size !== right.exceptions.size
    || !sameCause(left.defaultCause, right.defaultCause, account)) return false;
  for (const [local, cause] of left.exceptions) {
    if (chargeWork(account, 1) !== null || !sameCause(cause, taintCauseOf(right, local), account)) return false;
  }
  return true;
}

export function assignedLattice(stateBound: number): Lattice<Assigned> {
  return {
    bottom: null, overflow: null, stateBound,
    isOverflow: () => false,
    equals: (left, right, borrowed) => {
      if (left === right) return true;
      if (left === null || right === null) return false;
      if (left.written !== right.written) {
        if (left.written.size !== right.written.size) return false;
        if (chargeWork(borrowed, left.written.size) !== null) return true;
        for (const local of left.written) if (!right.written.has(local)) return false;
      }
      return equalTaint(left.taint, right.taint, borrowed);
    },
    join: (left, right, borrowed) => {
      if (left === null) return right;
      if (right === null || left === right) return left;
      let written = left.written;
      if (written !== right.written) {
        if (chargeWork(borrowed, written.size) !== null || chargeResultEntries(borrowed, written.size + 1) !== null) return left;
        const common = new Set<number>();
        for (const local of written) if (right.written.has(local)) common.add(local);
        written = common;
      }
      const taint = joinTaint(left.taint, right.taint, borrowed);
      if (chargeResultEntries(borrowed, 1) !== null) return left;
      return { written, taint };
    },
  };
}

export function solveAssigned(deps: BodyRoundDeps, input: Pick<BodyRoundInput, "execution" | "mir">, statics: StaticSlots = null,
  observeCall: ((summary: Summary) => DataflowStop | null) | null = null, staticSlot: StaticCalleeCells | null = null):
  DataflowResult<{ readonly entry: readonly Assigned[]; readonly reachable: readonly boolean[]; readonly error: CallError | null;
    readonly calls: ReadonlyMap<BlockId, SelectedCall> | null }> {
  const { account } = deps;
  const entry = chargeWork(account, 1);
  if (entry !== null) return entry;
  const { mir: body, execution: { provided } } = input;
  const setup = chargeWork(account, body.locals.length) ?? chargeResultEntries(account, body.locals.length + 2);
  if (setup !== null) return setup;
  const boundary = new Set<LocalId>();
  for (const local of body.locals) {
    if (local.role.kind === "parameter" && local.role.index < provided
      || local.role.kind === "receiver"
      || local.role.kind === "capture" && localOwnershipOfMir(local.mode) === "body") boundary.add(local.id);
  }
  let error: CallError | null = null;
  let calls: Map<BlockId, SelectedCall> | null = null;
  let answers: Map<string, RoundCallRead> | null = null;
  const problem: ForwardProblem<Assigned> = {
    direction: "forward", boundary: { written: boundary, taint: null },
    lattice: assignedLattice(body.locals.length + (statics?.size ?? 0) + 1),
    statement: (statement, state, borrowed) => transferAssigned(body, statement, state, borrowed, statics),
    terminator: (terminator, state, borrowed, block) => {
      if (terminator.kind === "call" || terminator.kind === "invoke") {
        if (state === null) return [];
        let next = state;
        if (terminator.kind === "invoke") {
          const destination = abortingPrimitiveDestination(deps, body, terminator);
          if (destination.kind !== "complete") return [];
          next = assignDestination(body, destination.value, state, borrowed, statics, false);
        } else {
          if (chargeWork(borrowed, 1) !== null) return [];
          if (calls === null || answers === null) {
            if (chargeResultEntries(borrowed, 2) !== null) return [];
            calls = new Map();
            answers = new Map();
          }
          let selected = calls.get(block);
          if (selected === undefined) {
            if (chargeResultEntries(borrowed, 1) !== null) return [];
            const answer = callSummary(deps, body, terminator, answers);
            if (answer.kind !== "complete") return [];
            selected = answer.value;
            calls.set(block, selected);
            if (isCallError(selected)) error = selectError(error, selected, borrowed);
            else if (!isLeastCall(selected) && observeCall !== null && observeCall(selected) !== null) return [];
          }
          if (isLeastCall(selected)) return [];
          if (isCallError(selected)) {
            next = taintUnwritten(state, selected, borrowed);
          } else {
            if (!selected.returns) return [];
            const initialized = callExitAssigned(deps, body, terminator, selected, state.written, "return", staticSlot);
            if (initialized.kind !== "complete") return [];
            if (initialized.value !== state.written) {
              if (chargeResultEntries(borrowed, 1) !== null) return [];
              next = { written: initialized.value, taint: state.taint };
            }
          }
          if (terminator.destination !== null) next = assignDestination(body, terminator.destination, next, borrowed, statics, false);
        }
        if (chargeWork(borrowed, 1) !== null || chargeResultEntries(borrowed, 1) !== null) return [];
        return [{ target: terminator.next, state: next }];
      }
      const count = terminator.kind === "switch" ? terminator.targets.length + 1 : terminator.kind === "goto" ? 1 : 0;
      if (chargeWork(borrowed, count) !== null || chargeResultEntries(borrowed, count) !== null) return [];
      if (terminator.kind === "goto") return [{ target: terminator.target, state }];
      if (terminator.kind === "switch") return [...terminator.targets.map(target => ({ target: target.target, state })),
        { target: terminator.otherwise, state }];
      terminatorOperands(terminator);
      return [];
    },
  };
  const solved = solve(body, provided, problem, account);
  if (solved.kind !== "complete") return solved;
  const collect = chargeResultEntries(account, 1);
  if (collect !== null) return collect;
  return { kind: "complete", value: { entry: solved.value.entry, reachable: solved.value.reachable, error, calls } };
}
