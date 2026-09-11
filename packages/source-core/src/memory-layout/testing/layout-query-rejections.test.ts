import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { readTsonicRawMemoryOperation } from "../readers.js";
import {
  memoryCall, memoryCalls, memorySession, memoryTestPrelude, memoryTestRegistration,
} from "./fixtures.js";

test("layout-query constants cannot conceal overflowing asserted integer widths", () => {
  const checked = memorySession(memoryTestPrelude + `
    import type { uint8 } from "@tsonic/core/types.js";
    import { memoryArrayLayout } from "@tsonic/core/lang.js";
    const byte = memoryLayout<uint8>(abi, 1, 1, 1);
    const fits = memoryArrayLayout(abi, 255, 1, 255, byte, 255);
    const exceeds = memoryArrayLayout(abi, 256, 1, 256, byte, 256);
    const bytes = sizeOf(exceeds);
    const annotated: nativeUint = sizeOf(exceeds);
    offsetRawPointer(raw, sizeOf(fits) as uint8, abi);
    offsetRawPointer(raw, (sizeOf(exceeds) as uint8)!, abi);
    offsetRawPointer(raw, bytes as uint8, abi);
    offsetRawPointer(raw, (-sizeOf(uint32Layout) as uint32), abi);
    offsetRawPointer(raw, annotated as uint8, abi);
  `);
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
  assert.equal(checked.extensionDiagnostics.length, 4);
  assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN"));
  const valid = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer"));
  assert.ok(valid?.operation === "byte-offset");
  assert.equal(valid.offsetWidth, 8);
  for (const index of [1, 2, 3, 4]) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer", index)), undefined);
  }
});

test("layout queries are not exact address-integer domains without a selected fixed width", () => {
  const checked = memorySession(memoryTestPrelude + `
    addressIntegerToRawPointer(sizeOf(uint32Layout) as uint32, abi);
    addressIntegerToRawPointer((-sizeOf(uint32Layout)) as uint32, abi);
    addressIntegerToRawPointer<uint32>(sizeOf(uint32Layout), abi);
  `, { registrations: [{ ...memoryTestRegistration, descriptor: {
    ...memoryTestRegistration.descriptor, fingerprint: "query-address-le32", addressWidth: 32,
  } }] });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
  assert.equal(checked.extensionDiagnostics.length, 2);
  assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN"));
  const valid = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "addressIntegerToRawPointer"));
  assert.ok(valid?.operation === "address-integer-to-raw");
  assert.equal(valid.addressWidth, 32);
  assert.equal(valid.addressRuntimeBase, "number");
  for (const index of [1, 2]) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "addressIntegerToRawPointer", index)), undefined);
  }
});

for (const body of [
  "const bytes: number = sizeOf(uint32Layout); offsetRawPointer(raw, bytes, abi);",
  "offsetRawPointer(raw, sizeOf(uint32Layout) as number, abi);",
  "let bytes = sizeOf(uint32Layout); bytes = 1.5; offsetRawPointer(raw, bytes, abi);",
  "{ function sizeOf(_layout: MemoryLayout<uint32>): number { return 4; } offsetRawPointer(raw, sizeOf(uint32Layout), abi); }",
  "offsetRawPointer(raw, 1.5, abi);",
]) {
  test(`query evidence cannot upgrade an unproven numeric domain: ${body}`, () => {
    const checked = memorySession(memoryTestPrelude + body);
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
    assert.equal(checked.extensionDiagnostics.length, 1);
    assert.equal(checked.extensionDiagnostics[0]?.extensionCode, "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN");
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer")), undefined);
  });
}

for (const body of [
  "declare const missing: MemoryLayout<uint32>; offsetRawPointer(raw, sizeOf(missing), abi);",
  "declare const missing: MemoryLayout<uint32>; const bytes: nativeUint = sizeOf(missing); offsetRawPointer(raw, bytes, abi);",
  "const invalid = memoryLayout<uint32>(abi, 4, 3, 4); offsetRawPointer(raw, sizeOf(invalid), abi);",
  "interface Header { count: uint32 }; const missing = memoryLayout<Header>(abi, 4, 4, 4); offsetRawPointer(raw, fieldOffsetOf(missing, value => value.count), abi);",
]) {
  test(`an incomplete layout observation cannot prove an integer offset: ${body}`, () => {
    const checked = memorySession(memoryTestPrelude + body);
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
    assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN"));
    assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED"));
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer")), undefined);
  });
}

test("query constants retain the selected ABI bounds without signed narrowing", () => {
  const checked = memorySession(memoryTestPrelude + `
    import { memoryArrayLayout } from "@tsonic/core/lang.js";
    import type { uint8 } from "@tsonic/core/types.js";
    const byte = memoryLayout<uint8>(abi, 1, 1, 1);
    const maximum = memoryArrayLayout(abi, 4294967295, 1, 4294967295, byte, 4294967295);
    const invalid = memoryArrayLayout(abi, 4294967296, 1, 4294967296, byte, 4294967296);
    offsetRawPointer(raw, sizeOf(maximum), abi);
    offsetRawPointer(raw, sizeOf(invalid), abi);
    offsetRawPointer(raw, sizeOf(maximum) as int32, abi);
    offsetRawPointer(raw, 2147483648, abi);
  `, { registrations: [{ ...memoryTestRegistration, descriptor: {
    ...memoryTestRegistration.descriptor, fingerprint: "query-bounds-le32", addressWidth: 32,
  } }] });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
  assert.equal(checked.extensionDiagnostics.filter(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN").length, 3);
  const calls = memoryCalls(checked, "offsetRawPointer");
  assert.equal(calls.length, 4);
  const valid = readTsonicRawMemoryOperation(checked.sourceFacts, calls[0]);
  assert.ok(valid?.operation === "byte-offset");
  assert.equal(valid.offsetWidth, 32);
  assert.equal(valid.offsetSignedness, "unsigned");
  for (const call of calls.slice(1)) assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, call), undefined);
});
