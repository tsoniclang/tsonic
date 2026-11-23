import assert from "node:assert/strict";
import { createAccount } from "../../packages/host/dist/dataflow/index.js";
import { test } from "node:test";
import { loadFrontFixture, navigationCapture } from "./fixtures/front/checked-module.mjs";
import { analyzeHostProgram } from "../../packages/host/dist/pipeline/index.js";
import { captureSourceBarrier } from "../../packages/host/dist/pipeline/source-barrier.js";
import { typeSourceBarrier } from "../../packages/host/dist/pipeline/typed-barrier.js";
import { lowerMirDeps, mirVerificationContext } from "../../packages/host/dist/pipeline/lower-mir-step.js";
import { lowerToMir } from "../../packages/host/dist/lower-mir/index.js";
import { verifyMir } from "../../packages/host/dist/ir-mir/index.js";
import { instanceKey, internType, viewTypes } from "../../packages/host/dist/ir-types/index.js";
import { parseModuleBodies, printModuleBodies } from "../../packages/host/dist/ir-program/index.js";

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

async function inputs(source) {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  return { snapshot, extensions: fixture.front.createCheckerExtensions([]), limits };
}

test("bare choose(false) embeds its actual literal in the selected formal and reaches the public supplied entry", async () => {
  const input = await inputs("export function choose(flag: boolean = true): boolean { return flag; }\n"
    + "export function call(): boolean { return choose(false); }");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const printed = printModuleBodies(index, module);
  const decoded = parseModuleBodies(index, printed);
  assert.equal(decoded.kind, "parsed");
  assert.equal(printModuleBodies(index, decoded.value), printed);
  const bodies = module.bodies.filter(row => row.kind === "selected" && row.tir.root.kind === "Block");
  const callee = bodies.find(row => row.tir.params.length === 1);
  const caller = bodies.find(row => row.tir.params.length === 0);
  const call = caller.tir.root.statements.nodes[0].expression;
  const literal = call.arguments.nodes[0];
  const parameter = callee.tir.params[0];
  assert.equal(call.arguments.nodes.length, 1);
  assert.equal(literal.kind, "FalseKeyword");
  assert.equal(call.tsonic.application.kind, "decided");
  const { callee: selected, arguments: arguments_ } = call.tsonic.application.decision;
  assert.deepEqual(selected.activation, callee.instance);
  assert.deepEqual(arguments_, [{ kind: "provided", parameter: 0, expression: literal.id }]);
  const formal = index.types.signatures[selected.decision.completion.signature].parameters[0];
  assert.equal(formal.declaration, parameter.tsonic.declaration);
  assert.deepEqual(index.types.terms[literal.tsonic.type],
    { kind: "literal", value: { kind: "boolean", value: false }, base: formal.type });
  assert.equal(literal.tsonic.convertedType, formal.type);
  assert.equal(literal.tsonic.conversion.kind, "convert");
  assert.equal(literal.tsonic.conversion.role, "argument");
  const conversion = literal.tsonic.conversion.operation.decision;
  assert.equal(conversion.kind, "selected");
  assert.deepEqual(conversion.execution, { kind: "pure" });
  assert.equal(conversion.operation.kind, "conversion");
  assert.deepEqual(conversion.operation.embedding, { kind: "conversion", conversion: "literal-fit", check: { kind: "none" },
    proof: { steps: [{ from: { root: { kind: "body", value: { body: caller.instance.body, node: literal.id } }, path: [] },
      to: { root: { kind: "item", value: { owner: formal.declaration, node: parameter.type.id } }, path: [] },
      rule: "literal-fit", premises: [] }], conclusion: 0 } });

  const mir = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(mir.callee.kind, "direct");
  assert.equal(mir.arguments.length, 1);
  assert.equal(mir.arguments[0].kind, "value");
  assert.equal(mir.arguments[0].operand.kind === "constant" ? caller.mir.constants[mir.arguments[0].operand.constant].type
    : caller.mir.places[mir.arguments[0].operand.place].storage, formal.type);
  const conversions = caller.mir.blocks.flatMap(block => block.statements)
    .filter(statement => statement.kind === "assign" && statement.value.kind === "convert" && statement.tir.node === literal.id);
  assert.equal(conversions.length, 1);
  assert.equal(conversions[0].value.operand.kind, "constant");
  assert.deepEqual(caller.mir.constants[conversions[0].value.operand.constant].value,
    { kind: "literal", value: { kind: "boolean", value: false } });
  const facts = caller.facts[0];
  const alternative = facts.origins.invocations.find(row => row.node === call.id).alternatives[0];
  assert.deepEqual(alternative.summary.execution, { instance: callee.instance, provided: 1 });
  assert.equal(alternative.arguments[0].kind, "provided");
  assert.equal(alternative.arguments[0].authoredIndex, 0);
  assert.deepEqual(facts.arena.contexts[alternative.context].arguments,
    [{ kind: "provided", origins: alternative.arguments[0].actual }]);
  assert.equal(facts.arena.origins[alternative.arguments[0].actual].includesAbsence, false);
  assert.ok(index.dependencyInventory);
  const callerEdges = index.dependencyInventory.dependencies.filter(edge => edge.dependent.instance.body === caller.instance.body);
  assert.deepEqual(callerEdges.filter(edge => edge.reason === "call").map(edge => edge.target), [alternative.summary]);
  assert.equal(callerEdges.some(edge => edge.reason === "initializer"), false);
  assert.deepEqual(callerEdges.filter(edge => edge.reason === "activation"), []);
});

