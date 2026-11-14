// Unit bank of lower-mir. Every expectation is taken from the signed specification
// (/shared/tsonic-stage3/spec: low/COMPONENTS.md section 7, low/COMMON-DATA.md, inputs/WALKTHROUGH-PROGRAMS.md)
// and from the program text, and is stated beside the assertion. Inputs are complete typed bodies
// written by hand in fixtures/lower-mir/programs; no expectation is derived from an implementation.
import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test as declare } from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { ARRAY_STEP, EMPTY_BINDINGS, MODULE, PARAMETRIC, SIG, T, TABLE, bodyId, def, native, selected, typedOperation, value, verificationContext } from "./fixtures/lower-mir/typed.mjs";
import {
  argumentConstantOf, argumentKindsOf, at, blocksWithStatementAt, calleeNameOf, capturedLocalsOf, capturedRootsOf, checkedPlace, checks,
  controlPoints, createsClosure, destinationBaseOf, destinationChainOf, destinationFieldOf, destinationRootOf, edgesOf, effects,
  effectsOn, entriesInto, fieldKeyOf, internalCallsOn, invert, isCall, isCompletionBranch, isInternalCall, markersOf, namesStep, nodesOn,
  operandPlacesOf, operationKindOf, operationName, providedCountsOf, readsField, readsLocal, readsPlace, receiverRootOf, recordsOf, rootLocalOf,
  storedChainLengthOf, storedRootOf, storesField, storesPlace, valueKindOf, walk, withoutFailureKinds, writesOf,
} from "./fixtures/lower-mir/observe.mjs";
import { ACTIVATION, GENERATOR_STEP, activationOf, deep, excluded, firstZero, handles, quotients, scaled } from "./fixtures/lower-mir/programs/added.mjs";
import { EXECUTIONS, add, nested, plus, shaped } from "./fixtures/lower-mir/programs/first.mjs";
import { wt1 } from "./fixtures/lower-mir/programs/wt1.mjs";
import { wt4 } from "./fixtures/lower-mir/programs/wt4.mjs";
import { wt6 } from "./fixtures/lower-mir/programs/wt6.mjs";
import { s7 } from "./fixtures/lower-mir/programs/s7.mjs";
import { s2, s3, s6 } from "./fixtures/lower-mir/programs/cleanup.mjs";
import { s1, wt5, wt8, wt9, wt10, wt11 } from "./fixtures/lower-mir/programs/more.mjs";

// The producer does not lower every construct yet. A construct it does not lower is refused by its one frontier
// check, a compiler defect whose message starts with FRONTIER. A case that meets it is not a passing case and not a
// wrong graph: it is reported as `todo` with what it met, and fails as written until the construct is lowered.
// Every other failure is a failure. `produced` is the operation itself, for the cases that assert the frontier.
const FRONTIER = "not lowered yet: ";
const CALLER_DEFECT = "caller defect: ";
let current = null;
const test = (name, ...rest) => {
  const run = rest.pop();
  return declare(name, ...rest, context => { current = context; return run(context); });
};
let produced;
let lowerToMir;
/** The query unit a hand-run lowering reports against: the result of a request of the `mirBody` row. */
const UNIT = { request: { query: "mirBody", key: ["unit"] }, position: { kind: "result" } };

// The coverage gate: every runtime file of lower-mir at 100% of lines, branches and functions over this bank and the
// case modules it loads; the type-only contract is not applicable.
const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index", "lower", "state"].map(name => resolve(repository, `packages/host/dist/lower-mir/${name}.js`));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let verifyMir;
let deps;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "lower-mir cases require a guarded admission");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  ({ lowerToMir: produced } = await import("../../packages/host/dist/lower-mir/index.js"));
  lowerToMir = (...given) => {
    try {
      return produced(...given);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(FRONTIER)) current.todo(error.message);
      throw error;
    }
  };
  ({ verifyMir } = await import("../../packages/host/dist/ir-mir/index.js"));
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const interner = types.seedTypeInterner(TABLE);
  deps = {
    defs: { completionSelector: T.int32, exceptionStorage: T.unknown },
    typeOf: type => types.readType(interner, type),
    signatureOf: signature => types.readSignature(interner, signature),
    limits: { maximumRecords: 100000 },
    unit: UNIT,
  };
});

// The cases of the lowering state, loaded after the hook above so that they run under the coverage it records.
await import("./lower-mir-state.cases.mjs");

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const urls = new Set(runtimeFiles.map(path => pathToFileURL(path).href));
    const result = capture.result.filter(script => urls.has(script.url));
    const sources = [];
    for (const script of result) {
      const actual = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: actual.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => ({ path: fileURLToPath(url), text }) },
    [...runtimeFiles, resolve(repository, "packages/host/src/lower-mir/contract.ts")], [{ ...capture, result, sources }]);
    assert.equal(result.length, 3, "each runtime file of lower-mir has source-identified coverage evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 1, "only the type-only contract is not applicable");
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
    assert.equal(report.files.filter(file => file.status === "covered").length, 3);
  } finally { session.disconnect(); }
});

/** The findings of the complete MIR verifier for a lowered graph. A refusal for resources is not a list of findings and fails the case. */
const verified = (mir, program) => {
  const outcome = verifyMir(mir, verificationContext(program));
  assert.equal(outcome.kind, "complete");
  return outcome.violations;
};
/**
 * Lowers one typed body and requires an accepted result with no diagnostic (section 7 part 7: the box originates one
 * diagnostic, the size limit). Section 7 part 2 has the verifier run at the handoff from lowering: every graph this
 * bank accepts is also a graph the complete MIR verifier accepts (R1 E-5).
 */
const lower = (program, internal = [], limits = null) => {
  const result = lowerToMir(limits === null ? deps : { ...deps, limits }, program.tir, internal);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(verified(result.value, program).map(violation => `${violation.rule} at ${JSON.stringify(violation.site)}`), []);
  return result.value;
};
/** The predicate of a defect raised by lower-mir through Diag: an Error whose cause names the owner (R1 section 4). */
const defectOfLowerMir = error => error instanceof Error && error.cause !== undefined && error.cause !== null && error.cause.owner === "lower-mir"
  && error.message.startsWith(CALLER_DEFECT);
/** The frontier refusal that names `what`: a compiler defect of lower-mir, not a diagnostic and not a caller defect. */
const notLoweredYet = what => error => error instanceof Error && error.cause !== undefined && error.cause !== null && error.cause.owner === "lower-mir"
  && error.message === `${FRONTIER}${what}`;
const convertingNode = (b, name, node, fromType, toType, execution, backing) => ({ ...node, $: "converted", tsonic: at => {
  const original = typeof node.tsonic === "function" ? node.tsonic(at) : node.tsonic;
  const from = { root: { kind: "body", value: b.nodeRef(at("converted")) }, path: [] };
  const to = { root: { kind: "body", value: b.nodeRef(0) }, path: [{ kind: "result", signature: SIG[name] }] };
  const embedding = { kind: "conversion", conversion: "numeric", proof: { steps: [{ from, to, rule: "numeric", premises: [] }], conclusion: 0 }, check: { kind: "none" } };
  const identity = backing === "native" ? { kind: "conversion", from: fromType, to: toType, embedding }
    : { kind: backing, declaration: def(`conversion.${backing}.int32-to-int64`), bindings: EMPTY_BINDINGS };
  const conversion = typedOperation(selected(identity, [fromType], toType, execution));
  return { ...original, convertedType: toType, conversion: backing === "native"
    ? { kind: "convert", role: "return", operation: conversion } : { kind: "backed-convert", role: "return", operation: conversion, embedding } };
} });
const narrowingNode = (b, name, node, source, result, failure) => ({ ...node, $: "narrowed", tsonic: at => {
  const original = typeof node.tsonic === "function" ? node.tsonic(at) : node.tsonic;
  const root = { kind: "body", value: b.nodeRef(0) };
  const parameter = { kind: "parameter", signature: SIG[name], index: 0 };
  const from = { root, path: [parameter] };
  const to = { root, path: [parameter, { kind: "optional-value" }] };
  const proof = { steps: [{ from, to, rule: "absence", premises: [] }], conclusion: 0 };
  return { ...original, narrowing: { kind: "narrowed", source, result, failure, proof } };
} });
const labelledBlock = (b, label, statement, target = label) => ({ $: label, kind: "LabeledStatement", label: b.label(label, target), statement,
  tsonic: at => ({ target: b.nodeRef(at(target)) }) });
const selectedBreak = (b, target) => ({ kind: "BreakStatement", label: b.label(target, target), tsonic: at => ({ target: b.nodeRef(at(target)) }) });
const selectedContinue = (b, target, labelled) => ({ kind: "ContinueStatement", label: labelled ? b.label(target, target) : null,
  tsonic: at => ({ target: b.nodeRef(at(target)) }) });
const unconditionalFor = (tag, statement, initializer = null) => ({ $: tag, kind: "ForStatement", initializer, condition: null, incrementor: null, statement, tsonic: null });
const labelled = (program, nodes) => { const names = invert(program.labels); return nodes.map(node => names.get(node) ?? node); };
const sourceLocal = (mir, local) => mir.locals.find(candidate => candidate.source !== null && candidate.source.local === local).id;
const statementsOn = path => path.events.filter(item => item.statement !== null);
const indexOfEvent = (path, predicate) => path.events.findIndex(predicate);
// The two policy values are two facts (the bounds failure and the absent-access failure); every combination runs,
// and each expectation is computed from the decision it belongs to (R1 E-3).
const POLICIES = [{ bounds: "unwind", absent: "unwind" }, { bounds: "abort", absent: "abort" },
  { bounds: "unwind", absent: "abort" }, { bounds: "abort", absent: "unwind" }];

// ---- the first producer: parameters, binary operations placed by their decision, return --------------------------

const originOf = node => ({ module: MODULE, start: node, length: 1, derived: [] });

/**
 * The graph of `function add(a, b) { return a + b; }`, written from the lowering rules and not from the producer
 * (package W4-3, section 3): R7 one entry at the full count; the parameters' locals name their rows and carry no begin
 * marker (R10); the sum is a statement when the decision of `+` is pure and a control point with the decision's
 * failure arm otherwise (R1, R2); the operation record is the node's decision (R12); a block names the node whose
 * evaluation it starts and a marker the node whose value its slot holds. `unwind` is null for the statement form.
 */
function expectedAdd(program, type, unwind) {
  const body = program.tir.body;
  const site = node => ({ origin: originOf(node), tir: { body, node } });
  const root = site(0);
  const sum = site(program.at("a+b"));
  const returned = site(program.at("return"));
  const locals = [
    { id: 0, storage: type, role: { kind: "parameter", index: 0 }, mode: program.tir.params[0].passing, source: { body, local: 0 }, origin: root.origin },
    { id: 1, storage: type, role: { kind: "parameter", index: 1 }, mode: program.tir.params[1].passing, source: { body, local: 1 }, origin: root.origin },
    { id: 2, storage: type, role: { kind: "temporary" }, mode: "local", source: null, origin: sum.origin },
  ];
  const places = locals.map(local => ({ id: local.id, base: { kind: "local", local: local.id }, storage: type, origin: local.origin }));
  const [a, b, result] = [0, 1, 2].map(place => ({ kind: "place", place }));
  const begun = { ...sum, kind: "storage-live", local: 2 };
  const blocks = unwind === null
    ? [{ ...root, id: 0, statements: [begun,
      { ...sum, kind: "assign", place: 2, value: { kind: "binary", operation: program.decision, left: a, right: b }, step: null }],
    terminator: { ...returned, kind: "return", value: result } }]
    : [{ ...root, id: 0, statements: [begun], terminator: { ...sum, kind: "invoke", operation: program.decision, operands: [a, b],
      destination: 2, next: 1, unwind: { kind: unwind }, step: null } },
    { ...returned, id: 1, statements: [], terminator: { ...returned, kind: "return", value: result } }];
  return { body, bindings: PARAMETRIC, entries: [{ provided: 2, block: 0 }], locals, constants: [], places, blocks, result: type };
}

