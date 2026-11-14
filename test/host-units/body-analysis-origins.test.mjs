// Unit cases of the Origins kernel (packages/host/src/analyses/origins/analyze.ts, unit O-1a: the call-free values
// family; W12-1.plan.md). These are isolated-adapter unit cases (COMPONENTS:1543): the kernel is private, so the cases
// import its module directly. They are not a pipeline or composition claim.
//
// Inputs. Case K-1 is the real `add` of the lowering fixtures, lowered by `lowerToMir` and accepted by `verifyMir`.
// The other bodies are lowered graphs written by hand against the MIR contract and passed through the MIR text codec;
// they are not run through `verifyMir`, because their typed sources (aggregate and member decisions) are not written.
// Expected values are written from the plan's laws before any run: C1 (a scalar refers to no storage), allocation
// producers by site, a local's slot replaced by a store, a cell under a producer added to, entry symbols for cells
// under an entry producer, canonical arena order (receiver, parameters by index, allocations by site node; projections
// by path; origins by producer list), and refusal on passing a limit (K-3366).
import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { T, TABLE, direct, memberDecision, verificationContext } from "./fixtures/lower-mir/typed.mjs";
import { add, plus } from "./fixtures/lower-mir/programs/first.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeNames = ["analyze", "arena", "keys", "state"];
const runtimeFiles = runtimeNames.map(name => resolve(repository, `packages/host/dist/analyses/origins/${name}.js`));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let kernel;
let mir;
let ids;
let types;
let step;
let lowerMir;
let verifyMir;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "Origins kernel cases require a guarded admission");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  kernel = await import("../../packages/host/dist/analyses/origins/analyze.js");
  mir = await import("../../packages/host/dist/ir-mir/index.js");
  ids = await import("../../packages/host/dist/ids/index.js");
  types = await import("../../packages/host/dist/ir-types/index.js");
  step = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  ({ verifyMir } = mir);
  lowerMir = await import("../../packages/host/dist/lower-mir/index.js");
});

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const urls = new Set(runtimeFiles.map(file => pathToFileURL(file).href));
    const result = capture.result.filter(script => urls.has(script.url));
    const sources = [];
    for (const script of result) {
      const actual = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: actual.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (scriptUrl, text) => ({ path: fileURLToPath(scriptUrl), text }) }, runtimeFiles, [{ ...capture, result, sources }]);
    assert.equal(result.length, runtimeFiles.length, "every kernel file has source-identified coverage evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings));
    for (const file of report.files) {
      assert.equal(file.lines, 100, `${basename(file.path)} lines`);
      assert.equal(file.branches, 100, `${basename(file.path)} branches`);
      assert.equal(file.functions, 100, `${basename(file.path)} functions`);
    }
  } finally { session.disconnect(); }
});

const LIMITS = { maximumProjectionDepth: 8, maximumOriginAlternatives: 16, maximumRelationalRecordsPerBody: 10000,
  maximumRelationalReferencesPerBody: 10000 };
const FLOW = { maximumWork: 1_000_000, maximumResultEntries: 1_000_000 };

// The constructed bodies' own type table: 0 float64, 1 an object shape, 2 bool, 3 string, 4 a literal over float64.
const TERMS = [
  { kind: "primitive", primitive: "float64" },
  { kind: "shape", members: [], indexes: [], calls: [], constructs: [] },
  { kind: "primitive", primitive: "bool" },
  { kind: "string" },
  { kind: "literal", value: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } }, base: 0 },
];
const typeOf = type => TERMS[type];
const [F64, OBJ, BOOL, STR, ONE] = [0, 1, 2, 3, 4];

const MODULE = "M[P[origins];m]";
let BODY;
const body = () => {
  BODY ??= ids.encodeBodyId({ owner: ids.encodeDefId({ module: MODULE, segments: [{ name: "kernel", ordinal: 0 }] }), role: "function", ordinal: 0 });
  return BODY;
};
const origin = { module: MODULE, start: 0, length: 1, derived: [] };
const at = node => ({ origin, tir: { body: body(), node } });
const member = key => ({ decision: memberDecision(key, OBJ, OBJ, direct("in-place")), getter: null, setter: null });

