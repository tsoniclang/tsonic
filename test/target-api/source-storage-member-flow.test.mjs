import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageMemberFlow } from "../../packages/target-api/dist/target-analysis/source-storage/graph/member-flow.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

const subject = type => ({ node: { type }, kind: "value", projection: [] });
const member = (declarations, optional = false) => ({
  property: { symbol: {}, rootSymbols: [], name: "checked-member", type: {}, optional, readonly: false },
  declarations, getters: [], setters: [], read: "property",
});
const present = (destination, originals) => ({ kind: "present",
  destination: member(destination), source: member(originals) });

function fixture(relation, limits = {}, context = () => true, selectMember) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const file = {};
  const calls = [];
  const retained = [];
  const relationships = new Map();
  const checkedRelation = (file, from, to) => {
    const sources = relationships.get(file) ?? new Map();
    const destinations = sources.get(from) ?? new Map();
    if (destinations.has(to)) return destinations.get(to);
    calls.push({ file, from, to });
    const raw = relation(file, from, to);
    const selected = new Map();
    if (raw.kind === "available") for (const member of raw.members) {
      const checked = member.kind === "absent" ? member : { ...member,
        source: { ...member.source, declarations: Object.freeze([...member.source.declarations]) } };
      for (const declaration of member.destination.declarations)
        selected.set(declaration, selected.has(declaration) ? undefined : checked);
    }
    const value = { correspondence: raw.kind !== "available" ? raw : { ...raw, members: Object.freeze([...raw.members]),
      source: { type: from, calls: [], constructs: [], indexes: [] },
      destination: { type: to, calls: [], constructs: [], indexes: [] } }, selected };
    destinations.set(to, value);
    sources.set(from, destinations);
    relationships.set(file, sources);
    return value;
  };
  const source = {
    ast: { name: () => undefined, getSourceFile: () => undefined, kindName: () => "test-node",
      is: { IsObjectLiteralExpression: node => node.kind === "object", IsArrayLiteralExpression: () => false,
        IsIdentifier: node => node.kind === "identifier" } },
    semantics: { includes: () => true, forFile: file => ({
      declarations: { declaredValueType: node => node.type },
      types: { expressionType: node => node.expressionType, contextualType: node => node.contextualType, isUnion: () => false,
        structuralMember(from, to, declaration) {
          return selectMember === undefined ? checkedRelation(file, from, to).selected.get(declaration)
            : selectMember(file, from, to, declaration);
        }, structuralMembers: (from, to) => checkedRelation(file, from, to).correspondence },
    }) },
  };
  const flow = createSourceStorageMemberFlow(source, budget, (node, kind = "value", projection = []) => ({ node, kind, projection }),
    owner => owner.file ?? file,
    (node, file) => { retained.push({ node, file }); return context(node, file); });
  return { flow, budget, file, calls, retained };
}

test("checked value occurrences index their selected expression type instead of the broader binding type", () => {
  const declared = {};
  const expression = {};
  const destination = {};
  const target = {};
  const original = {};
  const input = fixture((_file, from) => from === expression
    ? { kind: "available", members: [present([target], [original])] }
    : { kind: "unavailable", reason: "missing-required-member" });
  assert.equal(Object.hasOwn(input.flow, "isCopiedFor"), false,
    "the superseded Boolean slot API is absent rather than retained as a shim");
  const owner = { ...subject(declared), node: { kind: "identifier", type: declared, expressionType: expression } };
  const selected = input.flow.declarationsFor(owner, target, destination);
  assert.equal(selected?.length === 1 && selected[0] === original, true);
  assert.equal(input.calls.length === 1 && input.calls[0].from === expression, true,
    "one exact checked read view owns both the relationship and its cache identity");
  assert.equal(input.budget.failure() === undefined, true);
});

