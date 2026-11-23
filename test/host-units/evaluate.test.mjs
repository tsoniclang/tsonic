import { admitFixtureTable, insertFixtureType } from "./fixtures/types-construction.mjs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { after, before, test } from "node:test";
import { Session } from "node:inspector";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { T, TABLE, EMPTY_BINDINGS, declareType as addFixtureType, selected, verificationContext, application, SIG } from "./fixtures/lower-mir/typed.mjs";
import { shaped } from "./fixtures/lower-mir/programs/first.mjs";
import { nativeFactsFixture } from "./fixtures/native-facts.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index", "machine", "integer", "comparison", "conversions", "budget", "pause"].map(name => resolve(repository, `packages/host/dist/evaluate/${name}.js`));
const limits = { maximumSteps: 100, maximumIntermediateBits: 256, maximumResultBits: 256, maximumArithmeticWork: 256 };
const declareType = (name, term) => {
  const existing = TABLE.terms.findIndex(actual => isDeepStrictEqual(actual, term));
  return existing === -1 ? addFixtureType(name, term) : existing;
};
const comparisonTypes = ["int8", "int64", "uint64", "native-int", "native-uint"].map(carrier =>
  [carrier, declareType(`evaluationComparison.${carrier}`, { kind: "primitive", primitive: carrier })]);
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

function fixture(name, type = T.bool, makeRoot = b => b.block(b.returns(b.keyword("TrueKeyword", T.bool))), rows = [], nativeFacts = nativeFactsFixture()) {
  const program = shaped(name, rows, type, makeRoot);
  program.tir = { ...program.tir, bindings: { kind: "instantiated", bindings: EMPTY_BINDINGS } };
  const interner = admitFixtureTable(types, TABLE);
  const views = { typeOf: type => types.readType(interner, type), signatureOf: signature => types.readSignature(interner, signature) };
  const unit = { query: "constValue", key: [name, "compile-time"] };
  const produced = lower.lowerToMir({ ...views, limits: { maximumRecords: 10000 },
    defs: { completionSelector: T.int32, exceptionStorage: T.unknown }, unit: { request: unit, position: { kind: "result" } } }, program.tir, [], verificationContext(program).requiredEntries);
  assert.equal(produced.kind, "ok", "the real LowerMir producer completed");
  const parsed = mir.parseMir(mir.printMir(produced.value));
  assert.equal(parsed.kind, "parsed", "the actual MIR codec completed");
  const checked = mir.verifyMir(parsed.value, { ...verificationContext(program), selectedNativeFacts: nativeFacts });
  same(checked, { kind: "complete", violations: [] }, "the actual selected typed-body/MIR barrier completed");
  const body = parsed.value;
  const deps = { ...views, types: types.viewTypes(interner), selectedNativeFacts: nativeFacts, limits };
  const entry = { body: body.body, bindings: body.bindings };
  return { body, deps, entry, unit, start: (selected = limits) => product.evaluate({ ...deps, limits: selected }, entry, body, [], "compile-time", unit) };
}

test("real lowered and verified literal returns the exact typed value", () => {
  const value = fixture("evaluate-literal");
  same(value.start(), { kind: "done", value: { kind: "ok", value: { kind: "value", value: { kind: "boolean", value: true, type: T.bool } },
    diagnostics: [], positions: [{ position: { kind: "result" }, error: null }], emissions: [] } }, "exact native boolean and semantic result position");
});

test("a verified native Float64 literal materializes its exact direct-return bits within the original account", () => {
  const value = fixture("evaluate-native-float-literal", T.float64, builder => {
    const literal = builder.num("0", T.float64);
    return builder.block(builder.returns({ ...literal, text: "1.5",
      tsonic: { ...literal.tsonic, value: { numerator: 3n, denominator: 2n, negativeZero: false } } }));
  });
  const materialization = 1024 + 1075 + 64;
  const packing = 1 + 1 + materialization;
  const complete = packing + 2 + 2;
  for (const maximum of [0, 1, 2, packing - 1, packing, packing + 1, packing + 2, complete - 1, complete]) {
    const reads = [];
    const formats = new Proxy(value.deps.selectedNativeFacts.floatingFormats, { get(target, key, receiver) {
      if (key === "0") reads.push("format");
      return Reflect.get(target, key, receiver);
    } });
    const deps = { ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, floatingFormats: formats },
      limits: { ...limits, maximumArithmeticWork: maximum }, typeOf: type => { reads.push(type); return value.deps.typeOf(type); } };
    const actual = product.evaluate(deps, value.entry, value.body, [], "compile-time", value.unit);
    assert.deepEqual(reads, [[1, T.float64], [2, "format"], [packing + 1, T.float64], [packing + 2, "format"],
      [packing + 3, T.float64], [packing + 4, "format"]].filter(([boundary]) => boundary <= maximum).map(([, value]) => value));
    if (maximum === complete) assert.deepEqual(actual.value.value,
      { kind: "value", value: { kind: "floating", type: T.float64, bits: 0x3ff8000000000000n } });
    else {
      assert.equal(actual.value.kind, "refused");
      assert.deepEqual(actual.value.diagnostics[0].arguments,
        [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }]);
    }
  }
});

function embeddingFixture(name, source, target, operand, embeddingKind, parameters = []) {
  return fixture(name, target, builder => {
    const node = operand(builder);
    return builder.block(builder.returns({ ...node, $: "widening", tsonic: at => {
      const from = { root: { kind: "body", value: builder.nodeRef(at("widening")) }, path: [] };
      const to = { root: { kind: "body", value: builder.nodeRef(0) }, path: [{ kind: "result", signature: SIG[name] }] };
      const embedding = embeddingKind === "identity" ? { kind: "identity" } : { kind: "conversion", conversion: embeddingKind, check: { kind: "none" },
        proof: { steps: [{ from, to, rule: embeddingKind, premises: [] }], conclusion: 0 } };
      const decision = selected({ kind: "conversion", from: source, to: target, embedding }, [source], target);
      return { ...node.tsonic, convertedType: target,
        conversion: { kind: "convert", role: "return", operation: { decision, permissionScope: null } } };
    } }));
  }, parameters);
}

function literalWidening(name, source, target, literal, embeddingKind = "literal-fit") {
  return embeddingFixture(name, source, target, builder => literal.kind === "absence" ? builder.keyword("NullKeyword", source)
    : literal.kind === "boolean" ? builder.keyword(literal.value ? "TrueKeyword" : "FalseKeyword", source)
    : { kind: literal.kind === "number" ? "NumericLiteral" : "StringLiteral", text: literal.kind === "number" ? literal.token : literal.value,
      tokenFlags: [], tsonic: { type: source, convertedType: source, conversion: { kind: "identity" },
        narrowing: null, evidenceIndex: null, demand: { kind: "always" }, role: "value", value: literal.value } }, embeddingKind);
}

test("the actual pure literal-fit conversion preserves its boolean payload at the wider selected type", () => {
  const source = declareType("evaluation.literalWidening.true", { kind: "literal", value: { kind: "boolean", value: true }, base: T.bool });
  const value = literalWidening("evaluate-literal-widening.true", source, T.bool, { kind: "boolean", value: true });
  same(value.start().value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: true } },
    "the real Source-selected pure embedding needs no fabricated native conversion or default context");
});

test("selected Float64 literal fit materializes finite encodings and pays before actual type and format reads", () => {
  const cases = [
    ["normal", "1.25", 5n, 4n, false, 0x3ff4000000000000n],
    ["negative", "-1.25", -5n, 4n, false, 0xbff4000000000000n],
    ["zero", "0", 0n, 1n, false, 0n],
    ["negative-zero", "-0", 0n, 1n, true, 0x8000000000000000n],
    ["first-subnormal", `${5n ** 1074n}e-1074`, 1n, 1n << 1074n, false, 1n],
    ["last-subnormal", `${((1n << 52n) - 1n) * 5n ** 1074n}e-1074`, (1n << 52n) - 1n, 1n << 1074n, false, 0x000fffffffffffffn],
    ["first-normal", `${5n ** 1022n}e-1022`, 1n, 1n << 1022n, false, 0x0010000000000000n],
    ["last-normal", `${((1n << 53n) - 1n) << 971n}`, ((1n << 53n) - 1n) << 971n, 1n, false, 0x7fefffffffffffffn],
  ];
  const materialization = 1024 + 1075 + 64;
  const literalTypeRead = 1;
  const required = literalTypeRead + 4 + materialization + 6;
  for (const [name, token, numerator, denominator, negativeZero, bits] of cases) {
    const exact = { numerator, denominator, negativeZero };
    const literal = { kind: "number", token, value: exact };
    const source = declareType(`evaluation.literalWidening.float.${name}`, { kind: "literal", value: { kind: "number", value: exact }, base: T.float64 });
    const selected = literalWidening(`evaluate-literal-widening.float.${name}`, source, T.float64, literal);
    const allowed = { ...limits, maximumIntermediateBits: 1128, maximumResultBits: 64, maximumArithmeticWork: required };
    same(selected.start(allowed).value.value, { kind: "value", value: { kind: "floating", type: T.float64, bits } }, name);
    if (name !== "normal") continue;
    const [format] = selected.deps.selectedNativeFacts.floatingFormats;
    const run = (deps, body = selected.body) => product.evaluate(deps, selected.entry, body, [], "compile-time", selected.unit);
    for (let maximum = 0; maximum <= required; maximum += 1) {
      const reads = [];
      const floatingFormats = new Proxy([format], { get(target, key, receiver) {
        if (key === "0") reads.push("format");
        return Reflect.get(target, key, receiver);
      } });
      const selectedNativeFacts = new Proxy({ floatingFormats }, { get(target, key, receiver) {
        assert.equal(key, "floatingFormats", "exact pack reads no rounding, overflow or conversion rule");
        return Reflect.get(target, key, receiver);
      } });
      const answer = run({ ...selected.deps, selectedNativeFacts, limits: { ...allowed, maximumArithmeticWork: maximum },
        typeOf: id => { reads.push(id); return selected.deps.typeOf(id); } });
      assert.equal(answer.value.kind, maximum === required ? "ok" : "refused", `exact packing work ${maximum}`);
      assert.deepEqual(reads, [[literalTypeRead, source], ...[[2, source], [3, T.float64], [4, "format"],
        ...[5, 7, 9].flatMap(position => [[position + materialization, T.float64], [position + materialization + 1, "format"]])]
        .map(([position, value]) => [position + literalTypeRead, value])]
        .filter(([boundary]) => boundary <= maximum).map(([, value]) => value));
      if (maximum < required) assert.equal(answer.value.diagnostics[0].arguments[0].value, "evaluation.maximumArithmeticWork");
    }
    for (const field of ["maximumIntermediateBits", "maximumResultBits"])
      for (const maximum of [63, 64]) {
        const answer = selected.start({ ...allowed, [field]: maximum });
        assert.equal(answer.value.kind, maximum === 64 ? "ok" : "refused", field);
        if (maximum < 64) assert.equal(answer.value.diagnostics[0].arguments[0].value, `evaluation.${field}`);
      }
    const deps = { ...selected.deps, limits: allowed };
    assert.throws(() => run({ ...deps, selectedNativeFacts: { ...deps.selectedNativeFacts, floatingFormats: [] } }), /selected carrier format/u);
    assert.throws(() => run({ ...deps, selectedNativeFacts: { ...deps.selectedNativeFacts,
      floatingFormats: [{ ...format, interchange: "ieee754-binary32" }] } }), /exactly representable literal payload/u);
    assert.throws(() => run({ ...deps, typeOf: id => {
      assert.notEqual(id, T.float64, "same-slot numeric conversion cannot read destination after crossed source evidence");
      return id === source ? { ...deps.typeOf(id), base: T.int32 } : deps.typeOf(id);
    } }), /retains its exact payload/u);
    const inexact = { ...exact, numerator: 1n, denominator: 10n };
    const substitute = actual => ({ ...actual, value: inexact });
    const crossed = { ...selected.body, constants: selected.body.constants.map(row =>
      ({ ...row, value: { ...row.value, value: substitute(row.value.value) } })) };
    assert.throws(() => run(deps, crossed), /unchanged, exactly representable literal payload/u);
    assert.throws(() => run({ ...deps, typeOf: id => id === source ? { ...deps.typeOf(id), value: substitute(literal) } : deps.typeOf(id) },
      crossed), /unchanged, exactly representable literal payload/u);
  }
});

test("payload-preserving literal fit may use an integer alternative after a floating alternative needs materialization", () => {
  const literal = { kind: "number", token: "7", value: { numerator: 7n, denominator: 1n, negativeZero: false } };
  const integer = declareType("evaluation.literalWidening.actualInteger", { kind: "primitive", primitive: "int8" });
  const source = declareType("evaluation.literalWidening.exactInteger", { kind: "literal",
    value: { kind: "number", value: literal.value }, base: integer });
  const direct = literalWidening("evaluate-literal-widening.integer", source, integer, literal);
  const reads = [];
  const typed = product.evaluate({ ...direct.deps, typeOf: id => { reads.push(id); return direct.deps.typeOf(id); } },
    direct.entry, direct.body, [], "compile-time", direct.unit);
  same(typed.value.value, { kind: "value", value: { kind: "number", type: integer, value: literal.value } }, "the same carrier keeps its integer value");
  assert.deepEqual(reads, [source, source, integer]);
  const target = declareType("evaluation.literalWidening.numericChoice", { kind: "union", members: [T.float64, integer] });
  const value = literalWidening("evaluate-literal-widening.numericChoice", source, target, literal);
  same(value.start().value.value, { kind: "value", value: { kind: "number", type: target, value: literal.value } },
    "the existing integer payload fits without constructing a floating value");
});

test("selected literal widening preserves exact false and Unicode payloads under every smaller original allowance", () => {
  const literals = [{ kind: "boolean", value: false }, { kind: "string", value: "" }, { kind: "string", value: "e\u0301\u0000λ" }];
  for (const [index, literal] of literals.entries()) {
    const target = literal.kind === "boolean" ? T.bool : T.string;
    const source = declareType(`evaluation.literalWidening.${index}`, { kind: "literal", value: literal, base: target });
    const value = literalWidening(`evaluate-literal-widening.${index}`, source, target, literal);
    const required = literal.kind === "boolean" ? 17 : 15 + 2 * literal.value.length;
    for (let maximum = 0; maximum <= required; maximum += 1) {
      const answer = value.start({ ...limits, maximumArithmeticWork: maximum });
      assert.equal(answer.kind, "done");
      assert.equal(answer.value.kind, maximum < required ? "refused" : "ok", `canonical conversion work ${index}/${maximum}`);
      if (maximum === required) same(answer.value.value, { kind: "value", value: { ...literal, type: target } }, "the payload is not normalized or converted by a host numeric policy");
      else assert.equal(answer.value.diagnostics[0].arguments[0].value, "evaluation.maximumArithmeticWork");
    }
    const bits = literal.kind === "boolean" ? 1 : 16 * literal.value.length;
    for (const dimension of ["maximumIntermediateBits", "maximumResultBits"]) for (const maximum of new Set([0, Math.max(0, bits - 1), bits])) {
      const answer = value.start({ ...limits, [dimension]: maximum });
      assert.equal(answer.value.kind, maximum < bits ? "refused" : "ok", `${index}/${dimension}/${maximum}`);
    }
    const unread = new Proxy({}, { get() { assert.fail("Literal widening reads no unrelated numeric policy row."); } });
    same(product.evaluate({ ...value.deps, selectedNativeFacts: unread }, value.entry, value.body, [], "compile-time", value.unit).value.value,
      { kind: "value", value: { ...literal, type: target } }, "boolean and string widening need no target-name or numeric representation guess");
  }
});

test("conversion identity and nested literal-base evidence retain the actual selected payload and original read stop", () => {
  const identity = literalWidening("evaluate-literal-widening.identity", T.bool, T.bool, { kind: "boolean", value: true }, "identity");
  same(identity.start({ ...limits, maximumArithmeticWork: 1 }).value.value,
    { kind: "value", value: { kind: "boolean", type: T.bool, value: true } }, "a genuine identity embedding borrows the same value");
  const inner = declareType("evaluation.literalWidening.inner", { kind: "literal", value: { kind: "boolean", value: true }, base: T.bool });
  const outer = declareType("evaluation.literalWidening.outer", { kind: "literal", value: { kind: "boolean", value: true }, base: inner });
  const value = literalWidening("evaluate-literal-widening.nested", outer, T.bool, { kind: "boolean", value: true });
  for (let maximum = 0; maximum <= 21; maximum += 1) {
    const reads = [];
    const answer = product.evaluate({ ...value.deps, limits: { ...limits, maximumArithmeticWork: maximum }, typeOf: type => {
      reads.push(type);
      return value.deps.typeOf(type);
    } }, value.entry, value.body, [], "compile-time", value.unit);
    assert.equal(answer.value.kind, maximum < 21 ? "refused" : "ok");
    const expectedReads = [outer, inner, T.bool, T.bool];
    assert.deepEqual(reads, expectedReads.slice(0, reads.length), "no later source hop or target lookup follows refusal");
    if (maximum === 0) assert.deepEqual(reads, []);
    if (maximum === 21) assert.deepEqual(reads, expectedReads);
  }
});

test("a conversion never substitutes missing selected transformation, payload, check or native evidence", () => {
  const source = declareType("evaluation.literalWidening.frontier", { kind: "literal", value: { kind: "boolean", value: true }, base: T.bool });
  const value = literalWidening("evaluate-literal-widening.frontier", source, T.bool, { kind: "boolean", value: true });
  const changed = replace => ({ ...value.body, blocks: value.body.blocks.map(block => ({ ...block, statements: block.statements.map(statement =>
    statement.kind !== "assign" || statement.value.kind !== "convert" ? statement : { ...statement, value: { ...statement.value,
      operation: { ...statement.value.operation, decision: { ...statement.value.operation.decision,
        operation: replace(statement.value.operation.decision.operation) } } } }) })) });
  const run = (body = value.body, overrides = {}) => product.evaluate({ ...value.deps, ...overrides }, value.entry, body, [], "compile-time", value.unit);
  for (const replace of [operation => ({ ...operation, from: T.string }), operation => ({ ...operation, to: T.string })])
    assert.throws(() => run(changed(replace)), /actual source value and destination type/u);
  assert.throws(() => run(changed(operation => ({ ...operation, embedding: { kind: "identity" } }))), /same selected type/u);
  assert.throws(() => run(changed(operation => ({ ...operation, embedding: { kind: "refused", reason: "missing-correspondence" } }))), /actual selected conversion check/u);
  assert.throws(() => run(changed(operation => ({ ...operation, embedding: { ...operation.embedding, conversion: "numeric" } }))), /actual selected representation transformation/u);
  assert.throws(() => run(value.body, { typeOf: type => type === source ? undefined : value.deps.typeOf(type) }), /exact payload and resolved source\/destination domains/u);
  assert.throws(() => run(value.body, { typeOf: type => type === source ? { ...value.deps.typeOf(type), value: { kind: "boolean", value: false } }
    : value.deps.typeOf(type) }), /exact payload and resolved source\/destination domains/u);
  for (const [primitive, requirement] of [["char", "representation"], ["decimal", "representation"], ["float64", "literal-conversion"]])
    assert.throws(() => run(value.body, { typeOf: type => type === T.bool ? { kind: "primitive", primitive } : value.deps.typeOf(type) }),
      new RegExp(`actual selected ${requirement} evidence for literal conversion`, "u"));
});

