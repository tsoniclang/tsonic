import assert from "node:assert/strict";

import { test } from "node:test";

import { inspect } from "./requirements-fixtures.js";

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

for (const [name, before, after, reason] of [
  ["element write", "", "pointers[0] = logical;", /logical pointer/u],
  ["alias element write", "const alias = pointers;", "alias[0] = logical;", /logical pointer/u],
  ["alias binding replacement", "let alias = pointers;", "alias = [logical];", /logical pointer/u],
  ["container argument escape", "declare function mutate(values: Pointer<uint32>[]): void;", "mutate(pointers);", /container/u],
  ["method mutation", "", "pointers.push(logical);", /container/u],
  ["exported container", "", "export { pointers };", /container/u],
] as const){
test(`closed pointer container proof rejects ${name} even after a valid read`, () => {
    const result = inspect(`
      const original = allocateptr<uint32>(1);
      const logical = projectptr<uint32, uint32>(original, item => item, item => item);
      const pointers: Pointer<uint32>[] = [original];
      ${before}
      torawptr(pointers[0], uint32Layout);
      ${after}
    `);
    assert.equal(result.kind, "unproven");
    if (result.kind !== "unproven") return;
    assert.ok(result.issues.some(issue => reason.test(issue.reason)));
  });
}

test("a logical pointer in any array slot prevents a partial physical proof", () => {
  const result = inspect(`
    const original = allocateptr<uint32>(1);
    const pointers: Pointer<uint32>[] = [original, projectptr<uint32, uint32>(original, item => item, item => item)];
    torawptr(pointers[0], uint32Layout);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /logical pointer/u.test(issue.reason)));
});

test("selected function returns exclude nested getters methods and class expressions", () => {
  const result = inspect(`
    function make(): Pointer<uint32> {
      const original = allocateptr<uint32>(1);
      const nested = {
        get value() { return projectptr<uint32, uint32>(original, item => item, item => item); },
        method() { return projectptr<uint32, uint32>(original, item => item, item => item); }
      };
      const Nested = class { method() { return projectptr<uint32, uint32>(original, item => item, item => item); } };
      return original;
    }
    torawptr(make(), uint32Layout);
  `);
  assert.equal(result.kind, "origins");
  if (result.kind !== "origins") return;
  assert.equal(result.origins.length, 1);
});

test("container property getters never masquerade as stored pointer fields", () => {
  const result = inspect(`
    const holder = { get value(): Pointer<uint32> { return allocateptr<uint32>(1); } };
    torawptr(holder.value, uint32Layout);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /data properties/u.test(issue.reason)));
});

test("closed pointer container inspection shares the finite proof budget", () => {
  const result = inspect(`
    const pointers: Pointer<uint32>[] = [allocateptr<uint32>(1), allocateptr<uint32>(2)];
    const alias = pointers;
    torawptr(alias[0], uint32Layout);
  `, { budget: 3 });
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /budget exceeded/u.test(issue.reason)));
});

test("closed object pointer fields reject a logical replacement through an alias", () => {
  const result = inspect(`
    const pointer = allocateptr<uint32>(1);
    const holder = { pointer };
    const alias = holder;
    torawptr(holder.pointer, uint32Layout);
    alias.pointer = projectptr<uint32, uint32>(pointer, item => item, item => item);
  `);
  assert.equal(result.kind, "unproven");
  if (result.kind !== "unproven") return;
  assert.ok(result.issues.some(issue => /logical pointer/u.test(issue.reason)));
});

for (const [name, body, origins] of [
  ["array writes", `
    const values: Pointer<uint32>[] = [allocateptr<uint32>(1)];
    const alias = values;
    alias[0] = allocateptr<uint32>(2);
    values[1] = allocateptr<uint32>(3);
    torawptr(values[0], uint32Layout);
  `, 3],
  ["array rebinding", `
    let values: Pointer<uint32>[] = [allocateptr<uint32>(1)];
    values = [allocateptr<uint32>(2)];
    torawptr(values[0], uint32Layout);
  `, 2],
  ["object writes", `
    interface Holder { value: Pointer<uint32> }
    const holder: Holder = { value: allocateptr<uint32>(1) };
    const alias = holder;
    alias.value = allocateptr<uint32>(2);
    torawptr(holder.value, uint32Layout);
  `, 2],
  ["object rebinding", `
    interface Holder { value: Pointer<uint32> }
    let holder: Holder = { value: allocateptr<uint32>(1) };
    holder = { value: allocateptr<uint32>(2) };
    torawptr(holder.value, uint32Layout);
  `, 2],
  ["selected computed field", `
    interface Holder { value: Pointer<uint32>; other: Pointer<uint32> }
    const pointer = allocateptr<uint32>(1);
    const holder: Holder = { value: pointer, other: pointer };
    holder["value"] = allocateptr<uint32>(2);
    holder["other"] = projectptr<uint32, uint32>(pointer, item => item, item => item);
    torawptr(holder["value"], uint32Layout);
  `, 2],
  ["captured writes", `
    const values: Pointer<uint32>[] = [allocateptr<uint32>(1)];
    function replace(): void { values[0] = allocateptr<uint32>(2); }
    replace();
    torawptr(values[0], uint32Layout);
  `, 2],
] as const){
test(`pointer containers retain every exact origin across ${name}`, () => {
    const result = inspect(body);
    assert.equal(result.kind, "origins", result.kind === "unproven" ? result.issues.map(issue => issue.reason).join("\n") : "");
    if (result.kind !== "origins") return;
    assert.equal(result.origins.length, origins);
    assert.ok(result.origins.every(origin => origin.operation === "allocate"));
  });
}

test("pointer container writes cannot hide behind a distinct asserted property declaration", () => {
  const result = inspect(`
    interface First { value: Pointer<uint32> }
    interface Second { value: Pointer<uint32> }
    const pointer = allocateptr<uint32>(1);
    const holder: First = { value: pointer };
    const alias = holder as Second;
    alias.value = projectptr<uint32, uint32>(pointer, item => item, item => item);
    torawptr(holder.value, uint32Layout);
  `);
  assert.equal(result.kind, "unproven");
});

for (const operation of ["delete holder.value;", "delete (holder.value);", "const alias = holder; delete alias.value;"]){
test(`pointer container deletes cannot be mistaken for read-only uses: ${operation}`, () => {
    const result = inspect(`
      interface Holder { value?: Pointer<uint32> }
      const holder: Holder = { value: allocateptr<uint32>(1) };
      ${operation}
      torawptr(holder.value, uint32Layout);
    `);
    assert.equal(result.kind, "unproven");
    if (result.kind !== "unproven") return;
    assert.ok(result.issues.some(issue => /deletion/u.test(issue.reason)));
  });
}

test("a proved pointer container assignment to native absence retains its exact backing closure", () => {
  const result = inspect(`
    interface Holder { value?: Pointer<uint32> }
    const holder: Holder = { value: allocateptr<uint32>(1) };
    holder.value = undefined;
    torawptr(holder.value, uint32Layout);
  `);
  assert.equal(result.kind, "origins", "simple absence assignment is not an unproved deletion");
  if (result.kind !== "origins") return;
  assert.equal(result.origins.length, 1);
  assert.equal(result.origins[0]!.operation, "allocate");
  assert.equal(result.includesUndefined, true);
});