test("actual string literals select the present optional alternative and keep their payload through verified MIR", async () => {
  for (const { payload, defaulted } of [
    { payload: "text", defaulted: false }, { payload: "", defaulted: false }, { payload: "", defaulted: true },
  ]) {
    const formal = defaulted ? 'value: string | undefined = "fallback"' : "value?: string";
    const input = await inputs(`export function pass(${formal}): string | undefined { return value; }\n`
      + `export function call(): string | undefined { return pass(${JSON.stringify(payload)}); }`);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const checked = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
    assert.equal(checked.kind, "ok");
    const typed = checked.value;
    const caller = [...typed.bodies.values()].find(body => body.bindings.kind === "instantiated"
      && body.root.kind === "Block" && body.params.length === 0);
    assert.ok(caller);
    const call = caller.root.statements.nodes[0].expression;
    const [literal] = call.arguments.nodes;
    assert.equal(literal.kind, "StringLiteral");
    assert.equal(literal.tsonic.value, payload);
    const { callee, arguments: slots } = call.tsonic.application.decision;
    const selected = typed.bodies.get(instanceKey(callee.activation));
    assert.ok(selected);
    assert.equal(selected.params[0].tsonic.initializer !== null, defaulted);
    assert.deepEqual(slots, [{ kind: "provided", parameter: 0, expression: literal.id }]);
    const interner = captured.value.types;
    const defs = { completionSelector: internType(interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: internType(interner, { kind: "intrinsic", intrinsic: "unknown" }) };
    const table = viewTypes(interner);
    const destination = table.signatures[selected.signature].parameters[0].type;
    const { value: base } = table.terms[destination];
    assert.deepEqual(table.terms[destination], { kind: "optional", value: base });
    assert.deepEqual(table.terms[base], { kind: "string" });
    assert.deepEqual(table.terms[literal.tsonic.type], { kind: "literal", base, value: { kind: "string", value: payload } });
    assert.equal(literal.tsonic.convertedType, destination);
    const { decision } = literal.tsonic.conversion.operation;
    assert.equal(decision.kind, "selected");
    assert.deepEqual(decision.execution, { kind: "pure" });
    assert.equal(decision.operation.kind, "conversion");
    assert.equal(decision.operation.embedding.conversion, "union-injection");
    assert.deepEqual(decision.operation.embedding.check, { kind: "none" });
    const instance = { body: caller.body, bindings: caller.bindings };
    const run = { selectedNativeFacts: input.snapshot.nativeFacts, interner, table, defs,
      lowering: input.limits.lowering, verification: input.limits.mirVerification,
      declarationOf: typed.declarationOf, bodyOwner: body => body === selected.body ? selected.owner : null,
      bodyOf: target => typed.bodies.get(instanceKey(target)) ?? null };
    assert.deepEqual(caller.nestedBodies, []);
    const lowered = lowerToMir(lowerMirDeps(run, { request: { query: "mirBody", key: instanceKey(instance) },
      position: { kind: "result" } }), caller, [], typed.required.provided.get(instanceKey(instance)));
    assert.equal(lowered.kind, "ok");
    assert.deepEqual(verifyMir(lowered.value, mirVerificationContext(run, caller, typed.required.provided.get(instanceKey(instance)))), { kind: "complete", violations: [] });
    const mir = lowered.value;
    const block = mir.blocks.find(row => row.terminator.kind === "call" && row.terminator.tir.node === call.id);
    assert.equal(block.terminator.callee.kind, "direct");
    assert.deepEqual(block.terminator.callee.resolution.decision, callee.decision);
    const evaluations = block.statements.filter(row => row.kind === "assign" && row.tir.node === literal.id);
    assert.equal(evaluations.length, 1);
    const [evaluation] = evaluations;
    assert.equal(evaluation.value.kind, "convert");
    assert.deepEqual(evaluation.value.operation.decision, decision);
    assert.equal(evaluation.value.operand.kind, "constant");
    const constant = mir.constants[evaluation.value.operand.constant];
    assert.deepEqual(constant.value, { kind: "literal", value: { kind: "string", value: payload } });
    assert.equal(constant.type, literal.tsonic.type);
    assert.deepEqual(block.terminator.arguments, [{ kind: "value", passing: "by-value", operand: { kind: "place", place: evaluation.place } }]);
  }
});
