import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { compareScenarioInventories, createScenarioReport, summarizeScenarioReport, validateScenarios } from "../../scripts/proof-scenarios.mjs";
import { tsonicRoot } from "../../scripts/workspace-layout.mjs";

async function fixture() {
  const scratch = resolve(tsonicRoot, ".temp/proof-scenarios-tests");
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(resolve(scratch, "case-"));
  const projects = [
    { id: "consumer", path: "packages/consumer", execution: "runtime", dependencies: ["domain"] },
    { id: "domain", path: "packages/domain", execution: "compile-only", dependencies: [] },
    { id: "exports", path: "packages/exports", execution: "compile-only", dependencies: [] },
  ];
  for (const project of projects) {
    await mkdir(resolve(root, project.path, "src"), { recursive: true });
    await writeFile(resolve(root, project.path, "tsonic.json"), "{}\n");
    await writeFile(resolve(root, project.path, "package.json"), "{}\n");
    await writeFile(resolve(root, project.path, "src/main.ts"), 'const answer = 42;\nif (answer !== 42) throw new Error("wrong answer");\n');
  }
  const runtime = {
    id: "numbers/answer", classification: "paired", contract: "The answer is 42.",
    proofs: [{ project: "consumer", requires: ["domain"], level: "runtime", sources: ["packages/consumer/src/main.ts"],
      assertions: [{ file: "packages/consumer/src/main.ts", contains: 'if (answer !== 42) throw new Error("wrong answer");' }], outcome: "A wrong answer throws." }],
  };
  const library = {
    id: "exports/answer", classification: "unpaired", contract: "Compile answer declarations.", reason: "No executable caller.",
    proofs: [{ project: "exports", level: "compile-only", sources: ["packages/exports/src/main.ts"],
      assertions: [{ file: "packages/exports/src/main.ts", contains: "const answer = 42;" }], outcome: "The library compiles.", gap: "No function is invoked." }],
  };
  return { root, projects, projectFiles: projects.map(({ path }) => `${path}/tsonic.json`), manifest: { schemaVersion: 1, suite: "first", scenarios: [runtime, library] } };
}

test("scenario metadata covers configs, sources, consumer dependencies and assertion anchors", async () => {
  const input = await fixture();
  const inventory = await validateScenarios(input);
  assert.equal(inventory.projects.length, 3);
  const runtime = inventory.scenarios.find(({ id }) => id === "numbers/answer").proofs[0];
  assert.equal(runtime.assertions[0].line, 2);
  assert.deepEqual(runtime.requires, ["domain"]);
  assert(inventory.evidenceFiles.every(({ sha256 }) => /^[a-f0-9]{64}$/u.test(sha256)));
  const report = createScenarioReport(inventory);
  assert(report.scenarios.every(({ proofs }) => proofs.every(({ execution, verification }) => execution === "not-run" && verification === "not-established")));
});

test("schema, duplicate IDs, unknown/missing projects and stale config coverage reject", async () => {
  const input = await fixture();
  const cases = [
    [(value) => { value.manifest.schemaVersion = 2; }, /schemaVersion/u],
    [(value) => { value.manifest.scenarios.push(value.manifest.scenarios[0]); }, /Duplicate scenario/u],
    [(value) => { value.manifest.scenarios[0].proofs[0].project = "absent"; }, /Unknown scenario project/u],
    [(value) => { value.manifest.scenarios.pop(); }, /Every project/u],
    [(value) => { value.projectFiles.push("new/tsonic.json"); }, /inventory drift/u],
    [(value) => { value.manifest.scenarios[0].proofs[0].requires = []; }, /dependencies drift/u],
    [(value) => { value.manifest.scenarios[0].proofs.push(value.manifest.scenarios[0].proofs[0]); }, /Duplicate proof/u],
    [(value) => { value.manifest.scenarios[1].reason = ""; }, /reason/u],
    [(value) => { value.manifest.scenarios[0].proofs[0].outcome = ""; }, /outcome/u],
  ];
  for (const [mutate, expected] of cases) {
    const changed = structuredClone(input);
    mutate(changed);
    await assert.rejects(validateScenarios(changed), expected);
  }
});

test("missing files, stale assertions and escaping evidence reject instead of silently dropping rows", async () => {
  const input = await fixture();
  const changed = structuredClone(input);
  changed.manifest.scenarios[0].proofs[0].assertions[0].contains = "an assertion that does not exist";
  await assert.rejects(validateScenarios(changed), /Stale assertion evidence/u);
  changed.manifest.scenarios[0].proofs[0].assertions[0].file = "missing.ts";
  await assert.rejects(validateScenarios(changed), /ENOENT/u);
  for (const path of ["../outside.ts", "..\\outside.ts", "packages\\consumer\\src\\main.ts", "./packages/consumer/src/main.ts", "packages//consumer/src/main.ts"]) {
    changed.manifest.scenarios[0].proofs[0].assertions[0].file = path;
    await assert.rejects(validateScenarios(changed), /escapes or is not canonical/u);
  }
  await symlink(resolve(input.root, ".."), resolve(input.root, "outside"), "junction");
  const escapingSource = structuredClone(input);
  escapingSource.manifest.scenarios[0].proofs[0].sources.push("outside");
  await assert.rejects(validateScenarios(escapingSource), /escapes/u);
});

