// Unit bank of lower-mir. Every expectation is taken from the signed specification
// (/shared/tsonic-stage3/spec: low/COMPONENTS.md section 7, low/COMMON-DATA.md, inputs/WALKTHROUGH-PROGRAMS.md)
// and from the program text, and is stated beside the assertion. Inputs are complete typed bodies
// written by hand in fixtures/lower-mir/programs; no expectation is derived from an implementation.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { T, TABLE, bodyId, def } from "./fixtures/lower-mir/typed.mjs";
import {
  argumentKindsOf, at, blocksWithStatementAt, branchesOn, calleeNameOf, capturedLocalsOf, capturedRootsOf, checkedPlace, checks,
  controlPoints, createsClosure, destinationBaseOf, destinationChainOf, destinationFieldOf, destinationRootOf, edgesOf, effects,
  effectsOn, internalCallsOn, invert, isCall, isInternalCall, nodesOn, operationKindOf, operationName, providedCountsOf, readsField,
  receiverRootOf, rootLocalOf, storedChainLengthOf, storedRootOf, storesField, valueKindOf, walk, withoutFailureKinds, writesOf,
} from "./fixtures/lower-mir/observe.mjs";
import { wt1 } from "./fixtures/lower-mir/programs/wt1.mjs";
import { wt4 } from "./fixtures/lower-mir/programs/wt4.mjs";
import { wt6 } from "./fixtures/lower-mir/programs/wt6.mjs";
import { s7 } from "./fixtures/lower-mir/programs/s7.mjs";
import { s2, s3, s6 } from "./fixtures/lower-mir/programs/cleanup.mjs";
import { s1, wt5, wt8, wt9, wt10, wt11 } from "./fixtures/lower-mir/programs/more.mjs";

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
  const sum = statementsOn(path).filter(item => valueKindOf(item) === "binary");
  assert.equal(sum.length, 1);
  assert.equal(sum[0].node, program.at("left+right"));
  assert.equal(path.end, "return");
  // Section 7 part 8, WT-1: "one entry each". R7: both fixed arguments are required, so only the full count is admissible.
  assert.deepEqual(providedCountsOf(mir), [2]);
});

