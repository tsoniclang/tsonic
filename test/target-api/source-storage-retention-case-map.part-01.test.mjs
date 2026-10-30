import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { sourceDeclarationUses } from "../../packages/target-api/dist/source-navigation/declaration-uses.js";
import { sourceCallableValueParameters } from "../../packages/target-api/dist/source-navigation/callable-parameters.js";
import { sourceStorageFormalOwner } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceDeclarationRetentionQuery, createSourceDeclarationOwnershipValues, createSourceDeclarationOwnershipBudget,
  defaultSourceDeclarationOwnershipLimits, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { fixture, deferred } from "./source-storage-retention-case-map.split-fixtures.mjs";

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
  const definitions = sourceDeclarationUses(ast, child, [child, ast.name(child)]);
  assert.equal(definitions.every(use => !use.captured), true, "definition and its name are not runtime captures");
  const uses = current.source.navigation.declarationUses(child).filter(use => use.kind === "direct-call");
  assert.equal(uses.length, 3, "direct, recursive and sibling references retained");
  for (const use of uses) {
    let owner = ast.parent(use.reference);
    while (owner !== undefined && !ast.is.IsFunctionDeclaration(owner)) owner = ast.parent(owner);
    const name = owner === undefined ? undefined : ast.text(ast.name(owner));
    assert.equal(use.captured, name === "sibling", `${name}: only the sibling captures the enclosing child binding`);
  }
});

for (const [label, expression] of [
  ["direct receiving await", "await later(ready, child);"],
  ["forwarded receiving await", "await forward(ready, child);"],
  ["immediate receiving local", "const result = later(ready, child); await result;"],
  ["wrapped receiving local", "const result = ((later(ready, child))); await (result);"],
]){
test(`original caller lifetime case map: ${label}`, () => {
    const current = fixture(`${deferred}
      async function start(ready: Promise<void>): Promise<void> {
        const text = "live";
        function child(): void { void text; }
        ${expression}
      }
      void start(pending);
    `);
    const selected = current.select("child");
    assert.equal(selected.kind === "resolved", true, `${label}: ${selected.reason ?? selected.kind}`);
    assert.equal(selected.premises[0]?.kind, "retained", `${label}: original receiving activation completes before creator`);
    assert.equal(selected.premises.length > 0, true, `${label}: exact nonempty proof`);
  });
}

for (const [label, returnType, expression] of [
  ["discarded receiver", "void", "void later(ready, child);"],
  ["returned receiver", "Promise<void>", "return later(ready, child);"],
  ["returned forwarding receiver", "Promise<void>", "return forward(ready, child);"],
]){
test(`escaping creator lifetime case map: ${label}`, () => {
    const current = fixture(`${deferred}
      function start(ready: Promise<void>): ${returnType} {
        const text = "retained";
        function child(): void { void text; }
        ${expression}
      }
      void start(pending);
    `);
    const selected = current.select("child");
    assert.equal(selected.kind === "resolved", true, `${label}: ${selected.reason ?? selected.kind}`);
    assert.equal(selected.premises[0]?.kind, "retained", `${label}: actual receiving future escapes creator activation`);
    assert.equal(selected.premises.length > 0, true, `${label}: original escape witness retained`);
  });
}

test("opaque callback boundaries cannot become safe through an empty checked invocation graph", () => {
  const current = fixture("declare function opaque(callback: () => void): void; function child(): void {} opaque(child);", false);
  const selected = current.select("child");
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
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "returning the actual closure escapes its original creator");
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
]){
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

test("deferred callback lifetime follows the receiving input rather than the parameter's binding value", () => {
  const current = fixture(`${deferred}
    function start(ready: Promise<void>): void {
      const text = "retained";
      function child(): void { void text; }
      void later(ready, child);
    }
    start(pending);
  `);
  const owner = current.declaration("later");
  const parameters = sourceCallableValueParameters(current.source.ast, owner, current.source.semantics.forNode(owner),
    { kind: "declaration" });
  assert.equal(parameters?.length === 2, true, "the checked receiving signature has its two actual value parameters");
  const parameter = parameters[1];
  const binding = current.storage.subjectFor(parameter);
  const input = current.storage.subject(parameter, "input");
  assert.equal(binding.kind === "resolved" && binding.subject.kind === "value", true,
    "the parameter's physical binding value is not a formal activation port");
  assert.equal(input.kind === "resolved" && input.subject.kind === "input" && input.subject !== binding.subject, true,
    "the identical checked declaration has a distinct actual receiving input");
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved" && selected.premises[0]?.kind === "retained", true,
    "a discarded receiving future cannot be hidden by looking for an input owner on the binding-value subject");
  const { ast } = current.source;
  const receiving = current.storage.nodes.filter(node => {
    if (!ast.is.IsCallExpression(node)) return false;
    const expression = ast.as.AsCallExpression(node).Expression;
    if (!ast.is.IsIdentifier(expression) || ast.text(expression) !== "later") return false;
    const call = current.source.semantics.forNode(node).operations.call(node);
    return call !== undefined && call.sourceArguments.length === 2 &&
      call.sourceArguments.every((argument, index) => ast.is.IsIdentifier(argument.expression) &&
        ast.text(argument.expression) === ["ready", "child"][index]);
  });
  assert.equal(receiving.length, 1, "the fixture has one exact checked later(ready, child) invocation");
  assert.equal(selected.premises.some(premise => current.references("child").includes(premise.value.node) &&
    current.source.ast.is.IsCallExpression(current.source.ast.parent(premise.value.node))), true,
    "the actual original receiving call owns the escape");
});
