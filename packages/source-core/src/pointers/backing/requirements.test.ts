import assert from "node:assert/strict";

import { test } from "node:test";

import { createTargetSourceProgram } from "@tsonic/target-api/source";

import { createTsonicPointerBackingQueries } from "./requirements.js";

import { cleanMemorySession, memoryCall } from "../../memory-layout/testing/fixtures.js";

import { tsonicRawMemoryOperationFactKey } from "../raw-memory/facts.js";

import { inspect } from "./requirements.split-fixtures.js";

for (const [expression, visitedValues] of [
  ["void 0", 1],
  ["(void 0)", 2],
  ["void visit()", 1],
  ["void projectptr<uint32, uint32>(ordinary!, item => item, item => item)", 1],
] as const){
test(`void result has no pointer backing: ${expression}`, () => {
    const result = inspect(`
      declare function visit(): void;
      torawptr<uint32>(${expression}, uint32Layout);
    `, { budget: visitedValues });
    assert.equal(result.kind, "origins");
    if (result.kind !== "origins") return;
    assert.deepEqual(result.origins, []);
    assert.equal(result.includesUndefined, true);
    assert.equal(result.visitedValues, visitedValues);
    assert.ok(Object.isFrozen(result.origins));
  });
}

test("void absence survives aliases, selected returns and physical alternatives", () => {
  const result = inspect(`
    function make(condition: boolean): Pointer<uint32> | undefined {
      const absent = void 0;
      return condition ? allocateptr<uint32>(1) : absent;
    }
    torawptr(make(true), uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.deepEqual(result.origins.map(origin => origin.operation), ["allocate"]);
  assert.equal(result.includesUndefined, true);
});

test("void arguments cannot hide a logical default pointer", () => {
  const result = inspect(`
    const pointer = allocateptr<uint32>(1);
    function pass(value: Pointer<uint32> = projectptr<uint32, uint32>(pointer, item => item, item => item)) {
      return value;
    }
    torawptr(pass(void 0), uint32Layout);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /logical pointer/u.test(issue.reason)));
});

test("void pointer evidence rejects a missing source operand", () => {
  const checked = cleanMemorySession("torawptr<uint32>(void 0, uint32Layout);");
  const call = memoryCall(checked, "torawptr");
  const operation = checked.sourceFacts.getFact(call, tsonicRawMemoryOperationFactKey);
  assert.ok(operation?.operation === "to-raw");
  const source = createTargetSourceProgram(checked);
  const queries = createTsonicPointerBackingQueries({
    ...source,
    ast: { ...source.ast, as: { ...source.ast.as, AsVoidExpression: () => undefined } },
  }, { hasClosedCallers: () => true, maximumValues: 1 });
  const result = queries.resolve(operation.pointerExpression);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.deepEqual(result.issues.map(issue => issue.reason), ["A void pointer value has no exact source operand."]);
});

test("void terminals do not bypass the source-value budget", () => {
  const result = inspect("torawptr<uint32>((void 0), uint32Layout);", { budget: 1 });
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /budget exceeded/u.test(issue.reason)));
});

