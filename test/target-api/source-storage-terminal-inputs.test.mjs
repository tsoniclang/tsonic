import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageScopes } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-scopes.js";
import { createSourceStorageScopedKeys } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-keys.js";
import { createSourceStorageBindingInputs } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-transport.js";
import { createSourceStorageInvocationInputs } from "../../packages/target-api/dist/target-analysis/source-storage/graph/invocation-inputs.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { sourceStorageReference } from "../../packages/target-api/dist/target-analysis/source-storage/graph/scoped-model.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" }, files: { "/src/index.ts": `export {};
      function pick(value?: object) { const read = () => value; return read; }
      function forward(value?: object) { return pick(value); }
      const original = {};
      const supplied = pick(original); const omitted = pick(); const sibling = pick();
      const first = forward(); const second = forward();
    ` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "actual optional-input source checks");
  const source = createTargetSourceProgram(checked);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget);
  const ast = source.ast;
  const named = name => transport.visitedNodes.find(node => (ast.is.IsFunctionDeclaration(node) || ast.is.IsVariableDeclaration(node)) &&
    ast.text(ast.name(node)) === name);
  const initializer = name => ast.as.AsVariableDeclaration(named(name)).Initializer;
  const inputs = createSourceStorageInvocationInputs(source, budget, transport.subject, transport.subjectFor,
    transport.accessorTargets, call => transport.unresolvedInvocations.has(call));
  const graph = createSourceStorageGraphQueries(budget);
  graph.seal();
  const scopes = createSourceStorageScopes(source, budget, transport.subject, inputs, graph, () => undefined);
  const keys = createSourceStorageScopedKeys(source, budget, { ...transport,
    bindingInputFor: createSourceStorageBindingInputs(ast, transport, budget) }, scopes);
  const pick = named("pick");
  const formal = transport.subject(ast.parameters(pick)[0], "input");
  const frame = name => scopes.frameFor(pick, initializer(name), scopes.empty, scopes.empty);
  return { source, budget, transport, scopes, keys, named, initializer, pick, formal, frame };
}

test("an omitted actual formal stays a terminal leaf instead of reading sibling invocation inputs", () => {
  const current = fixture();
  const omitted = current.frame("omitted");
  const supplied = current.frame("supplied");
  const selected = current.scopes.lookup(current.formal, omitted);
  assert.equal(selected?.kind === "replace" && selected.terms.length === 1, true);
  const leaf = selected.terms[0];
  assert.equal(leaf.kind === "leaf" && leaf.subject === current.formal && leaf.scope === omitted, true,
    "omission belongs to its real invocation, never a declaration or global empty frame");
  const actual = current.scopes.lookup(current.formal, supplied);
  assert.equal(actual?.kind === "replace" && actual.terms.every(term => term.subject !== current.formal), true);
  const key = current.keys.encode(sourceStorageReference(current.formal, omitted));
  assert.equal(typeof key, "string");
  assert.equal(current.keys.encode(leaf), key);
  assert.notEqual(key, current.keys.encode(sourceStorageReference(current.formal, supplied)));
  assert.notEqual(key, current.keys.encode(sourceStorageReference(current.formal, current.frame("sibling"))));
  for (let repeat = 0; repeat < 12; repeat += 1) {
    assert.equal(current.frame("omitted") === omitted, true);
    assert.equal(current.keys.encode(sourceStorageReference(current.formal, omitted)), key);
  }
  assert.equal(current.budget.failure() === undefined, true);
});

test("terminal receiver birth retains its exact active invocation instead of the surrounding module", () => {
  const current = fixture();
  const receiver = current.transport.subject(current.pick, "receiver");
  const first = { kind: "leaf", subject: receiver, scope: current.frame("omitted") };
  const second = { kind: "leaf", subject: receiver, scope: current.frame("sibling") };
  const key = current.keys.encode(first);
  assert.equal(typeof key, "string");
  assert.notEqual(current.keys.encode(second), key);
  assert.equal(current.keys.encode(first), key);
  const firstBirth = current.keys.birth(receiver, first.scope);
  const secondBirth = current.keys.birth(receiver, second.scope);
  assert.equal(firstBirth !== undefined && secondBirth !== undefined, true, "both actual receiver activations have exact birth evidence");
  assert.notEqual(firstBirth.key, secondBirth.key);
  assert.equal(current.budget.failure() === undefined, true);
});

test("the same forwarded actual call keeps distinct checked caller activations", () => {
  const current = fixture();
  const forward = current.named("forward");
  const inner = [...current.transport.invocations].find(node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.text(current.source.ast.as.AsCallExpression(node).Expression) === "pick" &&
    current.source.ast.arguments(node).length === 1 && current.source.ast.is.IsIdentifier(current.source.ast.arguments(node)[0]) &&
    current.source.ast.text(current.source.ast.arguments(node)[0]) === "value");
  const frames = ["first", "second"].map(name => {
    const caller = current.scopes.frameFor(forward, current.initializer(name), current.scopes.empty, current.scopes.empty);
    return current.scopes.frameFor(current.pick, inner, caller, current.scopes.empty);
  });
  const selected = frames.map(scope => current.keys.encode(sourceStorageReference(current.formal, scope)));
  assert.equal(selected.every(key => typeof key === "string"), true);
  assert.notEqual(selected[0], selected[1], "an identical inner AST call is not an identical invocation activation");
  assert.equal(current.budget.failure() === undefined, true);
});

test("declaration symbolic leaves and captured closure contexts remain independently encoded", () => {
  const current = fixture();
  const declaration = current.scopes.declarationFor(current.pick, current.scopes.empty);
  const symbolic = current.scopes.lookup(current.formal, declaration).terms[0];
  assert.equal(current.scopes.isSymbolic(symbolic), true);
  const symbolicKey = current.keys.encode(symbolic);
  assert.equal(typeof symbolicKey, "string");
  assert.notEqual(symbolicKey, current.keys.encode(sourceStorageReference(current.formal, current.frame("omitted"))));
  assert.equal(current.keys.encode(symbolic), symbolicKey);
  const closure = current.transport.subject(current.initializer("read"));
  const keys = ["supplied", "omitted", "sibling"].map(name =>
    current.keys.encode({ kind: "leaf", subject: closure, scope: current.frame(name) }));
  assert.equal(keys.every(key => typeof key === "string") && new Set(keys).size === 3, true,
    "only terminal own formals omit self-context; actual closure environments remain exact");
  assert.equal(current.budget.failure() === undefined, true);
});
