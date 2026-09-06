import assert from "node:assert/strict";
import { test } from "node:test";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { createTsonicPointerBackingQueries } from "./requirements.js";
import { cleanMemorySession, memoryCall } from "../../memory-layout/testing/fixtures.js";
import { tsonicRawMemoryOperationFactKey } from "../raw-memory/facts.js";

const imports = `
import { allocatePointer, addressOf, projectPointer } from "@tsonic/core/lang.js";
`;

function inspect(sourceText: string, options: { closed?: boolean; budget?: number } = {}) {
  const checked = cleanMemorySession(imports + sourceText);
  const call = memoryCall(checked, "toRawPointer");
  const operation = checked.sourceFacts.getFact(call, tsonicRawMemoryOperationFactKey);
  assert.ok(operation?.operation === "to-raw");
  const queries = createTsonicPointerBackingQueries(createTargetSourceProgram(checked), {
    hasClosedCallers: () => options.closed ?? true,
    maximumValues: options.budget ?? 4096,
  });
  const result = queries.resolve(operation.pointerExpression);
  assert.equal(queries.resolve(operation.pointerExpression), result);
  assert.ok(Object.isFrozen(result));
  return result;
}

test("pointer backing finds every branch, alias and rebinding origin without choosing target storage", () => {
  const result = inspect(`
    let value: uint32 = 1;
    const original = addressOf(value);
    const allocated = allocatePointer<uint32>(2);
    let alias = original;
    alias = allocated;
    declare const condition: boolean;
    toRawPointer(condition ? alias : undefined, uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.deepEqual(result.origins.map(origin => origin.operation).sort(), ["address-of", "allocate"]);
  assert.equal(result.includesUndefined, true);
});

test("pointer backing follows exact selected generic parameters and source returns", () => {
  const result = inspect(`
    function pass<T>(pointer: Pointer<T>): Pointer<T> { return pointer; }
    function again(pointer: Pointer<uint32>): Pointer<uint32> { return pass(pointer); }
    const pointer = allocatePointer<uint32>(4);
    toRawPointer(again(pointer), uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.deepEqual(result.origins.map(origin => origin.operation), ["allocate"]);
});

test("pointer backing retains all incoming calls and parameter writes", () => {
  const result = inspect(`
    function pass(pointer: Pointer<uint32>): Pointer<uint32> {
      pointer = allocatePointer<uint32>(3);
      return pointer;
    }
    pass(allocatePointer<uint32>(1));
    toRawPointer(pass(allocatePointer<uint32>(2)), uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.equal(result.origins.length, 3);
});

test("default arguments participate even when undefined is explicitly passed", () => {
  const result = inspect(`
    const pointer = allocatePointer<uint32>(1);
    function pass(value: Pointer<uint32> = projectPointer<uint32, uint32>(pointer, item => item, item => item)) {
      return value;
    }
    toRawPointer(pass(undefined), uint32Layout);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /logical pointer/u.test(issue.reason)));
});

test("optional returned values retain the implicit undefined branch", () => {
  const result = inspect(`
    function pass(condition: boolean): Pointer<uint32> | undefined {
      if (condition) return allocatePointer<uint32>(1);
    }
    toRawPointer(pass(true), uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.equal(result.includesUndefined, true);
  assert.equal(result.origins.length, 1);
});

test("a logical projection cannot be hidden behind a successful incoming origin", () => {
  const result = inspect(`
    function pass(pointer: Pointer<uint32>): Pointer<uint32> { return pointer; }
    const pointer = allocatePointer<uint32>(1);
    pass(projectPointer<uint32, uint32>(pointer, value => value, value => value));
    toRawPointer(pass(pointer), uint32Layout);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /logical pointer/u.test(issue.reason)));
});

test("raw reinterpretation remains an exact origin with a separate target safety obligation", () => {
  const result = inspect(`
    const pointer = reinterpretRawPointer(raw, uint32Layout);
    toRawPointer(pointer, uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.deepEqual(result.origins.map(origin => origin.operation), ["reinterpret"]);
});

for (const [name, body, pattern] of [
  ["provider result", `declare function make(): Pointer<uint32>; toRawPointer(make(), uint32Layout);`, /implementation/u],
  ["open parameter", `function address(pointer: Pointer<uint32>) { return toRawPointer(pointer, uint32Layout); } address(allocatePointer<uint32>(1));`, /open caller/u],
  ["first-class call", `function pass(pointer: Pointer<uint32>) { return pointer; } const alias = pass; alias(allocatePointer<uint32>(2)); toRawPointer(pass(allocatePointer<uint32>(1)), uint32Layout);`, /first-class/u],
  ["container read", `const pointers = [allocatePointer<uint32>(1)]; toRawPointer(pointers[0], uint32Layout);`, /storage-flow/u],
  ["unanchored recursion", `function recurse(): Pointer<uint32> { return recurse(); } toRawPointer(recurse(), uint32Layout);`, /cyclic/u],
] as const) {
  test(`pointer backing does not invent evidence for ${name}`, () => {
    const result = inspect(body, { closed: name !== "open parameter" });
    assert.equal(result.kind, "unproven");
    if (result.kind !== "unproven") return;
    assert.ok(result.issues.some(issue => pattern.test(issue.reason)), result.issues.map(issue => issue.reason).join("\n"));
  });
}

test("pointer backing budget exhaustion never returns a partial origin set", () => {
  const result = inspect(`
    const pointer = allocatePointer<uint32>(1);
    const alias = pointer;
    toRawPointer(alias, uint32Layout);
  `, { budget: 2 });
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /budget exceeded/u.test(issue.reason)));
});
