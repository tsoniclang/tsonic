import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { after, before, test } from "node:test";
import { Session } from "node:inspector";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { T, TABLE, EMPTY_BINDINGS, selected, verificationContext, application, SIG } from "./fixtures/lower-mir/typed.mjs";
import { shaped } from "./fixtures/lower-mir/programs/first.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index", "machine", "budget", "pause"].map(name => resolve(repository, `packages/host/dist/evaluate/${name}.js`));
const limits = { maximumSteps: 100, maximumIntermediateBits: 256, maximumResultBits: 256, maximumArithmeticWork: 256 };
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) =>
  session.post(method, parameters, (error, value) => error === null ? done(value) : reject(error)));
let product;
let lower;
let mir;
let types;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "aggregate process-group admission is required");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import("../../packages/host/dist/evaluate/index.js");
  lower = await import("../../packages/host/dist/lower-mir/index.js");
  mir = await import("../../packages/host/dist/ir-mir/index.js");
  types = await import("../../packages/host/dist/ir-types/index.js");
});

function same(actual, expected, label) {
  assert.equal(isDeepStrictEqual(actual, expected), true, label);
}

function fixture(name, type = T.bool, makeRoot = b => b.block(b.returns(b.keyword("TrueKeyword", T.bool))), rows = []) {
  const program = shaped(name, rows, type, makeRoot);
  program.tir = { ...program.tir, bindings: { kind: "instantiated", bindings: EMPTY_BINDINGS } };
  const interner = types.seedTypeInterner(TABLE);
  const views = { typeOf: type => types.readType(interner, type), signatureOf: signature => types.readSignature(interner, signature) };
  const unit = { query: "constValue", key: [name, "compile-time"] };
  const produced = lower.lowerToMir({ ...views, limits: { maximumRecords: 10000 },
    defs: { completionSelector: T.int32, exceptionStorage: T.unknown }, unit: { request: unit, position: { kind: "result" } } }, program.tir, []);
  assert.equal(produced.kind, "ok", "the real LowerMir producer completed");
  const parsed = mir.parseMir(mir.printMir(produced.value));
  assert.equal(parsed.kind, "parsed", "the actual MIR codec completed");
  const checked = mir.verifyMir(parsed.value, verificationContext(program));
  same(checked, { kind: "complete", violations: [] }, "the actual selected typed-body/MIR barrier completed");
  const body = parsed.value;
  const deps = { ...views, limits };
  const entry = { body: body.body, bindings: body.bindings };
  return { body, deps, entry, unit, start: (selected = limits) => product.evaluate({ ...deps, limits: selected }, entry, body, [], "compile-time", unit) };
}

test("real lowered and verified literal returns the exact typed value", () => {
  const value = fixture("evaluate-literal");
  same(value.start(), { kind: "done", value: { kind: "ok", value: { kind: "value", value: { kind: "boolean", value: true, type: T.bool } },
    diagnostics: [], positions: [{ position: { kind: "result" }, error: null }], emissions: [] } }, "exact native boolean and semantic result position");
});

test("every limit rejects malformed counts, including negative zero, before an input body is read", () => {
  for (const field of Object.keys(limits)) {
    for (const malformed of [-0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      let bodyReads = 0;
      const body = { get body() { bodyReads += 1; throw new Error("body read before limits"); } };
      assert.throws(() => product.evaluate({ limits: { ...limits, [field]: malformed } }, {}, body, [], "compile-time", { query: "constValue", key: [] }), TypeError);
      assert.equal(bodyReads, 0, `${field} rejects malformed count before actual execution`);
    }
  }
});

test("literal steps and exact intermediate/result sizes obey zero, exact and one-under", () => {
  const value = fixture("evaluate-budget");
  for (const [field, required] of [["maximumSteps", 1], ["maximumIntermediateBits", 1], ["maximumResultBits", 1]]) {
    for (let maximum = 0; maximum <= required; maximum += 1) {
      const result = value.start({ ...limits, [field]: maximum, maximumArithmeticWork: 0 });
      assert.equal(result.kind, "done");
      assert.equal(result.value.kind, maximum < required ? "refused" : "ok", `${field}:${maximum}`);
      if (maximum < required) {
        assert.equal(result.value.diagnostics.length, 1);
        const diagnostic = result.value.diagnostics[0];
        same(diagnostic.arguments, [{ kind: "text", value: `evaluation.${field}` }, { kind: "number", value: maximum }], "the original named limit and exact maximum are retained");
      }
    }
  }
});

test("intermediate and result limits count the exact rational transport without JS-number conversion", () => {
  const value = fixture("evaluate-rational-size", T.int32, b => b.block(b.returns(b.num("7", T.int32))));
  for (const field of ["maximumIntermediateBits", "maximumResultBits"]) {
    for (let maximum = 0; maximum <= 4; maximum += 1) {
      const result = value.start({ ...limits, [field]: maximum, maximumArithmeticWork: 0 });
      assert.equal(result.kind, "done");
      assert.equal(result.value.kind, maximum < 4 ? "refused" : "ok", `${field}:${maximum}`);
      if (maximum === 4) same(result.value.value.value, { kind: "number", type: T.int32,
        value: { numerator: 7n, denominator: 1n, negativeZero: false } }, "three numerator bits and one denominator bit; no authored token leaks into ConstValue");
    }
  }
});

test("zero-size absence requires no arithmetic or scalar bits but still costs its real execution step", () => {
  const value = fixture("evaluate-absence", T.void, b => b.block(b.returns(null)));
  const result = value.start({ maximumSteps: 1, maximumIntermediateBits: 0, maximumResultBits: 0, maximumArithmeticWork: 0 });
  assert.equal(result.kind, "done");
  assert.equal(result.value.kind, "ok");
  same(result.value.value, { kind: "value", value: { kind: "absence", type: T.void } }, "one native absence state");
});

test("selected boolean work refuses at every under-limit allowance and completes at exact work", () => {
  const decision = selected({ kind: "boolean-operator", operator: "===" }, [T.bool, T.bool], T.bool);
  const value = fixture("evaluate-boolean-work", T.bool, b => b.block(b.returns(
    b.comparison(b.keyword("TrueKeyword", T.bool), "EqualsEqualsEqualsToken", b.keyword("FalseKeyword", T.bool), decision))));
  for (let maximum = 0; maximum <= 2; maximum += 1) {
    const result = value.start({ ...limits, maximumArithmeticWork: maximum });
    assert.equal(result.kind, "done");
    assert.equal(result.value.kind, maximum < 2 ? "refused" : "ok", `actual two-operand work:${maximum}`);
    if (maximum < 2) same(result.value.diagnostics[0].arguments,
      [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }], "arithmetic is the first exhausted dimension");
    else same(result.value.value, { kind: "value", value: { kind: "boolean", value: false, type: T.bool } }, "actual selected boolean relation");
  }
});

