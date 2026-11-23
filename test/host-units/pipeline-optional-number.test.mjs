import assert from "node:assert/strict";
import { test } from "node:test";
import { nativeFactsKey } from "../../packages/host/dist/ir-types/index.js";
import { parseModuleBodies, printModuleBodies } from "../../packages/host/dist/ir-program/index.js";
import { nativeFactsFixture } from "./fixtures/native-facts.mjs";
import { analyzeOptionalSource } from "./fixtures/optional-default.mjs";

test("optional native number copies the selected float64 value and keeps supplied absence distinct from omission", async () => {
  const program = await analyzeOptionalSource(
    "export function pass(value?: number): number | undefined { return value; }\n"
    + "export function omit(): number | undefined { return pass(); }\n"
    + "export function absent(): number | undefined { return pass(undefined); }\n"
    + "export function present(input: number): number | undefined { return pass(input); }");
  assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
  const { index, modules } = program.value;
  const native = nativeFactsFixture();
  assert.equal(index.nativeFactsKey, nativeFactsKey(native));
  assert.equal(native.floatingFormats.find(format => format.carrier === "float64").interchange, "ieee754-binary64");
  const selected = modules.flatMap(module => module.bodies).filter(body => body.kind === "selected");
  const callee = selected.find(body => body.tir.params[0]?.questionToken?.kind === "QuestionToken");
  assert.ok(callee);
  const [header] = callee.tir.params;
  const [formal] = index.types.signatures[callee.tir.signature].parameters;
  assert.equal(formal.kind, "optional");
  assert.equal(formal.initializer, null);
  assert.equal(formal.acceptsOmission, true);
  assert.equal(formal.passing, "by-value");
  const payload = header.type.tsonic.type;
  assert.deepEqual(index.types.terms[payload], { kind: "primitive", primitive: "float64" });
  assert.deepEqual(index.types.terms[formal.type], { kind: "optional", value: payload });
  assert.deepEqual(callee.mir.entries.map(row => row.provided), [1, 0]);
  const [full, omitted] = callee.mir.entries;
  const prologue = callee.mir.blocks[omitted.block];
  assert.equal(prologue.terminator.kind, "goto");
  assert.equal(prologue.terminator.target, full.block);
  assert.equal(prologue.statements.length, 1);
  const [assignment] = prologue.statements;
  assert.equal(assignment.kind, "assign");
  assert.equal(assignment.tir.node, header.id);
  const place = callee.mir.places[assignment.place];
  assert.equal(place.base.kind, "local");
  assert.deepEqual(callee.mir.locals[place.base.local].role, { kind: "parameter", index: 0 });
  assert.equal(assignment.value.kind, "use");
  assert.equal(assignment.value.operand.kind, "constant");
  assert.deepEqual(callee.mir.constants[assignment.value.operand.constant], { id: assignment.value.operand.constant,
    type: formal.type, value: { kind: "literal", value: { kind: "absence" } } });

  const checkOrigins = (arena, id, absence) => {
    assert.deepEqual(arena.origins[id], { id, kind: "complete", producers: [], includesAbsence: absence });
  };
  const summaryOf = (body, count) => index.summaries.find(row => row.key.kind === "body"
    && row.key.execution.instance.body === body.instance.body && row.key.execution.provided === count);
  const missing = summaryOf(callee, 0);
  checkOrigins(missing.arena, missing.result, true);
  assert.deepEqual(missing.retention, []);
  const supplied = summaryOf(callee, 1);
  const parameter = supplied.arena.origins[supplied.result];
  assert.equal(parameter.kind, "complete");
  assert.equal(parameter.includesAbsence, false);
  assert.equal(parameter.producers.length, 1);
  const bound = supplied.arena.boundProducers[parameter.producers[0]];
  assert.deepEqual(supplied.arena.producers[bound.producer], { id: bound.producer, kind: "parameter", index: 0, path: null });
  assert.deepEqual(supplied.retention, [], "the optional formal symbol transports presence, not retained ownership");
  assert.deepEqual(callee.facts.find(facts => facts.execution.provided === 1).origins.escapes, []);

  assert.ok(index.dependencyInventory);
  const edges = index.dependencyInventory.dependencies;
  assert.equal(edges.some(edge => edge.reason === "initializer"), false);
  const seen = [];
  for (const caller of selected.filter(body => body !== callee && body.tir.root.kind === "Block")) {
    const call = caller.tir.root.statements.nodes[0].expression;
    const [argument] = call.arguments.nodes;
    const hasValue = caller.tir.params.length === 1;
    const provided = call.arguments.nodes.length;
    const mir = caller.mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.tir.node === call.id).terminator;
    const facts = caller.facts[0];
    const [invocation] = facts.origins.invocations.find(row => row.node === call.id).alternatives;
    const [slot] = facts.arena.contexts[invocation.context].arguments;
    const [transport] = invocation.arguments;
    assert.deepEqual(invocation.summary, { kind: "body", execution: { instance: callee.instance, provided } });
    assert.deepEqual(edges.filter(edge => edge.dependent.instance.body === caller.instance.body && edge.reason === "call")
      .map(edge => edge.target), [invocation.summary]);
    assert.equal(transport.parameter, formal.declaration);
    if (argument === undefined) {
      seen.push("omitted");
      assert.deepEqual(mir.arguments, [{ kind: "omitted" }]);
      assert.deepEqual(slot, { kind: "omitted" });
      assert.equal(transport.kind, "omitted");
      assert.equal(Object.hasOwn(transport, "actual"), false);
    } else {
      seen.push(hasValue ? "present" : "supplied-absence");
      assert.equal(transport.kind, "provided");
      assert.equal(mir.arguments[0].kind, "value");
      assert.equal(mir.arguments[0].passing, "by-value");
      assert.deepEqual(slot, { kind: "provided", origins: transport.actual });
      assert.equal(argument.tsonic.convertedType, formal.type);
      assert.equal(argument.tsonic.conversion.operation.decision.operation.embedding.conversion, hasValue ? "union-injection" : "absence");
      if (hasValue) assert.equal(argument.tsonic.type, payload);
      else assert.deepEqual(argument.tsonic.resolution, { kind: "intrinsic-value", intrinsic: "undefined" });
      checkOrigins(facts.arena, transport.actual, !hasValue);
    }
    assert.equal(facts.origins.subjects.find(row => row.role === "return").origins, invocation.result);
    checkOrigins(facts.arena, invocation.result, !hasValue);
    const summary = summaryOf(caller, hasValue ? 1 : 0);
    checkOrigins(summary.arena, summary.result, !hasValue);
    assert.deepEqual(summary.retention, []);
  }
  assert.deepEqual(seen.sort(), ["omitted", "present", "supplied-absence"]);
});

