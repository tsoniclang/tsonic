import assert from "node:assert/strict";
import { accountFailure, createAccount } from "../../../packages/host/dist/dataflow/index.js";
import { InvocationAccount } from "../../../packages/host/dist/dataflow/account.js";

export const conditionRefusal = { kind: "refused", diagnostics: [{ code: { kind: "checker", number: 1, rendered: "constructed condition bound" },
  severity: "error", site: { kind: "none" }, source: null, evidence: [], message: "constructed condition bound", arguments: [], related: [], fix: null }] };

export const verificationAccount = () => createAccount({ maximumWork: 1000000000, maximumResultEntries: 1000000000 });

export function completeVerification(result) {
  assert.equal(result.kind, "complete", "the constructed verification invocation completed without resource refusal");
  return result.violations;
}

export function verificationStops(invoke) {
  const reference = verificationAccount();
  const expected = invoke(reference);
  assert.equal(expected.kind, "complete");
  const { work, entries } = InvocationAccount.stateOf(reference);
  for (const [dimension, needed] of [["work", work], ["result-entries", entries]]) {
    for (let maximum = 0; maximum < needed; maximum += 1) {
      const account = createAccount({ maximumWork: dimension === "work" ? maximum : work,
        maximumResultEntries: dimension === "result-entries" ? maximum : entries });
      const result = invoke(account);
      assert.equal(result.kind, "resource-limit", dimension);
      assert.equal(result.dimension, dimension);
      assert.equal(result.maximum, maximum);
      assert.equal(result, accountFailure(account));
      assert.equal("violations" in result, false);
    }
  }
}
