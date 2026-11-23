import { insertFixtureType } from "./types-construction.mjs";
import assert from "node:assert/strict";
import { encodePackageId, encodeModuleId, encodeDefId } from "../../../packages/host/dist/ids/index.js";

export async function graphInsertionCases(suite, types) {
  const { usedPublicationWork, usedPublicationRecords, chargeCreated, workLimit, createdLimit } =
    await import("../../../packages/host/dist/ir-types/work.js");
  const module = encodeModuleId({ package: encodePackageId("type-graph-owner"), path: "main.ts" });
  const definition = name => encodeDefId({ module, segments: [{ name, ordinal: 0 }] });
  const limits = { maximumWork: 10000000, maximumCreatedRecords: 10000000 };
  const create = () => {
    const arena = types.createTypeInterner();
    const bool = insertFixtureType(types, arena, { kind: "primitive", primitive: "bool" });
    const string = insertFixtureType(types, arena, { kind: "string" });
    return { arena, bool, string, table: types.viewTypes(arena) };
  };
  const run = (arena, terms, signatures = [], work = types.createTypePublicationWork(limits)) => {
    const table = types.viewTypes(arena);
    return { work, result: types.internTypeGraph({ types: arena, work }, {
      typeBase: table.terms.length, signatureBase: table.signatures.length, terms, signatures }) };
  };
  const shape = (read, signature = null) => ({ kind: "shape", members: [{ key: { kind: "text", value: "next" },
    origins: [{ kind: "declared", declaration: definition("next") }], readOrigins: [{ kind: "declared", declaration: definition("next") }],
    writeOrigins: [], kind: "property", read, write: null, optional: false, readonly: true }],
    indexes: [], calls: signature === null ? [] : [signature], constructs: [] });

  await suite.test("a finite cyclic type/signature graph joins the populated arena without retagging issued rows", () => {
    const current = create();
    const prefix = [...current.table.terms];
    const root = shape(3, 0);
    root.indexes.push({ origin: { kind: "item", value: { owner: definition("index"), node: 7 } }, key: current.string,
      read: 3, write: null, readonly: true });
    const signature = { declaration: definition("call"), owner: null, composition: null, kind: "call", typeParameters: [],
      receiver: null, parameters: [{ declaration: definition("argument"), kind: "required", type: 3,
        passing: "by-value", initializer: null, acceptsOmission: false }], result: 4 };
    const result = run(current.arena, [{ kind: "primitive", primitive: "bool" }, root,
      { kind: "callable", calls: [0], constructs: [] }], [signature]).result;
    assert.equal(result.kind, "complete");
    assert.equal(types.viewTypes(current.arena) === current.table, true);
    assert.equal(current.table.terms[0] === prefix[0] && current.table.terms[1] === prefix[1], true);
    assert.equal(result.value.types[0], current.bool);
    const selected = types.readType(current.arena, result.value.types[1]);
    assert.equal(selected.members[0].read, result.value.types[1]);
    assert.equal(selected.indexes[0].key, current.string);
    assert.equal(selected.indexes[0].read, result.value.types[1]);
    assert.equal(selected.calls[0], result.value.signatures[0]);
    const actual = types.readSignature(current.arena, result.value.signatures[0]);
    assert.equal(actual.parameters[0].type, result.value.types[1]);
    assert.equal(actual.result, result.value.types[2]);
    root.members[0].key.value = "caller mutation";
    root.indexes[0].origin.value.node = 99;
    signature.parameters[0].type = current.string;
    assert.equal(selected.members[0].key.value, "next");
    assert.equal(selected.indexes[0].origin.value.node, 7);
    assert.equal(actual.parameters[0].type, result.value.types[1]);
    const text = types.printTypes(current.table);
    assert.deepEqual(types.parseTypes(text), { kind: "parsed", value: current.table });
    assert.equal(types.exportTypes(current.arena, limits).kind, "complete");
  });

  await suite.test("redirected staged keys and equivalent recursive batches reuse already admitted representatives", () => {
    const current = create();
    const existing = insertFixtureType(types, current.arena, { kind: "array", element: current.bool, readonly: false });
    const first = run(current.arena, [{ kind: "primitive", primitive: "bool" },
      { kind: "array", element: 3, readonly: false }, { kind: "array", element: 3, readonly: false }]).result;
    assert.equal(first.kind, "complete");
    assert.deepEqual(first.value.types, [current.bool, existing, existing]);
    const left = run(current.arena, [shape(current.table.terms.length)]).result;
    const right = run(current.arena, [shape(current.table.terms.length)]).result;
    assert.equal(left.kind === "complete" && right.kind === "complete", true);
    assert.equal(left.value.types[0] === right.value.types[0], true, "no second representative is issued for the equivalent cycle");
    const published = types.exportTypes(current.arena, limits);
    assert.equal(published.kind, "complete");
    assert.equal(new Set(published.value.types).size, current.table.terms.length, "final publication only permutes admitted IDs");
  });

  await suite.test("every work and record prefix refuses atomically and keeps the first original stop unread", () => {
    const graphs = [current => ({ terms: [{ kind: "array", element: current.bool, readonly: false }], signatures: [] }),
      current => ({ terms: [{ kind: "union", members: [current.bool, current.string] }, { kind: "callable", calls: [0], constructs: [] }],
        signatures: [{ declaration: definition("bounded-call"), owner: null, composition: null, kind: "call", typeParameters: [],
          receiver: null, parameters: [], result: current.bool }] }),
      current => ({ terms: [{ kind: "union", members: [current.bool, 3] }, { kind: "optional", value: current.string }], signatures: [] })];
    for (const graph of graphs) {
    const reference = create();
    const input = graph(reference);
    const measured = run(reference.arena, input.terms, input.signatures);
    assert.equal(measured.result.kind, "complete");
    const exact = { maximumWork: usedPublicationWork(measured.work), maximumCreatedRecords: usedPublicationRecords(measured.work) };
    for (const dimension of ["work", "created-records"]) {
      const field = dimension === "work" ? "maximumWork" : "maximumCreatedRecords";
      for (let maximum = 0; maximum <= exact[field]; maximum++) {
        const current = create();
        const before = [...current.table.terms];
        const work = types.createTypePublicationWork({ ...exact, [field]: maximum });
        const supplied = graph(current);
        const result = run(current.arena, supplied.terms, supplied.signatures, work).result;
        if (maximum === exact[field]) { assert.equal(result.kind, "complete"); continue; }
        assert.deepEqual(result, { kind: "resource-limit", dimension, maximum });
        assert.equal(types.viewTypes(current.arena) === current.table, true);
        assert.equal(current.table.terms.length, before.length);
        assert.equal(current.table.signatures.length, 0);
        assert.equal(before.every((row, index) => row === current.table.terms[index]), true);
        const unread = new Proxy({}, { get() { assert.fail("a stopped graph budget cannot read another input"); } });
        assert.equal(types.internTypeGraph({ types: current.arena, work }, unread) === result, true);
        const retained = usedPublicationRecords(work);
        assert.equal(chargeCreated(work, 1), false, "the existing private record admission also stops before growth");
        assert.equal(usedPublicationRecords(work), retained);
        assert.equal(workLimit(work) === result && createdLimit(work) === result, true,
          "the original dimension/maximum survives both private refusal readers");
      }
    }
    }
  });

  await suite.test("graph fields and vector elements remain unread until their own work and retention are admitted", () => {
    const original = new Error("an unadmitted graph payload was read");
    for (let maximum = 0; maximum < 16; maximum += 1) {
      const current = create();
      let reads = 0;
      const term = { kind: "union", get members() { reads += 1; throw original; } };
      const work = types.createTypePublicationWork({ ...limits, maximumWork: maximum });
      const result = run(current.arena, [term], [], work).result;
      assert.deepEqual(result, { kind: "resource-limit", dimension: "work", maximum });
      assert.equal(reads, 0);
      assert.equal(current.table.terms.length, 2);
    }
    for (const dimension of ["work", "created-records"]) {
      const current = create();
      let elements = 0;
      const members = [current.bool];
      Object.defineProperty(members, 0, { get() { elements += 1; throw original; } });
      const work = types.createTypePublicationWork({ maximumWork: dimension === "work" ? 16 : limits.maximumWork,
        maximumCreatedRecords: dimension === "created-records" ? 4 : limits.maximumCreatedRecords });
      const result = run(current.arena, [{ kind: "union", members }], [], work).result;
      assert.deepEqual(result, { kind: "resource-limit", dimension, maximum: dimension === "work" ? 16 : 4 });
      assert.equal(elements, 0);
      assert.equal(current.table.terms.length, 2);
    }
    for (let maximum = 14; maximum <= 22; maximum += 1) {
      const current = create();
      let reads = 0;
      const signature = { declaration: null, owner: null, composition: null, kind: "call", typeParameters: [],
        receiver: null, get parameters() { reads += 1; throw original; }, result: current.bool };
      const result = run(current.arena, [], [signature],
        types.createTypePublicationWork({ ...limits, maximumWork: maximum })).result;
      assert.deepEqual(result, { kind: "resource-limit", dimension: "work", maximum });
      assert.equal(reads, 0);
      assert.equal(current.table.signatures.length, 0);
    }
  });

  await suite.test("one borrowed budget accumulates across actual lazy graph insertions without retargeting its maximum", () => {
    const reference = create();
    const first = run(reference.arena, [{ kind: "array", element: reference.bool, readonly: false }]);
    const bound = usedPublicationWork(first.work);
    const current = create();
    const work = types.createTypePublicationWork({ ...limits, maximumWork: bound });
    assert.equal(run(current.arena, [{ kind: "array", element: current.bool, readonly: false }], [], work).result.kind, "complete");
    const before = current.table.terms.length;
    const next = run(current.arena, [{ kind: "array", element: current.string, readonly: false }], [], work).result;
    assert.deepEqual(next, { kind: "resource-limit", dimension: "work", maximum: bound });
    assert.equal(current.table.terms.length, before);
    const again = run(current.arena, [], [], work).result;
    assert.equal(again === next, true);
    for (const invalid of [-1, 0.5, NaN, Infinity])
      assert.throws(() => types.createTypePublicationWork({ ...limits, maximumWork: invalid }), TypeError);
  });

  await suite.test("invalid snapshot, reference and sparse caller inputs never mutate the arena", () => {
    const current = create();
    const rows = current.table.terms.length;
    const execute = input => types.internTypeGraph({ types: current.arena, work: types.createTypePublicationWork(limits) }, input);
    for (const input of [
      { typeBase: rows - 1, signatureBase: 0, terms: [], signatures: [] },
      { typeBase: rows, signatureBase: 1, terms: [], signatures: [] },
      { typeBase: rows, signatureBase: 0, terms: new Array(1), signatures: [] },
      { typeBase: rows, signatureBase: 0, terms: [], signatures: new Array(1) },
      { typeBase: rows, signatureBase: 0, terms: new Proxy([], { get(target, key) {
        return key === "length" ? Number.MAX_SAFE_INTEGER : Reflect.get(target, key); } }), signatures: [] },
      { typeBase: rows, signatureBase: 0, terms: [], signatures: new Proxy([], { get(target, key) {
        return key === "length" ? Number.MAX_SAFE_INTEGER + 1 : Reflect.get(target, key); } }) },
      ...[-1, -0, 0.5, NaN, rows + 1].map(element => ({ typeBase: rows, signatureBase: 0,
        terms: [{ kind: "array", element, readonly: false }], signatures: [] })),
      { typeBase: rows, signatureBase: 0, terms: [{ kind: "callable", calls: [0], constructs: [] }], signatures: [] },
      { typeBase: rows, signatureBase: 0, terms: [{ kind: "callable", calls: new Array(1), constructs: [] }], signatures: [] },
    ]) {
      assert.throws(() => execute(input), TypeError);
      assert.equal(current.table.terms.length, rows);
      assert.equal(current.table.signatures.length, 0);
    }
    assert.deepEqual(run(current.arena, []).result, { kind: "complete", value: { types: [], signatures: [] } });
  });

  await suite.test("malformed caller vector lengths cannot refund the shared publication budget", () => {
    for (const field of ["terms", "signatures"]) for (const length of [-20, -1, 0.5, NaN, Infinity]) {
      const current = create();
      const work = types.createTypePublicationWork(limits);
      const vector = new Proxy([], { get(target, key) { return key === "length" ? length : Reflect.get(target, key); } });
      const input = { typeBase: current.table.terms.length, signatureBase: 0, terms: [], signatures: [], [field]: vector };
      let failure = null;
      try { types.internTypeGraph({ types: current.arena, work }, input); } catch (error) { failure = error; }
      assert.equal(usedPublicationWork(work) >= 0 && usedPublicationRecords(work) >= 0, true,
        "a malformed caller vector never earns negative work or record charges");
      assert.equal(failure instanceof TypeError, true, "malformed caller density is rejected at the domain boundary");
      assert.equal(usedPublicationWork(work), 7, "only the actual header read was admitted before invalid length rejection");
      assert.equal(usedPublicationRecords(work), 0);
      assert.equal(current.table.terms.length, 2);
      assert.equal(current.table.signatures.length, 0);
    }
  });

  await suite.test("deep finite forward references use the same iterative staging owner", () => {
    const current = create();
    const count = 10000;
    const base = current.table.terms.length;
    const terms = Array.from({ length: count }, (_, index) => ({ kind: "array", readonly: false,
      element: index === count - 1 ? current.bool : base + index + 1 }));
    const result = run(current.arena, terms).result;
    assert.equal(result.kind, "complete");
    let at = result.value.types[0];
    for (let index = 0; index < count; index++) at = types.readType(current.arena, at).element;
    assert.equal(at, current.bool);
  });
}
