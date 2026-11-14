import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { runCase } from "../host-cases/case.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const sourceFiles = ["contract.ts", "database.ts", "index.ts", "memo.ts"]
  .map(name => `packages/host/src/query/${name}`);
const runtimeFiles = ["database.js", "index.js", "memo.js"]
  .map(name => resolve(repository, "packages/host/dist/query", name));
const dependencyFiles = [
  "diag/contract.ts", "diag/index.ts", "diag/invariant.ts", "diag/order.ts",
  "ids/contract.ts", "ids/identity.ts", "ids/index.ts", "ids/key.ts",
].map(path => `packages/host/src/${path}`);
const interfaceFiles = ["diag/contract.ts", "diag/index.ts", "ids/contract.ts", "ids/index.ts"]
  .map(path => `packages/host/src/${path}`);
const caseDirectory = "test/host-cases/query/function";
const casePaths = readdirSync(resolve(repository, caseDirectory)).filter(name => name.endsWith(".case.json")).sort()
  .map(name => `${caseDirectory}/${name}`);
const areaData = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
const quarantineRoots = areaData.areas.map(area => area.directory);
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let product;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the complete suite requires aggregate admission");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import("../../packages/host/dist/query/index.js");
});

function diagnostic(number, path, message) {
  return ({ code: ({ kind: "checker", number, rendered: `TS${number}` }),
    severity: "error", site: ({ kind: "file", path }), source: "query-case", evidence: ([]),
    message, arguments: ([]), related: ([]), fix: null });
}

const unitError = construct => (key, cause, data) => ({ value: construct(key, cause, data), positions: [{ position: { kind: "result" }, error: { kind: "error", causes: [cause] } }] });
const unbounded = { maximumRecords: Number.MAX_SAFE_INTEGER };
const none = { witness: null, earned: [] };
const noCycle = () => { throw new Error("this case closes no cycle"); };
const fact = (query, key, encodedKey) => ({ query, key, encodedKey });
const cause = { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: "classified", index: 0 } } };
const errors = cycle => cycle.members.map(() => ({ kind: "error", data: null, emissions: [], cause, diagnostics: [] }));

const resultPosition = { kind: "result" };
const unitAt = (query, key, position = resultPosition) => ({ request: { query, key }, position });
const unitCause = unit => ({ kind: "unit", unit });
const hostCause = unit => ({ kind: "diagnostic", diagnostic: { kind: "host", unit, code: "TSONIC_UNIT_CYCLE" } });
const hostError = () => ({ ...diagnostic(0, "actual.ts", "actual detected semantic cycle"), code: {
  kind: "host", name: "TSONIC_UNIT_CYCLE", rendered: "TSONIC_UNIT_CYCLE" } });
const errorPositions = (position, causes) => ({ position, error: { kind: "error", causes } });

test("distinct finalized inference-variable positions retain their exact error or known-null without source-node collision", () => {
  const group = "G[actual-completed-group]";
  const position = variable => ({ kind: "inference-variable", group, variable });
  const failed = unitAt("solutionOf", group, position(0));
  const cause = hostCause(failed);
  const detected = hostError();
  const error = { kind: "error", causes: [cause] };
  const query = { name: "solutionOf", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({
    kind: "ok", value: ["error type", "known type"], diagnostics: [detected], emissions: [{ identity: cause.diagnostic, diagnostic: detected }],
    positions: [{ position: position(0), error }, { position: position(1), error: null },
      errorPositions(resultPosition, [unitCause(failed)])] }) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.errorOf(failed), { kind: "uncomputed" });
  assert.equal(database.run(query, group).kind, "completed");
  const read = database.errorOf(failed);
  assert.equal(read.kind, "completed");
  assert.equal(read.error, error, "the finalized variable retains its original ErrorValue object");
  assert.deepEqual(database.errorOf(unitAt("solutionOf", group, position(1))), { kind: "completed", error: null });
  for (const variable of [-0, -1, 2, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.deepEqual(database.errorOf(unitAt("solutionOf", group, position(variable))), { kind: "invalid-position" });
  assert.deepEqual(database.errorOf(unitAt("solutionOf", group, { ...position(0), group: "different-group" })), { kind: "invalid-position" });
  assert.deepEqual(database.errorOf(unitAt("solutionOf", "different-group", position(0))), { kind: "uncomputed" });
  assert.deepEqual(database.errorOf(unitAt("solutionOf", group, { kind: "source-node", node: { kind: "body", value: { body: "same-syntax", node: 0 } } })),
    { kind: "invalid-position" }, "a source occurrence is not an inferred variable's position");
  assert.equal(database.run(query, group).kind, "completed");
  assert.deepEqual(database.diagnostics(), [detected]);
});

test("unit completion retains actual declared positions, normal multi-cause absorption and exact emission identity", () => {
  const source = { kind: "source-node", node: { kind: "body", value: { body: "actual-body", node: 3 } } };
  const detected = hostError();
  const root = unitAt("actual-root", ["binding", 1], source);
  const original = hostCause(root);
  const emitted = { identity: original.diagnostic, diagnostic: detected };
  const leaf = { name: "actual-root", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({
    kind: "ok", value: "error type", diagnostics: [detected], emissions: [emitted], positions: [
      errorPositions(source, [original]), errorPositions(resultPosition, [unitCause(root)]),
      { position: { kind: "module-node", module: "actual.ts", node: 8 }, error: null }] }) };
  const second = { name: "second", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context =>
    context.get(leaf, root.request.key, none, value => {
      const read = context.errorOf(root);
      assert.equal(read.kind, "completed");
      assert.equal(read.error.causes[0] === original, true);
      return { kind: "ok", value, diagnostics: [], emissions: [], positions: [errorPositions(resultPosition, [unitCause(root)])] };
    }) };
  const third = { name: "third", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context =>
    context.get(second, 7, none, value => ({ kind: "ok", value, diagnostics: [], emissions: [],
      positions: [errorPositions(resultPosition, [unitCause(unitAt("second", 7)), unitCause(root)])] })) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.errorOf(root), { kind: "uncomputed" });
  assert.equal(database.run(third, null).kind, "completed");
  assert.deepEqual(database.errorOf(unitAt("third", null)), { kind: "completed", error: {
    kind: "error", causes: [unitCause(unitAt("second", 7)), unitCause(root)] } });
  assert.deepEqual(database.errorOf(unitAt("actual-root", root.request.key, { kind: "module-node", module: "actual.ts", node: 8 })), { kind: "completed", error: null });
  assert.deepEqual(database.errorOf(unitAt("actual-root", root.request.key, { kind: "module-node", module: "actual.ts", node: 9 })), { kind: "invalid-position" });
  assert.deepEqual(database.errorOf(unitAt("actual-root", ["binding", 2], source)), { kind: "uncomputed" });
  database.run(third, null);
  assert.deepEqual(database.diagnostics(), [detected]);
  const refusal = { name: "refusing", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "refused", diagnostics: [detected] }) };
  database.run(refusal, null);
  assert.deepEqual(database.errorOf(unitAt("refusing", null)), { kind: "refused", diagnostics: [detected] });
});

test("all typed-error cycle rotations ground in one real originating host unit and emit once", () => {
  for (const start of ["A", "B", "C"]) {
    const detected = hostError();
    const root = unitAt("C", null);
    const original = hostCause(root);
    const rows = {};
    for (const [name, next] of [["A", "B"], ["B", "C"], ["C", "A"]]) rows[name] = {
      name, keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => `${name}:error`) },
      compute: context => context.get(rows[next], null, none, () => { throw new Error("no partial cycle resumption"); }) };
    const database = product.createDatabase(null, unbounded, cycle => cycle.members.map(member => {
      const origin = member.fact.query === "C";
      return { kind: "error", data: null, cause: origin ? original : unitCause(root), diagnostics: origin ? [detected] : [],
        emissions: origin ? [{ identity: original.diagnostic, diagnostic: detected }] : [] };
    }), "recorded");
    assert.equal(database.run(rows[start], null).value, `${start}:error`);
    for (const name of ["A", "B", "C"]) {
      assert.equal(database.run(rows[name], null).value, `${name}:error`);
      assert.equal(database.errorOf(unitAt(name, null)).kind, "completed");
    }
    assert.deepEqual(database.diagnostics(), [detected]);
  }
});

test("uncomputed, invalid, known-null and ungrounded causes never publish a semantic answer", () => {
  const source = { kind: "source-node", node: { kind: "item", value: { owner: "actual-owner", node: 2 } } };
  const result = unitAt("bad", null);
  const detected = hostError();
  const own = hostCause(result);
  const elsewhere = hostCause(unitAt("bad", null, source));
  const good = { kind: "ok", value: 0, diagnostics: [detected], emissions: [{ identity: own.diagnostic, diagnostic: detected }],
    positions: [errorPositions(resultPosition, [own])] };
  const cases = [
    { ...good, positions: [] },
    { ...good, positions: [good.positions[0], good.positions[0]] },
    { ...good, positions: [errorPositions(resultPosition, [])] },
    { ...good, emissions: [] },
    { ...good, diagnostics: [] },
    { ...good, emissions: [good.emissions[0], good.emissions[0]] },
    { ...good, emissions: [{ identity: own.diagnostic, diagnostic: diagnostic(1, "x", "wrong") }], diagnostics: [] },
    (() => { const wrong = diagnostic(1, "x", "wrong"); return { ...good, diagnostics: [wrong], emissions: [{ identity: own.diagnostic, diagnostic: wrong }] }; })(),
    { ...good, emissions: [{ identity: { ...own.diagnostic, code: "OTHER_CODE" }, diagnostic: detected }] },
    { ...good, emissions: [{ identity: { ...own.diagnostic, unit: unitAt("bad", "other") }, diagnostic: detected }] },
    { ...good, emissions: [{ identity: elsewhere.diagnostic, diagnostic: detected }] },
    { ...good, positions: [errorPositions(source, [elsewhere]), errorPositions(resultPosition, [own])], emissions: [{ identity: elsewhere.diagnostic, diagnostic: detected }] },
    { ...good, positions: [errorPositions(resultPosition, [unitCause(unitAt("missing", null))])] },
    { ...good, positions: [errorPositions(resultPosition, [unitCause(unitAt("bad", null, source))])] },
    { ...good, positions: [{ position: source, error: null }, errorPositions(resultPosition, [unitCause(unitAt("bad", null, source))])] },
    { ...good, positions: [errorPositions(resultPosition, [unitCause(result)])] },
    { ...good, positions: [errorPositions(resultPosition, [unitCause(unitAt("bad", null, source))]), errorPositions(source, [own])] },
  ];
  for (const value of cases) {
    const database = product.createDatabase(null, unbounded, noCycle, "off");
    const row = { name: "bad", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => value };
    assert.throws(() => database.run(row, null), error => error.name === "Error");
    assert.deepEqual(database.errorOf(result), { kind: "uncomputed" });
    assert.deepEqual(database.diagnostics(), []);
  }
});

test("classified error data stays in the same row relation; wrong payloads and ungrounded cycles settle no member", () => {
  for (const wrong of [false, true]) {
    const payload = { kind: wrong ? "layout" : "declared-signature", ready: { original: true } };
    const rows = {};
    const firstCause = { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: "actual.ts", index: 0 } } };
    for (const [name, next] of [["A", "B"], ["B", "A"]]) rows[name] = {
      name, keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError((key, cause, data) => {
        assert.equal(data === payload, true);
        if (data.kind !== "declared-signature") throw new Error("wrong actual row payload arm");
        return key;
      }) }, compute: context => context.get(rows[next], null, none, () => { throw new Error("not resumed"); }) };
    const database = product.createDatabase(null, unbounded, cycle => cycle.members.map(() => ({ kind: "error", data: payload,
      cause: firstCause, emissions: [], diagnostics: [] })), "off");
    if (wrong) {
      assert.throws(() => database.run(rows.A, null), /wrong actual row payload arm/u);
      assert.deepEqual(database.errorOf(unitAt("A", null)), { kind: "uncomputed" });
      assert.deepEqual(database.errorOf(unitAt("B", null)), { kind: "uncomputed" });
    } else assert.equal(database.run(rows.A, null).kind, "completed");
  }
  for (const mode of ["cycle", "dropped-cause", "refused-dependency"]) {
    const rows = {};
    const diagnostic = hostError();
    const database = product.createDatabase(null, unbounded, cycle => cycle.members.map(member => ({ kind: "error", data: null,
      cause: unitCause(unitAt(member.fact.query === "A" ? "B" : "A", null)), emissions: [], diagnostics: [] })), "off");
    for (const [name, next] of [["A", "B"], ["B", "A"]]) rows[name] = {
      name, keyData: key => key, answerPolicy: { kind: "typed-error", construct: mode === "dropped-cause"
        ? () => ({ value: 0, positions: [{ position: resultPosition, error: null }] }) : unitError(() => 0) },
      compute: context => context.get(rows[next], null, none, () => { throw new Error("not resumed"); }) };
    if (mode === "refused-dependency") {
      const refused = { name: "refused", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "refused", diagnostics: [diagnostic] }) };
      database.run(refused, null);
      rows.A.compute = () => ({ kind: "ok", value: 0, diagnostics: [], emissions: [], positions: [errorPositions(resultPosition, [unitCause(unitAt("refused", null))])] });
    }
    assert.throws(() => database.run(rows.A, null), error => error.name === "Error");
    assert.deepEqual(database.errorOf(unitAt("A", null)), { kind: "uncomputed" });
    assert.deepEqual(database.errorOf(unitAt("B", null)), { kind: "uncomputed" });
  }
});