// The checkpoint program is over `number`, which is float64 (K-3291); the unit program of WT-1 is over int32. Lowering
// reads the carrier from the decision and nothing from the type, so both have the same graph; both are compared.
for (const typeName of ["float64", "int32"])
  for (const [execution, unwind] of [["pure", null], ["cannotFail", "none"], ["unwinds", "escape"], ["endsProcess", "abort"]])
    test(`first producer: add over ${typeName}, + ${execution}: the graph written from the rules`, () => {
      const type = T[typeName];
      const program = add(`first.add.${typeName}.${execution}`, type, plus(typeName, type, EXECUTIONS[execution]));
      assert.deepEqual(lower(program), expectedAdd(program, type, unwind));
    });

test("first producer: operands are evaluated left to right, each once; an inner operation is emitted before the one that uses it", () => {
  const P = plus("float64", T.float64);
  // (a + b) + a
  const left = nested("first.left", T.float64, ({ leaf, sum, group }) => sum("outer", group(sum("inner", leaf("a"), leaf("b"), P)), leaf("a"), P));
  let mir = lower(left);
  let sums = mir.blocks[0].statements.filter(record => record.kind === "assign");
  assert.deepEqual(sums.map(record => record.tir.node), [left.at("inner"), left.at("outer")]);
  assert.deepEqual(sums.map(record => [record.value.left.place, record.value.right.place, record.place]), [[0, 1, 2], [2, 0, 3]]);
  // a + (b + a): the left operand `a` is evaluated first and read in place; nothing between writes it.
  const right = nested("first.right", T.float64, ({ leaf, sum, group }) => sum("outer", leaf("a"), group(sum("inner", leaf("b"), leaf("a"), P)), P));
  mir = lower(right);
  sums = mir.blocks[0].statements.filter(record => record.kind === "assign");
  assert.deepEqual(sums.map(record => record.tir.node), [right.at("inner"), right.at("outer")]);
  assert.deepEqual(sums.map(record => [record.value.left.place, record.value.right.place, record.place]), [[1, 0, 2], [0, 2, 3]]);
  // One block, no control point but the return, and each temporary begun once before its one write.
  assert.equal(mir.blocks.length, 1);
  assert.deepEqual(mir.blocks[0].statements.map(record => record.kind), ["storage-live", "assign", "storage-live", "assign"]);
  assert.deepEqual(mir.locals.map(local => local.role.kind), ["parameter", "parameter", "temporary", "temporary"]);
});

test("first producer: an operand read from the caller's storage is saved before a control point that writes existing storage", () => {
  // function f(a, b) { return a + (b (+) b); } where (+) is an invocation. `a` is evaluated before (+) runs.
  const build = execution => ({ leaf, sum, group }) =>
    sum("outer", leaf("a"), group(sum("inner", leaf("b"), leaf("b"), plus("int32", T.int32, execution))), plus("int32", T.int32));
  const kinds = mir => mir.blocks.map(block => [...block.statements.map(record => record.kind), block.terminator.kind]);
  // `a` is passed by reference: its local is the caller's storage, which (+) may write. Its value is saved first.
  const byReference = nested("first.saved", T.int32, build(EXECUTIONS.writes), { passing: ["byref-readwrite", "by-value"] });
  let mir = lower(byReference);
  assert.deepEqual(kinds(mir), [["storage-live", "assign", "storage-live", "invoke"], ["storage-live", "assign", "return"]]);
  const saved = mir.blocks[0].statements[1];
  assert.deepEqual([saved.value, saved.tir.node], [{ kind: "use", operand: { kind: "place", place: 0 } }, byReference.at("a#1")]);
  const outer = mir.blocks[1].statements[1];
  assert.equal(outer.tir.node, byReference.at("outer"));
  assert.deepEqual(outer.value.left, { kind: "place", place: saved.place }, "the sum reads the saved value, not the caller's storage again");
  // Passed by value, `a` is the body's own cell: nothing but a record that names it writes it, and it is read in place.
  mir = lower(nested("first.private", T.int32, build(EXECUTIONS.writes)));
  assert.deepEqual(kinds(mir), [["storage-live", "invoke"], ["storage-live", "assign", "return"]]);
  assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: 0 });
  // An invocation whose decision says it writes no existing storage: nothing is saved, by reference or not.
  mir = lower(nested("first.reading", T.int32, build(EXECUTIONS.unwinds), { passing: ["byref-readwrite", "by-value"] }));
  assert.deepEqual(kinds(mir), [["storage-live", "invoke"], ["storage-live", "assign", "return"]]);
});

test("first producer: the receiver's row and a body that completes with no value", () => {
  // The row of role `this` is the local of role `receiver`; the other rows are counted without it (parameter-source-exact).
  const method = shaped("first.method", [["self", "this", T.counter], ["a", "required", T.int32]], T.int32,
    b => b.block(b.returns(b.id("a", 1, T.int32))), { receiver: T.counter });
  let mir = lower(method);
  assert.deepEqual(mir.locals.map(local => [local.role, local.source.local]), [[{ kind: "receiver" }, 0], [{ kind: "parameter", index: 0 }, 1]]);
  assert.deepEqual(mir.entries, [{ provided: 1, block: 0 }]);
  assert.deepEqual(mir.blocks[0].terminator.value, { kind: "place", place: 0 });
  // The end of a body that completes with no value is a return with no value, at the body's node.
  const empty = shaped("first.empty", [["a", "required", T.int32]], T.void, b => b.block());
  mir = lower(empty);
  assert.deepEqual(mir.blocks.map(block => [block.statements, block.terminator.kind, block.terminator.value, block.terminator.tir.node]), [[[], "return", null, 0]]);
  const bare = shaped("first.bare", [], T.void, b => b.block({ $: "return", ...b.returns(null) }));
  mir = lower(bare);
  assert.deepEqual([mir.blocks[0].terminator.value, mir.blocks[0].terminator.tir.node, mir.entries], [null, bare.at("return"), [{ provided: 0, block: 0 }]]);
  // What follows a return in its statement list is on no path: it is not lowered and makes no record.
  const twice = nested("first.twice", T.int32, ({ leaf }) => leaf("a"), { statements: ({ b, leaf }, tree) => [b.returns(tree), b.returns(leaf("b"))] });
  mir = lower(twice);
  assert.deepEqual([mir.blocks.length, mir.places.length, mir.blocks[0].terminator.value], [1, 1, { kind: "place", place: 0 }]);
});

test("first producer: below the size of its graph a body is refused with one diagnostic at its origin; at that size it is lowered", () => {
  // `add`: 3 locals and 3 places in both forms; 2 statements and 1 block as a statement, 1 statement and 2 blocks as a
  // control point: 9 records.
  for (const execution of ["pure", "unwinds"]) {
    const program = add(`first.add.float64.${execution}`, T.float64, plus("float64", T.float64, EXECUTIONS[execution]));
    const attempt = maximumRecords => produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
    for (let maximumRecords = 0; maximumRecords < 9; maximumRecords += 1) {
      const refused = attempt(maximumRecords);
      assert.equal(refused.kind, "refused", `limit ${maximumRecords}`);
      assert.equal("value" in refused, false);
      assert.deepEqual(refused.diagnostics.map(diagnostic => [diagnostic.code.rendered, diagnostic.severity, diagnostic.site, diagnostic.source, diagnostic.arguments]),
        [["TSONIC_COMPILER_RESOURCE_LIMIT", "error", { kind: "source", origin: originOf(0) }, "lower-mir",
          [{ kind: "text", value: "lower-mir.maximumRecords" }, { kind: "number", value: maximumRecords }]]]);
      assert.deepEqual(refused.diagnostics[0].evidence.slice(0, 2), ["lower-mir.maximumRecords", "mirBody"]);
    }
    const lowered = attempt(9);
    assert.equal(lowered.kind, "ok");
    assert.deepEqual(lowered.value, lower(program));
  }
  // Every other shape: the count of records of its graph is the smallest limit that admits it, and every smaller
  // limit refuses, whichever record the limit falls on (a saved operand, a temporary, a control point's next block).
  const size = mir => mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
    + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
  const writes = execution => ({ leaf, sum, group }) =>
    sum("outer", leaf("a"), group(sum("inner", leaf("b"), leaf("b"), plus("int32", T.int32, execution))), plus("int32", T.int32));
  for (const program of [nested("first.saved", T.int32, writes(EXECUTIONS.writes), { passing: ["byref-readwrite", "by-value"] }), waitingTemporary(),
    nested("first.private", T.int32, writes(EXECUTIONS.writes)),
    shaped("first.method", [["self", "this", T.counter], ["a", "required", T.int32]], T.int32, b => b.block(b.returns(b.id("a", 1, T.int32))), { receiver: T.counter })]) {
    const records = size(lower(program));
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${program.tir.body} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).kind, "ok");
  }
});

/** (a + b) + (b (+) b) with `a` by reference and (+) writing existing storage: the operand waiting at (+) is a temporary. */
const waitingTemporary = () => nested("first.waiting", T.int32, ({ leaf, sum, group }) => sum("outer", group(sum("first", leaf("a"), leaf("b"), plus("int32", T.int32))),
  group(sum("second", leaf("b"), leaf("b"), plus("int32", T.int32, EXECUTIONS.writes))), plus("int32", T.int32)), { passing: ["byref-readwrite", "by-value"] });

test("first producer: what a control point that writes cannot change is not saved: a temporary, and a parameter that is moved", () => {
  // The waiting operand is the temporary of (a + b): it is written by its one record and is not saved.
  let mir = lower(waitingTemporary());
  assert.deepEqual(mir.blocks.map(block => [...block.statements.map(record => record.kind), block.terminator.kind]),
    [["storage-live", "assign", "storage-live", "invoke"], ["storage-live", "assign", "return"]]);
  assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: 2 });
  // A parameter that is moved is the body's own cell, as one passed by value.
  mir = lower(nested("first.moved", T.int32, ({ leaf, sum, group }) => sum("outer", leaf("a"), group(sum("inner", leaf("b"), leaf("b"),
    plus("int32", T.int32, EXECUTIONS.writes))), plus("int32", T.int32)), { passing: ["move", "by-value"] }));
  assert.deepEqual(mir.blocks[0].statements.map(record => record.kind), ["storage-live"]);
  assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: 0 });
});

test("first producer: each exposed read is saved once, distinct reads of one local each, and a saved read never again (K-3352)", () => {
  const W = plus("int32", T.int32, EXECUTIONS.writes);
  const P = plus("int32", T.int32);
  const byReference = { passing: ["byref-readwrite", "by-value"] };
  const saves = mir => mir.blocks.flatMap(block => block.statements).filter(record => record.kind === "assign" && record.value.kind === "use");
  // a + ((b (+w) b) (+w) b): a is saved at the first writing control point and is not saved again at the second.
  let mir = lower(nested("k3352.once", T.int32, ({ leaf, sum, group }) =>
    sum("outer", leaf("a"), group(sum("second", group(sum("first", leaf("b"), leaf("b"), W)), leaf("b"), W)), P), byReference));
  assert.deepEqual(saves(mir).map(record => record.value.operand), [{ kind: "place", place: 0 }]);
  // a + (a + (b (+w) b)): two reads of a wait; each is saved, as its own value.
  mir = lower(nested("k3352.distinct", T.int32, ({ leaf, sum, group }) =>
    sum("outer", leaf("a"), group(sum("middle", leaf("a"), group(sum("inner", leaf("b"), leaf("b"), W)), P)), P), byReference));
  const distinct = saves(mir);
  assert.deepEqual(distinct.map(record => record.value.operand), [{ kind: "place", place: 0 }, { kind: "place", place: 0 }]);
  assert.notEqual(distinct[0].place, distinct[1].place);
  // b + (a + (b (+w) b)), a by reference and b by value: only the read of a is saved (mixed).
  mir = lower(nested("k3352.mixed", T.int32, ({ leaf, sum, group }) =>
    sum("outer", leaf("b"), group(sum("middle", leaf("a"), group(sum("inner", leaf("b"), leaf("b"), W)), P)), P), byReference));
  assert.deepEqual(saves(mir).map(record => record.value.operand), [{ kind: "place", place: 1 }]);
  // A read of a consumed before the writing control point is not exposed any more: (a + b) + (b (+w) b) saves nothing.
  mir = lower(nested("k3352.consumed", T.int32, ({ leaf, sum, group }) =>
    sum("outer", group(sum("first", leaf("a"), leaf("b"), P)), group(sum("second", leaf("b"), leaf("b"), W)), P), byReference));
  assert.deepEqual(saves(mir), []);
});

