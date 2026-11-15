import assert from "node:assert/strict";
import { test } from "node:test";
import { publicationFixture } from "./fixtures/program-publication.mjs";
import { moduleFixture, encodeContextKey } from "./ir-program-fixtures.mjs";
import { verifyFacts, printFacts, parseFacts } from "../../packages/host/dist/ir-facts/index.js";
import { canonicalizeProgram } from "../../packages/host/dist/ir-program/index.js";
import { createAccount, accountFailure, refuseAccount } from "../../packages/host/dist/dataflow/index.js";
import { InvocationAccount } from "../../packages/host/dist/dataflow/account.js";

const account = (maximumWork = 100000, maximumResultEntries = 100000) => createAccount({ maximumWork, maximumResultEntries });

function fixture() {
  const caller = publicationFixture();
  const callee = publicationFixture(moduleFixture("initializer.ts"));
  for (const [key, value] of callee.answers) caller.answers.set(key, value);
  const facts = caller.selected.facts[0];
  facts.arena.contexts.push({ id: 0, receiver: null, arguments: [], captures: [] });
  facts.origins.activations.push({ node: 0, point: { block: 0, statement: null }, activation: callee.instance, context: 0, caller: 0, entry: null });
  caller.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: caller.instance }]), [caller.scope, callee.scope]);
  const block = caller.selected.mir.blocks[0];
  block.terminator = { kind: "call", origin: block.origin, tir: block.tir,
    callee: { kind: "body", instance: callee.instance, captures: [] }, receiver: null, arguments: [],
    destination: null, next: 1, unwind: { kind: "escape" }, step: null };
  caller.selected.mir.blocks.push({ ...block, id: 1, statements: [],
    terminator: { kind: "return", value: null, origin: block.origin, tir: block.tir } });
  return { ...caller, facts, callee };
}

const checked = (input, meter = account()) => verifyFacts(input.facts, input.selected.mir, input.context.facts, meter);

function surfaceFixture(kind = "direct") {
  const input = fixture();
  const instance = input.callee.template.instance;
  const endpoint = role => ({ declaration: input.callee.definition, role, signature: 0, body: input.callee.bodyId });
  const bindings = input.callee.selected.tir.lexicalBindings;
  const resolution = { activation: instance, decision: {
    candidate: 0, advertised: endpoint("advertised"), api: endpoint("api-body"), bindings, implementationBindings: bindings,
    parameters: [], completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null,
  } };
  input.selected.mir.blocks[0].terminator.callee = kind === "direct" ? { kind, resolution }
    : { kind, resolution, operand: { kind: "constant", constant: 0 } };
  input.facts.origins.activations[0].activation = instance;
  input.facts.arena.origins.push({ id: 0, producers: [], includesAbsence: false, kind: "complete" });
  const summary = { kind: "body", execution: { instance, provided: 0 } };
  input.facts.origins.invocations.push({ node: 0, point: { block: 0, statement: null }, kind: "call", boundaries: [],
    alternatives: [{ resolution, context: 0, arguments: [], result: 0, thrown: 0, summary }] });
  input.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: input.instance }]), [input.scope, input.callee.scope, input.callee.scope]);
  return input;
}

test("direct body binding retains the actual MIR point without a fabricated surface invocation", () => {
  const input = fixture();
  assert.equal(input.facts.origins.invocations.length, 0);
  assert.deepEqual(checked(input), { kind: "complete", violations: [] });
  const text = printFacts(input.facts);
  assert.deepEqual(parseFacts(text), { kind: "parsed", value: input.facts });
  const omittedPoint = text.replace("point=MirPoint(block=b:0, statement=null), ", "");
  assert.equal(omittedPoint !== text, true);
  assert.equal(parseFacts(omittedPoint).kind, "invalid-text");
  const rewritten = canonicalizeProgram({ index: input.index, modules: [input.module] }, {
    table: input.index.types, types: [0], signatures: [0],
  });
  const selected = rewritten.modules[0].bodies.find(body => body.kind === "selected");
  assert.deepEqual(selected.facts[0].origins.activations[0].point, { block: 0, statement: null });
});

test("direct bindings distinguish two real call occurrences sharing the same source node", () => {
  const input = fixture();
  const block = input.selected.mir.blocks[1];
  block.terminator = { ...input.selected.mir.blocks[0].terminator, next: 2 };
  input.selected.mir.blocks.push({ ...block, id: 2, terminator: { kind: "return", value: null, origin: block.origin, tir: block.tir } });
  input.facts.origins.activations.push({ ...input.facts.origins.activations[0], point: { block: 1, statement: null } });
  input.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: input.instance }]), [input.scope, input.callee.scope, input.callee.scope]);
  assert.deepEqual(checked(input), { kind: "complete", violations: [] });
  input.facts.origins.activations.reverse();
  const result = checked(input);
  assert.equal(result.kind, "complete");
  assert.equal(result.violations.some(row => row.rule === "activations-order"), true);
});

test("surface direct and indirect bindings require the same point and actual alternative context", () => {
  for (const kind of ["direct", "indirect"]) {
    const input = surfaceFixture(kind);
    assert.deepEqual(checked(input), { kind: "complete", violations: [] }, kind);
    input.facts.arena.contexts.push({ id: 1, receiver: null, arguments: [], captures: [] });
    input.facts.origins.activations[0].context = 1;
    const result = checked(input);
    assert.equal(result.kind, "complete");
    assert.equal(result.violations.some(row => row.rule === "cross-owner-qualified"), true, kind);
  }
});