test("WT-1 total: the call is one control point with two supplied arguments", () => {
  const program = wt1().total;
  const mir = lower(program);
  // Section 7 part 8, WT-1: "the call a control point". R5: the effect appears once and names its source occurrence.
  const calls = effects(mir).filter(point => point.kind === "call");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].node, program.at("add(20,22)"));
  assert.deepEqual(argumentKindsOf(calls[0]), ["value", "value"]);
  assert.deepEqual(checks(mir), []);
  assert.deepEqual(providedCountsOf(mir), [0]);
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
    const readInner = indexOfEvent(path, item => readsField(mir, item, "inner"));
    const callF = indexOfEvent(path, item => item.statement === null && item.node === program.at("f()#2"));
    const storeX = indexOfEvent(path, item => storesField(mir, item, "x"));
    assert.ok(readInner !== -1 && readInner < callF && callF < storeX);
    const captured = storedRootOf(mir, path.events[readInner]);
    assert.equal(storedRootOf(mir, path.events[storeX]), captured);
    assert.equal(writesOf(mir, captured), 1);
    assert.equal(storedChainLengthOf(mir, path.events[storeX]), 2);
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
    const store = path.events.findLastIndex(item => storesField(mir, item, "count"));
    assert.ok(test !== -1 && test < assignment && assignment < store);
    assert.equal(storedRootOf(mir, path.events[assignment]), optLocal);
    assert.notEqual(storedRootOf(mir, path.events[store]), optLocal);
    assert.equal(writesOf(mir, storedRootOf(mir, path.events[store])), 1);
  });

  test(`WT-6 order (${policy.bounds}): a failing read inside try runs finally only when the failure unwinds`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // R6: every abnormal exit passes through each enclosing cleanup once. R1 and COMMON-DATA §10: a failure that ends
    // the process has no edge; no handler or cleanup runs after it.
    const path = walk(mir, { decide: point => point.node === program.at("a[0]#read") && point.kind === "check" ? "unwind" : "normal" });
    const tested = labelled(program, nodesOn(path, new Set(["check"]))).slice(-2);
    if (policy.bounds === "abort") { assert.equal(path.end, "abort"); assert.equal(tested.at(-1), "a[0]#read"); }
    else { assert.equal(path.end, "unwind"); assert.deepEqual(tested, ["a[0]#read", "a[0]#write"]); }
  });

  // Section 7 part 8, WT-6: "in `orderGrow` the callee appends to the same array … in `orderFixed` the extent cannot change
  // and no second control point is lowered". LowerMir reads no summary. Whether the checked extent can change must be a
  // fact of the access decision; its name and carrier are with Codex (C-3181; R2 K-1). The three inputs below differ
  // in the parent's type and the receiver mode only, so these cases state their results and wait for that field.
  const WAITS_EXTENT = { todo: "waits for C-3181: the decision field that says whether the checked extent can change" };

  test(`WT-6 orderGrow (${policy.bounds}): a call between the read and the store over a growable carrier: a second control point`, WAITS_EXTENT, () => {
    const program = wt6(policy).orderGrow;
    const mir = lower(program);
    assert.deepEqual(labelled(program, nodesOn(walk(mir))), ["i()", "@target", "grow(a)", "@target", "a[0]"]);
  });

  test(`WT-6 orderFixed (${policy.bounds}): a fixed extent held in place: no second control point`, WAITS_EXTENT, () => {
    const program = wt6(policy).orderFixed;
    const mir = lower(program);
    assert.deepEqual(labelled(program, nodesOn(walk(mir))), ["i()", "@target", "f()"]);
    assert.equal(checks(mir, program.at("@target")).length, 1);
    // R11: "value storage is addressed in place and never copied to stand for the destination". The fixed array is the
    // parameter's own storage: the checked place is rooted at that local.
    assert.equal(checkedPlace(mir, checks(mir)[0]).parentRoot, sourceLocal(mir, 0));
  });

  test(`WT-6 orderFixedByReference (${policy.bounds}): a fixed extent held by reference: no second control point`, WAITS_EXTENT, () => {
    const program = wt6(policy).orderFixedByReference;
    const mir = lower(program);
    // The receiver mode is "by reference" and the extent is fixed: reference does not mean growable.
    assert.deepEqual(labelled(program, nodesOn(walk(mir))), ["i()", "@target", "f()"]);
    assert.equal(checks(mir, program.at("@target")).length, 1);
  });
}

test("WT-6: the two failure policies give the same graph except for the failure kind of the same checks", () => {
  // WALKTHROUGH-PROGRAMS WT-6: "the MIR differs only in the failure edge of the same test (K-3212 point 3)".
  const [unwinding, aborting] = POLICIES.map(policy => wt6(policy));
  for (const name of ["orderGrow", "orderFixed", "orderFixedByReference"])
    assert.deepEqual(withoutFailureKinds(lower(aborting[name])), withoutFailureKinds(lower(unwinding[name])));
  // `order` has a cleanup that an unwinding failure enters and a process-ending failure does not; the path that
  // completes normally is the same under both.
  const orders = [unwinding, aborting].map(programs => walk(lower(programs.order)).events.map(item => [item.kind, item.node]));
  assert.deepEqual(orders[1], orders[0]);
});

// ---- WT-4 -----------------------------------------------------------------------------------

const internalCalls = internalCallsOn;