test("growing pending read and statement lists preserve every individual read and exact record refusal", () => {
  for (const count of [4, 16, 64]) {
    const program = nested(`exposed.growth.${count}`, T.int32, ({ leaf, sum, group }) => {
      let expression = sum("write", leaf("b"), leaf("b"), plus("int32", T.int32, EXECUTIONS.writes));
      for (let index = 0; index < count; index += 1)
        expression = sum(`pending${index}`, leaf("a"), group(expression), plus("int32", T.int32));
      return expression;
    }, { passing: ["byref-readwrite", "by-value"] });
    const mir = lower(program);
    const saves = mir.blocks.flatMap(block => block.statements).filter(record => record.kind === "assign" && record.value.kind === "use");
    assert.equal(saves.length, count);
    assert.equal(new Set(saves.map(record => record.place)).size, count);
    for (const record of saves) assert.deepEqual(record.value.operand, { kind: "place", place: 0 });
    const records = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (const maximumRecords of [0, records - 1]) {
      const refused = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
      assert.equal(refused.kind, "refused");
      assert.equal("value" in refused, false);
    }
    assert.deepEqual(lower(program, [], { maximumRecords: records }), mir);
    const statements = shaped(`statements.growth.${count}`, [], T.bool, b => b.block(
      ...Array.from({ length: count }, () => ({ kind: "EmptyStatement", tsonic: null })), b.returns(b.keyword("TrueKeyword", T.bool))));
    assert.equal(lower(statements).blocks[0].terminator.kind, "return");
  }
});

test("first producer: a comparison is placed by its decision like any binary operation", () => {
  const less = native("<", "int32", [T.int32, T.int32], T.bool);
  const program = shaped("first.less", [["a", "required", T.int32], ["b", "required", T.int32]], T.bool,
    b => b.block(b.returns({ $: "a<b", ...b.comparison(b.id("a", 0, T.int32), "LessThanToken", b.id("b", 1, T.int32), less) })));
  const mir = lower(program);
  assert.deepEqual(mir.blocks[0].statements.map(record => [record.kind, record.tir.node]), [["storage-live", program.at("a<b")], ["assign", program.at("a<b")]]);
  assert.deepEqual(mir.blocks[0].statements[1].value, { kind: "binary", operation: typedOperation(less), left: { kind: "place", place: 0 }, right: { kind: "place", place: 1 } });
  assert.equal(mir.locals[2].storage, T.bool);
});

test("selected scalar literals use one constant and no temporary or check, with exact graph-size refusal", () => {
  const cases = [
    ["true", T.bool, b => b.keyword("TrueKeyword", T.bool), { kind: "boolean", value: true }],
    ["false", T.bool, b => b.keyword("FalseKeyword", T.bool), { kind: "boolean", value: false }],
    ["absence", T.absence, b => b.keyword("NullKeyword", T.absence), { kind: "absence" }],
  ];
  for (const [name, type, token, number] of [
    ["zero", T.int32, "0", { numerator: 0n, denominator: 1n, negativeZero: false }],
    ["fraction", T.float64, "1.5", { numerator: 3n, denominator: 2n, negativeZero: false }],
    ["native64", T.literalInt64, "9007199254740993", { numerator: 9007199254740993n, denominator: 1n, negativeZero: false }],
    ["hex64", T.literalInt64, "0x20000000000001", { numerator: 9007199254740993n, denominator: 1n, negativeZero: false }],
  ]) cases.push([name, type, () => ({ kind: "NumericLiteral", text: token, tokenFlags: [],
    tsonic: { ...value(type), role: "value", value: number } }), { kind: "number", token, value: number }]);
  const big = 12345678901234567890123456789012345678901234567890n;
  cases.push(["bigint", T.literalBigint, () => ({ kind: "BigIntLiteral", text: `${big}n`, tokenFlags: [],
    tsonic: { ...value(T.literalBigint), role: "value", value: big } }), { kind: "bigint", token: `${big}n`, value: big }]);
  for (const kind of ["StringLiteral", "NoSubstitutionTemplateLiteral"]) {
    for (const [name, text, rawText] of [["empty", "", ""], ["escaped", "\n\u0000\u{1f340}", "\\n\\0\\u{1f340}"]]) {
      cases.push([`${kind}.${name}`, T.string, () => ({ kind, text, tokenFlags: [],
        ...(kind === "NoSubstitutionTemplateLiteral" ? { rawText, templateFlags: [] } : {}),
        tsonic: { ...value(T.string), role: "value", value: text } }), { kind: "string", value: text }]);
    }
  }
  for (const [name, type, build, expected] of cases) {
    const program = shaped(`literal.${name}`, [], type, b => b.block(b.returns(build(b))));
    const mir = lower(program);
    assert.deepEqual(mir.constants, [{ id: 0, type, value: { kind: "literal", value: expected } }]);
    assert.deepEqual([mir.locals, mir.places, mir.blocks.length, mir.blocks[0].statements], [[], [], 1, []]);
    assert.deepEqual(mir.blocks[0].terminator.value, { kind: "constant", constant: 0 });
    for (const maximumRecords of [0, 1]) {
      const outcome = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
      assert.equal(outcome.kind, "refused", `${name} under ${maximumRecords}`);
      assert.equal("value" in outcome, false);
      assert.deepEqual(outcome.diagnostics.map(diagnostic => diagnostic.code.rendered), ["TSONIC_COMPILER_RESOURCE_LIMIT"]);
    }
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 2 } }, program.tir, []).value, mir);
  }
});

test("literal operands share the canonical constant owner and retain evaluation-side references after ordering", () => {
  const equal = selected({ kind: "boolean-operator", operator: "===" }, [T.bool, T.bool], T.bool);
  for (const right of ["TrueKeyword", "FalseKeyword"]) {
    const program = shaped(`literal.same.${right}`, [], T.bool, b => b.block(b.returns(
      b.comparison(b.keyword("TrueKeyword", T.bool), "EqualsEqualsEqualsToken", b.keyword(right, T.bool), equal))));
    const mir = lower(program);
    const comparison = mir.blocks[0].statements.find(record => record.kind === "assign").value;
    assert.equal(mir.constants.length, right === "TrueKeyword" ? 1 : 2);
    assert.deepEqual([comparison.left.kind, comparison.right.kind], ["constant", "constant"]);
    assert.deepEqual(mir.constants[comparison.left.constant].value, { kind: "literal", value: { kind: "boolean", value: true } });
    assert.deepEqual(mir.constants[comparison.right.constant].value, { kind: "literal", value: { kind: "boolean", value: right === "TrueKeyword" } });
    const records = right === "TrueKeyword" ? 6 : 7;
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${right} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("selected unary values use the same operation placement and exact record account for pure and invocation decisions", () => {
  for (const [name, execution] of Object.entries(EXECUTIONS)) {
    const decision = native("-", "int32", [T.int32], T.int32, execution);
    const program = shaped(`unary.${name}`, [["a", "required", T.int32]], T.int32,
      b => b.block(b.returns({ $: "negated", ...b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, decision) })));
    const mir = lower(program);
    const site = program.at("negated");
    if (execution.kind === "pure") {
      assert.deepEqual(mir.blocks[0].statements.map(record => record.kind), ["storage-live", "assign"]);
      assert.deepEqual(mir.blocks[0].statements[1].value,
        { kind: "unary", operation: typedOperation(decision), operand: { kind: "place", place: 0 } });
      assert.equal(mir.blocks.length, 1);
    } else {
      const invoked = mir.blocks[0].terminator;
      assert.deepEqual(mir.blocks[0].statements.map(record => record.kind), ["storage-live"]);
      assert.deepEqual([invoked.kind, invoked.operation, invoked.operands, invoked.destination, invoked.tir.node],
        ["invoke", typedOperation(decision), [{ kind: "place", place: 0 }], 1, site]);
      assert.deepEqual(invoked.unwind, { kind: execution.failure === "unwind" ? "escape" : execution.failure });
      assert.equal(mir.blocks.length, 2);
    }
    assert.deepEqual(mir.blocks.at(-1).terminator.value, { kind: "place", place: 1 });
    for (let maximumRecords = 0; maximumRecords < 7; maximumRecords += 1) {
      const refused = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
      assert.equal(refused.kind, "refused", `${name} under ${maximumRecords}`);
      assert.equal("value" in refused, false);
    }
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 7 } }, program.tir, []).value, mir);
  }
  const not = selected({ kind: "boolean-operator", operator: "!" }, [T.bool], T.bool);
  const program = shaped("unary.boolean", [["a", "required", T.bool]], T.bool,
    b => b.block(b.returns(b.prefix(b.id("a", 0, T.bool), "ExclamationToken", T.bool, not))));
  assert.deepEqual(lower(program).blocks[0].statements[1].value,
    { kind: "unary", operation: typedOperation(not), operand: { kind: "place", place: 0 } });
});

test("typeof and void place their selected unary operations after actual operand evaluation", () => {
  for (const [kind, identity, result] of [["TypeOfExpression", "type-query", T.string], ["VoidExpression", "discard", T.absence]]) {
    for (const [name, execution] of Object.entries(EXECUTIONS)) {
      const decision = selected({ kind: identity }, [T.int32], result, execution);
      const program = shaped(`unary.${kind}.${name}`, [["x", "required", T.int32]], result, b => b.block(b.returns({
        $: "selected", kind, expression: b.id("x", 0, T.int32), tsonic: value(result, { operation: { kind: "decided", decision: typedOperation(decision) } }),
      })));
      const mir = lower(program);
      if (execution.kind === "pure") assert.deepEqual(mir.blocks[0].statements[1].value,
        { kind: "unary", operation: typedOperation(decision), operand: { kind: "place", place: 0 } });
      else {
        assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 0 }]);
        assert.deepEqual(mir.blocks[0].terminator.operation, typedOperation(decision));
        assert.equal(mir.blocks[0].terminator.unwind.kind, execution.failure === "unwind" ? "escape" : execution.failure);
      }
      assert.deepEqual(mir.blocks.at(-1).terminator.value, { kind: "place", place: 1 });
      for (let maximumRecords = 0; maximumRecords < 7; maximumRecords += 1)
        assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${kind}/${name} under ${maximumRecords}`);
      assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 7 } }, program.tir, []).value, mir);

      const operandEffect = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
      const effectful = shaped(`unary.${kind}.${name}.operand-effect`, [["x", "required", T.int32]], result, b => b.block(b.returns({
        kind, expression: { $: "effect", ...b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, operandEffect) },
        tsonic: value(result, { operation: { kind: "decided", decision: typedOperation(decision) } }),
      })));
      const graph = lower(effectful);
      assert.equal(graph.blocks[0].terminator.tir.node, effectful.at("effect"));
      assert.deepEqual(graph.blocks[0].terminator.operation, typedOperation(operandEffect));
      const query = graph.blocks[1];
      if (execution.kind === "pure") assert.deepEqual(query.statements[1].value.operand, { kind: "place", place: 1 });
      else assert.deepEqual(query.terminator.operands, [{ kind: "place", place: 1 }]);
      for (let maximumRecords = 0; maximumRecords < 11; maximumRecords += 1)
        assert.equal(produced({ ...deps, limits: { maximumRecords } }, effectful.tir, []).kind, "refused", `${kind}/${name} operand effect under ${maximumRecords}`);
      assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 11 } }, effectful.tir, []).value, graph);
    }
    const deferred = shaped(`unary.${kind}.deferred`, [["x", "required", T.int32]], result, b => b.block(b.returns({
      kind, expression: b.id("x", 0, T.int32), tsonic: value(result, { operation: { kind: "deferred", deferred: null } }),
    })));
    assert.throws(() => produced(deps, deferred.tir, []), error => defectOfLowerMir(error) && error.message.includes("deferred operation"));
  }
});

test("nested unary values run inside out; a writing unary saves only earlier pending exposed reads", () => {
  const minus = native("-", "int32", [T.int32], T.int32);
  const program = shaped("unary.nested", [["a", "required", T.int32]], T.int32, b => b.block(b.returns(
    { $: "outer", ...b.prefix({ $: "inner", ...b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, minus) }, "MinusToken", T.int32, minus) })));
  const nestedMir = lower(program);
  const operations = nestedMir.blocks[0].statements.filter(record => record.kind === "assign");
  assert.deepEqual(operations.map(record => record.tir.node), [program.at("inner"), program.at("outer")]);
  assert.deepEqual(operations.map(record => record.value.operand), [{ kind: "place", place: 0 }, { kind: "place", place: 1 }]);

  for (const passing of ["by-value", "byref-readwrite"]) {
    const writes = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
    const waiting = shaped(`unary.waiting.${passing}`, [["a", "required", T.int32, passing]], T.int32, b => b.block(b.returns(
      b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, writes),
        T.int32, plus("int32", T.int32)))));
    const mir = lower(waiting);
    const saved = mir.blocks[0].statements.filter(record => record.kind === "assign");
    const exposed = passing === "byref-readwrite";
    assert.equal(saved.length, exposed ? 1 : 0);
    if (exposed) assert.deepEqual(saved[0].value, { kind: "use", operand: { kind: "place", place: 0 } });
    assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 0 }]);
    assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: exposed ? 1 : 0 });
    const records = exposed ? 15 : 11;
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, waiting.tir, []).kind, "refused", `${passing} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, waiting.tir, []).value, mir);
  }
});