test("two surface calls sharing a node retain distinct point-context pairs and reject their exchange", () => {
  const input = surfaceFixture();
  input.facts.arena.contexts.push({ id: 1, receiver: null, arguments: [], captures: [] });
  const block = input.selected.mir.blocks[1];
  block.terminator = { ...input.selected.mir.blocks[0].terminator, next: 2 };
  input.selected.mir.blocks.push({ ...block, id: 2, terminator: { kind: "return", value: null, origin: block.origin, tir: block.tir } });
  const second = structuredClone(input.facts.origins.invocations[0]);
  second.point.block = 1;
  second.alternatives[0].context = 1;
  input.facts.origins.invocations.push(second);
  input.facts.origins.activations.push({ ...input.facts.origins.activations[0], point: { block: 1, statement: null }, context: 1 });
  input.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: input.instance }]),
    [input.scope, input.callee.scope, input.callee.scope, input.callee.scope, input.callee.scope]);
  assert.deepEqual(checked(input), { kind: "complete", violations: [] });
  input.facts.origins.activations[0].context = 1;
  input.facts.origins.activations[1].context = 0;
  const result = checked(input);
  assert.equal(result.kind, "complete");
  assert.equal(result.violations.filter(row => row.rule === "cross-owner-qualified").length, 2);
});

test("surface invocation points survive current codecs and cannot be omitted or point to a return", () => {
  const input = surfaceFixture();
  const text = printFacts(input.facts);
  assert.deepEqual(parseFacts(text), { kind: "parsed", value: input.facts });
  const omitted = text.replace("point=MirPoint(block=b:0, statement=null), ", "");
  assert.equal(omitted !== text, true);
  assert.equal(parseFacts(omitted).kind, "invalid-text");
  input.facts.origins.invocations[0].point.block = 1;
  const result = checked(input);
  assert.equal(result.kind, "complete");
  assert.equal(result.violations.some(row => row.rule === "cross-owner-qualified"), true);
});

test("surface alternative index admits both actual dimensions and retains every first refusal", () => {
  const input = surfaceFixture();
  const measured = account();
  assert.deepEqual(checked(input, measured), { kind: "complete", violations: [] });
  const { work, entries } = InvocationAccount.stateOf(measured);
  const unread = new Proxy({}, { get() { assert.fail("No read after surface-index refusal."); } });
  for (const dimension of ["work", "result-entries"]) {
    const required = dimension === "work" ? work : entries;
    for (let maximum = 0; maximum <= required; maximum += 1) {
      const current = account(dimension === "work" ? maximum : work, dimension === "result-entries" ? maximum : entries);
      const result = checked(input, current);
      if (maximum === required) assert.deepEqual(result, { kind: "complete", violations: [] });
      else {
        assert.equal(result.kind, "resource-limit", dimension);
        assert.equal(result.dimension, dimension);
        assert.equal(result, accountFailure(current));
        assert.equal(verifyFacts(unread, unread, unread, current), result);
      }
    }
  }
});

test("direct binding rejects a wrong point, operation, source, instance or context", () => {
  for (const change of ["missing-block", "statement", "return", "source-node", "source-body", "instance", "bindings", "context", "caller", "no-selected-body"]) {
    const input = fixture();
    const binding = input.facts.origins.activations[0];
    const call = input.selected.mir.blocks[0].terminator;
    if (change === "missing-block") binding.point.block = 99;
    if (change === "statement") binding.point.statement = 0;
    if (change === "return") binding.point.block = 1;
    if (change === "source-node") call.tir = { ...call.tir, node: 1 };
    if (change === "source-body") call.tir = { ...call.tir, body: input.callee.bodyId };
    if (change === "instance") call.callee.instance = input.instance;
    if (change === "bindings") call.callee.instance = input.callee.template.instance;
    if (change === "context") binding.context = 99;
    if (change === "caller") binding.caller = 99;
    if (change === "no-selected-body") {
      const endpoint = role => ({ declaration: input.callee.definition, role, signature: 0, body: null });
      const bindings = input.callee.selected.tir.lexicalBindings;
      call.callee = { kind: "direct", resolution: { activation: null, decision: {
        candidate: 0, advertised: endpoint("advertised"), api: endpoint("api-signature"), bindings, implementationBindings: bindings,
        parameters: [], completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null,
      } } };
    }
    const result = checked(input);
    assert.equal(result.kind, "complete", change);
    assert.equal(result.violations.length > 0, true, change);
  }
});

test("direct binding verification retains both exact shared bounds and the original first stop", () => {
  const input = fixture();
  const measured = account();
  assert.deepEqual(checked(input, measured), { kind: "complete", violations: [] });
  const { work, entries } = InvocationAccount.stateOf(measured);
  const unread = new Proxy({}, { get() { assert.fail("No source or ready relation is read after the original refusal."); } });
  for (const dimension of ["work", "result-entries"]) {
    const required = dimension === "work" ? work : entries;
    for (const maximum of [0, required - 1, required]) {
      const current = account(dimension === "work" ? maximum : work, dimension === "result-entries" ? maximum : entries);
      const result = checked(input, current);
      if (maximum === required) assert.deepEqual(result, { kind: "complete", violations: [] });
      else {
        assert.equal(result.kind, "resource-limit");
        assert.equal(result.dimension, dimension);
        assert.equal(result, accountFailure(current));
        assert.equal(verifyFacts(unread, unread, unread, current), result);
      }
    }
  }
  const stopped = account();
  const original = { kind: "refused", diagnostics: [] };
  refuseAccount(stopped, original);
  assert.equal(verifyFacts(unread, unread, unread, stopped), original);
});