test("WT-4 f: three entries by supplied count; a default runs only in the entry that omits its parameter", () => {
  const programs = wt4();
  const mir = lower(programs.f, programs.internal);
  // R7 and section 7 part 8, WT-4: "`f` has three entries", one per admissible count of supplied fixed arguments.
  // Graph law 7 says they are ordered by supplied count; the cases below find each entry by its count, not by its
  // position or block.
  assert.deepEqual([...providedCountsOf(mir)].sort(), [0, 1, 2]);
  const ordered = providedCountsOf(mir);
  assert.ok(ordered.every((count, index) => index === 0 || count < ordered[index - 1]) || ordered.every((count, index) => index === 0 || count > ordered[index - 1]));
  const entryOf = provided => providedCountsOf(mir).indexOf(provided);
  const defaults = provided => internalCalls(walk(mir, { entry: entryOf(provided) })).map(calleeNameOf);
  // WT-4: "the default body runs only for an omitted argument"; "a default that reads an earlier parameter": x's
  // default runs before y's.
  assert.deepEqual(defaults(2), []);
  assert.deepEqual(defaults(1), [programs.Y_DEFAULT]);
  assert.deepEqual(defaults(0), [programs.X_DEFAULT, programs.Y_DEFAULT]);
  // R8: an initializer body executes "as an explicit execution of that body instance", into the parameter it initializes.
  const [xDefault, yDefault] = internalCalls(walk(mir, { entry: entryOf(0) }));
  assert.equal(destinationRootOf(mir, xDefault), sourceLocal(mir, 0));
  assert.equal(destinationRootOf(mir, yDefault), sourceLocal(mir, 1));
  // WT-4: "the default body as a callee with captures": y's default reads the already-bound x.
  assert.deepEqual(capturedLocalsOf(yDefault), [{ body: bodyId("f"), local: 0 }]);
  assert.deepEqual(capturedRootsOf(mir, yDefault), [sourceLocal(mir, 0)]);
  // Every path ends in the one shared body: each entry returns.
  for (const provided of [0, 1, 2]) assert.equal(walk(mir, { entry: entryOf(provided) }).end, "return");
});

test("WT-4 x default: next() is one call in the default body, and f's own graph does not call it", () => {
  const programs = wt4();
  // WT-4: "`next()` executes only in the entry that omits `x`": the call belongs to the default body, which only
  // that entry executes.
  const inDefault = effects(lower(programs.xDefault)).filter(point => point.kind === "call");
  assert.equal(inDefault.length, 1);
  assert.equal(inDefault[0].node, programs.xDefault.at("next()"));
  const inF = effects(lower(programs.f, programs.internal)).filter(point => isCall(point) && !isInternalCall(point));
  assert.deepEqual(inF, []);
});

test("WT-4 calls: an omitted argument is represented as omitted; a supplied absence is a value", () => {
  const programs = wt4();
  const mir = lower(programs.calls);
  // R7: "an omitted argument is represented as omitted at the call; a default runs in the callee's entry". Section 7
  // part 8: "`f()` passes two omitted arguments, `f(null)` and `f(undefined)` a supplied absence and one omitted".
  const shape = label => at(mir, programs.calls.at(label), "call").map(argumentKindsOf);
  assert.deepEqual(shape("f()"), [["omitted", "omitted"]]);
  assert.deepEqual(shape("f(null)"), [["value", "omitted"]]);
  assert.deepEqual(shape("f(undefined)"), [["value", "omitted"]]);
  assert.deepEqual(shape("f(1)"), [["value", "omitted"]]);
  assert.deepEqual(shape("f(1,2)"), [["value", "value"]]);
  // No default executes at a call site.
  assert.deepEqual(internalCalls(walk(mir)), []);
  // R5: the five calls execute in authored order.
  assert.deepEqual(labelled(programs.calls, nodesOn(walk(mir))), ["f()", "f(null)", "f(undefined)", "f(1)", "f(1,2)"]);
});

// ---- S-7 ------------------------------------------------------------------------------------

