import assert from "node:assert/strict";
import { createAccount } from "../../packages/host/dist/dataflow/index.js";
import { test } from "node:test";
import { loadFrontFixture, navigationCapture } from "./fixtures/front/checked-module.mjs";
import { analyzeHostProgram } from "../../packages/host/dist/pipeline/index.js";
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

async function analyze(source) {
  const input = await inputs(source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", result.kind === "ok" ? undefined : JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  assert.ok(module);
  assert.ok(index.dependencyInventory);
  const selected = module.bodies.filter(row => row.kind === "selected");
  const callee = selected.find(row => row.tir.root.kind === "Block" && row.tir.params.length === 1);
  assert.ok(callee);
  const callers = selected.filter(row => row.tir.root.kind === "Block" && row.tir.params.length === 0);
  return { index, module, callee, callers };
}

function observe(index, caller, callee, provided) {
  const call = caller.tir.root.statements.nodes.at(-1).expression;
  assert.equal(call.kind, "CallExpression");
  assert.equal(call.arguments.nodes.length, provided);
  assert.equal(call.tsonic.application.kind, "decided");
  const decision = call.tsonic.application.decision;
  assert.deepEqual(decision.callee.activation, callee.instance);
  const mir = caller.mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.tir.node === call.id)?.terminator;
  assert.ok(mir);
  assert.equal(mir.callee.kind, "direct");
  assert.equal(mir.arguments.length, 1);
  const facts = caller.facts.find(row => row.execution.provided === 0);
  assert.ok(facts);
  const invocation = facts.origins.invocations.find(row => row.node === call.id);
  assert.equal(invocation?.alternatives.length, 1);
  const alternative = invocation.alternatives[0];
  const execution = { kind: "body", execution: { instance: callee.instance, provided } };
  assert.deepEqual(alternative.summary, execution);
  assert.equal(alternative.arguments.length, 1);
  const transport = alternative.arguments[0];
  assert.equal(transport.parameter, callee.tir.params[0].tsonic.declaration);
  assert.equal(transport.parameterIndex, 0);
  const edges = index.dependencyInventory.dependencies.filter(edge => edge.dependent.instance.body === caller.instance.body);
  assert.deepEqual(edges.filter(edge => edge.reason === "call").map(edge => edge.target), [execution]);
  return { call, decision, mir, facts, transport, slots: facts.arena.contexts[alternative.context].arguments, edges };
}

for (const annotated of [false, true]) test(`public choose(null) supplies native absence to the ${annotated ? "annotated" : "inferred"} formal without invoking its default`, async () => {
  const annotation = annotated ? ": null" : "";
  const { index, module, callee, callers } = await analyze(`
export function choose(flag${annotation} = null)${annotation} { return flag; }
export function callWithNull() { return choose(null); }
export function callWithoutArgument() { return choose(); }`);
  assert.equal(callers.length, 2);
  const printed = printModuleBodies(index, module);
  const decoded = parseModuleBodies(index, printed);
  assert.equal(decoded.kind, "parsed");
  assert.equal(printModuleBodies(index, decoded.value), printed);
  const supplied = callers.find(row => row.tir.root.statements.nodes[0].expression.arguments.nodes.length === 1);
  const omitted = callers.find(row => row.tir.root.statements.nodes[0].expression.arguments.nodes.length === 0);
  assert.ok(supplied);
  assert.ok(omitted);
  const actual = observe(index, supplied, callee, 1);
  const literal = actual.call.arguments.nodes[0];
  assert.equal(literal.kind, "NullKeyword");
  assert.deepEqual(index.types.terms[literal.tsonic.type], { kind: "intrinsic", intrinsic: "absence" });
  const formalType = callee.tir.params[0].type;
  if (annotated) {
    assert.equal(formalType.kind, "LiteralType");
    assert.equal(formalType.tsonic.type, literal.tsonic.type);
    assert.equal(formalType.literal.kind, "NullKeyword");
    assert.deepEqual(formalType.literal.tsonic, { role: "type-literal", type: literal.tsonic.type });
  } else assert.equal(formalType, null);
  assert.deepEqual(actual.decision.arguments, [{ kind: "provided", parameter: 0, expression: literal.id }]);
  const operand = actual.mir.arguments[0].operand;
  assert.equal(actual.mir.arguments[0].kind, "value");
  assert.equal(operand.kind, "constant");
  assert.deepEqual(supplied.mir.constants[operand.constant],
    { id: operand.constant, type: literal.tsonic.type, value: { kind: "literal", value: { kind: "absence" } } });
  assert.equal(actual.transport.kind, "provided");
  assert.equal(actual.transport.authoredIndex, 0);
  assert.deepEqual(actual.slots, [{ kind: "provided", origins: actual.transport.actual }]);
  assert.equal(actual.facts.arena.origins[actual.transport.actual].includesAbsence, true);
  assert.equal(actual.edges.some(edge => edge.reason === "initializer"), false);

  const missing = observe(index, omitted, callee, 0);
  const initializer = callee.tir.params[0].tsonic.initializer;
  assert.notEqual(initializer, null);
  assert.deepEqual(missing.decision.callee.decision.parameters, [{ kind: "default", parameter: 0, initializer }]);
  assert.deepEqual(missing.mir.arguments, [{ kind: "omitted" }]);
  assert.deepEqual(missing.slots, [{ kind: "omitted" }]);
  assert.equal(missing.transport.kind, "omitted");
  assert.equal(Object.hasOwn(missing.transport, "actual"), false);
  assert.equal(missing.edges.some(edge => edge.reason === "initializer" && edge.target.kind === "body"
    && edge.target.execution.instance.body === initializer), true);
  for (const provided of [0, 1]) {
    const entry = callee.mir.entries.find(row => row.provided === provided);
    assert.ok(entry);
    const terminator = callee.mir.blocks[entry.block].terminator;
    assert.equal(terminator.kind === "call" && terminator.callee.kind === "body" && terminator.callee.instance.body === initializer,
      provided === 0);
  }
});

