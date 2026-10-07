import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { snapshotSourceStorageCallEffect } from "../../packages/target-api/dist/target-analysis/source-storage/call-effects.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture() {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `declare function relay(value: object, other: object): object;
      const first = {}; const second = {}; const result = relay(first, second);` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const declaration = namedVariable(source.ast, file, "result");
  const invocation = source.ast.as.AsVariableDeclaration(declaration).Initializer;
  const selected = source.semantics.forNode(invocation).operations.call(invocation);
  assert.equal(selected !== undefined, true);
  return { source, invocation, selected };
}

test("a selected storage alias adds one exact origin edge without altering default opaque evidence", () => {
  const { source, invocation, selected } = fixture();
  const original = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const originalSubject = original.subjectFor(invocation);
  assert.equal(originalSubject.kind, "resolved");
  const originalOrigins = original.originsFor(originalSubject.subject);
  assert.equal(originalOrigins.kind, "resolved");
  assert.equal(originalOrigins.origins.length, 1);
  assert.equal(originalOrigins.origins[0].subject.node === invocation, true);
  let contributions = 0;
  const aliased = createSourceStorageQuery(source, source.navigation.sourceFiles, undefined, {
    call(node) {
      assert.equal(node === invocation, true);
      contributions += 1;
      return { resultAlias: selected.sourceArguments[0].expression };
    },
  });
  assert.equal(contributions, 1);
  assert.equal(aliased.failureReason() === undefined, true);
  const subject = aliased.subjectFor(invocation);
  assert.equal(subject.kind, "resolved");
  const origins = aliased.originsFor(subject.subject);
  assert.equal(origins.kind, "resolved");
  assert.equal(origins.origins.length, 1);
  assert.equal(source.ast.is.IsObjectLiteralExpression(origins.origins[0].subject.node), true);
  assert.equal(aliased.boundaries.some(boundary => boundary.invocation === invocation), true);
});

test("input preservation alone does not invent a result alias", () => {
  const { source, invocation, selected } = fixture();
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, undefined, {
    call: () => ({ preservedInputs: [selected.sourceArguments[0].expression] }),
  });
  const subject = storage.subjectFor(invocation);
  assert.equal(subject.kind, "resolved");
  const origins = storage.originsFor(subject.subject);
  assert.equal(origins.kind, "resolved");
  assert.equal(origins.origins[0].subject.node === invocation, true);
});

test("a certified native allocation is an exact owned result independent of argument preservation", () => {
  const { source, invocation, selected } = fixture();
  const original = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const allocated = createSourceStorageQuery(source, source.navigation.sourceFiles, undefined, {
    call: () => ({ resultAllocation: selected.call }),
  });
  const subject = allocated.subjectFor(invocation);
  assert.equal(subject.kind === "resolved", true);
  const closed = allocated.closedOriginsFor(subject.subject);
  assert.equal(closed.kind === "complete" && closed.origins.length === 1 && closed.origins[0].subject.node === invocation, true);
  assert.equal(allocated.boundaries.some(boundary => boundary.invocation === invocation), true, "opaque argument effects remain recorded");
  const originalSubject = original.subjectFor(invocation);
  assert.equal(originalSubject.kind === "resolved" && original.closedOriginsFor(originalSubject.subject).kind === "open", true,
    "absence of a semantic allocation contribution stays open");
  const observed = allocated.originsFor(subject.subject);
  assert.equal(observed.kind === "resolved" && observed.origins.length === 1 && observed.origins[0].subject.node === invocation, true,
    "observed origin contract is unchanged");
  const contributed = { resultAllocation: selected.call };
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const snapshotted = snapshotSourceStorageCallEffect(contributed, selected, budget);
  contributed.resultAllocation = selected.sourceArguments[0].expression;
  assert.equal(snapshotted !== undefined && Object.isFrozen(snapshotted) && snapshotted.resultAllocation === invocation, true);
});

test("effect snapshots retain exact nodes without keeping mutable selector containers", () => {
  const { selected } = fixture();
  const inputs = [selected.sourceArguments[0].expression];
  const contributed = { resultAlias: inputs[0], preservedInputs: inputs };
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const effect = snapshotSourceStorageCallEffect(contributed, selected, budget);
  assert.equal(effect !== undefined, true);
  inputs.push(selected.sourceArguments[1].expression);
  contributed.resultAlias = selected.sourceArguments[1].expression;
  assert.equal(effect.resultAlias === selected.sourceArguments[0].expression, true);
  assert.equal(effect.preservedInputs.length, 1);
  assert.equal(Object.isFrozen(effect), true);
  assert.equal(Object.isFrozen(effect.preservedInputs), true);
});

test("foreign duplicate sparse accessor and unknown effect selections fail closed", () => {
  const { source, selected } = fixture();
  const foreign = fixture().selected.sourceArguments[0].expression;
  let evaluated = 0;
  for (const [label, contribution] of [
    ["foreign alias", { resultAlias: foreign }],
    ["foreign allocation", { resultAllocation: fixture().invocation }],
    ["input is not an allocation", { resultAllocation: selected.sourceArguments[0].expression }],
    ["copied allocation identity", { resultAllocation: Object.freeze({ ...selected.call }) }],
    ["allocation and alias are exclusive", { resultAllocation: selected.call, resultAlias: selected.sourceArguments[0].expression }],
    ["invalid allocation", { resultAllocation: false }],
    ["foreign input", { preservedInputs: [foreign] }],
    ["duplicate", { preservedInputs: [selected.sourceArguments[0].expression, selected.sourceArguments[0].expression] }],
    ["sparse", { preservedInputs: new Array(1) }],
    ["nonfinite", { preservedInputs: Infinity }],
    ["unknown field", { preservedInputs: [], arbitrary: true }],
    ["accessor", { get resultAlias() { evaluated += 1; return selected.sourceArguments[0].expression; } }],
    ["allocation accessor", { get resultAllocation() { evaluated += 1; return selected.call; } }],
  ]) {
    const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, undefined, { call: () => contribution });
    assert.equal(storage.failureReason() !== undefined, true, label);
  }
  assert.equal(evaluated, 0);
  const unresolved = createSourceStorageBudget(defaultSourceStorageLimits);
  assert.equal(snapshotSourceStorageCallEffect({ resultAllocation: selected.call },
    { ...selected, sourceSelectedSignatureKind: "unresolved" }, unresolved) === undefined && unresolved.failure() !== undefined, true,
    "allocation requires a resolved selected call");
});

test("effect rows retain independent finite source-storage accounting", () => {
  const { selected } = fixture();
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 1 });
  const effect = snapshotSourceStorageCallEffect({ preservedInputs: [selected.sourceArguments[0].expression] }, selected, budget);
  assert.equal(effect === undefined, true);
  assert.equal(budget.failure() !== undefined, true);
});
