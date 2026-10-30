import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { analyzeSourceResourceScopes, createSourceControlFlowDomain, createSourceDeclarationControlFlow } from "../../packages/target-api/dist/target-analysis/flow/index.js";
import { sourceStorageClassLineages } from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { classes, fixture, flow, declarationFlow, marked, reachable, propertyField, runtimeLayers } from "./flow-construction-fixtures.mjs";

test("field initializers carry class activations while defaults and bodies carry constructor activations", () => {
  const current = fixture(`${classes} const instance = new Derived();`);
  const graph = flow(current, current.constructor("Derived"));
  const field = marked(current, graph, "derived-field");
  const parameter = marked(current, graph, "derived-parameter");
  const fieldContext = graph.executionRegions.get(field.id);
  const parameterContext = graph.executionRegions.get(parameter.id);
  assert.equal(fieldContext.owner === current.named("Derived"), true);
  assert.equal(parameterContext.owner === current.constructor("Derived"), true);
  assert.equal(fieldContext.role, "instance-initializer");
  assert.equal(parameterContext.role, "parameter-initializer");
  assert.equal(fieldContext.root === field.source && parameterContext.root === parameter.source, true, "original initializer identities");
  assert.equal(fieldContext !== parameterContext, true, "distinct canonical declaration regions");
  assert.equal("selection" in fieldContext || "selection" in parameterContext, false, "no runtime activation is a lexical region");
});

test("super or field failure bypasses subsequent initialization and constructor body", () => {
  const current = fixture(`${classes} const instance = new Derived();`);
  const graph = flow(current, current.constructor("Derived"));
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
  const graph = flow(current, current.named("Implicit"));
  const field = marked(current, graph, "implicit-field");
  assert.equal(graph.declaration === current.named("Implicit"), true);
  assert.equal(reachable(graph, graph.entry, field.id) && reachable(graph, field.id, graph.exit), true);
  assert.equal(graph.executionRegions.get(field.id).owner === current.named("Implicit"), true);
});

test("computed field names execute at class evaluation and never again in construction", () => {
  const current = fixture(`const key = "value"; class Computed { [key] = mark("field-value"); constructor() { mark("body"); } }
    const instance = new Computed();`);
  const graph = flow(current, current.constructor("Computed"));
  const field = marked(current, graph, "field-value");
  assert.equal(reachable(graph, field.id, marked(current, graph, "body").id), true);
  const property = current.ast.members(current.named("Computed")).find(current.ast.is.IsPropertyDeclaration);
  const key = current.ast.as.AsComputedPropertyName(current.ast.name(property)).Expression;
  assert.equal(graph.sourcePoints.has(key), false, "the class-definition computed key is not replayed");
});

test("source implicit heritage uses its actual implementation while foreign and native construction remain unresolved", () => {
  const current = fixture(`${classes} class ImplicitDerived extends Base { extra = mark("extra"); }
    const instance = new ImplicitDerived(); const direct = new Derived();`);
  const missing = createSourceDeclarationControlFlow(current.source, current.named("ImplicitDerived"), {
    domain: { kind: "source" },
  });
  assert.equal(missing.kind, "resolved", "checked implicit heritage selects its declared inherited implementation");
  assert.equal(missing.graph.executionRegions.get(marked(current, missing.graph, "base-body").id).owner === current.constructor("Base"), true);
  const inherited = flow(current, current.named("ImplicitDerived"));
  assert.equal(reachable(inherited, marked(current, inherited, "base-body").id, marked(current, inherited, "extra").id), true,
    "the actual source constructor completes before implicit derived fields");
  const wrong = createSourceDeclarationControlFlow(current.source, current.constructor("Base"), {
    domain: { kind: "source" },
    invocation: { storage: current.storage, call: current.construct("Derived") },
  });
  assert.equal(wrong.kind, "unresolved", "an unrelated constructor cannot borrow another allocation's regions");
  const native = fixture(`declare class External { constructor(); }
    class NativeDerived extends External { value = mark("value"); } const instance = new NativeDerived();`);
  const opaque = createSourceDeclarationControlFlow(native.source, native.named("NativeDerived"), {
    domain: { kind: "source" },
  });
  assert.equal(opaque.kind, "unresolved", "implicit native heritage is not expanded into an invented constructor");
  assert.match(opaque.reason, /checked constructor implementation/u);
});