test("a borrowed same-code diagnostic is not a detector emission at another position or request", () => {
  const root = unitAt("origin", null);
  const detected = hostError();
  const original = hostCause(root);
  const origin = { name: "origin", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({
    kind: "ok", value: 0, diagnostics: [detected], emissions: [{ identity: original.diagnostic, diagnostic: detected }],
    positions: [errorPositions(resultPosition, [original])] }) };
  for (const attachBorrowed of [false, true]) {
    const database = product.createDatabase(null, unbounded, noCycle, "off");
    const own = hostCause(unitAt("borrower", null));
    const borrower = { name: "borrower", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context =>
      context.get(origin, null, none, () => ({ kind: "ok", value: 0, diagnostics: [detected],
        emissions: attachBorrowed ? [{ identity: original.diagnostic, diagnostic: detected }] : [], positions: [errorPositions(resultPosition, [own])] })) };
    assert.throws(() => database.run(borrower, null), error => error.name === "Error");
    assert.deepEqual(database.errorOf(unitAt("borrower", null)), { kind: "uncomputed" });
    assert.deepEqual(database.diagnostics(), [detected]);
  }
});

test("answer position and emission records consume the same existing bound before retained allocation", () => {
  for (const maximumRecords of [0, 1, 2, 3]) {
    const database = product.createDatabase(null, { maximumRecords }, noCycle, "off");
    const row = { name: "positions", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", value: 7,
      diagnostics: [], emissions: [], positions: [{ position: { kind: "module-node", module: "actual.ts", node: 1 }, error: null }, { position: resultPosition, error: null }] }) };
    assert.equal(database.run(row, null).kind, maximumRecords === 3 ? "completed" : "refused");
    assert.deepEqual(database.errorOf(unitAt("positions", null)), maximumRecords === 3 ? { kind: "completed", error: null } : { kind: "uncomputed" });
  }
  const self = { name: "limited-cycle", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => 0) },
    compute: context => context.get(self, null, none, () => { throw new Error("not resumed"); }) };
  const database = product.createDatabase(null, { maximumRecords: 5 }, errors, "recorded");
  assert.equal(database.run(self, null).kind, "refused");
  assert.deepEqual(database.errorOf(unitAt("limited-cycle", null)), { kind: "uncomputed" });
  const detected = hostError();
  const own = hostCause(unitAt("late-error", null));
  const late = { name: "late-error", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({
    kind: "ok", value: 0, diagnostics: [detected], emissions: [{ identity: own.diagnostic, diagnostic: detected }], positions: [errorPositions(resultPosition, [own])] }) };
  for (const maximumRecords of [2, 3]) {
    const bounded = product.createDatabase(null, { maximumRecords }, noCycle, "off");
    assert.equal(bounded.run(late, null).kind, maximumRecords === 3 ? "completed" : "refused");
    assert.deepEqual(bounded.diagnostics(), maximumRecords === 3 ? [detected] : [detected, limitReached(2, "late-error", "N")]);
  }
  const cycleOrigin = hostCause(unitAt("late-cycle", null));
  const cycle = { name: "late-cycle", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => 0) },
    compute: context => context.get(cycle, null, none, () => { throw new Error("not resumed"); }) };
  const cycleBound = product.createDatabase(null, { maximumRecords: 1 }, closed => closed.members.map(() => ({
    kind: "error", data: null, cause: cycleOrigin, diagnostics: [detected], emissions: [{ identity: cycleOrigin.diagnostic, diagnostic: detected }] })), "off");
  assert.equal(cycleBound.run(cycle, null).kind, "refused");
  assert.deepEqual(cycleBound.errorOf(unitAt("late-cycle", null)), { kind: "uncomputed" });
  assert.deepEqual(cycleBound.diagnostics(), [detected, limitReached(1, "late-cycle", "N")]);
  let reads = 0;
  for (const size of [16, 64, 256]) {
    reads = 0;
    const positions = Array.from({ length: size }, (_, index) => ({ position: { kind: "module-node", module: "actual.ts", get node() { reads += 1; return index; } }, error: null }));
    const row = { name: "indexed", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", value: size, diagnostics: [], emissions: [], positions }) };
    const database = product.createDatabase(null, { maximumRecords: size + 1 }, noCycle, "off");
    assert.equal(database.run(row, null).kind, "completed");
    assert.equal(reads, size, "each actual position is indexed once at publication");
    for (let index = 0; index < size; index += 1) assert.deepEqual(database.errorOf(unitAt("indexed", null, { kind: "module-node", module: "actual.ts", node: index })), { kind: "completed", error: null });
    assert.equal(reads, size, "position lookup does not rescan stored positions");
  }
});
const limitReached = (maximum, name, encodedKey) => ({ code: { kind: "host", name: "TSONIC_COMPILER_RESOURCE_LIMIT", rendered: "TSONIC_COMPILER_RESOURCE_LIMIT" },
  severity: "error", site: { kind: "none" }, source: "query", evidence: ["query.maximumRecords", name, encodedKey, "A1:S6:result"],
  message: "A compiler resource limit was reached.", arguments: [{ kind: "text", value: "query.maximumRecords" }, { kind: "number", value: maximum }], related: [], fix: null });
const stoppedAt = (maximum, name, encodedKey) => ({ kind: "refused", diagnostics: [limitReached(maximum, name, encodedKey)] });


function evaluate(input) {
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  const queries = new Map(input.queries.map(entry => [entry.name, {
    expected: entry.value,
    query: { name: entry.name, keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: entry.value, diagnostics: [] }) },
  }]));
  const values = [];
  for (const request of input.requests) {
    const selected = queries.get(request.query);
    assert.equal(selected !== undefined, true, "each authored request names its actual query definition");
    const result = database.run(selected.query, request.key);
    assert.deepEqual(result, { kind: "completed", value: selected.expected, diagnostics: [] });
    values.push(result.value);
  }
  return { values, statistics: database.stats(), diagnostics: database.diagnostics() };
}

for (const path of casePaths) {
  test(`query authored function case ${basename(path, ".case.json")}`, async () => {
    const deps = {
      modules: ["query"],
      evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split("\\").join("/"),
      readText: path => readFileSync(resolve(repository, path), "utf8"),
      list: path => readdirSync(resolve(repository, path)),
      decode: (text, format) => { assert.equal(format, "json"); return JSON.parse(text); },
      adapters: { function: input => ({ kind: "accepted", value: evaluate(JSON.parse(input.text)), diagnostics: [] }) },
    };
    const result = await runCase(deps, path);
    assert.equal(result.status, "passed", JSON.stringify(result.status === "failed" ? result : { path }));
  });
}

test("query exposes exactly the one agreed public value", () => {
  assert.deepEqual(Object.keys(product), ["createDatabase"]);
  assert.deepEqual(casePaths.map(path => basename(path, ".case.json")),
    ["content-memo", "empty", "key-kinds", "name-boundaries", "query-names-reversed", "query-names", "tuple-boundaries"]);
});

test("an untouched database exposes its exact inputs and empty immutable snapshots without computing", () => {
  const inputs = ({ root: "analysis", count: 0 });
  const database = product.createDatabase(inputs, { maximumRecords: 0 }, noCycle, "recorded");
  assert.equal(database.inputs, inputs);
  assert.deepEqual(database.trace(), []);
  const statistics = database.stats();
  const diagnostics = database.diagnostics();
  assert.deepEqual(statistics, []);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(database.stats(), []);
  assert.deepEqual(database.diagnostics(), []);
});


test("construction retains arbitrary actual Inputs rather than encoding, copying or defaulting them", () => {
  const callable = () => "input";
  for (const inputs of [undefined, null, false, 0, -0, 1n, "", callable, ({ value: false })]) {
    const database = product.createDatabase(inputs, unbounded, noCycle, "recorded");
    assert.equal(database.inputs, inputs);
    assert.deepEqual(database.stats(), []);
    assert.deepEqual(database.diagnostics(), []);
  }
});

test("one actual query definition receives each database's own Inputs and independent memo", () => {
  let received;
  const query = { name: "input", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: (database, key) => {
    received = database;
    return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: `${database.inputs.prefix}:${key}`, diagnostics: [] };
  } };
  const left = product.createDatabase({ prefix: "left" }, unbounded, noCycle, "recorded");
  const right = product.createDatabase({ prefix: "right" }, unbounded, noCycle, "recorded");
  for (let request = 0; request < 2; request += 1) {
    assert.deepEqual(left.run(query, "key"), { kind: "completed", value: "left:key", diagnostics: [] });
    if (request === 0) {
      assert.equal(received.inputs, left.inputs);
      assert.equal(received.run, undefined);
    }
    assert.deepEqual(right.run(query, "key"), { kind: "completed", value: "right:key", diagnostics: [] });
    assert.equal(received.inputs, right.inputs);
  }
  assert.deepEqual(left.stats(), [{ name: "input", computed: 1, hits: 1 }]);
  assert.deepEqual(right.stats(), [{ name: "input", computed: 1, hits: 1 }]);
  assert.deepEqual(left.diagnostics(), []);
  assert.deepEqual(right.diagnostics(), []);
});

test("a registered projection defines identity once per demand while computation and cycle construction keep the original typed key", () => {
  const projections = [];
  const computed = [];
  const constructed = [];
  const original = { label: "recursive", evidence: new Map([["ready", 7]]) };
  const equivalent = { label: "recursive", evidence: new Map([["different", 9]]) };
  const leafKey = { label: "leaf", evidence: new Map() };
  let captured;
  const query = { name: "typed-key", keyData: key => { projections.push(key); return key.label; },
    answerPolicy: { kind: "typed-error", construct: unitError((key, received) => {
      constructed.push(key);
      assert.equal(received === cause, true, "the original classified cause");
      return { key };
    }) },
    compute: (context, key) => {
      computed.push(key);
      assert.equal(context.fact.query, "typed-key");
      assert.equal(context.fact.key, key.label);
      if (key === leafKey) return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: { key }, diagnostics: [] };
      return context.get(query, equivalent, none, () => { throw new Error("a settled cycle does not resume"); });
    } };
  const database = product.createDatabase(null, unbounded, cycle => { captured = cycle; return errors(cycle); }, "recorded");
  const first = database.run(query, original);
  assert.equal(first.kind, "completed");
  assert.equal(first.value.key === original, true, "constructor gets the actual active computation's key, not an equivalent reconstruction");
  assert.equal(database.run(query, equivalent).value === first.value, true, "equivalent projection is the same completed fact");
  assert.equal(database.run(query, leafKey).value.key === leafKey, true);
  assert.deepEqual(projections, [original, equivalent, equivalent, leafKey]);
  assert.deepEqual(computed, [original, leafKey]);
  assert.deepEqual(constructed, [original]);
  assert.deepEqual(captured.members.map(member => member.fact), [fact("typed-key", "recursive", "S9:recursive")]);
  assert.deepEqual(database.trace().filter(event => event.kind === "dependency").map(event => event.state), ["cold", "active", "warm", "cold"]);
});

test("completed wrappers memoize undefined, functions, bigint and every scalar without a missing-value fallback", () => {
  const callable = () => 7;
  const values = [undefined, null, false, true, 0, -0, NaN, Infinity, -Infinity, 9007199254740995n,
    "", ({ value: 1 }), ([]), callable];
  const query = { name: "values", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: (_, key) => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: values[key], diagnostics: [] }) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  for (const [key, expected] of values.entries()) {
    for (let request = 0; request < 2; request += 1) {
      assert.deepEqual(database.run(query, key), { kind: "completed", value: expected, diagnostics: [] });
    }
  }
  assert.deepEqual(database.stats(), [{ name: "values", computed: 14, hits: 14 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("numeric key identity includes exact bigint, negative zero, infinities and all framed scalar distinctions", () => {
  const keys = [0, -0, 1, 1n, "1", NaN, Infinity, -Infinity, 9007199254740995n, false, true, null];
  let computed = 0;
  const query = { name: "scalars", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: ++computed, diagnostics: [] }) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  for (const [index, key] of keys.entries()) {
    assert.deepEqual(database.run(query, key), { kind: "completed", value: index + 1, diagnostics: [] });
  }
  for (const [index, key] of keys.entries()) {
    assert.deepEqual(database.run(query, key), { kind: "completed", value: index + 1, diagnostics: [] });
  }
  assert.deepEqual(database.stats(), [{ name: "scalars", computed: 12, hits: 12 }]);
  assert.equal(computed, 12);
});

test("completed ok and refused diagnostic vectors retain exact snapshots without republishing hits", () => {
  const first = diagnostic(1, "a.ts", "first");
  const second = diagnostic(2, "b.ts", "second");
  const supplied = [second, first];
  const query = { name: "ok", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: supplied }) };
  const refused = { name: "refused", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "refused", diagnostics: [first, second] }) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  const original = database.run(query, null);
  assert.deepEqual(original, { kind: "completed", value: 7, diagnostics: [second, first] });
  supplied.length = 0;
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 7, diagnostics: [second, first] });
  const before = database.diagnostics();
  assert.deepEqual(before, [first, second]);
  for (let request = 0; request < 2; request += 1) {
    assert.deepEqual(database.run(refused, null), { kind: "refused", diagnostics: [first, second] });
  }
  assert.deepEqual(before, [first, second]);
  assert.deepEqual(database.diagnostics(), [first, first, second, second]);
  assert.deepEqual(database.stats(), [{ name: "ok", computed: 1, hits: 1 }, { name: "refused", computed: 1, hits: 1 }]);
});

