import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { requiredNode } from "../fixtures/source-navigation.mjs";
import { createSourceStorageDomainWitnesses } from "../../packages/target-api/dist/target-analysis/source-storage/domain-witnesses.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

const subject = (node = {}, kind = "value", projection = []) => ({ node, kind, projection });

test("domain witnesses retain exact composite identities and original insertion order", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const witnesses = createSourceStorageDomainWitnesses(budget);
  const selected = subject();
  const other = subject(selected.node, "return");
  const owner = subject();
  const projected = subject(owner.node, "value", [{ kind: "array-element" }]);
  const first = {};
  const second = {};
  const additions = [
    [selected, "external-input", first, undefined],
    [selected, "external-write", first, undefined],
    [selected, "external-input", second, undefined],
    [selected, "external-input", first, owner],
    [selected, "external-input", first, projected],
    [other, "external-input", first, owner],
  ];
  for (const addition of additions) witnesses.add(...addition);
  const values = [...witnesses.forSubject(selected)];
  assert.equal(values.length, 5, "subject, kind, exposure, owner and absent owner remain independent");
  for (let index = 0; index < values.length; index += 1) {
    const [expectedSubject, kind, exposure, expectedOwner] = additions[index];
    const value = values[index];
    assert.equal(value.subject === expectedSubject && value.kind === kind && value.exposure === exposure && value.owner === expectedOwner,
      true, `exact ordered witness ${index}`);
    assert.equal(Object.isFrozen(value), true, "finalized immutable boundary");
    assert.equal(Object.hasOwn(value, "owner"), expectedOwner !== undefined, "absence is not an invented owner");
  }
  for (const addition of additions) witnesses.add(...addition);
  const repeated = witnesses.forSubject(selected);
  assert.equal(repeated.length === values.length && repeated.every((value, index) => value === values[index]), true,
    "repeat admission retains identical witnesses without reordering");
  assert.equal(witnesses.forSubject(other).length === 1 && witnesses.forSubject(other)[0].owner === owner, true);
  assert.equal(witnesses.forSubject(subject()).length, 0, "unknown exact subject remains absent");
  assert.equal(budget.failure() === undefined, true);
});

test("many distinct exposures and repeated admissions remain linear under finite work and retained rows", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 256, maximumTransportRows: 768 });
  const witnesses = createSourceStorageDomainWitnesses(budget);
  const selected = subject();
  const exposures = Array.from({ length: 128 }, () => ({}));
  for (const exposure of exposures) witnesses.add(selected, "external-write", exposure);
  const original = [...witnesses.forSubject(selected)];
  for (const exposure of exposures) witnesses.add(selected, "external-write", exposure);
  assert.equal(original.length === exposures.length && original.every((value, index) => value.exposure === exposures[index]), true);
  assert.equal(witnesses.forSubject(selected).every((value, index) => value === original[index]), true);
  assert.equal(budget.failure() === undefined, true, "128 distinct and 128 repeat admissions fit the unchanged small finite work");
  witnesses.add(selected, "external-write", exposures[0]);
  assert.match(budget.failure(), /analysis-work/u, "even exact repeat admission cannot bypass exhausted work");
  assert.equal(witnesses.forSubject(selected).length, 128, "failure changes no existing witness");
});

test("witness admission reserves every retained index cell atomically and never clears exhaustion", () => {
  for (const maximumTransportRows of [1, 2, 3, 4]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows });
    const witnesses = createSourceStorageDomainWitnesses(budget);
    const selected = subject();
    witnesses.add(selected, "external-write", {});
    assert.equal(witnesses.forSubject(selected).length, 0, "no partially indexed boundary");
    assert.equal(budget.failure(), "Source storage rows require a live owner and a finite positive reservation.",
      "the existing reservation owner rejects a cost larger than the complete ceiling");
    witnesses.add(selected, "external-input", {});
    assert.equal(witnesses.forSubject(selected).length, 0, "failed owner stays failed");
  }
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 5 });
  const witnesses = createSourceStorageDomainWitnesses(budget);
  const selected = subject();
  const exposure = {};
  witnesses.add(selected, "external-write", exposure);
  const original = witnesses.forSubject(selected)[0];
  witnesses.add(selected, "external-write", exposure);
  assert.equal(budget.failure() === undefined && witnesses.forSubject(selected)[0] === original, true,
    "exact duplicate does not reserve another cell");
  witnesses.add(selected, "external-write", {});
  assert.match(budget.failure(), /transport-row/u);
  assert.equal(witnesses.forSubject(selected).length === 1 && witnesses.forSubject(selected)[0] === original, true);
  witnesses.add(selected, "external-write", exposure);
  assert.match(budget.failure(), /transport-row/u, "replay cannot reset the shared failure");
});

test("checked public class instances retain every exact writable exposure under a finite linear publication budget", () => {
  const count = 256;
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `class Holder { token = {}; } ${Array.from({ length: count }, (_, index) =>
      `export const value${index} = new Holder();`).join("\n")}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "unmodified idiomatic TypeScript checks");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file], { ...defaultSourceStorageLimits, maximumSteps: 32768 });
  const field = requiredNode(source.ast, file, node => source.ast.is.IsPropertyDeclaration(node));
  const selected = storage.subjectFor(field);
  assert.equal(selected.kind === "resolved", true, "exact original field");
  const result = storage.closedOriginsFor(selected.subject);
  assert.equal(result.kind === "open", true, "public native members preserve unknown external writes");
  const writes = result.boundaries.filter(boundary => boundary.kind === "external-write");
  assert.equal(writes.length, count, "no original exposure removed");
  assert.equal(new Set(writes.map(boundary => boundary.exposure)).size, count, "no exposure merged by spelling or shape");
  assert.equal(writes.every(boundary => boundary.subject === selected.subject && Object.isFrozen(boundary)), true);
  assert.equal(storage.failureReason() === undefined, true, "the same original small finite ceiling remains valid");
});
