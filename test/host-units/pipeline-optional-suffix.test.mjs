import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeOptionalSource } from "./fixtures/optional-default.mjs";

test("a required prefix and two optional formals keep authored evaluation and provided-count entry order", async () => {
  const program = await analyzeOptionalSource(
    "export function select(prefix: boolean, value?: boolean, tail?: boolean): boolean | undefined { return tail; }\n"
    + "export function one(): boolean | undefined { return select(false); }\n"
    + "export function two(): boolean | undefined { return select(false, undefined); }\n"
    + "export function three(): boolean | undefined { return select(false, undefined, true); }");
  assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
  const { index, modules } = program.value;
  const bodies = modules.flatMap(module => module.bodies).filter(body => body.kind === "selected" && body.tir.root.kind === "Block");
  const callee = bodies.find(body => body.tir.params.length === 3);
  assert.ok(callee);
  const formals = index.types.signatures[callee.tir.signature].parameters;
  const [prefix, ...suffix] = formals;
  assert.equal(prefix.kind, "required");
  assert.equal(prefix.acceptsOmission, false);
  assert.equal(suffix.length, 2);
  for (const formal of suffix) {
    assert.equal(formal.kind, "optional");
    assert.equal(formal.acceptsOmission, true);
    assert.equal(formal.initializer, null);
  }

  const entries = callee.mir.entries;
  assert.deepEqual(entries.map(entry => entry.provided), [3, 2, 1]);
  for (const [position, entry] of entries.entries()) {
    if (position === 0) continue;
    const prologue = callee.mir.blocks[entry.block];
    assert.equal(prologue.terminator.kind, "goto");
    assert.equal(prologue.terminator.target, entries[position - 1].block);
    const [write] = prologue.statements;
    assert.equal(prologue.statements.length, 1);
    assert.equal(write.kind, "assign");
    assert.equal(write.tir.node, callee.tir.params[entry.provided].id);
    const place = callee.mir.places[write.place];
    assert.equal(place.base.kind, "local");
    assert.deepEqual(callee.mir.locals[place.base.local].role, { kind: "parameter", index: entry.provided });
    assert.equal(write.value.kind, "use");
    assert.equal(write.value.operand.kind, "constant");
    const constant = callee.mir.constants[write.value.operand.constant];
    assert.equal(constant.type, formals[entry.provided].type);
    assert.deepEqual(constant.value, { kind: "literal", value: { kind: "absence" } });
  }

  assert.ok(index.dependencyInventory);
  const callers = bodies.filter(body => body !== callee);
  assert.equal(callers.length, 3);
  assert.deepEqual(callers.map(body => body.tir.root.statements.nodes[0].expression.arguments.nodes.length).sort(), [1, 2, 3]);
  const values = [{ kind: "boolean", value: false }, { kind: "absence" }, { kind: "boolean", value: true }];
  for (const caller of callers) {
    const call = caller.tir.root.statements.nodes[0].expression;
    const authored = call.arguments.nodes;
    const provided = authored.length;
    assert.deepEqual(authored.map(argument => argument.kind), ["FalseKeyword", "Identifier", "TrueKeyword"].slice(0, provided));
    if (provided >= 2)
      assert.deepEqual(authored[1].tsonic.resolution, { kind: "intrinsic-value", intrinsic: "undefined" });
    const block = caller.mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.tir.node === call.id);
    const mir = block.terminator;
    assert.equal(mir.callee.kind, "direct");
    const authoredNodes = authored.map(argument => argument.id);
    const evaluatesArgument = statement => statement.kind !== "storage-live" && statement.kind !== "storage-dead"
      && authoredNodes.includes(statement.tir.node);
    const evaluations = caller.mir.blocks.flatMap(block => block.statements.filter(evaluatesArgument));
    assert.deepEqual(evaluations.map(statement => statement.tir.node), authoredNodes);
    assert.deepEqual(block.statements.filter(evaluatesArgument), evaluations);
    const facts = caller.facts[0];
    const invocation = facts.origins.invocations.find(row => row.node === call.id);
    assert.equal(invocation.alternatives.length, 1);
    const [selected] = invocation.alternatives;
    assert.deepEqual(selected.summary, { kind: "body", execution: { instance: callee.instance, provided } });
    const edges = index.dependencyInventory.dependencies.filter(edge => edge.dependent.instance.body === caller.instance.body);
    assert.deepEqual(edges.filter(edge => edge.reason === "call").map(edge => edge.target), [selected.summary]);
    assert.equal(edges.some(edge => edge.reason === "initializer"), false);
    const slots = facts.arena.contexts[selected.context].arguments;
    assert.equal(slots.length, 3);
    assert.equal(mir.arguments.length, 3);
    assert.equal(selected.arguments.length, 3);
    for (const [position, formal] of formals.entries()) {
      const transported = selected.arguments[position];
      assert.equal(transported.parameter, formal.declaration);
      if (position >= provided) {
        assert.deepEqual(mir.arguments[position], { kind: "omitted" });
        assert.equal(transported.kind, "omitted");
        assert.equal(Object.hasOwn(transported, "actual"), false);
        assert.deepEqual(slots[position], { kind: "omitted" });
      } else {
        assert.equal(authored[position].tsonic.convertedType, formal.type);
        const evaluated = evaluations[position];
        assert.equal(evaluated.kind, "assign");
        assert.equal(evaluated.value.kind, "convert");
        assert.equal(evaluated.value.operand.kind, "constant");
        assert.deepEqual(caller.mir.constants[evaluated.value.operand.constant].value, { kind: "literal", value: values[position] });
        assert.deepEqual(mir.arguments[position], { kind: "value", passing: "by-value", operand: { kind: "place", place: evaluated.place } });
        assert.equal(transported.kind, "provided");
        assert.equal(transported.authoredIndex, position);
        assert.deepEqual(slots[position], { kind: "provided", origins: transported.actual });
        assert.equal(facts.arena.origins[transported.actual].includesAbsence, position === 1);
      }
    }
    const returned = facts.origins.subjects.find(row => row.role === "return");
    assert.equal(returned.origins, selected.result);
    assert.deepEqual(facts.arena.origins[returned.origins].producers, []);
    assert.equal(facts.arena.origins[returned.origins].includesAbsence, provided !== 3);
  }
});
