export const valueRecordMemoryProofFiles = Object.freeze({
  "layout.ts": `
import { field, memoryfield, memorylayout, struct } from "@tsonic/core/lang.js";
import type { uint8, uint32 } from "@tsonic/core/types.js";
import { abi } from "test:abi";
export const Word = struct({ count: field<uint32>() });
export type Word = typeof Word;
export const Header = struct({ word: field<Word>(), tag: field<uint8>() });
export type Header = typeof Header;
export const word = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
const byte = memorylayout<uint8>({ datalayout: abi, bytesize: 1, bytealignment: 1, stride: 1, fields: [] });
const nested = memorylayout<Word>({
  datalayout: abi,
  bytesize: 4,
  bytealignment: 4,
  stride: 4,
  fields: [memoryfield({ select: (value: Word) => value.count, byteoffset: 0, bytealignment: 4, fieldlayout: word })],
});
export const header = memorylayout<Header>({
  datalayout: abi,
  bytesize: 8,
  bytealignment: 4,
  stride: 8,
  fields: [
    memoryfield({ select: (value: Header) => value.tag, byteoffset: 0, bytealignment: 1, fieldlayout: byte }),
    memoryfield({ select: (value: Header) => value.word, byteoffset: 4, bytealignment: 4, fieldlayout: nested }),
  ],
});
`,
  "index.ts": `
import { allocateptr, equalptr, loadptr, offsetrawptr, reinterpretrawptr,
  storeptr, torawptr, unsafecontext } from "@tsonic/core/lang.js";
import type { uint32 } from "@tsonic/core/types.js";
import { abi } from "test:abi";
import { header, word } from "./layout.js";
import type { Header } from "./layout.js";
function initial(): Header { return { tag: 7, word: { count: 9 } }; }
export function run(): boolean {
  unsafecontext();
  const source = initial();
  const pointer = allocateptr<Header>(source);
  const raw = torawptr(pointer, header);
  const restored = reinterpretrawptr(raw, header);
  if (restored === undefined || !equalptr(pointer, restored)) return false;
  const snapshot = loadptr(restored);
  const field = reinterpretrawptr<uint32>(offsetrawptr(raw, 4, abi), word);
  if (field === undefined) return false;
  storeptr(field, 33);
  if (loadptr(pointer).word.count !== 33 || snapshot.word.count !== 9 || source.word.count !== 9) return false;
  storeptr(restored, { tag: 11, word: { count: 45 } });
  const result = loadptr(pointer);
  return result.tag === 11 && result.word.count === 45 && loadptr(field) === 45;
}
`,
});
