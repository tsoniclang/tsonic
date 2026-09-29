export const fixedArrayMemoryProofFiles = Object.freeze({
  "layout.ts": `
import { field, memoryarraylayout, memoryfield, memorylayout, struct } from "@tsonic/core/lang.js";
import type { FixedArray, uint8, uint32 } from "@tsonic/core/types.js";
import { abi } from "test:abi";
export type Row = FixedArray<uint32, 2>;
export type Matrix = FixedArray<Row, 2>;
export const Header = struct({ tag: field<uint8>(), values: field<Matrix>() });
export type Header = typeof Header;
export const word = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 8, fields: [] });
const byte = memorylayout<uint8>({ datalayout: abi, bytesize: 1, bytealignment: 1, stride: 1, fields: [] });
export const row = memoryarraylayout<uint32, 2>({ datalayout: abi, bytesize: 16, bytealignment: 4, stride: 16, elementlayout: word, length: 2 });
const matrix = memoryarraylayout<Row, 2>({ datalayout: abi, bytesize: 32, bytealignment: 4, stride: 32, elementlayout: row, length: 2 });
export const header = memorylayout<Header>({
  datalayout: abi,
  bytesize: 36,
  bytealignment: 4,
  stride: 36,
  fields: [
    memoryfield({ select: (value: Header) => value.tag, byteoffset: 0, bytealignment: 1, fieldlayout: byte }),
    memoryfield({ select: (value: Header) => value.values, byteoffset: 4, bytealignment: 4, fieldlayout: matrix }),
  ],
});
export const empty = memoryarraylayout<uint32, 0>({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: word, length: 0 });
`,
  "index.ts": `
import { allocateptr, equalptr, loadptr, offsetrawptr, reinterpretrawptr,
  storeptr, torawptr, unsafecontext } from "@tsonic/core/lang.js";
import type { FixedArray, uint32 } from "@tsonic/core/types.js";
import { abi } from "test:abi";
import { empty, header, word } from "./layout.js";
import type { Header } from "./layout.js";
function initial(): Header { return { tag: 7, values: [[1, 2], [3, 4]] as const }; }
export function run(): boolean {
  unsafecontext();
  const source = initial();
  const pointer = allocateptr<Header>(source);
  const raw = torawptr(pointer, header);
  const restored = reinterpretrawptr(raw, header);
  if (restored === undefined || !equalptr(pointer, restored)) return false;
  const snapshot = loadptr(restored);
  const last = reinterpretrawptr<uint32>(offsetrawptr(raw, 28, abi), word);
  if (last === undefined) return false;
  storeptr(last, 55);
  if (loadptr(pointer).values[1][1] !== 55 || snapshot.values[1][1] !== 4 || source.values[1][1] !== 4) return false;
  storeptr(restored, { tag: 9, values: [[11, 12], [13, 14]] as const });
  if (loadptr(last) !== 14 || loadptr(pointer).tag !== 9) return false;
  const zero = allocateptr<FixedArray<uint32, 0>>([] as const);
  const zeroRaw = torawptr(zero, empty);
  const zeroView = reinterpretrawptr(zeroRaw, empty);
  return zeroView !== undefined && equalptr(zero, zeroView) && loadptr(zeroView).length === 0;
}
`,
});