test("an unavailable checked read type cannot fall back to an unrelated declared binding carrier", () => {
  const target = {};
  const original = {};
  const input = fixture(() => ({ kind: "available", members: [present([target], [original])] }));
  const owner = { ...subject({}), node: { kind: "identifier", type: {} } };
  assert.equal(input.flow.declarationsFor(owner, target, {}) === undefined, true,
    "a declaration alone is not evidence for an unresolved checked read view");
  assert.equal(input.calls.length, 0);
  assert.equal(input.budget.failure() === undefined, true);
});

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
    present([first], [original, original, another, original]),
    present([second], [original, original]),
    { kind: "absent", destination: member([absent], true) },
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
  for (const limits of [{ maximumTransportRows: 1 }, { maximumTransportRows: 4 }, { maximumTransportRows: 7 }, { maximumSteps: 1 }]) {
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
  const absent = { kind: "absent", destination: member([optional], true) };
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

test("selected contextual slots do not depend on unrelated whole-shape availability or aggregate query order", () => {
  for (const available of [false, true]) for (const aggregateFirst of [false, true]) {
    const from = {}; const contextual = {}; const destination = {};
    const declaration = {}; const original = {};
    const absent = { kind: "absent", destination: member([declaration], true) };
    const contract = { kind: "present", destination: absent.destination,
      source: { ...member([original], true), property: { ...member([original], true).property, readonly: true } } };
    const input = fixture((_file, selected) => selected === from && available
      ? { kind: "available", members: [absent] }
      : { kind: "unavailable", reason: "missing-required-member" }, {}, () => true,
    (_file, selected, target, requested) => target !== destination || requested !== declaration ? undefined
      : selected === from ? absent : selected === contextual ? contract : undefined);
    const owner = { kind: "value", projection: [], node: { kind: "object", expressionType: from, contextualType: contextual } };
    const aggregate = () => input.flow.membersFor(owner, destination);
    if (aggregateFirst) assert.equal(aggregate() !== undefined, available, "whole-shape refusal remains independent");
    const selected = input.flow.memberFor(owner, declaration, destination);
    assert.equal(selected?.kind === "present" && selected.source.property.optional && selected.source.property.readonly, true,
      "the exact contextual optional readonly slot is physical even when unrelated whole fields are unavailable");
    const originals = input.flow.declarationsFor(owner, declaration, destination);
    assert.equal(originals?.length === 1 && originals[0] === original, true, "one actual checked contextual declaration");
    if (!aggregateFirst) assert.equal(aggregate() !== undefined, available, "selected evidence never certifies the whole shape");
    assert.equal(input.flow.declarationsFor(owner, declaration, destination) === originals, true,
      "aggregate availability and call order cannot replace the selected physical declaration sequence");
    const repeated = input.flow.memberFor(owner, declaration, destination);
    assert.equal(repeated?.kind === "present" && repeated.source.property.readonly, true,
      "readonly contextual evidence never depends on an unrelated aggregate field");
    assert.equal(input.budget.failure() === undefined, true, "both questions retain bounded independent evidence");
  }
});

test("optional-only member inventories reserve every retained relationship before copying or publishing their index", () => {
  const input = fixture(() => ({ kind: "available", members: Array.from({ length: 20 }, () =>
    ({ kind: "absent", destination: member([{}], true) })) }), { maximumTransportRows: 8 });
  const owner = subject({}); const destination = {};
  assert.equal(input.flow.membersFor(owner, destination) === undefined, true);
  assert.equal(input.budget.failure() === "Source storage rows require a live owner and a finite positive reservation.", true,
    "the complete copied row family is individually larger than the selected finite ceiling");
  assert.equal(input.flow.membersFor(owner, destination) === undefined && input.calls.length === 1, true,
    "neither an empty declaration index nor a cache hit can bypass an oversized exact relationship family");
});

test("throwing member construction releases its unpublished rows before a complete bounded retry", () => {
  const declaration = {}; const original = {};
  let fail = true;
  const sourceMember = { ...member([]), get declarations() {
    if (fail) { fail = false; throw new Error("incomplete member evidence"); }
    return [original];
  } };
  const input = fixture(() => ({ kind: "available", members: [{ kind: "present",
    destination: member([declaration]), source: sourceMember }] }), { maximumTransportRows: 8 });
  const owner = subject({}); const destination = {};
  assert.throws(() => input.flow.declarationsFor(owner, declaration, destination), /incomplete member evidence/);
  assert.equal(input.budget.failure() === undefined, true, "an exception is not a fabricated budget failure");
  const selected = input.flow.declarationsFor(owner, declaration, destination);
  assert.equal(selected?.length === 1 && selected[0] === original, true, "no failed index or reservation survives");
  assert.equal(input.flow.declarationsFor(owner, declaration, destination) === selected, true);
  assert.equal(input.calls.length === 2 && input.budget.failure() === undefined, true);
});
