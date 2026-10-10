import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageMemberFlow } from "../../packages/target-api/dist/target-analysis/source-storage/member-flow.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

const subject = type => ({ node: { type }, kind: "value", projection: [] });
const present = (destination, originals) => ({ kind: "present",
  destination: { declarations: destination }, source: { declarations: originals } });

function fixture(relation, limits = {}, context = () => true) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const file = {};
  const calls = [];
  const retained = [];
  const source = {
    ast: { name: () => undefined, getSourceFile: () => undefined,
      is: { IsObjectLiteralExpression: () => false, IsArrayLiteralExpression: () => false } },
    semantics: { includes: () => true, forFile: file => ({
      declarations: { declaredValueType: node => node.type },
      types: { expressionType: () => undefined, structuralMembers: (from, to) => {
        calls.push({ file, from, to });
        return relation(file, from, to);
      } },
    }) },
  };
  const flow = createSourceStorageMemberFlow(source, budget, owner => owner.file ?? file,
    (node, file) => { retained.push({ node, file }); return context(node, file); });
  return { flow, budget, file, calls, retained };
}

test("immutable checked member relationships are indexed once across aliases and exact selected declarations", () => {
  const targets = Array.from({ length: 64 }, () => ({}));
  const originals = targets.map(() => ({}));
  const relation = { kind: "available", members: targets.map((target, index) => present([target], [originals[index]])) };
  const input = fixture(() => relation, { maximumSteps: 1024 });
  const type = {};
  const destination = {};
  for (const [index, target] of targets.entries()) {
    const selected = input.flow.declarationsFor(subject(type), target, destination);
    assert.equal(selected?.length === 1 && selected[0] === originals[index], true, "exact selected declaration identity");
    assert.equal(Object.isFrozen(selected), true);
  }
  const original = input.flow.declarationsFor(subject(type), targets[0], destination);
  for (let replay = 0; replay < 100; replay += 1) {
    assert.equal(input.flow.declarationsFor(subject(type), targets[0], destination) === original, true,
      "alias subjects consume one completed immutable relation");
  }
  assert.equal(input.calls.length, 1);
  assert.equal(input.retained.length, 165, "only selected members receive checked context");
  assert.equal(input.budget.failure() === undefined, true, "linear indexing fits the unchanged finite work selection");
});

test("member indexes preserve exact order, optional absence, duplicates and declaration identity", () => {
  const first = {};
  const second = {};
  const original = {};
  const another = {};
  const absent = {};
  const input = fixture(() => ({ kind: "available", members: [
    present([first, second], [original, original]),
    { kind: "absent", destination: { declarations: [absent] } },
    present([first], [another, original]),
  ] }));
  const owner = subject({});
  const target = {};
  const selected = input.flow.declarationsFor(owner, first, target);
  assert.equal(selected?.length === 2 && selected[0] === original && selected[1] === another, true);
  const alternate = input.flow.declarationsFor(owner, second, target);
  assert.equal(alternate?.length === 1 && alternate[0] === original, true);
  for (const declaration of [absent, { ...first }]) {
    assert.equal(input.flow.declarationsFor(owner, declaration, target) === undefined, true,
      "absent and equal-looking unrelated declarations cannot invent correspondence");
  }
  assert.equal(input.calls.length, 1);
  assert.equal(input.retained.some(value => value.node === absent), false);
});

test("member indexes keep checked files, source types and selected destination types independent", () => {
  const declaration = {};
  const input = fixture((file, from, to) => ({ kind: "available", members: [present([declaration], [file, from, to])] }));
  const from = {};
  const otherFrom = {};
  const to = {};
  const otherTo = {};
  const otherFile = {};
  for (const [file, type, destination] of [[input.file, from, to], [input.file, otherFrom, to],
    [input.file, from, otherTo], [otherFile, from, to]]) {
    const selected = input.flow.declarationsFor({ ...subject(type), file }, declaration, destination);
    assert.equal(selected?.length === 3 && selected[0] === file && selected[1] === type && selected[2] === destination, true);
  }
  assert.equal(input.calls.length, 4);
  assert.equal(input.budget.failure() === undefined, true);
});

