export const selectedLiteralInputsSource = `
import type { int32, int64 } from "@tsonic/core/types.js";
type Selection = "first" | "second";
function select(value: Selection): int32 { return value === "first" ? 1 : 2; }
function optional(value?: Selection): int32 { return value === undefined ? 0 : select(value); }
function wide(value: int64): int64 { return value; }
export function run(): boolean {
  return select("first") === 1 && select(\`second\`) === 2 && optional("first") === 1 &&
    optional() === 0 && wide(9007199254740993n) === 9007199254740993n;
}
`;
