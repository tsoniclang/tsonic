// The cases of the graph laws of a lowered body. This file is a case module of the MIR bank: test/host-units/ir-mir.test.mjs
// imports it, and its cases run and are counted there. It is not a test entry of its own.
// Cases for the graph laws of a lowered body (COMPONENTS section 7 part 9, laws 1 and 4 to 10; S2-18).
// One hand-written graph satisfies them; each other case changes one thing and names the law it breaks.
// Law 2 and the agreement of failure kinds with decisions wait for the decision fields (S2-11). Law 3 is cased as
// ruled (K-3238, relayed by the controller); its fixed-extent kind waits for `extent` on the element access decision.
//   function laws(a: int32[], i: int32, o?: int32): int32 { for (const v of a) { use(v); } bump(i); o!; o!; o!; await o; await o; yield i; yield* a; return a[i]; }
// (the two awaits and the two yields are nodes for the cases of law 6 on suspensions; no case lowers them together)
// where `bump` takes its parameter by reference for reading and writing.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { EMPTY_BINDINGS, PARAMETRIC, T, TABLE, bodyId, builders, def, narrowed, signature, typedBody, value } from "./fixtures/lower-mir/typed.mjs";

const SIG_LAWS = signature("laws", [["a", T.int32Array], ["i", T.int32], ["o", T.optInt32, "optional"]], T.int32);
const SIG_USE = signature("laws.use", [["v", T.int32]], T.void);
const SIG_BUMP = signature("laws.bump", [["v", T.int32, "required", null, "byref-readwrite"]], T.void);
const SIG_TWO = signature("laws.two", [["x", T.optInt32, "optional"], ["y", T.optInt32, "optional"]], T.void);
// Each step is an invoked operation that cannot fail; only `next` writes existing storage (it advances the iterator).
const coreOperation = (name, operands, result, writesStorage) => ({ decision: { kind: "selected",
  operation: { kind: "core", declaration: def(name), bindings: EMPTY_BINDINGS }, operands, result,
  execution: { kind: "invocation", writesStorage, failure: "none" } }, permissionScope: null });
const ACQUIRE = coreOperation("laws.acquire", [T.int32Array], T.unknown, false);
const NEXT = coreOperation("laws.next", [T.unknown], T.unknown, true);
const DONE = coreOperation("laws.done", [T.unknown], T.bool, false);
const VALUE = coreOperation("laws.value", [T.unknown], T.int32, false);
const endpoint = (name, role, sig) => ({ declaration: def(name), role, signature: sig, body: bodyId(name) });
const USE_CALLEE = { decision: { candidate: 0, advertised: endpoint("laws.use", "advertised", SIG_USE), api: endpoint("laws.use", "api-body", SIG_USE),
  bindings: EMPTY_BINDINGS, implementationBindings: EMPTY_BINDINGS, parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }],
  completion: { signature: SIG_USE, completion: T.void, yielded: null, sent: null }, result: T.void, activation: null },
  activation: { body: bodyId("laws.use"), bindings: PARAMETRIC }, captures: [] };
const callee = (name, sig, parameters) => ({ decision: { candidate: 0, advertised: endpoint(name, "advertised", sig), api: endpoint(name, "api-body", sig),
  bindings: EMPTY_BINDINGS, implementationBindings: EMPTY_BINDINGS, parameters,
  completion: { signature: sig, completion: T.void, yielded: null, sent: null }, result: T.void, activation: null },
  activation: { body: bodyId(name), bindings: PARAMETRIC }, captures: [] });
const BUMP_CALLEE = callee("laws.bump", SIG_BUMP, [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "byref-readwrite" }]);
const TWO_CALLEE = callee("laws.two", SIG_TWO, [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" },
  { kind: "argument", parameter: 1, argument: 1, component: null, passing: "by-value" }]);
const ITERATE = { kind: "iterate", asynchronous: false, value: T.int32, completion: T.void, sent: null, thrown: T.unknown,
  steps: [{ role: "acquire", operation: ACQUIRE, callee: null }, { role: "next", operation: NEXT, callee: null },
    { role: "done", operation: DONE, callee: null }, { role: "value", operation: VALUE, callee: null }] };
const AWAIT_BARE = { kind: "await", asynchronous: true, value: T.optInt32, completion: T.void, sent: null, thrown: T.unknown, steps: [] };
const AWAIT_STEP = { ...AWAIT_BARE, steps: [{ role: "await", operation: coreOperation("laws.await", [T.unknown], T.unknown, true), callee: null }] };
const YIELD = { kind: "yield", asynchronous: false, value: T.int32, completion: T.void, sent: null, thrown: T.unknown, steps: [] };
const DELEGATE = { ...YIELD, kind: "delegate", steps: [{ role: "next", operation: NEXT, callee: null }] };
const INDEX = { decision: { key: { kind: "text", value: "index" }, origins: [], selectedDeclarations: [], primary: null, read: T.int32, write: T.int32,
  getter: null, setter: null, bindings: EMPTY_BINDINGS,
  location: { kind: "data", check: { kind: "required", failure: "unwind" }, receiver: "by-reference" } }, getter: null, setter: null };

// Each `o!` is a narrowing whose check unwinds; so is the element a[i], which is also narrowed.
const NARROWED = narrowed(T.optInt32, T.int32, "unwind");
const PURE_OPERATION = { decision: { kind: "selected", operation: { kind: "core", declaration: def("laws.pure"), bindings: EMPTY_BINDINGS },
  operands: [T.unknown], result: T.int32, execution: { kind: "pure" } }, permissionScope: null };
const b = builders("laws");
const typed = iterate => typedBody("laws", { signature: SIG_LAWS, completion: T.int32,
  locals: [["a", "parameter", T.int32Array], ["i", "parameter", T.int32], ["o", "parameter", T.optInt32], ["v", "binding", T.int32]],
  params: [[0, "required", T.int32Array], [1, "required", T.int32], [2, "optional", T.optInt32]],
  root: b.block(
    { $: "for", ...b.forOf(b.declarationList([b.variable(b.declName("v", 3), 3, T.int32)]), b.id("a", 0, T.int32Array),
      b.block(b.expressionStatement({ $: "use(v)", ...b.call(b.global("use", "laws.use", T.unknown), [{ $: "v", ...b.id("v", 3, T.int32) }], T.void,
        at => ({ callee: USE_CALLEE, receiver: null, arguments: [{ kind: "provided", parameter: 0, expression: at("v") }] })) })), iterate) },
    b.expressionStatement({ $: "bump(i)", ...b.call(b.global("bump", "laws.bump", T.unknown), [{ $: "i of bump", ...b.id("i", 1, T.int32) }], T.void,
      at => ({ callee: BUMP_CALLEE, receiver: null, arguments: [{ kind: "provided", parameter: 0, expression: at("i of bump") }] })) }),
    b.expressionStatement({ $: "o!", ...b.nonNull({ $: "o", ...b.id("o", 2, T.optInt32) }, T.int32, NARROWED) }),
    b.expressionStatement({ $: "o!#2", ...b.nonNull({ $: "o#2", ...b.id("o", 2, T.optInt32) }, T.int32, NARROWED) }),
    b.expressionStatement({ $: "o!#3", ...b.nonNull(b.id("o", 2, T.optInt32), T.int32, NARROWED) }),
    b.expressionStatement({ $: "await#bare", ...b.awaits(b.id("o", 2, T.optInt32), T.optInt32, AWAIT_BARE) }),
    b.expressionStatement({ $: "await#step", ...b.awaits(b.id("o", 2, T.optInt32), T.optInt32, AWAIT_STEP) }),
    b.expressionStatement({ $: "yield", ...b.yields(b.id("i", 1, T.int32), T.unknown, YIELD) }),
    b.expressionStatement({ $: "yield*", ...b.yields(b.id("a", 0, T.int32Array), T.unknown, DELEGATE, true) }),
    { $: "return", ...b.returns({ $: "a[i]", ...b.element({ $: "a", ...b.id("a", 0, T.int32Array) }, { $: "i", ...b.id("i", 1, T.int32) },
      { ...value(T.int32, { narrowing: NARROWED }), role: "value", selection: { kind: "decided", decision: INDEX } }) }) }) });
const source = typed(ITERATE);

const BODY = bodyId("laws");
const site = label => ({ origin: { module: "M[P[p];m]", start: source.at(label), length: 1, derived: [] }, tir: { body: BODY, node: source.at(label) } });
const local = (id, storage, role, sourceLocal = null) => ({ id, storage, role, source: sourceLocal === null ? null : { body: BODY, local: sourceLocal },
  origin: site("for").origin });
const place = (id, base, storage) => ({ id, base, storage, origin: site("for").origin });
const p = id => ({ kind: "place", place: id });
const step = index => ({ protocol: 0, step: index });

/**
 * The graph that satisfies every law. Places 0 to 9 are the locals 0 to 9; place 10 is the checked element a[i].
 * `i` is handed to `bump` for writing, so the index of a[i] is the copy in local 7, which is written once.
 */
function good() {
  return {
    body: BODY, bindings: PARAMETRIC,
    entries: [{ provided: 3, block: 0 }, { provided: 2, block: 8 }],
    locals: [
      local(0, T.int32Array, { kind: "parameter", index: 0 }, 0), local(1, T.int32, { kind: "parameter", index: 1 }, 1),
      local(2, T.optInt32, { kind: "parameter", index: 2 }, 2), local(3, T.int32, { kind: "user" }, 3),
      local(4, T.unknown, { kind: "temporary" }), local(5, T.unknown, { kind: "temporary" }), local(6, T.bool, { kind: "temporary" }),
      local(7, T.int32, { kind: "temporary" }), local(8, T.int32Array, { kind: "temporary" }), local(9, T.int32, { kind: "temporary" }),
    ],
    constants: [{ id: 0, type: T.optInt32, value: { kind: "literal", value: { kind: "absence" } } },
      { id: 1, type: T.bool, value: { kind: "literal", value: { kind: "boolean", value: true } } }],
    places: [
      ...[T.int32Array, T.int32, T.optInt32, T.int32, T.unknown, T.unknown, T.bool, T.int32, T.int32Array, T.int32].map((storage, id) =>
        place(id, { kind: "local", local: id }, storage)),
      place(10, { kind: "checked", place: 8, projection: { kind: "index", operand: p(7) }, tir: site("a[i]").tir }, T.int32),
    ],
    blocks: [
      { ...site("for"), id: 0, statements: [3, 4, 5, 6, 7, 8, 9].map(id => ({ ...site("for"), kind: "storage-live", local: id })),
        terminator: { ...site("for"), kind: "invoke", operation: ACQUIRE, operands: [p(0)], destination: 4, next: 1, unwind: { kind: "none" }, step: step(0) } },
      { ...site("for"), id: 1, statements: [],
        terminator: { ...site("for"), kind: "invoke", operation: NEXT, operands: [p(4)], destination: 5, next: 2, unwind: { kind: "none" }, step: step(1) } },
      { ...site("for"), id: 2, statements: [],
        terminator: { ...site("for"), kind: "invoke", operation: DONE, operands: [p(5)], destination: 6, next: 3, unwind: { kind: "none" }, step: step(2) } },
      { ...site("for"), id: 3, statements: [],
        terminator: { ...site("for"), kind: "switch", operand: p(6), targets: [{ constant: 1, target: 9 }], otherwise: 4, step: step(2) } },
      { ...site("for"), id: 4, statements: [],
        terminator: { ...site("for"), kind: "invoke", operation: VALUE, operands: [p(5)], destination: 3, next: 5, unwind: { kind: "none" }, step: step(3) } },
      { ...site("use(v)"), id: 5, statements: [],
        terminator: { ...site("use(v)"), kind: "call", callee: { kind: "direct", resolution: USE_CALLEE }, receiver: null,
          arguments: [{ kind: "value", passing: "by-value", operand: p(3) }], destination: null, next: 1, unwind: { kind: "escape" }, step: null } },
      { ...site("a[i]"), id: 6, statements: [
        { ...site("a"), kind: "assign", place: 8, value: { kind: "use", operand: p(0) }, step: null },
        { ...site("i"), kind: "assign", place: 7, value: { kind: "use", operand: p(1) }, step: null }],
        terminator: { ...site("a[i]"), kind: "check", place: 10, next: 7, unwind: { kind: "escape" } } },
      { ...site("return"), id: 7, statements: [{ ...site("a[i]"), kind: "assign", place: 9, value: { kind: "use", operand: p(10) }, step: null }],
        terminator: { ...site("return"), kind: "return", value: p(9) } },
      { ...site("for"), id: 8, statements: [{ ...site("for"), kind: "assign", place: 2, value: { kind: "use", operand: { kind: "constant", constant: 0 } }, step: null }],
        terminator: { ...site("for"), kind: "goto", target: 0 } },
      { ...site("bump(i)"), id: 9, statements: [],
        terminator: { ...site("bump(i)"), kind: "call", callee: { kind: "direct", resolution: BUMP_CALLEE }, receiver: null,
          arguments: [{ kind: "place", passing: "byref-readwrite", place: 1 }], destination: null, next: 6, unwind: { kind: "escape" }, step: null } },
    ],
    result: T.int32,
  };
}

