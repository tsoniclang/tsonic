import assert from "node:assert/strict";
import test from "node:test";
import { defaultSourceStorageLimits } from "../source-storage/model/resource-budget.js";
import { fixture, sourcePosition, sourceSpan, identity, declarations } from './generic-adoption-fixtures.js';
import { analyzeSourceDeclarationGenericAdoption } from "./generic-adoption.js";
import { createSourceDeclarationOwnershipBudget, sourceDeclarationOwnershipUnresolved } from "./contracts.js";
import type { SourceStorageLimits } from "../source-storage/model/types.js";

for (const [name, declaration, invoked] of declarations) {
  test(`generic adoption closes ${name} without refusing its ordinary actual`, () => {
    const current = fixture(`${declaration}\nconst promised = Promise.resolve(7); void ${invoked}(7); void ${invoked}(promised);`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.equal(selected.issues.length, 1, `${name}: exactly one concrete adopting instantiation`);
    const issue = selected.issues[0]!;
    assert.equal(current.textFor(issue.site), `${invoked}(promised)`, `${name}: refusal is on the actual call, not the generic body`);
    assert.equal(current.source.ast.is.IsTypeParameterDeclaration(issue.parameter), true, `${name}: actual parameter identity`);
    assert.equal(current.nodes.includes(issue.declaration) && current.nodes.includes(issue.operation), true,
      `${name}: declaration and first operation are real checked related nodes`);
    assert.deepEqual(issue.evidence, [
      ["declaration", issue.declaration] as const, ["first-sensitive-operation", issue.operation] as const,
    ].map(([kind, node]) => `${kind} index.ts:${sourcePosition(current.source, node).line}:${sourcePosition(current.source, node).column}`),
    `${name}: one shared owner publishes exact related source coordinates for both targets`);
    assert.deepEqual(issue.sourceSpan, sourceSpan(current.source, issue.site), `${name}: actual instantiation site span`);
    assert.equal(Object.isFrozen(selected.issues) && Object.isFrozen(issue), true, `${name}: immutable completed summary`);
  });
}

test("a class parameter and captured structural method are summarized at their actual constructors", () => {
  const current = fixture(`
    class Holder<T> { constructor(readonly value: T) {} async get(): Promise<T> { return this.value; } }
    function make<T>(value: T): { read(): Promise<T> } { return { async read(): Promise<T> { return value; } }; }
    const promised = Promise.resolve(7);
    void new Holder(7); void new Holder(promised); void make(7); void make(promised);
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "complete class summary");
  if (selected.kind !== "resolved") return;
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)).sort(), ["make(promised)", "new Holder(promised)"]);
});

for (const [name, extra, receiver, expression] of [
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
] as const) {
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
] as const) {
  test(`unknown ${name} receiver completion keeps its exact class binding fail-closed`, () => {
    const current = fixture(`${declaration}
      export function use(value: Contract<Promise<number>>) { return value.read(); }`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["value.read()"],
      "a bodyless native contract cannot erase the actual generic receiver instantiation");
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

for (const recursive of [false, true]) {
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
  assert.equal(selected.kind, "unresolved", "an open opaque result is not a closed nonresolver");
  if (selected.kind !== "unresolved") return;
  assert.equal(current.textFor(selected.at), "done(value)", "the exact unresolved operation is preserved");
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

for (const alias of [false, true]) for (const ordinary of [false, true]) {
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
      assert.equal(selected.kind, "unresolved", "opaque returned callable provenance stays unknown");
      if (selected.kind === "unresolved") assert.equal(current.textFor(selected.at), operation,
        "the actual demanded resolving call precedes an inferred latent native callback input");
    }
  });
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
  assert.equal(exhausted.kind === "unresolved" && exhausted.reason.includes("budget"), true,
    "budget exhaustion publishes neither an empty safe summary nor a partial refusal set");
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
  const selection = current.query(defaultSourceStorageLimits.maximumSteps, node => node === parameter);
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

for (const [name, body] of [
  ["unused-named", "async function unused() { return value; } return 1;"],
  ["discarded-arrow", "async () => value; return 1;"],
  ["type-only", "async function unused() { return value; } type OnlyType = typeof unused; return 1;"],
  ["erased-forwarding", "function unused() { return identity(value); } return 1;"],
]) {
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
] as const) {
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
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)).sort(),
    ["base.identity(promised)", "contract.identity(promised)"], "both actual generic signature instantiations require adoption");
});
function declaredQuery(current: ReturnType<typeof fixture>, limits: SourceStorageLimits = defaultSourceStorageLimits) {
  const node = current.nodes[0]!;
  const budget = createSourceDeclarationOwnershipBudget(node, limits);
  return analyzeSourceDeclarationGenericAdoption({ source: current.source, nodes: current.nodes, projectRoot: "/src", budget,
    premises: { completionFor(call, selected) {
      const semantics = current.source.semantics.forNode(call);
      const declaration = semantics.declarations.signatureDeclaration(selected.selectedSignature);
      if (declaration === undefined) return sourceDeclarationOwnershipUnresolved(call, "The unit native contract requires its real selected declaration.");
      const awaited = semantics.types.awaitedType(selected.sourceResultType);
      if (awaited !== undefined && semantics.types.isIdentical(awaited, selected.sourceResultType)) return { kind: "not-async" };
      return { kind: "async", resultPolicy: "must-observe", contract: { kind: "declaration", declaration,
        component: { selectedType: selected.sourceResultType, contextualCall: selected } } };
    } } });
}

for (const [name, declaration, invoked] of declarations) {
  test(`declaration-native adoption keeps the original ${name} source and exact generic call correspondence`, () => {
    const current = fixture(`${declaration}\nconst promised = Promise.resolve(7); void ${invoked}(7); void ${invoked}(promised);`);
    const selected = declaredQuery(current);
    assert.equal(selected.kind === "resolved", true, "the declared native relation completes without invocation history");
    if (selected.kind !== "resolved") return;
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
  const selected = declaredQuery(current, { ...defaultSourceStorageLimits, maximumSteps: 1 });
  assert.equal(selected.kind === "unresolved" && selected.cause.kind === "resource-limit" &&
    selected.cause.limit === 1 && current.nodes.includes(selected.cause.subject), true, "typed exact work exhaustion");
  assert.equal("issues" in selected, false, "an incomplete declared relation cannot publish successful partial issues");
});
