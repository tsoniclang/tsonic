import type { DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import { encodeKey } from "../ids/index.js";
import { artifactBindingsData } from "../ir-types/index.js";
import type { Condition, ConditionLimits } from "./conditions-data.js";
import { andConditions, checkConditionLimits, conditionEquals, orConditions, substituteCondition, validateCondition } from "./conditions.js";
import type { StaticDeclarationKey, StaticInitializationCellOf, StaticInitializationOf } from "./contract.js";
import type { BoundInitializationCell, BoundInitializationRow, InitializationApplication, InitializationApplicationInput,
  StaticInitializationCell, StaticInitializationEffect, UnmetStaticNeed } from "./initialization-data.js";
import { admitArtifactIdentity } from "./verification.js";

interface PointRows {
  readonly cells: Map<number, number>;
  default: number;
}

interface PreparedApplication {
  readonly application: InitializationApplication;
  readonly groups: Map<number, PointRows>;
  readonly formals: Map<number, number[]>;
  readonly children: readonly InitializationApplication[];
  readonly targets: Set<number>;
  readonly cells: (number | null)[];
  readonly referenced: Set<number>;
  readonly values: Map<number | null, ReadonlyMap<number, Condition>>;
  readonly points: Map<number, Map<number | null, Condition>>;
}

const validIndex = (index: number, length: number): boolean =>
  Number.isSafeInteger(index) && index >= 0 && !Object.is(index, -0) && index < length;

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new TypeError("Initialization application requires its actual ready record");
  return value;
}

function grow(limits: ConditionLimits, entries = 1): DataflowStop | null {
  return chargeWork(limits.account, 1) ?? chargeResultEntries(limits.account, entries);
}

function prepare(application: InitializationApplication, input: InitializationApplicationInput,
  limits: ConditionLimits): DataflowResult<PreparedApplication> {
  const initial = grow(limits);
  if (initial !== null) return initial;
  const table = application.table;
  if (application.binding.cells.length !== table.cells.length || application.binding.events.length !== table.events.length)
    throw new TypeError("Initialization bindings are parallel to the actual cell and event inventories");
  const formals = new Map<number, number[]>();
  const targets = new Set<number>();
  const sources = new Set<number>();
  for (const [index, cell] of application.binding.cells.entries()) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    const source = required(table.cells[index]);
    if (!validIndex(source, application.arena.cells.length) || sources.has(source) || application.arena.cells[source]?.id !== source)
      throw new TypeError("Initialization formals reference distinct cells in their actual source arena");
    sources.add(source);
    if (cell.kind === "written") continue;
    if (cell.kind === "unproven") {
      const admission = chargeResultEntries(limits.account, 1);
      if (admission !== null) return admission;
      if (cell.indices.length === 0) throw new TypeError("An unproven cell retains its actual nonempty may-target inventory");
      const seen = new Set<number>();
      for (const index of cell.indices) {
        const targetStop = grow(limits);
        if (targetStop !== null) return targetStop;
        if (!validIndex(index, input.caller.cells.length) || input.caller.cells[index]?.id !== index || seen.has(index))
          throw new TypeError("Unproven cells retain distinct actual caller may-targets");
        seen.add(index);
        targets.add(index);
      }
      continue;
    }
    if (!validIndex(cell.index, input.caller.cells.length) || input.caller.cells[cell.index]?.id !== cell.index)
      throw new TypeError("Initialization cells retain an actual caller cell");
    const bindingStop = chargeResultEntries(limits.account, 1);
    if (bindingStop !== null) return bindingStop;
    targets.add(cell.index);
    let group = formals.get(cell.index);
    if (group === undefined) { group = []; formals.set(cell.index, group); }
    group.push(index);
  }
  const children: InitializationApplication[] = [];
  for (const event of application.binding.events) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    if (event.kind === "event") {
      if (!validIndex(event.index, input.events.length)) throw new TypeError("Initialization events retain an actual caller completion event");
    } else if (event.kind === "tables") {
      if (event.applied.length === 0) throw new TypeError("A completion binding requires its actual nonempty alternatives");
      for (const selected of event.applied) {
      const childStop = grow(limits);
      if (childStop !== null) return childStop;
      const point = required(selected.application.table.points[selected.point]);
      if (!validIndex(selected.point, selected.application.table.points.length) ||
        point.kind !== "return" && point.kind !== "unwind" && point.kind !== "completed")
        throw new TypeError("A nested initialization table selects an actual completion point");
      children.push(selected.application);
      }
    }
  }
  for (const condition of table.conditions) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    const checked = validateCondition(condition, table.events.length, limits);
    if (checked.kind !== "complete") return checked;
    if (!checked.value) throw new TypeError("Initialization requires canonical source completion conditions");
  }
  if (table.conditions[0]?.alternatives.length !== 0 || table.conditions[1]?.alternatives.length !== 1 ||
    table.conditions[1].alternatives[0]?.length !== 0)
    throw new TypeError("Initialization tables retain canonical false and true conditions");
  const groups = new Map<number, PointRows>();
  const referenced = new Set<number>();
  for (const row of table.rows) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    if (!validIndex(row.point, table.points.length) ||
      table.points[row.point] === undefined || !validIndex(row.condition, table.conditions.length) ||
      row.cell !== null && !validIndex(row.cell, table.cells.length))
      throw new TypeError("An initialization row selects actual point, cell and condition records");
    referenced.add(row.condition);
    let group = groups.get(row.point);
    if (group === undefined) { group = { cells: new Map(), default: -1 }; groups.set(row.point, group); }
    if (row.cell === null) {
      if (group.default >= 0)
        throw new TypeError("An initialization point has one actual default");
      group.default = row.condition;
    } else {
      if (group.cells.has(row.cell)) throw new TypeError("An initialization point has one row per formal cell");
      group.cells.set(row.cell, row.condition);
    }
  }
  for (const [index, point] of table.points.entries()) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    const rows = required(groups.get(index));
    if (rows.default < 0)
      throw new TypeError("Every initialization point retains its actual rows and default");
    const selected = required(point);
    if (selected.kind === "need" && !validIndex(selected.cell, table.cells.length))
      throw new TypeError("A read point selects its actual required source-cell formal");
  }
  return { kind: "complete", value: { application, groups, formals, children, targets, cells: [], referenced, values: new Map(), points: new Map() } };
}

