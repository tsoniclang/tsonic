import assert from "node:assert/strict";

import test from "node:test";

import { defaultSourceDeclarationOwnershipLimits } from "./contracts.js";

import { fixture, identity } from "./generic-adoption-fixtures.js";

for (const [name, extra, receiver, expression] of Array.from([
  ["incoming", "", "Holder<Promise<number>>", "holder.get()"],
  ["aliased", "type Alias<V> = Holder<V>;", "Alias<Promise<number>>", "holder.get()"],
  ["finite-union", "", "Holder<number> | Holder<Promise<number>>", "holder.get()"],
  ["inherited", "class Derived<U> extends Holder<U> {}", "Derived<Promise<number>>", "holder.get()"],
  ["fixed-inherited", "class Derived extends Holder<Promise<number>> {}", "Derived", "holder.get()"],
  ["indexed-inherited", "class Derived<Parts extends unknown[]> extends Holder<Parts[0]> {}", "Derived<[Promise<number>]>", "holder.get()"],
  ["wrapped-inherited", "class Derived<Part> extends Holder<Promise<Part>> {}", "Derived<number>", "holder.get()"],
  ["conditional-inherited", "class Derived<Part> extends Holder<Part extends number ? number : Promise<number>> {}", "Derived<string>", "holder.get()"],
  ["parenthesized-call", "", "Holder<Promise<number>>", "(holder.get)()"],
  ["getter", "", "Holder<Promise<number>>", "holder.task"],
  ["method-value", "", "Holder<Promise<number>>", "holder.get"],
] as const).slice(7, 11)){
test(`generic adoption retains the actual ${name} receiver binding`, () => {
    const current = fixture(`class Holder<T> { constructor(readonly value: T) {}
      async get(): Promise<T> { return this.value; }
      get task(): Promise<T> { return this.get(); }
    } ${extra}
    export function use(holder: ${receiver}) { return ${expression}; }`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), [expression],
      "every actual receiver alternative is checked, without a callee-property duplicate");
  });
}

test("a receiver forwards sensitivity through the exact outer function binder", () => {
  const current = fixture(`class Holder<T> { constructor(readonly value: T) {}
    async get(): Promise<T> { return this.value; } }
    function forward<V>(holder: Holder<V>) { return holder.get(); }
    export function use(holder: Holder<Promise<number>>) { return forward(holder); }`);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "receiver forwarding");
  if (selected.kind !== "resolved") return;
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["forward(holder)"],
    "the owning checked call supplies the actual binding, not a guessed member spelling");
});

test("a synchronous class-binder result is native pass-through, not an invented async completion", () => {
  const current = fixture(`interface Method<Value> { read(): Value; }
    interface Property<Value> { read: () => Value; }
    abstract class Abstract<Value> { abstract read(): Value; }
    export function use(method: Method<Promise<number>>, property: Property<Promise<number>>,
      abstract: Abstract<Promise<number>>) {
      void method.read(); void property.read(); void abstract.read();
    }`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "no source await or async result adopts the class's native payload");
});

