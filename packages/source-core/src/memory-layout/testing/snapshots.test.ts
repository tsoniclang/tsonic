import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node, Type } from "@tsonic/tsts";
import { tsonicKeepAliveFactKey, tsonicRawMemoryOperationFactKey } from "../../pointers/raw-memory/facts.js";
import { snapshotMemoryLayout, tsonicDataLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "../facts.js";
import type { TsonicMemoryLayoutFact } from "../facts.js";
import { captureDataLayoutRegistrations } from "../registrations.js";
import { memoryTestRegistration } from "./fixtures.js";

function layoutFixture(): TsonicMemoryLayoutFact {
  return {
    call: {} as Node, sourceType: {} as Type, dataLayoutExpression: {} as Node,
    dataLayout: { providerDeclaration: { ...memoryTestRegistration.providerDeclaration }, ...memoryTestRegistration.descriptor },
    byteSize: 8, byteAlignment: 4, stride: 8,
    fields: [{ call: {} as Node, sourceType: {} as Type, selector: {} as Node, selectedDeclaration: {} as Node,
      fieldType: {} as Type, byteOffset: 4, byteAlignment: 4 }],
  };
}

test("layout snapshots deeply freeze metadata without freezing compiler subjects", () => {
  const input = layoutFixture();
  const captured = snapshotMemoryLayout(input);
  assert.notEqual(captured, input);
  assert.equal(captured.call, input.call);
  assert.ok(!Object.isFrozen(input.call));
  for (const record of [captured, captured.dataLayout, captured.dataLayout.providerDeclaration, captured.fields, captured.fields[0]]) {
    assert.ok(Object.isFrozen(record));
  }
  assert.ok(tsonicMemoryLayoutFactKey.equals(captured, snapshotMemoryLayout(input)));
  assert.ok(!tsonicMemoryLayoutFactKey.equals(captured, snapshotMemoryLayout({ ...input, stride: 12 })));
});

for (const patch of [
  { byteSize: -1 }, { byteSize: 0.5 }, { byteSize: Number.MAX_SAFE_INTEGER + 1 },
  { byteAlignment: 0 }, { byteAlignment: 3 }, { stride: 4 }, { stride: 10 },
] as const) {
  test(`layout rejects invalid metadata ${JSON.stringify(patch)}`, () => {
    assert.throws(() => snapshotMemoryLayout({ ...layoutFixture(), ...patch }));
  });
}

test("layout rejects duplicate fields, incompatible field alignment and selected-width overflow", () => {
  const source = layoutFixture();
  const field = source.fields[0]!;
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: [field, field] }));
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: [{ ...field, byteOffset: 3 }] }));
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: [{ ...field, byteOffset: 12 }] }));
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: [{ ...field, byteAlignment: 8 }] }));
  assert.throws(() => snapshotMemoryLayout({ ...source, byteSize: 2 ** 32, stride: 2 ** 32,
    dataLayout: { ...source.dataLayout, addressWidth: 32 } }));
});

test("zero-sized layouts and aligned strides remain expressible", () => {
  assert.equal(snapshotMemoryLayout({ ...layoutFixture(), byteSize: 0, stride: 0, fields: [] }).byteSize, 0);
});

test("layout field arrays reject accessors and custom traversal without executing them", () => {
  const source = layoutFixture();
  let executions = 0;
  const accessor = Object.defineProperty([...source.fields], "0", {
    get() { executions += 1; return source.fields[0]; },
  });
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: accessor }), /own data property/u);
  const customMap = Object.assign([...source.fields], {
    map() { executions += 1; return source.fields; },
  });
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: customMap }), /extra fields/u);
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: new Array(1) }), /own data property/u);
  assert.equal(executions, 0);
});

test("ABI registration arrays reject accessor entries and custom iterators without executing them", () => {
  let executions = 0;
  const accessor = Object.defineProperty([memoryTestRegistration], "0", {
    get() { executions += 1; return memoryTestRegistration; },
  });
  assert.throws(() => captureDataLayoutRegistrations(accessor), /own data property/u);
  const iterable = Object.assign([memoryTestRegistration], {
    *[Symbol.iterator]() { executions += 1; yield memoryTestRegistration; },
  });
  assert.throws(() => captureDataLayoutRegistrations(iterable), /extra fields/u);
  assert.equal(executions, 0);
});

