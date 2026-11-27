import type { DataflowResult, DataflowStop, FlowSolution, ForwardProblem } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, solve } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BlockId, LocalId, OriginsId } from "../../ids/contract.js";
import { originsId } from "../../ids/index.js";
import type { AppliedSummary, RelationalArena } from "../../ir-facts/contract.js";
import type { CallCaptureTransport } from "./calls.js";
import type { MirCompletionState, MirOperand, MirPendingCompletion, MirStatement, MirTerminator } from "../../ir-mir/contract.js";
import { transferMirCompletion } from "../../ir-mir/index.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { callValueEffects, isCallError, isLeastCall } from "./calls.js";
import type { SelectedCall } from "./calls.js";
import type { StaticCalleeCells } from "./static-calls.js";
import { bodyFrontier, readSlot, rootSlot } from "./places.js";
import type { StorageSlots } from "./places.js";
import type { HeldProjections } from "./projection-effects.js";
import { cleanupTarget, selectedCallAt } from "./storage.js";
import { appliedOrigins, joinOrigins, valueKind } from "./values.js";
import type { OpenCallTransport, ReadCallBoundary } from "./open-calls.js";
import { noCallBoundary } from "./open-calls.js";
import type { AdmitOrigins, ValueOrigins } from "./values.js";

export interface CurrentValues {
  readonly origins: readonly OriginsId[];
  readonly contents: ReadonlySet<number>;
  readonly completion?: MirCompletionState<OriginsId>;
}
export type ValueState = CurrentValues | null;

function withValues(state: ValueState | undefined, origins: readonly OriginsId[], contents: ReadonlySet<number>): CurrentValues {
  const completion = state?.completion;
  return completion === undefined ? { origins, contents } : { origins, contents, completion };
}

function withCompletion(state: CurrentValues, completion: MirCompletionState<OriginsId>): CurrentValues {
  return completion.active === null && completion.carried === null ? { origins: state.origins, contents: state.contents }
    : { origins: state.origins, contents: state.contents, completion };
}

function sameCompletion(account: BodyRoundDeps["account"], first: MirCompletionState<OriginsId> | undefined,
  second: MirCompletionState<OriginsId> | undefined): boolean {
  if (first === second) return true;
  if (first?.carried !== second?.carried) return false;
  for (let left = first?.active ?? null, right = second?.active ?? null; left !== right; left = left.outer, right = right.outer) {
    if (chargeWork(account, 1) !== null) return true;
    if (left === null || right === null || left.entry !== right.entry || left.continuation !== right.continuation || left.failure !== right.failure)
      return false;
  }
  return true;
}

function joinCompletion(deps: BodyRoundDeps, values: ValueOrigins, admit: AdmitOrigins, first: MirCompletionState<OriginsId> | undefined,
  second: MirCompletionState<OriginsId> | undefined): DataflowResult<MirCompletionState<OriginsId>> {
  const { account } = deps;
  if (first === undefined && second !== undefined) return { kind: "complete", value: second };
  if (second === undefined && first !== undefined) return { kind: "complete", value: first };
  if (first === undefined || second === undefined) return bodyFrontier("A completion join requires at least one actual carried state.");
  const left = first, right = second;
  if (left === right) return { kind: "complete", value: left };
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
  if (setup !== null) return setup;
  const joinValue = (before: OriginsId | null, after: OriginsId | null): OriginsId | null | DataflowStop =>
    before === null ? after : after === null ? before : joinOrigins(deps, values, before, after, admit);
  const carried = joinValue(left.carried, right.carried);
  if (carried !== null && typeof carried !== "number") return carried;
  const frames: { readonly entry: BlockId; readonly continuation: BlockId; readonly failure: OriginsId | null }[] = [];
  let previous = left.active, next = right.active;
  while (previous !== next) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    if (previous === null || next === null || previous.entry !== next.entry || previous.continuation !== next.continuation)
      return { kind: "complete", value: { active: null, carried } };
    const failure = joinValue(previous.failure, next.failure);
    if (failure !== null && typeof failure !== "number") return failure;
    const retained = chargeResultEntries(account, 2);
    if (retained !== null) return retained;
    frames.push({ entry: previous.entry, continuation: previous.continuation, failure });
    previous = previous.outer;
    next = next.outer;
  }
  let active: MirPendingCompletion<OriginsId> | null = previous;
  for (let position = frames.length - 1; position >= 0; position -= 1) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const frame = requirePresent(frames[position], { owner: "analyses/body", query: null, origin: null, message: "A completion join retains every admitted frame." });
    active = { ...frame, outer: active };
  }
  return { kind: "complete", value: { active, carried } };
}

