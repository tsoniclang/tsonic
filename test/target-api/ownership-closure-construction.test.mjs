import assert from "node:assert/strict";
import test from "node:test";
import { createSourceSuspensionQuery } from "../../packages/target-api/dist/public/analysis.js";
import { closureFixture, borrowed } from "./ownership-closure-fixture.mjs";

const forwarded = argument => `
  function target(value = view.item) { return value; }
  function forward(value?: number) { return target(value); }
  await pending(); return forward(${argument});
`;
const fixture = closureFixture({ text: `
  async function suppliedForward(view: Lease<number>) { ${forwarded("1")} }
  async function omittedForward(view: Lease<number>) { ${forwarded("")} }
  async function maybeForward(view: Lease<number>) { ${forwarded("flag ? 1 : undefined")} }
  function buildFields(view: Lease<number>) {
    class FieldBox {
      value = view.item;
      callback = () => view.item;
      constructor(callback = () => view.item) { callback(); }
    }
    return new FieldBox();
  }
  function buildImplicit(view: Lease<number>) { class FieldBox { value = view.item; } return new FieldBox(); }
  async function fieldsAfter(view: Lease<number>) { await pending(); return buildFields(view); }
  async function implicitAfter(view: Lease<number>) { await pending(); return buildImplicit(view); }
  async function unusedFields(view: Lease<number>) { class Unused { value = view.item; } await pending(); return 0; }
  async function fieldEntry() {
    const owner = new Owner(1); const view = borrow(owner);
    await suppliedForward(view); await omittedForward(view); await maybeForward(view);
    await fieldsAfter(view); await implicitAfter(view); await unusedFields(view);
  }
` });

for (const [name, expected] of [["suppliedForward", false], ["omittedForward", true], ["maybeForward", true],
  ["fieldsAfter", true], ["implicitAfter", true], ["unusedFields", false]]) {
  test(`checked continuation closes ${name} with original caller and execution-region bindings`, () => {
    const selected = fixture.query.continuationFor(fixture.call(name, "fieldEntry"));
    assert.equal(borrowed(selected, name).length > 0, expected);
  });
}

test("field reads, captures and constructor default captures retain their distinct checked owners", () => {
  const selected = fixture.query.continuationFor(fixture.call("fieldsAfter", "fieldEntry"));
  const leases = borrowed(selected, "constructor class/default captures");
  const ast = fixture.source.ast;
  assert.equal(leases.some(dependency => ast.is.IsClassDeclaration(dependency.candidate)), true, "field initialization has the class identity");
  assert.equal(leases.some(dependency => ast.is.IsConstructorDeclaration(dependency.candidate)), true, "default captures have the constructor identity");
  assert.equal(leases.every(dependency => fixture.selectedDeclaration(dependency.retention.value.node) === fixture.declaration("borrow")), true,
    "both regions substitute the actual lease rather than a formal, receiver temporary or invented witness");
});

test("implicit source heritage without checked execution correspondence remains unresolved, never an empty constructor", () => {
  const current = closureFixture({ text: `
    function constructMissing(view: Lease<number>) {
      class Base { value = view.item; }
      class Derived extends Base { other = view.item; }
      return new Derived();
    }
    async function afterMissing(view: Lease<number>) { await pending(); return constructMissing(view); }
    async function missingEntry() { const owner = new Owner(1); const view = borrow(owner); await afterMissing(view); }
  ` });
  const selected = current.query.continuationFor(current.call("afterMissing", "missingEntry"));
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /Implicit heritage|Inherited construction/u);
});

test("an inferred settled result cannot be reused as an absent native invocation contract", () => {
  const current = closureFixture({ text: "function scalarFactory() { return nativeScalar(1); }" });
  const call = current.calls(current.declaration("scalarFactory"))[0];
  const query = createSourceSuspensionQuery({ ...current, premises: { suspensionFor: () => undefined } });
  assert.equal(query.forResult(call, current.storage.emptyBindings).kind, "never", "plain scalar result cannot suspend its adopter");
  const native = query.forCall(call, current.storage.emptyBindings);
  assert.equal(native.kind, "unresolved", "native invocation work still requires its own exact contract");
});

test("completed continuation caches cannot outlive a sticky exhausted owner budget", () => {
  const current = closureFixture();
  const call = current.call("after");
  assert.equal(current.query.continuationFor(call).kind, "resolved");
  current.budget.reject("Explicit finite owner exhaustion.");
  const selected = current.query.continuationFor(call);
  assert.equal(selected.kind, "unresolved");
  assert.equal(selected.reason, "Explicit finite owner exhaustion.");
});

test("actual callable aliases and conditional implementations close together without hiding an open alternative", () => {
  const current = closureFixture({ text: `
    declare const unknownReader: (view: Lease<number>) => Promise<number>;
    async function calleeAlternatives(view: Lease<number>) { const callback = flag ? after : beforeOnly; return await callback(view); }
    async function aliases(view: Lease<number>) { const callback = after; const alias = callback; return await alias(view); }
    async function openAlternative(view: Lease<number>) { const callback = flag ? after : unknownReader; return await callback(view); }
    async function alternativeEntry() {
      const owner = new Owner(1); const view = borrow(owner);
      await calleeAlternatives(view); await aliases(view); await openAlternative(view);
    }
  ` });
  for (const name of ["calleeAlternatives", "aliases"]) {
    assert.equal(borrowed(current.query.continuationFor(current.call(name, "alternativeEntry")), name).length > 0, true);
  }
  const open = current.query.continuationFor(current.call("openAlternative", "alternativeEntry"));
  assert.equal(open.kind, "unresolved", "one closed source callee does not certify the unclassified alternative");
});