for (const order of ["fields-first", "base-first"]) {
  // Held (R2 K-4): where the plan of a class without an authored constructor is executed is with Codex (C-3187). This
  // input expands the plan in the body that holds `new Derived()`; the case states the order law and waits for the route.
  test(`S-7 (${order}): construction runs in the order of the ConstructionPlan, on one object`,
    { todo: "waits for C-3187: the body that executes a class-owned ConstructionPlan" }, () => {
    const programs = s7(order);
    const mir = lower(programs.program, programs.internal);
    // R9: "the object exists, then base construction, field initializers and constructor code run in the order the
    // typed body's ConstructionPlan gives (MR-16)". S-7 has one oracle per value of the selected order (MR-15).
    const steps = walk(mir).events.filter(isCall);
    const names = steps.map(calleeNameOf);
    const baseConstructor = def("Base.constructor");
    assert.deepEqual(names, order === "fields-first" ? [programs.V_INIT, programs.SEEN_INIT, baseConstructor]
      : [baseConstructor, programs.V_INIT, programs.SEEN_INIT]);
    // One object: each field initializer writes a field of the object the base constructor receives.
    const base = steps.find(item => !isInternalCall(item));
    const object = receiverRootOf(mir, base);
    assert.notEqual(object, null);
    for (const item of steps.filter(isInternalCall)) {
      assert.equal(destinationRootOf(mir, item), object);
      assert.equal(destinationChainOf(mir, item).length, 2);
    }
    assert.deepEqual(steps.filter(isInternalCall).map(item => destinationFieldOf(mir, item)), ["v", "seen"]);
  });
}

test("S-7: static initializer and static block run at the class declaration in member order", () => {
  const programs = s7("fields-first");
  const mir = lower(programs.moduleBody, programs.moduleInternal);
  // R8 and section 5 part 1 rows 5 and 6: static field initializers and static blocks run "at the class declaration's
  // occurrence in its enclosing body, in member order". S-7: "The static initializer and the static block run in
  // authored order".
  const steps = internalCalls(walk(mir));
  assert.deepEqual(steps.map(calleeNameOf), [programs.COUNT_INIT, programs.STATIC_BLOCK]);
  assert.deepEqual(destinationBaseOf(mir, steps[0]), { kind: "static", definition: def("Derived.count") });
  assert.equal(destinationBaseOf(mir, steps[1]), null);
});

// ---- S-2 ------------------------------------------------------------------------------------

const ITERATION_DONE = def("iterate.done");
const squash = items => items.filter((item, index) => index === 0 || item !== items[index - 1]);

test("S-2 switch: clauses run in source order with fallthrough; default only when no case matches", () => {
  const program = s2().program;
  const mir = lower(program);
  // S-2 oracle: `s2(1, …)` takes 3 from the switch (case 1 falls through into case 2, then `break`); `s2(2, [])` is 2;
  // `s2(3, [])` is 9. Section 17: S-2 covers "`switch` and labels" for LowerMir ("fallthrough edges").
  const clauses = new Set(["r+=1", "r+=2", "r=9"].map(label => program.at(label)));
  // Each case clause carries the selected equality of its test (NEEDS-W4 G1); the walk answers the test of each clause
  // at the clause's own occurrence, in authored order. Lowering chooses neither the comparison nor the order.
  const run = k => {
    const path = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : branchesOn(mir, point, ITERATION_DONE) ? true
      : point.node === program.at("case 1") ? k === 1 : point.node === program.at("case 2") ? k === 2 : "otherwise" });
    assert.equal(path.end, "return");
    return squash(labelled(program, statementsOn(path).filter(item => clauses.has(item.node)).map(item => item.node)));
  };
  assert.deepEqual(run(1), ["r+=1", "r+=2"]);
  assert.deepEqual(run(2), ["r+=2"]);
  assert.deepEqual(run(3), ["r=9"]);
  // The tests run in authored order, each once: with no match, case 1 is tested before case 2.
  const unmatched = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : branchesOn(mir, point, ITERATION_DONE) ? true : false });
  const tests = unmatched.events.filter(item => item.statement === null && item.kind === "switch" &&
    (item.node === program.at("case 1") || item.node === program.at("case 2"))).map(item => item.node);
  assert.deepEqual(labelled(program, tests), ["case 1", "case 2"]);
});