test("ok sparse vectors retain empty, absent and later present slots across root and dependency memo hits", () => {
  const first = diagnostic(1, "a.ts", "first");
  const second = diagnostic(2, "b.ts", "second");
  const replacement = diagnostic(3, "c.ts", "replacement");
  for (const route of ["root", "dependency"]) {
    for (const vector of [
      { supplied: [], expected: [], aggregate: [] },
      { supplied: new Array(1), expected: new Array(1), aggregate: [] },
      { supplied: [second, first], expected: [second, first], aggregate: [first, second] },
      { supplied: [, second], expected: [, second], aggregate: [second] },
      { supplied: [second, , first, ,], expected: [second, , first, ,], aggregate: [first, second] },
    ]) {
      let continuation = 0;
      const child = { name: "child", keyData: key => key, answerPolicy: { kind: "refusal-only" },
        compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: vector.supplied }) };
      const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(child, null, none, value => {
        continuation += 1;
        return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + 1, diagnostics: [] };
      }) };
      const database = product.createDatabase(null, unbounded, noCycle, "recorded");
      const selected = route === "root" ? child : parent;
      const expected = route === "root"
        ? { kind: "completed", value: 7, diagnostics: vector.expected }
        : { kind: "completed", value: 8, diagnostics: [] };
      const cold = database.run(selected, null);
      assert.deepEqual(cold, expected);
      const retained = route === "root" ? cold : database.run(child, null);
      assert.deepEqual(retained, { kind: "completed", value: 7, diagnostics: vector.expected });
      assert.notEqual(retained.diagnostics, vector.supplied);
      assert.deepEqual(Object.keys(retained.diagnostics), Object.keys(vector.expected));
      vector.expected.forEach((entry, index) => { assert.equal(retained.diagnostics[index], entry); });
      assert.deepEqual(vector.supplied, vector.expected);
      const previous = database.diagnostics();
      assert.deepEqual(previous, vector.aggregate);
      vector.aggregate.forEach((entry, index) => { assert.equal(previous[index], entry); });
      vector.supplied.length = 0;
      vector.supplied.push(replacement);
      const warm = database.run(selected, null);
      assert.deepEqual(warm, expected);
      assert.equal(warm.diagnostics, cold.diagnostics);
      assert.deepEqual(retained, { kind: "completed", value: 7, diagnostics: vector.expected });
      assert.deepEqual(previous, vector.aggregate);
      assert.deepEqual(database.diagnostics(), vector.aggregate);
      assert.deepEqual(database.stats(), route === "root"
        ? [{ name: "child", computed: 1, hits: 1 }]
        : [{ name: "child", computed: 1, hits: 1 }, { name: "parent", computed: 1, hits: 1 }]);
      assert.equal(continuation, route === "root" ? 0 : 1);
    }
  }
});

test("nonempty refused sparse vectors retain real heads and absent tails through dependency stop carriage", () => {
  const first = diagnostic(1, "a.ts", "first");
  const second = diagnostic(2, "b.ts", "second");
  const replacement = diagnostic(3, "c.ts", "replacement");
  for (const route of ["root", "dependency"]) {
    for (const vector of [
      { supplied: [second], expected: [second], aggregate: [second] },
      { supplied: [second, ,], expected: [second, ,], aggregate: [second] },
      { supplied: [second, , first, ,], expected: [second, , first, ,], aggregate: [first, second] },
    ]) {
      let continuation = 0;
      const child = { name: "child", keyData: key => key, answerPolicy: { kind: "refusal-only" },
        compute: () => ({ kind: "refused", diagnostics: vector.supplied }) };
      const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(child, null, none, value => {
        continuation += 1;
        return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] };
      }) };
      const database = product.createDatabase(null, unbounded, noCycle, "recorded");
      const selected = route === "root" ? child : parent;
      const cold = database.run(selected, null);
      assert.deepEqual(cold, { kind: "refused", diagnostics: vector.expected });
      assert.notEqual(cold.diagnostics, vector.supplied);
      assert.deepEqual(Object.keys(cold.diagnostics), Object.keys(vector.expected));
      vector.expected.forEach((entry, index) => { assert.equal(cold.diagnostics[index], entry); });
      assert.deepEqual(vector.supplied, vector.expected);
      const previous = database.diagnostics();
      assert.deepEqual(previous, vector.aggregate);
      vector.aggregate.forEach((entry, index) => { assert.equal(previous[index], entry); });
      vector.supplied.length = 0;
      vector.supplied.push(replacement);
      const warm = database.run(selected, null);
      assert.deepEqual(warm, { kind: "refused", diagnostics: vector.expected });
      assert.equal(warm, cold);
      assert.deepEqual(previous, vector.aggregate);
      assert.deepEqual(database.diagnostics(), vector.aggregate);
      assert.deepEqual(database.stats(), route === "root"
        ? [{ name: "child", computed: 1, hits: 1 }]
        : [{ name: "child", computed: 1, hits: 1 }, { name: "parent", computed: 2, hits: 0 }]);
      assert.equal(continuation, 0);
    }
  }
});








test("A to B to C computes once, records actual hits and publishes each completed vector once", () => {
  const rootDiagnostic = diagnostic(1, "a.ts", "root");
  const middleDiagnostic = diagnostic(2, "b.ts", "middle");
  const leafDiagnostic = diagnostic(3, "c.ts", "leaf");
  const leaf = { name: "C", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 2, diagnostics: [leafDiagnostic] }) };
  const middle = { name: "B", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: database => database.get(leaf, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + 1, diagnostics: [middleDiagnostic] })) };
  const root = { name: "A", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(middle, null,
    none, left => context.get(middle, null, none, right => context.get(leaf, null,
      none, last => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: left + right + last, diagnostics: [rootDiagnostic] })))) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(root, null), { kind: "completed", value: 8, diagnostics: [rootDiagnostic] });
  const previous = database.stats();
  assert.deepEqual(previous, [{ name: "A", computed: 1, hits: 0 }, { name: "B", computed: 1, hits: 1 },
    { name: "C", computed: 1, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), [rootDiagnostic, middleDiagnostic, leafDiagnostic]);
  assert.deepEqual(database.run(root, null), { kind: "completed", value: 8, diagnostics: [rootDiagnostic] });
  assert.deepEqual(database.stats(), [{ name: "A", computed: 1, hits: 1 }, { name: "B", computed: 1, hits: 1 },
    { name: "C", computed: 1, hits: 1 }]);
  assert.deepEqual(previous, [{ name: "A", computed: 1, hits: 0 }, { name: "B", computed: 1, hits: 1 },
    { name: "C", computed: 1, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), [rootDiagnostic, middleDiagnostic, leafDiagnostic]);
});



test("a refused dependency abandons its caller, preserves the complete vector and never fabricates a value", () => {
  const first = diagnostic(1, "a.ts", "refusal one");
  const second = diagnostic(2, "b.ts", "refusal two");
  let afterDependency = 0;
  const child = { name: "child", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "refused", diagnostics: [first, second] }) };
  const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(child, null, none, value => {
    afterDependency += 1;
    return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] };
  }) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  for (let request = 1; request <= 2; request += 1) {
    assert.deepEqual(database.run(parent, null), { kind: "refused", diagnostics: [first, second] });
    assert.deepEqual(database.stats(), [{ name: "child", computed: 1, hits: request - 1 },
      { name: "parent", computed: request, hits: 0 }]);
    assert.deepEqual(database.diagnostics(), [first, second]);
    assert.equal(afterDependency, 0);
  }
  assert.deepEqual(database.run(child, null), { kind: "refused", diagnostics: [first, second] });
  assert.deepEqual(database.stats(), [{ name: "child", computed: 1, hits: 2 }, { name: "parent", computed: 2, hits: 0 }]);
});

test("same-query different canonical keys are not a cycle and cleanup retains each still-active key", () => {
  const query = { name: "countdown", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: (context, key) => key === 0
    ? { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 0, diagnostics: [] }
    : context.get(query, key - 1, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + 1, diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(query, 3), { kind: "completed", value: 3, diagnostics: [] });
  assert.deepEqual(database.run(query, 2), { kind: "completed", value: 2, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "countdown", computed: 4, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), []);
});





test("an ordinary Error carrying a copied refusal tag is never converted into an expected outcome", () => {
  const fake = Object.assign(Error("query: abandoned computation"), { kind: "refused", diagnostics: [diagnostic(1, "a.ts", "fake")] });
  const query = { name: "forgery", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => { throw fake; } };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  for (let request = 0; request < 2; request += 1) assert.throws(() => database.run(query, null), error => error === fake);
  assert.deepEqual(database.stats(), [{ name: "forgery", computed: 2, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("an ordinary Error while constructing a dependency is not cached or converted to a refusal", () => {
  const original = Error("ordinary finally failure");
  const refusal = diagnostic(1, "a.ts", "actual refusal");
  const child = { name: "child", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "refused", diagnostics: [refusal] }) };
  let override = true;
  const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: database => {
    try { return database.get(child, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })); }
    finally { if (override) throw original; }
  } };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.throws(() => database.run(parent, null), error => error === original);
  override = false;
  assert.deepEqual(database.run(parent, null), { kind: "refused", diagnostics: [refusal] });
  assert.deepEqual(database.stats(), [{ name: "child", computed: 1, hits: 0 }, { name: "parent", computed: 2, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), [refusal]);
});

test("throwing after a completed sibling does not discard its memo, diagnostics or exact future hit", () => {
  const childDiagnostic = diagnostic(1, "a.ts", "completed sibling");
  const original = Error("failed parent");
  let throws = true;
  const child = { name: "child", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [childDiagnostic] }) };
  const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(child, null, none, value => {
    if (throws) throw original;
    return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + 1, diagnostics: [] };
  }) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.throws(() => database.run(parent, null), error => error === original);
  assert.deepEqual(database.diagnostics(), [childDiagnostic]);
  throws = false;
  assert.deepEqual(database.run(parent, null), { kind: "completed", value: 8, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "child", computed: 1, hits: 1 }, { name: "parent", computed: 2, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), [childDiagnostic]);
});

test("deep content keys use the real iterative encoder without a query-depth or host-stack surrogate limit", () => {
  let left = 7;
  let right = 7;
  for (let depth = 0; depth < 100_000; depth += 1) { left = [left]; right = [right]; }
  let calls = 0;
  const query = { name: "deep", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => {
    calls += 1; return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] };
  } };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(query, left), { kind: "completed", value: 7, diagnostics: [] });
  assert.deepEqual(database.run(query, right), { kind: "completed", value: 7, diagnostics: [] });
  assert.equal(calls, 1);
  assert.deepEqual(database.stats(), [{ name: "deep", computed: 1, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("the actual ids boundary rejects a cyclic key before any memo entry or computation", () => {
  let calls = 0;
  const query = { name: "invalid-key", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => {
    calls += 1; return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] };
  } };
  const cycle = [];
  cycle.push(cycle);
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.throws(() => database.run(query, cycle), { name: "TypeError", message: "ids: cyclic key data at $root[0]" });
  assert.equal(calls, 0);
  assert.deepEqual(database.stats(), []);
  assert.deepEqual(database.diagnostics(), []);
  assert.deepEqual(database.run(query, [0]), { kind: "completed", value: 7, diagnostics: [] });
  assert.equal(calls, 1);
  assert.deepEqual(database.stats(), [{ name: "invalid-key", computed: 1, hits: 0 }]);
});

test("a query name cannot silently select another definition or reinterpret its memo's Value type", () => {
  let wrongCalls = 0;
  const original = { name: "same", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }) };
  const other = { name: "same", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => {
    wrongCalls += 1; return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: "wrong", diagnostics: [] };
  } };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(original, null), { kind: "completed", value: 7, diagnostics: [] });
  for (const key of [null, "different"]) {
    assert.throws(() => database.run(other, key), error => {
      assert.equal(error instanceof Error, true);
      assert.deepEqual(error.cause, {
        owner: "query", query: { name: "same", encodedKey: key === null ? "N" : "S9:different" }, origin: null,
        message: 'Query name "same" is already bound to another definition',
      });
      return true;
    });
  }
  assert.equal(wrongCalls, 0);
  assert.deepEqual(database.run(original, null), { kind: "completed", value: 7, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "same", computed: 1, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), []);
});


test("an explicitly scheduled inner query leaves its parent's frame and sibling memo intact", () => {
  const leaf = { name: "leaf", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }) };
  const inner = { name: "inner", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: current => current.get(leaf, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + 1, diagnostics: [] })) };
  const outer = { name: "outer", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(inner, null, none, value => {
    assert.equal(value, 8);
    return context.get(leaf, null, none, sibling => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + sibling, diagnostics: [] }));
  }) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(outer, null), { kind: "completed", value: 15, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "inner", computed: 1, hits: 0 }, { name: "leaf", computed: 1, hits: 1 },
    { name: "outer", computed: 1, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), []);
});


test("statistics use total UTF-16 name ordering, independent of request order or locale", () => {
  const ordered = ["", "\u0000", "A", "\uD800", "\uD800\uDC00", "\uDBFF\uDFFF", "\uDFFF", "\uE000"];
  for (const names of [[...ordered].reverse(), [ordered[4], ordered[0], ordered[7], ordered[2],
    ordered[6], ordered[1], ordered[5], ordered[3]]]) {
    const database = product.createDatabase(null, unbounded, noCycle, "recorded");
    for (const name of names) {
      const query = { name, keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: name, diagnostics: [] }) };
      assert.deepEqual(database.run(query, null), { kind: "completed", value: name, diagnostics: [] });
    }
    assert.deepEqual(database.stats(), ordered.map(name => ({ name, computed: 1, hits: 0 })));
    assert.deepEqual(database.diagnostics(), []);
  }
});

