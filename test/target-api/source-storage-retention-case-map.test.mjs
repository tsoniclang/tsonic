import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceCallableRetentionQuery, createSourceStorageBudget, createSourceStorageQuery,
  defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";

function fixture(text) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {}; ${text}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const query = createSourceCallableRetentionQuery({ source, storage, budget });
  const declaration = name => {
    const selected = storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === name);
    if (selected !== undefined) return selected;
    const binding = storage.nodes.find(node => source.ast.is.IsVariableDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === name);
    const initializer = binding === undefined ? undefined : source.ast.as.AsVariableDeclaration(binding)?.Initializer;
    assert.equal(initializer !== undefined, true, `${name}: checked callable initializer`);
    return initializer;
  };
  return { source, storage, budget, declaration, retention: name => query.forDeclaration(declaration(name)) };
}

for (const [label, body] of [
  ["module function", "function child(): void {} child();"],
  ["nested function", "function start(): void { function child(): void {} child(); } start();"],
  ["module arrow", "const child = (): void => {}; child();"],
  ["nested arrow", "function start(): void { const child = (): void => {}; child(); } start();"],
  ["module function expression", "const child = function named(): void {}; child();"],
  ["nested function expression", "function start(): void { const child = function named(): void {}; child(); } start();"],
  ["const callable aliases", "function child(): void {} const first = child; const second = first; second();"],
  ["checked formal forwarding", "function child(): void {} function invoke(callback: () => void): void { callback(); } invoke(child);"],
  ["self recursive declaration", "function child(repeat: boolean): void { if (repeat) child(false); } child(true);"],
  ["mutual declarations", "function child(repeat: boolean): void { if (repeat) other(false); } function other(repeat: boolean): void { if (repeat) child(false); } child(true);"],
]) {
  test(`callable creation and execution case map: ${label}`, () => {
    const current = fixture(body);
    const selected = current.retention("child");
    assert.equal(selected.kind === "resolved", true, `${label}: ${selected.reason ?? selected.kind}`);
    assert.equal(selected.retention, "scoped", `${label}: nonescaping checked calls`);
    assert.equal(selected.witnesses.length > 0, true, `${label}: nonempty original use proof`);
    assert.equal(current.budget.failure() === undefined, true, `${label}: finite completed query`);
  });
}

test("declaration capture facts distinguish an enclosing binding from its invoked body", () => {
  const current = fixture(`
    function moduleValue(): void {}
    function start(): void {
      function child(repeat: boolean): void { if (repeat) child(false); }
      function sibling(): void { child(false); moduleValue(); }
      child(true);
      sibling();
    }
    moduleValue();
    start();
  `);
  const { ast } = current.source;
  const moduleUses = current.source.navigation.declarationUses(current.declaration("moduleValue"));
  assert.equal(moduleUses.filter(use => use.kind === "direct-call").length, 2, "two exact module references");
  assert.equal(moduleUses.every(use => !use.captured), true, "a nested use does not allocate module capture storage");
  const child = current.declaration("child");
  const uses = current.source.navigation.declarationUses(child).filter(use => use.kind === "direct-call");
  assert.equal(uses.length, 3, "direct, recursive and sibling references retained");
  for (const use of uses) {
    let owner = ast.parent(use.reference);
    while (owner !== undefined && !ast.is.IsFunctionDeclaration(owner)) owner = ast.parent(owner);
    const name = owner === undefined ? undefined : ast.text(ast.name(owner));
    assert.equal(use.captured, name === "sibling", `${name}: only the sibling captures the enclosing child binding`);
  }
});

const deferred = `declare const pending: Promise<void>;
  async function later(ready: Promise<void>, callback: () => void): Promise<void> { await ready; callback(); }
  function forward(ready: Promise<void>, callback: () => void): Promise<void> { return later(ready, callback); }`;

for (const [label, expression] of [
  ["direct receiving await", "await later(ready, child);"],
  ["forwarded receiving await", "await forward(ready, child);"],
  ["immediate receiving local", "const result = later(ready, child); await result;"],
  ["wrapped receiving local", "const result = ((later(ready, child))); await (result);"],
]) {
  test(`original caller lifetime case map: ${label}`, () => {
    const current = fixture(`${deferred}
      async function start(ready: Promise<void>): Promise<void> {
        const text = "live";
        function child(): void { void text; }
        ${expression}
      }
      void start(pending);
    `);
    const selected = current.retention("child");
    assert.equal(selected.kind === "resolved", true, `${label}: ${selected.reason ?? selected.kind}`);
    assert.equal(selected.retention, "scoped", `${label}: original receiving activation completes before creator`);
    assert.equal(selected.witnesses.length > 0, true, `${label}: exact nonempty proof`);
  });
}

for (const [label, returnType, expression] of [
  ["discarded receiver", "void", "void later(ready, child);"],
  ["returned receiver", "Promise<void>", "return later(ready, child);"],
  ["returned forwarding receiver", "Promise<void>", "return forward(ready, child);"],
]) {
  test(`escaping creator lifetime case map: ${label}`, () => {
    const current = fixture(`${deferred}
      function start(ready: Promise<void>): ${returnType} {
        const text = "retained";
        function child(): void { void text; }
        ${expression}
      }
      void start(pending);
    `);
    const selected = current.retention("child");
    assert.equal(selected.kind === "resolved", true, `${label}: ${selected.reason ?? selected.kind}`);
    assert.equal(selected.retention, "retained", `${label}: actual receiving future escapes creator activation`);
    assert.equal(selected.witnesses.length > 0, true, `${label}: original escape witness retained`);
  });
}

