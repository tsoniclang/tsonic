export const nativeAbsenceJsonSource = `
let reads = 0;
function absent(): undefined { reads += 1; return undefined; }
function count(): number { return reads; }
let sequence = 0;
function first(): string { sequence = sequence * 10 + 1; return '{"value":1}'; }
function second(): undefined { sequence = sequence * 10 + 2; return undefined; }
function third(): string { sequence = sequence * 10 + 3; return "  "; }
function failed(): undefined { sequence = sequence * 10 + 2; throw new Error("omitted argument"); }
function order(): number { return sequence; }
function reset(): void { sequence = 0; }
export function run(): boolean {
  const value = JSON.parse('{"value":1}');
  const compact = '{"value":1}';
  const pretty = '{\\n  "value": 1\\n}';
  const plain = JSON.stringify(value, null) === compact &&
    JSON.stringify(value, undefined) === compact &&
    JSON.stringify(value, null, 2) === pretty &&
    JSON.stringify(value, undefined, "  ") === pretty &&
    JSON.stringify(value, absent(), absent()) === compact && count() === 2;
  const ordered = JSON.stringify(JSON.parse(first()), second(), third()) === pretty && order() === 123;
  reset();
  let rejected = false;
  try { JSON.stringify(JSON.parse(first()), failed(), third()); }
  catch { rejected = true; }
  return plain && ordered && rejected && order() === 12;
}
`;

export const nativeAbsenceSource = `
import type { int32, int64 } from "@tsonic/core/types.js";
import { field, struct } from "@tsonic/core/lang.js";
type Absent = null | undefined;
type Maybe<Value> = Value | null | undefined;
let effects: int32 = 0;
function absent(useNull: boolean): Absent { effects++; return useNull ? null : undefined; }
function effectCount(): int32 { return effects; }
function equal(left: Absent, right: Absent): boolean { return left === right && !(left !== right); }
function missing(value: string | null | undefined): boolean { return value === null && value === undefined; }
function retain<Value>(value: Value): Value { return value; }
function pick<Value>(value: Maybe<Value>, fallback: Value): Value { return value ?? fallback; }
function omitted<Value>(value?: Value): Maybe<Value> { return value; }
function defaulted(value: int64 = 0n): int64 { return value; }
function fallback(): int64 { effects += 10; return 9007199254740993n; }
function optional(value: { value: int64 } | null | undefined): int64 | undefined { return value?.value; }
const Point = struct({ count: field<int64>() });
type Point = typeof Point;
class Item {
  count: int64;
  constructor(count: int64) { this.count = count; }
}
class Holder<Value> {
  value: Maybe<Value>;
  constructor(value: Maybe<Value>) { this.value = value; }
  get current(): Maybe<Value> { return this.value; }
  set current(value: Maybe<Value>) { this.value = value; }
}
function callback<Value>(read: () => Maybe<Value>, fallback: Value): Value { return read() ?? fallback; }
function point(useNull: boolean, present: boolean): Maybe<Point> {
  return present ? { count: 0n } : useNull ? null : undefined;
}
function item(useNull: boolean, present: boolean, value: Item): Maybe<Item> {
  return present ? value : useNull ? null : undefined;
}
function records(): boolean {
  const original: Point = { count: 9007199254740993n };
  const held = new Holder<Point>(original);
  let copy: Point = held.current ?? { count: -1n };
  copy.count = 7n;
  if (copy.count !== 7n || original.count !== 9007199254740993n || held.current?.count !== 9007199254740993n) return false;
  held.current = null;
  if (held.current !== undefined) return false;
  held.current = undefined;
  if (held.current !== null) return false;
  if (point(true, false) !== undefined || point(false, false) !== null) return false;
  if (point(true, true)?.count !== 0n || callback<Point>(() => null, original).count !== original.count) return false;
  const recordValues: Maybe<Point>[] = [original, null, undefined];
  if (recordValues[0]?.count !== 9007199254740993n || recordValues[1] !== undefined || recordValues[2] !== null) return false;
  const instance = new Item(0n);
  const classHolder = new Holder<Item>(instance);
  const alias = classHolder.current;
  if (alias === undefined || alias === null) return false;
  alias.count = 11n;
  if (instance.count !== 11n || classHolder.current !== instance) return false;
  if (item(true, false, instance) !== undefined || item(false, false, instance) !== null) return false;
  if (item(false, true, instance) !== instance || callback<Item>(() => undefined, instance) !== instance) return false;
  const classValues: Maybe<Item>[] = [null, undefined, instance];
  if (classValues[0] !== undefined || classValues[1] !== null || classValues[2] !== instance) return false;
  const shape = { value: 3n as int64 };
  const shapeHolder = new Holder<{ value: int64 }>(shape);
  const shapeAlias = shapeHolder.current;
  if (shapeAlias === null || shapeAlias === undefined) return false;
  shapeAlias.value = 13n;
  return shape.value === 13n && shapeHolder.current === shape;
}
export function run(): boolean {
  if (!equal(absent(true), absent(false)) || effectCount() !== 2) return false;
  if (!missing(null) || !missing(undefined) || missing("")) return false;
  if (retain<Absent>(null) !== retain<Absent>(undefined)) return false;
  const values: Maybe<int64>[] = [0n, null, undefined];
  if (values[0] !== 0n || values[1] !== undefined || values[2] !== null) return false;
  if (pick<int64>(0n, 5n) !== 0n || pick<boolean>(false, true) || pick<string>("", "fallback") !== "") return false;
  if (pick<int64 | undefined>(undefined, 0n) !== 0n) return false;
  if (omitted<int64>() !== null || omitted<int64>(0n) !== 0n || omitted<int64 | undefined>() !== null) return false;
  if (defaulted(9007199254740993n) !== 9007199254740993n || defaulted(0n) !== 0n || defaulted() !== 0n) return false;
  const nested: Maybe<int64 | undefined>[] = [undefined, 1n, null];
  if (nested[0] !== null || nested[1] !== 1n || nested[2] !== undefined) return false;
  if ((optional({ value: 0n }) ?? fallback()) !== 0n || effectCount() !== 2) return false;
  if ((optional(null) ?? fallback()) !== 9007199254740993n || effectCount() !== 12) return false;
  if ((optional(undefined) ?? fallback()) !== 9007199254740993n || effectCount() !== 22) return false;
  return records();
}
`;