const LAW_RULES = new Set(["failure-kind-exact", "check-place-exact", "statement-pure", "receiver-stable", "check-place-single", "checked-place-available", "checked-place-destination",
  "suspension-admitted", "refined-under-check", "index-operand-stable", "protocol-step-exact",
  "completion-branch-canonical", "entries-exact", "omission-admitted", "storage-marker-exact", "effect-site-unique"]);
let verifyMir;
let printMir;
let parseMir;
let constantKeyOfMir;
let context;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "MIR law cases require a guarded admission");
  ({ verifyMir, printMir, parseMir, constantKeyOfMir } = await import("../../packages/host/dist/ir-mir/index.js"));
  const declaration = (name, sig) => ({ scope: { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] }, parameterCount: 0,
    endpoints: [endpoint(name, "advertised", sig), endpoint(name, "api-body", sig)] });
  const declared = new Map([["laws", SIG_USE], ["laws.use", SIG_USE], ["laws.bump", SIG_BUMP], ["laws.two", SIG_TWO], ["laws.acquire", SIG_USE],
    ["laws.next", SIG_USE], ["laws.done", SIG_USE], ["laws.value", SIG_USE], ["laws.await", SIG_USE], ["laws.pure", SIG_USE]].map(([name, sig]) => [def(name), declaration(name, sig)]));
  context = { limits: { maximumWork: 100000 }, source: source.tir, types: TABLE, declarationOf: definition => declared.get(definition) ?? null,
    bodyOwner: body => body === BODY ? def("laws") : body === bodyId("laws.use") ? def("laws.use") : body === bodyId("laws.bump") ? def("laws.bump") : body === bodyId("laws.two") ? def("laws.two") : null };
});

/** The findings of a verification that ran to its end; a refusal for resources is not a list of findings. */
const found = (body, given = context) => {
  const outcome = verifyMir(body, given);
  assert.equal(outcome.kind, "complete");
  return outcome.violations;
};
const laws = body => found(body).filter(violation => LAW_RULES.has(violation.rule)).map(violation => violation.rule);
/** Every rule the verifier reports, for the cases that assert that a changed graph has its one finding and no other. */
const all = body => found(body).map(violation => violation.rule);
/** The same, for the body taken as asynchronous: a suspension stands only in a body that can suspend. */
const allAsync = body => found(body, { ...context, source: { ...context.source, asynchronous: true } }).map(violation => violation.rule);
const changed = change => { const body = good(); change(body); return body; };

test("the graph that satisfies the laws has no law violation, and its text form is read back equal", () => {
  assert.deepEqual(laws(good()), []);
  const parsed = parseMir(printMir(good()));
  assert.equal(parsed.kind, "parsed");
  assert.deepEqual(parsed.value, good());
});

test("the complete verifier's findings on the satisfying graph are recorded, not hidden", () => {
  // The satisfying graph is written by hand. Findings of rules older than these laws would be defects of this
  // input; the case fails on any, so that they are seen.
  assert.deepEqual(found(good()).map(violation => `${violation.rule} at ${violation.site.kind}${"block" in violation.site ? ` ${violation.site.block}/${violation.site.statement}` : ""}`), []);
});

test("law 1: a check whose failure kind says it cannot fail is refused", () => {
  // "a check is a control point with one of three failure kinds (to a handler, out of the body, ending the process)".
  assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.unwind = { kind: "none" }; })), ["failure-kind-exact"]);
  // The check of a[i] unwinds, as its access decision says: out of the body here, or to a handler.
  assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.unwind = { kind: "escape" }; })), []);
});

test("law 1: a call cannot end the process or be unable to fail", () => {
  // A call runs code of its own: its failure unwinds, to a handler or out of the body (COMMON-DATA §4, exit by unwind).
  for (const kind of ["abort", "none"])
    assert.deepEqual(laws(changed(body => { body.blocks[5].terminator.unwind = { kind }; })), ["failure-kind-exact"]);
});

test("law 1: a control point fails as its decision says", () => {
  const lawRules = (body, given) => found(body, given).filter(violation => LAW_RULES.has(violation.rule)).map(violation => violation.rule);
  // The access decision of a[i] says its check unwinds: a check that ends the process disagrees.
  assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.unwind = { kind: "abort" }; })), ["failure-kind-exact"]);
  // An invoked operation that cannot fail has no failure arm; one that unwinds has an edge or leaves the body.
  assert.deepEqual(lawRules(changed(body => { body.blocks[1].terminator.unwind = { kind: "escape" }; }), context), ["failure-kind-exact"]);
  assert.deepEqual(lawRules(changed(body => { body.blocks[1].terminator.unwind = { kind: "abort" }; }), context), ["failure-kind-exact"]);
  const invoked = failure => changed(body => {
    body.blocks[7].terminator = { ...site("return"), kind: "invoke", operation: { ...ACQUIRE, decision: { ...ACQUIRE.decision, execution: { kind: "invocation", writesStorage: false, failure } } },
      operands: [p(0)], destination: null, next: 10, unwind: { kind: "escape" }, step: null };
    body.blocks.push({ ...site("return"), id: 10, statements: [], terminator: { ...site("return"), kind: "return", value: p(9) } });
  });
  assert.deepEqual(lawRules(invoked("unwind"), context), []);
  assert.deepEqual(lawRules(invoked("abort"), context), ["failure-kind-exact"]);
  assert.deepEqual(lawRules(invoked("none"), context), ["failure-kind-exact"]);
  // A member whose decision says its check ends the process: the check of that view ends the process and does not unwind.
  const fatal = { decision: { ...INDEX.decision, key: { kind: "text", value: "x" }, location: { kind: "data", check: { kind: "required", failure: "abort" }, receiver: "in-place" } }, getter: null, setter: null };
  const checkedField = kind => changed(body => {
    body.places.push(place(11, { kind: "checked", place: 8, projection: { kind: "field", member: fatal }, tir: site("return").tir }, T.int32));
    body.blocks[7].terminator = { ...site("return"), kind: "check", place: 11, next: 10, unwind: { kind } };
    body.blocks.push({ ...site("return"), id: 10, statements: [], terminator: { ...site("return"), kind: "return", value: p(9) } });
  });
  assert.deepEqual(laws(checkedField("abort")), []);
  assert.deepEqual(laws(checkedField("escape")), ["failure-kind-exact"]);
});

test("law 2: a statement executes only a pure operation, and a pure operation is never a control point", () => {
  // A pure operation as a statement. (It is not an operation of that node; the selection rule says so, not a law.)
  const statement = operation => changed(body => { body.blocks[7].statements.push(
    { ...site("return"), kind: "assign", place: 9, value: { kind: "unary", operation, operand: p(5) }, step: null }); });
  assert.deepEqual(laws(statement(PURE_OPERATION)), []);
  // An invocation as a statement: it can fail or write, so it is a control point.
  assert.deepEqual(laws(statement(ACQUIRE)), ["statement-pure"]);
  // An aggregate at a node that selected no construction: law 2 says nothing of it (the type rules report it).
  assert.deepEqual(laws(changed(body => { body.blocks[7].statements.push(
    { ...site("a[i]"), kind: "assign", place: 9, value: { kind: "aggregate", type: T.int32, aggregate: { kind: "array", elements: [] } }, step: null }); })), []);
  // A pure operation as a control point.
  assert.deepEqual(laws(changed(body => {
    body.blocks[7].terminator = { ...site("return"), kind: "invoke", operation: PURE_OPERATION, operands: [p(5)], destination: null, next: 10, unwind: { kind: "none" }, step: null };
    body.blocks.push({ ...site("return"), id: 10, statements: [], terminator: { ...site("return"), kind: "return", value: p(9) } });
  })), ["statement-pure"]);
});

test("law 3: an invocation ends mutable availability only if its decision says it writes existing storage", () => {
  // a[i] is checked and read in block 7; then an operation is invoked; then a[i] is read again in block 10.
  const invokedBetween = operation => changed(body => {
    body.blocks[7].terminator = { ...site("return"), kind: "invoke", operation, operands: [p(4)], destination: null, next: 10, unwind: { kind: "none" }, step: null };
    body.blocks.push({ ...site("return"), id: 10, statements: [{ ...site("a[i]"), kind: "assign", place: 9, value: { kind: "use", operand: p(10) }, step: null }],
      terminator: { ...site("return"), kind: "return", value: p(9) } });
  });
  // `acquire` only reads: the indexed compound assignment with an overflow check between has one bounds check.
  assert.deepEqual(laws(invokedBetween(ACQUIRE)), []);
  // `next` writes existing storage.
  assert.deepEqual(laws(invokedBetween(NEXT)), ["checked-place-available"]);
});

