import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

test("packaged target source entry publishes intrinsic receiver facts and keeps the Host program internal", async () => {
  const { createCompilerSessionFromFiles, formatDiagnostics } = await import("@tsonic/tsts");
  const target = await import("@tsonic/target-api/source");
  const host = await import("@tsonic/target-api/host");
  const { createJsSourceApiFacts } = await import("@tsonic/js-source-profile");
  // K-2668 (I1): the composition factories take the checked program, so they are Host-only (/host), never on /source.
  assert.equal(target.createTargetSourceProgram, undefined);
  assert.equal(typeof host.createTargetSourceProgram, "function");
  assert.equal(target.createHostSourceProgram, undefined);
  assert.equal(target.hostSourceProgramOf, undefined);
  assert.equal(typeof host.createHostSourceProgram, "function");
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      export const builtin = globalThis.Number;
      export function local(globalThis: { Number: number }): number { return globalThis.Number; }
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics));
  const source = host.createTargetSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
  assert.ok(Object.isFrozen(source));
  assert.equal(source.semantics, undefined);
  assert.equal(source.navigation, undefined);
  assert.equal(typeof source.facts.analyses.integerRange, "function");
  const file = checked.getSourceFile("/src/index.ts");
  const accesses = [];
  function visit(node) {
    if (source.syntax.is.IsPropertyAccessExpression(node)) accesses.push(node);
    source.syntax.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(accesses.length, 2);
  for (const [index, node] of accesses.entries()) {
    const selected = source.facts.selections.memberAccess(node);
    assert.ok(selected);
    assert.equal(selected.receiverValue?.intrinsic, index === 0 ? "global-object" : undefined);
    assert.ok(Object.isFrozen(selected));
  }
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

test("published source-fact packages exclude compiled tests and fixture helpers", () => {
  for (const directory of ["source-core", "target-api"]) {
    const packageRoot = resolve(repoRoot, "packages", directory);
    const packed = JSON.parse(run("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], packageRoot));
    assert.equal(packed.length, 1, `${directory}: one package boundary`);
    const files = packed[0].files.map(file => file.path);
    assert.equal(files.includes("dist/public/index.js") && files.includes("dist/public/index.d.ts"), true,
      `${directory}: current runtime and declaration entrypoints remain published`);
    assert.equal(files.some(file => /(?:\.test\.|fixtures)/u.test(file)), false,
      `${directory}: compiled test and fixture implementation stays workspace-local`);
  }
});

test("packed TSTS declarations and runtime expose exact literal and bounded encoder contracts", async () => {
  const scratch = resolve(repoRoot, ".temp/packed-tsts-contract");
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(resolve(scratch, "case-"));
  const packed = JSON.parse(run("npm", [
    "pack", "--json", "--ignore-scripts", "--pack-destination", root,
  ], resolve(repoRoot, "packages/tsts")));
  assert.equal(packed.length, 1);
  assert.equal(packed[0].name, "@tsonic/tsts");
  await writeFile(resolve(root, "package.json"), JSON.stringify({
    name: "packed-tsts-contract-proof", private: true, type: "module",
  }));
  run("npm", [
    "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund",
    "--no-package-lock", resolve(root, packed[0].filename),
  ], root);
  await writeFile(resolve(root, "proof.ts"), `
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import {
  AsSourceFile,
  defaultTargetAstEncodingLimits,
  encodeTargetSourceFileForPrinting,
  TargetAstEncodingError,
  type SourceFile,
  type TargetAstEncodingLimits,
} from "@tsonic/tsts/target-ast";

const installed = resolve("node_modules/@tsonic/tsts");
assert.equal(realpathSync(installed), installed);
assert.equal(import.meta.resolve("@tsonic/tsts"),
  pathToFileURL(resolve(installed, "dist/src/index.js")).href);
assert.equal(import.meta.resolve("@tsonic/tsts/target-ast"),
  pathToFileURL(resolve(installed, "dist/src/services/target-ast.js")).href);
const checked = createCompilerSessionFromFiles({
  currentDirectory: "/project",
  files: { "/project/index.ts": 'export const message = "😀 é"; export const values = [1, 2, 3];' },
  rootFiles: ["/project/index.ts"],
  compilerOptions: {
    module: "esnext", moduleResolution: "bundler", target: "es2025", strict: true,
  },
}).checkSource();
const diagnostics = checked.diagnostics.filter((entry) => entry !== undefined);
assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/project"));
const source = AsSourceFile(checked.sourceFiles.find((entry) =>
  checked.ast.getFileName(entry) === "/project/index.ts"));
assert.ok(source);
const sourceFile: SourceFile = source;
const queries = checked.getSourceFileQueries(sourceFile);
const literals: string[] = [];
const visit = (node: Parameters<typeof checked.ast.forEachChild>[0]): void => {
  if (checked.ast.is.IsStringLiteral(node)) {
    const value: string | undefined = queries.typeShape.getStringLiteralTypeValue(queries.checker.getTypeAtLocation(node));
    assert.notEqual(value, undefined);
    literals.push(value!);
  }
  checked.ast.forEachChild(node, visit);
};
visit(sourceFile);
assert.deepEqual(literals, ["😀 é"]);
assert.equal(queries.typeShape.getStringLiteralTypeValue(undefined), undefined);
const original: Uint8Array = encodeTargetSourceFileForPrinting(sourceFile);
const limits: TargetAstEncodingLimits = {
  ...defaultTargetAstEncodingLimits,
  maximumNodeRows: 4_194_304,
  maximumEncodedBytes: original.byteLength,
};
assert.ok(Object.isFrozen(defaultTargetAstEncodingLimits));
assert.equal(defaultTargetAstEncodingLimits.maximumNodeRows, 2_097_152);
assert.deepEqual(encodeTargetSourceFileForPrinting(sourceFile, undefined), original);
assert.deepEqual(encodeTargetSourceFileForPrinting(sourceFile, defaultTargetAstEncodingLimits), original);
assert.deepEqual(encodeTargetSourceFileForPrinting(sourceFile, limits), original);
assert.throws(() => encodeTargetSourceFileForPrinting(sourceFile, {
  ...limits, maximumEncodedBytes: original.byteLength - 1,
}), { name: "TargetAstEncodingError", message: /encoded size/ });
assert.throws(() => encodeTargetSourceFileForPrinting(sourceFile, {
  ...limits, maximumNodeRows: 1,
}), { name: "TargetAstEncodingError", message: /node rows/ });
assert.throws(() => encodeTargetSourceFileForPrinting(sourceFile, {
  ...limits, maximumNodeRows: NaN,
}), TargetAstEncodingError);
assert.deepEqual(encodeTargetSourceFileForPrinting(sourceFile), original);
console.log("packed TSTS bounded encoding proof passed");
`);
  run(resolve(repoRoot, "node_modules/.bin/tsgo"), [
    "--ignoreConfig", "--strict", "--skipLibCheck", "--module", "nodenext",
    "--moduleResolution", "nodenext", "--target", "es2022", "--types", "node",
    "--outDir", "out", "proof.ts",
  ], root);
  assert.match(run(process.execPath, ["out/proof.js"], root), /bounded encoding proof passed/u);
});

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.error, undefined, `${command}: ${result.error?.message}`);
  assert.equal(result.signal, null, `${command}: ${result.signal}`);
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function assertMissing(path) {
  await assert.rejects(
    () => access(path),
    { code: "ENOENT" },
  );
}
