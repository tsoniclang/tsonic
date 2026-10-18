import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseKeelArguments, runKeelChecks } from "./tooling/keel-check.mjs";
import { keelDefaultManifest } from "./tooling/keel-owned-contracts.mjs";
import { readKeelDeclarations } from "./tooling/keel-declarations.mjs";
import { readKeelDeterminism, validateKeelManifest } from "./tooling/keel-workspace.mjs";
import { keelFixtureGeneration, keelFixtureHas } from "./tooling/keel-test-fixtures.mjs";
import { evaluateKeelDeterminism } from "./tooling/keel-certification-checks.mjs";
import { collectFiles, readSourceInventory } from "./tooling/file-inventory.mjs";
import { evaluateKeelRuntimeFamilies, keelRuntimeRoots } from "./tooling/keel-structure-checks.mjs";
import { keelOwnedDeterminismPrograms, readKeelProgramInputs } from "./tooling/keel-determinism-contracts.mjs";

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../.temp/keel-architecture");
mkdirSync(fixtureRoot, { recursive: true });

test("committed Keel contracts and public declaration inputs do not require private analysis or generated host builds", () => {
  const manifest = keelDefaultManifest();
  validateKeelManifest(manifest);
  assert.equal(JSON.stringify(manifest).includes(".analysis"), false);
  assert.equal(Object.keys(manifest.basePins).length, 15);
  assert.equal(manifest.runtimeFamilies.length > 0, true);
  assert.equal(manifest.nodeModules["csharp-nodejs"].length, 24);
  assert.equal(manifest.nodeModules["rust-nodejs"].length, 25);
  assert.equal(manifest.determinismPrograms.length, 209);
  assert.equal(manifest.determinismPrograms.filter(program => program.expectation.kind === "source-rejected").length, 18);
  assert.throws(() => validateKeelManifest({ ...manifest, determinismPrograms: manifest.determinismPrograms.slice(1) }), /cannot omit/u);
  const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const inputs = readKeelDeclarations(workspace);
  assert.equal(inputs.declarationFiles.has("external/tsonic/packages/target-api/src/artifacts.ts"), true);
  assert.equal(inputs.modulePaths["@tsonic/tsts"][0] === "external/tsonic/packages/tsts/dist/src/index.d.ts", true);
  assert.equal(inputs.modulePaths["@tsonic/target-api/analysis"]?.length === 1, true);
  assert.equal(inputs.declarationFiles.size > 0, true);
  assert.equal(/^[a-f0-9]{64}$/u.test(inputs.inputDigest), true);
  for (const invalid of [
    { ...manifest, basePins: { tsonic: "a".repeat(40) } },
    { ...manifest, targets: { "tsonic-rust": {} } },
    { ...manifest, runtimeFamilies: undefined },
  ]) assert.throws(() => validateKeelManifest(invalid), /must pin/u);
});

test("committed runtime responsibilities cover actual native sources without broad missing-source exceptions", () => {
  const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const sources = new Map(Object.entries(keelRuntimeRoots).map(([repo, prefix]) => [repo,
    new Map([...readSourceInventory(resolve(workspace, repo, prefix), {
      extensions: [".rs", ".cs"], exclude: ["obj", "bin"],
    })].map(([file, text]) => [`${prefix}/${file}`, text])),
  ]));
  const result = evaluateKeelRuntimeFamilies(sources, keelDefaultManifest().runtimeFamilies);
  assert.equal(result.findings.length, 0, result.findings.map(entry => `${entry.repo}:${entry.file}: ${entry.reason}`).slice(0, 8).join("\n"));
  assert.equal(result.capabilityGaps.some(row => row.api === "node:sqlite"), true);
});