test("laws 1 and 4: a view is checked exactly where its decision requires, and a reference receiver is captured once", () => {
  // An element whose access decision requires a check, as a view with no check.
  assert.deepEqual(laws(changed(body => { body.places[10].base.kind = "place"; body.blocks[6].terminator = { ...site("a[i]"), kind: "goto", target: 7 }; })),
    ["check-place-exact"]);
  // A member that needs no check, as a checked view. (The fixture's member `x` of nothing; only the laws are compared.)
  const free = { decision: { ...INDEX.decision, key: { kind: "text", value: "x" }, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null };
  const field = (kind, parent) => changed(body => { body.places.push(place(11, { kind, place: parent, projection: { kind: "field", member: free }, tir: site("return").tir }, T.int32)); });
  assert.deepEqual(laws(field("place", 8)), []);
  assert.deepEqual(laws(field("checked", 8)), ["check-place-exact"]);
  // A view with no decision is held to the forms only: a member reached through an accessor (a call, not a view);
  // an element at a node that selected no access; a view at a node the body does not have.
  const through = { decision: { ...INDEX.decision, key: { kind: "text", value: "x" }, location: { kind: "accessor" } }, getter: null, setter: null };
  const view = (kind, projection, tir) => changed(body => { body.places.push(place(11, { kind, place: 8, projection, tir }, T.int32)); });
  for (const kind of ["place", "checked"]) {
    assert.deepEqual(laws(view(kind, { kind: "field", member: through }, site("return").tir)), []);
    assert.deepEqual(laws(view(kind, { kind: "element", index: 0 }, site("return").tir)), []);
    assert.deepEqual(laws(view(kind, { kind: "element", index: 0 }, { body: BODY, node: 9999 })), []);
  }
  // A narrowed view at a node that has no narrowing, or no typed value at all: no check is required there, so a
  // checked view is a check that was made up.
  assert.deepEqual(laws(view("checked", { kind: "refined" }, site("o").tir)), ["check-place-exact"]);
  assert.deepEqual(laws(view("checked", { kind: "refined" }, site("return").tir)), ["check-place-exact"]);
  // The receiver of a[i] is reached by reference: it is the saved copy in local 8, written once.
  // Indexed directly through the parameter `a`, which the body never writes and does not hand out: also captured once.
  assert.deepEqual(laws(changed(body => { body.places[10].base.place = 0; })), []);
  // Indexed directly through `a` when `a` is passed by reference: the receiver is held in the caller's storage, which
  // other code writes. The lowering saves it first, as the satisfying graph does.
  const byReference = { ...context, source: { ...context.source, params: context.source.params.map((row, position) => position === 0 ? { ...row, passing: "byref-readwrite" } : row) } };
  assert.deepEqual(found(changed(body => { body.places[10].base.place = 0; }), byReference).filter(violation => LAW_RULES.has(violation.rule)).map(violation => violation.rule),
    ["receiver-stable"]);
  // The saved receiver written a second time.
  assert.deepEqual(laws(changed(body => { body.blocks[6].statements.push({ ...site("a"), kind: "assign", place: 8, value: { kind: "use", operand: p(0) }, step: null }); })),
    ["receiver-stable"]);
});

test("law 1: a check names a checked place at its own node", () => {
  // "a check is a control point": the control point and the place it tests are one occurrence.
  // The check tests another place, so a[i] is also read with no check of its own (law 3).
  assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.place = 9; })), ["checked-place-available", "check-place-exact"]);
  assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.tir = site("return").tir; })), ["check-place-exact"]);
});

test("a narrowed view exists only under a checked base", () => {
  // R2's verdict on C4, taken into S2-18: `refined` under a direct base would be a narrowing with no check.
  const add = kind => changed(body => { body.places.push(place(11, { kind, place: 2, projection: { kind: "refined" }, tir: site("o!").tir }, T.int32)); });
  // The narrowing of `o!` requires a check, so the same view is also one whose required check is absent.
  assert.deepEqual(laws(add("place")), ["refined-under-check", "check-place-exact"]);
  assert.deepEqual(laws(add("checked")), []);
});

test("a narrowed view has the type its node's narrowing selected", () => {
  // The node `o!` has type int32; a view of it at another type is refused.
  const view = storage => changed(body => { body.places.push(place(11, { kind: "checked", place: 2, projection: { kind: "refined" }, tir: site("o!").tir }, storage)); });
  assert.deepEqual(all(view(T.int32)), []);
  assert.deepEqual(all(view(T.bool)), ["projection-type"]);
  // R2 M-1: one node can be both an element and narrowed (`if (xs[0] !== null) use(xs[0].v)`). The narrowed view of
  // the checked element a[i] is a second checked place of the node a[i], of another kind and with another parent.
  assert.deepEqual(all(changed(body => { body.places.push(place(11, { kind: "checked", place: 10, projection: { kind: "refined" }, tir: site("a[i]").tir }, T.int32)); })), []);
});

test("law 4: an index is a constant or a local written once", () => {
  // "a place's receiver and index, once evaluated, cannot be changed by a later write (… an index [is] held in
  // values written once …)".
  const twice = changed(body => { body.blocks[7].statements.push({ ...site("i"), kind: "assign", place: 7, value: { kind: "use", operand: p(1) }, step: null }); });
  assert.deepEqual(laws(twice), ["index-operand-stable"]);
  // A parameter the body never writes was written once, at entry. Here `bump(i)` is removed, so nothing writes `i`.
  const direct = body => { body.places[10].base.projection.operand = p(1); };
  assert.deepEqual(all(changed(body => { direct(body); body.blocks.pop(); body.blocks[3].terminator.targets[0].target = 6; })), []);
  // Handed to a call for writing, it is no longer written once (R2, L-1).
  assert.deepEqual(all(changed(direct)), ["index-operand-stable"]);
  // A projected place is not a value written once. The place here is its own index, so its check reads it unchecked (law 3).
  assert.deepEqual(laws(changed(body => { body.places[10].base.projection.operand = p(10); })), ["index-operand-stable", "checked-place-available"]);
});

test("law 4: every way the index local's cell can be written is a write", () => {
  // R1: a second write through a narrowed view of the index local's own cell, after the indexed place was formed.
  // Law 3 reports the same graph twice more: the view is used with no check of its own, and the write through it
  // ends the availability of a[i], which the next statement reads.
  assert.deepEqual(all(changed(body => {
    body.places.push(place(11, { kind: "checked", place: 7, projection: { kind: "refined" }, tir: site("o!").tir }, T.int32));
    body.blocks[7].statements.unshift({ ...site("i"), kind: "assign", place: 11, value: { kind: "use", operand: p(1) }, step: null });
  })), ["index-operand-stable", "checked-place-available", "checked-place-available"]);
  // R1, R2: the index local handed by place to a call that may write it. The count is of the body, so where the
  // call stands does not matter; here it stands before the check, so that law 3 has nothing to report.
  const handed = passing => changed(body => {
    body.blocks[9].statements.push(body.blocks[6].statements.pop());
    body.blocks[9].terminator.arguments = [{ kind: "place", passing, place: 7 }];
  });
  assert.deepEqual(all(handed("byref-readwrite")), ["index-operand-stable"]);
  // The other writing modes are counted the same; the callee here takes `byref-readwrite`, so the complete list
  // also has the passing mismatch and only the law rules are compared. A reading mode is not a write.
  assert.deepEqual(laws(handed("byref-writeonly-must-init")), ["index-operand-stable"]);
  assert.deepEqual(laws(handed("borrow-mut")), ["index-operand-stable"]);
  assert.deepEqual(laws(handed("byref-readonly")), []);
  assert.deepEqual(laws(handed("borrow-shared")), []);
  // Its address taken, or the local captured by a closure or by an internal body's call. These hand-made records
  // have other findings (no reference type and no second body in this fixture); only the law rules are compared.
  assert.deepEqual(laws(changed(body => { body.blocks[7].statements.unshift(
    { ...site("i"), kind: "assign", place: 9, value: { kind: "address-of", place: 7, type: T.int32 }, step: null }); })), ["index-operand-stable"]);
  const captures = [{ local: { body: BODY, local: 1 }, place: 7 }];
  assert.deepEqual(laws(changed(body => { body.blocks[7].statements.unshift(
    { ...site("i"), kind: "assign", place: 4, value: { kind: "closure", instance: { body: bodyId("laws.use"), bindings: PARAMETRIC }, captures }, step: null }); })), ["index-operand-stable"]);
  assert.deepEqual(laws(changed(body => { body.blocks[5].terminator.callee = { kind: "body", instance: { body: bodyId("laws.use"), bindings: PARAMETRIC }, captures }; })),
    ["index-operand-stable"]);
});

const READ = () => ({ ...site("a[i]"), kind: "assign", place: 9, value: { kind: "use", operand: p(10) }, step: null });
const STORE = () => ({ ...site("a[i]"), kind: "assign", place: 10, value: { kind: "use", operand: p(1) }, step: null });
/** `bump(i)` moved between the read of a[i] in block 7 and block 9, which the change then fills. */
const callAfterRead = body => {
  body.blocks[3].terminator.targets[0].target = 6;
  body.blocks[7].terminator = { ...body.blocks[9].terminator, next: 9 };
};
const returns = operand => ({ ...site("return"), kind: "return", value: operand });

test("law 3: a checked place is available where its check continues and along single-entry blocks (ruling point 2)", () => {
  // The satisfying graph reads a[i] in the block its check continues to. A goto into a block with one incoming edge
  // carries it.
  assert.deepEqual(all(changed(body => {
    body.blocks.push({ ...site("a[i]"), id: 10, statements: [], terminator: { ...site("a[i]"), kind: "goto", target: 7 } });
    body.blocks[6].terminator.next = 10;
  })), []);
  // "Same block before the use" is not the rule: a use in the block that ends with the check is before the check.
  assert.deepEqual(all(changed(body => { body.blocks[6].statements.push(READ()); })), ["checked-place-available"]);
  // A merge ends it. Block 7 becomes a loop head: it is entered from the check and from itself.
  assert.deepEqual(all(changed(body => {
    body.locals.push(local(10, T.bool, { kind: "temporary" }));
    body.places.push(place(11, { kind: "local", local: 10 }, T.bool));
    body.blocks[0].statements.push({ ...site("for"), kind: "storage-live", local: 10 });
    body.blocks[6].statements.push({ ...site("a[i]"), kind: "assign", place: 11, value: { kind: "use", operand: { kind: "constant", constant: 1 } }, step: null });
    body.blocks[7].terminator = { ...site("return"), kind: "switch", operand: p(11), targets: [{ constant: 1, target: 10 }], otherwise: 7, step: null };
    body.blocks.push({ ...site("return"), id: 10, statements: [], terminator: returns(p(9)) });
  })), ["checked-place-available"]);
});

test("law 3: mutable availability ends at a call, a store, and a write or marker of a local the place depends on (point 3)", () => {
  // A value written into a local that the place does not depend on ends nothing.
  assert.deepEqual(all(changed(body => { body.blocks[7].statements.unshift({ ...site("i"), kind: "assign", place: 9, value: { kind: "use", operand: p(1) }, step: null }); })), []);
  // A call between the check and the use (it may run user code).
  assert.deepEqual(all(changed(body => { body.blocks[3].terminator.targets[0].target = 6; body.blocks[6].terminator.next = 9; body.blocks[9].terminator.next = 7; })),
    ["checked-place-available"]);
  // A store into a place that is not a local's own cell: here the store into a[i] itself, then a read of it.
  assert.deepEqual(all(changed(body => { body.blocks[7].statements.unshift(STORE()); })), ["checked-place-available"]);
  // The saved receiver written again: the reference receiver is no longer a value written once (law 4), and the
  // write ends the availability of the element under it (law 3).
  assert.deepEqual(all(changed(body => { body.blocks[7].statements.unshift({ ...site("a"), kind: "assign", place: 8, value: { kind: "use", operand: p(0) }, step: null }); })),
    ["receiver-stable", "checked-place-available"]);
  // The storage of the index local ended. The liveness rule reports the same graph; only the law rules are compared.
  assert.deepEqual(laws(changed(body => { body.blocks[7].statements.unshift({ ...site("i"), kind: "storage-dead", local: 7 }); })), ["checked-place-available"]);
});