test("empty statements have no records and expression statements retain effects while discarding their value", () => {
  const empty = shaped("discard.empty", [], T.void, b => b.block({ kind: "EmptyStatement", tsonic: null }));
  const bare = lower(empty);
  assert.deepEqual([bare.locals, bare.places, bare.constants, bare.blocks.length, bare.blocks[0].statements], [[], [], [], 1, []]);
  assert.equal(produced({ ...deps, limits: { maximumRecords: 0 } }, empty.tir, []).kind, "refused");
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 1 } }, empty.tir, []).value, bare);
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const program = shaped("discard.effect", [["a", "required", T.int32, "byref-readwrite"]], T.void,
    b => b.block(b.expressionStatement(b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, decision)),
      b.expressionStatement(b.id("a", 0, T.int32)), b.returns(null), b.expressionStatement(b.num("2", T.int32))));
  const mir = lower(program);
  assert.deepEqual(mir.blocks.map(block => block.statements.map(record => record.kind)), [["storage-live"], []]);
  assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 0 }]);
  assert.deepEqual([mir.blocks[1].terminator.kind, mir.blocks[1].terminator.value, mir.constants], ["return", null, []]);
  for (let maximumRecords = 0; maximumRecords < 7; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `discard under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 7 } }, program.tir, []).value, mir);
});

test("comma sequences execute each operand once in source order and keep only the right result", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const program = shaped("sequence.effects", [["a", "required", T.int32, "byref-readwrite"]], T.int32,
    b => b.block(b.returns(b.sequence(
      { $: "left", ...b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, decision) },
      { $: "right", ...b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, decision) }, T.int32))));
  const mir = lower(program);
  assert.deepEqual(mir.blocks.slice(0, 2).map(block => [block.terminator.kind, block.terminator.tir.node, block.terminator.operands]),
    [["invoke", program.at("left"), [{ kind: "place", place: 0 }]], ["invoke", program.at("right"), [{ kind: "place", place: 0 }]]]);
  assert.deepEqual(mir.blocks.flatMap(block => block.statements).map(record => record.kind), ["storage-live", "storage-live"]);
  assert.deepEqual(mir.blocks[2].terminator.value, { kind: "place", place: 2 });
  for (let maximumRecords = 0; maximumRecords < 11; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `sequence under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 11 } }, program.tir, []).value, mir);
});

test("discard removes only its own exposure while an outer pending read remains protected from a later effect", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const program = shaped("sequence.outer", [["a", "required", T.int32, "byref-readwrite"], ["b", "required", T.int32, "byref-readwrite"]], T.int32,
    b => b.block(b.returns(b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.sequence(b.id("b", 1, T.int32),
      b.prefix(b.id("b", 1, T.int32), "MinusToken", T.int32, decision), T.int32), T.int32, plus("int32", T.int32)))));
  const mir = lower(program);
  const saved = mir.blocks[0].statements.filter(record => record.kind === "assign");
  assert.deepEqual(saved.map(record => record.value), [{ kind: "use", operand: { kind: "place", place: 0 } }]);
  assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 1 }]);
  assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: 2 });
  for (let maximumRecords = 0; maximumRecords < 17; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `waiting under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 17 } }, program.tir, []).value, mir);
});

test("an escaping throw evaluates its selected operand once, names the actual throw and omits unreachable statements", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.unwinds);
  const cases = [
    ["constant", [], b => b.keyword("TrueKeyword", T.bool), 2],
    ["parameter", [["a", "required", T.int32]], b => b.id("a", 0, T.int32), 3],
    ["invoke", [["a", "required", T.int32]], b => b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, decision), 7],
  ];
  for (const [name, rows, expression, records] of cases) {
    const program = shaped(`throw.${name}`, rows, T.void, b => b.block({ $: "throw", ...b.throws(expression(b)) },
      b.expressionStatement(b.num("9", T.int32)), b.returns(null)));
    const mir = lower(program);
    const thrown = mir.blocks.at(-1).terminator;
    assert.deepEqual([thrown.kind, thrown.tir.node, thrown.unwind], ["throw", program.at("throw"), { kind: "escape" }]);
    assert.deepEqual(thrown.operand, name === "constant" ? { kind: "constant", constant: 0 }
      : { kind: "place", place: name === "invoke" ? 1 : 0 });
    assert.equal(mir.constants.length, name === "constant" ? 1 : 0);
    assert.equal(mir.blocks.length, name === "invoke" ? 2 : 1);
    if (name === "invoke") {
      assert.deepEqual(mir.blocks[0].terminator.operation, typedOperation(decision));
      assert.deepEqual(mir.blocks[0].terminator.unwind, { kind: "escape" });
      assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 0 }]);
    }
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("selected native and backed conversions retain raw carriers and exact source decisions under every execution decision", () => {
  const sources = [
    ["parameter", b => b.id("a", 0, T.int32), 7, { kind: "place", place: 0 }],
    ["literal", b => b.num("1", T.int32), 6, { kind: "constant", constant: 0 }],
    ["parenthesized", b => b.paren(b.id("a", 0, T.int32), T.int32), 7, { kind: "place", place: 0 }],
    ["binary", b => b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.id("a", 0, T.int32), T.int32, plus("int32", T.int32)), 11, { kind: "place", place: 1 }],
    ["unary", b => b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, native("-", "int32", [T.int32], T.int32)), 11, { kind: "place", place: 1 }],
  ];
  for (const backing of ["native", "core", "library"]) for (const [executionName, execution] of Object.entries(EXECUTIONS)) for (const [sourceName, source, records, operand] of sources) {
    const name = `conversion.${backing}.${executionName}.${sourceName}`;
    const program = shaped(name, sourceName === "literal" ? [] : [["a", "required", T.int32]], T.literalInt64,
      b => b.block(b.returns(convertingNode(b, name, source(b), T.int32, T.literalInt64, execution, backing))));
    const conversion = program.tir.root.statements.nodes[0].expression.tsonic.conversion.operation;
    const mir = lower(program);
    const convertedPlace = sourceName === "literal" ? 0 : sourceName === "binary" || sourceName === "unary" ? 2 : 1;
    if (execution.kind === "pure") {
      const stored = mir.blocks[0].statements.at(-1);
      assert.deepEqual(stored.value, { kind: "convert", operation: conversion, operand, to: T.literalInt64 });
      assert.equal(stored.place, convertedPlace);
    } else {
      assert.deepEqual([mir.blocks[0].terminator.operation, mir.blocks[0].terminator.operands, mir.blocks[0].terminator.destination],
        [conversion, [operand], convertedPlace]);
      assert.deepEqual(mir.blocks[0].terminator.unwind, { kind: execution.failure === "unwind" ? "escape" : execution.failure });
    }
    assert.equal(mir.locals.at(-1).storage, T.literalInt64);
    assert.deepEqual(mir.blocks.at(-1).terminator.value, { kind: "place", place: convertedPlace });
    if (sourceName === "binary" || sourceName === "unary") {
      assert.equal(mir.blocks[0].statements[1].value.kind, sourceName);
      assert.equal(mir.locals[1].storage, T.int32);
      assert.equal(mir.blocks[0].statements[1].tir.node, program.at("converted"));
    }
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("a selected writing conversion consumes its source then protects only an earlier exposed operand", () => {
  const name = "conversion.waiting";
  const program = shaped(name, [["a", "required", T.literalInt64, "byref-readwrite"], ["b", "required", T.int32, "byref-readwrite"]], T.literalInt64,
    b => b.block(b.returns(b.arithmetic(b.id("a", 0, T.literalInt64), "PlusToken",
      convertingNode(b, name, b.id("b", 1, T.int32), T.int32, T.literalInt64, EXECUTIONS.writes, "native"),
      T.literalInt64, plus("int64", T.literalInt64)))));
  const mir = lower(program);
  assert.deepEqual(mir.blocks[0].statements.filter(record => record.kind === "assign").map(record => record.value),
    [{ kind: "use", operand: { kind: "place", place: 0 } }]);
  assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 1 }]);
  assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: 2 });
  for (let maximumRecords = 0; maximumRecords < 17; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `conversion waiting under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 17 } }, program.tir, []).value, mir);
});

test("selected narrowed values check their actual place once with the supplied failure and exact record refusal", () => {
  for (const failure of ["unwind", "abort"]) for (const form of ["identifier", "wrapper", "constant"]) {
    const name = `narrow.${failure}.${form}`;
    const program = shaped(name, [["x", "required", T.optInt32]], T.int32, b => {
      const node = form === "identifier" ? b.id("x", 0, T.int32)
        : b.nonNull(form === "constant" ? b.num("1", T.optInt32) : b.id("x", 0, T.optInt32), T.int32, null);
      return b.block(b.returns(narrowingNode(b, name, node, T.optInt32, T.int32, failure)));
    });
    const mir = lower(program);
    const checked = mir.places.at(-1);
    assert.deepEqual([checked.storage, checked.base.kind, checked.base.projection, checked.base.tir],
      [T.int32, "checked", { kind: "refined" }, program.nodeRef("narrowed")]);
    assert.deepEqual([mir.blocks[0].terminator.kind, mir.blocks[0].terminator.place, mir.blocks[0].terminator.unwind],
      ["check", checked.id, { kind: failure === "abort" ? "abort" : "escape" }]);
    assert.deepEqual(mir.blocks[1].terminator.value, { kind: "place", place: checked.id });
    if (form === "constant") {
      assert.equal(mir.constants[0].type, T.optInt32);
      assert.deepEqual(mir.blocks[0].statements[1].value, { kind: "use", operand: { kind: "constant", constant: 0 } });
    } else assert.deepEqual(mir.blocks[0].statements, []);
    const records = form === "constant" ? 9 : 5;
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1) {
      const outcome = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
      assert.equal(outcome.kind, "refused", `${name} under ${maximumRecords}`);
      assert.equal("value" in outcome, false);
    }
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("a selected narrowing precedes its conversion and an exposed refined read is saved before a later write", () => {
  const convertedName = "narrow.converted";
  const converted = shaped(convertedName, [["x", "required", T.optInt32]], T.literalInt64, b => b.block(b.returns(
    convertingNode(b, convertedName, narrowingNode(b, convertedName, b.id("x", 0, T.int32), T.optInt32, T.int32, "abort"),
      T.int32, T.literalInt64, EXECUTIONS.unwinds, "native"))));
  const convertedMir = lower(converted);
  assert.deepEqual(convertedMir.blocks.map(block => block.terminator.kind), ["check", "invoke", "return"]);
  assert.deepEqual(convertedMir.blocks[1].terminator.operands, [{ kind: "place", place: 1 }]);
  assert.equal(convertedMir.locals.at(-1).storage, T.literalInt64);
  for (let maximumRecords = 0; maximumRecords < 9; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, converted.tir, []).kind, "refused", `narrow-convert under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 9 } }, converted.tir, []).value, convertedMir);

  const name = "narrow.waiting";
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const waiting = shaped(name, [["x", "required", T.optInt32, "byref-readwrite"], ["b", "required", T.int32]], T.int32,
    b => b.block(b.returns(b.arithmetic(narrowingNode(b, name, b.id("x", 0, T.int32), T.optInt32, T.int32, "unwind"), "PlusToken",
      b.prefix(b.id("b", 1, T.int32), "MinusToken", T.int32, decision), T.int32, plus("int32", T.int32)))));
  const mir = lower(waiting);
  assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["check", "invoke", "return"]);
  assert.deepEqual(mir.blocks[1].statements.filter(record => record.kind === "assign").map(record => record.value),
    [{ kind: "use", operand: { kind: "place", place: 1 } }]);
  assert.deepEqual(mir.blocks[1].terminator.operands, [{ kind: "place", place: 2 }]);
  assert.deepEqual(mir.blocks[2].statements[1].value.left, { kind: "place", place: 3 });
  for (let maximumRecords = 0; maximumRecords < 19; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, waiting.tir, []).kind, "refused", `refined waiting under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 19 } }, waiting.tir, []).value, mir);
});

