import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";

function fixture(text, options = {}) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src", compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; ${text}` },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const nodes = [];
  const pending = [file];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const declaration = name => nodes.find(node =>
    (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsFunctionDeclaration(node)) &&
    source.ast.text(source.ast.name(node)) === name);
  const initializer = name => Node_Initializer(source.ast, declaration(name));
  const storage = createSourceStorageQuery(source, [file], {
    ...defaultSourceStorageLimits, maximumSteps: 32_768, ...options.limits,
  }, options.effects);
  const subject = node => {
    const selected = storage.subjectFor(node);
    assert.equal(selected.kind === "resolved", true, "exact query-owned subject");
    return selected.subject;
  };
  return { source, file, nodes, declaration, initializer, storage, subject };
}

function exactResult(current, expression, expected, kind = "complete") {
  const selected = current.storage.closedOriginsFor(current.subject(expression));
  assert.equal(selected.kind === kind, true, `exact ${kind} selected result`);
  assert.equal(selected.origins.length === 1 && selected.origins[0].subject.node === expected, true,
    "only the selected caller's original result remains");
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.origins), true);
  assert.equal(current.storage.failureReason() === undefined, true, "unchanged finite guards remain intact");
  return selected;
}

for (const [name, input] of [
  ["direct callback", callback => callback],
  ["returned callback", callback => `identity(${callback})`],
  ["nested returned callback", callback => `identity(identity(${callback}))`],
]) {
  test(`selected ${name} keeps public bindings and automatic result flow correlated`, () => {
    const current = fixture(`
      function identity<Value>(value: Value): Value { return value; }
      function invoke(callback: () => object): object { return callback(); }
      const leftValue = { left: 1 };
      const rightValue = { right: 1 };
      const leftCallback = () => leftValue;
      const rightCallback = () => rightValue;
      const left = invoke(${input("leftCallback")});
      const right = invoke(${input("rightCallback")});
    `);
    const invoke = current.declaration("invoke");
    const formal = current.subject(current.source.ast.parameters(invoke)[0]);
    for (const name of ["left", "right"]) {
      exactResult(current, current.initializer(name), current.initializer(`${name}Value`));
      const selected = current.storage.bindingsForInvocation(invoke, current.initializer(name));
      assert.equal(selected.kind === "resolved", true, "exact selected invocation binding");
      const observed = current.storage.boundOriginsFor(formal, selected.bindings);
      assert.equal(observed.kind === "resolved" && observed.subjects.length === 1 &&
        observed.subjects[0].node === current.initializer(`${name}Callback`), true,
      "normalization cannot import a sibling callback through a shared return formal");
    }
  });
}

for (const [name, definition, input] of [
  ["default parameter", "function relay(value: () => object, selected = value): () => object { return selected; }", "relay(callback)"],
  ["getter", "function relay(value: () => object): () => object { return { get selected() { return value; } }.selected; }", "relay(callback)"],
  ["method", "function relay(value: () => object): () => object { return { selected() { return value; } }.selected(); }", "relay(callback)"],
  ["tuple projection", "function relay(value: () => object): () => object { return identity([value, () => ({})] as const)[0]; }", "relay(callback)"],
  ["record member", "function relay(value: () => object): () => object { return identity({ selected: value }).selected; }", "relay(callback)"],
]) {
  test(`returned callback ${name} preserves its own caller and selected value`, () => {
    const current = fixture(`
      function identity<Value>(value: Value): Value { return value; }
      function invoke(callback: () => object): object { return callback(); }
      ${definition}
      const leftValue = { left: 1 };
      const rightValue = { right: 1 };
      const leftCallback = () => leftValue;
      const rightCallback = () => rightValue;
      const left = invoke(${input.replace("callback", "leftCallback")});
      const right = invoke(${input.replace("callback", "rightCallback")});
    `);
    for (const name of ["left", "right"])
      exactResult(current, current.initializer(name), current.initializer(`${name}Value`));
  });
}

test("selected returned closure retains captured mutable locations rather than only normalized original values", () => {
  const current = fixture(`
    function retain<Value>(value: Value): () => Value { return () => value; }
    function invoke(callback: () => object): object { return callback(); }
    const original = {};
    export let exposed: object = original;
    const privateCallback = retain(original);
    const exposedCallback = retain(exposed);
    const privateResult = invoke(privateCallback);
    const exposedResult = invoke(exposedCallback);
  `);
  exactResult(current, current.initializer("privateResult"), current.initializer("original"));
  const selected = exactResult(current, current.initializer("exposedResult"), current.initializer("original"), "open");
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-write"), true,
    "same normalized producer does not erase the captured exposed storage witness");
});

for (const expression of ["owner.read()", 'owner["read"]()', "alias()", "identity(owner.read)()"])
  test(`property-held closure invocation ${expression} retains its own selected creator and public bindings`, () => {
    const current = fixture(`
      function identity<Value>(value: Value): Value { return value; }
      function make(token: object) { return { read: () => token }; }
      function invoke(owner: { read: () => object }): object {
        const alias = owner.read;
        return ${expression};
      }
      const leftValue = {}; const rightValue = {};
      const left = invoke(make(leftValue)); const right = invoke(make(rightValue));
    `);
    const invoke = current.declaration("invoke");
    const returned = current.storage.subject(invoke, "return");
    assert.equal(returned.kind === "resolved", true);
    for (const name of ["left", "right"]) {
      exactResult(current, current.initializer(name), current.initializer(`${name}Value`));
      const selected = current.storage.bindingsForInvocation(invoke, current.initializer(name));
      assert.equal(selected.kind === "resolved", true);
      const result = current.storage.closedOriginsFor(returned.subject, selected.bindings);
      assert.equal(result.kind === "complete" && result.origins.length === 1 &&
        result.origins[0].subject.node === current.initializer(`${name}Value`), true,
      "an implementation declaration cannot replace the actual property-held closure's environment");
    }
  });

