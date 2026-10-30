import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { analyzeSourceResourceScopes, createSourceControlFlowDomain, createSourceDeclarationControlFlow } from "../../packages/target-api/dist/target-analysis/flow/index.js";
import { sourceStorageClassLineages } from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";

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

function flow(current, declaration) {
  const selected = createSourceDeclarationControlFlow(current.source, declaration, { domain: { kind: "source" } });
  assert.equal(selected.kind === "resolved", true, selected.kind === "unresolved" ? selected.reason : "checked graph");
  return selected.graph;
}

function declarationFlow(current, declaration, limits) {
  const selected = createSourceDeclarationControlFlow(current.source, declaration, { domain: { kind: "source" }, limits });
  assert.equal(selected.kind === "resolved", true, selected.kind === "unresolved" ? selected.reason : "declaration graph");
  return selected.graph;
}

function marked(current, graph, name) {
  const found = graph.points.filter(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsCallExpression(point.source) && current.ast.arguments(point.source).some(argument =>
      current.ast.is.IsStringLiteral(argument) && current.ast.text(argument).includes(name)));
  assert.equal(found.length, 1, `${name}: one original evaluation`);
  return found[0];
}

test("resource declaration admission preserves exact dense data-only original list membership", () => {
  const current = fixture(`const first = 1, second = 2; const other = 3;`);
  const { ast } = current;
  const first = current.named("first");
  const second = current.named("second");
  const list = ast.parent(first);
  const valid = analyzeSourceResourceScopes(ast, [list], () => false);
  const original = ast.as.AsVariableDeclarationList(list);
  const declarations = valid.variables.get(list);
  assert.equal(declarations?.length === 2 && declarations[0] === first && declarations[1] === second, true,
    "the original direct checked declaration identities remain ordered");
  let evaluated = 0;
  const accessor = [];
  Object.defineProperty(accessor, "0", { get() { evaluated += 1; return first; } });
  for (const [label, supplied] of [
    ["missing", undefined], ["undefined slot", [undefined]], ["sparse", Array(1)],
    ["non-declaration", [ast.name(first)]], ["accessor", accessor],
    ["foreign list", [current.named("other")]], ["null slot", [null]],
  ]) {
    const selectedAst = { ...ast, as: { ...ast.as,
      AsVariableDeclarationList: node => node === list
        ? { ...original, Declarations: { ...original.Declarations, Nodes: supplied } }
        : ast.as.AsVariableDeclarationList(node) } };
    const selected = analyzeSourceResourceScopes(selectedAst, [list], () => false);
    assert.equal(selected.variables.has(list), false, `${label}: malformed syntax publishes no declaration sequence`);
  }
  assert.equal(evaluated, 0, "source admission does not execute an accessor to classify a malformed slot");
});

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
  const derivedFlow = flow(current, derived);
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
  const baseFlow = flow(current, current.constructor("Base"));
  const baseField = marked(current, baseFlow, "base-field");
  const baseParameter = marked(current, baseFlow, "base-parameter");
  const baseBody = marked(current, baseFlow, "base-body");
  assert.equal(reachable(baseFlow, baseField.id, baseParameter.id) && reachable(baseFlow, baseParameter.id, baseBody.id), true);
  assert.equal(reachable(baseFlow, baseParameter.id, baseField.id), false);
  const inventory = current.storage.instanceRegionsFor(allocation);
  assert.equal(inventory.kind, "resolved");
  assert.equal(inventory.regions[0].owner === current.named("Derived"), true, "inventory order is not used as execution order");
});

