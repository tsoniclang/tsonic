import assert from "node:assert/strict";
import { test } from "node:test";
import { pointerOperationFactKey } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../../identity.js";
import { tsonicRawMemoryOperationFactKey } from "../../pointers/raw-memory/facts.js";
import { tsonicDataLayoutFactKey, tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey } from "../facts.js";
import {
  readTsonicDataLayout, readTsonicKeepAlive, readTsonicMemoryLayout,
  readTsonicMemoryLayoutQuery, readTsonicRawMemoryOperation,
} from "../readers.js";
import { assertMemoryDiagnostics, cleanMemorySession, memoryCall, memoryCalls, memorySession, memoryTestPrelude, memoryTestRegistration } from "./fixtures.js";

test("raw reinterpretation returns the canonical inferred Pointer and retains nested operation facts", () => {
  const checked = cleanMemorySession(`
    const pointer: Pointer<uint32> | undefined = reinterpretRawPointer(raw, uint32Layout);
    const explicit = reinterpretRawPointer<uint32>(raw, uint32Layout);
    const chosen: Pointer<uint32> | undefined = raw === undefined ? ordinary : pointer;
    if (chosen !== undefined) storePointer(chosen, loadPointer(chosen));
    const address = toRawPointer(ordinary, uint32Layout);
  `);
  const inferred = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "reinterpretRawPointer"));
  const explicit = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "reinterpretRawPointer", 1));
  assert.equal(inferred?.operation, "reinterpret");
  assert.equal(explicit?.operation, "reinterpret");
  assert.ok(inferred?.operation === "reinterpret" && explicit?.operation === "reinterpret");
  assert.ok(inferred.pointeeType);
  assert.equal(inferred.explicitPointeeTypeNode, undefined);
  assert.ok(explicit.explicitPointeeTypeNode);
  assert.ok(inferred.pointeeType === explicit.pointeeType);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, inferred.layoutExpression)?.byteSize, 4);
  assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "storePointer"), pointerOperationFactKey)?.operation, "store");
  assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "loadPointer"), pointerOperationFactKey)?.operation, "load");
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "toRawPointer"))?.operation, "to-raw");
  assert.ok(Object.isFrozen(inferred));
});

test("raw operations support aliases and namespaces without granting same-spelled locals marker facts", () => {
  const checked = cleanMemorySession(`
    import { reinterpretRawPointer as convert } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    convert(raw, uint32Layout); core.reinterpretRawPointer(raw, uint32Layout);
    function local(raw: RawPointer | undefined) { return raw; }
    { const reinterpretRawPointer = local; reinterpretRawPointer(raw); }
  `);
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "convert"))?.operation, "reinterpret");
  const calls = memoryCalls(checked, "reinterpretRawPointer");
  assert.equal(calls.length, 2);
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, calls[0])?.operation, "reinterpret");
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, calls[1]), undefined);
});

test("source memory descriptors retain explicit ABI, physical field identity and exact observations", () => {
  const checked = cleanMemorySession(`
    interface Header { tag: uint32; count: uint32; }
    const headerLayout = memoryLayout<Header>(abi, 12, 4, 12,
      memoryField((header: Header) => header.tag, 0, 4),
      memoryField((header: Header) => header.count, 8, 4));
    sizeOf(headerLayout); alignOf(headerLayout); strideOf(headerLayout);
    fieldOffsetOf(headerLayout, header => header.count);
  `);
  const layout = readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", 1));
  assert.ok(layout);
  assert.equal(layout.byteSize, 12);
  assert.equal(layout.stride, 12);
  assert.equal(layout.fields.length, 2);
  assert.deepEqual(layout.fields.map((field) => field.byteOffset), [0, 8]);
  assert.equal(checked.ast.text(checked.ast.name(layout.fields[1]?.selectedDeclaration)), "count");
  assert.deepEqual(layout.dataLayout.providerDeclaration, memoryTestRegistration.providerDeclaration);
  assert.equal(readTsonicDataLayout(checked.sourceFacts, layout.dataLayoutExpression)?.fingerprint, memoryTestRegistration.descriptor.fingerprint);
  for (const [name, kind] of [["sizeOf", "size"], ["alignOf", "alignment"], ["strideOf", "stride"], ["fieldOffsetOf", "field-offset"]] as const) {
    const query = readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, name));
    assert.equal(query?.operation, kind);
    assert.equal(readTsonicMemoryLayout(checked.sourceFacts, query?.layoutExpression)?.call, layout.call);
  }
  const query = readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, "fieldOffsetOf"));
  assert.equal(query?.selectedFieldDeclaration, layout.fields[1]?.selectedDeclaration);
  assert.ok(Object.isFrozen(layout.fields));
  assert.ok(Object.isFrozen(layout.fields[0]));
});

test("layout fields infer their selector receiver from the enclosing layout", () => {
  const checked = cleanMemorySession(`
    interface Header { count: uint32; }
    memoryLayout<Header>(abi, 4, 4, 4, memoryField(header => header.count, 0, 4));
  `);
  assert.ok(checked.sourceFacts.getFact(memoryCall(checked, "memoryField"), tsonicMemoryFieldLayoutFactKey));
});

test("layout aliases demand the exact initializer independent of source-file order", () => {
  const checked = memorySession(memoryTestPrelude + `
    import { layout } from "./layout.js";
    const alias = layout;
    sizeOf(alias);
  `, { extraFiles: { "/src/layout.ts": `
    import { abi } from "test:abi";
    import type { uint32 } from "@tsonic/core/types.js";
    import { memoryLayout } from "@tsonic/core/lang.js";
    export const layout = memoryLayout<uint32>(abi, 4, 4, 4);
  ` } });
  assertMemoryDiagnostics(checked);
  const query = readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, "sizeOf"));
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, query?.layoutExpression)?.byteSize, 4);
});