test("a shadowing local named undefined remains the provided Boolean and does not enter the default", async () => {
  const { index, module, callee, callers } = await analyze(`
export function choose(flag: boolean = true): boolean { return flag; }
export function call(): boolean { const undefined: boolean = false; return choose(undefined); }`);
  assert.equal(callers.length, 1);
  const caller = callers[0];
  const { call, mir, facts, transport, slots, edges } = observe(index, caller, callee, 1);
  const argument = call.arguments.nodes[0];
  const declaration = caller.tir.root.statements.nodes[0].declarationList.declarations.nodes[0];
  assert.equal(argument.kind, "Identifier");
  assert.equal(argument.text, "undefined");
  assert.deepEqual(argument.tsonic.resolution, { kind: "local", local: declaration.tsonic.declaration.local });
  const initializer = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.initializer);
  assert.equal(initializer?.tir.root.kind, "FalseKeyword");
  assert.equal(mir.arguments[0].kind, "value");
  assert.equal(transport.kind, "provided");
  assert.equal(transport.authoredIndex, 0);
  assert.deepEqual(slots, [{ kind: "provided", origins: transport.actual }]);
  assert.equal(facts.arena.origins[transport.actual].includesAbsence, false);
  assert.equal(edges.some(edge => edge.reason === "initializer" && edge.target.kind === "body"
    && edge.target.execution.instance.body === callee.tir.params[0].tsonic.initializer), false);
});

test("a published nullable union has one native absence arm and a nonexecuting null literal", async () => {
  const input = await inputs(`export type Optional = string | null;
export function keep(value: boolean): boolean { return !value; }`);
  const program = analyzeHostProgram(input);
  assert.equal(program.kind, "ok");
  const { index, modules } = program.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const root = module.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "SourceFile");
  const { type } = root.tir.root.statements.nodes.find(node => node.kind === "TypeAliasDeclaration");
  assert.equal(type.kind, "UnionType");
  const syntax = type.types.nodes.find(node => node.kind === "LiteralType");
  assert.equal(syntax.literal.kind, "NullKeyword");
  assert.deepEqual(syntax.literal.tsonic, { role: "type-literal", type: syntax.tsonic.type });
  const optional = index.types.terms[type.tsonic.type];
  assert.equal(optional.kind, "optional");
  assert.deepEqual(index.types.terms[syntax.tsonic.type], { kind: "intrinsic", intrinsic: "absence" });
  assert.deepEqual(index.types.terms[optional.value], { kind: "string" });
});

test("typed null annotations refuse both crossed checked literal evidence and a non-absence type", async () => {
  const input = await inputs(`export type OnlyNull = null;
export function keep(value: boolean): boolean { return !value; }`);
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const result = captureSourceBarrier(input);
  assert.equal(result.kind, "ok");
  const module = result.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const [alias, keep] = module.tree.statements.nodes;
  const annotation = alias.type;
  const boolean = keep.parameters.nodes[0].type.tsonic.type;
  assert.equal(annotation.kind, "LiteralType");
  assert.equal(boolean.kind, "available");
  assert.notEqual(annotation.tsonic.type.value, boolean.value);
  annotation.literal.tsonic = { ...annotation.literal.tsonic, type: boolean };
  const crossedLiteral = "A literal annotation requires its actual checked literal and type.";
  assert.throws(() => typeSourceBarrier(input, result.value, createAccount(input.limits.dataflow)), {
    message: crossedLiteral, cause: { owner: "elaborate", query: null, origin: null, message: crossedLiteral },
  });
  annotation.tsonic = { ...annotation.tsonic, type: boolean };
  const foreignType = "A null annotation must retain the single native absence type.";
  assert.throws(() => typeSourceBarrier(input, result.value, createAccount(input.limits.dataflow)), {
    message: foreignType, cause: { owner: "elaborate", query: null, origin: null, message: foreignType },
  });
});

test("a published readonly tuple retains required slot order and the native absence type", async () => {
  const input = await inputs(`export type Pair = readonly [boolean, null];
export function keep(value: boolean): boolean { return !value; }`);
  const program = analyzeHostProgram(input);
  assert.equal(program.kind, "ok");
  const { index, modules } = program.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const root = module.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "SourceFile");
  const { type } = root.tir.root.statements.nodes.find(node => node.kind === "TypeAliasDeclaration");
  assert.equal(type.kind, "TypeOperator");
  assert.equal(type.operator, "ReadonlyKeyword");
  assert.equal(type.type.kind, "TupleType");
  const terms = type.type.elements.nodes.map(element => element.tsonic.type);
  assert.deepEqual(terms.map(id => index.types.terms[id]),
    [{ kind: "primitive", primitive: "bool" }, { kind: "intrinsic", intrinsic: "absence" }]);
  assert.deepEqual(index.types.terms[type.tsonic.type], { kind: "tuple", readonly: true,
    elements: terms.map(id => ({ declaration: null, kind: "required", type: id })) });
  assert.deepEqual(index.types.terms[type.type.tsonic.type], index.types.terms[type.tsonic.type]);
});
