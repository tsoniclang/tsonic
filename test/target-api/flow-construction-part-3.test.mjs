import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { analyzeSourceResourceScopes, createSourceControlFlowDomain, createSourceDeclarationControlFlow } from "../../packages/target-api/dist/target-analysis/flow/index.js";
import { sourceStorageClassLineages } from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { classes, fixture, flow, declarationFlow, marked, reachable, propertyField, runtimeLayers } from "./flow-construction-fixtures.mjs";

for (const depth of [2, 3]){
for (const capturesFirst of [false, true]){
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
}

for (const [label, expression, reads, writes] of [
  ["read", "this.value", true, false],
  ["overwrite", "(this.value = 2)", false, true],
  ["conditional", "flag ? this.value : (this.value = 2)", true, true],
]){
test(`symbolic property initializer flow retains ${label} without a fabricated callable`, () => {
  const current = fixture(`declare const flag: boolean;
    class Base { value = 1; } class Derived extends Base { observed = ${expression}; }`);
  const declaration = propertyField(current, "Derived", "observed");
  const selected = createSourceDeclarationControlFlow(current.source, declaration, { domain: { kind: "source" } });
  assert.equal(selected.kind, "resolved", selected.reason ?? "the actual property initializer defines its source flow");
  const graph = selected.graph;
  assert.equal(graph.declaration === declaration, true, "the graph retains the original property identity");
  const initializer = current.ast.as.AsPropertyDeclaration(declaration).Initializer;
  const regions = [...graph.executionRegions.values()];
  assert.equal(regions.length > 0, true, "the checked initializer has its required declaration region");
  assert.equal(regions.every(region => region.owner === current.ast.parent(declaration) &&
    region.root === initializer && region.role === "instance-initializer" && !("selection" in region)), true,
  "the original initializer region is not a constructor activation or fabricated callable");
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
}

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
  const sharedRegions = [...sharedFlow.graph.executionRegions.values()];
  assert.equal(sharedRegions.length > 0 && sharedFlow.graph.sourcePoints.has(sharedInitializer), true,
    "the original static initializer publishes actual evaluation points and nonempty region evidence");
  assert.equal(sharedRegions.every(region => region.owner === current.ast.parent(shared) &&
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

for (const part of ["whole initializer", "nested read"]){
test(`property flow refuses an excluded ${part} instead of skipping its effects`, () => {
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
}

for (const limits of [{ maximumSteps: 1 }, { maximumPoints: 1 }, { maximumEdges: 1 }, { maximumDepth: 1 }, { maximumSteps: Infinity }]){
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
}
