import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageEdges } from "../../packages/target-api/dist/target-analysis/source-storage/edges.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { sourceStorageSubjectType } from "../../packages/target-api/dist/target-analysis/source-storage/components.js";
import { namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

function fixture(limits = defaultSourceStorageLimits, selectSource = source => source) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": "const pair: [number, number] = [3, 7]; const values: number[] = []; const scalar = 1;" },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.extensionDiagnostics.length === 0 && checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics, "/src"));
  const source = selectSource(createTargetSourceProgram(checked));
  const file = projectSourceFile(source, "/src/index.ts");
  const budget = createSourceStorageBudget(limits);
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const selected = name => subject(namedVariable(source.ast, file, name));
  const pair = selected("pair");
  const values = selected("values");
  const scalar = selected("scalar");
  const edges = createSourceStorageEdges(source, budget, subject, () => file);
  const types = { from: sourceStorageSubjectType(source, pair, file), to: sourceStorageSubjectType(source, values, file) };
  assert.equal(types.from !== undefined && types.to !== undefined, true, "exact checked aggregate types");
  const component = subject(values.node, values.kind, [{ kind: "array-element" }]);
  return { source, file, budget, subject, pair, values, scalar, edges, types, component };
}

test("typed aggregate edges retain selected checker types and immutable correspondence", () => {
  const { budget, edges, types, pair, values, scalar, component, source, file } = fixture();
  assert.equal(edges.add(pair, values, types), true);
  types.from = sourceStorageSubjectType(source, scalar, file);
  types.to = types.from;
  const origins = edges.incomingFor(component);
  assert.equal(origins.size === 2, true, "selected tuple-to-array relation survives external descriptor mutation");
  assert.equal([...origins].every(origin => origin.node === pair.node && origin.projection.length === 1 &&
    origin.projection[0].kind === "tuple-element"), true);
  assert.equal([...origins].some(origin => origin.projection[0].index === 0) &&
    [...origins].some(origin => origin.projection[0].index === 1), true, "both exact tuple positions");
  assert.equal(edges.incomingFor(component) === origins, true, "one revision-owned proof");
  assert.equal(budget.failure() === undefined, true);
});

test("projection frontiers release temporary rows while retained proofs remain charged", () => {
  const { budget, edges, types, pair, values, component } = fixture({ ...defaultSourceStorageLimits, maximumTransportRows: 5 });
  assert.equal(edges.add(pair, values, types), true);
  const origins = edges.incomingFor(component);
  assert.equal(origins.size === 2, true, "five-row live peak admits complete tuple correspondence");
  for (let iteration = 0; iteration < 50; iteration += 1)
    assert.equal(edges.incomingFor(component) === origins, true, "cached proofs allocate no repeated frontier");
  const remaining = budget.createRows();
  assert.equal(remaining.add(2), true, "only cache plus two result rows remain live");
  remaining.release();
  assert.equal(budget.failure() === undefined, true);
  assert.equal(budget.row() && budget.row(), true, "released capacity is reusable");
  assert.equal(budget.row(), false, "retained cache rows cannot be forgotten");
  assert.equal(budget.failure()?.includes("transport-row"), true);
});

test("projection row exhaustion rejects below the real simultaneous frontier peak", () => {
  const { budget, edges, types, pair, values, component } = fixture({ ...defaultSourceStorageLimits, maximumTransportRows: 4 });
  assert.equal(edges.add(pair, values, types), true);
  edges.incomingFor(component);
  assert.equal(budget.failure()?.includes("transport-row"), true, "temporary and retained rows share the same owner");
  assert.equal(budget.step(), false, "resource rejection stays sticky");
});

test("projection revision replaces its charged cache without retaining superseded rows", () => {
  const { budget, edges, types, subject, pair, values, component } = fixture({ ...defaultSourceStorageLimits, maximumTransportRows: 5 });
  assert.equal(edges.add(pair, values, types), true);
  const first = edges.incomingFor(component);
  assert.equal(first.size === 2, true);
  const secondTypePair = { from: types.from, to: types.to };
  assert.equal(edges.add(pair, values, secondTypePair), false, "identical selected types do not make another revision");
  assert.equal(edges.incomingFor(component) === first, true);
  const projected = subject(pair.node, pair.kind, [{ kind: "tuple-element", index: 0 }]);
  assert.equal(edges.add(projected, component), true, "new direct proof creates a revision");
  const next = edges.incomingFor(component);
  assert.equal(next !== first && next.size === 2 && next.has(projected), true, "complete revised proof deduplicates exact subjects");
  const remaining = budget.createRows();
  assert.equal(remaining.add(2), true, "superseded cache no longer consumes rows");
  remaining.release();
  assert.equal(budget.failure() === undefined, true);
});

test("a checker exception unwinds cache and projection frontiers without changing its identity", () => {
  const expected = new Error("tuple proof failed");
  const { budget, edges, types, pair, values, component } = fixture(
    { ...defaultSourceStorageLimits, maximumTransportRows: 5 },
    source => ({ ...source, semantics: { ...source.semantics, forFile: file => {
      const semantics = source.semantics.forFile(file);
      return { ...semantics, types: { ...semantics.types, tupleElementInfos: () => { throw expected; } } };
    } } }),
  );
  assert.equal(edges.add(pair, values, types), true);
  let observed;
  try { edges.incomingFor(component); } catch (error) { observed = error; }
  assert.equal(observed === expected, true, "original failure propagates unchanged");
  const rows = budget.createRows();
  assert.equal(rows.add(5), true, "all incomplete proof and temporary owners unwind");
  rows.release();
  assert.equal(budget.failure() === undefined, true);
});

for (const [limit, label] of [["maximumEdges", "edge"], ["maximumSteps", "analysis-work"]]) {
  test(`typed aggregate projections preserve the independent ${label} guard`, () => {
    const { budget, edges, types, pair, values, component } = fixture({ ...defaultSourceStorageLimits, [limit]: 1 });
    assert.equal(edges.add(pair, values, types), true);
    edges.incomingFor(component);
    assert.equal(budget.failure()?.includes(label), true);
    assert.equal(budget.step(), false, "no proof can clear the rejection");
  });
}
