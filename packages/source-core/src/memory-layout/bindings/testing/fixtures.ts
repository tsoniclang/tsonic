import assert from "node:assert/strict";
import { formatDiagnostics } from "@tsonic/tsts";
import { assertMemoryDiagnostics, memorySession } from "../../testing/fixtures.js";

export const bindingPrelude = `
import { abi } from "test:abi";
import type { Pointer, RawPointer, uint32, int32, FixedArray } from "@tsonic/core/types.js";
import { memorylayout, memoryfield, memoryarraylayout, bindmemoryfield, bindmemoryrecord,
  allocateptr, addressof, viewptr, projectptr, loadptr, storeptr,
  torawptr, reinterpretrawptr, equalptr } from "@tsonic/core/lang.js";
const word = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
interface Header { count: uint32; tag: uint32 }
const countField = memoryfield({ select: (value: Header) => value.count, byteoffset: 0, bytealignment: 4, fieldlayout: word });
const tagField = memoryfield({ select: (value: Header) => value.tag, byteoffset: 4, bytealignment: 4, fieldlayout: word });
const headerLayout = memorylayout<Header>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, fields: [countField, tagField] });
`;

export const boundRecordSource = `
const logical: Header = { count: 3, tag: 5 };
const before = addressof(logical.count);
const countBinding = bindmemoryfield(countField, before);
const tagBinding = bindmemoryfield(tagField, addressof(logical.tag));
const alias = countBinding;
const physical = bindmemoryrecord(headerLayout, tagBinding, alias);
`;

export function bindingSession(body: string, extraFiles?: Readonly<Record<string, string>>) {
  const checked = memorySession(bindingPrelude + body, { extraFiles });
  assert.equal(checked.diagnostics.filter(Boolean).length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
  assertMemoryDiagnostics(checked);
  return checked;
}