test("pointer backing finds every branch, alias and rebinding origin without choosing target storage", () => {
  const result = inspect(`
    let value: uint32 = 1;
    const original = addressof(value);
    const allocated = allocateptr<uint32>(2);
    let alias = original;
    alias = allocated;
    declare const condition: boolean;
    torawptr(condition ? alias : undefined, uint32Layout);
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
    const pointer = allocateptr<uint32>(4);
    torawptr(again(pointer), uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.deepEqual(result.origins.map(origin => origin.operation), ["allocate"]);
});

test("pointer backing retains all incoming calls and parameter writes", () => {
  const result = inspect(`
    function pass(pointer: Pointer<uint32>): Pointer<uint32> {
      pointer = allocateptr<uint32>(3);
      return pointer;
    }
    pass(allocateptr<uint32>(1));
    torawptr(pass(allocateptr<uint32>(2)), uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.equal(result.origins.length, 3);
});

test("default arguments participate even when undefined is explicitly passed", () => {
  const result = inspect(`
    const pointer = allocateptr<uint32>(1);
    function pass(value: Pointer<uint32> = projectptr<uint32, uint32>(pointer, item => item, item => item)) {
      return value;
    }
    torawptr(pass(undefined), uint32Layout);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /logical pointer/u.test(issue.reason)));
});

test("optional returned values retain the implicit undefined branch", () => {
  const result = inspect(`
    function pass(condition: boolean): Pointer<uint32> | undefined {
      if (condition) return allocateptr<uint32>(1);
    }
    torawptr(pass(true), uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.equal(result.includesUndefined, true);
  assert.equal(result.origins.length, 1);
});

test("a logical projection cannot be hidden behind a successful incoming origin", () => {
  const result = inspect(`
    function pass(pointer: Pointer<uint32>): Pointer<uint32> { return pointer; }
    const pointer = allocateptr<uint32>(1);
    pass(projectptr<uint32, uint32>(pointer, value => value, value => value));
    torawptr(pass(pointer), uint32Layout);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /logical pointer/u.test(issue.reason)));
});

test("raw reinterpretation remains an exact origin with a separate target safety obligation", () => {
  const result = inspect(`
    const pointer = reinterpretrawptr(raw, uint32Layout);
    torawptr(pointer, uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.deepEqual(result.origins.map(origin => origin.operation), ["reinterpret"]);
});

for (const [name, body, pattern] of [
  ["provider result", `declare function make(): Pointer<uint32>; torawptr(make(), uint32Layout);`, /implementation/u],
  ["open parameter", `function address(pointer: Pointer<uint32>) { return torawptr(pointer, uint32Layout); } address(allocateptr<uint32>(1));`, /open caller/u],
  ["first-class call", `function pass(pointer: Pointer<uint32>) { return pointer; } const alias = pass; alias(allocateptr<uint32>(2)); torawptr(pass(allocateptr<uint32>(1)), uint32Layout);`, /first-class/u],
  ["unanchored recursion", `function recurse(): Pointer<uint32> { return recurse(); } torawptr(recurse(), uint32Layout);`, /cyclic/u],
] as const){
test(`pointer backing does not invent evidence for ${name}`, () => {
    const result = inspect(body, { closed: name !== "open parameter" });
    assert.equal(result.kind, "unproven");
    if (result.kind !== "unproven") return;
    assert.ok(result.issues.some(issue => pattern.test(issue.reason)), result.issues.map(issue => issue.reason).join("\n"));
  });
}

test("pointer backing budget exhaustion never returns a partial origin set", () => {
  const result = inspect(`
    const pointer = allocateptr<uint32>(1);
    const alias = pointer;
    torawptr(alias, uint32Layout);
  `, { budget: 2 });
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /budget exceeded/u.test(issue.reason)));
});

test("closed pointer arrays retain every possible element origin through local aliases", () => {
  const result = inspect(`
    const pointers: Pointer<uint32>[] = [allocateptr<uint32>(1), allocateptr<uint32>(2)];
    const alias = pointers;
    const again = (alias);
    torawptr(again[0], uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.equal(result.origins.length, 2);
  assert.equal(result.includesUndefined, true);
});

test("closed pointer object properties use selected identity rather than field spelling", () => {
  const result = inspect(`
    interface Holder { value: Pointer<uint32>; other: Pointer<uint32> }
    const pointer = allocateptr<uint32>(1);
    const holder: Holder = { value: pointer, other: projectptr<uint32, uint32>(pointer, item => item, item => item) };
    const alias = holder;
    torawptr(alias.value, uint32Layout);
  `);
  assert.equal(result.kind, "origins", result.kind === "unproven" ? result.issues.map(issue => issue.reason).join("\n") : "");
  if (result.kind !== "origins") return;
  assert.equal(result.origins.length, 1);
  assert.equal(result.origins[0]!.operation, "allocate");
});