test("declaration constructor flow retains native ordering and exact field, default and body regions", () => {
  const current = fixture(`${classes} const instance = new Derived();`);
  const derived = declarationFlow(current, current.constructor("Derived"));
  const base = declarationFlow(current, current.constructor("Base"));
  for (const [graph, owner, labels] of [[base, "Base", ["base-field", "base-parameter", "base-body"]],
    [derived, "Derived", ["derived-parameter", "derived-field", "derived-body"]]]) {
    const selected = labels.map(label => marked(current, graph, label));
    assert.equal(reachable(graph, selected[0].id, selected[1].id) && reachable(graph, selected[1].id, selected[2].id), true,
      `${owner}: original native constructor ordering`);
    for (const [index, point] of selected.entries()) {
      const execution = graph.executionRegions.get(point.id);
      assert.equal(execution !== undefined && execution.root !== undefined && !("selection" in execution), true, "required lexical evidence without activation");
      const expectedRole = labels[index].includes("field") ? "instance-initializer"
        : labels[index].includes("parameter") ? "parameter-initializer" : "body";
      assert.equal(execution.role, expectedRole, `${owner}: exact lexical role`);
      assert.equal(execution.owner === (expectedRole === "instance-initializer" ? current.named(owner) : current.constructor(owner)), true,
        `${owner}: original checked owner`);
    }
  }
  const superCall = derived.points.find(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsCallExpression(point.source) && current.ast.kindName(current.ast.as.AsCallExpression(point.source).Expression) === "KindSuperKeyword");
  assert.equal(reachable(derived, marked(current, derived, "derived-parameter").id, superCall.id) &&
    reachable(derived, superCall.id, marked(current, derived, "derived-field").id), true, "super remains between default and derived fields");
});

test("declaration field flow retains the exact initializer and excludes neighboring fields", () => {
  const current = fixture("class Fields { first = mark('first'); second = mark('second'); static shared = mark('shared'); }");
  const owner = current.named("Fields");
  for (const [name, role] of [["first", "instance-initializer"], ["shared", "static-initializer"]]) {
    const field = current.ast.members(owner).find(member => member !== undefined && current.ast.text(current.ast.name(member)) === name);
    const initializer = current.ast.as.AsPropertyDeclaration(field).Initializer;
    const graph = declarationFlow(current, field);
    const point = marked(current, graph, name);
    const execution = graph.executionRegions.get(point.id);
    assert.equal(execution?.owner === owner && execution.root === initializer && execution.role === role, true, `${name}: original checked field region`);
    assert.equal(graph.points.some(candidate => candidate.source !== undefined && current.ast.is.IsCallExpression(candidate.source) &&
      current.ast.arguments(candidate.source).some(argument => current.ast.is.IsStringLiteral(argument) && current.ast.text(argument) === "second")), false,
      "a field graph never executes its neighbor");
    assert.equal(point.successors.some(edge => edge.kind === "exception" && edge.to === graph.exceptionExit), true, "original initializer exception edge");
  }
});

test("declaration implicit construction retains inherited body and base-first fields without invented nodes", () => {
  const current = fixture("class Base { first = mark('base-field'); constructor(value = mark('base-parameter')) { mark('base-body'); } }\n" +
    "class Middle extends Base { second = mark('middle-field'); } class Derived extends Middle { third = mark('derived-field'); }");
  const graph = declarationFlow(current, current.named("Derived"));
  const ordered = ["base-field", "base-parameter", "base-body", "middle-field", "derived-field"].map(label => marked(current, graph, label));
  for (let index = 1; index < ordered.length; index += 1) assert.equal(reachable(graph, ordered[index - 1].id, ordered[index].id), true,
    "declared inheritance preserves native initialization order");
  assert.equal(graph.executionRegions.get(ordered[2].id).owner === current.constructor("Base"), true, "inherited actual constructor body owner");
  assert.equal(graph.points.every(point => point.source === undefined || current.ast.getSourceFile(point.source) ===
    current.ast.getSourceFile(current.named("Derived"))), true, "no fabricated constructor/body node");
});

