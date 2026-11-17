export const valueStructProofFiles = Object.freeze({
  "records.ts": `
import { field, struct } from "@tsonic/core/lang.js";
import type { uint32 } from "@tsonic/core/types.js";
export const Point: { x: uint32; y: uint32 } = struct({ x: field<uint32>(), y: field<uint32>() });
export type Point = typeof Point;
export const Pair = struct({ first: field<Point>(), second: field<Point>() });
export type Pair = typeof Pair;
export class Cell<T> {
  value: T;
  constructor(value: T) { this.value = value; }
}
export const Record = struct({ point: field<Point>(), cell: field<Cell<uint32>>() });
export type Record = typeof Record;
export class Counter {
  readonly storage: Point;
  constructor(value: uint32) { this.storage = { x: value, y: 0 }; }
  get(): uint32 { return this.storage.x; }
  set(value: uint32): void { this.storage.x = value; }
  add(other: Counter): void { this.storage.x += other.storage.x; }
  increment(): uint32 { return this.storage.x++; }
}
export function point(x: uint32, y: uint32): Point { return { x, y }; }
`,
  "index.ts": `
import { addressof, defaultvalue, loadptr, storeptr } from "@tsonic/core/lang.js";
import type { uint32 } from "@tsonic/core/types.js";
import { Cell, Counter, point } from "./records.js";
import type { Pair, Point, Record } from "./records.js";
function generic<T>(value: T): T { return value; }
let receiverVisits: uint32 = 0;
function visits(): uint32 { return receiverVisits; }
function selected(value: Counter): Counter { receiverVisits += 1; return value; }
function change(value: Counter): uint32 { value.set(20); return 3; }
export function run(): boolean {
  const zero = defaultvalue<Point>();
  if (zero.x !== 0 || zero.y !== 0) return false;
  if (point(31, 32).x !== 31) return false;
  const original = point(2, 4);
  let copy: Point = original;
  copy.x += 3;
  if (copy.x !== 5 || original.x !== 2) return false;
  const before = copy.x++;
  const after = ++copy.y;
  if (before !== 5 || copy.x !== 6 || after !== 5 || copy.y !== 5) return false;
  const nested: Pair = { first: original, second: copy };
  let nestedCopy: Pair = nested;
  nestedCopy.first.x = 11;
  if (nested.first.x !== 2 || nestedCopy.first.x !== 11) return false;
  const record: Record = { point: original, cell: new Cell<uint32>(1) };
  let otherRecord: Record = record;
  otherRecord.point.x = 14;
  otherRecord.cell.value = 8;
  if (record.point.x !== 2 || record.cell.value !== 8 || record.cell !== otherRecord.cell) return false;
  const counter = new Counter(4);
  const alias = counter;
  counter.add(alias);
  if (counter.get() !== 8 || alias.get() !== 8) return false;
  if (counter.increment() !== 8 || counter.get() !== 9) return false;
  receiverVisits = 0;
  selected(counter).storage.x += change(counter);
  if (visits() !== 1 || counter.get() !== 12) return false;
  const assigned = (selected(counter).storage.y = 17);
  if (visits() !== 2 || assigned !== 17 || counter.storage.y !== 17) return false;
  let located = point(1, 2);
  const pointer = addressof(located.x);
  const snapshot: Point = located;
  located.y = 10;
  located.y += 2;
  if (located.y !== 12) return false;
  storeptr(pointer, 7);
  if (located.x !== 7 || snapshot.x !== 1) return false;
  located = point(21, 22);
  if (loadptr(pointer) !== 21) return false;
  storeptr(pointer, 23);
  return located.x === 23 && generic<uint32>(19) === 19 && generic<string>("kept") === "kept";
}
`,
});
