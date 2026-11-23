import assert from "node:assert/strict";
import { verificationStops } from "./facts-verification.mjs";

export async function applySummaryCases(suite) {
  const { applySummary, summaryEquals, printSummary, parseSummary } = await import("../../../packages/host/dist/ir-facts/index.js");
  const flow = await import("../../../packages/host/dist/dataflow/index.js");
  const ids = await import("../../../packages/host/dist/ids/index.js");
  const module = ids.encodeModuleId({ package: ids.encodePackageId("summary-application"), path: "main.ts" });
  const definition = name => ids.encodeDefId({ module, segments: [{ name, ordinal: 0 }] });
  const body = name => ids.encodeBodyId({ owner: definition(name), role: "function", ordinal: 0 });
  const execution = name => ({ instance: { body: body(name), bindings: { kind: "parametric" } }, provided: name === "callee" ? 2 : 0 });
  const bindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
  const context = () => ({ id: 0, receiver: null, arguments: [], captures: [] });
  const origin = (id, producers = []) => ({ id, kind: "complete", producers, includesAbsence: false });
  const cell = (id, name) => ({ id, role: { kind: "detached" },
    occurrence: { kind: "statement", execution: execution(name), point: { block: 0, statement: 0 } }, lifetimes: [] });
  const arena = () => ({ cells: [], projections: [], producers: [], boundProducers: [], contexts: [context()], origins: [origin(0)], boundaries: [] });
  const no = () => ({ alternatives: [] });
  const yes = () => ({ alternatives: [[]] });
  const simple = () => {
    const summary = { key: { kind: "body", execution: execution("callee") }, signature: 0, arena: arena(), parameters: [], captures: [],
      result: 0, thrown: 0, writes: [], concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [],
      returns: true, unwinds: false, retention: [], callbacks: [], resultCells: [], backing: [], suspends: false, bindingDependent: false,
      initialization: { cells: [], events: [], conditions: [no(), yes()], points: [{ kind: "return" }],
        rows: [{ point: 0, cell: null, condition: 0 }] } };
    return { summary, callee: structuredClone(summary.key), at: { execution: execution("caller"), point: { block: 0, statement: 0 } },
      context: 0, caller: arena(), entries: [], cells: [], events: [], eventBindings: [] };
  };
  const reference = (summary, producer) => ({ owner: { kind: "summary", key: summary.key }, producer });
  const populated = () => {
    const input = simple();
    const source = input.summary;
    const at = { kind: "body", execution: source.key.execution, point: { block: 0, statement: 3 }, edge: null };
    source.arena.cells = [0, 1, 2, 3].map(id => cell(id, "callee"));
    source.arena.producers = [{ id: 0, path: null, kind: "parameter", index: 0 },
      { id: 1, path: null, kind: "parameter", index: 1 }, { id: 2, path: null, kind: "capture", index: 0 },
      { id: 3, path: null, kind: "allocation", at: { kind: "node", node: { kind: "body", value: { body: body("callee"), node: 3 } } } },
      { id: 4, path: null, kind: "cell-content", cell: 0, phase: "entry" },
      { id: 5, path: null, kind: "cell-content", cell: 0, phase: "uncontrolled" }];
    source.arena.boundProducers = source.arena.producers.map(({ id }) => ({ id, producer: id, context: 0, bindings: bindings() }));
    source.arena.origins = [origin(0), ...source.arena.producers.map(({ id }) => origin(id + 1, [id]))];
    source.arena.contexts[0] = { id: 0, receiver: null, arguments: [{ kind: "provided", origins: 1 }, { kind: "provided", origins: 2 }], captures: [{ index: 0, location: 2, cell: 2 }] };
    source.arena.boundaries = [{ id: 0, kind: "opaque-invocation", subject: 1, owner: null, bindings: bindings(), context: 0,
      at: { kind: "node", node: { kind: "body", value: { body: body("callee"), node: 4 } } }, detail: "actual unknown exchange" }];
    source.parameters = [0, 1].map(index => ({ slot: { kind: "parameter", index }, reads: { kind: "complete", paths: [] },
      writes: { kind: "complete", paths: [] } }));
    source.captures = [{ index: 0, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } }];
    source.result = 4;
    source.writes = [{ target: 0, value: 1 }, { target: 1, value: 2 }];
    source.concurrentWrites = [{ target: 0, value: 6 }];
    source.contentsOnReturn = [{ target: 1, value: 5 }];
    source.contentsOnUnwind = [{ target: 0, value: 6 }];
    source.unwinds = true;
    source.retention = [{ source: 2, at, into: { kind: "parameter", index: 1, path: null } }];
    source.callbacks = [{ kind: "known", subject: reference(source, 0), at, signature: 0, provided: 2, context: 0,
      result: 4, thrown: 0, handle: reference(source, 3), timing: "deferred", shared: [{ target: 0, value: 6 }] },
    { kind: "unknown", subject: reference(source, 1), boundary: { owner: { kind: "summary", key: source.key }, boundary: 0 },
      signatures: [0], constraint: null, invocationOnly: false }];
    source.resultCells = [{ value: 4, cell: 3, path: null }];
    source.backing = [{ at, operation: { family: "typed-location", operation: "address-of", at: { body: body("callee"), node: 7 } },
      pointer: 4, cell: 3, use: { kind: "return" } }];
    source.initialization = { cells: [0, 1], events: [{ kind: "callback", subject: reference(source, 0), exit: "return" }],
      conditions: [no(), yes(), { alternatives: [[0]] }], points: [
        { kind: "need", at, cell: 1, witness: { read: { kind: "body", value: { body: body("callee"), node: 5 } }, via: [] } },
        { kind: "return" }, { kind: "unwind" }], rows: [{ point: 0, cell: null, condition: 0 }, { point: 0, cell: 0, condition: 1 },
        { point: 1, cell: null, condition: 2 }, { point: 2, cell: null, condition: 0 }] };
    input.caller.cells = [0, 1, 2, 3, 4].map(id => cell(id, "caller"));
    input.caller.producers = [0, 1, 2, 3].map(id => ({ id, path: null, kind: "allocation",
      at: { kind: "node", node: { kind: "body", value: { body: body("caller"), node: id } } } }));
    input.caller.boundProducers = input.caller.producers.map(({ id }) => ({ id, producer: id, context: 0, bindings: bindings() }));
    input.caller.origins = [origin(0), ...input.caller.producers.map(({ id }) => origin(id + 1, [id]))];
    input.entries = [{ formal: 0, actual: 1 }, { formal: 1, actual: 2 }, { formal: 2, actual: 3 },
      { formal: 4, actual: 1 }, { formal: 5, actual: 4 }];
    input.cells = [{ kind: "cell", index: 1 }, { kind: "cell", index: 1 }, { kind: "cell", index: 2 }, { kind: "fresh", index: 3 }];
    input.events = [{ kind: "callback", subject: { owner: { kind: "body", execution: input.at.execution }, producer: 0 }, exit: "return" }];
    input.eventBindings = [{ kind: "event", index: 0 }];
    return input;
  };
  const refusal = name => ({ kind: "refused", diagnostics: [{ code: { kind: "checker", number: 1, rendered: name }, severity: "error",
    site: { kind: "none" }, source: null, evidence: [], message: name, arguments: [], related: [], fix: null }] });
  const originRefusal = refusal("origin alternatives");
  const conditionRefusal = refusal("condition alternatives");
  const limits = (maximumWork = 100000, maximumResultEntries = 100000) => ({
    account: flow.createAccount({ maximumWork, maximumResultEntries }), maximumOriginAlternatives: 100,
    maximumConditionAlternatives: 100, originRefusal, conditionRefusal });
  const complete = result => { assert.equal(result.kind, "complete"); return result.value; };

  await suite.test("summary application keeps provided absence distinct from omission", () => {
    const input = populated();
    input.caller.origins[1].includesAbsence = true;
    input.caller.contexts[0].arguments = [{ kind: "provided", origins: 1 }, { kind: "provided", origins: 2 }];
    const supplied = complete(applySummary(input, limits()));
    assert.equal(supplied.contexts[0].arguments[0].kind, "provided");
    assert.equal(supplied.contexts[0].arguments[0].origins.includesAbsence, true);
    input.caller.contexts[0].arguments[0] = { kind: "omitted" };
    assert.throws(() => applySummary(input, limits()), /omitted formal has no incoming caller value/);
    const omitted = simple();
    omitted.summary.key.execution.provided = 0;
    omitted.callee = structuredClone(omitted.summary.key);
    omitted.summary.arena.contexts[0].arguments = [{ kind: "omitted" }];
    omitted.caller.contexts[0].arguments = [{ kind: "omitted" }];
    assert.deepEqual(complete(applySummary(omitted, limits())).contexts[0].arguments, [{ kind: "omitted" }]);
  });

  await suite.test("whole summary application preserves all value, cell, exchange, event, exit and backing relations", () => {
    const input = populated();
    const before = structuredClone(input);
    const applied = complete(applySummary(input, limits()));
    assert.equal(applied.source, input.summary);
    assert.equal(applied.events, input.events);
    assert.equal(applied.subjects.length, input.summary.arena.boundProducers.length);
    assert.equal(applied.writes.length, 2);
    assert.equal(applied.writes[0].target.same.cell, 1);
    assert.equal(applied.writes[1].target.same.cell, 1);
    assert.deepEqual(applied.concurrentWrites[0].value.caller.map(row => row.producer), [3]);
    assert.deepEqual(applied.contentsOnReturn[0].value.caller.map(row => row.producer), [0]);
    assert.deepEqual(applied.contentsOnUnwind[0].value.caller.map(row => row.producer), [3]);
    assert.equal(applied.initialization[0].point.kind, "need");
    assert.deepEqual(applied.initialization[0].condition, yes());
    assert.deepEqual(applied.initialization[1].condition, { alternatives: [[0]] });
    assert.equal(applied.callbacks[0].application.context, applied.contexts[0]);
    assert.equal(applied.callbacks[0].application.context.captures[0].cell.same.cell, 2);
    assert.equal(applied.callbacks[0].application.handle.kind, "callee");
    assert.equal(applied.callbacks[1].application, null);
    assert.equal(applied.callbacks[1].source.constraint, null);
    assert.equal(applied.resultCells[0].cell.same.cell, 3);
    assert.equal(applied.backing[0].source.operation, input.summary.backing[0].operation);
    assert.equal(applied.backing[0].cell, applied.resultCells[0].cell);
    assert.equal(applied.retention[0].value.value.origins, 3);
    assert.equal(applied.retention[0].source.at, input.summary.retention[0].at);
    assert.deepEqual(input, before);
    const distinct = populated();
    distinct.cells[1] = { kind: "cell", index: 4 };
    distinct.entries[1].actual = 1;
    const separate = complete(applySummary(distinct, limits()));
    assert.deepEqual(separate.initialization[0].condition, no(), "equal bound values do not establish same storage");
    const uncertain = populated(); uncertain.cells[0] = { kind: "unproven", indices: [0, 1] };
    const may = complete(applySummary(uncertain, limits()));
    assert.deepEqual(may.writes[0].target.targets.map(row => row.cell), [0, 1]);
    assert.equal(may.writes[0].target.same, null);
    assert.deepEqual(may.initialization[0].condition, no(), "may writes never grant must credit");
    const captured = populated(); captured.cells[2] = { kind: "cell", index: 4 };
    assert.equal(complete(applySummary(captured, limits())).contexts[0].captures[0].cell.same.cell, 4,
      "capture cell binding is independent of the captured bound-value ID");
    const receiver = populated();
    receiver.summary.arena.producers[0] = { id: 0, path: null, kind: "receiver" };
    receiver.summary.arena.contexts[0].receiver = 1;
    receiver.summary.parameters[0].slot = { kind: "receiver" };
    receiver.summary.callbacks[0].handle = null;
    const withReceiver = complete(applySummary(receiver, limits()));
    assert.equal(withReceiver.parameters[0].values[0].kind, "caller");
    assert.equal(withReceiver.contexts[0].receiver, withReceiver.callbacks[0].application.context.receiver);
    assert.equal(withReceiver.callbacks[0].application.handle, null);
    const unused = simple();
    unused.summary.parameters = [{ slot: { kind: "parameter", index: 0 }, reads: { kind: "complete", paths: [] },
      writes: { kind: "complete", paths: [] } }];
    assert.deepEqual(complete(applySummary(unused, limits())).parameters[0].values, []);
    verificationStops(account => applySummary(uncertain, { ...limits(), account }));
    const repeated = populated(); repeated.cells[3] = { kind: "fresh", index: 4 };
    assert.equal(complete(applySummary(repeated, limits())).resultCells[0].cell.same.cell, 4,
      "identical creator/context syntax does not select a previous activation's cell");
  });

  await suite.test("whole application refuses malformed actual relations rather than dropping a required family", () => {
    for (const mutate of [
      value => { value.cells.pop(); }, value => { value.cells[0] = { kind: "written" }; },
      value => { value.cells[0] = { kind: "cell", index: -0 }; }, value => { value.cells[0] = { kind: "unproven", indices: [] }; },
      value => { value.cells[0] = { kind: "unproven", indices: [1, 1] }; },
      value => { value.summary.arena.cells[0].id = 1; }, value => { value.caller.cells[1].id = 0; },
      value => { value.summary.arena.contexts[0].id = 1; },
      value => { delete value.summary.arena.contexts[0].captures[0].cell; },
      value => { value.cells[2] = { kind: "written" }; },
      value => { value.summary.arena.contexts[0].captures[0].index = -0; },
      value => { value.summary.arena.contexts[0].captures = []; },
      value => { value.summary.callbacks[0].subject.owner = { kind: "body", execution: execution("caller") }; },
      value => { value.summary.callbacks[0].subject.owner = structuredClone(value.summary.callbacks[0].subject.owner);
        value.summary.callbacks[0].subject.owner.key.execution.provided = 0; },
      value => { value.summary.callbacks[0].subject.producer = 50; },
      value => { value.summary.callbacks[0].handle.producer = 50; },
      value => { value.summary.resultCells[0].cell = 50; }, value => { value.summary.backing[0].cell = 50; },
      value => { value.summary.contentsOnReturn[0].value = 50; },
      value => { value.summary.captures.push({ index: 1, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } }); },
      value => { value.summary.parameters.push({ slot: { kind: "parameter", index: 5 }, reads: { kind: "complete", paths: [0] }, writes: { kind: "complete", paths: [] } }); },
      value => { value.summary.parameters.push({ slot: { kind: "parameter", index: 5 }, reads: { kind: "open", paths: [], boundaries: [0] }, writes: { kind: "complete", paths: [] } }); },
      value => { value.summary.parameters.push({ slot: { kind: "parameter", index: 5 }, reads: { kind: "complete", paths: [] }, writes: { kind: "open", paths: [], boundaries: [0] } }); },
      value => { value.summary.parameters.push({ slot: { kind: "parameter", index: 5 }, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [0] } }); },
    ]) {
      const input = populated(); mutate(input);
      assert.throws(() => applySummary(input, limits()), TypeError);
    }
  });

  await suite.test("canonical whole Summary equality includes every published relation without pointer identity or a second schema", () => {
    const original = populated().summary;
    const account = () => limits().account;
    assert.equal(complete(summaryEquals(original, structuredClone(original), account())), true);
    const encoded = printSummary(original);
    const decoded = parseSummary(encoded);
    assert.equal(decoded.kind, "parsed");
    assert.equal(printSummary(decoded.value), encoded);
    assert.equal(complete(summaryEquals(original, decoded.value, account())), true);
    const sparse = populated().summary;
    sparse.arena.cells = new Array(1);
    assert.throws(() => printSummary(sparse), TypeError);
    for (const mutate of [
      value => { value.key.execution.provided = 1; },
      value => { value.signature = 1; },
      value => { value.arena.cells[0].occurrence.point.statement = 1; },
      value => { value.arena.cells[0].lifetimes.push({ kind: "live", execution: value.key.execution, point: { block: 0, statement: 0 }, local: 0 }); },
      value => { value.arena.boundProducers[0].bindings.selfBindings.push({ kind: "rigid", owner: definition("other") }); },
      value => { value.arena.contexts[0].captures[0].cell = 1; },
      value => { value.arena.origins[0].includesAbsence = true; },
      value => { value.arena.boundaries[0].detail = "different actual boundary"; },
      value => { value.parameters[0].reads.paths = [0]; },
      value => { value.captures[0].writes.paths = [0]; },
      value => { value.result = 1; }, value => { value.thrown = 1; },
      value => { value.writes[0].value = 2; },
      value => { value.concurrentWrites[0].target = 1; },
      value => { value.contentsOnReturn[0].value = 6; },
      value => { value.contentsOnUnwind[0].value = 5; },
      value => { value.retention[0].into.index = 0; },
      value => { value.callbacks[0].context = 1; },
      value => { value.callbacks[1].invocationOnly = true; },
      value => { value.initialization.cells.reverse(); },
      value => { value.initialization.conditions[2].alternatives = [[0], [1]]; },
      value => { value.initialization.points[0].witness.read.value.node = 6; },
      value => { value.initialization.rows[0].condition = 1; },
      value => { value.resultCells[0].cell = 2; },
      value => { value.backing[0].operation.operation = "allocate"; },
      value => { value.returns = false; }, value => { value.unwinds = false; },
      value => { value.suspends = true; }, value => { value.bindingDependent = true; },
    ]) {
      const changed = structuredClone(original); mutate(changed);
      assert.equal(complete(summaryEquals(original, changed, account())), false);
      assert.equal(complete(summaryEquals(changed, original, account())), false);
    }
    const zero = limits(0).account;
    const stopped = summaryEquals(original, original, zero);
    assert.equal(stopped, flow.accountFailure(zero));
    assert.equal(summaryEquals(null, null, zero), stopped);
    verificationStops(account => summaryEquals(simple().summary, simple().summary, account));
    const shared = limits(1).account;
    const cause = flow.refuseAccount(shared, conditionRefusal);
    assert.equal(summaryEquals(null, null, shared), cause);
    const lazy = simple().summary;
    const rows = [];
    let active = account();
    let reads = 0;
    let firstReadWork = null;
    const maximum = 100000;
    Object.defineProperty(rows, 0, { get() {
      assert.equal(flow.accountFailure(active), null, "the same original account admitted this actual row read");
      firstReadWork ??= maximum - flow.remainingWork(active);
      reads += 1;
      return cell(0, "callee");
    } });
    lazy.arena.cells = rows;
    assert.equal(complete(summaryEquals(lazy, lazy, active)), true);
    assert.equal(reads, 2);
    rows.length = 10000000;
    active = limits(firstReadWork - 1).account;
    reads = 0;
    const beforeRead = summaryEquals(lazy, lazy, active);
    assert.equal(beforeRead, flow.accountFailure(active));
    assert.equal(reads, 0, "a refused pull does not expand or read the huge later inventory");
    assert.equal(summaryEquals(null, null, active), beforeRead);
  });

  await suite.test("whole application shares one account and preserves the original first stop with no partial result", () => {
    const minimal = simple();
    const work = 35 + 2 * minimal.summary.key.execution.instance.body.length;
    assert.equal(applySummary(minimal, limits(work, 32)).kind, "complete",
      "root1 + full owner admissions6+2bodylength + value setup/rows3 + context1 + writes4 + initialization19 + result1; owner entries12 plus20");
    assert.deepEqual(applySummary(minimal, limits(work - 1, 32)), { kind: "resource-limit", dimension: "work", maximum: work - 1 });
    assert.deepEqual(applySummary(minimal, limits(work, 31)), { kind: "resource-limit", dimension: "result-entries", maximum: 31 });
    const shared = limits(2 * work - 1);
    complete(applySummary(minimal, shared));
    const stopped = applySummary(minimal, shared);
    assert.deepEqual(stopped, { kind: "resource-limit", dimension: "work", maximum: 2 * work - 1 });
    assert.equal(applySummary(null, shared), stopped);
    const first = limits(); first.maximumOriginAlternatives = 0; first.maximumConditionAlternatives = 0;
    assert.equal(applySummary(populated(), first), originRefusal);
    assert.equal(applySummary(null, first), originRefusal);
    const condition = limits(); condition.maximumConditionAlternatives = 0;
    assert.equal(applySummary(populated(), condition), conditionRefusal);
    assert.equal(applySummary(null, condition), conditionRefusal);
    const bounds = limits();
    verificationStops(account => {
      const result = applySummary(populated(), { ...bounds, account });
      if (result.kind !== "complete") assert.equal(applySummary(null, { ...bounds, account }), result);
      return result;
    });
  });
}