for (const depth of [2, 3]) for (const capturesFirst of [false, true]) {
  test(`declaration property graph is independent of actual factory depth and observation order: depth=${depth}, capturesFirst=${capturesFirst}`, () => {
    const layers = Array.from({ length: depth }, (_, index) => `const Layer${index} = layer(${index === 0 ? "Root" : `Layer${index - 1}`}, ${index + 1});`).join("\n");
    const current = fixture(`type Factory = new () => { root: number }; class Root { root = 0; }
      function layer(Parent: Factory, value: number) { return class Layer extends Parent { field = value; }; }
      ${layers} const instance = new Layer${depth - 1}();`);
    const field = propertyField(current, "Layer", "field");
    if (capturesFirst) current.storage.constructionFor(current.construct(`Layer${depth - 1}`));
    const graph = declarationFlow(current, field);
    if (!capturesFirst) current.storage.constructionFor(current.construct(`Layer${depth - 1}`));
    const reads = graph.points.filter(point => point.operation.kind === "read" && current.ast.text(current.ast.name(point.operation.binding)) === "value");
    assert.equal(reads.length, 1, "one declaration-local read, never one compiler region per observed instance");
    const execution = graph.executionRegions.get(reads[0].id);
    assert.equal(execution?.owner === current.ast.parent(field) && execution.root === current.ast.as.AsPropertyDeclaration(field).Initializer &&
      execution.role === "instance-initializer" && !("selection" in execution), true, "same original field/owner/root");
    const output = execFileSync(process.execPath, ["--input-type=module", "-e",
      `class Root { root = 0; } function layer(Parent, value) { return class Layer extends Parent { field = value; }; }
       ${layers} const instances = [${Array.from({ length: depth }, (_, index) => `new Layer${index}()`).join(",")}];
       process.stdout.write(JSON.stringify([instances.map(value => value.field), new Set(instances).size]));`],
      { encoding: "utf8", timeout: 10000, maxBuffer: 65536 });
    const [values, identities] = JSON.parse(output);
    assert.deepEqual(values, Array.from({ length: depth }, (_, index) => index + 1), "every original native factory capture survives");
    assert.equal(identities, depth, "runtime instances remain distinct");
  });
}

test("declaration constructor regions fail closed for foreign input, selected-root gaps and finite exhaustion", () => {
  const current = fixture(`${classes} const instance = new Derived();`);
  const foreign = fixture(`${classes} const instance = new Derived();`);
  const declaration = current.constructor("Derived");
  const ancestors = [];
  for (let node = declaration; node !== undefined; node = current.ast.parent(node)) ancestors.push(node);
  const selected = createSourceControlFlowDomain(current.source, ancestors);
  assert.equal(selected.kind, "resolved", "the original checked declaration is a valid narrow inventory");
  const missing = createSourceDeclarationControlFlow(current.source, declaration, { domain: selected.domain });
  assert.equal(missing.kind === "unresolved" && !("graph" in missing), true, "missing exact initializer/body roots cannot publish a partial graph");
  const foreignResult = createSourceDeclarationControlFlow(current.source, foreign.constructor("Derived"), { domain: { kind: "source" } });
  assert.equal(foreignResult.kind === "unresolved" && !("graph" in foreignResult), true, "foreign checked constructor rejected");
  for (const limits of [{ maximumPoints: 1 }, { maximumSteps: 1 }, { maximumDepth: 1 }]) {
    const result = createSourceDeclarationControlFlow(current.source, declaration, { domain: { kind: "source" }, limits });
    assert.equal(result.kind === "unresolved" && !("graph" in result), true, "finite failure never publishes partial regions");
    assert.match(result.reason, /finite/u);
  }
});

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

