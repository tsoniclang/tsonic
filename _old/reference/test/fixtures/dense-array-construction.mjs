export const denseArrayConstructionSource = `
import type { int32, int64 } from "@tsonic/core/types.js";
function copy<T>(values: T[]): T[] { return [...values]; }
export function run(): boolean {
  const exact: int64 = 9007199254740993n;
  const values: int64[] = [exact];
  const copied = copy(values);
  copied[0] = 4n;
  const combined: int64[] = [2n, ...values, 3n, ...copied];
  const labels: string[] = ["first", "second"];
  const labelsCopy = copy(labels);
  labelsCopy[0] = "changed";
  const pair: [int32, int32] = [7, 8];
  const expanded: int32[] = [...pair];
  let length: int32 = 0;
  for (const value of combined) { if (value <= 0n) return false; length++; }
  return values[0] === exact && copied[0] === 4n && length === 4 &&
    combined[0] === 2n && combined[1] === exact && combined[2] === 3n && combined[3] === 4n &&
    labels[0] === "first" && labelsCopy[1] === "second" && expanded[1] === 8;
}
`;

export const denseArrayEvaluationSource = `
import type { int32 } from "@tsonic/core/types.js";
class Token { value: int32 = 1; }
let reads: int32 = 0;
function source(values: int32[]): int32[] { reads++; return values; }
function change(values: int32[]): int32 { values[0] = 9; values.push(3); return 4; }
export function run(): boolean {
  const values: int32[] = [1, 2];
  const result = [...source(values), change(values), ...source(values)];
  const token = new Token();
  const tokens: Token[] = [token];
  const copied = [...tokens];
  const empty: int32[] = [];
  const emptyCopy = [...empty];
  copied[0]!.value = 7;
  return result.length === 6 && result[0] === 1 && result[1] === 2 && result[2] === 4 &&
    result[3] === 9 && result[4] === 2 && result[5] === 3 && values.length === 3 && reads === 2 &&
    copied !== tokens && copied[0] === token && token.value === 7 && emptyCopy !== empty && emptyCopy.length === 0;
}
`;
