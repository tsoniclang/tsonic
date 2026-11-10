import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node, Type } from "@tsonic/tsts";
import { tsonicKeepAliveFactKey, tsonicRawMemoryOperationFactKey } from "../../host-input/raw-memory-facts.js";
import { maximumMemoryLayoutDepth, snapshotMemoryLayout, tsonicDataLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "../../host-input/memory-layout-facts.js";
import { TargetCompilerResourceLimitFailure } from "@tsonic/target-api/artifacts";
import type { TsonicValueMemoryLayoutFact } from "../../host-input/memory-layout-facts.js";
import { captureDataLayoutRegistrations } from "../registrations.js";
import { valueMemoryLayout } from "./fixtures.js";
import { memoryTestRegistration } from "./programs.js";

function layoutFixture(): TsonicValueMemoryLayoutFact {
  const fieldType = {} as Type;
  const child: TsonicValueMemoryLayoutFact = {
    kind: "value",
    call: {} as Node, sourceType: fieldType, dataLayoutExpression: {} as Node,
    dataLayout: { providerDeclaration: { ...memoryTestRegistration.providerDeclaration }, ...memoryTestRegistration.descriptor },
    byteSize: 4n, byteAlignment: 4n, stride: 4n, fields: [],
  };
  return {
    kind: "value",
    call: {} as Node, sourceType: {} as Type, dataLayoutExpression: {} as Node,
    dataLayout: { providerDeclaration: { ...memoryTestRegistration.providerDeclaration }, ...memoryTestRegistration.descriptor },
    byteSize: 8n, byteAlignment: 4n, stride: 8n,
    fields: [{ call: {} as Node, sourceType: {} as Type, selector: {} as Node, selectedDeclaration: {} as Node,
      fieldType, byteOffset: 4n, byteAlignment: 4n, fieldLayoutExpression: {} as Node, fieldLayout: child }],
  };
}

test("layout snapshots deeply freeze metadata without freezing compiler subjects", () => {
  const input = layoutFixture();
  const captured = valueMemoryLayout(snapshotMemoryLayout(input));
  assert.notEqual(captured, input);
  assert.equal(captured.call, input.call);
  assert.ok(!Object.isFrozen(input.call));
  for (const record of [captured, captured.dataLayout, captured.dataLayout.providerDeclaration, captured.fields, captured.fields[0]]) {
    assert.ok(Object.isFrozen(record));
  }
  assert.ok(tsonicMemoryLayoutFactKey.equals(captured, snapshotMemoryLayout(input)));
  assert.ok(!tsonicMemoryLayoutFactKey.equals(captured, snapshotMemoryLayout({ ...input, stride: 12n })));
});

test("reachable captured-layout constructors validate forged fields and cannot accept a caller depth", () => {
  const input = layoutFixture(), genuine = valueMemoryLayout(snapshotMemoryLayout(input));
  const constructors = [genuine.constructor, Object.getPrototypeOf(Object.getPrototypeOf(genuine)).constructor];
  assert.equal(constructors.length, 2, "both the concrete and inherited constructor routes are retained");
  for (const constructor of constructors) {
    assert.equal(Object.isFrozen(constructor) && Object.isFrozen(constructor.prototype), true);
    for (const forged of [
      { ...input, byteSize: -1n },
      { ...input, fields: [{ ...input.fields[0]!, byteAlignment: 0n }] },
      { ...input, fields: [{ ...input.fields[0]!, fieldLayout: { ...input.fields[0]!.fieldLayout,
        dataLayout: { ...input.dataLayout, fingerprint: "foreign-ABI" } } }] },
    ]) assert.throws(() => Reflect.construct(constructor, [forged, 0]));
    let executions = 0;
    const accessor = Object.defineProperty({ ...input }, "fields", { get() { executions++; return input.fields; } });
    assert.throws(() => Reflect.construct(constructor, [accessor]));
    assert.equal(executions, 0, "a constructor does not execute a forged metadata accessor");
  }
  const independent = valueMemoryLayout(Reflect.construct(genuine.constructor, [genuine]));
  assert.equal(independent !== genuine && independent.fields === genuine.fields && Object.isFrozen(independent), true);
  assert.equal(tsonicMemoryLayoutFactKey.equals(genuine, independent), true);
});

test("reachable captured-layout constructors compute the exact depth128 boundary from genuine children", () => {
  const input = layoutFixture();
  let child = valueMemoryLayout(snapshotMemoryLayout({ ...input, byteSize: 0n, stride: 0n, fields: [] }));
  const parent = () => ({ ...child, fields: [{ ...input.fields[0]!, byteOffset: 0n,
    fieldType: child.sourceType, fieldLayout: child }] });
  for (let depth = 1; depth < maximumMemoryLayoutDepth; depth++) {
    const previous = child;
    child = valueMemoryLayout(Reflect.construct(child.constructor, [parent()]));
    assert.equal(child.fields.length === 1 && child.fields[0]!.fieldLayout === previous && Object.isFrozen(child.fields), true);
  }
  const independent = valueMemoryLayout(Reflect.construct(child.constructor, [child]));
  assert.equal(independent !== child && independent.fields === child.fields, true);
  assert.throws(() => Reflect.construct(child.constructor, [parent(), 0]), (failure: unknown) =>
    failure instanceof TargetCompilerResourceLimitFailure && failure.diagnostic.code === "TSONIC_COMPILER_RESOURCE_LIMIT" &&
    failure.diagnostic.evidence?.includes("depth=128") === true);
});

test("captured layouts install every validated field without dispatching a derived setter", () => {
  const input = layoutFixture(), genuine = valueMemoryLayout(snapshotMemoryLayout(input));
  let executions = 0;
  class Derived {
    set byteSize(value: bigint) { executions++; assert.equal(value >= 0n, true); }
    set fields(value: readonly object[]) { executions++; assert.equal(Array.isArray(value), true); }
  }
  const captured = valueMemoryLayout(Reflect.construct(genuine.constructor, [input], Derived));
  assert.equal(executions, 0);
  assert.equal(captured.byteSize, input.byteSize);
  assert.equal(captured.fields.length, input.fields.length);
  assert.equal(Object.isFrozen(captured), true);
  const names = Object.getOwnPropertyNames(genuine);
  assert.deepEqual(Object.getOwnPropertyNames(captured), names);
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(captured, name);
    assert.equal(descriptor !== undefined && "value" in descriptor && descriptor.writable === false &&
      descriptor.enumerable === true && descriptor.configurable === false, true, name);
  }
  assert.equal(tsonicMemoryLayoutFactKey.equals(genuine, captured), true);
});