test("every closed boolean relation and absence relation uses its selected law and exact operand work", () => {
  for (const [operator, expected] of [["&&", false], ["||", true], ["==", false], ["!=", true], ["===", false], ["!==", true]]) {
    const decision = selected({ kind: "boolean-operator", operator }, [T.bool, T.bool], T.bool);
    const value = fixture(`evaluate-boolean-${operator}`, T.bool, b => b.block(b.returns(
      b.comparison(b.keyword("TrueKeyword", T.bool), "EqualsEqualsEqualsToken", b.keyword("FalseKeyword", T.bool), decision))));
    const result = value.start({ ...limits, maximumArithmeticWork: 2 });
    same(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: expected } }, operator);
  }
  const not = selected({ kind: "boolean-operator", operator: "!" }, [T.bool], T.bool);
  const unary = fixture("evaluate-not", T.bool, b => b.block(b.returns(b.prefix(b.keyword("FalseKeyword", T.bool), "ExclamationToken", T.bool, not))));
  same(unary.start({ ...limits, maximumArithmeticWork: 1 }).value.value,
    { kind: "value", value: { kind: "boolean", type: T.bool, value: true } }, "actual unary boolean negation");
  for (const negated of [false, true]) {
    const decision = selected({ kind: "absence-test", negated }, [T.absence], T.bool);
    const value = fixture(`evaluate-absence-${negated}`, T.bool, b => b.block(b.returns(
      b.prefix(b.keyword("NullKeyword", T.absence), "ExclamationToken", T.bool, decision))));
    same(value.start({ ...limits, maximumArithmeticWork: 1 }).value.value,
      { kind: "value", value: { kind: "boolean", type: T.bool, value: !negated } }, "one native absence relation");
    const refused = value.start({ ...limits, maximumIntermediateBits: 0 });
    assert.equal(refused.value.kind, "refused", "zero-sized absence fits but the selected one-bit result must be precharged");
  }
});

function requestFixture(name, constant, type = T.bool) {
  const value = fixture(name, type, b => b.block(b.returns(type === T.bool ? b.keyword("TrueKeyword", T.bool) : b.num("1", type))));
  const body = { ...value.body, constants: value.body.constants.map(record => ({ ...record, value: constant })) };
  const parsed = mir.parseMir(mir.printMir(body));
  assert.equal(parsed.kind, "parsed", "constructed request-protocol MIR round trips; not a claimed Source geometry producer");
  return { ...value, body: parsed.value,
    begin: () => product.evaluate(value.deps, value.entry, parsed.value, [], "compile-time", value.unit) };
}

function answerUnit(query, position = { kind: "result" }) {
  return { request: { query, key: ["actual-dependent-unit"] }, position };
}

test("a constant pause retains its own context, exact caller witness and original dependency error", () => {
  const reference = { initializer: fixture("evaluate-nested-target").entry, context: "enum-member" };
  const value = requestFixture("evaluate-own-context", { kind: "constant", reference });
  const paused = value.begin();
  assert.equal(paused.kind, "paused");
  same(paused.requests, [{ kind: "const-value", reference }], "target owns enum-member context, caller is compile-time");
  same(paused.paused.witness.instance, value.entry, "the caller, not the target initializer");
  assert.equal(paused.paused.witness.site.tir.body, value.entry.body);
  assert.equal(paused.paused.witness.ready.count, 0);
  assert.equal(paused.paused.witness.request, paused.requests[0], "one actual pending relation");
  const unit = answerUnit("constValue");
  const identity = { kind: "host", unit, code: "TSONIC_CONSTANT_EVALUATION_FAILED" };
  const error = { kind: "error", causes: [{ kind: "diagnostic", diagnostic: identity }] };
  const result = product.resumeEvaluate(value.deps, paused.paused, [{ kind: "const-value", unit,
    value: { value: { kind: "value", value: { kind: "error", type: T.bool } }, positions: [{ position: unit.position, error }] } }]);
  assert.equal(result.kind, "done");
  assert.equal(result.value.kind, "ok");
  same(result.value.positions, [{ position: { kind: "result" }, error: { kind: "error", causes: [{ kind: "unit", unit }] } }], "original dependency unit, not a replacement diagnostic");
  same(result.value.diagnostics, [], "absorbing emits nothing");
  same(result.value.emissions, [], "no duplicated original emission");
  assert.throws(() => product.resumeEvaluate(value.deps, paused.paused, []), /unconsumed pause exactly once/u);
});

test("not-constant remains an honest outcome with its actual nested witness", () => {
  const target = fixture("evaluate-notconstant-target").entry;
  const value = requestFixture("evaluate-notconstant", { kind: "constant", reference: { initializer: target, context: "fixed-array-extent" } });
  const paused = value.begin();
  const outcome = { kind: "not-constant", at: { body: target.body, node: 1 }, reason: "external-operation" };
  const result = product.resumeEvaluate(value.deps, paused.paused, [{ kind: "const-value", unit: answerUnit("constValue"),
    value: { value: outcome, positions: [{ position: { kind: "result" }, error: null }] } }]);
  assert.equal(result.kind, "done");
  same(result.value.value, outcome, "no fake value, context diagnostic or replacement occurrence");
  same(result.value.emissions, [], "demanding owner retains context diagnostic responsibility");
});

test("successful constant resumption continues exactly once and rejects a different selected result type", () => {
  const target = fixture("evaluate-success-target").entry;
  const value = requestFixture("evaluate-success", { kind: "constant", reference: { initializer: target, context: "enum-member" } });
  const paused = value.begin();
  const prefix = paused.paused.witness.ready;
  const unit = answerUnit("constValue", { kind: "component", path: ["actual-result"] });
  const answer = type => ({ kind: "const-value", unit, value: {
    value: { kind: "value", value: { kind: "boolean", value: false, type } },
    positions: [{ position: { kind: "result" }, error: { kind: "error", causes: [] } }, { position: unit.position, error: null }],
  } });
  const result = product.resumeEvaluate(value.deps, paused.paused, [answer(T.bool)]);
  assert.equal(result.kind, "done");
  same(result.value.value, { kind: "value", value: { kind: "boolean", value: false, type: T.bool } }, "the actual result position is selected, not first record");
  assert.equal(prefix.count, 0, "the saved pending operand prefix remains the same earlier prefix");
  const mismatch = value.begin();
  assert.throws(() => product.resumeEvaluate(value.deps, mismatch.paused, [answer(T.int32)]), /actual selected result type/u);
});

test("resume rejects forged, mismatched and consumed continuations without any answer callback", () => {
  const value = requestFixture("evaluate-forged", { kind: "observation", at: { body: fixture("evaluate-forged").entry.body, node: 1 } });
  assert.throws(() => product.resumeEvaluate(value.deps, { continuation: {}, witness: {} }, []), /unconsumed pause/u);
  const wrongViews = value.begin();
  assert.throws(() => product.resumeEvaluate({ ...value.deps }, wrongViews.paused, []), /same actual run views/u);
  const wrongWitness = value.begin();
  assert.throws(() => product.resumeEvaluate(value.deps, { ...wrongWitness.paused,
    witness: { ...wrongWitness.paused.witness, type: T.int32 } }, []), /immutable pending witness/u);
  const wrongAnswer = value.begin();
  assert.throws(() => product.resumeEvaluate(value.deps, wrongAnswer.paused, [{ kind: "const-value" }]), /exactly the answer/u);
  const missingPosition = value.begin();
  assert.throws(() => product.resumeEvaluate(value.deps, missingPosition.paused,
    [{ kind: "observation-value", unit: answerUnit("observationsOf"), value: { value: { kind: "value", value: 8n }, positions: [] } }]), /actual result position/u);
});

