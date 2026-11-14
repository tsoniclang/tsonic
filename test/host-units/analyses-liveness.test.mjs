// Unit cases for analyzeStorageUse (COMPONENTS §10.1 line 1412, §10.2.1 line 1426). Constructed lowered bodies,
// round-tripped through the MIR codec: unit cases only (line 1543), not pipeline proof. Every expected result is
// written from the case's own statements, before any run.
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { after, before, test } from "node:test";
import { readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { parseSources, readImportGraph } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";
import { T, TABLE, callee, direct, memberDecision, verificationContext } from "./fixtures/lower-mir/typed.mjs";
import { add, plus } from "./fixtures/lower-mir/programs/first.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index", "model", "storage-use"].map(name => resolve(repository, `packages/host/dist/analyses/liveness/${name}.js`));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) =>
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error)));

let liveness;
let mir;
let ids;
let identity;
const executions = [];

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "aggregate process-group admission is required");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  liveness = await import("../../packages/host/dist/analyses/liveness/index.js");
  mir = await import("../../packages/host/dist/ir-mir/index.js");
  ids = await import("../../packages/host/dist/ids/index.js");
  const module = ids.encodeModuleId({ package: ids.encodePackageId("liveness"), path: "entry.ts" });
  const definition = ids.encodeDefId({ module, segments: [{ name: "entry", ordinal: 0 }] });
  const body = ids.encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
  const other = ids.encodeBodyId({ owner: definition, role: "function", ordinal: 1 });
  identity = { module, definition, body, other };
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
      project: (url, text) => ({ path: fileURLToPath(url), text }) }, runtimeFiles, [{ ...capture, result, sources }]);
    writeFileSync(resolve(repository, ".temp/liveness-coverage.json"), JSON.stringify(report, null, 2));
    assert.equal(result.length, runtimeFiles.length);
    assert.equal(report.status, "passed", JSON.stringify(report.findings));
  } finally { session.disconnect(); }
});

const wide = { maximumWork: 1_000_000, maximumResultEntries: 1_000_000 };

function site(node = 0) {
  return { origin: { module: identity.module, start: 0, length: 1, derived: [] }, tir: { body: identity.body, node: ids.nodeId(node) } };
}

const stepped = new Set(["assign", "switch", "call", "invoke", "await", "yield", "delegate"]);
const unstepped = record => stepped.has(record.kind) ? { step: null, ...record } : record;

// locals: [{ role, source }]; places: [base]; blocks: [{ statements, terminator }]; entries: [{ provided, block }].
function body({ locals, places, blocks, entries = [{ provided: 0, block: 0 }] }) {
  const value = {
    body: identity.body,
    bindings: { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } },
    entries: entries.map(entry => ({ provided: entry.provided, block: ids.blockId(entry.block) })),
    locals: locals.map((local, index) => ({ id: ids.localId(index), storage: ids.tyId(0), role: local.role,
      mode: local.mode ?? (local.role.kind === "parameter" ? "by-value" : "local"),
      source: local.source ? { body: identity.body, local: ids.localId(index) } : null, origin: site().origin })),
    constants: [{ id: ids.constId(0), type: ids.tyId(0), value: { kind: "literal", value: { kind: "boolean", value: true } } }],
    places: places.map((base, index) => ({ id: ids.placeId(index), base, storage: ids.tyId(0), origin: site().origin })),
    blocks: blocks.map((block, index) => ({ ...site(), id: ids.blockId(index),
      statements: block.statements.map(({ node, ...statement }) => ({ ...site(node ?? 0), ...unstepped(statement) })),
      terminator: { ...site(), ...unstepped(block.terminator) } })),
    result: ids.tyId(0),
  };
  const parsed = mir.parseMir(mir.printMir(value));
  assert.equal(isDeepStrictEqual(parsed, { kind: "parsed", value }), true, "the MIR codec produces the complete typed input");
  executions.push(parsed.value);
  return parsed.value;
}

const local = index => ({ kind: "local", local: ids.localId(index) });
const place = index => ({ kind: "place", place: ids.placeId(index) });
const constant = () => ({ kind: "constant", constant: ids.constId(0) });
const discard = () => ({ decision: { kind: "selected", operation: { kind: "discard" }, operands: [ids.tyId(0), ids.tyId(0)], result: ids.tyId(0),
  execution: { kind: "pure" } }, permissionScope: null });
const assign = (target, value, node = 0) => ({ kind: "assign", place: ids.placeId(target), value, node });
const use = operand => ({ kind: "use", operand });
const segment = (block, first, last) => ({ block: ids.blockId(block), first, last });
const range = (index, ...segments) => ({ local: ids.localId(index), segments });
const store = (node, block, statement, observed, edge = null) => ({ node: ids.nodeId(node), point: { block: ids.blockId(block), statement }, edge, observed });

function run(lowered, provided = 0, limits = wide) {
  return liveness.analyzeStorageUse({ execution: { instance: { body: lowered.body, bindings: lowered.bindings }, provided }, body: lowered, limits });
}

function facts(lowered, provided = 0) {
  const result = run(lowered, provided);
  assert.equal(result.kind, "ok");
  return result.value;
}

