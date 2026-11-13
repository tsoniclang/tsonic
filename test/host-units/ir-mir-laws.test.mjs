// Cases for the graph laws of a lowered body (COMPONENTS section 7 part 9, laws 1 and 4 to 10; S2-18).
// One hand-written graph satisfies them; each other case changes one thing and names the law it breaks.
// Law 2 and the agreement of failure kinds with decisions wait for the decision fields (S2-11); law 3 is
// not decided (C-3181) and has no case here.
//   function laws(a: int32[], i: int32, o?: int32): int32 { for (const v of a) { use(v); } return a[i]; }
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { EMPTY_BINDINGS, PARAMETRIC, T, TABLE, bodyId, builders, def, signature, typedBody, value } from "./fixtures/lower-mir/typed.mjs";

const SIG_LAWS = signature("laws", [["a", T.int32Array], ["i", T.int32], ["o", T.optInt32, "optional"]], T.int32);
const SIG_USE = signature("laws.use", [["v", T.int32]], T.void);
const coreOperation = (name, operands, result) => ({ decision: { kind: "selected",
  operation: { kind: "core", declaration: def(name), bindings: EMPTY_BINDINGS }, operands, result }, permissionScope: null });
const ACQUIRE = coreOperation("laws.acquire", [T.int32Array], T.unknown);
const NEXT = coreOperation("laws.next", [T.unknown], T.unknown);
const DONE = coreOperation("laws.done", [T.unknown], T.bool);
const VALUE = coreOperation("laws.value", [T.unknown], T.int32);
const endpoint = (name, role, sig) => ({ declaration: def(name), role, signature: sig, body: bodyId(name) });
const USE_CALLEE = { decision: { candidate: 0, advertised: endpoint("laws.use", "advertised", SIG_USE), api: endpoint("laws.use", "api-body", SIG_USE),
  bindings: EMPTY_BINDINGS, implementationBindings: EMPTY_BINDINGS, parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }],
  completion: { signature: SIG_USE, completion: T.void, yielded: null, sent: null }, result: T.void },
  activation: { body: bodyId("laws.use"), bindings: PARAMETRIC }, captures: [] };
const ITERATE = { kind: "iterate", asynchronous: false, value: T.int32, completion: T.void, sent: null, thrown: T.unknown,
  steps: [{ role: "acquire", operation: ACQUIRE, callee: null }, { role: "next", operation: NEXT, callee: null },
    { role: "done", operation: DONE, callee: null }, { role: "value", operation: VALUE, callee: null }] };
const INDEX = { decision: { key: { kind: "text", value: "index" }, origins: [], selectedDeclarations: [], primary: null, read: T.int32, write: T.int32,
  getter: null, setter: null, bindings: EMPTY_BINDINGS }, getter: null, setter: null };

const b = builders("laws");
const source = typedBody("laws", { signature: SIG_LAWS, completion: T.int32,
  locals: [["a", "parameter", T.int32Array], ["i", "parameter", T.int32], ["o", "parameter", T.optInt32], ["v", "binding", T.int32]],
  params: [[0, "required", T.int32Array], [1, "required", T.int32], [2, "optional", T.optInt32]],
  root: b.block(
    { $: "for", ...b.forOf(b.declarationList([b.variable(b.declName("v", 3), 3, T.int32)]), b.id("a", 0, T.int32Array),
      b.block(b.expressionStatement({ $: "use(v)", ...b.call(b.global("use", "laws.use", T.unknown), [{ $: "v", ...b.id("v", 3, T.int32) }], T.void,
        at => ({ callee: USE_CALLEE, receiver: null, arguments: [{ kind: "provided", parameter: 0, expression: at("v") }] })) })), ITERATE) },
    { $: "return", ...b.returns({ $: "a[i]", ...b.element({ $: "a", ...b.id("a", 0, T.int32Array) }, { $: "i", ...b.id("i", 1, T.int32) },
      { ...value(T.int32), role: "value", selection: { kind: "decided", decision: INDEX } }) }) }) });

