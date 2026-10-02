export const freshArraySpreadSource = `
import type { int16, int32 } from "@tsonic/core/types.js";
function copy<T>(values: T[]): T[] { return [...values]; }
function tuple(): [string, number] { return ["tuple", 9]; }
class Counter {
  count: int32 = 0;
  strings(): string[] { this.count += 1; return ["once"]; }
  pair(): [string, number] { this.count += 1; return ["pair", 8]; }
}
export function run(): boolean {
  const strings: string[] = ["source"];
  const union: (string | number)[] = ["first", ...strings, 3];
  const merged: (boolean | string | number)[] = [true, ...union, ...tuple()];
  const counter = new Counter();
  const once: (string | number)[] = [...counter.strings(), ...counter.pair()];
  const integers: int16[] = [4, 5];
  const widened: int32[] = [...integers];
  const copied = copy(strings);
  copied[0] = "copy";
  union[1] = 7;
  return strings[0] === "source" && copied[0] === "copy" &&
    merged[0] === true && merged[1] === "first" &&
    merged[2] === "source" && merged[3] === 3 && merged[4] === "tuple" && merged[5] === 9 &&
    counter.count === 2 && once[0] === "once" && once[1] === "pair" && once[2] === 8 &&
    widened[0] === 4 && widened[1] === 5;
}
`;

export const freshArraySpreadJsSource = freshArraySpreadSource.replace(
  'copied[0] = "copy";', 'copied[0] = "copy"; copied.push("more");',
).replace('return strings[0]', 'return strings.length === 1 && copied.length === 2 && merged.length === 6 && once.length === 3 && widened.length === 2 && strings[0]');

export const mutableArrayWideningSource = `
export function invalid(values: string[]): (string | number)[] { return values; }
`;

export const freshArraySpreadCostSource = `
import type { uint8 } from "@tsonic/core/types.js";
export function widen(values: uint8[]): number[] { return [...values]; }
export function copy(values: uint8[]): uint8[] { return [...values]; }
export function widenReadonly(values: readonly uint8[]): readonly number[] { return [...values]; }
export function readonlyValues(): readonly number[] { return [1, 2]; }
`;