/** A lowered body: locals as [role, type], places as [base, type], blocks as [statements, terminator]. */
function graph({ locals, places, blocks, constants = [], entries = [{ provided: 0, block: 0 }], bindings = { kind: "parametric" } }) {
  const value = {
    body: body(), bindings, entries,
    locals: locals.map(([role, storage], id) => ({ id, storage, role,
      source: role.kind === "parameter" || role.kind === "receiver" ? { body: body(), local: id } : null, origin })),
    constants: constants.map((constant, id) => ({ id, ...constant })),
    places: places.map(([base, storage], id) => ({ id, base, storage, origin })),
    blocks: blocks.map(([statements, terminator], id) => ({ ...at(0), id, statements, terminator })),
    result: OBJ,
  };
  const parsed = mir.parseMir(mir.printMir(value));
  assert.equal(parsed.kind, "parsed", "the constructed graph passes the MIR text codec");
  return parsed.value;
}

const local = id => ({ kind: "local", local: id });
const field = (place, key) => ({ kind: "place", place, projection: { kind: "field", member: member(key) }, tir: at(0).tir });
const use = place => ({ kind: "use", operand: { kind: "place", place } });
const assign = (place, value, node = 0) => ({ ...at(node), kind: "assign", place, value, step: null });
const object = fields => ({ kind: "aggregate", type: OBJ, aggregate: { kind: "object", fields: fields.map(([key, place]) => ({ member: member(key), value: { kind: "place", place } })) } });
const goto = target => ({ ...at(0), kind: "goto", target });
const ret = place => ({ ...at(99), kind: "return", value: place === null ? null : { kind: "place", place } });
const branch = (place, first, second) => ({ ...at(0), kind: "switch", operand: { kind: "place", place }, targets: [{ constant: 0, target: first }], otherwise: second, step: null });
const TRUE = { type: BOOL, value: { kind: "literal", value: { kind: "boolean", value: true } } };
const param = index => ({ kind: "parameter", index });
const user = { kind: "user" };

const run = (graphValue, limits = LIMITS, flow = FLOW, provided = 0) =>
  kernel.analyzeOriginsValues({ mir: graphValue, provided, typeOf, limits, flow });
const ok = result => { assert.equal(result.kind, "ok", result.kind === "ok" ? "ok" : JSON.stringify(result.diagnostics)); assert.deepEqual(result.diagnostics, []); return result.value; };
const refusedOn = (result, limit, maximum) => {
  assert.equal(result.kind, "refused");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.ok(JSON.stringify(result.diagnostics[0]).includes(limit), `${limit} named`);
  assert.ok(JSON.stringify(result.diagnostics[0]).includes(String(maximum)), `${maximum} named`);
};
const EMPTY_VECTOR = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
const bound = (id, producer = id) => ({ id, producer, bindings: EMPTY_VECTOR, context: 0 });
const complete = (id, producers, includesAbsence = false) => ({ id, producers, includesAbsence, kind: "complete" });

test("K-1: the real lowered add is all scalar: no producer, every origins the empty set", () => {
  const program = add("origins.add", T.float64, plus("float64", T.float64));
  const interner = types.seedTypeInterner(TABLE);
  const declared = verificationContext(program);
  const runState = { interner, table: TABLE, defs: { completionSelector: T.int32, exceptionStorage: T.unknown }, lowering: { maximumRecords: 1000 },
    verification: { maximumWork: 100000 }, declarationOf: declared.declarationOf, bodyOwner: declared.bodyOwner };
  const lowered = lowerMir.lowerToMir(step.lowerMirDeps(runState), program.tir, []);
  assert.equal(lowered.kind, "ok");
  assert.deepEqual(verifyMir(lowered.value, step.mirVerificationContext(runState, program.tir)), { kind: "complete", violations: [] });
  const returned = lowered.value.blocks.flatMap(block => block.terminator.kind === "return" ? [block.terminator] : []);
  const value = ok(kernel.analyzeOriginsValues({ mir: lowered.value, provided: 2, typeOf: type => types.readType(interner, type), limits: LIMITS, flow: FLOW }));
  assert.deepEqual(value.execution, { body: lowered.value.body, bindings: lowered.value.bindings, provided: 2 });
  assert.deepEqual(value.arena, { projections: [], producers: [], contexts: [{ id: 0, receiver: null, arguments: [0, 0], captures: [] }],
    boundProducers: [], origins: [complete(0, [])], boundaries: [] });
  assert.deepEqual(value.points, []);
  assert.deepEqual(value.subjects, returned.map(terminator => ({ node: terminator.tir.node, role: "return", path: null, origins: 0 })));
});

// function k2(p: Obj): Obj { const o = { f: p }; o.f = p; const r = o.f; return r; }
const k2 = () => graph({
  locals: [[param(0), OBJ], [user, OBJ], [user, OBJ]],
  places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ], [field(1, "f"), OBJ]],
  blocks: [[[assign(1, object([["f", 0]]), 7), assign(3, use(0)), assign(2, use(3))], ret(2)]],
});

