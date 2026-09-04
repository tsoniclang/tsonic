import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const layoutModule = pathToFileURL(
  resolve(repositoryRoot, "test/scripts/workspace-layout.mjs"),
).href;

test("test workspace layout honors one explicit absolute repository root", () => {
  const workspaceRoot = resolve(repositoryRoot, ".temp/test-fixtures/release-workspace");
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `const value = await import(${JSON.stringify(layoutModule)}); process.stdout.write(JSON.stringify(value.testRepositoryRoots));`,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, TSONICLANG_WORKSPACE_ROOT: workspaceRoot },
    },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    tsonic: repositoryRoot,
    tsonicCsharp: resolve(workspaceRoot, "tsonic-csharp"),
    csharpJs: resolve(workspaceRoot, "csharp-js"),
    csharpNodejs: resolve(workspaceRoot, "csharp-nodejs"),
    csharpRuntime: resolve(workspaceRoot, "csharp-runtime"),
  });
});

test("test workspace layout rejects ambiguous relative roots", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", `await import(${JSON.stringify(layoutModule)});`],
    {
      encoding: "utf8",
      env: { ...process.env, TSONICLANG_WORKSPACE_ROOT: "relative-workspace" },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TSONICLANG_WORKSPACE_ROOT must be an absolute path/u);
});
