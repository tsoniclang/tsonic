export const fixedArrayMemoryProofFiles = Object.freeze({
  "layout.ts": `
import { field, memoryArrayLayout, memoryField, memoryLayout, struct } from "@tsonic/core/lang.js";
import type { FixedArray, uint8, uint32 } from "@tsonic/core/types.js";
import { abi } from "test:abi";
export type Row = FixedArray<uint32, 2>;
export type Matrix = FixedArray<Row, 2>;
export const Header = struct({ tag: field<uint8>(), values: field<Matrix>() });
export type Header = typeof Header;
export const word = memoryLayout<uint32>(abi, 4, 4, 8);
const byte = memoryLayout<uint8>(abi, 1, 1, 1);
export const row = memoryArrayLayout<uint32, 2>(abi, 16, 4, 16, word, 2);
const matrix = memoryArrayLayout<Row, 2>(abi, 32, 4, 32, row, 2);
export const header = memoryLayout<Header>(abi, 36, 4, 36,
  memoryField((value: Header) => value.tag, 0, 1, byte),
  memoryField((value: Header) => value.values, 4, 4, matrix));
export const empty = memoryArrayLayout<uint32, 0>(abi, 0, 4, 0, word, 0);
`,
  "index.ts": `
import { allocatePointer, equalPointer, loadPointer, offsetRawPointer, reinterpretRawPointer,
  storePointer, toRawPointer, unsafeContext } from "@tsonic/core/lang.js";
import type { FixedArray, uint32 } from "@tsonic/core/types.js";
import { abi } from "test:abi";
import { empty, header, word } from "./layout.js";
import type { Header } from "./layout.js";
function initial(): Header { return { tag: 7, values: [[1, 2], [3, 4]] as const }; }
export function run(): boolean {
  unsafeContext();
  const source = initial();
  const pointer = allocatePointer<Header>(source);
  const raw = toRawPointer(pointer, header);
  const restored = reinterpretRawPointer(raw, header);
  if (restored === undefined || !equalPointer(pointer, restored)) return false;
  const snapshot = loadPointer(restored);
  const last = reinterpretRawPointer<uint32>(offsetRawPointer(raw, 28, abi), word);
  if (last === undefined) return false;
  storePointer(last, 55);
  if (loadPointer(pointer).values[1][1] !== 55 || snapshot.values[1][1] !== 4 || source.values[1][1] !== 4) return false;
  storePointer(restored, { tag: 9, values: [[11, 12], [13, 14]] as const });
  if (loadPointer(last) !== 14 || loadPointer(pointer).tag !== 9) return false;
  const zero = allocatePointer<FixedArray<uint32, 0>>([] as const);
  const zeroRaw = toRawPointer(zero, empty);
  const zeroView = reinterpretRawPointer(zeroRaw, empty);
  return zeroView !== undefined && equalPointer(zero, zeroView) && loadPointer(zeroView).length === 0;
}
`,
});