test("the root database exposes no synchronous get and a captured reentrant run is rejected without a child frame", () => {
  let calls = 0;
  const query = { name: "root", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => {
    calls += 1; return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] };
  } };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(Object.keys(database), ["inputs", "run", "errorOf", "diagnostics", "stats", "trace"]);
  assert.equal(database.get, undefined);
  assert.equal(calls, 0);
  assert.deepEqual(database.stats(), []);
  assert.deepEqual(database.diagnostics(), []);
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 7, diagnostics: [] });
  const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => database.run(query, null) };
  assert.throws(() => database.run(parent, null), { name: "TypeError",
    message: "query: run cannot be nested; request dependencies through context.get" });
  assert.equal(calls, 1);
  assert.deepEqual(database.stats(), [{ name: "parent", computed: 1, hits: 0 }, { name: "root", computed: 1, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("one hundred thousand genuine dependency edges finish iteratively and retain every completed memo", () => {
  const depth = 100000;
  let resumed = 0;
  const query = { name: "deep-chain", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: (context, key) => key === 0
    ? { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 0, diagnostics: [] }
    : context.get(query, key - 1, none, value => {
      resumed += 1;
      return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + 1, diagnostics: [] };
    }) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(query, depth), { kind: "completed", value: depth, diagnostics: [] });
  assert.equal(resumed, depth);
  assert.deepEqual(database.stats(), [{ name: "deep-chain", computed: depth + 1, hits: 0 }]);
  assert.deepEqual(database.run(query, depth), { kind: "completed", value: depth, diagnostics: [] });
  assert.deepEqual(database.run(query, depth - 1), { kind: "completed", value: depth - 1, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "deep-chain", computed: depth + 1, hits: 2 }]);
  assert.equal(resumed, depth);
  assert.deepEqual(database.diagnostics(), []);
});


test("heterogeneous dependencies preserve each exact value type through one continuation path", () => {
  const number = { name: "number", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: (_, key) => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: key + 1, diagnostics: [] }) };
  const text = { name: "text", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: (context, key) => context.get(number, key.length,
    none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: `${key}:${value}`, diagnostics: [] })) };
  const root = { name: "root", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(text, "typed",
    none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value === "typed:6", diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(root, null), { kind: "completed", value: true, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "number", computed: 1, hits: 0 }, { name: "root", computed: 1, hits: 0 },
    { name: "text", computed: 1, hits: 0 }]);
  assert.deepEqual(database.run(text, "typed"), { kind: "completed", value: "typed:6", diagnostics: [] });
});

test("public dependency steps reject zero, repeated and delayed scheduling and clean every active frame", () => {
  const leaf = { name: "leaf", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }) };
  const resume = value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] });
  for (const requests of [0, 2]) {
    const database = product.createDatabase(null, unbounded, noCycle, "recorded");
    const malformed = { name: "malformed", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "dependency", schedule: scheduler => {
      for (let request = 0; request < requests; request += 1) scheduler.request(leaf, null, none, resume);
    } }) };
    assert.throws(() => database.run(malformed, null), { name: "TypeError",
      message: "query: a dependency step must schedule exactly one request" });
    assert.deepEqual(database.run(leaf, null), { kind: "completed", value: 7, diagnostics: [] });
    assert.deepEqual(database.stats(), [{ name: "leaf", computed: 1, hits: 0 },
      { name: "malformed", computed: 1, hits: 0 }]);
  }
  let retained;
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  const query = { name: "retained", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "dependency", schedule: scheduler => {
    retained = scheduler;
    scheduler.request(leaf, null, none, resume);
  } }) };
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 7, diagnostics: [] });
  assert.throws(() => retained.request(leaf, null, none, resume), { name: "TypeError",
    message: "query: dependency scheduling must be synchronous" });
  assert.deepEqual(database.stats(), [{ name: "leaf", computed: 1, hits: 0 }, { name: "retained", computed: 1, hits: 0 }]);
});






test("the actual four-file query owner compiles against fresh real dependency public declarations", async () => {
  const deps = isolationDeps(tooling, quarantineRoots);
  const module = hostCatalogue.find(module => module.name === "query");
  const report = await compileIsolated(deps, module, { root: repository, sourceFiles,
    interfaceSources: interfaceFiles, declarationSources: dependencyFiles, outputDirectory: ".temp/query-isolation" });
  writeFileSync(resolve(repository, ".temp/query-isolation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 4000));
  assert.equal(report.sourceInventory.length, 12);
  assert.equal(report.loadedInventory.length > 12, true, "the actual compiler language closure is nonempty");
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
});


test("invalid record maxima are caller defects, not a refusal, rounding or a hidden default", () => {
  for (const maximumRecords of [-1, -0.5, 0.5, NaN, Infinity, -Infinity]) {
    assert.throws(() => product.createDatabase(null, { maximumRecords }, noCycle, "recorded"), {
      name: "TypeError", message: "query: maximumRecords must be a finite nonnegative integer",
    });
  }
  for (const maximumRecords of [0, -0, 1, 2, 9007199254740992, 1e21]) {
    const database = product.createDatabase(null, { maximumRecords }, noCycle, "recorded");
    assert.equal(database.inputs, null);
    assert.deepEqual(database.stats(), []);
    assert.deepEqual(database.diagnostics(), []);
    assert.deepEqual(database.trace(), []);
  }
});

test("database methods are detachable, compute has no hidden this, and the supplied record maximum is captured", () => {
  const limits = { maximumRecords: 10 };
  const database = product.createDatabase(({ value: 7 }), limits, noCycle, "recorded");
  limits.maximumRecords = 0;
  const { run, stats, diagnostics, trace } = database;
  let receivedThis = "not-called";
  const child = { name: "child", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: function (current) {
    receivedThis = this;
    return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: current.inputs.value, diagnostics: [] };
  } };
  const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: current => {
    const { get } = current;
    assert.deepEqual(Object.keys(current), ["inputs", "fact", "get", "errorOf"], "a computation sees its own canonical fact, not the database's diagnostics, statistics or trace");
    return get(child, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + 1, diagnostics: [] }));
  } };
  assert.deepEqual(run(parent, null), { kind: "completed", value: 8, diagnostics: [] });
  assert.equal(receivedThis, undefined);
  assert.deepEqual(stats(), [{ name: "child", computed: 1, hits: 0 }, { name: "parent", computed: 1, hits: 0 }]);
  assert.deepEqual(diagnostics(), []);
  assert.equal(trace().length, 6);
});

test("ordinary thrown computations are not cached or converted to language refusals", () => {
  const original = Error("original callback");
  let throws = true;
  const query = { name: "throw", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => {
    if (throws) throw original;
    return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] };
  } };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  for (let request = 0; request < 2; request += 1) assert.throws(() => database.run(query, null), error => error === original);
  throws = false;
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 7, diagnostics: [] });
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 7, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "throw", computed: 3, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("S2-8: a closed cycle is classified once, whole and in one canonical order, whichever fact is demanded first", () => {
  const outcomes = { S: { signature: "error" }, T: { type: "error" }, K: { constant: "error" } };
  const expectedCycle = { members: [
    { fact: fact("K", "n", "S1:n"), witness: "K reads the signature of its initializer", answerPolicy: "typed-error" },
    { fact: fact("S", "size", "S4:size"), witness: "S reads its authored type", answerPolicy: "typed-error" },
    { fact: fact("T", "array", "S5:array"), witness: "T reads its constant extent", answerPolicy: "typed-error" },
  ] };
  const memoised = [];
  for (const first of ["S", "T", "K", "root"]) {
    const classified = [];
    let resumed = 0;
    const row = (name, key, next, nextKey, witness) => ({ name,
      keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError((ownKey, received) => {
        assert.equal(ownKey, key);
        assert.equal(received, cause, "the classified cause, as given");
        return outcomes[name];
      }) },
      compute: context => context.get(next(), nextKey, { witness, earned: [] }, value => {
        resumed += 1;
        return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] };
      }) });
    const signature = row("S", "size", () => type, "array", "S reads its authored type");
    const type = row("T", "array", () => constant, "n", "T reads its constant extent");
    const constant = row("K", "n", () => signature, "size", "K reads the signature of its initializer");
    const root = { name: "root", keyData: key => key, answerPolicy: { kind: "refusal-only" },
      compute: context => context.get(signature, "size", none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: [value], diagnostics: [] })) };
    const rows = { S: [signature, "size"], T: [type, "array"], K: [constant, "n"] };
    const database = product.createDatabase(null, unbounded, cycle => { classified.push(cycle); return errors(cycle); }, "recorded");
    if (first === "root") assert.deepEqual(database.run(root, null), { kind: "completed", value: [outcomes.S], diagnostics: [] });
    else assert.deepEqual(database.run(...rows[first]), { kind: "completed", value: outcomes[first], diagnostics: [] });
    assert.deepEqual(classified, [expectedCycle]);
    assert.equal(classified[0].members[1].fact.key, "size");
    assert.equal(resumed, 0, "no member of the cycle is resumed");
    const values = ["S", "T", "K"].map(name => {
      const result = database.run(...rows[name]);
      assert.equal(result.kind, "completed");
      assert.equal(result.value, outcomes[name], "each member holds its own error value, never another member's");
      return result.value;
    });
    memoised.push(values);
    assert.equal(classified.length, 1);
    assert.deepEqual(database.stats().filter(row => row.name !== "root"),
      ["K", "S", "T"].map(name => ({ name, computed: 1, hits: 1 })));
    assert.deepEqual(database.trace().filter(event => event.kind === "completion" && event.outcome.startsWith("cycle"))
      .map(event => [event.fact.query, event.outcome]), [["K", "cycle-ok"], ["S", "cycle-ok"], ["T", "cycle-ok"]]);
    assert.deepEqual(database.diagnostics(), []);
  }
  assert.deepEqual(memoised, [memoised[0], memoised[0], memoised[0], memoised[0]]);
});

test("S2-8: the cycle carries the typed key; one query's keys order by encoded key; a self-cycle has one member", () => {
  const record = { kind: "record", fields: [["a", 1], ["b", 2]] };
  for (const first of ["a", "b"]) {
    const classified = [];
    const pair = { name: "pair", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(key => `cycle:${key}`) },
      compute: (context, key) => context.get(pair, key === "a" ? "b" : "a", { witness: `from ${key}`, earned: [] },
        value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
    const database = product.createDatabase(null, unbounded, cycle => { classified.push(cycle); return errors(cycle); }, "recorded");
    assert.deepEqual(database.run(pair, first), { kind: "completed", value: `cycle:${first}`, diagnostics: [] });
    assert.deepEqual(classified, [{ members: [{ fact: fact("pair", "a", "S1:a"), witness: "from a", answerPolicy: "typed-error" },
      { fact: fact("pair", "b", "S1:b"), witness: "from b", answerPolicy: "typed-error" }] }]);
    assert.deepEqual(database.stats(), [{ name: "pair", computed: 2, hits: 0 }]);
  }
  const seen = [];
  let resumed = 0;
  const self = { name: "self", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError((key, received) => [key, received]) },
    compute: (context, key) => context.get(self, key, { witness: 9, earned: [] }, value => {
      resumed += 1;
      return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] };
    }) };
  const database = product.createDatabase(null, unbounded, cycle => { seen.push(cycle); return errors(cycle); }, "recorded");
  const given = { kind: "record", fields: [["b", 2], ["a", 1]] };
  const result = database.run(self, given);
  assert.equal(result.kind, "completed");
  assert.equal(result.value[0], given);
  assert.equal(result.value[1], cause);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].members.length, 1);
  assert.equal(seen[0].members[0].fact.key, given, "the typed key as requested, not a decoded copy");
  assert.equal(seen[0].members[0].fact.query, "self");
  assert.equal(seen[0].members[0].fact.encodedKey, "O2:S1:aF1:S1:bF2:");
  assert.equal(seen[0].members[0].witness, 9);
  assert.equal(resumed, 0);
  assert.deepEqual(database.run(self, record), result);
  assert.deepEqual(database.stats(), [{ name: "self", computed: 1, hits: 1 }]);
  assert.deepEqual(database.trace().map(event => event.kind === "dependency" ? event.state : event.kind === "start" ? "start" : event.outcome),
    ["cold", "start", "active", "cycle-ok", "warm"]);
});

test("S2-8: a requester outside the cycle is resumed with the head's own outcome; a same-query ancestor stays active", () => {
  const classified = [];
  const query = { name: "prefix", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(key => key * 10) },
    compute: (context, key) => context.get(query, key === 0 ? 1 : key === 1 ? 2 : 1, { witness: key, earned: [] },
      value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + 1, diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, cycle => { classified.push(cycle.members.map(member => member.fact.key)); return errors(cycle); }, "recorded");
  assert.deepEqual(database.run(query, 0), { kind: "completed", value: 11, diagnostics: [] });
  assert.deepEqual(classified, [[1, 2]]);
  assert.deepEqual(database.run(query, 1), { kind: "completed", value: 10, diagnostics: [] });
  assert.deepEqual(database.run(query, 2), { kind: "completed", value: 20, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "prefix", computed: 3, hits: 2 }]);
});