export function applyInitialization(input: InitializationApplicationInput, limits: ConditionLimits): DataflowResult<readonly BoundInitializationRow[]> {
  const prior = accountFailure(limits.account);
  if (prior !== null) return prior;
  checkConditionLimits(limits);
  if (limits.eventCount !== input.events.length) throw new TypeError("Initialization conditions use the actual caller event inventory");
  const initial = grow(limits);
  if (initial !== null) return initial;
  const prepared = new Map<InitializationApplication, PreparedApplication>();
  const active = new Set<InitializationApplication>();
  const ordered: PreparedApplication[] = [];
  const pending: { readonly application: InitializationApplication; readonly exit: boolean }[] = [
    { application: input.application, exit: false },
  ];
  while (pending.length !== 0) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    const frame = required(pending.pop());
    if (frame.exit) {
      const value = required(prepared.get(frame.application));
      const growth = grow(limits);
      if (growth !== null) return growth;
      active.delete(frame.application); ordered.push(value);
    } else {
      if (active.has(frame.application)) throw new TypeError("Nested initialization applications are acyclic");
      if (prepared.has(frame.application)) continue;
      const checked = prepare(frame.application, input, limits);
      if (checked.kind !== "complete") return checked;
      const growth = grow(limits);
      if (growth !== null) return growth;
      prepared.set(frame.application, checked.value); active.add(frame.application);
      pending.push({ application: frame.application, exit: true });
      for (let index = checked.value.children.length - 1; index >= 0; index -= 1) {
        const childStop = grow(limits);
        if (childStop !== null) return childStop;
        const application = required(checked.value.children[index]);
        pending.push({ application, exit: false });
      }
    }
  }
  for (const current of ordered) {
    for (const application of current.children) {
      const childStop = chargeWork(limits.account, 1);
      if (childStop !== null) return childStop;
      const child = required(prepared.get(application));
      for (const cell of child.targets) {
        const memberStop = chargeWork(limits.account, 1);
        if (memberStop !== null) return memberStop;
        if (!current.targets.has(cell)) {
          const growth = chargeResultEntries(limits.account, 1);
          if (growth !== null) return growth;
          current.targets.add(cell);
        }
      }
    }
    const targetStop = grow(limits, current.targets.size + 1);
    if (targetStop !== null) return targetStop;
    current.cells.push(null);
    for (const cell of current.targets) {
      const stop = chargeWork(limits.account, 1);
      if (stop !== null) return stop;
      current.cells.push(cell);
    }
    for (const cell of current.cells) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    const events: Condition[] = [];
    for (const event of current.application.binding.events) {
      const eventStop = grow(limits);
      if (eventStop !== null) return eventStop;
      let value: Condition;
      if (event.kind === "never") value = { alternatives: [] };
      else if (event.kind === "event") value = { alternatives: [[event.index]] };
      else {
        value = { alternatives: [[]] };
        for (const selected of event.applied) {
          const childStop = chargeWork(limits.account, 1);
          if (childStop !== null) return childStop;
          const values = required(required(prepared.get(selected.application)).points.get(selected.point));
          const child = required(values.get(cell) ?? values.get(null));
          const combined = andConditions(value, child, limits);
          if (combined.kind !== "complete") return combined;
          value = combined.value;
        }
      }
      events.push(value);
    }
    const conditions = new Map<number, Condition>();
    for (const index of current.referenced) {
      const conditionStop = grow(limits);
      if (conditionStop !== null) return conditionStop;
      const condition = required(current.application.table.conditions[index]);
      const transformed = substituteCondition(condition, events, limits);
      if (transformed.kind !== "complete") return transformed;
      conditions.set(index, transformed.value);
    }
    current.values.set(cell, conditions);
    for (const [point, rows] of current.groups) {
      const pointStop = grow(limits);
      if (pointStop !== null) return pointStop;
      const otherwise = required(conditions.get(rows.default));
      const formals = cell === null ? undefined : current.formals.get(cell);
      let value: Condition = formals === undefined ? otherwise : { alternatives: [] };
      if (formals !== undefined) for (const formal of formals) {
        const formalStop = chargeWork(limits.account, 1);
        if (formalStop !== null) return formalStop;
        const selected = rows.cells.get(formal);
        let condition = required(conditions.get(selected ?? rows.default));
        if (selected === undefined) {
          const source = required(current.application.table.cells[formal]);
          const location = required(current.application.arena.cells[source]).role;
          if (location.kind === "created" && location.anchor.kind === "result") {
            const completion = required(current.application.table.points[point]);
            if (completion.kind === "return" || completion.kind === "unwind" || completion.kind === "completed")
              condition = required(current.application.table.conditions[1]);
          }
        }
        const combined = orConditions(value, condition, limits);
        if (combined.kind !== "complete") return combined;
        value = combined.value;
      }
      let values = current.points.get(point);
      if (values === undefined) { values = new Map(); current.points.set(point, values); }
      values.set(cell, value);
    }
    }
  }
  const root = required(prepared.get(input.application));
  const result: BoundInitializationRow[] = [];
  for (const [pointIndex, point] of input.application.table.points.entries()) {
    const pointStop = chargeWork(limits.account, 1);
    if (pointStop !== null) return pointStop;
    const rows = required(root.groups.get(pointIndex));
    if (point.kind === "need") {
      const rowStop = grow(limits);
      if (rowStop !== null) return rowStop;
      const cell = required(input.application.binding.cells[point.cell]);
      const condition = cell.kind === "written" ? { alternatives: [[]] }
        : cell.kind === "unproven" ? required(required(root.values.get(null)).get(rows.cells.get(point.cell) ?? rows.default))
          : required(required(root.points.get(pointIndex)).get(cell.index));
      result.push({ point, cell, condition });
    } else {
      const values = required(root.points.get(pointIndex));
      const otherwise = required(values.get(null));
      for (const cell of root.cells) {
        const rowStop = chargeWork(limits.account, 1);
        if (rowStop !== null) return rowStop;
        const condition = required(values.get(cell));
        if (cell !== null) {
          const equal = conditionEquals(condition, otherwise, limits);
          if (equal.kind !== "complete") return equal;
          if (equal.value) continue;
        }
        const growth = chargeResultEntries(limits.account, 1);
        if (growth !== null) return growth;
        result.push({ point, cell: cell === null ? null : { kind: "cell", index: cell }, condition });
      }
    }
  }
  return { kind: "complete", value: result };
}

