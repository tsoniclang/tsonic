import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageLexicalSelections } from "../../packages/target-api/dist/target-analysis/source-storage/lexical-regions.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

function fixture(depth, limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const root = { kind: "file" };
  const nodes = [root];
  for (let index = 0; index < depth; index += 1) nodes.push({ parent: nodes[nodes.length - 1] });
  let parents = 0;
  const ast = {
    parent: node => { parents += 1; return node.parent; },
    body: () => undefined,
    is: {
      IsSourceFile: node => node.kind === "file",
      IsFunctionDeclaration: () => false, IsFunctionExpression: () => false, IsArrowFunction: () => false,
      IsMethodDeclaration: () => false, IsConstructorDeclaration: () => false,
      IsGetAccessorDeclaration: () => false, IsSetAccessorDeclaration: () => false,
      IsParameterDeclaration: () => false, IsPropertyDeclaration: () => false, IsTryStatement: () => false,
    },
  };
  return { budget, root, nodes, selections: createSourceStorageLexicalSelections(ast, budget), parents: () => parents };
}

test("deep lexical paths retain one complete owner selection and do not repeat shared ancestor walks", () => {
  const current = fixture(20_000, { maximumTransportRows: 4 });
  assert.equal(current.selections.enclosing(current.nodes[10_000]) === current.root, true);
  assert.equal(current.selections.enclosing(current.nodes[current.nodes.length - 1]) === current.root, true);
  const before = current.parents();
  for (let attempt = 0; attempt < 50; attempt += 1)
    assert.equal(current.selections.enclosing(current.nodes[current.nodes.length - 1]) === current.root, true);
  assert.equal(current.parents() === before && before === 20_001, true, "only the demanded ancestor evidence is reused without recursive host calls");
  const remaining = current.budget.createRows();
  assert.equal(remaining.add(2), true, "undemanded ancestors do not inflate the retained lexical index");
  remaining.release();
  assert.equal(current.budget.failure() === undefined, true);
});

test("an exhausted lexical path cannot publish a partial owner or revive a failed work budget", () => {
  const current = fixture(12, { maximumSteps: 8 });
  assert.equal(current.selections.enclosing(current.nodes[current.nodes.length - 1]) === undefined, true);
  assert.match(current.budget.failure(), /analysis-work/u);
  assert.equal(current.selections.enclosing(current.nodes[1]) === undefined, true, "failure remains sticky even for a smaller later query");
});