test("actual unwritten storage error is distinct from unavailable incoming capture and external storage", () => {
  const value = fixture("evaluate-storage");
  const site = value.body.blocks[0].terminator;
  const make = (role, mode, statements = []) => ({ ...value.body,
    locals: [{ id: 0, role, mode, storage: T.bool, source: role.kind === "capture" ? { body: value.body.body, local: 0 } : null, origin: site.origin }],
    places: [{ id: 0, base: { kind: "local", local: 0 }, storage: T.bool, origin: site.origin }],
    blocks: [{ ...value.body.blocks[0], statements, terminator: { ...site, kind: "return", value: { kind: "place", place: 0 } } }] });
  const execute = body => product.evaluate(value.deps, value.entry, body, [], "compile-time", value.unit);
  const unwritten = execute(make({ kind: "user" }, "local", [{ ...site, kind: "storage-live", local: 0 }]));
  assert.equal(unwritten.kind, "done");
  assert.equal(unwritten.value.kind, "ok");
  assert.equal(unwritten.value.value.value.kind, "error");
  assert.equal(unwritten.value.emissions.length, 1);
  assert.equal(unwritten.value.diagnostics[0], unwritten.value.emissions[0].diagnostic, "one actual owned diagnostic object");
  same(unwritten.value.positions[0].error.causes,
    [{ kind: "diagnostic", diagnostic: unwritten.value.emissions[0].identity }], "actual UnitRef/DiagnosticIdentity annotations carry the original fault");
  assert.throws(() => execute(make({ kind: "capture", index: 0 }, "captured-value")), /actual selected incoming receiver or captured value/u);
  const external = execute(make({ kind: "capture", index: 0 }, "captured-location"));
  assert.equal(external.kind, "done");
  same(external.value.value, { kind: "not-constant", at: site.tir, reason: "external-storage" }, "no fake unwritten-source error for external storage");
  same(external.value.diagnostics, [], "the demanding context owns its own not-constant diagnostic");
});

function internalCall(caller, child, captures = []) {
  const block = caller.body.blocks[0];
  const site = block.terminator;
  const body = { ...caller.body, locals: [{ id: 0, role: { kind: "temporary" }, mode: "local", storage: caller.body.result, source: null, origin: site.origin }],
    places: [{ id: 0, base: { kind: "local", local: 0 }, storage: caller.body.result, origin: site.origin }],
    blocks: [{ ...block, terminator: { ...site, kind: "call", callee: { kind: "body", instance: child.entry, captures }, receiver: null,
      arguments: [], destination: 0, next: 1, unwind: { kind: "escape" }, step: null } },
    { ...block, id: 1, statements: [], terminator: { ...site, kind: "return", value: { kind: "place", place: 0 } } }] };
  const parsed = mir.parseMir(mir.printMir(body));
  assert.equal(parsed.kind, "parsed", "constructed frame-protocol fixture uses the actual closed MIR codec");
  return { ...caller, body: parsed.value, begin: (selected = limits) => product.evaluate({ ...caller.deps, limits: selected }, caller.entry, parsed.value, [], "compile-time", caller.unit) };
}

test("actual callee acquisition retains caller witness and resumes a child observation in its own complete instance", () => {
  const caller = fixture("evaluate-caller", T.int32, b => b.block(b.returns(b.num("1", T.int32))));
  const child = fixture("evaluate-child", T.int32, b => b.block(b.returns(b.num("1", T.int32))));
  const childSite = child.body.blocks[0].terminator;
  child.body = { ...child.body, constants: child.body.constants.map(record => ({ ...record,
    value: { kind: "observation", at: childSite.tir } })) };
  const call = internalCall(caller, child);
  const deps = call.deps;
  const paused = product.evaluate(deps, call.entry, call.body, [], "compile-time", call.unit);
  assert.equal(paused.kind, "paused");
  same(paused.requests, [{ kind: "mir-body", instance: child.entry }], "actual callee instance, never the root or template");
  same(paused.paused.witness.instance, caller.entry, "body acquisition originates in the caller frame");
  const observed = product.resumeEvaluate(deps, paused.paused, [{ kind: "mir-body", body: child.body }]);
  assert.equal(observed.kind, "paused");
  same(observed.requests, [{ kind: "observation-value", instance: child.entry, at: childSite.tir }], "the observation originates in the executing child");
  same(observed.paused.witness.instance, child.entry, "child frame witness survives the second pause");
  const result = product.resumeEvaluate(deps, observed.paused,
    [{ kind: "observation-value", unit: answerUnit("observationsOf"), value: { value: { kind: "value", value: 1n }, positions: [{ position: { kind: "result" }, error: null }] } }]);
  assert.equal(result.kind, "done");
  same(result.value.value.value, { kind: "number", type: T.int32, value: { numerator: 1n, denominator: 1n, negativeZero: false } },
    "the protocol transports the exact answer without converting through JS number; no native-fit claim");
});

test("one cumulative step account covers both frames and no completed prefix is replayed", () => {
  const caller = fixture("evaluate-call-budget");
  const child = fixture("evaluate-call-budget-child", T.bool, b => b.block(b.returns(b.keyword("FalseKeyword", T.bool))));
  const call = internalCall(caller, child);
  for (let maximum = 0; maximum <= 3; maximum += 1) {
    const deps = { ...call.deps, limits: { ...limits, maximumSteps: maximum } };
    let result = product.evaluate(deps, call.entry, call.body, [], "compile-time", call.unit);
    if (maximum === 0) assert.equal(result.kind, "done", "zero steps refuses before a callee request");
    else {
      assert.equal(result.kind, "paused");
      result = product.resumeEvaluate(deps, result.paused, [{ kind: "mir-body", body: child.body }]);
    }
    assert.equal(result.kind, "done");
    assert.equal(result.value.kind, maximum < 3 ? "refused" : "ok", `two returns and one call:${maximum}`);
    if (maximum === 3) same(result.value.value, { kind: "value", value: { kind: "boolean", value: false, type: T.bool } }, "child returned into actual caller destination");
  }
  const wrong = product.evaluate(call.deps, call.entry, call.body, [], "compile-time", call.unit);
  assert.throws(() => product.resumeEvaluate(call.deps, wrong.paused, [{ kind: "mir-body", body: caller.body }]), /exact requested complete callee/u);
});

test("boolean switch selects its literal edge and otherwise without a truthiness or numeric fallback", () => {
  const value = fixture("evaluate-switch");
  const site = value.body.blocks[0].terminator;
  const block = value.body.blocks[0];
  const body = { ...value.body, constants: [
    { id: 0, type: T.bool, value: { kind: "literal", value: { kind: "boolean", value: true } } },
    { id: 1, type: T.bool, value: { kind: "literal", value: { kind: "boolean", value: false } } }],
    blocks: [{ ...block, terminator: { ...site, kind: "switch", operand: { kind: "constant", constant: 0 }, targets: [{ constant: 0, target: 1 }], otherwise: 2, step: null } },
      { ...block, id: 1, terminator: { ...site, kind: "return", value: { kind: "constant", constant: 1 } } },
      { ...block, id: 2 }] };
  for (const [discriminant, expected] of [[0, false], [1, true]]) {
    const selected = { ...body, blocks: body.blocks.map(block => block.id === 0
      ? { ...block, terminator: { ...block.terminator, operand: { kind: "constant", constant: discriminant } } } : block) };
    const result = product.evaluate(value.deps, value.entry, selected, [], "compile-time", value.unit);
    assert.equal(result.kind, "done");
    same(result.value.value, { kind: "value", value: { kind: "boolean", value: expected, type: T.bool } }, "actual selected edge");
  }
  for (const maximum of [0, 1, 2]) {
    const result = product.evaluate({ ...value.deps, limits: { ...limits, maximumArithmeticWork: maximum } }, value.entry, body, [], "compile-time", value.unit);
    assert.equal(result.value.kind, maximum < 2 ? "refused" : "ok", `one actual two-operand discriminant comparison:${maximum}`);
  }
});

