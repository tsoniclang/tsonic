// The private kernel entry of the Origins domain (unit O-1a, the call-free values family; low/COMPONENTS.md section 10,
// rows 1427 and 1496). Not exported from the component and named by no wiring member (R5 BA-2): its one production
// caller will be the body round (`analyzeBodyRound`, S2-24) once every round family is real. Its records are private
// (R5 BA-3); when the position keys land in the Facts record (O-1b) the kernel produces `OriginsResult` and these
// records go away.
import type { InvariantFailure, Result } from "../../diag/contract.js";
import { requirePresent } from "../../diag/index.js";
import type { DataflowAccount, DataflowStop, CallerRefusal } from "../../dataflow/contract.js";
import { accountFailure, chargeWork, solve } from "../../dataflow/index.js";
import type { Origin } from "../../ids/contract.js";
import type { Execution, TypeOf } from "../../ir-types/contract.js";
import { sameInstance } from "../../ir-types/index.js";
import type { MirBody, MirLocal } from "../../ir-mir/contract.js";
import type { AnalysisLimits, PointPlaceOrigins, RelationalArena, SubjectOriginsFact } from "../../ir-facts/contract.js";
import { closeArena } from "./arena.js";
import { bindingWork, frontier, requiredStop } from "./keys.js";
import type { Kernel, State, Value } from "./state.js";
import { entryValue, originRefusal, originsProblem, readOperand, readPlace, requirePlace, seal, takeOriginWork, transferStatement } from "./state.js";

export interface OriginsInput {
  // A lowered body the MIR verifier accepted (S2-18). Origins never repairs a body.
  readonly mir: MirBody;
  // The execution (COMMON-DATA section 1; K-3367 D): the body instance with complete bindings and the entry, named by
  // the count of supplied fixed arguments. The lowered body must be that instance's, and must offer that entry.
  readonly execution: Execution;
  // The completed type table's reader: it decides which values refer to no storage (C1).
  readonly typeOf: TypeOf;
  readonly limits: AnalysisLimits;
  readonly account: DataflowAccount;
}

export interface OriginsValues {
  readonly execution: Execution;
  readonly arena: RelationalArena;
  readonly points: readonly PointPlaceOrigins[];
  readonly subjects: readonly SubjectOriginsFact[];
}

// The solver's resource dimension as the limit it names. The kernel's lattice never overflows, so "state" is listed only to
// keep the mapping total.
const solverLimit = (dimension: "work" | "result-entries" | "state"): string =>
  ({ "work": "dataflow.maximumWork", "result-entries": "dataflow.maximumResultEntries", "state": "dataflow.stateBound" })[dimension];

const unsolvedBlock = (): InvariantFailure => ({ owner: "analyses/origins", query: null, origin: null, message: "origins: a reachable block has no solved entry" });

type Row =
  | { readonly kind: "point"; readonly row: Omit<PointPlaceOrigins, "origins">; readonly value: Value }
  | { readonly kind: "subject"; readonly row: Omit<SubjectOriginsFact, "origins">; readonly value: Value };

const refusal = (input: OriginsInput, limit: string, maximum: number, origin: Origin | null): CallerRefusal => {
  return originRefusal(input.execution, limit, maximum, origin);
};

const stopRefusal = (input: OriginsInput, failure: DataflowStop): CallerRefusal =>
  failure.kind === "refused" ? failure : refusal(input, solverLimit(failure.dimension), failure.maximum, null);

const kernelRefusal = (input: OriginsInput, kernel: Kernel): Result<OriginsValues> | null => {
  const failure = accountFailure(kernel.account);
  return failure === null ? null : stopRefusal(input, failure);
};

const contextOf = (kernel: Kernel, locals: readonly MirLocal[]): { readonly receiver: Value | null; readonly arguments: readonly Value[] } => {
  let receiver: Value | null = null;
  const arguments_: Value[] = [];
  const parameters = new Map<number, MirLocal>();
  for (const local of locals) {
    if (!takeOriginWork(kernel, 1)) break;
    if (local.role.kind === "receiver") receiver = entryValue(kernel, local);
    else if (local.role.kind === "parameter") parameters.set(local.role.index, local);
    if (accountFailure(kernel.account) !== null) break;
  }
  for (let position = 0; position < parameters.size; position += 1) {
    if (!takeOriginWork(kernel)) break;
    const local = parameters.get(position);
    if (local === undefined) return frontier(null, `parameter ${position} has no local`);
    const value = entryValue(kernel, local);
    if (accountFailure(kernel.account) !== null) break;
    arguments_.push(value);
  }
  return { receiver, arguments: arguments_ };
};

