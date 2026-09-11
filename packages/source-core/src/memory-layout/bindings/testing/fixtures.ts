import assert from "node:assert/strict";
import { formatDiagnostics } from "@tsonic/tsts";
import { assertMemoryDiagnostics, memorySession } from "../../testing/fixtures.js";

export const bindingPrelude = `
import { abi } from "test:abi";
import type { Pointer, RawPointer, uint32, int32, FixedArray } from "@tsonic/core/types.js";
import { memoryLayout, memoryField, memoryArrayLayout, bindMemoryField, bindMemoryRecord,
  allocatePointer, addressOf, viewPointer, projectPointer, loadPointer, storePointer,
  toRawPointer, reinterpretRawPointer, equalPointer } from "@tsonic/core/lang.js";
const word = memoryLayout<uint32>(abi, 4, 4, 4);
interface Header { count: uint32; tag: uint32 }
const countField = memoryField((value: Header) => value.count, 0, 4, word);
const tagField = memoryField((value: Header) => value.tag, 4, 4, word);
const headerLayout = memoryLayout<Header>(abi, 8, 4, 8, countField, tagField);
`;

export const boundRecordSource = `
const logical: Header = { count: 3, tag: 5 };
const before = addressOf(logical.count);
const countBinding = bindMemoryField(countField, before);
const tagBinding = bindMemoryField(tagField, addressOf(logical.tag));
const alias = countBinding;
const physical = bindMemoryRecord(headerLayout, tagBinding, alias);
`;

export function bindingSession(body: string, extraFiles?: Readonly<Record<string, string>>) {
  const checked = memorySession(bindingPrelude + body, { extraFiles });
  assert.equal(checked.diagnostics.filter(Boolean).length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
  assertMemoryDiagnostics(checked);
  return checked;
}
