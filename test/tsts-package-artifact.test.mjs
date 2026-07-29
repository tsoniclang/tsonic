import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

test("vendored TSTS artifact exposes only the public package root", async () => {
  const root = await import("@tsonic/tsts");
  const explicitIndex = await import("@tsonic/tsts/index.js");

  assert.equal(typeof root.createCompilerSessionFromFiles, "function");
  assert.equal(typeof root.createCompilerHost, "function");
  assert.equal(typeof root.createInMemoryFileSystem, "function");
  assert.equal(typeof root.createAstReader, "function");
  assert.equal(typeof root.createTypeCheckerQueries, "function");
  assert.equal(typeof root.createTypeShapeQueries, "function");
  assert.equal(typeof root.createSourceFactQueries, "function");
  assert.equal(root.createCompilerSessionFromFiles, explicitIndex.createCompilerSessionFromFiles);

  await assert.rejects(
    () => import("@tsonic/tsts/dist/src/index.js"),
    (error) => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
  );
  await assert.rejects(
    () => import("@tsonic/tsts/src/index.js"),
    (error) => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
  );
});

test("vendored TSTS artifact contains dist output and no source-project tooling", async () => {
  const packageRoot = resolve(repoRoot, "packages/tsts");
  const manifest = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));

  assert.deepEqual(manifest.exports, {
    ".": {
      types: "./dist/src/index.d.ts",
      import: "./dist/src/index.js",
    },
    "./index.js": {
      types: "./dist/src/index.d.ts",
      import: "./dist/src/index.js",
    },
    "./package.json": "./package.json",
  });
  assert.equal(manifest.scripts, undefined);

  await access(resolve(packageRoot, "dist/src/index.js"));
  await access(resolve(packageRoot, "dist/src/index.d.ts"));
  await access(resolve(packageRoot, "dist/src/internal/bundled/libs_generated.d.ts"));
  await assertMissing(resolve(packageRoot, "src"));
  await assertMissing(resolve(packageRoot, "tools"));
  await assertMissing(resolve(packageRoot, "tsconfig.json"));
  await assertMissing(resolve(packageRoot, "tsonic.json"));
});

async function assertMissing(path) {
  await assert.rejects(
    () => access(path),
    { code: "ENOENT" },
  );
}
