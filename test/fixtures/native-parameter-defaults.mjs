export const nativeParameterDefaultsSource = `
let calls = 0;
function count(): number { return calls; }
function next(): unknown { calls++; return "default"; }
function direct(value: unknown = ""): unknown { return value; }
function evaluated(value: unknown = next()): unknown { return value; }
const deferred = (value: unknown = next()): unknown => value;
class Holder {
  value: unknown;
  constructor(value: unknown = "constructor") { this.value = value; }
  method(value: unknown = "method"): unknown { return value; }
}
export function run(): boolean {
  if (count() !== 0 || direct() !== "" || direct(undefined) !== "" || direct(null) !== "") return false;
  if (direct(0) !== 0 || direct(false) !== false || direct("") !== "") return false;
  if (evaluated(0) !== 0 || evaluated(false) !== false || deferred("") !== "" || count() !== 0) return false;
  if (evaluated() !== "default" || evaluated(undefined) !== "default" || evaluated(null) !== "default") return false;
  if (deferred() !== "default" || deferred(undefined) !== "default" || deferred(null) !== "default") return false;
  const first = new Holder();
  const second = new Holder(undefined);
  const third = new Holder(null);
  const fourth = new Holder(0);
  return count() === 6 && first.value === "constructor" && second.value === "constructor" &&
    third.value === "constructor" && fourth.value === 0 &&
    first.method() === "method" && first.method(undefined) === "method" && first.method(null) === "method" &&
    first.method(false) === false && first.method(0) === 0 && first.method("") === "";
}
`;

export const nativeAbsentParameterDefaultsSource = `
import { field, struct } from "@tsonic/core/lang.js";
import type { int64 } from "@tsonic/core/types.js";
const Point = struct({ count: field<int64>() });
type Point = typeof Point;
class Item {
  count: int64;
  constructor(count: int64) { this.count = count; }
}
function undefinedText(value: string | undefined = undefined): string | undefined { return value; }
function nullText(value: string | null = null): string | null { return value; }
function integer(value: int64 | null | undefined = undefined): int64 | null | undefined { return value; }
function scalar(value: number | null | undefined = null): number | null | undefined { return value; }
function flag(value: boolean | null | undefined = undefined): boolean | null | undefined { return value; }
function mutated(value: int64 | undefined = undefined): int64 | undefined { value = 11n; return value; }
const deferred = (value: int64 | null | undefined = undefined): int64 | null | undefined => value;
let calls = 0;
function count(): number { return calls; }
function next(): int64 | null | undefined { calls++; return 5n; }
function computed(value: int64 | null | undefined = next()): int64 | null | undefined { return value; }
const lazy = (value: int64 | null | undefined = next()): int64 | null | undefined => value;
function item(value: Item | null | undefined = undefined): Item | null | undefined { return value; }
function point(value: Point | null | undefined = null): Point | null | undefined { return value; }
class Holder {
  item: Item | undefined;
  path: string | undefined;
  point: Point | null | undefined;
  constructor(item: Item | undefined = undefined, path: string | undefined = undefined,
    point: Point | null | undefined = null) {
    this.item = item; this.path = path; this.point = point;
  }
  read(value: string | undefined = undefined): string | undefined { return value; }
  record(value: Point | null | undefined = undefined): Point | null | undefined { return value; }
}
export function run(): boolean {
  if (undefinedText() !== null || undefinedText(undefined) !== null || undefinedText("") !== "") return false;
  if (nullText() !== undefined || nullText(null) !== undefined || nullText("") !== "") return false;
  if (integer() !== null || integer(undefined) !== null || integer(null) !== undefined) return false;
  if (integer(0n) !== 0n || integer(9007199254740993n) !== 9007199254740993n) return false;
  if (mutated() !== 11n || mutated(undefined) !== 11n || mutated(0n) !== 11n) return false;
  if (deferred() !== null || deferred(undefined) !== null || deferred(null) !== undefined || deferred(0n) !== 0n) return false;
  if (computed(0n) !== 0n || lazy(0n) !== 0n || count() !== 0) return false;
  if (computed() !== 5n || computed(undefined) !== 5n || computed(null) !== 5n) return false;
  if (lazy() !== 5n || lazy(undefined) !== 5n || lazy(null) !== 5n || count() !== 6) return false;
  if (scalar() !== undefined || scalar(null) !== undefined || scalar(undefined) !== null || scalar(0) !== 0) return false;
  if (flag() !== null || flag(null) !== undefined || flag(undefined) !== null || flag(false) !== false) return false;
  const presentItem = new Item(7n);
  const presentPoint: Point = { count: 0n };
  if (item() !== null || item(undefined) !== null || item(null) !== undefined || item(presentItem) !== presentItem) return false;
  if (point() !== undefined || point(null) !== undefined || point(undefined) !== null) return false;
  if (point(presentPoint)?.count !== 0n) return false;
  const omitted = new Holder();
  const absent = new Holder(undefined, undefined, undefined);
  const explicit = new Holder(undefined, undefined, null);
  const present = new Holder(presentItem, "", presentPoint);
  if (omitted.item !== null || omitted.path !== null || omitted.point !== undefined) return false;
  if (absent.item !== null || absent.path !== null || absent.point !== null || explicit.point !== undefined) return false;
  if (present.item !== presentItem || present.path !== "" || present.point?.count !== 0n) return false;
  if (present.read() !== null || present.read(undefined) !== null || present.read("") !== "") return false;
  if (present.record() !== null || present.record(undefined) !== null || present.record(null) !== undefined) return false;
  return present.record(presentPoint)?.count === 0n;
}
`;

export const orderedParameterDefaultsSource = `
let calls = 0;
function next(): unknown { calls++; return "default"; }
function nextNumber(): number { calls++; return 9; }
function count(): number { return calls; }
function ordered(value: unknown = next(), required: number): unknown {
  return required === 7 ? value : false;
}
function constant(value: number = 3, required: number): number { return value + required; }
function destructured({ value }: { value: number } = { value: nextNumber() }, required: number): number {
  return value + required;
}
function positional([value]: [number] = [11], required: number): number {
  return value + required;
}
const deferred = (value: unknown = next(), required: number): unknown => required === 7 ? value : false;
class Holder {
  value: unknown;
  constructor(value: unknown = next(), required: number) { this.value = required === 7 ? value : false; }
  method(value: unknown = next(), required: number): unknown { return required === 7 ? value : false; }
}
export function run(): boolean {
  if (count() !== 0 || ordered(0, 7) !== 0 || deferred(false, 7) !== false) return false;
  if (constant(0, 7) !== 7 || constant(undefined, 7) !== 10) return false;
  if (destructured({ value: 0 }, 7) !== 7 || count() !== 0) return false;
  if (positional([0], 7) !== 7 || positional(undefined, 7) !== 18) return false;
  if (ordered(undefined, 7) !== "default" || ordered(null, 7) !== "default") return false;
  if (deferred(undefined, 7) !== "default" || deferred(null, 7) !== "default") return false;
  if (destructured(undefined, 7) !== 16) return false;
  const holder = new Holder(undefined, 7);
  if (holder.value !== "default" || holder.method(0, 7) !== 0 || holder.method(undefined, 7) !== "default") return false;
  return count() === 7;
}
`;