test("plain assignment to optional Float64 storage retains the exact selected literal and its injection", async () => {
  const source = "export function writeLocal(input: number): number | undefined { let cell: number | undefined = input; cell = (1.25); return cell; }\n";
  const expected = { numerator: 5n, denominator: 4n, negativeZero: false };
  const program = await analyzeOptionalSource(source);
  assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
  const { index, modules } = program.value;
  const main = modules.find(module => module.tree.statements.nodes.some(node => node.kind === "FunctionDeclaration" && node.name.text === "writeLocal"));
  assert.ok(main);
  const text = printModuleBodies(index, main);
  const decoded = parseModuleBodies(index, text);
  assert.equal(decoded.kind, "parsed");
  for (const module of [main, decoded.value]) {
    const body = module.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "Block");
    const assignment = body.tir.root.statements.nodes.find(node => node.kind === "ExpressionStatement").expression;
    assert.equal(assignment.operatorToken.kind, "EqualsToken");
    assert.equal(assignment.tsonic.role, "assignment");
    assert.equal(assignment.tsonic.calculation, null);
    const { storage } = assignment.tsonic;
    const { right } = assignment;
    assert.equal(right.kind, "ParenthesizedExpression");
    assert.equal(right.expression.kind, "NumericLiteral");
    assert.deepEqual(right.expression.tsonic.value, expected);
    const [term, domain] = [right.tsonic.type, storage].map(type => index.types.terms[type]);
    assert.equal(term.kind, "literal");
    assert.deepEqual(term.value, { kind: "number", value: expected });
    assert.deepEqual(domain, { kind: "optional", value: term.base });
    assert.deepEqual(index.types.terms[term.base], { kind: "primitive", primitive: "float64" });
    assert.equal(right.tsonic.convertedType, storage);
    const conversion = right.tsonic.conversion;
    assert.equal(conversion.kind, "convert");
    assert.equal(conversion.role, "assignment");
    const embedding = conversion.operation.decision.operation.embedding;
    assert.deepEqual(embedding, { kind: "conversion", conversion: "union-injection", check: { kind: "none" },
      proof: { conclusion: 0, steps: [{
        from: { root: { kind: "body", value: { body: body.instance.body, node: right.id } }, path: [] },
        to: { root: { kind: "body", value: { body: body.instance.body, node: assignment.left.id } }, path: [] },
        rule: "union-injection", premises: [],
      }] } });
    const statements = body.mir.blocks.flatMap(block => block.statements);
    const converted = statements.filter(row => row.kind === "assign" && row.value.kind === "convert"
      && row.value.operation.decision.operation.to === storage && row.value.operation.decision.operation.from === right.tsonic.type);
    assert.equal(converted.length, 1);
    assert.equal(converted[0].value.operand.kind, "constant");
    const constant = body.mir.constants[converted[0].value.operand.constant];
    assert.deepEqual({ type: constant.type, value: constant.value }, { type: right.tsonic.type,
      value: { kind: "literal", value: { kind: "number", token: "1.25", value: expected } } });
    const stored = statements.find(row => row.kind === "assign" && row.tir.node === assignment.id
      && row.value.kind === "use" && body.mir.places[row.place].storage === storage);
    assert.ok(stored);
    assert.equal(body.mir.places[stored.place].base.kind, "local");
  }
  assert.equal(printModuleBodies(index, decoded.value) === text, true);
  await assert.rejects(analyzeOptionalSource(source.replaceAll("1.25", "0.1")), /the embedding of .*\(assignment\)/u);
});

