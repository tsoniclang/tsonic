import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture, navigationCapture, preparation } from "./fixtures/front/checked-module.mjs";

const limits = {
  navigationCapture,
  query: { maximumRecords: 100000 },
  inference: { maximumVariablesPerGroup: 128, maximumAtomicContributionsPerGroup: 256 },
  evaluation: { maximumSteps: 10000, maximumIntermediateBits: 4096, maximumResultBits: 4096, maximumArithmeticWork: 10000 },
  dataflow: { maximumWork: 100000, maximumResultEntries: 100000 },
  analyses: { maximumProjectionDepth: 64, maximumOriginAlternatives: 64, maximumConditionAlternatives: 64,
    maximumRelationalRecordsPerBody: 10000, maximumRelationalReferencesPerBody: 10000 },
  summaries: { maximumIterationsPerComponent: 100, maximumComponentSize: 128 },
  metadata: { maximumWork: 10000, maximumGeometryBits: 4096 },
  instantiation: { maximumWork: 100000, maximumCreatedRecords: 100000, maximumBindingVectorsPerArtifact: 128,
    typeExpansion: { maximumDepth: 64, maximumVisits: 10000, maximumUnionMembers: 128, maximumIntersectionMembers: 128 } },
  lowering: { maximumRecords: 10000 }, mirVerification: { maximumWork: 100000 },
};

for (const [argument, provided] of [["", 0], ["supplied", 1]]) {
  test(provided === 0 ? "a public direct call omits the formal and selects its actual default entry"
    : "a public direct call supplies false and bypasses the actual default", async () => {
    const fixture = await loadFrontFixture();
    const source = `export function choose(flag: boolean = true): boolean { return flag; }
export function call(): boolean { ${provided === 0 ? "" : "const supplied: boolean = false;"} return choose(${argument}); }`;
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    const extensions = fixture.front.createCheckerExtensions([]);
    const inputs = { snapshot, extensions, preparation, limits };
    const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
    const { parseModuleBodies, printModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
    const result = analyzeHostProgram(inputs);
    assert.equal(result.kind, "ok", result.kind === "ok" ? undefined : JSON.stringify(result.diagnostics));
    const module = result.value.modules.find(row => row.module === snapshot.entryPoint);
    const printed = printModuleBodies(result.value.index, module);
    const decoded = parseModuleBodies(result.value.index, printed);
    assert.equal(decoded.kind, "parsed");
    assert.equal(printModuleBodies(result.value.index, decoded.value), printed);
    const lowered = { types: result.value.index.types, bodies: module.bodies };
    const inventory = result.value.index.dependencyInventory;
    assert.notEqual(inventory, null);
    const edges = inventory.dependencies;
    const selected = lowered.bodies.filter(body => body.kind === "selected" && body.tir.root.kind === "Block");
    const callee = selected.find(body => body.tir.params.length === 1);
    const caller = selected.find(body => body.tir.params.length === 0);
    const header = callee.tir.params[0];
    const call = caller.tir.root.statements.nodes.at(-1).expression;
    assert.equal(call.kind, "CallExpression");
    assert.equal(call.arguments.nodes.length, provided, "TIR retains the authored argument count");
    assert.equal(call.tsonic.application.kind, "decided");
    const application = call.tsonic.application.decision;
    assert.deepEqual(application.callee.activation, callee.instance);
    const formal = lowered.types.signatures[application.callee.decision.completion.signature].parameters[0];
    assert.equal(formal.declaration, header.tsonic.declaration);
    assert.equal(formal.initializer, header.tsonic.initializer);
    assert.equal(formal.acceptsOmission, true);
    const initializer = lowered.bodies.find(body => body.kind === "selected" && body.instance.body === formal.initializer);
    assert.equal(initializer.tir.root.kind, "TrueKeyword");
    const actual = caller.mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.tir.node === call.id).terminator;
    assert.equal(actual.callee.kind, "direct");
    assert.equal(actual.tir.node, call.id);
    const invocation = edges.filter(edge => edge.dependent.instance.body === caller.instance.body && edge.reason === "call");
    assert.equal(invocation.length, 1);
    assert.deepEqual(invocation[0].target, { kind: "body", execution: { instance: callee.instance, provided } });
    assert.equal(edges.some(edge => edge.dependent.instance.body === caller.instance.body
      && edge.target.kind === "body" && edge.target.execution.instance.body === initializer.instance.body), provided === 0);
    const facts = caller.facts[0];
    const alternative = facts.origins.invocations.find(row => row.node === call.id).alternatives[0];
    const transport = alternative.arguments[0];
    const slot = facts.arena.contexts[alternative.context].arguments[0];
    assert.equal(alternative.arguments.length, 1);
    assert.equal(alternative.summary.execution.provided, provided);
    assert.equal(transport.parameter, formal.declaration);
    assert.equal(transport.parameterIndex, 0);
    if (provided === 0) {
      assert.deepEqual(slot, { kind: "omitted" });
      assert.deepEqual(Object.keys(transport).sort(), ["formal", "kind", "parameter", "parameterIndex"]);
      assert.equal(transport.kind, "omitted");
      assert.deepEqual(application.callee.decision.parameters, [{ kind: "default", parameter: 0, initializer: initializer.instance.body }]);
      assert.deepEqual(application.arguments, [{ kind: "omitted", parameter: 0, value: { kind: "initializer", instance: initializer.instance } }]);
      assert.deepEqual(actual.arguments, [{ kind: "omitted" }]);
      assert.equal(caller.mir.blocks.some(block => block.terminator.kind === "call" && block.terminator.callee.kind === "body"), false);
    } else {
      assert.equal(transport.kind, "provided");
      assert.equal(transport.authoredIndex, 0);
      assert.deepEqual(slot, { kind: "provided", origins: transport.actual });
      assert.equal(facts.arena.origins[slot.origins].includesAbsence, false);
      const variable = caller.tir.root.statements.nodes[0].declarationList.declarations.nodes[0];
      const supplied = lowered.bodies.find(body => body.kind === "selected" && body.instance.body === variable.tsonic.initializer);
      assert.equal(supplied.tir.root.kind, "FalseKeyword");
      assert.deepEqual(call.arguments.nodes[0].tsonic.resolution, { kind: "local", local: variable.tsonic.declaration.local });
      assert.deepEqual(application.arguments, [{ kind: "provided", parameter: 0, expression: call.arguments.nodes[0].id }]);
      assert.equal(actual.arguments[0].kind, "value");
    }
    for (const count of [0, 1]) {
      const entry = callee.mir.entries.find(row => row.provided === count);
      const entryFacts = callee.facts.find(row => row.execution.provided === count);
      assert.equal(entryFacts.arena.contexts[0].arguments[0].kind, count === 0 ? "omitted" : "provided");
      const terminator = callee.mir.blocks[entry.block].terminator;
      assert.equal(terminator.kind === "call" && terminator.callee.kind === "body" && terminator.callee.instance.body === initializer.instance.body,
        count === 0, "only the callee omission entry executes the real initializer");
      assert.equal(edges.some(edge => edge.dependent.instance.body === callee.instance.body && edge.dependent.provided === count
        && edge.target.kind === "body" && edge.target.execution.instance.body === initializer.instance.body), count === 0);
    }
  });
}