test("S-2 labels: continue outer and break outer leave through each iteration cleanup they cross, once", () => {
  const program = s2().program;
  const mir = lower(program);
  // S-2 oracle input `s2(1, [[1, -1, 5], [2, 0, 7]])`: v = 1 is added; v = -1 continues the outer loop; v = 2 is added;
  // v = 0 breaks the outer loop. R6: "every … transfer passes through each enclosing cleanup once, in order": continue
  // outer leaves the inner iteration only; break outer leaves the inner and then the outer iteration.
  const answers = [false, false, false, false, false, true, false, false, false, false, false, false, true];
  const path = walk(mir, { decide: point => {
    if (point.kind !== "switch") return "normal";
    if (point.node === program.at("case 1")) return true;
    if (point.node === program.at("case 2")) return false;
    return answers.shift();
  } });
  assert.equal(path.end, "return");
  assert.deepEqual(answers, []);
  const trace = path.events.map(item => item.statement === null && operationName(item.record) === def("iterate.next") ? "next"
    : item.statement === null && operationName(item.record) === def("iterate.finish") ? "finish"
    : item.statement !== null && item.node === program.at("r+=v") ? "add" : null).filter(item => item !== null);
  // One addition may be several statements of the same occurrence; they count once.
  assert.deepEqual(trace.filter((item, index) => !(item === "add" && trace[index - 1] === "add")),
    ["next", "next", "add", "next", "finish", "next", "next", "add", "next", "finish", "finish"]);
});

// ---- S-3 ------------------------------------------------------------------------------------

for (const variant of ["unwind", "abort"]) {
  test(`S-3 (${variant}): the call unwinds to the handler; the narrowed use is checked; the rethrow leaves the body`, () => {
    const programs = s3(variant);
    const program = programs.program;
    const mir = lower(program);
    // S-3, LowerMir: "the unwind edge from the call to the handler; the rethrow". R1: the failure kind of a call inside
    // `try … catch` is "unwinds to a named handler".
    const call = at(mir, program.at("risky(n)"), "call");
    assert.equal(call.length, 1);
    assert.equal(call[0].failure, "handler");
    // `s3(4)` is 4: the normal path executes the call and returns.
    const normal = walk(mir);
    assert.deepEqual(labelled(program, nodesOn(normal)), ["risky(n)"]);
    assert.equal(normal.end, "return");
    // `s3(-2)` is -102: the call unwinds, `e instanceof Failure` is true, `e.code` is read through the narrowed `e`.
    // R1: "every narrowed use carries its check" (WT-10), with the selected failure kind; it stands in the catch block,
    // outside the protected region.
    const caught = walk(mir, { decide: point => point.node === program.at("risky(n)") ? "unwind" : point.kind === "switch" ? true : "normal" });
    assert.equal(caught.end, "return");
    const narrowedUse = checks(mir, program.at("e#narrowed"));
    assert.equal(narrowedUse.length, 1);
    assert.equal(narrowedUse[0].failure, variant === "abort" ? "abort" : "escape");
    assert.deepEqual(labelled(program, nodesOn(caught)), ["risky(n)", "e#narrowed"]);
    // A caught value that is not a Failure is thrown again and leaves the body.
    const rethrown = walk(mir, { decide: point => point.node === program.at("risky(n)") ? "unwind" : point.kind === "switch" ? false : "normal" });
    assert.equal(rethrown.end, "unwind");
    assert.deepEqual(labelled(program, nodesOn(rethrown)), ["risky(n)", "throw e"]);
    assert.equal(at(mir, program.at("throw e"), "throw")[0].failure, "escape");
  });
}

