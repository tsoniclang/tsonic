import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test, { before } from "node:test";
import { bankKeys, bankPatterns, emptyBanks } from "../scripts/required-banks.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(repository, "package.json"), "utf8"));
// The patterns the normal entry gives node --test, read through the one owner of that data.
const patterns = bankPatterns(repository);

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

test("the normal entry gives node --test the three configured patterns, quoted so that node expands them", () => {
  const script = manifest.scripts.test;
  assert.equal(patterns.every(pattern => typeof pattern === "string" && pattern.endsWith("/**/*.test.mjs")), true, "three recursive entry patterns");
  for (const key of bankKeys) assert.equal(script.includes(` "$npm_package_config_${key}"`), true, `the entry passes ${key}`);
  assert.equal(script.split(" --test --test-concurrency=1 ").length, 2, "one node --test invocation");
});

test("the guarded build, which runs before discovery, refuses an empty required bank", () => {
  assert.deepEqual(emptyBanks(repository), [], "no required bank of this tree is empty");
  const build = readFileSync(resolve(repository, "test/scripts/build.mjs"), "utf8");
  assert.equal(build.includes("emptyBanks(root)") && manifest.scripts.test.startsWith("env -u TSONIC_TEST_GUARD_REPORT npm run test:build && "), true,
    "npm test runs the build, and the build checks the banks, before node --test");
});

test("each required root, the architecture root included, is reported when it is empty or removed", () => {
  const parent = resolve(repository, ".temp/test-entry");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "banks-"));
  const write = (path, text) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), text); };
  const entries = ["test/architecture/a.test.mjs", "test/host-cases/c.test.mjs", "test/host-units/u.test.mjs"];
  const populate = () => {
    rmSync(resolve(root, "test"), { recursive: true, force: true });
    for (const path of entries) write(path, "export {};\n");
  };
  try {
    write("package.json", `${JSON.stringify({ config: manifest.config })}\n`);
    populate();
    assert.deepEqual(emptyBanks(root), [], "populated");
    rmSync(resolve(root, "test"), { recursive: true });
    for (const path of ["test/architecture/deep/a.test.mjs", "test/host-cases/deep/more/c.test.mjs", "test/host-units/sub/u.test.mjs"]) write(path, "export {};\n");
    assert.deepEqual(emptyBanks(root), [], "entries only below each root count");
    for (const [index, key] of bankKeys.entries()) {
      const directory = dirname(entries[index]);
      populate();
      rmSync(resolve(root, entries[index]));
      write(`${directory}/helper.mjs`, "export {};\n");
      assert.deepEqual(emptyBanks(root), [manifest.config[key]], `${key}: a root with no entry is reported`);
      populate();
      rmSync(resolve(root, directory), { recursive: true });
      assert.deepEqual(emptyBanks(root), [manifest.config[key]], `${key}: a removed root is reported`);
    }
  } finally {
    rmSync(root, { recursive: true });
  }
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
    rmSync(resolve(root, "test/host-cases"), { recursive: true });
    // node --test passes when a pattern matches nothing: the empty bank is refused by the build before discovery, not by node.
    assert.deepEqual(ran(root).status, 0, "node --test alone accepts an empty root");
  } finally {
    rmSync(root, { recursive: true });
  }
});
