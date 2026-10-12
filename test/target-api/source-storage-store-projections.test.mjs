import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";
import { createSourceStorageEdges } from "../../packages/target-api/dist/target-analysis/source-storage/edges.js";
import { createSourceStorageStoreProjections } from "../../packages/target-api/dist/target-analysis/source-storage/store-projections.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(limits = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    files: { "/src/index.ts": "export {}; const pair: [object, object] = [{}, {}]; const values: object[] = pair;" },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const pair = subject(namedVariable(source.ast, file, "pair"));
  const values = subject(namedVariable(source.ast, file, "values"));
  const selected = subject(values.node, values.kind, [{ kind: "array-element" }]);
  const store = Object.freeze({ reference: values.node, operation: values.node, storage: values, value: pair,
    region: file, kind: "initialization", destination: "binding" });
  const edges = createSourceStorageEdges(source, budget, subject, () => file);
  let storeLookups = 0;
  const read = createSourceStorageStoreProjections(budget, subject, candidate => {
    storeLookups += 1;
    return candidate === values ? [store] : undefined;
  }, edges.projectOrigin);
  return { budget, subject, pair, values, selected, store, read, storeLookups: () => storeLookups };
}

test("projected stores preserve canonical occurrence identity and every exact tuple-to-array component", () => {
  const current = fixture();
  const result = current.read(current.selected);
  assert.equal(Object.isFrozen(result) && result.length === 2 && result.every(selection =>
    Object.isFrozen(selection) && selection.store === current.store && selection.value.node === current.pair.node &&
    selection.value.projection.length === 1 && selection.value.projection[0].kind === "tuple-element"), true);
  assert.equal(result.some(selection => selection.value.projection[0].index === 0) &&
    result.some(selection => selection.value.projection[0].index === 1), true);
  assert.equal(current.read(current.selected) === result, true, "the immutable complete relationship is reused");
  const whole = current.read(current.values);
  assert.equal(whole.length === 1 && whole[0].store === current.store && whole[0].value === current.pair, true);
  assert.equal(current.budget.failure() === undefined, true);
});

test("unrelated or impossible components cannot invent a projected store producer", () => {
  const current = fixture();
  assert.equal(current.read(current.pair) === undefined, true, "a value is not its destination store");
  const invalid = current.subject(current.values.node, current.values.kind, [{ kind: "array-element" }, { kind: "array-element" }]);
  const result = current.read(invalid);
  assert.equal(Object.isFrozen(result) && result.length === 0, true, "an object element has no nested array component");
  assert.equal(current.budget.failure() === undefined, true);
});

test("the exact absence of stores is reused without bypassing a failed owner", () => {
  const current = fixture();
  assert.equal(current.read(current.pair) === undefined, true);
  const lookups = current.storeLookups();
  for (let repeat = 0; repeat < 32; repeat += 1) assert.equal(current.read(current.pair) === undefined, true);
  assert.equal(current.storeLookups(), lookups, "a complete negative projection is not rebuilt");
  current.budget.reject("independent exhausted guard");
  assert.equal(current.read(current.pair) === undefined, true);
  assert.equal(current.budget.failure(), "independent exhausted guard");
});

for (const limits of [{ maximumTransportRows: 1 }, { maximumSteps: 1 }, { maximumEdges: 1 }]) {
  test(`projected store selection preserves sticky independent limits ${JSON.stringify(limits)}`, () => {
    const current = fixture(limits);
    assert.equal(current.read(current.selected) === undefined && current.budget.failure() !== undefined, true);
    assert.equal(current.read(current.selected) === undefined, true, "no partial cache bypasses the failure");
  });
}
