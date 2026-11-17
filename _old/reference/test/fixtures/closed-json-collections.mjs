export const closedJsonCollectionSource = `
import type { int64 } from "@tsonic/core/types.js";
function stringify(value: unknown): string { return JSON.stringify(value) ?? "null"; }
let evaluations = 0;
function leaf(value: int64): int64 { evaluations++; return value; }
export function run(): void {
  const count: int64 = 9007199254740993n;
  const values: unknown = [true, count, null, undefined];
  const value: unknown = { ok: true, values };
  const alias = value;
  const ordered: unknown = { first: leaf(1n), second: leaf(2n) };
  const nested: unknown = { child: { value: count } };
  const quoted: unknown = { "": count, "a-b": count };
  if (stringify(value) !== '{"ok":true,"values":[true,9007199254740993,null,null]}' ||
      value !== alias || stringify(ordered) !== '{"first":1,"second":2}' || evaluations !== 2 ||
      stringify(nested) !== '{"child":{"value":9007199254740993}}' ||
      stringify(quoted) !== '{"":9007199254740993,"a-b":9007199254740993}' ||
      stringify(undefined) !== "null" || stringify(null) !== "null") {
    throw new Error("closed JSON collection transport");
  }
}
export function main(): void { run(); }
`;
