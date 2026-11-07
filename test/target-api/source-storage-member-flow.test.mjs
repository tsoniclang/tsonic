import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageMemberFlow } from "../../packages/target-api/dist/target-analysis/source-storage/graph/member-flow.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

// Member flow reads the Host: a subject's type is facts.values.type(node) (a descriptor), and member correspondence is
// the name join of facts.objects.members over the source and destination descriptors (components.ts). The fixture
// fakes exactly those two Host facts; a type is an opaque declared descriptor token.
const type = () => Object.freeze({ kind: "declared", declaration: {}, typeArguments: Object.freeze([]) });
const subject = selected => ({ node: { type: selected }, kind: "value", projection: [] });
// One Host member row: its name, declarations and optionality.
const row = (name, declarations, optional = false, readonly = false) => ({ name, declarations, optional, readonly });

function fixture(membersOf, limits = {}, context = () => true) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const file = {};
  const files = [file];
  const calls = [];
  const retained = [];
  const memo = new Map();
  const refused = Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", site: {}, reason: "fixture" });
  const is = new Proxy({
    IsObjectLiteralExpression: node => node.kind === "object", IsIdentifier: node => node.kind === "identifier",
  }, { get: (target, property) => property in target ? target[property] : () => false });
  const source = {
    sourceFiles: files,
    ast: { name: () => undefined, getSourceFile: () => undefined, kindName: () => "test-node", hasModifierKind: () => false, is },
    facts: {
      values: { type: node => {
        const selected = node.kind === "identifier" ? node.expressionType : node.expressionType ?? node.type;
        return selected === undefined ? refused : Object.freeze({ kind: "resolved", type: selected });
      } },
      // facts.objects memoizes members per descriptor (one immutable member list per type).
      objects: { members: selected => {
        if (memo.has(selected)) return memo.get(selected);
        const rows = membersOf(selected);
        const value = rows === undefined ? refused : Object.freeze(rows.map(entry => Object.freeze({ ...entry })));
        calls.push(selected);
        memo.set(selected, value);
        return value;
      } },
      analyses: { propertyName: () => undefined },
    },
  };
  const flow = createSourceStorageMemberFlow(source, budget, (node, kind = "value", projection = []) => ({ node, kind, projection }),
    owner => owner.file ?? file,
    (node, file) => { retained.push({ node, file }); return context(node, file); });
  return { flow, budget, file, files, calls, retained };
}

test("checked value occurrences index their selected expression type instead of the broader binding type", () => {
  const declared = type();
  const expression = type();
  const destination = type();
  const target = {};
  const original = {};
  const input = fixture(selected => selected === expression ? [row("value", [original])]
    : selected === destination ? [row("value", [target])] : []);
  assert.equal(Object.hasOwn(input.flow, "isCopiedFor"), false,
    "the superseded Boolean slot API is absent rather than retained as a shim");
  const owner = { ...subject(declared), node: { kind: "identifier", type: declared, expressionType: expression } };
  const selected = input.flow.declarationsFor(owner, target, destination);
  assert.equal(selected?.length === 1 && selected[0] === original, true);
  assert.equal(input.calls.includes(expression) && !input.calls.includes(declared), true,
    "the occurrence's Host type owns both the relationship and its cache identity");
  assert.equal(input.budget.failure() === undefined, true);
});

test("an unavailable checked read type cannot fall back to an unrelated declared binding carrier", () => {
  const target = {};
  const original = {};
  const input = fixture(() => [row("value", [original])]);
  const owner = { ...subject(type()), node: { kind: "identifier", type: type() } };
  assert.equal(input.flow.declarationsFor(owner, target, type()) === undefined, true,
    "a declaration alone is not evidence for a refused Host read type");
  assert.equal(input.calls.length, 0);
  assert.equal(input.budget.failure() === undefined, true);
});