test("S-3 risky: the thrown value is constructed, then thrown out of the body", () => {
  const program = s3("unwind").risky;
  const mir = lower(program);
  // Program text: `if (n < 0) throw new Failure(n); return n;`. R5: authored order.
  const thrown = walk(mir, { decide: point => point.kind === "switch" ? true : "normal" });
  assert.deepEqual(labelled(program, nodesOn(thrown)), ["new Failure(n)", "throw"]);
  assert.equal(thrown.end, "unwind");
  const returned = walk(mir, { decide: point => point.kind === "switch" ? false : "normal" });
  assert.deepEqual(nodesOn(returned), []);
  assert.equal(returned.end, "return");
});

// ---- S-6 ------------------------------------------------------------------------------------

test("S-6 using: disposal runs once on every exit, after the result is read and before the handler", () => {
  const { program, disposeDeclaration } = s6();
  const mir = lower(program);
  const isDispose = item => isCall(item) && !isInternalCall(item) && calleeNameOf(item) === disposeDeclaration;
  const readsLength = item => readsField(mir, item, "length");
  // R5 and graph law 9: the dispose step is emitted once; R6: every exit of the scope passes through it once.
  assert.equal(controlPoints(mir).filter(isDispose).length, 1);
  // S-6 oracle: `s6([], false)` is 0 "with the log holding one entry afterwards (the result is read before disposal)".
  const returned = walk(mir, { decide: point => point.kind === "switch" ? false : "normal" });
  assert.equal(returned.end, "return");
  assert.equal(returned.events.filter(isDispose).length, 1);
  assert.ok(indexOfEvent(returned, readsLength) !== -1 && indexOfEvent(returned, readsLength) < indexOfEvent(returned, isDispose));
  assert.equal(labelled(program, nodesOn(returned))[0], "new Res(log)");
  // S-6 oracle: `s6([], true)` is 1 "(disposal runs on the unwinding exit before the handler)".
  const thrown = walk(mir, { decide: point => point.kind === "switch" ? true : "normal" });
  assert.equal(thrown.end, "return");
  assert.equal(thrown.events.filter(isDispose).length, 1);
  assert.ok(indexOfEvent(thrown, isDispose) < indexOfEvent(thrown, readsLength));
  assert.deepEqual(labelled(program, nodesOn(thrown)).slice(0, 3), ["new Res(log)", "new Failure(0)", "throw"]);
  // A failure of the construction itself happens before the resource exists: no disposal on that path.
  const unbuilt = walk(mir, { decide: point => point.node === program.at("new Res(log)") ? "unwind" : "normal" });
  assert.equal(unbuilt.events.filter(isDispose).length, 0);
});

// ---- WT-9 -----------------------------------------------------------------------------------

test("WT-9 all: handle creation and suspension are separate control points; finally runs once on resume and on unwind", () => {
  const program = wt9().all;
  const mir = lower(program);
  // R3: "creation of a handle, … suspension, resumption, each finite exit … " are each explicit. WT-9: "handle creation
  // distinct from completion". Program text: `out += await load(id)` inside `try … finally { out += "."; }`.
  const call = at(mir, program.at("load(id)"), "call");
  const suspension = at(mir, program.at("await"), "await");
  assert.equal(call.length, 1);
  assert.equal(suspension.length, 1);
  assert.notEqual(call[0].block, suspension[0].block);
  assert.deepEqual(edgesOf(suspension[0].record).map(edge => edge.edge), ["resume", "unwind"]);
  // One element, then the iteration is complete.
  let asked = 0;
  const once = point => point.kind === "switch" && branchesOn(mir, point, ITERATION_DONE) ? (asked++ > 0) : "normal";
  const finals = path => path.events.filter(item => item.statement !== null && item.node === program.at("out+=.")).length;
  const resumed = walk(mir, { decide: once });
  assert.equal(resumed.end, "return");
  assert.ok(indexOfEvent(resumed, item => item.statement === null && item.node === program.at("load(id)")) <
    indexOfEvent(resumed, item => item.statement === null && item.kind === "await"));
  assert.ok(finals(resumed) >= 1);
  // R6: an unwinding exit at the suspension passes through the enclosing cleanup once and leaves the body.
  asked = 0;
  const failed = walk(mir, { decide: point => point.kind === "await" ? "unwind" : once(point) });
  assert.equal(failed.end, "unwind");
  assert.ok(finals(failed) >= 1);
  // Graph law 9: the cleanup's code is emitted in one block, not once per exit.
  assert.equal(blocksWithStatementAt(mir, program.at("out+=.")).length, 1);
});