for (const [name, declaration] of [
  ["interface", "interface Contract<Value> { read(): Promise<Value>; }"],
  ["abstract", "abstract class Contract<Value> { abstract read(): Promise<Value>; }"],
  ["callable-property", "interface Contract<Value> { read: () => Promise<Value>; }"],
  ["class-callable-property", `class Contract<Value> { read: () => Promise<Value>;
    constructor(read: () => Promise<Value>) { this.read = read; } }`],
] as const){
test(`unknown ${name} receiver completion keeps its exact class binding fail-closed`, () => {
    const current = fixture(`${declaration}
      export function use(value: Contract<Promise<number>>) { return value.read(); }`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.equal(selected.issues.length, 0, "the bodyless declaration keeps its completed native signature");
    const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
      current.textFor(node) === "value.read()");
    assert.equal(call !== undefined, true, "the original native receiver call remains checked");
    if (call === undefined) return;
    const semantics = current.source.semantics.forNode(call);
    const completed = semantics.operations.call(call);
    const nativeDeclaration = completed === undefined ? undefined :
      semantics.declarations.signatureDeclaration(completed.selectedSignature);
    const receiver = completed?.sourceReceiver;
    const bindings = receiver === undefined ? undefined : semantics.types.typeArgumentBindings(receiver.type);
    assert.equal(nativeDeclaration !== undefined && current.nodes.includes(nativeDeclaration) &&
      current.source.ast.body(nativeDeclaration) === undefined, true, "the selected signature is the original bodyless declaration");
    assert.equal(bindings?.length === 1 && current.nodes.includes(bindings[0]!.declaration), true,
      "the receiver retains its exact checked generic formal");
    if (bindings?.length !== 1 || receiver === undefined) return;
    const symbol = semantics.declarations.typeSymbol(receiver.type);
    const owner = current.source.ast.parent(bindings[0]!.declaration);
    assert.equal(symbol !== undefined && owner !== undefined &&
      semantics.declarations.symbolDeclarations(symbol).includes(owner), true,
      "the formal belongs to the actual native receiver declaration");
    const argument = bindings[0]!.argumentType;
    const awaited = semantics.types.awaitedType(argument);
    assert.equal(awaited !== undefined && !semantics.types.isIdentical(awaited, argument), true,
      "the completed receiver binding keeps its original Promise-valued native payload");
  });
}

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
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["wrap(promised)"],
      "the matching value reaches the resolver through the exact finite helper executions");
  });
}

test("an opaque resolver result is unresolved, never an empty safe source summary", () => {
  const current = fixture(`declare function opaque<T>(value: T): T;
    function wrap<T>(value: T) { return new Promise<T>(resolve => { const done = opaque(resolve); done(value); }); }
    void wrap(Promise.resolve(7));`);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "declared adoption completes");
  if (selected.kind !== "resolved") return;
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["wrap(Promise.resolve(7))"],
    "the original source-bodied declared Promise instantiation owns its one adoption issue");
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
      assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["wrap(Promise.resolve(7))"],
        "the original outer declared instantiation owns its one adoption issue");
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
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["identity(Promise.resolve(value))"],
    "Awaited(actual) differs from the actual outer Promise regardless of the inner free parameter");
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

test("generic adoption provenance has one canonical Unicode/CRLF span and project-relative format", () => {
  const text = 'const marker = "界😀";\r\nasync function identity<Value>(value: Value) {\r\n\treturn value;\r\n}\r\n' +
    "export function reject(promised: Promise<number>): void {\r\n\tvoid identity(promised);\r\n}";
  const expectedSpan = { fileName: "index.ts", line: 6, column: 7, endLine: 6, endColumn: 25 };
  const expectedEvidence = ["declaration index.ts:2:1", "first-sensitive-operation index.ts:3:2"];
  const results = ["/checkout/rust/src", "/another/csharp/src"].map(root => {
    const current = fixture(text, root);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "complete provenance");
    if (selected.kind !== "resolved") return undefined;
    assert.equal(selected.issues.length, 1, `${root}: one actual instantiation`);
    const issue = selected.issues[0]!;
    assert.equal(current.textFor(issue.site), "identity(promised)", `${root}: unchanged original site`);
    assert.deepEqual(issue.sourceSpan, expectedSpan, `${root}: UTF-8 offsets, scalar columns and CRLF lines`);
    assert.deepEqual(issue.evidence, expectedEvidence, `${root}: one fixed shared related-location format`);
    assert.equal(Object.isFrozen(issue.sourceSpan) && Object.isFrozen(issue.evidence), true, `${root}: immutable publication`);
    return { sourceSpan: issue.sourceSpan, evidence: issue.evidence };
  });
  assert.deepEqual(results[0], results[1], "a different target checkout cannot change diagnostic provenance bytes");
});