function currentContent(deps: BodyRoundDeps, state: ReadonlySet<number>, local: number,
  written: boolean): DataflowResult<ReadonlySet<number>> {
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  if (state.has(local) === written) return { kind: "complete", value: state };
  const copy = chargeWork(deps.account, state.size + 1) ?? chargeResultEntries(deps.account, state.size + 2);
  if (copy !== null) return copy;
  const next = new Set(state);
  if (written) next.add(local); else next.delete(local);
  return { kind: "complete", value: next };
}

export function mergeContents(deps: BodyRoundDeps, state: ReadonlySet<number>, locals: Iterable<number>,
  destination: number | null): DataflowResult<ReadonlySet<number>> {
  const setup = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 2);
  if (setup !== null) return setup;
  let next: Set<number> | null = null;
  const add = (local: number): DataflowStop | null => {
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

export function applyExitContents(deps: BodyRoundDeps,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, application: AppliedSummary, cellSlots: readonly number[],
  kind: "return" | "unwind", state: ValueState | undefined, values: ValueOrigins, admit: AdmitOrigins,
  destination: { readonly local: number; readonly tracked: boolean } | null, readBoundary: ReadCallBoundary): DataflowResult<CurrentValues> {
  const setup = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 2);
  if (setup !== null) return setup;
  const origins = requirePresent(state?.origins, { owner: "analyses/body", query: null, origin: operation.origin,
    message: "An applied exit retains its actual solved pre-call value state." });
  const previousContents = requirePresent(state?.contents, { owner: "analyses/body", query: null, origin: operation.origin,
    message: "An applied exit retains its actual solved pre-call content state." });
  const applied = kind === "return" ? application.contentsOnReturn : application.contentsOnUnwind;
  const locals: number[] = [];
  let next: OriginsId[] | null = null;
  const store = (local: number, value: OriginsId): DataflowStop | null => {
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
    const read = chargeWork(deps.account, 3);
    if (read !== null) return read;
    const row = requirePresent(applied[index], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "An applied finite content retains its actual value." });
    const local = requirePresent(cellSlots[row.target.targets[0].cell], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "An applied finite content retains its actual caller slot." });
    const value = appliedOrigins(deps, values, row.value, admit, readBoundary);
    if (typeof value !== "number") return value;
    const stored = store(local, value);
    if (stored !== null) return stored;
    const growth = chargeResultEntries(deps.account, 1);
    if (growth !== null) return growth;
    locals.push(local);
  }
  if (destination !== null) {
    const value = appliedOrigins(deps, values, kind === "return" ? application.result : application.thrown, admit, readBoundary);
    if (typeof value !== "number") return value;
    const stored = store(destination.local, value);
    if (stored !== null) return stored;
  }
  const contents = mergeContents(deps, previousContents, locals, destination?.tracked === true ? destination.local : null);
  if (contents.kind !== "complete") return contents;
  const output = chargeResultEntries(deps.account, 1);
  if (output !== null) return output;
  return { kind: "complete", value: withValues(state, next ?? origins, contents.value) };
}

