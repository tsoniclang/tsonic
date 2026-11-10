export const bigintTruncationSource = `
import type { int64, uint64 } from "@tsonic/core/types.js";
export function run(): boolean {
  const signed: int64 = -9007199254740993n;
  const unsigned: uint64 = 18446744073709551615n;
  if (BigInt.asIntN(64, unsigned) !== -1n || BigInt.asUintN(64, signed) !== 18437736874454810623n) return false;
  if (BigInt.asIntN(8, 255n) !== -1n || BigInt.asUintN(8, -129n) !== 127n) return false;
  if (BigInt.asIntN(9, 256n) !== -256n || BigInt.asUintN(9, -1n) !== 511n) return false;
  if (BigInt.asIntN(0, signed) !== 0n || BigInt.asUintN(1.9, unsigned) !== 1n) return false;
  if (BigInt.asUintN(64, unsigned) + 1n !== 18446744073709551616n) return false;
  const wide = 1606938044258990275541962092341162602522202993782792835301376n;
  if (BigInt.asIntN(201, wide) !== -wide || BigInt.asUintN(202, wide) !== wide) return false;
  let rejected = false;
  try { BigInt.asIntN(-1, signed); } catch (error) { rejected = error instanceof RangeError; }
  return rejected && signed === -9007199254740993n && unsigned === 18446744073709551615n;
}
`;