test("mutual generic forwarding uses one finite SCC and keeps exact actual instantiation sites", () => {
  const current = fixture(`
    async function left<T>(value: T, count: number): Promise<void> { if (count > 0) await right(value, count - 1); }
    async function right<U>(value: U, count: number): Promise<void> {
      if (count > 0) await left(value, count - 1); void Promise.resolve(value);
    }
    const promised = Promise.resolve(7); void left(7, 2); void left(promised, 2);
  `);
  for (let count = 0; count < 2; count++) {
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "finite mutually recursive summary");
    if (selected.kind !== "resolved") continue;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["left(promised, 2)"]);
  }
  const exhausted = current.query(1);
  assert.equal(exhausted.kind === "unresolved" && exhausted.cause.kind === "resource-limit" &&
    exhausted.cause.category === "step" && exhausted.cause.limit === 1 &&
    current.nodes.includes(exhausted.cause.subject), true,
    "budget exhaustion publishes neither an empty safe summary nor a partial refusal set");
  assert.equal("issues" in exhausted, false, "an exhausted relation never publishes partial issues");
});

test("native payload containers, ordinary library generics and primitive constraints do not become generic adoption", () => {
  const current = fixture(`
    ${identity}
    async function primitive<T extends number>(value: T): Promise<T> { return value; }
    async function container<T>(value: T[]): Promise<T[]> { return value; }
    const promised = Promise.resolve(7);
    void identity(7); void identity("exact"); void primitive(7); void container([promised]);
    void [1, 2].map(async value => value); void Promise.all([promised]);
    async function library(): Promise<void> { await Promise.all([1, 2].map(async value => value)); }
  `);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "native payload containers and ambient generic binders are not adoption sites");
});

test("unknown and any actuals keep their checked non-thenable boundary", () => {
  const current = fixture(`${identity}\ndeclare const unknownValue: unknown; declare const anyValue: any;
    void identity(unknownValue); void identity(anyValue);`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "the checker, not Promise-shaped spelling, owns the actual awaitable selection");
});

test("target-owned erased lifetime parameters use their exact declarations, never a parameter-name guess", () => {
  const current = fixture(`async function marker<Region>(value: Region) { return value; }
    const promised = Promise.resolve(7); void marker(promised);`);
  const parameter = current.nodes.find(node => current.source.ast.is.IsTypeParameterDeclaration(node));
  assert.equal(parameter !== undefined, true, "actual target-marked parameter");
  const selection = current.query(defaultSourceDeclarationOwnershipLimits.maximumSteps, node => node === parameter);
  assert.equal(selection.kind === "resolved" && selection.issues.length === 0, true, "one explicit target-owned erased marker");
  const ordinary = current.query();
  assert.equal(ordinary.kind === "resolved" && ordinary.issues.length === 1, true, "the same name alone is never an exemption");
});

test("a project member named Promise.resolve is not a native Promise resolving owner", () => {
  const current = fixture(`export {};
    const local = { resolve<Value>(value: Value): Value { return value; } };
    function wrap<T>(value: T): void { void local.resolve(value); }
    const promised = Promise.resolve(7); void wrap(promised);
  `);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "only the actual checked configured-library/provider declaration owns Promise resolution");
});

for (const [name, body] of Array.from([
  ["unused-named", "async function unused() { return value; } return 1;"],
  ["discarded-arrow", "async () => value; return 1;"],
  ["type-only", "async function unused() { return value; } type OnlyType = typeof unused; return 1;"],
  ["erased-forwarding", "function unused() { return identity(value); } return 1;"],
]).slice(0, 2)){
test(`generic adoption excludes only the canonical ${name} subtree`, () => {
    const current = fixture(`${identity}\nfunction consume<T>(value: T) { ${body} }
      const promised = Promise.resolve(1); void consume(promised);`);
    const selected = current.query();
    assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
      selected.kind === "unresolved" ? selected.reason : "an erased body has no runtime adoption operation");
  });
}
