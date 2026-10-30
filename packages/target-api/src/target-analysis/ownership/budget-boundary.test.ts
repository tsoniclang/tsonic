import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageBudget, defaultSourceStorageLimits, type SourceStorageBudget } from "../../public/analysis.js";
import { createSourceStorageBudget as canonicalBudgetOwner } from "../source-storage/model/resource-budget.js";

test("public ownership consumers reuse the canonical bounded storage owner and its exact signature", () => {
  assert.equal(createSourceStorageBudget === canonicalBudgetOwner, true, "one factory, not a copied target budget or new alias implementation");
  const budget: SourceStorageBudget = createSourceStorageBudget(defaultSourceStorageLimits);
  const ownership: Pick<SourceStorageBudget, "step" | "createRows" | "failure"> = budget;
  assert.equal(ownership.step(), true);
  const rows = ownership.createRows();
  assert.equal(rows.add(1), true);
  rows.release();
  assert.equal(ownership.failure() === undefined, true);
  assert.equal(Object.isFrozen(budget), true);
});
