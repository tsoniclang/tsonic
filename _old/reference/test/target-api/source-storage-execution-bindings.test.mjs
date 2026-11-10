import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" }, files: { "/src/index.ts": `export {};
      function fallback() { return {}; }
      function target(value: object | null = fallback()) { return value; }
      function forward(value?: object | null) { return target(value); }
      function enter(maybe: object | undefined, spread: [object?]) {
        forward({}); forward(); forward(maybe); target(...spread); forward(null);
      }
    ` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "checked source execution defaults");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const ast = source.ast;
  const declarations = storage.nodes;
  const target = declarations.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "target");
  const forward = declarations.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "forward");
  const callName = node => ast.is.IsCallExpression(node) ? ast.text(ast.as.AsCallExpression(node).Expression) : undefined;
  const inner = storage.invocations.find(node => callName(node) === "target" && ast.arguments(node).length === 1 &&
    ast.is.IsIdentifier(ast.arguments(node)[0]));
  const calls = storage.invocations.filter(node => callName(node) === "forward").sort((left, right) => ast.pos(left) - ast.pos(right));
  const initializer = ast.as.AsParameterDeclaration(ast.parameters(target)[0]).Initializer;
  return { source, storage, target, forward, inner, calls, initializer, callName };
}

test("execution regions use exact caller substitutions for forwarded supplied, omitted and maybe arguments", () => {
  const current = fixture();
  for (const [index, call] of current.calls.entries()) {
    const caller = current.storage.bindingsForLexicalOwner(call);
    assert.equal(caller.kind, "resolved", "the uncalled enclosing declaration retains its actual symbolic inputs");
    const bindings = current.storage.bindingsForInvocation(current.forward, call, caller.bindings);
    assert.equal(bindings.kind === "resolved", true, "actual caller frame");
    const result = current.storage.executionRegionsFor(current.target, current.inner, bindings.bindings);
    assert.equal(result.kind === "resolved", true, result.kind === "unresolved" ? result.reason : "checked regions");
    assert.equal(result.nodes.includes(current.initializer), index !== 0, "only proven supplied actuals exclude defaults");
  }
  const caller = current.storage.bindingsForLexicalOwner(current.inner);
  assert.equal(caller.kind, "resolved", "the unspecialized forwarder has its original declaration context");
  const generic = current.storage.executionRegionsFor(current.target, current.inner, caller.bindings);
  assert.equal(generic.kind === "resolved" && generic.nodes.includes(current.initializer), true, "unspecialized presence stays conservative");
  const spread = current.storage.invocations.find(node => current.callName(node) === "target" &&
    current.source.ast.is.IsSpreadElement(current.source.ast.arguments(node)[0]));
  const spreadCaller = current.storage.bindingsForLexicalOwner(spread);
  assert.equal(spreadCaller.kind, "resolved", "an uncalled spread argument keeps its original enclosing declaration context");
  const result = current.storage.executionRegionsFor(current.target, spread, spreadCaller.bindings);
  assert.equal(result.kind === "resolved" && result.nodes.includes(current.initializer), true, "spread remains conservative");
});

test("execution regions reject foreign call, declaration and binding identities at the storage boundary", () => {
  const current = fixture();
  const foreign = fixture();
  for (const [candidate, invocation, bindings] of [
    [foreign.target, current.inner, current.storage.emptyBindings],
    [current.target, foreign.inner, current.storage.emptyBindings],
    [current.target, current.inner, foreign.storage.emptyBindings],
    [current.target, current.inner, { ...current.storage.emptyBindings }],
    [current.forward, current.inner, current.storage.emptyBindings],
  ]) {
    const result = current.storage.executionRegionsFor(candidate, invocation, bindings);
    assert.equal(result.kind, "unresolved", "foreign evidence is never an empty region proof");
  }
});