for (const depth of [2, 3]) for (const capturesFirst of [false, true]) {
  test(`repeated class AST retains every actual factory activation in construction and flow: depth=${depth}, capturesFirst=${capturesFirst}`, () => {
    const layers = Array.from({ length: depth }, (_, index) =>
      `const Layer${index} = layer(${index === 0 ? "Root" : `Layer${index - 1}`}, ${index + 1});`).join("\n");
    const current = fixture(`
      type Factory = new () => { root: number };
      class Root { root = 0; }
      function layer(Parent: Factory, value: number) { return class Layer extends Parent { field = value; }; }
      ${layers}
      const instance = new Layer${depth - 1}();
      const read = instance.field;
    `);
    const { source, storage, ast } = current;
    const call = current.construct(`Layer${depth - 1}`);
    const operand = storage.subjectFor(ast.as.AsNewExpression(call).Expression);
    assert.equal(operand.kind, "resolved", "The constructor operand is an actual checked value.");
    const values = storage.storageProducersFor(operand.subject);
    assert.equal(values.kind === "complete" && values.producers.length === 1, true, "One actual outer class activation is selected.");
    const lineages = sourceStorageClassLineages(source, createSourceStorageBudget(defaultSourceStorageLimits),
      new Set(values.producers), {
        nativeConstructorsFor: () => undefined,
        subjectFor(node) {
          const selected = node === undefined ? undefined : storage.subjectFor(node);
          assert.equal(selected?.kind, "resolved", "Every actual heritage operand has checked identity.");
          return selected.subject;
        },
        valuesFor(subject, bindings) {
          const selected = storage.storageProducersFor(subject, bindings);
          assert.equal(selected.kind, "complete", "Every actual inherited factory capture is complete.");
          return new Set(selected.producers);
        },
      });
    assert.equal(lineages?.length === 1 && lineages[0].complete && lineages[0].classes.length === depth + 1, true,
      "The finite lineage preserves each repeated declaration with its own capture bindings.");
    const captures = lineages[0].classes.slice(0, depth);
    assert.equal(captures.every(captured => captured.subject === captures[0].subject), true, "The exact same original class AST repeats.");
    assert.equal(new Set(captures.map(captured => captured.bindings)).size, depth, "Actual factory activations stay distinct.");
    const selectCaptures = () => {
      for (const captured of [...captures].reverse()) {
        const selected = storage.bindingsForInvocation(captured.subject.node, call, storage.emptyBindings, captured);
        assert.equal(selected.kind === "resolved", true,
          selected.kind === "unresolved" ? selected.reason : "The requested ancestor capture is selected by actual identity, not first AST match.");
      }
    };
    if (capturesFirst) selectCaptures();
    const selected = storage.constructionFor(call);
    assert.equal(selected.kind === "resolved" && selected.alternatives.length === 1, true,
      selected.kind === "unresolved" ? selected.reason : "One complete actual construction is published.");
    if (!capturesFirst) selectCaptures();
    const declaration = propertyField(current, "Layer", "field");
    const graphSelection = createSourceDeclarationControlFlow(source, declaration, { domain: { kind: "source" } });
    assert.equal(graphSelection.kind === "resolved", true,
      graphSelection.kind === "unresolved" ? graphSelection.reason : "One checked declaration CFG is independent of observed instances.");
    const graph = graphSelection.graph;
    const reads = graph.points.filter(point => point.operation.kind === "read" && point.source !== undefined && ast.text(point.source) === "value");
    assert.equal(reads.length, 1, "The declaration graph contains its original field read once, independently of runtime instance count.");
    assert.equal(reads.every(point => point.source === reads[0].source), true, "Original syntax is retained, not cloned to invent identities.");
    const expected = Array.from({ length: depth }, (_, index) => index + 1);
    for (const point of reads) {
      const context = graph.executionRegions.get(point.id);
      assert.equal(context?.owner === captures[0].subject.node && context.root === ast.as.AsPropertyDeclaration(declaration).Initializer &&
        context.role === "instance-initializer" && !("selection" in context), true,
        "The original class owner and initializer define the lexical region, never a caller activation.");
      const subject = storage.subjectFor(point.source);
      assert.equal(subject.kind, "resolved", "The original initializer read has exact storage identity.");
    }
    const native = runtimeLayers(layers, depth);
    assert.deepEqual(native.values, expected, "Each runtime factory retains exactly its own argument without overwriting another layer.");
    assert.equal(native.identities, depth, "All actual runtime factory instances remain distinct.");
    assert.deepEqual(native.order, expected, "Original base layers initialize before their actual derived layers.");
    assert.equal(storage.failureReason() === undefined, true, "The finite activation model needs no increased budget.");
  });
}

function propertyField(current, className, fieldName) {
  const owner = current.storage.nodes.find(node => (current.ast.is.IsClassDeclaration(node) || current.ast.is.IsClassExpression(node)) &&
    current.ast.text(current.ast.name(node)) === className);
  const declaration = owner === undefined ? undefined : current.ast.members(owner).find(node => current.ast.is.IsPropertyDeclaration(node) &&
    current.ast.text(current.ast.name(node)) === fieldName);
  assert.equal(declaration !== undefined, true, `${className}.${fieldName}: original checked property`);
  return declaration;
}