test("the fixed generation scope has real source owners, exact raw inputs, and no private catalogue fallback", () => {
  const root = mkdtempSync(resolve(fixtureRoot, "source-inputs-"));
  try {
    const program = keelOwnedDeterminismPrograms.find(entry => entry.id === "tsumo/rust/engine");
    mkdirSync(resolve(root, "tsumo-rust/packages/engine/src"), { recursive: true });
    writeFileSync(resolve(root, "tsumo-rust/packages/engine/src/index.ts"), "export const value = 1;");
    const first = readKeelProgramInputs(root, program);
    mkdirSync(resolve(root, "tsumo-rust/packages/engine/out"));
    writeFileSync(resolve(root, "tsumo-rust/packages/engine/out/generated.rs"), "ignored generated artifacts");
    assert.equal(readKeelProgramInputs(root, program), first);
    writeFileSync(resolve(root, "tsumo-rust/packages/engine/src/index.ts"), "export const value = 2;");
    assert.equal(readKeelProgramInputs(root, program) !== first, true);
    const catalogue = keelOwnedDeterminismPrograms.find(entry => entry.family === "catalogue");
    assert.throws(() => readKeelProgramInputs(root, catalogue), /ENOENT/u);
    assert.equal(collectFiles(root).some(file => file.includes(".analysis")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("CLI cannot turn final certification into a baseline pass or replace an inventory while consuming it", () => {
  assert.deepEqual(parseKeelArguments(["--final"]), { final: true });
  for (const arguments_ of [
    ["--unknown"], ["--manifest"], ["--final", "--final"],
    ["--write-baseline", "new.json", "--shrink-baseline", "shrunk.json"],
    ["--baseline", "old.json", "--write-baseline", "new.json"],
  ]) assert.throws(() => parseKeelArguments(arguments_), /Unknown|duplicate|needs|separate|cannot/u);
  for (const option of ["--baseline", "--write-baseline", "--shrink-baseline"]) {
    assert.throws(() => parseKeelArguments(["--final", option, "inventory.json"]), /unconditional/u);
    assert.throws(() => runKeelChecks(["--final", option, "inventory.json"]), /unconditional/u);
  }
});

test("AC11 evidence adapter reads complete real output trees and drained guard summaries, rejects omissions and escapes", () => {
  const root = mkdtempSync(resolve(fixtureRoot, "artifacts-"));
  const outside = mkdtempSync(resolve(fixtureRoot, "outside-"));
  try {
    const { programs, samples } = keelFixtureGeneration();
    const packetSamples = samples.map((sample, index) => {
      const directories = [`${index}/first`, `${index}/second`];
      for (const directory of directories) {
        mkdirSync(resolve(root, directory), { recursive: true });
        writeFileSync(resolve(root, directory, "source.txt"), "native source");
      }
      for (const side of ["first", "second"]) {
        const guard = side === "first" ? sample.firstGuard : sample.secondGuard;
        writeFileSync(resolve(root, `${index}/${side}-guard.json`), JSON.stringify(guard));
        writeFileSync(resolve(root, `${index}/${side}-guard.log`), "exit status: 0\nscope drained: true\n");
      }
      return {
        target: sample.target, id: sample.id, pins: sample.pins, sourceDigest: sample.sourceDigest,
        files: ["source.txt"], firstDirectory: directories[0], secondDirectory: directories[1],
        firstGuardFile: `${index}/first-guard.json`, secondGuardFile: `${index}/second-guard.json`,
        firstGuardSummary: `${index}/first-guard.log`, secondGuardSummary: `${index}/second-guard.log`,
      };
    });
    const packetFile = resolve(root, "packet.json");
    writeFileSync(packetFile, JSON.stringify({ artifactRoot: root, samples: packetSamples }));
    const actual = readKeelDeterminism(packetFile);
    assert.equal(evaluateKeelDeterminism(actual, programs).length, 0);
    const firstGuardPath = resolve(root, "0/first-guard.json");
    const firstGuard = JSON.parse(readFileSync(firstGuardPath, "utf8"));
    for (const scopeDrained of [undefined, false]) {
      writeFileSync(firstGuardPath, JSON.stringify({ ...firstGuard, scopeDrained }));
      assert.equal(keelFixtureHas(evaluateKeelDeterminism(readKeelDeterminism(packetFile), programs), "AC11", "guard receipt"), true,
        "a true summary cannot manufacture missing or contradictory JSON drain proof");
    }
    writeFileSync(firstGuardPath, JSON.stringify(firstGuard));
    writeFileSync(resolve(root, "0/first-guard.log"), "exit status: 0\nscope drained: false\n");
    assert.equal(keelFixtureHas(evaluateKeelDeterminism(readKeelDeterminism(packetFile), programs), "AC11", "guard receipt"), true);
    writeFileSync(resolve(root, "0/first/unlisted.txt"), "not inventoried");
    assert.throws(() => readKeelDeterminism(packetFile), /complete output tree/u);
    rmSync(resolve(root, "0/first/unlisted.txt"));
    writeFileSync(resolve(outside, "source.txt"), "outside evidence");
    symlinkSync(outside, resolve(root, "escape"));
    const escaped = { ...JSON.parse(readFileSync(packetFile, "utf8")), samples: [{ ...packetSamples[0], firstDirectory: "escape" }] };
    writeFileSync(packetFile, JSON.stringify(escaped));
    assert.throws(() => readKeelDeterminism(packetFile), /escapes/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