test("immutable checked member relationships are indexed once across aliases and exact selected declarations", () => {
  const targets = Array.from({ length: 64 }, () => ({}));
  const originals = targets.map(() => ({}));
  const from = type();
  const destination = type();
  const input = fixture(selected => selected === from ? originals.map((original, index) => row(`m${index}`, [original]))
    : targets.map((target, index) => row(`m${index}`, [target])), { maximumSteps: 1024 });
  for (const [index, target] of targets.entries()) {
    const selected = input.flow.declarationsFor(subject(from), target, destination);
    assert.equal(selected?.length === 1 && selected[0] === originals[index], true, "exact selected declaration identity");
    assert.equal(Object.isFrozen(selected), true);
  }
  const original = input.flow.declarationsFor(subject(from), targets[0], destination);
  for (let replay = 0; replay < 100; replay += 1) {
    assert.equal(input.flow.declarationsFor(subject(from), targets[0], destination) === original, true,
      "alias subjects consume one completed immutable relation");
  }
  assert.equal(input.calls.length, 2, "one member list per Host type");
  assert.equal(input.retained.length, 165, "only selected members receive checked context");
  assert.equal(input.budget.failure() === undefined, true, "linear indexing fits the unchanged finite work selection");
});

test("member indexes preserve exact order, optional absence, duplicates and declaration identity", () => {
  const first = {};
  const second = {};
  const original = {};
  const another = {};
  const absent = {};
  const from = type();
  const target = type();
  const input = fixture(selected => selected === from
    ? [row("first", [original, original, another, original]), row("second", [original, original])]
    : [row("first", [first]), row("second", [second]), row("absent", [absent], true)]);
  const owner = subject(from);
  const selected = input.flow.declarationsFor(owner, first, target);
  assert.equal(selected?.length === 2 && selected[0] === original && selected[1] === another, true);
  const alternate = input.flow.declarationsFor(owner, second, target);
  assert.equal(alternate?.length === 1 && alternate[0] === original, true);
  for (const declaration of [absent, { ...first }]) {
    assert.equal(input.flow.declarationsFor(owner, declaration, target) === undefined, true,
      "absent and equal-looking unrelated declarations cannot invent correspondence");
  }
  assert.equal(input.calls.length, 2);
  assert.equal(input.retained.some(value => value.node === absent), false);
});

test("member indexes keep checked files, source types and selected destination types independent", () => {
  const declaration = {};
  const from = type();
  const otherFrom = type();
  const to = type();
  const otherTo = type();
  const originals = new Map([[from, {}], [otherFrom, {}]]);
  const input = fixture(selected => originals.has(selected) ? [row("value", [originals.get(selected)])]
    : [row("value", [declaration])]);
  const otherFile = {};
  input.files.push(otherFile);
  for (const [file, selectedType, destination] of [[input.file, from, to], [input.file, otherFrom, to],
    [input.file, from, otherTo], [otherFile, from, to]]) {
    const selected = input.flow.declarationsFor({ ...subject(selectedType), file }, declaration, destination);
    assert.equal(selected?.length === 1 && selected[0] === originals.get(selectedType), true);
    const retained = input.retained.at(-1);
    assert.equal(retained?.file === file, true, "the selected member is retained in its own checked file");
  }
  assert.equal(input.budget.failure() === undefined, true);
});

test("unavailable relationships cache exactly without caching an unresolved subject type", () => {
  const destination = type();
  const declaration = {};
  const input = fixture(selected => selected === destination ? [row("value", [declaration])] : []);
  const owner = subject(undefined);
  input.flow.declarationsFor(owner, declaration, destination);
  assert.equal(input.calls.length, 0, "no selected source type yet");
  owner.node.type = type();
  for (let replay = 0; replay < 20; replay += 1) {
    assert.equal(input.flow.declarationsFor(owner, declaration, destination) === undefined, true);
  }
  assert.equal(input.calls.length, 2);
  assert.equal(input.retained.length, 0);
});

test("member indexing preserves independent finite row and work limits on cold and cached queries", () => {
  const declaration = {};
  const original = {};
  const destination = type();
  const relation = selected => selected === destination ? [row("value", [declaration])] : [row("value", [original])];
  for (const limits of [{ maximumTransportRows: 1 }, { maximumTransportRows: 4 }, { maximumTransportRows: 7 }, { maximumSteps: 1 }]) {
    const input = fixture(relation, limits);
    const owner = subject(type());
    assert.equal(input.flow.declarationsFor(owner, declaration, destination) === undefined, true);
    assert.equal(input.budget.failure() !== undefined, true);
    assert.equal(input.flow.declarationsFor(owner, declaration, destination) === undefined, true,
      "a failed partial relationship cannot publish evidence or clear exhaustion");
  }
  const input = fixture(relation, { maximumSteps: 6 });
  const owner = subject(type());
  assert.equal(input.flow.declarationsFor(owner, declaration, destination)?.[0] === original, true);
  assert.equal(input.flow.declarationsFor(owner, declaration, destination) === undefined, true,
    "cache hits and selected context still consume finite work");
  assert.equal(input.budget.failure() !== undefined, true);
});

