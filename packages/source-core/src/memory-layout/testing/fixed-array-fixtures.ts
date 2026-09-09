import assert from "node:assert/strict";
import { formatDiagnostics } from "@tsonic/tsts";
import type { CheckedSourceProgram } from "@tsonic/tsts";
import {
  readTsonicMemoryLayout, resolveTsonicMemoryLayoutObservation,
} from "../../public/facts.js";
import type { TsonicArrayMemoryLayoutFact, TsonicMemoryLayoutFact } from "../../public/facts.js";
import { assertMemoryDiagnostics, memoryCall, memorySession, memoryTestRegistration } from "./fixtures.js";

export const arrayTestPrelude = `
import { abi } from "test:abi";
import type { FixedArray, MemoryLayout, Pointer, RawPointer, uint8, uint32, int32,
  uint64, nativeUint } from "@tsonic/core/types.js";
import { memoryLayout, memoryArrayLayout, memoryField, sizeOf, alignOf, strideOf,
  fieldOffsetOf, toRawPointer, reinterpretRawPointer, allocatePointer, addressOf,
  offsetRawPointer, keepAlive } from "@tsonic/core/lang.js";
declare const raw: RawPointer | undefined;
const word = memoryLayout<uint32>(abi, 4, 4, 4);
interface Empty {}
const empty = memoryLayout<Empty>(abi, 0, 4, 0);
`;

export const arrayTestProfiles = [
  { byteOrder: "little", addressWidth: 32, wideAlignment: 4 },
  { byteOrder: "big", addressWidth: 32, wideAlignment: 8 },
  { byteOrder: "little", addressWidth: 64, wideAlignment: 8 },
  { byteOrder: "big", addressWidth: 64, wideAlignment: 4 },
] as const;

export function arraySession(source: string, options: Parameters<typeof memorySession>[1] = {}): CheckedSourceProgram {
  return memorySession(arrayTestPrelude + source, options);
}

export function cleanArraySession(source: string, options: Parameters<typeof memorySession>[1] = {}): CheckedSourceProgram {
  const checked = arraySession(source, options);
  const diagnostics = checked.diagnostics.filter(entry => entry !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  assertMemoryDiagnostics(checked);
  return checked;
}

export function arrayMemoryLayout(layout: TsonicMemoryLayoutFact | undefined): TsonicArrayMemoryLayoutFact {
  assert.ok(layout?.kind === "array");
  return layout;
}

export function arrayLayoutAt(checked: CheckedSourceProgram, index = 0, name = "memoryArrayLayout"): TsonicArrayMemoryLayoutFact {
  return arrayMemoryLayout(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, name, index)));
}

export function assertArrayObservation(checked: CheckedSourceProgram, name: string, expected: number, index = 0): void {
  const result = resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, name, index));
  assert.ok(result?.kind === "resolved");
  assert.equal(result.value, expected);
  assert.ok(Object.isFrozen(result));
}

export function arrayProfileRegistration(profile: typeof arrayTestProfiles[number]) {
  return {
    ...memoryTestRegistration,
    descriptor: {
      fingerprint: `array-test-${profile.byteOrder}-${profile.addressWidth}-u64a${profile.wideAlignment}`,
      byteOrder: profile.byteOrder,
      addressWidth: profile.addressWidth,
    },
  };
}
