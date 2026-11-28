import assert from "node:assert/strict";
import { parseModuleBodies, printModuleBodies } from "../../../packages/host/dist/ir-program/index.js";
import { analyzeOptionalSource } from "./optional-default.mjs";

function originValue(arena, origins) {
  const value = arena.origins[origins];
  assert.equal(value.kind, "complete");
  return { absence: value.includesAbsence, actors: value.producers.map(identity => {
    const producer = arena.producers[arena.boundProducers[identity].producer];
    return { kind: producer.kind, index: producer.index, path: producer.path };
  }) };
}

export async function checkOptionalReferenceDefault() {
  const program = await analyzeOptionalSource(
    "export function select(fallback: string, value: string | undefined = fallback): string | undefined { return value; }\n"
    + "export function omit(fallback: string, supplied: string): string | undefined { return select(fallback); }\n"
    + "export function present(fallback: string, supplied: string): string | undefined { return select(fallback, supplied); }\n"
    + "export function absent(fallback: string, supplied: string): string | undefined { return select(fallback, undefined); }",
  {}, ["omit", "present", "absent"]);
  assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
  const { index, modules } = program.value;
  const active = modules.flatMap(module => module.bodies).filter(body => body.kind === "selected");
  const callee = active.find(body => body.tir.params[1]?.initializer.kind === "ready-default");
  assert.ok(callee);
  const module = modules.find(module => module.bodies.includes(callee));
  const [fallback, optional] = index.types.signatures[callee.tir.signature].parameters;
  assert.deepEqual(index.types.terms[fallback.type], { kind: "string" });
  assert.deepEqual(index.types.terms[optional.type], { kind: "optional", value: fallback.type });
  assert.equal(optional.kind, "default");
  assert.equal(optional.passing, "by-value");
  assert.equal(optional.acceptsOmission, true);
  const initializer = active.find(body => body.instance.body === optional.initializer);
  assert.equal(initializer?.tir.root.kind, "Identifier");
  assert.equal(initializer.tir.root.text, "fallback");
  assert.deepEqual(initializer.tir.captures, [{ local: callee.tir.params[0].tsonic.local, capture: "captured-location" }]);
  assert.equal(initializer.tir.root.tsonic.type, fallback.type);
  assert.equal(initializer.tir.root.tsonic.convertedType, optional.type);
  const converted = initializer.tir.root.tsonic.conversion;
  assert.equal(converted.role, "initialization");
  assert.equal(converted.operation.decision.operation.embedding.conversion, "union-injection");
  const capture = { absence: false, actors: [{ kind: "capture", index: 0, path: null }] };
  const initializerFacts = initializer.facts[0];
  assert.deepEqual(originValue(initializerFacts.arena, initializerFacts.origins.subjects.find(row => row.role === "return").origins), capture);

  assert.deepEqual(callee.mir.entries.map(entry => entry.provided), [2, 1]);
  const entry = callee.mir.blocks[callee.mir.entries[1].block].terminator;
  assert.equal(entry.kind, "call");
  assert.equal(entry.callee.kind, "body");
  assert.deepEqual(entry.callee.instance, initializer.instance);
  const capturePlace = callee.mir.places[entry.callee.captures[0].place];
  assert.equal(capturePlace.base.kind, "local");
  assert.deepEqual(callee.mir.locals[capturePlace.base.local].role, { kind: "parameter", index: 0 });

  const fallbackValue = { absence: false, actors: [{ kind: "parameter", index: 0, path: null }] };
  const suppliedValue = { absence: false, actors: [{ kind: "parameter", index: 1, path: null }] };
  const absent = { absence: true, actors: [] };
  const callers = active.filter(body => body !== callee && body.tir.root.kind === "Block");
  assert.equal(callers.length, 3);
  assert.ok(index.dependencyInventory);
  const exits = [];
  for (const caller of callers) {
    const call = caller.tir.root.statements.nodes[0].expression;
    const [first, second] = call.arguments.nodes;
    assert.equal(first.text, "fallback");
    const provided = second === undefined ? 1 : 2;
    const mode = provided === 1 ? "omitted" : second.text;
    exits.push(mode);
    const expected = mode === "omitted" ? fallbackValue : mode === "undefined" ? absent : suppliedValue;
    if (second !== undefined) {
      const introduced = second.tsonic.conversion.operation.decision.operation;
      assert.equal(introduced.to, optional.type);
      assert.equal(introduced.embedding.conversion, mode === "undefined" ? "absence" : "union-injection");
    }
    const operation = caller.mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.tir.node === call.id).terminator;
    assert.deepEqual(operation.arguments.map(argument => argument.kind), provided === 1 ? ["value", "omitted"] : ["value", "value"]);
    const facts = caller.facts[0];
    const [alternative] = facts.origins.invocations.find(row => row.node === call.id).alternatives;
    assert.deepEqual(alternative.summary, { kind: "body", execution: { instance: callee.instance, provided } });
    const edges = index.dependencyInventory.dependencies.filter(edge => edge.dependent.instance.body === caller.instance.body);
    assert.deepEqual(edges.filter(edge => edge.reason === "call").map(edge => edge.target), [alternative.summary]);
    assert.deepEqual(edges.filter(edge => edge.reason === "initializer").map(edge => edge.target),
      provided === 1 ? [{ kind: "body", execution: { instance: initializer.instance, provided: 0 } }] : []);
    const [prefix, value] = facts.arena.contexts[alternative.context].arguments;
    assert.equal(prefix.kind, "provided");
    assert.deepEqual(originValue(facts.arena, prefix.origins), fallbackValue);
    const suffix = alternative.arguments[1];
    assert.equal(suffix.parameter, optional.declaration);
    if (provided === 1) {
      assert.deepEqual(value, { kind: "omitted" });
      assert.equal(suffix.kind, "omitted");
      assert.equal(Object.hasOwn(suffix, "actual"), false);
    } else {
      assert.equal(suffix.kind, "provided");
      assert.deepEqual(value, { kind: "provided", origins: suffix.actual });
      assert.deepEqual(originValue(facts.arena, value.origins), expected);
    }
    assert.deepEqual(originValue(facts.arena, alternative.result), expected);
    const returned = facts.origins.subjects.find(row => row.role === "return");
    assert.equal(returned.origins, alternative.result);
    const summary = index.summaries.find(summary => summary.key.kind === "body"
      && summary.key.execution.instance.body === caller.instance.body && summary.key.execution.provided === 2);
    assert.deepEqual(originValue(summary.arena, summary.result), expected);
    assert.deepEqual(summary.retention.map(row => [row.source, row.into]), summary.arena.origins[summary.result].producers
      .map(actor => [actor, { kind: "return" }]));
  }
  assert.deepEqual(exits.sort(), ["omitted", "supplied", "undefined"]);
  const printed = printModuleBodies(index, module);
  const decoded = parseModuleBodies(index, printed);
  assert.equal(decoded.kind, "parsed");
  assert.equal(printModuleBodies(index, decoded.value), printed);
}
