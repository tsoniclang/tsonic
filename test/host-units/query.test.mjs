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
  return Object.freeze({ code: Object.freeze({ kind: "checker", number, rendered: `TS${number}` }),
    severity: "error", site: Object.freeze({ kind: "file", path }), source: "query-case", evidence: Object.freeze([]),
    message, arguments: Object.freeze([]), related: Object.freeze([]), fix: null });
}

function evaluate(input) {
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
  const queries = new Map(input.queries.map(entry => [entry.name, {
    expected: entry.value,
    query: { name: entry.name, cycle: "invariant", compute: () => ({ kind: "ok", value: entry.value, diagnostics: [] }) },
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
  const inputs = Object.freeze({ root: "analysis", count: 0 });
  const database = product.createDatabase(inputs, { maxActiveDepth: 0 });
  assert.equal(database.inputs, inputs);
  const statistics = database.stats();
  const diagnostics = database.diagnostics();
  assert.deepEqual(statistics, []);
  assert.deepEqual(diagnostics, []);
  assert.equal(Object.isFrozen(statistics), true);
  assert.equal(Object.isFrozen(diagnostics), true);
  assert.deepEqual(database.stats(), []);
  assert.deepEqual(database.diagnostics(), []);
});

test("invalid depth maxima are caller defects, not a refusal, rounding or a hidden default", () => {
  for (const maxActiveDepth of [-1, -0.5, 0.5, NaN, Infinity, -Infinity]) {
    assert.throws(() => product.createDatabase(null, { maxActiveDepth }), {
      name: "TypeError", message: "query: maxActiveDepth must be a finite nonnegative integer",
    });
  }
  for (const maxActiveDepth of [0, -0, 1, 2, 9007199254740992, 1e21]) {
    const database = product.createDatabase(null, { maxActiveDepth });
    assert.equal(database.inputs, null);
    assert.deepEqual(database.stats(), []);
    assert.deepEqual(database.diagnostics(), []);
  }
});

test("construction retains arbitrary actual Inputs rather than encoding, copying or defaulting them", () => {
  const callable = () => "input";
  for (const inputs of [undefined, null, false, 0, -0, 1n, "", callable, Object.freeze({ value: false })]) {
    const database = product.createDatabase(inputs, { maxActiveDepth: 1 });
    assert.equal(database.inputs, inputs);
    assert.deepEqual(database.stats(), []);
    assert.deepEqual(database.diagnostics(), []);
  }
});

test("one actual query definition receives each database's own Inputs and independent memo", () => {
  let received;
  const query = { name: "input", cycle: "invariant", compute: (database, key) => {
    received = database;
    return { kind: "ok", value: `${database.inputs.prefix}:${key}`, diagnostics: [] };
  } };
  const left = product.createDatabase({ prefix: "left" }, { maxActiveDepth: 1 });
  const right = product.createDatabase({ prefix: "right" }, { maxActiveDepth: 1 });
  for (let request = 0; request < 2; request += 1) {
    assert.deepEqual(left.run(query, "key"), { kind: "completed", value: "left:key", diagnostics: [] });
    if (request === 0) assert.equal(received, left);
    assert.deepEqual(right.run(query, "key"), { kind: "completed", value: "right:key", diagnostics: [] });
    assert.equal(received, right);
  }
  assert.deepEqual(left.stats(), [{ name: "input", computed: 1, hits: 1 }]);
  assert.deepEqual(right.stats(), [{ name: "input", computed: 1, hits: 1 }]);
  assert.deepEqual(left.diagnostics(), []);
  assert.deepEqual(right.diagnostics(), []);
});

test("completed wrappers memoize undefined, functions, bigint and every scalar without a missing-value fallback", () => {
  const callable = () => 7;
  const values = [undefined, null, false, true, 0, -0, NaN, Infinity, -Infinity, 9007199254740995n,
    "", Object.freeze({ value: 1 }), Object.freeze([]), callable];
  const query = { name: "values", cycle: "invariant", compute: (_, key) => ({ kind: "ok", value: values[key], diagnostics: [] }) };
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
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
  const query = { name: "scalars", cycle: "invariant", compute: () => ({ kind: "ok", value: ++computed, diagnostics: [] }) };
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
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
  const query = { name: "ok", cycle: "invariant", compute: () => ({ kind: "ok", value: 7, diagnostics: supplied }) };
  const refused = { name: "refused", cycle: "invariant", compute: () => ({ kind: "refused", diagnostics: [first, second] }) };
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
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
  assert.equal(Object.isFrozen(original), true);
  assert.equal(Object.isFrozen(original.diagnostics), true);
  assert.equal(Object.isFrozen(before), true);
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
      const child = { name: "child", cycle: "invariant",
        compute: () => ({ kind: "ok", value: 7, diagnostics: vector.supplied }) };
      const parent = { name: "parent", cycle: "invariant", compute: database => {
        const value = database.get(child, null); continuation += 1;
        return { kind: "ok", value: value + 1, diagnostics: [] };
      } };
      const database = product.createDatabase(null, { maxActiveDepth: 2 });
      const selected = route === "root" ? child : parent;
      const expected = route === "root"
        ? { kind: "completed", value: 7, diagnostics: vector.expected }
        : { kind: "completed", value: 8, diagnostics: [] };
      const cold = database.run(selected, null);
      assert.deepEqual(cold, expected);
      const retained = route === "root" ? cold : database.run(child, null);
      assert.deepEqual(retained, { kind: "completed", value: 7, diagnostics: vector.expected });
      assert.equal(Object.isFrozen(retained) && Object.isFrozen(retained.diagnostics), true);
      assert.notEqual(retained.diagnostics, vector.supplied);
      assert.deepEqual(Object.keys(retained.diagnostics), Object.keys(vector.expected));
      vector.expected.forEach((entry, index) => { assert.equal(retained.diagnostics[index], entry); });
      assert.deepEqual(vector.supplied, vector.expected);
      const previous = database.diagnostics();
      assert.deepEqual(previous, vector.aggregate);
      assert.equal(Object.isFrozen(previous), true);
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
      const child = { name: "child", cycle: "invariant",
        compute: () => ({ kind: "refused", diagnostics: vector.supplied }) };
      const parent = { name: "parent", cycle: "invariant", compute: database => {
        const value = database.get(child, null); continuation += 1;
        return { kind: "ok", value, diagnostics: [] };
      } };
      const database = product.createDatabase(null, { maxActiveDepth: 2 });
      const selected = route === "root" ? child : parent;
      const cold = database.run(selected, null);
      assert.deepEqual(cold, { kind: "refused", diagnostics: vector.expected });
      assert.equal(Object.isFrozen(cold) && Object.isFrozen(cold.diagnostics), true);
      assert.notEqual(cold.diagnostics, vector.supplied);
      assert.deepEqual(Object.keys(cold.diagnostics), Object.keys(vector.expected));
      vector.expected.forEach((entry, index) => { assert.equal(cold.diagnostics[index], entry); });
      assert.deepEqual(vector.supplied, vector.expected);
      const previous = database.diagnostics();
      assert.deepEqual(previous, vector.aggregate);
      assert.equal(Object.isFrozen(previous), true);
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

test("recovery sparse Results publish only actual diagnostics and preserve carried refusal snapshots on retry", () => {
  const first = diagnostic(1, "a.ts", "first");
  const second = diagnostic(2, "b.ts", "second");
  const replacement = diagnostic(3, "c.ts", "replacement");
  for (const vector of [
    { kind: "ok", supplied: [], expected: [], aggregate: [] },
    { kind: "ok", supplied: new Array(1), expected: new Array(1), aggregate: [] },
    { kind: "ok", supplied: [second, first], expected: [second, first], aggregate: [first, second] },
    { kind: "ok", supplied: [, second], expected: [, second], aggregate: [second] },
    { kind: "ok", supplied: [second, , first, ,], expected: [second, , first, ,], aggregate: [first, second] },
    { kind: "refused", supplied: [second], expected: [second], aggregate: [second] },
    { kind: "refused", supplied: [second, ,], expected: [second, ,], aggregate: [second] },
    { kind: "refused", supplied: [second, , first, ,], expected: [second, , first, ,], aggregate: [first, second] },
  ]) {
    let recoveryCalls = 0;
    let continuation = 0;
    let finish = false;
    const query = { name: "cycle", cycle: { recover: (key, chain) => {
      recoveryCalls += 1;
      assert.equal(key, null);
      assert.deepEqual(chain, [{ query: "cycle", encodedKey: "N" }, { query: "cycle", encodedKey: "N" }]);
      assert.equal(Object.isFrozen(chain) && chain.every(Object.isFrozen), true);
      if (finish) return { kind: "ok", value: 7, diagnostics: [] };
      return vector.kind === "ok" ? { kind: "ok", value: 7, diagnostics: vector.supplied }
        : { kind: "refused", diagnostics: vector.supplied };
    } }, compute: database => {
      const value = database.get(query, null); continuation += 1;
      return { kind: "ok", value: value + 1, diagnostics: [] };
    } };
    const database = product.createDatabase(null, { maxActiveDepth: 1 });
    const cold = database.run(query, null);
    assert.deepEqual(cold, vector.kind === "ok"
      ? { kind: "completed", value: 8, diagnostics: [] } : { kind: "refused", diagnostics: vector.expected });
    assert.equal(Object.isFrozen(cold) && Object.isFrozen(cold.diagnostics), true);
    if (vector.kind === "refused") {
      assert.notEqual(cold.diagnostics, vector.supplied);
      assert.deepEqual(Object.keys(cold.diagnostics), Object.keys(vector.expected));
      vector.expected.forEach((entry, index) => { assert.equal(cold.diagnostics[index], entry); });
    }
    assert.deepEqual(vector.supplied, vector.expected);
    const previous = database.diagnostics();
    assert.deepEqual(previous, vector.aggregate);
    assert.equal(Object.isFrozen(previous), true);
    vector.aggregate.forEach((entry, index) => { assert.equal(previous[index], entry); });
    vector.supplied.length = 0;
    vector.supplied.push(replacement);
    if (vector.kind === "ok") {
      assert.deepEqual(database.run(query, null), { kind: "completed", value: 8, diagnostics: [] });
      assert.deepEqual(database.stats(), [{ name: "cycle", computed: 1, hits: 1 }]);
      assert.equal(recoveryCalls, 1);
      assert.equal(continuation, 1);
      assert.deepEqual(database.diagnostics(), vector.aggregate);
    } else {
      const retry = database.run(query, null);
      assert.deepEqual(retry, { kind: "refused", diagnostics: [replacement] });
      assert.equal(retry.diagnostics[0], replacement);
      assert.equal(Object.isFrozen(retry) && Object.isFrozen(retry.diagnostics), true);
      assert.deepEqual(cold, { kind: "refused", diagnostics: vector.expected });
      assert.deepEqual(database.stats(), [{ name: "cycle", computed: 2, hits: 0 }]);
      assert.equal(recoveryCalls, 2);
      assert.equal(continuation, 0);
      assert.deepEqual(database.diagnostics(), vector.aggregate.concat(replacement));
      finish = true;
      assert.deepEqual(database.run(query, null), { kind: "completed", value: 8, diagnostics: [] });
      assert.deepEqual(database.run(query, null), { kind: "completed", value: 8, diagnostics: [] });
      assert.deepEqual(database.stats(), [{ name: "cycle", computed: 3, hits: 1 }]);
      assert.equal(recoveryCalls, 3);
      assert.equal(continuation, 1);
      assert.deepEqual(database.diagnostics(), vector.aggregate.concat(replacement));
    }
    assert.deepEqual(previous, vector.aggregate);
  }
});

test("A to B to C computes once, records actual hits and publishes each completed vector once", () => {
  const rootDiagnostic = diagnostic(1, "a.ts", "root");
  const middleDiagnostic = diagnostic(2, "b.ts", "middle");
  const leafDiagnostic = diagnostic(3, "c.ts", "leaf");
  const leaf = { name: "C", cycle: "invariant", compute: () => ({ kind: "ok", value: 2, diagnostics: [leafDiagnostic] }) };
  const middle = { name: "B", cycle: "invariant", compute: database => ({
    kind: "ok", value: database.get(leaf, null) + 1, diagnostics: [middleDiagnostic],
  }) };
  const root = { name: "A", cycle: "invariant", compute: database => ({
    kind: "ok", value: database.get(middle, null) + database.get(middle, null) + database.get(leaf, null),
    diagnostics: [rootDiagnostic],
  }) };
  const database = product.createDatabase(null, { maxActiveDepth: 3 });
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
  assert.equal(Object.isFrozen(previous) && previous.every(Object.isFrozen), true);
  assert.deepEqual(database.diagnostics(), [rootDiagnostic, middleDiagnostic, leafDiagnostic]);
});

test("depth zero, below, at and past follow the actual fresh-frame law before the next compute", () => {
  const counts = { root: 0, middle: 0, leaf: 0 };
  const leaf = { name: "leaf", cycle: "invariant", compute: () => {
    counts.leaf += 1; return { kind: "ok", value: 7, diagnostics: [] };
  } };
  const middle = { name: "middle", cycle: "invariant", compute: database => {
    counts.middle += 1; return { kind: "ok", value: database.get(leaf, null), diagnostics: [] };
  } };
  const root = { name: "root", cycle: "invariant", compute: database => {
    counts.root += 1; return { kind: "ok", value: database.get(middle, null), diagnostics: [] };
  } };
  const chain = [{ query: "root", encodedKey: "N" }, { query: "middle", encodedKey: "N" }, { query: "leaf", encodedKey: "N" }];
  for (const [maxActiveDepth, expected, expectedCounts, statistics] of [
    [0, { kind: "depth-exceeded", chain: chain.slice(0, 1) }, { root: 0, middle: 0, leaf: 0 },
      [{ name: "root", computed: 0, hits: 0 }]],
    [1, { kind: "depth-exceeded", chain: chain.slice(0, 2) }, { root: 1, middle: 0, leaf: 0 },
      [{ name: "middle", computed: 0, hits: 0 }, { name: "root", computed: 1, hits: 0 }]],
    [2, { kind: "depth-exceeded", chain }, { root: 2, middle: 1, leaf: 0 },
      [{ name: "leaf", computed: 0, hits: 0 }, { name: "middle", computed: 1, hits: 0 }, { name: "root", computed: 1, hits: 0 }]],
    [3, { kind: "completed", value: 7, diagnostics: [] }, { root: 3, middle: 2, leaf: 1 },
      [{ name: "leaf", computed: 1, hits: 0 }, { name: "middle", computed: 1, hits: 0 }, { name: "root", computed: 1, hits: 0 }]],
    [4, { kind: "completed", value: 7, diagnostics: [] }, { root: 4, middle: 3, leaf: 2 },
      [{ name: "leaf", computed: 1, hits: 0 }, { name: "middle", computed: 1, hits: 0 }, { name: "root", computed: 1, hits: 0 }]],
  ]) {
    const database = product.createDatabase(null, { maxActiveDepth });
    assert.deepEqual(database.run(root, null), expected);
    assert.deepEqual(counts, expectedCounts);
    assert.deepEqual(database.stats(), statistics);
    assert.deepEqual(database.diagnostics(), []);
  }
});

test("depth exhaustion two levels down abandons both frames; a later same-database root recomputes cleanly", () => {
  let forbidden = 0;
  const leaf = { name: "C", cycle: "invariant", compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) };
  const middle = { name: "B", cycle: "invariant", compute: database => {
    const value = database.get(leaf, null); forbidden += 1;
    return { kind: "ok", value: value + 1, diagnostics: [] };
  } };
  const root = { name: "A", cycle: "invariant", compute: database => {
    const value = database.get(middle, null); forbidden += 1;
    return { kind: "ok", value: value + 1, diagnostics: [] };
  } };
  const database = product.createDatabase(null, { maxActiveDepth: 2 });
  const expected = { kind: "depth-exceeded", chain: [
    { query: "A", encodedKey: "N" }, { query: "B", encodedKey: "N" }, { query: "C", encodedKey: "N" },
  ] };
  for (let request = 1; request <= 2; request += 1) {
    const result = database.run(root, null);
    assert.deepEqual(result, expected);
    assert.equal(Object.isFrozen(result) && Object.isFrozen(result.chain) && result.chain.every(Object.isFrozen), true);
    assert.equal(forbidden, 0);
    assert.deepEqual(database.stats(), [{ name: "A", computed: request, hits: 0 }, { name: "B", computed: request, hits: 0 },
      { name: "C", computed: 0, hits: 0 }]);
    assert.deepEqual(database.diagnostics(), []);
  }
  assert.deepEqual(database.run(leaf, null), { kind: "completed", value: 7, diagnostics: [] });
  assert.deepEqual(database.run(root, null), { kind: "completed", value: 9, diagnostics: [] });
  assert.deepEqual(database.run(root, null), { kind: "completed", value: 9, diagnostics: [] });
  assert.equal(forbidden, 2);
  assert.deepEqual(database.stats(), [{ name: "A", computed: 3, hits: 1 }, { name: "B", computed: 3, hits: 0 },
    { name: "C", computed: 1, hits: 1 }]);
});

test("a refused dependency abandons its caller, preserves the complete vector and never fabricates a value", () => {
  const first = diagnostic(1, "a.ts", "refusal one");
  const second = diagnostic(2, "b.ts", "refusal two");
  let afterDependency = 0;
  const child = { name: "child", cycle: "invariant", compute: () => ({ kind: "refused", diagnostics: [first, second] }) };
  const parent = { name: "parent", cycle: "invariant", compute: database => {
    const value = database.get(child, null); afterDependency += 1;
    return { kind: "ok", value, diagnostics: [] };
  } };
  const database = product.createDatabase(null, { maxActiveDepth: 2 });
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
  const query = { name: "countdown", cycle: "invariant", compute: (database, key) => ({
    kind: "ok", value: key === 0 ? 0 : database.get(query, key - 1) + 1, diagnostics: [],
  }) };
  const database = product.createDatabase(null, { maxActiveDepth: 4 });
  assert.deepEqual(database.run(query, 3), { kind: "completed", value: 3, diagnostics: [] });
  assert.deepEqual(database.run(query, 2), { kind: "completed", value: 2, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "countdown", computed: 4, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("cycles use full content keys and the complete chain, not object identity or a truncated suffix", () => {
  let cycle = true;
  const alternate = { a: 1, b: 2 };
  const first = { name: "A", cycle: "invariant", compute: database => ({
    kind: "ok", value: database.get(second, alternate) + 1, diagnostics: [],
  }) };
  const second = { name: "B", cycle: "invariant", compute: database => ({
    kind: "ok", value: cycle ? database.get(first, alternate) : 7, diagnostics: [],
  }) };
  const database = product.createDatabase(null, { maxActiveDepth: 3 });
  const key = "O2:S1:aF1:S1:bF2:";
  const chain = [{ query: "A", encodedKey: key }, { query: "B", encodedKey: key }, { query: "A", encodedKey: key }];
  assert.throws(() => database.run(first, { b: 2, a: 1 }), error => {
    assert.equal(error instanceof Error, true);
    assert.deepEqual(error.cause, {
      pass: "pipeline", query: { name: "A", encodedKey: key }, origin: null, message: `Query cycle ${JSON.stringify(chain)}`,
    });
    return true;
  });
  assert.deepEqual(database.stats(), [{ name: "A", computed: 1, hits: 0 }, { name: "B", computed: 1, hits: 0 }]);
  cycle = false;
  assert.deepEqual(database.run(first, alternate), { kind: "completed", value: 8, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "A", computed: 2, hits: 0 }, { name: "B", computed: 2, hits: 0 }]);
});

test("declared recovery receives the original attempted key and full chain without memoizing a provisional value", () => {
  const recovered = diagnostic(1, "cycle.ts", "declared recovery");
  const attempted = { a: 1, b: 2 };
  let recoveryKey;
  let recoveryChain;
  let recoverThis = "not-called";
  const first = { name: "A", cycle: { recover: function (key, chain) {
    recoverThis = this; recoveryKey = key; recoveryChain = chain;
    return { kind: "ok", value: 40, diagnostics: [recovered] };
  } }, compute: database => ({ kind: "ok", value: database.get(second, attempted) + 1, diagnostics: [] }) };
  const second = { name: "B", cycle: "invariant", compute: database => ({
    kind: "ok", value: database.get(first, attempted) + 2, diagnostics: [],
  }) };
  const database = product.createDatabase(null, { maxActiveDepth: 2 });
  assert.deepEqual(database.run(first, { b: 2, a: 1 }), { kind: "completed", value: 43, diagnostics: [] });
  assert.equal(recoveryKey, attempted);
  assert.equal(recoverThis, undefined);
  assert.deepEqual(recoveryChain, [{ query: "A", encodedKey: "O2:S1:aF1:S1:bF2:" },
    { query: "B", encodedKey: "O2:S1:aF1:S1:bF2:" }, { query: "A", encodedKey: "O2:S1:aF1:S1:bF2:" }]);
  assert.equal(Object.isFrozen(recoveryChain) && recoveryChain.every(Object.isFrozen), true);
  assert.deepEqual(database.diagnostics(), [recovered]);
  assert.deepEqual(database.run(first, attempted), { kind: "completed", value: 43, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "A", computed: 1, hits: 1 }, { name: "B", computed: 1, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), [recovered]);
});

test("a refusing recovery carries its complete vector and leaves no abandoned active memo", () => {
  const refusal = diagnostic(1, "cycle.ts", "refused recovery");
  let recover = false;
  let recoveryCalls = 0;
  let continuation = 0;
  const query = { name: "cycle", cycle: { recover: () => {
    recoveryCalls += 1;
    return recover ? { kind: "ok", value: 7, diagnostics: [] } : { kind: "refused", diagnostics: [refusal] };
  } }, compute: database => {
    const value = database.get(query, null); continuation += 1;
    return { kind: "ok", value: value + 1, diagnostics: [] };
  } };
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
  assert.deepEqual(database.run(query, null), { kind: "refused", diagnostics: [refusal] });
  assert.equal(continuation, 0);
  assert.deepEqual(database.stats(), [{ name: "cycle", computed: 1, hits: 0 }]);
  recover = true;
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 8, diagnostics: [] });
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 8, diagnostics: [] });
  assert.equal(recoveryCalls, 2);
  assert.equal(continuation, 1);
  assert.deepEqual(database.stats(), [{ name: "cycle", computed: 2, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), [refusal]);
});

test("ordinary thrown computations and thrown recovery are not cached or converted to language refusals", () => {
  const original = Error("original callback");
  const recoveredError = Error("original recovery");
  let throws = true;
  const query = { name: "throw", cycle: "invariant", compute: () => {
    if (throws) throw original;
    return { kind: "ok", value: 7, diagnostics: [] };
  } };
  let recoveryThrows = true;
  const cycle = { name: "cycle", cycle: { recover: () => {
    if (recoveryThrows) throw recoveredError;
    return { kind: "ok", value: 9, diagnostics: [] };
  } }, compute: database => ({ kind: "ok", value: database.get(cycle, null), diagnostics: [] }) };
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
  for (let request = 0; request < 2; request += 1) assert.throws(() => database.run(query, null), error => error === original);
  assert.throws(() => database.run(cycle, null), error => error === recoveredError);
  throws = false; recoveryThrows = false;
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 7, diagnostics: [] });
  assert.deepEqual(database.run(cycle, null), { kind: "completed", value: 9, diagnostics: [] });
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 7, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "cycle", computed: 2, hits: 0 }, { name: "throw", computed: 3, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("only the actual engine-private Error identity is recognised, never a copied message or public tag", () => {
  const fake = Object.assign(Error("query: abandoned computation"), { kind: "refused", diagnostics: [diagnostic(1, "a.ts", "fake")] });
  const query = { name: "forgery", cycle: "invariant", compute: () => { throw fake; } };
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
  for (let request = 0; request < 2; request += 1) assert.throws(() => database.run(query, null), error => error === fake);
  assert.deepEqual(database.stats(), [{ name: "forgery", computed: 2, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("an ordinary Error thrown during unwinding is not mistaken for a pending expected-outcome signal", () => {
  const original = Error("ordinary finally failure");
  const refusal = diagnostic(1, "a.ts", "actual refusal");
  const child = { name: "child", cycle: "invariant", compute: () => ({ kind: "refused", diagnostics: [refusal] }) };
  let override = true;
  const parent = { name: "parent", cycle: "invariant", compute: database => {
    try { return { kind: "ok", value: database.get(child, null), diagnostics: [] }; }
    finally { if (override) throw original; }
  } };
  const database = product.createDatabase(null, { maxActiveDepth: 2 });
  assert.throws(() => database.run(parent, null), error => error === original);
  override = false;
  assert.deepEqual(database.run(parent, null), { kind: "refused", diagnostics: [refusal] });
  assert.deepEqual(database.stats(), [{ name: "child", computed: 1, hits: 1 }, { name: "parent", computed: 2, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), [refusal]);
});

test("throwing after a completed sibling does not discard its memo, diagnostics or exact future hit", () => {
  const childDiagnostic = diagnostic(1, "a.ts", "completed sibling");
  const original = Error("failed parent");
  let throws = true;
  const child = { name: "child", cycle: "invariant", compute: () => ({ kind: "ok", value: 7, diagnostics: [childDiagnostic] }) };
  const parent = { name: "parent", cycle: "invariant", compute: database => {
    const value = database.get(child, null);
    if (throws) throw original;
    return { kind: "ok", value: value + 1, diagnostics: [] };
  } };
  const database = product.createDatabase(null, { maxActiveDepth: 2 });
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
  const query = { name: "deep", cycle: "invariant", compute: () => {
    calls += 1; return { kind: "ok", value: 7, diagnostics: [] };
  } };
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
  assert.deepEqual(database.run(query, left), { kind: "completed", value: 7, diagnostics: [] });
  assert.deepEqual(database.run(query, right), { kind: "completed", value: 7, diagnostics: [] });
  assert.equal(calls, 1);
  assert.deepEqual(database.stats(), [{ name: "deep", computed: 1, hits: 1 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("the actual ids boundary rejects a cyclic key before any memo entry or computation", () => {
  let calls = 0;
  const query = { name: "invalid-key", cycle: "invariant", compute: () => {
    calls += 1; return { kind: "ok", value: 7, diagnostics: [] };
  } };
  const cycle = [];
  cycle.push(cycle);
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
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
  const original = { name: "same", cycle: "invariant", compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) };
  const other = { name: "same", cycle: "invariant", compute: () => {
    wrongCalls += 1; return { kind: "ok", value: "wrong", diagnostics: [] };
  } };
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
  assert.deepEqual(database.run(original, null), { kind: "completed", value: 7, diagnostics: [] });
  for (const key of [null, "different"]) {
    assert.throws(() => database.run(other, key), error => {
      assert.equal(error instanceof Error, true);
      assert.deepEqual(error.cause, {
        pass: "pipeline", query: { name: "same", encodedKey: key === null ? "N" : "S9:different" }, origin: null,
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

test("database methods are detachable, compute has no hidden this, and the supplied depth maximum is captured", () => {
  const limits = { maxActiveDepth: 2 };
  const database = product.createDatabase(Object.freeze({ value: 7 }), limits);
  limits.maxActiveDepth = 0;
  const { run, stats, diagnostics } = database;
  let receivedThis = "not-called";
  const child = { name: "child", cycle: "invariant", compute: function (current) {
    receivedThis = this;
    return { kind: "ok", value: current.inputs.value, diagnostics: [] };
  } };
  const parent = { name: "parent", cycle: "invariant", compute: current => {
    const { get, stats: currentStats, diagnostics: currentDiagnostics } = current;
    const value = get(child, null);
    assert.deepEqual(currentStats(), [{ name: "child", computed: 1, hits: 0 }, { name: "parent", computed: 1, hits: 0 }]);
    assert.deepEqual(currentDiagnostics(), []);
    return { kind: "ok", value: value + 1, diagnostics: [] };
  } };
  assert.deepEqual(run(parent, null), { kind: "completed", value: 8, diagnostics: [] });
  assert.equal(receivedThis, undefined);
  assert.deepEqual(run(parent, null), { kind: "completed", value: 8, diagnostics: [] });
  assert.deepEqual(stats(), [{ name: "child", computed: 1, hits: 0 }, { name: "parent", computed: 1, hits: 1 }]);
  assert.deepEqual(diagnostics(), []);
  assert.equal(Object.isFrozen(database), true);
});

test("a nested explicit run owns its boundary and leaves the calling computation's frame intact", () => {
  const leaf = { name: "leaf", cycle: "invariant", compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) };
  const inner = { name: "inner", cycle: "invariant", compute: current => ({
    kind: "ok", value: current.get(leaf, null) + 1, diagnostics: [],
  }) };
  const outer = { name: "outer", cycle: "invariant", compute: current => {
    const result = current.run(inner, null);
    assert.deepEqual(result, { kind: "completed", value: 8, diagnostics: [] });
    return { kind: "ok", value: result.value + current.get(leaf, null), diagnostics: [] };
  } };
  const database = product.createDatabase(null, { maxActiveDepth: 3 });
  assert.deepEqual(database.run(outer, null), { kind: "completed", value: 15, diagnostics: [] });
  assert.deepEqual(database.stats(), [{ name: "inner", computed: 1, hits: 0 }, { name: "leaf", computed: 1, hits: 1 },
    { name: "outer", computed: 1, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("an invariant cycle reports the whole root prefix rather than only the repeated-key suffix", () => {
  const first = { name: "A", cycle: "invariant", compute: current => ({
    kind: "ok", value: current.get(second, 2), diagnostics: [],
  }) };
  const second = { name: "B", cycle: "invariant", compute: current => ({
    kind: "ok", value: current.get(first, 1), diagnostics: [],
  }) };
  const root = { name: "root", cycle: "invariant", compute: current => ({
    kind: "ok", value: current.get(first, 1), diagnostics: [],
  }) };
  const chain = [{ query: "root", encodedKey: "N" }, { query: "A", encodedKey: "F1:" },
    { query: "B", encodedKey: "F2:" }, { query: "A", encodedKey: "F1:" }];
  const database = product.createDatabase(null, { maxActiveDepth: 3 });
  assert.throws(() => database.run(root, null), error => {
    assert.equal(error instanceof Error, true);
    assert.deepEqual(error.cause, {
      pass: "pipeline", query: { name: "A", encodedKey: "F1:" }, origin: null, message: `Query cycle ${JSON.stringify(chain)}`,
    });
    return true;
  });
  assert.deepEqual(database.stats(), [{ name: "A", computed: 1, hits: 0 }, { name: "B", computed: 1, hits: 0 },
    { name: "root", computed: 1, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), []);
});

test("statistics use total UTF-16 name ordering, independent of request order or locale", () => {
  const ordered = ["", "\u0000", "A", "\uD800", "\uD800\uDC00", "\uDBFF\uDFFF", "\uDFFF", "\uE000"];
  for (const names of [[...ordered].reverse(), [ordered[4], ordered[0], ordered[7], ordered[2],
    ordered[6], ordered[1], ordered[5], ordered[3]]]) {
    const database = product.createDatabase(null, { maxActiveDepth: 1 });
    for (const name of names) {
      const query = { name, cycle: "invariant", compute: () => ({ kind: "ok", value: name, diagnostics: [] }) };
      assert.deepEqual(database.run(query, null), { kind: "completed", value: name, diagnostics: [] });
    }
    assert.deepEqual(database.stats(), ordered.map(name => ({ name, computed: 1, hits: 0 })));
    assert.deepEqual(database.diagnostics(), []);
  }
});

test("get outside an actual computation is a caller TypeError, even for a completed memo key", () => {
  let calls = 0;
  const query = { name: "root", cycle: "invariant", compute: () => {
    calls += 1; return { kind: "ok", value: 7, diagnostics: [] };
  } };
  const database = product.createDatabase(null, { maxActiveDepth: 1 });
  const { get } = database;
  const failure = { name: "TypeError", message: "query: get requires an active computation; use run" };
  assert.throws(() => get(query, null), failure);
  assert.equal(calls, 0);
  assert.deepEqual(database.stats(), []);
  assert.deepEqual(database.diagnostics(), []);
  assert.deepEqual(database.run(query, null), { kind: "completed", value: 7, diagnostics: [] });
  assert.throws(() => get(query, null), failure);
  assert.equal(calls, 1);
  assert.deepEqual(database.stats(), [{ name: "root", computed: 1, hits: 0 }]);
  assert.deepEqual(database.diagnostics(), []);
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

test("fresh actual declarations retain construction, snapshots, readonly fields and private-entry rejection", () => {
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
import type { ActiveKey, CreateDatabase, Database, Query, QueryLimits, QueryStat, RunResult } from "./query/contract.js";
import type { Diagnostic } from "./diag/contract.js";
const create: CreateDatabase = createDatabase;
const limits: QueryLimits = { maxActiveDepth: 2 };
const database: Database<{ readonly name: string }> = create({ name: "actual" }, limits);
const inputs: { readonly name: string } = database.inputs;
const statistics: readonly QueryStat[] = database.stats();
const diagnostics: readonly Diagnostic[] = database.diagnostics();
const chain: readonly ActiveKey[] = [{ query: "actual", encodedKey: "N" }];
const refusal: Diagnostic = { code: { kind: "checker", number: 1, rendered: "TS1" }, severity: "error",
  site: { kind: "file", path: "actual.ts" }, source: null, evidence: [], message: "actual refusal",
  arguments: [], related: [], fix: null };
const query: Query<{ readonly name: string }, number, number> = {
  name: "actual",
  compute: (current, key) => ({ kind: "ok", value: current.inputs.name.length + key, diagnostics: [] }),
  cycle: { recover: (key, active) => key < 0 ? { kind: "refused", diagnostics: [refusal] }
    : { kind: "ok", value: key + active.length, diagnostics: [] } },
};
const dependent: Query<{ readonly name: string }, null, number> = {
  name: "dependent", cycle: "invariant",
  compute: current => ({ kind: "ok", value: current.get(query, 7), diagnostics: [] }),
};
function consume(result: RunResult<number>): number {
  switch (result.kind) {
    case "completed": return result.value + result.diagnostics.length;
    case "refused": return result.diagnostics[0].message.length;
    case "depth-exceeded": return result.chain.length;
  }
}
const value: number = consume(database.run(dependent, null));
consume({ kind: "completed", value: 7, diagnostics: [] });
consume({ kind: "refused", diagnostics: [refusal] });
consume({ kind: "depth-exceeded", chain });
const sparse: Diagnostic[] = new Array<Diagnostic>(1);
const sparseRefusal: [Diagnostic, ...Diagnostic[]] = [refusal];
sparseRefusal.length = 2;
const sparseQuery: Query<{ readonly name: string }, null, number> = {
  name: "sparse", cycle: { recover: () => ({ kind: "refused", diagnostics: sparseRefusal }) },
  compute: () => ({ kind: "ok", value: 7, diagnostics: sparse }),
};
const sparseRefusedQuery: Query<{ readonly name: string }, null, number> = {
  name: "sparse-refused", cycle: "invariant",
  compute: () => ({ kind: "refused", diagnostics: sparseRefusal }),
};
consume(database.run(sparseQuery, null));
consume(database.run(sparseRefusedQuery, null));
void inputs; void statistics; void diagnostics; void chain; void value;
`);
  const cases = [
    ["readonly-inputs", "database.inputs = database.inputs;", 2540, 3, 10],
    ["readonly-get-port", "database.get = database.get;", 2540, 3, 10],
    ["readonly-run-port", "database.run = database.run;", 2540, 3, 10],
    ["readonly-stats-port", "database.stats = database.stats;", 2540, 3, 10],
    ["readonly-diagnostics-port", "database.diagnostics = database.diagnostics;", 2540, 3, 10],
    ["readonly-statistics", "database.stats().push();", 2339, 3, 18],
    ["readonly-diagnostics", "database.diagnostics().push();", 2339, 3, 24],
    ["readonly-depth", "limits.maxActiveDepth = 3;", 2540, 3, 8],
    ["readonly-statistic-row", "for (const statistic of database.stats()) {\n  statistic.computed = 2;\n}", 2540, 4, 13],
    ["readonly-active-key", 'const key: Port.ActiveKey = { query: "one", encodedKey: "N" };\nkey.encodedKey = "B1";', 2540, 4, 5],
    ["readonly-completed-value", 'const result: Port.RunResult<number> = { kind: "completed", value: 7, diagnostics: [] };\nresult.value = 9;', 2540, 4, 8],
    ["missing-depth", 'const wrong: Port.QueryLimits = {}; void wrong;', 2741, 3, 7],
    ["wrong-depth", 'const wrong: Port.QueryLimits = { maxActiveDepth: "2" }; void wrong;', 2322, 3, 35],
    ["wrong-query-key", 'database.run<null, number>(\n  { name: "typed", cycle: "invariant", compute: () => ({ kind: "ok", value: 7, diagnostics: [] }) },\n  true,\n);', 2345, 5, 3],
    ["closed-run-outcomes", 'const wrong: Port.RunResult<number> = { kind: "pending" }; void wrong;', 2322, 3, 41],
    ["undeclared-runtime-port", 'import { lookup } from "./query/index.js"; void lookup;', 2305, 3, 10],
    ["private-entry", 'import { snapshotChain } from "./query/memo.js"; void snapshotChain;', 2307, 3, 31],
  ];
  const files = [positive];
  const expected = [];
  for (const [name, body, code, line, column] of cases) {
    const file = `${name}.mts`;
    writeFileSync(resolve(stage, file), `import { createDatabase } from "./query/index.js"; import type * as Port from "./query/contract.js";\nconst database = createDatabase(null, { maxActiveDepth: 2 }); void database; const limits: Port.QueryLimits = { maxActiveDepth: 2 }; void limits;\n${body}\n`);
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
