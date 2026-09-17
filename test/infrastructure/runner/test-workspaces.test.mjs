import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createTestWorkspace } from "../../scripts/test-workspaces.mjs";
import { tsonicRoot } from "../../scripts/workspace-layout.mjs";

const scratch = join(tsonicRoot, ".temp/test-workspace-lifecycle");
const helperUrl = new URL("../../scripts/test-workspaces.mjs", import.meta.url).href;

function fixture(body) {
  const root = createTestWorkspace(scratch, "case-");
  const file = join(root, "worker.test.mjs");
  const parent = join(root, ".temp");
  const record = join(root, "workspaces.json");
  writeFileSync(file, `
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestWorkspace } from ${JSON.stringify(helperUrl)};
const parent = ${JSON.stringify(parent)};
const record = ${JSON.stringify(record)};
const directory = createTestWorkspace(parent, "project-");
writeFileSync(record, JSON.stringify([directory]));
${body}
`);
  return { root, file, parent, record };
}

function childEnvironment() {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  return environment;
}

function runFixture(current) {
  return spawnSync(process.execPath, ["--test", "--test-reporter=tap", current.file], {
    encoding: "utf8", timeout: 15_000, env: childEnvironment(),
  });
}

function directories(current) {
  return JSON.parse(readFileSync(current.record, "utf8"));
}

test("successful workspaces survive assertions and hooks, then disappear at process exit", () => {
  const current = fixture(`
test("native artifacts", () => {
  for (const relative of ["target/debug", "bin/Debug", "obj/Debug"]) {
    mkdirSync(join(directory, relative), { recursive: true });
    writeFileSync(join(directory, relative, "artifact"), "compiled");
  }
  writeFileSync(join(directory, "source.ts"), "export const answer = 42;");
});
test("later consumer", () => assert.equal(readFileSync(join(directory, "target/debug/artifact"), "utf8"), "compiled"));
after(() => assert.equal(readFileSync(join(directory, "source.ts"), "utf8"), "export const answer = 42;"));
`);
  const result = runFixture(current);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(existsSync(current.parent));
  assert.ok(directories(current).every(directory => !existsSync(directory)));
});

for (const [label, body] of [
  ["test failure", 'test("failure", () => assert.fail("fixture failure"));'],
  ["hook failure", 'test("success", () => {}); after(() => assert.fail("hook failure"));'],
  ["nonzero process exit", 'process.exitCode = 7;'],
]) {
  test(`${label} retains the workspace and reports its location`, () => {
    const current = fixture(`writeFileSync(join(directory, "evidence.log"), "native failure");\n${body}`);
    const result = runFixture(current);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    const [directory] = directories(current);
    assert.equal(readFileSync(join(directory, "evidence.log"), "utf8"), "native failure");
    assert.match(result.stdout + result.stderr, /Retained failed test workspace:/u);
  });
}

test("terminated test processes retain their workspaces", () => {
  const current = fixture(`process.kill(process.pid, "SIGTERM");`);
  const result = runFixture(current);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(directories(current).every(directory => existsSync(directory)));
});

test("fatal initialization errors retain evidence even when Node bypasses exit hooks", () => {
  const current = fixture(`writeFileSync(join(directory, "evidence.log"), "native failure"); throw new Error("fixture error");`);
  const result = runFixture(current);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /fixture error/u);
  const [directory] = directories(current);
  assert.equal(readFileSync(join(directory, "evidence.log"), "utf8"), "native failure");
});

test("existing siblings, caches and symlink targets are never removed", () => {
  const current = fixture(`
const old = join(parent, "existing");
mkdirSync(old);
writeFileSync(join(old, "source"), "retain");
symlinkSync(old, join(directory, "node_modules"), "dir");
test("success", () => assert.equal(readFileSync(join(directory, "node_modules/source"), "utf8"), "retain"));
`);
  const result = runFixture(current);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(readFileSync(join(current.parent, "existing/source"), "utf8"), "retain");
  assert.ok(directories(current).every(directory => !existsSync(directory)));
});

test("a replaced workspace is retained and fails cleanup", () => {
  const current = fixture(`
renameSync(directory, directory + ".saved");
symlinkSync(directory + ".saved", directory, "dir");
test("success", () => {});
`);
  const result = runFixture(current);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /identity changed/u);
  const [directory] = directories(current);
  assert.ok(existsSync(directory));
  assert.ok(existsSync(directory + ".saved"));
});

test("a workspace already removed by its owner is harmless", () => {
  const current = fixture(`rmSync(directory, { recursive: true }); test("success", () => {});`);
  const result = runFixture(current);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("cleanup failures fail the run instead of silently leaking successful workspaces", () => {
  const current = fixture(`chmodSync(parent, 0o500); test("success", () => {});`);
  const result = runFixture(current);
  chmodSync(current.parent, 0o700);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /Test workspace cleanup failed/u);
  assert.ok(directories(current).every(directory => existsSync(directory)));
});

test("a linked scratch parent owns only the newly allocated physical directory", () => {
  const current = fixture(`
const linked = join(parent, "linked");
const physical = join(parent, "physical");
mkdirSync(physical);
symlinkSync(physical, linked, "dir");
const second = createTestWorkspace(linked, "second-");
writeFileSync(record, JSON.stringify([directory, second]));
test("success", () => assert.equal(second.startsWith(physical), true));
`);
  const result = runFixture(current);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(existsSync(join(current.parent, "physical")));
  assert.ok(directories(current).every(directory => !existsSync(directory)));
});

test("concurrent workers cannot clean each other's workspaces", async () => {
  const current = fixture(`
test("wait", async () => {
  process.stdout.write("WORKSPACE_READY\\n");
  await new Promise(resolve => process.stdin.once("data", resolve));
  assert.ok(existsSync(directory));
});
`);
  const child = spawn(process.execPath, [current.file], { env: childEnvironment(), stdio: ["pipe", "pipe", "pipe"] });
  const closed = new Promise(resolve => child.once("close", (code, signal) => resolve({ code, signal })));
  let output = "";
  child.stderr.on("data", data => { output += data; });
  const timeout = setTimeout(() => child.kill("SIGTERM"), 15_000);
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", () => reject(new Error(`Worker exited before readiness: ${output}`)));
      child.stdout.on("data", data => {
        output += data;
        if (output.includes("WORKSPACE_READY")) resolve();
      });
    });
    const [activeDirectory] = directories(current);
    const other = fixture('test("success", () => {});');
    const result = runFixture(other);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(existsSync(activeDirectory));
    child.stdin.end("finish\n");
    assert.deepEqual(await closed, { code: 0, signal: null }, output);
    assert.equal(existsSync(activeDirectory), false);
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await closed;
  }
});

test("invalid parents and prefixes never allocate a workspace", () => {
  const current = createTestWorkspace(scratch, "invalid-");
  for (const parent of ["relative/.temp", join(tsonicRoot, ".temp", "..", "not-scratch"), "/", undefined]) {
    assert.throws(() => createTestWorkspace(parent, "project-"), /absolute .temp or .tests/u);
  }
  for (const prefix of ["", ".", "..", "../escape-", "/absolute", "bad\0prefix", undefined]) {
    assert.throws(() => createTestWorkspace(current, prefix), /nonempty file names/u);
  }
});
