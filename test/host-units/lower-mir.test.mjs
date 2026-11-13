// Unit bank of lower-mir. Every expectation is taken from the signed specification
// (/shared/tsonic-stage3/spec: low/COMPONENTS.md section 7, low/COMMON-DATA.md, inputs/WALKTHROUGH-PROGRAMS.md)
// and from the program text, and is stated beside the assertion. Inputs are complete typed bodies
// written by hand in fixtures/lower-mir/programs; no expectation is derived from an implementation.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { N } from "./fixtures/lower-mir/names.mjs";
import { T, TABLE, bodyId, def } from "./fixtures/lower-mir/typed.mjs";
import {
  at, checkedPlace, checks, chainOf, controlPoints, effects, effectsOn, entriesOf, invert, localOf, nodesOn, placeOf,
  rootLocalOf, walk, withoutFailureKinds, writesOf,
} from "./fixtures/lower-mir/observe.mjs";
import { wt1 } from "./fixtures/lower-mir/programs/wt1.mjs";
import { wt4 } from "./fixtures/lower-mir/programs/wt4.mjs";
import { wt6 } from "./fixtures/lower-mir/programs/wt6.mjs";
import { s7 } from "./fixtures/lower-mir/programs/s7.mjs";

let lowerToMir;
let deps;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "lower-mir cases require a guarded admission");
  ({ lowerToMir } = await import("../../packages/host/dist/lower-mir/index.js"));
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const interner = types.seedTypeInterner(TABLE);
  deps = {
    defs: { completionSelector: T.int32, exceptionStorage: T.unknown },
    typeOf: type => types.readType(interner, type),
    signatureOf: signature => types.readSignature(interner, signature),
    limits: { maximumRecords: 100000 },
  };
});

/** Lowers one typed body and requires an accepted result with no diagnostic (section 7 part 7: the box originates one diagnostic, the size limit). */
const lower = (program, internal = [], limits = null) => {
  const result = lowerToMir(limits === null ? deps : { ...deps, limits }, program.tir, internal);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  return result.value;
};
const labelled = (program, nodes) => { const names = invert(program.labels); return nodes.map(node => names.get(node) ?? node); };
const sourceLocal = (mir, local) => mir.locals.find(candidate => candidate.source !== null && candidate.source.local === local).id;
const fieldKey = link => link.projection !== undefined && link.projection.kind === "field" ? link.projection.member.decision.key.value : null;
const statementsOn = path => path.events.filter(item => item.statement !== null);
const indexOfEvent = (path, predicate) => path.events.findIndex(predicate);
const POLICIES = [{ bounds: "unwind", absent: "unwind" }, { bounds: "abort", absent: "abort" }];

// ---- WT-1 -----------------------------------------------------------------------------------

test("WT-1 add: a pure operation is a statement and the body has one entry", () => {
  const program = wt1().add;
  const mir = lower(program);
  // Section 7 part 8, WT-1: "`add` is a statement". R2: a pure decision is a statement between control points.
  const path = walk(mir);
  assert.deepEqual(effectsOn(path), []);
  const sum = statementsOn(path).filter(item => item.kind === "assign" && item.record.value.kind === "binary");
  assert.equal(sum.length, 1);
  assert.equal(sum[0].node, program.at("left+right"));
  assert.equal(path.end, "return");
  // Section 7 part 8, WT-1: "one entry each". R7: both fixed arguments are required, so only the full count is admissible.
  assert.deepEqual(entriesOf(mir), [{ provided: 2, block: 0 }]);
});

test("WT-1 total: the call is one control point with two supplied arguments", () => {
  const program = wt1().total;
  const mir = lower(program);
  // Section 7 part 8, WT-1: "the call a control point". R5: the effect appears once and names its source occurrence.
  const calls = effects(mir).filter(point => point.kind === "call");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].node, program.at("add(20,22)"));
  assert.deepEqual(calls[0].record.arguments.map(argument => argument.kind), ["value", "value"]);
  assert.deepEqual(checks(mir), []);
  assert.deepEqual(entriesOf(mir), [{ provided: 0, block: 0 }]);
});

test("WT-1 count: the loop body runs once per true condition and the body returns after a false one", () => {
  const program = wt1().count;
  const mir = lower(program);
  // Program text: `while (current < limit) current = current + 1;`. R5: authored effects execute once on each path that reaches them.
  let remaining = 2;
  const path = walk(mir, { decide: point => point.kind === "switch" ? (remaining-- > 0) : "normal" });
  const increments = statementsOn(path).filter(item => item.kind === "assign" && item.node === program.at("current+1"));
  assert.equal(increments.length, 2);
  assert.equal(path.end, "return");
  // No operation in this body can fail or run user code: no control point other than branches and the return (R2).
  assert.deepEqual(effects(mir), []);
});

