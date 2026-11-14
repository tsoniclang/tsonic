import type { Result } from "../../diag/contract.js";
import type { DataflowAccount } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, createAccount, solve } from "../../dataflow/index.js";
import type { CaptureFact, LivenessFacts, LiveSegment, StoreLiveness } from "../../ir-facts/contract.js";
import type { BlockId } from "../../ids/contract.js";
import type { Execution } from "../../ir-types/contract.js";
import { sameInstance } from "../../ir-types/index.js";
import type { MirClosureCapture, MirTerminator } from "../../ir-mir/contract.js";
import { localOwnershipOfMir } from "../../ir-mir/index.js";
import type { StorageUseInput } from "./contract.js";
import type { Analysis, Bits, Edge } from "./model.js";
import { captureByLocation, defect, required, refusalOf, emptyBits, hasBit, lattice, placeFactsOf, placeOf, statementReads,
  setBit, statementBefore, stopped, terminatorBefore, terminatorShape, work } from "./model.js";

function stoppedResult(input: StorageUseInput, account: DataflowAccount): Result<LivenessFacts> {
  return refusalOf(input.execution, required(accountFailure(account), "a failed operation has no invocation stop"));
}
function instanceWork(account: DataflowAccount, execution: Execution): boolean {
  const instance = execution.instance;
  if (chargeWork(account, 8 * (1 + instance.body.length)) !== null) return false;
  if (instance.bindings.kind !== "instantiated") return defect("an execution requires complete bindings, not a template");
  const bindings = instance.bindings.bindings;
  for (const rows of [bindings.classBindings, bindings.methodBindings, bindings.capturedBindings]) {
    if (chargeWork(account, 8 * rows.length) !== null) return false;
    for (const row of rows) if (chargeWork(account, 1 + row.parameter.owner.length) !== null) return false;
  }
  if (chargeWork(account, 8 * bindings.selfBindings.length) !== null) return false;
  for (const row of bindings.selfBindings) if (chargeWork(account, 1 + row.owner.length) !== null) return false;
  return true;
}
function handOut(analysis: Analysis, place: number, flags: boolean[]): void {
  if (!work(analysis)) return;
  const facts = placeOf(analysis, place);
  if (facts.root !== null && !facts.throughDeref) flags[facts.root] = true;
}
function escapesOf(analysis: Analysis, addressTaken: boolean[], captured: boolean[]): void {
  const sources = new Map<string, Map<number, number[]>>();
  for (const local of analysis.body.locals) {
    if (!work(analysis)) return;
    if (local.source === null) continue;
    let rows = sources.get(local.source.body);
    if (rows === undefined) { rows = new Map(); sources.set(local.source.body, rows); }
    let targets = rows.get(local.source.local);
    if (targets === undefined) { targets = []; rows.set(local.source.local, targets); }
    targets.push(local.id);
  }
  const captures = (list: readonly MirClosureCapture[]): void => {
    for (const capture of list) {
      if (!work(analysis)) return;
      const location = captureByLocation(capture);
      handOut(analysis, capture.place, captured);
      if (stopped(analysis)) return;
      const root = placeOf(analysis, capture.place);
      if (location && root.root !== null && !root.throughDeref && !setBit(analysis, analysis.escaped, root.root)) return;
      for (const local of sources.get(capture.local.body)?.get(capture.local.local) ?? []) {
        if (!work(analysis)) return;
        captured[local] = true;
        if (location && !setBit(analysis, analysis.escaped, local)) return;
      }
    }
  };
  for (const block of analysis.body.blocks) {
    if (!work(analysis)) return;
    for (const statement of block.statements) {
      if (!work(analysis)) return;
      if (statement.kind !== "assign") continue;
      if (statement.value.kind === "address-of") handOut(analysis, statement.value.place, addressTaken);
      else if (statement.value.kind === "closure") captures(statement.value.captures);
      if (stopped(analysis)) return;
    }
    const terminator = block.terminator;
    if (terminator.kind === "call") {
      for (const row of terminator.arguments) {
        if (!work(analysis)) return;
        if (row.kind === "place") handOut(analysis, row.place, addressTaken);
        if (stopped(analysis)) return;
      }
      if (terminator.callee.kind === "body") captures(terminator.callee.captures);
      if (stopped(analysis)) return;
    }
  }
}
function observed(analysis: Analysis, place: number, after: Bits): boolean {
  const facts = placeOf(analysis, place);
  return facts.root === null || facts.throughDeref || hasBit(analysis.escaped, facts.root) || hasBit(after, facts.root);
}
function captureWrite(analysis: Analysis, place: number, flags: boolean[]): void {
  const facts = placeOf(analysis, place);
  if (facts.whole && facts.root !== null && !facts.throughDeref && analysis.body.locals[facts.root]?.role.kind === "capture")
    flags[facts.root] = true;
}
function captureReads(analysis: Analysis, bits: Bits, flags: boolean[]): boolean {
  if (!work(analysis, bits.length)) return false;
  for (let word = 0; word < bits.length; word += 1) {
    let remaining = required(bits[word], "a read-footprint word is missing") >>> 0;
    while (remaining !== 0) {
      if (!work(analysis)) return false;
      const bit = 31 - Math.clz32(remaining & -remaining);
      const local = required(analysis.body.locals[word * 32 + bit], "a read-footprint local is missing");
      remaining = (remaining & (remaining - 1)) >>> 0;
      if (local.role.kind === "capture") flags[local.id] = true;
    }
  }
  return true;
}
function resultRow(analysis: Analysis, units = 1): boolean {
  return work(analysis, units) && chargeResultEntries(analysis.account, units) === null;
}
function reverseRows<Value>(analysis: Analysis, rows: Value[], first: number): boolean {
  if (!work(analysis, rows.length - first)) return false;
  for (let left = first, right = rows.length - 1; left < right; left += 1, right -= 1) {
    const value = required(rows[left], "a reverse row is missing");
    rows[left] = required(rows[right], "a reverse row is missing");
    rows[right] = value;
  }
  return true;
}
function storeEdges(analysis: Analysis, terminator: MirTerminator, edges: readonly Edge[], entryOf: (target: BlockId) => Bits,
  block: BlockId, stores: StoreLiveness[], writes: boolean[]): boolean {
  for (const edge of edges) {
    if (!work(analysis)) return false;
    if (edge.writes === null) continue;
    if (!resultRow(analysis)) return false;
    stores.push({ node: terminator.tir.node, point: { block, statement: null }, edge: edge.role,
      observed: observed(analysis, edge.writes, entryOf(edge.target)) });
    captureWrite(analysis, edge.writes, writes);
  }
  if (terminator.kind === "call") for (const row of terminator.arguments) {
    if (!work(analysis)) return false;
    if (row.kind === "place" && row.passing !== "byref-readonly" && row.passing !== "borrow-shared")
      captureWrite(analysis, row.place, writes);
  }
  return true;
}
function scanBlock(analysis: Analysis, blockIndex: number, entryOf: (target: BlockId) => Bits, segments: LiveSegment[][],
  stores: StoreLiveness[], reads: boolean[], writes: boolean[]): boolean {
  const block = required(analysis.body.blocks[blockIndex], "a replay block is missing");
  let current = terminatorBefore(analysis, block.terminator, entryOf);
  if (stopped(analysis) || !work(analysis, analysis.body.locals.length)) return false;
  const ends = new Int32Array(analysis.body.locals.length).fill(-1);
  const firstSegments = new Map<number, number>();
  const position = (before: Bits, after: Bits, point: number): boolean => {
    if (!work(analysis, analysis.words)) return false;
    for (let word = 0; word < analysis.words; word += 1) {
      let changed = (required(before[word], "a before word is missing") ^ required(after[word], "an after word is missing")) >>> 0;
      while (changed !== 0) {
        if (!work(analysis)) return false;
        const bit = 31 - Math.clz32(changed & -changed);
        const local = word * 32 + bit;
        changed = (changed & (changed - 1)) >>> 0;
        if (hasBit(before, local)) ends[local] = point;
        else {
          if (!resultRow(analysis)) return false;
          const list = required(segments[local], "a segment local is missing");
          if (!firstSegments.has(local)) firstSegments.set(local, list.length);
          list.push({ block: block.id, first: point + 1, last: required(ends[local], "a live interval end is missing") });
          ends[local] = -1;
        }
      }
    }
    return true;
  };
  if (!position(current, analysis.zero, block.statements.length)) return false;
  const firstStore = stores.length;
  for (let index = block.statements.length - 1; index >= 0; index -= 1) {
    if (!work(analysis)) return false;
    const statement = required(block.statements[index], "a replay statement is missing");
    const used = emptyBits(analysis);
    if (stopped(analysis)) return false;
    if (statement.kind === "assign") {
      if (!resultRow(analysis)) return false;
      stores.push({ node: statement.tir.node, point: { block: block.id, statement: index }, edge: null,
        observed: observed(analysis, statement.place, current) });
      captureWrite(analysis, statement.place, writes);
    }
    if (!statementReads(analysis, statement, used) || !captureReads(analysis, used, reads)) return false;
    const before = statementBefore(analysis, statement, current, used);
    if (stopped(analysis) || !position(before, current, index)) return false;
    current = before;
  }
  if (!position(analysis.zero, current, -1)) return false;
  for (const [local, start] of firstSegments) {
    if (!work(analysis)) return false;
    if (!reverseRows(analysis, required(segments[local], "a segment local is missing"), start)) return false;
  }
  if (!reverseRows(analysis, stores, firstStore)) return false;
  const uses = emptyBits(analysis);
  if (stopped(analysis)) return false;
  const edges = terminatorShape(analysis, block.terminator, uses);
  return !stopped(analysis) && captureReads(analysis, uses, reads) && storeEdges(analysis, block.terminator, edges, entryOf, block.id, stores, writes);
}
function orderCaptures(analysis: Analysis, rows: readonly CaptureFact[]): readonly CaptureFact[] {
  if (!work(analysis, rows.length)) return rows;
  let current = [...rows];
  let buffer: CaptureFact[] = [];
  for (let width = 1; width < current.length; width *= 2) {
    if (!work(analysis, current.length)) return current;
    buffer.length = 0;
    for (let start = 0; start < current.length; start += 2 * width) {
      let left = start, right = Math.min(start + width, current.length);
      const middle = right, end = Math.min(start + 2 * width, current.length);
      while (left < middle || right < end) {
        const first = current[left], second = current[right];
        let chooseLeft = right === end;
        if (!chooseLeft && left < middle) {
          const leftRow = required(first, "a sorted capture is missing");
          const rightRow = required(second, "a sorted capture is missing");
          if (!work(analysis, 1 + Math.min(leftRow.local.body.length, rightRow.local.body.length))) return current;
          chooseLeft = leftRow.local.body < rightRow.local.body || leftRow.local.body === rightRow.local.body && leftRow.local.local <= rightRow.local.local;
        }
        const row = required(current[chooseLeft ? left++ : right++], "a sorted capture is missing");
        buffer.push(row);
      }
    }
    const previous = current; current = buffer; buffer = previous;
  }
  return current;
}
export function analyzeBodyStorageUse(input: StorageUseInput): Result<LivenessFacts> {
  const { body, execution, limits } = input;
  const account = createAccount(limits);
  if (!instanceWork(account, execution)
    || !instanceWork(account, { instance: { body: body.body, bindings: body.bindings }, provided: execution.provided }))
    return stoppedResult(input, account);
  if (!sameInstance(execution.instance, { body: body.body, bindings: body.bindings })) return defect("the lowered body belongs to another execution");
  const words = Math.ceil(body.locals.length / 32);
  const setup = chargeWork(account, 1 + body.locals.length * 5 + words * 2);
  if (setup !== null) return refusalOf(execution, setup);
  const zero = new Uint32Array(words);
  const places = placeFactsOf(body, account);
  if (accountFailure(account) !== null) return stoppedResult(input, account);
  const addressTaken = body.locals.map(() => false), captured = body.locals.map(() => false);
  const analysis: Analysis = { body, places, words, zero, escaped: new Uint32Array(words), account };
  escapesOf(analysis, addressTaken, captured);
  if (stopped(analysis)) return stoppedResult(input, account);
  for (const local of body.locals) {
    if (!work(analysis)) return stoppedResult(input, account);
    const ownership = localOwnershipOfMir(local.mode);
    if (ownership === "undecided") return defect("a ready execution has an undecided local storage mode");
    if ((addressTaken[local.id] === true || ownership === "external") && !setBit(analysis, analysis.escaped, local.id))
      return stoppedResult(input, account);
  }
  const solution = solve(body, execution.provided, {
    direction: "backward", lattice: lattice(analysis), boundary: zero,
    statement: (statement, state) => {
      const uses = emptyBits(analysis);
      if (stopped(analysis) || !statementReads(analysis, statement, uses)) return state;
      return statementBefore(analysis, statement, state, uses);
    },
    terminator: (terminator, successors) => {
      if (!work(analysis, successors.length)) return zero;
      const entries = new Map(successors.map(row => [row.target, row.state]));
      return terminatorBefore(analysis, terminator, target => required(entries.get(target), "a terminator successor has no entry state"));
    },
  }, account);
  if (solution.kind !== "complete") return refusalOf(execution, solution);
  const entryOf = (target: BlockId): Bits => required(solution.value.entry[target], "an edge target is outside the body's block table");
  if (!work(analysis, body.locals.length * 3)) return stoppedResult(input, account);
  const segments: LiveSegment[][] = body.locals.map(() => []);
  const stores: StoreLiveness[] = [], reads = body.locals.map(() => false), writes = body.locals.map(() => false);
  for (const [index] of body.blocks.entries()) {
    if (!work(analysis)) return stoppedResult(input, account);
    if (solution.value.reachable[index] !== true) continue;
    if (!scanBlock(analysis, index, entryOf, segments, stores, reads, writes)) return stoppedResult(input, account);
  }
  const locals: LivenessFacts["locals"][number][] = [];
  const bindings: LivenessFacts["bindings"][number][] = [];
  const captures = new Map<string, Map<number, CaptureFact>>();
  for (const local of body.locals) {
    if (!work(analysis)) return stoppedResult(input, account);
    const list = required(segments[local.id], "a local's segments are missing");
    if (list.length !== 0) {
      if (!resultRow(analysis)) return stoppedResult(input, account);
      locals.push({ local: local.id, segments: list });
    }
    if (local.source !== null) {
      if (!resultRow(analysis)) return stoppedResult(input, account);
      bindings.push({ local: local.id, addressTaken: addressTaken[local.id] === true, captured: captured[local.id] === true });
    }
    if (local.role.kind === "capture") {
      const source = required(local.source, "a capture local has no qualified source");
      let bodyRows = captures.get(source.body);
      if (bodyRows === undefined) { bodyRows = new Map(); captures.set(source.body, bodyRows); }
      const old = bodyRows.get(source.local);
      if (old === undefined && !resultRow(analysis)) return stoppedResult(input, account);
      bodyRows.set(source.local, { local: source, reads: old?.reads === true || reads[local.id] === true,
        writes: old?.writes === true || writes[local.id] === true });
    }
  }
  const rows: CaptureFact[] = [];
  for (const bodyRows of captures.values()) for (const row of bodyRows.values()) {
    if (!work(analysis)) return stoppedResult(input, account);
    rows.push(row);
  }
  const ordered = orderCaptures(analysis, rows);
  if (stopped(analysis) || !work(analysis)) return stoppedResult(input, account);
  return { kind: "ok", value: { stores, locals, bindings, captures: ordered }, diagnostics: [] };
}