test("S2-8: the classifier decides each member's outcome; a row cannot alter it; a refused head abandons its requester", () => {
  const refusal = diagnostic(1, "a.ts", "ungrounded cycle");
  const earnedA = diagnostic(2, "b.ts", "earned by A before the cycle closed");
  const earnedB = diagnostic(3, "c.ts", "earned by B before the cycle closed");
  const earnedRoot = diagnostic(4, "d.ts", "earned by the requester outside the cycle");
  const disguised = { kind: "refused", diagnostics: [diagnostic(5, "e.ts", "a row's attempt to refuse")] };
  let resumed = 0;
  let consulted = 0;
  const resume = value => { resumed += 1; return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] }; };
  const first = { name: "A", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => { consulted += 1; return "A would rather succeed"; }) },
    compute: context => context.get(second, null, { witness: "A", earned: [earnedA] }, resume) };
  const second = { name: "B", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => disguised) },
    compute: context => context.get(first, null, { witness: "B", earned: [earnedB] }, resume) };
  const root = { name: "root", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: context => context.get(first, null, { witness: "root", earned: [earnedRoot] }, resume) };
  const database = product.createDatabase(null, unbounded, cycle => cycle.members.map(member =>
    member.fact.query === "A" ? { kind: "refused", diagnostic: refusal } : { kind: "error", data: null, emissions: [], cause, diagnostics: [] }), "recorded");
  const refused = database.run(root, null);
  assert.deepEqual(refused, { kind: "refused", diagnostics: [earnedA, refusal] },
    "the complete result of the refused head: the chunk it stated, then the classified refusal");
  assert.equal(consulted, 0, "the row of a refused member is not consulted and cannot turn the refusal into a value");
  assert.equal(database.run(first, null), refused, "the head's refused outcome is its memo entry");
  const other = database.run(second, null);
  assert.equal(other.kind, "completed", "a row that returns a refusal-shaped object has only named its value");
  assert.equal(other.value, disguised);
  assert.deepEqual(other.diagnostics, [earnedB], "an error-valued member's result holds what it had stated");
  assert.deepEqual(database.run(root, null), { kind: "refused", diagnostics: [earnedA, refusal] });
  assert.equal(resumed, 0);
  assert.deepEqual(database.diagnostics(), [refusal, earnedA, earnedB, earnedRoot]);
  assert.deepEqual(database.stats(), [{ name: "A", computed: 1, hits: 2 }, { name: "B", computed: 1, hits: 1 },
    { name: "root", computed: 2, hits: 0 }]);
  assert.deepEqual(database.trace().filter(event => event.kind === "completion").map(event => [event.fact.query, event.outcome]),
    [["A", "cycle-refused"], ["B", "cycle-ok"], ["root", "abandoned"], ["root", "abandoned"]]);
});

test("K3374: registered capabilities classify mixed cycles identically from every rotation without fabricating bodies", () => {
  for (const first of ["A", "B", "C", "root"]) {
    const refusal = diagnostic(1, "cycle.ts", "the verified body depends on this cycle");
    const earned = [2, 3, 4, 5].map(index => diagnostic(index, `earned${index}.ts`, `earned ${index}`));
    const originalCause = { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: "actual.ts", index: 0 } } };
    const classified = [];
    const constructed = [];
    let resumed = 0;
    let rootRuns = 0;
    const resume = value => { resumed += 1; return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] }; };
    const typed = (name, next, found) => ({ name,
      keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError((key, received) => {
        assert.equal(received === originalCause, true, `${first}/${name}/original cause`);
        constructed.push(name);
        return { name, key, cause: received };
      }) },
      compute: context => context.get(next(), null, { witness: name, earned: [found] }, resume) });
    const a = typed("A", () => body, earned[0]);
    const body = { name: "B", keyData: key => key, answerPolicy: { kind: "refusal-only" },
      compute: context => context.get(c, null, { witness: "B", earned: [earned[1]] }, resume) };
    const c = typed("C", () => a, earned[2]);
    const root = { name: "root", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => {
      rootRuns += 1;
      return context.get(body, null, { witness: "root", earned: [earned[3]] }, resume);
    } };
    const database = product.createDatabase(null, unbounded, cycle => {
      classified.push(cycle);
      return cycle.members.map(member => member.answerPolicy === "refusal-only"
        ? { kind: "refused", diagnostic: refusal } : { kind: "error", data: null, emissions: [], cause: originalCause, diagnostics: [] });
    }, "recorded");
    const rows = { A: a, B: body, C: c, root };
    const initial = database.run(rows[first], null);
    const refused = { kind: "refused", diagnostics: [earned[1], refusal] };
    if (first === "B" || first === "root") assert.deepEqual(initial, refused, first);
    else assert.deepEqual(initial, { kind: "completed", value: { name: first, key: null, cause: originalCause },
      diagnostics: [first === "A" ? earned[0] : earned[2]] }, first);
    assert.deepEqual(classified, [{ members: [
      { fact: fact("A", null, "N"), witness: "A", answerPolicy: "typed-error" },
      { fact: fact("B", null, "N"), witness: "B", answerPolicy: "refusal-only" },
      { fact: fact("C", null, "N"), witness: "C", answerPolicy: "typed-error" },
    ] }], first);
    assert.deepEqual(database.run(body, null), refused, `${first}/body has no value`);
    for (const row of [a, c]) {
      const result = database.run(row, null);
      assert.equal(result.kind, "completed");
      assert.equal(result.value.cause === originalCause, true, `${first}/${row.name}/cached cause`);
    }
    assert.deepEqual(database.run(root, null), refused);
    assert.deepEqual(database.run(root, null), refused);
    assert.deepEqual(database.stats().find(entry => entry.name === "root"), { name: "root", computed: rootRuns, hits: 0 });
    const independent = { name: "independent", keyData: key => key, answerPolicy: { kind: "refusal-only" },
      compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }) };
    assert.deepEqual(database.run(independent, null), { kind: "completed", value: 7, diagnostics: [] });
    assert.deepEqual(constructed, ["A", "C"]);
    assert.equal(resumed, 0);
    assert.equal(classified.length, 1);
    assert.equal(database.diagnostics().filter(entry => entry === refusal).length, 1);
    for (const found of earned) assert.equal(database.diagnostics().includes(found), true, `${first}/earned diagnostic`);
  }
});

test("K3374: an error classification for a refusal-only row is an owning invariant and leaves no memo", () => {
  let invalid = true;
  let resumed = 0;
  const refusal = diagnostic(1, "cycle.ts", "the original cycle refusal");
  const row = { name: "verified-body", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: context => context.get(row, null, none, value => {
      resumed += 1;
      return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] };
    }) };
  const database = product.createDatabase(null, unbounded, cycle => {
    assert.deepEqual(cycle.members.map(member => member.answerPolicy), ["refusal-only"]);
    return invalid ? [{ kind: "error", data: null, emissions: [], cause, diagnostics: [] }] : [{ kind: "refused", diagnostic: refusal }];
  }, "recorded");
  for (const attempt of [1, 2]) {
    assert.throws(() => database.run(row, null), error => error.message === "The cycle classifier cannot return an error outcome for a refusal-only query."
      && error.cause.owner === "query" && error.cause.query.name === "verified-body" && error.cause.query.encodedKey === "N", `attempt ${attempt}`);
    assert.deepEqual(database.diagnostics(), []);
  }
  invalid = false;
  assert.deepEqual(database.run(row, null), { kind: "refused", diagnostics: [refusal] });
  assert.deepEqual(database.run(row, null), { kind: "refused", diagnostics: [refusal] });
  assert.deepEqual(database.stats(), [{ name: "verified-body", computed: 3, hits: 1 }]);
  assert.equal(resumed, 0);
});

test("S2-8: earned cycle diagnostics originate once for all-typed members from every demand rotation", () => {
  for (const first of ["A", "B", "C", "root"]) {
    const originated = diagnostic(1, "cycle.ts", "a constant depends on its own answer");
    const earned = diagnostic(2, "independent.ts", "independently earned before the cycle");
    const originalCause = { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: "cycle", index: 0 } } };
    const constructed = [];
    let classified = 0;
    let resumed = 0;
    const resume = value => { resumed += 1; return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] }; };
    const row = (name, next) => ({ name, keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError((key, received) => {
      assert.equal(received === originalCause, true, `${first}/${name}/same original cause`);
      constructed.push(name);
      return { name, cause: received };
    }) }, compute: context => context.get(next(), null, { witness: name, earned: name === "A" ? [earned] : [] }, resume) });
    const a = row("A", () => b), b = row("B", () => c), c = row("C", () => a);
    const root = { name: "root", keyData: key => key, answerPolicy: { kind: "refusal-only" },
      compute: context => context.get(c, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
    const independent = { name: "independent", keyData: key => key, answerPolicy: { kind: "refusal-only" },
      compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }) };
    const database = product.createDatabase(null, unbounded, cycle => {
      classified += 1;
      assert.deepEqual(cycle.members.map(member => member.fact.query), ["A", "B", "C"]);
      return cycle.members.map(member => ({ kind: "error", data: null, emissions: [], cause: originalCause,
        diagnostics: member.fact.query === "A" ? [originated] : [] }));
    }, "recorded");
    assert.equal(database.run({ A: a, B: b, C: c, root }[first], null).kind, "completed");
    assert.equal(resumed, 0, `${first}/cycle members never resume`);
    for (const member of [a, b, c]) {
      const cached = database.run(member, null);
      assert.equal(cached.kind, "completed");
      assert.equal(cached.value.cause === originalCause, true);
      assert.deepEqual(cached.diagnostics, member === a ? [earned, originated] : []);
      if (member === a) assert.equal(cached.diagnostics[1] === originated, true, "the actual diagnostic reference survives settlement");
    }
    assert.equal(database.run(root, null).kind, "completed");
    assert.deepEqual(database.run(independent, null), { kind: "completed", value: 7, diagnostics: [] });
    assert.deepEqual(database.diagnostics(), [originated, earned]);
    assert.equal(database.diagnostics().filter(item => item === originated).length, 1);
    assert.equal(classified, 1);
    assert.deepEqual(constructed, ["A", "B", "C"]);
  }
});

test("S2-8: a throwing classifier or row, or an outcome list of the wrong length, is a compiler defect: nothing is memoised", () => {
  const classifierError = Error("classifier defect");
  const rowError = Error("row defect");
  const originated = diagnostic(1, "cycle.ts", "the cycle's original diagnostic");
  let mode = "classifier";
  const first = { name: "A", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => 1) },
    compute: context => context.get(second, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
  const second = { name: "B", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => {
    if (mode === "row") throw rowError;
    return 2;
  }) }, compute: context => context.get(first, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, cycle => {
    if (mode === "classifier") throw classifierError;
    if (mode === "short") return errors(cycle).slice(1);
    if (mode === "long") return [...errors(cycle), { kind: "error", data: null, emissions: [], cause, diagnostics: [] }];
    return cycle.members.map((member, index) => ({ kind: "error", data: null, emissions: [], cause, diagnostics: index === 0 ? [originated] : [] }));
  }, "recorded");
  assert.throws(() => database.run(first, null), error => error === classifierError);
  mode = "row";
  assert.throws(() => database.run(first, null), error => error === rowError);
  for (const length of ["short", "long"]) {
    mode = length;
    assert.throws(() => database.run(first, null), { name: "TypeError",
      message: "query: the classifier must return one outcome for each member of the closed cycle" });
  }
  assert.deepEqual(database.diagnostics(), [], "failed classification/settlement publishes no partial diagnostic");
  mode = "none";
  assert.deepEqual(database.run(first, null), { kind: "completed", value: 1, diagnostics: [originated] });
  assert.deepEqual(database.run(second, null), { kind: "completed", value: 2, diagnostics: [] });
  assert.deepEqual(database.diagnostics(), [originated]);
  assert.deepEqual(database.stats(), [{ name: "A", computed: 5, hits: 0 }, { name: "B", computed: 5, hits: 1 }]);
});

test("S2-27: a cycle of one hundred thousand members closes and settles iteratively, with no depth limit", () => {
  const depth = 100000;
  const sizes = [];
  let resumed = 0;
  const query = { name: "deep-cycle", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(key => key) },
    compute: (context, key) => context.get(query, key === depth ? 0 : key + 1, none, value => {
      resumed += 1;
      return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] };
    }) };
  const database = product.createDatabase(null, unbounded, cycle => { sizes.push(cycle.members.length); return errors(cycle); }, "recorded");
  assert.deepEqual(database.run(query, 0), { kind: "completed", value: 0, diagnostics: [] });
  assert.deepEqual(database.run(query, depth), { kind: "completed", value: depth, diagnostics: [] });
  assert.deepEqual(sizes, [depth + 1]);
  assert.equal(resumed, 0);
  assert.deepEqual(database.stats(), [{ name: "deep-cycle", computed: depth + 1, hits: 1 }]);
});