test("optional embeddings spend the same arithmetic budget before each selected type or format read", () => {
  const literalFalse = { kind: "boolean", value: false };
  const boolLiteral = declareType("evaluate.optional.false", { kind: "literal", value: literalFalse, base: T.bool });
  const optionalBool = declareType("evaluate.optional.bool", { kind: "optional", value: T.bool });
  const text = { kind: "string", value: "aλ" };
  const stringLiteral = declareType("evaluate.optional.text.literal", { kind: "literal", value: text, base: T.string });
  const optionalText = declareType("evaluate.optional.text", { kind: "optional", value: T.string });
  const optionalFloat = declareType("evaluate.optional.float", { kind: "optional", value: T.float64 });
  const literalCase = (name, source, target, payload, embedding, work, reads) => ({
    frame: literalWidening(name, source, target, payload, embedding), args: [], target, payload, work, reads,
  });
  const parameterCase = (name, source, target, payload, work, reads) => ({
    frame: embeddingFixture(name, source, target, builder => builder.id("input", 0, source), "union-injection", [["input", "required", source]]),
    args: [{ ...payload, type: source }], target, payload, work, reads,
  });
  const signedZero = { kind: "floating", bits: 0x8000000000000000n };
  const float = parameterCase("evaluate.optional.float-payload", T.float64, optionalFloat, signedZero, 19,
    [T.float64, "format", T.float64, "format", optionalFloat, T.float64, ...Array.from({ length: 3 },
      () => [optionalFloat, optionalFloat, T.float64, "format"]).flat()]);
  for (const { frame, args, target, payload, work, reads } of [
    parameterCase("evaluate.optional.boolean-payload", T.bool, optionalBool, literalFalse, 3, [optionalBool, T.bool]),
    literalCase("evaluate.optional.absent", T.absence, optionalBool, { kind: "absence" }, "absence", 4, [optionalBool, T.bool, T.absence]),
    literalCase("evaluate.optional.literal-bool", boolLiteral, optionalBool, literalFalse, "union-injection", 13, [optionalBool, T.bool, boolLiteral, T.bool]),
    literalCase("evaluate.optional.literal-text", stringLiteral, optionalText, text, "union-injection", 15, [optionalText, T.string, stringLiteral, T.string]),
    float,
  ]) {
    for (let maximum = 0; maximum <= work; maximum += 1) {
      const actual = [];
      const floatingFormats = new Proxy(frame.deps.selectedNativeFacts.floatingFormats, { get: (rows, key) => {
        if (key === "0") actual.push("format");
        return Reflect.get(rows, key);
      } });
      const answer = product.evaluate({ ...frame.deps, selectedNativeFacts: { ...frame.deps.selectedNativeFacts, floatingFormats },
        limits: { ...limits, maximumArithmeticWork: maximum }, typeOf: type => {
          actual.push(type);
          return frame.deps.typeOf(type);
        } }, frame.entry, frame.body, args, "compile-time", frame.unit);
      assert.equal(answer.kind, "done");
      assert.equal(answer.value.kind, maximum < work ? "refused" : "ok", `${frame.unit.key[0]}/${maximum}`);
      assert.deepEqual(actual, reads.slice(0, actual.length), "reads form an admitted prefix of the actual relation");
      assert.ok(actual.length <= maximum);
      if (maximum === work) {
        assert.deepEqual(actual, reads);
        same(answer.value.value, { kind: "value", value: { ...payload, type: target } }, "exact native payload and one optional domain");
      } else assert.equal(answer.value.diagnostics[0].arguments[0].value, "evaluation.maximumArithmeticWork");
    }
  }
  for (const dimension of ["maximumIntermediateBits", "maximumResultBits"]) {
    const { frame, args, target } = float;
    for (const maximum of [63, 64]) {
      const answer = product.evaluate({ ...frame.deps, limits: { ...limits, [dimension]: maximum } }, frame.entry, frame.body, args,
        "compile-time", frame.unit).value;
      assert.equal(answer.kind, maximum === 63 ? "refused" : "ok");
      if (maximum === 63) assert.equal(answer.diagnostics[0].arguments[0].value, `evaluation.${dimension}`);
      else same(answer.value, { kind: "value", value: { ...signedZero, type: target } }, "the present optional retains its full floating encoding");
    }
  }
});

test("crossed optional embeddings cannot borrow another type, payload or floating format", async () => {
  const literal = { kind: "boolean", value: true };
  const singleton = declareType("evaluate.optional.crossed.literal", { kind: "literal", value: literal, base: T.bool });
  const target = declareType("evaluate.optional.crossed.target", { kind: "optional", value: T.bool });
  const value = literalWidening("evaluate.optional.crossed", singleton, target, literal, "union-injection");
  const absence = literalWidening("evaluate.optional.crossed.absence", T.absence, target, { kind: "absence" }, "absence");
  const change = (frame, type, replacement) => product.evaluate({ ...frame.deps,
    typeOf: id => id === type ? replacement : frame.deps.typeOf(id) }, frame.entry, frame.body, [], "compile-time", frame.unit);
  assert.throws(() => change(value, target, { kind: "primitive", primitive: "bool" }), /actual selected optional value domain/u);
  assert.throws(() => change(value, target, { kind: "optional", value: T.string }), /actual selected present payload/u);
  assert.throws(() => change(value, singleton, { kind: "literal", value: literal, base: T.string }), /actual selected present type/u);
  assert.throws(() => change(value, singleton, { kind: "literal", value: { kind: "boolean", value: false }, base: T.bool }),
    /exact payload and resolved source\/destination domains/u);
  assert.throws(() => change(absence, T.absence, { kind: "intrinsic", intrinsic: "void" }), /selected native absence payload and type/u);
  const floatTarget = declareType("evaluate.optional.crossed.float", { kind: "optional", value: T.float64 });
  const rational = { kind: "number", token: "1.25", value: { numerator: 5n, denominator: 4n, negativeZero: false } };
  const floatLiteral = declareType("evaluate.optional.crossed.rational", { kind: "literal",
    value: { kind: "number", value: rational.value }, base: T.float64 });
  const unmaterialized = literalWidening("evaluate.optional.crossed-unmaterialized", floatLiteral, floatTarget, rational, "union-injection");
  assert.throws(() => unmaterialized.start(), /actual selected representation transformation/u);
  const floating = embeddingFixture("evaluate.optional.crossed-float", T.float64, floatTarget, builder => builder.id("input", 0, T.float64),
    "union-injection", [["input", "required", T.float64]]);
  const run = (deps, args) => product.evaluate(deps, floating.entry, floating.body, args, "compile-time", floating.unit);
  const signedZero = { kind: "floating", bits: 0x8000000000000000n, type: T.float64 };
  assert.throws(() => run({ ...floating.deps, typeOf: type => type === floatTarget ? { kind: "optional", value: T.bool } : floating.deps.typeOf(type) },
    [signedZero]), /floating embedding requires the actual selected present type/u);
  assert.throws(() => run({ ...floating.deps, selectedNativeFacts: { ...floating.deps.selectedNativeFacts, floatingFormats: [] } },
    [signedZero]), /require the selected carrier format/u);
  const { valueFits } = await import("../../packages/host/dist/evaluate/budget.js");
  const origin = value.body.blocks[0].terminator.origin;
  const machine = { deps: value.deps, arithmetic: 0, result: null, unit: value.unit };
  assert.throws(() => valueFits(machine, { ...signedZero, type: target }, "maximumIntermediateBits", origin),
    /requires? their actual selected native carrier/u);
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
      const result = value.start({ ...limits, [field]: maximum, maximumArithmeticWork: 1 });
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

test("actual Rules-selected native boolean negation shares the Boolean evaluator", () => {
  for (const input of [false, true]) {
    const decision = selected({ kind: "native-operator", operator: "!", carrier: "bool" }, [T.bool], T.bool);
    const value = fixture(`evaluate-native-boolean.${input}`, T.bool, builder => builder.block(builder.returns(
      builder.prefix(builder.keyword(input ? "TrueKeyword" : "FalseKeyword", T.bool), "ExclamationToken", T.bool, decision))));
    const result = value.start();
    same(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: !input } },
      "the retained native bool decision executes directly, without an integer or source-spelling surrogate");
  }
});

test("selected native boolean negation pays actual carrier reads and retains first refusal without policy reads", () => {
  const decision = selected({ kind: "native-operator", operator: "!", carrier: "bool" }, [T.bool], T.bool);
  const value = fixture("evaluate-native-boolean.work", T.bool, builder => builder.block(builder.returns(
    builder.prefix(builder.keyword("TrueKeyword", T.bool), "ExclamationToken", T.bool, decision))));
  for (let maximum = 0; maximum <= 3; maximum += 1) {
    let reads = 0;
    const result = product.evaluate({ ...value.deps, limits: { ...limits, maximumArithmeticWork: maximum },
      typeOf: type => { reads += 1; return value.deps.typeOf(type); } }, value.entry, value.body, [], "compile-time", value.unit);
    assert.equal(result.value.kind, maximum < 3 ? "refused" : "ok", `native bool work:${maximum}`);
    assert.equal(reads, Math.max(0, maximum - 1), "the operand work and each actual type lookup are admitted before any next read");
    if (maximum < 3) same(result.value.diagnostics[0].arguments,
      [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }], "same original arithmetic stop");
  }
  const unread = new Proxy({}, { get() { assert.fail("A native Boolean negation has no numeric policy lookup."); } });
  const result = product.evaluate({ ...value.deps, selectedNativeFacts: unread }, value.entry, value.body, [], "compile-time", value.unit);
  assert.equal(result.value.value.value.value, false);
  for (const field of ["maximumIntermediateBits", "maximumResultBits"])
    for (let maximum = 0; maximum <= 1; maximum += 1)
      assert.equal(value.start({ ...limits, [field]: maximum }).value.kind, maximum === 0 ? "refused" : "ok");
});

test("native boolean operands retain their canonical literal base and malformed association frontier", () => {
  const literal = declareType("evaluation.nativeBoolLiteral", { kind: "literal", value: { kind: "boolean", value: true }, base: T.bool });
  const decision = selected({ kind: "native-operator", operator: "!", carrier: "bool" }, [literal], T.bool);
  const value = fixture("evaluate-native-boolean.literal", T.bool, builder => builder.block(builder.returns(
    builder.prefix(builder.keyword("TrueKeyword", literal), "ExclamationToken", T.bool, decision))));
  assert.equal(value.start().value.value.value.value, false);
  const invoke = (deps = value.deps, body = value.body) => product.evaluate(deps, value.entry, body, [], "compile-time", value.unit);
  const changed = structuredClone(value.body);
  changed.blocks.flatMap(block => block.statements).find(row => row.value?.kind === "unary").value.operation.decision.result = T.unknown;
  assert.throws(() => invoke(value.deps, changed), /actual selected native boolean carrier association/u);
  assert.throws(() => invoke({ ...value.deps, typeOf: type => type === literal ? { kind: "shape", members: [], indexes: [], calls: [], constructs: [] }
    : value.deps.typeOf(type) }), /actual selected native boolean carrier association/u);
});

test("selected exact string equality preserves payloads and charges both operands before comparison", () => {
  for (const [index, [left, right]] of [["", ""], ["λ", "λ"], ["\u0000\n", "\u0000\n"], ["e\u0301", "é"], ["a", "b"]].entries()) {
    for (const operator of ["==", "===", "!=", "!=="]) {
      const decision = selected({ kind: "string-operator", operator }, [T.string, T.string], T.bool);
      const value = fixture(`evaluate-string-${index}-${operator}`, T.bool, builder => {
        const text = value => ({ kind: "StringLiteral", text: value, tokenFlags: [],
          tsonic: { type: T.string, convertedType: T.string, conversion: { kind: "identity" }, narrowing: null,
            evidenceIndex: null, demand: { kind: "always" }, role: "value", value } });
        return builder.block(builder.returns(builder.comparison(text(left), "EqualsEqualsEqualsToken", text(right), decision)));
      });
      const required = left.length + right.length + 1;
      for (let maximum = 0; maximum <= required; maximum += 1) {
        const result = value.start({ ...limits, maximumArithmeticWork: maximum });
        assert.equal(result.value.kind, maximum < required ? "refused" : "ok");
        if (maximum === required) same(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool,
          value: operator === "==" || operator === "===" ? left === right : left !== right } }, "no normalization or host numeric conversion");
      }
      const assign = value.body.blocks.flatMap(block => block.statements).find(statement => statement.kind === "assign" && statement.value.kind === "binary");
      const original = assign.value.operation.decision.operation;
      if (left.length === 0 && right.length === 0) {
        const refused = value.start({ ...limits, maximumIntermediateBits: 0 });
        assert.equal(refused.value.kind, "refused");
        same(refused.value.diagnostics[0].arguments,
          [{ kind: "text", value: "evaluation.maximumIntermediateBits" }, { kind: "number", value: 0 }], "the boolean output is admitted before comparison");
      }
      assign.value.operation.decision.operation = { ...original, operator: "<" };
      assert.throws(() => value.start(), /actual selected native string operation law/u);
      assign.value.operation.decision.operation = original;
    }
  }
  const decision = selected({ kind: "string-operator", operator: "===" }, [T.bool, T.bool], T.bool);
  const malformed = fixture("evaluate-string-malformed", T.bool, builder => builder.block(builder.returns(
    builder.comparison(builder.keyword("TrueKeyword", T.bool), "EqualsEqualsEqualsToken", builder.keyword("FalseKeyword", T.bool), decision))));
  assert.throws(() => malformed.start(), /two actual string operands/u);
  const wrongRight = fixture("evaluate-string-wrong-right", T.bool, builder => builder.block(builder.returns(builder.comparison(
    { kind: "StringLiteral", text: "x", tokenFlags: [], tsonic: { type: T.string, convertedType: T.string,
      conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" }, role: "value", value: "x" } },
    "EqualsEqualsEqualsToken", builder.keyword("FalseKeyword", T.bool),
    selected({ kind: "string-operator", operator: "===" }, [T.string, T.bool], T.bool)))));
  assert.throws(() => wrongRight.start(), /two actual string operands/u);
  const missingRight = fixture("evaluate-string-missing-right", T.bool, builder => builder.block(builder.returns(
    builder.prefix(builder.keyword("TrueKeyword", T.bool), "ExclamationToken", T.bool,
      selected({ kind: "string-operator", operator: "===" }, [T.bool], T.bool)))));
  assert.throws(() => missingRight.start(), /two actual string operands/u);
});

test("selected string concatenation admits represented output and actual operand work before creating the value", () => {
  for (const [index, [left, right, expected]] of [["", "", ""], ["λ", "\u0000\n", "λ\u0000\n"],
    ["e", "\u0301", "e\u0301"]].entries()) {
    const decision = selected({ kind: "string-operator", operator: "+" }, [T.string, T.string], T.string);
    const value = fixture(`evaluate-string-concat-${index}`, T.string, builder => {
      const text = value => ({ kind: "StringLiteral", text: value, tokenFlags: [],
        tsonic: { type: T.string, convertedType: T.string, conversion: { kind: "identity" }, narrowing: null,
          evidenceIndex: null, demand: { kind: "always" }, role: "value", value } });
      return builder.block(builder.returns(builder.arithmetic(text(left), "PlusToken", text(right), T.string, decision)));
    });
    for (const field of ["maximumIntermediateBits", "maximumResultBits"]) {
      const required = expected.length * 16;
      for (let maximum = 0; maximum <= required; maximum += 1) {
        const result = value.start({ ...limits, [field]: maximum });
        assert.equal(result.value.kind, maximum < required ? "refused" : "ok", `${field}:${maximum}`);
        if (maximum === required) same(result.value.value, { kind: "value", value: { kind: "string", type: T.string, value: expected } },
          "exact content is retained without implicit normalization");
      }
    }
    const requiredWork = left.length + right.length + 1;
    for (let maximum = 0; maximum <= requiredWork; maximum += 1) {
      const result = value.start({ ...limits, maximumArithmeticWork: maximum });
      assert.equal(result.value.kind, maximum < requiredWork ? "refused" : "ok", `work:${maximum}`);
    }
  }
});

function floatingComparisonFixture(name, operator, token, carrier, type, format) {
  const decision = selected({ kind: "native-operator", operator, carrier }, [type, type], T.bool);
  const facts = { ...nativeFactsFixture(), integerOverflow: [], conversions: [], floatingFormats: [format] };
  const value = fixture(name, T.bool, builder => builder.block(builder.returns(
    builder.comparison(builder.id("left", 0, type), token, builder.id("right", 1, type), decision))),
    [["left", "required", type], ["right", "required", type]], facts);
  const deps = { ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: 1024 } };
  const operand = bits => ({ kind: "floating", type, bits });
  const run = (left, right, given = deps, body = value.body) => product.evaluate(given, value.entry, body, [left, right], "compile-time", value.unit);
  return { ...value, deps, operand, run };
}

test("exact floating comparisons use selected widths and both unordered operand positions", () => {
  for (const [carrier, interchange, width, negative, positive, nan] of [
    ["float16", "ieee754-binary16", 16, 0xbc00n, 0x3c00n, 0xfc07n],
    ["float32", "ieee754-binary32", 32, 0xbf800000n, 0x3f800000n, 0xff800007n],
    ["float64", "ieee754-binary64", 64, 0xbff0000000000000n, 0x3ff0000000000000n, 0xfff0000000000007n],
  ]) {
    const type = declareType(`evaluation.floatComparison.${carrier}`, { kind: "primitive", primitive: carrier });
    const format = { carrier, interchange, nanSignObservable: true, nanPayloadObservable: true, signalingNaNObservable: true };
    const less = floatingComparisonFixture(`evaluate.floatComparison.less.${carrier}`, "<", "LessThanToken", carrier, type, format);
    const different = floatingComparisonFixture(`evaluate.floatComparison.different.${carrier}`, "!==", "ExclamationEqualsEqualsToken", carrier, type, format);
    for (const [owner, leftBits, rightBits, expected, exact] of [
      [less, negative, positive, true, 11 + 8 * width],
      [less, nan, positive, false, 11 + 2 * width],
      [different, positive, nan, true, 11 + 5 * width],
    ]) {
      const left = owner.operand(leftBits);
      const right = owner.operand(rightBits);
      const complete = owner.run(left, right);
      assert.deepEqual(complete.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: expected } });
      for (let maximum = 0; maximum <= exact; maximum += 1) {
        const actual = owner.run(left, right, { ...owner.deps, limits: { ...owner.deps.limits, maximumArithmeticWork: maximum } });
        if (maximum === exact) assert.deepEqual(actual, complete);
        else {
          assert.equal(actual.value.kind, "refused", `${carrier}: ${maximum}`);
          assert.deepEqual(actual.value.diagnostics[0].arguments,
            [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }]);
        }
      }
    }
  }
});

test("floating comparisons reject an unmaterialized operand and the crossed selected carrier", () => {
  const format = nativeFactsFixture().floatingFormats[0];
  const type = declareType("evaluation.floatComparison.fault", { kind: "primitive", primitive: "float64" });
  const owner = floatingComparisonFixture("evaluate.floatComparison.fault", "===", "EqualsEqualsEqualsToken", "float64", type, format);
  const zero = owner.operand(0n);
  const rational = { kind: "number", type, value: { numerator: 0n, denominator: 1n, negativeZero: false } };
  assert.throws(() => owner.run(zero, rational), /both exact floating bit values/u);
  assert.throws(() => owner.run(rational, zero), /both exact floating bit values/u);
  assert.throws(() => owner.run(rational, rational), /both exact floating bit values/u);
  const crossed = structuredClone(owner.body);
  const decision = crossed.blocks.flatMap(block => block.statements)
    .find(row => row.kind === "assign" && row.value.kind === "binary").value.operation.decision;
  decision.operation.carrier = "float32";
  assert.throws(() => owner.run(zero, zero, owner.deps, crossed), /both actual operand carriers/u);
});

