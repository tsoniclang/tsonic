export const numberBoxingProof = `
import type { int8, uint8, int16, uint16, int32, uint32, int64, uint64, float32, float64 } from "@tsonic/core/types.js";
let visits = 0;
function next(): uint32 { visits += 1; return 4294967295; }
function optional(value: uint32 | undefined): void { console.log(value); }
export function run(): boolean {
  const signedByte: int8 = -128;
  const byte: uint8 = 255;
  const signedShort: int16 = -32768;
  const short: uint16 = 65535;
  const signedWord: int32 = -2147483648;
  const word: uint32 = 4294967295;
  const single: float32 = 1.5;
  const double: float64 = 2.5;
  console.log(signedByte, byte, signedShort, short, signedWord, word, single, double);
  console.log(next(), visits, next(), visits);
  optional(word);
  optional(undefined);
  const signedWide: int64 = -9007199254740993n;
  const wide: uint64 = 18446744073709551615n;
  console.log(signedWide, wide);
  return visits === 2;
}
`;

export const numberBoxingOutput = [
  "-128 255 -32768 65535 -2147483648 4294967295 1.5 2.5",
  "4294967295 1 4294967295 2",
  "4294967295",
  "null",
  "-9007199254740993 18446744073709551615",
  "",
].join("\n");