test("WT-9 take: a yield has the three exits resume, consumer finish and unwind", () => {
  const program = wt9().take;
  const mir = lower(program);
  // COMMON-DATA §4: suspension; resumption; "finite exit … by the consumer finishing it". R3.
  const suspension = at(mir, program.at("yield i"), "yield");
  assert.equal(suspension.length, 1);
  assert.deepEqual(edgesOf(suspension[0].record).map(edge => edge.edge).slice(0, 2), ["resume", "return"]);
  const finished = walk(mir, { decide: point => point.kind === "switch" ? true : point.kind === "yield" ? "return" : "normal" });
  assert.equal(finished.end, "return");
  assert.deepEqual(labelled(program, nodesOn(finished)), ["yield i"]);
});

test("WT-9 guarded: every exit of a suspension passes through the enclosing cleanup once", () => {
  const program = wt9().guarded;
  const mir = lower(program);
  // Section 7 part 8, WT-9: "consumer-finish through enclosing cleanups". R6.
  assert.equal(at(mir, program.at("done()"), "call").length, 1);
  for (const [choice, end] of [["resume", "return"], ["return", "return"], ["unwind", "unwind"]]) {
    const path = walk(mir, { decide: point => point.kind === "yield" ? choice : "normal" });
    assert.deepEqual(labelled(program, nodesOn(path)), ["yield 1", "done()"]);
    assert.equal(path.end, end);
  }
});

// ---- WT-10 ----------------------------------------------------------------------------------

for (const policy of POLICIES) {
  test(`WT-10 read (${policy.absent}): every narrowed use and every index carries its check`, () => {
    const program = wt10(policy).program;
    const mir = lower(program);
    // Section 7 part 8, WT-10: "every narrowed use carries its check whether or not it will be proved". R1: "no check
    // is absent because it might be proved". The proof is Refinements' fact; lowering reads none.
    const failing = policy.absent === "abort" ? "abort" : "escape";
    for (const label of ["a[i]", "o.x#1", "o.x#2"]) {
      const found = checks(mir, program.at(label));
      assert.equal(found.length, 1, label);
      assert.equal(found[0].failure, failing, label);
    }
    // One loop iteration, both guards true: authored order of the calls and checks.
    let loop = 0;
    const path = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : point.node === program.at("for") || point.node === program.at("i<a.length") ? (loop++ === 0) : true });
    assert.deepEqual(labelled(program, nodesOn(path)), ["a[i]", "pure()", "o.x#1", "clear(o)", "o.x#2"]);
    assert.equal(path.end, "return");
  });
}

// ---- WT-11 ----------------------------------------------------------------------------------