test("implicit inherited constructor order agrees with Node without replaying arguments or class-definition keys", () => {
  const text = `
    const key = "value";
    class Base { [key] = mark("base-field"); constructor(value = mark("default")) { mark("base-body"); } }
    class Middle extends Base { other = mark("middle-field"); }
    class Derived extends Middle { last = mark("derived-field"); }
  `;
  const output = execFileSync(process.execPath, ["--input-type=module", "-e",
    `const events = []; function mark(name) { events.push(name); return 0; } ${text}
     new Derived(); new Derived(mark("argument")); process.stdout.write(JSON.stringify(events));`],
  { encoding: "utf8", timeout: 10000, maxBuffer: 65536 });
  assert.deepEqual(JSON.parse(output), ["base-field", "default", "base-body", "middle-field", "derived-field",
    "argument", "base-field", "base-body", "middle-field", "derived-field"]);
  const current = fixture(`${text} const instance = new Derived();`);
  const graph = flow(current, current.named("Derived"));
  const points = ["base-field", "default", "base-body", "middle-field", "derived-field"].map(name => marked(current, graph, name));
  for (let index = 1; index < points.length; index += 1) {
    assert.equal(reachable(graph, points[index - 1].id, points[index].id), true);
    assert.equal(reachable(graph, points[index].id, points[index - 1].id), false);
  }
  const property = current.ast.members(current.named("Base")).find(current.ast.is.IsPropertyDeclaration);
  const key = current.ast.as.AsComputedPropertyName(current.ast.name(property)).Expression;
  assert.equal(graph.sourcePoints.has(key), false, "the real class-definition key does not become a constructor read");
  for (const [name, owner] of [["base-field", current.named("Base")], ["default", current.constructor("Base")],
    ["middle-field", current.named("Middle")], ["derived-field", current.named("Derived")]]) {
    assert.equal(graph.executionRegions.get(marked(current, graph, name).id).owner === owner, true);
  }
});

test("a wholly implicit source lineage executes original field roots base-first without a fake body", () => {
  const current = fixture(`class Base { first = mark("base"); }
    class Middle extends Base { second = mark("middle"); }
    class Derived extends Middle { third = mark("derived"); }
    const instance = new Derived();`);
  const graph = flow(current, current.named("Derived"));
  const base = marked(current, graph, "base");
  const middle = marked(current, graph, "middle");
  const derived = marked(current, graph, "derived");
  assert.equal(graph.declaration === current.named("Derived"), true);
  assert.equal(reachable(graph, graph.entry, base.id) && reachable(graph, base.id, middle.id) &&
    reachable(graph, middle.id, derived.id) && reachable(graph, derived.id, graph.exit), true);
  assert.equal(graph.points.every(point => point.source === undefined || current.ast.getSourceFile(point.source) ===
    current.ast.getSourceFile(current.named("Derived"))), true, "all nodes come from the checked source, not synthesized constructors");
});

test("an actual super call into an implicit source middle keeps the original caller and allocation activations", () => {
  const current = fixture(`class Base { first = mark("base-field"); constructor(value = mark("default")) { mark("base-body"); } }
    class Middle extends Base { second = mark("middle-field"); }
    class Derived extends Middle { third = mark("derived-field"); constructor() { super(); mark("derived-body"); } }
    const instance = new Derived();`);
  const outer = flow(current, current.constructor("Derived"));
  const superCall = outer.points.find(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsCallExpression(point.source) && current.ast.kindName(current.ast.as.AsCallExpression(point.source).Expression) === "KindSuperKeyword");
  const caller = current.storage.bindingsForInvocation(current.constructor("Derived"), current.construct("Derived"));
  assert.equal(caller.kind, "resolved");
  const selected = current.storage.constructionFor(superCall.source, caller.bindings);
  assert.equal(selected.kind === "resolved" && selected.alternatives.length === 1, true);
  const checked = selected.alternatives[0];
  assert.equal(checked.root === current.named("Middle") && checked.allocation === current.construct("Derived") &&
    checked.implementation.declaration === current.constructor("Base"), true);
  const graph = flow(current, current.named("Middle"));
  assert.equal(reachable(graph, marked(current, graph, "base-body").id, marked(current, graph, "middle-field").id), true);
  assert.equal([...graph.executionRegions.values()].some(region => region.owner === current.named("Derived")), false,
    "the caller's fields are not replayed by the inherited implementation");
  const field = graph.executionRegions.get(marked(current, graph, "middle-field").id);
  const middleField = propertyField(current, "Middle", "second");
  assert.equal(field.owner === current.named("Middle") && field.root === current.ast.as.AsPropertyDeclaration(middleField).Initializer &&
    field.role === "instance-initializer" && !("selection" in field), true, "the declared base region never borrows caller activations");
  assert.equal(reachable(outer, superCall.id, marked(current, outer, "derived-field").id), true);
});

