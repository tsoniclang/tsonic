export const valueRecordMemoryProofFiles = Object.freeze({
  "layout.ts": `
import { field, memoryField, memoryLayout, struct } from "@tsonic/core/lang.js";
import type { uint8, uint32 } from "@tsonic/core/types.js";
import { abi } from "test:abi";
export const Word = struct({ count: field<uint32>() });
export type Word = typeof Word;
export const Header = struct({ word: field<Word>(), tag: field<uint8>() });
export type Header = typeof Header;
export const word = memoryLayout<uint32>(abi, 4, 4, 4);
const byte = memoryLayout<uint8>(abi, 1, 1, 1);
const nested = memoryLayout<Word>(abi, 4, 4, 4,
  memoryField((value: Word) => value.count, 0, 4, word));
export const header = memoryLayout<Header>(abi, 8, 4, 8,
  memoryField((value: Header) => value.tag, 0, 1, byte),
  memoryField((value: Header) => value.word, 4, 4, nested));
`,
  "index.ts": `
import { allocatePointer, equalPointer, loadPointer, offsetRawPointer, reinterpretRawPointer,
  storePointer, toRawPointer, unsafeContext } from "@tsonic/core/lang.js";
import type { uint32 } from "@tsonic/core/types.js";
import { abi } from "test:abi";
import { header, word } from "./layout.js";
import type { Header } from "./layout.js";
function initial(): Header { return { tag: 7, word: { count: 9 } }; }
export function run(): boolean {
  unsafeContext();
  const source = initial();
  const pointer = allocatePointer<Header>(source);
  const raw = toRawPointer(pointer, header);
  const restored = reinterpretRawPointer(raw, header);
  if (restored === undefined || !equalPointer(pointer, restored)) return false;
  const snapshot = loadPointer(restored);
  const field = reinterpretRawPointer<uint32>(offsetRawPointer(raw, 4, abi), word);
  if (field === undefined) return false;
  storePointer(field, 33);
  if (loadPointer(pointer).word.count !== 33 || snapshot.word.count !== 9 || source.word.count !== 9) return false;
  storePointer(restored, { tag: 11, word: { count: 45 } });
  const result = loadPointer(pointer);
  return result.tag === 11 && result.word.count === 45 && loadPointer(field) === 45;
}
`,
});
