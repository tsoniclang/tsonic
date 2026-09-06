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

test("closed pointer arrays retain every possible element origin through local aliases", () => {
  const result = inspect(`
    const pointers: Pointer<uint32>[] = [allocatePointer<uint32>(1), allocatePointer<uint32>(2)];
    const alias = pointers;
    const again = (alias);
    toRawPointer(again[0], uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.equal(result.origins.length, 2);
  assert.equal(result.includesUndefined, true);
});

test("closed pointer object properties use selected identity rather than field spelling", () => {
  const result = inspect(`
    interface Holder { value: Pointer<uint32>; other: Pointer<uint32> }
    const pointer = allocatePointer<uint32>(1);
    const holder: Holder = { value: pointer, other: projectPointer<uint32, uint32>(pointer, item => item, item => item) };
    const alias = holder;
    toRawPointer(alias.value, uint32Layout);
  `);
  assert.equal(result.kind, "origins", result.kind === "unproven" ? result.issues.map(issue => issue.reason).join("\n") : "");
  if (result.kind !== "origins") return;
  assert.equal(result.origins.length, 1);
  assert.equal(result.origins[0]!.operation, "allocate");
});

for (const [name, before, after] of [
  ["element write", "", "pointers[0] = logical;"],
  ["alias element write", "const alias = pointers;", "alias[0] = logical;"],
  ["alias binding replacement", "let alias = pointers;", "alias = [logical];"],
  ["container argument escape", "declare function mutate(values: Pointer<uint32>[]): void;", "mutate(pointers);"],
  ["method mutation", "", "pointers.push(logical);"],
  ["exported container", "", "export { pointers };"],
] as const) {
  test(`closed pointer container proof rejects ${name} even after a valid read`, () => {
    const result = inspect(`
      const original = allocatePointer<uint32>(1);
      const logical = projectPointer<uint32, uint32>(original, item => item, item => item);
      const pointers: Pointer<uint32>[] = [original];
      ${before}
      toRawPointer(pointers[0], uint32Layout);
      ${after}
    `);
    assert.equal(result.kind, "unproven");
    if (result.kind !== "unproven") return;
    assert.ok(result.issues.some(issue => /container/u.test(issue.reason)));
  });
}

test("a logical pointer in any array slot prevents a partial physical proof", () => {
  const result = inspect(`
    const original = allocatePointer<uint32>(1);
    const pointers: Pointer<uint32>[] = [original, projectPointer<uint32, uint32>(original, item => item, item => item)];
    toRawPointer(pointers[0], uint32Layout);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /logical pointer/u.test(issue.reason)));
});

test("selected function returns exclude nested getters methods and class expressions", () => {
  const result = inspect(`
    function make(): Pointer<uint32> {
      const original = allocatePointer<uint32>(1);
      const nested = {
        get value() { return projectPointer<uint32, uint32>(original, item => item, item => item); },
        method() { return projectPointer<uint32, uint32>(original, item => item, item => item); }
      };
      const Nested = class { method() { return projectPointer<uint32, uint32>(original, item => item, item => item); } };
      return original;
    }
    toRawPointer(make(), uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.equal(result.origins.length, 1);
});

test("container property getters never masquerade as stored pointer fields", () => {
  const result = inspect(`
    const holder = { get value(): Pointer<uint32> { return allocatePointer<uint32>(1); } };
    toRawPointer(holder.value, uint32Layout);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /data properties/u.test(issue.reason)));
});

test("closed pointer container inspection shares the finite proof budget", () => {
  const result = inspect(`
    const pointers: Pointer<uint32>[] = [allocatePointer<uint32>(1), allocatePointer<uint32>(2)];
    const alias = pointers;
    toRawPointer(alias[0], uint32Layout);
  `, { budget: 3 });
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /budget exceeded/u.test(issue.reason)));
});

test("closed object pointer fields reject replacement through an alias", () => {
  const result = inspect(`
    const pointer = allocatePointer<uint32>(1);
    const holder = { pointer };
    const alias = holder;
    toRawPointer(holder.pointer, uint32Layout);
    alias.pointer = projectPointer<uint32, uint32>(pointer, item => item, item => item);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /mutation/u.test(issue.reason)));
});
