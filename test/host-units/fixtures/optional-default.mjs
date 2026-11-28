import assert from "node:assert/strict";
import { loadFrontFixture, navigationCapture } from "./front/checked-module.mjs";
import { summaryKey } from "../../../packages/host/dist/ir-facts/index.js";
import { parseModuleBodies, printModuleBodies } from "../../../packages/host/dist/ir-program/index.js";
import { analyzeHostProgram } from "../../../packages/host/dist/pipeline/index.js";

const limits = {
  navigationCapture, query: { maximumRecords: 100000 },
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

const choose = "export function choose(flag: boolean | undefined = true): boolean | undefined { return flag; }";
const calls = {
  supplied: "export function call(): boolean | undefined { return choose(undefined); }",
  omitted: "export function call(): boolean | undefined { return choose(); }",
  shadow: "export function call(): boolean | undefined { const undefined: boolean = false; return choose(undefined); }",
};
const explicitNull = "export function choose(flag: boolean | null = true): boolean | null { return flag; }\n"
  + "export function call(): boolean | null { return choose(null); }";

function conversion(body, expression, formal, parameter, role, kind) {
  assert.equal(expression.tsonic.convertedType, formal.type);
  assert.equal(expression.tsonic.conversion.kind, "convert");
  assert.equal(expression.tsonic.conversion.role, role);
  const operation = expression.tsonic.conversion.operation.decision;
  assert.equal(operation.kind, "selected");
  assert.deepEqual(operation.execution, { kind: "pure" });
  assert.deepEqual(operation.operation, { kind: "conversion", from: expression.tsonic.type, to: formal.type,
    embedding: { kind: "conversion", conversion: kind, check: { kind: "none" }, proof: { conclusion: 0, steps: [{
      from: { root: { kind: "body", value: { body: body.instance.body, node: expression.id } }, path: [] },
      to: { root: { kind: "item", value: { owner: formal.declaration, node: parameter.type.id } }, path: [] },
      rule: kind, premises: [],
    }] } } });
  const statements = body.mir.blocks.flatMap(block => block.statements).filter(row =>
    row.kind === "assign" && row.value.kind === "convert" && row.tir.node === expression.id);
  assert.equal(statements.length, 1);
  const statement = statements[0];
  assert.deepEqual(statement.value.operation.decision, operation);
  return statement;
}

export async function analyzeOptionalSource(source, dependencies = {}, entries = []) {
  const fixture = await loadFrontFixture();
  const entry = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source, ...dependencies },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    externalEntries: entries.map(name => ({ module: entry, name })) });
  return analyzeHostProgram({ snapshot, extensions: fixture.front.createCheckerExtensions([]), limits });
}

