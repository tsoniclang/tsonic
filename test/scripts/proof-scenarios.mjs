import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const classifications = new Set(["paired", "native-only", "unpaired"]);
const levels = new Set(["runtime", "compile-only", "unasserted"]);
const scope = "Declared contracts and source-anchor integrity, not semantic equivalence or a parity percentage. Task status is local whole-project status, not an independently executed scenario.";

export async function validateScenarios({ root, manifest, projects, projectFiles, inputFiles = [] }) {
  assert.equal(manifest.schemaVersion, 1, "Unsupported scenario schemaVersion.");
  requireText(manifest.suite, "suite");
  assert(Array.isArray(manifest.scenarios) && manifest.scenarios.length > 0, "Missing scenarios.");
  const projectIndex = new Map(projects.map((project) => [project.id, project]));
  assert.equal(projectIndex.size, projects.length, "Duplicate project ID.");
  assert.deepEqual([...projectFiles].sort(), projects.map(({ path }) => `${path}/tsonic.json`).sort(), "Scenario project/config inventory drift.");
  const rootPath = await realpath(root);
  const files = new Map();
  async function readEvidence(file) {
    requireText(file, "evidence file");
    assert(!isAbsolute(file) && !file.includes("\\") && !file.split("/").some((part) => part === ".." || part === "." || part === ""), `Evidence path escapes or is not canonical: ${file}`);
    if (!files.has(file)) {
      const path = await realpath(resolve(rootPath, file));
      const local = relative(rootPath, path);
      assert(local !== ".." && !local.startsWith(`..${sep}`) && !isAbsolute(local), `Evidence path escapes: ${file}`);
      const text = await readFile(path, "utf8");
      files.set(file, { text, sha256: createHash("sha256").update(text).digest("hex") });
    }
    return files.get(file).text;
  }
  for (const file of inputFiles) await readEvidence(file);
  for (const project of projects) {
    assert(["runtime", "compile-only"].includes(project.execution), `Missing execution capability: ${project.id}`);
    await readEvidence(`${project.path}/tsonic.json`);
    await readEvidence(`${project.path}/package.json`);
  }
  const ids = new Set();
  const covered = new Set();
  const scenarios = [];
  for (const scenario of manifest.scenarios) {
    assert(typeof scenario.id === "string" && /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/u.test(scenario.id), `Invalid scenario ID: ${scenario.id}`);
    assert(!ids.has(scenario.id), `Duplicate scenario ID: ${scenario.id}`);
    ids.add(scenario.id);
    assert(classifications.has(scenario.classification), `Invalid classification: ${scenario.id}`);
    requireText(scenario.contract, `${scenario.id} contract`);
    if (scenario.classification !== "paired") requireText(scenario.reason, `${scenario.id} reason`);
    assert(Array.isArray(scenario.proofs) && scenario.proofs.length > 0, `Missing proofs: ${scenario.id}`);
    const proofProjects = new Set();
    const proofs = [];
    for (const proof of scenario.proofs) {
      const project = projectIndex.get(proof.project);
      assert(project !== undefined, `Unknown scenario project: ${proof.project}`);
      assert(!proofProjects.has(project.id), `Duplicate proof project: ${scenario.id}/${project.id}`);
      proofProjects.add(project.id);
      const required = proof.requires ?? [];
      assert.deepEqual([...required].sort(), [...(project.dependencies ?? [])].sort(), `Scenario dependencies drift: ${scenario.id}/${project.id}`);
      for (const id of [project.id, ...required]) {
        assert(projectIndex.has(id), `Unknown required project: ${id}`);
        covered.add(id);
      }
      assert(levels.has(proof.level), `Invalid proof level: ${scenario.id}/${project.id}`);
      if (proof.level !== "compile-only") assert.equal(project.execution, "runtime", `Library cannot claim runtime evidence: ${project.id}`);
      if (proof.level !== "runtime") requireText(proof.gap, `${scenario.id}/${project.id} gap`);
      if (scenario.classification === "paired") assert.equal(proof.level, "runtime", `Paired scenario lacks enforced runtime evidence: ${scenario.id}`);
      requireText(proof.outcome, `${scenario.id}/${project.id} outcome`);
      assert(Array.isArray(proof.sources) && proof.sources.some((file) => file.startsWith(`${project.path}/`)), `Missing project source: ${project.id}`);
      for (const file of proof.sources) await readEvidence(file);
      assert(Array.isArray(proof.assertions) && proof.assertions.length > 0, `Missing assertion evidence: ${scenario.id}`);
      const assertions = [];
      for (const assertion of proof.assertions) {
        requireText(assertion.contains, `${scenario.id} assertion anchor`);
        const text = await readEvidence(assertion.file);
        const offset = text.indexOf(assertion.contains);
        assert(offset >= 0, `Stale assertion evidence: ${scenario.id}: ${assertion.file}: ${assertion.contains}`);
        assertions.push({ ...assertion, line: text.slice(0, offset).split("\n").length });
      }
      proofs.push({ ...proof, requires: [...required].sort(), sources: [...proof.sources].sort(), assertions: assertions.sort((left, right) => compare(`${left.file}:${left.contains}`, `${right.file}:${right.contains}`)) });
    }
    scenarios.push({ ...scenario, proofs: proofs.sort((left, right) => compare(left.project, right.project)) });
  }
  assert.deepEqual([...covered].sort(), [...projectIndex.keys()].sort(), "Every project must have a scenario or an explicit consumer dependency.");
  return {
    schemaVersion: 1,
    suite: manifest.suite,
    scope,
    projects: projects.map(({ id, path, execution }) => ({ id, path, execution })).sort((left, right) => compare(left.id, right.id)),
    evidenceFiles: [...files].sort(([left], [right]) => compare(left, right)).map(([file, { sha256 }]) => ({ file, sha256 })),
    scenarios: scenarios.sort((left, right) => compare(left.id, right.id)),
  };
}