test("selected Float64 comparisons pack actual literal operands in order under one paid format and base", async () => {
  const materialization = 1024 + 1075 + 64;
  const format = nativeFactsFixture().floatingFormats[0];
  const other = { ...format, carrier: "float32", interchange: "ieee754-binary32" };
  const literal = (token, numerator, denominator, negativeZero = false) => ({ kind: "number", token, value: { numerator, denominator, negativeZero } });
  const node = (builder, value, type) => {
    const syntax = builder.num("0", type);
    return { ...syntax, text: value.token, tsonic: { ...syntax.tsonic, value: value.value } };
  };
  const declared = (name, value) => declareType(`evaluation.floatComparison.literal.${name}`,
    { kind: "literal", value: { kind: "number", value: value.value }, base: T.float64 });
  const first = literal("1.25", 5n, 4n);
  const second = literal("1.5", 3n, 2n);
  const left = declared("first", first);
  const right = declared("second", second);
  const comparison = (builder, lhs, rhs, operands) => builder.block(builder.returns(builder.comparison(lhs, "EqualsEqualsEqualsToken", rhs,
    selected({ kind: "native-operator", operator: "===", carrier: "float64" }, operands, T.bool))));
  const facts = { ...nativeFactsFixture(), floatingFormats: [other, format] };
  const owner = fixture("evaluate.floatComparison.literal.order", T.bool, builder =>
    comparison(builder, node(builder, first, left), node(builder, second, right), [left, right]), [], facts);
  const literalTypeReads = 2;
  const exact = literalTypeReads + 7 + 2 * materialization + 7 * 64;
  const attempt = (deps, body = owner.body) => product.evaluate(deps, owner.entry, body, [], "compile-time", owner.unit);
  for (let maximum = 0; maximum <= exact; maximum += 1) {
    const reads = [];
    const floatingFormats = new Proxy(facts.floatingFormats, { get(target, key, receiver) {
      if (key === "0" || key === "1") reads.push(`format:${key}`);
      return Reflect.get(target, key, receiver);
    } });
    const actual = attempt({ ...owner.deps, selectedNativeFacts: { ...facts, floatingFormats },
      typeOf: id => { reads.push(id); return owner.deps.typeOf(id); }, limits: { ...limits, maximumArithmeticWork: maximum } });
    assert.deepEqual(reads, [[1, left], [2, right], ...[[2, left], [3, T.float64], [4, "format:0"], [5, "format:1"],
      [7 + materialization, right]].map(([position, value]) => [position + literalTypeReads, value])]
      .filter(([cut]) => cut <= maximum).map(([, value]) => value), `literal comparison reads at ${maximum}`);
    if (maximum === exact) assert.deepEqual(actual.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: false } });
    else {
      assert.equal(actual.value.kind, "refused", `literal comparison work at ${maximum}`);
      assert.deepEqual(actual.value.diagnostics[0].arguments,
        [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }]);
    }
  }
  const enough = { ...limits, maximumIntermediateBits: 1128, maximumArithmeticWork: exact };
  const reads = [];
  const crossedFacts = new Proxy(facts, { get() { assert.fail("crossed left base must stop before the format relation"); } });
  assert.throws(() => attempt({ ...owner.deps, selectedNativeFacts: crossedFacts, limits: enough, typeOf: id => {
    reads.push(id);
    const type = owner.deps.typeOf(id);
    return id === left ? { ...type, base: T.int32 } : type;
  } }), /both actual operand carriers/u);
  assert.deepEqual(reads, [left, right, left, T.int32]);
  for (const contrary of [literal("0.1", 1n, 10n), literal("9007199254740993", 9007199254740993n, 1n)]) {
    const misplaced = { ...owner.body, constants: owner.body.constants.map(row => row.type === left ? { ...row, value: { kind: "literal", value: contrary } } : row) };
    const observed = [];
    assert.throws(() => attempt({ ...owner.deps, limits: enough, typeOf: id => {
      observed.push(id);
      const type = owner.deps.typeOf(id);
      return id === left ? { ...type, value: { kind: "number", value: contrary.value } } : type;
    } }, misplaced), /unchanged, exactly representable literal payload/u);
    assert.deepEqual(observed, [left, right, left, T.float64]);
    assert.throws(() => attempt({ ...owner.deps, limits: enough }, misplaced), /unchanged, exactly representable literal payload/u);
  }
  for (const [name, value, match, miss] of [
    ["signed-zero", literal("-0", 0n, 1n, true), 0n, 0x7ff8000000000001n],
    ["subnormal", literal(`${5n ** 1074n}e-1074`, 1n, 1n << 1074n), 1n, 2n],
  ]) for (const literalFirst of [true, false]) {
    const type = declared(`${name}.${literalFirst}`, value);
    const mixed = fixture(`evaluate.floatComparison.literal.${name}.${literalFirst}`, T.bool, builder => {
      const authored = node(builder, value, type);
      const supplied = builder.id("operand", 0, T.float64);
      return literalFirst ? comparison(builder, authored, supplied, [type, T.float64])
        : comparison(builder, supplied, authored, [T.float64, type]);
    }, [["operand", "required", T.float64]], facts);
    for (const [bits, expected] of [[match, true], [miss, false]]) {
      const result = product.evaluate({ ...mixed.deps, limits: enough }, mixed.entry, mixed.body,
        [{ kind: "floating", type: T.float64, bits }], "compile-time", mixed.unit);
      assert.deepEqual(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: expected } });
    }
  }
  const { compareFloating } = await import("../../packages/host/dist/evaluate/comparison.js");
  const site = owner.body.blocks.flatMap(block => block.statements)
    .find(statement => statement.kind === "assign" && statement.value.kind === "binary");
  const authored = { kind: "number", type: left, value: first.value };
  const bits = { kind: "floating", type: T.float64, bits: 0x3ff4000000000000n };
  const compare = (first, second, deps, machine = { deps, unit: owner.unit, result: null, arithmetic: 0 }) =>
    compareFloating(machine, "===", "float64", T.bool, site, first, second);
  for (let maximum = 0; maximum < 5; maximum += 1) {
    const observed = [];
    const floatingFormats = new Proxy(facts.floatingFormats, { get(target, key, receiver) {
      if (key === "0" || key === "1") observed.push(`format:${key}`);
      return Reflect.get(target, key, receiver);
    } });
    const deps = { ...owner.deps, limits: { ...enough, maximumArithmeticWork: maximum },
      selectedNativeFacts: { ...facts, floatingFormats }, typeOf: id => {
        observed.push(id);
        return owner.deps.typeOf(id);
      } };
    const machine = { deps, unit: owner.unit, result: null, arithmetic: 0 };
    assert.equal(compare(bits, authored, deps, machine), null);
    assert.equal(machine.result.kind, "refused");
    assert.deepEqual(machine.result.diagnostics[0].arguments,
      [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }]);
    assert.deepEqual(observed, [[2, T.float64], [3, "format:0"], [4, "format:1"]]
      .filter(([cut]) => cut <= maximum).map(([, value]) => value));
  }
  const deps = { ...owner.deps, limits: enough };
  const unreadLiteral = { ...authored, get type() { assert.fail("later literal type must not be pulled"); } };
  assert.throws(() => compare({ ...bits, bits: 1n << 64n }, unreadLiteral, deps), /valid selected encoding/u);
  let bitReads = 0;
  const readOnce = { ...bits, get bits() {
    bitReads += 1;
    return bitReads === 1 ? bits.bits : 0n;
  } };
  assert.deepEqual(compare(readOnce, authored, deps), { kind: "boolean", type: T.bool, value: true });
  assert.equal(bitReads, 1, "the compared payload is the same scalar admitted against the selected format");
  assert.throws(() => compare(authored, { ...bits, type: T.int32 }, { ...deps, typeOf: id =>
    id === T.int32 ? { kind: "primitive", primitive: "float64" } : deps.typeOf(id) }), /both actual operand carriers/u);
  const secondLiteral = { kind: "number", type: right, value: second.value };
  assert.throws(() => compare(authored, secondLiteral, { ...deps, typeOf: id => {
    assert.notEqual(id, T.int32, "a crossed second base cannot open another base lookup");
    const type = deps.typeOf(id);
    return id === right ? { ...type, base: T.int32 } : type;
  } }), /both actual operand carriers/u);
});

test("selected integer comparisons retain exact native values beyond double precision and every equality/order arm", () => {
  const high = 9007199254740993n;
  const exactLimits = { ...limits, maximumArithmeticWork: 10000 };
  for (const [carrier, type] of comparisonTypes) {
    const first = carrier === "int8" ? 1n : high;
    for (const [left, right] of [[first, first], [first, first + 1n], [first + 1n, first]]) {
      for (const operator of ["==", "!=", "===", "!==", "<", "<=", ">", ">="]) {
        const token = { "==": "EqualsEqualsToken", "!=": "ExclamationEqualsToken", "===": "EqualsEqualsEqualsToken",
          "!==": "ExclamationEqualsEqualsToken", "<": "LessThanToken", "<=": "LessThanEqualsToken", ">": "GreaterThanToken", ">=": "GreaterThanEqualsToken" }[operator];
        const decision = selected({ kind: "native-operator", operator, carrier }, [type, type], T.bool);
        const value = fixture(`evaluate-integer-${carrier}-${operator}-${left}-${right}`, T.bool, b => b.block(b.returns(
          b.comparison(b.num(String(left), type), token, b.num(String(right), type), decision))));
        const result = value.start(exactLimits);
        const expected = operator === "==" || operator === "===" ? left === right
          : operator === "!=" || operator === "!==" ? left !== right : operator === "<" ? left < right
            : operator === "<=" ? left <= right : operator === ">" ? left > right : left >= right;
        same(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: expected } },
          "the actual exact native comparison, without double rounding");
      }
    }
  }
});

test("integer comparison geometry, row reads and comparisons share one exact precharged arithmetic allowance", () => {
  const [carrier, type] = comparisonTypes[0];
  const decision = selected({ kind: "native-operator", operator: "<", carrier }, [type, type], T.bool);
  const value = fixture("evaluate-integer-account", T.bool, b => b.block(b.returns(
    b.comparison(b.num("1", type), "LessThanToken", b.num("2", type), decision))));
  const required = 2 + (2 + 3 * 8 + 2 + 4 * 8 + 8);
  for (let maximum = 0; maximum <= required; maximum += 1) {
    const result = value.start({ ...limits, maximumArithmeticWork: maximum });
    assert.equal(result.value.kind, maximum < required ? "refused" : "ok", `same invocation work ${maximum}`);
    if (maximum < required) same(result.value.diagnostics[0].arguments,
      [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }],
      "the original first arithmetic refusal is retained");
  }
  for (let maximum = 0; maximum <= 8; maximum += 1) {
    const result = value.start({ ...limits, maximumIntermediateBits: maximum });
    assert.equal(result.value.kind, maximum < 8 ? "refused" : "ok", `admit range bits before growth ${maximum}`);
  }
});

function additionFixture(name, carrier, type, left, right, law = "wrap", result = type, resultCarrier = carrier) {
  const execution = law === "wrap" ? { kind: "pure" } : { kind: "invocation", writesStorage: false, failure: law };
  const decision = selected({ kind: "native-operator", operator: "+", carrier }, [type, type], result, execution);
  const value = fixture(name, result, builder => builder.block(builder.returns(builder.arithmetic(
    builder.num(String(left), type), "PlusToken", builder.num(String(right), type), result, decision))));
  const facts = { ...value.deps.selectedNativeFacts, integerOverflow: [{ carrier, operation: "add", result: resultCarrier, law }] };
  const deps = { ...value.deps, selectedNativeFacts: facts, limits: { ...limits, maximumArithmeticWork: 10000 } };
  return { ...value, deps, run: (given = deps, body = value.body) => product.evaluate(given, value.entry, body, [], "compile-time", value.unit) };
}

function negationFixture(name, carrier, type, operand, law = "wrap", result = type, resultCarrier = carrier) {
  const execution = law === "wrap" ? { kind: "pure" } : { kind: "invocation", writesStorage: false, failure: law };
  const decision = selected({ kind: "native-operator", operator: "-", carrier }, [type], result, execution);
  const value = fixture(name, result, builder => builder.block(builder.returns(
    builder.prefix(builder.num(String(operand), type), "MinusToken", result, decision))));
  const facts = { ...value.deps.selectedNativeFacts, integerOverflow: [{ carrier, operation: "negate", result: resultCarrier, law }] };
  const deps = { ...value.deps, selectedNativeFacts: facts, limits: { ...limits, maximumArithmeticWork: 10000 } };
  return { ...value, deps, run: (given = deps, body = value.body) => product.evaluate(given, value.entry, body, [], "compile-time", value.unit) };
}

function integerUpdateFixture(operator, carrier, type, law) {
  const family = operator === "++" ? "increment" : "decrement";
  const facts = { ...nativeFactsFixture(), integerOverflow: [{ carrier, operation: family, result: carrier, law }] };
  const execution = law === "wrap" ? { kind: "pure" } : { kind: "invocation", writesStorage: false, failure: law };
  const decision = selected({ kind: "native-operator", operator, carrier }, [type], type, execution);
  const value = fixture(`evaluate-update.${family}.${carrier}.${law}`, type, builder => {
    const target = builder.target("value", 0, type, { kind: "read-write", storage: type, read: type, narrowing: null, evidenceIndex: null });
    const typed = builder.prefix(target, operator === "++" ? "PlusPlusToken" : "MinusMinusToken", type, decision);
    return builder.block(builder.returns({ ...typed, tsonic: { ...typed.tsonic, role: "update", storage: type } }));
  }, [["value", "required", type]], facts);
  const run = (numerator, deps = value.deps, body = value.body) => product.evaluate(deps, value.entry, body, [{
    kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false },
  }], "compile-time", value.unit);
  return { ...value, run };
}

test("selected increment and decrement pay for one native read and a bounded result", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [operator, boundary, wrapped, next] of [["++", 127n, -128n, 3n], ["--", -128n, 127n, 1n]]) {
    for (const law of ["wrap", "abort"]) {
      const value = integerUpdateFixture(operator, carrier, type, law);
      for (const [operand, result, required] of [[2n, next, 61], [boundary, law === "wrap" ? wrapped : null, 53]]) {
        for (let allowance = 0; allowance <= required; allowance += 1) {
          const evaluated = value.run(operand, { ...value.deps, limits: { ...limits, maximumArithmeticWork: allowance } });
          if (allowance < required) {
            assert.equal(evaluated.value.kind, "refused", `${operator} ${law} ${operand} work ${allowance}`);
            same(evaluated.value.diagnostics[0].arguments,
              [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: allowance }], "original selected update stop");
          } else {
            assert.equal(evaluated.value.kind, "ok", `${operator} ${law} ${operand} work ${allowance}`);
            same(evaluated.value.value.value, result === null ? { kind: "error", type } : {
              kind: "number", type, value: { numerator: result, denominator: 1n, negativeZero: false },
            }, "exact update result and selected failure");
          }
        }
      }
    }
  }
  const [wideCarrier, wide] = comparisonTypes.find(([name]) => name === "native-uint");
  const wideValue = integerUpdateFixture("++", wideCarrier, wide, "wrap");
  const supplied = { ...wideValue.deps, selectedNativeFacts: { ...wideValue.deps.selectedNativeFacts,
    nativeIntegerWidths: [{ carrier: wideCarrier, bits: 137 }] }, limits: { ...limits, maximumArithmeticWork: 1500 } };
  assert.equal(wideValue.run((1n << 137n) - 1n, supplied).value.value.value.value.numerator, 0n);
  assert.throws(() => wideValue.run(1n, { ...supplied, selectedNativeFacts: { ...supplied.selectedNativeFacts, nativeIntegerWidths: [] } }),
    /actual selected integer increment geometry/u);
});

test("an update cannot borrow a binary operation, unrelated destination or addition law", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = integerUpdateFixture("++", carrier, type, "wrap");
  const changed = () => {
    const body = structuredClone(value.body);
    const statement = body.blocks.flatMap(block => block.statements).find(row => row.kind === "assign" && row.value.kind === "unary");
    return { body, statement };
  };
  const binary = changed();
  binary.statement.value = { kind: "binary", operation: binary.statement.value.operation,
    left: binary.statement.value.operand, right: binary.statement.value.operand };
  assert.throws(() => value.run(1n, value.deps, binary.body), /one actual operand/u);
  const different = changed();
  different.statement.value.operation.decision.result = T.int32;
  assert.throws(() => value.run(1n, value.deps, different.body), /exact read and write carrier/u);
  assert.throws(() => value.run(1n, { ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    integerOverflow: [{ carrier, operation: "add", result: carrier, law: "wrap" }] } }), /integer increment/u);
});

function floatingUnaryFixture(name, operator, carrier, source, result, floatingFormats) {
  const selectedNativeFacts = { ...nativeFactsFixture(), integerOverflow: [], conversions: [], floatingFormats };
  const decision = selected({ kind: "native-operator", operator, carrier }, [source], result);
  const token = operator === "+" ? "PlusToken" : "MinusToken";
  const value = fixture(name, result, builder => builder.block(builder.returns(
    builder.prefix(builder.id("value", 0, source), token, result, decision))),
    [["value", "required", source]], selectedNativeFacts);
  return { ...value, run: (input, deps = value.deps, body = value.body) =>
    product.evaluate(deps, value.entry, body, [input], "compile-time", value.unit) };
}

test("native floating unary identity and negation retain exact selected encodings and finite bounds", () => {
  for (const [carrier, interchange, width, payloads] of [
    ["float16", "ieee754-binary16", 16, [[0x8000n, 0n], [1n, 0x8001n], [0x7c00n, 0xfc00n], [0xfe07n, 0x7e07n], [0x7c03n, 0xfc03n]]],
    ["float32", "ieee754-binary32", 32, [[0x80000000n, 0n], [1n, 0x80000001n], [0x7f800000n, 0xff800000n],
      [0xffc00007n, 0x7fc00007n], [0x7f800003n, 0xff800003n]]],
    ["float64", "ieee754-binary64", 64, [[0x8000000000000000n, 0n], [1n, 0x8000000000000001n], [0x7ff0000000000000n, 0xfff0000000000000n],
      [0xfff8000000000007n, 0x7ff8000000000007n], [0x7ff0000000000003n, 0xfff0000000000003n]]],
  ]) {
    const type = declareType(`evaluation.floatingUnary.${carrier}`, { kind: "primitive", primitive: carrier });
    const format = { carrier, interchange, nanSignObservable: true, nanPayloadObservable: true, signalingNaNObservable: true };
    for (const operator of ["+", "-"]) {
      const owner = floatingUnaryFixture(`evaluate.floatingUnary.${carrier}.${operator}`, operator, carrier, type, type, [format]);
      const base = { ...owner.deps, limits: { ...owner.deps.limits, maximumIntermediateBits: width, maximumResultBits: width } };
      for (const [bits, opposite] of payloads) {
        const input = { kind: "floating", type, bits };
        const result = owner.run(input, base);
        assert.equal(result.value.kind, "ok");
        if (operator === "+") assert.equal(result.value.value.value === input, true, "same-type identity borrows the actual bit value");
        else assert.deepEqual(result.value.value, { kind: "value", value: { kind: "floating", type, bits: opposite } });
        assert.equal(input.bits, bits);
        for (const field of ["maximumIntermediateBits", "maximumResultBits"]) {
          const stopped = owner.run(input, { ...base, limits: { ...base.limits, [field]: width - 1 } });
          assert.equal(stopped.value.kind, "refused");
          assert.deepEqual(stopped.value.diagnostics[0].arguments,
            [{ kind: "text", value: `evaluation.${field}` }, { kind: "number", value: width - 1 }]);
        }
      }
    }
  }
});

test("native floating unary operations prove a literal base and refuse crossed carriers", () => {
  const double = declareType("evaluation.floatingIdentity.base", { kind: "primitive", primitive: "float64" });
  const literal = declareType("evaluation.floatingIdentity.literal", {
    kind: "literal", value: { kind: "number", value: { numerator: 3n, denominator: 2n, negativeZero: false } }, base: double,
  });
  const format = nativeFactsFixture().floatingFormats[0];
  const single = declareType("evaluation.floatingIdentity.crossed", { kind: "primitive", primitive: "float32" });
  const singleFormat = { ...format, carrier: "float32", interchange: "ieee754-binary32" };
  const input = { kind: "floating", type: literal, bits: 0x3ff8000000000000n };
  for (const [operator, bits, exactWork] of [["+", input.bits, 20], ["-", 0xbff8000000000000n, 86]]) {
    const owner = floatingUnaryFixture(`evaluate.floatingUnary.literal.${operator}`, operator, "float64", literal, double, [singleFormat, format]);
    const complete = owner.run(input);
    assert.deepEqual(complete.value.value, { kind: "value", value: { kind: "floating", type: double, bits } });
    assert.equal(input.type, literal);
    for (let maximum = 0; maximum <= exactWork; maximum += 1) {
      const run = owner.run(input, { ...owner.deps, limits: { ...owner.deps.limits, maximumArithmeticWork: maximum } });
      if (maximum === exactWork) {
        assert.deepEqual(run, complete);
      } else {
        assert.equal(run.value.kind, "refused", String(maximum));
        assert.deepEqual(run.value.diagnostics[0].arguments,
          [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }]);
      }
    }
    const broken = structuredClone(owner.body);
    const decision = broken.blocks.flatMap(block => block.statements)
      .find(row => row.kind === "assign" && row.value.kind === "unary").value.operation.decision;
    decision.result = single;
    assert.throws(() => owner.run(input, owner.deps, broken), /actual Rules-selected unary floating result conversion association/u);
    decision.operation.carrier = "float32";
    assert.throws(() => owner.run(input, owner.deps, broken), /actual unchanged operand carrier/u);
  }
});