function runtimeLayers(layers, depth) {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e",
    `const order = []; class Root { root = 0; }
     function layer(Parent, value) { return class Layer extends Parent { field = (order.push(value), value); }; }
     ${layers}
     const instances = [${Array.from({ length: depth }, (_, index) => `new Layer${index}()`).join(",")}];
     order.length = 0; new Layer${depth - 1}();
     process.stdout.write(JSON.stringify({ values: instances.map(instance => instance.field), identities: new Set(instances).size, order }));`],
  { encoding: "utf8", timeout: 10000, maxBuffer: 65536 });
  return JSON.parse(output);
}

for (const [label, expression, reads, writes] of [
  ["read", "this.value", true, false],
  ["overwrite", "(this.value = 2)", false, true],
  ["conditional", "flag ? this.value : (this.value = 2)", true, true],
]) test(`symbolic property initializer flow retains ${label} without a fabricated callable`, () => {
  const current = fixture(`declare const flag: boolean;
    class Base { value = 1; } class Derived extends Base { observed = ${expression}; }`);
  const declaration = propertyField(current, "Derived", "observed");
  const selected = createSourceDeclarationControlFlow(current.source, declaration, { domain: { kind: "source" } });
  assert.equal(selected.kind, "resolved", selected.reason ?? "the actual property initializer defines its source flow");
  const graph = selected.graph;
  assert.equal(graph.declaration === declaration, true, "the graph retains the original property identity");
  assert.equal(graph.executionRegions.size, 0, "a symbolic graph is not evidence of a constructor activation");
  assert.equal(graph.points.some(point => point.operation.kind === "return" || point.operation.kind === "declare"), false,
    "an initializer is neither a function return nor a synthetic parameter declaration");
  assert.equal(graph.points.some(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsPropertyAccessExpression(point.source) &&
    current.source.semantics.forNode(point.source).operations.propertyAccess(point.source)?.accessMode === "read"), reads,
  "only actual initializer reads observe the inherited value");
  assert.equal(graph.points.some(point => point.operation.kind === "write-location"), writes,
    "only the explicit RHS assignment writes storage; the native owner applies the field's own store");
  if (label === "conditional") assert.equal(graph.points.some(point => point.operation.kind === "branch"), true,
    "both checked conditional paths remain in the same solver graph");
});

test("property initializer closure captures are retained without executing the delayed body", () => {
  const current = fixture(`function build(token: number) {
    return class Derived { observed = () => { mark("delayed-body"); return token; }; };
  } const Copy = build(1); const instance = new Copy();`);
  const selected = createSourceDeclarationControlFlow(current.source, propertyField(current, "Derived", "observed"), { domain: { kind: "source" } });
  assert.equal(selected.kind, "resolved", selected.reason ?? "the exact initializer closure is admitted");
  assert.equal(selected.graph.points.some(point => point.operation.kind === "capture" &&
    current.ast.text(current.ast.name(point.operation.binding)) === "token"), true, "the original outer binding is captured");
  assert.equal(selected.graph.points.some(point => point.source !== undefined && current.ast.is.IsCallExpression(point.source) &&
    current.ast.arguments(point.source).some(argument => current.ast.is.IsStringLiteral(argument) &&
      current.ast.text(argument).includes("delayed-body"))), false, "a captured closure's body is not an eager initializer effect");
});