export function collectExitContents(deps: BodyRoundDeps, origins: readonly OriginsId[], entry: readonly OriginsId[], contents: ReadonlySet<number>, cells: readonly number[],
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

export function removeUnchangedContents(deps: BodyRoundDeps, output: Map<number, OriginsId>, cells: readonly number[],
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
export function operandOrigins(input: BodyRoundInput, constants: readonly OriginsId[], state: readonly OriginsId[], operand: MirOperand,
  slots: StorageSlots = null, fields: HeldProjections | null = null): OriginsId {
  if (operand.kind === "place") {
    const projection = fields?.places.get(operand.place);
    if (projection !== undefined) return originsId(projection.includesAbsence ? 1 : 0);
    const base = input.mir.places[operand.place]?.base;
    if (base?.kind === "checked" && base.projection.kind === "refined") return originsId(0);
  }
  return requirePresent(operand.kind === "constant" ? constants[operand.constant] : state[readSlot(input.mir, operand.place, slots)],
    { owner: "analyses/body", query: null, origin: null, message: "An executing operand retains its actual value-flow Origins." });
}

export function transferValue(deps: BodyRoundDeps, input: BodyRoundInput, constants: readonly OriginsId[],
  initial: readonly OriginsId[], state: readonly OriginsId[], statement: MirStatement, slots: StorageSlots = null, fields: HeldProjections | null = null):
  DataflowResult<readonly OriginsId[]> {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  const step = chargeWork(deps.account, 1);
  if (step !== null) return step;
  if (statement.kind === "assign" && fields?.places.has(statement.place) === true) return { kind: "complete", value: state };
  const work = chargeWork(deps.account, state.length) ?? chargeResultEntries(deps.account, state.length);
  if (work !== null) return work;
  const next = [...state];
  if (statement.kind === "assign") {
    const local = rootSlot(input.mir, statement.place, slots);
    let operand = statement.value.kind === "use" ? statement.value.operand : null;
    if (statement.value.kind !== "use") {
      const storage = requirePresent(input.mir.places[statement.place], { owner: "analyses/body", query: null, origin: statement.origin,
        message: "An executing assignment retains its selected place storage." });
      const kind = valueKind(deps, storage.storage);
      const stopped = accountFailure(deps.account);
      if (stopped !== null) return stopped;
      if (kind === "reference" || kind === "array-reference") return bodyFrontier("BodyAnalysis requires the actual selected reference operation value producer.");
      if (kind === "primitive-optional" || kind === "reference-optional") {
        const value = statement.value;
        if (value.kind !== "convert" || value.operation.decision.kind !== "selected"
          || value.operation.decision.execution.kind !== "pure" || value.operation.decision.operation.kind !== "conversion")
          return bodyFrontier("BodyAnalysis requires the actual selected optional value conversion.");
        const conversion = value.operation.decision.operation.embedding;
        if (value.to !== storage.storage || conversion.kind !== "conversion" || conversion.check.kind !== "none"
          || conversion.conversion !== "absence" && conversion.conversion !== "union-injection")
          return bodyFrontier("BodyAnalysis requires the actual selected absent or present optional conversion.");
        operand = value.operand;
      }
    }
    next[local] = operand !== null ? operandOrigins(input, constants, state, operand, slots, fields)
      : requirePresent(initial[local], { owner: "analyses/body", query: null, origin: statement.origin,
        message: "A selected pure scalar operation retains its storage disposition." });
  } else next[statement.local] = requirePresent(initial[statement.local], { owner: "analyses/body", query: null,
    origin: statement.origin, message: "A storage reset retains the local's uninitialized value disposition." });
  return { kind: "complete", value: next };
}

export function valueProblem(deps: BodyRoundDeps, input: BodyRoundInput, arena: RelationalArena,
  values: ValueOrigins, constants: readonly OriginsId[], initial: readonly OriginsId[], boundary: CurrentValues,
  reachable: readonly boolean[], admit: AdmitOrigins,
  captures: ReadonlyMap<BlockId, readonly CallCaptureTransport[]>, tracked: ReadonlySet<number>, calls: ReadonlyMap<BlockId, SelectedCall> | null,
  transport: OpenCallTransport | null,
  slots: StorageSlots = null, staticCallees: StaticCalleeCells | null = null, cellSlots: readonly number[] = [], fields: HeldProjections | null = null,
  objectValues: ReadonlySet<LocalId> | null = null): ForwardProblem<ValueState> {
  return {
    direction: "forward", boundary,
    lattice: {
      bottom: null, overflow: null, isOverflow: () => false, stateBound: initial.length + 1,
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
        return sameCompletion(account, left.completion, right.completion);
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
        if (left.completion === undefined && right.completion === undefined) return { origins: next, contents: contents.value };
        const completion = joinCompletion(deps, values, admit, left.completion, right.completion);
        return completion.kind === "complete" ? withCompletion({ origins: next, contents: contents.value }, completion.value) : left;
      },
    },
    statement: (statement, state) => {
      if (state === null) return state;
      const next = transferValue(deps, input, constants, initial, state.origins, statement, slots, fields);
      if (next.kind !== "complete") return state;
      const admission = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
      if (admission !== null) return state;
      const local = statement.kind === "assign" ? fields?.places.has(statement.place) === true
        ? null : rootSlot(input.mir, statement.place, slots) : statement.local;
      const changed = local !== null && tracked.has(local) ? currentContent(deps, state.contents, local, statement.kind === "assign") : null;
      if (changed !== null && changed.kind !== "complete") return state;
      return withValues(state, next.value, changed === null ? state.contents : changed.value);
    },
    terminator: (terminator, state, account, block, resumed) => {
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
      const carry = (target: BlockId, origins: OriginsId, incoming: CurrentValues): boolean => {
        if (chargeWork(account, 1) !== null || chargeResultEntries(account, 2) !== null) return false;
        if (incoming.completion?.carried != null) return bodyFrontier("An unwind cannot overwrite an in-flight failure.");
        return edge(target, withCompletion(incoming, { active: incoming.completion?.active ?? null, carried: origins }));
      };
      if (terminator.kind === "cleanup-enter" || terminator.kind === "cleanup-resume" || terminator.kind === "cleanup-discard") {
        if (chargeWork(account, 1) !== null || chargeResultEntries(account, terminator.kind === "cleanup-enter" ? 3 : 2) !== null) return outgoing;
        const moved = transferMirCompletion(terminator, state.completion ?? { active: null, carried: null });
        if (moved.kind !== "next" || cleanupTarget(terminator, resumed) !== moved.target)
          return bodyFrontier("A value transfer must retain its exact qualified cleanup continuation.");
        edge(moved.target, withCompletion(state, moved.state));
      } else if (terminator.kind === "goto") edge(terminator.target, state);
      else if (terminator.kind === "invoke" || terminator.kind === "check" || terminator.kind === "throw" || terminator.kind === "unwind-propagate") {
        if ((terminator.kind === "invoke" || terminator.kind === "check") && !edge(terminator.next, state)) return outgoing;
        const propagating = terminator.kind === "unwind-propagate";
        const payload = () => terminator.kind === "throw" ? operandOrigins(input, constants, state.origins, terminator.operand, slots, fields)
          : propagating ? state.completion?.carried ?? bodyFrontier("A propagated unwind has its actual carried origins.") : originsId(0);
        const from = propagating ? withCompletion(state, { active: state.completion?.active ?? null, carried: null }) : state;
        if (terminator.unwind.kind === "carry") {
          carry(terminator.unwind.target, payload(), from);
          return outgoing;
        }
        if (terminator.unwind.kind !== "handler") return outgoing;
        const { exception, target } = terminator.unwind;
        if (exception === null) edge(target, from);
        else {
          if (chargeWork(account, state.origins.length + 1) !== null
            || chargeResultEntries(account, state.origins.length + 2) !== null) return outgoing;
          const local = rootSlot(input.mir, exception, slots);
          const written = [...state.origins];
          written[local] = payload();
          const contents = tracked.has(local) ? currentContent(deps, state.contents, local, true) : null;
          if (contents !== null && contents.kind !== "complete") return outgoing;
          edge(target, withValues(from, written, contents?.value ?? state.contents));
        }
      }
      else if (terminator.kind === "switch") {
        for (const target of terminator.targets) if (!edge(target.target, state)) return outgoing;
        edge(terminator.otherwise, state);
      } else if (terminator.kind === "call") {
        if (chargeWork(account, 1) !== null) return outgoing;
        const selected = selectedCallAt(calls, block);
        if (isLeastCall(selected)) return outgoing;
        if (isCallError(selected)) return bodyFrontier("A solved value call retains its already-completed semantic answer.");
        const unwind = selected.unwinds && (terminator.unwind.kind === "handler" || terminator.unwind.kind === "carry") ? terminator.unwind : null;
        if (!selected.returns && unwind === null) return outgoing;
        const destination = terminator.destination === null ? null : rootSlot(input.mir, terminator.destination, slots);
        const result = callValueEffects(deps, input, terminator, { block, statement: null }, selected,
          arena, state.origins, constants, terminator.callee.kind !== "body" ? [] : requirePresent(captures.get(block), { owner: "analyses/body", query: null,
            origin: terminator.origin, message: "A selected body call retains its actual slot-location inventory." }), staticCallees, objectValues);
        if (result.kind !== "complete") return outgoing;
        if (result.value.kind === "applied") {
          const returned = selected.returns && destination !== null ? chargeResultEntries(account, 1) : null;
          if (returned !== null) return outgoing;
          const boundary = transport?.forCall(terminator, selected) ?? noCallBoundary;
          if (typeof boundary !== "function") return outgoing;
          if (selected.returns) {
            const applied = applyExitContents(deps, terminator, result.value.value, cellSlots, "return", state, values, admit,
              destination === null ? null : { local: destination, tracked: tracked.has(destination) }, boundary);
            if (applied.kind !== "complete" || !edge(terminator.next, applied.value)) return outgoing;
          }
          if (unwind !== null) {
            const place = unwind.kind === "handler" ? unwind.exception : null;
            const descriptor = chargeResultEntries(account, place === null ? 0 : 1);
            if (descriptor !== null) return outgoing;
            const exception = place === null ? null : rootSlot(input.mir, place, slots);
            const applied = applyExitContents(deps, terminator, result.value.value, cellSlots, "unwind", state, values, admit,
              exception === null ? null : { local: exception, tracked: tracked.has(exception) }, boundary);
            if (applied.kind !== "complete") return outgoing;
            if (unwind.kind === "carry") {
              const origins = appliedOrigins(deps, values, result.value.value.thrown, admit, boundary);
              if (typeof origins === "number") carry(unwind.target, origins, applied.value);
            } else edge(unwind.target, applied.value);
          }
          return outgoing;
        }
        if (unwind !== null) {
          const locals = requirePresent(result.value.unwound ?? undefined, { owner: "analyses/body", query: null, origin: terminator.origin,
            message: "A primitive handled call retains its actual unwind contents." });
          const contents = mergeContents(deps, state.contents, locals, null);
          if (contents.kind !== "complete" || chargeResultEntries(account, 1) !== null) return outgoing;
          const incoming = withValues(state, state.origins, contents.value);
          if (!(unwind.kind === "carry" ? carry(unwind.target, originsId(0), incoming) : edge(unwind.target, incoming))) return outgoing;
        }
        if (!selected.returns) return outgoing;
        let next = state;
        let writtenLocal: number | null = null;
        if (destination !== null) {
          if (chargeWork(account, state.origins.length + 1) !== null || chargeResultEntries(account, state.origins.length + 1) !== null) return outgoing;
          const produced = requirePresent(initial[destination], { owner: "analyses/body", query: null, origin: terminator.origin,
            message: "A primitive call retains its actual initial destination Origins." });
          const written = [...state.origins];
          written[destination] = produced;
          writtenLocal = tracked.has(destination) ? destination : null;
          next = withValues(state, written, state.contents);
        }
        const contents = mergeContents(deps, next.contents, result.value.contents, writtenLocal);
        if (contents.kind !== "complete") return outgoing;
        if (chargeResultEntries(account, 1) !== null) return outgoing;
        next = withValues(next, next.origins, contents.value);
        edge(terminator.next, next);
      }
      return outgoing;
    },
  };
}

export function solveValueOrigins(deps: BodyRoundDeps, input: BodyRoundInput, arena: RelationalArena,
  values: ValueOrigins, constants: readonly OriginsId[], initial: readonly OriginsId[], boundary: readonly OriginsId[],
  reachable: readonly boolean[], admit: AdmitOrigins,
  captures: ReadonlyMap<BlockId, readonly CallCaptureTransport[]>, cells: readonly number[], calls: ReadonlyMap<BlockId, SelectedCall> | null,
  slots: StorageSlots, staticCallees: StaticCalleeCells | null, fields: HeldProjections | null, objectValues: ReadonlySet<LocalId> | null,
  transport: OpenCallTransport | null): DataflowResult<FlowSolution<ValueState>> {
  const work = chargeWork(deps.account, 1 + cells.length) ?? chargeResultEntries(deps.account, 4 + cells.length);
  if (work !== null) return work;
  const tracked = new Set(cells);
  const problem = valueProblem(deps, input, arena, values, constants, initial, { origins: boundary, contents: new Set() },
    reachable, admit, captures, tracked, calls, transport, slots, staticCallees, cells, fields, objectValues);
  return solve(input.mir, input.execution.provided, problem, deps.account);
}
