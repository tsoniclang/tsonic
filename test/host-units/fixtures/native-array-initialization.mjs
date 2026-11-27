import assert from "node:assert/strict";
import { loadFrontFixture } from "./front/checked-module.mjs";
import { nativeInt32Input } from "./native-int32-input.mjs";

const rangedSource = `
  function later(value: Native): Native { return value; }
  export function ranged(xs: Native[], value: Native): Native {
    try { return [0, ...xs, later(value)].length; }
    finally { later(value); }
  }
`;

async function selectedArrayInput(fixture, source) {
  const input = await nativeInt32Input(fixture, source, true);
  const original = input.snapshot.nativeFacts;
  const selectedNativeFacts = { ...original, arrayConstruction: { kind: "exact-length", extentFailure: "abort", rangeCopy: "contiguous" },
    arrayExtents: original.arrayExtents.map(row => row.carrier === "array" ? { ...row, result: "int32" } : row) };
  return { ...input, snapshot: { ...input.snapshot, nativeFacts: selectedNativeFacts } };
}

export async function nativeArrayInitialization() {
  const fixture = await loadFrontFixture();
  const { createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { verifyMir } = await import("../../../packages/host/dist/ir-mir/index.js");
  const { instanceKey, internType, viewTypes } = await import("../../../packages/host/dist/ir-types/index.js");
  const { lowerToMir } = await import("../../../packages/host/dist/lower-mir/index.js");
  const { lowerMirDeps, mirVerificationContext } = await import("../../../packages/host/dist/pipeline/lower-mir-step.js");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../../packages/host/dist/pipeline/typed-barrier.js");
  const input = await selectedArrayInput(fixture, rangedSource + `
    export function plain(value: Native): Native { const values: Native[] = [later(value)]; return values.length; }
    export function empty(): Native { const values: Native[] = []; return values.length; }
  `);
  const selectedNativeFacts = input.snapshot.nativeFacts;
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok", JSON.stringify(checked.diagnostics));
  const typed = typeSourceBarrier(input, checked.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const ready = typed.value;
  const interner = checked.value.types;
  const defs = { completionSelector: internType(interner, { kind: "primitive", primitive: "int32" }),
    exceptionStorage: internType(interner, { kind: "intrinsic", intrinsic: "unknown" }) };
  const run = { selectedNativeFacts, interner, table: viewTypes(interner), defs, lowering: input.limits.lowering,
    verification: input.limits.mirVerification, declarationOf: ready.declarationOf,
    bodyOwner: body => fixture.ids.decodeBodyId(body).value.owner, bodyOf: instance => ready.bodies.get(instanceKey(instance)) ?? null };
  const selectedBodies = [...ready.bodies.values()].filter(row => row.bindings.kind === "instantiated" && row.root.kind === "Block");
  const ranged = selectedBodies.find(row => row.root.statements.nodes[0]?.kind === "TryStatement");
  const plain = [...ready.bodies.values()].find(row => row.bindings.kind === "instantiated"
    && row.root.kind === "ArrayLiteralExpression" && row.root.elements.nodes.length === 1);
  const empty = [...ready.bodies.values()].find(row => row.bindings.kind === "instantiated"
    && row.root.kind === "ArrayLiteralExpression" && row.root.elements.nodes.length === 0);
  const lower = (tir, maximumRecords = input.limits.lowering.maximumRecords) => {
    assert.ok(tir);
    const key = instanceKey({ body: tir.body, bindings: tir.bindings });
    const entries = ready.required.provided.get(key);
    assert.ok(entries);
    const unit = { request: { query: "mirBody", key }, position: { kind: "result" } };
    return lowerToMir(lowerMirDeps({ ...run, lowering: { maximumRecords } }, unit), tir, [], entries);
  };
  const verify = (tir, body, maximumWork = input.limits.mirVerification.maximumWork) => {
    const entries = ready.required.provided.get(instanceKey({ body: tir.body, bindings: tir.bindings }));
    return verifyMir(body, mirVerificationContext({ ...run, verification: { maximumWork } }, tir, entries));
  };
  return { ranged, plain, empty, lower, verify };
}

export async function checkNativeArrayFacts() {
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const input = await selectedArrayInput(await loadFrontFixture(), rangedSource);
  const answer = analyzeHostProgram(input);
  assert.equal(answer.kind, "ok", JSON.stringify(answer.diagnostics));
  const chapter = answer.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = chapter.bodies.find(row => row.kind === "selected" && row.mir.blocks.some(block => block.terminator.kind === "array-start"));
  assert.ok(selected);
  const start = selected.mir.blocks.find(block => block.terminator.kind === "array-start");
  const completed = selected.mir.blocks.flatMap(block => block.statements).find(row => row.kind === "array-finish");
  assert.equal(completed.start, start.id);
  const [facts] = selected.facts;
  const allocations = facts.arena.producers.filter(producer => producer.kind === "allocation");
  assert.equal(allocations.length, 1);
  assert.deepEqual(allocations[0].at, { kind: "node", node: { kind: "body", value: start.terminator.tir } });
  const bound = facts.arena.boundProducers.find(row => row.producer === allocations[0].id);
  const written = facts.origins.writes.find(row => row.node === completed.tir.node && row.operation === "initialization");
  assert.ok(written);
  assert.deepEqual(facts.arena.origins[written.values[0].origins].producers, [bound.id]);
  const summary = answer.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === selected.tir.body);
  assert.ok(summary.arena.boundProducers.some(row => row.producer === allocations[0].id));
  assert.equal(summary.unwinds, true);
}

export async function checkPlacedArrayReturn() {
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const input = await selectedArrayInput(await loadFrontFixture(), `
    function pair(): [Native, Native] { return [1, 2]; }
    export function s1(record: { a: Native; b?: Native }, xs: Native[]): Native {
      const [p, q] = pair();
      const { a, b = 3 } = record;
      const all = [0, ...xs, p];
      return a + b + p + q + all.length;
    }
  `);
  const before = input.snapshot.nativeFacts;
  const nativeFacts = { ...before, integerOverflow: [
    { carrier: "int32", operation: "add", result: "int32", law: "wrap" }, ...before.integerOverflow,
  ] };
  const answer = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } });
  assert.equal(answer.kind, "ok", JSON.stringify(answer.diagnostics));
  const chapter = answer.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = chapter.bodies.filter(row => row.kind === "selected");
  const initializer = selected.find(row => row.tir.root.kind === "ArrayLiteralExpression" && row.tir.root.elements.nodes.length === 3);
  assert.ok(initializer);
  const stage = initializer.mir.blocks.find(block => block.terminator.kind === "array-start");
  assert.ok(stage);
  const inside = initializer.facts.flatMap(row => row.arena.producers).filter(row => row.kind === "allocation");
  assert.equal(inside.length, 1);
  assert.deepEqual(inside[0].at.node.value, stage.terminator.tir);
  const application = selected.flatMap(row => row.mir.blocks.map(block => ({ row, block }))).find(({ block }) =>
    block.terminator.kind === "call" && block.terminator.callee.kind === "body"
    && block.terminator.callee.instance.body === initializer.tir.body);
  assert.ok(application);
  const [caller] = application.row.facts;
  assert.equal(caller.arena.producers.some(row => row.kind === "allocation"), false);
  const returned = caller.arena.producers.find(row => row.kind === "call-result" && row.at.node === application.block.terminator.tir.node);
  assert.ok(returned);
  assert.deepEqual(returned.at, application.block.terminator.tir);
  assert.deepEqual(returned.callee, { kind: "direct", definition: initializer.tir.owner });
  const bound = caller.arena.boundProducers.find(row => row.producer === returned.id);
  const store = caller.origins.writes.find(row => row.point.block === application.block.id && row.point.statement === null);
  assert.ok(store);
  assert.deepEqual(caller.arena.origins[store.values[0].origins].producers, [bound.id]);
}