// ---- WT-6 -----------------------------------------------------------------------------------

for (const policy of POLICIES) {
  const failing = policy.bounds === "abort" ? "abort" : "escape";

  test(`WT-6 order (${policy.bounds}): effects and checks execute once, in authored order`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // Section 7 part 8, WT-6: "`i()` before `f()`; the index check of `a[i()] += f()` at the read and, because a call
    // stands between that read and the store into a carrier whose extent can change, a second control point at the
    // store"; "`opt` is read and tested once, before the right-hand side"; "`return` through `finally`".
    const path = walk(mir);
    assert.deepEqual(labelled(program, nodesOn(path)),
      ["i()", "@target", "f()#1", "@target", "f()#2", "@bang", "a[0]#read", "a[0]#write"]);
    assert.equal(path.end, "return");
    // R5: no effect occurrence is emitted twice (graph law 9). The two records at @target are the checks of the
    // read and of the store.
    for (const label of ["i()", "f()#1", "f()#2"]) assert.equal(at(mir, program.at(label), "call").length, 1);
    assert.equal(checks(mir, program.at("@target")).length, 2);
    assert.equal(checks(mir, program.at("@bang")).length, 1);
  });

  test(`WT-6 order (${policy.bounds}): both checks of a[i()] use the array and index evaluated once`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // Section 7 part 8, WT-6: "a second control point at the store over the same evaluated array and index". R11:
    // "receiver and index are evaluated once; a reference receiver is captured where it is authored". Graph law 4.
    const [first, second] = checks(mir, program.at("@target")).map(point => checkedPlace(mir, point));
    assert.equal(first.projection, "index");
    assert.equal(second.parentRoot, first.parentRoot);
    assert.deepEqual(second.index, first.index);
    assert.equal(first.index.kind, "place");
    assert.equal(writesOf(mir, rootLocalOf(mir, first.index.place)), 1);
    assert.ok(writesOf(mir, first.parentRoot) <= 1);
  });

  test(`WT-6 order (${policy.bounds}): each check carries the selected failure kind`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // R1: a check is a control point "with its failure kind: unwinds to a named handler or out of the body, or ends the
    // process". WT-6: "the MIR differs only in the failure edge of the same test". The read of a[0] stands inside
    // `try … finally`, so an unwinding failure there enters the cleanup; the other checks stand outside any handler.
    const kinds = Object.fromEntries(["@target", "@bang", "a[0]#read", "a[0]#write"].map(label =>
      [label, checks(mir, program.at(label)).map(point => point.failure)]));
    assert.deepEqual(kinds, {
      "@target": [failing, failing], "@bang": [failing],
      "a[0]#read": [policy.bounds === "abort" ? "abort" : "handler"], "a[0]#write": [failing],
    });
  });

  test(`WT-6 order (${policy.bounds}): o.inner is read before f() and the store goes into that object`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // Section 7 part 8, WT-6: "`o.inner` read before `f()` and the store into that object". R11: a reference receiver
    // is captured where it is authored.
    const path = walk(mir);
    const readInner = indexOfEvent(path, item => item.statement !== null && item.kind === "assign" && item.record.value.kind === "use" &&
      item.record.value.operand.kind === "place" && fieldKey(chainOf(mir, item.record.value.operand.place).at(-1)) === "inner");
    const callF = indexOfEvent(path, item => item.statement === null && item.node === program.at("f()#2"));
    const storeX = indexOfEvent(path, item => item.statement !== null && item.kind === "assign" && fieldKey(chainOf(mir, item.record.place).at(-1)) === "x");
    assert.ok(readInner !== -1 && readInner < callF && callF < storeX);
    const captured = rootLocalOf(mir, path.events[readInner].record.place);
    assert.equal(rootLocalOf(mir, path.events[storeX].record.place), captured);
    assert.equal(writesOf(mir, captured), 1);
    assert.equal(chainOf(mir, path.events[storeX].record.place).length, 2);
  });

  test(`WT-6 order (${policy.bounds}): opt is tested once before the right-hand side and is not read again`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // Section 7 part 8, WT-6: "`opt` is read and tested once, before the right-hand side. Its type is held by reference,
    // so the receiver is that object: the store after the assignment goes into it, there is no second absence test …
    // The variable `opt` is not read again to stand for the captured object."
    const path = walk(mir);
    const optLocal = sourceLocal(mir, 3);
    const test = indexOfEvent(path, item => item.statement === null && item.node === program.at("@bang"));
    const assignment = indexOfEvent(path, item => item.statement !== null && item.kind === "assign" && item.node === program.at("opt=undefined"));
    const store = path.events.findLastIndex(item => item.statement !== null && item.kind === "assign" && fieldKey(chainOf(mir, item.record.place).at(-1)) === "count");
    assert.ok(test !== -1 && test < assignment && assignment < store);
    assert.equal(rootLocalOf(mir, path.events[assignment].record.place), optLocal);
    assert.notEqual(rootLocalOf(mir, path.events[store].record.place), optLocal);
    assert.equal(writesOf(mir, rootLocalOf(mir, path.events[store].record.place)), 1);
  });

  test(`WT-6 order (${policy.bounds}): a failing read inside try runs finally only when the failure unwinds`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // R6: every abnormal exit passes through each enclosing cleanup once. R1 and COMMON-DATA §10: a failure that ends
    // the process has no edge; no handler or cleanup runs after it.
    const path = walk(mir, { decide: point => point.node === program.at("a[0]#read") && point.kind === N.resolvePlace ? "unwind" : "normal" });
    const tested = labelled(program, nodesOn(path, new Set([N.resolvePlace]))).slice(-2);
    if (policy.bounds === "abort") { assert.equal(path.end, "abort"); assert.equal(tested.at(-1), "a[0]#read"); }
    else { assert.equal(path.end, "unwind"); assert.deepEqual(tested, ["a[0]#read", "a[0]#write"]); }
  });

  test(`WT-6 orderGrow and orderFixed (${policy.bounds}): a second control point only where the extent can change`, () => {
    const programs = wt6(policy);
    const grow = lower(programs.orderGrow);
    const fixed = lower(programs.orderFixed);
    // Section 7 part 8, WT-6: "in `orderGrow` the callee appends to the same array … in `orderFixed` the extent cannot
    // change and no second control point is lowered". LowerMir reads no summary: the structure decides.
    assert.deepEqual(labelled(programs.orderGrow, nodesOn(walk(grow))), ["i()", "@target", "grow(a)", "@target", "a[0]"]);
    assert.deepEqual(labelled(programs.orderFixed, nodesOn(walk(fixed))), ["i()", "@target", "f()"]);
    assert.equal(checks(fixed, programs.orderFixed.at("@target")).length, 1);
    // R11: "value storage is addressed in place and never copied to stand for the destination". The fixed array is the
    // parameter's own storage: the checked place is rooted at that local.
    assert.equal(checkedPlace(fixed, checks(fixed)[0]).parentRoot, sourceLocal(fixed, 0));
  });
}

