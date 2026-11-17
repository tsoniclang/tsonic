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
  return ({ code: ({ kind: "checker", number: 0, rendered }), severity: "error",
    site, source: null, evidence: ([]), message, arguments: ([]),
    related: ([]), fix: null });
}

function origin(module = "M[P[project];source.ts]", start = 0) {
  return ({ module, start, length: 0, derived: ([]) });
}

function assertOrder(input, expected, label) {
  const beforeOrder = [...input];
  const beforeValues = structuredClone(input);
  const expectedValues = structuredClone(expected);
  const actual = product.orderDiagnostics((input));
  assert.deepEqual(actual, expectedValues, label);
  assert.deepEqual(input, beforeValues, label + ": complete input values remain unchanged");
  assert.equal(actual === input, false, `${label}: ordering owns a result vector, never mutates the caller`);
  assert.equal(actual.length, expected.length, label);
  for (const [index, value] of expected.entries()) assert.equal(actual[index] === value, true, `${label}: exact diagnostic ${index}`);
  assert.equal(input.every((value, index) => value === beforeOrder[index]), true, `${label}: input order remains unchanged`);
}

test("the runtime index exposes only the eight approved diagnostic ports", () => {
  assert.deepEqual(Object.keys(product).sort(), ["diagnosticIdentityKey", "hostDiagnosticCode", "lookupDiagnostic", "orderDiagnostics", "requirePresent", "resourceLimitDiagnostic", "throwInvariant", "unitPositionData"]);
  assert.deepEqual(readdirSync(resolve(repository, sourceDirectory)).filter(name => name.endsWith(".ts")).sort(),
    ["contract.ts", "index.ts", "invariant.ts", "order.ts"]);
});

test("MR-14: diagnostic identity is the captured checker reference, or the originating unit and code; one key gives its equality and its order", () => {
  const key = product.diagnosticIdentityKey;
  const unit = (query, requestKey, position) => ({ request: { query, key: requestKey }, position });
  const host = (code, value) => ({ kind: "host", code, unit: value });
  const body = node => ({ kind: "source-node", node: { kind: "body", value: { body: "m#f", node } } });
  const item = node => ({ kind: "source-node", node: { kind: "item", value: { owner: "m#f", node } } });
  const template = host("TSONIC_LOCAL_TYPE_CONFLICT", unit("tirBody", ["m#f", { kind: "record", fields: [["kind", "parametric"]] }], body(4)));
  const sameAgain = host("TSONIC_LOCAL_TYPE_CONFLICT", unit("tirBody", ["m#f", { kind: "record", fields: [["kind", "parametric"]] }], body(4)));
  const distinct = [
    { kind: "checker", diagnostic: { module: "m.ts", index: 0 } },
    { kind: "checker", diagnostic: { module: "m.ts", index: 1 } },
    { kind: "checker", diagnostic: { module: "n.ts", index: 0 } },
    template,
    host("TSONIC_LOCAL_TYPE_ACCUMULATOR", template.unit),
    host("TSONIC_LOCAL_TYPE_CONFLICT", unit("tirBody", ["m#f", { kind: "record", fields: [["kind", "instantiated"], ["class", ["int32"]]] }], body(4))),
    host("TSONIC_LOCAL_TYPE_CONFLICT", unit("tirBody", ["m#f", { kind: "record", fields: [["kind", "parametric"]] }], body(5))),
    host("TSONIC_LOCAL_TYPE_CONFLICT", unit("tirBody", ["m#f", { kind: "record", fields: [["kind", "parametric"]] }], item(4))),
    host("TSONIC_LOCAL_TYPE_CONFLICT", unit("tirBody", ["m#f", { kind: "record", fields: [["kind", "parametric"]] }], { kind: "result" })),
    host("TSONIC_LOCAL_TYPE_CONFLICT", unit("tirBody", ["m#f", { kind: "record", fields: [["kind", "parametric"]] }], { kind: "module-node", module: "m.ts", node: 4 })),
    host("TSONIC_LOCAL_TYPE_CONFLICT", unit("mirBody", ["m#f", { kind: "record", fields: [["kind", "parametric"]] }], body(4))),
    host("TSONIC_LOCAL_TYPE_UNSUPPORTED", unit("produceType", ["m#Pair"], { kind: "component", path: [["construction-argument", "Map", 0]] })),
    host("TSONIC_LOCAL_TYPE_UNSUPPORTED", unit("produceType", ["m#Pair"], { kind: "component", path: [["construction-argument", "Map", 1]] })),
    host("TSONIC_LOCAL_TYPE_UNSUPPORTED", unit("produceType", ["m#Pair"], { kind: "component", path: [] })),
    host("TSONIC_LOCAL_TYPE_UNSUPPORTED", unit("produceType", ["m#Pair"], { kind: "result" })),
    host("TSONIC_LOCAL_TYPE_UNSUPPORTED", unit("solutionOf", "g", { kind: "inference-variable", group: "g", variable: 0 })),
    host("TSONIC_LOCAL_TYPE_UNSUPPORTED", unit("solutionOf", "g", { kind: "inference-variable", group: "g", variable: 1 })),
    host("TSONIC_LOCAL_TYPE_UNSUPPORTED", unit("solutionOf", "g", { kind: "inference-variable", group: "other", variable: 0 })),
    host("TSONIC_LOCAL_TYPE_UNSUPPORTED", unit("produceType", ["m#Pair"], { kind: "component", path: [["construction-argument", "Map", 1], ["element"]] })),
  ];
  const second = () => host("TSONIC_LOCAL_TYPE_UNSUPPORTED", unit("produceType", ["m#Pair"], { kind: "component", path: [["construction-argument", "Map", 1]] }));
  assert.equal(key(second()), key(second()), "one component path is one position");
  assert.equal(key(template), key(sameAgain), "the same unit and code are one identity, whatever object holds them");
  const keys = distinct.map(key);
  assert.equal(new Set(keys).size, distinct.length, "a different code, binding, node, owner kind, position or producing fact is a different identity");
  assert.equal(keys.every(value => typeof value === "string"), true);
  assert.deepEqual([...keys].sort(), [...keys].reverse().sort(), "the order of identities is the order of their keys");
});