test("straight line: each value is live from its write to its last read, and every store is observed", () => {
  // t = a + b; r = t; return r
  const lowered = body({
    locals: [{ role: { kind: "return" } }, { role: { kind: "parameter", index: 0 }, source: true },
      { role: { kind: "parameter", index: 1 }, source: true }, { role: { kind: "temporary" } }],
    places: [local(0), local(1), local(2), local(3)],
    blocks: [{ statements: [assign(3, { kind: "binary", operation: discard(), left: place(1), right: place(2) }, 1), assign(0, use(place(3)), 2)],
      terminator: { kind: "return", value: place(0) } }],
  });
  const value = facts(lowered);
  assert.equal(isDeepStrictEqual(value.locals, [range(0, segment(0, 2, 2)), range(1, segment(0, 0, 0)), range(2, segment(0, 0, 0)),
    range(3, segment(0, 1, 1))]), true, JSON.stringify(value.locals));
  assert.equal(isDeepStrictEqual(value.stores, [store(1, 0, 0, true), store(2, 0, 1, true)]), true, JSON.stringify(value.stores));
  assert.equal(isDeepStrictEqual(value.captures, []), true);
});

test("dead store: a value overwritten before any read is unobserved; a read between makes it observed", () => {
  const dead = body({
    locals: [{ role: { kind: "user" } }], places: [local(0)],
    blocks: [{ statements: [assign(0, use(constant()), 1), assign(0, use(constant()), 2)], terminator: { kind: "return", value: place(0) } }],
  });
  const deadFacts = facts(dead);
  assert.equal(isDeepStrictEqual(deadFacts.stores, [store(1, 0, 0, false), store(2, 0, 1, true)]), true, JSON.stringify(deadFacts.stores));
  assert.equal(isDeepStrictEqual(deadFacts.locals, [range(0, segment(0, 2, 2))]), true);
  const read = body({
    locals: [{ role: { kind: "user" } }, { role: { kind: "user" } }], places: [local(0), local(1)],
    blocks: [{ statements: [assign(0, use(constant()), 1), assign(1, use(place(0)), 2), assign(0, use(constant()), 3)],
      terminator: { kind: "return", value: place(0) } }],
  });
  const readFacts = facts(read);
  assert.equal(isDeepStrictEqual(readFacts.stores, [store(1, 0, 0, true), store(2, 0, 1, false), store(3, 0, 2, true)]), true,
    JSON.stringify(readFacts.stores));
});

test("branch: a value read on one arm only is live into that arm and not the other", () => {
  // b0: x = c; switch c -> b1 | b2.  b1: return x.  b2: return c
  const lowered = body({
    locals: [{ role: { kind: "user" } }, { role: { kind: "user" } }], places: [local(0), local(1)],
    blocks: [
      { statements: [assign(0, use(constant()), 1)], terminator: { kind: "switch", operand: place(1),
        targets: [{ constant: ids.constId(0), target: ids.blockId(1) }], otherwise: ids.blockId(2) } },
      { statements: [], terminator: { kind: "return", value: place(0) } },
      { statements: [], terminator: { kind: "return", value: place(1) } },
    ],
  });
  const value = facts(lowered);
  assert.equal(isDeepStrictEqual(value.locals, [range(0, segment(0, 1, 1), segment(1, 0, 0)),
    range(1, segment(0, 0, 1), segment(2, 0, 0))]), true, JSON.stringify(value.locals));
});

test("loop: a value read after the loop is live through every loop block; one read only before it is not", () => {
  // b0: x = c; y = c; goto b1.  b1: switch y -> b2 | b3.  b2: y = c; goto b1.  b3: return x
  const lowered = body({
    locals: [{ role: { kind: "user" } }, { role: { kind: "user" } }], places: [local(0), local(1)],
    blocks: [
      { statements: [assign(0, use(constant()), 1), assign(1, use(constant()), 2)], terminator: { kind: "goto", target: ids.blockId(1) } },
      { statements: [], terminator: { kind: "switch", operand: place(1), targets: [{ constant: ids.constId(0), target: ids.blockId(2) }],
        otherwise: ids.blockId(3) } },
      { statements: [assign(1, use(constant()), 3)], terminator: { kind: "goto", target: ids.blockId(1) } },
      { statements: [], terminator: { kind: "return", value: place(0) } },
    ],
  });
  const value = facts(lowered);
  assert.equal(isDeepStrictEqual(value.locals, [range(0, segment(0, 1, 2), segment(1, 0, 0), segment(2, 0, 1), segment(3, 0, 0)),
    range(1, segment(0, 2, 2), segment(1, 0, 0), segment(2, 1, 1))]), true, JSON.stringify(value.locals));
  assert.equal(value.stores.every(row => row.observed), true);
});

test("address taken: the local is live at every position and every store to it is observed", () => {
  // x = c; p = &x; x = c; return c
  const lowered = body({
    locals: [{ role: { kind: "user" }, source: true }, { role: { kind: "user" } }], places: [local(0), local(1)],
    blocks: [{ statements: [assign(0, use(constant()), 1), assign(1, { kind: "address-of", place: ids.placeId(0), type: ids.tyId(0) }, 2),
      assign(0, use(constant()), 3)], terminator: { kind: "return", value: constant() } }],
  });
  const value = facts(lowered);
  assert.equal(isDeepStrictEqual(value.locals, [range(0, segment(0, 0, 3))]), true, JSON.stringify(value.locals));
  assert.equal(isDeepStrictEqual(value.stores, [store(1, 0, 0, true), store(2, 0, 1, false), store(3, 0, 2, true)]), true,
    JSON.stringify(value.stores));
});

test("a store to a static is observed", () => {
  const lowered = body({
    locals: [], places: [{ kind: "static", definition: identity.definition }],
    blocks: [{ statements: [assign(0, use(constant()), 1)], terminator: { kind: "return", value: null } }],
  });
  assert.equal(isDeepStrictEqual(facts(lowered).stores, [store(1, 0, 0, true)]), true);
});