test("typed expression wrappers evaluate their operand only and retain actual contextual conversions at the wrapper", () => {
  for (const kind of ["AsExpression", "SatisfiesExpression", "TypeAssertionExpression"]) {
    const name = `wrapper.identity.${kind}`;
    const identity = shaped(name, [["x", "required", T.float64]], T.float64,
      b => b.block(b.returns({ kind, expression: b.id("x", 0, T.float64),
        type: { kind: "NumberKeyword", tsonic: { type: T.float64, declarations: [] } }, tsonic: value(T.float64) })));
    const plain = lower(identity);
    assert.deepEqual([plain.constants, plain.locals.length, plain.places.length, plain.blocks.length, plain.blocks[0].statements], [[], 1, 1, 1, []]);
    assert.deepEqual(plain.blocks[0].terminator.value, { kind: "place", place: 0 });
    for (let maximumRecords = 0; maximumRecords < 3; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, identity.tir, []).kind, "refused", `${kind} identity under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 3 } }, identity.tir, []).value, plain);

    const conversionName = `wrapper.converted.${kind}`;
    const converted = shaped(conversionName, [["x", "required", T.int32]], T.float64,
      b => b.block(b.returns(convertingNode(b, conversionName, { kind, expression: b.id("x", 0, T.int32),
        type: { kind: "NumberKeyword", tsonic: { type: T.float64, declarations: [] } }, tsonic: value(T.int32) },
      T.int32, T.float64, EXECUTIONS.pure, "native"))));
    const mir = lower(converted);
    assert.deepEqual([mir.locals.map(local => local.storage), mir.places.map(place => place.storage)], [[T.int32, T.float64], [T.int32, T.float64]]);
    assert.deepEqual([mir.blocks[0].statements[1].value.kind, mir.blocks[0].statements[1].value.operand, mir.blocks[0].statements[1].tir],
      ["convert", { kind: "place", place: 0 }, converted.nodeRef("converted")]);
    for (let maximumRecords = 0; maximumRecords < 7; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, converted.tir, []).kind, "refused", `${kind} converted under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 7 } }, converted.tir, []).value, mir);
  }
});

test("selected labelled exits skip the correct remainders and otherwise add no block", () => {
  const plain = shaped("label.plain", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "scope", b.block(b.expressionStatement(b.id("x", 0, T.int32)))), b.returns(b.id("x", 0, T.int32))));
  const returned = shaped("label.returned", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "scope", b.block(b.returns(b.id("x", 0, T.int32)))), b.throws(b.keyword("TrueKeyword", T.bool))));
  const broken = shaped("label.broken", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "scope", b.block(selectedBreak(b, "scope"), b.throws(b.keyword("TrueKeyword", T.bool)))), b.returns(b.id("x", 0, T.int32))));
  const outer = shaped("label.outer", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "out", b.block(labelledBlock(b, "inside", b.block(selectedBreak(b, "out"), b.throws(b.keyword("FalseKeyword", T.bool)))),
      b.throws(b.keyword("TrueKeyword", T.bool)))), b.returns(b.id("x", 0, T.int32))));
  const alias = shaped("label.alias", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "out", labelledBlock(b, "alias", b.block(selectedBreak(b, "out")), "out")), b.returns(b.id("x", 0, T.int32))));
  for (const [program, records, blocks] of [[plain, 3, 1], [returned, 3, 1], [broken, 4, 2], [outer, 4, 2], [alias, 4, 2]]) {
    const mir = lower(program);
    assert.deepEqual([mir.blocks.length, mir.locals.length, mir.places.length, mir.constants.length], [blocks, 1, 1, 0]);
    if (blocks === 2) assert.deepEqual([mir.blocks[0].terminator.kind, mir.blocks[0].terminator.target], ["goto", 1]);
    assert.deepEqual(mir.blocks.at(-1).terminator.value, { kind: "place", place: 0 });
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${program.tir.body} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("an inner selected break resumes its own remainder before an outer break exits its scope", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const program = shaped("label.inner", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "out", b.block(labelledBlock(b, "inside", b.block(selectedBreak(b, "inside"))),
      b.expressionStatement(b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision)), selectedBreak(b, "out"),
      b.throws(b.keyword("TrueKeyword", T.bool)))), b.returns(b.id("x", 0, T.int32))));
  const mir = lower(program);
  assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["goto", "invoke", "goto", "return"]);
  assert.deepEqual(mir.blocks.map(block => block.statements.map(record => record.kind)), [[], ["storage-live"], [], []]);
  assert.deepEqual([mir.blocks[0].terminator.target, mir.blocks[1].terminator.next, mir.blocks[2].terminator.target], [1, 2, 3]);
  assert.deepEqual(mir.blocks[1].terminator.operation, typedOperation(decision));
  assert.deepEqual(mir.blocks[3].terminator.value, { kind: "place", place: 0 });
  for (let maximumRecords = 0; maximumRecords < 9; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `inner break under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 9 } }, program.tir, []).value, mir);
});

test("invalid qualified selected break and label targets are caller defects, never guessed from label spelling", () => {
  const unknown = shaped("label.unknown", [], T.void, b => b.block({ kind: "BreakStatement", label: null,
    tsonic: { target: b.nodeRef(0) } }));
  assert.throws(() => produced(deps, unknown.tir, []), error => defectOfLowerMir(error) && error.message.includes("no active selected target"));
  const foreign = shaped("label.foreign", [], T.void, b => b.block({ kind: "BreakStatement", label: null,
    tsonic: { target: { body: bodyId("label.other"), node: 0 } } }));
  assert.throws(() => produced(deps, foreign.tir, []), error => defectOfLowerMir(error) && error.message.includes("break targets another body"));
  const foreignLabel = shaped("label.foreign-label", [], T.void, b => b.block({ kind: "LabeledStatement", label: b.label("x", "scope"),
    statement: { $: "scope", ...b.block() }, tsonic: { target: { body: bodyId("label.other"), node: 0 } } }));
  assert.throws(() => produced(deps, foreignLabel.tir, []), error => defectOfLowerMir(error) && error.message.includes("label targets another body"));
});

test("unconditional for loops have a real back edge, selected break/continue and no fabricated normal return", () => {
  const empty = shaped("for.empty", [], T.void, b => b.block(unconditionalFor("loop", b.block()), b.throws(b.keyword("TrueKeyword", T.bool))));
  const continuing = shaped("for.continue", [], T.void, b => b.block(unconditionalFor("loop", b.block(selectedContinue(b, "loop", false),
    b.throws(b.keyword("TrueKeyword", T.bool)))), b.returns(null)));
  const returned = shaped("for.returned", [["x", "required", T.int32]], T.int32,
    b => b.block(unconditionalFor("loop", b.block(b.returns(b.id("x", 0, T.int32)))), b.throws(b.keyword("TrueKeyword", T.bool))));
  const broken = shaped("for.broken", [["x", "required", T.int32]], T.int32,
    b => b.block(unconditionalFor("loop", b.block({ ...selectedBreak(b, "loop"), label: null })), b.returns(b.id("x", 0, T.int32))));
  const alias = shaped("for.alias", [["x", "required", T.int32]], T.int32,
    b => b.block(labelledBlock(b, "scope", unconditionalFor("loop", b.block({ ...selectedBreak(b, "loop"), label: null })), "loop"), b.returns(b.id("x", 0, T.int32))));
  for (const [program, records, endings] of [[empty, 2, ["goto", "goto"]], [continuing, 2, ["goto", "goto"]],
    [returned, 4, ["goto", "return"]], [broken, 5, ["goto", "goto", "return"]], [alias, 5, ["goto", "goto", "return"]]]) {
    const mir = lower(program);
    assert.deepEqual(mir.blocks.map(block => block.terminator.kind), endings);
    assert.deepEqual(mir.constants, []);
    assert.equal(mir.blocks[0].terminator.target, 1);
    if (records === 2) assert.equal(mir.blocks[1].terminator.target, 1);
    else assert.deepEqual(mir.blocks.at(-1).terminator.value, { kind: "place", place: 0 });
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${program.tir.body} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("for expression initialization runs once before its head and nested selected loop targets stay distinct", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const initialized = shaped("for.initialized", [["x", "required", T.int32]], T.int32,
    b => b.block(unconditionalFor("loop", b.block(b.returns(b.id("x", 0, T.int32))),
      b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision))));
  const mir = lower(initialized);
  assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["invoke", "goto", "return"]);
  assert.deepEqual(mir.blocks.flatMap(block => block.statements).map(record => record.kind), ["storage-live"]);
  assert.deepEqual(mir.blocks[0].terminator.operation, typedOperation(decision));
  assert.equal(mir.blocks[1].terminator.target, 2);
  assert.deepEqual(mir.blocks[2].terminator.value, { kind: "place", place: 0 });
  for (let maximumRecords = 0; maximumRecords < 8; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, initialized.tir, []).kind, "refused", `for initializer under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 8 } }, initialized.tir, []).value, mir);

  const nested = shaped("for.nested", [], T.void, b => b.block(labelledBlock(b, "outer", unconditionalFor("out-loop", b.block(
    unconditionalFor("inside", b.block({ ...selectedBreak(b, "inside"), label: null })), selectedContinue(b, "outer", true),
    b.throws(b.keyword("TrueKeyword", T.bool))))), b.returns(null)));
  const graph = lower(nested);
  assert.deepEqual(graph.blocks.map(block => [block.terminator.kind, block.terminator.target]), [["goto", 1], ["goto", 2], ["goto", 3], ["goto", 1]]);
  assert.deepEqual([graph.constants, graph.locals, graph.places], [[], [], []]);
  for (let maximumRecords = 0; maximumRecords < 4; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, nested.tir, []).kind, "refused", `nested for under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 4 } }, nested.tir, []).value, graph);
});

test("for incrementors run after normal completion or selected continues through one actual tail", () => {
  for (const [name, execution] of Object.entries({ pure: { kind: "pure" }, ...EXECUTIONS })) {
    const decision = native("-", "int32", [T.int32], T.int32, execution);
    for (const control of ["normal", "continue", "labelled", "nested", "alias"]) {
      const program = shaped(`for.incrementor.${name}.${control}`, [["x", "required", T.int32]], T.void, b => {
        const incrementor = b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision);
        const body = control === "normal" ? b.block() : control === "nested" ? b.block(
          unconditionalFor("inside", b.block({ ...selectedBreak(b, "inside"), label: null })), selectedContinue(b, "scope", true))
          : b.block(selectedContinue(b, control === "labelled" ? "scope" : "loop", control !== "continue"));
        const loop = { ...unconditionalFor("loop", body), incrementor };
        return b.block(control === "labelled" || control === "nested" || control === "alias"
          ? labelledBlock(b, "scope", loop, control === "alias" ? "loop" : "scope") : loop);
      });
      const mir = lower(program);
      const records = control === "nested" ? 11 : 9;
      const tail = mir.blocks.find(block => block.statements.some(record => record.kind === "storage-live"));
      assert.equal(tail !== undefined, true);
      assert.equal(mir.blocks[0].terminator.target, 1);
      assert.equal(mir.blocks[control === "nested" ? 3 : 1].terminator.target, tail.id);
      assert.equal(mir.blocks.at(-1).terminator.kind, "goto");
      assert.equal(mir.blocks.at(-1).terminator.target, 1);
      assert.deepEqual(mir.blocks.flatMap(block => block.statements).filter(record => record.kind === "storage-live").length, 1);
      assert.deepEqual(execution.kind === "pure" ? tail.statements[1].value.operation : tail.terminator.operation, typedOperation(decision));
      if (execution.kind !== "pure") assert.equal(tail.terminator.unwind.kind, execution.failure === "unwind" ? "escape" : execution.failure);
      for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
        assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${control}/${name} incrementor under ${maximumRecords}`);
      assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
    }
  }
});