function identityFixture(name, carrier, type, operand, facts = nativeFactsFixture()) {
  const decision = selected({ kind: "native-operator", operator: "+", carrier }, [type], type);
  const value = fixture(name, type, builder => builder.block(builder.returns(
    builder.prefix(builder.num(String(operand), type), "PlusToken", type, decision))), [], facts);
  const deps = { ...value.deps, limits: { ...limits, maximumArithmeticWork: 10000 } };
  return { ...value, deps, run: (given = deps, body = value.body) => product.evaluate(given, value.entry, body, [], "compile-time", value.unit) };
}

function subtractionFixture(name, carrier, type, left, right, law = "wrap", result = type, resultCarrier = carrier) {
  const execution = law === "wrap" ? { kind: "pure" } : { kind: "invocation", writesStorage: false, failure: law };
  const decision = selected({ kind: "native-operator", operator: "-", carrier }, [type, type], result, execution);
  const value = fixture(name, result, builder => builder.block(builder.returns(builder.arithmetic(
    builder.num(String(left), type), "MinusToken", builder.num(String(right), type), result, decision))));
  const facts = { ...value.deps.selectedNativeFacts, integerOverflow: [{ carrier, operation: "subtract", result: resultCarrier, law }] };
  const deps = { ...value.deps, selectedNativeFacts: facts, limits: { ...limits, maximumArithmeticWork: 10000 } };
  return { ...value, deps, run: (given = deps, body = value.body) => product.evaluate(given, value.entry, body, [], "compile-time", value.unit) };
}

function multiplicationFixture(name, carrier, type, left, right, law = "wrap", result = type, resultCarrier = carrier) {
  const execution = law === "wrap" ? { kind: "pure" } : { kind: "invocation", writesStorage: false, failure: law };
  const decision = selected({ kind: "native-operator", operator: "*", carrier }, [type, type], result, execution);
  const value = fixture(name, result, builder => builder.block(builder.returns(builder.arithmetic(
    builder.num(String(left), type), "AsteriskToken", builder.num(String(right), type), result, decision))));
  const facts = { ...value.deps.selectedNativeFacts, integerOverflow: [{ carrier, operation: "multiply", result: resultCarrier, law }] };
  const deps = { ...value.deps, selectedNativeFacts: facts, limits: { ...limits, maximumArithmeticWork: 100000 } };
  return { ...value, deps, run: (given = deps, body = value.body) => product.evaluate(given, value.entry, body, [], "compile-time", value.unit) };
}

function divisionFixture(name, carrier, type, left, right, rounding = "toward-zero", zeroLaw = "unwind", overflowLaw = "wrap", result = type) {
  const decision = selected({ kind: "native-operator", operator: "/", carrier }, [type, type], result,
    { kind: "invocation", writesStorage: false, failure: zeroLaw });
  const value = fixture(name, result, builder => builder.block(builder.returns(builder.arithmetic(
    builder.num(String(left), type), "SlashToken", builder.num(String(right), type), result, decision))));
  const signed = ["int8", "int16", "int32", "int64", "int128", "native-int"].includes(carrier);
  const facts = { ...value.deps.selectedNativeFacts, divisionByZero: [{ carrier, law: zeroLaw }],
    divisionRounding: [{ carrier, rounding }], signedQuotientOverflow: signed ? [{ carrier, law: overflowLaw }] : [] };
  const deps = { ...value.deps, selectedNativeFacts: facts, limits: { ...limits, maximumArithmeticWork: 100000 } };
  return { ...value, deps, run: (given = deps, body = value.body) => product.evaluate(given, value.entry, body, [], "compile-time", value.unit) };
}

function bitwiseFixture(name, carrier, type, operator, left, right = null, result = type) {
  const unary = operator === "~";
  const decision = selected({ kind: "native-operator", operator, carrier }, unary ? [type] : [type, type], result);
  const value = fixture(name, result, builder => builder.block(builder.returns(unary
    ? builder.prefix(builder.num(String(left), type), "TildeToken", result, decision)
    : builder.arithmetic(builder.num(String(left), type),
      { "&": "AmpersandToken", "|": "BarToken", "^": "CaretToken" }[operator], builder.num(String(right), type), result, decision))));
  const deps = { ...value.deps, limits: { ...limits, maximumArithmeticWork: 100000 } };
  return { ...value, deps, run: (given = deps, body = value.body) => product.evaluate(given, value.entry, body, [], "compile-time", value.unit) };
}

function shiftFixture(name, carrier, type, left, count, law, nativeFacts = nativeFactsFixture(), operator = ">>") {
  const execution = law.kind === "mask" ? { kind: "pure" } : { kind: "invocation", writesStorage: false, failure: law.failure };
  const decision = selected({ kind: "native-operator", operator, carrier }, [type, type], type, execution);
  const token = operator === ">>" ? "GreaterThanGreaterThanToken" : "GreaterThanGreaterThanGreaterThanToken";
  const selectedNativeFacts = { ...nativeFacts, invalidShiftCount: [{ carrier, law }] };
  const value = fixture(name, type, builder => builder.block(builder.returns(builder.arithmetic(
    builder.num(String(left), type), token, builder.num(String(count), type), type, decision))), [], selectedNativeFacts);
  const deps = { ...value.deps, selectedNativeFacts, limits: { ...limits, maximumArithmeticWork: 100000 } };
  return { ...value, deps, run: (given = deps, body = value.body) => product.evaluate(given, value.entry, body, [], "compile-time", value.unit) };
}

function leftShiftFixture(name, source, destination, left, count, overflow, countLaw, nativeFacts = nativeFactsFixture()) {
  const [carrier, type] = source;
  const [resultCarrier, result] = destination;
  const failure = countLaw.kind === "fail" ? countLaw.failure : overflow === "wrap" ? null : overflow;
  const execution = failure === null ? { kind: "pure" } : { kind: "invocation", writesStorage: false, failure };
  const decision = selected({ kind: "native-operator", operator: "<<", carrier }, [type, type], result, execution);
  const selectedNativeFacts = { ...nativeFacts, invalidShiftCount: [{ carrier, law: countLaw }],
    integerOverflow: [{ carrier, operation: "left-shift", result: resultCarrier, law: overflow }] };
  const value = fixture(name, result, builder => builder.block(builder.returns(builder.arithmetic(
    builder.num(String(left), type), "LessThanLessThanToken", builder.num(String(count), type), result, decision))), [], selectedNativeFacts);
  const deps = { ...value.deps, limits: { ...limits, maximumArithmeticWork: 100000 } };
  return { ...value, deps, result, run: (given = deps) => product.evaluate(given, value.entry, value.body, [], "compile-time", value.unit) };
}

test("left shift evaluates inside the native widths, with independent count and value faults", () => {
  const [signedByte, signedWord, unsignedWord, native] = comparisonTypes;
  const mask = { kind: "mask", mask: 127n };
  const cases = [
    [signedByte, signedByte, 1n, 7n, "wrap", -128n],
    [signedByte, signedByte, -1n, 7n, "abort", -128n],
    [signedByte, signedByte, 1n, 7n, "abort", null],
    [signedByte, signedByte, -2n, 7n, "abort", null],
    [signedByte, unsignedWord, -1n, 0n, "wrap", 18446744073709551615n],
    [signedWord, signedByte, -1n, 8n, "wrap", 0n],
    [signedWord, signedByte, 0n, 8n, "abort", 0n],
    [signedWord, signedByte, -1n, 8n, "abort", null],
  ];
  for (const [ordinal, [source, result, left, count, law, expected]] of cases.entries()) {
    const value = leftShiftFixture(`evaluate.left-shift.${ordinal}`, source, result, left, count, law, mask);
    const maximumIntermediateBits = source === signedByte && result === signedByte ? 9 : 256;
    const evaluated = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumIntermediateBits } });
    assert.equal(evaluated.value.kind, "ok");
    if (expected === null) {
      assert.deepEqual(evaluated.value.value, { kind: "value", value: { kind: "error", type: value.result } });
      assert.match(evaluated.value.diagnostics[0].message, /process-ending integer overflow/u);
    } else {
      assert.equal(evaluated.value.value.value.value.numerator, expected);
      assert.deepEqual(evaluated.value.diagnostics, []);
    }
  }
  const supplied = { ...nativeFactsFixture(), nativeIntegerWidths: [{ carrier: "native-int", bits: 137 }] };
  const wide = leftShiftFixture("evaluate.left-shift.width", native, native, -1n, 136n, "abort", mask, supplied);
  assert.equal(wide.run().value.value.value.value.numerator, -(1n << 136n));
  assert.throws(() => wide.run({ ...wide.deps, selectedNativeFacts: { ...wide.deps.selectedNativeFacts, nativeIntegerWidths: [] } }),
    /actual selected integer left-shift geometry/u);
  const countFault = leftShiftFixture("evaluate.left-shift.count-first", signedByte, signedByte, 127n, 8n, "abort",
    { kind: "fail", failure: "abort" });
  assert.match(countFault.run().value.diagnostics[0].message, /process-ending invalid integer shift count/u);
});

test("left shift stops at every smaller arithmetic allowance before a native result", () => {
  const [signedByte, signedWord] = comparisonTypes;
  for (const [label, source, left, count, law, expected, operationWork] of [
    ["wrap", signedByte, -1n, 7n, "wrap", -128n, 103],
    ["abort", signedByte, -1n, 7n, "abort", -128n, 119],
    ["narrow", signedWord, 0n, 8n, "abort", 0n, 673],
  ]) {
    const exact = 2 + operationWork;
    const value = leftShiftFixture(`evaluate.left-shift.work.${label}`, source, signedByte, left, count, law, { kind: "mask", mask: 7n });
    const complete = value.run();
    assert.equal(complete.value.value.value.value.numerator, expected);
    for (let maximum = 0; maximum <= exact; maximum += 1) {
      const evaluated = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: maximum } });
      if (maximum === exact) {
        assert.deepEqual(evaluated, complete);
      } else {
        assert.equal(evaluated.value.kind, "refused", `${label}: ${maximum}`);
        assert.deepEqual(evaluated.value.diagnostics[0].arguments,
          [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }]);
      }
    }
  }
});

test("right shift uses selected carrier geometry and masks only the invalid count", () => {
  const mask = { kind: "mask", mask: 3n };
  for (const [left, count, expected] of [[-128n, 7n, -1n], [-56n, -1n, -7n], [72n, 10n, 18n], [72n, 8n, 72n]]) {
    const value = shiftFixture(`evaluate-shift-right.${left}.${count}`, "int8", comparisonTypes[0][1], left, count, mask);
    assert.equal(value.run().value.value.value.value.numerator, expected);
  }
  const unsigned = comparisonTypes.find(row => row[0] === "uint64");
  const high = shiftFixture("evaluate-shift-right.unsigned", unsigned[0], unsigned[1], 18446744073709551615n, 1n, mask);
  assert.equal(high.run().value.value.value.value.numerator, 9223372036854775807n);
  const native = comparisonTypes.find(row => row[0] === "native-int");
  const supplied = { ...nativeFactsFixture(), nativeIntegerWidths: [{ carrier: native[0], bits: 137 }] };
  const wide = shiftFixture("evaluate-shift-right.native-width", native[0], native[1], -(1n << 136n), 136n, mask, supplied);
  assert.equal(wide.run().value.value.value.value.numerator, -1n);
});

test("zero-fill right shift keeps the selected carrier width and preserves a zero-count bit pattern", () => {
  const [[carrier, type], , unsigned, native] = comparisonTypes;
  const mask = { kind: "mask", mask: 7n };
  const facts = nativeFactsFixture();
  for (const [left, count, expected, operationWork] of [
    [-128n, 0n, -128n, 86],
    [-1n, 1n, 127n, 102],
    [-56n, 8n, -56n, 110],
    [-56n, -1n, 1n, 118],
  ]) {
    const exact = 2 + operationWork;
    const value = shiftFixture(`evaluate-zero-fill.${left}.${count}`, carrier, type, left, count, mask, facts, ">>>");
    const successful = value.run();
    assert.deepEqual(successful.value.value, { kind: "value", value: { kind: "number", type,
      value: { numerator: expected, denominator: 1n, negativeZero: false } } });
    for (let maximum = 0; maximum <= exact; maximum += 1) {
      const limited = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: maximum } });
      if (maximum === exact) assert.deepEqual(limited, successful);
      else {
        assert.equal(limited.value.kind, "refused", `${left}/${count}/${maximum}`);
        assert.deepEqual(limited.value.diagnostics[0].arguments,
          [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }]);
      }
    }
  }
  const high = shiftFixture("evaluate-zero-fill.unsigned", unsigned[0], unsigned[1], 18446744073709551615n, 63n, mask, facts, ">>>");
  assert.equal(high.run().value.value.value.value.numerator, 1n);
  const supplied = { ...facts, nativeIntegerWidths: [{ carrier: native[0], bits: 137 }] };
  const wide = shiftFixture("evaluate-zero-fill.native-width", native[0], native[1], -(1n << 136n), 136n, mask, supplied, ">>>");
  assert.equal(wide.run().value.value.value.value.numerator, 1n);
  assert.throws(() => wide.run({ ...wide.deps, selectedNativeFacts: { ...wide.deps.selectedNativeFacts, invalidShiftCount: [] } }),
    /actual selected integer shift count law/u);
});

test("right shift preserves both failure arms and every smaller work allowance", () => {
  const [carrier, type] = comparisonTypes[0];
  const mask = { kind: "mask", mask: 3n };
  for (const [count, law] of [[3n, mask], [11n, mask], [-1n, mask], [8n, { kind: "fail", failure: "abort" }],
    [-1n, { kind: "fail", failure: "unwind" }]]) {
    const value = shiftFixture(`evaluate-shift-right.work.${count}.${law.kind}`, carrier, type, -56n, count, law);
    const complete = value.run();
    if (law.kind === "fail") {
      assert.deepEqual(complete.value.value, { kind: "value", value: { kind: "error", type } });
      assert.match(complete.value.diagnostics[0].message, law.failure === "abort" ? /process-ending invalid integer shift count/u
        : /invalid integer shift count escaped/u);
    }
    let admitted = false;
    for (let maximum = 0; maximum < 256; maximum += 1) {
      const selected = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: maximum } });
      if (selected.value.kind === "ok") {
        assert.deepEqual(selected, complete);
        admitted = true;
        break;
      }
      assert.equal(selected.value.kind, "refused");
      assert.deepEqual(selected.value.diagnostics[0].arguments,
        [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }]);
    }
    assert.equal(admitted, true);
  }
});

test("right shift requires the actual ready count law and never silently repairs an invalid mask", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = shiftFixture("evaluate-shift-right.invalid-law", carrier, type, -56n, 8n, { kind: "mask", mask: 3n });
  const rows = invalidShiftCount => ({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, invalidShiftCount } });
  assert.throws(() => value.run(rows([])), /actual selected integer shift count law/u);
  for (const mask of [-1n, 256n])
    assert.throws(() => value.run(rows([{ carrier, law: { kind: "mask", mask } }])), /supplied mask to fit/u);
  assert.throws(() => value.run(rows([{ carrier, law: { kind: "mask", mask: 8n } }])), /mask does not produce a valid count/u);
  assert.throws(() => value.run(rows([{ carrier, law: { kind: "fail", failure: "abort" } }])), /operation marked unable to fail/u);
  const unread = new Proxy([], { get() { assert.fail("No native shift count is read after the original stop."); } });
  const stopped = value.run({ ...rows(unread), limits: { ...value.deps.limits, maximumArithmeticWork: 1 } });
  assert.equal(stopped.value.kind, "refused");
});

function remainderFixture(name, carrier, type, left, right, sign = "dividend", zeroLaw = "unwind", result = type, nativeFacts = nativeFactsFixture()) {
  const decision = selected({ kind: "native-operator", operator: "%", carrier }, [type, type], result,
    { kind: "invocation", writesStorage: false, failure: zeroLaw });
  const value = fixture(name, result, builder => builder.block(builder.returns(builder.arithmetic(
    builder.num(String(left), type), "PercentToken", builder.num(String(right), type), result, decision))), [], nativeFacts);
  const facts = { ...value.deps.selectedNativeFacts, remainderByZero: [{ carrier, law: zeroLaw }], remainderSign: [{ carrier, sign }] };
  const deps = { ...value.deps, selectedNativeFacts: facts, limits: { ...limits, maximumArithmeticWork: 100000 } };
  return { ...value, deps, run: (given = deps, body = value.body) => product.evaluate(given, value.entry, body, [], "compile-time", value.unit) };
}

test("integer remainder consumes its supplied sign law on actual lowered MIR", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [left, right, dividend, divisor, nonnegative] of [[7n, 3n, 1n, 1n, 1n], [-7n, 3n, -1n, 2n, 2n],
    [7n, -3n, 1n, -2n, 1n], [-7n, -3n, -1n, -1n, 2n], [-128n, -1n, 0n, 0n, 0n], [0n, -128n, 0n, 0n, 0n],
    [127n, -128n, 127n, -1n, 127n], [-1n, -128n, -1n, -1n, 127n]]) {
    for (const [sign, expected] of [["dividend", dividend], ["divisor", divisor], ["nonnegative", nonnegative]]) {
      const value = remainderFixture(`evaluate-remainder.${left}.${right}.${sign}`, carrier, type, left, right, sign);
      same(value.run().value.value, { kind: "value", value: { kind: "number", type,
        value: { numerator: expected, denominator: 1n, negativeZero: false } } }, "actual supplied native remainder sign");
    }
  }
  for (const [carrier, type] of comparisonTypes.slice(1)) {
    const value = remainderFixture(`evaluate-remainder.wide.${carrier}`, carrier, type, 9007199254740995n, 3n);
    assert.equal(value.run().value.value.value.value.numerator, 2n);
    if (carrier === "native-int" || carrier === "native-uint") {
      const narrow = remainderFixture(`evaluate-remainder.supplied.${carrier}`, carrier, type, 255n, 7n);
      assert.equal(narrow.run({ ...narrow.deps, selectedNativeFacts: { ...narrow.deps.selectedNativeFacts,
        nativeIntegerWidths: [{ carrier, bits: 9 }] } }).value.value.value.value.numerator, 3n);
      const wide = remainderFixture(`evaluate-remainder.supplied-wide.${carrier}`, carrier, type, (1n << 120n) + 3n, 7n,
        "dividend", "unwind", type, { ...nativeFactsFixture(), nativeIntegerWidths: [{ carrier, bits: 137 }] });
      assert.equal(wide.run().value.value.value.value.numerator, 4n);
    }
  }
  const unsigned = comparisonTypes.find(row => row[0] === "uint64");
  const maximum = remainderFixture("evaluate-remainder.unsigned-high", unsigned[0], unsigned[1], 18446744073709551615n, 7n);
  assert.equal(maximum.run().value.value.value.value.numerator, 1n);
  const native = comparisonTypes.find(row => row[0] === "native-int");
  const oneBit = remainderFixture("evaluate-remainder.onebit", native[0], native[1], -1n, -1n);
  assert.equal(oneBit.run({ ...oneBit.deps, selectedNativeFacts: { ...oneBit.deps.selectedNativeFacts,
    nativeIntegerWidths: [{ carrier: native[0], bits: 1 }] } }).value.value.value.value.numerator, 0n);
});

test("integer remainder zero follows its own selected failure without borrowing a quotient or sign law", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const law of ["unwind", "abort"]) {
    const value = remainderFixture(`evaluate-remainder.zero.${law}`, carrier, type, 1n, 0n, "dividend", law);
    const facts = { ...value.deps.selectedNativeFacts };
    for (const field of ["remainderSign", "divisionByZero", "divisionRounding", "signedQuotientOverflow", "integerOverflow"])
      Object.defineProperty(facts, field, { get() { assert.fail(`Remainder zero does not read ${field}.`); } });
    const result = value.run({ ...value.deps, selectedNativeFacts: facts });
    assert.equal(result.value.value.value.kind, "error");
    assert.equal(result.value.diagnostics[0].message.includes("remainder by zero"), true);
    assert.equal(result.value.diagnostics[0].code.name, "TSONIC_CONSTANT_EVALUATION_FAILED");
    const malformed = structuredClone(value.body);
    const operation = malformed.blocks.find(block => block.terminator.kind === "invoke").terminator;
    operation.unwind = { kind: "none" };
    assert.throws(() => value.run(value.deps, malformed), /marked unable to fail/u);
    operation.unwind = { kind: law === "abort" ? "escape" : "abort" };
    assert.throws(() => value.run(value.deps, malformed), /selected failure arm disagree/u);
  }
  const value = remainderFixture("evaluate-remainder.caught-value", carrier, type, 1n, 0n);
  const body = structuredClone(value.body);
  body.blocks.find(block => block.terminator.kind === "invoke").terminator.unwind = { kind: "handler", target: 0, exception: 0 };
  assert.throws(() => value.run(value.deps, body), /actual selected remainder-by-zero fault value/u);
});