test("entries: each provided count selects its own entry block; a count with no entry is a caller defect", () => {
  // b0 (provided 0): x = c; goto b1.  b1 (provided 1): return x
  const lowered = body({
    locals: [{ role: { kind: "parameter", index: 0 }, source: true }], places: [local(0)],
    entries: [{ provided: 0, block: 0 }, { provided: 1, block: 1 }],
    blocks: [
      { statements: [assign(0, use(constant()), 1)], terminator: { kind: "goto", target: ids.blockId(1) } },
      { statements: [], terminator: { kind: "return", value: place(0) } },
    ],
  });
  assert.equal(isDeepStrictEqual(facts(lowered, 0).locals, [range(0, segment(0, 1, 1), segment(1, 0, 0))]), true);
  assert.equal(isDeepStrictEqual(facts(lowered, 1).locals, [range(0, segment(1, 0, 0))]), true, "block 0 is not executed from entry 1");
  assert.equal(isDeepStrictEqual(facts(lowered, 1).stores, []), true);
  assert.throws(() => run(lowered, 2));
});

test("caller defect: a lowered body of another execution", () => {
  const lowered = body({ locals: [], places: [], blocks: [{ statements: [], terminator: { kind: "return", value: null } }] });
  assert.throws(() => liveness.analyzeStorageUse({ execution: { instance: { body: identity.other, bindings: lowered.bindings }, provided: 0 },
    body: lowered, limits: wide }));
});

test("limits: solver and published family rows share the one cumulative result allowance", () => {
  const lowered = body({
    locals: [{ role: { kind: "return" } }, { role: { kind: "parameter", index: 0 }, source: true },
      { role: { kind: "parameter", index: 1 }, source: true }, { role: { kind: "temporary" } }],
    places: [local(0), local(1), local(2), local(3)],
    blocks: [{ statements: [assign(3, { kind: "binary", operation: discard(), left: place(1), right: place(2) }, 1), assign(0, use(place(3)), 2)],
      terminator: { kind: "return", value: place(0) } }],
  });
  assert.equal(run(lowered, 0, { maximumWork: 1_000_000, maximumResultEntries: 15 }).kind, "ok");
  const under = run(lowered, 0, { maximumWork: 1_000_000, maximumResultEntries: 14 });
  assert.equal(under.kind, "refused");
  assert.equal(under.diagnostics.length, 1);
  assert.equal(run(lowered, 0, { maximumWork: 0, maximumResultEntries: 1_000_000 }).kind, "refused");
});

const capture = index => ({ role: { kind: "capture", index }, mode: "captured-value", source: true });
const indexed = (base, operand) => ({ kind: "place", place: ids.placeId(base),
  projection: { kind: "index", operand: place(operand) }, tir: site().tir });
const captureFact = (index, reads, writes) => ({ local: { body: identity.body, local: ids.localId(index) }, reads, writes });

test("capture reads include a destination index, not merely the assigned rvalue or carried live state", () => {
  const lowered = body({
    locals: [{ role: { kind: "user" } }, capture(0), capture(1)],
    places: [local(0), local(1), local(2), indexed(0, 1)],
    blocks: [{ statements: [assign(3, use(constant()), 1)], terminator: { kind: "return", value: constant() } }],
  });
  assert.equal(isDeepStrictEqual(facts(lowered).captures, [captureFact(1, true, false), captureFact(2, false, false)]), true);
});

test("capture reads include each terminator edge destination index", () => {
  const lowered = body({
    locals: [{ role: { kind: "user" } }, capture(0), capture(1), capture(2)],
    places: [local(0), local(1), local(2), local(3), indexed(0, 1), indexed(0, 2)],
    blocks: [{ statements: [], terminator: { kind: "invoke", operation: discard(), operands: [],
      destination: ids.placeId(4), next: ids.blockId(1),
      unwind: { kind: "handler", exception: ids.placeId(5), target: ids.blockId(1) } } },
    { statements: [], terminator: { kind: "return", value: null } }],
  });
  const result = facts(lowered);
  assert.equal(isDeepStrictEqual(result.captures, [captureFact(1, true, false), captureFact(2, true, false),
    captureFact(3, false, false)]), true);
  assert.equal(isDeepStrictEqual(result.stores, [store(0, 0, null, false, "continue"), store(0, 0, null, false, "unwind")]), true);
});

test("whole captured-cell writes differ from projected writes and unused captures", () => {
  const lowered = body({
    locals: [capture(0), capture(1), capture(2)], places: [local(0), local(1), local(2),
      { kind: "place", place: ids.placeId(1), projection: { kind: "element", index: 0 }, tir: site().tir }],
    blocks: [{ statements: [assign(0, use(constant()), 1), assign(3, use(constant()), 2)],
      terminator: { kind: "return", value: place(1) } }],
  });
  assert.equal(isDeepStrictEqual(facts(lowered).captures, [captureFact(0, false, true), captureFact(1, true, false),
    captureFact(2, false, false)]), true);
});

