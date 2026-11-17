import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runCase } from "./case.mjs";
import { compareCaseValues } from "./compare.mjs";
import { writeCaseEvidence } from "./evidence.mjs";

test("harness preserves complete host-number outcomes including nonfinite values and signed zero", () => {
  for (const [actual, expected, equal] of [
    [NaN, NaN, true], [Infinity, Infinity, true], [-Infinity, -Infinity, true],
    [-0, -0, true], [0, 0, true], [1, 1, true],
    [NaN, Infinity, false], [Infinity, -Infinity, false], [NaN, 0, false],
    [-0, 0, false], [NaN, "NaN", false], [Infinity, "Infinity", false],
  ]) {
    assert.equal(compareCaseValues({ value: actual, nested: [actual] },
      { value: expected, nested: [expected] }), equal);
  }
});

const repository = fileURLToPath(new URL("../../", import.meta.url));
const levels = (["function", "pass", "verifier", "pipeline", "corpus"]);
const diagnostic = ({ code: "FIXTURE_REFUSED", message: "The fixture input is refused.", site: { path: "input", start: 2, length: 1 }, evidence: ["fixture"], related: [] });
const accepted = ({ kind: "accepted", value: { state: { scale: 3 }, output: 12 }, diagnostics: [] });
const refused = ({ kind: "refused", diagnostics: [diagnostic] });

async function fixture(level, action, changes = {}) {
  const parent = resolve(repository, ".temp/host-s1-cases");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "case-"));
  const directory = `test/host-cases/analyses/liveness/${level}`;
  const descriptorPath = `${directory}/fixture.case.json`;
  const descriptor = { name: "fixture", level, rule: "harness-complete-result",
    input: `${directory}/fixture.input.json`, expected: `${directory}/fixture.expected.json`, ...changes };
  const write = (path, value) => {
    const destination = resolve(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, typeof value === "string" ? value : JSON.stringify(value));
  };
  const calls = [];
  const adapters = Object.fromEntries(levels.map(owner => [owner, input => {
    calls.push(owner);
    const data = JSON.parse(input.text);
    return data.refuse ? refused : { kind: "accepted", value: { state: data.state, output: data.state.scale * data.input }, diagnostics: [] };
  }]));
  const deps = {
    evidenceDirectory: resolve(parent, "evidence"),
    modules: ["analyses/liveness"], adapters,
    readText: path => readFileSync(resolve(root, path), "utf8"),
    canonical: path => relative(root, realpathSync(resolve(root, path))),
    list: path => readdirSync(resolve(root, path)), decode: text => JSON.parse(text),
  };
  write(descriptorPath, descriptor);
  write(`${directory}/fixture.input.json`, { state: { scale: 3 }, input: 4, refuse: false });
  write(`${directory}/fixture.expected.json`, accepted);
  try { await action({ root, descriptor, descriptorPath, deps, write, calls }); }
  finally { rmSync(root, { recursive: true }); }
}

for (const level of levels) {
  test(`harness ${level}: exact dispatch and complete accepted/refused vectors`, async () => {
    await fixture(level, async ({ descriptor, descriptorPath, deps, write, calls }) => {
      const result = await runCase(deps, descriptorPath);
      assert.equal(result.status, "passed");
      assert.equal(compareCaseValues(result.outcome, accepted), true);
      assert.equal(calls.join(","), level);
      write(descriptor.input, { state: { scale: 3 }, input: 4, refuse: true });
      write(descriptor.expected, refused);
      const negative = await runCase(deps, descriptorPath);
      assert.equal(negative.status, "passed");
      assert.equal(compareCaseValues(negative.outcome, refused), true);
    });
  });
}

test("all closed formats retain their exact adjacent input and expected names", async () => {
  for (const format of ["json", "ts", "hir", "tir", "mir", "facts", "program"]) {
    await fixture("function", async ({ descriptor, descriptorPath, deps, root, write }) => {
      const next = { ...descriptor, input: descriptor.input.replace(/json$/u, format), expected: descriptor.expected.replace(/json$/u, format) };
      if (format !== "json") {
        rmSync(resolve(root, descriptor.input));
        rmSync(resolve(root, descriptor.expected));
      }
      write(next.input, { state: { scale: 3 }, input: 4 });
      write(next.expected, accepted);
      write(descriptorPath, next);
      const reads = [];
      const result = await runCase({ ...deps, readText: path => { reads.push(path); return deps.readText(path); } }, descriptorPath);
      assert.equal(result.status, "passed", format);
      assert.equal(JSON.stringify(reads), JSON.stringify([descriptorPath, next.input, next.expected]), "only the three authored case files are read");
    });
  }
});