test("WT-6: the two failure policies give the same graph except for the failure kind of the same checks", () => {
  // WALKTHROUGH-PROGRAMS WT-6: "the MIR differs only in the failure edge of the same test (K-3212 point 3)".
  const [unwinding, aborting] = POLICIES.map(policy => wt6(policy));
  for (const name of ["orderGrow", "orderFixed"])
    assert.deepEqual(withoutFailureKinds(lower(aborting[name])), withoutFailureKinds(lower(unwinding[name])));
  // `order` has a cleanup that an unwinding failure enters and a process-ending failure does not; the path that
  // completes normally is the same under both.
  const orders = [unwinding, aborting].map(programs => walk(lower(programs.order)).events.map(item => [item.kind, item.node]));
  assert.deepEqual(orders[1], orders[0]);
});

// ---- WT-4 -----------------------------------------------------------------------------------

const internalCalls = path => path.events.filter(item => item.statement === null && item.kind === "call" && item.record.callee.kind === N.bodyCallee);

test("WT-4 f: three entries by supplied count; a default runs only in the entry that omits its parameter", () => {
  const programs = wt4();
  const mir = lower(programs.f, programs.internal);
  // R7 and section 7 part 8, WT-4: "`f` has three entries". Graph law 7: entries are ordered by supplied count; the
  // fully supplied entry is the body's start and runs no default.
  assert.deepEqual(entriesOf(mir).map(entry => entry.provided), [2, 1, 0]);
  assert.equal(entriesOf(mir)[0].block, 0);
  const defaults = entry => internalCalls(walk(mir, { entry })).map(item => item.record.callee.instance.body);
  // WT-4: "the default body runs only for an omitted argument"; "a default that reads an earlier parameter": x's
  // default runs before y's.
  assert.deepEqual(defaults(0), []);
  assert.deepEqual(defaults(1), [programs.Y_DEFAULT]);
  assert.deepEqual(defaults(2), [programs.X_DEFAULT, programs.Y_DEFAULT]);
  // R8: an initializer body executes "as an explicit execution of that body instance", into the parameter it initializes.
  const [xDefault, yDefault] = internalCalls(walk(mir, { entry: 2 }));
  assert.equal(rootLocalOf(mir, xDefault.record.destination), sourceLocal(mir, 0));
  assert.equal(rootLocalOf(mir, yDefault.record.destination), sourceLocal(mir, 1));
  // WT-4: "the default body as a callee with captures": y's default reads the already-bound x.
  assert.deepEqual(yDefault.record.callee.captures.map(capture => capture.local), [{ body: bodyId("f"), local: 0 }]);
  assert.equal(rootLocalOf(mir, yDefault.record.callee.captures[0].place), sourceLocal(mir, 0));
  // Every path ends in the one shared body: each entry returns.
  for (const entry of [0, 1, 2]) assert.equal(walk(mir, { entry }).end, "return");
});