test("cached member correspondence cannot bypass selected checked-context rejection", () => {
  const declaration = {};
  const original = {};
  const destination = type();
  let permitted = true;
  const input = fixture(selected => selected === destination ? [row("value", [declaration])] : [row("value", [original])],
    {}, () => permitted);
  const owner = subject(type());
  assert.equal(input.flow.declarationsFor(owner, declaration, destination)?.[0] === original, true);
  permitted = false;
  assert.equal(input.flow.declarationsFor(owner, declaration, destination) === undefined, true);
  assert.equal(input.calls.length, 2);
  assert.equal(input.retained.length, 2);
});

test("direct member selection and recursive domain traversal consume one immutable indexed checked relationship", () => {
  const target = {}; const optional = {}; const original = {};
  const from = type();
  const destination = type();
  const sourceRows = [row("value", [original])];
  const input = fixture(selected => selected === from ? sourceRows
    : [row("value", [target]), row("optional", [optional], true)]);
  const owner = subject(from);
  const selected = input.flow.membersFor(owner, destination);
  assert.equal(Object.isFrozen(selected) && selected.length === 2 &&
    selected[0].kind === "present" && selected[0].destination.declarations[0] === target &&
    selected[0].source.declarations[0] === original &&
    selected[1].kind === "absent" && selected[1].destination.declarations[0] === optional, true,
    "optional absence and exact source/destination member rows remain intact");
  sourceRows.length = 0;
  const declarations = input.flow.declarationsFor(owner, target, destination);
  assert.equal(declarations.length === 1 && declarations[0] === original, true);
  assert.equal(input.flow.membersFor(owner, destination) === selected && selected.length === 2 && input.calls.length === 2, true,
    "the owning completed index isolates its sequence and serves both consumers without duplicate member reads");
  assert.equal(input.budget.failure() === undefined, true);
});

test("optional-only member inventories reserve every retained relationship before copying or publishing their index", () => {
  const destination = type();
  const input = fixture(selected => selected === destination
    ? Array.from({ length: 20 }, (_, index) => row(`m${index}`, [{}], true)) : [], { maximumTransportRows: 8 });
  const owner = subject(type());
  assert.equal(input.flow.membersFor(owner, destination) === undefined, true);
  assert.equal(input.budget.failure() === "Source storage transport exceeds its finite transport-row budget.", true,
    "the complete copied row family is individually larger than the selected finite ceiling");
  assert.equal(input.flow.membersFor(owner, destination) === undefined && input.calls.length === 2, true,
    "neither an empty declaration index nor a cache hit can bypass an oversized exact relationship family");
});

test("throwing member construction releases its unpublished rows before a complete bounded retry", () => {
  const declaration = {}; const original = {};
  const destination = type();
  let fail = true;
  const sourceRow = { name: "value", optional: false, readonly: false, get declarations() {
    if (fail) { fail = false; throw new Error("incomplete member evidence"); }
    return [original];
  } };
  const input = fixture(selected => selected === destination ? [row("value", [declaration])] : [sourceRow],
    { maximumTransportRows: 8 });
  const owner = subject(type());
  assert.throws(() => input.flow.declarationsFor(owner, declaration, destination), /incomplete member evidence/);
  assert.equal(input.budget.failure() === undefined, true, "an exception is not a fabricated budget failure");
  const selected = input.flow.declarationsFor(owner, declaration, destination);
  assert.equal(selected?.length === 1 && selected[0] === original, true, "no failed index or reservation survives");
  assert.equal(input.flow.declarationsFor(owner, declaration, destination) === selected, true);
  assert.equal(input.calls.length === 2 && input.budget.failure() === undefined, true);
});
