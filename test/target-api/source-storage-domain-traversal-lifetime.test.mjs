import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

test("repeated complete value and producer traversals retain exact evidence without accumulating dead domain rows", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "const original = {}; const first = original; export const result = first;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file], { ...defaultSourceStorageLimits, maximumTransportRows: 512 });
  const selected = storage.subjectFor(namedVariable(source.ast, file, "result"));
  const declaration = namedVariable(source.ast, file, "original");
  const original = storage.subjectFor(source.ast.as.AsVariableDeclaration(declaration).Initializer);
  assert.equal(selected.kind === "resolved" && original.kind === "resolved", true);
  for (let index = 0; index < 2000; index += 1) {
    const values = storage.closedOriginsFor(selected.subject);
    const producers = storage.storageProducersFor(selected.subject);
    assert.equal(values.kind === "complete" && values.origins.length === 1 && values.origins[0].subject === original.subject,
      true, `exact value traversal ${index}`);
    assert.equal(producers.kind === "complete" && producers.producers.length === 1 && producers.producers[0].subject === original.subject,
      true, `exact producer traversal ${index}`);
  }
  assert.equal(storage.failureReason() === undefined, true, "only retained facts and the actual live traversal count toward the original finite ceiling");
});
