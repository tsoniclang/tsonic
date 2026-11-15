import { test } from "node:test";
import { dependencyInventoryCases } from "./fixtures/facts-dependencies.mjs";

test("Summaries canonical required-operation inventory", async suite => {
  await dependencyInventoryCases(suite);
});