test("an observation error preserves the exact source cause without a fabricated geometry value", () => {
  const value = fixture("evaluate-observation-error", T.int32, b => b.block(b.returns(b.num("1", T.int32))));
  const site = value.body.blocks[0].terminator;
  const body = { ...value.body, constants: value.body.constants.map(record => ({ ...record, value: { kind: "observation", at: site.tir } })) };
  const begin = () => product.evaluate(value.deps, value.entry, body, [], "compile-time", value.unit);
  const unit = answerUnit("observationsOf");
  const diagnostic = { kind: "host", unit, code: "TSONIC_INVALID_LAYOUT" };
  const error = { kind: "error", causes: [{ kind: "diagnostic", diagnostic }] };
  const paused = begin();
  const result = product.resumeEvaluate(value.deps, paused.paused, [{ kind: "observation-value", unit,
    value: { value: { kind: "error" }, positions: [{ position: unit.position, error }] } }]);
  same(result.value.positions[0].error, { kind: "error", causes: [{ kind: "unit", unit }] }, "transport names the original semantic producer");
  same(result.value.emissions, [], "no repeated Layout diagnostic");
  const malformed = begin();
  assert.throws(() => product.resumeEvaluate(value.deps, malformed.paused, [{ kind: "observation-value", unit,
    value: { value: { kind: "error" }, positions: [{ position: unit.position, error: null }] } }]), /actual original error position/u);
});

test("selected by-value and borrowed scalar argument cells preserve actual storage ownership", () => {
  for (const passing of ["by-value", "byref-readwrite"]) {
    const name = `evaluate-parameter-${passing}`;
    const child = fixture(name, T.bool, b => b.block(b.returns(b.id("argument", 0, T.bool))), [["argument", "required", T.bool, passing]]);
    const caller = fixture(`${name}-caller`);
    const bridge = internalCall(caller, child);
    const call = bridge.body.blocks[0].terminator;
    const rootSite = call;
    const childSite = child.body.blocks[0].terminator;
    const local = { ...child.body.locals[0] };
    const childPlace = child.body.places.find(place => place.base.kind === "local" && place.base.local === local.id);
    assert.notEqual(childPlace, undefined);
    const childBody = { ...child.body, constants: [{ id: 0, type: T.bool, value: { kind: "literal", value: { kind: "boolean", value: false } } }],
      blocks: [{ ...child.body.blocks[0], statements: [{ ...childSite, kind: "assign", place: childPlace.id,
        value: { kind: "use", operand: { kind: "constant", constant: 0 } } }], terminator: childSite }] };
    const decision = application(name, SIG[name], [{ kind: "argument", parameter: 0, argument: 0, component: null, passing }], T.bool);
    const body = { ...bridge.body, locals: [{ id: 0, role: { kind: "user" }, mode: "local", storage: T.bool, source: null, origin: call.origin }],
      blocks: [{ ...bridge.body.blocks[0], statements: [{ ...rootSite, kind: "assign", place: 0,
        value: { kind: "use", operand: { kind: "constant", constant: 0 } } }], terminator: { ...call, destination: null,
          callee: { kind: "direct", resolution: { decision, activation: child.entry } },
          arguments: [passing === "by-value" ? { kind: "value", passing, operand: { kind: "place", place: 0 } } : { kind: "place", passing, place: 0 }] } }, bridge.body.blocks[1]] };
    const paused = product.evaluate(bridge.deps, bridge.entry, body, [], "compile-time", bridge.unit);
    assert.equal(paused.kind, "paused");
    const result = product.resumeEvaluate(bridge.deps, paused.paused, [{ kind: "mir-body", body: childBody }]);
    assert.equal(result.kind, "done");
    same(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: passing === "by-value" } },
      "the selected value copy cannot mutate the caller; the selected borrowed cell can");
  }
});

test("creating captured-value versus captured-location selects a snapshot versus the same actual cell", () => {
  for (const capture of ["captured-value", "captured-location"]) {
    const caller = fixture(`evaluate-${capture}-creator`);
    const child = fixture(`evaluate-${capture}-child`, T.bool, b => b.block(b.returns(b.keyword("FalseKeyword", T.bool))));
    const source = { body: caller.entry.body, local: 0 };
    const bridge = internalCall(caller, child, [{ local: source, place: 0, capture }]);
    const call = bridge.body.blocks[0].terminator;
    const childSite = child.body.blocks[0].terminator;
    const childBody = { ...child.body, locals: [{ id: 0, role: { kind: "capture", index: 0 }, mode: capture, storage: T.bool, source, origin: childSite.origin }],
      places: [{ id: 0, base: { kind: "local", local: 0 }, storage: T.bool, origin: childSite.origin }],
      blocks: [{ ...child.body.blocks[0], statements: [{ ...childSite, kind: "assign", place: 0,
        value: { kind: "use", operand: { kind: "constant", constant: 0 } } }] }] };
    const body = { ...bridge.body, locals: [{ ...bridge.body.locals[0], role: { kind: "user" }, source }],
      blocks: [{ ...bridge.body.blocks[0], statements: [{ ...call, kind: "assign", place: 0,
        value: { kind: "use", operand: { kind: "constant", constant: 0 } } }], terminator: { ...call, destination: null } }, bridge.body.blocks[1]] };
    const paused = product.evaluate(bridge.deps, bridge.entry, body, [], "compile-time", bridge.unit);
    assert.equal(paused.kind, "paused");
    const result = product.resumeEvaluate(bridge.deps, paused.paused, [{ kind: "mir-body", body: childBody }]);
    assert.equal(result.kind, "done");
    same(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: capture === "captured-value" } },
      "same selected creator local and cell; only the actual capture decision changes ownership");
  }
});

test("a thrown scalar is caught by its actual caller handler or yields exactly one original owned fault", () => {
  const caller = fixture("evaluate-catches");
  const child = fixture("evaluate-throws");
  const bridge = internalCall(caller, child);
  const site = child.body.blocks[0].terminator;
  const childBody = { ...child.body, blocks: [{ ...child.body.blocks[0], terminator: { ...site, kind: "throw",
    operand: site.value, unwind: { kind: "escape" } } }] };
  for (const failure of [{ kind: "handler", exception: 0, target: 1 }, { kind: "escape" }, { kind: "abort" }, { kind: "none" }]) {
    const body = { ...bridge.body, blocks: bridge.body.blocks.map(block => block.id === 0
      ? { ...block, terminator: { ...block.terminator, unwind: failure } } : block) };
    const paused = product.evaluate(bridge.deps, bridge.entry, body, [], "compile-time", bridge.unit);
    assert.equal(paused.kind, "paused");
    if (failure.kind === "none") {
      assert.throws(() => product.resumeEvaluate(bridge.deps, paused.paused, [{ kind: "mir-body", body: childBody }]), /unable to fail/u);
      continue;
    }
    const result = product.resumeEvaluate(bridge.deps, paused.paused, [{ kind: "mir-body", body: childBody }]);
    assert.equal(result.kind, "done");
    assert.equal(result.value.kind, "ok");
    if (failure.kind === "handler") {
      same(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: true } }, "the same thrown value reaches the real handler cell");
      same(result.value.diagnostics, [], "a caught throw is ordinary execution");
    } else {
      assert.equal(result.value.value.value.kind, "error");
      assert.equal(result.value.diagnostics.length, 1);
      assert.equal(result.value.emissions[0].diagnostic, result.value.diagnostics[0]);
    }
  }
});

