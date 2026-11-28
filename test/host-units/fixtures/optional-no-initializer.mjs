import assert from "node:assert/strict";
import { loadFrontFixture } from "./front/checked-module.mjs";
import { analyzeOptionalSource } from "./optional-default.mjs";
import { parseModuleBodies, printModuleBodies } from "../../../packages/host/dist/ir-program/index.js";

const declaration = "export function pass(value?: boolean): boolean | undefined { return value; }";
const required = "export function pass(value: boolean | undefined): boolean | undefined { return value; }";
const call = argument => "\nexport function call(): boolean | undefined { return pass(" + argument + "); }";

export async function checkOptionalNoInitializer() {
  const fixture = await loadFrontFixture();
  const { raw, checked, interner } = fixture.checkedModuleOf(declaration);
  const parameterOf = tree => tree.statements.nodes.find(node => node.kind === "FunctionDeclaration").parameters.nodes[0];
  const written = parameterOf(raw.tree);
  assert.equal(written.questionToken.kind, "QuestionToken");
  assert.equal(written.initializer, null);
  assert.deepEqual(parameterOf(checked.tree).questionToken, written.questionToken);
  assert.ok(fixture.hir.indexSyntaxTree(checked.tree).every((node, position) => node.id === position));
  const roundTrip = fixture.hir.parseHir(fixture.hir.printHir(checked));
  assert.equal(roundTrip.kind, "parsed");
  assert.deepEqual(parameterOf(roundTrip.value.tree).questionToken, written.questionToken);
  assert.deepEqual(fixture.verifyChecked(roundTrip.value, interner), []);

  let omitted;
  let requiredFormal;
  for (const [source, optional, provided] of [
    [declaration, true, null], [declaration + call(""), true, 0],
    [declaration + call("undefined"), true, 1], [required + call("undefined"), false, 1],
  ]) {
    const program = await analyzeOptionalSource(source, {}, provided === null ? ["pass"] : ["pass", "call"]);
    assert.equal(program.kind, "ok");
    const { index, modules } = program.value;
    const active = modules.flatMap(module => module.bodies).filter(body => body.kind === "selected" && body.tir.root.kind === "Block");
    const callee = active.find(body => body.tir.params.length === 1);
    assert.ok(callee);
    const module = modules.find(module => module.bodies.includes(callee));
    const signature = index.types.signatures[callee.tir.signature];
    const formal = signature.parameters[0];
    const header = callee.tir.params[0];
    assert.equal(formal.kind, optional ? "optional" : "required");
    assert.equal(formal.declaration, header.tsonic.declaration);
    assert.equal(header.tsonic.role, formal.kind);
    assert.equal(formal.acceptsOmission, optional);
    assert.equal(formal.initializer, null);
    assert.deepEqual(header.initializer, { kind: "none" });
    assert.equal(header.tsonic.storage, formal.type);
    assert.equal(callee.tir.root.statements.nodes[0].expression.tsonic.type, formal.type);
    assert.equal(callee.tir.root.statements.nodes[0].expression.tsonic.conversion.kind, "identity");
    assert.equal(index.types.terms[formal.type].kind, "optional");
    if (optional) {
      assert.deepEqual(header.questionToken, written.questionToken);
      assert.deepEqual(index.types.terms[header.type.tsonic.type], { kind: "primitive", primitive: "bool" });
      assert.deepEqual(callee.mir.entries.map(entry => entry.provided), [1, 0]);
      const entry = callee.mir.blocks[callee.mir.entries[1].block];
      assert.equal(entry.terminator.kind, "goto");
      assert.equal(entry.terminator.target, callee.mir.entries[0].block);
      const [assignment] = entry.statements;
      assert.equal(entry.statements.length, 1);
      assert.equal(assignment.kind, "assign");
      assert.equal(assignment.tir.node, header.id);
      assert.equal(callee.mir.locals[callee.mir.places[assignment.place].base.local].role.index, 0);
      assert.equal(assignment.value.kind, "use");
      assert.equal(assignment.value.operand.kind, "constant");
      const constant = callee.mir.constants[assignment.value.operand.constant];
      assert.equal(constant.type, formal.type);
      assert.deepEqual(constant.value, { kind: "literal", value: { kind: "absence" } });
      const missing = callee.facts.find(row => row.execution.provided === 0);
      assert.ok(missing);
      assert.deepEqual(missing.arena.contexts[0].arguments, [{ kind: "omitted" }]);
      const returned = missing.origins.subjects.find(row => row.role === "return");
      assert.equal(missing.arena.origins[returned.origins].includesAbsence, true);
      assert.deepEqual(missing.arena.origins[returned.origins].producers, []);
    } else {
      assert.equal(header.questionToken, null);
      assert.deepEqual(callee.mir.entries.map(entry => entry.provided), [1]);
      requiredFormal = formal;
    }
    assert.ok(module.bodies.every(body => body.tir.root.kind === "SourceFile" || body.tir.root.kind === "Block"),
      "no initializer body is synthesized");
    assert.ok(index.dependencyInventory);
    const edges = index.dependencyInventory.dependencies;
    assert.equal(edges.some(edge => edge.reason === "initializer"), false);
    if (provided === null) continue;
    const caller = active.find(body => body.tir.params.length === 0);
    assert.ok(caller);
    const expression = caller.tir.root.statements.nodes[0].expression;
    assert.equal(expression.arguments.nodes.length, provided);
    const { arguments: arguments_, callee: selected } = expression.tsonic.application.decision;
    const mir = caller.mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.tir.node === expression.id).terminator;
    assert.equal(mir.callee.kind, "direct");
    const facts = caller.facts[0];
    const invocation = facts.origins.invocations[0].alternatives[0];
    const transport = invocation.arguments[0];
    const slot = facts.arena.contexts[invocation.context].arguments[0];
    assert.deepEqual(invocation.summary, { kind: "body", execution: { instance: callee.instance, provided } });
    assert.deepEqual(edges.filter(edge => edge.dependent.instance.body === caller.instance.body && edge.reason === "call")
      .map(edge => edge.target), [invocation.summary]);
    assert.equal(facts.arena.origins[invocation.result].includesAbsence, true);
    assert.equal(transport.parameter, formal.declaration);
    if (provided === 0) {
      assert.deepEqual(selected.decision.parameters, [{ kind: "omitted", parameter: 0, type: formal.type }]);
      assert.deepEqual(arguments_, [{ kind: "omitted", parameter: 0, value: { kind: "absence" } }]);
      assert.deepEqual(mir.arguments, [{ kind: "omitted" }]);
      assert.deepEqual(slot, { kind: "omitted" });
      assert.equal(transport.kind, "omitted");
      assert.equal(Object.hasOwn(transport, "actual"), false);
      omitted = { index, caller, mir, formal, header };
    } else {
      const argument = expression.arguments.nodes[0];
      assert.equal(argument.kind, "Identifier");
      assert.deepEqual(argument.tsonic.resolution, { kind: "intrinsic-value", intrinsic: "undefined" });
      assert.deepEqual(arguments_, [{ kind: "provided", parameter: 0, expression: argument.id }]);
      assert.equal(mir.arguments[0].kind, "value");
      assert.equal(transport.kind, "provided");
      assert.deepEqual(slot, { kind: "provided", origins: transport.actual });
      assert.equal(facts.arena.origins[transport.actual].includesAbsence, true);
      const embedding = argument.tsonic.conversion.operation.decision.operation.embedding;
      assert.equal(embedding.conversion, "absence");
      assert.deepEqual(embedding.proof.steps[0].to, { root: { kind: "item", value: {
        owner: formal.declaration, node: optional ? header.id : header.type.id,
      } }, path: [] });
    }
    const printed = printModuleBodies(index, module);
    const decoded = parseModuleBodies(index, printed);
    assert.equal(decoded.kind, "parsed");
    assert.equal(printModuleBodies(index, decoded.value), printed);
  }
  const missingSource = required + call("");
  const { raw: missingRaw, checked: missingChecked, interner: missingTypes, definitions: missingDefinitions }
    = fixture.checkedModuleOf(missingSource);
  assert.deepEqual(fixture.verifyChecked(missingChecked, missingTypes), []);
  const [requiredDeclaration, rejectedCaller] = missingChecked.tree.statements.nodes;
  const missingFormal = requiredDeclaration.parameters.nodes[0];
  assert.deepEqual(missingDefinitions.rows.filter(row => row.node === missingFormal.id).map(row => row.definition),
    [requiredFormal.declaration]);
  const rejectedCall = rejectedCaller.body.statements.nodes[0].expression;
  const [rejected] = missingRaw.calls;
  const module = missingRaw.module;
  const original = { module, index: 0 };
  assert.equal(rejected.kind, "conditional-candidates");
  assert.deepEqual(rejected.invocation, { module, node: rejectedCall.id });
  assert.deepEqual(rejected.diagnostics, [original]);
  assert.equal(rejected.declarationOrder.kind, "available");
  assert.equal(rejected.declarationOrder.value.length, 1);
  const signature = missingRaw.types.signatures[rejected.declarationOrder.value[0]];
  assert.deepEqual(signature.declaration, { module, node: requiredDeclaration.id });
  assert.equal(signature.parameters.length, 1);
  assert.deepEqual(signature.parameters[0].declaration, { module, node: missingFormal.id });
  assert.equal(signature.parameters[0].acceptsOmission, false);
  assert.deepEqual(missingRaw.types.candidates[rejected.candidates].candidates, []);
  assert.equal(rejectedCall.tsonic.application.kind, "available");
  assert.deepEqual(rejectedCall.tsonic.application.value.arguments, []);
  assert.deepEqual(rejectedCall.tsonic.application.value.resolvedSignature, { kind: "unavailable", reason: "checker-error",
    causes: [{ kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: original } }] });

  const refused = await analyzeOptionalSource(missingSource);
  assert.equal(refused.kind, "refused");
  assert.deepEqual(refused.diagnostics, missingRaw.checkerDiagnostics);
  assert.deepEqual(refused.diagnostics.map(row => row.code), [{ kind: "checker", number: 2554, rendered: "TS2554" }]);
  assert.deepEqual(refused.diagnostics[0].related.map(row => [row.code.number, row.site]),
    [[6210, { kind: "source", origin: missingFormal.origin }]]);
  return { omitted, requiredFormal };
}

