import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { analyzeSourceResourceScopes, createSourceControlFlowDomain, createSourceDeclarationControlFlow } from "../../packages/target-api/dist/target-analysis/flow/index.js";
import { sourceStorageClassLineages } from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { classes, fixture, flow, declarationFlow, marked, reachable, propertyField, runtimeLayers } from "./flow-construction-fixtures.mjs";

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

for (const depth of [2, 3]){
for (const capturesFirst of [false, true]){
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

for (const [label, contract] of [
  ["constructor type", "type Factory = new () => { root: number };"],
  ["constructor overloads", "interface Factory { new (): { root: number }; new (input: number): { root: number }; }"],
]){
test(`declaration construction retains ${label} without selecting a runtime base implementation`, () => {
  const current = fixture(`${contract}
    function layer(Parent: Factory, value: number) {
      return class Layer extends Parent { field = mark("declared-field") + value; };
    }`);
  const field = propertyField(current, "Layer", "field");
  const declaration = current.ast.parent(field);
  const graph = declarationFlow(current, declaration);
  const initializer = current.ast.as.AsPropertyDeclaration(field).Initializer;
  const point = marked(current, graph, "declared-field");
  const region = graph.executionRegions.get(point.id);
  assert.equal(region?.owner === declaration && region.root === initializer &&
    region.role === "instance-initializer" && !("selection" in region), true,
    "the actual field region comes from the declaration, never an observed constructor activation");
  assert.equal(reachable(graph, graph.entry, point.id) && reachable(graph, point.id, graph.exit), true,
    "an implicit declared base does not skip the local initializer");
  assert.equal(point.successors.some(edge => edge.kind === "exception" && edge.to === graph.exceptionExit), true,
    "the original initializer retains its exceptional completion");
  assert.equal(graph.points.some(entry => entry.operation.kind === "return" || entry.operation.kind === "declare"), false,
    "a checked constructor signature does not fabricate a callable body or parameter initialization");
  assert.equal(graph.points.filter(entry => entry.operation.kind === "read" &&
    current.ast.text(current.ast.name(entry.operation.binding)) === "value").length, 1,
    "the lexical captured value is read exactly once without following runtime callers");
});
}

test("declaration construction refuses a missing checked constructor contract without a partial graph", () => {
  const current = fixture(`type Factory = new () => { root: number };
    function layer(Parent: Factory) { return class Layer extends Parent { field = mark("declared-field"); }; }`);
  const declaration = current.ast.parent(propertyField(current, "Layer", "field"));
  const formal = current.source.navigation.nodesForFiles(current.source.sourceFiles).find(node =>
    current.ast.is.IsParameterDeclaration(node) && current.ast.text(current.ast.name(node)) === "Parent");
  assert.equal(formal !== undefined, true, "the declared native-constructor input has its original checked identity");
  const source = { ...current.source, semantics: { ...current.source.semantics,
    forNode(node) {
      const selected = current.source.semantics.forNode(node);
      return node === formal ? { ...selected, types: { ...selected.types, constructSignatures: () => [] } } : selected;
    } } };
  const result = createSourceDeclarationControlFlow(source, declaration, { domain: { kind: "source" } });
  assert.equal(result.kind, "unresolved", "missing native constructor evidence is not empty success");
  assert.equal(result.source === formal, true, "the missing contract belongs to the original declared constructor input");
  assert.equal("graph" in result, false, "no partial initializer graph escapes the failed native contract");
});
