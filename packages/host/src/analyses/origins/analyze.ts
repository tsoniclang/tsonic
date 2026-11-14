// The private kernel entry of the Origins domain (unit O-1a, the call-free values family; low/COMPONENTS.md section 10,
// rows 1427 and 1496). Not exported from the component and named by no wiring member (R5 BA-2): its one production
// caller will be the body round (`analyzeBodyRound`, S2-24) once every round family is real. Its records are private
// (R5 BA-3); when the position keys land in the Facts record (O-1b) the kernel produces `OriginsResult` and these
// records go away.
import type { Diagnostic, InvariantFailure, Result } from "../../diag/contract.js";
import { requirePresent, resourceLimitDiagnostic } from "../../diag/index.js";
import type { DataflowLimits } from "../../dataflow/contract.js";
import { solve } from "../../dataflow/index.js";
import type { BodyId, Origin } from "../../ids/contract.js";
import type { ArtifactBindings, BindingVector, TypeOf } from "../../ir-types/contract.js";
import type { MirBody, MirLocal } from "../../ir-mir/contract.js";
import type { AnalysisLimits, PointPlaceOrigins, RelationalArena, SubjectOriginsFact } from "../../ir-facts/contract.js";
import { closeArena } from "./arena.js";
import { frontier } from "./keys.js";
import type { Kernel, State, Value } from "./state.js";
import { entryValue, originsProblem, readOperand, readPlace, requirePlace, transferStatement } from "./state.js";

// An execution: a body instance with complete bindings and an entry, named by its count of supplied fixed arguments
// (the key of `dataflow.solve`). It is replaced by W2's common execution record when that exists (R5 BA-1).
export interface OriginsExecution {
  readonly body: BodyId;
  readonly bindings: ArtifactBindings;
  readonly provided: number;
}

export interface OriginsInput {
  // A lowered body the MIR verifier accepted (S2-18). Origins never repairs a body.
  readonly mir: MirBody;
  readonly provided: number;
  // The completed type table's reader: it decides which values refer to no storage (C1).
  readonly typeOf: TypeOf;
  readonly limits: AnalysisLimits;
  readonly flow: DataflowLimits;
}

export interface OriginsValues {
  readonly execution: OriginsExecution;
  readonly arena: RelationalArena;
  readonly points: readonly PointPlaceOrigins[];
  readonly subjects: readonly SubjectOriginsFact[];
}

// The solver's resource dimension as the limit it names. The kernel's lattice never overflows, so "state" is listed only to
// keep the mapping total.
const solverLimit = (dimension: "work" | "result-entries" | "state"): string =>
  ({ "work": "dataflow.maximumWork", "result-entries": "dataflow.maximumResultEntries", "state": "dataflow.stateBound" })[dimension];

const noBindings = (): BindingVector => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });

const unsolvedBlock = (): InvariantFailure => ({ owner: "analyses/origins", query: null, origin: null, message: "origins: a reachable block has no solved entry" });

type Row =
  | { readonly kind: "point"; readonly row: Omit<PointPlaceOrigins, "origins">; readonly value: Value }
  | { readonly kind: "subject"; readonly row: Omit<SubjectOriginsFact, "origins">; readonly value: Value };

const refusal = (input: OriginsInput, limit: string, maximum: number, origin: Origin | null): Result<OriginsValues> => {
  const diagnostic: Diagnostic = resourceLimitDiagnostic({ owner: "analyses/origins", limit, maximum,
    site: origin === null ? { kind: "none" } : { kind: "source", origin },
    unit: { request: { query: "analyses/origins.values", key: [input.mir.body, input.provided] }, position: { kind: "result" } } });
  return { kind: "refused", diagnostics: [diagnostic] };
};

const contextOf = (kernel: Kernel, locals: readonly MirLocal[]): { readonly receiver: Value | null; readonly arguments: readonly Value[] } => {
  const receiver = locals.find(local => local.role.kind === "receiver");
  const parameters = locals.flatMap(local => local.role.kind === "parameter" ? [{ index: local.role.index, local }] : [])
    .sort((left, right) => left.index - right.index);
  parameters.forEach((parameter, position) => {
    if (parameter.index !== position) frontier(parameter.local.origin, `parameter ${position} has no local`);
  });
  return { receiver: receiver === undefined ? null : entryValue(kernel, receiver), arguments: parameters.map(parameter => entryValue(kernel, parameter.local)) };
};

