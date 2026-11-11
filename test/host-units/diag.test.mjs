import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { Session } from "node:inspector";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { after, before } from "node:test";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";
import { runCase } from "../host-cases/case.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const sourceDirectory = "packages/host/src/diag";
const emittedDirectory = resolve(repository, "packages/host/dist/diag");
const runtimeFiles = ["index.js", "invariant.js", "order.js"].map(name => resolve(emittedDirectory, name));
const ownedSources = ["contract.ts", "index.ts", "invariant.ts", "order.ts"].map(name => `${sourceDirectory}/${name}`);
const descriptors = ["empty-order", "mixed-sites", "stable-equal-key", "lookup-present", "lookup-absent", "invariant-full", "invariant-null"];
const coverageSession = new Session();
let product;
let evidenceDirectory;

const post = (method, parameters = {}) => new Promise((done, reject) => {
  coverageSession.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined && process.env.TSONIC_TEST_ADMISSION_OWNER !== undefined,
    true, "all owner tests and compiler children require the admitted aggregate process-group guard");
  const parent = resolve(repository, ".temp/host-f-diag");
  mkdirSync(parent, { recursive: true });
  evidenceDirectory = mkdtempSync(resolve(parent, "proof-"));
  coverageSession.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import(pathToFileURL(resolve(emittedDirectory, "index.js")).href);
});