test("unavailable relationships cache exactly without caching an unresolved subject type", () => {
  const input = fixture(() => ({ kind: "unavailable", reason: "missing-required-member" }));
  const owner = subject(undefined);
  const declaration = {};
  const destination = {};
  input.flow.declarationsFor(owner, declaration, destination);
  assert.equal(input.calls.length, 0, "no selected source type yet");
  owner.node.type = {};
  for (let replay = 0; replay < 20; replay += 1) {
    assert.equal(input.flow.declarationsFor(owner, declaration, destination) === undefined, true);
  }
  assert.equal(input.calls.length, 1);
  assert.equal(input.retained.length, 0);
});

test("member indexing preserves independent finite row and work limits on cold and cached queries", () => {
  const declaration = {};
  const original = {};
  const relation = () => ({ kind: "available", members: [present([declaration], [original])] });
  for (const limits of [{ maximumTransportRows: 1 }, { maximumTransportRows: 4 }, { maximumSteps: 1 }]) {
    const input = fixture(relation, limits);
    const owner = subject({});
    const destination = {};
    assert.equal(input.flow.declarationsFor(owner, declaration, destination) === undefined, true);
    assert.equal(input.budget.failure() !== undefined, true);
    assert.equal(input.flow.declarationsFor(owner, declaration, destination) === undefined, true,
      "a failed partial relationship cannot publish evidence or clear exhaustion");
  }
  const input = fixture(relation, { maximumSteps: 6 });
  const owner = subject({});
  const destination = {};
  assert.equal(input.flow.declarationsFor(owner, declaration, destination)?.[0] === original, true);
  assert.equal(input.flow.declarationsFor(owner, declaration, destination) === undefined, true,
    "cache hits and selected context still consume finite work");
  assert.equal(input.budget.failure() !== undefined, true);
});

test("cached member correspondence cannot bypass selected checked-context rejection", () => {
  const declaration = {};
  const original = {};
  let permitted = true;
  const input = fixture(() => ({ kind: "available", members: [present([declaration], [original])] }), {}, () => permitted);
  const owner = subject({});
  const destination = {};
  assert.equal(input.flow.declarationsFor(owner, declaration, destination)?.[0] === original, true);
  permitted = false;
  assert.equal(input.flow.declarationsFor(owner, declaration, destination) === undefined, true);
  assert.equal(input.calls.length, 1);
  assert.equal(input.retained.length, 2);
});

test("direct member selection and recursive domain traversal consume one immutable indexed checked relationship", () => {
  const target = {}; const optional = {}; const original = {};
  const matched = present([target], [original]);
  const absent = { kind: "absent", destination: { declarations: [optional] } };
  const members = [matched, absent];
  const input = fixture(() => ({ kind: "available", members }));
  const owner = subject({});
  const destination = {};
  const selected = input.flow.membersFor(owner, destination);
  assert.equal(Object.isFrozen(selected) && selected.length === 2 && selected[0] === matched && selected[1] === absent, true,
    "optional absence and exact checked source/destination member rows remain intact");
  members.length = 0;
  const declarations = input.flow.declarationsFor(owner, target, destination);
  assert.equal(declarations.length === 1 && declarations[0] === original, true);
  assert.equal(input.flow.membersFor(owner, destination) === selected && selected.length === 2 && input.calls.length === 1, true,
    "the owning completed index isolates its sequence and serves both consumers without duplicate correspondence reads");
  assert.equal(input.budget.failure() === undefined, true);
});

test("optional-only member inventories reserve every retained relationship before copying or publishing their index", () => {
  const input = fixture(() => ({ kind: "available", members: Array.from({ length: 20 }, () =>
    ({ kind: "absent", destination: { declarations: [{}] } })) }), { maximumTransportRows: 8 });
  const owner = subject({}); const destination = {};
  assert.equal(input.flow.membersFor(owner, destination) === undefined, true);
  assert.equal(input.budget.failure() === "Source storage rows require a live owner and a finite positive reservation.", true,
    "the complete copied row family is individually larger than the selected finite ceiling");
  assert.equal(input.flow.membersFor(owner, destination) === undefined && input.calls.length === 1, true,
    "neither an empty declaration index nor a cache hit can bypass an oversized exact relationship family");
});
