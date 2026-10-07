export const nativeCallbackClosureSource = `
class Counter {
  #value = 7;
  bias = 0;
  read(): () => number {
    const callback = () => this.#value + seed + this["bias"];
    const seed = 3;
    return callback;
  }
  update(value: number): void { this.#value = value; }
}
function selected(value: string): string;
function selected(value: number): string;
function selected(value: string | number): string {
  return typeof value === "string" ? value : "number";
}
function genericSelected<T>(value: T): T;
function genericSelected<Item>(value: Item): Item { return value; }
export function run(): boolean {
  const counter = new Counter();
  const callback = counter.read();
  if (callback() !== 10) return false;
  counter.update(13);
  if (callback() !== 16) return false;
  return selected("native") === "native" && selected(7) === "number" &&
    genericSelected("exact") === "exact" && genericSelected(11) === 11;
}
export function main(): void {
  if (!run()) throw new Error("native callback and implementation ownership");
}
`;

export const nativeNamedMemberSource = `
import { field, struct } from "@tsonic/core/lang.js";
import type { int32 } from "@tsonic/core/types.js";
const Point = struct({ x: field<int32>() });
type Point = typeof Point;
const Pair = struct({ point: field<Point>() });
type Pair = typeof Pair;
function readPoint(value: Point): int32 { return value.x; }
function pointKey(): "x" { events = events * 10 + 2; return "x"; }
let events = 0;
function readEvents(): number { return events; }
class Named {
  value = 3;
  static limit: int32 = 9;
  static sum(value: number): number { events = events * 10 + 5; return value + 1; }
  get count(): number { events = events * 10 + 3; return this.value; }
  set count(value: number) { events = events * 10 + 5; this.value = value; }
  read(): number { return this.value; }
  add(value: number): number { events = events * 10 + 5; return this.value + value; }
}
class Box<Value> {
  value: Value;
  constructor(value: Value) { this.value = value; }
}
function readBox<Value>(box: Box<Value>): Value { return box["value"]; }
const original = new Named();
const replacement = new Named();
let selected = original;
function receiver(): Named { events = events * 10 + 1; return selected; }
function key(): "value" { events = events * 10 + 2; selected = replacement; return "value"; }
function accessorKey(): "count" { events = events * 10 + 2; return "count"; }
function methodKey(): "add" { events = events * 10 + 2; selected = replacement; return "add"; }
function staticKey(): "sum" { events = events * 10 + 2; return "sum"; }
function staticFieldKey(): "limit" { events = events * 10 + 2; return "limit"; }
function operand(): number { events = events * 10 + 4; return 7; }
function missing(): Named | undefined { return undefined; }
function failingKey(): "value" { throw new Error("key"); }
export function run(): boolean {
  const first = receiver()[key()];
  if (first !== 3 || readEvents() !== 12) return false;
  events = 0; selected = original;
  receiver()[key()] = operand();
  if (readEvents() !== 124 || original.read() !== 7 || replacement.read() !== 3) return false;
  events = 0; selected = original;
  const previous = receiver()[key()]++;
  if (readEvents() !== 12 || previous !== 7 || original.read() !== 8) return false;
  events = 0; selected = original;
  receiver()[accessorKey()] += operand();
  if (readEvents() !== 12345 || original.read() !== 15) return false;
  events = 0; selected = original;
  const added = receiver()[methodKey()](operand());
  if (readEvents() !== 1245 || added !== 22) return false;
  events = 0;
  const staticAdded = Named[staticKey()](operand());
  if (readEvents() !== 245 || staticAdded !== 8) return false;
  events = 0;
  const limit = Named[staticFieldKey()];
  if (readEvents() !== 2 || limit !== 9) return false;
  events = 0;
  if (missing()?.[key()] !== undefined || readEvents() !== 0) return false;
  let caught = false;
  try { original[failingKey()] = operand(); } catch { caught = true; }
  if (!caught || readEvents() !== 0) return false;
  let point: Point = { x: 1 };
  point[pointKey()] = 7;
  if (readEvents() !== 2 || readPoint(point) !== 7) return false;
  events = 0;
  const pair: Pair = { point };
  pair["point"][pointKey()] += 3;
  return readEvents() === 2 && readPoint(pair.point) === 10 && readPoint(point) === 7 && original["read"]() === 15 &&
    readBox(new Box(11)) === 11 && readBox(new Box("native")) === "native";
}
export function main(): void {
  if (!run()) throw new Error("exact named member evaluation");
}
`;

export const nativeArrayCallbackClosureSource = `
export function run(): boolean {
  const seed = 2;
  const mapped = [1, 2, 3].map(value => value + seed);
  const filtered = mapped.filter(value => value > seed);
  return filtered.length === 3 && filtered.some(value => value === 5);
}
export function main(): void {
  if (!run()) throw new Error("native array callback parameter elision");
}
`;

export const nativeSuspendedCallbackClosureSource = `
export async function run(): Promise<boolean> {
  let processing: Promise<void> = Promise.resolve(undefined);
  let total = 0;
  const process = async (previous: Promise<void>, value: number): Promise<void> => {
    await previous;
    total += value;
  };
  const schedule = (value: number): void => { processing = process(processing, value); };
  schedule(3);
  schedule(4);
  await processing;
  await Promise.resolve(undefined).then(() => { if (total === 7) return; total = -1; });
  return total === 7;
}
export async function main(): Promise<void> {
  if (!await run()) throw new Error("native suspended callback storage");
}
`;

export const nativeObjectConstructionConversionSource = `
import type { int64 } from "@tsonic/core/types.js";
interface Counted { count: int64 }
type Failure = { value: unknown };
function read(value: string | Counted): int64 {
  return typeof value === "string" ? -1n : value.count;
}
export function run(): boolean {
  let failure: Failure | undefined;
  try { throw new Error("native construction"); } catch (caught) { failure = { value: caught }; }
  const counted: Counted = { count: 9007199254740993n };
  return failure !== undefined && failure.value !== null &&
    counted.count === 9007199254740993n && read({ count: counted.count }) === counted.count;
}
export function main(): void {
  if (!run()) throw new Error("native object construction conversion");
}
`;

export const nativeRecordConstructionConversionSource = `
import type { int64 } from "@tsonic/core/types.js";
function read(value: string | Record<string, int64>): int64 {
  return typeof value === "string" ? -1n : value["count"];
}
export function run(): boolean {
  const count: int64 = 9007199254740993n;
  const record: Record<string, unknown> = { count: 7 };
  return read({ count }) === count && read("native") === -1n && record["count"] === 7;
}
export function main(): void {
  if (!run()) throw new Error("native record construction conversion");
}
`;
