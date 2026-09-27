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
    import { memoryarraylayout } from "@tsonic/core/lang.js";
    const byte = memorylayout<uint8>({ datalayout: abi, bytesize: 1, bytealignment: 1, stride: 1, fields: [] });
    const fits = memoryarraylayout({ datalayout: abi, bytesize: 255, bytealignment: 1, stride: 255, elementlayout: byte, length: 255 });
    const exceeds = memoryarraylayout({ datalayout: abi, bytesize: 256, bytealignment: 1, stride: 256, elementlayout: byte, length: 256 });
    const bytes = sizeof(exceeds);
    const annotated: nativeUint = sizeof(exceeds);
    offsetrawptr(raw, sizeof(fits) as uint8, abi);
    offsetrawptr(raw, (sizeof(exceeds) as uint8)!, abi);
    offsetrawptr(raw, bytes as uint8, abi);
    offsetrawptr(raw, (-sizeof(uint32Layout) as uint32), abi);
    offsetrawptr(raw, annotated as uint8, abi);
  `);
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
  assert.equal(checked.extensionDiagnostics.length, 4);
  assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN"));
  const valid = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr"));
  assert.ok(valid?.operation === "byte-offset");
  assert.equal(valid.offsetWidth, 8);
  for (const index of [1, 2, 3, 4]) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr", index)), undefined);
  }
});

test("layout queries are not exact address-integer domains without a selected fixed width", () => {
  const checked = memorySession(memoryTestPrelude + `
    addressintegertorawptr(sizeof(uint32Layout) as uint32, abi);
    addressintegertorawptr((-sizeof(uint32Layout)) as uint32, abi);
    addressintegertorawptr<uint32>(sizeof(uint32Layout), abi);
  `, { registrations: [{ ...memoryTestRegistration, descriptor: {
    ...memoryTestRegistration.descriptor, fingerprint: "query-address-le32", addressWidth: 32,
  } }] });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
  assert.equal(checked.extensionDiagnostics.length, 2);
  assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN"));
  const valid = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "addressintegertorawptr"));
  assert.ok(valid?.operation === "address-integer-to-raw");
  assert.equal(valid.addressWidth, 32);
  assert.equal(valid.addressRuntimeBase, "number");
  for (const index of [1, 2]) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "addressintegertorawptr", index)), undefined);
  }
});

for (const body of [
  "const bytes: number = sizeof(uint32Layout); offsetrawptr(raw, bytes, abi);",
  "offsetrawptr(raw, sizeof(uint32Layout) as number, abi);",
  "let bytes = sizeof(uint32Layout); bytes = 1.5; offsetrawptr(raw, bytes, abi);",
  "{ function sizeof(_layout: MemoryLayout<uint32>): number { return 4; } offsetrawptr(raw, sizeof(uint32Layout), abi); }",
  "offsetrawptr(raw, 1.5, abi);",
]) {
  test(`query evidence cannot upgrade an unproven numeric domain: ${body}`, () => {
    const checked = memorySession(memoryTestPrelude + body);
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
    assert.equal(checked.extensionDiagnostics.length, 1);
    assert.equal(checked.extensionDiagnostics[0]?.extensionCode, "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN");
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr")), undefined);
  });
}

for (const body of [
  "declare const missing: MemoryLayout<uint32>; offsetrawptr(raw, sizeof(missing), abi);",
  "declare const missing: MemoryLayout<uint32>; const bytes: nativeUint = sizeof(missing); offsetrawptr(raw, bytes, abi);",
  "const invalid = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 3, stride: 4, fields: [] }); offsetrawptr(raw, sizeof(invalid), abi);",
  "interface Header { count: uint32 }; const missing = memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] }); offsetrawptr(raw, fieldoffsetof(missing, value => value.count), abi);",
]) {
  test(`an incomplete layout observation cannot prove an integer offset: ${body}`, () => {
    const checked = memorySession(memoryTestPrelude + body);
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
    assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN"));
    assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED"));
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr")), undefined);
  });
}

test("query constants retain the selected ABI bounds without signed narrowing", () => {
  const checked = memorySession(memoryTestPrelude + `
    import { memoryarraylayout } from "@tsonic/core/lang.js";
    import type { uint8 } from "@tsonic/core/types.js";
    const byte = memorylayout<uint8>({ datalayout: abi, bytesize: 1, bytealignment: 1, stride: 1, fields: [] });
    const maximum = memoryarraylayout({ datalayout: abi, bytesize: 4294967295, bytealignment: 1, stride: 4294967295, elementlayout: byte, length: 4294967295 });
    const invalid = memoryarraylayout({ datalayout: abi, bytesize: 4294967296, bytealignment: 1, stride: 4294967296, elementlayout: byte, length: 4294967296 });
    offsetrawptr(raw, sizeof(maximum), abi);
    offsetrawptr(raw, sizeof(invalid), abi);
    offsetrawptr(raw, sizeof(maximum) as int32, abi);
    offsetrawptr(raw, 2147483648, abi);
  `, { registrations: [{ ...memoryTestRegistration, descriptor: {
    ...memoryTestRegistration.descriptor, fingerprint: "query-bounds-le32", addressWidth: 32,
  } }] });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
  assert.equal(checked.extensionDiagnostics.filter(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN").length, 3);
  const calls = memoryCalls(checked, "offsetrawptr");
  assert.equal(calls.length, 4);
  const valid = readTsonicRawMemoryOperation(checked.sourceFacts, calls[0]);
  assert.ok(valid?.operation === "byte-offset");
  assert.equal(valid.offsetWidth, 32);
  assert.equal(valid.offsetSignedness, "unsigned");
  for (const call of calls.slice(1)) assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, call), undefined);
});