test("K-2: an allocation's field cell holds what was stored into it; a projected store has a point row for its base", () => {
  const value = ok(run(k2()));
  assert.deepEqual(value.arena.producers, [{ id: 0, path: null, kind: "parameter", index: 0 },
    { id: 1, path: null, kind: "allocation", at: { kind: "node", node: { body: body(), node: 7 } } }]);
  assert.deepEqual(value.arena.boundProducers, [bound(0), bound(1)]);
  assert.deepEqual(value.arena.origins, [complete(0, [0]), complete(1, [1])]);
  assert.deepEqual(value.arena.contexts, [{ id: 0, receiver: null, arguments: [0], captures: [] }]);
  assert.deepEqual(value.points, [{ point: { block: 0, statement: 1 }, place: 1, origins: 1 }]);
  assert.deepEqual(value.subjects, [{ node: 99, role: "return", path: null, origins: 0 }]);
});

// function k3(p: Obj, q: Obj, c: bool): Obj { let r; if (c) r = p; else r = q; return r; }
const k3 = (renumbered = false) => {
  const thenBlock = [[assign(3, use(0))], goto(3)];
  const elseBlock = [[assign(3, use(1))], goto(3)];
  return graph({
    locals: [[param(0), OBJ], [param(1), OBJ], [param(2), BOOL], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), BOOL], [local(3), OBJ]],
    blocks: renumbered ? [[[], branch(2, 2, 1)], elseBlock, thenBlock, [[], ret(3)]] : [[[], branch(2, 1, 2)], thenBlock, elseBlock, [[], ret(3)]],
  });
};

test("K-3: a join holds both producers, and the arena does not depend on block numbering", () => {
  const value = ok(run(k3()));
  assert.deepEqual(value.arena.producers, [{ id: 0, path: null, kind: "parameter", index: 0 }, { id: 1, path: null, kind: "parameter", index: 1 }]);
  assert.deepEqual(value.arena.origins, [complete(0, []), complete(1, [0]), complete(2, [0, 1]), complete(3, [1])]);
  assert.deepEqual(value.arena.contexts, [{ id: 0, receiver: null, arguments: [1, 3, 0], captures: [] }]);
  assert.deepEqual(value.subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
  assert.deepEqual(ok(run(k3(true))).arena, value.arena);
  // One branch alone: one producer.
  const single = graph({ locals: [[param(0), OBJ], [user, OBJ]], places: [[local(0), OBJ], [local(1), OBJ]],
    blocks: [[[assign(1, use(0))], ret(1)]] });
  assert.deepEqual(ok(run(single)).subjects, [{ node: 99, role: "return", path: null, origins: 0 }]);
  assert.deepEqual(ok(run(single)).arena.origins, [complete(0, [0])]);
});

test("K-4: a loop reaches its fixed point with both producers at the exit", () => {
  const loop = graph({
    locals: [[param(0), OBJ], [param(1), OBJ], [param(2), BOOL], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), BOOL], [local(3), OBJ]],
    blocks: [[[assign(3, use(0))], goto(1)], [[], branch(2, 2, 3)], [[assign(3, use(1))], goto(1)], [[], ret(3)]],
  });
  assert.deepEqual(ok(run(loop)).subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
});

test("K-5: a store into a field cell adds; a store into a local's slot replaces", () => {
  const fields = graph({
    locals: [[param(0), OBJ], [param(1), OBJ], [user, OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ], [field(2, "f"), OBJ], [local(3), OBJ]],
    blocks: [[[assign(2, object([["f", 0]]), 5), assign(3, use(1)), assign(4, use(3))], ret(4)]],
  });
  const added = ok(run(fields));
  assert.deepEqual(added.arena.origins, [complete(0, [0]), complete(1, [0, 1]), complete(2, [1]), complete(3, [2])]);
  assert.deepEqual(added.subjects, [{ node: 99, role: "return", path: null, origins: 1 }]);
  const slot = graph({
    locals: [[param(0), OBJ], [param(1), OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ]],
    blocks: [[[assign(2, use(0)), assign(2, use(1))], ret(2)]],
  });
  const replaced = ok(run(slot));
  assert.deepEqual(replaced.arena.origins, [complete(0, [0]), complete(1, [1])]);
  assert.deepEqual(replaced.subjects, [{ node: 99, role: "return", path: null, origins: 1 }]);
});

// function k8(p: Obj): Obj { return p.f; }
const k8 = () => graph({
  locals: [[param(0), OBJ], [user, OBJ]],
  places: [[local(0), OBJ], [field(0, "f"), OBJ], [local(1), OBJ]],
  blocks: [[[assign(2, use(1))], ret(2)]],
});