test("for incrementors are skipped after break/return and initialization remains before the loop tail", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  for (const control of ["return", "break"]) {
    const program = shaped(`for.incrementor.skipped.${control}`, [["x", "required", T.int32]], T.int32, b => b.block({
      ...unconditionalFor("loop", b.block(control === "return" ? b.returns(b.id("x", 0, T.int32)) : { ...selectedBreak(b, "loop"), label: null })),
      incrementor: b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision),
    }, b.returns(b.id("x", 0, T.int32))));
    const mir = lower(program);
    assert.equal(mir.blocks.some(block => block.terminator.kind === "invoke"), false);
    assert.deepEqual(mir.blocks.flatMap(block => block.statements), []);
    const records = control === "return" ? 4 : 5;
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `skipped ${control} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
  const initialized = shaped("for.incrementor.initialized", [["x", "required", T.int32]], T.void, b => b.block({
    ...unconditionalFor("loop", b.block(), b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision)),
    incrementor: b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision),
  }));
  const mir = lower(initialized);
  assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["invoke", "goto", "goto", "invoke", "goto"]);
  assert.deepEqual(mir.blocks.map(block => block.terminator.target ?? null), [null, 2, 3, null, 2]);
  assert.equal(mir.blocks[0].terminator.next, 1);
  assert.equal(mir.blocks[3].terminator.next, 4);
  for (let maximumRecords = 0; maximumRecords < 13; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, initialized.tir, []).kind, "refused", `initialized incrementor under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 13 } }, initialized.tir, []).value, mir);
});

test("conditional for frontiers and invalid selected continue owners remain explicit", () => {
  const condition = shaped("for.frontier.condition", [], T.void,
    b => b.block({ ...unconditionalFor("loop", b.block()), condition: b.keyword("TrueKeyword", T.bool) }));
  assert.throws(() => produced(deps, condition.tir, []), notLoweredYet("a for loop with a condition"));
  const declaration = shaped("for.frontier.declaration", [], T.void,
    b => b.block(unconditionalFor("loop", b.block(), b.declarationList([]))));
  assert.throws(() => produced(deps, declaration.tir, []), notLoweredYet("for initialization by declarations"));
  const missing = shaped("for.missing-initializer", [], T.void,
    b => b.block(unconditionalFor("loop", b.block(), { kind: "MissingDeclaration", modifiers: null, tsonic: null })));
  assert.throws(() => produced(deps, missing.tir, []), error => defectOfLowerMir(error) && error.message.includes("missing declaration in for initialization"));
  const foreign = shaped("for.foreign", [], T.void, b => b.block({ kind: "ContinueStatement", label: null,
    tsonic: { target: { body: bodyId("for.other"), node: 0 } } }));
  assert.throws(() => produced(deps, foreign.tir, []), error => defectOfLowerMir(error) && error.message.includes("continue targets another body"));
  const unknown = shaped("for.unknown", [], T.void, b => b.block({ kind: "ContinueStatement", label: null, tsonic: { target: b.nodeRef(0) } }));
  assert.throws(() => produced(deps, unknown.tir, []), error => defectOfLowerMir(error) && error.message.includes("no active loop target"));
  const block = shaped("for.non-loop", [], T.void, b => b.block(labelledBlock(b, "scope", b.block(selectedContinue(b, "scope", true)))));
  assert.throws(() => produced(deps, block.tir, []), error => defectOfLowerMir(error) && error.message.includes("no active loop target"));
});

test("first producer: a record limit that is not a count is the caller's defect, raised before any record is made (K-3338)", () => {
  const program = add("first.add.limit", T.float64, plus("float64", T.float64));
  const unread = { get root() { assert.fail("malformed counts must be rejected before the body is read"); } };
  for (const maximumRecords of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, -1, 1.5, 8.999,
    Number.MAX_SAFE_INTEGER + 1, undefined, "1", 1n])
    assert.throws(() => produced({ ...deps, limits: { maximumRecords } }, unread, []),
      error => error instanceof TypeError && error.message === "lower-mir: maximumRecords must be a safe nonnegative count", String(maximumRecords));
  // Zero is a count: the body is refused with the size-limit diagnostic, not raised. The exact need is admitted.
  const zero = produced({ ...deps, limits: { maximumRecords: 0 } }, program.tir, []);
  assert.deepEqual([zero.kind, zero.diagnostics.map(diagnostic => diagnostic.code.rendered)], ["refused", ["TSONIC_COMPILER_RESOURCE_LIMIT"]]);
  assert.equal(produced({ ...deps, limits: { maximumRecords: 9 } }, program.tir, []).kind, "ok");
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: Number.MAX_SAFE_INTEGER } }, program.tir, []),
    produced({ ...deps, limits: { maximumRecords: 9 } }, program.tir, []));
  // The check comes first: a body past the frontier with an invalid limit is still the limit's defect.
  const generator = shaped("first.limit.generator", [["a", "required", T.int32]], T.int32, b => b.block(b.returns(b.id("a", 0, T.int32))), { extra: { generator: true } });
  assert.throws(() => produced({ ...deps, limits: { maximumRecords: -1 } }, generator.tir, []), TypeError);
});

test("first producer: an identity refinement is no check, and a parenthesized operand is its inner value", () => {
  const identity = { kind: "identity", type: T.int32 };
  const program = shaped("first.identity", [["a", "required", T.int32]], T.int32,
    b => b.block(b.returns(b.paren(b.id("a", 0, T.int32, { value: { narrowing: identity } }), T.int32))));
  const mir = lower(program);
  assert.deepEqual([mir.blocks.length, mir.blocks[0].statements, mir.blocks[0].terminator.value], [1, [], { kind: "place", place: 0 }]);
});

test("first producer: the frontier is one check that names what it met", () => {
  const refused = (program, what) => assert.throws(() => produced(deps, program.tir, []), notLoweredYet(what), what);
  const returning = (name, makeExpression, rows = [["a", "required", T.int32]], completion = T.int32, options = {}) =>
    shaped(name, rows, completion, b => b.block(b.returns(makeExpression(b))), options);
  const a = b => b.id("a", 0, T.int32);
  const P = plus("int32", T.int32);
  // Bodies and parameter rows.
  refused(shaped("frontier.root", [["a", "required", T.int32]], T.int32, a), "a body whose root is Identifier");
  refused(returning("frontier.async", a, undefined, undefined, { extra: { asynchronous: true } }), "an asynchronous body or a generator");
  refused(returning("frontier.generator", a, undefined, undefined, { extra: { generator: true } }), "an asynchronous body or a generator");
  refused(returning("frontier.captures", a, undefined, undefined, { extra: { captures: [{ local: { body: bodyId("frontier.outer"), local: 0 }, capture: "captured-value" }] } }), "a body that captures");
  for (const role of ["optional", "default", "rest"]) refused(returning(`frontier.${role}`, a, [["a", role, T.int32]]), `a parameter of role ${role}`);
  // Statements and expressions.
  refused(shaped("frontier.statement", [["a", "required", T.int32]], T.int32, b => b.block(b.whileLoop(b.keyword("TrueKeyword", T.bool), b.returns(a(b))))),
    "the statement WhileStatement");
  refused(returning("frontier.numeric-role", b => ({ ...b.num("1", T.int32), tsonic: { role: "type-literal", type: T.int32 } })),
    "a numeric literal of role type-literal");
  refused(returning("frontier.bigint-role", () => ({ kind: "BigIntLiteral", text: "1n", tokenFlags: [],
    tsonic: { role: "type-literal", type: T.literalBigint } }), [], T.literalBigint), "a bigint literal of role type-literal");
  refused(returning("frontier.prefix-role", b => ({ ...b.prefix(a(b), "MinusToken", T.int32, P),
    tsonic: { role: "type-literal", type: T.int32 } })), "a prefix expression of role type-literal");
  refused(returning("frontier.keyword-role", b => ({ ...b.keyword("TrueKeyword", T.bool), tsonic: { role: "type-literal", type: T.bool } }), [], T.bool),
    "a keyword literal of role type-literal");
  refused(returning("frontier.string-role", () => ({ kind: "StringLiteral", text: "x", tokenFlags: [],
    tsonic: { role: "type-literal", type: T.string } }), [], T.string), "a string literal of role type-literal");
  refused(returning("frontier.assignment", b => b.assign(b.target("a", 0, T.int32), "EqualsToken", a(b), T.int32, T.int32)),
    "a binary expression of role assignment");
  refused(returning("frontier.target", b => b.target("a", 0, T.int32)), "an identifier of role assignment-target");
  refused(returning("frontier.global", b => b.global("g", "frontier.g", T.int32)), "a name resolved to a definition");
  refused(shaped("frontier.outerLocal", [["a", "required", T.int32]], T.int32,
    b => b.block(b.returns({ kind: "Identifier", text: "x", tsonic: { ...b.id("x", 0, T.int32).tsonic, resolution: { kind: "local", local: { body: bodyId("frontier.outer"), local: 0 } } } }))),
    "a local that is not a parameter of the body");
  refused(shaped("frontier.bodyLocal", [["a", "required", T.int32]], T.int32, b => b.block(b.returns(b.id("x", 1, T.int32))),
    { extra: { extra: { locals: [{ id: 0, declaration: { kind: "body", value: { body: bodyId("frontier.bodyLocal"), node: 0 } }, name: "a", role: "parameter", capturedFrom: null, mutable: false, storage: T.int32 },
      { id: 1, declaration: { kind: "body", value: { body: bodyId("frontier.bodyLocal"), node: 0 } }, name: "x", role: "binding", capturedFrom: null, mutable: false, storage: T.int32 }] } } }),
  "a local that is not a parameter of the body");
  // Values: the arms of the conversion decision that are not the identity, a narrowed use, a selected demand. None
  // is reached by a checkpoint program yet; each is refused, so none looks lowered.
  const valued = (name, extra) => returning(name, b => b.id("a", 0, T.int32, { value: extra }));
  refused(valued("frontier.demand", { demand: { kind: "never", control: 0 } }), "a value demanded under a selection");
  refused(returning("frontier.parenthesized", b => ({ ...b.paren(a(b), T.int32), tsonic: { ...b.paren(a(b), T.int32).tsonic, demand: { kind: "never", control: 0 } } })),
    "a value demanded under a selection");
});