const descriptorOpposites = ([
  [{ name: "" }, "descriptor"], [{ level: "rule" }, "descriptor"], [{ level: "schema" }, "descriptor"],
  [{ rule: "" }, "descriptor"], [{ rule: null }, "descriptor"],
  [{ extra: true }, "descriptor"], [{ expected: undefined }, "descriptor"],
  [{ input: "../escape.input.json" }, "location"], [{ input: "/escape.input.json" }, "location"],
  [{ input: "test/host-cases/other/function/fixture.input.json" }, "location"],
  [{ input: "test/host-cases/analyses/liveness/function/wrong.input.json" }, "location"],
  [{ expected: "test/host-cases/analyses/liveness/function/fixture.expected.txt" }, "location"],
]);

test("harness rejects the whole independently authored descriptor opposite table", async () => {
  for (const [changes, code] of descriptorOpposites) await fixture("function", async ({ descriptorPath, deps }) => {
    const result = await runCase(deps, descriptorPath);
    assert.equal(result.status, "failed", JSON.stringify(changes));
    assert.equal(result.code, code, JSON.stringify(changes));
  }, changes);
  for (const value of [null, [], {}, { extra: true }]) await fixture("function", async ({ descriptorPath, deps, write }) => {
    write(descriptorPath, JSON.stringify(value));
    assert.equal((await runCase(deps, descriptorPath)).code, "descriptor");
  });
});

test("harness refuses missing, unexpected, aliased and malformed authored files without golden generation", async () => {
  await fixture("function", async ({ descriptorPath, descriptor, deps, root, write }) => {
    const invalid = ["../escape.case.json", "test/host-cases/case.mjs", "test/host-cases//fixture.case.json", "test/host-cases/unknown/function/fixture.case.json"];
    for (const path of invalid) assert.equal((await runCase(deps, path)).code, "descriptor");
    assert.equal((await runCase({ ...deps, modules: [] }, descriptorPath)).code, "location");
    assert.equal((await runCase({ ...deps, canonical: path => path === descriptorPath ? path : "elsewhere" }, descriptorPath)).code, "location");
    assert.equal((await runCase({ ...deps, canonical: () => "elsewhere" }, descriptorPath)).code, "descriptor");
    assert.equal((await runCase({ ...deps, adapters: {} }, descriptorPath)).code, "adapter");
    write(descriptor.expected, "{");
    assert.equal((await runCase(deps, descriptorPath)).code, "expected");
    rmSync(resolve(root, descriptor.expected));
    assert.equal((await runCase(deps, descriptorPath)).code, "expected");
    write(descriptor.expected, accepted);
    rmSync(resolve(root, descriptor.input));
    assert.equal((await runCase(deps, descriptorPath)).code, "input");
    write(descriptor.input, { state: { scale: 3 }, input: 4 });
    write(descriptor.input.replace("input", "actual"), accepted);
    assert.equal((await runCase(deps, descriptorPath)).code, "inventory");
    assert.equal(readdirSync(dirname(resolve(root, descriptor.expected))).includes("fixture.expected.json"), true);
  });
});

test("harness compares all diagnostic identity, text, sites, ordering, evidence and outcome fields", async () => {
  const wrong = [
    { kind: "accepted", value: 13, diagnostics: [] },
    { kind: "accepted", value: accepted.value, diagnostics: [diagnostic] },
    { kind: "accepted", value: accepted.value, diagnostics: [], extra: 1 },
    { kind: "refused", diagnostics: [] },
    { kind: "refused", diagnostics: [{ ...diagnostic, code: "OTHER" }] },
    { kind: "refused", diagnostics: [{ ...diagnostic, message: "wrong" }] },
    { kind: "refused", diagnostics: [{ ...diagnostic, site: { path: "input", start: 3, length: 1 } }] },
    { kind: "refused", diagnostics: [{ ...diagnostic, evidence: [] }] },
    { kind: "refused", diagnostics: [diagnostic, diagnostic] },
    { kind: "partial", diagnostics: [] },
  ];
  for (const expected of wrong) await fixture("function", async ({ descriptor, descriptorPath, deps, write }) => {
    write(descriptor.input, { state: { scale: 3 }, input: 4, refuse: expected.kind === "refused" });
    write(descriptor.expected, expected);
    const result = await runCase(deps, descriptorPath);
    assert.equal(result.status, "failed", JSON.stringify(expected));
  });
  for (const [left, right, expected] of [[null, {}, false], [[], {}, false], [[1], [], false], [{ x: 1 }, { x: 2 }, false],
    [{ x: [1, null] }, { x: [1, null] }, true], [false, false, true], ["1", 1, false]])
    assert.equal(compareCaseValues(left, right), expected);
  assert.equal(compareCaseValues(9223372036854775807n, 9223372036854775807n), true);
  assert.equal(compareCaseValues(new Array(1), new Array(1)), false);
  const cycle = {};
  cycle.self = cycle;
  assert.equal(compareCaseValues(cycle, cycle), false);
  assert.equal(compareCaseValues({ value: undefined }, { value: undefined }), false);
  assert.equal(compareCaseValues(new Map(), {}), false);
});

