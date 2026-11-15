import type { DataflowAccount, DataflowResult, ForwardProblem, Lattice } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, solve } from "../../dataflow/index.js";
import { requirePresent, throwInvariant } from "../../diag/index.js";
import type { BlockId, LocalId } from "../../ids/contract.js";
import type { MirBody, MirOperand, MirStatement, MirTerminator } from "../../ir-mir/contract.js";

export type Assigned = ReadonlySet<LocalId> | null;

export function bodyFrontier(message: string): never {
  return throwInvariant({ owner: "analyses/initialization", query: null, origin: null, message });
}

export function assignedEntry(entries: readonly Assigned[], block: BlockId): ReadonlySet<LocalId> {
  return entries[block] ?? bodyFrontier("A reached block has its actual solved initialization entry.");
}

export function readLocal(body: MirBody, operand: Extract<MirOperand, { readonly kind: "place" }>): LocalId;
export function readLocal(body: MirBody, operand: MirOperand): LocalId | null;
export function readLocal(body: MirBody, operand: MirOperand): LocalId | null {
  if (operand.kind === "constant") return null;
  const place = requirePresent(body.places[operand.place], { owner: "analyses/initialization", query: null,
    origin: null, message: "A verified operand retains its actual place." });
  if (place.base.kind !== "local") return bodyFrontier("BodyAnalysis needs the actual selected logical-cell relation for this place.");
  return place.base.local;
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
    case "switch": return [terminator.operand];
    case "goto": case "unreachable": return [];
    default: return bodyFrontier("BodyAnalysis needs the selected call, failure or suspension transport for this terminator.");
  }
}

export function transferAssigned(body: MirBody, statement: MirStatement, state: ReadonlySet<LocalId>,
  account: DataflowAccount): ReadonlySet<LocalId>;
export function transferAssigned(body: MirBody, statement: MirStatement, state: Assigned,
  account: DataflowAccount): Assigned;
export function transferAssigned(body: MirBody, statement: MirStatement, state: Assigned,
  account: DataflowAccount): Assigned {
  if (state === null || accountFailure(account) !== null) return state;
  if (chargeWork(account, 1 + state.size) !== null || chargeResultEntries(account, state.size + 1) !== null) return state;
  const next = new Set(state);
  if (statement.kind === "assign") {
    const place = body.places[statement.place];
    if (place?.base.kind !== "local") return bodyFrontier("A selected assignment requires its actual logical-cell binding.");
    next.add(place.base.local);
  } else next.delete(statement.local);
  return next;
}

export function assignedLattice(stateBound: number): Lattice<Assigned> {
  return {
    bottom: null, overflow: null, stateBound,
    isOverflow: () => false,
    equals: (left, right, borrowed) => {
      if (left === right) return true;
      if (left === null || right === null || left.size !== right.size) return false;
      if (chargeWork(borrowed, left.size) !== null) return true;
      for (const local of left) if (!right.has(local)) return false;
      return true;
    },
    join: (left, right, borrowed) => {
      if (left === null) return right;
      if (right === null || left === right) return left;
      if (chargeWork(borrowed, left.size) !== null || chargeResultEntries(borrowed, left.size) !== null) return left;
      const common = new Set<LocalId>();
      for (const local of left) if (right.has(local)) common.add(local);
      return common;
    },
  };
}

export function solveAssigned(body: MirBody, provided: number, account: DataflowAccount):
  DataflowResult<{ readonly entry: readonly Assigned[]; readonly reachable: readonly boolean[] }> {
  const setup = chargeWork(account, 1 + body.locals.length) ?? chargeResultEntries(account, body.locals.length + 1);
  if (setup !== null) return setup;
  const boundary = new Set<LocalId>();
  for (const local of body.locals) {
    if (local.role.kind === "parameter" && local.role.index < provided
      || local.role.kind === "receiver" || local.role.kind === "capture") boundary.add(local.id);
  }
  const problem: ForwardProblem<Assigned> = {
    direction: "forward", boundary,
    lattice: assignedLattice(body.locals.length + 1),
    statement: (statement, state, borrowed) => transferAssigned(body, statement, state, borrowed),
    terminator: (terminator, state, borrowed) => {
      const count = terminator.kind === "switch" ? terminator.targets.length + 1 : terminator.kind === "goto" ? 1 : 0;
      if (chargeWork(borrowed, count) !== null || chargeResultEntries(borrowed, count) !== null) return [];
      if (terminator.kind === "goto") return [{ target: terminator.target, state }];
      if (terminator.kind === "switch") return [...terminator.targets.map(target => ({ target: target.target, state })),
        { target: terminator.otherwise, state }];
      terminatorOperands(terminator);
      return [];
    },
  };
  return solve(body, provided, problem, account);
}