test("S2-27: diagnostics earned before a refused dependency are kept once; the abandoned computation has no memo entry", () => {
  const limit = diagnostic(1, "a.ts", "limit reached while solving big");
  const conflict = diagnostic(2, "b.ts", "conflict on s, found before big was asked");
  const outer = diagnostic(3, "c.ts", "earned by the caller of f");
  const later = diagnostic(4, "d.ts", "found by f once it no longer needs big");
  let needsBig = true;
  let resumed = 0;
  const supplied = [conflict];
  const big = { name: "big", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "refused", diagnostics: [limit] }) };
  const f = { name: "f", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => needsBig
    ? context.get(big, null, { witness: null, earned: supplied }, value => { resumed += 1; return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] }; })
    : { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [later] } };
  const g = { name: "g", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: context => context.get(f, null, { witness: null, earned: [outer] }, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + 1, diagnostics: [] })) };
  const quiet = { name: "quiet", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: context => context.get(big, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  for (let request = 1; request <= 2; request += 1) {
    assert.deepEqual(database.run(g, null), { kind: "refused", diagnostics: [limit] });
    supplied.length = 0;
    assert.deepEqual(database.diagnostics(), [limit, conflict, outer], "kept once, not once per abandonment");
    supplied.push(conflict);
    assert.deepEqual(database.stats(), [{ name: "big", computed: 1, hits: request - 1 },
      { name: "f", computed: request, hits: 0 }, { name: "g", computed: request, hits: 0 }]);
  }
  assert.equal(resumed, 0);
  assert.deepEqual(database.run(quiet, null), { kind: "refused", diagnostics: [limit] });
  assert.deepEqual(database.diagnostics(), [limit, conflict, outer]);
  needsBig = false;
  assert.deepEqual(database.run(f, null), { kind: "completed", value: 7, diagnostics: [later] });
  assert.deepEqual(database.diagnostics(), [limit, outer, later], "a completed result replaces what its abandoned computation had earned");
  assert.deepEqual(database.run(g, null), { kind: "completed", value: 8, diagnostics: [outer] },
    "the kernel composes: what g stated with its request, then what its final result carries (nothing)");
  assert.deepEqual(database.diagnostics(), [limit, outer, later], "stated once by g, published once with its result");
  assert.deepEqual(database.trace().filter(event => event.kind === "completion").map(event => [event.fact.query, event.outcome]),
    [["big", "refused"], ["f", "abandoned"], ["g", "abandoned"], ["f", "abandoned"], ["g", "abandoned"],
      ["quiet", "abandoned"], ["f", "ok"], ["g", "ok"]]);
});

test("S2-27: the trace is the ordered record of request, start and completion; cold before warm and the warm opposite", () => {
  const add = { name: "add", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 42, diagnostics: [] }) };
  const total = { name: "total", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: context => context.get(add, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
  const addFact = fact("add", null, "N");
  const totalFact = fact("total", null, "N");
  const cold = product.createDatabase(null, unbounded, noCycle, "recorded");
  cold.run(total, null);
  const before = cold.trace();
  cold.run(add, null);
  assert.deepEqual(cold.trace(), [
    { kind: "dependency", from: null, to: totalFact, state: "cold" },
    { kind: "start", fact: totalFact },
    { kind: "dependency", from: totalFact, to: addFact, state: "cold" },
    { kind: "start", fact: addFact },
    { kind: "completion", fact: addFact, outcome: "ok" },
    { kind: "completion", fact: totalFact, outcome: "ok" },
    { kind: "dependency", from: null, to: addFact, state: "warm" },
  ]);
  assert.equal(before.length, 6, "a snapshot does not grow with later work");
  const warm = product.createDatabase(null, unbounded, noCycle, "recorded");
  warm.run(add, null);
  warm.run(total, null);
  assert.deepEqual(warm.trace(), [
    { kind: "dependency", from: null, to: addFact, state: "cold" },
    { kind: "start", fact: addFact },
    { kind: "completion", fact: addFact, outcome: "ok" },
    { kind: "dependency", from: null, to: totalFact, state: "cold" },
    { kind: "start", fact: totalFact },
    { kind: "dependency", from: totalFact, to: addFact, state: "warm" },
    { kind: "completion", fact: totalFact, outcome: "ok" },
  ]);
  for (const database of [cold, warm]) {
    assert.deepEqual(database.stats(), [{ name: "add", computed: 1, hits: 1 }, { name: "total", computed: 1, hits: 0 }]);
  }
});

test("the record bound is charged before allocation: below, at and over, for a cold, a warm and a closing request", () => {
  const earned = diagnostic(1, "a.ts", "earned before the bound was reached");
  const leaf = { name: "leaf", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }) };
  const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: context => context.get(leaf, null, { witness: null, earned: [earned] }, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
  const self = { name: "self", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => 0) },
    compute: context => context.get(self, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
  const leafFact = fact("leaf", null, "N");
  const completed = { kind: "completed", value: 7, diagnostics: [] };
  const exhausted = (maximumRecords, at) => stoppedAt(maximumRecords, at.query, at.encodedKey);
  for (const maximumRecords of [0, 3]) {
    const database = product.createDatabase(null, { maximumRecords }, noCycle, "recorded");
    assert.deepEqual(database.run(leaf, null), exhausted(maximumRecords, leafFact));
    assert.deepEqual(database.stats(), [{ name: "leaf", computed: 0, hits: 0 }]);
    assert.deepEqual(database.trace(), []);
  }
  const atCold = product.createDatabase(null, { maximumRecords: 5 }, noCycle, "recorded");
  assert.deepEqual(atCold.run(leaf, null), completed);
  assert.deepEqual(atCold.run(leaf, null), exhausted(5, leafFact), "a warm request is one more record");
  const atWarm = product.createDatabase(null, { maximumRecords: 6 }, noCycle, "recorded");
  assert.deepEqual(atWarm.run(leaf, null), completed);
  assert.deepEqual(atWarm.run(leaf, null), completed);
  assert.deepEqual(atWarm.run(leaf, null), exhausted(6, leafFact));
  const belowDependency = product.createDatabase(null, { maximumRecords: 7 }, noCycle, "recorded");
  assert.deepEqual(belowDependency.run(parent, null), exhausted(7, leafFact));
  assert.deepEqual(belowDependency.diagnostics(), [earned, limitReached(7, "leaf", "N")], "the abandoned requester keeps what it had earned");
  assert.deepEqual(belowDependency.stats(), [{ name: "leaf", computed: 0, hits: 0 }, { name: "parent", computed: 1, hits: 0 }]);
  const again = belowDependency.run(parent, null);
  assert.deepEqual(again, exhausted(7, leafFact), "the bound of one database is reported once, at the fact where it was first met");
  assert.equal(again.diagnostics[0], belowDependency.diagnostics()[1]);
  assert.deepEqual(belowDependency.diagnostics(), [earned, limitReached(7, "leaf", "N")]);
  const atDependency = product.createDatabase(null, { maximumRecords: 10 }, noCycle, "recorded");
  assert.deepEqual(atDependency.run(parent, null), { kind: "completed", value: 7, diagnostics: [earned] });
  const belowClosing = product.createDatabase(null, { maximumRecords: 4 }, noCycle, "recorded");
  assert.deepEqual(belowClosing.run(self, null), exhausted(4, fact("self", null, "N")));
  const atClosing = product.createDatabase(null, { maximumRecords: 6 }, errors, "recorded");
  assert.deepEqual(atClosing.run(self, null), { kind: "completed", value: 0, diagnostics: [] });
});

test("G-3: a database reports its bound once; a later run that stops at another fact is refused with the diagnostic naming the first", () => {
  const first = { name: "first", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 1, diagnostics: [] }) };
  const other = { name: "other", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 2, diagnostics: [] }) };
  const database = product.createDatabase(null, { maximumRecords: 0 }, noCycle, "off");
  const stopped = database.run(first, "a");
  assert.deepEqual(stopped, stoppedAt(0, "first", "S1:a"));
  const later = database.run(other, "b");
  assert.deepEqual(later, stoppedAt(0, "first", "S1:a"), "the later stop was at other[b]; the diagnostic still names first[a]");
  assert.equal(later.diagnostics[0], stopped.diagnostics[0]);
  assert.deepEqual(database.diagnostics(), [limitReached(0, "first", "S1:a")]);
});

test("records of work that leaves nothing behind are released: a thrown computation, and an abandonment with nothing earned", () => {
  const refusal = diagnostic(1, "a.ts", "refused");
  const kept = diagnostic(2, "b.ts", "earned");
  const original = Error("defect");
  const leaf = { name: "leaf", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }) };
  const thrower = { name: "thrower", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => { throw original; } };
  for (const [maximumRecords, expected] of [[6, stoppedAt(6, "leaf", "N")],
    [7, { kind: "completed", value: 7, diagnostics: [] }]]) {
    const database = product.createDatabase(null, { maximumRecords }, noCycle, "recorded");
    assert.throws(() => database.run(thrower, null), error => error === original);
    assert.deepEqual(database.run(leaf, null), expected);
  }
  const child = { name: "child", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "refused", diagnostics: [refusal] }) };
  for (const [earned, maximumRecords, expected] of [
    [[], 8, "refused"], [[kept], 8, "bound"], [[kept], 9, "refused"],
  ]) {
    const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" },
      compute: context => context.get(child, null, { witness: null, earned }, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
    const database = product.createDatabase(null, { maximumRecords }, noCycle, "recorded");
    assert.deepEqual(database.run(parent, null), { kind: "refused", diagnostics: [refusal] });
    assert.deepEqual(database.run(child, null), expected === "bound" ? stoppedAt(maximumRecords, "child", "N") : { kind: "refused", diagnostics: [refusal] });
    assert.deepEqual(database.diagnostics(), [refusal, ...earned, ...(expected === "bound" ? [limitReached(maximumRecords, "child", "N")] : [])]);
  }
});

