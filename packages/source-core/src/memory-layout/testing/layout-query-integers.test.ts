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
      const header = memorylayout<Header>({
        datalayout: abi,
        bytesize: 12,
        bytealignment: 4,
        stride: 16,
        fields: [memoryfield({ select: (value: Header) => value.count, byteoffset: 4, bytealignment: 4, fieldlayout: uint32Layout })],
      });
      offsetrawptr(raw, sizeof(header), abi);
      offsetrawptr(raw, alignof(header), abi);
      offsetrawptr(raw, strideof(header), abi);
      offsetrawptr(raw, fieldoffsetof(header, value => value.count), abi);
    `, { registrations: [{ ...memoryTestRegistration, descriptor: {
      ...memoryTestRegistration.descriptor, fingerprint: `query-le${addressWidth}`, addressWidth,
    } }] });
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
    assertMemoryDiagnostics(checked);
    for (const [index, queryName, value] of [
      [0, "sizeof", 12], [1, "alignof", 4], [2, "strideof", 16], [3, "fieldoffsetof", 4],
    ] as const) {
      const call = memoryCall(checked, "offsetrawptr", index);
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
    import { sizeof as byteSize } from "@tsonic/core/lang.js";
    import * as memory from "@tsonic/core/lang.js";
    const bytes = byteSize(uint32Layout);
    const copy = bytes;
    offsetrawptr(raw, byteSize(uint32Layout), abi);
    offsetrawptr(raw, memory.alignof(uint32Layout), abi);
    offsetrawptr(raw, ((copy) satisfies nativeUint)!, abi);
    offsetrawptr(raw, (strideof(uint32Layout)), abi);
    offsetrawptr(raw, <nativeUint>sizeof(uint32Layout), abi);
  `);
  const calls = memoryCalls(checked, "offsetrawptr");
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
    offsetrawptr(raw, alias, abi);
    offsetrawptr(raw, strideof(layout), abi);
  `, { extraFiles: { "/src/layout.ts": `
    import { abi } from "test:abi";
    import { memorylayout, sizeof } from "@tsonic/core/lang.js";
    import type { uint32 } from "@tsonic/core/types.js";
    export const layout = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
    export const bytes = sizeof(layout);
  ` } });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
  assertMemoryDiagnostics(checked);
  for (const call of memoryCalls(checked, "offsetrawptr")) {
    const operation = readTsonicRawMemoryOperation(checked.sourceFacts, call);
    assert.ok(operation?.operation === "byte-offset");
    assert.equal(operation.offsetSignedness, "unsigned");
  }
});

test("nested raw offsets and reinterpretation demand exact query producers", () => {
  const checked = cleanMemorySession(`
    reinterpretrawptr(offsetrawptr(
      offsetrawptr(raw, sizeof(uint32Layout), abi),
      alignof(uint32Layout), abi), uint32Layout);
  `);
  assert.equal(memoryCalls(checked, "offsetrawptr").length, 2);
  for (const call of memoryCalls(checked, "offsetrawptr")) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, call)?.operation, "byte-offset");
  }
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "reinterpretrawptr"))?.operation, "reinterpret");
});

test("query composition retains literal, standalone and annotated controls", () => {
  const checked = cleanMemorySession(`
    sizeof(uint32Layout);
    const bytes: nativeUint = sizeof(uint32Layout);
    offsetrawptr(raw, 4, abi);
    offsetrawptr(raw, bytes, abi);
    offsetrawptr(raw, sizeof(uint32Layout), abi);
    offsetrawptr(raw, -sizeof(uint32Layout), abi);
  `);
  for (const [index, signedness] of ["signed", "unsigned", "unsigned", "signed"].entries()) {
    const operation = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr", index));
    assert.ok(operation?.operation === "byte-offset");
    assert.equal(operation.offsetSignedness, signedness);
  }
});

test("zero-sized huge arrays supply a zero byte count without expanding their extent", () => {
  const checked = cleanMemorySession(`
    import { memoryarraylayout } from "@tsonic/core/lang.js";
    interface Empty {}
    const empty = memorylayout<Empty>({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, fields: [] });
    const huge = memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, elementlayout: empty, length: 9007199254740993n });
    offsetrawptr(raw, sizeof(huge), abi);
    offsetrawptr(raw, strideof(huge), abi);
  `);
  for (const name of ["sizeof", "strideof"]) {
    const observation = resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, name));
    assert.ok(observation?.kind === "resolved");
    assert.equal(observation.value, 0);
    assert.equal(observation.layout.kind === "array" && observation.layout.fixedArray.length, 9007199254740993n);
  }
  assert.equal(memoryCalls(checked, "offsetrawptr").length, 2);
});
