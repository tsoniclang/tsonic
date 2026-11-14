// Unit cases of the Origins kernel (packages/host/src/analyses/origins/analyze.ts, unit O-1a: the call-free values
// family; W12-1.plan.md). These are isolated-adapter unit cases (COMPONENTS:1543): the kernel is private, so the cases
// import its module directly. They are not a pipeline or composition claim.
//
// Inputs. Case K-1 is the real `add` of the lowering fixtures, lowered by `lowerToMir` and accepted by `verifyMir`.
// The other bodies are lowered graphs written by hand against the MIR contract and passed through the MIR text codec;
// they are not run through `verifyMir`, because their typed sources (aggregate and member decisions) are not written.
// Every such case says "codec-only" in its name (R6 O-7).
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
let flow;
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
  flow = await import("../../packages/host/dist/dataflow/index.js");
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
function graph({ locals, places, blocks, constants = [], entries = [{ provided: 0, block: 0 }], bindings = { kind: "instantiated", bindings: EMPTY_VECTOR } }) {
  const value = {
    body: body(), bindings, entries,
    locals: locals.map(([role, storage], id) => ({ id, storage, role, mode: role.kind === "parameter" || role.kind === "receiver" ? "by-value" : "local",
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

const executionOf = (graphValue, provided = 0) => ({ instance: { body: graphValue.body, bindings: graphValue.bindings }, provided });
const completedExecutions = [];
const run = (graphValue, limits = LIMITS, flowLimits = FLOW, execution = executionOf(graphValue)) => {
  const input = { mir: graphValue, execution, typeOf, limits, account: flow.createAccount(flowLimits) };
  const result = kernel.analyzeOriginsValues(input);
  if (result.kind === "ok" && flowLimits === FLOW) completedExecutions.push({ input, result });
  return result;
};
const ok = result => { assert.equal(result.kind, "ok", result.kind === "ok" ? "ok" : JSON.stringify(result.diagnostics)); assert.deepEqual(result.diagnostics, []); return result.value; };
const refusedOn = (result, limit, maximum) => {
  assert.equal(result.kind, "refused");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.ok(JSON.stringify(result.diagnostics[0]).includes(limit), `${limit} named`);
  assert.ok(JSON.stringify(result.diagnostics[0]).includes(String(maximum)), `${maximum} named`);
};
const EMPTY_VECTOR = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
const arenaExecution = () => ({ instance: { body: body(), bindings: { kind: "instantiated", bindings: EMPTY_VECTOR } }, provided: 0 });
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
  const readType = type => types.readType(interner, type);
  // The fixture lowers add's template (parametric bindings), which Origins refuses by name (R6 O-4).
  const template = { instance: { body: lowered.value.body, bindings: lowered.value.bindings }, provided: 2 };
  assert.throws(() => kernel.analyzeOriginsValues({ mir: lowered.value, execution: template, typeOf: readType, limits: LIMITS, account: flow.createAccount(FLOW) }),
    /a template body \(parametric bindings\) is not analysed/);
  // The execution lowers add's bound typed body: the instance with the empty complete binding (add has no binders).
  const boundSource = { ...program.tir, bindings: { kind: "instantiated", bindings: EMPTY_VECTOR } };
  const boundLowered = lowerMir.lowerToMir(step.lowerMirDeps(runState), boundSource, []);
  assert.equal(boundLowered.kind, "ok");
  const instantiated = boundLowered.value;
  assert.deepEqual(instantiated.bindings, { kind: "instantiated", bindings: EMPTY_VECTOR });
  assert.deepEqual(verifyMir(instantiated, step.mirVerificationContext(runState, boundSource)), { kind: "complete", violations: [] });
  const execution = { instance: { body: instantiated.body, bindings: instantiated.bindings }, provided: 2 };
  const value = ok(kernel.analyzeOriginsValues({ mir: instantiated, execution, typeOf: readType, limits: LIMITS, account: flow.createAccount(FLOW) }));
  assert.equal(value.execution, execution);
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

test("K-2 (codec-only): an allocation's field cell holds what was stored into it; a projected store has a point row for its base", () => {
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

test("K-3 (codec-only): a join holds both producers, and the arena does not depend on block numbering", () => {
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

test("K-4 (codec-only): a loop reaches its fixed point with both producers at the exit", () => {
  const loop = graph({
    locals: [[param(0), OBJ], [param(1), OBJ], [param(2), BOOL], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), BOOL], [local(3), OBJ]],
    blocks: [[[assign(3, use(0))], goto(1)], [[], branch(2, 2, 3)], [[assign(3, use(1))], goto(1)], [[], ret(3)]],
  });
  assert.deepEqual(ok(run(loop)).subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
});

test("K-5 (codec-only): a store into a field cell adds; a store into a local's slot replaces", () => {
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

test("K-8 (codec-only): a cell under an entry producer holds its entry symbol, the producer with that path", () => {
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

test("C1 (codec-only): string, literal and bool values refer to no storage; an absence constant may be absent", () => {
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

test("K-9 (codec-only): a record of a family not written yet is a named frontier, with no partial facts", () => {
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

test("K-10 (codec-only): the execution must be the lowered body's instance and an entry it offers; otherwise a caller defect", () => {
  const graphValue = k2();
  assert.throws(() => run(graphValue, LIMITS, FLOW, executionOf(graphValue, 1)), /caller defect: the body offers no entry for 1 supplied arguments/);
  const otherBody = ids.encodeBodyId({ owner: ids.encodeDefId({ module: MODULE, segments: [{ name: "kernel", ordinal: 0 }] }), role: "function", ordinal: 1 });
  assert.throws(() => run(graphValue, LIMITS, FLOW, { instance: { body: otherBody, bindings: graphValue.bindings }, provided: 0 }),
    /caller defect: the lowered body is not the lowered body of the execution's instance/);
  const otherBindings = { kind: "instantiated", bindings: { ...EMPTY_VECTOR, classBindings: [{ kind: "rigid", parameter: { owner: "D[M[P[origins];m];kernel]", index: 0 } }] } };
  assert.throws(() => run(graphValue, LIMITS, FLOW, { instance: { body: graphValue.body, bindings: otherBindings }, provided: 0 }),
    /caller defect: the lowered body is not the lowered body of the execution's instance/);
  const template = graph({ locals: [[param(0), OBJ]], places: [[local(0), OBJ]], blocks: [[[], ret(0)]], bindings: { kind: "parametric" } });
  assert.throws(() => run(template), /a template body \(parametric bindings\) is not analysed/);
});

test("L-1, L-2 (codec-only): arena records and references at their need complete and one under refuses", () => {
  // K-2's arena: 0 projections + 2 producers + 2 bound producers + 1 context + 2 origins = 7 records;
  // references: 1 context argument + 2 origins members + 2 per bound producer = 7.
  ok(run(k2(), { ...LIMITS, maximumRelationalRecordsPerBody: 7 }));
  refusedOn(run(k2(), { ...LIMITS, maximumRelationalRecordsPerBody: 6 }), "maximumRelationalRecordsPerBody", 6);
  ok(run(k2(), { ...LIMITS, maximumRelationalReferencesPerBody: 7 }));
  refusedOn(run(k2(), { ...LIMITS, maximumRelationalReferencesPerBody: 6 }), "maximumRelationalReferencesPerBody", 6);
});

test("L-1b (codec-only, R6 P1): an object of five scalar fields makes no cell; its arena of five records completes at five", () => {
  // x: float64; return { a: x, b: x, c: x, d: x, e: x }. Arena: 1 producer, 1 bound producer, 1 context, 2 origins.
  const fields = ["a", "b", "c", "d", "e"];
  const value = graph({ locals: [[param(0), F64], [user, OBJ]], places: [[local(0), F64], [local(1), OBJ]],
    blocks: [[[assign(1, object(fields.map(key => [key, 0])), 4)], ret(1)]] });
  const result = ok(run(value, { ...LIMITS, maximumRelationalRecordsPerBody: 5 }));
  assert.deepEqual(result.arena.origins, [complete(0, []), complete(1, [0])]);
  assert.deepEqual(result.arena.projections, []);
  refusedOn(run(value, { ...LIMITS, maximumRelationalRecordsPerBody: 4 }), "maximumRelationalRecordsPerBody", 4);
});

test("O-2 (codec-only, R6 P3, P4): constant and dynamic indexes see each other's writes, and array literals are read at a constant index", () => {
  // P3: function p3(p0: Obj, k: float64, v: Obj) { p0[k] = v; return p0[0]; }
  const p3 = ok(run(graph({
    locals: [[param(0), OBJ], [param(1), F64], [param(2), OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), F64], [local(2), OBJ], [local(3), OBJ], [indexed(0, 1), OBJ], [element(0, 0), OBJ]],
    blocks: [[[assign(4, use(2)), assign(3, use(5))], ret(3)]],
  })));
  assert.deepEqual(p3.arena.producers.map(producer => [producer.kind, producer.index, producer.path]),
    [["parameter", 0, null], ["parameter", 0, 0], ["parameter", 2, null]]);
  assert.deepEqual(p3.arena.origins, [complete(0, []), complete(1, [0]), complete(2, [1, 2]), complete(3, [2])]);
  assert.deepEqual(p3.subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
  // P4: function p4(p0: Obj) { const a = [p0]; return a[0]; }, and the tuple and fixed-array forms with a dynamic store.
  const p4 = ok(run(graph({
    locals: [[param(0), OBJ], [user, OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ], [element(1, 0), OBJ]],
    blocks: [[[assign(1, aggregate("array", [0]), 6), assign(2, use(3))], ret(2)]],
  })));
  assert.deepEqual(p4.arena.origins, [complete(0, [0])]);
  assert.deepEqual(p4.subjects, [{ node: 99, role: "return", path: null, origins: 0 }]);
  for (const kind of ["tuple", "fixed-array"]) {
    // t = [p0]; t[k] = v; return t[0] gives { p0, v }; return t[k] gives the same.
    const body = place => graph({
      locals: [[param(0), OBJ], [param(1), F64], [param(2), OBJ], [user, OBJ], [user, OBJ]],
      places: [[local(0), OBJ], [local(1), F64], [local(2), OBJ], [local(3), OBJ], [local(4), OBJ], [indexed(3, 1), OBJ], [element(3, 0), OBJ]],
      blocks: [[[assign(3, aggregate(kind, [0]), 8), assign(5, use(2)), assign(4, use(place))], ret(4)]],
    });
    for (const place of [6, 5]) {
      const result = ok(run(body(place)));
      assert.deepEqual(result.arena.origins.map(entry => entry.producers), [[], [0], [0, 1], [1], [2]], `${kind} ${place}`);
      assert.deepEqual(result.subjects, [{ node: 99, role: "return", path: null, origins: 2 }], `${kind} ${place}`);
    }
  }
});

test("L-3 (codec-only): a value of maximumOriginAlternatives producers is kept; one more refuses the run (K-3366)", () => {
  assert.deepEqual(ok(run(k3(), { ...LIMITS, maximumOriginAlternatives: 2 })).subjects, [{ node: 99, role: "return", path: null, origins: 2 }]);
  refusedOn(run(k3(), { ...LIMITS, maximumOriginAlternatives: 1 }), "maximumOriginAlternatives", 1);
});

test("L-4 (codec-only): a path at maximumProjectionDepth is kept; one deeper refuses the run (K-3366)", () => {
  ok(run(k8(), { ...LIMITS, maximumProjectionDepth: 1 }));
  refusedOn(run(k8(), { ...LIMITS, maximumProjectionDepth: 0 }), "maximumProjectionDepth", 0);
});

test("L-5 (codec-only): K-3 setup, callbacks, solve, replay and publication share one exact work allowance", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const required = 9 + 16 * (1 + body().length) + 8 + 1 + 19 + 112 + 42 + 42 + 111 + 5;
  const input = k3();
  const account = flow.createAccount(FLOW);
  ok(kernel.analyzeOriginsValues({ mir: input, execution: executionOf(input), typeOf, limits: LIMITS, account }));
  assert.equal(InvocationAccount.stateOf(account).work, required, "literal setup/solver/replay/arena event sum");
  for (let maximumWork = 0; maximumWork < required; maximumWork += 1)
    refusedOn(run(input, LIMITS, { ...FLOW, maximumWork }), "dataflow.maximumWork", maximumWork);
  ok(run(input, LIMITS, { ...FLOW, maximumWork: required }));
  refusedOn(run(input, LIMITS, { ...FLOW, maximumWork: required - 1 }), "dataflow.maximumWork", required - 1);
  refusedOn(run(k3(), LIMITS, { ...FLOW, maximumWork: 0 }), "dataflow.maximumWork", 0);
  refusedOn(run(k3(), LIMITS, { ...FLOW, maximumResultEntries: 0 }), "dataflow.maximumResultEntries", 0);
});

test("the complete empty-values execution refuses every below-exact account and has no uncharged publication tail", () => {
  const input = graph({ locals: [], places: [], blocks: [[[], ret(null)]] });
  const required = 16 * body().length + 47;
  for (let maximumWork = 0; maximumWork < required; maximumWork += 1)
    refusedOn(run(input, LIMITS, { ...FLOW, maximumWork }), "dataflow.maximumWork", maximumWork);
  ok(run(input, LIMITS, { ...FLOW, maximumWork: required }));
  ok(run(input, LIMITS, { ...FLOW, maximumWork: required + 1 }));
});

test("actual refusal units distinguish complete binding vectors and preserve the original same-execution diagnostic through the account", () => {
  const owner = ids.encodeDefId({ module: MODULE, segments: [{ name: "Owner", ordinal: 0 }] });
  const vectors = [F64, BOOL].map(type => ({ ...EMPTY_VECTOR,
    classBindings: [{ kind: "bound", parameter: { owner, index: 0 }, type }] }));
  const results = vectors.map(bindings => {
    const input = graph({ bindings: { kind: "instantiated", bindings }, locals: [[param(0), OBJ]],
      places: [[local(0), OBJ]], blocks: [[[], ret(0)]] });
    const execution = executionOf(input);
    const account = flow.createAccount(FLOW);
    const result = kernel.analyzeOriginsValues({ mir: input, execution, typeOf,
      limits: { ...LIMITS, maximumOriginAlternatives: 0 }, account });
    refusedOn(result, "analysis.maximumOriginAlternatives", 0);
    assert.equal(flow.accountFailure(account), result);
    assert.equal(result.diagnostics[0].evidence[2], ids.encodeKey(types.executionKey(execution)));
    assert.equal(kernel.analyzeOriginsValues({ mir: null, execution, typeOf, limits: LIMITS, account }), result);
    return result;
  });
  assert.notEqual(results[0].diagnostics[0].evidence[2], results[1].diagnostics[0].evidence[2]);
});

// function k11(p: Obj): Obj { const o = { a: p.f.g }; o.a = p.h; o.a = p.f.k; return o.a; }
test("K-11 (codec-only): projections are ordered by path length, then segment by segment; a parent path is closed with its child", () => {
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

test("K-12 (codec-only): a receiver, number and symbol keys, tuples, arrays and dynamic indexes", () => {
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

test("K-13 (codec-only): refined views, checks, a handled throw, storage markers, scalar operations, an unreachable block and bindings", () => {
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

test("K-14 (codec-only): more records of families not written yet are named frontiers", () => {
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

test("L-6 (codec-only): limits passed while values grow refuse the run and keep nothing", () => {
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
    constants: new Map(), typeOf, charges: { maximumAlternatives: 4, maximumDepth: 4 }, account: flow.createAccount(FLOW), execution: executionOf(graphValue), specs: [], numbers: new Map(), indexChildren: new Map(), stamp: 0 };
  const problem = state.originsProblem(kernelState, 100);
  const bottom = problem.lattice.bottom;
  assert.equal(problem.statement(graphValue.blocks[0].statements[0], bottom), bottom);
  assert.deepEqual(problem.terminator(graphValue.blocks[0].terminator, bottom), []);
  assert.equal(problem.lattice.join(bottom, problem.boundary), problem.boundary);
  assert.equal(problem.lattice.join(problem.boundary, bottom), problem.boundary);
  assert.equal(problem.lattice.equals(bottom, problem.boundary), false);
  assert.equal(problem.lattice.isOverflow(problem.boundary), false);
});

test("K-15 (codec-only): constants without storage, an unhandled throw, and every suspending or calling terminator kind as a frontier", async () => {
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
    constants: new Map(), typeOf, charges: { maximumAlternatives: 4, maximumDepth: 4 }, account: flow.createAccount(FLOW), execution: executionOf(graphValue), specs: [], numbers: new Map(), indexChildren: new Map(), stamp: 0 };
  const problem = state.originsProblem(kernelState, 100);
  for (const kind of ["call", "await", "yield", "delegate"]) {
    assert.throws(() => problem.terminator({ ...at(0), kind }, problem.boundary), new RegExp(`a ${kind} terminator is not analysed yet`));
  }
});

test("K-16 (codec-only): field, constant-index and dynamic-index paths of one producer close in segment-rank order", () => {
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
    constants: new Map(), typeOf, charges: { maximumAlternatives: 4, maximumDepth: 4 }, account: flow.createAccount(FLOW), execution: executionOf(graphValue), specs: [], numbers: new Map(), indexChildren: new Map(), stamp: 0 };
  const problem = state.originsProblem(kernelState, 100);
  const left = problem.statement(graphValue.blocks[1].statements[0], problem.boundary);
  const right = problem.statement(graphValue.blocks[2].statements[0], problem.boundary);
  flow.refuseAccount(kernelState.account, state.originRefusal(kernelState.execution, "analysis.maximumOriginAlternatives", 1, null));
  const joined = problem.lattice.join(left, right);
  assert.equal(problem.lattice.equals(joined, left), true);
  assert.equal(problem.statement(graphValue.blocks[2].statements[0], left), left);
});

const stateKernel = (graphValue, maximumAlternatives = 4, maximumDepth = 4) => ({
  locals: new Map(graphValue.locals.map(entry => [entry.id, entry])),
  places: new Map(graphValue.places.map(entry => [entry.id, entry])),
  constants: new Map(graphValue.constants.map(entry => [entry.id, entry])),
  typeOf, charges: { maximumAlternatives, maximumDepth },
  account: flow.createAccount(FLOW), execution: executionOf(graphValue), specs: [], numbers: new Map(), indexChildren: new Map(), stamp: 0,
});

test("C1 scalar type traversal is stack-bounded and charges before every actual type read", async () => {
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  for (const depth of [5, 12000]) {
    const interner = types.createTypeInterner();
    let selected = types.internType(interner, { kind: "primitive", primitive: "float64" });
    const terms = [types.readType(interner, selected)];
    for (let position = 0; position < depth; position += 1) {
      selected = types.internType(interner, { kind: "literal", base: selected,
        value: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } } });
      terms.push(types.readType(interner, selected));
    }
    assert.deepEqual(types.verifyTypes({ table: { terms, signatures: [] }, evidence: [], bindings: [],
      nominalOf: () => null, nodeExists: () => false, localExists: () => false }), [], "the real Types owner accepts this acyclic graph");
    const input = graph({ locals: [[param(0), selected]], places: [[local(0), selected]], blocks: [[[], ret(0)]] });
    const operations = depth === 5 ? ["isScalar", "entryValue"] : ["isScalar"];
    for (const operation of operations) {
      const required = depth + 1 + (operation === "entryValue" ? 1 : 0);
      const allowances = depth === 5 ? Array.from({ length: required + 1 }, (_, position) => position) : [0, required - 1, required];
      for (const maximumWork of allowances) {
        const kernelState = stateKernel(input);
        kernelState.account = flow.createAccount({ ...FLOW, maximumWork });
        let reads = 0;
        kernelState.typeOf = type => {
          assert.equal(flow.accountFailure(kernelState.account), null, "no type reader is called after the original account stop");
          reads += 1;
          return types.readType(interner, type);
        };
        const result = operation === "isScalar" ? state.isScalar(kernelState, input.places[0]) : state.entryValue(kernelState, input.locals[0]);
        if (operation === "isScalar") assert.equal(result, maximumWork === required);
        else assert.deepEqual(result, { producers: [], absent: false });
        assert.equal(reads, Math.max(0, Math.min(depth + 1, maximumWork - (operation === "entryValue" ? 1 : 0))), `${operation} cap ${maximumWork}`);
        assert.equal(kernelState.specs.length, 0, "scalar traversal and its refusal intern no producers");
        if (maximumWork < required) {
          const failure = flow.accountFailure(kernelState.account);
          assert.deepEqual(failure, { kind: "resource-limit", dimension: "work", maximum: maximumWork });
          assert.equal(state.isScalar(kernelState, input.places[0]), false);
          assert.deepEqual(state.entryValue(kernelState, input.locals[0]), { producers: [], absent: false });
          assert.equal(flow.accountFailure(kernelState.account), failure, "the first refusal is unchanged");
        } else assert.equal(flow.accountFailure(kernelState.account), null);
      }
    }
    const refused = stateKernel(input);
    refused.typeOf = () => assert.fail("a domain-refused scalar traversal must not read a type");
    const cause = state.originRefusal(refused.execution, "analysis.maximumOriginAlternatives", 0, origin);
    flow.refuseAccount(refused.account, cause);
    assert.equal(state.isScalar(refused, input.places[0]), false);
    assert.deepEqual(state.entryValue(refused, input.locals[0]), { producers: [], absent: false });
    assert.equal(flow.accountFailure(refused.account), cause);
  }
});

test("codec-only refined-place reads and stores use bounded stack and the same exact invocation units", async () => {
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const keys = await import("../../packages/host/dist/analyses/origins/keys.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  for (const depth of [3, 12000]) {
    const places = [[local(0), OBJ], [local(1), OBJ]];
    let last = 0;
    for (let position = 0; position < depth; position += 1) {
      places.push([{ kind: "checked", place: last, projection: { kind: "refined" }, tir: at(0).tir }, OBJ]);
      last = places.length - 1;
    }
    const input = graph({ locals: [[param(0), OBJ], [param(1), OBJ]], places, blocks: [[[], ret(0)]] });
    for (const operation of ["read", "write"]) {
      const required = operation === "read" ? 2 * (depth + 1) + 5 : 2 * (depth + 1) + 6;
      const allowances = depth === 3 ? Array.from({ length: required + 1 }, (_, position) => position) : [0, required - 1, required];
      for (const maximumWork of allowances) {
        const kernelState = stateKernel(input);
        kernelState.account = flow.createAccount({ ...FLOW, maximumWork });
        kernelState.typeOf = type => {
          assert.equal(flow.accountFailure(kernelState.account), null, "a refused place traversal calls no type reader");
          return typeOf(type);
        };
        const boundary = { reached: true, cells: new Map(), stamp: -1 };
        if (operation === "write") {
          const producer = keys.rootSpec({ kind: "parameter", index: 1 });
          kernelState.specs.push(producer);
          kernelState.numbers.set(producer.key, 0);
          boundary.cells.set(-2, { producers: [0], absent: false });
        }
        const answer = operation === "read" ? state.readPlace(kernelState, boundary, input.places[last])
          : state.transferStatement(kernelState, assign(last, use(1)), boundary);
        if (maximumWork < required) {
          const failure = flow.accountFailure(kernelState.account);
          assert.deepEqual(failure, { kind: "resource-limit", dimension: "work", maximum: maximumWork });
          if (operation === "read") {
            assert.deepEqual(answer, { producers: [], absent: false });
            assert.equal(kernelState.specs.length, 0, "no entry producer before its full charge");
          } else {
            assert.equal(answer, boundary, "no partial store state");
            assert.equal(boundary.cells.has(-1), false);
          }
          assert.deepEqual(state.readPlace(kernelState, boundary, null), { producers: [], absent: false });
          assert.equal(state.transferStatement(kernelState, null, boundary), boundary);
          assert.equal(flow.accountFailure(kernelState.account), failure);
        } else {
          assert.equal(flow.accountFailure(kernelState.account), null);
          assert.equal(InvocationAccount.stateOf(kernelState.account).work, required);
          if (operation === "read") {
            assert.deepEqual(answer, { producers: [0], absent: false });
            assert.deepEqual(kernelState.specs[0].root, { kind: "parameter", index: 0 });
          } else {
            assert.deepEqual(answer.cells.get(-1), { producers: [0], absent: false });
            assert.equal(boundary.cells.has(-1), false, "the incoming state is not mutated");
          }
        }
      }
    }
  }
});

test("codec-only deep physical paths reach their actual projection-depth refusal without a host stack limit", async () => {
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const places = [[local(0), OBJ]];
  const depth = 12000;
  for (let position = 0; position < depth; position += 1) places.push([field(position, "next"), OBJ]);
  const input = graph({ locals: [[param(0), OBJ]], places, blocks: [[[], ret(0)]] });
  const kernelState = stateKernel(input, 4, 8);
  const boundary = { reached: true, cells: new Map(), stamp: -1 };
  assert.deepEqual(state.readPlace(kernelState, boundary, input.places[depth]), { producers: [], absent: false });
  const failure = flow.accountFailure(kernelState.account);
  assert.equal(failure.kind, "refused");
  assert.equal(failure.diagnostics.length, 1);
  assert.equal(failure.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.equal(JSON.stringify(failure.diagnostics[0]).includes("analysis.maximumProjectionDepth"), true);
  assert.equal(kernelState.specs.length, 9, "the refused ninth child was not interned");
  assert.deepEqual(state.readPlace(kernelState, boundary, null), { producers: [], absent: false });
  assert.equal(flow.accountFailure(kernelState.account), failure);
});

test("singleton entry and allocation values obey zero and exact alternative allowances before interning", async () => {
  refusedOn(run(k2(), { ...LIMITS, maximumOriginAlternatives: 0 }, { ...FLOW, maximumWork: 0 }),
    "dataflow.maximumWork", 0);
  refusedOn(run(k2(), { ...LIMITS, maximumOriginAlternatives: 0 }), "analysis.maximumOriginAlternatives", 0);
  const allocated = graph({ locals: [[user, OBJ]], places: [[local(0), OBJ]],
    blocks: [[[assign(0, object([]), 7)], ret(0)]] });
  refusedOn(run(allocated, { ...LIMITS, maximumOriginAlternatives: 0 }), "analysis.maximumOriginAlternatives", 0);
  assert.deepEqual(ok(run(allocated, { ...LIMITS, maximumOriginAlternatives: 1 })).arena.origins, [complete(0, [0])]);
  const scalar = graph({ locals: [[param(0), F64]], places: [[local(0), F64]], blocks: [[[], ret(0)]] });
  assert.deepEqual(ok(run(scalar, { ...LIMITS, maximumOriginAlternatives: 0 })).arena.origins, [complete(0, [])]);
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const graphValue = k2();
  const refused = stateKernel(graphValue, 0);
  assert.equal(state.entryValue(refused, graphValue.locals[0]).producers.length, 0);
  assert.equal(refused.specs.length, 0);
  assert.equal(refused.numbers.size, 0);
  refusedOn(flow.accountFailure(refused.account), "analysis.maximumOriginAlternatives", 0);
});

test("a failed charged child stops map writes, later interning and terminator handoff without publishing open origins", async () => {
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const graphValue = k3();
  const kernelState = stateKernel(graphValue, 1);
  const problem = state.originsProblem(kernelState, 100);
  const left = problem.statement(graphValue.blocks[1].statements[0], problem.boundary);
  state.seal(kernelState);
  const right = problem.statement(graphValue.blocks[2].statements[0], problem.boundary);
  const before = [...left.cells.entries()];
  assert.equal(problem.lattice.join(left, right), left);
  refusedOn(flow.accountFailure(kernelState.account), "analysis.maximumOriginAlternatives", 1);
  const sizes = [kernelState.specs.length, kernelState.numbers.size, kernelState.indexChildren.size, kernelState.stamp];
  assert.equal(problem.statement(assign(3, object([]), 777), left), left);
  assert.deepEqual(problem.terminator(goto(0), left), []);
  assert.deepEqual(state.readPlace(kernelState, left, graphValue.places[0]), state.EMPTY);
  assert.deepEqual(state.readOperand(kernelState, left, { kind: "place", place: 0 }, origin), state.EMPTY);
  assert.deepEqual(state.entryValue(kernelState, graphValue.locals[0]), state.EMPTY);
  state.seal(kernelState);
  assert.deepEqual([...left.cells.entries()], before);
  assert.deepEqual([kernelState.specs.length, kernelState.numbers.size, kernelState.indexChildren.size, kernelState.stamp], sizes);
  assert.equal(problem.lattice.equals(left, right), true, "an already-refused private solve stops; it is not an accepted equality fact");

  const storedGraph = graph({ locals: [[param(0), OBJ], [param(1), OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ], [field(2, "f"), OBJ], [field(2, "later"), OBJ]],
    blocks: [[[assign(2, object([["f", 0]]), 7), assign(3, use(1))], ret(2)]] });
  const storedKernel = stateKernel(storedGraph, 1);
  const storedProblem = state.originsProblem(storedKernel, 100);
  const stored = storedProblem.statement(storedGraph.blocks[0].statements[0], storedProblem.boundary);
  const storedCells = [...stored.cells.entries()];
  const failed = storedProblem.statement(storedGraph.blocks[0].statements[1], stored);
  assert.equal(failed, stored);
  assert.deepEqual([...stored.cells.entries()], storedCells);
  const refusedSize = storedKernel.specs.length;
  assert.deepEqual(state.readPlace(storedKernel, failed, storedGraph.places[4]), state.EMPTY);
  assert.equal(storedKernel.specs.length, refusedSize);
});

test("one transfer owns one state map and later block transfers cannot mutate handed-out states", async () => {
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const graphValue = k2();
  const kernelState = stateKernel(graphValue);
  const problem = state.originsProblem(kernelState, 100);
  const first = problem.statement(assign(1, use(0)), problem.boundary);
  const second = problem.statement(assign(2, use(0)), first);
  assert.equal(second, first);
  assert.equal(second.cells, first.cells);
  const stored = [...first.cells.entries()];
  const handed = problem.terminator(goto(0), second)[0].state;
  const later = problem.statement({ ...at(0), kind: "storage-dead", local: 1 }, handed);
  assert.equal(later === handed, false);
  assert.equal(later.cells === handed.cells, false);
  assert.deepEqual([...handed.cells.entries()], stored);
  assert.deepEqual(problem.boundary.cells.size, 0);
});

test("complete bindings and actual receiver/argument context qualify allocation producers without same-frame identity credit", () => {
  const owner = ids.encodeDefId({ module: MODULE, segments: [{ name: "T", ordinal: 0 }] });
  const binding = type => ({ kind: "instantiated", bindings: { ...EMPTY_VECTOR,
    classBindings: [{ kind: "bound", parameter: { owner, index: 0 }, type }] } });
  const input = bindings => graph({ bindings,
    locals: [[{ kind: "receiver" }, OBJ], [param(0), OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ]],
    blocks: [[[assign(2, object([["receiver", 0], ["argument", 1]]), 17)], ret(2)]] });
  const rigid = { kind: "instantiated", bindings: { ...EMPTY_VECTOR,
    classBindings: [{ kind: "rigid", parameter: { owner, index: 0 } }] } };
  for (const bindings of [binding(F64), binding(BOOL), rigid]) {
    const graphValue = input(bindings);
    const result = ok(run(graphValue));
    assert.equal(result.execution.instance.bindings, graphValue.bindings);
    assert.deepEqual(result.arena.producers.at(-1), { id: 2, path: null, kind: "allocation", at: { kind: "node", node: { body: body(), node: 17 } } });
    assert.deepEqual(result.arena.boundProducers.map(entry => entry.bindings), [bindings.bindings, bindings.bindings, bindings.bindings]);
    assert.deepEqual(result.arena.boundProducers.map(entry => entry.context), [0, 0, 0]);
    assert.deepEqual(result.arena.contexts, [{ id: 0, receiver: 0, arguments: [1], captures: [] }]);
    assert.equal(result.arena.origins.every(entry => entry.kind === "complete"), true);
  }
});

test("arena record/reference reservations refuse before visiting later invalid sentinel input and preserve exact canonical counts", async () => {
  const { closeArena } = await import("../../packages/host/dist/analyses/origins/arena.js");
  const { rootSpec } = await import("../../packages/host/dist/analyses/origins/keys.js");
  const empty = { producers: [], absent: false };
  const first = { producers: [0], absent: false };
  const context = { receiver: null, arguments: [first] };
  const specs = [rootSpec({ kind: "parameter", index: 0 })];
  const limits = { maximumRecords: 4, maximumReferences: 4 };
  const closed = closeArena(arenaExecution(), specs, context, [first, first], limits, flow.createAccount(FLOW));
  assert.equal(closed.kind, "closed");
  assert.deepEqual(closed.arena.origins, [complete(0, [0])]);
  for (let maximumRecords = 0; maximumRecords < 4; maximumRecords += 1) {
    refusedOn(closeArena(arenaExecution(), specs, context, [first], { ...limits, maximumRecords }, flow.createAccount(FLOW)), "analysis.maximumRelationalRecordsPerBody", maximumRecords);
  }
  for (let maximumReferences = 0; maximumReferences < 4; maximumReferences += 1) {
    refusedOn(closeArena(arenaExecution(), specs, context, [first], { ...limits, maximumReferences }, flow.createAccount(FLOW)), "analysis.maximumRelationalReferencesPerBody", maximumReferences);
  }
  const invalid = { producers: [99], absent: false };
  refusedOn(closeArena(arenaExecution(), [], { receiver: null, arguments: [] }, [invalid],
    { maximumRecords: 0, maximumReferences: 0 }, flow.createAccount(FLOW)), "analysis.maximumRelationalRecordsPerBody", 0);
  refusedOn(closeArena(arenaExecution(), [], { receiver: empty, arguments: [invalid] }, [],
    { maximumRecords: 100, maximumReferences: 0 }, flow.createAccount(FLOW)), "analysis.maximumRelationalReferencesPerBody", 0);
});

test("projection and alternative refusal propagates from returned values, nested stores, dynamic cells and aggregate children", () => {
  const returned = graph({ locals: [[param(0), OBJ]],
    places: [[local(0), OBJ], [field(0, "f"), OBJ], [field(1, "g"), OBJ]], blocks: [[[], ret(2)]] });
  refusedOn(run(returned, { ...LIMITS, maximumProjectionDepth: 0 }), "analysis.maximumProjectionDepth", 0);
  refusedOn(run(returned, { ...LIMITS, maximumProjectionDepth: 1 }), "analysis.maximumProjectionDepth", 1);
  ok(run(returned, { ...LIMITS, maximumProjectionDepth: 2 }));
  const stored = graph({ locals: [[param(0), OBJ], [param(1), OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [field(0, "f"), OBJ], [field(2, "g"), OBJ], [field(3, "h"), OBJ]],
    blocks: [[[assign(4, use(1))], ret(null)]] });
  refusedOn(run(stored, { ...LIMITS, maximumProjectionDepth: 1 }), "analysis.maximumProjectionDepth", 1);
  for (const kind of ["array", "tuple", "fixed-array"]) {
    const input = graph({ locals: [[param(0), OBJ], [user, OBJ]],
      places: [[local(0), OBJ], [local(1), OBJ], [field(0, "f"), OBJ]],
      blocks: [[[assign(1, aggregate(kind, [2, 0]), 7)], ret(1)]] });
    refusedOn(run(input, { ...LIMITS, maximumProjectionDepth: 0 }), "analysis.maximumProjectionDepth", 0);
  }
  const dynamic = graph({ locals: [[param(0), OBJ], [param(1), OBJ], [param(2), F64]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), F64], [element(0, 0), OBJ], [indexed(0, 2), OBJ]],
    blocks: [[[assign(3, use(1))], ret(4)]] });
  refusedOn(run(dynamic, { ...LIMITS, maximumOriginAlternatives: 1 }), "analysis.maximumOriginAlternatives", 1);
  const manyCells = graph({ locals: [[param(0), OBJ], [param(1), OBJ], [param(2), OBJ], [param(3), F64]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ], [local(3), F64],
      [element(0, 0), OBJ], [element(0, 1), OBJ], [indexed(0, 3), OBJ]],
    blocks: [[[assign(4, use(1)), assign(5, use(2))], ret(6)]] });
  refusedOn(run(manyCells, { ...LIMITS, maximumOriginAlternatives: 2 }), "analysis.maximumOriginAlternatives", 2);
  const thrown = graph({ locals: [[param(0), OBJ], [{ kind: "exception" }, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [field(0, "f"), OBJ]],
    blocks: [[[], { ...at(0), kind: "throw", operand: { kind: "place", place: 2 }, unwind: { kind: "handler", exception: 1, target: 1 } }], [[], ret(1)]] });
  refusedOn(run(thrown, { ...LIMITS, maximumProjectionDepth: 0 }), "analysis.maximumProjectionDepth", 0);
});

test("sorted producer unions preserve overlapping alternatives and absence without duplicate members", async () => {
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const input = graph({ locals: [[param(0), OBJ], [param(1), OBJ], [param(2), OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ], [local(3), OBJ]], blocks: [[[], ret(3)]] });
  const kernelState = stateKernel(input);
  for (const row of input.locals) state.entryValue(kernelState, row);
  const problem = state.originsProblem(kernelState, 100);
  const left = { reached: true, cells: new Map([[-4, { producers: [0, 1], absent: false }]]), stamp: -1 };
  const right = { reached: true, cells: new Map([[-4, { producers: [1, 2], absent: true }]]), stamp: -1 };
  const joined = problem.lattice.join(left, right);
  assert.deepEqual(joined.cells.get(-4), { producers: [0, 1, 2], absent: true });
  assert.deepEqual(problem.lattice.join(right, left).cells.get(-4), joined.cells.get(-4));
});

test("a projected arena obeys every below/exact record and reference allowance", () => {
  for (const field of ["maximumRelationalRecordsPerBody", "maximumRelationalReferencesPerBody"]) {
    ok(run(k8(), { ...LIMITS, [field]: 8 }));
    for (let maximum = 0; maximum < 8; maximum += 1) refusedOn(run(k8(), { ...LIMITS, [field]: maximum }), field, maximum);
  }
});

test("deep producer paths retain one parent and one segment per node and close to exact linear arena records", async () => {
  const { closeArena } = await import("../../packages/host/dist/analyses/origins/arena.js");
  const { childSpec, fieldSegment, rootSpec } = await import("../../packages/host/dist/analyses/origins/keys.js");
  for (const depth of [1, 8, 128, 2048]) {
    const specs = [rootSpec({ kind: "parameter", index: 0 })];
    const segment = fieldSegment(member("next"));
    for (let position = 0; position < depth; position += 1) {
      const child = childSpec(specs[position], position, segment);
      assert.deepEqual(child, { key: `${position}/f${segment.key}`, root: specs[0].root,
        parent: position, segment, depth: position + 1 });
      specs.push(child);
    }
    const context = { receiver: null, arguments: [{ producers: [0], absent: false }] };
    const rows = [{ producers: [depth], absent: false }];
    const required = depth + 7;
    const limits = { maximumRecords: required, maximumReferences: required };
    const result = closeArena(arenaExecution(), specs, context, rows, limits, flow.createAccount(FLOW));
    assert.equal(result.kind, "closed");
    assert.equal(result.arena.projections.length, depth);
    assert.equal(result.arena.producers.length, 2);
    for (const [position, path] of result.arena.projections.entries()) {
      assert.equal(path.id, position);
      assert.equal(path.parent, position === 0 ? null : position - 1);
    }
    assert.deepEqual(result.arena.producers.map(producer => producer.path), [null, depth - 1]);
    refusedOn(closeArena(arenaExecution(), specs, context, rows, { ...limits, maximumRecords: required - 1 }, flow.createAccount(FLOW)), "analysis.maximumRelationalRecordsPerBody", required - 1);
    refusedOn(closeArena(arenaExecution(), specs, context, rows, { ...limits, maximumReferences: required - 1 }, flow.createAccount(FLOW)), "analysis.maximumRelationalReferencesPerBody", required - 1);
  }
});

test("canonical root and segment ordering is total and independent of provisional producer numbering", async () => {
  const { compareRoots, compareSegments, fieldSegment } = await import("../../packages/host/dist/analyses/origins/keys.js");
  const roots = [{ kind: "receiver" }, { kind: "parameter", index: 0 }, { kind: "parameter", index: 1 },
    { kind: "allocation", node: 0 }, { kind: "allocation", node: 1 }];
  const segments = [fieldSegment(member("a")), fieldSegment(member("b")), { kind: "index", index: 0 },
    { kind: "index", index: 1 }, { kind: "element" }];
  for (const [values, compare] of [[roots, compareRoots], [segments, compareSegments]]) {
    for (const [leftIndex, left] of values.entries()) for (const [rightIndex, right] of values.entries()) {
      assert.equal(Math.sign(compare(left, right)), Math.sign(leftIndex - rightIndex));
    }
  }
});

test("same-spelling native fields retain distinct origin/binding cells while read/write/check access to the same field aliases (codec-only)", () => {
  const declaration = name => ids.encodeDefId({ module: MODULE, segments: [{ name, ordinal: 0 }] });
  const firstOwner = declaration("Base.field");
  const secondOwner = declaration("Derived.field");
  const selected = (owner, bindings = EMPTY_VECTOR, change = {}) => ({
    decision: { ...memberDecision("field", OBJ, OBJ, direct("in-place")),
      origins: [{ kind: "declared", declaration: owner }], selectedDeclarations: [owner], primary: owner, bindings, ...change },
    getter: null, setter: null,
  });
  const first = selected(firstOwner, EMPTY_VECTOR, { read: null });
  const readFirst = selected(firstOwner, EMPTY_VECTOR, { write: null,
    location: { kind: "data", check: { kind: "required", failure: "unwind" }, receiver: "by-reference" } });
  const fieldAt = selection => ({ kind: "place", place: 0, projection: { kind: "field", member: selection }, tir: at(0).tir });
  const returned = (writeSecond, read = readFirst, writeFirst = first) => {
    const result = ok(run(graph({ locals: [[param(0), OBJ], [param(1), OBJ], [param(2), OBJ], [user, OBJ]],
      places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ], [local(3), OBJ],
        [fieldAt(writeFirst), OBJ], [fieldAt(writeSecond), OBJ], [fieldAt(read), OBJ]],
      blocks: [[[assign(4, use(1)), assign(5, use(2)), assign(3, use(6))], ret(3)]] })));
    const origins = result.arena.origins[result.subjects[0].origins];
    return origins.producers.map(bound => {
      const producer = result.arena.producers[result.arena.boundProducers[bound].producer];
      return { index: producer.index, projected: producer.path !== null };
    });
  };
  assert.deepEqual(returned(selected(secondOwner)), [{ index: 0, projected: true }, { index: 1, projected: false }]);
  assert.deepEqual(returned(selected(firstOwner)),
    [{ index: 0, projected: true }, { index: 1, projected: false }, { index: 2, projected: false }]);
  const bound = type => ({ ...EMPTY_VECTOR, classBindings: [{ kind: "bound", parameter: { owner: firstOwner, index: 0 }, type }] });
  assert.deepEqual(returned(selected(firstOwner, bound(BOOL)), selected(firstOwner, bound(F64)), selected(firstOwner, bound(F64))),
    [{ index: 0, projected: true }, { index: 1, projected: false }]);
  assert.deepEqual(returned(selected(firstOwner, bound(F64)), selected(firstOwner, bound(F64), { write: null }), selected(firstOwner, bound(F64), { read: null })),
    [{ index: 0, projected: true }, { index: 1, projected: false }, { index: 2, projected: false }]);
});

test("an accessor selection cannot masquerade as a native field projection", async () => {
  const { fieldSegment } = await import("../../packages/host/dist/analyses/origins/keys.js");
  const accessor = { ...member("field"), decision: { ...member("field").decision, location: { kind: "accessor" } } };
  assert.throws(() => fieldSegment(accessor), /caller defect: a field projection does not select a data location/);
});

test("canonical physical field representative is independent of actual read/write encounter order and root numbering", async () => {
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const { closeArena } = await import("../../packages/host/dist/analyses/origins/arena.js");
  const owner = ids.encodeDefId({ module: MODULE, segments: [{ name: "Object.field", ordinal: 0 }] });
  const selected = change => ({ decision: { ...memberDecision("field", OBJ, OBJ, direct("in-place")),
    origins: [{ kind: "declared", declaration: owner }], selectedDeclarations: [owner], primary: owner, ...change }, getter: null, setter: null });
  const read = selected({ write: null, location: { kind: "data", check: { kind: "required", failure: "unwind" }, receiver: "by-reference" } });
  const write = selected({ read: null });
  const fieldAt = (place, member) => ({ kind: "place", place, projection: { kind: "field", member }, tir: at(0).tir });
  const input = graph({ locals: [[param(0), OBJ], [param(1), OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [fieldAt(0, read), OBJ], [fieldAt(0, write), OBJ],
      [fieldAt(1, read), OBJ], [fieldAt(1, write), OBJ]], blocks: [[[], ret(null)]] });
  const close = order => {
    const kernelState = stateKernel(input);
    const problem = state.originsProblem(kernelState, 100);
    const values = [];
    for (const place of order) values.push(state.readPlace(kernelState, problem.boundary, input.places[place]));
    const context = { receiver: null, arguments: input.locals.map(local => state.entryValue(kernelState, local)) };
    const result = closeArena(arenaExecution(), kernelState.specs, context, values,
      { maximumRecords: 100, maximumReferences: 100 }, flow.createAccount(FLOW));
    assert.equal(result.kind, "closed");
    return result.arena;
  };
  const expected = close([2, 3, 4, 5]);
  assert.deepEqual(close([3, 2, 5, 4]), expected, "same producer, opposite read/write processing");
  assert.deepEqual(close([4, 5, 2, 3]), expected, "opposite root/provisional numbering");
  assert.deepEqual(close([5, 4, 3, 2]), expected, "opposite root and access processing together");
  const branchArena = reversed => {
    const leg = selection => [[assign(3, use(selection))], goto(3)];
    const result = ok(run(graph({ locals: [[param(0), OBJ], [param(1), OBJ], [param(2), BOOL], [user, OBJ]],
      places: [[local(0), OBJ], [local(1), OBJ], [local(2), BOOL], [local(3), OBJ],
        [fieldAt(0, read), OBJ], [fieldAt(1, write), OBJ]],
      blocks: [[[], branch(2, reversed ? 2 : 1, reversed ? 1 : 2)],
      ...(reversed ? [leg(5), leg(4)] : [leg(4), leg(5)]), [[], ret(3)]] })));
    return result.arena;
  };
  assert.deepEqual(branchArena(true), branchArena(false), "opposite branch/block numbering selects the same genuine representative");
});

test("a refused deep path does not inspect later roots or rows and duplicate paths do not consume records", async () => {
  const { closeArena } = await import("../../packages/host/dist/analyses/origins/arena.js");
  const { childSpec, fieldSegment, rootSpec } = await import("../../packages/host/dist/analyses/origins/keys.js");
  const specs = [rootSpec({ kind: "parameter", index: 0 })];
  const segment = fieldSegment(member("next"));
  for (let position = 0; position < 128; position += 1) specs.push(childSpec(specs[position], position, segment));
  const rows = [{ producers: [128], absent: false }, { producers: [-1], absent: false }];
  refusedOn(closeArena(arenaExecution(), specs, { receiver: null, arguments: [] }, rows,
    { maximumRecords: 4, maximumReferences: 10000 }, flow.createAccount(FLOW)), "analysis.maximumRelationalRecordsPerBody", 4);
  const duplicateSpecs = [rootSpec({ kind: "parameter", index: 0 }), rootSpec({ kind: "parameter", index: 1 })];
  duplicateSpecs.push(childSpec(duplicateSpecs[0], 0, segment), childSpec(duplicateSpecs[1], 1, segment));
  const result = closeArena(arenaExecution(), duplicateSpecs, { receiver: null, arguments: [] },
    [{ producers: [2, 3], absent: false }], { maximumRecords: 7, maximumReferences: 10000 }, flow.createAccount(FLOW));
  assert.equal(result.kind, "closed");
  assert.equal(result.arena.projections.length, 1, "second root reuses the physical projection at the exact record cap");
});

test("actual binding and storage-member metadata traversal refuses before every charged projection unit", async () => {
  const keys = await import("../../packages/host/dist/analyses/origins/keys.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const owner = ids.encodeDefId({ module: MODULE, segments: [{ name: "Field", ordinal: 0 }] });
  const bindings = { classBindings: [{ kind: "bound", parameter: { owner, index: 0 }, type: F64 }],
    methodBindings: [{ kind: "bound", parameter: { owner, index: 1 }, type: BOOL }],
    capturedBindings: [{ kind: "bound", parameter: { owner, index: 2 }, type: OBJ }],
    selfBindings: [{ kind: "bound", owner, type: OBJ }] };
  const origins = [{ kind: "declared", declaration: owner }, { kind: "class-prototype", owner },
    { kind: "mapped", owner: { kind: "body", value: { body: body(), node: 0 } }, key: { kind: "number", value: { numerator: 3n, denominator: 1n, negativeZero: false } } },
    { kind: "mapped", owner: { kind: "item", value: { owner, node: 0 } }, key: { kind: "symbol", declaration: owner } }];
  const operations = [account => keys.bindingWork(account, bindings),
    account => keys.segmentWork(account, null), account => keys.segmentWork(account, { kind: "element" }),
    account => keys.segmentWork(account, { kind: "index", index: 3 })];
  for (const key of [{ kind: "text", value: "field" }, { kind: "number", value: { numerator: 3n, denominator: 1n, negativeZero: false } }, { kind: "symbol", declaration: owner }]) {
    const selection = { ...member("field"), decision: { ...member("field").decision,
      key, origins, selectedDeclarations: [owner], primary: owner, bindings } };
    operations.push(account => keys.memberWork(account, selection));
    operations.push(account => keys.segmentWork(account, { kind: "field", key: "actual storage key", member: selection }));
  }
  for (const operation of operations) {
    const exact = flow.createAccount(FLOW);
    assert.equal(operation(exact), true);
    const required = InvocationAccount.stateOf(exact).work;
    for (let maximumWork = 0; maximumWork < required; maximumWork += 1) {
      const account = flow.createAccount({ ...FLOW, maximumWork });
      assert.equal(operation(account), false);
      assert.deepEqual(flow.accountFailure(account), { kind: "resource-limit", dimension: "work", maximum: maximumWork });
      const spent = InvocationAccount.stateOf(account).work;
      assert.equal(keys.memberWork(account, null), false, "first stop precedes metadata reads");
      assert.equal(keys.bindingWork(account, null), false, "first stop precedes binding traversal");
      assert.equal(InvocationAccount.stateOf(account).work, spent);
    }
    assert.equal(operation(flow.createAccount({ ...FLOW, maximumWork: required })), true);
  }
});

test("shared arena closure accounts for duplicate physical paths, representative comparisons and post-close lookups", async () => {
  const { closeArena } = await import("../../packages/host/dist/analyses/origins/arena.js");
  const keys = await import("../../packages/host/dist/analyses/origins/keys.js");
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const first = keys.rootSpec({ kind: "parameter", index: 0 });
  const second = keys.rootSpec({ kind: "parameter", index: 1 });
  const selection = member("a");
  const read = { ...selection, decision: { ...selection.decision, write: null } };
  const specs = [first, keys.childSpec(first, 0, keys.fieldSegment(selection)), second,
    keys.childSpec(second, 2, keys.fieldSegment(read)), keys.childSpec(second, 2, keys.fieldSegment(member("b")))];
  const values = [{ producers: [1, 3, 4], absent: false }];
  const context = { receiver: { producers: [0], absent: false }, arguments: [{ producers: [2], absent: false }] };
  const limits = { maximumRecords: 100, maximumReferences: 100 };
  const full = flow.createAccount(FLOW);
  const expected = closeArena(arenaExecution(), specs, context, values, limits, full);
  assert.equal(expected.kind, "closed");
  const required = InvocationAccount.stateOf(full).work;
  for (let maximumWork = 0; maximumWork < required; maximumWork += 1) {
    const account = flow.createAccount({ ...FLOW, maximumWork });
    assert.deepEqual(closeArena(arenaExecution(), specs, context, values, limits, account),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  }
  assert.equal(closeArena(arenaExecution(), specs, context, values, limits,
    flow.createAccount({ ...FLOW, maximumWork: required })).kind, "closed");
  const cause = state.originRefusal(arenaExecution(), "analysis.maximumProjectionDepth", 0, null);
  assert.equal(flow.refuseAccount(full, cause), cause);
  assert.equal(expected.originsOf(null), cause, "lookup stops before inspecting its value");
  assert.equal(closeArena(null, null, null, null, null, full), cause, "closure stops before inspecting inputs");
  assert.equal(keys.requiredStop(full), cause);
  assert.throws(() => keys.requiredStop(flow.createAccount(FLOW)), /a failed operation has no invocation stop/);
  assert.throws(() => closeArena({ ...arenaExecution(), instance: { body: body(), bindings: { kind: "parametric" } } },
    [], { receiver: null, arguments: [] }, [], limits, flow.createAccount(FLOW)), /a template has no complete bound producer vector/);
});

test("joins and equality traverse distinct existing cell keys without dropping the right-only stored relation", async () => {
  const state = await import("../../packages/host/dist/analyses/origins/state.js");
  const input = graph({ locals: [[param(0), OBJ], [user, OBJ], [user, OBJ]],
    places: [[local(0), OBJ], [local(1), OBJ], [local(2), OBJ]], blocks: [[[], ret(null)]] });
  const owned = stateKernel(input);
  const problem = state.originsProblem(owned, 100);
  const left = problem.statement(assign(1, use(0)), problem.boundary);
  state.seal(owned);
  const right = problem.statement(assign(2, use(0)), problem.boundary);
  const joined = problem.lattice.join(left, right);
  assert.equal(joined.cells.size, 2);
  assert.deepEqual([...joined.cells.keys()], [-2, -3]);
  assert.equal(problem.lattice.equals(left, right), false);
  assert.equal(problem.lattice.equals(joined, joined), true);
});

test("every successful existing values fixture stops at every earlier shared-work boundary without partial facts", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  assert.equal(completedExecutions.length > 20, true, "actual producer, store, join, projection and publication fixtures are present");
  for (const [position, { input, result }] of completedExecutions.entries()) {
    const required = InvocationAccount.stateOf(input.account).work;
    for (let maximumWork = 0; maximumWork < required; maximumWork += 1) {
      const account = flow.createAccount({ ...FLOW, maximumWork });
      const refused = kernel.analyzeOriginsValues({ ...input, account });
      refusedOn(refused, "dataflow.maximumWork", maximumWork);
      assert.equal(flow.accountFailure(account).kind, "resource-limit", `fixture ${position}: same work account owns the first stop`);
    }
    assert.deepEqual(kernel.analyzeOriginsValues({ ...input, account: flow.createAccount({ ...FLOW, maximumWork: required }) }), result,
      `fixture ${position}: exact work preserves its independently asserted facts`);
  }
});