export const staticDeclarationKey: StaticDeclarationKey = (declaration, account) => {
  const identity = chargeWork(account, 1) ?? chargeWork(account, declaration.definition.length) ?? admitArtifactIdentity(declaration.bindings, account)
    ?? chargeResultEntries(account, 1);
  return identity ?? { kind: "complete", value: encodeKey([declaration.definition, artifactBindingsData(declaration.bindings)]) };
};

export const staticInitializationCellOf: StaticInitializationCellOf = (summary, position, account) => {
  const read = chargeWork(account, 1);
  if (read !== null) return read;
  const row = summary.arena.cells[position];
  if (row === undefined || !Object.is(row.id, position) || row.role.kind !== "static" || row.occurrence.kind !== "declared"
    || row.occurrence.at.kind !== "node")
    return { kind: "complete", value: null };
  const declaration = row.role.declaration;
  const key = staticDeclarationKey(declaration, account);
  if (key.kind !== "complete") return key;
  const identity = chargeResultEntries(account, 3);
  return identity ?? { kind: "complete", value: { declaration, key: key.value, source: row.occurrence.at.node } };
};

export const staticInitializationOf: StaticInitializationOf = (summary, writtenOnEntry, limits) => {
  const { account } = limits;
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
  if (initial !== null) return initial;
  const table = summary.initialization;
  const unbound: DataflowResult<StaticInitializationEffect> = { kind: "complete", value: { kind: "unbound" } };
  if (table.events.length !== 0 || summary.callbacks.length !== 0 || limits.eventCount !== 0) return unbound;
  if (table.cells.length === 0) {
    for (let index = 0; index < table.points.length; index += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const point = table.points[index];
      if (point?.kind !== "return" && point?.kind !== "unwind") return unbound;
    }
    return { kind: "complete", value: { kind: "bound", writes: [], unmet: [] } };
  }
  const cells: BoundInitializationCell[] = [];
  const sources = new Map<number, StaticInitializationCell>();
  for (let index = 0; index < table.cells.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const position = table.cells[index];
    if (position === undefined || sources.has(position)) return unbound;
    const selected = staticInitializationCellOf(summary, position, account);
    if (selected.kind !== "complete") return selected;
    if (selected.value === null) return unbound;
    const growth = chargeResultEntries(account, 2);
    if (growth !== null) return growth;
    cells.push({ kind: "cell", index: position });
    sources.set(position, selected.value);
  }
  const bound = applyInitialization({ caller: summary.arena, events: [],
    application: { owner: { kind: "summary", key: summary.key }, arena: summary.arena, table, binding: { cells, events: [] } } }, limits);
  if (bound.kind !== "complete") return bound;
  const writes: string[] = [];
  const unmet: UnmetStaticNeed[] = [];
  const unmetKeys = new Set<string>();
  for (let index = 0; index < bound.value.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const row = required(bound.value[index]);
    if (row.point.kind === "before" || row.point.kind === "completed") return unbound;
    if (row.point.kind === "unwind") continue;
    const proved = row.condition.alternatives.length !== 0;
    if (row.cell?.kind !== "cell") {
      if (proved) return unbound;
      continue;
    }
    const source = required(sources.get(row.cell.index));
    if (row.point.kind === "need" && !proved) {
      const lookup = chargeWork(account, source.key.length);
      if (lookup !== null) return lookup;
      const alreadyWritten = writtenOnEntry(source.key);
      const lookupStop = accountFailure(account);
      if (lookupStop !== null) return lookupStop;
      if (alreadyWritten || unmetKeys.has(source.key)) continue;
      const emit = chargeResultEntries(account, 3);
      if (emit !== null) return emit;
      unmetKeys.add(source.key);
      unmet.push({ declaration: source.declaration, at: row.point.at, witness: row.point.witness });
    } else if (row.point.kind === "return" && proved) {
      if (!summary.returns) return unbound;
      const emit = chargeResultEntries(account, 1);
      if (emit !== null) return emit;
      writes.push(source.key);
    }
  }
  return { kind: "complete", value: { kind: "bound", writes, unmet } };
};