test("integer remainder admits every width-dependent operation before the original finite allowance", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [left, right, sign, operationWork] of [[-7n, 3n, "dividend", 134], [-6n, 3n, "divisor", 142],
    [-6n, 3n, "nonnegative", 142], [7n, 3n, "divisor", 158], [-7n, 3n, "divisor", 166],
    [7n, 3n, "nonnegative", 150], [-7n, 3n, "nonnegative", 166], [-7n, -3n, "nonnegative", 174]]) {
    const value = remainderFixture(`evaluate-remainder.work.${left}.${right}.${sign}`, carrier, type, left, right, sign);
    const needed = 2 + operationWork;
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const result = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: maximum } });
      assert.equal(result.value.kind, maximum < needed ? "refused" : "ok", `actual remainder work ${left}/${right}/${sign}/${maximum}`);
      if (maximum < needed) same(result.value.diagnostics[0].arguments,
        [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }], "original remainder allowance");
    }
  }
  for (const [law, operationWork] of [["abort", 70], ["unwind", 71]]) {
    const needed = 2 + operationWork;
    const zero = remainderFixture(`evaluate-remainder.zero-work.${law}`, carrier, type, 1n, 0n, "dividend", law);
    for (let maximum = 0; maximum <= needed; maximum += 1)
      assert.equal(zero.run({ ...zero.deps, limits: { ...zero.deps.limits, maximumArithmeticWork: maximum } }).value.kind,
        maximum < needed ? "refused" : "ok");
  }
  const value = remainderFixture("evaluate-remainder.bits", carrier, type, 7n, 3n);
  for (const [dimension, needed] of [["maximumIntermediateBits", 8], ["maximumResultBits", 2]])
    for (let maximum = 0; maximum <= needed; maximum += 1)
      assert.equal(value.run({ ...value.deps, limits: { ...value.deps.limits, [dimension]: maximum } }).value.kind,
        maximum < needed ? "refused" : "ok");
  const unread = [];
  unread.length = 10000;
  Object.defineProperty(unread, 0, { get() { assert.fail("No unadmitted remainder row."); } });
  for (const [right, field] of [[3n, "remainderSign"], [0n, "remainderByZero"]]) {
    const guarded = remainderFixture(`evaluate-remainder.unread.${field}`, carrier, type, 7n, right);
    assert.equal(guarded.run({ ...guarded.deps, selectedNativeFacts: { ...guarded.deps.selectedNativeFacts, [field]: unread },
      limits: { ...guarded.deps.limits, maximumArithmeticWork: 69 } }).value.kind, "refused");
  }
  assert.equal(value.run({ ...value.deps, typeOf() { assert.fail("No type payload after original refusal."); },
    limits: { ...value.deps.limits, maximumArithmeticWork: 0 } }).value.kind, "refused");
  const native = comparisonTypes.find(row => row[0] === "native-int");
  const huge = remainderFixture("evaluate-remainder.huge-width", native[0], native[1], 7n, 3n);
  assert.equal(huge.run({ ...huge.deps, selectedNativeFacts: { ...huge.deps.selectedNativeFacts,
    nativeIntegerWidths: [{ carrier: native[0], bits: Number.MAX_SAFE_INTEGER }] } }).value.kind, "refused");
});

test("integer remainder requires actual sign, zero and result association without unrelated numeric assumptions", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = remainderFixture("evaluate-remainder.ready-inputs", carrier, type, -128n, -1n);
  const facts = { ...value.deps.selectedNativeFacts };
  for (const field of ["remainderByZero", "integerOverflow", "divisionByZero", "divisionRounding", "signedQuotientOverflow"])
    Object.defineProperty(facts, field, { get() { assert.fail(`Nonzero remainder does not read ${field}.`); } });
  assert.equal(value.run({ ...value.deps, selectedNativeFacts: facts }).value.value.value.value.numerator, 0n);
  for (const rows of [[], [{ carrier: "uint8", sign: "dividend" }], [{ carrier, sign: "unselected" }]])
    assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, remainderSign: rows } }),
      /actual selected integer remainder sign law/u);
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    remainderSign: [undefined] } }), /complete selected integer remainder sign relation/u);
  assert.equal(value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    remainderSign: [{ carrier: "uint8", sign: "nonnegative" }, { carrier, sign: "dividend" }] } }).value.value.value.value.numerator, 0n);
  const zero = remainderFixture("evaluate-remainder.missing-zero", carrier, type, 1n, 0n);
  for (const rows of [[], [{ carrier, law: "ieee754" }]])
    assert.throws(() => zero.run({ ...zero.deps, selectedNativeFacts: { ...zero.deps.selectedNativeFacts, remainderByZero: rows } }),
      /actual selected integer remainder-by-zero law/u);
  const cross = remainderFixture("evaluate-remainder.unselected-result", carrier, type, 7n, 3n, "dividend", "unwind", T.int32);
  assert.throws(() => cross.run(), /actual Rules-selected integer remainder result conversion association/u);
  assert.throws(() => value.run({ ...value.deps, typeOf: () => ({ kind: "shape", members: [], indexes: [], calls: [], constructs: [] }) }),
    /actual selected integer result carrier association/u);
  const malformed = structuredClone(value.body);
  const operation = malformed.blocks.find(block => block.terminator.kind === "invoke").terminator;
  operation.operands.pop();
  assert.throws(() => value.run(value.deps, malformed), /two actual operands/u);
  operation.operands.push(structuredClone(value.body.blocks.find(block => block.terminator.kind === "invoke").terminator.operands[1]));
  operation.operation.decision.operation.carrier = "bool";
  operation.operation.decision.result = T.bool;
  assert.throws(() => value.run(value.deps, malformed), /actual selected integer remainder geometry/u);
});

test("selected bitwise integer operations retain their full native carrier instead of host32 coercion", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [operator, left, right, expected] of [["&", 5n, 3n, 1n], ["|", 5n, 3n, 7n], ["^", 5n, 3n, 6n],
    ["&", -128n, 127n, 0n], ["|", -128n, 127n, -1n], ["^", -128n, 127n, -1n],
    ["&", -1n, 127n, 127n], ["^", -1n, -128n, 127n], ["~", 5n, null, -6n],
    ["~", -128n, null, 127n], ["~", 127n, null, -128n]]) {
    const value = bitwiseFixture(`evaluate-bitwise.${operator}.${left}.${right}`, carrier, type, operator, left, right);
    same(value.run().value.value, { kind: "value", value: { kind: "number", type,
      value: { numerator: expected, denominator: 1n, negativeZero: false } } }, "actual selected native bit pattern");
  }
  for (const [carrier, type] of comparisonTypes.slice(1)) {
    for (const [operator, expected] of [["&", 9007199254740992n], ["|", 9007199254740993n], ["^", 1n]]) {
      const value = bitwiseFixture(`evaluate-bitwise.wide.${carrier}.${operator}`, carrier, type, operator, 9007199254740993n, 9007199254740992n);
      assert.equal(value.run().value.value.value.value.numerator, expected);
    }
    const unsigned = carrier === "uint64" || carrier === "native-uint";
    const complement = bitwiseFixture(`evaluate-bitwise.complement.${carrier}`, carrier, type, "~", 9007199254740993n);
    const width = carrier === "native-int" || carrier === "native-uint"
      ? complement.deps.selectedNativeFacts.nativeIntegerWidths.find(row => row.carrier === carrier).bits : 64;
    assert.equal(complement.run().value.value.value.value.numerator,
      unsigned ? (1n << BigInt(width)) - 9007199254740994n : -9007199254740994n);
    if (carrier === "native-int" || carrier === "native-uint") {
      const narrow = bitwiseFixture(`evaluate-bitwise.supplied.${carrier}`, carrier, type, "~", 1n);
      assert.equal(narrow.run({ ...narrow.deps, selectedNativeFacts: { ...narrow.deps.selectedNativeFacts,
        nativeIntegerWidths: [{ carrier, bits: 9 }] } }).value.value.value.value.numerator, unsigned ? 510n : -2n);
    }
  }
});

test("integer bitwise operations pay each represented operand width before the original allowance boundary", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [operator, right, operationWork] of [["&", 3n, 77], ["|", 3n, 77], ["^", 3n, 77], ["~", null, 52]]) {
    const needed = (right === null ? 1 : 2) + operationWork;
    const value = bitwiseFixture(`evaluate-bitwise.work.${operator}`, carrier, type, operator, 5n, right);
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const result = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: maximum } });
      assert.equal(result.value.kind, maximum < needed ? "refused" : "ok", `actual bitwise work ${operator}/${maximum}`);
      if (maximum < needed) same(result.value.diagnostics[0].arguments,
        [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }], "original bitwise refusal");
    }
  }
  const value = bitwiseFixture("evaluate-bitwise.bits", carrier, type, "^", 5n, 3n);
  for (const [dimension, needed] of [["maximumIntermediateBits", 8], ["maximumResultBits", 4]])
    for (let maximum = 0; maximum <= needed; maximum += 1)
      assert.equal(value.run({ ...value.deps, limits: { ...value.deps.limits, [dimension]: maximum } }).value.kind,
        maximum < needed ? "refused" : "ok");
});

test("integer bitwise operations do not borrow unrelated native policies or invent a result conversion", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = bitwiseFixture("evaluate-bitwise.ready-inputs", carrier, type, "^", 5n, 3n);
  const facts = { ...value.deps.selectedNativeFacts };
  for (const field of ["integerOverflow", "divisionByZero", "divisionRounding", "signedQuotientOverflow"])
    Object.defineProperty(facts, field, { get() { assert.fail(`No irrelevant ${field} row for a bitwise operation.`); } });
  assert.equal(value.run({ ...value.deps, selectedNativeFacts: facts }).value.value.value.value.numerator, 6n);
  const cross = bitwiseFixture("evaluate-bitwise.unselected-result", carrier, type, "^", 5n, 3n, T.int32);
  assert.throws(() => cross.run(), /actual Rules-selected integer bitwise result conversion association/u);
  assert.throws(() => value.run({ ...value.deps, typeOf: () => ({ kind: "shape", members: [], indexes: [], calls: [], constructs: [] }) }),
    /actual selected integer result carrier association/u);
  const malformed = structuredClone(value.body);
  const operation = malformed.blocks.flatMap(block => block.statements).find(statement => statement.value?.kind === "binary").value;
  operation.operation.decision.operation.carrier = "bool";
  operation.operation.decision.result = T.bool;
  assert.throws(() => value.run(value.deps, malformed), /actual selected integer bitwise geometry/u);
  const wrongArity = bitwiseFixture("evaluate-bitwise.unary-arity", carrier, type, "~", 5n);
  const body = structuredClone(wrongArity.body);
  body.blocks.flatMap(block => block.statements).find(statement => statement.value?.kind === "unary").value.operation.decision.operation.operator = "^";
  assert.throws(() => wrongArity.run(wrongArity.deps, body), /actual operand inventory/u);
});

test("selected integer division executes the actual supplied quotient law on genuine lowered MIR", () => {
  const [carrier, type] = comparisonTypes[0];
  const roundings = ["toward-zero", "floor", "ceiling", "nearest-even", "nearest-away"];
  const cases = [[7n, 3n, [2n, 2n, 3n, 2n, 2n], [-2n, -3n, -2n, -2n, -2n]],
    [8n, 3n, [2n, 2n, 3n, 3n, 3n], [-2n, -3n, -2n, -3n, -3n]],
    [1n, 2n, [0n, 0n, 1n, 0n, 1n], [0n, -1n, 0n, 0n, -1n]],
    [3n, 2n, [1n, 1n, 2n, 2n, 2n], [-1n, -2n, -1n, -2n, -2n]],
    [5n, 2n, [2n, 2n, 3n, 2n, 3n], [-2n, -3n, -2n, -2n, -3n]],
    [6n, 3n, [2n, 2n, 2n, 2n, 2n], [-2n, -2n, -2n, -2n, -2n]],
    [0n, 3n, [0n, 0n, 0n, 0n, 0n], [0n, 0n, 0n, 0n, 0n]]];
  for (const [left, right, positive, negative] of cases)
    for (const [leftSign, rightSign] of [[1n, 1n], [-1n, 1n], [1n, -1n], [-1n, -1n]])
      for (const [index, rounding] of roundings.entries()) {
        const value = divisionFixture(`evaluate-division.${left}.${right}.${leftSign}.${rightSign}.${rounding}`,
          carrier, type, left * leftSign, right * rightSign, rounding);
        same(value.run().value.value, { kind: "value", value: { kind: "number", type,
          value: { numerator: (leftSign === rightSign ? positive : negative)[index], denominator: 1n, negativeZero: false } } },
        "exact supplied rounding in both signs, including ties and native zero");
      }
  for (const [carrier, type] of comparisonTypes.slice(1)) {
    const value = divisionFixture(`evaluate-division.wide.${carrier}`, carrier, type, 9007199254740993n, 2n, "nearest-away");
    assert.equal(value.run().value.value.value.value.numerator, 4503599627370497n);
    if (carrier === "native-int" || carrier === "native-uint") {
      const narrow = divisionFixture(`evaluate-division.supplied.${carrier}`, carrier, type, 255n, 2n, "ceiling");
      assert.equal(narrow.run({ ...narrow.deps, selectedNativeFacts: { ...narrow.deps.selectedNativeFacts,
        nativeIntegerWidths: [{ carrier, bits: 9 }] } }).value.value.value.value.numerator, 128n);
    }
  }
  const unsigned = comparisonTypes.find(row => row[0] === "uint64");
  const high = divisionFixture("evaluate-division.unsigned-high", unsigned[0], unsigned[1], 18446744073709551615n, 2n, "nearest-even");
  assert.equal(high.run().value.value.value.value.numerator, 9223372036854775808n);
});

test("integer division keeps zero and signed quotient overflow on their distinct supplied failure arms", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const law of ["wrap", "unwind", "abort"]) {
    const value = divisionFixture(`evaluate-division.minimum.${law}`, carrier, type, -128n, -1n,
      "toward-zero", law === "wrap" ? "unwind" : law, law);
    const result = value.run();
    if (law === "wrap") assert.equal(result.value.value.value.value.numerator, -128n);
    else {
      assert.equal(result.value.value.value.kind, "error");
      assert.equal(result.value.diagnostics[0].code.name, "TSONIC_CONSTANT_EVALUATION_FAILED");
    }
    const facts = { ...value.deps.selectedNativeFacts,
      get divisionRounding() { assert.fail("Signed quotient overflow does not infer a rounding law."); } };
    assert.equal(value.run({ ...value.deps, selectedNativeFacts: facts }).value.kind, "ok");
  }
  const exactMinimum = divisionFixture("evaluate-division.minimum-exact", carrier, type, -128n, 2n);
  assert.equal(exactMinimum.run().value.value.value.value.numerator, -64n);
  for (const law of ["unwind", "abort"]) {
    const zero = divisionFixture(`evaluate-division.zero.${law}`, carrier, type, 1n, 0n, "toward-zero", law);
    const facts = { ...zero.deps.selectedNativeFacts,
      get divisionRounding() { assert.fail("Division by zero has no invented rounded value."); },
      get signedQuotientOverflow() { assert.fail("Zero does not read the signed quotient-overflow relation."); } };
    const result = zero.run({ ...zero.deps, selectedNativeFacts: facts });
    assert.equal(result.value.value.value.kind, "error");
    assert.equal(result.value.diagnostics[0].message.includes("division by zero"), true);
    const malformed = structuredClone(zero.body);
    const operation = malformed.blocks.find(block => block.terminator.kind === "invoke").terminator;
    operation.unwind = { kind: "none" };
    assert.throws(() => zero.run(zero.deps, malformed), /marked unable to fail/u);
    operation.unwind = { kind: law === "abort" ? "escape" : "abort" };
    assert.throws(() => zero.run(zero.deps, malformed), /selected failure arm disagree/u);
  }
  const zero = divisionFixture("evaluate-division.caught-value", carrier, type, 1n, 0n);
  const body = structuredClone(zero.body);
  body.blocks.find(block => block.terminator.kind === "invoke").terminator.unwind = { kind: "handler", target: 0, exception: 0 };
  assert.throws(() => zero.run(zero.deps, body), /actual selected division-by-zero fault value/u);
  const native = comparisonTypes.find(row => row[0] === "native-int");
  const oneBit = divisionFixture("evaluate-division.onebit", native[0], native[1], -1n, -1n);
  assert.equal(oneBit.run({ ...oneBit.deps, selectedNativeFacts: { ...oneBit.deps.selectedNativeFacts,
    nativeIntegerWidths: [{ carrier: native[0], bits: 1 }] } }).value.value.value.value.numerator, -1n);
});

test("integer division precharges every quotient, residual, rounding and row read on the same finite allowance", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [left, right, rounding, operationWork] of [[8n, 2n, "toward-zero", 142], [6n, 3n, "floor", 214],
    [-7n, 3n, "floor", 238], [7n, 3n, "floor", 230], [8n, 3n, "nearest-even", 262],
    [-8n, 3n, "nearest-even", 270], [8n, -3n, "nearest-even", 270], [-8n, -3n, "nearest-even", 278],
    [1n, 2n, "nearest-even", 263], [3n, 2n, "nearest-even", 271], [-128n, -1n, "toward-zero", 86]]) {
    const value = divisionFixture(`evaluate-division.work.${left}.${right}.${rounding}`, carrier, type, left, right, rounding);
    const needed = 2 + operationWork;
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const result = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: maximum } });
      assert.equal(result.value.kind, maximum < needed ? "refused" : "ok", `actual quotient work ${left}/${right}/${maximum}`);
      if (maximum < needed) same(result.value.diagnostics[0].arguments,
        [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }], "original quotient allowance");
    }
  }
  for (const [law, operationWork] of [["abort", 70], ["unwind", 71]]) {
    const needed = 2 + operationWork;
    const zero = divisionFixture(`evaluate-division.zero-work.${law}`, carrier, type, 1n, 0n, "toward-zero", law);
    for (let maximum = 0; maximum <= needed; maximum += 1)
      assert.equal(zero.run({ ...zero.deps, limits: { ...zero.deps.limits, maximumArithmeticWork: maximum } }).value.kind,
        maximum < needed ? "refused" : "ok");
  }
  const value = divisionFixture("evaluate-division.bits", carrier, type, 8n, 2n);
  for (const [dimension, needed] of [["maximumIntermediateBits", 8], ["maximumResultBits", 4]])
    for (let maximum = 0; maximum <= needed; maximum += 1)
      assert.equal(value.run({ ...value.deps, limits: { ...value.deps.limits, [dimension]: maximum } }).value.kind,
        maximum < needed ? "refused" : "ok");
  const unread = [];
  unread.length = 10000;
  Object.defineProperty(unread, 0, { get() { assert.fail("No unadmitted selected quotient row."); } });
  assert.equal(value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, divisionRounding: unread },
    limits: { ...value.deps.limits, maximumArithmeticWork: 77 } }).value.kind, "refused");
  const row = { carrier, get rounding() { assert.fail("No rounding payload after division-work refusal."); } };
  assert.equal(value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, divisionRounding: [row] },
    limits: { ...value.deps.limits, maximumArithmeticWork: 78 } }).value.kind, "refused");
});

