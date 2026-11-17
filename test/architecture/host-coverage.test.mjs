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
const choose = values => exports => { for (const value of values) exports.choose(value); };

async function capture(sourceText, exercise, action) {
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
    const captures = [];
    for (const step of Array.isArray(exercise) ? exercise : [exercise]) {
      step(exports);
      const raw = await post("Profiler.takePreciseCoverage");
      const result = raw.result.filter(script => script.url === pathToFileURL(file).href);
      const sources = [];
      for (const script of result) {
        const response = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
        sources.push({ scriptId: script.scriptId, url: script.url, text: response.scriptSource });
      }
      captures.push({ ...raw, result, sources });
    }
    await post("Profiler.stopPreciseCoverage");
    const deps = {
      canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => url.startsWith("file:") ? { path: fileURLToPath(url), text } : null,
    };
    await action({ root, file, deps, raw: captures[0], captures });
  } finally { session.disconnect(); rmSync(root, { recursive: true }); }
}

test("actual nonempty V8 ranges and original source identity earn per-file 100 with no exclusions", async () => {
  await capture(branchSource, choose([true, false]), async ({ file, deps, raw }) => {
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
  });
});

const catchFinallySource = (nested = false, gap = "\n        ") => `export function create(enabled) {
  if (!enabled) throw new TypeError("disabled");
  let cleanups = 0;
  const signal = new Error("signal");
  function compute(value) {
    if (value === "signal") throw signal;
    if (value === "failure") throw new Error("failure");
    return ${nested ? 'value === "unvisited" ? 99 : value' : "value"};
  }
  function run(value) {
    try {
      return compute(value);
    } catch (error) {
      if (error === signal) return "signal";
      throw error;
    }${gap}finally {
      cleanups += 1;
    }
  }
  return { run, count: () => cleanups };
}
`;
const exerciseCatchFinally = exports => {
  assert.throws(() => exports.create(false), TypeError);
  const database = exports.create(true);
  assert.equal(database.run("ok"), "ok");
  assert.equal(database.run("signal"), "signal");
  assert.throws(() => database.run("failure"), /^Error: failure$/u);
  assert.equal(database.count(), 3);
};

test("actual catch/finally whitespace is not a branch and does not contaminate an executed enclosing range", async () => {
  const source = catchFinallySource();
  await capture(source, exerciseCatchFinally, async ({ file, deps, raw }) => {
    const functions = raw.result.flatMap(script => script.functions);
    const whitespace = functions.flatMap(fn => fn.ranges.slice(1)).filter(range =>
      range.count === 0 && source.slice(range.startOffset, range.endOffset).trim().length === 0);
    assert.equal(whitespace.length > 0, true, "actual V8 supplied the nonexecutable interval");
    assert.equal(functions.filter(fn => fn.functionName === "create").some(fn => fn.ranges.slice(1).some(range =>
      range.count > 0 && whitespace.some(gap => range.startOffset <= gap.startOffset && range.endOffset >= gap.endOffset))),
    true, "the executed enclosing branch contains the separate whitespace range");
    const report = checkCoverage(deps, [file], [raw]);
    assert.deepEqual(report.findings, []);
    assert.equal(report.status, "passed");
    assert.equal(report.files[0].lines === 100 && report.files[0].branches === 100 && report.files[0].functions === 100, true);
  });
});

test("a genuinely uncovered nested branch still fails beside catch/finally whitespace", async () => {
  const source = catchFinallySource(true);
  await capture(source, exerciseCatchFinally, async ({ file, deps, raw }) => {
    const report = checkCoverage(deps, [file], [raw]);
    const line = source.slice(0, source.indexOf('return value === "unvisited"')).split("\n").length;
    assert.equal(report.status, "failed");
    assert.equal(report.findings.some(finding => finding.code === "coverage-branch" && finding.line === line), true);
    assert.equal(report.files[0].branches < 100, true);
    assert.equal(report.files[0].lines === 100 && report.files[0].functions === 100, true);
  });
});

test("an actual zero-count interval containing a comment is not exempted as whitespace", async () => {
  const source = catchFinallySource(false, "\n        /* retained zero-range comment */\n        ");
  await capture(source, exerciseCatchFinally, async ({ file, deps, raw }) => {
    assert.equal(raw.result.flatMap(script => script.functions).flatMap(fn => fn.ranges.slice(1)).some(range =>
      range.count === 0 && source.slice(range.startOffset, range.endOffset).includes("/* retained zero-range comment */")), true);
    const report = checkCoverage(deps, [file], [raw]);
    assert.equal(report.status, "failed");
    assert.equal(report.findings.some(finding => finding.code === "coverage-branch"), true);
  });
});