test("recursive forwarding converges without importing sibling callback identities", () => {
  const current = fixture(`
    declare const done: boolean;
    function relay<Value>(value: Value): Value { if (done) return value; return relay(value); }
    function invoke(callback: () => object): object { return callback(); }
    const leftValue = { left: 1 };
    const rightValue = { right: 1 };
    const leftCallback = () => leftValue;
    const rightCallback = () => rightValue;
    const left = invoke(relay(leftCallback));
    const right = invoke(relay(rightCallback));
  `);
  for (const name of ["left", "right"])
    exactResult(current, current.initializer(name), current.initializer(`${name}Value`));
});

test("public invocation bindings preserve returned closure captures and correlated alternatives", () => {
  const current = fixture(`
    declare const choose: boolean;
    function retain<Value>(value: Value): () => Value { return () => value; }
    const original = {};
    export let exposed: object = original;
    const privateCallback = retain(original);
    const exposedCallback = retain(exposed);
    const privateResult = privateCallback();
    const exposedResult = exposedCallback();
    const alternative = choose ? privateCallback : exposedCallback;
    const alternativeResult = alternative();
  `);
  const closure = current.nodes.find(node => current.source.ast.is.IsArrowFunction(node));
  const returned = current.storage.subject(closure, "return");
  assert.equal(returned.kind === "resolved", true, "the exact authored closure return");
  for (const [name, kind] of [["privateResult", "complete"], ["exposedResult", "open"], ["alternativeResult", "open"]]) {
    const selected = current.storage.bindingsForInvocation(closure, current.initializer(name));
    assert.equal(selected.kind === "resolved", true, name);
    const value = current.storage.closedOriginsFor(returned.subject, selected.bindings);
    assert.equal(value.kind === kind && value.origins.length === 1 && value.origins[0].subject.node === current.initializer("original"),
      true, "public and automatic traversal consume the same exact captured contexts");
    if (kind === "open") assert.equal(value.boundaries.some(boundary => boundary.kind === "external-write"), true,
      "selected alternatives retain their actual writable location witness");
    exactResult(current, current.initializer(name), current.initializer("original"), kind);
    assert.equal(current.storage.bindingsForInvocation(closure, current.initializer(name)).bindings === selected.bindings, true,
      "the complete correlated family has stable query-owned identity");
  }
});

test("returned closure tuple projections retain both capture positions from exactly their own creation", () => {
  const current = fixture(`
    function retain<Left, Right>(left: Left, right: Right): () => readonly [Left, Right] { return () => [left, right] as const; }
    const firstLeft = { firstLeft: 1 }; const firstRight = { firstRight: 1 };
    const secondLeft = { secondLeft: 1 }; const secondRight = { secondRight: 1 };
    const firstCallback = retain(firstLeft, firstRight);
    const secondCallback = retain(secondLeft, secondRight);
    const first = firstCallback(); const second = secondCallback();
    const leftFirst = first[0]; const rightFirst = first[1];
    const leftSecond = second[0]; const rightSecond = second[1];
  `);
  for (const [name, expected] of [["leftFirst", "firstLeft"], ["rightFirst", "firstRight"], ["leftSecond", "secondLeft"], ["rightSecond", "secondRight"]])
    exactResult(current, current.initializer(name), current.initializer(expected));
});

test("selected constructor receiver keeps its allocation identity without recursive return expansion", () => {
  const current = fixture(`
    class Value { constructor() { return this; } }
    function identity<Type>(value: Type): Type { return value; }
    const original = new Value();
    const selected = identity(original);
  `);
  const identity = current.declaration("identity");
  const selected = current.storage.bindingsForInvocation(identity, current.initializer("selected"));
  assert.equal(selected.kind === "resolved", true, "constructor receiver remains an exact allocation");
  const formal = current.subject(current.source.ast.parameters(identity)[0]);
  const observed = current.storage.boundOriginsFor(formal, selected.bindings);
  assert.equal(observed.kind === "resolved" && observed.subjects.length === 1 &&
    observed.subjects[0].node === current.initializer("original"), true, "exact authored new expression");
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("explicit base construction retains its checked class callee, arguments and inherited member initialization", () => {
  const current = fixture(`
    class Base { constructor(public readonly value: object) {} }
    class Derived extends Base { constructor(value: object) { super(value); } }
    const leftValue = {}; const rightValue = {};
    const left = new Derived(leftValue).value;
    const right = new Derived(rightValue).value;
  `);
  for (const name of ["left", "right"])
    exactResult(current, current.initializer(name), current.initializer(`${name}Value`));
});

test("selected callback bindings reject foreign query evidence and exhausted analysis without a partial result", () => {
  const text = "function identity<Value>(value: Value): Value { return value; } const original = () => ({}); const selected = identity(original);";
  const current = fixture(text);
  const other = fixture(text);
  const selected = current.storage.bindingsForInvocation(current.declaration("identity"), current.initializer("selected"));
  assert.equal(selected.kind === "resolved", true);
  const foreign = other.storage.boundOriginsFor(other.subject(other.source.ast.parameters(other.declaration("identity"))[0]), selected.bindings);
  assert.equal(foreign.kind === "unresolved", true, "another query cannot reuse the binding witness");
  const exhausted = fixture(text, { limits: { maximumSteps: 1 } });
  assert.equal(exhausted.storage.subjectFor(exhausted.initializer("selected")).kind === "unresolved", true);
  assert.match(exhausted.storage.failureReason(), /analysis-work/u);
});
