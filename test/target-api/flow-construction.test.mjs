import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceControlFlow } from "../../packages/target-api/dist/target-analysis/flow/index.js";

const classes = `
  class Base {
    value = mark("base-field");
    constructor(input = mark("base-parameter")) { mark("base-body"); }
  }
  class Derived extends Base {
    other = mark("derived-field");
    constructor(input = mark("derived-parameter")) { super(); mark("derived-body"); }
  }
`;

function fixture(text) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; declare function mark(name: string): number; ${text}` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "unannotated authored construction checks");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const ast = source.ast;
  const named = name => storage.nodes.find(node => (ast.is.IsClassDeclaration(node) || ast.is.IsVariableDeclaration(node)) &&
    ast.text(ast.name(node)) === name);
  const construct = name => storage.invocations.find(node => ast.is.IsNewExpression(node) &&
    ast.text(ast.as.AsNewExpression(node).Expression) === name);
  const constructor = name => ast.members(named(name)).find(ast.is.IsConstructorDeclaration);
  return { source, storage, ast, named, construct, constructor };
}

function flow(current, declaration, call, callerBindings = current.storage.emptyBindings) {
  const selected = createSourceControlFlow(current.source, declaration, { invocation: { storage: current.storage, call, callerBindings } });
  assert.equal(selected.kind === "resolved", true, selected.kind === "unresolved" ? selected.reason : "checked graph");
  return selected.graph;
}

function marked(current, graph, name) {
  const found = graph.points.filter(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsCallExpression(point.source) && current.ast.arguments(point.source).some(argument =>
      current.ast.is.IsStringLiteral(argument) && current.ast.text(argument).includes(name)));
  assert.equal(found.length, 1, `${name}: one original evaluation`);
  return found[0];
}

function reachable(graph, from, to, exceptions = false) {
  const pending = [from];
  const seen = new Set();
  while (pending.length !== 0) {
    const selected = pending.pop();
    if (selected === to) return true;
    if (seen.has(selected)) continue;
    seen.add(selected);
    for (const edge of graph.points[selected].successors) if (exceptions || edge.kind !== "exception") pending.push(edge.to);
  }
  return false;
}

test("checked constructor flow agrees with Node's base-field, parameter, super and derived-field order", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e",
    `const events = []; function mark(name) { events.push(name); return 0; } ${classes}
     new Derived(); process.stdout.write(JSON.stringify(events));`], { encoding: "utf8", timeout: 10000, maxBuffer: 65536 });
  assert.deepEqual(JSON.parse(output), ["derived-parameter", "base-field", "base-parameter", "base-body", "derived-field", "derived-body"]);
  const current = fixture(`${classes} const instance = new Derived();`);
  const derived = current.constructor("Derived");
  const allocation = current.construct("Derived");
  const derivedFlow = flow(current, derived, allocation);
  const before = marked(current, derivedFlow, "derived-parameter");
  const field = marked(current, derivedFlow, "derived-field");
  const after = marked(current, derivedFlow, "derived-body");
  const superCall = derivedFlow.points.find(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsCallExpression(point.source) && current.ast.kindName(current.ast.as.AsCallExpression(point.source).Expression) === "KindSuperKeyword");
  assert.equal(reachable(derivedFlow, before.id, superCall.id), true);
  assert.equal(reachable(derivedFlow, superCall.id, field.id) && reachable(derivedFlow, field.id, after.id), true);
  assert.equal(reachable(derivedFlow, field.id, superCall.id), false);
  const bindings = current.storage.bindingsForInvocation(derived, allocation);
  assert.equal(bindings.kind, "resolved");
  const baseFlow = flow(current, current.constructor("Base"), superCall.source, bindings.bindings);
  const baseField = marked(current, baseFlow, "base-field");
  const baseParameter = marked(current, baseFlow, "base-parameter");
  const baseBody = marked(current, baseFlow, "base-body");
  assert.equal(reachable(baseFlow, baseField.id, baseParameter.id) && reachable(baseFlow, baseParameter.id, baseBody.id), true);
  assert.equal(reachable(baseFlow, baseParameter.id, baseField.id), false);
  const inventory = current.storage.instanceRegionsFor(allocation);
  assert.equal(inventory.kind, "resolved");
  assert.equal(inventory.regions[0].owner === current.named("Derived"), true, "inventory order is not used as execution order");
});

test("field initializers carry class activations while defaults and bodies carry constructor activations", () => {
  const current = fixture(`${classes} const instance = new Derived();`);
  const graph = flow(current, current.constructor("Derived"), current.construct("Derived"));
  const field = marked(current, graph, "derived-field").source;
  const parameter = marked(current, graph, "derived-parameter").source;
  const fieldContext = graph.executionRegions.get(field);
  const parameterContext = graph.executionRegions.get(parameter);
  assert.equal(fieldContext.owner === current.named("Derived"), true);
  assert.equal(parameterContext.owner === current.constructor("Derived"), true);
  assert.equal(fieldContext.selection.kind === "resolved" && parameterContext.selection.kind === "resolved", true);
  assert.equal(fieldContext.selection.bindings !== parameterContext.selection.bindings, true, "distinct canonical source identities");
  for (const context of [fieldContext, parameterContext]) {
    const result = current.storage.boundActivationsFor(context.owner, context.selection.bindings);
    assert.equal(result.kind === "resolved" && result.activations.length === 1 &&
      result.activations[0].kind === "invocation" && result.activations[0].invocation === current.construct("Derived"), true);
  }
});

test("super or field failure bypasses subsequent initialization and constructor body", () => {
  const current = fixture(`${classes} const instance = new Derived();`);
  const graph = flow(current, current.constructor("Derived"), current.construct("Derived"));
  const field = marked(current, graph, "derived-field");
  const body = marked(current, graph, "derived-body");
  const superCall = graph.points.find(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsCallExpression(point.source) && current.ast.kindName(current.ast.as.AsCallExpression(point.source).Expression) === "KindSuperKeyword");
  for (const point of [superCall, field]) {
    const abrupt = point.successors.find(edge => edge.kind === "exception");
    assert.equal(abrupt !== undefined, true, "original abrupt completion remains explicit");
    assert.equal(reachable(graph, abrupt.to, body.id, true), false);
    assert.equal(reachable(graph, abrupt.to, graph.exceptionExit, true), true);
  }
});

test("implicit base constructors execute their actual instance regions without a fabricated callable", () => {
  const current = fixture(`class Implicit { value = mark("implicit-field"); } const instance = new Implicit();`);
  const graph = flow(current, current.named("Implicit"), current.construct("Implicit"));
  const field = marked(current, graph, "implicit-field");
  assert.equal(graph.declaration === current.named("Implicit"), true);
  assert.equal(reachable(graph, graph.entry, field.id) && reachable(graph, field.id, graph.exit), true);
  assert.equal(graph.executionRegions.get(field.source).owner === current.named("Implicit"), true);
});

test("computed field names execute at class evaluation and never again in construction", () => {
  const current = fixture(`const key = "value"; class Computed { [key] = mark("field-value"); constructor() { mark("body"); } }
    const instance = new Computed();`);
  const graph = flow(current, current.constructor("Computed"), current.construct("Computed"));
  const field = marked(current, graph, "field-value");
  assert.equal(reachable(graph, field.id, marked(current, graph, "body").id), true);
  const property = current.ast.members(current.named("Computed")).find(current.ast.is.IsPropertyDeclaration);
  const key = current.ast.as.AsComputedPropertyName(current.ast.name(property)).Expression;
  assert.equal(graph.sourcePoints.has(key), false, "the class-definition computed key is not replayed");
});

test("implicit heritage and foreign allocations require actual inherited execution proof", () => {
  const current = fixture(`${classes} class ImplicitDerived extends Base { extra = mark("extra"); }
    const instance = new ImplicitDerived(); const direct = new Derived();`);
  const missing = createSourceControlFlow(current.source, current.named("ImplicitDerived"), {
    invocation: { storage: current.storage, call: current.construct("ImplicitDerived") },
  });
  assert.equal(missing.kind, "unresolved");
  assert.match(missing.reason, /Implicit heritage construction requires checked inherited/u);
  const wrong = createSourceControlFlow(current.source, current.constructor("Base"), {
    invocation: { storage: current.storage, call: current.construct("Derived") },
  });
  assert.equal(wrong.kind, "unresolved", "an unrelated constructor cannot borrow another allocation's regions");
  const native = fixture(`declare class External { constructor(); }
    class NativeDerived extends External { value = mark("value"); } const instance = new NativeDerived();`);
  const opaque = createSourceControlFlow(native.source, native.named("NativeDerived"), {
    invocation: { storage: native.storage, call: native.construct("NativeDerived") },
  });
  assert.equal(opaque.kind, "unresolved", "implicit native heritage is not expanded into an invented constructor");
  assert.match(opaque.reason, /Implicit heritage construction requires checked inherited/u);
});

test("each checked super branch performs only its own initializer sequence before joining", () => {
  const current = fixture(`class Base { constructor() {} }
    class Derived extends Base {
      value = mark("field");
      constructor(flag: boolean) { if (flag) super(); else super(); mark("body"); }
    }
    const instance = new Derived(true);`);
  const graph = flow(current, current.constructor("Derived"), current.construct("Derived"));
  const supers = graph.points.filter(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsCallExpression(point.source) && current.ast.kindName(current.ast.as.AsCallExpression(point.source).Expression) === "KindSuperKeyword");
  assert.equal(supers.length, 2);
  const fields = graph.points.filter(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsCallExpression(point.source) && current.ast.arguments(point.source).some(argument =>
      current.ast.is.IsStringLiteral(argument) && current.ast.text(argument).includes("field")));
  assert.equal(fields.length, 2, "one original initializer appears on each mutually exclusive completion path");
  assert.equal(fields[0].source === fields[1].source, true, "no fabricated or copied field AST");
  for (const invocation of supers) {
    assert.equal(fields.filter(field => reachable(graph, invocation.id, field.id)).length, 1);
    assert.equal(reachable(graph, invocation.id, marked(current, graph, "body").id), true);
  }
});

test("generic constructor graphs retain fields and checked constructor budgets remain finite", () => {
  const current = fixture(`${classes} const instance = new Derived();`);
  const generic = createSourceControlFlow(current.source, current.constructor("Base"));
  assert.equal(generic.kind, "resolved");
  const field = marked(current, generic.graph, "base-field");
  assert.equal(reachable(generic.graph, field.id, marked(current, generic.graph, "base-parameter").id), true);
  for (const limits of [{ maximumPoints: 1 }, { maximumSteps: 1 }, { maximumDepth: 1 }]) {
    const selected = createSourceControlFlow(current.source, current.constructor("Derived"), {
      limits, invocation: { storage: current.storage, call: current.construct("Derived") },
    });
    assert.equal(selected.kind, "unresolved", "bounded constructor proof never publishes partial regions");
    assert.match(selected.reason, /finite/u);
  }
});