test("every closed scalar transport obeys exact bit bounds without native carrier guesses", async () => {
  const value = fixture("evaluate-closed-scalars");
  const cases = [
    [{ kind: "bigint", value: 0n, token: "0n" }, T.literalBigint, 0],
    [{ kind: "bigint", value: -8n, token: "-8n" }, T.literalBigint, 4],
    [{ kind: "string", value: "ab" }, T.string, 32],
    [{ kind: "unique-symbol", declaration: "D[M[P[p];m];selected]" }, T.unknown, 336],
    [{ kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: false }, token: "0" }, T.int32, 1],
    [{ kind: "number", value: { numerator: -8n, denominator: 1n, negativeZero: false }, token: "-8" }, T.int32, 5],
  ];
  for (const [literal, type, required] of cases) {
    const body = { ...value.body, result: type, constants: [{ ...value.body.constants[0], type, value: { kind: "literal", value: literal } }] };
    for (const field of ["maximumIntermediateBits", "maximumResultBits"]) {
      for (let maximum = 0; maximum <= required; maximum += 1) {
        const result = product.evaluate({ ...value.deps, limits: { ...limits, maximumIntermediateBits: 512, maximumResultBits: 512, [field]: maximum } }, value.entry, body, [], "compile-time", value.unit);
        assert.equal(result.kind, "done");
        assert.equal(result.value.kind, maximum < required ? "refused" : "ok", `${literal.kind}/${field}:${maximum}`);
      }
    }
  }
  const { valueFits } = await import("../../packages/host/dist/evaluate/budget.js");
  const machine = { deps: { limits: { ...limits, maximumIntermediateBits: Number.MAX_SAFE_INTEGER } }, result: null };
  assert.equal(valueFits(machine, { kind: "bigint", type: T.literalBigint, value: 1n }, "maximumIntermediateBits", value.body.blocks[0].origin), true,
    "the actual largest count boundary does not overflow a maximum+1 guard");
  assert.equal(valueFits(machine, { kind: "error", type: T.bool }, "maximumIntermediateBits", value.body.blocks[0].origin), true,
    "the internal size relation assigns no fabricated payload to an error carrier");
});

test("actual root, storage and constant invariants reject malformed selected records without fake outcomes", () => {
  const value = fixture("evaluate-boundaries");
  const block = value.body.blocks[0];
  const site = block.terminator;
  const run = body => product.evaluate(value.deps, value.entry, body, [], "compile-time", value.unit);
  const returned = operand => ({ ...value.body, blocks: [{ ...block, terminator: { ...site, value: operand } }] });
  const place = base => ({ ...returned({ kind: "place", place: 0 }), places: [{ id: 0, storage: T.bool, origin: site.origin, base }] });
  assert.throws(() => product.evaluate(value.deps, { ...value.entry, bindings: { kind: "parametric" } }, value.body, [], "compile-time", value.unit), /actual complete verified entry/u);
  assert.throws(() => run({ ...value.body, entries: [] }), /actually provided entry/u);
  assert.throws(() => run({ ...value.body, blocks: [] }), /actual block/u);
  assert.throws(() => run({ ...returned({ kind: "place", place: 0 }), places: [] }), /verified place/u);
  assert.throws(() => run(place({ kind: "local", local: 0 })), /actual local/u);
  assert.throws(() => run(returned({ kind: "constant", constant: 5 })), /verified constant operand/u);
  assert.throws(() => run(place({ kind: "projection" })), /selected storage projection/u);
  assert.throws(() => run(place({ kind: "checked", place: 0, projection: { kind: "index" } })), /selected checked projection/u);
  const external = run(place({ kind: "static" }));
  assert.equal(external.value.value.reason, "external-storage");
  const selected = value.body.constants[0];
  for (const [constant, pattern] of [
    [{ kind: "observation", at: { ...site.tir, body: "another-owner" } }, /actual executing frame/u],
    [{ kind: "metadata" }, /metadata descriptor/u],
    [{ kind: "definition" }, /initializer association/u],
  ]) assert.throws(() => run({ ...value.body, constants: [{ ...selected, value: constant }] }), pattern);
  const local = { id: 0, role: { kind: "user" }, mode: "local", storage: T.bool, source: null, origin: site.origin };
  const refined = { ...place({ kind: "checked", place: 1, projection: { kind: "refined" } }), locals: [local],
    places: [{ id: 0, base: { kind: "checked", place: 1, projection: { kind: "refined" } }, storage: T.bool, origin: site.origin },
      { id: 1, base: { kind: "local", local: 0 }, storage: T.bool, origin: site.origin }] };
  const unset = run(refined);
  assert.equal(unset.value.value.value.kind, "error", "a refined view reads the SAME underlying unwritten cell");
});

test("remaining selected execution frontiers are invariants, never substituted not-constant values", () => {
  const value = fixture("evaluate-frontiers");
  const block = value.body.blocks[0];
  const site = block.terminator;
  const run = body => product.evaluate(value.deps, value.entry, body, [], "compile-time", value.unit);
  for (const kind of ["aggregate", "address-of", "closure"]) {
    const body = { ...value.body, locals: [{ id: 0, role: { kind: "temporary" }, mode: "local", source: null, storage: T.bool, origin: site.origin }],
      places: [{ id: 0, base: { kind: "local", local: 0 }, storage: T.bool, origin: site.origin }],
      blocks: [{ ...block, statements: [{ ...site, kind: "assign", place: 0, value: { kind } }] }] };
    assert.throws(() => run(body), /selected rvalue/u, kind);
  }
  for (const kind of ["unreachable", "check"]) {
    assert.throws(() => run({ ...value.body, blocks: [{ ...block, terminator: { ...site, kind } }] }),
      kind === "unreachable" ? /unreachable/u : /selected check terminator/u);
  }
  for (const kind of ["await", "yield", "delegate"]) {
    const result = run({ ...value.body, blocks: [{ ...block, terminator: { ...site, kind } }] });
    same(result.value.value, { kind: "not-constant", at: site.tir, reason: "suspension" }, "real suspension is an actual constant-domain boundary");
  }
});