test("fresh actual declarations retain construction, snapshots, readonly fields, the removed forms and private-entry rejection", () => {
  const deps = isolationDeps(tooling, quarantineRoots);
  const parent = resolve(repository, ".temp/query-consumers");
  mkdirSync(parent, { recursive: true });
  const stage = mkdtempSync(resolve(parent, "case-"));
  writeFileSync(resolve(stage, "package.json"), '{"type":"module","private":true}\n');
  for (const owner of ["query", "ids", "diag"]) {
    mkdirSync(resolve(stage, owner));
    for (const name of ["contract", "index"]) {
      copyFileSync(resolve(repository, `packages/host/dist/${owner}/${name}.d.ts`), resolve(stage, `${owner}/${name}.d.ts`));
    }
  }
  const positive = resolve(stage, "positive.mts");
  writeFileSync(positive, `import { createDatabase } from "./query/index.js";
import type { ClassifyCycle, ClosedCycle, CreateDatabase, CycleOutcome, Database, FactKey, Query, QueryAbandonment, QueryLimits, QueryStat, RunResult, TraceEvent, TraceRecording } from "./query/contract.js";
import type { Cause, Diagnostic } from "./diag/contract.js";
type Inputs = { readonly name: string };
type Witness = { readonly site: string };
type Row<Key extends null | number, Value> = Query<Inputs, Key, Value, Witness, null>;
const create: CreateDatabase = createDatabase;
const limits: QueryLimits = { maximumRecords: 64 };
const silent: TraceRecording = "off";
const refusal: Diagnostic = { code: { kind: "checker", number: 1, rendered: "TS1" }, severity: "error",
  site: { kind: "file", path: "actual.ts" }, source: null, evidence: [], message: "actual refusal",
  arguments: [], related: [], fix: null };
const ground: Cause = { kind: "unit", unit: { request: { query: "classified", key: null }, position: { kind: "result" } } };
const classify: ClassifyCycle<Witness, null> = (cycle: ClosedCycle<Witness>): readonly CycleOutcome<null>[] =>
  cycle.members.map((member, index) => index === 0 && member.witness.site.length > 0
    ? { kind: "refused", diagnostic: refusal } : { kind: "error", data: null, emissions: [], cause: ground, diagnostics: [] });
const database: Database<Inputs, Witness, null> = create({ name: "actual" }, limits, classify, "recorded");
const stopped: QueryAbandonment = { kind: "abandoned", diagnostics: [refusal], earned: [] };
const gives: Row<null, number> = { name: "gives", compute: () => stopped, keyData: key => key, answerPolicy: { kind: "refusal-only" } };
const actualKey = { id: 7, evidence: (): void => {} };
const typed: Query<Inputs, typeof actualKey, number, Witness, null> = { name: "typed-key", keyData: key => key.id,
  compute: (context, key) => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: key.id + context.fact.encodedKey.length, diagnostics: [] }),
  answerPolicy: { kind: "typed-error", construct: (key, cause) => ({ value: key.id, positions: [{ position: { kind: "result" }, error: { kind: "error", causes: [cause] } }] }) } };
void database.run(typed, actualKey);
void create({ name: "silent" }, limits, classify, silent).run(gives, null);
const inputs: Inputs = database.inputs;
const statistics: readonly QueryStat[] = database.stats();
const diagnostics: readonly Diagnostic[] = database.diagnostics();
const trace: readonly TraceEvent[] = database.trace();
const key: FactKey = { query: "actual", key: null, encodedKey: "N" };
const text: Row<number, string> = {
  name: "text",
  compute: (current, key) => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: current.inputs.name + key, diagnostics: [] }),
  keyData: key => key, answerPolicy: { kind: "typed-error", construct: (key, cause) => ({ value: cause.kind + key, positions: [{ position: { kind: "result" }, error: { kind: "error", causes: [cause] } }] }) },
};
const count: Row<null, number> = {
  name: "count",
  compute: current => current.get(text, 7, { witness: { site: "count" }, earned: [refusal] },
    value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value.length, diagnostics: [] })),
  keyData: key => key, answerPolicy: { kind: "typed-error", construct: (_, cause) => ({ value: cause.kind.length, positions: [{ position: { kind: "result" }, error: { kind: "error", causes: [cause] } }] }) },
};
function consume(result: RunResult<number>): number {
  switch (result.kind) {
    case "completed": return result.value + result.diagnostics.length;
    case "refused": return result.diagnostics[0].message.length;
  }
}
function describe(event: TraceEvent): string {
  switch (event.kind) {
    case "dependency": return (event.from === null ? "root" : event.from.query) + ">" + event.to.query + ":" + event.state;
    case "start": return event.fact.query;
    case "completion": return event.fact.query + ":" + event.outcome;
  }
}
const value: number = consume(database.run(count, null));
consume({ kind: "completed", value: 7, diagnostics: [] });
consume({ kind: "refused", diagnostics: [refusal] });
void inputs; void statistics; void diagnostics; void trace.map(describe); void value; void key;
`);
  const cases = [
    ["readonly-inputs", "database.inputs = database.inputs;", 2540, 3, 10],
    ["removed-synchronous-get", "void database.get;", 2339, 3, 15],
    ["readonly-run-port", "database.run = database.run;", 2540, 3, 10],
    ["readonly-stats-port", "database.stats = database.stats;", 2540, 3, 10],
    ["readonly-diagnostics-port", "database.diagnostics = database.diagnostics;", 2540, 3, 10],
    ["readonly-trace-port", "database.trace = database.trace;", 2540, 3, 10],
    ["readonly-statistics", "database.stats().push();", 2339, 3, 18],
    ["readonly-diagnostics", "database.diagnostics().push();", 2339, 3, 24],
    ["readonly-trace", "database.trace().push();", 2339, 3, 18],
    ["readonly-limit", "limits.maximumRecords = 3;", 2540, 3, 8],
    ["readonly-statistic-row", "for (const statistic of database.stats()) {\n  statistic.computed = 2;\n}", 2540, 4, 13],
    ["readonly-fact-key", 'const key: Port.FactKey = { query: "one", key: null, encodedKey: "N" };\nkey.encodedKey = "B1";', 2540, 4, 5],
    ["readonly-completed-value", 'const result: Port.RunResult<number> = { kind: "completed", value: 7, diagnostics: [] };\nresult.value = 9;', 2540, 4, 8],
    ["missing-limit", 'const wrong: Port.QueryLimits = {}; void wrong;', 2741, 3, 7],
    ["wrong-limit", 'const wrong: Port.QueryLimits = { maximumRecords: "2" }; void wrong;', 2322, 3, 35],
    ["wrong-query-key", 'database.run<null, number>(\n  { name: "typed", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }) },\n  true,\n);', 2345, 5, 3],
    ["closed-run-outcomes", 'const wrong: Port.RunResult<number> = { kind: "pending" }; void wrong;', 2322, 3, 41],
    ["removed-exhausted-outcome", 'const wrong: Port.RunResult<number> = { kind: "exhausted", maximumRecords: 1 }; void wrong;', 2322, 3, 41],
    ["removed-depth-outcome", 'const wrong: Port.RunResult<number> = { kind: "depth-exceeded", chain: [] }; void wrong;', 2322, 3, 41],
    ["undeclared-runtime-port", 'import { lookup } from "./query/index.js"; void lookup;', 2305, 3, 10],
    ["private-entry", 'import { leastFact } from "./query/memo.js"; void leastFact;', 2307, 3, 27],
  ];
  const located = (name, body, code, token, shift) => cases.push([name, body, code, 3, body.indexOf(token) + shift]);
  const row = 'const wrong: Port.Query<null, null, number, null, null> = { name: "row", keyData: key => key, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] })';
  located("removed-depth-limit", 'const wrong: Port.QueryLimits = { maximumRecords: 2, maxActiveDepth: 2 }; void wrong;', 2353, "maxActiveDepth", 1);
  located("removed-cycle-policy", `${row}, answerPolicy: { kind: "refusal-only" }, cycle: "invariant" }; void wrong;`, 2353, 'cycle: "invariant"', 1);
  located("removed-cycle-outcome-hook", `${row}, answerPolicy: { kind: "refusal-only" }, cycleOutcome: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 0, diagnostics: [] }) }; void wrong;`, 2353, "cycleOutcome", 1);
  located("missing-answer-policy", `${row} }; void wrong;`, 2741, "wrong", 1);
  located("missing-key-projection", 'const wrong: Port.Query<null, null, number, null, null> = { name: "old", compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }), answerPolicy: { kind: "refusal-only" } }; void wrong;', 2741, "wrong", 1);
  located("wrong-key-projection", 'const wrong: Port.Query<null, { readonly id: number }, number, null, null> = { name: "bad", keyData: key => () => key.id, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }), answerPolicy: { kind: "refusal-only" } }; void wrong;', 2322, "key => () => key.id", 1);
  located("readonly-context-fact", 'function mutate(context: Port.QueryContext<null, null, null>): void { context.fact = context.fact; } void mutate;', 2540, ".fact", 2);
  located("removed-error-value", `${row}, answerPolicy: { kind: "refusal-only" }, errorValue: () => 0 }; void wrong;`, 2353, "errorValue", 1);
  located("typed-error-requires-constructor", `${row}, answerPolicy: { kind: "typed-error" } }; void wrong;`, 2322, "answerPolicy", 1);
  located("refusal-only-has-no-constructor", `${row}, answerPolicy: { kind: "refusal-only", construct: () => 0 } }; void wrong;`, 2353, "construct", 1);
  located("a-row-cannot-refuse", `${row}, answerPolicy: { kind: "typed-error", construct: () => ({ kind: "refused", diagnostics: [] }) } }; void wrong;`, 2739, '({ kind: "refused"', 1);
  located("closed-answer-policy", `${row}, answerPolicy: { kind: "fallback" } }; void wrong;`, 2322, 'kind: "fallback"', 1);
  located("readonly-answer-policy", 'function mutate(query: Port.Query<null, null, number, null, null>): void { query.answerPolicy = { kind: "refusal-only" }; } void mutate;', 2540, ".answerPolicy", 2);
  located("readonly-member-capability", 'function mutate(member: Port.CycleMember<null>): void { member.answerPolicy = "typed-error"; } void mutate;', 2540, ".answerPolicy", 2);
  located("outcome-third-arm", 'const wrong: Port.CycleOutcome<null> = { kind: "valid", value: 1 }; void wrong;', 2322, "kind", 1);
  located("refused-outcome-without-diagnostic", 'const wrong: Port.CycleOutcome<null> = { kind: "refused" }; void wrong;', 2322, "wrong", 1);
  located("error-outcome-without-earned-diagnostics", 'const wrong: Port.CycleOutcome<null> = { kind: "error", data: null, emissions: [], cause: { kind: "unit", unit: { request: { query: "q", key: null }, position: { kind: "result" } } } }; void wrong;', 2322, "wrong", 1);
  located("verdict-parameter-removed", 'const wrong: Port.Query<null, null, number, null, null, null> | null = null; void wrong;', 2314, "Port.Query", 1);
  located("missing-classifier", 'void createDatabase(null, { maximumRecords: 2 });', 2554, "createDatabase", 1);
  located("missing-trace-choice", 'void createDatabase(null, { maximumRecords: 2 }, () => []);', 2554, "createDatabase", 1);
  located("wrong-trace-choice", 'void createDatabase(null, { maximumRecords: 2 }, () => [], "on");', 2345, '"on"', 1);
  located("empty-abandonment", 'const wrong: Port.QueryAbandonment = { kind: "abandoned", diagnostics: [], earned: [] }; void wrong;', 2322, "diagnostics", 1);
  located("missing-request", 'function legacy(context: Port.QueryContext<null, null, null>, query: Port.Query<null, null, number, null, null>, resume: (value: number) => Port.QueryComputation<null, number, null, null>): void { context.get(query, null, resume); } void legacy;', 2554, ".get", 2);
  located("removed-context-diagnostics", 'function read(context: Port.QueryContext<null, null, null>): void { void context.diagnostics; } void read;', 2339, ".diagnostics", 2);
  located("removed-context-stats", 'function read(context: Port.QueryContext<null, null, null>): void { void context.stats; } void read;', 2339, ".stats", 2);
  located("removed-nested-root", 'function nested(context: Port.QueryContext<null, null, null>): void { void context.run; } void nested;', 2339, ".run", 2);
  located("readonly-context-get", 'function mutate(context: Port.QueryContext<null, null, null>): void { context.get = context.get; } void mutate;', 2540, ".get", 2);
  const files = [positive];
  const expected = [];
  for (const [name, body, code, line, column] of cases) {
    const file = `${name}.mts`;
    writeFileSync(resolve(stage, file), `import { createDatabase } from "./query/index.js"; import type * as Port from "./query/contract.js";\nconst database = createDatabase(null, { maximumRecords: 2 }, () => [], "off"); void database; const limits: Port.QueryLimits = { maximumRecords: 2 }; void limits;\n${body}\n`);
    files.push(resolve(stage, file));
    expected.push({ file, line, column, code });
  }
  const config = resolve(stage, "tsconfig.json");
  writeFileSync(config, JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true, noUnusedLocals: true, noUnusedParameters: true, noImplicitReturns: true,
    noFallthroughCasesInSwitch: true, noEmit: true, skipLibCheck: false, target: "es2022", lib: ["es2022"],
    module: "nodenext", moduleResolution: "nodenext", types: [] }, files }));
  const result = spawnSync(process.execPath, [deps.compiler, "--project", config, "--listFiles", "--pretty", "false"], {
    cwd: stage, encoding: "utf8", timeout: 90_000, maxBuffer: 4_194_304,
  });
  assert.equal(result.error === undefined && result.signal === null, true, "the real strict declaration consumer terminates");
  const output = `${result.stdout}${result.stderr}`;
  writeFileSync(resolve(stage, "diagnostics.log"), output);
  const actual = [...output.matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gmu)].map(match => ({
    file: basename(match[1]), line: Number(match[2]), column: Number(match[3]), code: Number(match[4]),
  }));
  assert.equal([...output.matchAll(/\berror TS\d+:/gu)].length, actual.length,
    "every compiler error belongs to the complete located diagnostic vector");
  const order = rows => rows.sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1
    : left.line - right.line || left.column - right.column || left.code - right.code);
  assert.deepEqual(order(actual), order(expected), output.slice(0, 4000));
  assert.equal(result.status, 1, "the pinned compiler rejects the exact negative programs with no emit");
  const loaded = result.stdout.split(/\r?\n/u).filter(path => path.startsWith("/"));
  const declarations = ["query/contract.d.ts", "query/index.d.ts", "diag/contract.d.ts", "ids/contract.d.ts"]
    .map(path => resolve(stage, path));
  const allowed = new Set([...files, ...declarations, ...deps.platform.language]);
  assert.equal(loaded.length > files.length, true);
  assert.equal(loaded.every(path => allowed.has(realpathSync(path))), true, "no original, private or stale dependency source is loaded");
  assert.deepEqual(loaded.filter(path => path.startsWith(stage) && path.endsWith(".d.ts")).sort(), declarations.sort());
});

test("an abandonment stated by a computation ends it without a memo entry; its refusal and what it had earned are kept once", () => {
  const refusal = diagnostic(1, "a.ts", "the unmemoised application it needed refused");
  const found = diagnostic(2, "b.ts", "found before the application was applied");
  const above = diagnostic(3, "c.ts", "earned by its requester");
  let computed = 0;
  const stops = { name: "stops", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => {
    computed += 1;
    return { kind: "abandoned", diagnostics: [refusal], earned: [found] };
  } };
  const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: context => context.get(stops, null, { witness: null, earned: [above] }, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  for (let request = 1; request <= 2; request += 1) {
    assert.deepEqual(database.run(parent, null), { kind: "refused", diagnostics: [refusal] });
    assert.deepEqual(database.diagnostics(), [refusal, found, above]);
    assert.equal(computed, request);
  }
  assert.deepEqual(database.run(stops, null), { kind: "refused", diagnostics: [refusal] });
  assert.deepEqual(database.diagnostics(), [refusal, found, above]);
  assert.deepEqual(database.stats(), [{ name: "parent", computed: 2, hits: 0 }, { name: "stops", computed: 3, hits: 0 }]);
  assert.deepEqual(database.trace().filter(event => event.kind === "completion").map(event => [event.fact.query, event.outcome]),
    [["stops", "abandoned"], ["parent", "abandoned"], ["stops", "abandoned"], ["parent", "abandoned"], ["stops", "abandoned"]]);
});

function measure(expected, scenario, classify = errors) {
  const database = product.createDatabase(null, { maximumRecords: expected + 3 }, classify, "recorded");
  const spare = { name: "zz-spare", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }) };
  assert.equal(database.run(spare, null).kind, "completed");
  scenario(database);
  let warm = 0;
  while (warm <= 50 && database.run(spare, null).kind === "completed") warm += 1;
  return { remaining: warm, database };
}
const completionsOf = database => database.trace().filter(event => event.kind === "completion").map(event => `${event.fact.query}:${event.outcome}`);

