import assert from "node:assert/strict";

import test from "node:test";

import { defaultSourceDeclarationOwnershipLimits } from "./contracts.js";

import { fixture, identity, declarations } from "./generic-adoption-fixtures.js";

import { declaredQuery } from "./generic-adoption-part-3-fixtures.js";

for (const [name, declaration, invoked] of declarations){
test(`declaration-native adoption keeps the original ${name} source and exact generic call correspondence`, () => {
    const current = fixture(`${declaration}\nconst promised = Promise.resolve(7); void ${invoked}(7); void ${invoked}(promised);`);
    const selected = declaredQuery(current);
    assert.equal(selected.kind === "resolved", true, "the declared native relation completes without invocation history");
    if (selected.kind !== "resolved") return;
    if (name === "generic callable body unknown") {
      assert.equal(selected.issues.length === 0, true, "C1298: the selected void return has no declared Promise adoption");
      for (const actual of ["7", "promised"]) assert.equal(current.nodes.some(node =>
        current.source.ast.is.IsCallExpression(node) && current.textFor(node) === `${invoked}(${actual})`), true,
      "C1298 preserves both original checked ordinary and Promise-valued calls");
      return;
    }
    assert.equal(selected.issues.length === 1, true, "one exact adopting generic instantiation");
    assert.equal(current.textFor(selected.issues[0]!.site) === `${invoked}(promised)`, true,
      "the ordinary actual and the adopting actual never cross-bind");
    assert.equal(current.source.ast.is.IsTypeParameterDeclaration(selected.issues[0]!.parameter), true, "the exact original binder remains");
  });
}

test("declaration-native generic completion supports an adequate abstract signature without a source body", () => {
  const current = fixture("declare function nativeRead<Value>(value: Value): Promise<Value>; void nativeRead(Promise.resolve(7));");
  const selected = declaredQuery(current);
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "an actual checked native declaration contract is not a missing runtime producer");
});

test("declaration-native generic callback inputs do not invent an asynchronous result contract", () => {
  const current = fixture(`
    function same<Part>(value: Part): Part { return value; }
    function invoke<Value>(callback: <Part>(value: Part) => Part, value: Value): void { void callback(value); }
    function root<Value>(value: Value): void { invoke(same, value); }
    void root(7); void root(Promise.resolve(7));
  `);
  const selected = declaredQuery(current);
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "a generic callable input alone is not a native adopting operation");
});

test("declaration-native generic callback adoption uses the completed result rather than every input", () => {
  const current = fixture(`
    async function ignore<Part>(value: Part): Promise<void> { void value; }
    function invoke<Value>(callback: <Part>(value: Part) => Promise<void>, value: Value): void { void callback(value); }
    function root<Value>(value: Value): void { invoke(ignore, value); }
    void root(7); void root(Promise.resolve(7));
  `);
  const selected = declaredQuery(current);
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "the native void output does not adopt a separate Promise-valued input");
});

test("declaration-native generic result identity does not recognize a project Promise spelling", () => {
  const current = fixture(`
    namespace Project { export interface Promise<Value> { readonly value: Value; } }
    function wrap<Value>(value: Value): Project.Promise<Value> { return { value }; }
    void wrap(7); void wrap(Promise.resolve(7));
  `);
  const selected = declaredQuery(current);
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "only the checked canonical Promise declaration owns the native adopting result contract");
});

test("declaration-native generic SCCs retain exact source instantiations independently of call order", () => {
  for (const reversed of [false, true]) {
    const calls = ["void left(7, 2);", "void left(promised, 2);"];
    if (reversed) calls.reverse();
    const current = fixture(`
      async function left<T>(value: T, count: number): Promise<void> { if (count > 0) await right(value, count - 1); }
      async function right<U>(value: U, count: number): Promise<void> {
        if (count > 0) await left(value, count - 1); void Promise.resolve(value);
      }
      const promised = Promise.resolve(7); ${calls.join(" ")}
    `);
    const selected = declaredQuery(current);
    assert.equal(selected.kind === "resolved", true, `finite declared SCC order=${reversed}`);
    if (selected.kind !== "resolved") continue;
    assert.equal(selected.issues.length === 1 && current.textFor(selected.issues[0]!.site) === "left(promised, 2)", true,
      "one declared generic relation preserves the actual promised call, not runtime rows");
  }
});

test("declaration-native canonical Promise wrappers keep their adoption boundary through an outer binder", () => {
  const current = fixture(`${identity}\nfunction wrap<Value>(value: Value) { return identity(Promise.resolve(value)); } void wrap(7);`);
  const selected = declaredQuery(current);
  assert.equal(selected.kind === "resolved" && selected.issues.length === 1 &&
    current.textFor(selected.issues[0]!.site) === "identity(Promise.resolve(value))", true,
    "a checked outer Promise is not erased merely because its payload contains a free binder");
});

test("declaration-native generic exhaustion is a resource result with the actual source and no partial issue publication", () => {
  const current = fixture(`${identity}\nvoid identity(Promise.resolve(7));`);
  const selected = declaredQuery(current, { ...defaultSourceDeclarationOwnershipLimits, maximumSteps: 1 });
  assert.equal(selected.kind === "unresolved" && selected.cause.kind === "resource-limit" &&
    selected.cause.limit === 1 && current.nodes.includes(selected.cause.subject), true, "typed exact work exhaustion");
  assert.equal("issues" in selected, false, "an incomplete declared relation cannot publish successful partial issues");
});
