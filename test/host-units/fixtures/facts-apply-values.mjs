import assert from "node:assert/strict";
import { verificationStops } from "./facts-verification.mjs";

export async function applyValueCases(suite) {
  const { applyValueOrigins } = await import("../../../packages/host/dist/ir-facts/apply-values.js");
  const flow = await import("../../../packages/host/dist/dataflow/index.js");
  const ids = await import("../../../packages/host/dist/ids/index.js");
  const module = ids.encodeModuleId({ package: ids.encodePackageId("summary-values"), path: "main.ts" });
  const definition = name => ids.encodeDefId({ module, segments: [{ name, ordinal: 0 }] });
  const body = name => ids.encodeBodyId({ owner: definition(name), role: "function", ordinal: 0 });
  const bindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
  const execution = name => ({ instance: { body: body(name), bindings: { kind: "parametric" } }, provided: 2 });
  const position = () => ({ execution: execution("caller"), point: { block: 0, statement: 1 } });
  const source = name => ({ kind: "node", node: { kind: "body", value: { body: body(name), node: 0 } } });
  const bound = (id, producer = id, context = 0) => ({ id, producer, bindings: bindings(), context });
  const context = id => ({ id, receiver: null, arguments: [], captures: [] });
  const origins = (id, producers = [], includesAbsence = false) => ({ id, producers, includesAbsence, kind: "complete" });
  const boundary = name => ({ id: 0, kind: "external-input", at: source(name), subject: 0, owner: null,
    bindings: bindings(), context: 0, detail: "actual constructed boundary" });
  const arena = () => ({ cells: [], projections: [], producers: [], contexts: [context(0)], boundProducers: [], origins: [origins(0)], boundaries: [] });
  const summary = () => ({ key: { kind: "body", execution: execution("callee") }, signature: 0, arena: arena(),
    parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [],
    concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns: true, unwinds: false,
    initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }],
      points: [{ kind: "return" }], rows: [{ point: 0, cell: null, condition: 0 }] }, resultCells: [], backing: [],
    suspends: false, bindingDependent: false });
  const input = () => { const value = summary(); return { summary: value, callee: structuredClone(value.key),
    at: position(), context: 0, caller: arena(), entries: [] }; };
  const refusal = { kind: "refused", diagnostics: [{ code: { kind: "checker", number: 1, rendered: "origins bound" },
    severity: "error", site: { kind: "none" }, source: null, evidence: [], message: "origins bound", arguments: [], related: [], fix: null }] };
  const limits = (maximumWork = 100000, maximumResultEntries = 100000, maximumOriginAlternatives = 100000) => ({
    maximumOriginAlternatives, account: flow.createAccount({ maximumWork, maximumResultEntries }), refusal });
  const complete = result => { assert.equal(result.kind, "complete"); return result.value.origins; };
  const callWithValues = () => {
    const value = input();
    value.summary.arena.producers = [{ id: 0, kind: "parameter", index: 0, path: null },
      { id: 1, kind: "allocation", at: source("callee"), path: null }, { id: 2, kind: "parameter", index: 1, path: null }];
    value.summary.arena.boundProducers = [bound(0), bound(1), bound(2)];
    value.summary.arena.origins = [origins(0), origins(1, [0]), origins(2, [1]),
      { ...origins(3, [0, 1, 2]), kind: "open", boundaries: [0] }];
    value.summary.arena.boundaries = [boundary("callee")];
    value.caller.producers = [0, 1, 2].map(id => ({ id, kind: "allocation", path: null, at: source("caller") }));
    value.caller.contexts.push(context(1));
    value.caller.boundProducers = [bound(0), bound(1), bound(2, 2, 1)];
    value.caller.origins = [origins(0), { ...origins(1, [0, 1], true), kind: "open", boundaries: [0] },
      { ...origins(2, [1, 2]), kind: "open", boundaries: [0] }];
    value.caller.boundaries = [boundary("caller")];
    value.entries = [{ formal: 0, actual: 1 }, { formal: 2, actual: 2 }];
    return value;
  };

  await suite.test("private summary value application expands actual bound alternatives without losing arena, bindings or absence", () => {
    const supplied = callWithValues();
    const before = structuredClone(supplied);
    const rows = complete(applyValueOrigins(supplied, limits()));
    const caller = { kind: "body", execution: supplied.at.execution };
    const callee = { kind: "summary", key: supplied.summary.key };
    assert.deepEqual(rows[0], { caller: [], callee: [], includesAbsence: false, boundaries: [] });
    assert.deepEqual(rows[1], { caller: [{ owner: caller, producer: 0 }, { owner: caller, producer: 1 }], callee: [],
      includesAbsence: true, boundaries: [{ owner: caller, boundary: 0 }] });
    assert.deepEqual(rows[2], { caller: [], callee: [{ at: supplied.at, context: 0, producer: { owner: callee, producer: 1 } }],
      includesAbsence: false, boundaries: [] });
    assert.deepEqual(rows[3], { caller: [0, 1, 2].map(producer => ({ owner: caller, producer })),
      callee: [{ at: supplied.at, context: 0, producer: { owner: callee, producer: 1 } }], includesAbsence: true,
      boundaries: [{ owner: caller, boundary: 0 }, { owner: callee, boundary: 0 }] });
    assert.deepEqual(supplied, before);
    assert.equal(applyValueOrigins(supplied, limits(100000, 100000, 3)), refusal, "four actual alternatives, not two imported OriginsRefs");
    const created = callWithValues(); created.summary.arena.origins = [origins(0), origins(1, [1])];
    assert.equal(applyValueOrigins(created, limits(100000, 100000, 0)), refusal, "a created alternative is bounded before its output record");
    assert.equal(complete(applyValueOrigins(supplied, limits(100000, 100000, 4)))[3].caller.length, 3);
    const other = structuredClone(supplied); other.at.point.statement = 2;
    assert.notDeepEqual(complete(applyValueOrigins(other, limits()))[2], rows[2], "two applications retain different positions");
    other.at = supplied.at; other.context = 1;
    assert.notDeepEqual(complete(applyValueOrigins(other, limits()))[2], rows[2], "one position retains distinct actual contexts");
    supplied.entries[1].actual = 1;
    assert.equal(complete(applyValueOrigins(supplied, limits()))[3].caller.length, 2, "the same imported value is expanded once");
    const scalar = callWithValues(); scalar.caller.origins[1] = origins(1); scalar.caller.origins[2] = origins(2);
    scalar.summary.arena.origins = [origins(0), origins(1, [0, 2])];
    assert.deepEqual(complete(applyValueOrigins(scalar, limits(100000, 100000, 0)))[1],
      { caller: [], callee: [], includesAbsence: false, boundaries: [] }, "empty scalar values do not create artificial alternatives");
  });

  await suite.test("private summary value application rejects missing/forged entry and complete execution relationships", () => {
    const mutations = [
      value => { value.callee.execution.provided = 1; },
      value => { value.callee.execution.instance.body = body("other"); },
      value => { value.callee.execution.instance.bindings = { kind: "instantiated", bindings: bindings() }; },
      value => { value.context = -0; }, value => { value.context = 4; }, value => { value.caller.contexts[0].id = 1; },
      value => { value.entries.pop(); }, value => { value.entries.push({ formal: 0, actual: 1 }); },
      value => { value.entries.push({ formal: 4, actual: 1 }); }, value => { value.entries.push({ formal: 1, actual: 1 }); },
      value => { value.entries[0].actual = 4; }, value => { value.caller.origins[1].id = 2; },
      value => { value.summary.arena.boundProducers[0].id = 1; }, value => { delete value.summary.arena.boundProducers[0]; },
      value => { value.summary.arena.boundProducers[0].producer = 10; }, value => { value.summary.arena.producers[0].id = 1; },
      value => { value.summary.arena.origins[0].id = 1; }, value => { delete value.summary.arena.origins[0]; },
      value => { value.summary.arena.origins[3].producers = [1, 0]; }, value => { value.summary.arena.origins[3].producers = [0, 9]; },
      value => { value.caller.boundProducers[0].id = 1; }, value => { delete value.caller.boundProducers[0]; },
      value => { value.caller.origins[1].producers = [9]; }, value => { value.caller.boundaries[0].id = 1; },
      value => { value.summary.arena.boundaries[0].id = 1; }, value => { value.summary.arena.origins[3].boundaries = [9]; },
    ];
    for (const mutate of mutations) { const supplied = callWithValues(); mutate(supplied); assert.throws(() => applyValueOrigins(supplied, limits()), TypeError); }
    const supplied = callWithValues();
    const request = { definition: definition("declared"), endpoint: "api-signature", ordinal: 1, bindings: { kind: "parametric" } };
    supplied.summary.key = { kind: "declared", execution: { request, provided: 2 } };
    supplied.callee = structuredClone(supplied.summary.key);
    complete(applyValueOrigins(supplied, limits()));
    supplied.callee.execution.request.ordinal = 0;
    assert.throws(() => applyValueOrigins(supplied, limits()), TypeError);
    supplied.callee.execution.request.ordinal = 1; supplied.callee.execution.request.endpoint = "advertised";
    assert.throws(() => applyValueOrigins(supplied, limits()), TypeError);
    for (const invalid of [-0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      assert.throws(() => applyValueOrigins(input(), { ...limits(), maximumOriginAlternatives: invalid }), TypeError);
  });

  await suite.test("private summary value application charges one account before growth and returns the original first refusal", () => {
    const supplied = input();
    const work = 9 + 2 * supplied.summary.key.execution.instance.body.length;
    assert.equal(complete(applyValueOrigins(supplied, limits(work, 15, 0))).length, 1,
      "two complete owner admissions6+2bodylength, setup/output/row3 work; owner12 plus setup/output/row3 entries");
    assert.deepEqual(applyValueOrigins(supplied, limits(work - 1, 15)), { kind: "resource-limit", dimension: "work", maximum: work - 1 });
    assert.deepEqual(applyValueOrigins(supplied, limits(work, 14)), { kind: "resource-limit", dimension: "result-entries", maximum: 14 });
    const bounds = limits();
    verificationStops(account => {
      const result = applyValueOrigins(callWithValues(), { ...bounds, account });
      if (result.kind !== "complete") assert.equal(applyValueOrigins(null, { ...bounds, account }), result);
      return result;
    });
    const alternatives = limits(100000, 100000, 0);
    assert.equal(applyValueOrigins(callWithValues(), alternatives), refusal);
    assert.equal(applyValueOrigins(null, alternatives), refusal);
    const shared = limits(2 * work - 1, 10000, 0);
    complete(applyValueOrigins(supplied, shared));
    const stop = applyValueOrigins(supplied, shared);
    assert.deepEqual(stop, { kind: "resource-limit", dimension: "work", maximum: 2 * work - 1 });
    assert.equal(applyValueOrigins(null, shared), stop);
    const original = limits(); flow.refuseAccount(original.account, refusal);
    assert.equal(applyValueOrigins(null, original), refusal);
  });

  const { checkHeldReferenceArgument } = await import("./held-reference-argument.mjs");
  await suite.test("a copied capture binds its actual root separately from its returned projection", checkHeldReferenceArgument);
}
