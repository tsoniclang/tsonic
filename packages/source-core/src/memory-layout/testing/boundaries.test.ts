import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import {
  readTsonicMemoryFieldLayout,
  readTsonicMemoryLayout,
  readTsonicMemoryLayoutQuery,
  readTsonicRawMemoryOperation,
} from "../readers.js";
import { assertMemoryDiagnostics, cleanMemorySession, memoryCall, memorySession, memoryTestPrelude, memoryTestRegistration } from "./fixtures.js";

test("arbitrary-object binding is not an exported raw-address constructor", () => {
  const checked = memorySession('import { bindRawPointer } from "@tsonic/core/lang.js"; bindRawPointer({});');
  assert.match(formatDiagnostics(checked.diagnostics.filter((diagnostic) => diagnostic !== undefined), "/src"), /has no exported member(?: named)? 'bindRawPointer'/u);
});

for (const dimensions of ["4, 0, 4", "4, 3, 6", "8, 4, 4", "4, 4, 6", "-1, 4, 4", "1.5, 4, 4", "9007199254740993, 4, 4"]) {
  test(`invalid source layout ${dimensions} is diagnosed without failing the extension transaction`, () => {
    const checked = memorySession(memoryTestPrelude + `memoryLayout<uint32>(abi, ${dimensions});`);
    assert.ok(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_LAYOUT_DIMENSIONS_INVALID" ||
      diagnostic.extensionCode === "SOURCE_CORE_MEMORY_LAYOUT_NOT_PROVEN"));
    assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", 1)), undefined);
    assert.equal(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_ANALYSIS_FAILED"), false);
  });
}

test("invalid source fields do not poison unrelated valid memory facts", () => {
  const checked = memorySession(memoryTestPrelude + `
    interface Header { count: uint32; }
    memoryField((header: Header) => header.count, 1, 4);
    sizeOf(uint32Layout);
  `);
  assert.ok(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_FIELD_DIMENSIONS_INVALID"));
  assert.equal(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryField")), undefined);
  assert.ok(readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, "sizeOf")));
});

test("duplicate and out-of-aggregate selected fields are rejected before publishing a layout", () => {
  const checked = memorySession(memoryTestPrelude + `
    interface Header { count: uint32; }
    const field = memoryField((header: Header) => header.count, 0, 4);
    memoryLayout<Header>(abi, 4, 4, 4, field, field);
    memoryLayout<Header>(abi, 4, 4, 4, memoryField(header => header.count, 8, 4));
  `);
  assert.equal(checked.extensionDiagnostics.filter((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_LAYOUT_DIMENSIONS_INVALID").length, 2);
  for (const index of [1, 2]) assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", index)), undefined);
});

for (const selector of [
  "(header: Header) => { sideEffect(); return header.count; }",
  "(header: Header) => { if (enabled) return header.count; throw 0; }",
  "(header: Header = makeHeader()) => header.count",
]) {
  test(`memory selectors cannot silently erase computation: ${selector}`, () => {
    const checked = memorySession(memoryTestPrelude + `
      interface Header { count: uint32; }
      declare function sideEffect(): void;
      declare function makeHeader(): Header;
      declare const enabled: boolean;
      const layout = memoryLayout<Header>(abi, 4, 4, 4);
      memoryField(${selector}, 0, 4);
      fieldOffsetOf(layout, ${selector});
    `);
    assert.ok(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_FIELD_NOT_PROVEN"));
    assert.ok(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_QUERY_FIELD_NOT_PROVEN"));
    assert.equal(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryField")), undefined);
    assert.equal(readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, "fieldOffsetOf")), undefined);
  });
}

test("a single returned field is an exact selector, not an executed callback", () => {
  const checked = cleanMemorySession(`
    interface Header { count: uint32; }
    memoryLayout<Header>(abi, 4, 4, 4, memoryField(function (header) { return header.count; }, 0, 4));
  `);
  assert.ok(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryField")));
});

test("integer offsets retain domains through parameters, fields, returns and immutable aliases", () => {
  const checked = cleanMemorySession(`
    import type { uint8, int64 } from "@tsonic/core/types.js";
    interface Limits { offset: uint8; }
    declare const limits: Limits;
    declare function offset(): int64;
    function advance(amount: uint8) { return offsetRawPointer(raw, amount, abi); }
    const copy = limits.offset;
    offsetRawPointer(raw, (copy), abi);
    offsetRawPointer(raw, offset(), abi);
  `);
  for (const [index, width, signedness] of [[0, 8, "unsigned"], [1, 8, "unsigned"], [2, 64, "signed"]] as const) {
    const fact = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer", index));
    assert.ok(fact?.operation === "byte-offset");
    assert.equal(fact.offsetWidth, width);
    assert.equal(fact.offsetSignedness, signedness);
  }
});

test("inferred address conversion results retain their exact native unsigned domain", () => {
  const checked = cleanMemorySession(`
    const address = rawPointerToAddressInteger(raw, abi);
    const copy = address;
    addressIntegerToRawPointer(copy, abi);
    addressIntegerToRawPointer(rawPointerToAddressInteger(raw, abi), abi);
  `);
  for (const index of [0, 1]) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "addressIntegerToRawPointer", index))?.operation, "address-integer-to-raw");
  }
});

test("32-bit ABI selection controls native offset bounds without narrowing 128-bit operands", () => {
  const checked = memorySession(memoryTestPrelude + `
    import type { uint128 } from "@tsonic/core/types.js";
    declare const wide: uint128;
    offsetRawPointer(raw, wide, abi);
    offsetRawPointer(raw, 2147483647, abi);
    offsetRawPointer(raw, 2147483648, abi);
  `, { registrations: [{ ...memoryTestRegistration, descriptor: {
    ...memoryTestRegistration.descriptor, fingerprint: "test-abi-le32", addressWidth: 32,
  } }] });
  const wide = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer"));
  const native = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer", 1));
  assert.ok(wide?.operation === "byte-offset" && native?.operation === "byte-offset");
  assert.equal(wide.offsetWidth, 128);
  assert.equal(native.offsetWidth, 32);
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer", 2)), undefined);
});

test("readonly ABI aliases preserve provider identity across source files", () => {
  const checked = memorySession(`
    import { selected } from "./abi.js";
    import { memoryLayout } from "@tsonic/core/lang.js";
    import type { uint32 } from "@tsonic/core/types.js";
    memoryLayout<uint32>(selected, 4, 4, 4);
  `, { extraFiles: { "/src/abi.ts": 'import { abi } from "test:abi"; export const selected = abi;' } });
  assertMemoryDiagnostics(checked);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout"))?.dataLayout.fingerprint, memoryTestRegistration.descriptor.fingerprint);
});

test("an authored plain-number domain is not reinterpreted through its integer initializer", () => {
  const checked = memorySession(memoryTestPrelude + `
    import type { uint8 } from "@tsonic/core/types.js";
    const narrow: uint8 = 1;
    const widened: number = narrow;
    offsetRawPointer(raw, widened, abi);
  `);
  assert.ok(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN"));
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer")), undefined);
});
