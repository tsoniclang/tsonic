export const nativeClosedValuesSource = `
import type { int32, uint64 } from "@tsonic/core/types.js";
class Box {
  value: int32;
  constructor(value: int32) { this.value = value; }
}
class Base {
  value: int32;
  constructor(value: int32) { this.value = value; }
}
class Derived extends Base {}
class Slot {
  current: unknown = undefined;
  reads: int32 = 0;
  writes: int32 = 0;
  receivers: int32 = 0;
  rights: int32 = 0;
  get value(): unknown { this.reads++; return this.current; }
  set value(value: unknown) { this.writes++; this.current = value; }
  owner(): Slot { this.receivers++; return this; }
  replacement(): unknown { this.rights++; return "filled"; }
  effects(reads: int32, writes: int32, receivers: int32, rights: int32): boolean {
    return this.reads === reads && this.writes === writes && this.receivers === receivers && this.rights === rights;
  }
}
function retain(value: unknown): unknown { return value; }
function numericDefault(value: unknown = 0): unknown { return value; }
function stringDefault(value: unknown = "native"): unknown { return value; }
function boolDefault(value: unknown = false): unknown { return value; }
function optional(value: string | number | undefined): unknown { return value; }
function fallback(value: unknown): unknown { return value ?? "fallback"; }
function assigned(value: unknown): unknown { return value ??= "fallback"; }
function stored(value: unknown): unknown { value ??= "fallback"; return value; }
function locations(): boolean {
  const slot = new Slot();
  const first = slot.owner().value ??= slot.replacement();
  if (first !== "filled" || !slot.effects(1, 1, 1, 1)) return false;
  const second = slot.owner().value ??= slot.replacement();
  if (second !== "filled" || !slot.effects(2, 1, 2, 1)) return false;
  slot.current = false;
  const third = slot.owner().value ?? slot.replacement();
  return third === false && slot.effects(3, 1, 3, 1);
}
export function run(): boolean {
  const text = "native UTF-8 string";
  const retained = retain(text);
  const boxed = new Box(7 as int32);
  const alias = boxed;
  const base: Base = new Derived(9 as int32);
  const object = retain(boxed);
  const inherited = retain(base);
  const wide = 9007199254740993n as uint64;
  const empty = {};
  return retained !== "different" && retained === text && typeof retained === "string" &&
    numericDefault() === 0 && numericDefault(7) === 7 && stringDefault() === "native" &&
    boolDefault() === false && retain(false) !== 0 && retain(wide) === wide &&
    typeof retain(wide) === "bigint" && typeof retain(7 as int32) === "number" &&
    optional(undefined) === undefined && optional("present") === "present" && optional(8) === 8 &&
    retain(null) === retain(undefined) && retain("") !== undefined && retain(0) !== undefined &&
    fallback(undefined) === "fallback" && fallback(null) === "fallback" &&
    fallback(0) === 0 && fallback(false) === false && fallback("") === "" &&
    assigned(undefined) === "fallback" && assigned(null) === "fallback" && assigned(false) === false &&
    stored(undefined) === "fallback" && stored(0) === 0 && stored("") === "" &&
    object === retain(alias) && object !== retain(new Box(7 as int32)) && boxed.value === 7 &&
    inherited === retain(base) && inherited !== retain(new Derived(9 as int32)) &&
    retain(empty) === retain(empty) && retain(empty) !== retain({}) && locations();
}
`;
