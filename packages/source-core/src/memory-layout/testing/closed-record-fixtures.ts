import assert from "node:assert/strict";
import { formatDiagnostics } from "@tsonic/tsts";
import type { CheckedSourceProgram, Node } from "@tsonic/tsts";
import { readTsonicMemoryType } from "../type-contract/facts.js";
import { assertMemoryDiagnostics, memorySession } from "./fixtures.js";

export const recordPrelude = `
import { abi } from "test:abi";
import type { Pointer, RawPointer, FixedArray, int32, uint32, int64, uint64, uint8 } from "@tsonic/core/types.js";
import { struct, field, memorylayout, memoryarraylayout, memoryfield, fieldoffsetof,
  allocateptr, torawptr, reinterpretrawptr, bindmemoryfield, bindmemoryrecord } from "@tsonic/core/lang.js";
`;

export function checkedRecords(source: string, extraFiles: Readonly<Record<string, string>> = {}, codes: readonly string[] = []): CheckedSourceProgram {
  const checked = memorySession(recordPrelude + source, { extraFiles });
  const diagnostics = checked.diagnostics.filter(diagnostic => diagnostic !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  if (codes.length === 0) assertMemoryDiagnostics(checked);
  else assert.deepEqual(checked.extensionDiagnostics.map(diagnostic => diagnostic.extensionCode), codes);
  return checked;
}

export function recordIdentity(checked: CheckedSourceProgram, call: Node) {
  const fact = readTsonicMemoryType(checked.sourceFacts, call);
  assert.ok(fact);
  assert.ok(Object.isFrozen(fact));
  assert.ok(Object.isFrozen(fact.identity));
  return fact.identity;
}

export const recordLayouts = `
interface First { count: int64; tag: uint8 }
interface Second { tag: uint8; count: int64 }
const word = memorylayout<int64>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
const byte = memorylayout<uint8>({ datalayout: abi, bytesize: 1, bytealignment: 1, stride: 1, fields: [] });
const first = memorylayout<First>({
  datalayout: abi,
  bytesize: 16,
  bytealignment: 8,
  stride: 16,
  fields: [memoryfield({ select: (value: First) => value.count, byteoffset: 0, bytealignment: 8, fieldlayout: word }), memoryfield({ select: (value: First) => value.tag, byteoffset: 8, bytealignment: 1, fieldlayout: byte })],
});
const second = memorylayout<Second>({
  datalayout: abi,
  bytesize: 16,
  bytealignment: 8,
  stride: 16,
  fields: [memoryfield({ select: (value: Second) => value.tag, byteoffset: 8, bytealignment: 1, fieldlayout: byte }), memoryfield({ select: (value: Second) => value.count, byteoffset: 0, bytealignment: 8, fieldlayout: word })],
});
`;
