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
  const actual = product.orderDiagnostics(Object.freeze(input));
  assert.equal(actual === input, false, `${label}: ordering owns a result vector, never mutates the caller`);
  assert.equal(actual.length, expected.length, label);
  for (const [index, value] of expected.entries()) assert.equal(actual[index] === value, true, `${label}: exact diagnostic ${index}`);
  assert.equal(input.every((value, index) => value === beforeOrder[index]), true, `${label}: input order remains unchanged`);
}

test("the runtime index exposes only the three approved diagnostic ports", () => {
  assert.deepEqual(Object.keys(product).sort(), ["lookupDiagnostic", "orderDiagnostics", "throwInvariant"]);
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
              assert.equal(thrown === value.failure, true, "invariants throw the actual complete supplied record");
              return { kind: "accepted", value: { thrown }, diagnostics: [] };
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

test("source ordering uses exact UTF-16 module text, start, and rendered code, not length or severity", () => {
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
    assertOrder([equal, early], [equal, early], `${site.kind}: stable equal code`);
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

test("stable ties retain full host/checker/extension payloads, repeated entries and nested identities", () => {
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
  assert.equal(output.length, 4);
  for (const [index, value] of input.entries()) {
    assert.equal(output[index] === value, true, `stable complete diagnostic ${index}`);
    for (const field of ["code", "severity", "site", "source", "evidence", "message", "arguments", "related", "fix"])
      assert.equal(output[index][field] === value[field], true, `unchanged ${field}`);
  }
  assert.equal(Object.is(output[0].arguments[2].value, -0), true, "negative zero is not reformatted");
  assert.equal(output[0].arguments[1].value, 900719925474099312345678901234567890n);
  assert.equal(output[0].evidence.length, 3, "evidence duplicates are not discharged");
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
});

test("invariants retain every pass, nullable query/origin and original failure identity without stack work", () => {
  const passes = ["front", "decls", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata", "liveness",
    "initialization", "refinements", "origins", "suspension", "errorStorage", "pointerBacking", "summaries", "pipeline"];
  for (const pass of passes) {
    for (const query of [null, Object.freeze({ name: "query\uD800", encodedKey: "[exact]\r\n" })]) {
      for (const selectedOrigin of [null, origin()]) {
        const failure = Object.freeze({ pass, query, origin: selectedOrigin, message: "invariant\r\n\uDFFF" });
        assert.throws(() => product.throwInvariant(failure), thrown => thrown === failure);
        assert.equal(Object.hasOwn(failure, "stack"), false, "no captured stack or wrapped Error");
      }
    }
  }
  let stackReads = 0;
  const failure = { pass: "infer", query: null, origin: null, message: "do not enrich" };
  Object.defineProperty(failure, "stack", { get() { stackReads += 1; throw new Error("Unrequested stack lookup."); } });
  assert.throws(() => product.throwInvariant(failure), thrown => thrown === failure);
  assert.equal(stackReads, 0);
});

test("the complete actual diag module passes fresh strict isolation against the real ids contract", async () => {
  const data = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
  const report = await compileIsolated(isolationDeps(tooling, data.areas.map(area => area.directory)),
    hostCatalogue.find(module => module.name === "diag"), {
      root: repository, sourceFiles: ownedSources,
      interfaceSources: ["packages/host/src/ids/contract.ts"],
      declarationSources: ["packages/host/src/ids/contract.ts"], outputDirectory: ".temp/host-f-diag/isolation",
    });
  writeFileSync(resolve(evidenceDirectory, "isolation.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", `${JSON.stringify(report.findings)}\n${report.diagnostics.join("\n")}`);
  assert.deepEqual(report.findings, []);
  assert.equal(report.diagnostics.length, 2);
  assert.equal(report.sourceInventory.length, 5);
  assert.equal(report.provenance.length, 1);
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
  assert.equal(report.loadedInventory.some(path => path.endsWith("/isolated/packages/host/src/ids/contract.d.ts")), true);
  assert.equal(report.loadedInventory.some(path => path.endsWith("/isolated/packages/host/src/ids/contract.ts")), false);
});

test("fresh genuine emitted declarations admit the three ports and reject readonly/shape opposites exactly", () => {
  const stage = mkdtempSync(resolve(evidenceDirectory, "consumer-"));
  mkdirSync(resolve(stage, "diag"));
  mkdirSync(resolve(stage, "ids"));
  const declarations = readdirSync(emittedDirectory).filter(name => name.endsWith(".d.ts")).sort();
  assert.deepEqual(declarations, ["contract.d.ts", "index.d.ts", "invariant.d.ts", "order.d.ts"]);
  for (const name of declarations) writeFileSync(resolve(stage, "diag", name), readFileSync(resolve(emittedDirectory, name)));
  writeFileSync(resolve(stage, "ids/contract.d.ts"), readFileSync(resolve(repository, "packages/host/dist/ids/contract.d.ts")));
  writeFileSync(resolve(stage, "package.json"), JSON.stringify({ type: "module", private: true }));
  const header = 'import { orderDiagnostics, lookupDiagnostic, throwInvariant } from "./diag/index.js";\nimport type { Diagnostic, DiagnosticDefinition, DiagnosticRegistry, HostDiagnosticCode, InvariantFailure, LookupDiagnostic, MessageArgument, OrderDiagnostics, ThrowInvariant } from "./diag/contract.js";\n';
  const positive = `${header}export function consume(code: HostDiagnosticCode, diagnostic: Diagnostic, failure: InvariantFailure) {\nconst order: OrderDiagnostics = orderDiagnostics; const lookup: LookupDiagnostic = lookupDiagnostic; const fail: ThrowInvariant = throwInvariant;\nconst registry: DiagnosticRegistry = { definitions: [] }; const ordered: readonly Diagnostic[] = order([diagnostic]);\nconst definition: DiagnosticDefinition | null = lookup(registry, code); const argument: MessageArgument = { kind: "integer", value: 9007199254740993n };\nreturn { ordered, definition, argument, fail: (): never => fail(failure) };\n}\n`;
  writeFileSync(resolve(stage, "consumer.ts"), positive);
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
  const accepted = run("positive.json", ["consumer.ts"]);
  assert.equal(accepted.status, 0, accepted.text);
  const loaded = accepted.text.split(/\r?\n/u).filter(path => path.startsWith(stage));
  assert.deepEqual(loaded.map(path => relative(stage, path).split(sep).join("/")).sort(),
    ["consumer.ts", "diag/contract.d.ts", "diag/index.d.ts", "ids/contract.d.ts"]);
  const negatives = [
    ["readonly-order.ts", 'import { orderDiagnostics } from "./diag/index.js"; orderDiagnostics([]).push();', 2339],
    ["wrong-code.ts", 'import { lookupDiagnostic } from "./diag/index.js"; lookupDiagnostic({ definitions: [] }, 1);', 2345],
    ["incomplete-invariant.ts", 'import { throwInvariant } from "./diag/index.js"; throwInvariant({ pass: "infer", query: null, origin: null });', 2345],
    ["extra-argument.ts", 'import { orderDiagnostics } from "./diag/index.js"; orderDiagnostics([], []);', 2554],
    ["readonly-definition.ts", 'import type { DiagnosticDefinition } from "./diag/contract.js"; export function update(value: DiagnosticDefinition): void { value.template = "changed"; }', 2540],
    ["mutable-result.ts", 'import { orderDiagnostics } from "./diag/index.js"; import type { Diagnostic } from "./diag/contract.js"; export const mutable: (values: readonly Diagnostic[]) => Diagnostic[] = orderDiagnostics;', 2322],
    ["inexact-integer.ts", 'import type { MessageArgument } from "./diag/contract.js"; export const argument: MessageArgument = { kind: "integer", value: 12 };', 2322],
  ];
  for (const [name, text] of negatives) writeFileSync(resolve(stage, name), text);
  const refused = run("negative.json", negatives.map(([name]) => name));
  assert.notEqual(refused.status, 0);
  const actual = [...refused.text.matchAll(/^(.+)\(\d+,\d+\): error TS(\d+):/gmu)]
    .map(match => [basename(match[1]), Number(match[2])]).sort(([left], [right]) => left.localeCompare(right));
  const expected = negatives.map(([name, , code]) => [name, code]).sort(([left], [right]) => left.localeCompare(right));
  assert.deepEqual(actual, expected, refused.text);
});