const BODY = bodyId("laws");
const site = label => ({ origin: { module: "M[P[p];m]", start: source.at(label), length: 1, derived: [] }, tir: { body: BODY, node: source.at(label) } });
const local = (id, storage, role, sourceLocal = null) => ({ id, storage, role, source: sourceLocal === null ? null : { body: BODY, local: sourceLocal },
  origin: site("for").origin });
const place = (id, base, storage) => ({ id, base, storage, origin: site("for").origin });
const p = id => ({ kind: "place", place: id });
const step = index => ({ protocol: 0, step: index });

/** The graph that satisfies every law. Places 0 to 9 are the locals 0 to 9; place 10 is the checked element a[i]. */
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
        terminator: { ...site("for"), kind: "switch", operand: p(6), targets: [{ constant: 1, target: 6 }], otherwise: 4, step: step(2) } },
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
    ],
    result: T.int32,
  };
}

const LAW_RULES = new Set(["failure-kind-exact", "check-place-exact", "refined-under-check", "index-operand-stable", "protocol-step-exact",
  "completion-branch-canonical", "entries-exact", "omission-admitted", "storage-marker-exact", "effect-site-unique"]);
let verifyMir;
let printMir;
let parseMir;
let constantKeyOfMir;
let context;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "MIR law cases require a guarded admission");
  ({ verifyMir, printMir, parseMir, constantKeyOfMir } = await import("../../packages/host/dist/ir-mir/index.js"));
  const declaration = name => ({ scope: { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] }, parameterCount: 0, endpoints: [endpoint(name, "advertised", SIG_USE), endpoint(name, "api-body", SIG_USE)] });
  const declared = new Map(["laws", "laws.use", "laws.acquire", "laws.next", "laws.done", "laws.value"].map(name => [def(name), declaration(name)]));
  context = { source: source.tir, types: TABLE, declarationOf: definition => declared.get(definition) ?? null,
    bodyOwner: body => body === BODY ? def("laws") : body === bodyId("laws.use") ? def("laws.use") : null };
});

const laws = body => verifyMir(body, context).filter(violation => LAW_RULES.has(violation.rule)).map(violation => violation.rule);
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
  assert.deepEqual(verifyMir(good(), context).map(violation => `${violation.rule} at ${violation.site.kind}${"block" in violation.site ? ` ${violation.site.block}/${violation.site.statement}` : ""}`), []);
});

test("law 1: a check whose failure kind says it cannot fail is refused", () => {
  // "a check is a control point with one of three failure kinds (to a handler, out of the body, ending the process)".
  assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.unwind = { kind: "none" }; })), ["failure-kind-exact"]);
  for (const kind of ["escape", "abort"]) assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.unwind = { kind }; })), []);
});

test("law 1: a call cannot end the process or be unable to fail", () => {
  // A call runs code of its own: its failure unwinds, to a handler or out of the body (COMMON-DATA §4, exit by unwind).
  for (const kind of ["abort", "none"])
    assert.deepEqual(laws(changed(body => { body.blocks[5].terminator.unwind = { kind }; })), ["failure-kind-exact"]);
});

test("law 1: a check names a checked place at its own node", () => {
  // "a check is a control point": the control point and the place it tests are one occurrence.
  assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.place = 9; })), ["check-place-exact"]);
  assert.deepEqual(laws(changed(body => { body.blocks[6].terminator.tir = site("return").tir; })), ["check-place-exact"]);
});

test("a narrowed view exists only under a checked base", () => {
  // R2's verdict on C4, taken into S2-18: `refined` under a direct base would be a narrowing with no check.
  const add = kind => changed(body => { body.places.push(place(11, { kind, place: 2, projection: { kind: "refined" }, tir: site("a[i]").tir }, T.int32)); });
  assert.deepEqual(laws(add("place")), ["refined-under-check"]);
  assert.deepEqual(laws(add("checked")), []);
});

