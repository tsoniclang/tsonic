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