test("actual implicit property flow carries its class-entry binding and exception edge, not neighboring fields", () => {
  const current = fixture(`class Base { value = 1; }
    class Derived extends Base { observed = mark("selected-field") + this.value; other = mark("other-field"); }
    const instance = new Derived();`);
  const declaration = propertyField(current, "Derived", "observed");
  const call = current.construct("Derived");
  const selected = current.storage.constructionFor(call);
  assert.equal(selected.kind === "resolved" && selected.alternatives.length === 1, true, "one exact actual construction");
  const construction = selected.alternatives[0];
  const owner = current.ast.parent(declaration);
  const classEntry = construction.classes.find(entry => entry.owner === owner);
  assert.equal(classEntry !== undefined, true, "the actual construction contains the field's exact class entry");
  const region = classEntry.regions.find(entry => entry.node === current.ast.as.AsPropertyDeclaration(declaration).Initializer);
  assert.equal(region !== undefined, true, "the original initializer belongs to that actual class region");
  const result = createSourceDeclarationControlFlow(current.source, declaration, {
    domain: { kind: "source" },
  });
  assert.equal(result.kind, "resolved", result.reason ?? "the property uses its actual cached construction region");
  const point = marked(current, result.graph, "selected-field");
  const context = result.graph.executionRegions.get(point.id);
  assert.equal(context?.owner === owner && context.root === region.node && context.role === "instance-initializer" && !("selection" in context), true,
    "the exact checked field region is published without construction or activation authority");
  assert.equal(point.successors.some(edge => edge.kind === "exception" && edge.to === result.graph.exceptionExit), true,
    "the same expression visitor retains the possible exceptional completion");
  assert.equal(reachable(result.graph, result.graph.entry, point.id) && reachable(result.graph, point.id, result.graph.exit), true,
    "normal evaluation reaches the real initializer and normal exit");
  assert.equal(result.graph.points.some(point => point.source !== undefined && current.ast.is.IsCallExpression(point.source) &&
    current.ast.arguments(point.source).some(argument => current.ast.is.IsStringLiteral(argument) &&
      current.ast.text(argument).includes("other-field"))), false, "a property root is not a whole-class initializer replay");
});

test("property flow retains each repeated original class initializer with its distinct actual bindings", () => {
  const current = fixture(`type Factory = new () => { root: number }; class Root { root = 0; }
    function layer(Parent: Factory, value: number) { return class Layer extends Parent { field = value; }; }
    const Layer0 = layer(Root, 1); const Layer1 = layer(Layer0, 2); const Layer2 = layer(Layer1, 3);
    const instance = new Layer2();`);
  const declaration = propertyField(current, "Layer", "field");
  const call = current.construct("Layer2");
  const selected = current.storage.constructionFor(call);
  assert.equal(selected.kind === "resolved" && selected.alternatives.length === 1, true, "one finite original construction alternative");
  const result = createSourceDeclarationControlFlow(current.source, declaration, {
    domain: { kind: "source" },
  });
  assert.equal(result.kind, "resolved", result.reason ?? "all actual occurrences survive the property-root selection");
  const reads = result.graph.points.filter(point => point.operation.kind === "read" &&
    current.ast.text(current.ast.name(point.operation.binding)) === "value");
  assert.equal(reads.length, 1, "one declaration graph contains the original initializer read regardless of actual factory count");
  assert.equal(reads.every(point => point.source === reads[0].source), true, "repetition never clones the source AST");
  for (const point of reads) {
    const context = result.graph.executionRegions.get(point.id);
    assert.equal(context?.owner === current.ast.parent(declaration) &&
      context.root === current.ast.as.AsPropertyDeclaration(declaration).Initializer && context.role === "instance-initializer" && !("selection" in context), true,
      "the original field owns one exact checked lexical region");
    const subject = current.storage.subjectFor(point.source);
    assert.equal(subject.kind, "resolved", "the read has original checked storage identity");
  }
  const native = runtimeLayers("const Layer0 = layer(Root, 1); const Layer1 = layer(Layer0, 2); const Layer2 = layer(Layer1, 3);", 3);
  assert.deepEqual(native.values, [1, 2, 3], "each actual instance keeps its distinct captured factory value");
  assert.equal(native.identities, 3, "all three original runtime factory instances stay distinct");
  assert.deepEqual(native.order, [1, 2, 3], "base initializers precede the actual derived initializer");
});