export function createScenarioReport(inventory, results = []) {
  const projectIndex = new Map(inventory.projects.map((project) => [project.id, project]));
  const projectResults = new Map();
  for (const result of results.filter(({ id }) => id.startsWith("project-"))) {
    const project = result.id.slice("project-".length);
    assert(projectIndex.has(project), `Unknown project result: ${result.id}`);
    assert(!projectResults.has(project), `Duplicate project result: ${result.id}`);
    assert(["passed", "failed"].includes(result.status), `Invalid project result: ${result.id}`);
    projectResults.set(project, result.status);
  }
  return {
    ...inventory,
    pairing: "declaration-only; peer execution is not certified by this report",
    scenarios: inventory.scenarios.map((scenario) => ({
      ...scenario,
      proofs: scenario.proofs.map((proof) => {
        const tasks = [proof.project, ...proof.requires].sort().map((project) => ({ id: `project-${project}`, mode: projectIndex.get(project).execution, status: projectResults.get(project) ?? "not-run" }));
        const execution = tasks.some(({ status }) => status === "failed")
          ? "failed"
          : tasks.every(({ status }) => status === "passed") ? "passed" : "not-run";
        return { ...proof, tasks, execution, verification: execution === "passed" ? proof.level === "runtime" ? "asserted" : proof.level : "not-established" };
      }),
    })),
  };
}

export function summarizeScenarioReport(report) {
  if (report.metadata === "not-validated") {
    return [`SCENARIO_SCOPE=${scope}`, "SCENARIO_METADATA=not-validated", "SCENARIO_VERIFICATION=not-established"];
  }
  const proofs = report.scenarios.flatMap(({ proofs }) => proofs);
  return [
    `SCENARIO_SCOPE=${scope}`,
    "SCENARIO_METADATA=validated; pairing is declaration-only",
    `SCENARIO_DECLARATIONS=${report.scenarios.length} ${countSummary(report.scenarios.map(({ classification }) => classification), [...classifications])}`,
    `SCENARIO_PROOF_ROWS=${proofs.length} ${countSummary(proofs.map(({ level }) => level), [...levels])}`,
    `SCENARIO_PROOF_EXECUTION=${countSummary(proofs.map(({ execution }) => execution), ["passed", "failed", "not-run"])}`,
    `SCENARIO_PROOF_VERIFICATION=${countSummary(proofs.map(({ verification }) => verification), ["asserted", "compile-only", "unasserted", "not-established"])}`,
  ];
}

export function compareScenarioInventories(inventories) {
  assert(inventories.length >= 2, "Pair inspection requires at least two inventories.");
  const suites = inventories.map(({ suite }) => suite).sort();
  assert.equal(new Set(suites).size, suites.length, "Duplicate scenario suite.");
  const ids = [...new Set(inventories.flatMap(({ scenarios }) => scenarios.map(({ id }) => id)))].sort();
  const rows = ids.map((id) => {
    const entries = inventories.flatMap((inventory) => {
      const scenario = inventory.scenarios.find((candidate) => candidate.id === id);
      return scenario === undefined ? [] : [{ suite: inventory.suite, ...scenario }];
    }).sort((left, right) => compare(left.suite, right.suite));
    const first = entries[0];
    for (const entry of entries) {
      assert.equal(entry.contract, first.contract, `Same ID has different contracts: ${id}`);
      assert.equal(entry.classification, first.classification, `Classification mismatch: ${id}`);
    }
    if (first.classification === "paired") {
      assert.equal(entries.length, inventories.length, `Missing paired scenario: ${id}`);
      assert(entries.every(({ proofs }) => proofs.every(({ level }) => level === "runtime")), `Paired scenario lacks enforced runtime evidence: ${id}`);
    }
    if (first.classification === "native-only") assert.equal(entries.length, 1, `Native-only scenario shared across suites: ${id}`);
    return { id, classification: first.classification, contract: first.contract, suites: entries.map(({ suite, proofs, reason }) => ({ suite, ...(reason === undefined ? {} : { reason }), proofs: proofs.map(({ project, requires, level, outcome, gap }) => ({ project, requires, level, outcome, ...(gap === undefined ? {} : { gap }) })) })), absentFrom: suites.filter((suite) => !entries.some((entry) => entry.suite === suite)) };
  });
  return { scope, pairing: "metadata-only; no project executions performed", suites, scenarios: rows };
}

export async function inspectScenarioArguments(args, inspect) {
  if (args.length === 0) return false;
  assert(args[0] === "--scenarios" && (args.length === 1 || (args.length === 3 && args[1] === "--peer")), "Usage: verify-all.mjs [--scenarios [--peer <proof-repository>]]");
  const inventory = await inspect();
  if (args.length === 1) {
    console.log(JSON.stringify(createScenarioReport(inventory), null, 2));
  } else {
    const peer = await import(pathToFileURL(resolve(args[2], "scripts/verify/scenarios.mjs")).href);
    console.log(JSON.stringify(compareScenarioInventories([inventory, await peer.inspectScenarios()]), null, 2));
  }
  return true;
}

function requireText(value, label) {
  assert(typeof value === "string" && value.trim().length > 0, `Missing ${label}.`);
}

function countSummary(values, choices) {
  return choices.map((choice) => `${choice}:${values.filter((value) => value === choice).length}`).join(" ");
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
