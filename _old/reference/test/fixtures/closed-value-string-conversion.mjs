export const closedValueStringConversionSource = `
import type { int64, uint64 } from "@tsonic/core/types.js";
function format(value: unknown): string { return String(value); }
export function run(): boolean {
  const exact: int64 = 9007199254740993n;
  const maximum: uint64 = 18446744073709551615n;
  const values: unknown[] = [undefined, "value", exact, true];
  let calls = 0;
  const next = (): unknown => { calls += 1; return "raw\\nstring"; };
  return format(exact) === "9007199254740993" && format(maximum) === "18446744073709551615" &&
    format(undefined) === "null" && format(null) === "null" && format("") === "" &&
    format("a😀z") === "a😀z" && format(false) === "false" && format(1.5) === "1.5" &&
    format(-0) === "0" && format(Number.NaN) === "NaN" &&
    format(Number.POSITIVE_INFINITY) === "Infinity" &&
    format(values) === ",value,9007199254740993,true" &&
    format(next()) === "raw\\nstring" && calls === 1;
}
`;
