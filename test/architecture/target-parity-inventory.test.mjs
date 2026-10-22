import assert from "node:assert/strict";
import test from "node:test";
import { readTargetParityInventory, targetReferenceFindings } from "./tooling/target-parity-inventory.mjs";

test("shared target source references resolve without claiming execution coverage", () => {
  assert.deepEqual(targetReferenceFindings(readTargetParityInventory("language-lanes")), []);
  assert.throws(() => readTargetParityInventory("missing"), /Unknown target inventory/u);
});

test("target source references reject missing and noncanonical paths", () => {
  for (const path of ["tsonic/missing-contract.ts", "../tsonic/README.md", "/absolute", "tsonic\\README.md", "tsonic//README.md"]) {
    assert.equal(targetReferenceFindings([{ id: "mutation", rustReference: path }]).length, 1, path);
  }
  assert.deepEqual(targetReferenceFindings([{ id: "no-recorded-reference" }]), []);
});

// Inventory-wide checks of the shared lane fixtures (moved from the compiler repositories, which never name each other).
const lanes = readTargetParityInventory("javascript-node-lanes");
const languageLanes = readTargetParityInventory("language-lanes");

test("every JS and Node lane has exactly one valid classification", () => {
  assert.ok(lanes.length >= 90, `lane list too small: ${lanes.length}`);
  const seen = new Set();
  for (const lane of lanes) {
    assert.ok(["implemented", "hard-rejected", "target-limit"].includes(lane.classification), lane.lane);
    assert.ok(!seen.has(lane.lane), `duplicate lane: ${lane.lane}`);
    seen.add(lane.lane);
    if (lane.classification === "target-limit") {
      assert.ok(typeof lane.reason === "string" && lane.reason.length >= 40, `${lane.lane} must state its exact target boundary`);
    }
  }
});

test("the JS and Node surface families cannot silently disappear from the inventory", () => {
  const requiredFamilies = [
    "Object.keys", "Object.assign", "Object.hasOwn",
    "Number.parseInt", "Number.isNaN", "toFixed",
    "console.log", "node:assert", "bare module aliases",
    "process identity and metrics", "process stdio", "buffer extras",
    "local-time getters", "UTC setters",
    "localeCompare", "matchAll result consumption", "exec/match result consumption",
    "streams and fs.watch", "discriminated object unions",
  ];
  for (const family of requiredFamilies) {
    assert.ok(lanes.some((lane) => lane.lane.includes(family)), `missing lane family: ${family}`);
  }
});

test("completed RegExp, JSON, and closed Object.assign lanes cannot regress to stale limits", () => {
  for (const laneName of [
    "dynamic patterns and complete ECMAScript constructs",
    "replacer functions and selected toJSON",
    "Object.assign over closed shapes",
  ]) {
    assert.equal(
      lanes.find((lane) => lane.lane === laneName)?.classification,
      "implemented",
      laneName,
    );
  }
});

const classifications = new Set([
  "implemented",
  "implementation-gap",
  "contract-gap",
  "target-limit",
  "shared-rejection",
]);

test("the language lane inventory is complete and mechanically classified", () => {
  assert.ok(languageLanes.length >= 45, `parity inventory is too small: ${languageLanes.length}`);
  const identities = new Set();
  const areas = new Set();
  for (const lane of languageLanes) {
    assert.equal(typeof lane.id, "string");
    assert.ok(!identities.has(lane.id), `duplicate parity lane '${lane.id}'`);
    identities.add(lane.id);
    areas.add(lane.area);
    assert.ok(classifications.has(lane.classification), lane.id);
    assert.equal(typeof lane.source, "string", `${lane.id} needs source`);
    assert.ok(lane.source.length > 0, `${lane.id} has empty source`);
    assert.equal(typeof lane.rustReference, "string", `${lane.id} needs a target source reference`);
    assert.equal(typeof lane.action, "string", `${lane.id} needs an action`);
    assert.ok(lane.action.length > 0, `${lane.id} has no action`);
  }
  for (const area of [
    "modules",
    "declarations",
    "objects",
    "control-flow",
    "iteration",
    "generators",
    "resources",
    "expressions",
    "types",
    "safety",
    "providers",
    "surfaces",
    "output",
  ]) {
    assert.ok(areas.has(area), `missing parity area '${area}'`);
  }
});

test("priority coverage remains mechanically visible", () => {
  for (const laneId of [
    "modules.default-expression-export",
    "declarations.class-static-blocks",
    "objects.spread",
    "declarations.generic-virtual-methods",
    "providers.standard-library-breadth",
    "js-node.detailed-surface",
  ]) {
    const lane = languageLanes.find(({ id }) => id === laneId);
    assert.ok(lane !== undefined, `missing prioritized lane '${laneId}'`);
    assert.ok(
      classifications.has(lane.classification),
      `priority lane '${laneId}' has no valid closure`,
    );
  }
});

test("the detailed JS and Node inventory remains a required parity input", () => {
  const detailed = readTargetParityInventory("javascript-node-lanes");
  assert.ok(detailed.length >= 140, `detailed surface inventory is too small: ${detailed.length}`);
});
