import { remainingWork } from "../../../packages/host/dist/dataflow/index.js";
import assert from "node:assert/strict";

export async function cellTransportCases(suite) {
  const { createInstantiationMeter } = await import("../../../packages/host/dist/ir-program/work.js");
  const { createProjectionInventory, drainProjectionInventory } = await import("../../../packages/host/dist/ir-program/program-values.js");
  const { inventorySummary } = await import("../../../packages/host/dist/ir-program/instantiate-facts.js");
  const { rewriteSummary } = await import("../../../packages/host/dist/ir-program/canonical-facts.js");
  const ids = await import("../../../packages/host/dist/ids/index.js");
  const module = ids.encodeModuleId({ package: ids.encodePackageId("program-cells"), path: "source.ts" });
  const definition = ids.encodeDefId({ module, segments: [{ name: "run", ordinal: 0 }] });
  const body = ids.encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
  const instance = { body, bindings: { kind: "parametric" } };
  const execution = { instance, provided: 2 };
  const key = { kind: "body", execution };
  const bindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
  const source = { kind: "body", value: { body, node: 3 } };
  const declared = { kind: "declared", at: { kind: "node", node: source } };
  const row = (role, occurrence = declared) => ({ id: 0, role, occurrence, lifetimes: [] });
  const summary = cells => ({ key, signature: 0, arena: { cells, projections: [], producers: [], contexts: [],
    boundProducers: [], origins: [], boundaries: [] }, parameters: [], captures: [], result: 0, thrown: 0,
    writes: [], retention: [], callbacks: [], suspends: false, bindingDependent: false, concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns: false, unwinds: false, initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }], points: [], rows: [] }, resultCells: [], backing: [] });
  const limits = (maximumWork = 100000, maximumCreatedRecords = 100000) => ({
    maximumWork, maximumCreatedRecords, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 20, maximumVisits: 100, maximumUnionMembers: 20, maximumIntersectionMembers: 20 } });
  const identity = { type: value => value, signature: value => value, parameterBinding: value => value, selfBinding: value => value };
  const inventory = (value, maximumWork, maximumCreatedRecords) => {
    const meter = createInstantiationMeter(limits(maximumWork, maximumCreatedRecords));
    const scan = createProjectionInventory(meter, identity);
    const stop = inventorySummary(scan, value) ?? drainProjectionInventory(scan);
    return { stop, meter, scan };
  };

  await suite.test("canonical Program cell inventory charges the actual seventh arena field and every copied row before rewriting", () => {
    const staticRole = { kind: "static", declaration: { definition, bindings: instance.bindings } };
    const selected = { key: { kind: "text", value: "field" }, origins: [{ kind: "declared", declaration: definition }],
      selectedDeclarations: [definition], primary: definition, bindings: bindings() };
    const statement = { kind: "statement", execution, point: { block: 0, statement: 1 } };
    const scenarios = [
      [summary([]), 46, 6],
      [summary([row({ kind: "detached" })]), 54, 7],
      [summary([row({ kind: "parameter", index: 0 })]), 55, 7],
      [summary([row({ kind: "capture", index: 0 })]), 55, 7],
      [summary([row({ kind: "local", local: 0 }, statement)]), 64, 10],
      [summary([row(staticRole)]), 60, 9],
      [summary([row({ kind: "created", anchor: { kind: "result" }, slot: { kind: "entity" } })]), 59, 8],
      [summary([row({ kind: "created", anchor: { kind: "receiver" }, slot: { kind: "entity" } })]), 59, 8],
      [summary([row({ kind: "created", anchor: { kind: "local", local: 0 }, slot: { kind: "entity" } })]), 60, 8],
      [summary([row({ kind: "created", anchor: { kind: "result" }, slot: { kind: "local", local: { body, local: 0 } } })]), 60, 8],
      [summary([row({ kind: "created", anchor: { kind: "result" }, slot: { kind: "capture", path: 0, index: 0 } })]), 61, 8],
      [summary([row({ kind: "created", anchor: staticRole, slot: { kind: "field", member: selected } })]), 78, 13],
    ];
    const local = scenarios.find(([value]) => value.arena.cells[0]?.occurrence.kind === "statement");
    local[0].arena.cells[0].lifetimes = [{ kind: "live", execution, point: { block: 0, statement: 0 }, local: 0 }];
    local[1] += 12;
    local[2] += 3;
    for (const [value, work, records] of scenarios) {
      const exact = inventory(value, work, records);
      assert.equal(exact.stop, null);
      assert.equal(work - remainingWork(exact.meter.account), work);
      assert.equal(exact.meter.created, records);
      assert.deepEqual(rewriteSummary(identity, value, key), value);
      for (const [dimension, maximum] of [["work", work], ["created-records", records]]) {
        for (let allowance = 0; allowance < maximum; allowance += 1) {
          const result = inventory(value, dimension === "work" ? allowance : work,
            dimension === "created-records" ? allowance : records);
          assert.deepEqual(result.stop, { kind: "resource-limit", dimension, maximum: allowance });
        }
      }
    }
    let reads = 0;
    const observed = row({ kind: "detached" });
    Object.defineProperty(observed, "role", { get() { reads += 1; return { kind: "detached" }; } });
    assert.deepEqual(inventory(summary([observed]), 46, 6).stop, { kind: "resource-limit", dimension: "work", maximum: 46 });
    assert.equal(reads, 0, "refused row admission never reads its later role or copies a cell");
  });

  await suite.test("canonical Program cells rewrite every actual binding position without changing the dense row identity or provided count", () => {
    const vector = bindings();
    vector.classBindings.push({ kind: "bound", parameter: { owner: definition, index: 0 }, type: 0 });
    const artifact = { kind: "instantiated", bindings: vector };
    const selectedExecution = { instance: { body, bindings: artifact }, provided: 2 };
    const selectedMember = { key: { kind: "text", value: "field" }, origins: [], selectedDeclarations: [definition],
      primary: definition, bindings: vector };
    const rows = [
      row({ kind: "static", declaration: { definition, bindings: artifact } }),
      { ...row({ kind: "created", anchor: { kind: "static", declaration: { definition, bindings: artifact } },
        slot: { kind: "field", member: selectedMember } }), id: 1,
        occurrence: { kind: "entry", execution: selectedExecution, local: 0 },
        lifetimes: [{ kind: "live", execution: selectedExecution, point: { block: 0, statement: 1 }, local: 0 }] },
      { ...row({ kind: "detached" }, { kind: "statement", execution: selectedExecution, point: { block: 0, statement: 2 } }), id: 2 },
    ];
    const value = summary(rows);
    const scanned = inventory(value, 1000, 1000);
    assert.equal(scanned.stop, null);
    assert.deepEqual([...scanned.scan.types], [0], "static/physical/entry/statement/lifetime bindings all feed the actual projection inventory");
    const rewritten = rewriteSummary({ ...identity, type: type => type + 7 }, value, key);
    const expected = structuredClone(value);
    const expectedVector = { ...vector, classBindings: [{ ...vector.classBindings[0], type: 7 }] };
    expected.arena.cells[0].role.declaration.bindings.bindings = expectedVector;
    const second = expected.arena.cells[1];
    second.role.anchor.declaration.bindings.bindings = expectedVector;
    second.role.slot.member.bindings = expectedVector;
    second.occurrence.execution.instance.bindings.bindings = expectedVector;
    second.lifetimes[0].execution.instance.bindings.bindings = expectedVector;
    expected.arena.cells[2].occurrence.execution.instance.bindings.bindings = expectedVector;
    assert.deepEqual(rewritten, expected);
    assert.deepEqual(rewritten.arena.cells.map(cell => cell.id), [0, 1, 2]);
    assert.equal(value.arena.cells[1].occurrence.execution.instance.bindings.bindings.classBindings[0].type, 0,
      "the one source arena is never mutated or reindexed");
  });
  await suite.test("Program transports the saved complete exchange, witness and backing records without semantic producer claims", () => {
    const value = summary([row({ kind: "detached" })]);
    const owner = { kind: "summary", key };
    const subject = { owner, producer: 0 };
    const declaredKey = { kind: "declared", execution: { request: { definition, endpoint: "api-signature", ordinal: 2,
      bindings: instance.bindings }, provided: 2 } };
    const bodyAt = { kind: "body", execution, point: { block: 0, statement: 0 }, edge: null };
    const declaredAt = { kind: "declared", execution: declaredKey.execution, source };
    value.arena.contexts = [{ id: 0, receiver: null, arguments: [], captures: [] }];
    value.arena.producers = [{ id: 0, kind: "parameter", index: 0, path: null }];
    value.arena.boundProducers = [{ id: 0, producer: 0, bindings: bindings(), context: 0 }];
    value.arena.origins = [{ id: 0, kind: "complete", producers: [0], includesAbsence: false }];
    value.retention = [{ source: 0, at: bodyAt, into: { kind: "return" } }, { source: 0, at: declaredAt, into: { kind: "throw" } }];
    value.callbacks = [
      { kind: "known", subject, at: bodyAt, signature: 0, provided: 2, context: 0, result: 0, thrown: 0,
        handle: null, timing: "synchronous", shared: [] },
      { kind: "known", subject: { owner: { kind: "body", execution }, producer: 0 }, at: declaredAt, signature: 1, provided: 2,
        context: 0, result: 0, thrown: 0, handle: { owner: { kind: "summary", key: declaredKey }, producer: 0 }, timing: "deferred", shared: [] },
      { kind: "unknown", subject, boundary: { owner, boundary: 0 }, signatures: [0, 1], constraint: null, invocationOnly: false },
    ];
    value.backing = [
      { at: bodyAt, pointer: 0, cell: 0, operation: { family: "typed-location", operation: "allocate", at: source.value }, use: { kind: "return" } },
      { at: declaredAt, pointer: 0, cell: 0, operation: { family: "typed-location", operation: "address-of", at: source.value },
        use: { kind: "argument", callee: declaredKey, slot: { kind: "parameter", index: 0 }, passing: "borrow-shared" } },
    ];
    value.initialization = { cells: [0], conditions: [{ alternatives: [] }, { alternatives: [[]] }], rows: [],
      events: [{ kind: "callback", subject, exit: "return" }],
      points: [{ kind: "return" }, { kind: "unwind" }, { kind: "before", at: bodyAt, subject },
        { kind: "before", at: declaredAt, subject }, { kind: "completed", handle: subject, exit: "return" },
        { kind: "need", at: bodyAt, cell: 0, witness: { read: source, via: [{ key, row: 0 }, { key: declaredKey, row: 0 }] } }] };
    assert.deepEqual(rewriteSummary(identity, value, key), value, "identity projection retains all supplied fields and qualified owners");
    const expected = structuredClone(value);
    expected.signature += 3;
    for (const callback of expected.callbacks) {
      if (callback.kind === "known") callback.signature += 3;
      else callback.signatures = callback.signatures.map(id => id + 3);
    }
    assert.deepEqual(rewriteSummary({ ...identity, signature: value => value + 3 }, value, key), expected);
    const rich = inventory(value, 10000, 10000);
    assert.equal(rich.stop, null);
    const neededWork = 10000 - remainingWork(rich.meter.account);
    const neededRecords = rich.meter.created;
    for (const [dimension, needed] of [["work", neededWork], ["created-records", neededRecords]]) {
      for (let maximum = 0; maximum < needed; maximum += 1) {
        const stopped = inventory(value, dimension === "work" ? maximum : neededWork,
          dimension === "created-records" ? maximum : neededRecords).stop;
        assert.deepEqual(stopped, { kind: "resource-limit", dimension, maximum });
      }
    }
  });

}