export async function checkNativeArrayAlternatives() {
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { arrayReturnSource } = await import("../../../packages/host/dist/analyses/body/array-results.js");
  const { accountFailure, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const input = await selectedArrayInput(await loadFrontFixture(), `
    function make(xs: Native[], value: Native, borrow: boolean): Native[] {
      if (borrow) return xs;
      const fresh: Native[] = [...xs, value];
      return fresh;
    }
    export function mixed(xs: Native[], value: Native, borrow: boolean): Native {
      const result = make(xs, value, borrow);
      return result.length;
    }
  `);
  const answer = analyzeHostProgram(input);
  assert.equal(answer.kind, "ok", JSON.stringify(answer.diagnostics));
  const chapter = answer.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = chapter.bodies.filter(row => row.kind === "selected");
  const initializer = selected.find(row => row.tir.root.kind === "CallExpression");
  assert.ok(initializer);
  const call = initializer.mir.blocks.find(row => row.terminator.kind === "call").terminator;
  const signature = call.callee.resolution.decision.api.declaration;
  const chosen = selected.find(row => row.tir.owner === signature);
  assert.ok(chosen);
  const summary = answer.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === chosen.tir.body);
  const [facts] = initializer.facts;
  const outcome = answer.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === initializer.tir.body);
  const result = outcome.arena.origins[outcome.result];
  assert.equal(result.producers.length, 2);
  const kinds = result.producers.map(bound => {
    const producer = facts.arena.producers[facts.arena.boundProducers[bound].producer];
    return producer.kind;
  });
  assert.deepEqual(kinds, ["capture", "call-result"]);
  assert.equal(result.includesAbsence, false);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let exact = null;
    for (let cap = 0; cap < 1000; cap += 1) {
      const account = createAccount({ ...input.limits.dataflow, [dimension]: cap });
      const result = arrayReturnSource({ account }, call, summary);
      if (result.kind !== "complete") {
        assert.equal(result === accountFailure(account), true);
        continue;
      }
      assert.equal(result.value.summary === summary, true);
      assert.equal(result.value.declaration, signature);
      const [created] = result.value.origins;
      assert.equal(result.value.origins.size, 1);
      assert.equal(summary.arena.producers[summary.arena.boundProducers[created].producer].kind, "call-result");
      exact = cap;
      break;
    }
    assert.ok(exact > 0);
  }
}

