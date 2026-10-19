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
    const [bytesize, bytealignment, stride] = dimensions.split(", ");
    const checked = memorySession(memoryTestPrelude + `memorylayout<uint32>({
      datalayout: abi, bytesize: ${bytesize}, bytealignment: ${bytealignment}, stride: ${stride}, fields: [],
    });`);
    assert.ok(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_LAYOUT_DIMENSIONS_INVALID" ||
      diagnostic.extensionCode === "SOURCE_CORE_MEMORY_LAYOUT_NOT_PROVEN"));
    assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 1)), undefined);
    assert.equal(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_ANALYSIS_FAILED"), false);
  });
}

test("invalid source fields do not poison unrelated valid memory facts", () => {
  const checked = memorySession(memoryTestPrelude + `
    interface Header { count: uint32; }
    memoryfield({ select: (header: Header) => header.count, byteoffset: 1, bytealignment: 4, fieldlayout: uint32Layout });
    sizeof(uint32Layout);
  `);
  assert.ok(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_FIELD_DIMENSIONS_INVALID"));
  assert.equal(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryfield")), undefined);
  assert.ok(readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, "sizeof")));
});

test("duplicate and out-of-aggregate selected fields are rejected before publishing a layout", () => {
  const checked = memorySession(memoryTestPrelude + `
    interface Header { count: uint32; }
    const field = memoryfield({ select: (header: Header) => header.count, byteoffset: 0, bytealignment: 4, fieldlayout: uint32Layout });
    memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [field, field] });
    memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [memoryfield({ select: header => header.count, byteoffset: 8, bytealignment: 4, fieldlayout: uint32Layout })] });
  `);
  assert.deepEqual(checked.extensionDiagnostics.map(diagnostic => diagnostic.extensionCode), [
    "SOURCE_CORE_MEMORY_LAYOUT_FIELD_NOT_PROVEN", "SOURCE_CORE_MEMORY_LAYOUT_DIMENSIONS_INVALID",
  ]);
  for (const index of [1, 2]) assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", index)), undefined);
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
      const layout = memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
      memoryfield({ select: ${selector}, byteoffset: 0, bytealignment: 4, fieldlayout: uint32Layout });
      fieldoffsetof(layout, ${selector});
    `);
    assert.ok(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_FIELD_NOT_PROVEN"));
    assert.ok(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_QUERY_FIELD_NOT_PROVEN"));
    assert.equal(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryfield")), undefined);
    assert.equal(readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, "fieldoffsetof")), undefined);
  });
}

test("a single returned field is an exact selector, not an executed callback", () => {
  const checked = cleanMemorySession(`
    interface Header { count: uint32; }
    memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [memoryfield({ select: function (header) { return header.count; }, byteoffset: 0, bytealignment: 4, fieldlayout: uint32Layout })] });
  `);
  assert.ok(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryfield")));
});

test("integer offsets retain domains through parameters, fields, returns and immutable aliases", () => {
  const checked = cleanMemorySession(`
    import type { uint8, int64 } from "@tsonic/core/types.js";
    interface Limits { offset: uint8; }
    declare const limits: Limits;
    declare function offset(): int64;
    function advance(amount: uint8) { return offsetrawptr(raw, amount, abi); }
    const copy = limits.offset;
    offsetrawptr(raw, (copy), abi);
    offsetrawptr(raw, offset(), abi);
  `);
  for (const [index, width, signedness] of [[0, 8, "unsigned"], [1, 8, "unsigned"], [2, 64, "signed"]] as const) {
    const fact = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr", index));
    assert.ok(fact?.operation === "byte-offset");
    assert.equal(fact.offsetWidth, width);
    assert.equal(fact.offsetSignedness, signedness);
  }
});

test("inferred address conversion results retain their exact fixed-width unsigned domain", () => {
  const checked = cleanMemorySession(`
    const address = rawptrtoaddressinteger<uint64>(raw, abi);
    const copy = address;
    addressintegertorawptr(copy, abi);
    addressintegertorawptr(rawptrtoaddressinteger<uint64>(raw, abi), abi);
  `);
  for (const index of [0, 1]) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "addressintegertorawptr", index))?.operation, "address-integer-to-raw");
  }
});

test("32-bit ABI selection controls native offset bounds without narrowing 128-bit operands", () => {
  const checked = memorySession(memoryTestPrelude + `
    import type { uint128 } from "@tsonic/core/types.js";
    declare const wide: uint128;
    offsetrawptr(raw, wide, abi);
    offsetrawptr(raw, 2147483647, abi);
    offsetrawptr(raw, 2147483648, abi);
  `, { registrations: [{ ...memoryTestRegistration, descriptor: {
    ...memoryTestRegistration.descriptor, fingerprint: "test-abi-le32", addressWidth: 32,
  } }] });
  const wide = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr"));
  const native = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr", 1));
  assert.ok(wide?.operation === "byte-offset" && native?.operation === "byte-offset");
  assert.equal(wide.offsetWidth, 128);
  assert.equal(native.offsetWidth, 32);
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr", 2)), undefined);
});

test("readonly ABI aliases preserve provider identity across source files", () => {
  const checked = memorySession(`
    import { selected } from "./abi.js";
    import { memorylayout } from "@tsonic/core/lang.js";
    import type { uint32 } from "@tsonic/core/types.js";
    memorylayout<uint32>({ datalayout: selected, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
  `, { extraFiles: { "/src/abi.ts": 'import { abi } from "test:abi"; export const selected = abi;' } });
  assertMemoryDiagnostics(checked);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout"))?.dataLayout.fingerprint, memoryTestRegistration.descriptor.fingerprint);
});

test("an authored plain-number domain is not reinterpreted through its integer initializer", () => {
  const checked = memorySession(memoryTestPrelude + `
    import type { uint8 } from "@tsonic/core/types.js";
    const narrow: uint8 = 1;
    const widened: number = narrow;
    offsetrawptr(raw, widened, abi);
  `);
  assert.ok(checked.extensionDiagnostics.some((diagnostic) => diagnostic.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN"));
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr")), undefined);
});

test("typed byte-offset constants cannot hide invalid values behind erasing wrappers", () => {
  const offsets = [
    "1.5 as uint32", "1e309 satisfies uint32", "<uint32>(4294967296)",
    "(-1 as uint32)!", "18446744073709551616n as uint64",
  ];
  const checked = memorySession(memoryTestPrelude + offsets.map((offset) =>
    `offsetrawptr(raw, (${offset}), abi);`).join("\n"));
  assert.equal(checked.diagnostics.filter((entry) => entry !== undefined).length, 0);
  assert.equal(checked.extensionDiagnostics.length, offsets.length);
  assert.ok(checked.extensionDiagnostics.every((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN"));
  for (const index of offsets.keys()) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr", index)), undefined);
  }
});

test("erasing wrappers preserve valid layout constants and signed byte offsets", () => {
  const checked = cleanMemorySession(`
    import type { int64 } from "@tsonic/core/types.js";
    memorylayout<uint32>({ datalayout: abi, bytesize: (4 as nativeUint), bytealignment: (4 satisfies nativeUint), stride: (<nativeUint>4)!, fields: [] });
    offsetrawptr(raw, (-4n as int64), abi);
    offsetrawptr(raw, ((4 as uint32) satisfies uint32)!, abi);
  `);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 1))?.byteSize, 4);
  const signed = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr"));
  const unsigned = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr", 1));
  assert.ok(signed?.operation === "byte-offset" && unsigned?.operation === "byte-offset");
  assert.equal(signed.offsetSignedness, "signed");
  assert.equal(signed.offsetWidth, 64);
  assert.equal(unsigned.offsetSignedness, "unsigned");
  assert.equal(unsigned.offsetWidth, 32);
});

test("satisfies and non-null assertions cannot replace an authored numeric domain", () => {
  const checked = memorySession(memoryTestPrelude + `
    const integer: uint32 = 4;
    const widened: number = integer;
    offsetrawptr(raw, (widened satisfies uint32)!, abi);
    addressintegertorawptr<uint32>((widened satisfies uint32)!, abi);
  `, { registrations: [{ ...memoryTestRegistration, descriptor: {
    ...memoryTestRegistration.descriptor, fingerprint: "test-abi-le32", addressWidth: 32,
  } }] });
  assert.equal(checked.diagnostics.filter((entry) => entry !== undefined).length, 0);
  assert.deepEqual(checked.extensionDiagnostics.map((entry) => entry.extensionCode).sort(), [
    "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN", "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN",
  ]);
  for (const name of ["offsetrawptr", "addressintegertorawptr"]) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, name)), undefined);
  }
});

for (const declarations of [
  "const size: number = -size;",
  "const size: number = +(-size);",
  "const size: number = -other; const other: number = size;",
]) {
  test(`cyclic unary layout constants fail without an extension crash: ${declarations}`, () => {
    const checked = memorySession(memoryTestPrelude + declarations + "memorylayout<uint32>({ datalayout: abi, bytesize: size, bytealignment: 4, stride: 4, fields: [] });");
    assert.ok(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_LAYOUT_NOT_PROVEN"));
    assert.equal(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "OBSERVATION_HOOK_FAILED"), false);
    assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 1)), undefined);
  });
}

test("nested unary layout constants retain their exact sign", () => {
  const checked = cleanMemorySession("const negative = -4; const positive = -(+negative); memorylayout<uint32>({ datalayout: abi, bytesize: positive, bytealignment: 4, stride: 4, fields: [] });");
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 1))?.byteSize, 4);
});
