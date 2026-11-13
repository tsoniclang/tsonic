import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test, { before } from "node:test";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(repository, "package.json"), "utf8"));
// The patterns the normal entry gives node --test, read as data from the one place that states them.
const keys = ["testArchitecture", "testCases", "testUnits"];
const patterns = keys.map(key => manifest.config[key]);

before(() => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the entry cases run under the admitted process-group guard");
});

// The files node --test runs for the configured patterns in a directory, and its exit status. The child is a run of its own,
// not a file of this run: the variable that marks a test file's process is not passed on.
function ran(directory) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== "NODE_TEST_CONTEXT"));
  const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "--test-reporter=tap", ...patterns],
    { cwd: directory, env, encoding: "utf8", timeout: 60_000 });
  assert.equal(result.error, undefined, "node --test completes");
  return { status: result.status, files: [...result.stdout.matchAll(/^\s*ok \d+ - ran (\S+)$/gmu)].map(match => match[1]).sort() };
}

// The configured patterns that match no file in a directory: a required bank that is empty.
const emptyPatterns = directory => patterns.filter(pattern => globSync(pattern, { cwd: directory }).length === 0);

test("the normal entry gives node --test the three configured patterns, quoted so that node expands them", () => {
  const script = manifest.scripts.test;
  assert.equal(patterns.every(pattern => typeof pattern === "string" && pattern.endsWith("/**/*.test.mjs")), true, "three recursive entry patterns");
  for (const key of keys) assert.equal(script.includes(` "$npm_package_config_${key}"`), true, `the entry passes ${key}`);
  assert.equal(script.split(" --test --test-concurrency=1 ").length, 2, "one node --test invocation");
});

test("every configured pattern matches at least one test entry in this tree", () => {
  assert.deepEqual(emptyPatterns(repository), [], "no required bank is empty");
});

test("the configured patterns run every entry at any depth of the three roots and nothing else", () => {
  const parent = resolve(repository, ".temp/test-entry");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "tree-"));
  const write = (path, text) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), text); };
  const entry = path => write(path, `import test from "node:test";\ntest(${JSON.stringify(`ran ${path}`)}, () => {});\n`);
  try {
    for (const path of ["test/architecture/a.test.mjs", "test/host-cases/c.test.mjs", "test/host-units/u.test.mjs"]) entry(path);
    for (const path of ["test/host-units/helper.mjs", "test/host-units/x.cases.mjs", "test/host-units/fixtures/data.mjs"]) write(path, "export const value = 1;\n");
    assert.deepEqual(ran(root), { status: 0, files: ["test/architecture/a.test.mjs", "test/host-cases/c.test.mjs", "test/host-units/u.test.mjs"] },
      "the three entries run; a helper, a case module and a fixture do not");
    entry("test/host-units/sub/n.test.mjs");
    assert.deepEqual(ran(root).files.includes("test/host-units/sub/n.test.mjs"), true, "a nested unit entry runs");
    entry("test/architecture/new.test.mjs");
    assert.deepEqual(ran(root).files.includes("test/architecture/new.test.mjs"), true, "a new architecture entry runs");
    rmSync(resolve(root, "test/host-units/u.test.mjs"));
    assert.deepEqual(ran(root), { status: 0, files: ["test/architecture/a.test.mjs", "test/architecture/new.test.mjs", "test/host-cases/c.test.mjs",
      "test/host-units/sub/n.test.mjs"] }, "a removed entry is no longer run and nothing stale is named");
    assert.deepEqual(emptyPatterns(root), [], "every root still has an entry");
    rmSync(resolve(root, "test/host-cases"), { recursive: true });
    // node --test passes when a pattern matches nothing, so the empty bank is reported by the check above, not by node.
    assert.deepEqual(ran(root).status, 0, "node --test alone accepts an empty root");
    assert.deepEqual(emptyPatterns(root), [manifest.config.testCases], "the emptied case root is reported as an empty required bank");
  } finally {
    rmSync(root, { recursive: true });
  }
});