test("K-8: a cell under an entry producer holds its entry symbol, the producer with that path", () => {
  const value = ok(run(k8()));
  assert.equal(value.arena.projections.length, 1);
  assert.equal(value.arena.projections[0].id, 0);
  assert.equal(value.arena.projections[0].parent, null);
  assert.equal(value.arena.projections[0].projection.kind, "field");
  assert.deepEqual(value.arena.projections[0].projection.member.decision.key, { kind: "text", value: "f" });
  assert.deepEqual(value.arena.producers, [{ id: 0, path: null, kind: "parameter", index: 0 }, { id: 1, path: 0, kind: "parameter", index: 0 }]);
  assert.deepEqual(value.arena.origins, [complete(0, [0]), complete(1, [1])]);
  assert.deepEqual(value.subjects, [{ node: 99, role: "return", path: null, origins: 1 }]);
});

test("C1: string, literal and bool values refer to no storage; an absence constant may be absent", () => {
  const scalars = graph({
    locals: [[param(0), STR], [param(1), ONE], [param(2), BOOL], [user, OBJ]],
    places: [[local(0), STR], [local(1), ONE], [local(2), BOOL], [local(3), OBJ]],
    constants: [{ type: OBJ, value: { kind: "literal", value: { kind: "absence" } } }],
    blocks: [[[assign(3, { kind: "use", operand: { kind: "constant", constant: 0 } })], ret(3)]],
  });
  const value = ok(run(scalars));
  assert.deepEqual(value.arena.producers, []);
  assert.deepEqual(value.arena.origins, [complete(0, []), complete(1, [], true)]);
  assert.deepEqual(value.arena.contexts, [{ id: 0, receiver: null, arguments: [0, 0, 0], captures: [] }]);
  assert.deepEqual(value.subjects, [{ node: 99, role: "return", path: null, origins: 1 }]);
});

test("K-9: a record of a family not written yet is a named frontier, with no partial facts", () => {
  const frontierOf = (blocks, places = [[local(0), OBJ], [local(1), OBJ]], locals = [[param(0), OBJ], [user, OBJ]], constants = []) =>
    () => run(graph({ locals, places, blocks, constants }));
  const call = { ...at(0), kind: "invoke", operation: { decision: { kind: "selected", operation: { kind: "discard" }, operands: [], result: F64,
    execution: { kind: "pure" } }, permissionScope: null }, operands: [], destination: null, next: 1, unwind: { kind: "none" }, step: null };
  assert.throws(frontierOf([[[], call], [[], ret(null)]]), /origins: a invoke terminator is not analysed yet/);
  assert.throws(frontierOf([[[assign(1, use(2))], ret(1)]], [[local(0), OBJ], [local(1), OBJ], [{ kind: "static", definition: "D[M[P[origins];m];s]" }, OBJ]]),
    /static place needs the uncontrolled-time symbol/);
  assert.throws(frontierOf([[[assign(1, { kind: "address-of", place: 0, type: OBJ })], ret(1)]]), /address-of is not analysed yet/);
  assert.throws(frontierOf([[[assign(1, use(0))], ret(1)]], undefined, [[{ kind: "capture", index: 0 }, OBJ], [user, OBJ]]), /captured location/);
});

test("K-10: an execution names an entry the body offers; another count is a caller defect", () => {
  assert.throws(() => run(k2(), LIMITS, FLOW, 1), /caller defect: the body offers no entry for 1 supplied arguments/);
});

test("L-1, L-2: arena records and references at their need complete and one under refuses", () => {
  // K-2's arena: 0 projections + 2 producers + 2 bound producers + 1 context + 2 origins = 7 records;
  // references: 1 context argument + 2 origins members + 2 per bound producer = 7.
  ok(run(k2(), { ...LIMITS, maximumRelationalRecordsPerBody: 7 }));
  refusedOn(run(k2(), { ...LIMITS, maximumRelationalRecordsPerBody: 6 }), "maximumRelationalRecordsPerBody", 6);
  ok(run(k2(), { ...LIMITS, maximumRelationalReferencesPerBody: 7 }));
  refusedOn(run(k2(), { ...LIMITS, maximumRelationalReferencesPerBody: 6 }), "maximumRelationalReferencesPerBody", 6);
  // Interning is charged too: K-2 interns 3 keys (p0, the allocation, its field cell), so 2 refuses before the close.
  refusedOn(run(k2(), { ...LIMITS, maximumRelationalRecordsPerBody: 2 }), "maximumRelationalRecordsPerBody", 2);
});