test("property flow rejects static, missing, foreign and forged actual initializer evidence", () => {
  const text = "class Value { field = 1; static shared = 2; missing!: number; } const instance = new Value();";
  const current = fixture(text);
  const foreign = fixture(text);
  const declaration = propertyField(current, "Value", "field");
  const call = current.construct("Value");
  const selected = current.storage.constructionFor(call);
  assert.equal(selected.kind, "resolved", "the genuine construction exists for the inverse controls");
  const shared = propertyField(current, "Value", "shared");
  const sharedFlow = createSourceDeclarationControlFlow(current.source, shared, { domain: { kind: "source" } });
  assert.equal(sharedFlow.kind, "resolved", "the original checked static initializer has its explicit declaration role");
  const sharedInitializer = current.ast.as.AsPropertyDeclaration(shared).Initializer;
  assert.equal([...sharedFlow.graph.executionRegions.values()].every(region => region.owner === current.ast.parent(shared) &&
    region.root === sharedInitializer && region.role === "static-initializer" && !("selection" in region)), true,
    "static initialization is never mistaken for an instance or invocation region");
  for (const [label, source, root, invocation] of [
    ["missing initializer", current.source, propertyField(current, "Value", "missing"), undefined],
    ["foreign property", current.source, propertyField(foreign, "Value", "field"), undefined],
    ["foreign storage", current.source, declaration, { storage: foreign.storage, call }],
    ["foreign call", current.source, declaration, { storage: current.storage, call: foreign.construct("Value") }],
    ["copied construction", current.source, declaration, { storage: current.storage, call, construction: { ...selected.alternatives[0] } }],
  ]) {
    const result = createSourceDeclarationControlFlow(source, root, { domain: { kind: "source" }, ...(invocation === undefined ? {} : { invocation }) });
    assert.equal(result.kind, "unresolved", `${label}: incomplete identity cannot publish an empty initializer graph`);
    assert.equal("graph" in result, false, `${label}: no partial graph escapes`);
  }
});

for (const part of ["whole initializer", "nested read"]) test(`property flow refuses an excluded ${part} instead of skipping its effects`, () => {
  const current = fixture("class Value { value = 1; observed = this.value + mark('selected'); }");
  const declaration = propertyField(current, "Value", "observed");
  const initializer = current.ast.as.AsPropertyDeclaration(declaration).Initializer;
  const excluded = part === "whole initializer" ? initializer : current.ast.as.AsBinaryExpression(initializer).Left;
  const nodes = [];
  const pending = [...current.source.sourceFiles];
  while (pending.length !== 0) {
    const node = pending.pop();
    if (node === excluded) continue;
    nodes.push(node);
    for (const child of current.ast.children(node)) if (child !== undefined) pending.push(child);
  }
  const domain = createSourceControlFlowDomain(current.source, nodes);
  assert.equal(domain.kind, "resolved", "the selected subset is a genuine parent-closed checked inventory");
  const result = createSourceDeclarationControlFlow(current.source, declaration, { domain: domain.domain });
  assert.equal(result.kind, "unresolved", "the requested initializer requires its complete demanded domain");
  assert.equal(result.source === excluded, true, "the precise missing checked initializer node is reported");
  assert.match(result.reason, /complete initializer/u);
  assert.equal("graph" in result, false, "no missing effect becomes a completed empty graph");
});

for (const limits of [{ maximumSteps: 1 }, { maximumPoints: 1 }, { maximumEdges: 1 }, { maximumDepth: 1 }, { maximumSteps: Infinity }])
  test(`property initializer flow retains ${Number.isFinite(Object.values(limits)[0]) ? "finite resource exhaustion" : "invalid limit rejection"} ${Object.keys(limits)[0]}=${Object.values(limits)[0]}`, () => {
    const current = fixture("class Value { value = 1; observed = mark('budget') + this.value; }");
    const selected = createSourceDeclarationControlFlow(current.source, propertyField(current, "Value", "observed"), { domain: { kind: "source" }, limits });
    assert.equal(selected.kind, "unresolved", "no property-entry path raises or bypasses a finite limit");
    assert.match(selected.reason, /finite/u);
    assert.equal("graph" in selected, false, "finite failure never publishes a partial initializer");
    const [dimension, limit] = Object.entries(limits)[0];
    if (Number.isFinite(limit)) {
      assert.equal(selected.resource?.subject === propertyField(current, "Value", "observed"), true, "the initializer declaration owns resource exhaustion");
      assert.equal(selected.resource?.dimension, dimension, "the initializer reports the actual exhausted dimension");
      assert.equal(selected.resource?.limit, limit, "the original initializer bound is retained");
    } else assert.equal(selected.resource === undefined, true, "invalid Infinity is not an exhausted allowance");
  });