test("callee entries distinguish full and omitted fixed arguments and refuse incomplete incoming associations", () => {
  const caller = fixture("evaluate-entry-caller");
  const child = fixture("evaluate-entry-child");
  const bridge = internalCall(caller, child);
  const site = child.body.blocks[0].terminator;
  const parameter = { id: 0, role: { kind: "parameter", index: 0 }, mode: "by-value", storage: T.bool, source: null, origin: site.origin };
  const place = { id: 0, base: { kind: "local", local: 0 }, storage: T.bool, origin: site.origin };
  const target = { ...child.body, entries: [{ provided: 1, block: 0 }, { provided: 0, block: 1 }], locals: [parameter], places: [place],
    blocks: [{ ...child.body.blocks[0], terminator: { ...site, value: { kind: "place", place: 0 } } },
      { ...child.body.blocks[0], id: 1 }] };
  const selected = { ...bridge.body, blocks: bridge.body.blocks.map(block => block.id === 0
    ? { ...block, terminator: { ...block.terminator, arguments: [{ kind: "omitted" }] } } : block) };
  const begin = () => product.evaluate(bridge.deps, bridge.entry, selected, [], "compile-time", bridge.unit);
  const paused = begin();
  const result = product.resumeEvaluate(bridge.deps, paused.paused, [{ kind: "mir-body", body: target }]);
  same(result.value.value, { kind: "value", value: { kind: "boolean", value: true, type: T.bool } }, "actual provided0 selects block1, not full block0 or ordinal0");
  for (const [body, pattern] of [
    [{ ...target, entries: [] }, /full fixed-argument entry/u],
    [{ ...target, entries: [{ provided: 2, block: 0 }] }, /every fixed argument/u],
    [{ ...target, entries: [{ provided: 1, block: 0 }] }, /actually admissible provided entry/u],
    [{ ...target, locals: [{ ...parameter, role: { kind: "receiver" } }] }, /incoming storage association/u],
    [{ ...target, locals: [{ ...parameter, role: { kind: "capture", index: 0 }, source: { body: caller.entry.body, local: 9 } }] }, /incoming storage association/u],
  ]) assert.throws(() => product.resumeEvaluate(bridge.deps, begin().paused, [{ kind: "mir-body", body }]), pattern);
});

test("selected receiver mode shares the actual caller cell or copies the evaluated receiver value", () => {
  for (const mode of ["by-value", "byref-readwrite"]) {
    const caller = fixture(`evaluate-receiver-${mode}-caller`);
    const child = fixture(`evaluate-receiver-${mode}-child`, T.bool, b => b.block(b.returns(b.keyword("FalseKeyword", T.bool))));
    const bridge = internalCall(caller, child);
    const call = bridge.body.blocks[0].terminator;
    const childSite = child.body.blocks[0].terminator;
    const body = { ...bridge.body, blocks: [{ ...bridge.body.blocks[0], statements: [{ ...call, kind: "assign", place: 0,
      value: { kind: "use", operand: { kind: "constant", constant: 0 } } }],
      terminator: { ...call, receiver: { kind: "place", place: 0 }, destination: null } }, bridge.body.blocks[1]] };
    const target = { ...child.body, locals: [{ id: 0, role: { kind: "receiver" }, mode, storage: T.bool, source: null, origin: childSite.origin }],
      places: [{ id: 0, base: { kind: "local", local: 0 }, storage: T.bool, origin: childSite.origin }],
      blocks: [{ ...child.body.blocks[0], statements: [{ ...childSite, kind: "assign", place: 0,
        value: { kind: "use", operand: { kind: "constant", constant: 0 } } }] }] };
    const paused = product.evaluate(bridge.deps, bridge.entry, body, [], "compile-time", bridge.unit);
    const result = product.resumeEvaluate(bridge.deps, paused.paused, [{ kind: "mir-body", body: target }]);
    same(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: mode === "by-value" } }, "selected receiver storage is not unconditionally copied");
  }
});

test("bodyless, deferred and indirect calls keep genuine distinct boundaries and evaluate actual operands", () => {
  const caller = fixture("evaluate-call-frontiers");
  const child = fixture("evaluate-call-frontiers-child");
  const bridge = internalCall(caller, child);
  const site = bridge.body.blocks[0].terminator;
  const decision = application("evaluate-call-frontiers-child", SIG["evaluate-call-frontiers-child"], [], T.bool);
  const run = call => product.evaluate(bridge.deps, bridge.entry,
    { ...bridge.body, blocks: [{ ...bridge.body.blocks[0], terminator: { ...site, ...call } }, bridge.body.blocks[1]] }, [], "compile-time", bridge.unit);
  const external = run({ callee: { kind: "direct", resolution: { decision, activation: null } }, receiver: { kind: "constant", constant: 0 } });
  same(external.value.value, { kind: "not-constant", at: site.tir, reason: "external-operation" }, "a bodyless selected call is outside the interpreter");
  assert.throws(() => run({ callee: { kind: "direct", resolution: { decision: { ...decision, activation: "when-first-driven" }, activation: child.entry } } }), /native handle value/u);
  assert.throws(() => run({ callee: { kind: "indirect", operand: { kind: "constant", constant: 0 }, resolution: { decision, activation: child.entry } } }), /callable value/u);
  const sparse = new Array(1);
  assert.throws(() => run({ arguments: sparse }), /complete argument vector/u);
  const externalPlace = { ...bridge.body.places[0], base: { kind: "static" } };
  for (const part of ["argument", "capture", "destination"]) {
    const call = part === "argument" ? { ...site, arguments: [{ kind: "place", passing: "byref-readwrite", place: 0 }] }
      : part === "capture" ? { ...site, callee: { kind: "body", instance: child.entry, captures: [{ local: { body: caller.entry.body, local: 0 }, place: 0, capture: "captured-location" }] } } : site;
    const body = { ...bridge.body, places: [externalPlace], blocks: [{ ...bridge.body.blocks[0], terminator: call }, bridge.body.blocks[1]] };
    const result = product.evaluate(bridge.deps, bridge.entry, body, [], "compile-time", bridge.unit);
    assert.equal(result.value.value.reason, "external-storage", `${part} cannot acquire storage outside this run`);
  }
});

test("real root parameters, local lifetime and empty successor jumps retain exact step and value limits", () => {
  const value = fixture("evaluate-root-parameter", T.bool, b => b.block(b.returns(b.id("arg", 0, T.bool))), [["arg", "required", T.bool]]);
  const argument = { kind: "boolean", type: T.bool, value: false };
  for (const maximum of [0, 1]) {
    const result = product.evaluate({ ...value.deps, limits: { ...limits, maximumIntermediateBits: maximum } }, value.entry, value.body, [argument], "compile-time", value.unit);
    assert.equal(result.value.kind, maximum === 0 ? "refused" : "ok");
    if (maximum === 1) same(result.value.value.value, argument, "the actual provided argument initializes its own selected slot");
  }
  const root = fixture("evaluate-local-lifetime");
  const site = root.body.blocks[0].terminator;
  const body = { ...root.body, locals: [{ id: 0, role: { kind: "user" }, mode: "local", storage: T.bool, source: null, origin: site.origin }],
    blocks: [{ ...root.body.blocks[0], statements: [{ ...site, kind: "storage-live", local: 0 }, { ...site, kind: "storage-dead", local: 0 }],
      terminator: { ...site, kind: "goto", target: 1 } }, { ...root.body.blocks[0], id: 1 }] };
  for (let maximum = 0; maximum <= 4; maximum += 1) {
    const result = product.evaluate({ ...root.deps, limits: { ...limits, maximumSteps: maximum } }, root.entry, body, [], "compile-time", root.unit);
    assert.equal(result.value.kind, maximum < 4 ? "refused" : "ok", `two lifetime statements, goto, return:${maximum}`);
  }
});