test("WT-11 write: pointer operations are the selected operations at their positions; no check is made up for a raw access", () => {
  const program = wt11({ absent: "unwind" }).program;
  const mir = lower(program);
  // Section 7 part 8, WT-11. R2: only an operation that can fail or write existing storage is a control point; R12:
  // nothing in the graph is selected by lowering.
  const store = at(mir, program.at("storeptr(pointer,7)"));
  assert.deepEqual(store.map(point => [point.kind, point.failure]), [["invoke", "none"]]);
  assert.equal(operationKindOf(store[0]), "pointer-write");
  for (const label of ["unsafecontext()", "addressof", "torawptr", "reinterpretrawptr"]) assert.deepEqual(at(mir, program.at(label)), [], label);
  // The only check in the body is the one the narrowed use of `pointer` requires.
  assert.deepEqual(labelled(program, checks(mir).map(point => point.node)), ["pointer#narrowed"]);
  const stored = walk(mir, { decide: point => point.kind === "switch" ? true : "normal" });
  assert.deepEqual(labelled(program, nodesOn(stored)), ["pointer#narrowed", "storeptr(pointer,7)"]);
  const skipped = walk(mir, { decide: point => point.kind === "switch" ? false : "normal" });
  assert.deepEqual(nodesOn(skipped), []);
});

// ---- WT-8 -----------------------------------------------------------------------------------

test("WT-8 runEither: the two closures are created once each, in authored order, before the call", () => {
  const program = wt8().program;
  const mir = lower(program);
  // Section 7 part 8, WT-8: "each … callback registration an explicit execution at its declared position". R5.
  const path = walk(mir);
  const first = label => indexOfEvent(path, item => item.node === program.at(label));
  assert.ok(first("a-closure") !== -1 && first("a-closure") < first("b-closure"));
  assert.ok(first("b-closure") < indexOfEvent(path, isCall));
  const created = label => path.events.filter(item => item.node === program.at(label) && createsClosure(item)).length;
  assert.equal(created("a-closure"), 1);
  assert.equal(created("b-closure"), 1);
});

// ---- WT-5 -----------------------------------------------------------------------------------

test("WT-5: an erroneous or still-deferred body is a caller defect; an independent body lowers", () => {
  const programs = wt5();
  // Section 7 part 7: "a body with a deferred decision, a deferred conversion or an error resolution … Thrown as
  // defects, never diagnostics". Part 8, WT-5: "graphs of the others are unaffected".
  assert.throws(() => lowerToMir(deps, programs.broken.tir, []), TypeError);
  assert.throws(() => lowerToMir(deps, programs.deferred.tir, []), TypeError);
  const mir = lower(programs.independent);
  assert.deepEqual(effects(mir), []);
  assert.equal(walk(mir).end, "return");
});

// ---- S-1 ------------------------------------------------------------------------------------

test("S-1: the source of a destructuring is evaluated once", () => {
  const program = s1().program;
  const mir = lower(program);
  // S-1 oracle: "`pair` runs once". 8.4 of the parked chapter is not authority; the clause is R5.
  assert.equal(at(mir, program.at("pair()"), "call").length, 1);
  assert.equal(labelled(program, nodesOn(walk(mir)))[0], "pair()");
  // Whether a position of the pattern needs a check is the selected access of that binding element, which the typed
  // body does not carry yet (NEEDS-W4 G2); nothing is asserted about checks here.
});

// ---- the limit ------------------------------------------------------------------------------

test("the MIR size limit refuses with one diagnostic and returns no graph", () => {
  const program = wt6(POLICIES[0]).order;
  // Section 7 part 7: "the size of one MIR graph (its count of control points and records), charged before
  // allocation"; "Diagnostic originated: one"; "Refusal: that limit only". The unit of the count is the contract's
  // (`LowerMirLimits.maximumRecords`); the case does not restate it: it finds the smallest admitted limit and requires
  // a refusal just below it.
  const attempt = maximumRecords => lowerToMir({ ...deps, limits: { maximumRecords } }, program.tir, []);
  assert.equal(attempt(0).kind, "refused");
  let low = 0;
  let high = deps.limits.maximumRecords;
  assert.equal(attempt(high).kind, "ok");
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    if (attempt(middle).kind === "ok") high = middle; else low = middle;
  }
  // Below the boundary every limit refuses; at and above it every limit admits.
  const refused = attempt(low);
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  assert.equal("value" in refused, false);
  assert.deepEqual(attempt(high).value, lower(program));
  assert.equal(attempt(high + 1).kind, "ok");
});
