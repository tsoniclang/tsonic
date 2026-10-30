import assert from "node:assert/strict";

import { test } from "node:test";

import { readTsonicRawMemoryOperation } from "../readers.js";

import { memoryCall, memoryCalls, memorySession, memoryTestPrelude } from "./fixtures.js";

import { addressSession, assertClean } from "./address-integers-fixtures.js";

for (const [width, argument] of [[32, "uint64"], [64, "uint32"], [32, "number"], [64, "bigint"], [64, "nativeUint"], [64, "number | bigint"]] as const){
test(`raw-to-address rejects ${argument} on a ${width}-bit ABI`, () => {
    const checked = addressSession(`rawptrtoaddressinteger<${argument}>(raw, abi);`, width);
    assert.ok(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN"));
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "rawptrtoaddressinteger")), undefined);
  });
}

test("raw-to-address requires an explicit domain rather than guessing from the destination", () => {
  const checked = addressSession(`
    rawptrtoaddressinteger(raw, abi);
    const address: uint64 = rawptrtoaddressinteger(raw, abi);
  `, 64);
  assert.equal(checked.extensionDiagnostics.filter((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN").length, 2);
  for (const call of memoryCalls(checked, "rawptrtoaddressinteger")) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, call), undefined);
  }
});

test("address conversions require a registered ABI and exact marker/type identity", () => {
  const unknown = memorySession(memoryTestPrelude + "rawptrtoaddressinteger<uint64>(raw, abi);", { registrations: [] });
  assert.ok(unknown.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ABI_NOT_PROVEN"));
  assert.equal(readTsonicRawMemoryOperation(unknown.sourceFacts, memoryCall(unknown, "rawptrtoaddressinteger")), undefined);
  const checked = addressSession(`
    { type uint64 = bigint; rawptrtoaddressinteger<uint64>(raw, abi); }
    function local() { return 0n; }
    { const rawptrtoaddressinteger = local; rawptrtoaddressinteger(); }
  `, 64);
  const calls = memoryCalls(checked, "rawptrtoaddressinteger");
  assert.equal(calls.length, 2);
  assert.equal(checked.extensionDiagnostics.filter((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN").length, 1);
  for (const call of calls) assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, call), undefined);
});

test("imported alias chains retain selected primitive facts without inspecting their names", () => {
  const checked = memorySession(memoryTestPrelude + `
    import type { Address } from "./address.js";
    declare const input: Address;
    addressintegertorawptr(input, abi);
    rawptrtoaddressinteger<Address>(raw, abi);
  `, { extraFiles: {
    "/src/address.ts": 'import type { uint64 as Word } from "@tsonic/core/types.js"; type Bits = (Word); export type Address = Bits;',
  } });
  assertClean(checked);
  for (const name of ["addressintegertorawptr", "rawptrtoaddressinteger"]) {
    const fact = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, name));
    assert.ok(fact?.operation === "raw-to-address-integer" || fact?.operation === "address-integer-to-raw");
    assert.equal(fact.addressWidth, 64);
  }
});

for (const declaration of [
  "type Address = bigint;",
  "type Address = uint64[];",
  "type Address = uint64 | uint32;",
  "type Address = Other; type Other = Address;",
]){
test(`composite, unmarked or cyclic aliases cannot supply address evidence: ${declaration}`, () => {
    const checked = addressSession(`${declaration} rawptrtoaddressinteger<Address>(raw, abi);`, 64);
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "rawptrtoaddressinteger")), undefined);
    assert.equal(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_ANALYSIS_FAILED"), false);
    assert.ok(checked.diagnostics.some((entry) => entry !== undefined) || checked.extensionDiagnostics.some((entry) =>
      entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN"));
  });
}