test("WT-4 x default: next() is one call in the default body, and f's own graph does not call it", () => {
  const programs = wt4();
  // WT-4: "`next()` executes only in the entry that omits `x`": the call belongs to the default body, which only
  // that entry executes.
  const inDefault = effects(lower(programs.xDefault)).filter(point => point.kind === "call");
  assert.equal(inDefault.length, 1);
  assert.equal(inDefault[0].node, programs.xDefault.at("next()"));
  const inF = effects(lower(programs.f, programs.internal)).filter(point => point.kind === "call" && point.record.callee.kind !== N.bodyCallee);
  assert.deepEqual(inF, []);
});

test("WT-4 calls: an omitted argument is represented as omitted; a supplied absence is a value", () => {
  const programs = wt4();
  const mir = lower(programs.calls);
  // R7: "an omitted argument is represented as omitted at the call; a default runs in the callee's entry". Section 7
  // part 8: "`f()` passes two omitted arguments, `f(null)` and `f(undefined)` a supplied absence and one omitted".
  const shape = label => at(mir, programs.calls.at(label), "call").map(point => point.record.arguments.map(argument => argument.kind));
  assert.deepEqual(shape("f()"), [[N.omitted, N.omitted]]);
  assert.deepEqual(shape("f(null)"), [["value", N.omitted]]);
  assert.deepEqual(shape("f(undefined)"), [["value", N.omitted]]);
  assert.deepEqual(shape("f(1)"), [["value", N.omitted]]);
  assert.deepEqual(shape("f(1,2)"), [["value", "value"]]);
  // No default executes at a call site.
  assert.deepEqual(internalCalls(walk(mir)), []);
  // R5: the five calls execute in authored order.
  assert.deepEqual(labelled(programs.calls, nodesOn(walk(mir))), ["f()", "f(null)", "f(undefined)", "f(1)", "f(1,2)"]);
});

// ---- S-7 ------------------------------------------------------------------------------------

for (const order of ["fields-first", "base-first"]) {
  test(`S-7 (${order}): construction runs in the order of the ConstructionPlan, on one object`, () => {
    const programs = s7(order);
    const mir = lower(programs.program, programs.internal);
    // R9: "the object exists, then base construction, field initializers and constructor code run in the order the
    // typed body's ConstructionPlan gives (MR-16)". S-7 has one oracle per value of the selected order (MR-15).
    const steps = walk(mir).events.filter(item => item.statement === null && item.kind === "call");
    const names = steps.map(item => item.record.callee.kind === N.bodyCallee ? item.record.callee.instance.body
      : item.record.callee.resolution.decision.advertised.declaration);
    const baseConstructor = def("Base.constructor");
    assert.deepEqual(names, order === "fields-first" ? [programs.V_INIT, programs.SEEN_INIT, baseConstructor]
      : [baseConstructor, programs.V_INIT, programs.SEEN_INIT]);
    // One object: each field initializer writes a field of the object the base constructor receives.
    const base = steps.find(item => item.record.callee.kind !== N.bodyCallee);
    assert.equal(base.record.receiver.kind, "place");
    const object = rootLocalOf(mir, base.record.receiver.place);
    for (const item of steps.filter(candidate => candidate.record.callee.kind === N.bodyCallee)) {
      const chain = chainOf(mir, item.record.destination);
      assert.equal(chain[0].root.local, object);
      assert.equal(chain.length, 2);
    }
    assert.deepEqual(steps.filter(item => item.record.callee.kind === N.bodyCallee).map(item => fieldKey(chainOf(mir, item.record.destination).at(-1))), ["v", "seen"]);
  });
}

test("S-7: static initializer and static block run at the class declaration in member order", () => {
  const programs = s7("fields-first");
  const mir = lower(programs.moduleBody, programs.moduleInternal);
  // R8 and section 5 part 1 rows 5 and 6: static field initializers and static blocks run "at the class declaration's
  // occurrence in its enclosing body, in member order". S-7: "The static initializer and the static block run in
  // authored order".
  const steps = internalCalls(walk(mir));
  assert.deepEqual(steps.map(item => item.record.callee.instance.body), [programs.COUNT_INIT, programs.STATIC_BLOCK]);
  assert.deepEqual(placeOf(mir, steps[0].record.destination).base, { kind: "static", definition: def("Derived.count") });
  assert.equal(steps[1].record.destination, null);
});