test("bare numeric tokens preserve exact present binary64 inputs through verified Program publication", async () => {
  const values = new Map([["0", [0n, 1n]], ["0x0", [0n, 1n]], ["1.25", [5n, 4n]], ["9_007_199_254_740_994", [9007199254740994n, 1n]]]);
  const source = "\uFEFF// 😀\r\nexport function pass(value?: number): number | undefined { return value; }\r\n"
    + [...values.keys()].map((token, index) => `export function call${index}(): number | undefined { return pass(${token}); }`).join("\r\n");
  const program = await analyzeOptionalSource(source);
  assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
  const { index, modules } = program.value;
  assert.equal(index.nativeFactsKey, nativeFactsKey(nativeFactsFixture()));
  const active = modules.flatMap(module => module.bodies).filter(body => body.kind === "selected" && body.tir.root.kind === "Block");
  const callee = active.find(body => body.tir.params[0]?.questionToken?.kind === "QuestionToken");
  assert.ok(callee);
  const [formal] = index.types.signatures[callee.tir.signature].parameters;
  const payload = callee.tir.params[0].type.tsonic.type;
  assert.deepEqual(index.types.terms[formal.type], { kind: "optional", value: payload });
  assert.deepEqual(index.types.terms[payload], { kind: "primitive", primitive: "float64" });
  const seen = [];
  for (const caller of active.filter(body => body !== callee)) {
    const call = caller.tir.root.statements.nodes[0].expression;
    const [argument] = call.arguments.nodes;
    assert.equal(argument.kind, "NumericLiteral");
    const token = source.slice(argument.origin.start, argument.origin.start + argument.origin.length);
    assert.equal(argument.text, token);
    seen.push(token);
    const [numerator, denominator] = values.get(token);
    const exact = { numerator, denominator, negativeZero: false };
    assert.deepEqual(argument.tsonic.value, exact);
    assert.deepEqual(index.types.terms[argument.tsonic.type], { kind: "literal", base: payload, value: { kind: "number", value: exact } });
    assert.equal(argument.tsonic.convertedType, formal.type);
    const block = caller.mir.blocks.find(row => row.terminator.kind === "call" && row.terminator.tir.node === call.id);
    const conversions = block.statements.filter(row => row.kind === "assign" && row.tir.node === argument.id);
    assert.equal(conversions.length, 1);
    const [conversion] = conversions;
    assert.equal(conversion.value.kind, "convert");
    assert.equal(conversion.value.operation.decision.operation.embedding.conversion, "union-injection");
    assert.equal(conversion.value.operand.kind, "constant");
    assert.deepEqual(caller.mir.constants[conversion.value.operand.constant].value, { kind: "literal", value: { kind: "number", token, value: exact } });
    assert.deepEqual(block.terminator.arguments, [{ kind: "value", passing: "by-value", operand: { kind: "place", place: conversion.place } }]);
    const facts = caller.facts[0];
    const [invocation] = facts.origins.invocations.find(row => row.node === call.id).alternatives;
    assert.deepEqual(invocation.summary, { kind: "body", execution: { instance: callee.instance, provided: 1 } });
    assert.deepEqual(facts.arena.origins[invocation.result], { id: invocation.result, kind: "complete", producers: [], includesAbsence: false });
    assert.equal(facts.arena.contexts[invocation.context].arguments[0].kind, "provided");
  }
  assert.deepEqual(seen.sort(), [...values.keys()].sort());
  const module = modules.find(row => row.bodies.includes(callee));
  const printed = printModuleBodies(index, module);
  const parsed = parseModuleBodies(index, printed);
  assert.equal(parsed.kind, "parsed");
  assert.equal(printModuleBodies(index, parsed.value), printed);
});