test("first producer: a body that must not be offered is a caller defect, told from the frontier", () => {
  const defect = (program, what) => assert.throws(() => produced(deps, program.tir, []),
    error => defectOfLowerMir(error) && error.message === `${CALLER_DEFECT}${what}`, what);
  const returning = (name, makeExpression, completion = T.int32) =>
    shaped(name, [["a", "required", T.int32]], completion, b => b.block(b.returns(makeExpression(b))));
  const deferred = { invocation: { rule: "embed", input: null }, result: T.int32 };
  defect(returning("defect.prefix", b => ({ ...b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, plus("int32", T.int32)),
    tsonic: { ...value(T.int32), role: "value", operation: { kind: "deferred", deferred } } })), "a deferred operation");
  defect(returning("defect.conversion", b => b.id("a", 0, T.int32, { value: { conversion: { kind: "deferred", deferred } } })), "a deferred conversion");
  defect(returning("defect.operation", b => ({ ...b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.id("a", 0, T.int32), T.int32, plus("int32", T.int32)),
    tsonic: { ...b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.id("a", 0, T.int32), T.int32, plus("int32", T.int32)).tsonic, operation: { kind: "deferred", deferred } } })),
  "a deferred operation");
  defect(returning("defect.resolution", () => ({ kind: "Identifier", text: "missing", tsonic: { type: T.int32, convertedType: T.int32, conversion: { kind: "identity" },
    narrowing: null, evidenceIndex: null, demand: { kind: "always" }, role: "value", resolution: { kind: "error", diagnostic: 0 } } })), "an error resolution");
  defect(shaped("defect.end", [["a", "required", T.int32]], T.int32, b => b.block()), "the end of a body that completes with a value is reached");
  // Initializer data supplied with the body: the body places an initializer execution, which is past the frontier.
  const program = add("defect.internal", T.int32, plus("int32", T.int32));
  assert.throws(() => produced(deps, program.tir, [{ instance: { body: bodyId("defect.internal", "default"), bindings: PARAMETRIC }, captures: [], signature: 0 }]),
    notLoweredYet("a body that executes initializer bodies"));
  // A statement list with a hole is a defect of the tree, reported by name (R5 C-a).
  const holed = shaped("defect.hole", [["a", "required", T.int32]], T.int32, b => ({ ...b.block(), statements: { $list: true, nodes: [, b.returns(b.id("a", 0, T.int32))] } }));
  assert.throws(() => produced(deps, holed.tir, []), error => error instanceof Error && error.cause !== undefined && error.cause.owner === "lower-mir"
    && error.message === "a statement list has a hole");
  defect(shaped("defect.endUnknown", [["a", "required", T.int32]], T.unknown, b => b.block()), "the end of a body that completes with a value is reached");
});

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
  const failingAbsent = policy.absent === "abort" ? "abort" : "escape";

  test(`WT-6 order (${policy.bounds}/${policy.absent}): effects and checks execute once, in authored order`, () => {
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

  test(`WT-6 order (${policy.bounds}/${policy.absent}): both checks of a[i()] use the array and index evaluated once`, () => {
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

  test(`WT-6 order (${policy.bounds}/${policy.absent}): each check carries the selected failure kind`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // R1: a check is a control point "with its failure kind: unwinds to a named handler or out of the body, or ends the
    // process". WT-6: "the MIR differs only in the failure edge of the same test". The read of a[0] stands inside
    // `try … finally`, so an unwinding failure there enters the cleanup; the other checks stand outside any handler.
    const kinds = Object.fromEntries(["@target", "@bang", "a[0]#read", "a[0]#write"].map(label =>
      [label, checks(mir, program.at(label)).map(point => point.failure)]));
    assert.deepEqual(kinds, {
      "@target": [failing, failing], "@bang": [failingAbsent],
      "a[0]#read": [policy.bounds === "abort" ? "abort" : "handler"], "a[0]#write": [failing],
    });
  });

  test(`WT-6 order (${policy.bounds}/${policy.absent}): each read and each store stands where the source evaluates it`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    const path = walk(mir);
    const position = predicate => indexOfEvent(path, predicate);
    const terminatorOf = point => position(item => item.statement === null && item.block === point.block);
    // a[i()] += f(). Section 7 part 8, WT-6: "the index check … at the read". The element is read between its first
    // check and f(), and stored after the second check through the place that check resolved (graph law 3).
    const [firstCheck, secondCheck] = checks(mir, program.at("@target")).sort((one, other) => terminatorOf(one) - terminatorOf(other));
    const read = position(item => item.statement !== null && readsPlace(mir, item, firstCheck.record.place));
    const stored = path.events.findLastIndex(item => storesPlace(mir, item, secondCheck.record.place));
    const callF = position(item => item.statement === null && item.node === program.at("f()#1"));
    assert.ok(terminatorOf(firstCheck) < read && read < callF, "the element is read after its check and before f()");
    assert.ok(callF < terminatorOf(secondCheck) && terminatorOf(secondCheck) < stored, "the element is stored after the second check");
    // opt!.count += (opt = undefined, 1): `count` is read before the right-hand side is evaluated.
    const readCount = position(item => item.statement !== null && operandPlacesOf(item).some(place => fieldKeyOf(mir, place) === "count"));
    const assigned = position(item => item.statement !== null && item.kind === "assign" && item.node === program.at("opt=undefined"));
    assert.ok(readCount !== -1 && readCount < assigned, "count is read before opt is assigned");
    // try { return a[0]; } finally { a[0] = 0; }: the result is read before the cleanup stores, and what is returned
    // is the value read, not the element after the store.
    const readCheck = checks(mir, program.at("a[0]#read"))[0];
    const writeCheck = checks(mir, program.at("a[0]#write"))[0];
    const readFirst = position(item => item.statement !== null && readsPlace(mir, item, readCheck.record.place));
    const storeFirst = position(item => storesPlace(mir, item, writeCheck.record.place));
    assert.ok(readFirst !== -1 && readFirst < storeFirst, "a[0] is read before the cleanup stores into it");
    const returned = path.events.at(-1);
    assert.equal(returned.kind, "return");
    assert.equal(readsPlace(mir, returned, readCheck.record.place) || readsPlace(mir, returned, writeCheck.record.place), false);
  });

  test(`WT-6 order (${policy.bounds}/${policy.absent}): o.inner is read before f() and the store goes into that object`, () => {
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

  test(`WT-6 order (${policy.bounds}/${policy.absent}): opt is tested once before the right-hand side and is not read again`, () => {
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

  test(`WT-6 order (${policy.bounds}/${policy.absent}): a failing read inside try runs finally only when the failure unwinds`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // R6: every abnormal exit passes through each enclosing cleanup once. R1 and COMMON-DATA §10: a failure that ends
    // the process has no edge; no handler or cleanup runs after it.
    const path = walk(mir, { decide: point => point.node === program.at("a[0]#read") && point.kind === "check" ? "unwind" : "normal" });
    const tested = labelled(program, nodesOn(path, new Set(["check"]))).slice(-2);
    if (policy.bounds === "abort") { assert.equal(path.end, "abort"); assert.equal(tested.at(-1), "a[0]#read"); }
    else { assert.equal(path.end, "unwind"); assert.deepEqual(tested, ["a[0]#read", "a[0]#write"]); }
  });

  test(`WT-6 orderGrow (${policy.bounds}/${policy.absent}): a call between the read and the store over a growable carrier: a second control point`, () => {
    const program = wt6(policy).orderGrow;
    const mir = lower(program);
    assert.deepEqual(labelled(program, nodesOn(walk(mir))), ["i()", "@target", "grow(a)", "@target", "a[0]"]);
  });

  test(`WT-6 orderFixed (${policy.bounds}/${policy.absent}): a fixed extent held in place: no second control point`, () => {
    const program = wt6(policy).orderFixed;
    const mir = lower(program);
    assert.deepEqual(labelled(program, nodesOn(walk(mir))), ["i()", "@target", "f()"]);
    assert.equal(checks(mir, program.at("@target")).length, 1);
    // R11: "value storage is addressed in place and never copied to stand for the destination". The fixed array is the
    // parameter's own storage: the checked place is rooted at that local.
    assert.equal(checkedPlace(mir, checks(mir)[0]).parentRoot, sourceLocal(mir, 0));
  });

  test(`WT-6 orderInPlace (${policy.bounds}/${policy.absent}): a narrowed type held in place is tested again after the right-hand side`, () => {
    const program = wt6(policy).orderInPlace;
    const mir = lower(program);
    // Section 7 part 8, the WT-6 row, for a type held in place: the place is "resolved again after the right-hand
    // side and tested against what the variable then holds". The store goes into the variable's own storage.
    const path = walk(mir);
    assert.deepEqual(labelled(program, nodesOn(path)), ["@bang", "@bang"]);
    assert.deepEqual(checks(mir, program.at("@bang")).map(point => point.failure), [failingAbsent, failingAbsent]);
    const tests = path.events.map((item, index) => item.statement === null && item.kind === "check" ? index : -1).filter(index => index !== -1);
    const assignment = indexOfEvent(path, item => item.statement !== null && item.kind === "assign" && item.node === program.at("opt=undefined"));
    const store = path.events.findLastIndex(item => storesField(mir, item, "count"));
    assert.ok(tests[0] < assignment && assignment < tests[1] && tests[1] < store);
    assert.equal(storedRootOf(mir, path.events[store]), sourceLocal(mir, 0));
  });

  test(`WT-6 orderFixedByReference (${policy.bounds}/${policy.absent}): a fixed extent held by reference: no second control point`, () => {
    const program = wt6(policy).orderFixedByReference;
    const mir = lower(program);
    // The receiver mode is "by reference" and the extent is fixed: reference does not mean growable.
    assert.deepEqual(labelled(program, nodesOn(walk(mir))), ["i()", "@target", "f()"]);
    assert.equal(checks(mir, program.at("@target")).length, 1);
  });
}

test("WT-6: the failure policies give the same graph except for the failure kind of the same checks", () => {
  // WALKTHROUGH-PROGRAMS WT-6: "the MIR differs only in the failure edge of the same test (K-3212 point 3)".
  const [reference, ...others] = POLICIES.map(policy => wt6(policy));
  const normalPath = programs => walk(lower(programs.order)).events.map(item => [item.kind, item.node]);
  for (const programs of others) {
    for (const name of ["orderGrow", "orderFixed", "orderFixedByReference", "orderInPlace"])
      assert.deepEqual(withoutFailureKinds(lower(programs[name])), withoutFailureKinds(lower(reference[name])));
    // `order` has a cleanup that an unwinding failure enters and a process-ending failure does not; the path that
    // completes normally is the same under every policy.
    assert.deepEqual(normalPath(programs), normalPath(reference));
  }
});

// ---- WT-4 -----------------------------------------------------------------------------------

const internalCalls = internalCallsOn;

test("WT-4 f: three entries by supplied count; a default runs only in the entry that omits its parameter", () => {
  const programs = wt4();
  const mir = lower(programs.f, programs.internal);
  // R7 and section 7 part 8, WT-4: "`f` has three entries", one per admissible count of supplied fixed arguments.
  // Graph law 7 says they are ordered by supplied count; the cases below find each entry by its count, not by its
  // position or block.
  // Graph law 7 as the foundation enforces it: the full count first, each next count one less.
  assert.deepEqual(providedCountsOf(mir), [2, 1, 0]);
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
  // The supplied absence is the absence constant; a supplied 1 is the number (R1 section 4).
  const firstArgument = label => argumentConstantOf(mir, at(mir, programs.calls.at(label), "call")[0], 0);
  assert.equal(firstArgument("f(null)"), null);
  assert.equal(firstArgument("f(undefined)"), null);
  assert.equal(firstArgument("f(1)"), 1n);
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
    const path = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : isCompletionBranch(point) ? true
      : point.node === program.at("case 1") ? k === 1 : point.node === program.at("case 2") ? k === 2 : "otherwise" });
    assert.equal(path.end, "return");
    return squash(labelled(program, statementsOn(path).filter(item => clauses.has(item.node)).map(item => item.node)));
  };
  assert.deepEqual(run(1), ["r+=1", "r+=2"]);
  assert.deepEqual(run(2), ["r+=2"]);
  assert.deepEqual(run(3), ["r=9"]);
  // The tests run in authored order, each once: with no match, case 1 is tested before case 2.
  const unmatched = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : isCompletionBranch(point) ? true : false });
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
  const trace = path.events.map(item => item.statement === null && namesStep(item, ARRAY_STEP.next) ? "next"
    : item.statement === null && namesStep(item, ARRAY_STEP.finish) ? "finish"
    : item.statement !== null && item.node === program.at("r+=v") ? "add" : null).filter(item => item !== null);
  // One addition may be several statements of the same occurrence; they count once.
  assert.deepEqual(trace.filter((item, index) => !(item === "add" && trace[index - 1] === "add")),
    ["next", "next", "add", "next", "finish", "next", "next", "add", "next", "finish", "finish"]);
  // R6 "in order": `continue outer` closes the inner iteration; `break outer` closes the inner one, then the outer one.
  const closed = path.events.filter(item => item.statement === null && namesStep(item, ARRAY_STEP.finish)).map(item => item.node);
  assert.deepEqual(labelled(program, closed), ["for v", "for v", "for row"]);
  // R10: a binding of an iteration is begun again by each iteration: `row` twice, `v` four times on this path.
  const begun = local => path.events.filter(item => item.statement !== null && item.kind === "storage-live" && item.record.local === sourceLocal(mir, local)).length;
  assert.equal(begun(3), 2);
  assert.equal(begun(4), 4);
  // Graph law 8: a parameter is present on entry and carries no marker.
  assert.deepEqual([0, 1].flatMap(parameter => markersOf(mir, sourceLocal(mir, parameter))), []);
});