test("law 3: a suspension between the check and the use ends mutable availability (point 3)", () => {
  // a[i] is read, the body suspends at an await, and a[i] is read again after resumption.
  const suspended = (body, rechecked) => {
    body.blocks[7].terminator = { ...site("return"), kind: "await", operand: p(4), destination: 5, resume: 10, unwind: { kind: "escape" }, step: null };
    if (rechecked) {
      body.blocks.push({ ...site("a[i]"), id: 10, statements: [], terminator: { ...site("a[i]"), kind: "check", place: 10, next: 11, unwind: { kind: "escape" } } },
        { ...site("return"), id: 11, statements: [READ()], terminator: returns(p(9)) });
    } else body.blocks.push({ ...site("return"), id: 10, statements: [READ()], terminator: returns(p(9)) });
  };
  // Checked again after resumption, through the same place.
  assert.deepEqual(allAsync(changed(body => { suspended(body, true); })), []);
  // Used after resumption on the strength of the check before it.
  assert.deepEqual(allAsync(changed(body => { suspended(body, false); })), ["checked-place-available"]);
  // Law 5: the same graph in a body that is not asynchronous has a suspension with no event to stand for.
  assert.deepEqual(all(changed(body => { suspended(body, true); })), ["suspension-admitted"]);
});

const WAITS_EXTENT = { todo: "waits for `extent: CarrierExtent` on the element access decision (W2, the commit after A1)" };
test("law 3: a fixed extent with an unchanged receiver and index stays available across a call (point 4)", WAITS_EXTENT, () => {
  // With `extent: "fixed"` on the decision of a[i], the call between the check and the use ends nothing.
  assert.deepEqual(all(changed(body => { body.blocks[3].terminator.targets[0].target = 6; body.blocks[6].terminator.next = 9; body.blocks[9].terminator.next = 7; })), []);
});
test("law 3: a fixed extent does not survive a write of its saved receiver (point 4)", WAITS_EXTENT, () => {
  // Until the field exists this graph is refused as every mutable place is; with it, it must still be refused.
  assert.fail("the fixed-extent kind is not implemented");
});

/** A saved copy of `o` in local 10 (place 11) and its narrowed view, place 12, checked in a new block 10 that continues to `bump(i)`. */
const narrowedView = (body, parent) => {
  body.locals.push(local(10, T.optInt32, { kind: "temporary" }));
  body.places.push(place(11, { kind: "local", local: 10 }, T.optInt32),
    place(12, { kind: "checked", place: parent, projection: { kind: "refined" }, tir: site("o!").tir }, T.int32));
  body.blocks[0].statements.push({ ...site("for"), kind: "storage-live", local: 10 });
  body.blocks[3].terminator.targets[0].target = 10;
  body.blocks.push({ ...site("o!"), id: 10, statements: [{ ...site("o"), kind: "assign", place: 11, value: { kind: "use", operand: p(2) }, step: null }],
    terminator: { ...site("o!"), kind: "check", place: 12, next: 9, unwind: { kind: "escape" } } });
  // o = undefined, then a read of the narrowed view; after the call and the check of a[i], another read of it.
  body.blocks[9].statements.push({ ...site("o"), kind: "assign", place: 2, value: { kind: "use", operand: { kind: "constant", constant: 0 } }, step: null },
    { ...site("o!"), kind: "assign", place: 9, value: { kind: "use", operand: p(12) }, step: null });
  body.blocks[7].statements.push({ ...site("o!"), kind: "assign", place: 9, value: { kind: "use", operand: p(12) }, step: null });
};

test("law 3: the narrowed view of a saved value stays available; a view in place is checked again (point 5)", () => {
  // `opt!.count += (opt = undefined, 1)`: the saved reference is not absent although the variable is assigned, and
  // it stays so across a call and another check.
  assert.deepEqual(all(changed(body => { narrowedView(body, 11); })), []);
  // The view of the variable's own cell: the assignment to the variable ends it, and so does the call.
  assert.deepEqual(all(changed(body => { narrowedView(body, 2); })), ["checked-place-available", "checked-place-available"]);
});

// ---- law 3 at a merge (K-3242): a stable place survives where it arrives on every incoming edge ----
// Added to the satisfying graph by `staged`: two saved copies of `o` (locals 10 and 12, places 11 and 14) with their
// narrowed views (place 12 at the node `o!`, place 15 at the second `o!`), and a condition (local 11, place 13).
// Block 7 reads a[i], writes the three locals, and ends as the case says.
const viewOf = (id, parent, node) => place(id, { kind: "checked", place: parent, projection: { kind: "refined" }, tir: site(node).tir }, T.int32);
const readView = (view = 12) => ({ ...site("o!"), kind: "assign", place: 9, value: { kind: "use", operand: p(view) }, step: null });
const checkOf = (view, node, next, unwind = { kind: "escape" }) => ({ ...site(node), kind: "check", place: view, next, unwind });
const branch = (whenTrue, otherwise) => ({ ...site("return"), kind: "switch", operand: p(13), targets: [{ constant: 1, target: whenTrue }], otherwise, step: null });
const jump = target => ({ ...site("return"), kind: "goto", target });
const blockOf = (id, statements, terminator) => ({ ...site("return"), id, statements, terminator });
const staged = build => changed(body => {
  body.locals.push(local(10, T.optInt32, { kind: "temporary" }), local(11, T.bool, { kind: "temporary" }), local(12, T.optInt32, { kind: "temporary" }));
  body.places.push(place(11, { kind: "local", local: 10 }, T.optInt32), viewOf(12, 11, "o!"), place(13, { kind: "local", local: 11 }, T.bool),
    place(14, { kind: "local", local: 12 }, T.optInt32), viewOf(15, 14, "o!#2"));
  for (const id of [10, 11, 12]) body.blocks[0].statements.push({ ...site("for"), kind: "storage-live", local: id });
  body.blocks[7].statements.push({ ...site("o"), kind: "assign", place: 11, value: { kind: "use", operand: p(2) }, step: null },
    { ...site("o#2"), kind: "assign", place: 14, value: { kind: "use", operand: p(2) }, step: null },
    { ...site("return"), kind: "assign", place: 13, value: { kind: "use", operand: { kind: "constant", constant: 1 } }, step: null });
  build(body);
});
/** The view is checked in block 7; block 10 branches to blocks 11 and 12, which meet in block 13. */
const checkedThenDiamond = (body, { atMerge, inOtherArm = [] }) => {
  body.blocks[7].terminator = checkOf(12, "o!", 10);
  body.blocks.push(blockOf(10, [readView()], branch(11, 12)), blockOf(11, [], jump(13)), blockOf(12, inOtherArm, jump(13)),
    blockOf(13, atMerge, returns(p(9))));
};
/** Block 7 branches to blocks 10 and 11, each ending as given; they meet in block 12, which reads the view. */
const diamondThenUse = (body, first, second) => {
  body.blocks[7].terminator = branch(10, 11);
  body.blocks.push(blockOf(10, [], first), blockOf(11, [], second), blockOf(12, [readView()], returns(p(9))));
};

test("law 3 at a merge: a stable place checked before a branch is available after the arms meet", () => {
  // `opt!.count += c ? 1 : 2`: the saved reference is tested once; the store after the conditional needs no second test.
  assert.deepEqual(all(staged(body => { checkedThenDiamond(body, { atMerge: [readView()] }); })), []);
  // A mutable place is not: a[i], checked and read before the branch, is read again where the arms meet.
  assert.deepEqual(all(staged(body => { checkedThenDiamond(body, { atMerge: [READ()] }); })), ["checked-place-available"]);
});

test("law 3 at a merge: fixed[i] += c ? 1 : 2 has no second bounds control point for the join", WAITS_EXTENT, () => {
  // UNVERIFIED until `extent` exists: with a fixed extent the read of a[i] where the arms meet has no finding.
  assert.deepEqual(all(staged(body => { checkedThenDiamond(body, { atMerge: [READ()] }); })), []);
});

test("law 3 at a merge: the same fact on every incoming edge, or none", () => {
  // Checked in both arms: the same checked place arrives on both edges.
  assert.deepEqual(all(staged(body => { diamondThenUse(body, checkOf(12, "o!", 12), checkOf(12, "o!", 12)); })), []);
  // Checked in one arm only.
  assert.deepEqual(all(staged(body => { diamondThenUse(body, checkOf(12, "o!", 12), jump(12)); })), ["checked-place-available"]);
  // A view of another saved copy in the other arm: two facts, neither on both edges. They are not joined.
  assert.deepEqual(all(staged(body => { diamondThenUse(body, checkOf(12, "o!", 12), checkOf(15, "o!#2", 12)); })), ["checked-place-available"]);
});

test("law 3 at a merge: an invalidation on one path, and a path that brings nothing, prevent the merged fact", () => {
  // The storage of the saved copy ends in one arm. The liveness rule reports the read too; the law rules are compared.
  assert.deepEqual(laws(staged(body => { checkedThenDiamond(body, { atMerge: [readView()], inOtherArm: [{ ...site("o"), kind: "storage-dead", local: 10 }] }); })),
    ["checked-place-available"]);
  // A block nothing reaches is an incoming edge like any other, and it brings nothing.
  assert.deepEqual(laws(staged(body => { checkedThenDiamond(body, { atMerge: [readView()] }); body.blocks.push(blockOf(14, [], jump(13))); })),
    ["checked-place-available"]);
  // An entry is an incoming route that brings nothing: block 10 is entered from the check and as the body's second entry.
  assert.deepEqual(laws(staged(body => {
    body.blocks[7].terminator = checkOf(12, "o!", 10);
    body.blocks.push(blockOf(10, [readView()], returns(p(9))));
    body.entries[1].block = 10;
  })), ["checked-place-available"]);
  // A loop header: block 10 is entered from the check and from itself. The back edge has not been read when the
  // header is, so the header starts with nothing.
  assert.deepEqual(all(staged(body => {
    body.blocks[7].terminator = checkOf(12, "o!", 10);
    body.blocks.push(blockOf(10, [readView()], branch(11, 10)), blockOf(11, [], returns(p(9))));
  })), ["checked-place-available"]);
});

test("law 3 at a merge: a failure edge carries what held before the failing terminator", () => {
  // The exception local 13 (place 16) receives the thrown value on the failure edge.
  const withHandler = build => staged(body => {
    body.locals.push(local(13, T.unknown, { kind: "exception" }));
    body.places.push(place(16, { kind: "local", local: 13 }, T.unknown));
    body.blocks[0].statements.push({ ...site("for"), kind: "storage-live", local: 13 });
    build(body);
  });
  // The view is checked, then `bump` is called with a handler: the view is available in the handler and after the call.
  assert.deepEqual(laws(withHandler(body => {
    body.blocks[3].terminator.targets[0].target = 6;
    body.blocks[7].terminator = checkOf(12, "o!", 10);
    body.blocks.push({ ...site("bump(i)"), id: 10, statements: [],
      terminator: { ...body.blocks[9].terminator, next: 11, unwind: { kind: "handler", exception: 16, target: 12 } } },
      blockOf(11, [readView()], returns(p(9))), blockOf(12, [readView()], returns(p(9))));
    body.blocks[9] = blockOf(9, [], returns(p(1)));
  })), []);
  // The handler of the check itself: the view is not available where its own check failed.
  assert.deepEqual(laws(withHandler(body => {
    body.blocks[7].terminator = checkOf(12, "o!", 10, { kind: "handler", exception: 16, target: 11 });
    body.blocks.push(blockOf(10, [readView()], returns(p(9))), blockOf(11, [readView()], returns(p(9))));
  })), ["checked-place-available"]);
});

