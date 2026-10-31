import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createProofPathResolver, currentProofs, proofMovesFromKeymap } from "../../scripts/proof-paths.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function fixture(context, files, moves = {}) {
  const workspaceRoot = mkdtempSync(resolve(repositoryRoot, ".temp/proof-paths-"));
  context.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));
  const repository = resolve(workspaceRoot, "tsonic");
  mkdirSync(repository, { recursive: true });
  for (const [path, source] of Object.entries(files)) {
    const target = resolve(workspaceRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return { workspaceRoot, repository, resolver: createProofPathResolver({ workspaceRoot, moves }) };
}

test("proof paths follow every exact split and retain unchanged current files", context => {
  const moves = { "tsonic/old.test.mjs": ["tsonic/part-1.test.mjs", "tsonic/part-2.test.mjs"] };
  const { repository, resolver } = fixture(context, {
    "tsonic/part-1.test.mjs": "",
    "tsonic/part-2.test.mjs": "",
    "tsonic/unchanged.test.mjs": "",
  }, moves);
  moves["tsonic/old.test.mjs"].push("tsonic/not-published.test.mjs");
  const actual = resolver.paths(repository, ["old.test.mjs", "unchanged.test.mjs", "old.test.mjs"]);
  assert.deepEqual(actual, ["part-1.test.mjs", "part-2.test.mjs", "unchanged.test.mjs"]);
  assert.equal(Object.isFrozen(actual), true);
  assert.deepEqual(resolver.paths(repository, ["old.test.mjs"]), ["part-1.test.mjs", "part-2.test.mjs"]);
});

test("proof paths keep the retained original part and every exact descendant", context => {
  const { repository, resolver } = fixture(context, {
    "tsonic/retained.test.mjs": "",
    "tsonic/next.test.mjs": "",
  }, { "tsonic/retained.test.mjs": ["tsonic/retained.test.mjs", "tsonic/next.test.mjs"] });
  assert.deepEqual(resolver.paths(repository, ["retained.test.mjs"]), ["retained.test.mjs", "next.test.mjs"]);
});

test("proof paths follow exact move chains and reject cyclic relations", context => {
  const { repository, resolver, workspaceRoot } = fixture(context, {
    "tsonic/current.test.mjs": "",
  }, {
    "tsonic/original.test.mjs": ["tsonic/intermediate.test.mjs"],
    "tsonic/intermediate.test.mjs": ["tsonic/current.test.mjs"],
  });
  assert.deepEqual(resolver.paths(repository, ["original.test.mjs"]), ["current.test.mjs"]);
  const cyclic = createProofPathResolver({ workspaceRoot, moves: {
    "tsonic/first.test.mjs": ["tsonic/second.test.mjs"],
    "tsonic/second.test.mjs": ["tsonic/first.test.mjs"],
  } });
  assert.throws(() => cyclic.paths(repository, ["first.test.mjs"]), /Cyclic proof move/u);
});

test("proof paths reject missing files directories and foreign or absolute references", context => {
  const { repository, resolver, workspaceRoot } = fixture(context, { "tsonic/current.test.mjs": "" });
  mkdirSync(resolve(repository, "directory"));
  assert.throws(() => resolver.paths(repository, ["missing.test.mjs"]), /ENOENT/u);
  assert.throws(() => resolver.paths(repository, ["directory"]), /not an executable evidence file/u);
  assert.throws(() => resolver.paths(repository, [resolve(repository, "current.test.mjs")]), /not relative/u);
  assert.throws(() => resolver.paths(repository, ["../../foreign.test.mjs"]), /canonical workspace domain/u);
  assert.throws(() => resolver.paths(dirname(workspaceRoot), ["current.test.mjs"]), /canonical workspace domain/u);
});

test("proof move declarations reject empty duplicate malformed and foreign targets", context => {
  const { workspaceRoot } = fixture(context, {});
  for (const moves of [
    null,
    [],
    { "tsonic/old.test.mjs": [] },
    { "tsonic/old.test.mjs": ["tsonic/current.test.mjs", "tsonic/current.test.mjs"] },
    { "tsonic/old.test.mjs": ["../foreign.test.mjs"] },
    { "tsonic/old.test.mjs": ["/foreign.test.mjs"] },
    { "tsonic/old.test.mjs": ["tsonic/./current.test.mjs"] },
    { "tsonic/old.test.mjs": ["tsonic\\current.test.mjs"] },
  ]) assert.throws(() => createProofPathResolver({ workspaceRoot, moves }), Error);
});

test("proof keymaps preserve exact module identities without filename inference", () => {
  const keymap = { files: [
    { module: "tsonic:test/original.test.mjs", parts: [
      { module: "tsonic:test/current-a.test.mjs" }, { module: "tsonic:test/current-b.test.mjs" },
    ] },
    { module: "tsonic-csharp:test/unchanged.test.mjs", parts: [{ module: "tsonic-csharp:test/unchanged.test.mjs" }] },
  ] };
  assert.deepEqual(proofMovesFromKeymap(keymap), {
    "tsonic/test/original.test.mjs": ["tsonic/test/current-a.test.mjs", "tsonic/test/current-b.test.mjs"],
  });
  assert.throws(() => proofMovesFromKeymap({ files: [...keymap.files, keymap.files[0]] }), /repeats an original/u);
  assert.throws(() => proofMovesFromKeymap({ files: [{ module: "tsonic:../outside", parts: [] }] }), /canonical workspace domain/u);
  assert.throws(() => proofMovesFromKeymap({ files: [{ module: "tsonic:test/original.test.mjs", parts: [] }] }), /no current parts/u);
});

test("proof test lookup reads the unique original literal without executing its module", async context => {
  const statement = 'test("original key", () => { const program = ["const value = 7;"].join("\\n"); });';
  const { repository, resolver } = fixture(context, {
    "tsonic/part-1.test.mjs": 'throw new Error("must never execute");\n// test("original key", () => {});\n',
    "tsonic/part-2.test.mjs": 'const text = "unicode λ";\n' + statement + '\n',
  }, { "tsonic/original.test.mjs": ["tsonic/part-1.test.mjs", "tsonic/part-2.test.mjs"] });
  const actual = await resolver.readTest(repository, "original.test.mjs", "original key");
  assert.equal(actual.path, "part-2.test.mjs");
  assert.equal(actual.name, "original key");
  assert.equal(actual.source.trim(), statement);
  assert.equal(Object.isFrozen(actual), true);
});

test("proof test lookup rejects missing and duplicate exact original keys", async context => {
  const { repository, resolver } = fixture(context, {
    "tsonic/part-1.test.mjs": 'test("same key", () => {});',
    "tsonic/part-2.test.mjs": 'test("same key", () => {});',
  }, { "tsonic/original.test.mjs": ["tsonic/part-1.test.mjs", "tsonic/part-2.test.mjs"] });
  await assert.rejects(resolver.readTest(repository, "original.test.mjs", "absent key"), /exactly once.*\(0\)/u);
  await assert.rejects(resolver.readTest(repository, "original.test.mjs", "same key"), /exactly once.*\(2\)/u);
});

test("proof test lookup preserves the selected sibling repository domain", async context => {
  const { repository, resolver } = fixture(context, {
    "tsonic-csharp/test/current.test.mjs": 'test("native proof", () => {});',
  }, { "tsonic-csharp/test/old.test.mjs": ["tsonic-csharp/test/current.test.mjs"] });
  const actual = await resolver.readTest(repository, "../tsonic-csharp/test/old.test.mjs", "native proof");
  assert.equal(actual.path, "../tsonic-csharp/test/current.test.mjs");
  assert.equal(actual.source.trim(), 'test("native proof", () => {});');
});

test("published proof relations resolve every declared current descendant", () => {
  const data = JSON.parse(readFileSync(resolve(repositoryRoot, "test/fixtures/proof-paths.json"), "utf8"));
  assert.equal(data.schemaVersion, 1);
  const workspaceRoot = resolve(repositoryRoot, "..");
  const expected = new Set(Object.values(data.moves).flat());
  const actual = currentProofs.paths(workspaceRoot, Object.keys(data.moves));
  assert.deepEqual(new Set(actual), expected);
  assert.equal(actual.every(path => path.endsWith(".test.mjs") || path.endsWith(".test.ts")), true);
});
