import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageDomainBoundarySelection } from "../../packages/target-api/dist/target-analysis/source-storage/graph/domain-boundary-selection.js";

test("boundary selection retains exact semantic identities without repeated output scans", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const rows = budget.createRows();
  const selection = createSourceStorageDomainBoundarySelection(rows);
  const bindings = {};
  const otherBindings = {};
  const subject = {};
  const owner = {};
  const exposure = {};
  const boundary = { kind: "external-write", subject, owner, exposure, creationBindings: bindings };
  selection.retain(boundary, otherBindings);
  const original = selection.values[0];
  selection.retain({ ...boundary }, otherBindings);
  assert.equal(selection.values.length === 1 && selection.values[0] === original, true,
    "identical boundaries keep the original frozen witness rather than a duplicate");
  assert.equal(original.bindings === bindings && Object.isFrozen(original), true,
    "the actual writer creation context wins over the reader context");
  selection.retain({ ...boundary, creationBindings: otherBindings }, bindings);
  selection.retain({ ...boundary, owner: {} }, bindings);
  selection.retain({ ...boundary, exposure: {} }, bindings);
  selection.retain({ ...boundary, subject: {} }, bindings);
  selection.retain({ ...boundary, kind: "opaque-write" }, bindings);
  assert.equal(selection.values.length, 6, "no distinct context, owner, exposure, subject or writer kind is merged");
  assert.equal(budget.failure() === undefined, true, "all retained indexes remain within the original budget");
  rows.release();
});

test("boundary selection reserves every output and index before publishing a partial witness", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 1 });
  const rows = budget.createRows();
  const selection = createSourceStorageDomainBoundarySelection(rows);
  const boundary = { kind: "external-write", subject: {}, exposure: {} };
  selection.retain(boundary, {});
  assert.equal(selection.values.length, 0, "exhaustion never publishes a partially indexed boundary");
  assert.equal(budget.failure() !== undefined, true, "the original resource owner refuses the complete reservation");
  selection.retain(boundary, {});
  assert.equal(selection.values.length, 0, "replay cannot erase the shared failure");
  rows.release();
});