test("law 3: a checked place is never the destination of a terminator (R2 M-2)", () => {
  // The stable view as the destination of an invoked step, and as the exception place of a handler. The second
  // graph has a type finding for the exception place as well; the law rules are compared.
  assert.deepEqual(all(staged(body => { body.blocks[4].terminator.destination = 12; })), ["checked-place-destination"]);
  assert.deepEqual(laws(staged(body => {
    body.blocks[7].terminator = checkOf(12, "o!", 10);
    body.blocks.push({ ...site("a[i]"), id: 10, statements: [], terminator: checkOf(10, "a[i]", 11, { kind: "handler", exception: 12, target: 11 }) },
      blockOf(11, [], returns(p(9))));
  })), ["checked-place-destination"]);
});

test("law 3 at a merge: a block reads only the part of a shared list that its own edge brought", () => {
  // The view at `o!` is checked in block 7. Block 10 branches: block 12 checks the second view and so appends it
  // to the list block 7 began; block 11 was handed that list before the append.
  const forked = inFirst => staged(body => {
    body.blocks[7].terminator = checkOf(12, "o!", 10);
    body.blocks.push(blockOf(10, [], branch(11, 12)), blockOf(11, inFirst, returns(p(9))), blockOf(12, [], checkOf(15, "o!#2", 13)),
      blockOf(13, [readView(15), readView(12)], returns(p(9))));
  });
  assert.deepEqual(all(forked([readView(12)])), []);
  assert.deepEqual(all(forked([readView(15)])), ["checked-place-available"]);
  // Three blocks are handed the list of block 7: one appends to it, one must copy it to add the same place, and the
  // third reads it after that copy.
  assert.deepEqual(all(staged(body => {
    body.blocks[7].terminator = checkOf(12, "o!", 10);
    body.blocks.push(blockOf(10, [], branch(11, 12)), blockOf(11, [], branch(13, 14)), blockOf(12, [], checkOf(15, "o!#2", 15)),
      blockOf(13, [readView(12)], returns(p(9))), blockOf(14, [], checkOf(15, "o!#2", 16)),
      blockOf(15, [readView(15)], returns(p(9))), blockOf(16, [readView(15), readView(12)], returns(p(9))));
  })), []);
  // Both arms check both views, in opposite orders: two lists with the same two facts.
  assert.deepEqual(all(staged(body => {
    body.blocks[7].terminator = branch(10, 11);
    body.blocks.push(blockOf(10, [], checkOf(12, "o!", 12)), blockOf(11, [], checkOf(15, "o!#2", 13)),
      blockOf(12, [], checkOf(15, "o!#2", 14)), blockOf(13, [], checkOf(12, "o!", 14)),
      blockOf(14, [readView(12), readView(15)], returns(p(9))));
  })), []);
});

test("the work limit: a body is verified up to its limit and refused past it, never accepted and never found invalid", () => {
  const under = maximumWork => verifyMir(body, { ...context, limits: { maximumWork } });
  const refusal = maximumWork => ({ kind: "resource-limit", body: BODY, dimension: "work", maximum: maximumWork });
  // One diamond under a stable place. The contract's units: one for each incoming edge of a block that is not
  // continued into and receives a set on every edge. Here: the two arms of the loop's branch (blocks 4 and 9),
  // the two arms of the diamond (11 and 12), and the two edges into the merge (13): six. The loop header receives
  // no set from its back edge and is not charged. The storage pass charges the same account first: 40 units on this
  // body (3 for the entry set, 10 markers, 27 lookups of uses that depend on their block's start; NEEDS-W4.md has
  // the count by block). So the body needs 46.
  let body = staged(graph => { checkedThenDiamond(graph, { atMerge: [readView()] }); });
  assert.deepEqual(under(46), { kind: "complete", violations: [] });
  assert.deepEqual(under(45), refusal(45));
  assert.deepEqual(under(0), refusal(0));
  // A refusal is not a finding: the same body with a defect is refused in the same way under the limit, and its
  // defect is reported only by a verification that ran to its end.
  const defective = staged(graph => { checkedThenDiamond(graph, { atMerge: [READ()] }); });
  assert.deepEqual(verifyMir(defective, { ...context, limits: { maximumWork: 5 } }), refusal(5));
  assert.deepEqual(found(defective).map(violation => violation.rule), ["checked-place-available"]);
  // Work adds up within one body: a second diamond after the first costs four more (two arms, two edges into its
  // merge) and three more lookups of the storage pass, and the limit that admitted one diamond refuses two.
  body = staged(graph => {
    checkedThenDiamond(graph, { atMerge: [readView()] });
    graph.blocks[13].terminator = branch(14, 15);
    graph.blocks.push(blockOf(14, [], jump(16)), blockOf(15, [], jump(16)), blockOf(16, [readView()], returns(p(9))));
  });
  assert.deepEqual(under(53), { kind: "complete", violations: [] });
  assert.deepEqual(under(52), refusal(52));
  assert.deepEqual(under(46), refusal(46));
  // The account is the body's: verifying two bodies one after the other under the limit of one charges each from zero.
  const one = staged(graph => { checkedThenDiamond(graph, { atMerge: [readView()] }); });
  for (const turn of [1, 2]) assert.deepEqual(verifyMir(one, { ...context, limits: { maximumWork: 46 } }), { kind: "complete", violations: [] }, `body ${turn}`);
  // The satisfying graph has no stable place. Law 3 charges it 2: the two arms of the loop's branch (blocks 4 and 9)
  // each receive the empty set on their one edge. The storage pass charges it 28 (3 for the entry set, 7 markers,
  // 18 lookups). So it needs 30.
  assert.equal(verifyMir(good(), { ...context, limits: { maximumWork: 30 } }).kind, "complete");
  assert.deepEqual(verifyMir(good(), { ...context, limits: { maximumWork: 29 } }), refusal(29));
});

test("law 3: a value delivered on a suspension's return edge into the local a stable place views ends it on that edge", () => {
  const generator = { ...context, source: { ...context.source, generator: true } };
  // The view is checked, then the body yields. The return edge delivers into `destination` and goes to block 12,
  // which reads the view. The exception local 13 (place 16) is a second saved value with its own view (place 17).
  // The viewed local 13 is written exactly once in both graphs, so its view is stable: by an assignment in block 7
  // when the return edge delivers elsewhere, by the return edge when it delivers into the local. Block 11, after
  // resumption, reads the view in both: a mutable view would be refused there.
  const returned = destination => staged(body => {
    body.locals.push(local(13, T.optInt32, { kind: "temporary" }));
    body.places.push(place(16, { kind: "local", local: 13 }, T.optInt32), viewOf(17, 16, "o!#3"));
    body.blocks[0].statements.push({ ...site("for"), kind: "storage-live", local: 13 });
    if (destination !== 16) body.blocks[7].statements.push({ ...site("o"), kind: "assign", place: 16, value: { kind: "use", operand: p(2) }, step: null });
    body.blocks[7].terminator = checkOf(17, "o!#3", 10);
    body.blocks.push(blockOf(10, [readView(17)], { ...site("return"), kind: "yield", operand: p(4), destination: 5, resume: 11,
      return: { destination, target: 12 }, unwind: { kind: "escape" }, step: null }),
    blockOf(11, [readView(17)], returns(p(9))), blockOf(12, [readView(17)], returns(p(9))));
  });
  const lawRules = body => found(body, generator).filter(violation => LAW_RULES.has(violation.rule)).map(violation => violation.rule);
  // Delivered into another local: the view is still available where the return edge goes.
  assert.deepEqual(lawRules(returned(5)), []);
  // Delivered into the viewed local itself (its one write): the return edge carries nothing; the resume edge does.
  assert.deepEqual(lawRules(returned(16)), ["checked-place-available"]);
});

test("law 3 at a merge: prefixes of one list, a place checked twice, and a view copied to add a place", () => {
  // Block 12 checks the second view and so lengthens the list; block 11 does not. They meet in block 13, which gets
  // the longer prefix first and the shorter second: the shorter is what both bring.
  const meeting = atMerge => staged(body => {
    body.blocks[7].terminator = checkOf(12, "o!", 10);
    body.blocks.push(blockOf(10, [], branch(11, 12)), blockOf(11, [], jump(13)), blockOf(12, [], checkOf(15, "o!#2", 13)), blockOf(13, atMerge, returns(p(9))));
  });
  assert.deepEqual(all(meeting([readView(12)])), []);
  assert.deepEqual(all(meeting([readView(15)])), ["checked-place-available"]);
  // A second check of a place that is available changes nothing.
  assert.deepEqual(all(staged(body => {
    body.blocks[7].terminator = checkOf(12, "o!", 10);
    body.blocks.push(blockOf(10, [], checkOf(12, "o!", 11)), blockOf(11, [readView(12)], returns(p(9))));
  })), []);
  // Block 12 appends the second view to the list of block 7; block 11, handed that list before, adds a third view and
  // must take a copy to do so. Neither sees the other's place.
  const third = inEleven => staged(body => {
    body.locals.push(local(13, T.optInt32, { kind: "temporary" }));
    body.places.push(place(16, { kind: "local", local: 13 }, T.optInt32), viewOf(17, 16, "o!#3"));
    body.blocks[0].statements.push({ ...site("for"), kind: "storage-live", local: 13 });
    body.blocks[7].statements.push({ ...site("o"), kind: "assign", place: 16, value: { kind: "use", operand: p(2) }, step: null });
    body.blocks[7].terminator = checkOf(12, "o!", 10);
    body.blocks.push(blockOf(10, [], branch(11, 12)), blockOf(11, [], checkOf(17, "o!#3", 14)), blockOf(12, [], checkOf(15, "o!#2", 13)),
      blockOf(13, [readView(15), readView(12)], returns(p(9))), blockOf(14, inEleven, returns(p(9))));
  });
  assert.deepEqual(all(third([readView(17), readView(12)])), []);
  assert.deepEqual(all(third([readView(15)])), ["checked-place-available"]);
});

test("the work limit is one boundary for every body: below it a refusal, from it on the complete answer", () => {
  // Each limit below the boundary exhausts the account at a different charge: an incoming edge, a place counted, a
  // list copied. None of them yields an answer other than the refusal.
  // The need of each body is derived from the two charging rules. Blocks are read in reverse postorder, in which
  // the `otherwise` arm of a branch and everything it reaches is read before the other arm: the first body's blocks
  // after 10 are read in the order 12, 15, 11, 14, 16, 13.
  // First body. Storage pass: 46 (3 for the entry set, 10 markers, 33 lookups; NEEDS-W4.md has them by block). Law 3:
  // 8 = the loop's two arms (blocks 4 and 9) + one edge into each of blocks 11, 12, 13 and 14 + one place copied in
  // block 14, which adds the view of `o!#2` to a list that block 12 has already extended + one place copied in
  // block 13, which reads the list whose place that copy made available again elsewhere. (A first derivation of 7
  // left out the copy in block 13; the run refused at 53.)
  // Second body. Storage pass: 42 (3, 10 and 29 lookups). Law 3: 10 = the loop's two arms + one edge into each of
  // blocks 10 and 11 + the two edges into the merge (block 14) + the two places on each of the two different lists
  // that arrive there.
  const needs = [46 + 8, 42 + 10];
  const bodies = [
    staged(body => {
      body.blocks[7].terminator = checkOf(12, "o!", 10);
      body.blocks.push(blockOf(10, [], branch(11, 12)), blockOf(11, [], branch(13, 14)), blockOf(12, [], checkOf(15, "o!#2", 15)),
        blockOf(13, [readView(12)], returns(p(9))), blockOf(14, [], checkOf(15, "o!#2", 16)),
        blockOf(15, [readView(15)], returns(p(9))), blockOf(16, [readView(15), readView(12)], returns(p(9))));
    }),
    staged(body => {
      body.blocks[7].terminator = branch(10, 11);
      body.blocks.push(blockOf(10, [], checkOf(12, "o!", 12)), blockOf(11, [], checkOf(15, "o!#2", 13)),
        blockOf(12, [], checkOf(15, "o!#2", 14)), blockOf(13, [], checkOf(12, "o!", 14)),
        blockOf(14, [readView(12), readView(15)], returns(p(9))));
    }),
  ];
  for (const [position, body] of bodies.entries()) {
    const need = needs[position];
    const kinds = [];
    for (let maximumWork = 0; maximumWork <= need + 10; maximumWork += 1) {
      const outcome = verifyMir(body, { ...context, limits: { maximumWork } });
      if (outcome.kind === "complete") assert.deepEqual(outcome.violations, []);
      else assert.deepEqual(outcome, { kind: "resource-limit", body: BODY, dimension: "work", maximum: maximumWork });
      kinds.push(outcome.kind);
    }
    assert.deepEqual(kinds, [...new Array(need).fill("resource-limit"), ...new Array(11).fill("complete")], `body ${position}`);
  }
});

