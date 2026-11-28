import assert from "node:assert/strict";
import { accountFailure, createAccount } from "../../../packages/host/dist/dataflow/index.js";

const limits = { maximumWork: 1000000, maximumResultEntries: 1000000 };

export function checkReachedProofCuts(stateOf, run, expected, label, afterProbe = () => {}) {
  const probe = createAccount(limits);
  const meter = stateOf(probe);
  const charged = { work: [], entries: [] };
  const consumed = { work: 0, entries: 0 };
  for (const category of ["work", "entries"]) Object.defineProperty(meter, category, {
    get: () => consumed[category], set: next => {
      if (next > consumed[category]) charged[category].push(next);
      consumed[category] = next;
    },
  });
  assert.deepEqual(run(probe), { kind: "complete", value: expected }, label);
  afterProbe();
  assert.deepEqual(run(createAccount({ maximumWork: consumed.work, maximumResultEntries: consumed.entries })),
    { kind: "complete", value: expected }, label);
  for (const [category, dimension] of [["work", "work"], ["entries", "result-entries"]]) {
    assert.ok(charged[category].length > 0, `${label}: ${dimension}`);
    for (const cut of charged[category]) {
      const account = createAccount({ maximumWork: category === "work" ? cut - 1 : consumed.work,
        maximumResultEntries: category === "entries" ? cut - 1 : consumed.entries });
      const stopped = run(account);
      assert.equal(stopped.kind, "resource-limit", `${label}: ${dimension} ${cut - 1}`);
      assert.equal(stopped.dimension, dimension);
      assert.equal(stopped === accountFailure(account), true);
      assert.equal(run(account) === stopped, true);
    }
  }
}