test("the resource-limit diagnostic names its owner, the one limit field, its maximum and the exact unit the owner stopped at", () => {
  const key = { kind: "record", fields: [["b", 2], ["a", 1]] };
  const report = { owner: "query", limit: "query.maximumRecords", maximum: 16, site: { kind: "none" },
    unit: { request: { query: "signature", key }, position: { kind: "result" } } };
  const diagnostic = product.resourceLimitDiagnostic(report);
  assert.deepEqual(diagnostic, { code: { kind: "host", name: "TSONIC_COMPILER_RESOURCE_LIMIT", rendered: "TSONIC_COMPILER_RESOURCE_LIMIT" },
    severity: "error", site: { kind: "none" }, source: "query",
    evidence: ["query.maximumRecords", "signature", "O2:S1:aF1:S1:bF2:", "A1:S6:result"],
    message: "A compiler resource limit was reached.",
    arguments: [{ kind: "text", value: "query.maximumRecords" }, { kind: "number", value: 16 }], related: [], fix: null });
  assert.equal(diagnostic.site, report.site);
  const origin = { module: "m.ts", start: 3, length: 4, derived: [] };
  const located = product.resourceLimitDiagnostic({ owner: "lower-mir", limit: "lowering.maximumRecords", maximum: 2,
    site: { kind: "source", origin }, unit: { request: { query: "mirBody", key: "b" },
      position: { kind: "source-node", node: { kind: "body", value: { body: "b", node: 7 } } } } });
  assert.deepEqual(located.evidence, ["lowering.maximumRecords", "mirBody", "S1:b", "A4:S11:source-nodeS4:bodyS1:bF7:"],
    "the unit's whole position, in the same canonical form as a diagnostic identity's");
  const atNode = position => product.resourceLimitDiagnostic({ ...report, unit: { request: report.unit.request, position } }).evidence[3];
  assert.equal(atNode({ kind: "module-node", module: "m.ts", node: 4 }), "A3:S11:module-nodeS4:m.tsF4:");
  assert.deepEqual(product.unitPositionData({ kind: "inference-variable", group: "g", variable: 0 }), ["inference-variable", "g", 0]);
  assert.notEqual(atNode({ kind: "component", path: [0] }), atNode({ kind: "component", path: [1] }), "two components of one type are two positions");
  assert.notEqual(atNode({ kind: "source-node", node: { kind: "body", value: { body: "b", node: 7 } } }),
    atNode({ kind: "source-node", node: { kind: "body", value: { body: "b", node: 8 } } }), "two nodes of one body are two positions");
  assert.equal(located.site.origin, origin);
  assert.equal(located.source, "lower-mir");
  assert.notEqual(product.resourceLimitDiagnostic(report), diagnostic, "each call builds its own record");
  assert.deepEqual(product.orderDiagnostics([diagnostic, located]), [located, diagnostic], "a located limit diagnostic orders before an unlocated one");
});