test("L-3: a value of maximumOriginAlternatives producers is kept; one more refuses the run (K-3366)", () => {
  assert.deepEqual(ok(run(k3(), { ...LIMITS, maximumOriginAlternatives: 2 })).subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
  refusedOn(run(k3(), { ...LIMITS, maximumOriginAlternatives: 1 }), "maximumOriginAlternatives", 1);
});

test("L-4: a path at maximumProjectionDepth is kept; one deeper refuses the run (K-3366)", () => {
  ok(run(k8(), { ...LIMITS, maximumProjectionDepth: 1 }));
  refusedOn(run(k8(), { ...LIMITS, maximumProjectionDepth: 0 }), "maximumProjectionDepth", 0);
});

test("L-5: solver work below the body's need refuses with the solver's limit", () => {
  refusedOn(run(k3(), LIMITS, { ...FLOW, maximumWork: 0 }), "dataflow.maximumWork", 0);
  refusedOn(run(k3(), LIMITS, { ...FLOW, maximumResultEntries: 0 }), "dataflow.maximumResultEntries", 0);
});

// function k11(p: Obj): Obj { const o = { a: p.f.g }; o.a = p.h; o.a = p.f.k; return o.a; }
test("K-11: projections are ordered by path length, then segment by segment; a parent path is closed with its child", () => {
  const value = ok(run(graph({
    locals: [[param(0), OBJ], [user, OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [field(0, "f"), OBJ], [field(1, "g"), OBJ], [field(0, "h"), OBJ], [field(1, "k"), OBJ],
      [local(1), OBJ], [field(5, "a"), OBJ], [local(2), OBJ]],
    blocks: [[[assign(5, object([["a", 2]]), 3), assign(6, use(3)), assign(6, use(4)), assign(7, use(6))], ret(7)]],
  })));
  assert.deepEqual(value.arena.projections.map(path => [path.id, path.parent, path.projection.member.decision.key.value]),
    [[0, null, "f"], [1, null, "h"], [2, 0, "g"], [3, 0, "k"]]);
  assert.deepEqual(value.arena.producers.map(producer => [producer.id, producer.kind, producer.path]),
    [[0, "parameter", null], [1, "parameter", 1], [2, "parameter", 2], [3, "parameter", 3], [4, "allocation", null]]);
  assert.deepEqual(value.arena.origins, [complete(0, [0]), complete(1, [1, 2, 3]), complete(2, [4])]);
  assert.deepEqual(value.points, [{ point: { block: 0, statement: 1 }, place: 5, origins: 2 }, { point: { block: 0, statement: 2 }, place: 5, origins: 2 }]);
  assert.deepEqual(value.subjects, [{ node: 99, role: "return", path: null, origins: 1 }]);
});

const keyed = key => ({ decision: { ...memberDecision("x", OBJ, OBJ, direct("in-place")), key }, getter: null, setter: null });
const keyedField = (place, key) => ({ kind: "place", place, projection: { kind: "field", member: keyed(key) }, tir: at(0).tir });
const element = (place, index) => ({ kind: "place", place, projection: { kind: "element", index }, tir: at(0).tir });
const indexed = (place, by) => ({ kind: "place", place, projection: { kind: "index", operand: { kind: "place", place: by } }, tir: at(0).tir });
const aggregate = (kind, places) => ({ kind: "aggregate", type: OBJ, aggregate: { kind, elements: places.map(place => ({ kind: "place", place })) } });

test("K-12: a receiver, number and symbol keys, tuples, arrays and dynamic indexes", () => {
  const receiverRead = ok(run(graph({
    locals: [[{ kind: "receiver" }, OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [keyedField(0, { kind: "number", value: { numerator: 2n, denominator: 1n, negativeZero: false } }), OBJ], [local(1), OBJ]],
    blocks: [[[assign(2, use(1))], ret(2)]],
  })));
  assert.deepEqual(receiverRead.arena.producers.map(producer => [producer.kind, producer.path]), [["receiver", null], ["receiver", 0]]);
  assert.deepEqual(receiverRead.arena.contexts, [{ id: 0, receiver: 0, arguments: [], captures: [] }]);
  assert.deepEqual(receiverRead.subjects, [{ node: 99, role: "return", path: null, origins: 1 }]);
  const symbolRead = ok(run(graph({
    locals: [[param(0), OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [keyedField(0, { kind: "symbol", declaration: "D[M[P[origins];m];sym]" }), OBJ], [local(1), OBJ]],
    blocks: [[[assign(2, use(1))], ret(2)]],
  })));
  assert.deepEqual(symbolRead.arena.origins, [complete(0, [0]), complete(1, [1])]);
  // t = [p, q]; a = [p, q]; return t[1], a[i], t[i], p[i], p[0] in five bodies.
  const shape = (blocks, extra = []) => graph({
    locals: [[param(0), OBJ], [param(1), OBJ], [param(2), F64], [user, OBJ], [user, OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), F64], [local(3), OBJ], [local(4), OBJ], [local(5), OBJ], ...extra.map(base => [base, OBJ])],
    blocks,
  });
  const tupleAt = ok(run(shape([[[assign(3, aggregate("tuple", [0, 1]), 21), assign(5, use(6))], ret(5)]], [element(3, 1)])));
  assert.deepEqual(tupleAt.subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
  assert.deepEqual(tupleAt.arena.origins, [complete(0, []), complete(1, [0]), complete(2, [1])]);
  const arrayAny = ok(run(shape([[[assign(4, aggregate("array", [0, 1]), 22), assign(5, use(6))], ret(5)]], [indexed(4, 2)])));
  assert.deepEqual(arrayAny.arena.origins, [complete(0, []), complete(1, [0]), complete(2, [0, 1]), complete(3, [1])]);
  assert.deepEqual(arrayAny.subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
  const tupleAny = ok(run(shape([[[assign(3, aggregate("fixed-array", [0, 1]), 23), assign(5, use(6))], ret(5)]], [indexed(3, 2)])));
  assert.deepEqual(tupleAny.subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
  const parameterAny = ok(run(shape([[[assign(5, use(6))], ret(5)]], [indexed(0, 2)])));
  assert.deepEqual(parameterAny.arena.projections.map(path => path.projection), [{ kind: "element" }]);
  const parameterAt = ok(run(shape([[[assign(5, use(6))], ret(5)]], [element(0, 0)])));
  assert.deepEqual(parameterAt.arena.projections.map(path => path.projection), [{ kind: "index", constant: 0n }]);
  const record = ok(run(shape([[[assign(3, { kind: "aggregate", type: OBJ, aggregate: { kind: "record", fields: [{ member: member("r"), value: { kind: "place", place: 1 } }] } }, 24),
    assign(5, use(6))], ret(5)]], [field(3, "r")])));
  assert.deepEqual(record.subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
});

test("K-13: refined views, checks, a handled throw, storage markers, scalar operations, an unreachable block and bindings", () => {
  const refined = (place, kind = "place") => ({ kind, place, projection: { kind: "refined" }, tir: at(0).tir });
  const typed = { decision: { kind: "selected", operation: { kind: "discard" }, operands: [], result: F64, execution: { kind: "pure" } }, permissionScope: null };
  const value = ok(run(graph({
    bindings: { kind: "instantiated", bindings: EMPTY_VECTOR },
    locals: [[param(0), OBJ], [param(1), OBJ], [user, OBJ], [{ kind: "exception" }, OBJ], [user, F64], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ], [local(3), OBJ], [local(4), F64], [refined(2), OBJ], [refined(0, "checked"), OBJ], [local(5), OBJ]],
    constants: [TRUE, { type: F64, value: { kind: "observation", at: at(5).tir } }],
    blocks: [
      [[{ ...at(0), kind: "storage-live", local: 2 }, assign(5, use(6)), assign(4, { kind: "unary", operation: typed, operand: { kind: "constant", constant: 1 } }),
        assign(4, { kind: "binary", operation: typed, left: { kind: "place", place: 4 }, right: { kind: "place", place: 4 } }),
        assign(4, { kind: "convert", operation: typed, operand: { kind: "place", place: 4 }, to: F64 }),
        assign(7, { kind: "use", operand: { kind: "constant", constant: 0 } })],
       { ...at(0), kind: "check", place: 6, next: 1, unwind: { kind: "escape" } }],
      [[], { ...at(0), kind: "throw", operand: { kind: "place", place: 1 }, unwind: { kind: "handler", exception: 3, target: 2 } }],
      [[assign(2, use(3)), { ...at(0), kind: "storage-dead", local: 5 }], ret(2)],
      [[], { ...at(0), kind: "throw", operand: { kind: "place", place: 0 }, unwind: { kind: "escape" } }],
      [[], { ...at(0), kind: "unreachable" }],
    ],
  })));
  assert.deepEqual(value.arena.boundProducers, [bound(0), bound(1)]);
  assert.deepEqual(value.arena.origins, [complete(0, [0]), complete(1, [1])]);
  // The refined view wrote p into the slot of local 2; the handled throw then replaced it with q through the exception.
  assert.deepEqual(value.subjects, [{ node: 99, role: "return", path: null, origins: 1 }]);
});

test("K-14: more records of families not written yet are named frontiers", () => {
  const typed = { decision: { kind: "selected", operation: { kind: "discard" }, operands: [], result: OBJ, execution: { kind: "pure" } }, permissionScope: null };
  const frontierOf = (statements, places = [], constants = [], terminator = ret(1)) => () => run(graph({
    locals: [[param(0), OBJ], [user, OBJ]], places: [[local(0), OBJ], [local(1), OBJ], ...places], constants, blocks: [[statements, terminator]] }));
  assert.throws(frontierOf([assign(1, { kind: "binary", operation: typed, left: { kind: "place", place: 0 }, right: { kind: "place", place: 0 } })]),
    /a binary operation with a non-scalar result/);
  assert.throws(frontierOf([assign(1, { kind: "closure", instance: { body: body(), bindings: { kind: "parametric" } }, captures: [] })]), /a closure value/);
  assert.throws(frontierOf([assign(1, use(2))], [[{ kind: "place", place: 0, projection: { kind: "deref" }, tir: at(0).tir }, OBJ]]), /deref/);
  assert.throws(frontierOf([assign(1, use(2))], [[{ kind: "place", place: 0, projection: { kind: "capture", index: 0 }, tir: at(0).tir }, OBJ]]), /capture projection/);
  assert.throws(frontierOf([assign(1, { kind: "use", operand: { kind: "constant", constant: 0 } })], [],
    [{ type: OBJ, value: { kind: "definition", definition: "D[M[P[origins];m];kernel]", bindings: { kind: "parametric" } } }]), /definition constant/);
  assert.throws(frontierOf([assign(1, { kind: "use", operand: { kind: "constant", constant: 0 } })], [],
    [{ type: OBJ, value: { kind: "metadata", definition: "D[M[P[origins];m];kernel]", bindings: { kind: "parametric" } } }]), /metadata constant/);
  assert.throws(frontierOf([], [[{ kind: "static", definition: "D[M[P[origins];m];s]" }, OBJ]], [], ret(2)), /static place/);
  assert.throws(frontierOf([assign(2, use(0))], [[{ kind: "static", definition: "D[M[P[origins];m];s]" }, OBJ]]), /static place/);
  assert.throws(frontierOf([assign(2, use(0))], [[local(2), OBJ]], [], ret(1)), /./);
  assert.throws(() => run(graph({ locals: [[param(1), OBJ], [user, OBJ]], places: [[local(0), OBJ], [local(1), OBJ]], blocks: [[[], ret(1)]] })),
    /parameter 0 has no local/);
  assert.throws(() => run(graph({ locals: [[{ kind: "capture", index: 0 }, OBJ], [user, OBJ]], places: [[local(0), OBJ], [local(1), OBJ]],
    blocks: [[[assign(0, use(1))], ret(1)]] })), /captured location/);
  assert.throws(frontierOf([], [], [], { ...at(0), kind: "check", place: 0, next: 0, unwind: { kind: "handler", exception: 1, target: 0 } }), /handled check failure/);
});

test("L-6: limits passed while values grow refuse the run and keep nothing", () => {
  refusedOn(run(k2(), { ...LIMITS, maximumRelationalRecordsPerBody: 1 }), "maximumRelationalRecordsPerBody", 1);
  refusedOn(run(k2(), { ...LIMITS, maximumRelationalRecordsPerBody: 0 }), "maximumRelationalRecordsPerBody", 0);
  refusedOn(run(k2(), { ...LIMITS, maximumProjectionDepth: 0 }), "maximumProjectionDepth", 0);
  const dynamic = graph({
    locals: [[param(0), OBJ], [param(1), F64], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), F64], [local(2), OBJ], [indexed(0, 1), OBJ]],
    blocks: [[[assign(2, use(3))], ret(2)]],
  });
  refusedOn(run(dynamic, { ...LIMITS, maximumProjectionDepth: 0 }), "maximumProjectionDepth", 0);
});

test("the lattice: bottom passes through the transfers, joins with bottom keep the other side, and reachability distinguishes states", async () => {
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const graphValue = k2();
  const kernelState = { locals: new Map(graphValue.locals.map(entry => [entry.id, entry])), places: new Map(graphValue.places.map(entry => [entry.id, entry])),
    constants: new Map(), typeOf, charges: { maximumAlternatives: 4, maximumDepth: 4, maximumRecords: 100 }, specs: [], numbers: new Map(), exhaustion: null };
  const problem = state.originsProblem(kernelState, 100);
  const bottom = problem.lattice.bottom;
  assert.equal(problem.statement(graphValue.blocks[0].statements[0], bottom), bottom);
  assert.deepEqual(problem.terminator(graphValue.blocks[0].terminator, bottom), []);
  assert.equal(problem.lattice.join(bottom, problem.boundary), problem.boundary);
  assert.equal(problem.lattice.join(problem.boundary, bottom), problem.boundary);
  assert.equal(problem.lattice.equals(bottom, problem.boundary), false);
  assert.equal(problem.lattice.isOverflow(problem.boundary), false);
});

test("K-15: constants without storage, an unhandled throw, and every suspending or calling terminator kind as a frontier", async () => {
  const constants = ok(run(graph({
    locals: [[param(0), OBJ], [user, OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ]],
    constants: [{ type: F64, value: { kind: "observation", at: at(5).tir } }, TRUE],
    blocks: [[[assign(1, { kind: "use", operand: { kind: "constant", constant: 0 } }), assign(2, { kind: "use", operand: { kind: "constant", constant: 1 } })], ret(1)]],
  })));
  assert.deepEqual(constants.subjects, [{ node: 99, role: "return", path: null, origins: 0 }]);
  assert.deepEqual(constants.arena.origins, [complete(0, []), complete(1, [0])]);
  const thrown = ok(run(graph({ locals: [[param(0), OBJ]], places: [[local(0), OBJ]],
    blocks: [[[], { ...at(0), kind: "throw", operand: { kind: "place", place: 0 }, unwind: { kind: "escape" } }]] })));
  assert.deepEqual(thrown.subjects, []);
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const graphValue = k2();
  const kernelState = { locals: new Map(graphValue.locals.map(entry => [entry.id, entry])), places: new Map(graphValue.places.map(entry => [entry.id, entry])),
    constants: new Map(), typeOf, charges: { maximumAlternatives: 4, maximumDepth: 4, maximumRecords: 100 }, specs: [], numbers: new Map(), exhaustion: null };
  const problem = state.originsProblem(kernelState, 100);
  for (const kind of ["call", "await", "yield", "delegate"]) {
    assert.throws(() => problem.terminator({ ...at(0), kind }, problem.boundary), new RegExp(`a ${kind} terminator is not analysed yet`));
  }
});

test("K-16: field, constant-index and dynamic-index paths of one producer close in segment-rank order", () => {
  const value = ok(run(graph({
    locals: [[param(0), OBJ], [param(1), F64], [user, OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), F64], [local(2), OBJ], [field(2, "a"), OBJ], [field(0, "f"), OBJ], [element(0, 0), OBJ], [indexed(0, 1), OBJ], [local(3), OBJ]],
    blocks: [[[assign(2, object([["a", 4]]), 9), assign(3, use(5)), assign(3, use(6)), assign(7, use(3))], ret(7)]],
  })));
  assert.deepEqual(value.arena.projections.map(path => path.projection.kind), ["field", "index", "element"]);
  assert.deepEqual(value.arena.producers.map(producer => [producer.kind, producer.path]),
    [["parameter", null], ["parameter", 0], ["parameter", 1], ["parameter", 2], ["allocation", null]]);
  // The scalar index parameter has the empty origins, so the return union is the third record.
  assert.deepEqual(value.arena.origins, [complete(0, []), complete(1, [0]), complete(2, [1, 2, 3]), complete(3, [4])]);
  assert.deepEqual(value.subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
});

test("after exhaustion nothing grows: a join keeps its left side", async () => {
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const graphValue = k3();
  const kernelState = { locals: new Map(graphValue.locals.map(entry => [entry.id, entry])), places: new Map(graphValue.places.map(entry => [entry.id, entry])),
    constants: new Map(), typeOf, charges: { maximumAlternatives: 4, maximumDepth: 4, maximumRecords: 100 }, specs: [], numbers: new Map(), exhaustion: null };
  const problem = state.originsProblem(kernelState, 100);
  const left = problem.statement(graphValue.blocks[1].statements[0], problem.boundary);
  const right = problem.statement(graphValue.blocks[2].statements[0], problem.boundary);
  kernelState.exhaustion = { limit: "analysis.maximumOriginAlternatives", maximum: 1, origin: null };
  const joined = problem.lattice.join(left, right);
  assert.equal(problem.lattice.equals(joined, left), true);
  assert.equal(problem.statement(graphValue.blocks[2].statements[0], left), left);
});
