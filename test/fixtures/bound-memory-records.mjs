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
import { memoryField, memoryLayout } from "@tsonic/core/lang.js";
import { abi } from "test:abi";
${declarations}
const scalar = memoryLayout<uint32>(abi, 4, 4, 4);
export const countField = memoryField((value: Word) => value.count, 0, 4, scalar);
export const wordLayout = memoryLayout<Word>(abi, 4, 4, 4, countField);
export const leftField = memoryField((value: Pair) => value.left, 0, 4, scalar);
export const rightField = memoryField((value: Pair) => value.right, 4, 4, scalar);
export const pairLayout = memoryLayout<Pair>(abi, 8, 4, 8, leftField, rightField);
export const nestedField = memoryField((value: Nested) => value.word, 0, 4, wordLayout);
export const nestedLayout = memoryLayout<Nested>(abi, 4, 4, 4, nestedField);
`,
    "views.ts": `
import { addressOf, bindMemoryField, bindMemoryRecord } from "@tsonic/core/lang.js";
import type { uint32 } from "@tsonic/core/types.js";
import { countField, wordLayout } from "./schema.js";
import type { Word } from "./schema.js";
export function retain(value: Word): Word { return value; }
export function create(seed: uint32): Word {
  let owned: uint32 = seed;
  return bindMemoryRecord(wordLayout, bindMemoryField(countField, addressOf(owned)));
}
`,
    "index.ts": `
import { addressOf, allocatePointer, bindMemoryField, bindMemoryRecord, bindPointer,
  equalPointer, hashPointer, loadPointer, storePointer } from "@tsonic/core/lang.js";
import type { Pointer, uint32 } from "@tsonic/core/types.js";
import { countField, wordLayout, leftField, rightField, pairLayout,
  nestedField, nestedLayout } from "./schema.js";
import type { Word } from "./schema.js";
import { create, retain } from "./views.js";

function equalNumber(actual: number, expected: number): boolean { return actual === expected; }

function captureAndOrder(): boolean {
  let left: uint32 = 1;
  let right: uint32 = 2;
  const original = addressOf(left);
  let selected: Pointer<uint32> = original;
  let visits = 0;
  const capture = (): Pointer<uint32> => { visits += 1; return selected; };
  const binding = bindMemoryField(leftField, capture());
  const alias = binding;
  selected = addressOf(right);
  const record = bindMemoryRecord(pairLayout,
    bindMemoryField(rightField, selected), alias);
  const location = addressOf(record.left);
  storePointer(location, 7);
  if (visits !== 1 || left !== 7 || right !== 2 ||
      !equalPointer(location, original) || hashPointer(location) !== hashPointer(original)) return false;
  record.right = 9;
  left = 11;
  return equalNumber(right, 9) && record.left === 11;
}

function readFreeTransport(): boolean {
  let value: uint32 = 3;
  let reads = 0;
  let writes = 0;
  const pointer = bindPointer<uint32>(
    { identity: 1 },
    () => { reads += 1; return value; },
    next => { writes += 1; value = next; });
  const record = bindMemoryRecord(wordLayout, bindMemoryField(countField, pointer));
  const returned = retain(record);
  const boxed = allocatePointer<Word>(returned);
  const restored = loadPointer(boxed);
  if (reads !== 0 || writes !== 0) return false;
  restored.count = 5;
  if (reads !== 0 || !equalNumber(writes, 1) || value !== 5) return false;
  const address = addressOf(restored.count);
  if (reads !== 0 || !equalPointer(address, pointer)) return false;
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
  const pointer = bindPointer<uint32>(
    { identity: 2 },
    () => { if (rejectRead) throw failure; return value; },
    next => { if (rejectWrite) throw failure; value = next; });
  const record = bindMemoryRecord(wordLayout, bindMemoryField(countField, pointer));
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
  const child = allocatePointer<Word>(first);
  const nested = bindMemoryRecord(nestedLayout, bindMemoryField(nestedField, child));
  const oldAddress = addressOf(nested.word.count);
  if (!equalPointer(oldAddress, addressOf(first.count))) return false;
  nested.word = second;
  storePointer(oldAddress, 31);
  nested.word.count = 37;
  const before = nested.word.count++;
  const after = ++nested.word.count;
  nested.word.count += 3;
  return before === 37 && after === 39 && first.count === 31 && second.count === 42 &&
    equalPointer(addressOf(nested.word.count), addressOf(second.count));
}

export function run(): boolean {
  return captureAndOrder() && readFreeTransport() && callbackFailures() && nestedRetargeting();
}
`,
  });
}