test("authenticated captures aggregate only each exact branch's own counts", async () => {
  await capture(branchSource, [choose([true]), choose([true, false, false])], async ({ file, deps, captures }) => {
    assert.equal(captures.length, 2);
    for (const raw of captures) {
      assert.equal(raw.result.length, 1);
      assert.equal(raw.sources[0].text, branchSource);
    }
    assert.equal(checkCoverage(deps, [file], [captures[0]]).status, "failed");
    for (const inputs of [captures, [...captures].reverse()]) {
      const report = checkCoverage(deps, [file], inputs);
      assert.deepEqual(report.findings, []);
      assert.equal(report.files[0].lines === 100 && report.files[0].branches === 100 && report.files[0].functions === 100, true);
      assert.equal(report.rawV8[0] === inputs[0] && report.rawV8[1] === inputs[1], true);
    }
  });
});
test("one real uncovered same-line branch fails branches, not already executed statement lines", async () => {
  await capture(branchSource, choose([true]), async ({ file, deps, raw }) => {
    const offset = branchSource.indexOf(": 0;");
    const line = branchSource.slice(0, offset).split("\n");
    const expected = [{ code: "coverage-branch", path: file, line: 2, column: line[1].length + 1 }];
    const report = checkCoverage(deps, [file], [raw]);
    assert.equal(JSON.stringify(report.findings), JSON.stringify(expected));
    assert.equal(report.status, "failed");
    assert.equal(report.files[0].lines, 100);
    assert.equal(report.files[0].branches < 100, true);
    assert.equal(report.files[0].functions, 100);
  });
});

test("real unexecuted statements and uncalled functions fail their own line and function gates", async () => {
  await capture(multilineSource, choose([true]), async ({ file, deps, raw }) => {
    const report = checkCoverage(deps, [file], [raw]);
    assert.equal(report.findings.some(finding => finding.code === "coverage-line" && finding.line === 3 && finding.column === 3), true);
    assert.equal(report.findings.some(finding => finding.code === "coverage-branch"), true);
    assert.equal(report.findings.some(finding => finding.code === "coverage-function"), false);
  });
  await capture(multilineSource, choose([]), async ({ file, deps, raw }) => {
    const report = checkCoverage(deps, [file], [raw]);
    assert.equal(report.findings.some(finding => finding.code === "coverage-function" && finding.line === 1 && finding.column === 1), true);
    assert.equal(report.findings.some(finding => finding.code === "coverage-line"), true);
    assert.equal(report.findings.some(finding => finding.code === "coverage-empty"), false, "uncalled genuine V8 function evidence is not an empty report");
  });
});

test("empty, missing, entry-only, wrong source identity and malformed ranges cannot fabricate coverage", async () => {
  await capture(branchSource, choose([true, false]), async ({ file, deps, raw, root }) => {
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
  await capture(branchSource, choose([true, false]), async ({ root, deps }) => {
    const file = resolve(root, "contract.ts");
    writeFileSync(file, "export interface Data { readonly values: readonly number[]; }\nexport type Read = (input: Data) => number;\n");
    const report = checkCoverage(deps, [file], []);
    assert.equal(report.status, "passed");
    assert.equal(report.files[0].status, "not-applicable");
    assert.equal(report.files[0].lines === null && report.files[0].branches === null && report.files[0].functions === null, true);
  });
});

test("a genuine module-entry record cannot replace the authored function at the same no-newline end", async () => {
  const text = "export function choose(value) { return value ? 1 : 0; }";
  await capture(text, choose([true, false]), async ({ file, deps, raw }) => {
    const expected = [{ code: "coverage-empty", path: file, line: 1, column: 1 }];
    const entryOnly = { ...raw, result: raw.result.map(script => ({ ...script, functions: script.functions.slice(0, 1) })) };
    assert.equal(JSON.stringify(checkCoverage(deps, [file], [entryOnly]).findings), JSON.stringify(expected));
    const complete = checkCoverage(deps, [file], [raw]);
    assert.equal(complete.status, "passed", JSON.stringify(complete.findings));
    assert.equal(complete.files[0].functions, 100);
  });
  const helper = "export function choose() { return 1; }";
  await capture(helper, choose([]), async ({ file, deps, raw }) => {
    const report = checkCoverage(deps, [file], [raw]);
    assert.equal(report.status, "failed");
    assert.equal(report.findings.some(finding => finding.code === "coverage-function" && finding.line === 1 && finding.column === 1), true);
    assert.equal(report.findings.some(finding => finding.code === "coverage-empty"), false);
    const entryOnly = { ...raw, result: raw.result.map(script => ({ ...script, functions: script.functions.slice(0, 1) })) };
    assert.equal(JSON.stringify(checkCoverage(deps, [file], [entryOnly]).findings), JSON.stringify([{ code: "coverage-empty", path: file, line: 1, column: 1 }]));
  });
  await capture(helper, exports => { exports.choose(); }, async ({ file, deps, raw }) => {
    const report = checkCoverage(deps, [file], [raw]);
    assert.equal(report.status, "passed", JSON.stringify(report.findings));
    assert.equal(report.files[0].lines === 100 && report.files[0].branches === 100 && report.files[0].functions === 100, true);
  });
});