test("the actual call only admits the initializer of its matching omitted formal", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
export function choose(first: boolean = true, second: boolean = false): boolean { return second; }
export function call(): boolean { const supplied: boolean = true; return choose(supplied); }` },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const inputs = { snapshot, extensions: fixture.front.createCheckerExtensions([]), preparation, limits };
  const captured = captureSourceBarrier(inputs);
  assert.equal(captured.kind, "ok");
  const account = createAccount(inputs.limits.dataflow);
  const choose = captured.value.modules.find(row => row.module.module === snapshot.entryPoint).module.tree.statements.nodes[0];
  const dependenciesOf = pipelineWiring.summaries.dependenciesOf;
  let checks = 0;
  pipelineWiring.summaries.dependenciesOf = (deps, input) => {
    const call = input.tir.root.kind === "Block" ? input.tir.root.statements.nodes.at(-1)?.expression : null;
    if (call?.kind === "CallExpression") {
      assert.equal(call.tsonic.application.kind, "decided");
      const callee = call.tsonic.application.decision.callee;
      assert.equal(callee.activation.body, choose.tsonic.body);
      const at = { body: input.tir.body, node: call.id };
      const [supplied, omitted] = choose.parameters.nodes.map(parameter => ({
        body: parameter.tsonic.initializer, bindings: structuredClone(callee.activation.bindings),
      }));
      const formal = choose.parameters.nodes[1];
      const property = Object.getOwnPropertyDescriptor(formal, "initializer");
      let reads = 0;
      Object.defineProperty(formal, "initializer", { configurable: true, get() { reads += 1; return property.value; } });
      try {
        assert.equal(deps.initializerAt(at, { instance: supplied, parameter: 0, callee }), null);
        assert.equal(deps.initializerAt(at, { instance: supplied, parameter: 1, callee }), null);
        assert.equal(deps.initializerAt(at, { instance: omitted, parameter: 0, callee }), null);
        assert.equal(reads, 0);
        assert.deepEqual(deps.initializerAt(at, { instance: omitted, parameter: 1, callee }),
          { kind: "body", execution: { instance: omitted, provided: 0 } });
        assert.equal(reads, 1);
        checks += 1;
      } finally { Object.defineProperty(formal, "initializer", property); }
    }
    return dependenciesOf(deps, input);
  };
  try {
    const typed = typeSourceBarrier(inputs, captured.value, account);
    assert.equal(typed.kind, "ok");
    assert.equal(checks, 1);
    assert.equal(analyzeTypedSource(inputs, typed.value, account).kind, "ok");
    assert.equal(checks, 1);
  } finally { pipelineWiring.summaries.dependenciesOf = dependenciesOf; }
});