export async function checkNativeArrayLowering() {
  const { ranged, plain, empty, lower, verify } = await nativeArrayInitialization();
  for (const tir of [ranged, plain, empty]) {
    const lowering = lower(tir);
    assert.equal(lowering.kind, "ok", JSON.stringify(lowering.diagnostics));
    const body = lowering.value;
    assert.deepEqual(verify(tir, body), { kind: "complete", violations: [] });
    const starts = body.blocks.filter(block => block.terminator.kind === "array-start");
    assert.equal(starts.length, 1);
    const [block] = starts;
    const start = block.terminator;
    const continuation = body.blocks[start.next];
    const place = body.places[start.place];
    assert.equal(place.base.kind, "local");
    assert.equal(body.locals[place.base.local].role.kind, "temporary");
    const statements = body.blocks.flatMap(row => row.statements);
    assert.equal(statements.some(row => row.kind === "storage-live" && row.local === place.base.local), false);
    const rows = statements.filter(row => "start" in row);
    assert.equal(rows.every(row => row.start === block.id), true);
    assert.equal(rows.filter(row => row.kind === "array-finish").length, 1);
    if (tir === ranged) {
      const array = tir.root.statements.nodes[0].tryBlock.statements.nodes[0].expression.expression;
      const [prefix, spread, tail] = array.elements.nodes;
      assert.equal(start.range.kind, "place");
      assert.equal(start.extentFailure.kind, "abort");
      assert.equal(start.allocationFailure.kind, "carry");
      assert.deepEqual(continuation.statements.slice(0, 2).map(row => [row.kind, row.part, row.tir.node]),
        [["array-element", 0, prefix.id], ["array-range", 1, spread.expression.id]]);
      assert.equal(continuation.terminator.kind, "call");
      assert.equal(continuation.terminator.tir.node, tail.id);
      assert.deepEqual(body.blocks[continuation.terminator.next].statements.slice(0, 2).map(row => [row.kind, row.tir.node]),
        [["array-element", tail.id], ["array-finish", array.id]]);
    } else if (tir === plain) {
      assert.equal(start.range, null);
      assert.equal(continuation.terminator.kind, "call");
      assert.equal(continuation.statements.some(row => row.kind === "array-element"), false);
      assert.deepEqual(body.blocks[continuation.terminator.next].statements.slice(0, 2).map(row => row.kind), ["array-element", "array-finish"]);
    } else {
      assert.equal(start.range, null);
      assert.deepEqual(rows.map(row => row.kind), ["array-finish"]);
    }
    let exact = 0;
    while (exact < 500 && lower(tir, exact).kind === "refused") {
      const stopped = lower(tir, exact);
      assert.equal(Object.hasOwn(stopped, "value"), false);
      exact += 1;
    }
    assert.ok(exact < 500);
    assert.deepEqual(lower(tir, exact), lowering);
  }
}

