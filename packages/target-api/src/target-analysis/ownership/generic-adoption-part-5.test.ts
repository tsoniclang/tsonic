import assert from "node:assert/strict";

import test from "node:test";

import { fixture, identity } from "./generic-adoption-fixtures.js";
import { checkedOperation } from "./generic-adoption-part-3-fixtures.js";

test("an ordinary helper does not become a resolver merely because its callback has the same signature", () => {
  const current = fixture(`function use<T>(value: T): Promise<number> { return new Promise<number>(resolve => {
    function observe(callback: (value: T) => void): void { callback(value); }
    observe(item => { void item; }); resolve(7);
  }); }
  export function run(value: Promise<number>) { return use(value); }`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "resolver provenance is actual storage identity, not callback type");
});

for (const recursive of [false, true]){
test(`resolver qualification preserves the whole ${recursive ? "recursive" : "direct"} callback/value row`, () => {
    const helper = recursive ? `function deliver<V>(callback: (value: V) => void, value: V, count: number): void {
      if (count > 0) bounce(callback, value, count - 1); else callback(value);
    } function bounce<U>(callback: (value: U) => void, value: U, count: number): void {
      if (count > 0) deliver(callback, value, count - 1); else callback(value);
    }` : "function deliver<V>(callback: (value: V) => void, value: V, count: number): void { callback(value); }";
    for (const reversed of [false, true]) {
      const calls = ["deliver(resolve, 7, 2);", "deliver(item => { void item; }, value, 2);"];
      const current = fixture(`${helper}
        function wrap<T>(value: T) { return new Promise<number>(resolve => {
          ${(reversed ? calls.slice().reverse() : calls).join("\n")}
        }); }
        void wrap(7); void wrap(Promise.resolve(7));`);
      const selected = current.query();
      assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
        selected.kind === "unresolved" ? selected.reason : "only 7 reaches the resolver in either activation order");
    }
  });

test(`a genuinely adopting ${recursive ? "recursive" : "direct"} resolver row retains its actual outer binder`, () => {
    const helper = recursive ? `function deliver<V>(callback: (value: V) => void, value: V, count: number): void {
      if (count > 0) bounce(callback, value, count - 1); else callback(value);
    } function bounce<U>(callback: (value: U) => void, value: U, count: number): void {
      if (count > 0) deliver(callback, value, count - 1); else callback(value);
    }` : "function deliver<V>(callback: (value: V) => void, value: V, count: number): void { callback(value); }";
    const current = fixture(`${helper}
      function wrap<T>(value: T) { return new Promise<T>(resolve => deliver(resolve, value, 2)); }
      const promised = Promise.resolve(7); void wrap(7); void wrap(promised);`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "same resolver activation");
    if (selected.kind !== "resolved") return;
    assert.equal(selected.issues.length, 0, "approved C1373: a matching declared Promise payload adopts natively");
    checkedOperation(current, "wrap(promised)");
  });
}

test("an opaque resolver result is unresolved, never an empty safe source summary", () => {
  const current = fixture(`declare function opaque<T>(value: T): T;
    function wrap<T>(value: T) { return new Promise<T>(resolve => { const done = opaque(resolve); done(value); }); }
    void wrap(Promise.resolve(7));`);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "declared adoption completes");
  if (selected.kind !== "resolved") return;
  assert.equal(selected.issues.length, 0, "approved C1373 E: the declared native callback type is sufficient");
  checkedOperation(current, "wrap(Promise.resolve(7))");
  const operation = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
    current.textFor(node) === "done(value)");
  assert.equal(operation !== undefined &&
    current.source.semantics.forNode(operation).operations.call(operation)?.sourceSelectedSignatureKind === "resolved", true,
    "the original inner operation remains authenticated without tracing its opaque callback");
});

test("an opaque resolver relation does not refuse a proven ordinary actual", () => {
  const current = fixture(`type Alias<Value> = (resolve: (value: Value) => void) => (value: Value) => void;
    function wrap<T>(value: T, alias: Alias<T>) { return new Promise<T>(resolve => {
      const done = alias(resolve); done(value);
    }); }
    void wrap<number>(7, resolve => resolve);`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "the actual number is proven non-adopting without inventing an alias body");
});

for (const alias of [false, true]){
for (const ordinary of [false, true]){
test(`observed resolving calls own latent native input uncertainty (${alias}, ${ordinary})`, () => {
    const operation = alias ? "forwarded(value)" : "done(value)";
    const current = fixture(`declare function opaque<T>(value: T): T;
      function wrap<T>(value: T) {
        return new Promise<T>(resolve => {
          const done = opaque(resolve);
          ${alias ? "const forwarded = done; forwarded(value);" : "done(value);"}
        });
      }
      void wrap(${ordinary ? "7" : "Promise.resolve(7)"});`);
    const selected = current.query();
    if (ordinary) {
      assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
        "a proven ordinary actual remains non-adopting through the same opaque relation");
    } else {
      assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "declared adoption completes");
      if (selected.kind !== "resolved") return;
      assert.equal(selected.issues.length, 0, "approved C1373 E: the original outer instantiation adopts natively");
      checkedOperation(current, "wrap(Promise.resolve(7))");
      const inner = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
        current.textFor(node) === operation);
      assert.equal(inner !== undefined &&
        current.source.semantics.forNode(inner).operations.call(inner)?.sourceSelectedSignatureKind === "resolved", true,
        "the original inner operation remains checked without following opaque callbacks or aliases");
    }
  });
}
}

test("a canonical Promise wrapper is adopting even when its payload still has an outer binder", () => {
  const current = fixture(`${identity}
    function wrap<Value>(value: Value) { return identity(Promise.resolve(value)); }
    void wrap(7);`);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "canonical Awaited wrapper");
  if (selected.kind !== "resolved") return;
  assert.equal(selected.issues.length, 0, "approved C1373: a closed outer Promise supports its still-generic payload");
  checkedOperation(current, "identity(Promise.resolve(value))");
});

test("an open direct binder and a native payload container propagate without becoming Promise wrappers", () => {
  const current = fixture(`${identity}
    function forward<Value>(value: Value) { return identity(value); }
    function container<Value>(value: Value) { return identity([Promise.resolve(value)]); }
    void forward(7); void container(7);`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "the native array is identical to its canonical Awaited type");
});
