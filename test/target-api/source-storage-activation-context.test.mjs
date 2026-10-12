import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, projectSourceFile } from "../fixtures/source-navigation.mjs";

async function fixture(name, text) {
  const checked = await checkedSource(name, {
    "globals.d.ts": `
      interface Object {} interface Function {} interface CallableFunction extends Function {}
      interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
      interface Number {} interface String {} interface RegExp {}
      interface Array<T> { [index: number]: T; length: number; }
      interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
    `,
    "src/index.ts": text,
  });
  assert.equal(checked.diagnostics.length, 0);
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const { ast } = source;
  const nodes = [];
  const visit = node => {
    nodes.push(node);
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const declaration = name => nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === name);
  const subject = (node, kind) => {
    const selected = storage.subject(node, kind);
    assert.equal(selected.kind, "resolved");
    return selected.subject;
  };
  return { ast, nodes, source, storage, declaration, subject };
}

function resolved(selection) {
  assert.equal(selection.kind, "resolved", selection.kind === "unresolved" ? selection.reason : "exact selection");
  return selection;
}

test("argument closure frontier retains its caller's symbolic enclosing activation", async () => {
  const { ast, nodes, storage, declaration, subject } = await fixture("source-activation-argument-capture", `
    export function source<Value>(callback: () => Value): Value { return callback(); }
    export function scoped<Value>(value: Value): Value { return source(() => value); }
  `);
  const owner = declaration("scoped");
  const callee = declaration("source");
  const invocation = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "source");
  const arrow = nodes.find(node => ast.is.IsArrowFunction(node));
  const independent = resolved(storage.bindingsForInvocation(callee, invocation)).bindings;
  resolved(storage.boundValueFrontierFor(subject(ast.parameters(callee)[0], "input"), independent, []));
  const callerBindings = resolved(storage.bindingsForDeclaration(owner)).bindings;
  const calledBindings = resolved(storage.bindingsForInvocation(callee, invocation, callerBindings)).bindings;
  const frontier = resolved(storage.boundValueFrontierFor(subject(ast.parameters(callee)[0], "input"), calledBindings, []));
  assert.equal(frontier.frontier.length, 1, "one exact argument closure activation");
  assert.equal(frontier.frontier[0].subject.node === arrow, true);
  const activation = resolved(storage.boundActivationsFor(owner, frontier.frontier[0].bindings));
  assert.equal(activation.activations.length === 1 && activation.activations[0].kind === "declaration" &&
    activation.activations[0].bindings === callerBindings, true);
  const boundary = subject(arrow, "value");
  const stopped = resolved(storage.boundValueFrontierFor(subject(ast.parameters(callee)[0], "input"), calledBindings, [boundary]));
  assert.equal(stopped.frontier.length === 1 && stopped.frontier[0].kind === "boundary" &&
    stopped.frontier[0].subject === boundary && stopped.frontier[0].bindings === callerBindings, true,
  "a closure expression boundary retains its creation environment");
  assert.equal(storage.boundActivationsFor(arrow, stopped.frontier[0].bindings).kind, "unresolved",
    "creating a closure does not fabricate an activation of its body");
});

test("symbolic nested parameter frontier retains the declaration and its enclosing activation", async () => {
  const { ast, nodes, storage, declaration, subject } = await fixture("source-activation-nested-parameter", `
    export function run<Value>() {
      const read = (value: Value): Value => value;
      return read;
    }
  `);
  const owner = declaration("run");
  const arrow = nodes.find(node => ast.is.IsArrowFunction(node));
  const independent = resolved(storage.bindingsForDeclaration(arrow)).bindings;
  resolved(storage.boundValueFrontierFor(subject(ast.parameters(arrow)[0], "input"), independent, []));
  const enclosingBindings = resolved(storage.bindingsForDeclaration(owner)).bindings;
  const arrowBindings = resolved(storage.bindingsForDeclaration(arrow, enclosingBindings)).bindings;
  const frontier = resolved(storage.boundValueFrontierFor(subject(ast.parameters(arrow)[0], "input"), arrowBindings, []));
  assert.equal(frontier.frontier.length, 1, "one exact symbolic parameter activation");
  assert.equal(frontier.frontier[0].subject.node === ast.parameters(arrow)[0], true);
  const activation = resolved(storage.boundActivationsFor(arrow, frontier.frontier[0].bindings));
  const enclosing = resolved(storage.boundActivationsFor(owner, activation.activations[0].bindings));
  assert.equal(enclosing.activations.length === 1 && enclosing.activations[0].kind === "declaration" &&
    enclosing.activations[0].bindings === enclosingBindings, true);
  const independentAgain = resolved(storage.boundValueFrontierFor(subject(ast.parameters(arrow)[0], "input"), independent, []));
  assert.equal(independentAgain.frontier.length, 1, "query order cannot merge lexical contexts");
  assert.equal(storage.boundActivationsFor(owner, independentAgain.frontier[0].bindings).kind, "unresolved",
    "an independently selected declaration does not acquire an invented outer activation");
});

