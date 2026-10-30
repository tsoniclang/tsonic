import assert from "node:assert/strict";

import test from "node:test";

import { defaultSourceDeclarationOwnershipLimits } from "./contracts.js";

import { fixture, identity, declarations } from "./generic-adoption-fixtures.js";

import { declaredQuery } from "./generic-adoption-part-3.split-fixtures.js";

for (const [name, body] of Array.from([
  ["unused-named", "async function unused() { return value; } return 1;"],
  ["discarded-arrow", "async () => value; return 1;"],
  ["type-only", "async function unused() { return value; } type OnlyType = typeof unused; return 1;"],
  ["erased-forwarding", "function unused() { return identity(value); } return 1;"],
]).slice(2, 4)){
test(`generic adoption excludes only the canonical ${name} subtree`, () => {
    const current = fixture(`${identity}\nfunction consume<T>(value: T) { ${body} }
      const promised = Promise.resolve(1); void consume(promised);`);
    const selected = current.query();
    assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
      selected.kind === "unresolved" ? selected.reason : "an erased body has no runtime adoption operation");
  });
}

for (const [name, declaration, invoked] of [
  ["called-nested", "function consume<T>(value: T) { async function inner() { return value; } return inner(); }", "consume"],
  ["hoisted-call", "function consume<T>(value: T) { return inner(); async function inner() { return value; } }", "consume"],
  ["returned-arrow", "function consume<T>(value: T) { return async () => value; }", "consume"],
  ["stored-arrow", "function consume<T>(value: T) { const queue: (() => Promise<T>)[] = []; const later = async () => value; queue.push(later); }", "consume"],
  ["invoked-arrow", "function consume<T>(value: T) { return (async () => value)(); }", "consume"],
  ["overloaded", "function identity2<V>(value: V): Promise<V>; async function identity2<V>(value: V): Promise<V> { return value; }", "identity2"],
] as const){
test(`generic adoption retains the complete ${name} source domain`, () => {
    const current = fixture(`${declaration}\nconst promised = Promise.resolve(1); void ${invoked}(promised);`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), [`${invoked}(promised)`],
      "a runtime-reachable nested body or overload is never erased from adoption evidence");
  });
}

test("interface and abstract generic signatures stay fail-closed without a source implementation", () => {
  const current = fixture(`
    interface Contract { identity<Value>(value: Value): Promise<Value>; }
    abstract class Base { abstract identity<Value>(value: Value): Promise<Value>; }
    function reject(contract: Contract, base: Base, promised: Promise<number>): void {
      void contract.identity(promised); void base.identity(promised);
    }
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "two unknown source contracts");
  if (selected.kind !== "resolved") return;
  assert.equal(selected.issues.length, 0, "both bodyless declarations keep their completed native signatures");
  for (const expression of ["base.identity(promised)", "contract.identity(promised)"]) {
    const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
      current.textFor(node) === expression);
    assert.equal(call !== undefined, true, "the original native generic call remains checked");
    if (call === undefined) continue;
    const semantics = current.source.semantics.forNode(call);
    const completed = semantics.operations.call(call);
    const nativeDeclaration = completed === undefined ? undefined :
      semantics.declarations.signatureDeclaration(completed.selectedSignature);
    assert.equal(nativeDeclaration !== undefined && current.nodes.includes(nativeDeclaration) &&
      current.source.ast.body(nativeDeclaration) === undefined, true, "the actual selected native declaration has no source body");
    const bindings = completed?.sourceSelectedMethodTypeArguments;
    assert.equal(bindings?.length === 1 && semantics.types.awaitedType(bindings[0]!.selectedType) !== undefined &&
      !semantics.types.isIdentical(semantics.types.awaitedType(bindings[0]!.selectedType)!, bindings[0]!.selectedType), true,
      "the native signature preserves the original Promise-valued generic argument");
    if (bindings?.length !== 1) continue;
    const symbol = semantics.declarations.typeSymbol(bindings[0]!.typeParameter);
    assert.equal(symbol !== undefined && semantics.declarations.symbolDeclarations(symbol)
      .some(parameter => current.nodes.includes(parameter) && current.source.ast.is.IsTypeParameterDeclaration(parameter)), true,
    "the generic argument remains bound to its original checked formal");
  }
});

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