test("integer division does not invent missing rounding, failure, representation or result-conversion evidence", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = divisionFixture("evaluate-division.ready-inputs", carrier, type, 8n, 2n);
  for (const rows of [[], [{ carrier: "uint8", rounding: "toward-zero" }]])
    assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, divisionRounding: rows } }),
      /actual selected integer division rounding law/u);
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    divisionRounding: [undefined] } }), /complete selected integer division rounding relation/u);
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    divisionRounding: [{ carrier, rounding: "unselected-rounding" }] } }), /actual selected integer division rounding law/u);
  assert.equal(value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    divisionByZero: [], signedQuotientOverflow: [], divisionRounding: [{ carrier: "uint8", rounding: "floor" },
      { carrier, rounding: "toward-zero" }] } }).value.value.value.value.numerator, 4n);
  const zero = divisionFixture("evaluate-division.missing-zero-law", carrier, type, 1n, 0n);
  assert.throws(() => zero.run({ ...zero.deps, selectedNativeFacts: { ...zero.deps.selectedNativeFacts, divisionByZero: [] } }),
    /actual selected integer division-by-zero law/u);
  assert.throws(() => zero.run({ ...zero.deps, selectedNativeFacts: { ...zero.deps.selectedNativeFacts,
    divisionByZero: [{ carrier, law: "ieee754" }] } }), /actual selected integer division-by-zero law/u);
  const minimum = divisionFixture("evaluate-division.missing-overflow-law", carrier, type, -128n, -1n);
  assert.throws(() => minimum.run({ ...minimum.deps, selectedNativeFacts: { ...minimum.deps.selectedNativeFacts, signedQuotientOverflow: [] } }),
    /actual selected signed integer quotient overflow law/u);
  const cross = divisionFixture("evaluate-division.missing-conversion", carrier, type, 8n, 2n, "toward-zero", "unwind", "wrap", T.int32);
  assert.throws(() => cross.run(), /actual Rules-selected integer quotient result conversion association/u);
  assert.throws(() => value.run({ ...value.deps, typeOf: () => ({ kind: "shape", members: [], indexes: [], calls: [], constructs: [] }) }),
    /actual selected integer result carrier association/u);
  const malformed = structuredClone(value.body);
  const operation = malformed.blocks.find(block => block.terminator.kind === "invoke").terminator;
  operation.operands.pop();
  assert.throws(() => value.run(value.deps, malformed), /two actual operands/u);
  operation.operands.push(structuredClone(value.body.blocks.find(block => block.terminator.kind === "invoke").terminator.operands[1]));
  operation.operation.decision.operation.carrier = "bool";
  operation.operation.decision.result = T.bool;
  assert.throws(() => value.run(value.deps, malformed), /actual selected integer division geometry/u);
});

test("selected integer multiplication executes the actual supplied law on genuine lowered MIR", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [left, right, expected] of [[3n, 2n, 6n], [-3n, 2n, -6n], [-3n, -2n, 6n], [0n, -128n, 0n],
    [-128n, -1n, -128n], [-128n, 2n, 0n], [127n, 2n, -2n], [-127n, 2n, 2n]]) {
    const value = multiplicationFixture(`evaluate-multiplication.${left}.${right}`, carrier, type, left, right);
    same(value.run().value.value, { kind: "value", value: { kind: "number", type,
      value: { numerator: expected, denominator: 1n, negativeZero: false } } }, "actual selected native product");
  }
  for (const [carrier, type] of comparisonTypes.slice(1)) {
    const value = multiplicationFixture(`evaluate-multiplication.wide.${carrier}`, carrier, type, 9007199254740993n, 2n);
    assert.equal(value.run().value.value.value.value.numerator, 18014398509481986n);
    if (carrier === "native-int" || carrier === "native-uint") {
      const narrow = multiplicationFixture(`evaluate-multiplication.supplied.${carrier}`, carrier, type, 255n, 2n);
      assert.equal(narrow.run({ ...narrow.deps, selectedNativeFacts: { ...narrow.deps.selectedNativeFacts,
        nativeIntegerWidths: [{ carrier, bits: 9 }] } }).value.value.value.value.numerator,
      carrier === "native-int" ? -2n : 510n);
    }
  }
  const unsigned = comparisonTypes.find(row => row[0] === "uint64");
  const high = multiplicationFixture("evaluate-multiplication.unsigned-high", unsigned[0], unsigned[1], 18446744073709551615n, 2n);
  assert.equal(high.run().value.value.value.value.numerator, 18446744073709551614n);
});

test("integer multiplication applies the complete product's selected result and failure laws", () => {
  const [carrier, type] = comparisonTypes[0];
  const unsigned = comparisonTypes.find(row => row[0] === "uint64");
  for (const law of ["wrap", "unwind", "abort"]) {
    for (const [left, right] of [[127n, 2n], [-127n, 2n], [-128n, -1n]]) {
      const value = multiplicationFixture(`evaluate-multiplication.overflow.${law}.${left}`, carrier, type, left, right, law);
      const result = value.run();
      if (law === "wrap") assert.equal(result.value.value.value.kind, "number");
      else {
        assert.equal(result.value.value.value.kind, "error");
        assert.equal(result.value.diagnostics[0].code.name, "TSONIC_CONSTANT_EVALUATION_FAILED");
      }
    }
    const widened = multiplicationFixture(`evaluate-multiplication.widen.${law}`, carrier, type, 127n, 127n, law, T.int32, "int32");
    assert.equal(widened.run().value.value.value.value.numerator, 16129n);
    const narrowed = multiplicationFixture(`evaluate-multiplication.cancel.${law}`, "int32", T.int32, 1000n, 0n, law, type, carrier);
    assert.equal(narrowed.run().value.value.value.value.numerator, 0n);
    const changedSign = multiplicationFixture(`evaluate-multiplication.changed-sign.${law}`, carrier, type, -3n, -2n, law, unsigned[1], unsigned[0]);
    assert.equal(changedSign.run().value.value.value.value.numerator, 6n);
    const signed = multiplicationFixture(`evaluate-multiplication.unsigned-to-signed.${law}`, unsigned[0], unsigned[1], 1n, 2n, law, type, carrier);
    assert.equal(signed.run().value.value.value.value.numerator, 2n);
  }
  const narrowWrap = multiplicationFixture("evaluate-multiplication.narrow-wrap", "int32", T.int32, 1000n, 2n, "wrap", type, carrier);
  assert.equal(narrowWrap.run().value.value.value.value.numerator, -48n);
  const trapped = multiplicationFixture("evaluate-multiplication.caught-value", carrier, type, 127n, 2n, "unwind");
  const body = structuredClone(trapped.body);
  body.blocks.find(block => block.terminator.kind === "invoke").terminator.unwind = { kind: "handler", target: 0, exception: 0 };
  assert.throws(() => trapped.run(trapped.deps, body), /actual selected overflow fault value/u);
});

test("integer multiplication admits quadratic work and temporary magnitude before building a product", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [left, right, operationWork] of [[3n, 2n, 158], [127n, 2n, 166], [-127n, 2n, 150]]) {
    const needed = 2 + operationWork;
    const value = multiplicationFixture(`evaluate-multiplication.work.${left}`, carrier, type, left, right);
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const result = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: maximum } });
      assert.equal(result.value.kind, maximum < needed ? "refused" : "ok", `actual multiplication work ${maximum}`);
      if (maximum < needed) same(result.value.diagnostics[0].arguments,
        [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }], "original multiplication refusal");
    }
  }
  const value = multiplicationFixture("evaluate-multiplication.bits", carrier, type, 3n, 2n);
  for (const [dimension, needed] of [["maximumIntermediateBits", 16], ["maximumResultBits", 4]])
    for (let maximum = 0; maximum <= needed; maximum += 1)
      assert.equal(value.run({ ...value.deps, limits: { ...value.deps.limits, [dimension]: maximum } }).value.kind,
        maximum < needed ? "refused" : "ok");
  const narrowed = multiplicationFixture("evaluate-multiplication.output-work", "int32", T.int32, 1000n, 0n, "unwind", type, carrier);
  const narrowedWork = 2 + 1408;
  for (let maximum = 0; maximum <= narrowedWork; maximum += 1)
    assert.equal(narrowed.run({ ...narrowed.deps, limits: { ...narrowed.deps.limits, maximumArithmeticWork: maximum } }).value.kind,
      maximum < narrowedWork ? "refused" : "ok");
  const rows = [];
  rows.length = 10000;
  Object.defineProperty(rows, 0, { get() { assert.fail("No unadmitted multiplication law payload."); } });
  assert.equal(value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: rows },
    limits: { ...value.deps.limits, maximumArithmeticWork: 1 } }).value.kind, "refused");
  const native = comparisonTypes.find(row => row[0] === "native-int");
  const huge = multiplicationFixture("evaluate-multiplication.huge-width", native[0], native[1], 1n, 1n);
  assert.equal(huge.run({ ...huge.deps, selectedNativeFacts: { ...huge.deps.selectedNativeFacts,
    nativeIntegerWidths: [{ carrier: native[0], bits: Number.MAX_SAFE_INTEGER }] },
  limits: { ...huge.deps.limits, maximumArithmeticWork: Number.MAX_SAFE_INTEGER } }).value.kind, "refused");
});

test("integer multiplication requires its own selected law and genuine carrier associations", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = multiplicationFixture("evaluate-multiplication.ready-inputs", carrier, type, 3n, 2n);
  for (const rows of [[], [{ carrier, operation: "add", result: carrier, law: "wrap" }],
    [{ carrier, operation: "subtract", result: carrier, law: "wrap" }]])
    assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: rows } }),
      /actual selected native operation law for integer multiplication/u);
  const malformed = structuredClone(value.body);
  malformed.blocks.flatMap(block => block.statements).find(statement => statement.value?.kind === "binary").value.operation.decision.operation.carrier = "bool";
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    integerOverflow: [{ carrier: "bool", operation: "multiply", result: carrier, law: "wrap" }] } }, malformed),
  /actual selected integer multiplication geometry/u);
});

test("selected integer subtraction applies the actual supplied native law without negating its right operand", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [left, right, expected] of [[3n, 2n, 1n], [1n, -128n, -127n], [-128n, 1n, 127n], [127n, -1n, -128n], [-128n, -128n, 0n]]) {
    const value = subtractionFixture(`evaluate-subtraction.${left}.${right}`, carrier, type, left, right);
    same(value.run().value.value, { kind: "value", value: { kind: "number", type,
      value: { numerator: expected, denominator: 1n, negativeZero: false } } }, "exact subtraction, including an unnegatable signed minimum");
  }
  for (const [carrier, type] of comparisonTypes.slice(1)) {
    const unsigned = carrier === "uint64" || carrier === "native-uint";
    const left = unsigned ? 0n : -9223372036854775808n;
    const right = unsigned ? 18446744073709551615n : 9223372036854775807n;
    const value = subtractionFixture(`evaluate-subtraction.exact.${carrier}`, carrier, type, left, right);
    if (carrier === "native-int") assert.equal(value.deps.selectedNativeFacts.nativeIntegerWidths.find(row => row.carrier === carrier).bits, 128);
    assert.equal(value.run().value.value.value.value.numerator, carrier === "native-int" ? -18446744073709551615n : 1n);
    if (carrier === "native-int" || carrier === "native-uint") {
      const narrow = subtractionFixture(`evaluate-subtraction.supplied.${carrier}`, carrier, type, unsigned ? 0n : -256n,
        unsigned ? 511n : 255n);
      const result = narrow.run({ ...narrow.deps, selectedNativeFacts: { ...narrow.deps.selectedNativeFacts,
        nativeIntegerWidths: [{ carrier, bits: 9 }] } });
      assert.equal(result.value.value.value.value.numerator, 1n);
    }
  }
});

test("integer subtraction bounds complete results under supplied widening, narrowing and failure laws", () => {
  const [carrier, type] = comparisonTypes[0];
  const wide = subtractionFixture("evaluate-subtraction.wide", carrier, type, 127n, -128n, "unwind", T.int32, "int32");
  assert.equal(wide.run().value.value.value.value.numerator, 255n);
  for (const law of ["wrap", "unwind", "abort"]) {
    const exact = subtractionFixture(`evaluate-subtraction.cancellation.${law}`, "int32", T.int32, 1000n, 999n, law, type, carrier);
    assert.equal(exact.run().value.value.value.value.numerator, 1n);
    const unsigned = comparisonTypes.find(row => row[0] === "uint64");
    const changedSign = subtractionFixture(`evaluate-subtraction.changed-sign.${law}`, carrier, type, 0n, -1n, law, unsigned[1], unsigned[0]);
    assert.equal(changedSign.run().value.value.value.value.numerator, 1n);
    const signed = subtractionFixture(`evaluate-subtraction.unsigned-input.${law}`, unsigned[0], unsigned[1], 0n, 1n, law, type, carrier);
    assert.equal(signed.run().value.value.value.value.numerator, -1n);
    for (const [left, right, expected] of [[4n, 2n, 2n], [-4n, -2n, -2n], [127n, -1n, -128n], [-128n, 1n, 127n], [-128n, -128n, 0n]]) {
      const value = subtractionFixture(`evaluate-subtraction.failure.${law}.${left}.${right}`, carrier, type, left, right, law);
      const result = value.run();
      if (law !== "wrap" && (left === 127n || left === -128n && right === 1n)) {
        assert.equal(result.value.value.value.kind, "error");
        assert.equal(result.value.diagnostics.length, 1);
        assert.equal(result.value.diagnostics[0].code.name, "TSONIC_CONSTANT_EVALUATION_FAILED");
      } else assert.equal(result.value.value.value.value.numerator, expected);
    }
  }
  const wrapped = subtractionFixture("evaluate-subtraction.narrow-wrap", "int32", T.int32, 128n, -128n, "wrap", type, carrier);
  assert.equal(wrapped.run().value.value.value.value.numerator, 0n);
  const trapped = subtractionFixture("evaluate-subtraction.caught-fault", carrier, type, -128n, 1n, "unwind");
  const body = structuredClone(trapped.body);
  body.blocks.find(block => block.terminator.kind === "invoke").terminator.unwind = { kind: "handler", target: 0, exception: 0 };
  assert.throws(() => trapped.run(trapped.deps, body), /actual selected overflow fault value/u);
});

test("integer subtraction admits each represented operation on the original arithmetic and bit allowances", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [left, right, operationWork] of [[3n, 2n, 86], [-128n, 1n, 86], [127n, -1n, 94]]) {
    const needed = 2 + operationWork;
    const value = subtractionFixture(`evaluate-subtraction.work.${left}.${right}`, carrier, type, left, right);
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const result = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: maximum } });
      assert.equal(result.value.kind, maximum < needed ? "refused" : "ok", `actual subtraction work ${maximum}`);
      if (maximum < needed) same(result.value.diagnostics[0].arguments,
        [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }], "original subtraction refusal");
    }
  }
  const value = subtractionFixture("evaluate-subtraction.bits", carrier, type, 3n, 2n);
  for (const [dimension, needed] of [["maximumIntermediateBits", 8], ["maximumResultBits", 2]])
    for (let maximum = 0; maximum <= needed; maximum += 1)
      assert.equal(value.run({ ...value.deps, limits: { ...value.deps.limits, [dimension]: maximum } }).value.kind,
        maximum < needed ? "refused" : "ok");
  const narrowed = subtractionFixture("evaluate-subtraction.output-work", "int32", T.int32, 1000n, 999n, "unwind", type, carrier);
  const narrowedWork = 2 + 352;
  for (let maximum = 0; maximum <= narrowedWork; maximum += 1)
    assert.equal(narrowed.run({ ...narrowed.deps, limits: { ...narrowed.deps.limits, maximumArithmeticWork: maximum } }).value.kind,
      maximum < narrowedWork ? "refused" : "ok");
  const rows = [];
  rows.length = 10000;
  Object.defineProperty(rows, 0, { get() { assert.fail("No subtraction row payload after refusal."); } });
  assert.equal(value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: rows },
    limits: { ...value.deps.limits, maximumArithmeticWork: 1 } }).value.kind, "refused");
});

test("integer subtraction requires its own supplied operation law and actual carrier geometry", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = subtractionFixture("evaluate-subtraction.ready-inputs", carrier, type, 3n, 2n);
  for (const rows of [[], [{ carrier, operation: "add", result: carrier, law: "wrap" }],
    [{ carrier, operation: "negate", result: carrier, law: "wrap" }]])
    assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: rows } }),
      /actual selected native operation law for integer subtraction/u);
  const malformed = structuredClone(value.body);
  malformed.blocks.flatMap(block => block.statements).find(statement => statement.value?.kind === "binary").value.operation.decision.operation.carrier = "bool";
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    integerOverflow: [{ carrier: "bool", operation: "subtract", result: carrier, law: "wrap" }] } }, malformed),
    /actual selected integer subtraction geometry/u);
});

test("selected integer negation executes its actual supplied native wrapping law", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [operand, expected] of [[0n, 0n], [1n, -1n], [-1n, 1n], [-128n, -128n]]) {
    const value = negationFixture(`evaluate-negation.${operand}`, carrier, type, operand);
    same(value.run().value.value, { kind: "value", value: { kind: "number", type,
      value: { numerator: expected, denominator: 1n, negativeZero: false } } }, "actual selected integer negation, not JS double arithmetic");
  }
  for (const [carrier, type] of comparisonTypes.slice(1)) {
    const unsigned = carrier === "uint64" || carrier === "native-uint";
    const operand = unsigned ? 1n : -9007199254740993n;
    const expected = unsigned ? 18446744073709551615n : 9007199254740993n;
    const value = negationFixture(`evaluate-negation.exact.${carrier}`, carrier, type, operand);
    same(value.run().value.value, { kind: "value", value: { kind: "number", type,
      value: { numerator: expected, denominator: 1n, negativeZero: false } } }, "the actual supplied native carrier never rounds through double");
    if (carrier === "native-int" || carrier === "native-uint") {
      const narrow = negationFixture(`evaluate-negation.supplied.${carrier}`, carrier, type, unsigned ? 1n : -256n);
      const result = narrow.run({ ...narrow.deps, selectedNativeFacts: { ...narrow.deps.selectedNativeFacts,
        nativeIntegerWidths: [{ carrier, bits: 9 }] } });
      assert.equal(result.value.value.value.value.numerator, unsigned ? 511n : -256n);
    }
  }
});

test("native unary integer identity retains exact supplied carriers without reading an overflow law", () => {
  for (const [carrier, type] of comparisonTypes) {
    const unsigned = carrier === "uint64" || carrier === "native-uint";
    const operand = carrier === "int8" ? -128n : unsigned ? 9007199254740993n : -9007199254740993n;
    const value = identityFixture(`evaluate-unary-identity.${carrier}`, carrier, type, operand);
    const unread = new Proxy([], { get() { assert.fail("Unary identity has no overflow operation to select."); } });
    const result = value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: unread } });
    same(result.value.value, { kind: "value", value: { kind: "number", type,
      value: { numerator: operand, denominator: 1n, negativeZero: false } } }, "native identity never coerces through double or performs binary addition");
  }
  for (const [carrier, type] of comparisonTypes.filter(([carrier]) => carrier === "native-int" || carrier === "native-uint")) {
    const operand = 1n << 120n;
    const value = identityFixture(`evaluate-unary-identity.supplied.${carrier}`, carrier, type, operand,
      { ...nativeFactsFixture(), nativeIntegerWidths: [{ carrier, bits: 137 }] });
    assert.equal(value.run().value.value.value.value.numerator, operand, "the same supplied137-bit geometry reaches MIR and evaluation");
  }
});

test("unary integer identity admits exact geometry and operand validation before every allowance cut", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = identityFixture("evaluate-unary-identity.work", carrier, type, 1n);
  const required = 1 + (1 + 1 + 3 * 8 + 1 + 1 + 2 * 8);
  for (let maximum = 0; maximum <= required; maximum += 1) {
    const result = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: maximum } });
    assert.equal(result.value.kind, maximum < required ? "refused" : "ok", `identity work:${maximum}`);
    if (maximum < required) same(result.value.diagnostics[0].arguments,
      [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }], "same original arithmetic refusal");
  }
  for (const [dimension, required] of [["maximumIntermediateBits", 8], ["maximumResultBits", 2]])
    for (let maximum = 0; maximum <= required; maximum += 1)
      assert.equal(value.run({ ...value.deps, limits: { ...value.deps.limits, [dimension]: maximum } }).value.kind,
        maximum < required ? "refused" : "ok", `${dimension}:${maximum}`);
  let reads = 0;
  const result = value.run({ ...value.deps, limits: { ...limits, maximumArithmeticWork: 0 },
    typeOf: () => { reads += 1; assert.fail("A refused identity does not read its result type."); } });
  assert.equal(result.value.kind, "refused");
  assert.equal(reads, 0);
});