after(async () => {
  try {
    const captured = await post("Profiler.takePreciseCoverage");
    const urls = new Set(runtimeFiles.map(path => pathToFileURL(path).href));
    const result = captured.result.filter(script => urls.has(script.url));
    const sources = [];
    for (const script of result) {
      const response = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: response.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const raw = { result, sources };
    const report = checkCoverage({
      canonical: realpathSync,
      readText: path => readFileSync(path, "utf8"),
      parse: parseSources,
      project: (url, text) => url.startsWith("file:") ? { path: fileURLToPath(url), text } : null,
    }, runtimeFiles, [raw]);
    const inputs = [...ownedSources.map(path => resolve(repository, path)), ...runtimeFiles].map(path => ({
      path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    }));
    writeFileSync(resolve(evidenceDirectory, "coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(evidenceDirectory, "source-inputs.json"), `${JSON.stringify(inputs, null, 2)}\n`);
    console.log(`F.diag actual product coverage: ${evidenceDirectory}`);
    assert.equal(result.length, 3, "all three actual emitted runtime owners have nonempty raw V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings));
    assert.deepEqual(report.findings, []);
    assert.equal(report.files.length, 3);
    for (const file of report.files) {
      assert.equal(file.status, "covered", file.path);
      assert.equal(file.lines, 100, file.path);
      assert.equal(file.branches, 100, file.path);
      assert.equal(file.functions, 100, file.path);
    }
  } finally {
    coverageSession.disconnect();
  }
});

function diagnostic(site, rendered, message = rendered) {
  return Object.freeze({ code: Object.freeze({ kind: "checker", number: 0, rendered }), severity: "error",
    site, source: null, evidence: Object.freeze([]), message, arguments: Object.freeze([]),
    related: Object.freeze([]), fix: null });
}

function origin(module = "M[P[project];source.ts]", start = 0) {
  return Object.freeze({ module, start, length: 0, derived: Object.freeze([]) });
}

function assertOrder(input, expected, label) {
  const beforeOrder = [...input];
  const beforeValues = structuredClone(input);
  const expectedValues = structuredClone(expected);
  const actual = product.orderDiagnostics(Object.freeze(input));
  assert.deepEqual(actual, expectedValues, label);
  assert.deepEqual(input, beforeValues, label + ": complete input values remain unchanged");
  assert.equal(actual === input, false, `${label}: ordering owns a result vector, never mutates the caller`);
  assert.equal(actual.length, expected.length, label);
  for (const [index, value] of expected.entries()) assert.equal(actual[index] === value, true, `${label}: exact diagnostic ${index}`);
  assert.equal(input.every((value, index) => value === beforeOrder[index]), true, `${label}: input order remains unchanged`);
}

test("the runtime index exposes only the five approved diagnostic ports", () => {
  assert.deepEqual(Object.keys(product).sort(), ["hostDiagnosticCode", "lookupDiagnostic", "orderDiagnostics", "requirePresent", "throwInvariant"]);
  assert.deepEqual(readdirSync(resolve(repository, sourceDirectory)).filter(name => name.endsWith(".ts")).sort(),
    ["contract.ts", "index.ts", "invariant.ts", "order.ts"]);
});

for (const name of descriptors) {
  test(`authored complete JSON outcome: ${name}`, async () => {
    const report = await runCase({
      modules: ["diag"],
      readText: path => readFileSync(resolve(repository, path), "utf8"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split(sep).join("/"),
      list: path => readdirSync(resolve(repository, path)),
      decode: text => JSON.parse(text),
      adapters: {
        function: input => {
          assert.equal(input.format, "json");
          const value = JSON.parse(input.text);
          switch (value.operation) {
            case "order":
              return { kind: "accepted", value: product.orderDiagnostics(value.diagnostics), diagnostics: [] };
            case "lookup":
              return { kind: "accepted", value: product.lookupDiagnostic(value.registry, value.code), diagnostics: [] };
            case "invariant": {
              let thrown;
              try { product.throwInvariant(value.failure); }
              catch (failure) { thrown = failure; }
              assert.equal(thrown instanceof Error, true, "an invariant throws a native Error");
              assert.equal(thrown.cause === value.failure, true, "the original complete failure is the exact cause");
              return { kind: "accepted", value: { thrown: { name: thrown.name, message: thrown.message, cause: thrown.cause } }, diagnostics: [] };
            }
            default:
              throw new Error("Unknown authored diagnostic operation.");
          }
        },
      },
    }, `test/host-cases/diag/function/${name}.case.json`);
    assert.equal(report.status, "passed", JSON.stringify(report));
  });
}

test("empty and singleton diagnostic vectors remain complete without reusing the input vector", () => {
  assertOrder([], [], "empty");
  const only = diagnostic({ kind: "none" }, "TS0");
  assertOrder([only], [only], "singleton");
});

test("all source/file/none ordering directions are independent of diagnostic identity and message", () => {
  const source = diagnostic({ kind: "source", origin: origin() }, "Z", "last lexical message");
  const file = diagnostic({ kind: "file", path: "source.ts" }, "A", "first lexical message");
  const none = diagnostic({ kind: "none" }, "0", "middle message");
  for (const [label, first, second] of [["source/file", source, file], ["source/none", source, none], ["file/none", file, none]]) {
    assertOrder([first, second], [first, second], `${label} ordered`);
    assertOrder([second, first], [first, second], `${label} reversed`);
  }
});

test("source ordering uses exact UTF-16 module text, start, and rendered code before length or content", () => {
  const earlyModule = diagnostic({ kind: "source", origin: origin("M[P[project];a.ts]", 99) }, "Z");
  const lateModule = diagnostic({ kind: "source", origin: origin("M[P[project];z.ts]", 0) }, "A");
  assertOrder([lateModule, earlyModule], [earlyModule, lateModule], "module precedes start/code");
  assertOrder([earlyModule, lateModule], [earlyModule, lateModule], "module forward");
  const earlyStart = diagnostic({ kind: "source", origin: origin(undefined, 2) }, "Z");
  const lateStart = diagnostic({ kind: "source", origin: origin(undefined, 10) }, "A");
  assertOrder([lateStart, earlyStart], [earlyStart, lateStart], "numeric start");
  assertOrder([earlyStart, lateStart], [earlyStart, lateStart], "numeric start forward");
  const earlyCode = diagnostic({ kind: "source", origin: origin(undefined, 2) }, "TS10");
  const lateCode = diagnostic({ kind: "source", origin: origin(undefined, 2) }, "TS2");
  assertOrder([lateCode, earlyCode], [earlyCode, lateCode], "rendered spelling, not numeric diagnostic value");
  assertOrder([earlyCode, lateCode], [earlyCode, lateCode], "rendered forward");
  const surrogate = diagnostic({ kind: "source", origin: origin("M[P[project];\uD83D\uDE00.ts]") }, "S");
  const privateUse = diagnostic({ kind: "source", origin: origin("M[P[project];\uE000.ts]") }, "S");
  assertOrder([privateUse, surrogate], [surrogate, privateUse], "UTF-16 code units, not code points or locale");
  assertOrder([surrogate, privateUse], [surrogate, privateUse], "UTF-16 forward");
});

test("file paths and file/none rendered codes retain exact UTF-16 ordering without normalization", () => {
  const earlyPath = diagnostic({ kind: "file", path: "A\\source.ts" }, "Z");
  const latePath = diagnostic({ kind: "file", path: "a/source.ts" }, "A");
  assertOrder([latePath, earlyPath], [earlyPath, latePath], "authored path");
  assertOrder([earlyPath, latePath], [earlyPath, latePath], "authored path forward");
  for (const site of [{ kind: "file", path: "\uD800.ts" }, { kind: "none" }]) {
    const early = diagnostic(site, "\uD800");
    const late = diagnostic(site, "\uE000");
    assertOrder([late, early], [early, late], `${site.kind}: code-unit ordering`);
    assertOrder([early, late], [early, late], `${site.kind}: forward`);
    const equal = diagnostic(site, "\uD800", "distinct equal-key diagnostic");
    assertOrder([equal, early], [early, equal], `${site.kind}: canonical equal-code content`);
    assertOrder([early, equal], [early, equal], `${site.kind}: canonical equal-code content reversed`);
  }
});

test("each site domain independently preserves host, checker and extension code identities", () => {
  for (const site of [{ kind: "source", origin: origin() }, { kind: "file", path: "exact.ts" }, { kind: "none" }]) {
    const checker = Object.freeze({ ...diagnostic(site, "A"), code: { kind: "checker", number: 0, rendered: "A" } });
    const extension = Object.freeze({ ...diagnostic(site, "B"), code: { kind: "extension", number: 91, extensionCode: "EXACT", rendered: "B" } });
    const host = Object.freeze({ ...diagnostic(site, "C"), code: { kind: "host", name: "HOST_EXACT", rendered: "C" } });
    assertOrder([host, checker, extension], [checker, extension, host], `${site.kind}: independent three-code domain`);
    const output = product.orderDiagnostics([host, checker, extension]);
    assert.equal(output[0].code === checker.code && output[1].code === extension.code && output[2].code === host.code,
      true, `${site.kind}: exact code objects, not rendered-code replacements`);
  }
});

test("canonical ties retain full host/checker/extension payloads, repeated entries and nested identities", () => {
  const site = Object.freeze({ kind: "source", origin: Object.freeze({
    module: "M[P[project];\uD800-source.ts]", start: 2, length: 7,
    derived: Object.freeze([{ kind: "lowering", pass: "front" }, { kind: "expansion", expansion: "expansion-1" }]),
  }) });
  const related = Object.freeze([
    { site, code: { kind: "host", name: "HOST_EXACT", rendered: "HOST_EXACT" }, message: "related\r\n\uD800" },
    { site: { kind: "file", path: "supplied\\path.ts" }, code: { kind: "checker", number: 0, rendered: "TS0" }, message: "file" },
    { site: { kind: "none" }, code: { kind: "extension", number: 0, extensionCode: "OWNER_0", rendered: "TS0" }, message: "none" },
  ]);
  const argumentsValue = Object.freeze([
    { kind: "text", value: "\uD800\r\n\uDFFF" },
    { kind: "integer", value: 900719925474099312345678901234567890n },
    { kind: "number", value: -0 },
    { kind: "origin", value: site.origin },
  ]);
  const fix = Object.freeze({ description: "keep authored replacement", edits: Object.freeze([
    { origin: site.origin, replacement: "\r\n\uD800replacement" },
    { origin: origin(undefined, 0), replacement: "" },
  ]) });
  const first = Object.freeze({ code: { kind: "host", name: "HOST_0", rendered: "TS0" }, severity: "warning",
    site, source: "owner\r\n\uD800", evidence: Object.freeze(["repeat", "repeat", "exact\uDFFF"]), message: "first\r\n",
    arguments: argumentsValue, related, fix });
  const second = Object.freeze({ ...first, code: { kind: "checker", number: 0, rendered: "TS0" }, severity: "suggestion", message: "second" });
  const third = Object.freeze({ ...first, code: { kind: "extension", number: 0, extensionCode: "OWNER_0", rendered: "TS0" },
    severity: "error", source: null, message: "third" });
  const input = Object.freeze([second, first, third, first]);
  const output = product.orderDiagnostics(input);
  const expected = [first, first, second, third];
  assert.equal(output.length, 4);
  for (const [index, value] of expected.entries()) {
    assert.equal(output[index] === value, true, `canonical complete diagnostic ${index}`);
    for (const field of ["code", "severity", "site", "source", "evidence", "message", "arguments", "related", "fix"])
      assert.equal(output[index][field] === value[field], true, `unchanged ${field}`);
  }
  assert.equal(Object.is(output[0].arguments[2].value, -0), true, "negative zero is not reformatted");
  assert.equal(output[0].arguments[1].value, 900719925474099312345678901234567890n);
  assert.equal(output[0].evidence.length, 3, "evidence duplicates are not discharged");
  assertOrder([first, third, first, second], expected, "opposite production order has the same complete output");
});

test("equal source keys use length after rendered code and complete content in both input orders", () => {
  const short = diagnostic({ kind: "source", origin: { ...origin(), length: 1 } }, "S", "z");
  const long = diagnostic({ kind: "source", origin: { ...origin(), length: 2 } }, "S", "a");
  assertOrder([long, short], [short, long], "length precedes content");
  assertOrder([short, long], [short, long], "length forward");
  const earlierCode = diagnostic({ kind: "source", origin: { ...origin(), length: 99 } }, "A");
  assertOrder([short, earlierCode], [earlierCode, short], "rendered code precedes length");
  assertOrder([earlierCode, short], [earlierCode, short], "rendered code forward");
});

test("every diagnostic content family breaks primary ties without production-order dependence", () => {
  const site = { kind: "source", origin: origin() };
  const base = diagnostic(site, "S", "same");
  const changed = fields => Object.freeze({ ...base, ...fields });
  const lowerOrigin = { ...origin(), derived: [{ kind: "lowering", pass: "front" }] };
  const higherOrigin = { ...origin(), derived: [{ kind: "lowering", pass: "infer" }] };
  const related = (relatedSite, code, message) => [{ site: relatedSite, code, message }];
  const checker = number => ({ kind: "checker", number, rendered: "S" });
  const edits = (description, editOrigin, replacement) => ({ description, edits: [{ origin: editOrigin, replacement }] });
  const pairs = [
    ["host identity", { code: { kind: "host", name: "A", rendered: "S" } }, { code: { kind: "host", name: "B", rendered: "S" } }],
    ["checker identity", { code: checker(1) }, { code: checker(2) }],
    ["extension identity", { code: { kind: "extension", number: 1, extensionCode: "A", rendered: "S" } },
      { code: { kind: "extension", number: 1, extensionCode: "B", rendered: "S" } }],
    ["severity", { severity: "error" }, { severity: "warning" }],
    ["source history", { site: { kind: "source", origin: lowerOrigin } }, { site: { kind: "source", origin: higherOrigin } }],
    ["source text", { source: null }, { source: "a" }],
    ["evidence", { evidence: ["a"] }, { evidence: ["b"] }],
    ["message", { message: "a" }, { message: "b" }],
    ["text argument", { arguments: [{ kind: "text", value: "a" }] }, { arguments: [{ kind: "text", value: "b" }] }],
    ["integer argument", { arguments: [{ kind: "integer", value: 1n }] }, { arguments: [{ kind: "integer", value: 2n }] }],
    ["number argument", { arguments: [{ kind: "number", value: -0 }] }, { arguments: [{ kind: "number", value: 0 }] }],
    ["origin argument", { arguments: [{ kind: "origin", value: lowerOrigin }] }, { arguments: [{ kind: "origin", value: higherOrigin }] }],
    ["related site", { related: related({ kind: "file", path: "a" }, checker(1), "same") },
      { related: related({ kind: "file", path: "b" }, checker(1), "same") }],
    ["related code", { related: related({ kind: "none" }, checker(1), "same") },
      { related: related({ kind: "none" }, checker(2), "same") }],
    ["related message", { related: related(site, checker(1), "a") }, { related: related(site, checker(1), "b") }],
    ["fix absence", { fix: edits("same", origin(), "same") }, { fix: null }],
    ["fix description", { fix: edits("a", origin(), "same") }, { fix: edits("b", origin(), "same") }],
    ["fix origin", { fix: edits("same", lowerOrigin, "same") }, { fix: edits("same", higherOrigin, "same") }],
    ["fix replacement", { fix: edits("same", origin(), "a") }, { fix: edits("same", origin(), "b") }],
  ];
  for (const [label, lower, higher] of pairs) {
    const first = changed(lower);
    const second = changed(higher);
    assertOrder([second, first], [first, second], label);
    assertOrder([first, second], [first, second], label + " reversed");
  }
});

test("source numeric tie levels are total for exact nonfinite and signed-zero host numbers", () => {
  const numbers = [-Infinity, -1, -0, 0, 1, Infinity, NaN];
  for (const field of ["start", "length"]) {
    const expected = numbers.map(value => diagnostic({ kind: "source", origin: { ...origin(), [field]: value } }, "S"));
    assertOrder([...expected].reverse(), expected, field + ": reverse numeric domain");
    assertOrder([...expected], expected, field + ": forward numeric domain");
    for (const value of expected) assertOrder([value, value], [value, value], field + ": identical complete duplicates");
  }
});

test("sparse diagnostic vectors retain complete original values and deterministic absent-slot ordering", () => {
  const base = diagnostic({ kind: "source", origin: origin() }, "S", "same");
  const lowering = { kind: "lowering", pass: "front" };
  const source = values => ({ ...origin(), derived: values });
  const originArgument = values => ({ kind: "origin", value: source(values) });
  const related = values => ({ site: { kind: "source", origin: source(values) }, code: base.code, message: "same" });
  const edit = values => ({ origin: source(values), replacement: "same" });
  for (const [label, row, make] of [
    ["evidence", "same", values => ({ ...base, evidence: values })],
    ["arguments", { kind: "text", value: "same" }, values => ({ ...base, arguments: values })],
    ["related", { site: base.site, code: base.code, message: "same" }, values => ({ ...base, related: values })],
    ["edits", edit([]), values => ({ ...base, fix: { description: "same", edits: values } })],
    ["site derivations", lowering, values => ({ ...base, site: { kind: "source", origin: source(values) } })],
    ["argument derivations", lowering, values => ({ ...base, arguments: [originArgument(values)] })],
    ["related derivations", lowering, values => ({ ...base, related: [related(values)] })],
    ["edit derivations", lowering, values => ({ ...base, fix: { description: "same", edits: [edit(values)] } })],
  ]) {
    const sparse = new Array(2);
    sparse[1] = row;
    const vectors = [[], new Array(1), [row], sparse].map(value => Object.freeze(value));
    const expected = vectors.map(make);
    for (const value of expected) assertOrder([value], [value], label + ": complete singleton");
    assertOrder([...expected].reverse(), expected, label + ": reverse input");
    assertOrder([...expected], expected, label + ": forward input");
    assert.deepEqual(vectors, [[], new Array(1), [row], sparse], label + ": original holes retained");
  }
});

test("registry lookup returns only the exact matching supplied definition and has no hidden registry", () => {
  const first = Object.freeze({ code: "HOST_A", severity: "error", stage: "front", template: "A {0}" });
  const last = Object.freeze({ code: "HOST_Z", severity: "suggestion", stage: "driver", template: "Z {0}\uD800" });
  const registry = Object.freeze({ definitions: Object.freeze([first, last]) });
  assert.equal(product.lookupDiagnostic(registry, "HOST_A") === first, true);
  assert.equal(product.lookupDiagnostic(registry, "HOST_Z") === last, true);
  for (const absent of ["HOST", "host_a", " HOST_A", "HOST_A ", "HOST_A\0", ""])
    assert.equal(product.lookupDiagnostic(registry, absent), null, `exact absence ${JSON.stringify(absent)}`);
  assert.equal(product.lookupDiagnostic({ definitions: [] }, "HOST_A"), null, "no fallback to an earlier supplied registry");
  const replacement = Object.freeze({ ...first, template: "different exact caller registry" });
  assert.equal(product.lookupDiagnostic({ definitions: [replacement] }, "HOST_A") === replacement, true);
  const sparse = new Array(5);
  sparse[1] = first;
  sparse[3] = last;
  const expected = structuredClone(sparse);
  Object.freeze(sparse);
  assert.equal(product.lookupDiagnostic({ definitions: sparse }, "HOST_A") === first, true);
  assert.equal(product.lookupDiagnostic({ definitions: sparse }, "HOST_Z") === last, true);
  assert.equal(product.lookupDiagnostic({ definitions: sparse }, "ABSENT"), null);
  assert.equal(product.lookupDiagnostic({ definitions: new Array(2) }, "HOST_A"), null);
  assert.deepEqual(sparse, expected, "all supplied slots, holes and exact definitions are unchanged");
});

test("invariants retain every actual owner, nullable query/origin and exact failure cause without reading its stack", () => {
  const owners = hostCatalogue.filter(module => module.name !== "ids").map(module => module.name);
  for (const owner of owners) {
    for (const query of [null, Object.freeze({ name: "query\uD800", encodedKey: "[exact]\r\n" })]) {
      for (const selectedOrigin of [null, origin()]) {
        const failure = Object.freeze({ owner, query, origin: selectedOrigin, message: "invariant\r\n\uDFFF" });
        assert.throws(() => product.throwInvariant(failure), thrown => thrown instanceof Error &&
          thrown.name === "Error" && thrown.message === failure.message && thrown.cause === failure);
        assert.equal(Object.hasOwn(failure, "stack"), false, "the original failure record is not mutated");
      }
    }
  }
  let stackReads = 0;
  const failure = { owner: "infer", query: null, origin: null, message: "do not enrich" };
  Object.defineProperty(failure, "stack", { get() { stackReads += 1; throw new Error("Unrequested stack lookup."); } });
  assert.throws(() => product.throwInvariant(failure), thrown => thrown instanceof Error &&
    thrown.name === "Error" && thrown.message === failure.message && thrown.cause === failure);
  assert.equal(stackReads, 0);
});

test("required presence preserves every present value and exact caller identity without interpreting its contents", () => {
  const failure = Object.freeze({ owner: "ir-program", query: null, origin: null, message: "present values do not fail" });
  const record = Object.freeze({ name: "complete\r\n\uD800", nested: Object.freeze({ count: 7n, absent: null }) });
  const vector = Object.freeze([record, record, null]);
  const sparse = new Array(3);
  sparse[1] = record;
  Object.freeze(sparse);
  const values = [null, false, true, 0, -0, NaN, Infinity, -Infinity, 0n, 9007199254740993n, "", "\uD800\r\n", record, vector, sparse];
  for (const [index, value] of values.entries())
    assert.equal(Object.is(product.requirePresent(value, failure), value), true, `present value ${index} is unchanged`);
  assert.equal(vector[0] === record && vector[1] === record, true, "repeated nested identities remain exact");
  assert.equal(sparse.length === 3 && !Object.hasOwn(sparse, 0) && sparse[1] === record && !Object.hasOwn(sparse, 2),
    true, "the complete sparse caller vector is retained without reading or filling its holes");
});

test("required absence uses the same invariant owner and retains the entire exact supplied failure", () => {
  for (const query of [null, Object.freeze({ name: "publication", encodedKey: "exact\r\n\uD800" })]) {
    for (const selectedOrigin of [null, Object.freeze(origin("M[P[project];exact.ts]", 7))]) {
      const failure = Object.freeze({ owner: "dataflow", query, origin: selectedOrigin, message: "missing row\r\n\uDFFF" });
      const beforeFailure = structuredClone(failure);
      assert.throws(() => product.requirePresent(undefined, failure), thrown => thrown instanceof Error &&
        thrown.name === "Error" && thrown.message === failure.message && thrown.cause === failure);
      assert.deepEqual(failure, beforeFailure, "the complete failure value is not changed or enriched");
      assert.equal(failure.query === query && failure.origin === selectedOrigin, true, "all nullable payload identities remain exact");
      assert.equal(Object.hasOwn(failure, "stack"), false, "the invariant does not mutate its caller record");
    }
  }
});

test("host diagnostic code construction is total and preserves the complete supplied spelling", () => {
  for (const name of ["", "TSONIC_LIBRARY_ROLE_BINDING_INVALID", "TSONIC_LIBRARY_SUMMARY_BINDING_INVALID", "\uD800\n", "not registered"]) {
    assert.equal(product.hostDiagnosticCode(name), name);
    assert.equal(product.lookupDiagnostic({ definitions: [] }, product.hostDiagnosticCode(name)), null);
  }
});

test("the complete actual diag module passes fresh strict isolation against the real ids public values", async () => {
  const data = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
  const report = await compileIsolated(isolationDeps(tooling, data.areas.map(area => area.directory)),
    hostCatalogue.find(module => module.name === "diag"), {
      root: repository, sourceFiles: ownedSources,
      interfaceSources: ["packages/host/src/ids/contract.ts", "packages/host/src/ids/index.ts"],
      declarationSources: ["contract.ts", "index.ts", "identity.ts", "key.ts"].map(name => "packages/host/src/ids/" + name),
      outputDirectory: ".temp/host-f-diag/isolation",
    });
  writeFileSync(resolve(evidenceDirectory, "isolation.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", `${JSON.stringify(report.findings)}\n${report.diagnostics.join("\n")}`);
  assert.deepEqual(report.findings, []);
  assert.equal(report.diagnostics.length, 2);
  assert.equal(report.sourceInventory.length, 8);
  assert.equal(report.provenance.length, 2);
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
  assert.equal(report.loadedInventory.some(path => path.endsWith("/isolated/packages/host/src/ids/contract.d.ts")), true);
  assert.equal(report.loadedInventory.some(path => path.endsWith("/isolated/packages/host/src/ids/index.d.ts")), true);
  assert.equal(report.loadedInventory.some(path => path.endsWith("/isolated/packages/host/src/ids/contract.ts")), false);
  assert.equal(report.loadedInventory.some(path => path.endsWith("/isolated/packages/host/src/ids/key.d.ts")), false);
});

test("fresh genuine emitted declarations admit the five ports and reject readonly/shape opposites exactly", () => {
  const stage = mkdtempSync(resolve(evidenceDirectory, "consumer-"));
  mkdirSync(resolve(stage, "diag"));
  mkdirSync(resolve(stage, "ids"));
  const declarations = readdirSync(emittedDirectory).filter(name => name.endsWith(".d.ts")).sort();
  assert.deepEqual(declarations, ["contract.d.ts", "index.d.ts", "invariant.d.ts", "order.d.ts"]);
  for (const name of declarations) writeFileSync(resolve(stage, "diag", name), readFileSync(resolve(emittedDirectory, name)));
  writeFileSync(resolve(stage, "ids/contract.d.ts"), readFileSync(resolve(repository, "packages/host/dist/ids/contract.d.ts")));
  writeFileSync(resolve(stage, "package.json"), JSON.stringify({ type: "module", private: true }));
  const header = 'import { orderDiagnostics, lookupDiagnostic, throwInvariant, requirePresent, hostDiagnosticCode } from "./diag/index.js";\nimport type { Diagnostic, DiagnosticDefinition, DiagnosticRegistry, HostDiagnosticCode, HostDiagnosticCodeConstructor, InvariantFailure, LookupDiagnostic, MessageArgument, OrderDiagnostics, RequirePresent, ThrowInvariant } from "./diag/contract.js";\n';
  const positive = `${header}export function consume(code: HostDiagnosticCode, diagnostic: Diagnostic, failure: InvariantFailure) {\nconst order: OrderDiagnostics = orderDiagnostics; const lookup: LookupDiagnostic = lookupDiagnostic; const fail: ThrowInvariant = throwInvariant; const makeCode: HostDiagnosticCodeConstructor = hostDiagnosticCode;\nconst registry: DiagnosticRegistry = { definitions: [] }; const ordered: readonly Diagnostic[] = order([diagnostic]);\nconst definition: DiagnosticDefinition | null = lookup(registry, code); const argument: MessageArgument = { kind: "integer", value: 9007199254740993n };\nreturn { ordered, definition, argument, code: makeCode("HOST_EXACT"), fail: (): never => fail(failure) };\n}\n`;
  writeFileSync(resolve(stage, "consumer.ts"), positive + '\nexport function presence(value: { readonly name: string } | undefined, failure: InvariantFailure) { const requireValue: RequirePresent = requirePresent; const retained: { readonly name: string } = requireValue(value, failure); const absent: null = requireValue<null>(null, failure); return { retained, absent }; }\n');
  const owners = hostCatalogue.filter(module => module.name !== "ids").map(module => module.name);
  writeFileSync(resolve(stage, "owner-consumer.ts"), `import { requirePresent } from "./diag/index.js";\nimport type { InvariantFailure, InvariantOwner } from "./diag/contract.js";\nexport const owners: readonly InvariantOwner[] = ${JSON.stringify(owners)};\nexport function failure(owner: InvariantOwner): InvariantFailure { return { owner, query: null, origin: null, message: "actual owner" }; }\nexport const present: number = requirePresent(0, failure("dataflow"));\n`);
  const compiler = resolve(tooling, "node_modules/@typescript/native-preview/bin/tsgo.js");
  const configuration = files => ({ compilerOptions: {
    strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true,
    noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true,
    skipLibCheck: false, noEmit: true, target: "ES2022", lib: ["ES2022"], types: [],
    module: "NodeNext", moduleResolution: "NodeNext", verbatimModuleSyntax: true,
  }, files });
  const run = (name, files) => {
    writeFileSync(resolve(stage, name), JSON.stringify(configuration(files)));
    const result = spawnSync(process.execPath, [compiler, "--project", resolve(stage, name), "--pretty", "false", "--listFiles"], {
      cwd: stage, encoding: "utf8", maxBuffer: 1_048_576, timeout: 90_000,
    });
    assert.equal(result.error === undefined, true, "the real consumer compiler completes without application error");
    assert.equal(result.signal, null);
    const text = `${result.stdout}${result.stderr}`;
    writeFileSync(resolve(stage, `${name}.log`), text);
    return { status: result.status, text };
  };
  const accepted = run("positive.json", ["consumer.ts", "owner-consumer.ts"]);
  assert.equal(accepted.status, 0, accepted.text);
  const loaded = accepted.text.split(/\r?\n/u).filter(path => path.startsWith(stage));
  assert.deepEqual(loaded.map(path => relative(stage, path).split(sep).join("/")).sort(),
    ["consumer.ts", "diag/contract.d.ts", "diag/index.d.ts", "ids/contract.d.ts", "owner-consumer.ts"]);
  const negatives = [
    ["readonly-order.ts", 'import { orderDiagnostics } from "./diag/index.js"; orderDiagnostics([]).push();', 2339],
    ["wrong-code.ts", 'import { lookupDiagnostic } from "./diag/index.js"; lookupDiagnostic({ definitions: [] }, 1);', 2345],
    ["incomplete-invariant.ts", 'import { throwInvariant } from "./diag/index.js"; throwInvariant({ owner: "infer", query: null, origin: null });', 2741],
    ["extra-argument.ts", 'import { orderDiagnostics } from "./diag/index.js"; orderDiagnostics([], []);', 2554],
    ["readonly-definition.ts", 'import type { DiagnosticDefinition } from "./diag/contract.js"; export function update(value: DiagnosticDefinition): void { value.template = "changed"; }', 2540],
    ["mutable-result.ts", 'import { orderDiagnostics } from "./diag/index.js"; import type { Diagnostic } from "./diag/contract.js"; export const mutable: (values: readonly Diagnostic[]) => Diagnostic[] = orderDiagnostics;', 2322],
    ["inexact-integer.ts", 'import type { MessageArgument } from "./diag/contract.js"; export const argument: MessageArgument = { kind: "integer", value: 12 };', 2322],
    ["readonly-present.ts", 'import { requirePresent } from "./diag/index.js"; import type { InvariantFailure } from "./diag/contract.js"; export function update(value: { readonly name: string } | undefined, failure: InvariantFailure): void { requirePresent(value, failure).name = "changed"; }', 2540],
    ["incomplete-present-invariant.ts", 'import { requirePresent } from "./diag/index.js"; requirePresent(0, { owner: "infer", query: null, origin: null });', 2741],
    ["superseded-pass.ts", 'import { throwInvariant } from "./diag/index.js"; throwInvariant({ pass: "pipeline", query: null, origin: null, message: "old form" });', 2353],
    ["excluded-ids-owner.ts", 'import { requirePresent } from "./diag/index.js"; declare const failure: { readonly owner: "ids"; readonly query: null; readonly origin: null; readonly message: string }; requirePresent(0, failure);', 2345],
    ["unqualified-analysis-owner.ts", 'import { requirePresent } from "./diag/index.js"; declare const failure: { readonly owner: "liveness"; readonly query: null; readonly origin: null; readonly message: string }; requirePresent(0, failure);', 2345],
  ];
  for (const [name, text] of negatives) writeFileSync(resolve(stage, name), text);
  const refused = run("negative.json", negatives.map(([name]) => name));
  assert.equal(refused.status, 1, refused.text);
  const actual = [...refused.text.matchAll(/^(.+)\(\d+,\d+\): error TS(\d+):/gmu)]
    .map(match => [basename(match[1]), Number(match[2])]).sort(([left], [right]) => left.localeCompare(right));
  assert.equal([...refused.text.matchAll(/error TS\d+:/gu)].length, actual.length, refused.text);
  const expected = negatives.map(([name, , code]) => [name, code]).sort(([left], [right]) => left.localeCompare(right));
  assert.deepEqual(actual, expected, refused.text);
});
