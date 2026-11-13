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

const unbounded = { maximumRecords: Number.MAX_SAFE_INTEGER };
const none = { witness: null, earned: [] };
const noCycle = () => { throw new Error("this case closes no cycle"); };
const fact = (query, key, encodedKey) => ({ query, key, encodedKey });

function evaluate(input) {
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  const queries = new Map(input.queries.map(entry => [entry.name, {
    expected: entry.value,
    query: { name: entry.name, cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: entry.value, diagnostics: [] }) },
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
  const query = { name: "input", cycleOutcome: noCycle, compute: (database, key) => {
    received = database;
    return { kind: "ok", value: `${database.inputs.prefix}:${key}`, diagnostics: [] };
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

test("completed wrappers memoize undefined, functions, bigint and every scalar without a missing-value fallback", () => {
  const callable = () => 7;
  const values = [undefined, null, false, true, 0, -0, NaN, Infinity, -Infinity, 9007199254740995n,
    "", ({ value: 1 }), ([]), callable];
  const query = { name: "values", cycleOutcome: noCycle, compute: (_, key) => ({ kind: "ok", value: values[key], diagnostics: [] }) };
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
  const query = { name: "scalars", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: ++computed, diagnostics: [] }) };
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
  const query = { name: "ok", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 7, diagnostics: supplied }) };
  const refused = { name: "refused", cycleOutcome: noCycle, compute: () => ({ kind: "refused", diagnostics: [first, second] }) };
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
      const child = { name: "child", cycleOutcome: noCycle,
        compute: () => ({ kind: "ok", value: 7, diagnostics: vector.supplied }) };
      const parent = { name: "parent", cycleOutcome: noCycle, compute: context => context.get(child, null, none, value => {
        continuation += 1;
        return { kind: "ok", value: value + 1, diagnostics: [] };
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
      const child = { name: "child", cycleOutcome: noCycle,
        compute: () => ({ kind: "refused", diagnostics: vector.supplied }) };
      const parent = { name: "parent", cycleOutcome: noCycle, compute: context => context.get(child, null, none, value => {
        continuation += 1;
        return { kind: "ok", value, diagnostics: [] };
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
  const leaf = { name: "C", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 2, diagnostics: [leafDiagnostic] }) };
  const middle = { name: "B", cycleOutcome: noCycle, compute: database => database.get(leaf, null, none, value => ({ kind: "ok", value: value + 1, diagnostics: [middleDiagnostic] })) };
  const root = { name: "A", cycleOutcome: noCycle, compute: context => context.get(middle, null,
    none, left => context.get(middle, null, none, right => context.get(leaf, null,
      none, last => ({ kind: "ok", value: left + right + last, diagnostics: [rootDiagnostic] })))) };
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
  const child = { name: "child", cycleOutcome: noCycle, compute: () => ({ kind: "refused", diagnostics: [first, second] }) };
  const parent = { name: "parent", cycleOutcome: noCycle, compute: context => context.get(child, null, none, value => {
    afterDependency += 1;
    return { kind: "ok", value, diagnostics: [] };
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
  const query = { name: "countdown", cycleOutcome: noCycle, compute: (context, key) => key === 0
    ? { kind: "ok", value: 0, diagnostics: [] }
    : context.get(query, key - 1, none, value => ({ kind: "ok", value: value + 1, diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(query, 3), { kind: "completed", value: 3, diagnostics: [] });
  assert.deepEqual(database.run(query, 2), { kind: "completed", value: 2, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "countdown", computed: 4, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), []);
});





test("an ordinary Error carrying a copied refusal tag is never converted into an expected outcome", () => {
  const fake = Object.assign(Error("query: abandoned computation"), { kind: "refused", diagnostics: [diagnostic(1, "a.ts", "fake")] });
  const query = { name: "forgery", cycleOutcome: noCycle, compute: () => { throw fake; } };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  for (let request = 0; request < 2; request += 1) assert.throws(() => database.run(query, null), error => error === fake);
  assert.deepEqual(database.stats(), [{ name: "forgery", computed: 2, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("an ordinary Error while constructing a dependency is not cached or converted to a refusal", () => {
  const original = Error("ordinary finally failure");
  const refusal = diagnostic(1, "a.ts", "actual refusal");
  const child = { name: "child", cycleOutcome: noCycle, compute: () => ({ kind: "refused", diagnostics: [refusal] }) };
  let override = true;
  const parent = { name: "parent", cycleOutcome: noCycle, compute: database => {
    try { return database.get(child, null, none, value => ({ kind: "ok", value, diagnostics: [] })); }
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
  const child = { name: "child", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 7, diagnostics: [childDiagnostic] }) };
  const parent = { name: "parent", cycleOutcome: noCycle, compute: context => context.get(child, null, none, value => {
    if (throws) throw original;
    return { kind: "ok", value: value + 1, diagnostics: [] };
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
  const query = { name: "deep", cycleOutcome: noCycle, compute: () => {
    calls += 1; return { kind: "ok", value: 7, diagnostics: [] };
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
  const query = { name: "invalid-key", cycleOutcome: noCycle, compute: () => {
    calls += 1; return { kind: "ok", value: 7, diagnostics: [] };
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
  const original = { name: "same", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) };
  const other = { name: "same", cycleOutcome: noCycle, compute: () => {
    wrongCalls += 1; return { kind: "ok", value: "wrong", diagnostics: [] };
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
  const leaf = { name: "leaf", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) };
  const inner = { name: "inner", cycleOutcome: noCycle, compute: current => current.get(leaf, null, none, value => ({ kind: "ok", value: value + 1, diagnostics: [] })) };
  const outer = { name: "outer", cycleOutcome: noCycle, compute: context => context.get(inner, null, none, value => {
    assert.equal(value, 8);
    return context.get(leaf, null, none, sibling => ({ kind: "ok", value: value + sibling, diagnostics: [] }));
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
      const query = { name, cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: name, diagnostics: [] }) };
      assert.deepEqual(database.run(query, null), { kind: "completed", value: name, diagnostics: [] });
    }
    assert.deepEqual(database.stats(), ordered.map(name => ({ name, computed: 1, hits: 0 })));
    assert.deepEqual(database.diagnostics(), []);
  }
});

test("the root database exposes no synchronous get and a captured reentrant run is rejected without a child frame", () => {
  let calls = 0;
  const query = { name: "root", cycleOutcome: noCycle, compute: () => {
    calls += 1; return { kind: "ok", value: 7, diagnostics: [] };
  } };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(Object.keys(database), ["inputs", "run", "diagnostics", "stats", "trace"]);
  assert.equal(database.get, undefined);
  assert.equal(calls, 0);
  assert.deepEqual(database.stats(), []);
  assert.deepEqual(database.diagnostics(), []);
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 7, diagnostics: [] });
  const parent = { name: "parent", cycleOutcome: noCycle, compute: () => database.run(query, null) };
  assert.throws(() => database.run(parent, null), { name: "TypeError",
    message: "query: run cannot be nested; request dependencies through context.get" });
  assert.equal(calls, 1);
  assert.deepEqual(database.stats(), [{ name: "parent", computed: 1, hits: 0 }, { name: "root", computed: 1, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("one hundred thousand genuine dependency edges finish iteratively and retain every completed memo", () => {
  const depth = 100000;
  let resumed = 0;
  const query = { name: "deep-chain", cycleOutcome: noCycle, compute: (context, key) => key === 0
    ? { kind: "ok", value: 0, diagnostics: [] }
    : context.get(query, key - 1, none, value => {
      resumed += 1;
      return { kind: "ok", value: value + 1, diagnostics: [] };
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
  const number = { name: "number", cycleOutcome: noCycle, compute: (_, key) => ({ kind: "ok", value: key + 1, diagnostics: [] }) };
  const text = { name: "text", cycleOutcome: noCycle, compute: (context, key) => context.get(number, key.length,
    none, value => ({ kind: "ok", value: `${key}:${value}`, diagnostics: [] })) };
  const root = { name: "root", cycleOutcome: noCycle, compute: context => context.get(text, "typed",
    none, value => ({ kind: "ok", value: value === "typed:6", diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(root, null), { kind: "completed", value: true, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "number", computed: 1, hits: 0 }, { name: "root", computed: 1, hits: 0 },
    { name: "text", computed: 1, hits: 0 }]);
  assert.deepEqual(database.run(text, "typed"), { kind: "completed", value: "typed:6", diagnostics: [] });
});

test("public dependency steps reject zero, repeated and delayed scheduling and clean every active frame", () => {
  const leaf = { name: "leaf", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) };
  const resume = value => ({ kind: "ok", value, diagnostics: [] });
  for (const requests of [0, 2]) {
    const database = product.createDatabase(null, unbounded, noCycle, "recorded");
    const malformed = { name: "malformed", cycleOutcome: noCycle, compute: () => ({ kind: "dependency", schedule: scheduler => {
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
  const query = { name: "retained", cycleOutcome: noCycle, compute: () => ({ kind: "dependency", schedule: scheduler => {
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
  const limits = { maximumRecords: 8 };
  const database = product.createDatabase(({ value: 7 }), limits, noCycle, "recorded");
  limits.maximumRecords = 0;
  const { run, stats, diagnostics, trace } = database;
  let receivedThis = "not-called";
  const child = { name: "child", cycleOutcome: noCycle, compute: function (current) {
    receivedThis = this;
    return { kind: "ok", value: current.inputs.value, diagnostics: [] };
  } };
  const parent = { name: "parent", cycleOutcome: noCycle, compute: current => {
    const { get } = current;
    assert.deepEqual(Object.keys(current), ["inputs", "get"], "a computation cannot read the database's diagnostics, statistics or trace");
    return get(child, null, none, value => ({ kind: "ok", value: value + 1, diagnostics: [] }));
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
  const query = { name: "throw", cycleOutcome: noCycle, compute: () => {
    if (throws) throw original;
    return { kind: "ok", value: 7, diagnostics: [] };
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
    { fact: fact("K", "n", "S1:n"), witness: "K reads the signature of its initializer" },
    { fact: fact("S", "size", "S4:size"), witness: "S reads its authored type" },
    { fact: fact("T", "array", "S5:array"), witness: "T reads its constant extent" },
  ] };
  const memoised = [];
  for (const first of ["S", "T", "K", "root"]) {
    const classified = [];
    let resumed = 0;
    const row = (name, key, next, nextKey, witness) => ({ name,
      cycleOutcome: (ownKey, verdict) => {
        assert.equal(ownKey, key);
        assert.equal(verdict, "ungrounded");
        return { kind: "ok", value: outcomes[name], diagnostics: [] };
      },
      compute: context => context.get(next(), nextKey, { witness, earned: [] }, value => {
        resumed += 1;
        return { kind: "ok", value, diagnostics: [] };
      }) });
    const signature = row("S", "size", () => type, "array", "S reads its authored type");
    const type = row("T", "array", () => constant, "n", "T reads its constant extent");
    const constant = row("K", "n", () => signature, "size", "K reads the signature of its initializer");
    const root = { name: "root", cycleOutcome: noCycle,
      compute: context => context.get(signature, "size", none, value => ({ kind: "ok", value: [value], diagnostics: [] })) };
    const rows = { S: [signature, "size"], T: [type, "array"], K: [constant, "n"] };
    const database = product.createDatabase(null, unbounded, cycle => { classified.push(cycle); return "ungrounded"; }, "recorded");
    if (first === "root") assert.deepEqual(database.run(root, null), { kind: "completed", value: [outcomes.S], diagnostics: [] });
    else assert.deepEqual(database.run(...rows[first]), { kind: "completed", value: outcomes[first], diagnostics: [] });
    assert.deepEqual(classified, [expectedCycle]);
    assert.equal(classified[0].members[1].fact.key, "size");
    assert.equal(resumed, 0, "no member of the cycle is resumed");
    const values = ["S", "T", "K"].map(name => {
      const result = database.run(...rows[name]);
      assert.equal(result.kind, "completed");
      assert.equal(result.value, outcomes[name], "each member holds its own outcome, never another member's value");
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
    const pair = { name: "pair", cycleOutcome: key => ({ kind: "ok", value: `cycle:${key}`, diagnostics: [] }),
      compute: (context, key) => context.get(pair, key === "a" ? "b" : "a", { witness: `from ${key}`, earned: [] },
        value => ({ kind: "ok", value, diagnostics: [] })) };
    const database = product.createDatabase(null, unbounded, cycle => { classified.push(cycle); return null; }, "recorded");
    assert.deepEqual(database.run(pair, first), { kind: "completed", value: `cycle:${first}`, diagnostics: [] });
    assert.deepEqual(classified, [{ members: [{ fact: fact("pair", "a", "S1:a"), witness: "from a" },
      { fact: fact("pair", "b", "S1:b"), witness: "from b" }] }]);
    assert.deepEqual(database.stats(), [{ name: "pair", computed: 2, hits: 0 }]);
  }
  const seen = [];
  let resumed = 0;
  const self = { name: "self", cycleOutcome: (key, verdict) => ({ kind: "ok", value: [key, verdict], diagnostics: [] }),
    compute: (context, key) => context.get(self, key, { witness: 9, earned: [] }, value => {
      resumed += 1;
      return { kind: "ok", value, diagnostics: [] };
    }) };
  const database = product.createDatabase(null, unbounded, cycle => { seen.push(cycle); return "self"; }, "recorded");
  const given = { kind: "record", fields: [["b", 2], ["a", 1]] };
  const result = database.run(self, given);
  assert.equal(result.kind, "completed");
  assert.deepEqual(result.value[1], "self");
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
  const query = { name: "prefix", cycleOutcome: key => ({ kind: "ok", value: key * 10, diagnostics: [] }),
    compute: (context, key) => context.get(query, key === 0 ? 1 : key === 1 ? 2 : 1, { witness: key, earned: [] },
      value => ({ kind: "ok", value: value + 1, diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, cycle => { classified.push(cycle.members.map(member => member.fact.key)); return null; }, "recorded");
  assert.deepEqual(database.run(query, 0), { kind: "completed", value: 11, diagnostics: [] });
  assert.deepEqual(classified, [[1, 2]]);
  assert.deepEqual(database.run(query, 1), { kind: "completed", value: 10, diagnostics: [] });
  assert.deepEqual(database.run(query, 2), { kind: "completed", value: 20, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "prefix", computed: 3, hits: 2 }]);
});

test("S2-8: a refused outcome for the head abandons its requester; members keep their own outcomes and earned diagnostics once", () => {
  const refusal = diagnostic(1, "a.ts", "ungrounded cycle");
  const earnedA = diagnostic(2, "b.ts", "earned by A before the cycle closed");
  const earnedB = diagnostic(3, "c.ts", "earned by B before the cycle closed");
  const earnedRoot = diagnostic(4, "d.ts", "earned by the requester outside the cycle");
  let resumed = 0;
  const resume = value => { resumed += 1; return { kind: "ok", value, diagnostics: [] }; };
  const first = { name: "A", cycleOutcome: () => ({ kind: "refused", diagnostics: [refusal] }),
    compute: context => context.get(second, null, { witness: "A", earned: [earnedA] }, resume) };
  const second = { name: "B", cycleOutcome: () => ({ kind: "ok", value: "error", diagnostics: [] }),
    compute: context => context.get(first, null, { witness: "B", earned: [earnedB] }, resume) };
  const root = { name: "root", cycleOutcome: noCycle,
    compute: context => context.get(first, null, { witness: "root", earned: [earnedRoot] }, resume) };
  const database = product.createDatabase(null, unbounded, () => null, "recorded");
  const refused = database.run(root, null);
  assert.deepEqual(refused, { kind: "refused", diagnostics: [refusal] });
  assert.equal(database.run(first, null), refused, "the head's refused outcome is its memo entry");
  assert.deepEqual(database.run(second, null), { kind: "completed", value: "error", diagnostics: [] });
  assert.deepEqual(database.run(root, null), { kind: "refused", diagnostics: [refusal] });
  assert.equal(resumed, 0);
  assert.deepEqual(database.diagnostics(), [refusal, earnedA, earnedB, earnedRoot]);
  assert.deepEqual(database.stats(), [{ name: "A", computed: 1, hits: 2 }, { name: "B", computed: 1, hits: 1 },
    { name: "root", computed: 2, hits: 0 }]);
  assert.deepEqual(database.trace().filter(event => event.kind === "completion").map(event => [event.fact.query, event.outcome]),
    [["A", "cycle-refused"], ["B", "cycle-ok"], ["root", "abandoned"], ["root", "abandoned"]]);
});

test("S2-8: a throwing classifier or outcome is a compiler defect: nothing is memoised and the database stays usable", () => {
  const classifierError = Error("classifier defect");
  const outcomeError = Error("outcome defect");
  let mode = "classifier";
  const first = { name: "A", cycleOutcome: () => ({ kind: "ok", value: 1, diagnostics: [] }),
    compute: context => context.get(second, null, none, value => ({ kind: "ok", value, diagnostics: [] })) };
  const second = { name: "B", cycleOutcome: () => {
    if (mode === "outcome") throw outcomeError;
    return { kind: "ok", value: 2, diagnostics: [] };
  }, compute: context => context.get(first, null, none, value => ({ kind: "ok", value, diagnostics: [] })) };
  const database = product.createDatabase(null, unbounded, () => {
    if (mode === "classifier") throw classifierError;
    return null;
  }, "recorded");
  assert.throws(() => database.run(first, null), error => error === classifierError);
  mode = "outcome";
  assert.throws(() => database.run(first, null), error => error === outcomeError);
  mode = "none";
  assert.deepEqual(database.run(first, null), { kind: "completed", value: 1, diagnostics: [] });
  assert.deepEqual(database.run(second, null), { kind: "completed", value: 2, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "A", computed: 3, hits: 0 }, { name: "B", computed: 3, hits: 1 }]);
});

test("S2-27: a cycle of one hundred thousand members closes and settles iteratively, with no depth limit", () => {
  const depth = 100000;
  const sizes = [];
  let resumed = 0;
  const query = { name: "deep-cycle", cycleOutcome: key => ({ kind: "ok", value: key, diagnostics: [] }),
    compute: (context, key) => context.get(query, key === depth ? 0 : key + 1, none, value => {
      resumed += 1;
      return { kind: "ok", value, diagnostics: [] };
    }) };
  const database = product.createDatabase(null, unbounded, cycle => { sizes.push(cycle.members.length); return null; }, "recorded");
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
  const big = { name: "big", cycleOutcome: noCycle, compute: () => ({ kind: "refused", diagnostics: [limit] }) };
  const f = { name: "f", cycleOutcome: noCycle, compute: context => needsBig
    ? context.get(big, null, { witness: null, earned: supplied }, value => { resumed += 1; return { kind: "ok", value, diagnostics: [] }; })
    : { kind: "ok", value: 7, diagnostics: [later] } };
  const g = { name: "g", cycleOutcome: noCycle,
    compute: context => context.get(f, null, { witness: null, earned: [outer] }, value => ({ kind: "ok", value: value + 1, diagnostics: [] })) };
  const quiet = { name: "quiet", cycleOutcome: noCycle,
    compute: context => context.get(big, null, none, value => ({ kind: "ok", value, diagnostics: [] })) };
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
  assert.deepEqual(database.run(g, null), { kind: "completed", value: 8, diagnostics: [] });
  assert.deepEqual(database.diagnostics(), [limit, later]);
  assert.deepEqual(database.trace().filter(event => event.kind === "completion").map(event => [event.fact.query, event.outcome]),
    [["big", "refused"], ["f", "abandoned"], ["g", "abandoned"], ["f", "abandoned"], ["g", "abandoned"],
      ["quiet", "abandoned"], ["f", "ok"], ["g", "ok"]]);
});

test("S2-27: the trace is the ordered record of request, start and completion; cold before warm and the warm opposite", () => {
  const add = { name: "add", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 42, diagnostics: [] }) };
  const total = { name: "total", cycleOutcome: noCycle,
    compute: context => context.get(add, null, none, value => ({ kind: "ok", value, diagnostics: [] })) };
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
  const leaf = { name: "leaf", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) };
  const parent = { name: "parent", cycleOutcome: noCycle,
    compute: context => context.get(leaf, null, { witness: null, earned: [earned] }, value => ({ kind: "ok", value, diagnostics: [] })) };
  const self = { name: "self", cycleOutcome: () => ({ kind: "ok", value: 0, diagnostics: [] }),
    compute: context => context.get(self, null, none, value => ({ kind: "ok", value, diagnostics: [] })) };
  const leafFact = fact("leaf", null, "N");
  const completed = { kind: "completed", value: 7, diagnostics: [] };
  const exhausted = (maximumRecords, at) => ({ kind: "exhausted", maximumRecords, at });
  for (const maximumRecords of [0, 3]) {
    const database = product.createDatabase(null, { maximumRecords }, noCycle, "recorded");
    assert.deepEqual(database.run(leaf, null), exhausted(maximumRecords, leafFact));
    assert.deepEqual(database.stats(), [{ name: "leaf", computed: 0, hits: 0 }]);
    assert.deepEqual(database.trace(), []);
  }
  const atCold = product.createDatabase(null, { maximumRecords: 4 }, noCycle, "recorded");
  assert.deepEqual(atCold.run(leaf, null), completed);
  assert.deepEqual(atCold.run(leaf, null), exhausted(4, leafFact), "a warm request is one more record");
  const atWarm = product.createDatabase(null, { maximumRecords: 5 }, noCycle, "recorded");
  assert.deepEqual(atWarm.run(leaf, null), completed);
  assert.deepEqual(atWarm.run(leaf, null), completed);
  assert.deepEqual(atWarm.run(leaf, null), exhausted(5, leafFact));
  const belowDependency = product.createDatabase(null, { maximumRecords: 7 }, noCycle, "recorded");
  assert.deepEqual(belowDependency.run(parent, null), exhausted(7, leafFact));
  assert.deepEqual(belowDependency.diagnostics(), [earned], "the abandoned requester keeps what it had earned");
  assert.deepEqual(belowDependency.stats(), [{ name: "leaf", computed: 0, hits: 0 }, { name: "parent", computed: 1, hits: 0 }]);
  assert.deepEqual(belowDependency.run(parent, null), exhausted(7, fact("parent", null, "N")));
  assert.deepEqual(belowDependency.diagnostics(), [earned]);
  const atDependency = product.createDatabase(null, { maximumRecords: 8 }, noCycle, "recorded");
  assert.deepEqual(atDependency.run(parent, null), completed);
  const belowClosing = product.createDatabase(null, { maximumRecords: 4 }, noCycle, "recorded");
  assert.deepEqual(belowClosing.run(self, null), exhausted(4, fact("self", null, "N")));
  const atClosing = product.createDatabase(null, { maximumRecords: 5 }, () => null, "recorded");
  assert.deepEqual(atClosing.run(self, null), { kind: "completed", value: 0, diagnostics: [] });
});

test("records of work that leaves nothing behind are released: a thrown computation, and an abandonment with nothing earned", () => {
  const refusal = diagnostic(1, "a.ts", "refused");
  const kept = diagnostic(2, "b.ts", "earned");
  const original = Error("defect");
  const leaf = { name: "leaf", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) };
  const thrower = { name: "thrower", cycleOutcome: noCycle, compute: () => { throw original; } };
  for (const [maximumRecords, expected] of [[5, { kind: "exhausted", maximumRecords: 5, at: fact("leaf", null, "N") }],
    [6, { kind: "completed", value: 7, diagnostics: [] }]]) {
    const database = product.createDatabase(null, { maximumRecords }, noCycle, "recorded");
    assert.throws(() => database.run(thrower, null), error => error === original);
    assert.deepEqual(database.run(leaf, null), expected);
  }
  const child = { name: "child", cycleOutcome: noCycle, compute: () => ({ kind: "refused", diagnostics: [refusal] }) };
  for (const [earned, maximumRecords, expected] of [
    [[], 8, "refused"], [[kept], 8, "exhausted"], [[kept], 9, "refused"],
  ]) {
    const parent = { name: "parent", cycleOutcome: noCycle,
      compute: context => context.get(child, null, { witness: null, earned }, value => ({ kind: "ok", value, diagnostics: [] })) };
    const database = product.createDatabase(null, { maximumRecords }, noCycle, "recorded");
    assert.deepEqual(database.run(parent, null), { kind: "refused", diagnostics: [refusal] });
    assert.equal(database.run(child, null).kind, expected);
    assert.deepEqual(database.diagnostics(), earned.length === 0 ? [refusal] : [refusal, kept]);
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
import type { ClassifyCycle, ClosedCycle, CreateDatabase, Database, FactKey, Query, QueryAbandonment, QueryLimits, QueryStat, RunResult, TraceEvent, TraceRecording } from "./query/contract.js";
import type { Diagnostic } from "./diag/contract.js";
type Inputs = { readonly name: string };
type Witness = { readonly site: string };
type Verdict = { readonly cause: string };
type Row<Key extends null | number, Value> = Query<Inputs, Key, Value, Witness, Verdict>;
const create: CreateDatabase = createDatabase;
const limits: QueryLimits = { maximumRecords: 64 };
const silent: TraceRecording = "off";
const stopped: QueryAbandonment = { kind: "abandoned", diagnostics: [{ code: { kind: "checker", number: 2, rendered: "TS2" }, severity: "error",
  site: { kind: "none" }, source: null, evidence: [], message: "refused application", arguments: [], related: [], fix: null }], earned: [] };
const gives: Row<null, number> = { name: "gives", compute: () => stopped, cycleOutcome: () => ({ kind: "ok", value: 0, diagnostics: [] }) };
const classify: ClassifyCycle<Witness, Verdict> = (cycle: ClosedCycle<Witness>) =>
  ({ cause: cycle.members.map(member => member.fact.query + "@" + member.witness.site).join(",") });
const database: Database<Inputs, Witness, Verdict> = create({ name: "actual" }, limits, classify, "recorded");
void create({ name: "silent" }, limits, classify, silent).run(gives, null);
const inputs: Inputs = database.inputs;
const statistics: readonly QueryStat[] = database.stats();
const diagnostics: readonly Diagnostic[] = database.diagnostics();
const trace: readonly TraceEvent[] = database.trace();
const key: FactKey = { query: "actual", key: null, encodedKey: "N" };
const refusal: Diagnostic = { code: { kind: "checker", number: 1, rendered: "TS1" }, severity: "error",
  site: { kind: "file", path: "actual.ts" }, source: null, evidence: [], message: "actual refusal",
  arguments: [], related: [], fix: null };
const text: Row<number, string> = {
  name: "text",
  compute: (current, key) => ({ kind: "ok", value: current.inputs.name + key, diagnostics: [] }),
  cycleOutcome: (key, verdict) => ({ kind: "ok", value: verdict.cause + key, diagnostics: [] }),
};
const count: Row<null, number> = {
  name: "count",
  compute: current => current.get(text, 7, { witness: { site: "count" }, earned: [refusal] },
    value => ({ kind: "ok", value: value.length, diagnostics: [] })),
  cycleOutcome: (_, verdict) => verdict.cause.length < 0 ? { kind: "ok", value: 0, diagnostics: [] }
    : { kind: "refused", diagnostics: [refusal] },
};
function consume(result: RunResult<number>): number {
  switch (result.kind) {
    case "completed": return result.value + result.diagnostics.length;
    case "refused": return result.diagnostics[0].message.length;
    case "exhausted": return result.maximumRecords + result.at.encodedKey.length;
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
consume({ kind: "exhausted", maximumRecords: 1, at: key });
void inputs; void statistics; void diagnostics; void trace.map(describe); void value;
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
    ["wrong-query-key", 'database.run<null, number>(\n  { name: "typed", cycleOutcome: () => ({ kind: "ok", value: 7, diagnostics: [] }), compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) },\n  true,\n);', 2345, 5, 3],
    ["closed-run-outcomes", 'const wrong: Port.RunResult<number> = { kind: "pending" }; void wrong;', 2322, 3, 41],
    ["removed-depth-outcome", 'const wrong: Port.RunResult<number> = { kind: "depth-exceeded", chain: [] }; void wrong;', 2322, 3, 41],
    ["undeclared-runtime-port", 'import { lookup } from "./query/index.js"; void lookup;', 2305, 3, 10],
    ["private-entry", 'import { leastFact } from "./query/memo.js"; void leastFact;', 2307, 3, 27],
  ];
  const located = (name, body, code, token, shift) => cases.push([name, body, code, 3, body.indexOf(token) + shift]);
  located("removed-depth-limit", 'const wrong: Port.QueryLimits = { maximumRecords: 2, maxActiveDepth: 2 }; void wrong;', 2353, "maxActiveDepth", 1);
  located("removed-cycle-policy", 'const wrong: Port.Query<null, null, number, null, null> = { name: "removed", compute: () => ({ kind: "ok", value: 7, diagnostics: [] }), cycleOutcome: () => ({ kind: "ok", value: 0, diagnostics: [] }), cycle: "invariant" }; void wrong;', 2353, 'cycle: "invariant"', 1);
  located("missing-cycle-outcome", 'const wrong: Port.Query<null, null, number, null, null> = { name: "plain", compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) }; void wrong;', 2741, "wrong", 1);
  located("missing-classifier", 'void createDatabase(null, { maximumRecords: 2 });', 2554, "createDatabase", 1);
  located("missing-trace-choice", 'void createDatabase(null, { maximumRecords: 2 }, () => null);', 2554, "createDatabase", 1);
  located("wrong-trace-choice", 'void createDatabase(null, { maximumRecords: 2 }, () => null, "on");', 2345, '"on"', 1);
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
    writeFileSync(resolve(stage, file), `import { createDatabase } from "./query/index.js"; import type * as Port from "./query/contract.js";\nconst database = createDatabase(null, { maximumRecords: 2 }, () => null, "off"); void database; const limits: Port.QueryLimits = { maximumRecords: 2 }; void limits;\n${body}\n`);
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
  const stops = { name: "stops", cycleOutcome: noCycle, compute: () => {
    computed += 1;
    return { kind: "abandoned", diagnostics: [refusal], earned: [found] };
  } };
  const parent = { name: "parent", cycleOutcome: noCycle,
    compute: context => context.get(stops, null, { witness: null, earned: [above] }, value => ({ kind: "ok", value, diagnostics: [] })) };
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

function measure(expected, scenario, classify = () => "verdict") {
  const database = product.createDatabase(null, { maximumRecords: expected + 3 }, classify, "recorded");
  const spare = { name: "zz-spare", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) };
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
  const resume = value => ({ kind: "ok", value, diagnostics: [] });
  const a = { name: "A", cycleOutcome: () => ({ kind: "refused", diagnostics: [refusal] }), compute: context => context.get(b, null, { witness: "A", earned: [earnedA] }, resume) };
  const b = { name: "B", cycleOutcome: () => ({ kind: "ok", value: "error", diagnostics: [] }), compute: context => context.get(a, null, { witness: "B", earned: [] }, resume) };
  const r = { name: "R", cycleOutcome: noCycle, compute: context => context.get(a, null, { witness: "R", earned: [earnedR] }, resume) };
  const under = measure(4 + 4 + 4 + 4 + 1, database => { assert.deepEqual(database.run(r, null), { kind: "refused", diagnostics: [refusal] }); });
  assert.equal(under.remaining, 3, "spare 4; R three events and its kept list; A and B four each; the closing request one");
  assert.deepEqual(completionsOf(under.database).slice(1), ["A:cycle-refused", "B:cycle-ok", "R:abandoned"]);
  assert.deepEqual(under.database.diagnostics(), [earnedA, earnedR, refusal]);
  const c = { name: "C", cycleOutcome: () => ({ kind: "ok", value: 1, diagnostics: [] }), compute: context => context.get(d, null, none, resume) };
  const d = { name: "D", cycleOutcome: () => ({ kind: "ok", value: 2, diagnostics: [] }), compute: context => context.get(c, null, none, resume) };
  const root = measure(4 + 4 + 4 + 1, database => { assert.deepEqual(database.run(c, null), { kind: "completed", value: 1, diagnostics: [] }); });
  assert.equal(root.remaining, 3);
});

test("R1-c: exhaustion at the request that would close a cycle abandons every active computation; nothing is memoised and what was earned is kept", () => {
  const earnedA = diagnostic(1, "a.ts", "earned by A");
  const earnedR = diagnostic(2, "r.ts", "earned by the requester");
  const resume = value => ({ kind: "ok", value, diagnostics: [] });
  const a = { name: "A", cycleOutcome: noCycle, compute: context => context.get(b, null, { witness: "A", earned: [earnedA] }, resume) };
  const b = { name: "B", cycleOutcome: noCycle, compute: context => context.get(c, null, none, resume) };
  const c = { name: "C", cycleOutcome: noCycle, compute: context => context.get(a, null, none, resume) };
  const r = { name: "R", cycleOutcome: noCycle, compute: context => context.get(a, null, { witness: "R", earned: [earnedR] }, resume) };
  const spare = { name: "zz-spare", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) };
  const database = product.createDatabase(null, { maximumRecords: 4 + 16 }, noCycle, "recorded");
  assert.equal(database.run(spare, null).kind, "completed");
  assert.deepEqual(database.run(r, null), { kind: "exhausted", maximumRecords: 20, at: fact("A", null, "N") });
  assert.deepEqual(completionsOf(database).slice(1), ["C:abandoned", "B:abandoned", "A:abandoned", "R:abandoned"]);
  assert.deepEqual(database.stats().filter(row => row.name !== "zz-spare"), ["A", "B", "C", "R"].map(name => ({ name, computed: 1, hits: 0 })));
  assert.deepEqual(database.diagnostics(), [earnedA, earnedR]);
  let warm = 0;
  while (warm <= 50 && database.run(spare, null).kind === "completed") warm += 1;
  assert.equal(warm, 2, "18 of 20 retained: R and A three events and a kept list each, B and C three events each");
});

test("R1-d: two cycles in one strongly connected group are classified alike and give the same outcomes for every first demand", () => {
  const names = ["A", "B", "C", "D", "W"];
  const results = [];
  for (const order of [["A", "C", "W", "B", "D"], ["C", "A", "W", "D", "B"], ["W", "D", "B", "A", "C"], ["D", "W", "A", "B", "C"], ["B", "D", "W", "C", "A"]]) {
    const classified = [];
    const rows = {};
    const row = (name, sequence) => ({ name, cycleOutcome: (key, verdict) => ({ kind: "ok", value: `${name}:member of ${verdict}`, diagnostics: [] }),
      compute: context => {
        const answers = [];
        const next = index => index === sequence.length ? { kind: "ok", value: `${name}(${answers.join(",")})`, diagnostics: [] }
          : context.get(rows[sequence[index]], null, { witness: `${name}->${sequence[index]}`, earned: [] }, value => { answers.push(value); return next(index + 1); });
        return next(0);
      } });
    Object.assign(rows, { A: row("A", ["B"]), B: row("B", ["A", "C"]), C: row("C", ["D"]), D: row("D", ["C", "A"]), W: row("W", ["A", "C"]) });
    const database = product.createDatabase(null, unbounded, cycle => {
      const text = cycle.members.map(member => member.fact.query).join("+");
      classified.push(text);
      return text;
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
  const p = { name: "P", cycleOutcome: noCycle, compute: () => ({ kind: "ok", value: 1, diagnostics: [] }) };
  const q = { name: "Q", cycleOutcome: noCycle, compute: () => ({ kind: "refused", diagnostics: [refusesQ] }) };
  const x = { name: "X", cycleOutcome: noCycle, compute: context => context.get(p, null, none,
    () => context.get(q, null, { witness: null, earned: [earned] }, value => ({ kind: "ok", value, diagnostics: [] }))) };
  const bounded = product.createDatabase(null, { maximumRecords: 16 }, noCycle, "recorded");
  assert.deepEqual(bounded.run(x, null), { kind: "refused", diagnostics: [refusesQ] });
  assert.deepEqual(bounded.diagnostics(), [refusesQ, earned]);
  assert.deepEqual(bounded.run(x, null), { kind: "exhausted", maximumRecords: 16, at: fact("P", null, "N") },
    "the second run of X is admitted cold and has no record for its warm request of P");
  assert.deepEqual(bounded.diagnostics(), [refusesQ, earned], "what the first abandonment kept is still reported");
  let mode = "first";
  const y = { name: "Y", cycleOutcome: noCycle, compute: context => mode === "first"
    ? context.get(q, null, { witness: null, earned: [earned] }, value => ({ kind: "ok", value, diagnostics: [] }))
    : context.get(p, null, { witness: null, earned: [] }, () => context.get(q, null,
      { witness: null, earned: mode === "nothing" ? [] : [earned, later] }, value => ({ kind: "ok", value, diagnostics: [] }))) };
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

test("with the trace off no event exists and a request allocates no record: a fact costs one record, a warm or closing request none", () => {
  const original = Error("defect");
  const leaf = { name: "leaf", cycleOutcome: noCycle, compute: (_, key) => ({ kind: "ok", value: key, diagnostics: [] }) };
  const parent = { name: "parent", cycleOutcome: noCycle,
    compute: context => context.get(leaf, 1, none, value => context.get(leaf, 1, none, again => ({ kind: "ok", value: value + again, diagnostics: [] }))) };
  const self = { name: "self", cycleOutcome: () => ({ kind: "ok", value: 0, diagnostics: [] }),
    compute: context => context.get(self, null, none, value => ({ kind: "ok", value, diagnostics: [] })) };
  let throws = true;
  const thrower = { name: "thrower", cycleOutcome: noCycle, compute: () => {
    if (throws) throw original;
    return { kind: "ok", value: 7, diagnostics: [] };
  } };
  const none0 = product.createDatabase(null, { maximumRecords: 0 }, noCycle, "off");
  assert.deepEqual(none0.run(leaf, 1), { kind: "exhausted", maximumRecords: 0, at: fact("leaf", 1, "F1:") });
  const one = product.createDatabase(null, { maximumRecords: 1 }, noCycle, "off");
  for (let request = 0; request < 1000; request += 1) assert.deepEqual(one.run(leaf, 1), { kind: "completed", value: 1, diagnostics: [] });
  assert.deepEqual(one.run(leaf, 2), { kind: "exhausted", maximumRecords: 1, at: fact("leaf", 2, "F2:") });
  assert.deepEqual(one.trace(), []);
  assert.deepEqual(one.stats(), [{ name: "leaf", computed: 1, hits: 999 }]);
  const two = product.createDatabase(null, { maximumRecords: 2 }, noCycle, "off");
  assert.deepEqual(two.run(parent, null), { kind: "completed", value: 2, diagnostics: [] });
  assert.deepEqual(two.run(leaf, 2), { kind: "exhausted", maximumRecords: 2, at: fact("leaf", 2, "F2:") });
  const closing = product.createDatabase(null, { maximumRecords: 1 }, () => null, "off");
  assert.deepEqual(closing.run(self, null), { kind: "completed", value: 0, diagnostics: [] });
  assert.deepEqual(closing.trace(), []);
  const released = product.createDatabase(null, { maximumRecords: 1 }, noCycle, "off");
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