test("S-2 steps: every record of an iteration names its step; each loop has one completion branch", () => {
  const program = s2().program;
  const mir = lower(program);
  for (const label of ["for row", "for v"]) {
    // R4: a protocol step "says which step of which protocol it is; the edge on which an iteration is complete is
    // identifiable from the record". Graph laws 6 and 9: each step is one record.
    const records = controlPoints(mir).filter(point => point.node === program.at(label) && point.kind === "invoke");
    for (const [role, index] of Object.entries(ARRAY_STEP)) {
      const named = records.filter(point => namesStep(point, index));
      assert.equal(named.length, 1, `${label} ${role}`);
      // The record executes the operation of the step it names: the decision's, not one lowering chose (R12).
      assert.equal(operationName(named[0].record), def(`iterate.${role}`));
    }
    assert.equal(records.every(point => point.step !== null), true);
    const branches = controlPoints(mir).filter(point => point.node === program.at(label) && isCompletionBranch(point));
    assert.equal(branches.length, 1);
    assert.equal(namesStep(branches[0], ARRAY_STEP.done), true);
  }
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
    // The handler edge delivers the thrown value into the storage of `e`, and `throw e` reads it (-102 depends on it).
    assert.equal(rootLocalOf(mir, call[0].record.unwind.exception), sourceLocal(mir, 1));
    assert.equal(readsLocal(mir, at(mir, program.at("throw e"), "throw")[0], sourceLocal(mir, 1)), true);
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
  // R4: the disposal names its step of the declaration's dispose protocol.
  assert.equal(namesStep(controlPoints(mir).filter(isDispose)[0], 0), true);
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
  // The construction stands inside `try`: its failure goes to the handler, and that path returns from the catch block.
  assert.equal(at(mir, program.at("new Res(log)"), "call")[0].failure, "handler");
  assert.equal(unbuilt.end, "return");
  // R10: the slot of `r` outlives the cleanup that reads it: no end marker of `r` precedes the disposal.
  const ended = indexOfEvent(returned, item => item.statement !== null && item.kind === "storage-dead" && item.record.local === sourceLocal(mir, 2));
  assert.ok(ended === -1 || indexOfEvent(returned, isDispose) < ended);
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
  assert.deepEqual(edgesOf(suspension[0].record).map(edge => edge.edge), ["resume", "unwind"]);
  // R4: the suspension names the await step of its node's protocol.
  assert.equal(namesStep(suspension[0], 0), true);
  // Graph law 9: the cleanup's code is emitted in one block, not once per exit.
  assert.equal(blocksWithStatementAt(mir, program.at("out+=.")).length, 1);
  const cleanup = blocksWithStatementAt(mir, program.at("out+=."))[0].id;
  // One element, then the iteration is complete.
  let asked = 0;
  const once = point => point.kind === "switch" && isCompletionBranch(point) ? (asked++ > 0) : "normal";
  const resumed = walk(mir, { decide: once });
  assert.equal(resumed.end, "return");
  assert.ok(indexOfEvent(resumed, item => item.statement === null && item.node === program.at("load(id)")) <
    indexOfEvent(resumed, item => item.statement === null && item.kind === "await"));
  assert.equal(entriesInto(resumed, cleanup), 1);
  // R6: an unwinding exit at the suspension passes through the enclosing cleanup once and leaves the body.
  asked = 0;
  const failed = walk(mir, { decide: point => point.kind === "await" ? "unwind" : once(point) });
  assert.equal(failed.end, "unwind");
  assert.equal(entriesInto(failed, cleanup), 1);
});

test("WT-9 take: a yield has the three exits resume, consumer finish and unwind", () => {
  const program = wt9().take;
  const mir = lower(program);
  // COMMON-DATA §4: suspension; resumption; "finite exit … by the consumer finishing it". R3.
  const suspension = at(mir, program.at("yield i"), "yield");
  assert.equal(suspension.length, 1);
  assert.equal(namesStep(suspension[0], 0), true);
  // No handler encloses the yield: a failure sent in leaves the body.
  assert.equal(suspension[0].failure, "escape");
  const incremented = path => path.events.filter(item => item.statement !== null && item.node === program.at("i++")).length;
  const exit = choice => { let asked = 0; return walk(mir, { decide: point => point.kind === "switch" ? asked++ === 0 : point.kind === "yield" ? choice : "normal" }); };
  // Resumption continues the loop: the increment runs, the condition is asked again, the body returns.
  const resumed = exit("resume");
  assert.equal(resumed.end, "return");
  assert.ok(incremented(resumed) >= 1);
  // The consumer finishing leaves at once: nothing of the loop runs after the yield.
  const finished = exit("return");
  assert.equal(finished.end, "return");
  assert.equal(incremented(finished), 0);
  assert.deepEqual(labelled(program, nodesOn(finished)), ["yield i"]);
  assert.equal(exit("unwind").end, "unwind");
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
  test(`WT-10 read (${policy.bounds}/${policy.absent}): every narrowed use and every index carries its check`, () => {
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
  assert.throws(() => lowerToMir(deps, programs.broken.tir, []), defectOfLowerMir);
  assert.throws(() => lowerToMir(deps, programs.deferred.tir, []), defectOfLowerMir);
  // Part 7, the other caller defects: "an initializer execution with no supplied body data" (WT-4 `f` without the
  // data of its two defaults) and "a node kind the admitted vocabulary excludes".
  assert.throws(() => lowerToMir(deps, wt4().f.tir, []), defectOfLowerMir);
  assert.throws(() => lowerToMir(deps, excluded().program.tir, []), defectOfLowerMir);
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

// ---- clauses that had no case (R1 section 5) and the activation ruling ---------------------------

test("an operation that can fail is a control point with the selected failure kind; a pure one is a statement", () => {
  // R1, R2, R12; COMMON-DATA §3 Operation. `try { return a / b; } catch { return 0; }` with `/` selected three ways.
  const { unwinding, aborting, pure } = quotients();
  const failing = { decide: point => point.kind === "invoke" ? "unwind" : "normal" };
  let mir = lower(unwinding);
  assert.deepEqual(at(mir, unwinding.at("a/b")).map(point => [point.kind, point.failure]), [["invoke", "handler"]]);
  assert.equal(walk(mir, failing).end, "return");
  mir = lower(aborting);
  assert.deepEqual(at(mir, aborting.at("a/b")).map(point => [point.kind, point.failure]), [["invoke", "abort"]]);
  assert.equal(walk(mir, failing).end, "abort");
  mir = lower(pure);
  assert.deepEqual(at(mir, pure.at("a/b")), []);
  assert.equal(statementsOn(walk(mir)).filter(item => valueKindOf(item) === "binary" && item.node === pure.at("a/b")).length, 1);
});

test("a required parameter before a default: entries for the counts 2 and 1, none for 0", () => {
  const { program, internal, B_DEFAULT } = scaled();
  const mir = lower(program, internal);
  // R7: one entry per admissible count of supplied fixed arguments. `scaled(a, b = 2)` cannot be called with none.
  assert.deepEqual(providedCountsOf(mir), [2, 1]);
  const defaults = provided => internalCallsOn(walk(mir, { entry: providedCountsOf(mir).indexOf(provided) })).map(calleeNameOf);
  assert.deepEqual(defaults(2), []);
  assert.deepEqual(defaults(1), [B_DEFAULT]);
});

test("a return out of an iteration passes through its finish step once", () => {
  const { program } = firstZero();
  const mir = lower(program);
  // R6: every transfer out of a scope passes through each enclosing cleanup once. One element, equal to 0.
  const path = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : isCompletionBranch(point) ? false : true });
  assert.equal(path.end, "return");
  const steps = path.events.filter(item => item.statement === null && item.node === program.at("for") && item.step !== null && item.kind === "invoke");
  assert.equal(steps.filter(item => namesStep(item, ARRAY_STEP.next)).length, 1);
  assert.equal(steps.filter(item => namesStep(item, ARRAY_STEP.finish)).length, 1);
  assert.equal(namesStep(steps.at(-1), ARRAY_STEP.finish), true);
});

test("deep nesting lowers without native recursion in proportion to it", () => {
  // Section 7 part 7. 20000 nested parentheses around a literal.
  const mir = lower(deep(20000).program);
  assert.equal(walk(mir).end, "return");
  assert.deepEqual(effects(mir), []);
});

test("activation: the caller records creation, mode and drive; nothing in its graph stands for the callee's activation", () => {
  const { program } = handles();
  const mir = lower(program);
  // K-3239 item 4: one canonical event, the first entry of the callee's execution, per actual handle activation. The
  // caller records the selected mode and the connection, and never a second activation event.
  const creation = label => at(mir, program.at(label), "call");
  const loop = program.at("for v");
  // Two outer iterations, each driving its handle to one value and then to completion.
  const outer = [true, true, false];
  const inner = [false, true, false, true];
  const path = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : isCompletionBranch(point) ? inner.shift() : outer.shift() });
  assert.equal(path.end, "return");
  // Distinct handles from the same creation site: one record, executed once per handle.
  assert.equal(creation("gen()#loop").length, 1);
  assert.equal(path.events.filter(item => item.statement === null && item.kind === "call" && item.node === program.at("gen()#loop")).length, 2);
  assert.equal(activationOf(creation("gen()#loop")[0]), ACTIVATION.whenFirstDriven);
  // First drive, repeated drive: one `next` record, a call of the handle's member, run once per drive (two per handle).
  const drives = path.events.filter(item => item.statement === null && item.node === loop && namesStep(item, GENERATOR_STEP.next));
  assert.equal(drives.length, 4);
  assert.equal(new Set(drives.map(item => item.block)).size, 1);
  assert.equal(drives[0].kind, "call");
  // An entry that throws under the deferred mode surfaces at the drive, which is not inside the `try`.
  assert.equal(drives[0].failure, "escape");
  // A handle never driven: its creation is one record and nothing reads the handle.
  assert.equal(creation("gen()#idle").length, 1);
  assert.deepEqual(recordsOf(mir).filter(item => readsLocal(mir, item, sourceLocal(mir, 4))), []);
  // Immediate mode: one creating call that carries the mode; an entry that throws unwinds it into the handler.
  assert.equal(creation("fetched(1)").length, 1);
  assert.equal(activationOf(creation("fetched(1)")[0]), ACTIVATION.atCreation);
  assert.equal(creation("fetched(1)")[0].failure, "handler");
  // Nothing in this graph stands for an activation: no call of a body, no suspension, and no step outside the loop's node.
  assert.deepEqual(recordsOf(mir).filter(isInternalCall), []);
  assert.deepEqual(effects(mir).filter(point => point.kind === "await" || point.kind === "yield" || point.kind === "delegate"), []);
  assert.equal(recordsOf(mir).filter(item => item.step !== null).every(item => item.node === loop), true);
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