for (const name of descriptors) {
  test(`authored complete JSON outcome: ${name}`, async () => {
    const report = await runCase({
      modules: ["diag"],
      evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
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
    const checker = ({ ...diagnostic(site, "A"), code: { kind: "checker", number: 0, rendered: "A" } });
    const extension = ({ ...diagnostic(site, "B"), code: { kind: "extension", number: 91, extensionCode: "EXACT", rendered: "B" } });
    const host = ({ ...diagnostic(site, "C"), code: { kind: "host", name: "HOST_EXACT", rendered: "C" } });
    assertOrder([host, checker, extension], [checker, extension, host], `${site.kind}: independent three-code domain`);
    const output = product.orderDiagnostics([host, checker, extension]);
    assert.equal(output[0].code === checker.code && output[1].code === extension.code && output[2].code === host.code,
      true, `${site.kind}: exact code objects, not rendered-code replacements`);
  }
});

test("canonical ties retain full host/checker/extension payloads, repeated entries and nested identities", () => {
  const site = ({ kind: "source", origin: ({
    module: "M[P[project];\uD800-source.ts]", start: 2, length: 7,
    derived: ([{ kind: "lowering", pass: "front" }, { kind: "expansion", expansion: "expansion-1" }]),
  }) });
  const related = ([
    { site, code: { kind: "host", name: "HOST_EXACT", rendered: "HOST_EXACT" }, message: "related\r\n\uD800" },
    { site: { kind: "file", path: "supplied\\path.ts" }, code: { kind: "checker", number: 0, rendered: "TS0" }, message: "file" },
    { site: { kind: "none" }, code: { kind: "extension", number: 0, extensionCode: "OWNER_0", rendered: "TS0" }, message: "none" },
  ]);
  const argumentsValue = ([
    { kind: "text", value: "\uD800\r\n\uDFFF" },
    { kind: "integer", value: 900719925474099312345678901234567890n },
    { kind: "number", value: -0 },
    { kind: "origin", value: site.origin },
  ]);
  const fix = ({ description: "keep authored replacement", edits: ([
    { origin: site.origin, replacement: "\r\n\uD800replacement" },
    { origin: origin(undefined, 0), replacement: "" },
  ]) });
  const first = ({ code: { kind: "host", name: "HOST_0", rendered: "TS0" }, severity: "warning",
    site, source: "owner\r\n\uD800", evidence: (["repeat", "repeat", "exact\uDFFF"]), message: "first\r\n",
    arguments: argumentsValue, related, fix });
  const second = ({ ...first, code: { kind: "checker", number: 0, rendered: "TS0" }, severity: "suggestion", message: "second" });
  const third = ({ ...first, code: { kind: "extension", number: 0, extensionCode: "OWNER_0", rendered: "TS0" },
    severity: "error", source: null, message: "third" });
  const input = ([second, first, third, first]);
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
  const changed = fields => ({ ...base, ...fields });
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
    const vectors = [[], new Array(1), [row], sparse].map(value => (value));
    const expected = vectors.map(make);
    for (const value of expected) assertOrder([value], [value], label + ": complete singleton");
    assertOrder([...expected].reverse(), expected, label + ": reverse input");
    assertOrder([...expected], expected, label + ": forward input");
    assert.deepEqual(vectors, [[], new Array(1), [row], sparse], label + ": original holes retained");
  }
});

test("registry lookup returns only the exact matching supplied definition and has no hidden registry", () => {
  const first = ({ code: "HOST_A", severity: "error", stage: "front", template: "A {0}" });
  const last = ({ code: "HOST_Z", severity: "suggestion", stage: "driver", template: "Z {0}\uD800" });
  const registry = ({ definitions: ([first, last]) });
  assert.equal(product.lookupDiagnostic(registry, "HOST_A") === first, true);
  assert.equal(product.lookupDiagnostic(registry, "HOST_Z") === last, true);
  for (const absent of ["HOST", "host_a", " HOST_A", "HOST_A ", "HOST_A\0", ""])
    assert.equal(product.lookupDiagnostic(registry, absent), null, `exact absence ${JSON.stringify(absent)}`);
  assert.equal(product.lookupDiagnostic({ definitions: [] }, "HOST_A"), null, "no fallback to an earlier supplied registry");
  const replacement = ({ ...first, template: "different exact caller registry" });
  assert.equal(product.lookupDiagnostic({ definitions: [replacement] }, "HOST_A") === replacement, true);
  const sparse = new Array(5);
  sparse[1] = first;
  sparse[3] = last;
  const expected = structuredClone(sparse);
  assert.equal(product.lookupDiagnostic({ definitions: sparse }, "HOST_A") === first, true);
  assert.equal(product.lookupDiagnostic({ definitions: sparse }, "HOST_Z") === last, true);
  assert.equal(product.lookupDiagnostic({ definitions: sparse }, "ABSENT"), null);
  assert.equal(product.lookupDiagnostic({ definitions: new Array(2) }, "HOST_A"), null);
  assert.deepEqual(sparse, expected, "all supplied slots, holes and exact definitions are unchanged");
});

test("invariants retain every actual owner, nullable query/origin and exact failure cause without reading its stack", () => {
  const owners = hostCatalogue.filter(module => module.name !== "ids").map(module => module.name);
  for (const owner of owners) {
    for (const query of [null, ({ name: "query\uD800", encodedKey: "[exact]\r\n" })]) {
      for (const selectedOrigin of [null, origin()]) {
        const failure = ({ owner, query, origin: selectedOrigin, message: "invariant\r\n\uDFFF" });
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
  const failure = ({ owner: "ir-program", query: null, origin: null, message: "present values do not fail" });
  const record = ({ name: "complete\r\n\uD800", nested: ({ count: 7n, absent: null }) });
  const vector = ([record, record, null]);
  const sparse = new Array(3);
  sparse[1] = record;
  const values = [null, false, true, 0, -0, NaN, Infinity, -Infinity, 0n, 9007199254740993n, "", "\uD800\r\n", record, vector, sparse];
  for (const [index, value] of values.entries())
    assert.equal(Object.is(product.requirePresent(value, failure), value), true, `present value ${index} is unchanged`);
  assert.equal(vector[0] === record && vector[1] === record, true, "repeated nested identities remain exact");
  assert.equal(sparse.length === 3 && !Object.hasOwn(sparse, 0) && sparse[1] === record && !Object.hasOwn(sparse, 2),
    true, "the complete sparse caller vector is retained without reading or filling its holes");
});

test("required absence uses the same invariant owner and retains the entire exact supplied failure", () => {
  for (const query of [null, ({ name: "publication", encodedKey: "exact\r\n\uD800" })]) {
    for (const selectedOrigin of [null, (origin("M[P[project];exact.ts]", 7))]) {
      const failure = ({ owner: "dataflow", query, origin: selectedOrigin, message: "missing row\r\n\uDFFF" });
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

test("fresh genuine emitted declarations admit the six ports and the cause records, and reject readonly/shape opposites exactly", () => {
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
  writeFileSync(resolve(stage, "cause-consumer.ts"), `import { resourceLimitDiagnostic } from "./diag/index.js";
import type { Cause, CheckerDiagnosticRef, Diagnostic, DiagnosticIdentity, ErrorValue, ResourceLimitDiagnostic, ResourceLimitReport, UnitPosition, UnitRef } from "./diag/contract.js";
import type { GroupId, ModuleId, NodeId, SourceNodeRef } from "./ids/contract.js";
export function causes(module: ModuleId, node: NodeId, source: SourceNodeRef, group: GroupId, code: Diagnostic["code"]): ErrorValue {
  const captured: CheckerDiagnosticRef = { module, index: 0 };
  const positions: readonly UnitPosition[] = [{ kind: "result" }, { kind: "module-node", module, node }, { kind: "source-node", node: source },
    { kind: "component", path: [["argument", 1], "element"] }, { kind: "inference-variable", group, variable: 0 }];
  const unit: UnitRef = { request: { query: "bindingTargets", key: [module] }, position: { kind: "module-node", module, node } };
  const original: DiagnosticIdentity = { kind: "checker", diagnostic: captured };
  const detected: DiagnosticIdentity | null = code.kind === "host" ? { kind: "host", unit, code: code.name } : null;
  const dependent: Cause = { kind: "unit", unit };
  const grounded: Cause = { kind: "diagnostic", diagnostic: detected ?? original };
  void positions;
  return { kind: "error", causes: [grounded, dependent] };
}
export function describe(cause: Cause): string {
  switch (cause.kind) {
    case "diagnostic": return cause.diagnostic.kind === "checker" ? String(cause.diagnostic.diagnostic.index) : cause.diagnostic.code;
    case "unit": return cause.unit.request.query + ":" + cause.unit.position.kind;
  }
}
export function limit(report: ResourceLimitReport): Diagnostic { const build: ResourceLimitDiagnostic = resourceLimitDiagnostic; return build(report); }
`);
  const accepted = run("positive.json", ["cause-consumer.ts", "consumer.ts", "owner-consumer.ts"]);
  assert.equal(accepted.status, 0, accepted.text);
  const loaded = accepted.text.split(/\r?\n/u).filter(path => path.startsWith(stage));
  assert.deepEqual(loaded.map(path => relative(stage, path).split(sep).join("/")).sort(),
    ["cause-consumer.ts", "consumer.ts", "diag/contract.d.ts", "diag/index.d.ts", "ids/contract.d.ts", "owner-consumer.ts"]);
  const negatives = [
    ["cause-third-arm.ts", 'import type { Cause } from "./diag/contract.js"; export const wrong: Cause = { kind: "unassociated" };', 2322],
    ["cause-null.ts", 'import type { ErrorValue } from "./diag/contract.js"; export const wrong: ErrorValue = { kind: "error", causes: [] };', 2322],
    ["checker-reference-without-module.ts", 'import type { CheckerDiagnosticRef } from "./diag/contract.js"; export const wrong: CheckerDiagnosticRef = { index: 0 };', 2741],
    ["unit-without-position.ts", 'import type { UnitRef } from "./diag/contract.js"; export const wrong: UnitRef = { request: { query: "q", key: null } };', 2741],
    ["unit-position-fourth-arm.ts", 'import type { UnitPosition } from "./diag/contract.js"; export const wrong: UnitPosition = { kind: "nearest-node" };', 2322],
    ["readonly-cause-unit.ts", 'import type { UnitRef } from "./diag/contract.js"; export function move(unit: UnitRef): void { unit.position = { kind: "result" }; }', 2540],
    ["limit-without-unit.ts", 'import { resourceLimitDiagnostic } from "./diag/index.js"; resourceLimitDiagnostic({ owner: "query", limit: "query.maximumRecords", maximum: 1, site: { kind: "none" } });', 2741],
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
