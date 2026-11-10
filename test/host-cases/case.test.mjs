import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runCase } from "./case.mjs";
import { compareCaseValues } from "./compare.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const quarantineData = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
const levels = Object.freeze(["function", "pass", "verifier", "pipeline", "corpus"]);
const diagnostic = Object.freeze({ code: "FIXTURE_REFUSED", message: "The fixture input is refused.", site: { path: "input", start: 2, length: 1 }, evidence: ["fixture"], related: [] });
const accepted = Object.freeze({ kind: "accepted", value: { state: { scale: 3 }, output: 12 }, diagnostics: [] });
const refused = Object.freeze({ kind: "refused", diagnostics: [diagnostic] });

async function fixture(level, action, changes = {}) {
  const parent = resolve(repository, ".temp/host-s1-cases");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "case-"));
  const directory = `test/host-cases/analyses/liveness/${level}`;
  const descriptorPath = `${directory}/fixture.case.json`;
  const descriptor = { name: "fixture", level, rule: "harness-complete-result", oldSource: null,
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
      assert.equal(Object.isFrozen(result), true);
      write(descriptor.input, { state: { scale: 3 }, input: 4, refuse: true });
      write(descriptor.expected, refused);
      const negative = await runCase(deps, descriptorPath);
      assert.equal(negative.status, "passed");
      assert.equal(compareCaseValues(negative.outcome, refused), true);
    });
  });
}

test("harness citations never become file reads and all closed formats retain their exact adjacent names", async () => {
  for (const format of ["json", "ts", "hir", "tir", "mir", "facts", "program"]) {
    await fixture("function", async ({ descriptor, descriptorPath, deps, root, write }) => {
      const next = { ...descriptor, input: descriptor.input.replace(/json$/u, format), expected: descriptor.expected.replace(/json$/u, format),
        oldSource: { area: "modular", path: `${quarantineData.oldRoots.tests.hostSpec}/runner/assertions.mjs`, test: "ordered domain" } };
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
      assert.equal(reads.some(path => path.includes("runner")), false, "oldSource remains citation-only");
    });
  }
});

const descriptorOpposites = Object.freeze([
  [{ name: "" }, "descriptor"], [{ level: "rule" }, "descriptor"], [{ level: "schema" }, "descriptor"],
  [{ rule: "" }, "descriptor"], [{ rule: null }, "descriptor"], [{ oldSource: {} }, "citation"],
  [{ oldSource: { area: "elsewhere", path: "test/old.ts", test: "test" } }, "citation"],
  [{ oldSource: { area: "reference", path: "../escape.ts", test: "test" } }, "citation"],
  [{ oldSource: { area: "reference", path: "test/old.ts", test: "" } }, "citation"],
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