for (const kind of ["await", "yield", "delegate"]) {
  test(`suspension ${kind}: each actual write edge retains its role and independent observation`, () => {
    const terminator = { kind, destination: ids.placeId(0), resume: ids.blockId(1),
      unwind: { kind: "handler", exception: ids.placeId(2), target: ids.blockId(3) },
      ...(kind === "delegate" ? { iterator: constant() } : { operand: constant() }),
      ...(kind === "await" ? {} : { return: { destination: ids.placeId(1), target: ids.blockId(2) } }) };
    const lowered = body({
      locals: [capture(0), capture(1), capture(2)], places: [local(0), local(1), local(2)],
      blocks: [{ statements: [], terminator },
        { statements: [], terminator: { kind: "return", value: place(0) } },
        { statements: [], terminator: { kind: "return", value: null } },
        { statements: [], terminator: { kind: "return", value: place(2) } }],
    });
    const value = facts(lowered);
    const expected = [store(0, 0, null, true, "resume"),
      ...(kind === "await" ? [] : [store(0, 0, null, false, "return")]), store(0, 0, null, true, "unwind")];
    assert.equal(isDeepStrictEqual(value.stores, expected), true, JSON.stringify(value.stores));
    assert.equal(isDeepStrictEqual(value.captures, [captureFact(0, true, true),
      captureFact(1, false, kind !== "await"), captureFact(2, true, true)]), true);
  });
}

test("writing through dereference reads its pointer; a refined whole cell is killed by a write", () => {
  const lowered = body({
    locals: [capture(0), capture(1)], places: [local(0), local(1),
      { kind: "place", place: ids.placeId(0), projection: { kind: "deref" }, tir: site().tir },
      { kind: "place", place: ids.placeId(1), projection: { kind: "refined" }, tir: site().tir }],
    blocks: [{ statements: [assign(2, use(constant()), 1), assign(3, use(constant()), 2)],
      terminator: { kind: "return", value: null } }],
  });
  const value = facts(lowered);
  assert.equal(isDeepStrictEqual(value.captures, [captureFact(0, true, false), captureFact(1, false, true)]), true);
  assert.equal(isDeepStrictEqual(value.stores, [store(1, 0, 0, true), store(2, 0, 1, false)]), true);
});

test("storage markers end a previous value's live range without manufacturing capture reads", () => {
  const lowered = body({
    locals: [capture(0)], places: [local(0)],
    blocks: [{ statements: [assign(0, use(constant()), 1), { kind: "storage-dead", local: ids.localId(0) },
      { kind: "storage-live", local: ids.localId(0) }], terminator: { kind: "return", value: place(0) } }],
  });
  const value = facts(lowered);
  assert.equal(value.stores[0].observed, false);
  assert.equal(isDeepStrictEqual(value.locals, [range(0, segment(0, 3, 3))]), true);
  assert.equal(isDeepStrictEqual(value.captures, [captureFact(0, true, true)]), true);
});

test("an empty execution has an exact cumulative three-row solver bound and no partial publication", () => {
  const lowered = body({ locals: [], places: [], blocks: [{ statements: [], terminator: { kind: "return", value: null } }] });
  for (let maximumResultEntries = 0; maximumResultEntries < 3; maximumResultEntries += 1)
    assert.equal(run(lowered, 0, { ...wide, maximumResultEntries }).kind, "refused");
  assert.equal(run(lowered, 0, { ...wide, maximumResultEntries: 3 }).kind, "ok");
});

test("all prefixes of the current shared-work allowance refuse instead of leaking a partial family", () => {
  const lowered = body({
    locals: [capture(0)], places: [local(0)],
    blocks: [{ statements: [assign(0, use(constant()), 1)], terminator: { kind: "return", value: place(0) } }],
  });
  let required = 0;
  while (run(lowered, 0, { ...wide, maximumWork: required }).kind !== "ok") {
    required += 1;
    assert.equal(required < 100_000, true);
  }
  for (let maximumWork = 0; maximumWork < required; maximumWork += 1) {
    const result = run(lowered, 0, { ...wide, maximumWork });
    assert.equal(result.kind, "refused", `work ${maximumWork}/${required}`);
    assert.equal(result.diagnostics.length, 1);
  }
  assert.equal(isDeepStrictEqual(run(lowered, 0, { ...wide, maximumWork: required }).value, facts(lowered)), true);
});

test("empty execution work has the independently derived exact identity/setup/solver/replay allowance", () => {
  const lowered = body({ locals: [], places: [], blocks: [{ statements: [], terminator: { kind: "return", value: null } }] });
  const required = 16 * lowered.body.length + 39;
  assert.equal(run(lowered, 0, { ...wide, maximumWork: required }).kind, "ok");
  assert.equal(run(lowered, 0, { ...wide, maximumWork: required - 1 }).kind, "refused");
});

test("a real complete typed add is lowered, verified and produces independently derived Liveness without other fact families", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const lower = await import("../../packages/host/dist/lower-mir/index.js");
  const step = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  const factsOwner = await import("../../packages/host/dist/ir-facts/index.js");
  const program = add("liveness.add", T.float64, plus("float64", T.float64));
  const declared = verificationContext(program);
  const runState = { interner: types.seedTypeInterner(TABLE), table: TABLE,
    defs: { completionSelector: T.int32, exceptionStorage: T.unknown },
    lowering: { maximumRecords: 1000 }, verification: { maximumWork: 100000 },
    declarationOf: declared.declarationOf, bodyOwner: declared.bodyOwner, bodyOf: declared.bodyOf };
  const typed = { ...program.tir, bindings: { kind: "instantiated",
    bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } };
  const lowered = lower.lowerToMir(step.lowerMirDeps(runState), typed, []);
  assert.equal(lowered.kind, "ok");
  assert.equal(isDeepStrictEqual(mir.verifyMir(lowered.value, step.mirVerificationContext(runState, typed)),
    { kind: "complete", violations: [] }), true);
  const value = facts(lowered.value, 2);
  assert.equal(value.stores.every(row => row.observed), true);
  assert.equal(value.captures.length, 0);
  assert.equal(value.bindings.every(row => !row.addressTaken && !row.captured), true);
  const violations = factsOwner.verifyLiveness(value, { body: typed.body, bindings: typed.bindings }, lowered.value,
    { tirBody: () => typed, nodeExists: reference => reference.kind === "body" && reference.value.body === typed.body,
      localExists: reference => reference.body === typed.body && typed.locals.some(row => row.id === reference.local) });
  assert.equal(isDeepStrictEqual(violations, []), true, JSON.stringify(violations));
});