test("unary integer identity retains missing native geometry and actual result conversion frontiers", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = identityFixture("evaluate-unary-identity.missing", carrier, type, 1n);
  const changed = (carrier, result = type) => {
    const body = structuredClone(value.body);
    const decision = body.blocks.flatMap(block => block.statements).find(row => row.value?.kind === "unary").value.operation.decision;
    decision.operation.carrier = carrier;
    decision.result = result;
    return body;
  };
  assert.throws(() => value.run({ ...value.deps, typeOf: () => ({ kind: "shape", members: [], indexes: [], calls: [], constructs: [] }) }),
    /actual selected integer result carrier association/u);
  assert.throws(() => value.run(value.deps, changed(carrier, T.int32)), /actual Rules-selected unary integer result conversion association/u);
  assert.throws(() => value.run(value.deps, changed("bool", T.bool)), /actual selected unary integer geometry/u);
  const native = comparisonTypes.find(row => row[0] === "native-int");
  const supplied = identityFixture("evaluate-unary-identity.native", native[0], native[1], 256n);
  assert.throws(() => supplied.run({ ...supplied.deps, selectedNativeFacts: { ...supplied.deps.selectedNativeFacts, nativeIntegerWidths: [] } }),
    /actual selected unary integer geometry/u);
  assert.throws(() => supplied.run({ ...supplied.deps, selectedNativeFacts: { ...supplied.deps.selectedNativeFacts,
    nativeIntegerWidths: [{ carrier: native[0], bits: 9 }] } }), /operand must fit its supplied native carrier/u);
});

test("integer negation retains supplied result geometry and real failure arms without a fabricated fault value", () => {
  const [carrier, type] = comparisonTypes[0];
  const wider = negationFixture("evaluate-negation.widen", carrier, type, -128n, "unwind", T.int32, "int32");
  assert.equal(wider.run().value.value.value.value.numerator, 128n);
  const [, wide] = comparisonTypes[1];
  const narrower = negationFixture("evaluate-negation.narrow", "int64", wide, -128n, "wrap", type, carrier);
  assert.equal(narrower.run().value.value.value.value.numerator, -128n);
  for (const law of ["unwind", "abort"]) {
    const normal = negationFixture(`evaluate-negation.inrange.${law}`, carrier, type, 1n, law);
    assert.equal(normal.run().value.kind, "ok");
    assert.equal(normal.run().value.value.value.value.numerator, -1n);
    const overflow = negationFixture(`evaluate-negation.overflow.${law}`, carrier, type, -128n, law);
    const result = overflow.run();
    assert.equal(result.value.kind, "ok");
    assert.equal(result.value.value.value.kind, "error");
    assert.equal(result.value.diagnostics.length, 1);
    assert.equal(result.value.diagnostics[0].code.name, "TSONIC_CONSTANT_EVALUATION_FAILED");
    if (law === "unwind") {
      const body = structuredClone(overflow.body);
      body.blocks.find(block => block.terminator.kind === "invoke").terminator.unwind = { kind: "handler", target: 0, exception: 0 };
      assert.throws(() => overflow.run(overflow.deps, body), /actual selected overflow fault value/u);
    }
  }
});

test("integer negation pays exact row, geometry, comparison and wrapping work before every original allowance cut", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [operand, operationWork] of [[1n, 69], [-128n, 77]]) {
    const needed = 1 + operationWork;
    const value = negationFixture(`evaluate-negation.work.${operand}`, carrier, type, operand);
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const result = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork: maximum } });
      assert.equal(result.value.kind, maximum < needed ? "refused" : "ok", `actual negation work ${maximum}`);
      if (maximum < needed) same(result.value.diagnostics[0].arguments,
        [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }], "same original arithmetic refusal");
    }
  }
  const value = negationFixture("evaluate-negation.bits", carrier, type, 1n);
  for (const [dimension, needed] of [["maximumIntermediateBits", 8], ["maximumResultBits", 2]])
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const result = value.run({ ...value.deps, limits: { ...value.deps.limits, [dimension]: maximum } });
      assert.equal(result.value.kind, maximum < needed ? "refused" : "ok");
    }
  const rows = [];
  rows.length = 10000;
  Object.defineProperty(rows, 0, { get() { assert.fail("No unadmitted negation law row."); } });
  assert.equal(value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: rows },
    limits: { ...value.deps.limits, maximumArithmeticWork: 1 } }).value.kind, "refused");
});

test("integer negation keeps absent or malformed selected inputs distinct from a real resource refusal", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = negationFixture("evaluate-negation.ready-inputs", carrier, type, 1n);
  for (const rows of [[], [{ carrier, operation: "subtract", result: carrier, law: "wrap" }]])
    assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: rows } }),
      /actual selected native operation law for integer negation/u);
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: [undefined] } }),
    /complete selected integer overflow relation/u);
  assert.throws(() => value.run({ ...value.deps, typeOf: () => ({ kind: "shape", members: [], indexes: [], calls: [], constructs: [] }) }),
    /actual selected integer result carrier association/u);
  const changed = (carrier, result = type) => {
    const body = structuredClone(value.body);
    const operation = body.blocks.flatMap(block => block.statements).find(row => row.kind === "assign" && row.value.kind === "unary").value.operation.decision;
    operation.operation.carrier = carrier;
    operation.result = result;
    return body;
  };
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    integerOverflow: [{ carrier: "bool", operation: "negate", result: carrier, law: "wrap" }] } }, changed("bool")),
    /actual selected integer negation geometry/u);
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    integerOverflow: [{ carrier, operation: "negate", result: "bool", law: "wrap" }] } }, changed(carrier, T.bool)),
    /actual selected integer result geometry/u);
  const wider = negationFixture("evaluate-negation.output-allowance", carrier, type, 1n, "wrap", T.int32, "int32");
  assert.equal(wider.run({ ...wider.deps, limits: { ...wider.deps.limits, maximumIntermediateBits: 16 } }).value.kind, "refused");
  const native = comparisonTypes.find(row => row[0] === "native-int");
  const missing = negationFixture("evaluate-negation.native-width", native[0], native[1], 1n);
  assert.throws(() => missing.run({ ...missing.deps, selectedNativeFacts: { ...missing.deps.selectedNativeFacts, nativeIntegerWidths: [] } }),
    /actual selected integer negation geometry/u);
  for (const [operator, token] of [["<<", "LessThanLessThanToken"], ["**", "AsteriskAsteriskToken"]]) {
    const shift = selected({ kind: "native-operator", operator, carrier }, [type, type], type);
    const pending = fixture(`evaluate-negation.binary-shift-frontier.${operator}`, type, builder => builder.block(builder.returns(
      builder.arithmetic(builder.num("2", type), token, builder.num("1", type), type, shift))));
    assert.throws(() => pending.start(), /actual selected native operation law/u);
  }
});

test("selected integer addition applies supplied wrapping laws exactly beyond double precision without oversized sums", () => {
  for (const [carrier, type] of comparisonTypes) {
    const bits = carrier === "int8" ? 8n : carrier === "native-int" ? 128n : 64n;
    const signed = carrier === "int8" || carrier === "int64" || carrier === "native-int";
    const minimum = signed ? -(1n << (bits - 1n)) : 0n;
    const maximum = signed ? (1n << (bits - 1n)) - 1n : (1n << bits) - 1n;
    const rows = [[0n, 0n, 0n], [maximum, 1n, minimum], [maximum, maximum, signed ? -2n : maximum - 1n]];
    if (signed) rows.push([minimum, -1n, maximum], [minimum, minimum, 0n], [-1n, 1n, 0n]);
    if (carrier !== "int8") rows.push([9007199254740993n, 2n, 9007199254740995n]);
    for (const [index, [left, right, expected]] of rows.entries()) {
      const value = additionFixture(`evaluate-addition.${carrier}.${index}`, carrier, type, left, right);
      same(value.run().value.value, { kind: "value", value: { kind: "number", type,
        value: { numerator: expected, denominator: 1n, negativeZero: false } } }, "the actual supplied native wrapping result");
    }
  }
});

test("integer addition admits each original operation before its exact work and stops before later row reads", () => {
  const [carrier, type] = comparisonTypes[0];
  for (const [index, left, right, operationWork] of [[0, 1n, 2n, 94], [1, 127n, 1n, 110], [2, -128n, -1n, 110]]) {
    const required = 2 + operationWork;
    const value = additionFixture(`evaluate-addition.account.${index}`, carrier, type, left, right);
    for (let maximumArithmeticWork = 0; maximumArithmeticWork <= required; maximumArithmeticWork += 1) {
      const result = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork } });
      assert.equal(result.value.kind, maximumArithmeticWork < required ? "refused" : "ok", `actual addition work ${index}/${maximumArithmeticWork}`);
      if (maximumArithmeticWork < required) same(result.value.diagnostics[0].arguments,
        [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximumArithmeticWork }], "original same-account refusal");
    }
  }
  const value = additionFixture("evaluate-addition.no-later-read", carrier, type, 1n, 2n);
  const rows = [];
  rows.length = 10000;
  Object.defineProperty(rows, 0, { get() { throw new Error("unadmitted native law read"); } });
  const result = value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: rows },
    limits: { ...value.deps.limits, maximumArithmeticWork: 1 } });
  assert.equal(result.value.kind, "refused");
});

test("integer addition retains selected widening and original escaping failure rather than a fabricated successful value", () => {
  const [carrier, type] = comparisonTypes[0];
  const wider = additionFixture("evaluate-addition.widen", carrier, type, 127n, 127n, "wrap", T.int32, "int32");
  assert.equal(wider.run().value.value.value.value.numerator, 254n);
  for (const law of ["unwind", "abort"]) {
    const good = additionFixture(`evaluate-addition.inrange.${law}`, carrier, type, 1n, 2n, law);
    assert.equal(good.run().value.kind, "ok");
    const overflowing = additionFixture(`evaluate-addition.failure.${law}`, carrier, type, 127n, 1n, law);
    const result = overflowing.run();
    assert.equal(result.value.kind, "ok");
    assert.equal(result.value.value.value.kind, "error");
    assert.equal(result.value.diagnostics.length, 1);
    assert.equal(result.value.diagnostics[0].code.name, "TSONIC_CONSTANT_EVALUATION_FAILED");
    const body = structuredClone(overflowing.body);
    const invoke = body.blocks.find(block => block.terminator.kind === "invoke").terminator;
    invoke.unwind = { kind: "none" };
    assert.throws(() => overflowing.run(overflowing.deps, body), /marked unable to fail/u);
    invoke.unwind = { kind: law === "abort" ? "escape" : "abort" };
    assert.throws(() => overflowing.run(overflowing.deps, body), /failure arm disagree/u);
    invoke.unwind = { kind: "handler", target: 0, exception: 0 };
    if (law === "unwind") assert.throws(() => overflowing.run(overflowing.deps, body), /actual selected overflow fault value/u);
  }
});

test("integer addition keeps malformed and unavailable actual ready inputs distinct from resource exhaustion", () => {
  const [carrier, type] = comparisonTypes[0];
  const value = additionFixture("evaluate-addition.boundaries", carrier, type, 1n, 2n);
  const changeResult = result => {
    const body = structuredClone(value.body);
    body.blocks.flatMap(block => block.statements).find(statement => statement.value?.kind === "binary").value.operation.decision.result = result;
    return body;
  };
  assert.throws(() => value.run(value.deps, changeResult(T.unknown)), /actual selected integer result carrier association/u);
  const sparse = Array(1);
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: sparse } }), /complete selected integer overflow relation/u);
  const body = structuredClone(value.body);
  const statement = body.blocks.flatMap(block => block.statements).find(statement => statement.value?.kind === "binary");
  statement.value = { kind: "unary", operation: statement.value.operation, operand: statement.value.left };
  statement.value.operation.decision.operation.operator = "*";
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    integerOverflow: [{ carrier, operation: "multiply", result: carrier, law: "wrap" }] } }, body), /two actual operands/u);
  for (const row of [
    { carrier, operation: "subtract", result: carrier, law: "wrap" },
    { carrier, operation: "add", result: "int32", law: "wrap" },
  ]) assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, integerOverflow: [row] } }), /actual selected native operation law/u);
  const malformedCarrier = structuredClone(value.body);
  malformedCarrier.blocks.flatMap(block => block.statements).find(statement => statement.value?.kind === "binary").value.operation.decision.operation.carrier = "bool";
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    integerOverflow: [{ carrier: "bool", operation: "add", result: carrier, law: "wrap" }] } }, malformedCarrier), /actual selected integer addition geometry/u);
  assert.throws(() => value.run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts,
    integerOverflow: [{ carrier, operation: "add", result: "bool", law: "wrap" }] } }, changeResult(T.bool)), /actual selected integer result geometry/u);
  const wider = additionFixture("evaluate-addition.widened-bounds", carrier, type, 1n, 2n, "wrap", T.int32, "int32");
  const work = 2 + (1 + 1 + (2 + 3 * 8) + 2 * (1 + 2 * 8) + (2 + 3 * 32) + 2 * 32 + 4 * 32);
  for (let maximumArithmeticWork = 0; maximumArithmeticWork <= work; maximumArithmeticWork += 1)
    assert.equal(wider.run({ ...wider.deps, limits: { ...wider.deps.limits, maximumArithmeticWork } }).value.kind,
      maximumArithmeticWork < work ? "refused" : "ok", `widened addition original work ${maximumArithmeticWork}`);
  for (let maximumIntermediateBits = 0; maximumIntermediateBits <= 32; maximumIntermediateBits += 1)
    assert.equal(wider.run({ ...wider.deps, limits: { ...wider.deps.limits, maximumIntermediateBits } }).value.kind,
      maximumIntermediateBits < 32 ? "refused" : "ok", `widened addition represented geometry ${maximumIntermediateBits}`);
  const narrowed = additionFixture("evaluate-addition.narrowed-frontier", "int32", T.int32, 1n, 2n, "wrap", type, carrier);
  assert.equal(narrowed.run().value.value.value.value.numerator, 3n);
});

test("an escaping native overflow respects its actual caller handlers and the same original stop", () => {
  const [carrier, type] = comparisonTypes[0];
  const child = additionFixture("evaluate-addition.child-overflow", carrier, type, 127n, 1n, "unwind");
  const caller = fixture("evaluate-addition.caller", type, builder => builder.block(builder.returns(builder.num("0", type))));
  const bridge = internalCall(caller, child);
  const deps = { ...bridge.deps, selectedNativeFacts: child.deps.selectedNativeFacts, limits: child.deps.limits };
  for (const arm of ["escape", "handler", "none", "abort"]) {
    const body = structuredClone(bridge.body);
    body.blocks[0].terminator.unwind = arm === "handler" ? { kind: "handler", target: 1, exception: 0 } : { kind: arm };
    const paused = product.evaluate(deps, bridge.entry, body, [], "compile-time", bridge.unit);
    const resume = () => product.resumeEvaluate(deps, paused.paused, [{ kind: "mir-body", body: child.body }]);
    if (arm === "handler") assert.throws(resume, /actual selected overflow fault value/u);
    else if (arm === "none" || arm === "abort") assert.throws(resume, /actual unwinding arm/u);
    else {
      const result = resume();
      assert.equal(result.value.value.value.kind, "error");
      assert.equal(result.value.diagnostics.length, 1);
      assert.equal(result.value.diagnostics[0].site.origin.start, child.body.blocks.find(block => block.terminator.kind === "invoke").terminator.origin.start);
    }
  }
  for (const [law, operationWork] of [["unwind", 87], ["abort", 86]]) {
    const work = 2 + operationWork;
    const value = additionFixture(`evaluate-addition.failure-account.${law}`, carrier, type, 127n, 1n, law);
    for (let maximumArithmeticWork = 0; maximumArithmeticWork <= work; maximumArithmeticWork += 1) {
      const result = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork } });
      assert.equal(result.value.kind, maximumArithmeticWork < work ? "refused" : "ok");
      if (maximumArithmeticWork === work) assert.equal(result.value.value.value.kind, "error");
    }
  }
});

test("actual narrow integer addition supports supplied wrapping and trapping laws without a wider temporary", () => {
  const [carrier, type] = comparisonTypes[0];
  const unsigned = comparisonTypes.find(([name]) => name === "uint64")[1];
  const cases = [
    [257n, 2n, 3n], [-257n, -2n, -3n], [2147483647n, 2147483647n, -2n], [-2147483648n, -2147483648n, 0n],
  ];
  for (const [index, [left, right, expected]] of cases.entries()) {
    const value = additionFixture(`evaluate-addition.narrowed.${index}`, "int32", T.int32, left, right, "wrap", type, carrier);
    assert.equal(value.run().value.value.value.value.numerator, expected);
  }
  const changedSign = additionFixture("evaluate-addition.changed-sign", "int64", comparisonTypes[1][1], -1n, 0n, "wrap", unsigned, "uint64");
  assert.equal(changedSign.run().value.value.value.value.numerator, 18446744073709551615n);
  for (const law of ["unwind", "abort"]) for (const [index, left, right, expected] of [
    [0, 1000n, -1000n, 0n], [1, -1000n, 1001n, 1n], [2, 1n, 2n, 3n], [3, -1n, -2n, -3n],
    [4, 128n, 1n, null], [5, 1n, 128n, null], [6, -129n, -1n, null], [7, -1n, -129n, null],
    [8, 1000n, -1n, null], [9, -1000n, 1n, null], [10, 127n, 1n, null],
  ]) {
    const value = additionFixture(`evaluate-addition.narrowed.${law}.${index}`, "int32", T.int32, left, right, law, type, carrier);
    const result = value.run();
    if (expected === null) assert.equal(result.value.value.value.kind, "error");
    else assert.equal(result.value.value.value.value.numerator, expected);
  }
});

test("narrow selected arithmetic charges original row, geometry, conversion and branch work before every operation", () => {
  const [carrier, type] = comparisonTypes[0];
  const rows = [
    [257n, 2n, "wrap", 400, false], [127n, 1n, "wrap", 416, false],
    [1n, 2n, "unwind", 448, false], [1000n, -1000n, "unwind", 448, false],
    [-1000n, 1n, "unwind", 417, true], [1000n, -1n, "unwind", 449, true],
    [128n, 1n, "unwind", 385, true], [1n, 128n, "unwind", 417, true], [127n, 1n, "unwind", 441, true],
  ];
  for (const [index, [left, right, law, operationWork, failed]] of rows.entries()) {
    const required = 2 + operationWork;
    const value = additionFixture(`evaluate-addition.narrow-budget.${index}`, "int32", T.int32, left, right, law, type, carrier);
    for (let maximumArithmeticWork = 0; maximumArithmeticWork <= required; maximumArithmeticWork += 1) {
      const result = value.run({ ...value.deps, limits: { ...value.deps.limits, maximumArithmeticWork } });
      assert.equal(result.value.kind, maximumArithmeticWork < required ? "refused" : "ok", `narrow original work ${index}/${maximumArithmeticWork}`);
      if (maximumArithmeticWork === required) assert.equal(result.value.value.value.kind, failed ? "error" : "number");
    }
  }
  const signed = comparisonTypes.find(([name]) => name === "int64")[1];
  const unsigned = comparisonTypes.find(([name]) => name === "uint64")[1];
  const narrowed = additionFixture("evaluate-addition.unsigned-to-signed", "uint64", unsigned,
    18446744073709551615n, 0n, "wrap", signed, "int64");
  assert.equal(narrowed.run().value.value.value.value.numerator, -1n);
});

