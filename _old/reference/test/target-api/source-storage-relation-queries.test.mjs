import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture() {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src", compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {};
      function retain(value: object): () => object { return () => value; }
      const original = {}; const separate = {};
      const first = retain(original)(); const second = retain(separate)();
    ` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "ordinary source checks without annotations");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const budget = createSourceStorageBudget({ maximumNodes: 256, maximumEdges: 256,
    maximumSubjectRows: 512, maximumTransportRows: 4096, maximumSteps: 65_536 });
  const transport = createSourceStorageTransport(source, [file], budget);
  const subject = name => transport.subjectFor(Node_Initializer(source.ast, namedVariable(source.ast, file, name)));
  return { budget, query: transport.substitutions, subject };
}

test("canonical relation evidence survives query return and throw without retaining request history", () => {
  const remainingRows = repeats => {
    const current = fixture();
    const first = current.subject("first");
    const original = current.subject("original");
    const expected = current.query.values(first, current.query.empty);
    assert.equal(expected?.size === 1 && [...expected][0].subject === original, true);
    const bindings = [...expected][0].bindings;
    const failure = new Error("exact query interruption");
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      assert.throws(() => current.query.walk(first, current.query.empty, () => { throw failure; }), error => error === failure);
      const selected = current.query.values(first, current.query.empty);
      assert.equal(selected?.size === 1 && [...selected][0].subject === original && [...selected][0].bindings === bindings,
        true, "query unwinding preserves the identical canonical source and binding identities");
    }
    assert.equal(current.budget.failure() === undefined, true, "completed or throwing queries preserve the live owner");
    let remaining = 0;
    while (current.budget.row()) remaining += 1;
    return remaining;
  };
  assert.equal(remainingRows(32), remainingRows(1), "repeated requests add no retained interner or traversal rows");
});

test("canonical relation queries retain both independent entry roots in either query order", () => {
  for (const order of [["first", "second", "second", "first"], ["second", "first", "first", "second"]]) {
    const current = fixture();
    for (const name of order) {
      const own = current.subject(name === "first" ? "original" : "separate");
      const selected = current.query.values(current.subject(name), current.query.empty);
      assert.equal(selected?.size === 1 && [...selected][0].subject === own, true,
        `${name}: one exact entry root, not a union of callers`);
    }
    assert.equal(current.budget.failure() === undefined, true);
  }
});

for (const [guard, exhaust] of [
  ["source-node", budget => budget.node()],
  ["edge", budget => budget.edge()],
  ["subject", budget => budget.subject(1)],
  ["transport-row", budget => budget.row()],
  ["analysis-work", budget => budget.step()],
]) {
  test(`completed canonical relations cannot bypass the independent ${guard} guard`, () => {
    const current = fixture();
    const first = current.subject("first");
    assert.equal(current.query.values(first, current.query.empty)?.size === 1, true);
    while (exhaust(current.budget)) {}
    assert.equal(current.budget.failure().includes(guard), true);
    assert.equal(current.query.values(first, current.query.empty) === undefined, true,
      "completed cached evidence cannot resume an exhausted owner");
    assert.equal(current.query.walk(first, current.query.empty) === undefined, true,
      "witness traversal cannot reset an exhausted owner");
  });
}
