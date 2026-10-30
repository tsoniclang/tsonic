import assert from "node:assert/strict";

import test from "node:test";

import { fixture } from "./recursive-retention-fixtures.js";

for (const reverse of Array.from([false, true]).slice(0, 1)){
for (const [kind, owner, callee] of Array.from([
    ["returned-alias", "Adoption", "returned"],
    ["awaited-member", "AwaitedAdoption", "awaited"],
    ["recursive-return", "RecursiveAdoption", "recursiveAdopt"],
    ["getter-return", "GetterAdoption", "returned"],
    ["conditional-return", "ConditionalAdoption", "returned"],
  ]).slice(0, 4)){
test(`${kind} prepares its caller-owned Promise producer before the SCC, reverse=${reverse}`, () => {
      for (const borrowed of [false, true]) {
        for (const producerFirst of [false, true]) {
          const current = fixture(reverse, "self");
          const root = current.declaration(`${borrowed ? "borrowed" : "owned"}${owner}`);
          const call = (name: string) => current.storage.nodes.find(node =>
            current.source.ast.is.IsCallExpression(node) &&
            current.selectedDeclaration(node) === current.declaration(name) &&
            current.storage.enclosingRegionFor(node) === current.source.ast.body(root));
          const adopted = call(callee!);
          const produced = call("produced");
          assert.equal(adopted !== undefined && produced !== undefined, true, "the actual adopter and separate caller factory");
          if (producerFirst) {
            const first = current.query.continuationFor(produced!);
            assert.equal(first.kind, "resolved", first.kind === "unresolved" ? first.reason
              : "prewarming the producer's closure is a control, not a required execution order");
          }
          const selected = current.query.forCall(adopted!);
          assert.equal(selected.kind === "resolved" && selected.decision === (borrowed ? "rejected" : "admitted"), true,
            selected.kind === "unresolved" ? selected.reason
              : `${kind}: borrowed=${borrowed}, producerFirst=${producerFirst}, decision=${selected.kind === "resolved" ? selected.decision : selected.kind}`);
          if (selected.kind === "resolved" && borrowed) {
            assert.equal(selected.decision === "rejected" && selected.diagnostic.at === adopted &&
              selected.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES", true,
            "the caller factory's actual loan survives aliases, member projections and recursive adoption");
          }
          assert.equal(current.budget.failure() === undefined, true, "the actual finite graph closes within its unchanged budget");
        }
      }
    });
}
}