export function analyzeOriginsValues(input: OriginsInput): Result<OriginsValues> {
  const { mir } = input;
  // The execution's entry must be one the body offers (K-3367 D); naming another is a caller defect.
  if (!mir.entries.some(entry => entry.provided === input.provided)) {
    return frontier(null, `caller defect: the body offers no entry for ${input.provided} supplied arguments`);
  }
  const kernel: Kernel = {
    locals: new Map(mir.locals.map(local => [local.id, local])),
    places: new Map(mir.places.map(place => [place.id, place])),
    constants: new Map(mir.constants.map(constant => [constant.id, constant])),
    typeOf: input.typeOf,
    charges: { maximumAlternatives: input.limits.maximumOriginAlternatives, maximumDepth: input.limits.maximumProjectionDepth,
      maximumRecords: input.limits.maximumRelationalRecordsPerBody },
    specs: [], numbers: new Map<string, number>(), exhaustion: null,
  };
  const context = contextOf(kernel, mir.locals);
  const solved = solve(mir, input.provided, originsProblem(kernel, input.limits.maximumRelationalRecordsPerBody), input.flow);
  if (solved.kind === "resource-limit") {
    return refusal(input, solverLimit(solved.dimension), solved.maximum, null);
  }
  const rows: Row[] = [];
  mir.blocks.forEach((block, index) => {
    if (solved.value.reachable[index] !== true) return;
    let state: State = requirePresent(solved.value.entry[index], unsolvedBlock());
    block.statements.forEach((statement, position) => {
      if (statement.kind === "assign") {
        const destination = requirePlace(kernel, statement.place);
        // A store into a cell under a value (not a refined view, which is its parent's own cell) has a row for its base.
        if ((destination.base.kind === "place" || destination.base.kind === "checked") && destination.base.projection.kind !== "refined") {
          const base = requirePlace(kernel, destination.base.place);
          rows.push({ kind: "point", row: { point: { block: block.id, statement: position }, place: base.id }, value: readPlace(kernel, state, base) });
        }
      }
      state = transferStatement(kernel, statement, state);
    });
    const terminator = block.terminator;
    if (terminator.kind === "return" && terminator.value !== null) {
      const value = readOperand(kernel, state, terminator.value, terminator.origin);
      rows.push({ kind: "subject", row: { node: terminator.tir.node, role: "return", path: null }, value });
    }
  });
  if (kernel.exhaustion !== null) return refusal(input, kernel.exhaustion.limit, kernel.exhaustion.maximum, kernel.exhaustion.origin);
  // A parametric body: its producers carry the empty vector, exact for a body with no binders. A generic template has
  // binders and is not an execution of complete bindings; which vector its producers carry is open with W2's common
  // execution record (R5 BA-1, K-3367 D). Facts verification judges the vector against the definition's binders.
  const bindings = mir.bindings.kind === "instantiated" ? mir.bindings.bindings : noBindings();
  const closed = closeArena(mir.body, kernel.specs, bindings, context, rows.map(row => row.value),
    { maximumRecords: input.limits.maximumRelationalRecordsPerBody, maximumReferences: input.limits.maximumRelationalReferencesPerBody });
  if (closed.kind === "over") return refusal(input, closed.limit, closed.maximum, null);
  const points: PointPlaceOrigins[] = [];
  const subjects: SubjectOriginsFact[] = [];
  for (const row of rows) {
    if (row.kind === "point") points.push({ ...row.row, origins: closed.originsOf(row.value) });
    else subjects.push({ ...row.row, origins: closed.originsOf(row.value) });
  }
  return { kind: "ok", value: { execution: { body: mir.body, bindings: mir.bindings, provided: input.provided }, arena: closed.arena, points, subjects },
    diagnostics: [] };
}
