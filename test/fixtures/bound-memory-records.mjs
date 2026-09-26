export function boundMemoryRecordProofFiles(valueRepresentation) {
  const declarations = valueRepresentation ? `
import { field, struct } from "@tsonic/core/lang.js";
export const Word = struct({ count: field<uint32>() });
export type Word = typeof Word;
export const Pair = struct({ left: field<uint32>(), right: field<uint32>() });
export type Pair = typeof Pair;
export const Nested = struct({ word: field<Word>() });
export type Nested = typeof Nested;
` : `
export type Word = { count: uint32 };
export type Pair = { left: uint32; right: uint32 };
export type Nested = { word: Word };
`;
  return Object.freeze({
    "schema.ts": `
import type { uint32 } from "@tsonic/core/types.js";
import { memoryfield, memorylayout } from "@tsonic/core/lang.js";
import { abi } from "test:abi";
${declarations}
const scalar = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
export const countField = memoryfield({ select: (value: Word) => value.count, byteoffset: 0, bytealignment: 4, fieldlayout: scalar });
export const wordLayout = memorylayout<Word>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [countField] });
export const leftField = memoryfield({ select: (value: Pair) => value.left, byteoffset: 0, bytealignment: 4, fieldlayout: scalar });
export const rightField = memoryfield({ select: (value: Pair) => value.right, byteoffset: 4, bytealignment: 4, fieldlayout: scalar });
export const pairLayout = memorylayout<Pair>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, fields: [leftField, rightField] });
export const nestedField = memoryfield({ select: (value: Nested) => value.word, byteoffset: 0, bytealignment: 4, fieldlayout: wordLayout });
export const nestedLayout = memorylayout<Nested>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [nestedField] });
`,
    "views.ts": `
import { addressof, bindmemoryfield, bindmemoryrecord } from "@tsonic/core/lang.js";
import type { uint32 } from "@tsonic/core/types.js";
import { countField, wordLayout } from "./schema.js";
import type { Word } from "./schema.js";
export function retain(value: Word): Word { return value; }
export function create(seed: uint32): Word {
  let owned: uint32 = seed;
  return bindmemoryrecord(wordLayout, bindmemoryfield(countField, addressof(owned)));
}
`,
    "index.ts": `
import { addressof, allocateptr, bindmemoryfield, bindmemoryrecord, bindptr,
  equalptr, hashptr, loadptr, storeptr } from "@tsonic/core/lang.js";
import type { Pointer, uint32 } from "@tsonic/core/types.js";
import { countField, wordLayout, leftField, rightField, pairLayout,
  nestedField, nestedLayout } from "./schema.js";
import type { Word } from "./schema.js";
import { create, retain } from "./views.js";

function equalNumber(actual: number, expected: number): boolean { return actual === expected; }

function captureAndOrder(): boolean {
  let left: uint32 = 1;
  let right: uint32 = 2;
  const original = addressof(left);
  let selected: Pointer<uint32> = original;
  let visits = 0;
  const capture = (): Pointer<uint32> => { visits += 1; return selected; };
  const binding = bindmemoryfield(leftField, capture());
  const alias = binding;
  selected = addressof(right);
  const record = bindmemoryrecord(pairLayout,
    bindmemoryfield(rightField, selected), alias);
  const location = addressof(record.left);
  storeptr(location, 7);
  if (visits !== 1 || left !== 7 || right !== 2 ||
      !equalptr(location, original) || hashptr(location) !== hashptr(original)) return false;
  record.right = 9;
  left = 11;
  return equalNumber(right, 9) && record.left === 11;
}

function readFreeTransport(): boolean {
  let value: uint32 = 3;
  let reads = 0;
  let writes = 0;
  const pointer = bindptr<uint32>(
    { identity: 1 },
    () => { reads += 1; return value; },
    next => { writes += 1; value = next; });
  const record = bindmemoryrecord(wordLayout, bindmemoryfield(countField, pointer));
  const returned = retain(record);
  const boxed = allocateptr<Word>(returned);
  const restored = loadptr(boxed);
  if (reads !== 0 || writes !== 0) return false;
  restored.count = 5;
  if (reads !== 0 || !equalNumber(writes, 1) || value !== 5) return false;
  const address = addressof(restored.count);
  if (reads !== 0 || !equalptr(address, pointer)) return false;
  const observed = record.count;
  return observed === 5 && equalNumber(reads, 1);
}

class Failure extends Error {
  code: number;
  constructor(code: number) { super("bound memory failure"); this.code = code; }
}
function callbackFailures(): boolean {
  const failure = new Failure(17);
  const otherFailure = new Failure(17);
  let value: uint32 = 4;
  let rejectRead = true;
  let rejectWrite = true;
  const pointer = bindptr<uint32>(
    { identity: 2 },
    () => { if (rejectRead) throw failure; return value; },
    next => { if (rejectWrite) throw failure; value = next; });
  const record = bindmemoryrecord(wordLayout, bindmemoryfield(countField, pointer));
  let readCaught = false;
  let writeCaught = false;
  try { const observed = record.count; if (observed !== 4) return false; }
  catch (error) { readCaught = error === failure && failure === error && error !== otherFailure; }
  try { record.count = 8; }
  catch (error) { writeCaught = error === failure && otherFailure !== error; }
  if (!readCaught || !writeCaught || value !== 4) return false;
  rejectRead = false;
  rejectWrite = false;
  record.count = 12;
  return record.count === 12 && equalNumber(value, 12);
}

function nestedRetargeting(): boolean {
  const first = create(19);
  const second = create(23);
  const child = allocateptr<Word>(first);
  const nested = bindmemoryrecord(nestedLayout, bindmemoryfield(nestedField, child));
  const oldAddress = addressof(nested.word.count);
  if (!equalptr(oldAddress, addressof(first.count))) return false;
  nested.word = second;
  storeptr(oldAddress, 31);
  nested.word.count = 37;
  const before = nested.word.count++;
  const after = ++nested.word.count;
  nested.word.count += 3;
  return before === 37 && after === 39 && first.count === 31 && second.count === 42 &&
    equalptr(addressof(nested.word.count), addressof(second.count));
}

export function run(): boolean {
  return captureAndOrder() && readFreeTransport() && callbackFailures() && nestedRetargeting();
}
`,
  });
}