test("opaque callback boundaries cannot become safe through an empty checked invocation graph", () => {
  const current = fixture("declare function opaque(callback: () => void): void; function child(): void {} opaque(child);");
  const selected = current.retention("child");
  assert.equal(selected.kind, "unresolved", "unknown native lifetime is not empty nonretention");
});

test("returned callable values preserve actual creator retention", () => {
  const current = fixture(`function create(): () => void {
    const text = "retained";
    function child(): void { void text; }
    return child;
  }
  const result = create();
  result();`);
  const selected = current.retention("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.retention, "retained", "returning the actual closure escapes its original creator");
});

for (const [label, declarations, read, expected] of [
  ["union member", `
    interface Box<Value> { readonly value: Value; }
    const box: Box<typeof first> | Box<typeof second> = selected ? { value: first } : { value: second };
  `, "box.value", ["first", "second"]],
  ["union tuple", `
    const pair: [typeof first, null] | [typeof second, undefined] = selected ? [first, null] : [second, undefined];
  `, "pair[0]", ["first", "second"]],
  ["union array", `
    const values: (typeof first)[] | (typeof second)[] = selected ? [first] : [second];
  `, "values[0]", ["first", "second"]],
  ["generic projected return", `
    interface Box<Value> { readonly value: Value; }
    function project<Value>(box: Box<Value>): Value { return box.value; }
    const box: Box<typeof first | typeof second> = { value: selected ? first : second };
  `, "project(box)", ["first", "second"]],
  ["guarded one-state absence", `
    interface Box<Value> { readonly value: Value; }
    const box: Box<typeof first | typeof second> | null | undefined = selected ? { value: first } : undefined;
  `, "box === null || box === undefined ? second : box.value", ["first", "second"]],
]) {
  test(`checked storage projection case map: ${label}`, () => {
    const current = fixture(`declare const selected: boolean;
      const first = { left: 1 }; const second = { right: 2 };
      ${declarations}
      const result = ${read};`);
    const { ast } = current.source;
    const variable = name => current.storage.nodes.find(node => ast.is.IsVariableDeclaration(node) &&
      ast.text(ast.name(node)) === name);
    const result = current.storage.subjectFor(variable("result"));
    assert.equal(result.kind === "resolved", true, `${label}: exact checked result storage`);
    const origins = current.storage.closedOriginsFor(result.subject);
    assert.equal(origins.kind === "complete", true, `${label}: ${origins.reason ?? origins.kind}`);
    assert.equal(origins.origins.length, expected.length, `${label}: no fabricated or merged producers`);
    for (const name of expected) {
      const initializer = ast.as.AsVariableDeclaration(variable(name))?.Initializer;
      assert.equal(initializer !== undefined && origins.origins.some(origin => origin.subject.node === initializer), true,
        `${label}: exact ${name} producer`);
    }
    assert.equal(current.storage.failureReason() === undefined, true, `${label}: finite exact projection`);
  });
}

test("whole-program formal origins traverse execution regions without losing per-call bindings", () => {
  const current = fixture(`function relay(value: object): object { return value; }
    const first = {}; const second = {};
    const firstResult = relay(first); const secondResult = relay(second);`);
  const { ast } = current.source;
  const variable = name => current.storage.nodes.find(node => ast.is.IsVariableDeclaration(node) &&
    ast.text(ast.name(node)) === name);
  const formal = current.storage.subject(ast.parameters(current.declaration("relay"))[0], "input");
  assert.equal(formal.kind === "resolved", true, "exact unbound formal subject");
  const selected = current.storage.closedOriginsFor(formal.subject);
  assert.equal(selected.kind === "complete", true, selected.reason ?? selected.kind);
  assert.equal(selected.origins.length, 2, "both and only actual program activations contribute");
  for (const [result, original] of [["firstResult", "first"], ["secondResult", "second"]]) {
    const subject = current.storage.subjectFor(variable(result));
    assert.equal(subject.kind === "resolved", true, `${result}: exact checked subject`);
    const origins = current.storage.closedOriginsFor(subject.subject);
    const initializer = ast.as.AsVariableDeclaration(variable(original))?.Initializer;
    assert.equal(origins.kind === "complete" && origins.origins.length === 1 &&
      origins.origins[0].subject.node === initializer, true, `${result}: only its original caller`);
  }
  assert.equal(current.storage.failureReason() === undefined, true, "completed finite execution traversal");
});

test("an uncalled formal does not gain a producer from an empty execution selection", () => {
  const current = fixture("function unused(value: object): object { return value; }");
  const parameter = current.source.ast.parameters(current.declaration("unused"))[0];
  const subject = current.storage.subject(parameter, "input");
  assert.equal(subject.kind === "resolved", true, "exact uncalled formal");
  assert.equal(current.storage.closedOriginsFor(subject.subject).kind, "unresolved", "no zero-edge closed-value proof");
});

test("an exported formal keeps the external entry beside observed private calls", () => {
  const current = fixture(`export function relay(value: object): object { return value; }
    const original = {}; const result = relay(original);`);
  const parameter = current.source.ast.parameters(current.declaration("relay"))[0];
  const subject = current.storage.subject(parameter, "input");
  assert.equal(subject.kind === "resolved", true, "exact exported formal");
  const origins = current.storage.closedOriginsFor(subject.subject);
  assert.equal(origins.kind, "open", "observed callers do not close the exported input");
  assert.equal(origins.boundaries.some(boundary => boundary.kind === "external-input"), true,
    "the actual external entry remains explicit");
});