export const nativeAbsenceArraySource = `
import type { int64 } from "@tsonic/core/types.js";
import { field, struct } from "@tsonic/core/lang.js";
type Maybe<Value> = Value | null | undefined;
function fill<Value>(values: Maybe<Value>[], value: Value): Maybe<Value>[] {
  values[0] = value;
  values[1] = null;
  values[2] = undefined;
  return values;
}
function forward<Value>(values: Maybe<Value>[], value: Value): Maybe<Value>[] {
  return fill(values, value);
}
function first<Value>(values: Maybe<Value>[]): Maybe<Value> { return values[0]; }
class ArrayHolder<Value> {
  values: Maybe<Value>[];
  constructor(values: Maybe<Value>[]) { this.values = values; }
  put(value: Value): void { this.values[0] = value; }
  get(): Maybe<Value> { return this.values[0]; }
}
function capture<Value>(values: Maybe<Value>[]) {
  return class Captured {
    get(): Maybe<Value> { return values[0]; }
    put(value: Value): void { values[0] = value; }
  };
}
const Point = struct({ count: field<int64>() });
type Point = typeof Point;
class Item {
  count: int64;
  constructor(count: int64) { this.count = count; }
}
export function run(): boolean {
  const values: Maybe<int64>[] = [0n, null, undefined];
  const alias = forward<int64>(values, 9007199254740993n);
  if (alias !== values || values[0] !== 9007199254740993n || values[1] !== undefined || values[2] !== null) return false;
  const holder = new ArrayHolder<int64>(values);
  holder.put(-9007199254740993n);
  if (first(values) !== -9007199254740993n || holder.get() !== -9007199254740993n) return false;
  const Captured = capture(values);
  const captured = new Captured();
  captured.put(9007199254740993n);
  if (captured.get() !== 9007199254740993n || holder.get() !== 9007199254740993n) return false;
  const strings: Maybe<string>[] = ["before", null, undefined];
  if (forward<string>(strings, "") !== strings || strings[0] !== "") return false;
  const nested: Maybe<int64 | undefined>[] = [undefined, 1n, null];
  if (fill<int64 | undefined>(nested, 0n) !== nested || nested[0] !== 0n || nested[1] !== null) return false;
  const original: Point = { count: 7n };
  const records: Maybe<Point>[] = [original, null, undefined];
  if (fill<Point>(records, { count: 5n }) !== records || records[0]?.count !== 5n || original.count !== 7n) return false;
  const instance = new Item(11n);
  const classes: Maybe<Item>[] = [null, undefined, instance];
  if (fill<Item>(classes, instance) !== classes || classes[0] !== instance || classes[1] !== undefined || classes[2] !== null) return false;
  const absent: Maybe<null | undefined>[] = [null, undefined, null];
  if (fill<null | undefined>(absent, null) !== absent || absent[0] !== undefined || absent[1] !== null) return false;
  return true;
}
`;

export const nativeAbsenceJsSource = `
class Key { value: number = 0; }
function equal(left: unknown, right: unknown): boolean { return left === right; }
function kind(value: unknown): string { return typeof value; }
export function run(): boolean {
  if (!equal(null, undefined) || equal(null, 0) || equal(undefined, false) || equal(null, "")) return false;
  if (kind(null) !== kind(undefined) || kind(undefined) !== "object") return false;
  const values = new Map<string, number | null | undefined>();
  values.set("null", null);
  values.set("undefined", undefined);
  values.set("zero", 0);
  if (!values.has("null") || !values.has("undefined") || values.has("missing")) return false;
  if (values.get("null") !== undefined || values.get("undefined") !== null || values.get("missing") !== null) return false;
  if ((values.get("zero") ?? 9) !== 0) return false;
  const weak = new WeakMap<Key, number | null | undefined>();
  const key = new Key();
  const missing = new Key();
  weak.set(key, null);
  if (!weak.has(key) || weak.has(missing) || weak.get(key) !== undefined || weak.get(missing) !== null) return false;
  weak.set(key, 0);
  if (weak.get(key) !== 0) return false;
  const absent = new Set<null | undefined>();
  absent.add(null);
  absent.add(undefined);
  return absent.size === 1 && absent.has(null) && absent.has(undefined) && Object.is(null, undefined);
}
`;
