import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

test("vendored TSTS artifact exposes only the approved public entrypoints", async () => {
  const root = await import("@tsonic/tsts");
  const explicitIndex = await import("@tsonic/tsts/index.js");
  const targetAst = await import("@tsonic/tsts/target-ast");

  assert.equal(typeof root.createCompilerSessionFromFiles, "function");
  assert.equal(typeof root.createCompilerSessionFromProgram, "function");
  assert.equal(typeof root.createCompilerSession, "function");
  assert.equal(typeof root.createCompilerHost, "function");
  assert.equal(typeof root.createInMemoryFileSystem, "function");
  assert.equal(typeof root.createSourceSemanticsExtension, "function");
  assert.equal(root.createAstReader, undefined);
  assert.equal(root.createTypeCheckerQueries, undefined);
  assert.equal(root.createTypeShapeQueries, undefined);
  assert.equal(root.createSourceFactQueries, undefined);
  assert.equal(root.transformTargetSourceFile, undefined);
  assert.equal(root.createCompilerSessionFromFiles, explicitIndex.createCompilerSessionFromFiles);
  assert.equal(typeof targetAst.transformTargetSourceFile, "function");
  assert.equal(typeof targetAst.encodeTargetSourceFileForPrinting, "function");
  assert.equal(typeof targetAst.NodeFactory_NewNodeList, "function");

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
  const workspaceManifest = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
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
    "./target-ast": {
      types: "./dist/src/services/target-ast.d.ts",
      import: "./dist/src/services/target-ast.js",
    },
    "./package.json": "./package.json",
  });
  assert.equal(manifest.scripts, undefined);
  assert.equal(manifest.private, undefined);
  assert.equal(manifest.version, workspaceManifest.version);
  assert.equal(manifest.engines.node, ">=22.18.0");

  await access(resolve(packageRoot, "dist/src/index.js"));
  await access(resolve(packageRoot, "dist/src/index.d.ts"));
  await access(resolve(packageRoot, "dist/src/services/target-ast.js"));
  await access(resolve(packageRoot, "dist/src/services/target-ast.d.ts"));
  await access(resolve(packageRoot, "dist/src/internal/bundled/libs_generated.d.ts"));
  await assertMissing(resolve(packageRoot, "src"));
  await assertMissing(resolve(packageRoot, "tools"));
  await assertMissing(resolve(packageRoot, "tsconfig.json"));
  await assertMissing(resolve(packageRoot, "tsonic.json"));
});

test("published packages exclude incremental compiler state", async () => {
  for (const directory of ["source-core", "target-api", "js-source-profile", "host", "cli"]) {
    const manifest = JSON.parse(await readFile(
      resolve(repoRoot, "packages", directory, "package.json"),
      "utf8",
    ));
    assert.ok(
      manifest.files.includes("!dist/**/*.tsbuildinfo"),
      `${directory} must exclude incremental compiler state from its npm artifact`,
    );
  }
});

async function assertMissing(path) {
  await assert.rejects(
    () => access(path),
    { code: "ENOENT" },
  );
}
