export const inferredOptionalNumericResultFiles = Object.freeze({
  "counts.ts": `
import type { FixedArray, int32, int64, uint8 } from "@tsonic/core/types.js";
export function length(values: FixedArray<uint8, 3>, present: boolean) {
  if (present) return values.length;
  return undefined;
}
export function wide(value: int64, present: boolean) {
  if (present) return value;
  return undefined;
}
export function floating(value: int32, present: boolean): number | undefined {
  if (present) return value;
  return undefined;
}
export function fractional(value: number, present: boolean) {
  if (present) return value / 2;
  return undefined;
}
export function text(present: boolean) {
  if (present) return "ready";
  return undefined;
}
export function selected(): int64 | undefined;
export function selected(value: int64): int64;
export function selected(value?: int64): int64 | undefined { return value; }
`,
  "index.ts": `
import { length, wide, floating, fractional, text, selected } from "./counts.js";
import type { FixedArray, int64, uint8 } from "@tsonic/core/types.js";
function local(values: FixedArray<uint8, 3>, present: boolean) {
  if (present) return values.length;
  return undefined;
}
function forwardText(present: boolean) { return text(present); }
export function run(values: FixedArray<uint8, 3>): boolean {
  const exact: int64 = 9007199254740993n;
  return length(values, true) === 3 && length(values, false) === undefined &&
    local(values, true) === 3 && local(values, false) === null &&
    wide(exact, true) === exact && wide(exact, false) === undefined &&
    floating(7, true) === 7 && floating(7, false) === null &&
    fractional(5, true) === 2.5 && fractional(5, false) === undefined &&
    forwardText(true) === "ready" && forwardText(false) === null &&
    selected(exact) === exact && selected() === undefined;
}
`,
});