test("malformed bodies: a record that names a row the body does not have is reported by the owning rule, and the laws stay total", () => {
  // A check that names a place the body does not have.
  assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.place = 99; })), ["checked-place-available", "check-place-exact"]);
  // An index held in a local the body does not have, and in a place that is not a local.
  assert.deepEqual(laws(changed(body => { body.places.push(place(11, { kind: "local", local: 99 }, T.int32)); body.places[10].base.projection.operand = p(11); })),
    ["index-operand-stable"]);
  assert.deepEqual(laws(changed(body => { body.places.push(place(11, { kind: "static", definition: def("laws") }, T.int32)); body.places[10].base.projection.operand = p(11); })),
    ["index-operand-stable"]);
  // A checked place whose parent the body does not have: its reference receiver is no local's cell.
  assert.deepEqual(laws(changed(body => { body.places[10].base.place = 99; })), ["receiver-stable"]);
  // A checked element of static storage: it is rooted at no local, so law 3 keeps nothing by a local for it. Its
  // receiver is reached by reference and is read from the static each time, which other code writes: law 4 refuses
  // it (the lowering saves the reference in a local written once).
  assert.deepEqual(laws(changed(body => {
    body.places.push(place(11, { kind: "static", definition: def("laws") }, T.int32Array),
      place(12, { kind: "checked", place: 11, projection: { kind: "element", index: 0 }, tir: site("a[i]").tir }, T.int32));
    body.blocks[7].terminator = { ...site("a[i]"), kind: "check", place: 12, next: 10, unwind: { kind: "escape" } };
    body.blocks.push({ ...site("return"), id: 10, statements: [{ ...site("return"), kind: "assign", place: 9, value: { kind: "use", operand: p(12) }, step: null }],
      terminator: { ...site("return"), kind: "return", value: p(9) } });
  })), ["receiver-stable"]);
  // A view under a checked place that was not checked: the check of the view reads its parent.
  assert.deepEqual(laws(changed(body => {
    body.places.push(place(11, { kind: "checked", place: 10, projection: { kind: "refined" }, tir: site("a[i]").tir }, T.int32));
    body.blocks[6].terminator.place = 11;
  })), ["checked-place-available", "checked-place-available"]);
  // A continuing edge into a position that holds no block.
  assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.next = 10; body.blocks.length = 11; })), ["checked-place-available"]);
  // A step record at a node the body does not have: law 10's rule reports it, the law rules do not.
  assert.deepEqual(laws(changed(body => { body.blocks[1].terminator.tir = { body: BODY, node: 9999 }; })), []);
  // A call at the loop's node that names no step and whose callee is no step's: nothing of law 6.
  assert.deepEqual(laws(changed(body => { body.blocks[5].terminator.tir = site("for").tir; })), []);
  // A rest parameter is not a fixed argument: the entries stay those of the three fixed parameters.
  const withRest = { ...context, source: { ...context.source, params: [...context.source.params, { ...context.source.params[2], role: "rest" }] } };
  assert.deepEqual(found(good(), withRest).filter(violation => LAW_RULES.has(violation.rule)), []);
});

test("the local of a by-reference parameter is the caller's storage: never stable, never an index (R1 N-1, K-3271)", () => {
  const passed = (parameter, passing) => ({ ...context, source: { ...context.source,
    params: context.source.params.map((row, position) => position === parameter ? { ...row, passing } : row) } });
  const lawRules = (body, given) => found(body, given).filter(violation => LAW_RULES.has(violation.rule)).map(violation => violation.rule);
  // R1 (a): the narrowed view of a parameter's own cell is checked, `bump` is called, the view is read. The view here
  // is of `a` (the fixture has no narrowing node of that type; the type finding is not a law rule).
  const viewOfParameter = changed(body => {
    body.places.push(place(11, { kind: "checked", place: 0, projection: { kind: "refined" }, tir: site("o!").tir }, T.int32));
    body.blocks[3].terminator.targets[0].target = 6;
    body.blocks[7].terminator = { ...site("o!"), kind: "check", place: 11, next: 9, unwind: { kind: "escape" } };
    body.blocks[9].terminator.next = 10;
    body.blocks.push({ ...site("return"), id: 10, statements: [{ ...site("o!"), kind: "assign", place: 9, value: { kind: "use", operand: p(11) }, step: null }],
      terminator: { ...site("return"), kind: "return", value: p(9) } });
  });
  // Passed by value or moved, the cell is private: the view is stable and the call ends nothing.
  assert.deepEqual(lawRules(viewOfParameter, context), []);
  assert.deepEqual(lawRules(viewOfParameter, passed(0, "move")), []);
  // Passed by reference in any mode, the cell is the caller's: the call may have changed it.
  for (const passing of ["byref-readwrite", "byref-readonly", "byref-writeonly-must-init", "borrow-shared", "borrow-mut"])
    assert.deepEqual(lawRules(viewOfParameter, passed(0, passing)), ["checked-place-available"], passing);
  // R1 (c): a[i] indexed directly by the parameter `i`, with nothing in the body writing `i`.
  const indexedByParameter = changed(body => { body.places[10].base.projection.operand = p(1); body.blocks.pop(); body.blocks[3].terminator.targets[0].target = 6; });
  assert.deepEqual(lawRules(indexedByParameter, context), []);
  assert.deepEqual(lawRules(indexedByParameter, passed(1, "byref-readwrite")), ["index-operand-stable"]);
  // The receiver (R1): the same graph over the local of role `receiver`, with the receiver's row passed by value and
  // by reference. The row of role `this` is a parameter row like the others and its local is found the same way, by
  // the source local it names (source local 4 here). (The fixture's signature has no receiver; that finding is not a
  // law rule.)
  const viewOfReceiver = changed(body => {
    body.locals.push(local(10, T.optInt32, { kind: "receiver" }, 4));
    body.places.push(place(11, { kind: "local", local: 10 }, T.optInt32),
      place(12, { kind: "checked", place: 11, projection: { kind: "refined" }, tir: site("o!").tir }, T.int32));
    body.blocks[3].terminator.targets[0].target = 6;
    body.blocks[7].terminator = { ...site("o!"), kind: "check", place: 12, next: 9, unwind: { kind: "escape" } };
    body.blocks[9].terminator.next = 10;
    body.blocks.push({ ...site("return"), id: 10, statements: [{ ...site("o!"), kind: "assign", place: 9, value: { kind: "use", operand: p(12) }, step: null }],
      terminator: { ...site("return"), kind: "return", value: p(9) } });
  });
  const receiving = passing => ({ ...context, source: { ...context.source,
    locals: [...context.source.locals, { ...context.source.locals[2], id: 4, name: "this" }],
    params: [{ ...context.source.params[2], local: 4, role: "this", passing }, ...context.source.params] } });
  assert.deepEqual(lawRules(viewOfReceiver, receiving("by-value")), []);
  assert.deepEqual(lawRules(viewOfReceiver, receiving("byref-readwrite")), ["checked-place-available"]);
  assert.deepEqual(lawRules(viewOfReceiver, receiving("borrow-shared")), ["checked-place-available"]);
  // `a[ref i]` is supported source: the value of `i` is saved once in a private local and that local is the index.
  // The satisfying graph is that lowering (local 7 is the copy), and it stays valid when `i` is by reference.
  assert.deepEqual(found(good(), passed(1, "byref-readwrite")).filter(violation => LAW_RULES.has(violation.rule)), []);
});

test("law 8: a storage marker is about a slot the body owns (K-3278)", () => {
  const passed = (parameter, passing) => ({ ...context, source: { ...context.source,
    params: context.source.params.map((row, position) => position === parameter ? { ...row, passing } : row) } });
  const rules = (body, given) => found(body, given).map(violation => violation.rule);
  // The slot of `a` ends after its last use, before the return.
  const ended = changed(body => { body.blocks[7].statements.push({ ...site("return"), kind: "storage-dead", local: 0 }); });
  // Passed by value or moved, the slot is the body's own and may end.
  assert.deepEqual(rules(ended, context), []);
  assert.deepEqual(rules(ended, passed(0, "move")), []);
  // Passed by reference, the local is the caller's storage: the body does not end it. That is the only finding.
  assert.deepEqual(rules(ended, passed(0, "byref-readwrite")), ["storage-marker-exact"]);
  assert.deepEqual(rules(ended, passed(0, "borrow-shared")), ["storage-marker-exact"]);
  // A begin marker on it is refused as on every local present on entry, whatever its passing.
  const begun = changed(body => { body.blocks[0].statements.unshift({ ...site("for"), kind: "storage-live", local: 0 }); });
  assert.deepEqual(rules(begun, context), ["storage-marker-exact"]);
  assert.deepEqual(rules(begun, passed(0, "byref-readwrite")), ["storage-marker-exact"]);
  // A local that names the source local of a row passed by reference is the caller's storage whatever its role:
  // the satisfying graph begins local 3, and here a row passed by reference has that source local.
  const named = { ...context, source: { ...context.source,
    params: [...context.source.params, { ...context.source.params[1], local: 3, role: "rest", passing: "byref-readwrite" }] } };
  assert.deepEqual(found(good(), named).filter(violation => violation.rule === "storage-marker-exact").map(violation => violation.site.statement), [0]);
  // The receiver, whose local names the source local of the row of role `this`: its slot may end when its row is passed by value, and may not when it is passed by reference.
  const receiverEnded = changed(body => {
    body.locals.push(local(10, T.optInt32, { kind: "receiver" }, 4));
    body.blocks[7].statements.push({ ...site("return"), kind: "storage-dead", local: 10 });
  });
  const receiving = passing => ({ ...context, source: { ...context.source,
    locals: [...context.source.locals, { ...context.source.locals[2], id: 4, name: "this" }],
    params: [{ ...context.source.params[2], local: 4, role: "this", passing }, ...context.source.params] } });
  const markerRules = (body, given) => found(body, given).filter(violation => violation.rule === "storage-marker-exact").map(violation => violation.rule);
  assert.deepEqual(markerRules(receiverEnded, receiving("by-value")), []);
  assert.deepEqual(markerRules(receiverEnded, receiving("byref-readwrite")), ["storage-marker-exact"]);
});