test("law 4: an index is a constant or a local written once", () => {
  // "a place's receiver and index, once evaluated, cannot be changed by a later write (… an index [is] held in
  // values written once …)".
  const twice = changed(body => { body.blocks[7].statements.push({ ...site("i"), kind: "assign", place: 7, value: { kind: "use", operand: p(1) }, step: null }); });
  assert.deepEqual(laws(twice), ["index-operand-stable"]);
  // A parameter the body never writes was written once, at entry.
  assert.deepEqual(laws(changed(body => { body.places[10].base.projection.operand = p(1); })), []);
  // A projected place is not a value written once.
  assert.deepEqual(laws(changed(body => { body.places[10].base.projection.operand = p(10); })), ["index-operand-stable"]);
});

test("law 6: a protocol step names a step of a protocol of its node, in the form of that step", () => {
  // "a protocol step names its step".
  assert.deepEqual(laws(changed(body => { body.blocks[1].terminator.step = { protocol: 1, step: 1 }; })), ["protocol-step-exact"]);
  assert.deepEqual(laws(changed(body => { body.blocks[1].terminator.step = { protocol: 0, step: 9 }; })), ["protocol-step-exact"]);
  // A call cannot be a step whose selection has no callee.
  assert.deepEqual(laws(changed(body => { body.blocks[5].terminator.tir = site("for").tir; body.blocks[5].terminator.step = step(1); })), ["protocol-step-exact"]);
  // Only the `done` step is branched on.
  assert.deepEqual(laws(changed(body => { body.blocks[3].terminator.step = step(1); })), ["protocol-step-exact"]);
});

test("law 6: the completion branch of an iteration has one canonical shape", () => {
  // "the completion branch of an iteration has one canonical shape": one listed target, the constant true; otherwise elsewhere.
  assert.deepEqual(laws(changed(body => { body.blocks[3].terminator.targets = []; })), ["completion-branch-canonical"]);
  assert.deepEqual(laws(changed(body => { body.blocks[3].terminator.otherwise = 6; })), ["completion-branch-canonical"]);
  assert.deepEqual(laws(changed(body => { body.constants[1].value.value.value = false; })), ["completion-branch-canonical"]);
});

test("law 7: entries are ordered by supplied count and offer only admissible counts", () => {
  // "entries are ordered by supplied count and offer only admissible counts".
  assert.deepEqual(laws(changed(body => { body.entries.reverse(); })), ["entries-exact", "entries-exact"]);
  assert.deepEqual(laws(changed(body => { body.entries = []; })), ["entries-exact"]);
  assert.deepEqual(laws(changed(body => { body.entries[0].block = 8; })), ["entries-exact"]);
  // `i` is required: an entry that omits it is not admissible.
  assert.deepEqual(laws(changed(body => { body.entries.push({ provided: 1, block: 8 }); })), ["entries-exact"]);
  // Offering fewer entries than are admissible is allowed; offering the full count alone is the smallest valid list.
  assert.deepEqual(laws(changed(body => { body.entries = [{ provided: 3, block: 0 }]; })), []);
});

test("law 7: a call may omit only what the callee's signature lets be omitted", () => {
  // `use(v: int32)` has one required parameter.
  assert.deepEqual(laws(changed(body => { body.blocks[5].terminator.arguments = [{ kind: "omitted" }]; })), ["omission-admitted"]);
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

test("law 10: every record names a node of the typed body", () => {
  // "every record names a node of the typed body": a projected place included.
  const rules = verifyMir(changed(body => { body.places[10].base.tir = { body: BODY, node: 9999 }; }), context).map(violation => violation.rule);
  assert.ok(rules.includes("tir-node-resolves"));
});

test("an omission prologue is reachable from its entry: a use in it of a local that was never begun is seen", () => {
  // Reachability starts at every entry (law 7 gives a body several starts).
  const rules = verifyMir(changed(body => { body.blocks[8].statements[0].value = { kind: "use", operand: p(9) }; }), context).map(violation => violation.rule);
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
  assert.ok(verifyMir(swapped, context).map(violation => violation.rule).includes("constants-order"));
  const repeated = changed(body => { body.constants.push({ ...body.constants[1], id: 2 }); });
  assert.ok(verifyMir(repeated, context).map(violation => violation.rule).includes("constant-unique"));
});