test("each finite class alternative has its own CFG and forged or ambiguous alternatives are refused", () => {
  const current = fixture(`declare const flag: boolean;
    class First { field = mark("first-only"); } class Second { field = mark("second-only"); }
    const Copy = First; const Choice = flag ? Copy : Second; const instance = new Choice();`);
  const call = current.construct("Choice");
  const selected = current.storage.constructionFor(call);
  assert.equal(selected.kind === "resolved" && selected.alternatives.length === 2, true,
    "The checked conditional constructor contains both finite source alternatives.");
  for (const construction of selected.alternatives) {
    const result = createSourceDeclarationControlFlow(current.source, construction.root, {
      domain: { kind: "source" },
    });
    assert.equal(result.kind, "resolved", "The selected cache-owned alternative defines exactly one execution.");
    const expected = current.ast.text(current.ast.name(construction.root)) === "First" ? "first-only" : "second-only";
    const other = expected === "first-only" ? "second-only" : "first-only";
    const field = marked(current, result.graph, expected);
    assert.equal(reachable(result.graph, result.graph.entry, field.id) && reachable(result.graph, field.id, result.graph.exit), true);
    assert.equal(result.graph.points.some(point => point.source !== undefined && current.ast.is.IsCallExpression(point.source) &&
      current.ast.arguments(point.source).some(argument => current.ast.is.IsStringLiteral(argument) &&
        current.ast.text(argument).includes(other))), false, "Alternative initializers are never linearized into the same graph.");
    const forged = createSourceDeclarationControlFlow(current.source, construction.root, {
      domain: { kind: "source" },
      invocation: { storage: current.storage, call, construction: { ...construction } },
    });
    assert.equal(forged.kind === "unresolved" && forged.reason.includes("source domain") && !("graph" in forged), true,
      "Removed invocation data cannot authorize a declaration graph.");
  }
});

test("normal constructor returns finish inherited fields after finally while abrupt completion bypasses them", () => {
  const current = fixture(`class Base {
      first = mark("base-field");
      constructor(flag: boolean, value = mark("default")) {
        try { if (flag) return; mark("base-body"); } finally { mark("finally"); }
      }
    }
    class Derived extends Base { last = mark("derived-field"); }
    const instance = new Derived(true);`);
  const graph = flow(current, current.named("Derived"));
  const field = marked(current, graph, "derived-field");
  const returned = graph.points.find(point => point.operation.kind === "return");
  assert.equal(returned !== undefined && reachable(graph, returned.id, field.id), true,
    "normal completion of the real base constructor still initializes implicit derived fields");
  const finallyPoints = graph.points.filter(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsCallExpression(point.source) && current.ast.arguments(point.source).some(argument =>
      current.ast.is.IsStringLiteral(argument) && current.ast.text(argument).includes("finally")));
  assert.equal(finallyPoints.some(point => reachable(graph, returned.id, point.id) && reachable(graph, point.id, field.id)), true);
  for (const name of ["base-field", "default", "base-body"]) {
    const point = marked(current, graph, name);
    const exception = point.successors.find(edge => edge.kind === "exception");
    assert.equal(exception !== undefined && reachable(graph, exception.to, graph.exceptionExit, true), true, name);
    assert.equal(reachable(graph, exception.to, field.id, true), false, `${name}: throwing cannot perform later implicit fields`);
  }
});

test("each checked super branch performs only its own initializer sequence before joining", () => {
  const current = fixture(`class Base { constructor() {} }
    class Derived extends Base {
      value = mark("field");
      constructor(flag: boolean) { if (flag) super(); else super(); mark("body"); }
    }
    const instance = new Derived(true);`);
  const graph = flow(current, current.constructor("Derived"));
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
  const generic = createSourceDeclarationControlFlow(current.source, current.constructor("Base"), { domain: { kind: "source" } });
  assert.equal(generic.kind, "resolved");
  const field = marked(current, generic.graph, "base-field");
  assert.equal(reachable(generic.graph, field.id, marked(current, generic.graph, "base-parameter").id), true);
  for (const limits of [{ maximumPoints: 1 }, { maximumSteps: 1 }, { maximumDepth: 1 }]) {
    const selected = createSourceDeclarationControlFlow(current.source, current.constructor("Derived"), {
      domain: { kind: "source" },
      limits,
    });
    assert.equal(selected.kind, "unresolved", "bounded constructor proof never publishes partial regions");
    assert.match(selected.reason, /finite/u);
    const [dimension, limit] = Object.entries(limits)[0];
    assert.equal(selected.resource?.subject === current.constructor("Derived"), true, "the original checked constructor owns resource exhaustion");
    assert.equal(selected.resource?.dimension, dimension, "constructor exhaustion retains its exact dimension");
    assert.equal(selected.resource?.limit, limit, "constructor limits are unchanged");
    assert.equal("graph" in selected, false, "no incomplete constructor graph is published");
  }
});