export async function checkNativeArrayVerification() {
  const { ranged, lower, verify } = await nativeArrayInitialization();
  const { parseMir, printMir } = await import("../../../packages/host/dist/ir-mir/index.js");
  const lowering = lower(ranged);
  assert.equal(lowering.kind, "ok", JSON.stringify(lowering.diagnostics));
  const { value: body } = lowering;
  const block = body.blocks.find(row => row.terminator.kind === "array-start");
  const finish = body.blocks.find(row => row.statements.some(statement => statement.kind === "array-finish"));
  const prefix = body.blocks[block.terminator.next];
  const original = printMir(body);
  const decoded = parseMir(original);
  assert.equal(decoded.kind, "parsed");
  assert.equal(printMir(decoded.value), original);
  assert.deepEqual(verify(ranged, decoded.value), { kind: "complete", violations: [] });
  const reject = (mutate, reason) => {
    const candidate = structuredClone(body);
    mutate(candidate);
    const result = verify(ranged, candidate);
    assert.equal(result.kind, "complete");
    assert.equal(result.violations.some(row => row.rule === "array-initialization-exact"
      && row.detail[0].value === reason), true, JSON.stringify(result.violations));
  };
  reject(candidate => { candidate.blocks[block.id].terminator.range = null; }, "range");
  reject(candidate => { candidate.blocks[block.id].terminator.extentFailure = { kind: "none" }; }, "failure");
  reject(candidate => { candidate.blocks[prefix.id].statements.reverse(); }, "range-prefix");
  reject(candidate => {
    const last = candidate.blocks[finish.id].statements.findIndex(row => row.kind === "array-element" && row.part === 2);
    assert.ok(last >= 0);
    candidate.blocks[finish.id].statements.splice(last, 1);
  }, "incomplete");
  reject(candidate => {
    const start = candidate.blocks[block.id].terminator;
    const local = candidate.places[start.place].base.local;
    candidate.blocks[finish.id].statements.unshift({ kind: "storage-live", origin: start.origin, tir: start.tir, local });
  }, "ordinary-marker");
  const partial = structuredClone(body);
  const start = partial.blocks[block.id].terminator;
  const scalar = partial.blocks[prefix.id].statements[0];
  scalar.operand = { kind: "place", place: start.place };
  const read = verify(ranged, partial);
  assert.equal(read.kind, "complete");
  assert.equal(read.violations.some(row => row.rule === "storage-live-before-use"), true);
  assert.equal(verify(ranged, body, 0).kind, "resource-limit");
}
