import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { before } from "node:test";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const sourceDirectory = "packages/host/src/step";
const emittedDirectory = resolve(repository, "packages/host/dist/step");
const ownedSources = ["contract.ts", "index.ts"].map(name => `${sourceDirectory}/${name}`);
let evidenceDirectory;

before(() => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined && process.env.TSONIC_TEST_ADMISSION_OWNER !== undefined,
    true, "all owner tests and compiler children require the admitted aggregate process-group guard");
  const parent = resolve(repository, ".temp/host-f-step");
  mkdirSync(parent, { recursive: true });
  evidenceDirectory = mkdtempSync(resolve(parent, "proof-"));
});

test("the catalogue owns step as one data-only library that imports nothing", () => {
  const rows = hostCatalogue.filter(module => module.name === "step");
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.kind, "library");
  assert.deepEqual(row.imports, []);
  assert.deepEqual(row.effects, []);
  assert.equal(row.contract, `${sourceDirectory}/contract.ts`);
  assert.equal(row.entry, `${sourceDirectory}/index.ts`);
});

test("the complete actual step module passes fresh strict isolation with no gate finding", async () => {
  const data = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
  const report = await compileIsolated(isolationDeps(tooling, data.areas.map(area => area.directory)),
    hostCatalogue.find(module => module.name === "step"), {
      root: repository, sourceFiles: ownedSources, interfaceSources: [], declarationSources: [],
      outputDirectory: ".temp/host-f-step/isolation",
    });
  writeFileSync(resolve(evidenceDirectory, "isolation.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", `${JSON.stringify(report.findings)}\n${report.diagnostics.join("\n")}`);
  assert.deepEqual(report.findings, []);
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
  assert.equal(report.loadedInventory.some(path => path.endsWith("/packages/host/src/step/contract.ts")), true);
});

test("the emitted step modules export no runtime value", async () => {
  assert.deepEqual(readdirSync(emittedDirectory).filter(name => name.endsWith(".js")).sort(), ["contract.js", "index.js"]);
  for (const name of ["contract.js", "index.js"]) {
    const module = await import(pathToFileURL(resolve(emittedDirectory, name)).href);
    assert.deepEqual(Object.keys(module), [], `${name} has no runtime export`);
  }
});

test("fresh genuine emitted declarations admit both arms and reject an empty batch, a third arm and mutation exactly", () => {
  const stage = mkdtempSync(resolve(evidenceDirectory, "consumer-"));
  mkdirSync(resolve(stage, "step"));
  const declarations = readdirSync(emittedDirectory).filter(name => name.endsWith(".d.ts")).sort();
  assert.deepEqual(declarations, ["contract.d.ts", "index.d.ts"]);
  for (const name of declarations) writeFileSync(resolve(stage, "step", name), readFileSync(resolve(emittedDirectory, name)));
  writeFileSync(resolve(stage, "package.json"), JSON.stringify({ type: "module", private: true }));
  const header = 'import type { Step } from "./step/index.js";\n' +
    'type Request = { readonly kind: "first"; readonly key: number } | { readonly kind: "second"; readonly name: string };\n' +
    'type Work = Step<number, Request, string>;\n';
  const positive = `import type { Step as ContractStep } from "./step/contract.js";\n${header}` +
    'export const done: Work = { kind: "done", value: 1 };\n' +
    'export const one: Work = { kind: "paused", requests: [{ kind: "first", key: 1 }], paused: "state" };\n' +
    'export const several: ContractStep<number, Request, string> = { kind: "paused", requests: [{ kind: "first", key: 1 }, { kind: "second", name: "x" }, { kind: "first", key: 2 }], paused: "state" };\n' +
    'export const same: Work = several;\n' +
    'export function head(step: Work): Request | number { return step.kind === "paused" ? step.requests[0] : step.value; }\n' +
    'export function state(step: Work): string | number { switch (step.kind) { case "done": return step.value; case "paused": return step.paused; } }\n';
  writeFileSync(resolve(stage, "consumer.ts"), positive);
  const compiler = resolve(tooling, "node_modules/@typescript/native-preview/bin/tsgo.js");
  const configuration = files => ({ compilerOptions: {
    strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true,
    noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true,
    skipLibCheck: false, noEmit: true, target: "ES2022", lib: ["ES2022"], types: [],
    module: "NodeNext", moduleResolution: "NodeNext", verbatimModuleSyntax: true,
  }, files });
  const run = (name, files) => {
    writeFileSync(resolve(stage, name), JSON.stringify(configuration(files)));
    const result = spawnSync(process.execPath, [compiler, "--project", resolve(stage, name), "--pretty", "false", "--listFiles"], {
      cwd: stage, encoding: "utf8", maxBuffer: 1_048_576, timeout: 90_000,
    });
    assert.equal(result.error === undefined, true, "the real consumer compiler completes without application error");
    assert.equal(result.signal, null);
    const text = `${result.stdout}${result.stderr}`;
    writeFileSync(resolve(stage, `${name}.log`), text);
    return { status: result.status, text };
  };
  const accepted = run("positive.json", ["consumer.ts"]);
  assert.equal(accepted.status, 0, accepted.text);
  const loaded = accepted.text.split(/\r?\n/u).filter(path => path.startsWith(stage));
  assert.deepEqual(loaded.map(path => relative(stage, path).split(sep).join("/")).sort(),
    ["consumer.ts", "step/contract.d.ts", "step/index.d.ts"]);
  const negatives = [
    ["empty-batch.ts", `${header}export const empty: Work = { kind: "paused", requests: [], paused: "state" };`, 2322],
    ["third-arm.ts", `${header}export const pending: Work = { kind: "pending", paused: "state" };`, 2322],
    ["foreign-request.ts", `${header}export const foreign: Work = { kind: "paused", requests: [{ kind: "third" }], paused: "state" };`, 2322],
    ["wrong-done-value.ts", `${header}export const wrong: Work = { kind: "done", value: "text" };`, 2322],
    ["mutable-batch.ts", `${header}export function grow(step: Work): void { if (step.kind === "paused") step.requests.push({ kind: "first", key: 3 }); }`, 2339],
    ["readonly-value.ts", `${header}export function update(step: Work): void { if (step.kind === "done") step.value = 2; }`, 2540],
    ["readonly-paused.ts", `${header}export function replace(step: Work): void { if (step.kind === "paused") step.paused = "other"; }`, 2540],
    ["unnarrowed-requests.ts", `${header}export function requests(step: Work): number { return step.requests.length; }`, 2339],
  ];
  for (const [name, text] of negatives) writeFileSync(resolve(stage, name), text);
  const refused = run("negative.json", negatives.map(([name]) => name));
  assert.equal(refused.status, 1, refused.text);
  const actual = [...refused.text.matchAll(/^(.+)\(\d+,\d+\): error TS(\d+):/gmu)]
    .map(match => [basename(match[1]), Number(match[2])]).sort(([left], [right]) => left.localeCompare(right));
  assert.equal([...refused.text.matchAll(/error TS\d+:/gu)].length, actual.length, refused.text);
  const expected = negatives.map(([name, , code]) => [name, code]).sort(([left], [right]) => left.localeCompare(right));
  assert.deepEqual(actual, expected, refused.text);
});