for (const [type, value, base, signedness, width] of [
  ["int8", "1", "number", "signed", 8], ["uint8", "1", "number", "unsigned", 8],
  ["int16", "1", "number", "signed", 16], ["uint16", "1", "number", "unsigned", 16],
  ["int32", "1", "number", "signed", 32], ["uint32", "1", "number", "unsigned", 32],
  ["int64", "-4n", "bigint", "signed", 64], ["uint64", "4n", "bigint", "unsigned", 64],
  ["int128", "4n", "bigint", "signed", 128], ["uint128", "4n", "bigint", "unsigned", 128],
  ["nativeInt", "1", "number", "signed", 64], ["nativeUint", "1", "number", "unsigned", 64],
] as const) {
  test(`byte offsets retain the exact ${type} domain`, () => {
    const checked = cleanMemorySession(`
      import type { ${type} as Offset } from "@tsonic/core/types.js";
      const amount: Offset = ${value};
      offsetRawPointer(raw, amount, abi);
    `);
    const fact = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer"));
    assert.ok(fact?.operation === "byte-offset");
    assert.equal(fact.offsetRuntimeBase, base);
    assert.equal(fact.offsetSignedness, signedness);
    assert.equal(fact.offsetWidth, width);
  });
}

for (const expression of ["4", "-4", "4n", "-4n"]) {
  test(`byte offsets accept exact in-range unmarked constant ${expression}`, () => {
    const checked = cleanMemorySession(`offsetRawPointer(raw, ${expression}, abi);`);
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer"))?.operation, "byte-offset");
  });
}

for (const [declaration, expression] of [
  ["", "1.5"], ["", "9223372036854775808n"], ["", "9007199254740993"],
  ["declare const amount: number;", "amount"], ["declare const amount: bigint;", "amount"],
  ['import type { float64 } from "@tsonic/core/types.js"; const amount: float64 = 4;', "amount"],
  ['import type { int8 } from "@tsonic/core/types.js"; const amount: int8 = 256;', "amount"],
] as const) {
  test(`byte offsets reject an unproved or out-of-range domain: ${declaration} ${expression}`, () => {
    const checked = memorySession(memoryTestPrelude + `${declaration} offsetRawPointer(raw, ${expression}, abi);`);
    assert.ok(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN"));
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer")), undefined);
  });
}

test("integer conversions and keepAlive retain independent exact operands", () => {
  const checked = cleanMemorySession(`
    const address: nativeUint = rawPointerToAddressInteger(raw, abi);
    const restored = addressIntegerToRawPointer(address, abi);
    keepAlive(ordinary);
  `);
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "rawPointerToAddressInteger"))?.operation, "raw-to-address-integer");
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "addressIntegerToRawPointer"))?.operation, "address-integer-to-raw");
  const call = memoryCall(checked, "keepAlive");
  assert.equal(readTsonicKeepAlive(checked.sourceFacts, call)?.valueExpression, checked.ast.arguments(call)[0]);
});

test("nested same-line raw operations have distinct fact subjects", () => {
  const checked = cleanMemorySession("reinterpretRawPointer(offsetRawPointer(raw, 4, abi), uint32Layout);");
  const outer = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "reinterpretRawPointer"));
  const inner = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer"));
  assert.ok(outer?.operation === "reinterpret" && inner?.operation === "byte-offset");
  assert.notEqual(outer.call, inner.call);
  assert.equal(outer.rawExpression, inner.call);
});

test("declaration-only marker occurrences do not produce runtime memory facts", () => {
  const checked = memorySession(memoryTestPrelude + `
    declare class Ambient { [keepAlive(raw)]: never; }
    interface Shape { [keepAlive(raw)]: never; }
  `);
  for (const call of memoryCalls(checked, "keepAlive")) assert.equal(readTsonicKeepAlive(checked.sourceFacts, call), undefined);
});

test("unregistered layout tokens fail without publishing a layout", () => {
  const checked = memorySession(memoryTestPrelude, { registrations: [] });
  assert.ok(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_LAYOUT_NOT_PROVEN"));
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout")), undefined);
});

test("ABI providers cannot publish source-core-owned layout facts or commit the failed transaction", () => {
  let attempted = false;
  assert.throws(() => memorySession(memoryTestPrelude, { extensions: [{
    identity: { id: "test.illegal-writer", version: "1" },
    dependencies: { dependsOn: [tsonicCoreSourceExtensionId] },
    analyzeSource(context) {
      const subject = {};
      const result = context.facts.set(subject, tsonicDataLayoutFactKey, {
        ...memoryTestRegistration.descriptor, providerDeclaration: memoryTestRegistration.providerDeclaration,
      });
      assert.equal(result, "conflict");
      assert.equal(context.facts.has(subject, tsonicDataLayoutFactKey), false);
      attempted = true;
    },
  }] }), /Cannot commit an extension fact transaction after a fact write failed/u);
  assert.equal(attempted, true);
});

test("missing public source facts stay missing without reconstruction", () => {
  const checked = cleanMemorySession("");
  const subject = memoryCall(checked, "memoryLayout");
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, subject), undefined);
  assert.equal(readTsonicKeepAlive(checked.sourceFacts, subject), undefined);
  assert.equal(checked.sourceFacts.getFact(subject, tsonicRawMemoryOperationFactKey), undefined);
  assert.ok(checked.sourceFacts.getFact(subject, tsonicMemoryLayoutFactKey));
});
