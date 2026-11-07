import { createJsSourceApiFacts } from "../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createHostSourceProgram } from "../../packages/target-api/dist/public/host.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { snapshotSourceStorageCallEffect } from "../../packages/target-api/dist/target-analysis/source-storage/graph/call-effects.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture() {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `declare function relay(value: object, other: object): object;
      const first = {}; const second = {}; const result = relay(first, second);` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const declaration = namedVariable(source.ast, file, "result");
  const invocation = source.ast.as.AsVariableDeclaration(declaration).Initializer;
  const selected = source.navigation.call(invocation);
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
      return { resultAlias: selected.arguments[0] };
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

test("removed preservation contributions are rejected rather than accepted or ignored", () => {
  const { source, invocation, selected } = fixture();
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, undefined, {
    call: () => ({ preservedInputs: [selected.arguments[0]] }),
  });
  const subject = storage.subjectFor(invocation);
  assert.equal(subject.kind === "unresolved" && storage.failureReason() !== undefined, true,
    "no partial alias or empty writer proof escapes a removed effect contract");
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
  const snapshotted = snapshotSourceStorageCallEffect(contributed, selected, undefined, budget);
  contributed.resultAllocation = selected.arguments[0];
  assert.equal(snapshotted !== undefined && Object.isFrozen(snapshotted) && snapshotted.resultAllocation === invocation, true);
});

test("effect snapshots retain exact aliases without keeping mutable selector containers", () => {
  const { selected } = fixture();
  const inputs = [selected.arguments[0]];
  const contributed = { resultAlias: inputs[0] };
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const effect = snapshotSourceStorageCallEffect(contributed, selected, undefined, budget);
  assert.equal(effect !== undefined, true);
  inputs.push(selected.arguments[1]);
  contributed.resultAlias = selected.arguments[1];
  assert.equal(effect.resultAlias === selected.arguments[0], true);
  assert.equal(Object.hasOwn(effect, "preservedInputs"), false, "no removed input list is published");
  assert.equal(Object.isFrozen(effect), true);
});

test("foreign duplicate sparse accessor and unknown effect selections fail closed", () => {
  const { source, selected } = fixture();
  const foreign = fixture().selected.arguments[0];
  let evaluated = 0;
  for (const [label, contribution] of [
    ["foreign alias", { resultAlias: foreign }],
    ["foreign allocation", { resultAllocation: fixture().invocation }],
    ["input is not an allocation", { resultAllocation: selected.arguments[0] }],
    ["copied allocation identity", { resultAllocation: Object.freeze({ ...selected.call }) }],
    ["allocation and alias are exclusive", { resultAllocation: selected.call, resultAlias: selected.arguments[0] }],
    ["invalid allocation", { resultAllocation: false }],
    ["foreign input", { preservedInputs: [foreign] }],
    ["duplicate", { preservedInputs: [selected.arguments[0], selected.arguments[0]] }],
    ["sparse", { preservedInputs: new Array(1) }],
    ["nonfinite", { preservedInputs: Infinity }],
    ["removed empty field", { preservedInputs: [] }],
    ["unknown field", { preservedInputs: [], arbitrary: true }],
    ["accessor", { get resultAlias() { evaluated += 1; return selected.arguments[0]; } }],
    ["allocation accessor", { get resultAllocation() { evaluated += 1; return selected.call; } }],
  ]) {
    const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, undefined, { call: () => contribution });
    assert.equal(storage.failureReason() !== undefined, true, label);
  }
  assert.equal(evaluated, 0);
  const unresolved = createSourceStorageBudget(defaultSourceStorageLimits);
  assert.equal(snapshotSourceStorageCallEffect({ resultAllocation: selected.call },
    { ...selected, selection: "untyped" }, undefined, unresolved) === undefined && unresolved.failure() !== undefined, true,
    "allocation requires a resolved selected call");
});

test("effect rows retain independent finite source-storage accounting", () => {
  const { selected } = fixture();
  const fitting = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 1 });
  const published = snapshotSourceStorageCallEffect({ resultAlias: selected.arguments[0] }, selected, undefined, fitting);
  assert.equal(published?.resultAlias === selected.arguments[0] && fitting.failure() === undefined, true,
    "one immutable current effect fits its exact single published row");
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 1 });
  assert.equal(budget.row(), true, "the only available row is already owned");
  const effect = snapshotSourceStorageCallEffect({ resultAlias: selected.arguments[0] }, selected, undefined, budget);
  assert.equal(effect === undefined, true);
  assert.equal(budget.failure() !== undefined, true);
});