test("a local of role receiver or parameter names the source local of its row", () => {
  const rule = (body, given = context) => found(body, given).filter(violation => violation.rule === "parameter-source-exact").map(violation => violation.site.local);
  assert.deepEqual(rule(good()), []);
  // Parameter 1 with no source local; naming the local of row 0; naming a local of another body; an index with no row.
  assert.deepEqual(rule(changed(body => { body.locals[1].source = null; })), [1]);
  assert.deepEqual(rule(changed(body => { body.locals[1].source = { body: BODY, local: 0 }; })), [1]);
  assert.deepEqual(rule(changed(body => { body.locals[1].source = { body: bodyId("laws.use"), local: 1 }; })), [1]);
  assert.deepEqual(rule(changed(body => { body.locals[1].role = { kind: "parameter", index: 3 }; })), [1]);
  // The receiver names the local of the row of role `this` (source local 4 here); the other rows are counted without it.
  const receiving = { ...context, source: { ...context.source,
    locals: [...context.source.locals, { ...context.source.locals[2], id: 4, name: "this" }],
    params: [{ ...context.source.params[2], local: 4, role: "this" }, ...context.source.params] } };
  const withReceiver = named => changed(body => { body.locals.push(local(10, T.optInt32, { kind: "receiver" }, named)); });
  assert.deepEqual(rule(withReceiver(4), receiving), []);
  assert.deepEqual(rule(withReceiver(null), receiving), [10]);
  assert.deepEqual(rule(withReceiver(2), receiving), [10]);
  // A receiver in a body whose typed body has no row of role `this`.
  assert.deepEqual(rule(withReceiver(4), context), [10]);
});

test("check-place-single compares the views of one node kind by kind", () => {
  const viewAt = (id, projection) => place(id, { kind: "checked", place: 8, projection, tir: site("a[i]").tir }, T.int32);
  const constantIndex = constant => ({ kind: "index", operand: { kind: "constant", constant } });
  // One view of each other kind beside the element a[i]: five kinds, no two alike.
  assert.deepEqual(laws(changed(body => { body.places.push(viewAt(11, { kind: "field", member: INDEX }), viewAt(12, { kind: "element", index: 0 }),
    viewAt(13, { kind: "deref" }), viewAt(14, { kind: "capture", index: 0 })); })), []);
  // Two positional views: the same position, and two positions.
  assert.deepEqual(laws(changed(body => { body.places.push(viewAt(11, { kind: "element", index: 0 }), viewAt(12, { kind: "element", index: 0 })); })), []);
  assert.deepEqual(laws(changed(body => { body.places.push(viewAt(11, { kind: "element", index: 0 }), viewAt(12, { kind: "element", index: 1 })); })), ["check-place-single"]);
  // Two views of a kind without a position are the same view.
  assert.deepEqual(laws(changed(body => { body.places.push(viewAt(11, { kind: "deref" }), viewAt(12, { kind: "deref" })); })), []);
  // A second element view indexed by the same place is the same view; indexed by another place it is another.
  assert.deepEqual(laws(changed(body => { body.places.push(viewAt(11, { kind: "index", operand: p(7) })); })), []);
  assert.deepEqual(laws(changed(body => { body.places.push(viewAt(11, { kind: "index", operand: p(9) })); })), ["check-place-single"]);
  // The element a[i] is indexed by a place; a second element view indexed by a constant is another view.
  assert.deepEqual(laws(changed(body => { body.places.push(viewAt(11, constantIndex(0))); })), ["check-place-single"]);
  // With a constant index first: the same constant, another constant, a place.
  const constantFirst = second => changed(body => { body.places[10].base.projection = constantIndex(0); body.places.push(viewAt(11, second)); });
  assert.deepEqual(laws(constantFirst(constantIndex(0))), []);
  assert.deepEqual(laws(constantFirst(constantIndex(1))), ["check-place-single"]);
  assert.deepEqual(laws(constantFirst({ kind: "index", operand: p(7) })), ["check-place-single"]);
});

test("a call of an internal body stands at the node that names the body, or is the default of a parameter", () => {
  const DEFAULT = bodyId("laws.o", "default");
  const callee = { kind: "body", instance: { body: DEFAULT, bindings: PARAMETRIC }, captures: [] };
  // The omission prologue (block 8) runs the default of `o` into `o`; with a receiver in the second graph.
  const prologue = receiver => changed(body => {
    body.blocks[8] = { ...site("for"), id: 8, statements: [], terminator: { ...site("for"), kind: "call", callee, receiver, arguments: [],
      destination: 2, next: 0, unwind: { kind: "escape" }, step: null } };
  });
  const withDefault = { ...context, source: { ...context.source, params: context.source.params.map((parameter, position) =>
    position === 2 ? { ...parameter, role: "default", initializer: DEFAULT } : parameter) } };
  const rules = (body, given) => found(body, given).map(violation => violation.rule);
  // The body is the default of the parameter: the call is not refused as unselected.
  assert.equal(rules(prologue(null), withDefault).includes("operation-selected"), false);
  assert.equal(rules(prologue(p(0)), withDefault).includes("operation-selected"), false);
  // No parameter and no node names it.
  assert.equal(rules(prologue(null), context).includes("operation-selected"), true);
});

test("law 3: a stable place stays available across a suspension; a mutable one does not", () => {
  const suspendedThen = statement => staged(body => {
    body.blocks[7].terminator = checkOf(12, "o!", 10);
    body.blocks.push(blockOf(10, [], { ...site("return"), kind: "await", operand: p(4), destination: 5, resume: 11, unwind: { kind: "escape" }, step: null }),
      blockOf(11, [statement], returns(p(9))));
  });
  assert.deepEqual(allAsync(suspendedThen(readView())), []);
  assert.deepEqual(allAsync(suspendedThen(READ())), ["checked-place-available"]);
});

test("law 3: success of a check makes the place available; it does not stand for the state of its storage (point 6)", () => {
  // A store into an available checked place needs no earlier read of it.
  assert.deepEqual(all(changed(body => { body.blocks[7].statements = [STORE()]; body.blocks[7].terminator = returns(p(1)); })), []);
  // The check of a[i] succeeded, and the receiver's storage was never begun: the liveness rule still reports it.
  const rules = all(changed(body => { body.blocks[0].statements = body.blocks[0].statements.filter(statement => statement.local !== 8); }));
  assert.ok(rules.includes("storage-live-before-use"));
  assert.ok(!rules.includes("checked-place-available"));
});

test("law 3: a store after a call is checked again through the same saved receiver and index (point 7; WT-6 order, orderGrow)", () => {
  // a[i] is read, `bump` is called, a[i] is checked again and stored: two control points over one place.
  const again = (body, checked) => {
    callAfterRead(body);
    body.blocks[9] = { ...site("a[i]"), id: 9, statements: [], terminator: { ...site("a[i]"), kind: "check", place: checked, next: 10, unwind: { kind: "escape" } } };
    body.blocks.push({ ...site("a[i]"), id: 10, statements: [{ ...STORE(), place: checked }], terminator: returns(p(9)) });
  };
  assert.deepEqual(all(changed(body => { again(body, 10); })), []);
  // No second check.
  assert.deepEqual(all(changed(body => { callAfterRead(body); body.blocks[9] = { ...site("a[i]"), id: 9, statements: [STORE()], terminator: returns(p(9)) }; })),
    ["checked-place-available"]);
  // A second check that resolves the element again from the parameter, not from the saved receiver.
  assert.deepEqual(all(changed(body => {
    body.places.push(place(11, { kind: "checked", place: 0, projection: { kind: "index", operand: p(7) }, tir: site("a[i]").tir }, T.int32));
    again(body, 11);
  })), ["check-place-single"]);
});

test("law 6: a record that performs a step of its node's protocol names the step (R1, R2 L-2)", () => {
  // The iteration's `next` step with no step named.
  assert.deepEqual(all(changed(body => { body.blocks[1].terminator.step = null; })), ["protocol-step-exact"]);
  // The `done` step with no step named: the record is reported, and so is the branch, which names a step no record performs.
  assert.deepEqual(all(changed(body => { body.blocks[2].terminator.step = null; })), ["protocol-step-exact", "protocol-step-exact"]);
  // The completion branch with no step named, its targets exchanged: the branch on the result of the `done` step is
  // reported, and so is the `done` step, which has no branch that names it.
  assert.deepEqual(all(changed(body => { const branch = body.blocks[3].terminator;
    branch.step = null; branch.targets = [{ constant: 1, target: 4 }]; branch.otherwise = 9; })), ["protocol-step-exact", "protocol-step-exact"]);
  // A record that names a step executes that step's operation: the `next` operation named as the `value` step.
  assert.deepEqual(all(changed(body => { body.blocks[1].terminator.step = step(3); })), ["protocol-step-exact"]);
});

test("law 6: a protocol step names a step of a protocol of its node, in the form of that step", () => {
  // "a protocol step names its step".
  assert.deepEqual(laws(changed(body => { body.blocks[1].terminator.step = { protocol: 1, step: 1 }; })), ["protocol-step-exact"]);
  assert.deepEqual(laws(changed(body => { body.blocks[1].terminator.step = { protocol: 0, step: 9 }; })), ["protocol-step-exact"]);
  // A call cannot be a step whose selection has no callee.
  assert.deepEqual(laws(changed(body => { body.blocks[5].terminator.tir = site("for").tir; body.blocks[5].terminator.step = step(1); })), ["protocol-step-exact"]);
  // Only the `done` step is branched on: the branch names another step, and the `done` step is left without its branch.
  assert.deepEqual(laws(changed(body => { body.blocks[3].terminator.step = step(1); })), ["protocol-step-exact", "protocol-step-exact"]);
});

test("law 6: the result of a completion test goes into a local that nothing else writes (R2 M-4)", () => {
  // The completion branch is found by the local the `done` step wrote; a second writer of that local would make an
  // ordinary branch on it look like a completion branch.
  assert.deepEqual(all(changed(body => { body.blocks[6].statements.push(
    { ...site("a[i]"), kind: "assign", place: 6, value: { kind: "use", operand: { kind: "constant", constant: 1 } }, step: null }); })), ["protocol-step-exact"]);
});

test("law 6: the result of a completion test is read by exactly one record, the branch that names its step (R1 N-2)", () => {
  // The `done` step delivers nowhere: it has no result to branch on, and the branch names a step with no result.
  assert.deepEqual(laws(changed(body => { body.blocks[2].terminator.destination = null; })), ["protocol-step-exact", "protocol-step-exact"]);
  // The result is also read by another record.
  assert.deepEqual(laws(changed(body => { body.blocks[7].statements.push(
    { ...site("return"), kind: "assign", place: 9, value: { kind: "use", operand: p(6) }, step: null }); })), ["protocol-step-exact"]);
  // The result is never branched on: the loop has no completion edge.
  assert.deepEqual(laws(changed(body => { body.blocks[3].terminator = { ...site("for"), kind: "goto", target: 4 }; })), ["protocol-step-exact"]);
  // R1: the branch is on a copy of the result, unnamed and with its targets exchanged.
  assert.deepEqual(laws(changed(body => {
    body.locals.push(local(10, T.bool, { kind: "temporary" }));
    body.places.push(place(11, { kind: "local", local: 10 }, T.bool));
    body.blocks[0].statements.push({ ...site("for"), kind: "storage-live", local: 10 });
    body.blocks[3].statements.push({ ...site("for"), kind: "assign", place: 11, value: { kind: "use", operand: p(6) }, step: null });
    body.blocks[3].terminator = { ...site("for"), kind: "switch", operand: p(11), targets: [{ constant: 1, target: 4 }], otherwise: 9, step: null };
  })), ["protocol-step-exact"]);
  // A branch that names the `done` step and reads another local.
  assert.deepEqual(laws(changed(body => { body.blocks[3].terminator.operand = p(1); })), ["protocol-step-exact", "protocol-step-exact"]);
});

