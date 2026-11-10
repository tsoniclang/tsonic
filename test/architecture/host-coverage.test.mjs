import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { checkCoverage } from "./host/coverage.mjs";
import { parseSources } from "./host/import-graph.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const branchSource = "export function choose(value) {\n  return value ? 1 : 0;\n}\n";
const multilineSource = "export function choose(value) {\n  if (value) return 1;\n  return 0;\n}\n";

async function capture(sourceText, calls, action) {
  const parent = resolve(repository, ".temp/host-s1-coverage");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "case-"));
  const file = resolve(root, "fixture.mjs");
  writeFileSync(file, sourceText);
  const session = new Session();
  session.connect();
  const post = (method, parameters = {}) => new Promise((done, reject) => {
    session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
  });
  try {
    await post("Debugger.enable");
    await post("Profiler.enable");
    await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
    const exports = await import(pathToFileURL(file).href);
    for (const value of calls) exports.choose(value);
    const raw = await post("Profiler.takePreciseCoverage");
    const result = raw.result.filter(script => script.url === pathToFileURL(file).href);
    const sources = [];
    for (const script of result) {
      const response = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: response.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const deps = {
      canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => url.startsWith("file:") ? { path: fileURLToPath(url), text } : null,
    };
    await action({ root, file, deps, raw: { ...raw, result, sources } });
  } finally { session.disconnect(); rmSync(root, { recursive: true }); }
}

test("actual nonempty V8 ranges and original source identity earn per-file 100 with no exclusions", async () => {
  await capture(branchSource, [true, false], async ({ file, deps, raw }) => {
    assert.equal(raw.result.length, 1);
    assert.equal(raw.result[0].functions.length > 1, true, "entry-only evidence is not the function proof");
    const report = checkCoverage(deps, [file], [raw]);
    assert.equal(report.status, "passed", JSON.stringify(report.findings));
    assert.equal(report.findings.length, 0);
    assert.equal(report.files.length, 1);
    assert.equal(report.files[0].lines, 100);
    assert.equal(report.files[0].branches, 100);
    assert.equal(report.files[0].functions, 100);
    assert.equal(report.files[0].sourceHash, createHash("sha256").update(branchSource).digest("hex"));
    assert.equal(report.rawV8[0] === raw, true, "original V8 evidence retained by identity");
    assert.equal(Object.isFrozen(report), true);
  });
});

test("one real uncovered same-line branch fails branches, not already executed statement lines", async () => {
  await capture(branchSource, [true], async ({ file, deps, raw }) => {
    const report = checkCoverage(deps, [file], [raw]);
    const offset = branchSource.indexOf("0;");
    const line = branchSource.slice(0, offset).split("\n");
    const expected = [{ code: "coverage-branch", path: file, line: 2, column: line[1].length + 1 }];
    assert.equal(JSON.stringify(report.findings), JSON.stringify(expected));
    assert.equal(report.status, "failed");
    assert.equal(report.files[0].lines, 100);
    assert.equal(report.files[0].branches < 100, true);
    assert.equal(report.files[0].functions, 100);
  });
});

test("real unexecuted statements and uncalled functions fail their own line and function gates", async () => {
  await capture(multilineSource, [true], async ({ file, deps, raw }) => {
    const report = checkCoverage(deps, [file], [raw]);
    assert.equal(report.findings.some(finding => finding.code === "coverage-line" && finding.line === 3 && finding.column === 3), true);
    assert.equal(report.findings.some(finding => finding.code === "coverage-branch"), true);
    assert.equal(report.findings.some(finding => finding.code === "coverage-function"), false);
  });
  await capture(multilineSource, [], async ({ file, deps, raw }) => {
    const report = checkCoverage(deps, [file], [raw]);
    assert.equal(report.findings.some(finding => finding.code === "coverage-function" && finding.line === 1 && finding.column === 1), true);
    assert.equal(report.findings.some(finding => finding.code === "coverage-line"), true);
    assert.equal(report.findings.some(finding => finding.code === "coverage-empty"), false, "uncalled genuine V8 function evidence is not an empty report");
  });
});

test("empty, missing, entry-only, wrong source identity and malformed ranges cannot fabricate coverage", async () => {
  await capture(branchSource, [true, false], async ({ file, deps, raw, root }) => {
    const opposites = [[], [{ result: [], sources: [] }], [{ ...raw, sources: [] }],
      [{ ...raw, sources: raw.sources.map(source => ({ ...source, text: `${source.text}\n` })) }],
      [{ ...raw, result: raw.result.map(script => ({ ...script, functions: script.functions.slice(0, 1) })) }],
      [{ ...raw, result: raw.result.map(script => ({ ...script, functions: script.functions.map(fn => ({ ...fn, ranges: [] })) })) }],
      [{ ...raw, result: raw.result.map(script => ({ ...script, functions: script.functions.map(fn => ({ ...fn, ranges: fn.ranges.map(range => ({ ...range, count: -1 })) })) })) }],
    ];
    for (const capture of opposites) {
      const report = checkCoverage(deps, [file], capture);
      assert.equal(JSON.stringify(report.findings), JSON.stringify([{ code: "coverage-empty", path: file, line: 1, column: 1 }]));
    }
    assert.equal(checkCoverage({ ...deps, project: () => null }, [file], [raw]).findings[0].code, "coverage-empty");
    assert.equal(checkCoverage(deps, [], [raw]).findings[0].code, "coverage-empty");
    const empty = resolve(root, "empty.mjs");
    writeFileSync(empty, "");
    assert.equal(checkCoverage(deps, [empty], []).findings[0].code, "coverage-empty");
    assert.equal(checkCoverage(deps, [resolve(root, "missing.mjs")], []).findings[0].code, "coverage-empty");
    assert.throws(() => checkCoverage(deps, [file, file], [raw]), /distinct complete/u);
  });
});

test("types-only contracts are explicitly N/A, never invented runtime 100 percent", async () => {
  await capture(branchSource, [true, false], async ({ root, deps }) => {
    const file = resolve(root, "contract.ts");
    writeFileSync(file, "export interface Data { readonly values: readonly number[]; }\nexport type Read = (input: Data) => number;\n");
    const report = checkCoverage(deps, [file], []);
    assert.equal(report.status, "passed");
    assert.equal(report.files[0].status, "not-applicable");
    assert.equal(report.files[0].lines === null && report.files[0].branches === null && report.files[0].functions === null, true);
  });
});