test("R1-a, R1-b: a cycle retains exactly its members' records, under a requester whose list is kept and as the root", () => {
  const earnedA = diagnostic(1, "a.ts", "earned by A");
  const earnedR = diagnostic(2, "r.ts", "earned by the requester");
  const refusal = diagnostic(3, "x.ts", "cycle refusal");
  const resume = value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] });
  const a = { name: "A", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(b, null, { witness: "A", earned: [earnedA] }, resume) };
  const b = { name: "B", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => "error") }, compute: context => context.get(a, null, { witness: "B", earned: [] }, resume) };
  const r = { name: "R", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(a, null, { witness: "R", earned: [earnedR] }, resume) };
  const under = measure(5 + 4 + 4 + 5 + 1, database => { assert.deepEqual(database.run(r, null), { kind: "refused", diagnostics: [earnedA, refusal] }); },
    cycle => cycle.members.map(member => member.fact.query === "A" ? { kind: "refused", diagnostic: refusal } : { kind: "error", data: null, emissions: [], cause, diagnostics: [] }));
  assert.equal(under.remaining, 3, "spare 5; R three events and its kept list; A four and B five (including its position); the closing request one");
  assert.deepEqual(completionsOf(under.database).slice(1), ["A:cycle-refused", "B:cycle-ok", "R:abandoned"]);
  assert.deepEqual(under.database.diagnostics(), [earnedA, earnedR, refusal, limitReached(22, "zz-spare", "N")],
    "the measuring loop ends at the bound, which is reported once");
  const c = { name: "C", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => 1) }, compute: context => context.get(d, null, none, resume) };
  const d = { name: "D", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => 2) }, compute: context => context.get(c, null, none, resume) };
  const root = measure(5 + 5 + 5 + 1, database => { assert.deepEqual(database.run(c, null), { kind: "completed", value: 1, diagnostics: [] }); });
  assert.equal(root.remaining, 3);
});

test("R1-c: exhaustion at the request that would close a cycle abandons every active computation; nothing is memoised and what was earned is kept", () => {
  const earnedA = diagnostic(1, "a.ts", "earned by A");
  const earnedR = diagnostic(2, "r.ts", "earned by the requester");
  const resume = value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] });
  const a = { name: "A", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(b, null, { witness: "A", earned: [earnedA] }, resume) };
  const b = { name: "B", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(c, null, none, resume) };
  const c = { name: "C", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(a, null, none, resume) };
  const r = { name: "R", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(a, null, { witness: "R", earned: [earnedR] }, resume) };
  const spare = { name: "zz-spare", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] }) };
  const database = product.createDatabase(null, { maximumRecords: 5 + 16 }, noCycle, "recorded");
  assert.equal(database.run(spare, null).kind, "completed");
  assert.deepEqual(database.run(r, null), stoppedAt(21, "A", "N"));
  assert.deepEqual(completionsOf(database).slice(1), ["C:abandoned", "B:abandoned", "A:abandoned", "R:abandoned"]);
  assert.deepEqual(database.stats().filter(row => row.name !== "zz-spare"), ["A", "B", "C", "R"].map(name => ({ name, computed: 1, hits: 0 })));
  assert.deepEqual(database.diagnostics(), [earnedA, earnedR, limitReached(21, "A", "N")]);
  let warm = 0;
  while (warm <= 50 && database.run(spare, null).kind === "completed") warm += 1;
  assert.equal(warm, 2, "19 of 21 retained: R and A three events and a kept list each, B and C three events each");
});

test("R1-d: two cycles in one strongly connected group are classified alike and give the same outcomes for every first demand", () => {
  const names = ["A", "B", "C", "D", "W"];
  const results = [];
  for (const order of [["A", "C", "W", "B", "D"], ["C", "A", "W", "D", "B"], ["W", "D", "B", "A", "C"], ["D", "W", "A", "B", "C"], ["B", "D", "W", "C", "A"]]) {
    const classified = [];
    const rows = {};
    const row = (name, sequence) => ({ name, keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError((key, received) => `${name}:member of ${received.diagnostic.diagnostic.module}`) },
      compute: context => {
        const answers = [];
        const next = index => index === sequence.length ? { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: `${name}(${answers.join(",")})`, diagnostics: [] }
          : context.get(rows[sequence[index]], null, { witness: `${name}->${sequence[index]}`, earned: [] }, value => { answers.push(value); return next(index + 1); });
        return next(0);
      } });
    Object.assign(rows, { A: row("A", ["B"]), B: row("B", ["A", "C"]), C: row("C", ["D"]), D: row("D", ["C", "A"]), W: row("W", ["A", "C"]) });
    const database = product.createDatabase(null, unbounded, cycle => {
      const text = cycle.members.map(member => member.fact.query).join("+");
      classified.push(text);
      return cycle.members.map(() => ({ kind: "error", data: null, emissions: [], cause: { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: text, index: 0 } } }, diagnostics: [] }));
    }, "recorded");
    for (const name of order) assert.equal(database.run(rows[name], null).kind, "completed", name);
    results.push({ classified: classified.sort(), values: Object.fromEntries(names.map(name => [name, database.run(rows[name], null).value])) });
  }
  assert.deepEqual(results[0], { classified: ["A+B", "C+D"], values: { A: "A:member of A+B", B: "B:member of A+B",
    C: "C:member of C+D", D: "D:member of C+D", W: "W(A:member of A+B,C:member of C+D)" } });
  for (const result of results) assert.deepEqual(result, results[0]);
});

test("K-1: an abandonment at an earlier point than the one already kept for its fact does not shorten what is kept", () => {
  const refusesQ = diagnostic(1, "q.ts", "Q refuses");
  const earned = diagnostic(2, "x.ts", "earned by X after P and before Q");
  const later = diagnostic(3, "y.ts", "earned by X after a further answer");
  const p = { name: "P", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 1, diagnostics: [] }) };
  const q = { name: "Q", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => ({ kind: "refused", diagnostics: [refusesQ] }) };
  const x = { name: "X", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => context.get(p, null, none,
    () => context.get(q, null, { witness: null, earned: [earned] }, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] }))) };
  const bounded = product.createDatabase(null, { maximumRecords: 17 }, noCycle, "recorded");
  assert.deepEqual(bounded.run(x, null), { kind: "refused", diagnostics: [refusesQ] });
  assert.deepEqual(bounded.diagnostics(), [refusesQ, earned]);
  assert.deepEqual(bounded.run(x, null), stoppedAt(17, "P", "N"),
    "the second run of X is admitted cold and has no record for its warm request of P");
  assert.deepEqual(bounded.diagnostics(), [refusesQ, earned, limitReached(17, "P", "N")], "what the first abandonment kept is still reported");
  let mode = "first";
  const y = { name: "Y", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => mode === "first"
    ? context.get(q, null, { witness: null, earned: [earned] }, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] }))
    : context.get(p, null, { witness: null, earned: [] }, () => context.get(q, null,
      { witness: null, earned: mode === "nothing" ? [] : [earned, later] }, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] }))) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  database.run(y, null);
  assert.deepEqual(database.diagnostics(), [refusesQ, earned]);
  mode = "further";
  database.run(y, null);
  assert.deepEqual(database.diagnostics(), [refusesQ, earned, later], "an abandonment further on replaces the list");
  mode = "first";
  database.run(y, null);
  assert.deepEqual(database.diagnostics(), [refusesQ, earned, later], "an earlier one does not");
  mode = "nothing";
  database.run(y, null);
  assert.deepEqual(database.diagnostics(), [refusesQ], "the furthest abandonment states nothing earned, and nothing is kept");
});

test("K-3240: a request states an increment; chunks survive abandonment at the second and third request, an earlier abandonment does not shorten them, and a completed result holds each once", () => {
  const [first, second, third, last] = [1, 2, 3, 4].map(number => diagnostic(number, `e${number}.ts`, `earned before request ${number}`));
  const stops = [5, 6, 7].map(number => diagnostic(number, `s${number}.ts`, `refusal ${number}`));
  const gate = { name: "gate", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: (_, key) => key[2] === null ? { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: key[1], diagnostics: [] } : { kind: "refused", diagnostics: [stops[key[2]]] } };
  let phase = 0;
  let refuseAt = 0;
  const ask = (context, request, earned, then) =>
    context.get(gate, [phase, request, request === refuseAt ? phase : null], { witness: null, earned }, then);
  const x = { name: "X", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: context => ask(context, 1, [first],
    () => ask(context, 2, [second], () => ask(context, 3, [third], () => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: "done", diagnostics: [last] })))) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  const attempt = at => { refuseAt = at; const result = database.run(x, null); phase += 1; return result; };
  assert.deepEqual(attempt(2), { kind: "refused", diagnostics: [stops[0]] });
  assert.deepEqual(database.diagnostics(), [first, second, stops[0]], "the chunk stated with the refused request is kept with the one before it");
  assert.deepEqual(attempt(3), { kind: "refused", diagnostics: [stops[1]] });
  assert.deepEqual(database.diagnostics(), [first, second, third, stops[0], stops[1]], "an abandonment further on keeps all three chunks, each once");
  assert.deepEqual(attempt(2), { kind: "refused", diagnostics: [stops[2]] });
  assert.deepEqual(database.diagnostics(), [first, second, third, stops[0], stops[1], stops[2]], "an earlier abandonment does not shorten what is kept");
  const completed = attempt(0);
  assert.deepEqual(completed, { kind: "completed", value: "done", diagnostics: [first, second, third, last] },
    "the chunks in order, then what the final result carries");
  assert.deepEqual(database.diagnostics(), [first, second, third, last, stops[0], stops[1], stops[2]], "published once; nothing kept beside the result");
  assert.deepEqual(database.run(x, null), completed, "a memo hit returns the composed result");
  assert.deepEqual(database.stats().find(row => row.name === "X"), { name: "X", computed: 4, hits: 1 });
});

test("R1: a fact abandoned with a kept chunk and later settled as a cycle member is reported once, in its result", () => {
  const stop = diagnostic(1, "a.ts", "gate refuses");
  const kept = diagnostic(2, "b.ts", "earned by A before its first request");
  let phase = 0;
  const gate = { name: "gate", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: (_, key) => key === 0 ? { kind: "refused", diagnostics: [stop] } : { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 1, diagnostics: [] } };
  const a = { name: "A", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => "A-error") }, compute: context => context.get(gate, phase, { witness: "A", earned: [kept] },
    () => context.get(b, null, { witness: "A", earned: [] }, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] }))) };
  const b = { name: "B", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => "B-error") },
    compute: context => context.get(a, null, { witness: "B", earned: [] }, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, errors, "recorded");
  assert.deepEqual(database.run(a, null), { kind: "refused", diagnostics: [stop] });
  assert.deepEqual(database.diagnostics(), [stop, kept], "kept for the abandoned attempt");
  phase = 1;
  assert.deepEqual(database.run(a, null), { kind: "completed", value: "A-error", diagnostics: [kept] });
  assert.deepEqual(database.diagnostics(), [stop, kept], "the settled member's result replaces what was kept: once");
});

test("with the trace off no event exists and a request allocates no record: a scalar fact and its answer position cost two records, a warm or closing request none", () => {
  const original = Error("defect");
  const leaf = { name: "leaf", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: (_, key) => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: key, diagnostics: [] }) };
  const parent = { name: "parent", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: context => context.get(leaf, 1, none, value => context.get(leaf, 1, none, again => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: value + again, diagnostics: [] }))) };
  const self = { name: "self", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => 0) },
    compute: context => context.get(self, null, none, value => ({ kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics: [] })) };
  let throws = true;
  const thrower = { name: "thrower", keyData: key => key, answerPolicy: { kind: "refusal-only" }, compute: () => {
    if (throws) throw original;
    return { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value: 7, diagnostics: [] };
  } };
  const none0 = product.createDatabase(null, { maximumRecords: 0 }, noCycle, "off");
  assert.deepEqual(none0.run(leaf, 1), stoppedAt(0, "leaf", "F1:"));
  const one = product.createDatabase(null, { maximumRecords: 2 }, noCycle, "off");
  for (let request = 0; request < 1000; request += 1) assert.deepEqual(one.run(leaf, 1), { kind: "completed", value: 1, diagnostics: [] });
  assert.deepEqual(one.run(leaf, 2), stoppedAt(2, "leaf", "F2:"));
  assert.deepEqual(one.trace(), []);
  assert.deepEqual(one.stats(), [{ name: "leaf", computed: 1, hits: 999 }]);
  const two = product.createDatabase(null, { maximumRecords: 4 }, noCycle, "off");
  assert.deepEqual(two.run(parent, null), { kind: "completed", value: 2, diagnostics: [] });
  assert.deepEqual(two.run(leaf, 2), stoppedAt(4, "leaf", "F2:"));
  const closing = product.createDatabase(null, { maximumRecords: 2 }, errors, "off");
  assert.deepEqual(closing.run(self, null), { kind: "completed", value: 0, diagnostics: [] });
  assert.deepEqual(closing.trace(), []);
  const released = product.createDatabase(null, { maximumRecords: 2 }, noCycle, "off");
  assert.throws(() => released.run(thrower, null), error => error === original);
  throws = false;
  assert.deepEqual(released.run(thrower, null), { kind: "completed", value: 7, diagnostics: [] });
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
    const raw = [{ ...capture, result, sources }];
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => ({ path: fileURLToPath(url), text }) },
    [...runtimeFiles, resolve(repository, "packages/host/src/query/contract.ts")], raw);
    const directory = resolve(repository, ".temp/query-coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "raw-v8.json"), `${JSON.stringify(raw)}\n`);
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(directory, "source-inputs.json"), `${JSON.stringify(sourceFiles.map(path => ({ path,
      hash: createHash("sha256").update(readFileSync(resolve(repository, path))).digest("hex") })), null, 2)}\n`);
    assert.equal(result.length, 3, "all three genuine runtime owners have nonempty real V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    assert.equal(report.files.filter(file => file.status === "covered").length, 3);
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 1, "the actual type-only contract is N/A");
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally { session.disconnect(); }
});