test("harness failures preserve complete actual and expected files without changing the authored golden", async () => {
  const retainedEvidence = [];
  await fixture("function", async ({ root, descriptor, descriptorPath, deps }) => {
    const golden = readFileSync(resolve(root, descriptor.expected), "utf8");
    const actual = { kind: "accepted", value: { number: -0, notNumber: NaN, large: 9223372036854775807n }, diagnostics: [] };
    const expected = { kind: "accepted", value: { number: 0, notNumber: Infinity, large: -9223372036854775808n }, diagnostics: [] };
    const supplied = { ...deps, adapters: { function: () => actual }, decode: () => expected };
    const first = await runCase(supplied, descriptorPath);
    const second = await runCase(supplied, descriptorPath);
    assert.equal(first.code, "mismatch");
    assert.equal(second.code, "mismatch");
    const files = result => result.detail.slice(result.detail.indexOf("Actual: ") + 8).split("\nExpected: ");
    const [actualPath, expectedPath] = files(first);
    retainedEvidence.push(actualPath, expectedPath);
    const [secondActualPath] = files(second);
    assert.notEqual(actualPath, secondActualPath);
    const check = (actualValue, expectedValue, label) => {
      if (compareCaseValues(actualValue, expectedValue)) return;
      const evidence = writeCaseEvidence(deps.evidenceDirectory, actualValue, expectedValue);
      assert.fail(label + " Actual: " + evidence.actual + " Expected: " + evidence.expected);
    };
    check(readFileSync(actualPath, "utf8"), '{"kind":"accepted","value":{"number":-0,"notNumber":NaN,"large":9223372036854775807n},"diagnostics":[]}\n', "complete actual evidence");
    check(readFileSync(expectedPath, "utf8"), '{"kind":"accepted","value":{"number":0,"notNumber":Infinity,"large":-9223372036854775808n},"diagnostics":[]}\n', "complete expected evidence");
    check(readFileSync(resolve(root, descriptor.expected), "utf8"), golden, "authored expected file unchanged");
    check(Object.keys(await runCase(deps, descriptorPath)).sort(), ["outcome", "path", "status"], "passing result shape unchanged");
  });
  for (const path of retainedEvidence) {
    assert.equal(readFileSync(path, "utf8").length > 0, true, "evidence survives fixture cleanup: " + path);
  }
});

test("failure evidence preserves complete scalar and ordered collection files", async () => {
  const rows = [
    ["booleans", true, false, "true\n", "false\n"],
    ["null and empty record", null, {}, "null\n", "{}\n"],
    ["empty and singleton arrays", [], [null], "[]\n", "[null]\n"],
    ["ordered several arrays", [true, false, null], [[true], {}, []], "[true,false,null]\n", "[[true],{},[]]\n"],
    ["singleton and ordered records", { only: null }, { first: true, second: false }, '{"only":null}\n', '{"first":true,"second":false}\n'],
    ["empty and escaped strings", "", 'quote"\\\n\t\r\b\f\u0000\ud800', '""\n', String.raw`"quote\"\\\n\t\r\b\f\u0000\ud800"` + "\n"],
    ["escaped keys and paired UTF16", { ['key"\\\n\udc00']: "pair😀" }, "😀pair", String.raw`{"key\"\\\n\udc00":"pair😀"}` + "\n", '"😀pair"\n'],
  ];
  await fixture("function", async ({ deps }) => {
    for (const [label, actual, expected, actualText, expectedText] of rows) {
      const evidence = writeCaseEvidence(deps.evidenceDirectory, actual, expected);
      for (const [path, completeText, side] of [
        [evidence.actual, actualText, "actual"],
        [evidence.expected, expectedText, "expected"],
      ]) {
        const persisted = readFileSync(path, "utf8");
        if (persisted !== completeText) {
          const failure = writeCaseEvidence(deps.evidenceDirectory, persisted, completeText);
          assert.fail(label + " " + side + " Actual: " + failure.actual + " Expected: " + failure.expected);
        }
      }
    }
  });
});

test("failure evidence retains a complete 100000-level value without recursive formatting", async () => {
  await fixture("function", async ({ deps }) => {
    let value = -0;
    for (let depth = 0; depth < 100000; depth += 1) value = [value];
    const evidence = writeCaseEvidence(deps.evidenceDirectory, value, null);
    const actual = readFileSync(evidence.actual, "utf8");
    const expected = "[".repeat(100000) + "-0" + "]".repeat(100000) + "\n";
    if (actual !== expected) {
      const failure = writeCaseEvidence(deps.evidenceDirectory, actual, expected);
      assert.fail("complete deep evidence Actual: " + failure.actual + " Expected: " + failure.expected);
    }
    const expectedValue = readFileSync(evidence.expected, "utf8");
    if (expectedValue !== "null\n") {
      const failure = writeCaseEvidence(deps.evidenceDirectory, expectedValue, "null\n");
      assert.fail("complete deep expected evidence Actual: " + failure.actual + " Expected: " + failure.expected);
    }
  });
});