test("call argument address modes, omitted values, captures and actual receiver reads remain distinct", () => {
  for (const passing of ["byref-readonly", "borrow-shared", "byref-readwrite", "byref-writeonly-must-init"]) {
    const lowered = body({
      locals: [capture(0), capture(1), capture(2), capture(3)], places: [local(0), local(1), local(2), local(3)],
      blocks: [{ statements: [], terminator: { kind: "call",
        callee: { kind: "body", instance: { body: identity.other, bindings: { kind: "instantiated",
          bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } }, captures: [] },
        receiver: place(2), arguments: [{ kind: "omitted" }, { kind: "value", passing: "move", operand: place(1) },
          { kind: "place", passing, place: ids.placeId(0) }], destination: null, next: ids.blockId(1), unwind: { kind: "escape" } } },
      { statements: [], terminator: { kind: "return", value: null } }],
    });
    const value = facts(lowered);
    assert.equal(isDeepStrictEqual(value.captures, [captureFact(0, passing !== "byref-writeonly-must-init",
      passing !== "byref-readonly" && passing !== "borrow-shared"), captureFact(1, true, false),
    captureFact(2, true, false), captureFact(3, false, false)]), true, passing);
    assert.equal(isDeepStrictEqual(value.bindings.map(row => row.addressTaken), [true, false, false, false]), true);
  }
});

test("closure creation captures its actual qualified source binding, not an unrelated local", () => {
  const lowered = body({
    locals: [{ role: { kind: "temporary" } }, { role: { kind: "user" }, source: true }, { role: { kind: "user" }, source: true }],
    places: [local(0), local(1), local(2)],
    blocks: [{ statements: [assign(0, { kind: "closure", instance: { body: identity.other, bindings: { kind: "parametric" } },
      captures: [{ local: { body: identity.body, local: ids.localId(1) }, place: ids.placeId(1), capture: "captured-location" }] }, 1)],
      terminator: { kind: "return", value: place(0) } }],
  });
  assert.equal(isDeepStrictEqual(facts(lowered).bindings, [
    { local: ids.localId(1), addressTaken: false, captured: true },
    { local: ids.localId(2), addressTaken: false, captured: false },
  ]), true);
});

test("replay reuses one read footprint and does not rescan unrelated local roles for capture evidence", () => {
  const countReads = statements => {
    const lowered = body({ locals: Array.from({ length: 128 }, () => ({ role: { kind: "user" } })),
      places: [local(0), local(1)], blocks: [{ statements: Array.from({ length: statements }, (_, index) =>
        assign(0, use(place(1)), index)), terminator: { kind: "return", value: null } }] });
    let reads = 0;
    const original = lowered.locals[127];
    lowered.locals[127] = { ...original, get role() { reads += 1; return original.role; } };
    facts(lowered);
    return reads;
  };
  assert.equal(countReads(32), countReads(1), "an unrelated role is read only at its owning setup/publication boundaries");
});

test("statement transfer consumes the already-computed exact footprint without reading the rvalue twice", async () => {
  const model = await import("../../packages/host/dist/analyses/liveness/model.js");
  const flow = await import("../../packages/host/dist/dataflow/index.js");
  const lowered = body({ locals: [{ role: { kind: "user" } }], places: [local(0)],
    blocks: [{ statements: [assign(0, use(place(0)))], terminator: { kind: "return", value: null } }] });
  const account = flow.createAccount(wide);
  const analysis = { body: lowered, places: model.placeFactsOf(lowered, account), words: 1,
    zero: new Uint32Array(1), escaped: new Uint32Array(1), account };
  let reads = 0;
  const original = lowered.blocks[0].statements[0];
  const statement = { ...original, get value() { reads += 1; return original.value; } };
  const footprint = model.emptyBits(analysis);
  assert.equal(model.statementReads(analysis, statement, footprint), true);
  const before = model.statementBefore(analysis, statement, analysis.zero, footprint);
  assert.equal(reads, 1, "the one footprint is reused for transfer rather than re-traversing the rvalue");
  assert.equal(model.hasBit(before, 0), true);
});