test("law 6: a statement that executes a step's operation is held to the same rule as a control point", () => {
  // A step is a statement exactly when its decision is pure (law 2). The same source, with a `value` step that is pure:
  const pureValue = { ...context, source: typed({ ...ITERATE, steps: [...ITERATE.steps.slice(0, 3), { role: "value", operation: PURE_OPERATION, callee: null }] }).tir };
  const otherPure = { ...PURE_OPERATION, decision: { ...PURE_OPERATION.decision, operation: { ...PURE_OPERATION.decision.operation, declaration: def("laws.done") } } };
  // Block 4 performs the `value` step as a statement and continues to the loop's body.
  const stepStatement = (operation, named) => changed(body => {
    body.blocks[4].statements.push({ ...site("for"), kind: "assign", place: 3, value: { kind: "unary", operation, operand: p(5) }, step: named });
    body.blocks[4].terminator = { ...site("for"), kind: "goto", target: 5 };
  });
  const rules = (body, given) => found(body, given).filter(violation => LAW_RULES.has(violation.rule)).map(violation => violation.rule);
  // It names the step whose operation it executes.
  assert.deepEqual(rules(stepStatement(PURE_OPERATION, step(3)), pureValue), []);
  // It executes a step's operation and names no step.
  assert.deepEqual(rules(stepStatement(PURE_OPERATION, null), pureValue), ["protocol-step-exact"]);
  // It names a step and executes another operation.
  assert.deepEqual(rules(stepStatement(otherPure, step(3)), pureValue), ["protocol-step-exact"]);
  // In the unchanged source the `value` step is an invocation: as a statement it names its step and is refused by law 2.
  assert.deepEqual(rules(stepStatement(VALUE, step(3)), context), ["statement-pure"]);
});

/** Block 7 ends in a suspension at the given node (a label, or a site record), continuing to a new block 10 that returns. */
const suspendAt = (body, node, kind, named) => {
  const at = typeof node === "string" ? site(node) : node;
  const common = { ...at, kind, destination: 5, resume: 10, unwind: { kind: "escape" }, step: named };
  body.blocks[7].terminator = kind === "await" ? { ...common, operand: p(4) }
    : kind === "yield" ? { ...common, operand: p(4), return: { destination: 5, target: 10 } }
      : { ...common, iterator: p(4), return: { destination: 5, target: 10 } };
  body.blocks.push({ ...site("return"), id: 10, statements: [], terminator: { ...site("return"), kind: "return", value: p(9) } });
};

test("law 6: a suspension names its protocol, and the step it performs where one is listed", () => {
  const asynchronous = { ...context, source: { ...context.source, asynchronous: true } };
  const generator = { ...context, source: { ...context.source, generator: true } };
  const rules = (given, node, kind, named) => found(changed(body => { suspendAt(body, node, kind, named); }), given)
    .filter(violation => LAW_RULES.has(violation.rule)).map(violation => violation.rule);
  const first = { protocol: 0, step: 0 };
  // An await whose protocol lists no step names the protocol.
  assert.deepEqual(rules(asynchronous, "await#bare", "await", first), []);
  assert.deepEqual(rules(asynchronous, "await#bare", "await", null), ["protocol-step-exact"]);
  assert.deepEqual(rules(asynchronous, "await#bare", "await", { protocol: 0, step: 1 }), ["protocol-step-exact"]);
  assert.deepEqual(rules(asynchronous, "await#bare", "await", { protocol: 1, step: 0 }), ["protocol-step-exact"]);
  // An await whose protocol lists its step names that step.
  assert.deepEqual(rules(asynchronous, "await#step", "await", first), []);
  assert.deepEqual(rules(asynchronous, "await#step", "await", null), ["protocol-step-exact"]);
  // A step of another role is not an await: the iteration's `next`.
  assert.deepEqual(rules(asynchronous, "for", "await", step(1)), ["protocol-step-exact"]);
  // At a node that has no await protocol an await names nothing.
  assert.deepEqual(rules(asynchronous, "return", "await", null), []);
  // A yield and a delegation name their protocol.
  assert.deepEqual(rules(generator, "yield", "yield", first), []);
  assert.deepEqual(rules(generator, "yield", "yield", null), ["protocol-step-exact"]);
  assert.deepEqual(rules(generator, "yield", "yield", { protocol: 1, step: 0 }), ["protocol-step-exact"]);
  assert.deepEqual(rules(generator, "yield", "yield", { protocol: 0, step: 3 }), ["protocol-step-exact"]);
  assert.deepEqual(rules(generator, "yield*", "delegate", first), []);
  assert.deepEqual(rules(generator, "yield*", "yield", first), ["protocol-step-exact"]);
  assert.deepEqual(rules(generator, "return", "yield", null), []);
  // A suspension at a node the body does not have is reported by the rule of law 10, and by no law rule here.
  const nowhere = { origin: site("return").origin, tir: { body: BODY, node: 9999 } };
  assert.deepEqual(rules(asynchronous, nowhere, "await", null), []);
  assert.deepEqual(rules(generator, nowhere, "yield", null), []);
  // Law 5: a yield stands only in a generator.
  assert.deepEqual(rules(context, "yield", "yield", first), ["suspension-admitted"]);
  assert.deepEqual(rules(context, "yield*", "delegate", first), ["suspension-admitted"]);
});

test("law 6: the completion branch of an iteration has one canonical shape", () => {
  // "the completion branch of an iteration has one canonical shape": one listed target, the constant true; otherwise elsewhere.
  assert.deepEqual(laws(changed(body => { body.blocks[3].terminator.targets = []; })), ["completion-branch-canonical"]);
  assert.deepEqual(laws(changed(body => { body.blocks[3].terminator.otherwise = 9; })), ["completion-branch-canonical"]);
  assert.deepEqual(laws(changed(body => { body.constants[1].value.value.value = false; })), ["completion-branch-canonical"]);
});

test("law 7: entries are ordered by supplied count and offer only admissible counts", () => {
  // "entries are ordered by supplied count and offer only admissible counts".
  assert.deepEqual(laws(changed(body => { body.entries.reverse(); })), ["entries-exact"]);
  assert.deepEqual(laws(changed(body => { body.entries = []; })), ["entries-exact"]);
  assert.deepEqual(laws(changed(body => { body.entries[0].block = 8; })), ["entries-exact"]);
  // `i` is required: an entry that omits it is not admissible.
  assert.deepEqual(laws(changed(body => { body.entries.push({ provided: 1, block: 8 }); })), ["entries-exact"]);
  // One entry per admissible count (R2, L-3): `o` may be omitted, so the full count alone is not the list.
  assert.deepEqual(all(changed(body => { body.entries = [{ provided: 3, block: 0 }]; })), ["entries-exact"]);
  assert.deepEqual(laws(changed(body => { body.entries = [{ provided: 3, block: 0 }, { provided: 3, block: 8 }]; })), ["entries-exact"]);
});

test("law 7: a call may omit only what the callee's signature lets be omitted", () => {
  // `use(v: int32)` has one required parameter.
  assert.deepEqual(laws(changed(body => { body.blocks[5].terminator.arguments = [{ kind: "omitted" }]; })), ["omission-admitted"]);
  // Omitted arguments are a suffix (R2, L-3): an entry is named by a count. `two(x?: int32, y?: int32)` is not the
  // callee of this node, so the complete list also has the selection finding; only the law rules are compared.
  const two = (...argumentList) => changed(body => { body.blocks[5].terminator.callee = { kind: "direct", resolution: TWO_CALLEE };
    body.blocks[5].terminator.arguments = argumentList; });
  const supplied = { kind: "value", passing: "by-value", operand: p(2) };
  assert.deepEqual(laws(two(supplied, { kind: "omitted" })), []);
  assert.deepEqual(laws(two({ kind: "omitted" }, { kind: "omitted" })), []);
  assert.deepEqual(laws(two({ kind: "omitted" }, supplied)), ["omission-admitted"]);
});

test("law 8: a local that is present on entry carries no begin marker", () => {
  // "a begin marker on a present slot ends it first; entry-present locals carry no begin marker".
  assert.deepEqual(laws(changed(body => { body.blocks[0].statements.unshift({ ...site("for"), kind: "storage-live", local: 1 }); })), ["storage-marker-exact"]);
});

test("law 9: no effect occurrence is emitted twice", () => {
  // "no effect occurrence is emitted twice".
  const doubled = changed(body => {
    body.blocks.push({ ...site("use(v)"), id: 9, statements: [], terminator: { ...body.blocks[5].terminator, next: 1 } });
    body.blocks[5].terminator.next = 9;
  });
  assert.deepEqual(laws(doubled), ["effect-site-unique"]);
  // Two different steps of one node are two occurrences.
  assert.deepEqual(laws(good()).filter(rule => rule === "effect-site-unique"), []);
});

test("law 5: the completion of a handle is one record: a step has one completion branch", () => {
  // "one representation per execution event". A second branch on the same `done` step, reached when the first is not taken.
  assert.deepEqual(all(changed(body => {
    body.blocks.push({ ...site("for"), id: 10, statements: [], terminator: { ...body.blocks[3].terminator, targets: [{ constant: 1, target: 9 }] } });
    body.blocks[3].terminator.otherwise = 10;
  })), ["effect-site-unique", "protocol-step-exact"]);
  // (the second finding is law 6's: the result of the `done` step is read by two records, not by its one branch)
});

test("law 10: every record names a node of the typed body", () => {
  // "every record names a node of the typed body": a projected place included.
  const rules = found(changed(body => { body.places[10].base.tir = { body: BODY, node: 9999 }; })).map(violation => violation.rule);
  assert.ok(rules.includes("tir-node-resolves"));
});

test("an omission prologue is reachable from its entry: a use in it of a local that was never begun is seen", () => {
  // Reachability starts at every entry (law 7 gives a body several starts).
  const rules = found(changed(body => { body.blocks[8].statements[0].value = { kind: "use", operand: p(9) }; })).map(violation => violation.rule);
  assert.ok(rules.includes("storage-live-before-use"));
});

test("constants ordered by the published key satisfy the order the verifier requires, and no other order does", () => {
  // The contract: "A body's constants are unique by this key and listed in its order". A producer that sorts by
  // `constantKeyOfMir` and the verifier use one function.
  const keys = good().constants.map(constant => constantKeyOfMir(constant.type, constant.value));
  assert.deepEqual([...keys].sort(), keys);
  assert.equal(new Set(keys).size, keys.length);
  const swapped = changed(body => {
    body.constants = [{ ...body.constants[1], id: 0 }, { ...body.constants[0], id: 1 }];
    body.blocks[3].terminator.targets[0].constant = 0;
    body.blocks[8].statements[0].value.operand.constant = 1;
  });
  assert.ok(found(swapped).map(violation => violation.rule).includes("constants-order"));
  const repeated = changed(body => { body.constants.push({ ...body.constants[1], id: 2 }); });
  assert.ok(found(repeated).map(violation => violation.rule).includes("constant-unique"));
});
