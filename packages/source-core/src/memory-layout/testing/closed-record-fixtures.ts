import assert from "node:assert/strict";
import { formatDiagnostics } from "@tsonic/tsts";
import type { CheckedSourceProgram, Node } from "@tsonic/tsts";
import { readTsonicMemoryType } from "../type-contract/facts.js";
import { assertMemoryDiagnostics, memorySession } from "./fixtures.js";

export const recordPrelude = `
import { abi } from "test:abi";
import type { Pointer, RawPointer, FixedArray, int32, uint32, int64, uint64, uint8 } from "@tsonic/core/types.js";
import { struct, field, memoryLayout, memoryArrayLayout, memoryField, fieldOffsetOf,
  allocatePointer, toRawPointer, reinterpretRawPointer, bindMemoryField, bindMemoryRecord } from "@tsonic/core/lang.js";
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
const word = memoryLayout<int64>(abi, 8, 8, 8);
const byte = memoryLayout<uint8>(abi, 1, 1, 1);
const first = memoryLayout<First>(abi, 16, 8, 16,
  memoryField((value: First) => value.count, 0, 8, word),
  memoryField((value: First) => value.tag, 8, 1, byte));
const second = memoryLayout<Second>(abi, 16, 8, 16,
  memoryField((value: Second) => value.tag, 8, 1, byte),
  memoryField((value: Second) => value.count, 0, 8, word));
`;