for (const patch of [
  { byteSize: -1 }, { byteSize: 0.5 }, { byteSize: Number.MAX_SAFE_INTEGER + 1 },
  { byteAlignment: 0n }, { byteAlignment: 3n }, { stride: 4n }, { stride: 10n },
] as const) {
  test(`layout rejects invalid metadata ${Object.entries(patch).map(([key, value]) => key + "=" + String(value)).join(",")}`, () => {
    assert.throws(() => snapshotMemoryLayout({ ...layoutFixture(), ...patch } as never));
  });
}

test("layout rejects duplicate fields, incompatible field alignment and selected-width overflow", () => {
  const source = layoutFixture();
  const field = source.fields[0]!;
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: [field, field] }));
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: [{ ...field, byteOffset: 3n }] }));
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: [{ ...field, byteOffset: 12n }] }));
  assert.throws(() => snapshotMemoryLayout({ ...source, fields: [{ ...field, byteAlignment: 8n }] }));
  assert.throws(() => snapshotMemoryLayout({ ...source, byteSize: 2n ** 32n, stride: 2n ** 32n,
    dataLayout: { ...source.dataLayout, addressWidth: 32 } }));
});

test("zero-sized layouts and aligned strides remain expressible", () => {
  assert.equal(snapshotMemoryLayout({ ...layoutFixture(), byteSize: 0n, stride: 0n, fields: [] }).byteSize, 0n);
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

test("keepalive facts preserve the exact lexical call and protected value", () => {
  const source = { call: {} as Node, valueExpression: {} as Node, valueType: {} as Type, resultType: {} as Type };
  const fact = tsonicKeepAliveFactKey.snapshot(source);
  assert.ok(tsonicKeepAliveFactKey.equals(fact, source));
  assert.ok(!tsonicKeepAliveFactKey.equals(fact, { ...source, call: {} as Node }));
});
