import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileHostModuleInIsolation } from "../scripts/host-isolated.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const compiler = resolve(repository, "node_modules/@typescript/native-preview/bin/tsgo.js");
const temporary = resolve(repository, ".temp/host-isolation-fixtures");
const model = "packages/host/src/model/contract.ts";
const contract = "packages/host/src/constants/contract.ts";
const implementation = "packages/host/src/constants/value.ts";
const lawful = new Map([
  [model, "export interface Fact { readonly value: number; }"],
  [contract, 'import type { Fact } from "../model/contract.js"; export interface Answer { readonly fact: Fact; }'],
  [implementation, 'import type { Fact } from "../model/contract.js"; export function value(fact: Fact): number { return fact.value + 1; }'],
]);

async function fixture(files, body) {
  mkdirSync(temporary, { recursive: true });
  const root = mkdtempSync(resolve(temporary, "case-"));
  try {
    for (const [file, text] of files) {
      mkdirSync(dirname(resolve(root, file)), { recursive: true });
      writeFileSync(resolve(root, file), text);
    }
    const input = { root, module: "constants", sourceFiles: [contract, implementation], dependencyContracts: [model],
      outputDirectory: ".temp/isolation" };
    return await body(input);
  } finally { rmSync(root, { recursive: true }); }
}

test("a complete whole module compiles against freshly checked declarations without peer implementations", async () => {
  await fixture(lawful, async input => {
    const result = await compileHostModuleInIsolation(input);
    assert.equal(result.kind, "passed", result.log.slice(0, 4096));
    assert.equal(Object.isFrozen(result), true);
    assert.equal((result.log.match(/strict compiler exit=0/gu) ?? []).length, 2,
      "both fresh dependency checking and the isolated current module ran");
    assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), [], "only this operation's rebuildable stage is disposed");
  });
});

test("private type-only dependencies cannot pass by including a peer implementation", async () => {
  const files = new Map(lawful);
  files.set(implementation, 'import type { Private } from "../model/private.js"; export function value(input: Private): number { return input.value; }');
  files.set("packages/host/src/model/private.ts", "export interface Private { readonly value: number; }");
  await fixture(files, async input => {
    const result = await compileHostModuleInIsolation(input);
    assert.equal(result.kind, "failed");
    assert.match(result.log, /isolated-compile/u);
    assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), []);
  });
});

test("fresh contract emission rejects private declaration leaks and never trusts a stale declaration", async () => {
  const files = new Map(lawful);
  files.set(model, 'export type Fact = import("./private.js").Private;');
  files.set("packages/host/src/model/private.ts", "export interface Private { readonly value: number; }");
  files.set("packages/host/dist/model/contract.d.ts", "export interface Fact { readonly value: number; }");
  await fixture(files, async input => {
    const result = await compileHostModuleInIsolation(input);
    assert.equal(result.kind, "failed");
    assert.match(result.log, /isolated-compile/u);
    assert.equal(existsSync(resolve(input.root, "packages/host/dist/model/contract.d.ts")), true,
      "the caller's unrelated output is neither used nor removed");
  });
});

test("strict dependency and module compiler failures are returned with actual diagnostics", async () => {
  for (const file of [model, implementation]) {
    const files = new Map(lawful);
    files.set(file, file === model ? "export interface Fact { readonly value: number; } export const broken: string = 1;"
      : "export function value(): number { return 'wrong'; }");
    await fixture(files, async input => {
      const result = await compileHostModuleInIsolation(input);
      assert.equal(result.kind, "failed");
      assert.match(result.log, /TS2322/u);
      assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), []);
    });
  }
});

test("successive isolation runs emit the actual current dependency rather than reuse an old success", async () => {
  await fixture(lawful, async input => {
    const first = await compileHostModuleInIsolation(input);
    assert.equal(first.kind, "passed", first.log.slice(0, 4096));
    writeFileSync(resolve(input.root, model), "export interface Fact { readonly value: string; }");
    const changed = await compileHostModuleInIsolation(input);
    assert.equal(changed.kind, "failed");
    assert.match(changed.log, /TS2322/u);
  });
});

test("source inventory, paths, contract closure and admitted execution are authenticated before compilation", async () => {
  await fixture(lawful, async input => {
    await assert.rejects(compileHostModuleInIsolation({ ...input, sourceFiles: [contract] }), /complete exact/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, module: "missing" }), /declared whole/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, dependencyContracts: [model, model] }), /distinct/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, outputDirectory: "../outside" }), /disposable/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, dependencyContracts: ["../outside.ts"] }), /canonical/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, dependencyContracts: [implementation] }), /original declared/u);
    symlinkSync(resolve(input.root, model), resolve(input.root, "packages/host/src/constants/hidden.ts"));
    await assert.rejects(compileHostModuleInIsolation(input), /symlink/u);
  });
  await fixture(lawful, async input => {
    const admission = process.env.TSONIC_TEST_ADMISSION;
    try {
      delete process.env.TSONIC_TEST_ADMISSION;
      await assert.rejects(compileHostModuleInIsolation(input), /admitted process-group/u);
    } finally { process.env.TSONIC_TEST_ADMISSION = admission; }
  });
});

test("tooling contracts are checked against the actual JavaScript implementations, not only declaration models", () => {
  const result = spawnSync(process.execPath, [compiler, "--ignoreConfig", "--strict", "--allowJs", "--checkJs", "false",
    "--noEmit", "--skipLibCheck", "false", "--types", "node", "--target", "es2022", "--module", "nodenext",
    resolve(repository, "test/architecture/tooling/host-gates.mjs"), resolve(repository, "test/scripts/host-isolated.mjs")],
  { cwd: repository, encoding: "utf8", maxBuffer: 1_048_576, timeout: 60_000 });
  if (result.error !== undefined) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`.slice(0, 8192));
});
