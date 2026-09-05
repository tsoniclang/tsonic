import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import type { CheckedSourceProgram } from "@tsonic/tsts";
import { readTsonicDataLayout, readTsonicRawMemoryOperation } from "../readers.js";
import { assertMemoryDiagnostics, memoryCall, memoryCalls, memorySession, memoryTestPrelude, memoryTestRegistration } from "./fixtures.js";

function addressSession(source: string, width: 32 | 64, byteOrder: "little" | "big" = "little"): CheckedSourceProgram {
  return memorySession(memoryTestPrelude + source, { registrations: [{
    ...memoryTestRegistration,
    descriptor: { fingerprint: `address-test-${byteOrder}-${width}`, byteOrder, addressWidth: width },
  }] });
}

function assertClean(checked: CheckedSourceProgram): void {
  const diagnostics = checked.diagnostics.filter((entry) => entry !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  assertMemoryDiagnostics(checked);
}

for (const width of [32, 64] as const) {
  for (const byteOrder of ["little", "big"] as const) {
    test(`${width}-bit ${byteOrder}-endian addresses retain an exact unsigned source result and operand`, () => {
      const type = `uint${width}`;
      const checked = addressSession(`
        const address: ${type} = rawPointerToAddressInteger<${type}>(raw, abi);
        const result: RawPointer | undefined = addressIntegerToRawPointer(address, abi);
        const explicitlySelected = addressIntegerToRawPointer<${type}>(address, abi);
      `, width, byteOrder);
      assertClean(checked);
      const sourceFile = checked.getSourceFile("/src/index.ts");
      assert.ok(sourceFile);
      const { checker } = checked.getSourceFileQueries(sourceFile);
      for (const name of ["rawPointerToAddressInteger", "addressIntegerToRawPointer"] as const) {
        for (const call of memoryCalls(checked, name)) {
          const fact = readTsonicRawMemoryOperation(checked.sourceFacts, call);
          assert.ok(fact?.operation === "raw-to-address-integer" || fact?.operation === "address-integer-to-raw");
          assert.ok(fact.call === call);
          assert.equal(fact.addressWidth, width);
          assert.equal(fact.addressRuntimeBase, width === 32 ? "number" : "bigint");
          assert.equal(fact.addressSignedness, "unsigned");
          const layout = readTsonicDataLayout(checked.sourceFacts, fact.dataLayoutExpression);
          assert.equal(layout?.addressWidth, width);
          assert.equal(layout?.byteOrder, byteOrder);
          const selection = checker.getResolvedCallInfo(call);
          assert.ok(fact.resultType === selection?.sourceResultType);
          if (fact.operation === "raw-to-address-integer") {
            assert.equal(checker.typeToString(fact.resultType), width === 32 ? "number" : "bigint");
            assert.ok(fact.rawExpression === selection?.sourceArguments[0]?.expression);
            assert.ok(fact.rawType === selection?.sourceArguments[0]?.type);
          } else {
            assert.ok(fact.addressExpression === selection?.sourceArguments[0]?.expression);
            assert.ok(fact.addressType === selection?.sourceArguments[0]?.type);
          }
          assert.ok(Object.isFrozen(fact));
        }
      }
    });
  }
}

for (const [width, values] of [
  [32, ["0", "2147483648", "4294967295"]],
  [64, ["0n", "9007199254740991n", "9007199254740992n", "9007199254740993n", "18446744073709551615n"]],
] as const) {
  test(`${width}-bit address constants preserve the complete unsigned range`, () => {
    const source = values.map((value, index) => `
      const address${index}: uint${width} = ${value};
      addressIntegerToRawPointer(address${index}, abi);
      addressIntegerToRawPointer<uint${width}>(${value}, abi);
    `).join("\n");
    const checked = addressSession(source, width);
    assertClean(checked);
    const calls = memoryCalls(checked, "addressIntegerToRawPointer");
    assert.equal(calls.length, values.length * 2);
    for (const call of calls) {
      const fact = readTsonicRawMemoryOperation(checked.sourceFacts, call);
      assert.ok(fact?.operation === "address-integer-to-raw");
      assert.equal(fact.addressWidth, width);
      assert.ok(fact.addressExpression === checked.ast.arguments(call)[0]);
    }
  });
}

test("address domains survive parameters, fields, returns, selected producers and immutable aliases", () => {
  const checked = addressSession(`
    import { rawPointerToAddressInteger as address } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    import type { uint64 as Word } from "@tsonic/core/types.js";
    import type * as types from "@tsonic/core/types.js";
    type Address = Word;
    interface State { address: Address; }
    declare const state: State;
    declare function read(): Address;
    function pass(value: Address) { return addressIntegerToRawPointer(value, abi); }
    const copied = state.address;
    addressIntegerToRawPointer(copied, abi);
    addressIntegerToRawPointer(read(), abi);
    const result = address<Address>(raw, abi);
    const alias = result;
    core.addressIntegerToRawPointer(alias, abi);
    core.addressIntegerToRawPointer(core.rawPointerToAddressInteger<types.uint64>(raw, abi), abi);
  `, 64);
  assertClean(checked);
  for (const call of memoryCalls(checked, "addressIntegerToRawPointer")) {
    const fact = readTsonicRawMemoryOperation(checked.sourceFacts, call);
    assert.ok(fact?.operation === "address-integer-to-raw");
    assert.equal(fact.addressWidth, 64);
    assert.equal(fact.addressRuntimeBase, "bigint");
  }
  assert.equal(memoryCalls(checked, "addressIntegerToRawPointer").length, 5);
});

for (const [width, source] of [
  [32, "addressIntegerToRawPointer<uint32>(-1, abi);"],
  [32, "addressIntegerToRawPointer<uint32>(1.5, abi);"],
  [32, "addressIntegerToRawPointer<uint32>(1e309, abi);"],
  [32, "addressIntegerToRawPointer<uint32>(4294967296, abi);"],
  [32, "addressIntegerToRawPointer<uint32>(9007199254740993, abi);"],
  [32, "const address: uint32 = 1.5; addressIntegerToRawPointer(address, abi);"],
  [32, "const address: uint32 = 4294967296; addressIntegerToRawPointer(address, abi);"],
  [64, "addressIntegerToRawPointer<uint64>(-1n, abi);"],
  [64, "addressIntegerToRawPointer<uint64>(18446744073709551616n, abi);"],
  [64, "const address: uint64 = 18446744073709551616n; addressIntegerToRawPointer(address, abi);"],
  [32, "declare const address: number; addressIntegerToRawPointer<uint32>(address, abi);"],
  [64, "declare const address: bigint; addressIntegerToRawPointer<uint64>(address, abi);"],
  [32, "declare const address: nativeUint; addressIntegerToRawPointer(address, abi);"],
  [64, "declare const address: nativeUint; addressIntegerToRawPointer(address, abi);"],
  [64, "import type { int64 } from '@tsonic/core/types.js'; declare const address: int64; addressIntegerToRawPointer<uint64>(address, abi);"],
  [64, "import type { uint128 } from '@tsonic/core/types.js'; declare const address: uint128; addressIntegerToRawPointer<uint64>(address, abi);"],
  [32, "declare const address: uint64; addressIntegerToRawPointer(address, abi);"],
  [64, "declare const address: uint32; addressIntegerToRawPointer(address, abi);"],
  [32, "import type { uint8 } from '@tsonic/core/types.js'; declare const address: uint8; addressIntegerToRawPointer<uint32>(address, abi);"],
  [32, "addressIntegerToRawPointer(4, abi);"],
  [64, "addressIntegerToRawPointer(4n, abi);"],
] as const) {
  test(`address conversion rejects an unproved domain or invalid constant: ${width} ${source}`, () => {
    const checked = addressSession(source, width);
    assert.ok(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN"));
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "addressIntegerToRawPointer")), undefined);
    assert.equal(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_ANALYSIS_FAILED"), false);
  });
}