test("compile-only and unchecked conditions cannot declare enforced behavioral pairing", async () => {
  const input = await fixture();
  const library = input.manifest.scenarios[1];
  library.proofs[0].level = "runtime";
  await assert.rejects(validateScenarios(input), /Library cannot claim runtime/u);
  library.proofs[0].level = "compile-only";
  library.classification = "paired";
  await assert.rejects(validateScenarios(input), /lacks enforced runtime/u);
  library.classification = "unpaired";
  delete library.proofs[0].gap;
  await assert.rejects(validateScenarios(input), /gap/u);
});

test("reports preserve exact task statuses and never promote successful library builds to runtime proof", async () => {
  const inventory = await validateScenarios(await fixture());
  const results = inventory.projects.map(({ id }) => ({ id: `project-${id}`, status: "passed" }));
  const report = createScenarioReport(inventory, results);
  assert.equal(report.scenarios[0].proofs[0].verification, "compile-only");
  assert.equal(report.scenarios[1].proofs[0].verification, "asserted");
  assert.deepEqual(report.scenarios[1].proofs[0].tasks, [
    { id: "project-consumer", mode: "runtime", status: "passed" },
    { id: "project-domain", mode: "compile-only", status: "passed" },
  ]);
  const failed = results.map((result) => result.id === "project-domain" ? { ...result, status: "failed" } : result);
  const failedProof = createScenarioReport(inventory, failed).scenarios[1].proofs[0];
  assert.equal(failedProof.execution, "failed");
  assert.equal(failedProof.verification, "not-established");
  assert.equal(createScenarioReport(inventory, results.filter(({ id }) => id !== "project-domain")).scenarios[1].proofs[0].execution, "not-run");
  assert.throws(() => createScenarioReport(inventory, [...results, results[0]]), /Duplicate project result/u);
  assert.throws(() => createScenarioReport(inventory, [{ id: "project-unknown", status: "passed" }]), /Unknown project result/u);
  assert.throws(() => createScenarioReport(inventory, [{ id: "project-consumer", status: "skipped" }]), /Invalid project result/u);
});

test("unasserted runtime rows remain unasserted even when the project task passes", async () => {
  const input = await fixture();
  input.manifest.scenarios[0].classification = "unpaired";
  input.manifest.scenarios[0].reason = "Output has no oracle.";
  input.manifest.scenarios[0].proofs[0].level = "unasserted";
  input.manifest.scenarios[0].proofs[0].gap = "Failure logs do not fail the runner.";
  const inventory = await validateScenarios(input);
  const report = createScenarioReport(inventory, inventory.projects.map(({ id }) => ({ id: `project-${id}`, status: "passed" })));
  assert.equal(report.scenarios[1].proofs[0].verification, "unasserted");
});

test("text summaries count declarations/proof rows without duplicating evidence or claiming parity", async () => {
  const inventory = await validateScenarios(await fixture());
  const summary = summarizeScenarioReport(createScenarioReport(inventory));
  assert(summary.includes("SCENARIO_DECLARATIONS=2 paired:1 native-only:0 unpaired:1"));
  assert(summary.includes("SCENARIO_PROOF_EXECUTION=passed:0 failed:0 not-run:2"));
  assert(summary.includes("SCENARIO_PROOF_VERIFICATION=asserted:0 compile-only:0 unasserted:0 not-established:2"));
  assert(!summary.join("\n").includes("packages/consumer/src/main.ts"));
  assert.deepEqual(summarizeScenarioReport({ metadata: "not-validated", verification: "not-established" }).slice(1), [
    "SCENARIO_METADATA=not-validated", "SCENARIO_VERIFICATION=not-established",
  ]);
});

test("equal IDs alone are insufficient; pairing requires reciprocal declared contracts and enforced lanes", async () => {
  const first = await validateScenarios(await fixture());
  const second = { ...structuredClone(first), suite: "second" };
  const report = compareScenarioInventories([first, second]);
  assert.equal(report.pairing, "metadata-only; no project executions performed");
  assert.equal(report.scenarios[0].classification, "unpaired");
  const changed = structuredClone(second);
  changed.scenarios[1].contract = "A different outcome despite the same ID.";
  assert.throws(() => compareScenarioInventories([first, changed]), /different contracts/u);
  changed.scenarios.pop();
  assert.throws(() => compareScenarioInventories([first, changed]), /Missing paired/u);
  second.scenarios[1].proofs[0].level = "unasserted";
  assert.throws(() => compareScenarioInventories([first, second]), /lacks enforced runtime/u);
  second.scenarios[1].proofs[0].level = "runtime";
  second.scenarios[0].classification = "native-only";
  assert.throws(() => compareScenarioInventories([first, second]), /Classification mismatch/u);
  first.scenarios[0].classification = "native-only";
  assert.throws(() => compareScenarioInventories([first, second]), /Native-only scenario shared/u);
});

test("reports are stable across input ordering and explicitly disclose absent unpaired/native lanes", async () => {
  const input = await fixture();
  const first = await validateScenarios(input);
  input.projects.reverse();
  input.projectFiles.reverse();
  input.manifest.scenarios.reverse();
  const reordered = await validateScenarios(input);
  assert.deepEqual(reordered, first);
  const results = first.projects.map(({ id }) => ({ id: `project-${id}`, status: "passed" }));
  assert.deepEqual(createScenarioReport(first, results), createScenarioReport(reordered, [...results].reverse()));
  const second = { ...structuredClone(first), suite: "second", scenarios: first.scenarios.filter(({ classification }) => classification === "paired") };
  const comparison = compareScenarioInventories([first, second]);
  assert.deepEqual(comparison, compareScenarioInventories([second, first]));
  assert.deepEqual(comparison.scenarios[0].absentFrom, ["second"]);
  assert.equal(comparison.scenarios[0].classification, "unpaired");
});