test("integer comparisons preserve ready-domain defects, literal-base provenance and original row refusal", () => {
  const [carrier, type] = comparisonTypes[0];
  const decision = selected({ kind: "native-operator", operator: "<=", carrier }, [type, type], T.bool);
  const value = fixture("evaluate-integer-views", T.bool, b => b.block(b.returns(
    b.comparison(b.num("1", type), "LessThanEqualsToken", b.num("1", type), decision))));
  const run = (deps, body = value.body) => product.evaluate(deps, value.entry, body, [], "compile-time", value.unit);
  const changed = (position, change) => ({ ...value.body, constants: value.body.constants.map((constant, index) =>
    index === position ? change(constant) : constant) });
  let reads = 0;
  const noDomain = { ...value.deps, types: { terms: [], signatures: [] }, typeOf: () => { reads += 1; return undefined; } };
  assert.throws(() => run(noDomain), /actual ready type domain/u);
  assert.equal(reads, 0, "a valid reader is never used to replace a missing captured domain");
  assert.throws(() => run({ ...value.deps, typeOf: () => undefined }), /complete ready type row/u);
  assert.throws(() => run({ ...value.deps, typeOf: () => ({ kind: "string" }) }), /operand carrier association/u);
  assert.throws(() => run({ ...value.deps, typeOf: () => ({ kind: "primitive", primitive: "uint8" }) }), /operand carrier association/u);
  const interner = admitFixtureTable(types, value.deps.types);
  const literal = insertFixtureType(types, interner, { kind: "literal", base: type, value: { kind: "number",
    value: { numerator: 1n, denominator: 1n, negativeZero: false } } });
  const body = changed(0, constant => ({ ...constant, type: literal }));
  const seen = [];
  const deps = { ...value.deps, types: types.viewTypes(interner), typeOf: selected => { seen.push(selected); return types.readType(interner, selected); } };
  assert.equal(run(deps, body).value.kind, "ok");
  same(seen, [literal, literal, literal, type, literal, type], "two actual literal acquisitions, then both operands follow their own literal base");
  const originalWork = 2 + (2 + 3 * 8);
  seen.length = 0;
  const refused = run({ ...deps, limits: { ...limits, maximumArithmeticWork: originalWork } }, body);
  assert.equal(refused.value.kind, "refused");
  same(seen, [literal, literal], "a refused primitive endpoint charge stops before its actual row lookup");
  for (const literal of [
    { kind: "boolean", value: true },
    { kind: "number", value: { numerator: 1n, denominator: 2n, negativeZero: false } },
    { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: true } },
  ]) assert.throws(() => run(value.deps, changed(0, constant => ({ ...constant, value: { kind: "literal", value: literal } }))), /integral operand/u);
  assert.throws(() => run(value.deps, changed(0, constant => ({ ...constant,
    value: { kind: "literal", value: { kind: "bigint", value: 128n } } }))), /fit its supplied native carrier/u);
  assert.throws(() => run(value.deps, changed(0, constant => ({ ...constant,
    value: { kind: "literal", value: { kind: "bigint", value: -129n } } }))), /fit its supplied native carrier/u);
  assert.equal(run(value.deps, changed(0, constant => ({ ...constant,
    value: { kind: "literal", value: { kind: "bigint", value: 1n } } }))).value.kind, "ok");
  for (const [carrier, defect] of [
    ["float32", /both exact floating bit values/u],
    ["native-int", /actual selected integer comparison geometry/u],
  ]) {
    const body = structuredClone(value.body);
    const statement = body.blocks.flatMap(block => block.statements).find(statement => statement.value?.kind === "binary");
    statement.value.operation.decision.operation.carrier = carrier;
    assert.throws(() => run({ ...value.deps, selectedNativeFacts: { ...value.deps.selectedNativeFacts, nativeIntegerWidths: [] } }, body), defect);
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
  const target = fixture("evaluate-nested-target");
  const reference = { context: "enum-member", member: "D[M[P[p];m];Code/Next]", bindings: target.entry.bindings };
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
  const value = requestFixture("evaluate-success", { kind: "constant", reference: { initializer: target, context: "compile-time" } });
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

test("a destination-free call evaluates the actual return operand without republishing it in the caller", () => {
  const caller = fixture("evaluate-no-destination");
  const initializer = fixture("evaluate-float-result-initializer", T.float64, b => b.block(b.returns(b.num("0", T.float64))));
  const reference = { initializer: initializer.entry, context: "compile-time" };
  const child = requestFixture("evaluate-no-destination-float", { kind: "constant", reference }, T.float64);
  const call = internalCall(caller, child);
  const [start, next] = call.body.blocks;
  const parsed = mir.parseMir(mir.printMir({ ...call.body, locals: [], places: [], blocks: [
    { ...start, terminator: { ...start.terminator, destination: null } },
    { ...next, terminator: caller.body.blocks[0].terminator },
  ] }));
  assert.equal(parsed.kind, "parsed");
  const format = { carrier: "float64", interchange: "ieee754-binary64", nanSignObservable: true, nanPayloadObservable: true, signalingNaNObservable: true };
  for (let maximum = 0; maximum <= 2; maximum += 1) {
    const reads = [];
    const floatingFormats = new Proxy([format], { get(target, key, receiver) {
      if (key === "0") reads.push(key);
      return Reflect.get(target, key, receiver);
    } });
    const deps = { ...call.deps, selectedNativeFacts: { ...call.deps.selectedNativeFacts, floatingFormats },
      limits: { ...limits, maximumArithmeticWork: maximum } };
    const pending = product.evaluate(deps, call.entry, parsed.value, [], "compile-time", call.unit);
    assert.equal(pending.kind, "paused");
    const operand = product.resumeEvaluate(deps, pending.paused, [{ kind: "mir-body", body: child.body }]);
    assert.equal(operand.kind, "paused");
    same(operand.requests, [{ kind: "const-value", reference }], "an ignored result still evaluates its actual operand");
    const result = product.resumeEvaluate(deps, operand.paused, [{ kind: "const-value", unit: answerUnit("constValue"),
      value: { value: { kind: "value", value: { kind: "floating", type: T.float64, bits: 0x8000000000000000n } },
        positions: [{ position: { kind: "result" }, error: null }] } }]);
    assert.equal(result.kind, "done");
    assert.equal(result.value.kind, maximum < 2 ? "refused" : "ok", `one selected type and one format read:${maximum}`);
    assert.deepEqual(reads, maximum === 2 ? ["0"] : []);
    if (result.value.kind === "ok") same(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: true } },
      "only the caller's actual result is published");
    else assert.equal(result.value.diagnostics[0].arguments[0].value, "evaluation.maximumArithmeticWork");
  }
});

test("a callee with no returned operand cannot initialize an actual caller destination", () => {
  const caller = fixture("evaluate-required-destination");
  const child = fixture("evaluate-required-destination-void", T.void, b => b.block(b.returns(null)));
  const call = internalCall(caller, child);
  const pending = product.evaluate(call.deps, call.entry, call.body, [], "compile-time", call.unit);
  assert.equal(pending.kind, "paused");
  assert.throws(() => product.resumeEvaluate(call.deps, pending.paused, [{ kind: "mir-body", body: child.body }]), /requires its actual returned value/u);
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

test("coalescing a verified optional value compares only its own absence case and stops before unpaid reads", () => {
  for (const [name, primitive, present, work] of [
    ["text", T.string, { kind: "string", value: "" }, 4],
    ["float", T.float64, { kind: "floating", bits: 0x8000000000000000n }, 24],
  ]) {
    const type = declareType(`evaluate.coalesce.${name}`, { kind: "optional", value: primitive });
    const value = fixture(`evaluate-coalesce-${name}`, type, builder => {
      const left = { ...builder.id("left", 0, type), $: "left" };
      const right = builder.id("right", 1, type);
      return builder.block(builder.returns(builder.binary(left, "QuestionQuestionToken",
        { ...right, $: "right", tsonic: at => ({ ...right.tsonic, demand: { kind: "selected", control: at("left"), when: "absent" } }) },
        at => ({ type, convertedType: type, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" },
          role: "short-circuit", selection: { kind: "coalesce", control: at("left"), right: at("right"), disposition: "dynamic" } }))));
    }, [["left", "required", type], ["right", "required", type]]);
    const dispatch = value.body.blocks.find(row => row.terminator.kind === "switch");
    const [actualTarget] = dispatch.terminator.targets;
    const operands = [{ ...present, type }, { kind: "absence", type }];
    const run = (body, deps, args = operands) => product.evaluate(deps, value.entry, body, args, "compile-time", value.unit).value;
    const changeTargets = (targets, constants = value.body.constants) => ({ ...value.body, constants,
      blocks: value.body.blocks.map(block => block !== dispatch ? block : { ...block, terminator: { ...block.terminator, targets } }) });
    const floatingValidation = 4;
    const threshold = name === "text" ? 2 : 3 * floatingValidation + 2;
    for (let maximum = 0; maximum <= work; maximum += 1) {
      const seen = [];
      const targets = new Proxy(dispatch.terminator.targets, { get: (rows, id) => {
        if (id === "0") seen.push("target");
        return Reflect.get(rows, id);
      } });
      const constants = new Proxy(value.body.constants, { get: (rows, id) => {
        if (id === String(actualTarget.constant)) seen.push("constant");
        return Reflect.get(rows, id);
      } });
      const deps = { ...value.deps, typeOf: id => {
        if (name === "text") seen.push(id);
        return value.deps.typeOf(id);
      }, limits: { ...limits, maximumArithmeticWork: maximum } };
      const answer = run(changeTargets(targets, constants), deps);
      assert.equal(answer.kind, maximum < work ? "refused" : "ok", `${name}/${maximum}`);
      if (name === "text") assert.deepEqual(seen, maximum < threshold ? [] : ["target", "constant", ...[type, primitive].slice(0, maximum - threshold)]);
      else assert.deepEqual(seen, maximum < threshold ? [] : ["target", "constant"]);
      if (maximum < work) assert.equal(answer.diagnostics[0].arguments[0].value, "evaluation.maximumArithmeticWork");
      else same(answer.value, { kind: "value", value: operands[0] }, "a present native payload never takes the absence edge");
    }
    const failure = /selected native discriminant relation/u;
    const withConstant = replace => changeTargets(dispatch.terminator.targets,
      value.body.constants.map(constant => constant.id === actualTarget.constant ? replace(constant) : constant));
    const crossed = withConstant(constant => ({ ...constant, type: T.absence }));
    assert.throws(() => run(crossed, value.deps), failure);
    assert.throws(() => run(crossed, value.deps, [operands[1], operands[0]]), failure);
    assert.throws(() => run(withConstant(constant => ({ ...constant, value: { kind: "literal", value: { kind: "string", value: "" } } })),
      value.deps), failure);
    assert.throws(() => run(changeTargets(new Array(1)), value.deps), /complete target vector/u);
    if (name === "text") {
      for (const replacement of [{ kind: "optional", value: T.bool }, { kind: "string" }])
        assert.throws(() => run(value.body, { ...value.deps, typeOf: id => id === type ? replacement : value.deps.typeOf(id) }), failure);
      const rational = { kind: "number", type, value: { numerator: 0n, denominator: 1n, negativeZero: false } };
      assert.throws(() => run(value.body, value.deps, [rational, operands[1]]), failure);
    }
    same(run(value.body, value.deps, [operands[1], operands[0]]).value, { kind: "value", value: operands[0] },
      "only genuine absence takes the selected right operand");
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

test("floating bit allowances use the actual supplied full encoding, including zero and all payload bits", async () => {
  const value = fixture("evaluate-floating-budget");
  const { valueFits } = await import("../../packages/host/dist/evaluate/budget.js");
  const origin = value.body.blocks[0].origin;
  const interner = admitFixtureTable(types, TABLE);
  for (const [primitive, interchange, width] of [["float16", "ieee754-binary16", 16], ["float32", "ieee754-binary32", 32], ["float64", "ieee754-binary64", 64]]) {
    const type = insertFixtureType(types, interner, { kind: "primitive", primitive });
    const format = { carrier: primitive, interchange, nanSignObservable: false, nanPayloadObservable: false, signalingNaNObservable: false };
    const deps = { ...value.deps, types: types.viewTypes(interner), typeOf: id => types.readType(interner, id), selectedNativeFacts: { ...nativeFactsFixture(), floatingFormats: [format] } };
    for (const bits of [0n, 1n << BigInt(width - 1), (1n << BigInt(width)) - 1n]) {
      for (const field of ["maximumIntermediateBits", "maximumResultBits"]) {
        for (let maximum = 0; maximum <= width; maximum += 1) {
          const machine = { deps: { ...deps, limits: { ...limits, [field]: maximum } }, result: null, arithmetic: 0, unit: value.unit };
          assert.equal(valueFits(machine, { kind: "floating", type, bits }, field, origin), maximum === width, `${primitive}/${field}/${bits}/${maximum}`);
          assert.equal(machine.result === null, maximum === width);
        }
      }
    }
    const invoke = (selectedDeps, bits = 0n, selectedType = type) => valueFits({ deps: selectedDeps, result: null, arithmetic: 0, unit: value.unit },
      { kind: "floating", type: selectedType, bits }, "maximumIntermediateBits", origin);
    assert.throws(() => invoke({ ...deps, selectedNativeFacts: { ...deps.selectedNativeFacts, floatingFormats: [] } }), /selected carrier format/u);
    assert.throws(() => invoke({ ...deps, selectedNativeFacts: { ...deps.selectedNativeFacts, floatingFormats: Array(1) } }),
      /complete selected carrier format relation/u);
    assert.throws(() => invoke({ ...deps, selectedNativeFacts: { ...deps.selectedNativeFacts, floatingFormats: [{ ...format, interchange: "unknown" }] } }), /valid selected encoding/u);
    for (const bits of [-1n, 1n << BigInt(width)]) assert.throws(() => invoke(deps, bits), /valid selected encoding/u);
    for (const selectedType of [T.int32, T.string]) assert.throws(() => invoke(deps, 0n, selectedType), /actual selected native carrier/u);
  }
});

test("floating literal-base and format consumption charge the original invocation before every actual row read", async () => {
  const value = fixture("evaluate-floating-literal-chain");
  const { valueFits } = await import("../../packages/host/dist/evaluate/budget.js");
  const origin = value.body.blocks[0].origin;
  const interner = admitFixtureTable(types, TABLE);
  const primitive = insertFixtureType(types, interner, { kind: "primitive", primitive: "float32" });
  const first = insertFixtureType(types, interner, { kind: "literal", base: primitive,
    value: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } } });
  const selected = insertFixtureType(types, interner, { kind: "literal", base: first,
    value: { kind: "number", value: { numerator: 2n, denominator: 1n, negativeZero: false } } });
  const view = types.viewTypes(interner);
  const format = { carrier: "float32", interchange: "ieee754-binary32",
    nanSignObservable: false, nanPayloadObservable: false, signalingNaNObservable: false };
  for (const field of ["maximumIntermediateBits", "maximumResultBits"]) {
    for (let maximum = 0; maximum <= 4; maximum += 1) {
      const reads = [];
      let formatReads = 0;
      const formats = new Proxy([format], { get(target, key, receiver) {
        if (key === "0") { assert.equal(maximum >= 4, true, "the actual format row is admitted before access"); formatReads += 1; }
        return Reflect.get(target, key, receiver);
      } });
      const deps = { ...value.deps, types: view, typeOf: type => { reads.push(type); return types.readType(interner, type); },
        selectedNativeFacts: { ...nativeFactsFixture(), floatingFormats: formats },
        limits: { ...limits, [field]: 32, maximumArithmeticWork: maximum } };
      const machine = { deps, arithmetic: 0, result: null, unit: value.unit };
      const floating = { kind: "floating", type: selected, bits: 0n };
      assert.equal(valueFits(machine, floating, field, origin), maximum === 4);
      same(reads, [selected, first, primitive].slice(0, maximum), "only actual charged rows are read, including the endpoint");
      assert.equal(formatReads, maximum === 4 ? 1 : 0);
      assert.equal(machine.arithmetic, maximum);
      if (maximum < 4) {
        const refusal = machine.result;
        same(refusal.diagnostics[0].arguments,
          [{ kind: "text", value: "evaluation.maximumArithmeticWork" }, { kind: "number", value: maximum }],
          "the original arithmetic account owns the first refusal");
        assert.equal(valueFits(machine, floating, field, origin), false);
        assert.equal(machine.result, refusal);
        assert.equal(reads.length, Math.min(maximum, 3), "an already-refused invocation performs no later row read");
      } else {
        assert.equal(valueFits(machine, floating, field, origin), false, "a second read borrows the exhausted original invocation");
        assert.equal(machine.arithmetic, 4);
        assert.equal(reads.length, 3);
        assert.equal(formatReads, 1);
      }
    }
    const deps = { ...value.deps, types: view, typeOf: type => types.readType(interner, type),
      selectedNativeFacts: { ...nativeFactsFixture(), floatingFormats: [format] },
      limits: { ...limits, [field]: 31, maximumArithmeticWork: 4 } };
    const machine = { deps, arithmetic: 0, result: null, unit: value.unit };
    assert.equal(valueFits(machine, { kind: "floating", type: selected, bits: 0n }, field, origin), false);
    assert.equal(machine.arithmetic, 4);
    same(machine.result.diagnostics[0].arguments,
      [{ kind: "text", value: `evaluation.${field}` }, { kind: "number", value: 31 }],
      "after the charged relation completes, the full encoding owns its actual bit refusal");
    const invoke = typeOf => valueFits({ deps: { ...deps, typeOf }, arithmetic: 0, result: null, unit: value.unit },
      { kind: "floating", type: selected, bits: 0n }, field, origin);
    assert.throws(() => invoke(() => undefined), /complete ready type row/u);
    const invalidBase = { kind: "literal", base: selected,
      value: { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: false } } };
    const malformed = { ...deps, types: { terms: [invalidBase], signatures: [] }, typeOf: () => invalidBase,
      limits: { ...limits, maximumArithmeticWork: 4 } };
    assert.throws(() => valueFits({ deps: malformed, arithmetic: 0, result: null, unit: value.unit },
      { kind: "floating", type: 0, bits: 0n }, field, origin), /actual ready type domain/u);
    let missingDomainReads = 0;
    const missing = { ...deps, types: { terms: [], signatures: [] },
      typeOf: type => { missingDomainReads += 1; return types.readType(interner, type); } };
    const missingMachine = { deps: missing, arithmetic: 0, result: null, unit: value.unit };
    assert.throws(() => valueFits(missingMachine, { kind: "floating", type: selected, bits: 0n }, field, origin),
      /actual ready type domain/u);
    assert.equal(missingDomainReads, 0, "a mismatched captured domain is not repaired by a valid unrelated reader");
    assert.equal(missingMachine.arithmetic, 0);
  }
});

test("each supplied floating format candidate is admitted before its row or payload is read", async () => {
  const value = fixture("evaluate-floating-format-prefix");
  const { valueFits } = await import("../../packages/host/dist/evaluate/budget.js");
  const interner = admitFixtureTable(types, TABLE);
  const type = insertFixtureType(types, interner, { kind: "primitive", primitive: "float64" });
  const rows = [["float16", "ieee754-binary16"], ["float32", "ieee754-binary32"], ["float64", "ieee754-binary64"]]
    .map(([carrier, interchange]) => ({ carrier, interchange,
      nanSignObservable: false, nanPayloadObservable: false, signalingNaNObservable: false }));
  const origin = value.body.blocks[0].origin;
  for (const field of ["maximumIntermediateBits", "maximumResultBits"]) for (let maximum = 0; maximum <= 4; maximum += 1) {
    const reads = [];
    const formats = new Proxy(rows, { get(target, key, receiver) {
      if (typeof key === "string" && /^\d+$/.test(key)) {
        const index = Number(key);
        assert.equal(maximum >= index + 2, true, "one actual type and each actual candidate must be admitted first");
        reads.push(index);
      }
      return Reflect.get(target, key, receiver);
    } });
    const machine = { deps: { ...value.deps, types: types.viewTypes(interner), typeOf: selected => types.readType(interner, selected),
      selectedNativeFacts: { ...nativeFactsFixture(), floatingFormats: formats },
      limits: { ...limits, [field]: 64, maximumArithmeticWork: maximum } }, result: null, arithmetic: 0, unit: value.unit };
    const floating = { kind: "floating", type, bits: 0n };
    assert.equal(valueFits(machine, floating, field, origin), maximum === 4);
    same(reads, [0, 1, 2].slice(0, Math.max(0, maximum - 1)), "only the exact admitted prefix is read");
    assert.equal(machine.arithmetic, maximum);
    const original = machine.result;
    assert.equal(valueFits(machine, floating, field, origin), false);
    if (original !== null) assert.equal(machine.result, original);
    same(reads, [0, 1, 2].slice(0, Math.max(0, maximum - 1)), "neither a refused nor exhausted invocation reads another candidate");
  }
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
    [{ ...target, entries: [] }, /actually admissible provided entry/u],
    [{ ...target, entries: [{ provided: 2, block: 0 }] }, /actually admissible provided entry/u],
    [{ ...target, entries: [{ provided: 1, block: 0 }] }, /actually admissible provided entry/u],
    [{ ...target, locals: [] }, /every fixed argument/u],
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
  assert.throws(() => run(make({ kind: "native-operator", operator: "+", carrier: "int32" })), /actual Rules-selected unary integer result conversion association/u);
  assert.throws(() => run(make({ kind: "native-operator", operator: "-", carrier: "int32" })), /actual selected native operation law/u);
  assert.throws(() => run(make({ kind: "native-operator", operator: "<", carrier: "int32" }, [])), /two actual operands/u);
  assert.throws(() => run(make({ kind: "bigint-operator", operator: "+" })), /actual selected native operation law/u);
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