export async function checkOptionalDefault(mode) {
  const program = await analyzeOptionalSource(mode === "null" ? explicitNull : choose + "\n" + calls[mode], {}, ["call", "choose"]);
  assert.equal(program.kind, "ok", program.kind === "ok" ? undefined : JSON.stringify(program.diagnostics));
  const { index, modules } = program.value;
  assert.ok(index.dependencyInventory);
  const active = modules.flatMap(module => module.bodies).filter(body => body.kind === "selected" && body.tir.root.kind === "Block");
  const callee = active.find(body => body.tir.params.length === 1);
  const caller = active.find(body => body.tir.params.length === 0);
  assert.ok(callee && caller);
  const module = modules.find(row => row.bodies.includes(caller));
  assert.ok(module);
  const call = caller.tir.root.statements.nodes.at(-1).expression;
  const parameter = callee.tir.params[0];
  assert.equal(call.kind, "CallExpression");
  const absence = mode === "supplied" || mode === "null";
  const provided = mode === "omitted" ? 0 : 1;
  assert.equal(call.arguments.nodes.length, provided);
  assert.equal(call.tsonic.application.kind, "decided");
  const selected = call.tsonic.application.decision.callee;
  assert.deepEqual(selected.activation, callee.instance);
  const formal = index.types.signatures[selected.decision.completion.signature].parameters[0];
  assert.equal(formal.declaration, parameter.tsonic.declaration);
  assert.equal(parameter.type.tsonic.type, formal.type);
  assert.equal(formal.acceptsOmission, true);
  const optional = index.types.terms[formal.type];
  assert.equal(optional.kind, "optional");
  const payload = index.types.terms[optional.value];
  assert.equal(payload.kind, "union", "the selected domain was not replaced by the authored Boolean arm's type");
  const present = parameter.type.types.nodes[0].tsonic.type;
  assert.deepEqual(index.types.terms[present], { kind: "primitive", primitive: "bool" });
  const alternatives = payload.members.map(type => index.types.terms[type]);
  assert.equal(alternatives.every(term => term.kind === "literal" && term.value.kind === "boolean" && term.base === present), true);
  assert.deepEqual(alternatives.map(term => term.value.value).sort(), [false, true]);

  const initializer = module.bodies.find(body => body.kind === "selected" && body.instance.body === formal.initializer);
  assert.equal(initializer?.tir.root.kind, "TrueKeyword");
  const defaultValue = conversion(initializer, initializer.tir.root, formal, parameter, "initialization", "union-injection");
  assert.equal(defaultValue.value.operand.kind, "constant");
  assert.deepEqual(initializer.mir.constants[defaultValue.value.operand.constant].value, { kind: "literal", value: { kind: "boolean", value: true } });
  const initialized = callee.mir.entries.find(entry => entry.provided === provided);
  assert.ok(initialized);
  const entry = callee.mir.blocks[initialized.block].terminator;
  assert.equal(entry.kind === "call" && entry.callee.kind === "body" && entry.callee.instance.body === formal.initializer, provided === 0);
  const bodyEdges = index.dependencyInventory.dependencies;
  assert.equal(bodyEdges.some(edge => edge.dependent.instance.body === caller.instance.body && edge.reason === "initializer"
    && edge.target.kind === "body" && edge.target.execution.instance.body === formal.initializer), provided === 0);

  const actual = caller.mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.tir.node === call.id)?.terminator;
  assert.equal(actual?.callee.kind, "direct");
  const facts = caller.facts.find(row => row.execution.provided === 0);
  assert.ok(facts);
  const alternative = facts.origins.invocations.find(row => row.node === call.id).alternatives[0];
  assert.deepEqual(alternative.summary, { kind: "body", execution: { instance: callee.instance, provided } });
  const transport = alternative.arguments[0];
  const slot = facts.arena.contexts[alternative.context].arguments[0];
  assert.equal(transport.parameter, formal.declaration);
  if (provided === 0) {
    assert.deepEqual(selected.decision.parameters, [{ kind: "default", parameter: 0, initializer: formal.initializer }]);
    assert.deepEqual(actual.arguments, [{ kind: "omitted" }]);
    assert.deepEqual(slot, { kind: "omitted" });
    assert.equal(transport.kind, "omitted");
  } else {
    const argument = call.arguments.nodes[0];
    assert.equal(argument.kind, mode === "null" ? "NullKeyword" : "Identifier");
    if (mode !== "null") assert.equal(argument.text, "undefined");
    const statement = conversion(caller, argument, formal, parameter, "argument", absence ? "absence" : "union-injection");
    assert.equal(actual.arguments[0].kind, "value");
    assert.deepEqual(actual.arguments[0].operand, { kind: "place", place: statement.place });
    assert.equal(transport.kind, "provided");
    assert.equal(transport.authoredIndex, 0);
    assert.deepEqual(slot, { kind: "provided", origins: transport.actual });
    assert.equal(facts.arena.origins[transport.actual].includesAbsence, absence);
    assert.deepEqual(facts.arena.origins[transport.actual].producers, []);
    if (absence) {
      assert.deepEqual(index.types.terms[argument.tsonic.type], { kind: "intrinsic", intrinsic: "absence" });
      if (mode === "supplied") assert.deepEqual(argument.tsonic.resolution, { kind: "intrinsic-value", intrinsic: "undefined" });
      assert.equal(statement.value.operand.kind, "constant");
      assert.deepEqual(caller.mir.constants[statement.value.operand.constant].value, { kind: "literal", value: { kind: "absence" } });
    } else {
      const local = caller.tir.root.statements.nodes[0].declarationList.declarations.nodes[0];
      const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === local.tsonic.initializer);
      assert.equal(body?.tir.root.kind, "FalseKeyword");
      assert.equal(argument.tsonic.type, present);
      assert.deepEqual(argument.tsonic.resolution, { kind: "local", local: local.tsonic.declaration.local });
      assert.equal(statement.value.operand.kind, "place");
    }
  }
  assert.equal(facts.arena.origins[alternative.result].includesAbsence, absence);
  const returned = facts.origins.subjects.find(row => row.role === "return");
  assert.ok(returned);
  assert.equal(returned.origins, alternative.result);
  assert.deepEqual(facts.arena.origins[returned.origins].producers, []);
  const summary = index.summaries.find(row => summaryKey(row.key) === summaryKey(alternative.summary));
  assert.ok(summary);
  const result = summary.arena.origins[summary.result];
  assert.equal(result.includesAbsence, false);
  assert.equal(result.producers.length, provided);
  assert.deepEqual(summary.retention, [], "an optional Boolean is still by value");
  assert.deepEqual(callee.facts.find(row => row.execution.provided === provided).origins.escapes, []);

  const text = printModuleBodies(index, module);
  const parsed = parseModuleBodies(index, text);
  assert.equal(parsed.kind, "parsed");
  assert.equal(printModuleBodies(index, parsed.value), text);
  return { types: index.types, initializer, defaultValue };
}