test("invocations evaluate operands once, preserve their continuation and retain actual operation frontiers", () => {
  const value = fixture("evaluate-invoke");
  const block = value.body.blocks[0];
  const site = block.terminator;
  const boolean = operation => ({ decision: selected(operation, [T.bool], operation.kind === "discard" ? T.void : T.bool), permissionScope: null });
  const make = (operation, operands = [{ kind: "constant", constant: 0 }], destination = 0) => ({ ...value.body,
    result: operation.kind === "discard" && destination !== null ? T.void : T.bool,
    locals: [{ id: 0, role: { kind: "temporary" }, mode: "local", storage: operation.kind === "discard" ? T.void : T.bool, source: null, origin: site.origin }],
    places: [{ id: 0, base: { kind: "local", local: 0 }, storage: operation.kind === "discard" ? T.void : T.bool, origin: site.origin }],
    blocks: [{ ...block, terminator: { ...site, kind: "invoke", operation: boolean(operation), operands, destination,
      next: 1, unwind: { kind: "none" }, step: null } },
    { ...block, id: 1, terminator: { ...site, value: destination === null ? site.value : { kind: "place", place: 0 } } }] });
  const run = body => product.evaluate(value.deps, value.entry, body, [], "compile-time", value.unit);
  const not = run(make({ kind: "boolean-operator", operator: "!" }));
  same(not.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: false } }, "actual invocation writes destination then follows successor");
  const discarded = run(make({ kind: "discard" }));
  same(discarded.value.value, { kind: "value", value: { kind: "absence", type: T.void } }, "the actual discard result is native absence of the selected void type");
  assert.equal(run(make({ kind: "discard" }, [], null)).value.kind, "ok", "a resultless invocation still follows its actual successor");
  for (const kind of ["library", "core"]) {
    const result = run(make({ kind, declaration: "D[M[P[p];m];operation]", bindings: EMPTY_BINDINGS }));
    same(result.value.value, { kind: "not-constant", at: site.tir, reason: "external-operation" }, "external selected operation has no invented value");
  }
  assert.throws(() => run(make({ kind: "native-operator", operator: "+", carrier: "int32" })), /actual selected native operation law/u);
  assert.throws(() => run(make({ kind: "boolean-operator", operator: "!" }, [])), /actual operand/u);
  assert.throws(() => run(make({ kind: "boolean-operator", operator: "&&" })), /two verified boolean values/u);
  assert.throws(() => run(make({ kind: "discard" }, new Array(1))), /complete operand vector/u);
  const external = make({ kind: "discard" });
  external.places = [{ ...external.places[0], base: { kind: "static" } }];
  assert.equal(run(external).value.value.reason, "external-storage");
  const wrongType = make({ kind: "boolean-operator", operator: "!" });
  wrongType.constants = [{ ...wrongType.constants[0], value: { kind: "literal", value: { kind: "absence" } } }];
  assert.throws(() => run(wrongType), /verified boolean value/u);
});

test("absence switches and both sides of closed boolean operators keep their actual selected relations", () => {
  const value = fixture("evaluate-branch-relations");
  const block = value.body.blocks[0];
  const site = block.terminator;
  const body = { ...value.body, constants: [{ id: 0, type: T.absence, value: { kind: "literal", value: { kind: "absence" } } },
    { id: 1, type: T.bool, value: { kind: "literal", value: { kind: "boolean", value: false } } }],
    blocks: [{ ...block, terminator: { ...site, kind: "switch", operand: { kind: "constant", constant: 0 }, targets: [{ constant: 0, target: 1 }], otherwise: 2, step: null } },
      { ...block, id: 1, terminator: { ...site, value: { kind: "constant", constant: 1 } } }, { ...block, id: 2 }] };
  const run = body => product.evaluate(value.deps, value.entry, body, [], "compile-time", value.unit);
  same(run(body).value.value.value, { kind: "boolean", type: T.bool, value: false }, "native absence matches itself without a JS null/undefined tag");
  const badTarget = { ...body, blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator, targets: [{ constant: 8, target: 1 }] } }, ...body.blocks.slice(1)] };
  assert.throws(() => run(badTarget), /literal constant/u);
  const unimplemented = { ...body, constants: body.constants.map(record => record.id === 0
    ? { ...record, value: { kind: "literal", value: { kind: "string", value: "s" } } } : record) };
  assert.throws(() => run(unimplemented), /native discriminant relation/u);
  for (const operator of ["&&", "||"]) {
    const decision = selected({ kind: "boolean-operator", operator }, [T.bool, T.bool], T.bool);
    const opposite = fixture(`evaluate-opposite-${operator}`, T.bool, b => b.block(b.returns(
      b.comparison(b.keyword("FalseKeyword", T.bool), "EqualsEqualsEqualsToken", b.keyword("TrueKeyword", T.bool), decision))));
    assert.equal(opposite.start().value.value.value.value, operator === "||");
  }
  for (const negated of [false, true]) {
    const decision = selected({ kind: "absence-test", negated }, [T.bool], T.bool);
    const opposite = fixture(`evaluate-present-${negated}`, T.bool, b => b.block(b.returns(
      b.prefix(b.keyword("TrueKeyword", T.bool), "ExclamationToken", T.bool, decision))));
    assert.equal(opposite.start().value.value.value.value, negated);
  }
});

test("capture acquisition rejects undecided and unwritten values but can lend a real unwritten location", () => {
  const caller = fixture("evaluate-capture-boundaries");
  const child = fixture("evaluate-capture-boundaries-child");
  const source = { body: caller.entry.body, local: 0 };
  for (const capture of [null, "captured-value", "captured-location"]) {
    const bridge = internalCall(caller, child, [{ local: source, place: 0, capture }]);
    const begin = () => product.evaluate(bridge.deps, bridge.entry, bridge.body, [], "compile-time", bridge.unit);
    if (capture === null) assert.throws(begin, /actual capture decision/u);
    else if (capture === "captured-value") {
      const result = begin();
      assert.equal(result.kind, "done");
      assert.equal(result.value.value.value.kind, "error", "snapshotting an unwritten value is a reached source fault");
    } else {
      const paused = begin();
      assert.equal(paused.kind, "paused", "a selected location may be unwritten until its child writes it");
      const result = product.resumeEvaluate(bridge.deps, paused.paused, [{ kind: "mir-body", body: child.body }]);
      assert.equal(result.kind, "done");
      assert.equal(result.value.kind, "ok");
    }
  }
  const not = selected({ kind: "boolean-operator", operator: "!" }, [T.bool], T.bool);
  const temporary = fixture("evaluate-callee-private-temporary", T.bool,
    b => b.block(b.returns(b.prefix(b.keyword("TrueKeyword", T.bool), "ExclamationToken", T.bool, not))));
  const bridge = internalCall(caller, temporary);
  const paused = product.evaluate(bridge.deps, bridge.entry, bridge.body, [], "compile-time", bridge.unit);
  const result = product.resumeEvaluate(bridge.deps, paused.paused, [{ kind: "mir-body", body: temporary.body }]);
  assert.equal(result.value.value.value.value, false, "callee-created slots remain independent from all incoming association maps");
});