test("layout registration snapshots are mutation-proof and compare all ABI fields", () => {
  const registration = { providerDeclaration: { ...memoryTestRegistration.providerDeclaration }, descriptor: { ...memoryTestRegistration.descriptor } };
  const entries = captureDataLayoutRegistrations([registration, registration]);
  assert.equal(entries.size, 1);
  const captured = [...entries.values()][0]!;
  registration.providerDeclaration.providerId = "changed";
  registration.descriptor.fingerprint = "changed";
  assert.equal(captured.providerDeclaration.providerId, "test.memory-abi");
  assert.equal(captured.fingerprint, "test-abi-v1-le64");
  for (const descriptor of [
    { ...memoryTestRegistration.descriptor, fingerprint: "v2" },
    { ...memoryTestRegistration.descriptor, byteOrder: "big" as const },
    { ...memoryTestRegistration.descriptor, addressWidth: 32 as const },
  ]) {
    assert.throws(() => captureDataLayoutRegistrations([memoryTestRegistration, { ...memoryTestRegistration, descriptor }]));
    assert.ok(!tsonicDataLayoutFactKey.equals(captured, { ...captured, ...descriptor }));
  }
});

test("fact snapshots reject extra keys, missing evidence, and accessors without executing them", () => {
  const value = { operation: "reinterpret" as const, call: {} as Node, resultType: {} as Type,
    rawExpression: {} as Node, rawType: {} as Type, pointeeType: {} as Type,
    layoutExpression: {} as Node, layoutType: {} as Type };
  const fact = tsonicRawMemoryOperationFactKey.snapshot(value);
  assert.equal("explicitPointeeTypeNode" in fact, false);
  assert.throws(() => tsonicRawMemoryOperationFactKey.snapshot({ ...value, unexpected: true } as typeof value));
  assert.throws(() => tsonicRawMemoryOperationFactKey.snapshot({ ...value, pointeeType: undefined } as unknown as typeof value));
  const accessor = Object.defineProperty({ ...value }, "rawExpression", { get() { assert.fail("Must not invoke accessor."); } });
  assert.throws(() => tsonicRawMemoryOperationFactKey.snapshot(accessor), /accessor/u);
  const discriminatorAccessor = Object.defineProperty({ ...value }, "operation", { get() { assert.fail("Must not invoke operation accessor."); } });
  assert.throws(() => tsonicRawMemoryOperationFactKey.snapshot(discriminatorAccessor), /discriminator/u);
  const nonEnumerable = Object.defineProperty({ ...value }, "rawExpression", { value: value.rawExpression, enumerable: false });
  const capturedNonEnumerable = tsonicRawMemoryOperationFactKey.snapshot(nonEnumerable);
  assert.ok(capturedNonEnumerable.operation === "reinterpret");
  assert.equal(capturedNonEnumerable.rawExpression, value.rawExpression);
  assert.ok(tsonicRawMemoryOperationFactKey.equals(fact,
    tsonicRawMemoryOperationFactKey.snapshot({ ...value, explicitPointeeTypeNode: undefined })));
  const symbol = Symbol("extra");
  const unexpectedSymbol = { ...value, [symbol]: true };
  assert.throws(() => tsonicRawMemoryOperationFactKey.snapshot(unexpectedSymbol));
});

test("query facts require exact selected field evidence only for field-offset observations", () => {
  const query = { operation: "size" as const, call: {} as Node, layoutExpression: {} as Node, layoutType: {} as Type, resultType: {} as Type };
  assert.ok(tsonicMemoryLayoutQueryFactKey.snapshot(query));
  assert.throws(() => tsonicMemoryLayoutQueryFactKey.snapshot({ ...query, operation: "field-offset" }));
  assert.throws(() => tsonicMemoryLayoutQueryFactKey.snapshot({ ...query, selectedFieldDeclaration: {} as Node }));
});

test("keepAlive facts preserve the exact lexical call and protected value", () => {
  const source = { call: {} as Node, valueExpression: {} as Node, valueType: {} as Type, resultType: {} as Type };
  const fact = tsonicKeepAliveFactKey.snapshot(source);
  assert.ok(tsonicKeepAliveFactKey.equals(fact, source));
  assert.ok(!tsonicKeepAliveFactKey.equals(fact, { ...source, call: {} as Node }));
});
