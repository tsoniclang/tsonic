export const nativeNullishRecordsSource = `
import type { uint64 } from "@tsonic/core/types.js";
let calls = 0;
function count(): number { return calls; }
function fresh(): Record<string, number> { calls++; return { answer: 7 }; }
function selected(value: Record<string, number> | null | undefined): Record<string, number> {
  return value ?? fresh();
}
function assigned(value: Record<string, number> | null | undefined): Record<string, number> {
  value ??= fresh();
  return value;
}
function read<Value>(value: Record<string, Value | undefined>): Value | undefined {
  return value.missing;
}
function optional(value: Record<string, string | undefined> | null | undefined): string | undefined {
  return value?.present;
}
export function run(): boolean {
  const original: Record<string, number> = { answer: 0 };
  const first = selected(original);
  const second = assigned(original);
  original.answer = 9;
  const previous = original.answer++;
  original.answer += 1;
  if (count() !== 0 || previous !== 9 || first.answer !== 11 || second.answer !== 11) return false;
  const absentNull = selected(null);
  const absentUndefined = selected(undefined);
  const assignedNull = assigned(null);
  const assignedUndefined = assigned(undefined);
  const values: Record<string, string | undefined> = { present: "value", missing: undefined };
  const blank: Record<string, string | undefined> = {};
  if (read(values) !== undefined || read(blank) !== undefined || optional(null) !== undefined ||
    optional(undefined) !== undefined || optional(values) !== "value" || blank.missing !== undefined) return false;
  const wide: Record<string, uint64> = { first: 9007199254740993n };
  wide.first += 1n;
  if (wide.first !== 9007199254740994n) return false;
  return count() === 4 && absentNull.answer === 7 && absentUndefined.answer === 7 &&
    assignedNull.answer === 7 && assignedUndefined.answer === 7;
}
`;