export function analyzeOriginsValues(input: OriginsInput): Result<OriginsValues> {
  const { mir, execution } = input;
  const account = input.account;
  const priorStop = accountFailure(account);
  if (priorStop !== null) return stopRefusal(input, priorStop);
  const setupStop = chargeWork(account, 1 + mir.locals.length + mir.places.length + mir.constants.length);
  if (setupStop !== null) return stopRefusal(input, setupStop);
  for (const instance of [execution.instance, { body: mir.body, bindings: mir.bindings }]) {
    const stop = chargeWork(account, 8 * (1 + instance.body.length));
    if (stop !== null) return stopRefusal(input, stop);
    if (instance.bindings.kind === "instantiated" && !bindingWork(account, instance.bindings.bindings)) {
      const failure = requiredStop(account);
      return stopRefusal(input, failure);
    }
  }
  // A lowered body of another instance, or an entry the body does not offer, is a caller defect (K-3367 D).
  if (!sameInstance(execution.instance, { body: mir.body, bindings: mir.bindings })) {
    return frontier(null, "caller defect: the lowered body is not the lowered body of the execution's instance");
  }
  let offered = false;
  for (const entry of mir.entries) {
    const stop = chargeWork(account, 1);
    if (stop !== null) return stopRefusal(input, stop);
    if (entry.provided === execution.provided) { offered = true; break; }
  }
  if (!offered) {
    return frontier(null, `caller defect: the body offers no entry for ${execution.provided} supplied arguments`);
  }
  // A template is not an execution of complete bindings. Which vector its producers would carry is not settled (the
  // template law), so it is refused by name, never stamped with a substituted empty vector (R6 O-4).
  if (mir.bindings.kind !== "instantiated") {
    return frontier(null, "a template body (parametric bindings) is not analysed; Origins analyses an execution of complete bindings");
  }
  const kernel: Kernel = {
    account, execution,
    locals: new Map(mir.locals.map(local => [local.id, local])),
    places: new Map(mir.places.map(place => [place.id, place])),
    constants: new Map(mir.constants.map(constant => [constant.id, constant])),
    typeOf: input.typeOf,
    charges: { maximumAlternatives: input.limits.maximumOriginAlternatives, maximumDepth: input.limits.maximumProjectionDepth },
    specs: [], numbers: new Map<string, number>(), indexChildren: new Map<number, number[]>(), stamp: 0,
  };
  const context = contextOf(kernel, mir.locals);
  const entryStop = kernelRefusal(input, kernel);
  if (entryStop !== null) return entryStop;
  const solved = solve(mir, execution.provided, originsProblem(kernel, input.limits.maximumRelationalRecordsPerBody), account);
  if (solved.kind === "refused") return solved;
  if (solved.kind === "resource-limit") {
    return refusal(input, solverLimit(solved.dimension), solved.maximum, null);
  }
  const rows: Row[] = [];
  for (const [index, block] of mir.blocks.entries()) {
    if (!takeOriginWork(kernel, 1)) return stopRefusal(input, requiredStop(account));
    if (solved.value.reachable[index] !== true) continue;
    seal(kernel);
    const sealStop = kernelRefusal(input, kernel);
    if (sealStop !== null) return sealStop;
    let state: State = requirePresent(solved.value.entry[index], unsolvedBlock());
    for (const [position, statement] of block.statements.entries()) {
      if (!takeOriginWork(kernel, 1)) return stopRefusal(input, requiredStop(account));
      if (statement.kind === "assign") {
        const destination = requirePlace(kernel, statement.place);
        // A store into a cell under a value (not a refined view, which is its parent's own cell) has a row for its base.
        if ((destination.base.kind === "place" || destination.base.kind === "checked") && destination.base.projection.kind !== "refined") {
          const base = requirePlace(kernel, destination.base.place);
          const value = readPlace(kernel, state, base);
          const stop = kernelRefusal(input, kernel);
          if (stop !== null) return stop;
          rows.push({ kind: "point", row: { point: { block: block.id, statement: position }, place: base.id }, value });
        }
      }
      state = transferStatement(kernel, statement, state);
      const stop = kernelRefusal(input, kernel);
      if (stop !== null) return stop;
    }
    const terminator = block.terminator;
    if (terminator.kind === "return" && terminator.value !== null) {
      const value = readOperand(kernel, state, terminator.value, terminator.origin);
      const returnStop = kernelRefusal(input, kernel);
      if (returnStop !== null) return returnStop;
      rows.push({ kind: "subject", row: { node: terminator.tir.node, role: "return", path: null }, value });
    }
  }
  if (!takeOriginWork(kernel, rows.length)) return stopRefusal(input, requiredStop(account));
  const closed = closeArena(execution, kernel.specs, context, rows.map(row => row.value),
    { maximumRecords: input.limits.maximumRelationalRecordsPerBody, maximumReferences: input.limits.maximumRelationalReferencesPerBody }, account);
  if (closed.kind === "refused") return closed;
  if (closed.kind === "resource-limit") return refusal(input, solverLimit(closed.dimension), closed.maximum, null);
  const points: PointPlaceOrigins[] = [];
  const subjects: SubjectOriginsFact[] = [];
  for (const row of rows) {
    const workStop = chargeWork(account, 1);
    if (workStop !== null) return stopRefusal(input, workStop);
    const origins = closed.originsOf(row.value);
    if (origins.kind !== "complete") return stopRefusal(input, origins);
    if (row.kind === "point") points.push({ ...row.row, origins: origins.value });
    else subjects.push({ ...row.row, origins: origins.value });
  }
  const publicationStop = chargeWork(account, 1);
  if (publicationStop !== null) return stopRefusal(input, publicationStop);
  return { kind: "ok", value: { execution, arena: closed.arena, points, subjects },
    diagnostics: [] };
}