for (const [width, argument] of [[32, "uint64"], [64, "uint32"], [32, "number"], [64, "bigint"], [64, "nativeUint"], [64, "number | bigint"]] as const) {
  test(`raw-to-address rejects ${argument} on a ${width}-bit ABI`, () => {
    const checked = addressSession(`rawPointerToAddressInteger<${argument}>(raw, abi);`, width);
    assert.ok(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN"));
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "rawPointerToAddressInteger")), undefined);
  });
}

test("raw-to-address requires an explicit domain rather than guessing from the destination", () => {
  const checked = addressSession(`
    rawPointerToAddressInteger(raw, abi);
    const address: uint64 = rawPointerToAddressInteger(raw, abi);
  `, 64);
  assert.equal(checked.extensionDiagnostics.filter((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN").length, 2);
  for (const call of memoryCalls(checked, "rawPointerToAddressInteger")) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, call), undefined);
  }
});

test("address conversions require a registered ABI and exact marker/type identity", () => {
  const unknown = memorySession(memoryTestPrelude + "rawPointerToAddressInteger<uint64>(raw, abi);", { registrations: [] });
  assert.ok(unknown.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ABI_NOT_PROVEN"));
  assert.equal(readTsonicRawMemoryOperation(unknown.sourceFacts, memoryCall(unknown, "rawPointerToAddressInteger")), undefined);
  const checked = addressSession(`
    { type uint64 = bigint; rawPointerToAddressInteger<uint64>(raw, abi); }
    function local() { return 0n; }
    { const rawPointerToAddressInteger = local; rawPointerToAddressInteger(); }
  `, 64);
  const calls = memoryCalls(checked, "rawPointerToAddressInteger");
  assert.equal(calls.length, 2);
  assert.equal(checked.extensionDiagnostics.filter((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN").length, 1);
  for (const call of calls) assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, call), undefined);
});

test("imported alias chains retain selected primitive facts without inspecting their names", () => {
  const checked = memorySession(memoryTestPrelude + `
    import type { Address } from "./address.js";
    declare const input: Address;
    addressIntegerToRawPointer(input, abi);
    rawPointerToAddressInteger<Address>(raw, abi);
  `, { extraFiles: {
    "/src/address.ts": 'import type { uint64 as Word } from "@tsonic/core/types.js"; type Bits = (Word); export type Address = Bits;',
  } });
  assertClean(checked);
  for (const name of ["addressIntegerToRawPointer", "rawPointerToAddressInteger"]) {
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
]) {
  test(`composite, unmarked or cyclic aliases cannot supply address evidence: ${declaration}`, () => {
    const checked = addressSession(`${declaration} rawPointerToAddressInteger<Address>(raw, abi);`, 64);
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "rawPointerToAddressInteger")), undefined);
    assert.equal(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_ANALYSIS_FAILED"), false);
    assert.ok(checked.diagnostics.some((entry) => entry !== undefined) || checked.extensionDiagnostics.some((entry) =>
      entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN"));
  });
}
