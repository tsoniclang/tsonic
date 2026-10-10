import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageLexicalSelections } from "../../packages/target-api/dist/target-analysis/source-storage/lexical-regions.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { checkedSource, namedDeclaration, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";
import { Node_Expression, Node_Initializer } from "../../packages/target-api/dist/source-navigation/index.js";

async function fixture() {
  const checked = await checkedSource("source-storage-lexical-regions", {
    "globals.d.ts": `interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {} interface Number {}
interface String {} interface RegExp {} interface Array<T> { [index: number]: T; length: number; }`,
    "src/index.ts": `export function inspect(value = 1) {
  try {
    try { throw 1; } catch (inner) { throw 2; } finally { throw 3; }
  } catch (outer) { throw 4; }
  const local = () => { throw 5; };
  return value;
}
export class Holder { field = 1; method(value = 3) { return value; } }`,
  });
  assert.equal(checked.diagnostics.length, 0, "valid original checked AST");
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const throwing = number => requiredNode(source.ast, file, node =>
    source.ast.is.IsThrowStatement(node) && source.ast.text(Node_Expression(source.ast, node)) === String(number));
  return { source, file, throwing };
}

test("lexical storage selections preserve exact nested try, catch, finally and callable boundaries", async () => {
  const { source, file, throwing } = await fixture();
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const selected = createSourceStorageLexicalSelections(source.ast, budget);
  for (const [number, name] of [[1, "inner"], [2, "outer"], [3, "outer"]]) {
    const caught = selected.catchDestination(throwing(number));
    assert.equal(source.ast.text(source.ast.name(caught)), name);
  }
  assert.equal(selected.catchDestination(throwing(4)) === undefined, true, "a catch does not catch its own body");
  assert.equal(selected.catchDestination(throwing(5)) === undefined, true, "a nested callable does not inherit a lexical catch");
  const owner = namedDeclaration(source.ast, file, "inspect");
  for (const number of [1, 2, 3, 4]) {
    assert.equal(selected.enclosing(throwing(number)) === source.ast.body(owner), true, "original body identity");
  }
  assert.equal(selected.enclosing(throwing(5)) !== source.ast.body(owner), true, "nested callback has its own body");
  const holder = namedDeclaration(source.ast, file, "Holder");
  const field = source.ast.members(holder).find(node => source.ast.text(source.ast.name(node)) === "field");
  const method = source.ast.members(holder).find(node => source.ast.text(source.ast.name(node)) === "method");
  for (const declaration of [field, source.ast.parameters(method)[0]]) {
    const initializer = Node_Initializer(source.ast, declaration);
    assert.equal(initializer !== undefined && selected.enclosing(initializer) === initializer, true, "initializer is its own execution region");
  }
  assert.equal(budget.failure() === undefined, true);
});

test("lexical storage caches both present and absent boundaries without repeating immutable AST walks", async () => {
  const { source, throwing } = await fixture();
  let reads = 0;
  const ast = { ...source.ast, parent: node => { reads += 1; return source.ast.parent(node); } };
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const selected = createSourceStorageLexicalSelections(ast, budget);
  const value = throwing(1);
  const absent = throwing(5);
  const region = selected.enclosing(value);
  const caught = selected.catchDestination(value);
  assert.equal(selected.catchDestination(absent), undefined);
  const completedReads = reads;
  for (let repeat = 0; repeat < 100; repeat += 1) {
    assert.equal(selected.enclosing(value) === region, true);
    assert.equal(selected.catchDestination(value) === caught, true);
    assert.equal(selected.catchDestination(absent), undefined);
  }
  assert.equal(reads, completedReads, "cached facts do not repeat parent traversal");
  assert.equal(budget.failure() === undefined, true);
});

test("lexical storage retains independent cache-hit work, retained-row and malformed-parent guards", async () => {
  const { source, throwing } = await fixture();
  const value = throwing(5);
  const work = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 3 });
  const workSelections = createSourceStorageLexicalSelections(source.ast, work);
  assert.equal(workSelections.enclosing(value) !== undefined, true);
  assert.equal(workSelections.enclosing(value) === undefined, true, "cache hits still exhaust the finite work ceiling");
  assert.match(work.failure(), /analysis-work/u);
  const rows = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 1 });
  const rowSelections = createSourceStorageLexicalSelections(source.ast, rows);
  assert.equal(rowSelections.enclosing(value) !== undefined, true);
  assert.equal(rowSelections.catchDestination(value) === undefined, true);
  assert.match(rows.failure(), /transport-row/u);
  assert.equal(rowSelections.enclosing(value) === undefined, true, "previous cached evidence cannot bypass exhaustion");
  const cycle = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 8 });
  const cycleSelections = createSourceStorageLexicalSelections({ ...source.ast, parent: () => value }, cycle);
  assert.equal(cycleSelections.enclosing(value) === undefined, true);
  assert.match(cycle.failure(), /analysis-work/u);
});
