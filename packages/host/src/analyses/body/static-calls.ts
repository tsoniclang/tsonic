import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { LogicalCellRow, Summary } from "../../ir-facts/contract.js";
import { staticDeclarationKey, staticInitializationCellOf } from "../../ir-facts/index.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { bodyFrontier } from "./places.js";
import { valueKind } from "./values.js";

export type StaticCalleeCells = (summary: Summary, source: number) => number | undefined;

export interface StaticCallInventory {
  readonly additional: readonly LogicalCellRow[];
  readonly absent: ReadonlySet<number>;
  readonly include: (summary: Summary) => DataflowStop | null;
  readonly cellOf: StaticCalleeCells;
  readonly slotOf: StaticCalleeCells;
}

export function staticCallInventory(deps: BodyRoundDeps, input: BodyRoundInput, direct: readonly LogicalCellRow[],
  admit: (additional: number, absence: boolean) => DataflowStop | null): DataflowResult<StaticCallInventory> {
  const { account } = deps;
  const start = chargeWork(account, 1) ?? chargeResultEntries(account, 7);
  if (start !== null) return start;
  const byIdentity = new Map<string, LogicalCellRow>();
  const selected = new Map<Summary, ReadonlyMap<number, number>>();
  const additional: LogicalCellRow[] = [];
  const absent = new Set<number>();
  for (const row of direct) {
    const read = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (read !== null) return read;
    if (row.role.kind !== "static") return bodyFrontier("A direct static inventory contains only its actual static cells.");
    const key = staticDeclarationKey(row.role.declaration, account);
    if (key.kind !== "complete") return key;
    byIdentity.set(key.value, row);
  }
  const include = (summary: Summary): DataflowStop | null => {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    if (selected.has(summary)) return null;
    const retain = chargeResultEntries(account, 2);
    if (retain !== null) return retain;
    const bindings = new Map<number, number>();
    selected.set(summary, bindings);
    for (let index = 0; index < summary.arena.cells.length; index += 1) {
      const cellRead = chargeWork(account, 1);
      if (cellRead !== null) return cellRead;
      if (summary.arena.cells[index]?.role.kind !== "static") continue;
      const staticCell = staticInitializationCellOf(summary, index, account);
      if (staticCell.kind !== "complete") return staticCell;
      if (staticCell.value === null) return bodyFrontier("An applied static cell must retain its actual declaration.");
      const { declaration, key, source } = staticCell.value;
      if (source.kind !== "item" || source.value.owner !== declaration.definition)
        return bodyFrontier("One applied static cell requires the same qualified declaration occurrence.");
      const identity = chargeWork(account, key.length) ?? chargeResultEntries(account, 1);
      if (identity !== null) return identity;
      let actual = byIdentity.get(key);
      if (actual === undefined) {
        const view = chargeWork(account, 1);
        if (view !== null) return view;
        const type = deps.staticTypeOf(source);
        const stopped = accountFailure(account);
        if (stopped !== null) return stopped;
        if (type === null) return bodyFrontier("An applied static cell needs its actual declared storage type.");
        const kind = valueKind(deps, type);
        const classified = accountFailure(account);
        if (classified !== null) return classified;
        if (kind !== "primitive" && kind !== "absence")
          return bodyFrontier("An applied static cell needs its actual incoming non-scalar value contents.");
        const allocation = admit(additional.length + 1, absent.size !== 0 || kind === "absence")
          ?? chargeResultEntries(account, kind === "absence" ? 7 : 6);
        if (allocation !== null) return allocation;
        const position = direct.length + additional.length;
        actual = { id: input.tir.captures.length + position, role: { kind: "static", declaration },
          occurrence: { kind: "declared", at: { kind: "node", node: source } }, lifetimes: [] };
        if (kind === "absence") absent.add(input.mir.locals.length + position);
        byIdentity.set(key, actual);
        additional.push(actual);
      }
      const occurrence = actual.occurrence;
      if (occurrence.kind !== "declared" || occurrence.at.kind !== "node"
        || occurrence.at.node.kind !== "item" || occurrence.at.node.value.owner !== source.value.owner
        || occurrence.at.node.value.node !== source.value.node)
        return bodyFrontier("One applied static cell requires the same qualified declaration occurrence.");
      bindings.set(index, actual.id);
    }
    return null;
  };
  const cellOf: StaticCalleeCells = (summary, source) => selected.get(summary)?.get(source);
  const slotOf: StaticCalleeCells = (summary, source) => {
    const cell = cellOf(summary, source);
    return cell === undefined ? undefined : input.mir.locals.length + cell - input.tir.captures.length;
  };
  return { kind: "complete", value: { additional, absent, include, cellOf, slotOf } };
}
