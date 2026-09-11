import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { readTsonicRawMemoryOperation, resolveTsonicMemoryLayoutObservation } from "../readers.js";
import {
  assertMemoryDiagnostics, cleanMemorySession, memoryCall, memoryCalls,
  memorySession, memoryTestPrelude, memoryTestRegistration,
} from "./fixtures.js";

for (const addressWidth of [32, 64] as const) {
  test(`all layout queries compose with ${addressWidth}-bit unsigned byte offsets`, () => {
    const checked = memorySession(memoryTestPrelude + `
      interface Header { count: uint32 }
      const header = memoryLayout<Header>(abi, 12, 4, 16,
        memoryField((value: Header) => value.count, 4, 4, uint32Layout));
      offsetRawPointer(raw, sizeOf(header), abi);
      offsetRawPointer(raw, alignOf(header), abi);
      offsetRawPointer(raw, strideOf(header), abi);
      offsetRawPointer(raw, fieldOffsetOf(header, value => value.count), abi);
    `, { registrations: [{ ...memoryTestRegistration, descriptor: {
      ...memoryTestRegistration.descriptor, fingerprint: `query-le${addressWidth}`, addressWidth,
    } }] });
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
    assertMemoryDiagnostics(checked);
    for (const [index, queryName, value] of [
      [0, "sizeOf", 12], [1, "alignOf", 4], [2, "strideOf", 16], [3, "fieldOffsetOf", 4],
    ] as const) {
      const call = memoryCall(checked, "offsetRawPointer", index);
      const operation = readTsonicRawMemoryOperation(checked.sourceFacts, call);
      const queryCall = memoryCall(checked, queryName);
      const observation = resolveTsonicMemoryLayoutObservation(checked.sourceFacts, queryCall);
      assert.ok(operation?.operation === "byte-offset");
      assert.ok(observation?.kind === "resolved");
      assert.equal(operation.offsetExpression, queryCall);
      assert.equal(operation.offsetType, observation.query.resultType);
      assert.equal(operation.offsetWidth, addressWidth);
      assert.equal(operation.offsetSignedness, "unsigned");
      assert.equal(operation.offsetRuntimeBase, "number");
      assert.equal(observation.value, value);
      assert.equal(observation.layout.dataLayout.addressWidth, addressWidth);
      assert.ok(Object.isFrozen(operation));
      assert.ok(Object.isFrozen(observation.query));
    }
  });
}

test("layout-query aliases and erasing wrappers preserve their exact integer results", () => {
  const checked = cleanMemorySession(`
    import { sizeOf as byteSize } from "@tsonic/core/lang.js";
    import * as memory from "@tsonic/core/lang.js";
    const bytes = byteSize(uint32Layout);
    const copy = bytes;
    offsetRawPointer(raw, byteSize(uint32Layout), abi);
    offsetRawPointer(raw, memory.alignOf(uint32Layout), abi);
    offsetRawPointer(raw, ((copy) satisfies nativeUint)!, abi);
    offsetRawPointer(raw, (strideOf(uint32Layout)), abi);
    offsetRawPointer(raw, <nativeUint>sizeOf(uint32Layout), abi);
  `);
  const calls = memoryCalls(checked, "offsetRawPointer");
  assert.equal(calls.length, 5);
  for (const call of calls) {
    const operation = readTsonicRawMemoryOperation(checked.sourceFacts, call);
    assert.ok(operation?.operation === "byte-offset");
    assert.equal(operation.offsetWidth, 64);
    assert.equal(operation.offsetSignedness, "unsigned");
    assert.equal(operation.offsetExpression, checked.ast.arguments(call)[1]);
  }
});

test("layout queries survive cross-file immutable results and descriptors", () => {
  const checked = memorySession(memoryTestPrelude + `
    import { bytes, layout } from "./layout.js";
    const alias = bytes;
    offsetRawPointer(raw, alias, abi);
    offsetRawPointer(raw, strideOf(layout), abi);
  `, { extraFiles: { "/src/layout.ts": `
    import { abi } from "test:abi";
    import { memoryLayout, sizeOf } from "@tsonic/core/lang.js";
    import type { uint32 } from "@tsonic/core/types.js";
    export const layout = memoryLayout<uint32>(abi, 4, 4, 4);
    export const bytes = sizeOf(layout);
  ` } });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
  assertMemoryDiagnostics(checked);
  for (const call of memoryCalls(checked, "offsetRawPointer")) {
    const operation = readTsonicRawMemoryOperation(checked.sourceFacts, call);
    assert.ok(operation?.operation === "byte-offset");
    assert.equal(operation.offsetSignedness, "unsigned");
  }
});

test("nested raw offsets and reinterpretation demand exact query producers", () => {
  const checked = cleanMemorySession(`
    reinterpretRawPointer(offsetRawPointer(
      offsetRawPointer(raw, sizeOf(uint32Layout), abi),
      alignOf(uint32Layout), abi), uint32Layout);
  `);
  assert.equal(memoryCalls(checked, "offsetRawPointer").length, 2);
  for (const call of memoryCalls(checked, "offsetRawPointer")) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, call)?.operation, "byte-offset");
  }
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "reinterpretRawPointer"))?.operation, "reinterpret");
});

test("query composition retains literal, standalone and annotated controls", () => {
  const checked = cleanMemorySession(`
    sizeOf(uint32Layout);
    const bytes: nativeUint = sizeOf(uint32Layout);
    offsetRawPointer(raw, 4, abi);
    offsetRawPointer(raw, bytes, abi);
    offsetRawPointer(raw, sizeOf(uint32Layout), abi);
    offsetRawPointer(raw, -sizeOf(uint32Layout), abi);
  `);
  for (const [index, signedness] of ["signed", "unsigned", "unsigned", "signed"].entries()) {
    const operation = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetRawPointer", index));
    assert.ok(operation?.operation === "byte-offset");
    assert.equal(operation.offsetSignedness, signedness);
  }
});

test("zero-sized huge arrays supply a zero byte count without expanding their extent", () => {
  const checked = cleanMemorySession(`
    import { memoryArrayLayout } from "@tsonic/core/lang.js";
    interface Empty {}
    const empty = memoryLayout<Empty>(abi, 0, 1, 0);
    const huge = memoryArrayLayout(abi, 0, 1, 0, empty, 9007199254740993n);
    offsetRawPointer(raw, sizeOf(huge), abi);
    offsetRawPointer(raw, strideOf(huge), abi);
  `);
  for (const name of ["sizeOf", "strideOf"]) {
    const observation = resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, name));
    assert.ok(observation?.kind === "resolved");
    assert.equal(observation.value, 0);
    assert.equal(observation.layout.kind === "array" && observation.layout.fixedArray.length, 9007199254740993n);
  }
  assert.equal(memoryCalls(checked, "offsetRawPointer").length, 2);
});