test("selected incoming storage modes distinguish body slots from externally observable cells even through role aliases", () => {
  for (const mode of ["local", "by-value", "move", "captured-value", "byref-readonly", "byref-readwrite",
    "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "captured-location"]) {
    for (const role of [{ kind: "user" }, ...(mode.startsWith("captured-") ? [{ kind: "capture", index: 0 }] : [])]) {
      const lowered = body({ locals: [{ role, mode, source: true }], places: [local(0)], blocks: [{
        statements: [assign(0, use(constant()), 1), assign(0, use(constant()), 2)], terminator: { kind: "return", value: null },
      }] });
      const value = facts(lowered);
      const external = !["local", "by-value", "move", "captured-value"].includes(mode);
      assert.equal(isDeepStrictEqual(value.stores.map(row => row.observed), [external, external]), true, mode);
      assert.equal(value.bindings[0].addressTaken, false, "incoming storage authority does not invent a body address-taking operation");
      assert.equal(value.bindings[0].captured, false, "incoming capture ownership is not a creating-side capture operation");
    }
  }
});

test("creating-side selected capture mode is independent of incoming mode for closures and internal calls", () => {
  for (const mode of ["captured-value", "captured-location"]) for (const outgoing of ["captured-value", "captured-location"]) {
    for (const kind of ["closure", "body"]) {
      const captures = [{ local: { body: identity.body, local: ids.localId(1) }, place: ids.placeId(1), capture: outgoing }];
      const instance = { body: identity.other, bindings: { kind: "instantiated",
        bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } };
      const second = { statements: [assign(1, use(constant()), 3)], terminator: { kind: "return", value: null } };
      const first = kind === "closure" ? {
        statements: [assign(1, use(constant()), 1), assign(0, { kind, instance, captures }, 2)],
        terminator: { kind: "goto", target: ids.blockId(1) },
      } : {
        statements: [assign(1, use(constant()), 1)],
        terminator: { kind: "call", callee: { kind, instance, captures }, receiver: null, arguments: [],
          destination: null, next: ids.blockId(1), unwind: { kind: "escape" } },
      };
      const lowered = body({ locals: [{ role: { kind: "temporary" } }, { ...capture(0), mode }],
        places: [local(0), local(1)], blocks: [first, second] });
      const value = facts(lowered);
      assert.equal(isDeepStrictEqual(value.captures, [captureFact(1, outgoing === "captured-value", true)]), true,
        "taking the location is not reading the old cell contents");
      const external = mode === "captured-location" || outgoing === "captured-location";
      assert.equal(value.stores.find(row => row.node === 1).observed, true, "creation reads a value or exposes its cell");
      assert.equal(value.stores.find(row => row.node === 3).observed, external, "a value copy does not expose the later source-cell write");
      assert.equal(value.bindings[0].captured, true, "both creating modes retain actual capture evidence");
      assert.equal(value.bindings[0].addressTaken, false);
    }
  }
});

test("ready executions reject undecided incoming and outgoing capture transport instead of guessing a mode", () => {
  const lowered = body({ locals: [capture(0)], places: [local(0)], blocks: [{
    statements: [], terminator: { kind: "return", value: null },
  }] });
  assert.throws(() => run({ ...lowered, locals: [{ ...lowered.locals[0], mode: null }] }), /undecided local storage mode/);
  const value = { kind: "closure", instance: { body: identity.other, bindings: lowered.bindings },
    captures: [{ local: { body: identity.body, local: ids.localId(0) }, place: ids.placeId(0), capture: null }] };
  assert.throws(() => run({ ...lowered, blocks: [{ ...lowered.blocks[0], statements: [{ ...site(), kind: "assign",
    place: ids.placeId(0), value, step: null }] }] }), /undecided capture mode/);
});

test("all aggregate and unary/conversion read footprints preserve the exact captured source", () => {
  for (const kind of ["object", "record", "array", "tuple", "fixed-array", "unary", "convert"]) {
    const value = kind === "unary" ? { kind, operation: discard(), operand: place(0) }
      : kind === "convert" ? { kind, operation: discard(), operand: place(0), to: ids.tyId(0) }
      : { kind: "aggregate", type: ids.tyId(0), aggregate: kind === "object" || kind === "record"
        ? { kind, fields: [{ member: { decision: memberDecision("x", T.float64, T.float64, direct("in-place")), getter: null, setter: null },
          value: place(0) }] }
        : { kind, elements: [place(0)] } };
    const lowered = body({ locals: [capture(0), { role: { kind: "temporary" } }], places: [local(0), local(1)],
      blocks: [{ statements: [assign(1, value, 1)], terminator: { kind: "return", value: null } }] });
    assert.equal(isDeepStrictEqual(facts(lowered).captures, [captureFact(0, true, false)]), true, kind);
  }
});

test("deep linked index dependencies remain complete without retained prefix vectors", () => {
  const depth = 128;
  const places = [local(0), local(1)];
  for (let index = 0; index < depth; index += 1)
    places.push({ kind: "place", place: ids.placeId(places.length - 1), projection: { kind: "index", operand: place(0) }, tir: site().tir });
  const lowered = body({ locals: [capture(0), { role: { kind: "user" } }], places,
    blocks: [{ statements: [assign(places.length - 1, use(constant()), 1)], terminator: { kind: "return", value: null } }] });
  assert.equal(isDeepStrictEqual(facts(lowered).captures, [captureFact(0, true, false)]), true);
  for (const maximumWork of [0, depth, depth * 2, depth * 3])
    assert.equal(run(lowered, 0, { ...wide, maximumWork }).kind, "refused");
});

test("the exact four-file Liveness owner compiles against fresh real dependency declarations with no summary reader", async () => {
  assert.equal(isDeepStrictEqual(Object.keys(liveness), ["analyzeStorageUse"]), true);
  const sourceFiles = ["contract", "index", "model", "storage-use"].map(name => `packages/host/src/analyses/liveness/${name}.ts`);
  const interfaces = ["ids/contract", "diag/contract", "diag/index", "ir-types/contract", "ir-types/index", "ir-hir/contract",
    "ir-infer/contract", "ir-tir/contract", "ir-mir/contract", "ir-mir/index", "ir-facts/contract", "snapshot/contract",
    "dataflow/contract", "dataflow/index"].map(name => `packages/host/src/${name}.ts`);
  const files = new Map();
  const visit = directory => {
    for (const entry of readdirSync(resolve(repository, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      assert.equal(entry.isSymbolicLink(), false);
      if (entry.isDirectory()) visit(path);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts"))
        files.set(path, readFileSync(resolve(repository, path), "utf8"));
    }
  };
  for (const name of ["ids", "diag", "ir-types", "ir-hir", "ir-infer", "ir-tir", "ir-mir", "ir-facts", "snapshot", "dataflow"])
    visit(`packages/host/src/${name}`);
  const graph = readImportGraph(parseSources(files), files);
  const production = new Set(interfaces);
  for (const path of production) for (const edge of graph) if (edge.source === path && edge.target !== null) {
    assert.equal(files.has(edge.target), true, edge.target);
    production.add(edge.target);
  }
  const areas = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
  const deps = isolationDeps(process.env.TSONIC_HOST_TOOLING_ROOT ?? repository, areas.areas.map(area => area.directory));
  const report = await compileIsolated(deps, hostCatalogue.find(row => row.name === "analyses/liveness"),
    { root: repository, sourceFiles, interfaceSources: interfaces, declarationSources: [...production],
      outputDirectory: ".temp/liveness-isolation" });
  writeFileSync(resolve(repository, ".temp/liveness-isolation-report.json"), JSON.stringify(report, null, 2));
  assert.equal(report.status, "passed", JSON.stringify(report.findings));
});

test("capture evidence merges one qualified outer cell and orders distinct outer bodies canonically", () => {
  const lowered = body({
    locals: [capture(0), capture(1), capture(2), capture(3), capture(4)],
    places: [local(0), local(1), local(2), local(3), local(4)],
    blocks: [{ statements: [assign(1, use(constant()), 1)], terminator: { kind: "return", value: place(0) } }],
  });
  lowered.locals[0].source = { body: identity.other, local: ids.localId(3) };
  lowered.locals[1].source = { body: identity.other, local: ids.localId(3) };
  lowered.locals[2].source = { body: identity.body, local: ids.localId(4) };
  lowered.locals[3].source = { body: identity.other, local: ids.localId(0) };
  lowered.locals[4].source = { body: identity.body, local: ids.localId(1) };
  const expected = [
    { local: { body: identity.body, local: ids.localId(1) }, reads: false, writes: false },
    { local: { body: identity.body, local: ids.localId(4) }, reads: false, writes: false },
    { local: { body: identity.other, local: ids.localId(0) }, reads: false, writes: false },
    { local: { body: identity.other, local: ids.localId(3) }, reads: true, writes: true },
  ];
  expected.sort((left, right) => left.local.body < right.local.body ? -1 : left.local.body > right.local.body ? 1 : left.local.local - right.local.local);
  assert.equal(isDeepStrictEqual(facts(lowered).captures, expected), true);
});

test("complete class/method/captured/self execution bindings are charged and never mistaken for another instantiation", () => {
  const lowered = body({ locals: [], places: [], blocks: [{ statements: [], terminator: { kind: "return", value: null } }] });
  const parameter = { owner: identity.definition, index: 0 };
  lowered.bindings = { kind: "instantiated", bindings: {
    classBindings: [{ kind: "bound", parameter, type: ids.tyId(0) }],
    methodBindings: [{ kind: "rigid", parameter }],
    capturedBindings: [{ kind: "bound", parameter, type: ids.tyId(0) }],
    selfBindings: [{ kind: "bound", owner: identity.definition, type: ids.tyId(0) }],
  } };
  assert.equal(run(lowered).kind, "ok");
  const different = structuredClone(lowered.bindings);
  different.bindings.classBindings[0].type = ids.tyId(1);
  assert.throws(() => liveness.analyzeStorageUse({ execution: { instance: { body: lowered.body, bindings: different }, provided: 0 },
    body: lowered, limits: wide }), /another execution/);
  assert.throws(() => liveness.analyzeStorageUse({ execution: { instance: { body: lowered.body, bindings: { kind: "parametric" } }, provided: 0 },
    body: lowered, limits: wide }), /complete bindings/);
});

test("check, throw and unreachable terminators retain actual read footprints without creating stores", () => {
  for (const terminator of [
    { kind: "check", place: ids.placeId(0), next: ids.blockId(1), unwind: { kind: "abort" } },
    { kind: "throw", operand: place(0), unwind: { kind: "escape" } },
    { kind: "unreachable" },
  ]) {
    const lowered = body({ locals: [capture(0)], places: [local(0)],
      blocks: [{ statements: [], terminator }, { statements: [], terminator: { kind: "return", value: null } }] });
    assert.equal(isDeepStrictEqual(facts(lowered).captures, [captureFact(0, terminator.kind !== "unreachable", false)]), true);
  }
});

test("direct and indirect callees read only the actual indirect operand and explicit receiver/arguments", () => {
  for (const kind of ["direct", "indirect"]) {
    const resolution = callee("liveness.external", 0, [], T.float64);
    const lowered = body({ locals: [capture(0)], places: [local(0)], blocks: [
      { statements: [], terminator: { kind: "call", callee: { kind, resolution, ...(kind === "indirect" ? { operand: place(0) } : {}) },
        receiver: null, arguments: [], destination: null, next: ids.blockId(1), unwind: { kind: "abort" } } },
      { statements: [], terminator: { kind: "return", value: null } },
    ] });
    assert.equal(isDeepStrictEqual(facts(lowered).captures, [captureFact(0, kind === "indirect", false)]), true);
  }
});

test("body calls capture the actual logical source even when a distinct temporary carries its address", () => {
  const lowered = body({ locals: [{ role: { kind: "temporary" } }, { role: { kind: "user" }, source: true }],
    places: [local(0), local(1)], blocks: [
      { statements: [], terminator: { kind: "call", callee: { kind: "body",
        instance: { body: identity.other, bindings: { kind: "parametric" } },
        captures: [{ local: { body: identity.body, local: ids.localId(1) }, place: ids.placeId(0), capture: "captured-location" }] },
      receiver: null, arguments: [], destination: null, next: ids.blockId(1), unwind: { kind: "escape" } } },
      { statements: [], terminator: { kind: "return", value: null } },
    ] });
  assert.equal(isDeepStrictEqual(facts(lowered).bindings, [{ local: ids.localId(1), addressTaken: false, captured: true }]), true);
});

test("malformed dense place/local inputs are caller defects, not partial Liveness facts", async () => {
  const good = body({ locals: [{ role: { kind: "user" } }], places: [local(0)],
    blocks: [{ statements: [assign(0, use(constant()))], terminator: { kind: "return", value: null } }] });
  for (const mutate of [
    value => { value.places[0].id = ids.placeId(1); },
    value => { value.places[0].base.local = ids.localId(1); },
    value => { value.places[0].base = { kind: "place", place: ids.placeId(1), projection: { kind: "deref" }, tir: site().tir }; },
    value => { value.blocks[0].statements[0].place = ids.placeId(1); },
    value => { value.blocks[0].statements[0] = { ...site(), kind: "storage-live", local: ids.localId(1) }; },
    value => { value.locals[0].role = { kind: "capture", index: 0 }; value.locals[0].source = null; },
  ]) {
    const value = structuredClone(good);
    mutate(value);
    assert.throws(() => run(value), /liveness|local|place|capture/);
  }
  const model = await import("../../packages/host/dist/analyses/liveness/model.js");
  const flow = await import("../../packages/host/dist/dataflow/index.js");
  const analysis = { body: good, places: [], words: 0, zero: new Uint32Array(), escaped: new Uint32Array(), account: flow.createAccount(wide) };
  assert.equal(model.hasBit(analysis.zero, 0), false);
  assert.throws(() => model.setBit(analysis, analysis.zero, 0), /outside.*local/);
});

test("an invocation operand is a capture read even when it has no result destination", () => {
  const lowered = body({ locals: [capture(0)], places: [local(0)], blocks: [
    { statements: [], terminator: { kind: "invoke", operation: discard(), operands: [place(0)], destination: null,
      next: ids.blockId(1), unwind: { kind: "none" } } },
    { statements: [], terminator: { kind: "return", value: null } },
  ] });
  assert.equal(isDeepStrictEqual(facts(lowered).captures, [captureFact(0, true, false)]), true);
});

test("a logical capture transported through an unnamed temporary creates no fabricated source binding row", () => {
  const lowered = body({ locals: [{ role: { kind: "temporary" } }], places: [local(0)], blocks: [
    { statements: [], terminator: { kind: "call", callee: { kind: "body",
      instance: { body: identity.other, bindings: { kind: "parametric" } },
      captures: [{ local: { body: identity.other, local: ids.localId(0) }, place: ids.placeId(0), capture: "captured-location" }] },
    receiver: null, arguments: [], destination: null, next: ids.blockId(1), unwind: { kind: "escape" } } },
    { statements: [], terminator: { kind: "return", value: null } },
  ] });
  assert.equal(isDeepStrictEqual(facts(lowered).bindings, []), true);
});

test("native dense-read and refusal boundaries retain missing-word errors, zero values and original diagnostic identity", async () => {
  const model = await import("../../packages/host/dist/analyses/liveness/model.js");
  const flow = await import("../../packages/host/dist/dataflow/index.js");
  const lowered = body({ locals: [], places: [], blocks: [{ statements: [], terminator: { kind: "return", value: null } }] });
  const execution = { instance: { body: lowered.body, bindings: lowered.bindings }, provided: 0 };
  const original = run(lowered, 0, { ...wide, maximumWork: 0 });
  assert.equal(model.refusalOf(execution, original) === original, true);
  assert.equal(model.required(0, "zero"), 0);
  assert.throws(() => model.required(null, "missing"), /missing/);
  assert.throws(() => model.required(undefined, "missing"), /missing/);
  const analysis = { body: lowered, places: [], words: 1, zero: new Uint32Array(1), escaped: new Uint32Array(1),
    account: flow.createAccount(wide) };
  assert.throws(() => model.orInto(analysis, new Uint32Array(1), new Uint32Array()), /source word/);
});

test("every current positive execution refuses at each smaller shared work and result-entry allowance without partial facts", () => {
  for (const lowered of executions) {
    const expected = facts(lowered);
    for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      let low = 0, high = 1;
      while (run(lowered, 0, { ...wide, [dimension]: high }).kind !== "ok") {
        high *= 2;
        assert.equal(high <= wide[dimension], true, dimension);
      }
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (run(lowered, 0, { ...wide, [dimension]: middle }).kind === "ok") high = middle;
        else low = middle + 1;
      }
      for (let maximum = 0; maximum < high; maximum += 1) {
        const result = run(lowered, 0, { ...wide, [dimension]: maximum });
        assert.equal(result.kind, "refused", `${dimension}=${maximum}/${high}`);
        assert.equal(result.diagnostics.length, 1);
      }
      assert.equal(isDeepStrictEqual(run(lowered, 0, { ...wide, [dimension]: high }).value, expected), true);
    }
  }
});
