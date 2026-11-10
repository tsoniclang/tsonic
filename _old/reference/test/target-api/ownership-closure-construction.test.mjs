import assert from "node:assert/strict";
import test from "node:test";
import { createSourceDeclarationSuspensionQuery } from "../../packages/target-api/dist/public/analysis.js";
import { closureFixture, borrowed, nativeLeaseWitness } from "./ownership-closure-fixture.mjs";

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
  assert.equal(leases.every(dependency => nativeLeaseWitness(fixture, dependency)), true,
    "both regions retain the original checked read and its exact native owner, region and lifetime");
});

test("implicit source heritage closes actual inherited fields instead of treating a missing authored constructor as a native body", () => {
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
  const dependencies = borrowed(selected, "source inherited field closure");
  assert.equal(dependencies.length > 0, true);
  for (const name of ["Base", "Derived"]) assert.equal(dependencies.some(dependency =>
    current.source.ast.is.IsClassDeclaration(dependency.candidate) && current.source.ast.text(current.source.ast.name(dependency.candidate)) === name), true,
  `${name}: the actual class initializer binding is retained`);
});

test("inherited source constructor defaults, fields and nested real super calls retain checked lease correspondence", () => {
  const current = closureFixture({ text: `
    function buildInherited(view: Lease<number>, supplied: boolean) {
      class Base { first = view.item; constructor(callback = () => view.item) { callback(); } }
      class Middle extends Base { second = () => view.item; }
      class Derived extends Middle { third = view.item; constructor() { super(); } }
      return new Derived();
    }
    async function inheritedAfter(view: Lease<number>) { await pending(); return buildInherited(view, true); }
    async function inheritedEntry() { const owner = new Owner(1); const view = borrow(owner); await inheritedAfter(view); }
  ` });
  const selected = current.query.continuationFor(current.call("inheritedAfter", "inheritedEntry"));
  const dependencies = borrowed(selected, "actual inherited constructor continuation");
  assert.equal(dependencies.length > 0, true);
  for (const name of ["Base", "Middle", "Derived"]) assert.equal(dependencies.some(dependency =>
    current.source.ast.is.IsClassDeclaration(dependency.candidate) && current.source.ast.text(current.source.ast.name(dependency.candidate)) === name), true,
  `${name}: original field identity`);
  assert.equal(dependencies.some(dependency => current.source.ast.is.IsConstructorDeclaration(dependency.candidate)), true,
    "the inherited default closure is entered through its actual constructor binding");
  assert.equal(dependencies.every(dependency => nativeLeaseWitness(current, dependency)), true);
});

for (const [argument, expected] of [["() => 1", false], ["", true]]) {
  test(`implicit generic inherited constructor ${argument === "" ? "omission" : "supplied value"} selects only the checked default closure`, () => {
    const current = closureFixture({ text: `
      async function genericAfter(view: Lease<number>) {
        class Base<Value> { constructor(callback = () => view.item) { callback(); } }
        class Derived<Item> extends Base<Item> {}
        const Alias = Derived;
        await pending();
        return new Alias<number>(${argument});
      }
      async function genericEntry() { const owner = new Owner(1); const view = borrow(owner); await genericAfter(view); }
    ` });
    assert.equal(borrowed(current.query.continuationFor(current.call("genericAfter", "genericEntry")), "generic inherited default").length > 0, expected);
  });
}

test("an inherited native constructor without a checked body or pending contract is not an empty source implementation", () => {
  const current = closureFixture({ text: `
    declare class NativeBase { constructor(); }
    function constructNative(view: Lease<number>) {
      class Derived extends NativeBase { value = view.item; }
      return new Derived();
    }
    async function nativeConstructionAfter(view: Lease<number>) { await pending(); return constructNative(view); }
    async function nativeConstructionEntry() { const owner = new Owner(1); const view = borrow(owner); await nativeConstructionAfter(view); }
  ` });
  const selected = current.query.continuationFor(current.call("nativeConstructionAfter", "nativeConstructionEntry"));
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /native body contracts/u);
});

test("an inferred settled result cannot be reused as an absent native invocation contract", () => {
  const current = closureFixture({ text: "function scalarFactory() { return nativeScalar(1); }" });
  const call = current.calls(current.declaration("scalarFactory"))[0];
  const query = createSourceDeclarationSuspensionQuery({ ...current, premises: { suspensionFor: () => undefined } });
  assert.equal(query.forResult(call).kind, "never", "plain scalar result cannot suspend its adopter");
  const native = query.forCall(call);
  assert.equal(native.kind, "unresolved", "native invocation work still requires its own exact contract");
});

for (const resultFirst of [false, true]) {
  test(`result and native invocation decisions preserve their own complete contracts (${resultFirst})`, () => {
    const current = closureFixture({ text: "function scalarFactory() { return nativeScalar(1); }" });
    const call = current.calls(current.declaration("scalarFactory"))[0];
    let contracts = 0;
    const query = createSourceDeclarationSuspensionQuery({ ...current, premises: { suspensionFor(value, use) {
      contracts += 1;
      return current.native.suspensionFor(value, use);
    } } });
    const value = () => assert.equal(query.forResult(call).kind, "never", "plain scalar result stays immediate");
    const invocation = () => assert.equal(query.forCall(call).kind, "never", "native call retains its actual checked contract");
    for (const inspect of resultFirst ? [value, invocation] : [invocation, value]) inspect();
    assert.equal(contracts, 1, "the invocation contract is computed once and is never inferred from the scalar result");
  });
}

test("completed continuation caches cannot outlive a sticky exhausted owner budget", () => {
  const current = closureFixture({ limits: { maximumSteps: 32768 } });
  const call = current.call("after");
  assert.equal(current.query.continuationFor(call).kind, "resolved");
  while (current.budget.step(call)) {}
  const selected = current.query.continuationFor(call);
  assert.equal(selected.kind, "unresolved");
  assert.equal(selected === current.budget.failure() && selected.cause.kind === "resource-limit" &&
    selected.cause.subject === call && selected.cause.category === "step" && selected.cause.limit === 32768, true);
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