export async function checkOptionalReferenceNoInitializer() {
  const program = await analyzeOptionalSource(
    "export function pass(value?: string): string | undefined { return value; }\n"
    + "export function omit(): string | undefined { return pass(); }\n"
    + "export function absent(): string | undefined { return pass(undefined); }\n"
    + "export function present(input: string): string | undefined { return pass(input); }", {}, ["omit", "absent", "present"]);
  assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
  const { index, modules } = program.value;
  const bodies = modules.flatMap(module => module.bodies).filter(body => body.kind === "selected");
  const callee = bodies.find(body => body.tir.params[0]?.questionToken?.kind === "QuestionToken");
  assert.ok(callee);
  assert.ok(bodies.every(body => body.tir.root.kind === "SourceFile" || body.tir.root.kind === "Block"));
  const header = callee.tir.params[0];
  const [formal] = index.types.signatures[callee.tir.signature].parameters;
  assert.equal(formal.kind, "optional");
  assert.equal(formal.passing, "by-value");
  assert.equal(formal.acceptsOmission, true);
  assert.equal(formal.initializer, null);
  assert.deepEqual(header.initializer, { kind: "none" });
  assert.equal(header.tsonic.initializer, null);
  assert.equal(header.tsonic.storage, formal.type);
  assert.deepEqual(index.types.terms[formal.type], { kind: "optional", value: header.type.tsonic.type });
  assert.deepEqual(index.types.terms[header.type.tsonic.type], { kind: "string" });
  const entries = callee.mir.entries;
  assert.deepEqual(entries.map(entry => entry.provided), [1, 0]);
  const prologue = callee.mir.blocks[entries[1].block];
  assert.equal(prologue.terminator.kind, "goto");
  assert.equal(prologue.terminator.target, entries[0].block);
  assert.equal(prologue.statements.length, 1);
  const [write] = prologue.statements;
  assert.equal(write.kind, "assign");
  assert.equal(write.tir.node, header.id);
  const place = callee.mir.places[write.place];
  assert.equal(place.base.kind, "local");
  assert.deepEqual(callee.mir.locals[place.base.local].role, { kind: "parameter", index: 0 });
  assert.equal(write.value.kind, "use");
  assert.equal(write.value.operand.kind, "constant");
  assert.deepEqual(callee.mir.constants[write.value.operand.constant], { id: write.value.operand.constant,
    type: formal.type, value: { kind: "literal", value: { kind: "absence" } } });

  const checkValue = (arena, identity, hasReference) => {
    const value = arena.origins[identity];
    assert.equal(value.kind, "complete");
    assert.equal(value.includesAbsence, !hasReference);
    assert.deepEqual(value.producers.map(bound => {
      const producer = arena.producers[arena.boundProducers[bound].producer];
      return { kind: producer.kind, index: producer.index, path: producer.path };
    }), hasReference ? [{ kind: "parameter", index: 0, path: null }] : []);
    return value.producers;
  };
  assert.deepEqual(callee.facts.map(facts => facts.execution.provided), [0, 1]);
  for (const facts of callee.facts) {
    const [slot] = facts.arena.contexts[0].arguments;
    assert.equal(slot.kind, facts.execution.provided === 0 ? "omitted" : "provided");
    checkValue(facts.arena, facts.origins.subjects.find(row => row.role === "return").origins, facts.execution.provided === 1);
  }
  assert.ok(index.dependencyInventory);
  const edges = index.dependencyInventory.dependencies;
  assert.equal(edges.some(edge => edge.reason === "initializer"), false);
  const dispositions = [];
  for (const caller of bodies.filter(body => body !== callee && body.tir.root.kind === "Block")) {
    const call = caller.tir.root.statements.nodes[0].expression;
    const provided = call.arguments.nodes.length;
    const [source] = call.arguments.nodes;
    const selected = call.tsonic.application.decision;
    assert.deepEqual(selected.callee.activation, callee.instance);
    const mir = caller.mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.tir.node === call.id).terminator;
    const facts = caller.facts[0];
    const [invocation] = facts.origins.invocations.find(row => row.node === call.id).alternatives;
    const [transport] = invocation.arguments;
    const [slot] = facts.arena.contexts[invocation.context].arguments;
    assert.deepEqual(invocation.summary, { kind: "body", execution: { instance: callee.instance, provided } });
    assert.deepEqual(edges.filter(edge => edge.dependent.instance.body === caller.instance.body && edge.reason === "call")
      .map(edge => edge.target), [invocation.summary]);
    assert.equal(transport.parameter, formal.declaration);
    const hasReference = source?.tsonic.resolution.kind === "local";
    if (source === undefined) {
      dispositions.push("omitted");
      assert.deepEqual(selected.callee.decision.parameters, [{ kind: "omitted", parameter: 0, type: formal.type }]);
      assert.deepEqual(selected.arguments, [{ kind: "omitted", parameter: 0, value: { kind: "absence" } }]);
      assert.deepEqual(mir.arguments, [{ kind: "omitted" }]);
      assert.deepEqual(slot, { kind: "omitted" });
      assert.equal(transport.kind, "omitted");
      assert.equal(Object.hasOwn(transport, "actual"), false);
    } else {
      dispositions.push(hasReference ? "present" : "supplied-absence");
      assert.deepEqual(selected.arguments, [{ kind: "provided", parameter: 0, expression: source.id }]);
      assert.equal(mir.arguments[0].kind, "value");
      assert.equal(transport.kind, "provided");
      assert.equal(transport.authoredIndex, 0);
      assert.deepEqual(slot, { kind: "provided", origins: transport.actual });
      assert.deepEqual(source.tsonic.resolution, hasReference ? { kind: "local", local: caller.tir.params[0].tsonic.local }
        : { kind: "intrinsic-value", intrinsic: "undefined" });
      assert.equal(source.tsonic.convertedType, formal.type);
      assert.equal(source.tsonic.conversion.operation.decision.operation.embedding.conversion, hasReference ? "union-injection" : "absence");
      checkValue(facts.arena, transport.actual, hasReference);
    }
    assert.equal(facts.origins.subjects.find(row => row.role === "return").origins, invocation.result);
    checkValue(facts.arena, invocation.result, hasReference);
    const summary = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === caller.instance.body);
    assert.equal(summary.key.execution.provided, hasReference ? 1 : 0);
    const retained = checkValue(summary.arena, summary.result, hasReference);
    assert.deepEqual(summary.retention.map(row => [row.source, row.into]), retained.map(bound => [bound, { kind: "return" }]));
  }
  assert.deepEqual(dispositions.sort(), ["omitted", "present", "supplied-absence"]);
  const module = modules.find(row => row.bodies.includes(callee));
  const printed = printModuleBodies(index, module);
  const decoded = parseModuleBodies(index, printed);
  assert.equal(decoded.kind, "parsed");
  assert.equal(printModuleBodies(index, decoded.value), printed);
}