test("upstream error and private pause-state integrity never admit a fabricated successful dependency", async () => {
  const reference = { initializer: fixture("evaluate-invalid-error-target").entry, context: "compile-time" };
  const value = requestFixture("evaluate-invalid-error", { kind: "constant", reference });
  const unit = answerUnit("constValue");
  const answer = error => [{ kind: "const-value", unit,
    value: { value: { kind: "value", value: { kind: "error", type: T.bool } }, positions: [{ position: unit.position, error }] } }];
  assert.throws(() => product.resumeEvaluate(value.deps, value.begin().paused, answer({ kind: "error", causes: [] })), /original grounded cause/u);
  assert.throws(() => product.resumeEvaluate(value.deps, value.begin().paused, answer(null)), /actual unit error position/u);
  const { EvaluationSuspension } = await import("../../packages/host/dist/evaluate/pause.js");
  const rebuild = (paused, mutate) => {
    const machine = EvaluationSuspension.consume(paused.continuation);
    mutate(machine);
    return { ...paused, continuation: EvaluationSuspension.create(machine) };
  };
  const missing = rebuild(value.begin().paused, machine => { machine.pending = null; });
  assert.throws(() => product.resumeEvaluate(value.deps, missing, answer(null)), /immutable pending witness/u);
  const untyped = rebuild(value.begin().paused, machine => { machine.pending.type = null; });
  untyped.witness = { ...untyped.witness, type: null };
  assert.throws(() => product.resumeEvaluate(value.deps, untyped, answer(null)), /selected result type/u);
  const child = fixture("evaluate-missing-call-state-child");
  const bridge = internalCall(fixture("evaluate-missing-call-state"), child);
  const paused = product.evaluate(bridge.deps, bridge.entry, bridge.body, [], "compile-time", bridge.unit);
  const invalid = rebuild(paused.paused, machine => { machine.pending.call = null; });
  assert.throws(() => product.resumeEvaluate(bridge.deps, invalid, [{ kind: "mir-body", body: child.body }]), /actual pending call/u);
});

test("selected receiver/cell boundary and external exception destination retain first refusal", async () => {
  const caller = fixture("evaluate-exception-storage");
  const child = fixture("evaluate-exception-storage-child");
  const bridge = internalCall(caller, child);
  const site = child.body.blocks[0].terminator;
  const throwing = { ...child.body, blocks: [{ ...child.body.blocks[0], terminator: { ...site, kind: "throw", operand: site.value, unwind: { kind: "escape" } } }] };
  const body = { ...bridge.body, places: [{ ...bridge.body.places[0], base: { kind: "static" } }],
    blocks: [{ ...bridge.body.blocks[0], terminator: { ...bridge.body.blocks[0].terminator, destination: null,
      unwind: { kind: "handler", exception: 0, target: 1 } } }, bridge.body.blocks[1]] };
  const paused = product.evaluate(bridge.deps, bridge.entry, body, [], "compile-time", bridge.unit);
  const result = product.resumeEvaluate(bridge.deps, paused.paused, [{ kind: "mir-body", body: throwing }]);
  assert.equal(result.value.value.reason, "external-storage", "the real handler destination cannot be manufactured inside this run");
  const ready = product.evaluate(bridge.deps, bridge.entry, bridge.body, [], "compile-time", bridge.unit);
  const undecided = { ...child.body, locals: [{ id: 0, role: { kind: "receiver" }, mode: null, source: null, storage: T.bool, origin: site.origin }] };
  assert.throws(() => product.resumeEvaluate(bridge.deps, ready.paused, [{ kind: "mir-body", body: undecided }]), /complete storage mode/u);
  const { EvaluationSuspension } = await import("../../packages/host/dist/evaluate/pause.js");
  for (const external of [false, true]) {
    const target = requestFixture(`evaluate-internal-receiver-${external}`, { kind: "constant", reference: { initializer: child.entry, context: "compile-time" } });
    const pending = target.begin();
    const machine = EvaluationSuspension.consume(pending.paused.continuation);
    const frame = machine.frames[0];
    const call = { ...bridge.body.blocks[0].terminator, receiver: { kind: "place", place: 0 }, destination: null };
    frame.body = { ...frame.body, locals: bridge.body.locals,
      places: [{ ...bridge.body.places[0], base: external ? { kind: "static" } : { kind: "local", local: 0 } }] };
    frame.work = [{ kind: "call", terminator: call }];
    const rebound = { ...pending.paused, continuation: EvaluationSuspension.create(machine) };
    const answer = [{ kind: "const-value", unit: answerUnit("constValue"), value: { value: { kind: "value", value: { kind: "boolean", type: T.bool, value: true } },
      positions: [{ position: { kind: "result" }, error: null }] } }];
    const response = product.resumeEvaluate(target.deps, rebound, answer);
    assert.equal(response.kind, external ? "done" : "paused", "owning-state fixtures exercise receiver cell acquisition, not a Source composition claim");
    if (external) assert.equal(response.value.value.reason, "external-storage");
  }
});

test("an unwritten by-place formal and unavailable assignment stop before any later continuation", () => {
  const caller = fixture("evaluate-writeonly-caller");
  const childName = "evaluate-writeonly-child";
  const child = fixture(childName, T.bool, b => b.block(b.returns(b.id("arg", 0, T.bool))), [["arg", "required", T.bool, "byref-readwrite"]]);
  const bridge = internalCall(caller, child);
  const site = bridge.body.blocks[0].terminator;
  const decision = application(childName, SIG[childName], [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "byref-readwrite" }], T.bool);
  const body = { ...bridge.body, blocks: [{ ...bridge.body.blocks[0], terminator: { ...site,
    callee: { kind: "direct", resolution: { decision, activation: child.entry } }, arguments: [{ kind: "place", passing: "byref-readwrite", place: 0 }] } }, bridge.body.blocks[1]] };
  const pending = product.evaluate(bridge.deps, bridge.entry, body, [], "compile-time", bridge.unit);
  const result = product.resumeEvaluate(bridge.deps, pending.paused, [{ kind: "mir-body", body: child.body }]);
  assert.equal(result.value.value.value.kind, "error", "lending a cell does not invent its contents");
  const external = { ...bridge.body, places: [{ ...bridge.body.places[0], base: { kind: "static" } }],
    blocks: [{ ...bridge.body.blocks[0], statements: [{ ...site, kind: "assign", place: 0, value: { kind: "use", operand: { kind: "constant", constant: 0 } } }] }, bridge.body.blocks[1]] };
  assert.equal(product.evaluate(bridge.deps, bridge.entry, external, [], "compile-time", bridge.unit).value.value.reason, "external-storage");
  const block = caller.body.blocks[0];
  const malformed = { ...caller.body, constants: [{ ...caller.body.constants[0], value: { kind: "invalid-incoming-record" } }],
    blocks: [{ ...block, terminator: { ...block.terminator, kind: "switch", operand: { kind: "constant", constant: 0 }, targets: [], otherwise: 0, step: null } }] };
  assert.throws(() => product.evaluate(caller.deps, caller.entry, malformed, [], "compile-time", caller.unit), /actual discriminant/u);
  const omittedRoot = { ...child.body, entries: [{ provided: 0, block: 0 }], blocks: [{ ...child.body.blocks[0], terminator: { ...child.body.blocks[0].terminator,
    value: { kind: "constant", constant: 0 } } }], constants: caller.body.constants };
  assert.equal(product.evaluate(child.deps, child.entry, omittedRoot, [], "compile-time", child.unit).value.kind, "ok");
  const externalRoot = product.evaluate(child.deps, child.entry, child.body, [{ kind: "boolean", type: T.bool, value: true }], "compile-time", child.unit);
  assert.equal(externalRoot.value.value.reason, "external-storage", "a root scalar argument does not invent a borrowed external environment");
});

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
      project: (url, text) => ({ path: fileURLToPath(url), text }) }, runtimeFiles, [{ ...capture, result, sources }]);
    const directory = resolve(repository, ".temp/evaluate-coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(result.length, runtimeFiles.length, "every actual runtime owner has source-identified evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
  } finally { session.disconnect(); }
});