test("one nested declaration keeps symbolic and distinct invocation environments isolated in either query order", async () => {
  const { ast, nodes, storage, declaration, subject } = await fixture("source-activation-distinct-callers", `
    export function outer<Value>(value: Value) {
      const read = (item: Value): Value => item;
      return read;
    }
    const first = outer(1);
    const second = outer("second");
  `);
  const outer = declaration("outer");
  const arrow = nodes.find(node => ast.is.IsArrowFunction(node));
  const invocations = nodes.filter(node => ast.is.IsCallExpression(node));
  const parameter = subject(ast.parameters(arrow)[0], "input");
  const parents = [
    storage.emptyBindings,
    resolved(storage.bindingsForDeclaration(outer)).bindings,
    ...invocations.map(invocation => resolved(storage.bindingsForInvocation(outer, invocation)).bindings),
  ];
  const bindings = parents.map(parent => resolved(storage.bindingsForDeclaration(arrow, parent)).bindings);
  assert.equal(new Set(bindings).size, bindings.length, "each declared frame owns its exact parent");
  for (let pass = 0; pass < 3; pass += 1) {
    for (const index of pass === 1 ? [3, 2, 1, 0] : [0, 1, 2, 3]) {
      const selected = resolved(storage.boundValueFrontierFor(parameter, bindings[index], []));
      assert.equal(selected.frontier.length, 1, `context ${index}, pass ${pass}`);
      assert.equal(selected.frontier[0].subject === parameter && selected.frontier[0].bindings === bindings[index], true);
      const own = resolved(storage.boundActivationsFor(arrow, selected.frontier[0].bindings));
      assert.equal(own.activations.length === 1 && own.activations[0].kind === "declaration" &&
        own.activations[0].bindings === bindings[index], true);
      const enclosing = storage.boundActivationsFor(outer, own.activations[0].bindings);
      if (index === 0) {
        assert.equal(enclosing.kind, "unresolved", "no enclosing activation may be invented");
        continue;
      }
      resolved(enclosing);
      assert.equal(enclosing.activations.length, 1);
      const activation = enclosing.activations[0];
      assert.equal(activation.bindings === parents[index], true);
      assert.equal(activation.kind, index === 1 ? "declaration" : "invocation");
      assert.equal(Object.isFrozen(activation) && Object.isFrozen(activation.bindings), true);
      if (activation.kind === "invocation") {
        assert.equal(activation.invocation === invocations[index - 2], true);
        assert.equal(activation.callerBindings === storage.emptyBindings, true);
        const actual = resolved(storage.boundOriginsFor(subject(ast.parameters(outer)[0], "input"), activation.bindings));
        assert.equal(actual.subjects.length === 1 &&
          actual.subjects[0].node === ast.arguments(activation.invocation)[0], true,
        "number and string arguments retain their distinct exact source identities");
      }
      assert.equal(resolved(storage.bindingsForDeclaration(arrow, parents[index])).bindings === bindings[index], true,
        "repeated exact contexts reuse their canonical declaration frame");
    }
  }
  assert.equal(storage.failureReason(), undefined);
});

test("activation queries reject foreign and fabricated context identities without touching getters", async () => {
  const current = await fixture("source-activation-owned-contexts", "export function outer<Value>(value: Value) { return value; }");
  const foreign = await fixture("source-activation-foreign-contexts", "export function outer<Value>(value: Value) { return value; }");
  const owner = current.declaration("outer");
  const bindings = resolved(current.storage.bindingsForDeclaration(owner)).bindings;
  const accessor = Object.defineProperty({}, "substitutions", { get: () => assert.fail("forged bindings accessor executed") });
  for (const candidate of [foreign.storage.emptyBindings, {}, Object.create(bindings), accessor, null]) {
    assert.equal(current.storage.boundActivationsFor(owner, candidate).kind, "unresolved");
  }
  assert.equal(current.storage.boundActivationsFor(foreign.declaration("outer"), bindings).kind, "unresolved");
  const valid = resolved(current.storage.boundActivationsFor(owner, bindings));
  assert.equal(valid.activations.length === 1 && valid.activations[0].bindings === bindings, true,
    "invalid context queries cannot poison independently valid evidence");
});

test("activation selection preserves every independent source-storage resource limit", async () => {
  const current = await fixture("source-activation-budgets", "export function outer<Value>(value: Value) { return value; }");
  for (const limit of Object.keys(defaultSourceStorageLimits)) {
    const storage = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles,
      { ...defaultSourceStorageLimits, [limit]: 1 });
    assert.equal(storage.boundActivationsFor(current.declaration("outer"), storage.emptyBindings).kind, "unresolved", limit);
    assert.equal(storage.failureReason() !== undefined, true, limit);
  }
});
