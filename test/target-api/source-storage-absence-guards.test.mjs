import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageGuardedValues } from "../../packages/target-api/dist/target-analysis/source-storage/graph/guarded-values.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body, limits = {}, files = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    files: { "/src/index.ts": `export {}; ${body}`, ...files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 65_536, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject, () => []);
  const classValues = createSourceStorageTransport(source, source.navigation.sourceFiles,
    createSourceStorageBudget(defaultSourceStorageLimits)).classLineagesFor;
  const guards = createSourceStorageGuardedValues(source, budget, classValues);
  const declaration = name => namedVariable(source.ast, file, name);
  const initializer = name => Node_Initializer(source.ast, declaration(name));
  const owner = name => subject(initializer(name) ?? declaration(name));
  const storage = () => createSourceStorageQuery(source, source.navigation.sourceFiles,
    { ...defaultSourceStorageLimits, maximumSteps: 65_536, ...limits });
  return { source, file, budget, subject, guards, declaration, initializer, owner, storage };
}

const admissionFixture = `
  class Box {}
  declare function external(): unknown;
  declare function absentResult(): void;
  declare const mixed: number | null | undefined;
  declare const absentUnion: null | undefined;
  declare const voidUnion: number | void;
  declare const opaque: any;
  const missing = undefined; const nil = null; const zero = 0; const disabled = false;
  const empty = ""; const callback = () => 1; const object = {}; const box = new Box();
  const unknown = external(); const voidValue = absentResult();
  const tuple: [undefined, () => number] = [undefined, callback];
  function generic<Value>(value: Value) { const genericValue = value; }
  function constrained<Value extends number>(value: Value) { const constrainedValue = value; }
  function select(value: unknown) {
    if (value !== undefined) { const present = value; }
    if (value === null) { const absent = value; }
    if (value instanceof Box) { const nominal = value; }
    if (!(value instanceof Box)) { const nonNominal = value; }
    if (value !== undefined && value instanceof Box) { const conjunction = value; }
    if (value === null || value instanceof Box) { const disjunction = value; }
  }
`;

test("single-absence admission uses checked native carriers, not truthiness or source spelling", () => {
  const current = fixture(admissionFixture);
  for (const [name, present] of [
    ["missing", false], ["nil", false], ["voidValue", false],
    ["zero", true], ["disabled", true], ["empty", true], ["callback", true], ["object", true], ["box", true],
    ["absentUnion", false], ["voidUnion", undefined], ["unknown", undefined], ["opaque", undefined], ["mixed", undefined],
    ["genericValue", undefined], ["constrainedValue", true],
  ]) {
    assert.equal(current.guards.admits(current.owner(name), current.initializer("present")), present, name);
    assert.equal(current.guards.admits(current.owner(name), current.initializer("absent")),
      present === undefined ? undefined : !present, `${name}: inverse native absence`);
  }
  assert.equal(current.budget.failure() === undefined, true);
});

test("absence admission preserves exact projected component types", () => {
  const current = fixture(admissionFixture);
  for (const [index, expected] of [[0, false], [1, true], [2, undefined]]) {
    const owner = current.subject(current.declaration("tuple"), "value", [{ kind: "tuple-element", index }]);
    assert.equal(current.guards.admits(owner, current.initializer("present")), expected, `tuple component ${index}`);
  }
  assert.equal(current.budget.failure() === undefined, true);
});

for (const [condition, expectsPresent] of [
  ["value !== undefined", true], ["undefined !== value", true], ["value != null", true],
  ["!(value === null)", true], ["value === undefined", false], ["null === value", false],
  ["value == null", false], ["!(undefined !== value)", false],
]) {
  test(`native single-absence polarity remains exact through ${condition}`, () => {
    const current = fixture(`
      const nil = null; const missing = undefined; const present = () => 1;
      function select(value: unknown) { if (${condition}) { const selected = value; } }
    `);
    assert.equal(current.guards.appliesTo(current.initializer("selected")), true);
    for (const [name, expected] of [["nil", !expectsPresent], ["missing", !expectsPresent], ["present", expectsPresent]])
      assert.equal(current.guards.admits(current.owner(name), current.initializer("selected")), expected, name);
    assert.equal(current.budget.failure() === undefined, true);
  });
}

test("a checked imported absence alias narrows without recognizing its name", () => {
  const current = fixture(`
    import { vacant } from "./absence.js";
    const missing = undefined; const present = () => 1;
    function select(value: unknown) { if (vacant !== value) { const selected = value; } }
  `, {}, { "/src/absence.ts": "export const vacant: undefined = undefined;" });
  assert.equal(current.guards.admits(current.owner("missing"), current.initializer("selected")), false);
  assert.equal(current.guards.admits(current.owner("present"), current.initializer("selected")), true);
});

test("a shadowed undefined identifier does not manufacture an absence predicate", () => {
  const current = fixture(`
    function select(value: unknown, undefined: number) {
      if (value !== undefined) { const selected = value; }
    }
  `);
  assert.equal(current.guards.appliesTo(current.initializer("selected")), false);
  assert.equal(current.budget.failure() === undefined, true);
});

test("absence support does not invent unrelated literal or typeof storage filters", () => {
  const current = fixture(`
    function select(value: unknown) {
      if (value === 0) { const literal = value; }
      if (typeof value === "number") { const category = value; }
    }
  `);
  assert.equal(current.guards.appliesTo(current.initializer("literal")), false);
  assert.equal(current.guards.appliesTo(current.initializer("category")), false);
  assert.equal(current.budget.failure() === undefined, true);
});

test("absence and nominal conjunctions reject contradictions while preserving possible unknowns", () => {
  const current = fixture(admissionFixture);
  for (const [first, second, possible] of [
    ["present", "absent", false], ["absent", "present", false], ["nominal", "absent", false],
    ["absent", "nominal", false], ["nominal", "present", true], ["nonNominal", "absent", true],
  ]) {
    const selected = current.guards.conjoin(undefined, current.initializer(first));
    assert.equal(selected !== null && selected !== undefined, true, first);
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.references), true);
    const result = current.guards.conjoin(selected, current.initializer(second));
    assert.equal(result !== undefined, true, `${first}; ${second}: exact finite conjunction`);
    assert.equal(result !== null, possible, `${first}; ${second}`);
  }
  assert.equal(current.guards.admits(current.owner("unknown"), current.initializer("present")), undefined);
  assert.equal(current.guards.admits(current.owner("nil"), current.initializer("conjunction")), false);
  assert.equal(current.guards.admits(current.owner("box"), current.initializer("conjunction")), true);
  assert.equal(current.guards.admits(current.owner("nil"), current.initializer("disjunction")), true);
  assert.equal(current.guards.admits(current.owner("box"), current.initializer("disjunction")), true);
  assert.equal(current.guards.admits(current.owner("zero"), current.initializer("disjunction")), false);
  assert.equal(current.budget.failure() === undefined, true);
});

for (const [name, body] of [
  ["rebound parameter", `function select(value: unknown) {
    if (value !== undefined) { value = undefined; const selected = value; }
  }`],
  ["exported binding", `export let value: unknown;
    if (value !== undefined) { const selected = value; }
  `],
  ["captured mutation", `function select(input: unknown) {
    let value: unknown = input;
    function replace() { value = undefined; }
    if (value !== undefined) { replace(); const selected = value; }
  }`],
]) {
  test(`absence narrowing cannot reuse an invalidated ${name} guard`, () => {
    const current = fixture(body);
    assert.equal(current.guards.appliesTo(current.initializer("selected")), false);
    assert.equal(current.budget.failure() === undefined, true);
  });
}

for (const absent of ["undefined", "null"]) {
  test(`guarded optional callable transport drops its ${absent} origin before another conversion`, () => {
    const current = fixture(`
      declare const present: boolean;
      const original = () => 3;
      const first: (input: number) => number = original;
      const optional: typeof first | ${absent} = present ? first : ${absent};
      if (optional !== ${absent}) {
        const second: (left: number, right: number) => number = optional;
      }
    `);
    const storage = current.storage();
    const subject = storage.subjectFor(current.initializer("second"));
    assert.equal(subject.kind === "resolved", true);
    const selected = storage.closedOriginsFor(subject.subject);
    assert.equal(selected.kind === "complete", true, `${selected.kind}; ${storage.failureReason() ?? "no failure"}`);
    assert.equal(selected.origins.length === 1 && selected.origins[0].subject.node === current.initializer("original"), true,
      "the source callable remains exact and the absent producer is not admitted");
    assert.equal(storage.failureReason() === undefined, true);
  });
}

test("single-absence filtering keeps opaque provenance open instead of inventing a producer", () => {
  const current = fixture(`
    declare function external(): (() => number) | undefined;
    const optional = external();
    if (optional !== undefined) { const selected = optional; }
  `);
  const storage = current.storage();
  const subject = storage.subjectFor(current.initializer("selected"));
  assert.equal(subject.kind === "resolved", true);
  const selected = storage.closedOriginsFor(subject.subject);
  assert.equal(selected.kind === "open", true, `${selected.kind}; ${storage.failureReason() ?? "no failure"}`);
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-result"), true);
  assert.equal(selected.origins.length === 1 && selected.origins[0].subject.node === current.initializer("optional"), true);
});

test("unknown absence admissions reuse exact immutable entries without accumulating rows", () => {
  const remaining = repeats => {
    const current = fixture(admissionFixture, { maximumTransportRows: 128 });
    const owner = current.owner("unknown");
    for (let repeat = 0; repeat < repeats; repeat += 1)
      assert.equal(current.guards.admits(owner, current.initializer("present")), undefined);
    assert.equal(current.budget.failure() === undefined, true);
    let rows = 0;
    while (current.budget.row()) rows += 1;
    return rows;
  };
  assert.equal(remaining(1), remaining(64));
});

for (const [name, limits] of [
  ["work", { maximumSteps: 2 }], ["rows", { maximumTransportRows: 1 }],
]) {
  test(`absence guard ${name} exhaustion cannot publish a partial admission or conjunction`, () => {
    const current = fixture(admissionFixture, limits);
    assert.equal(current.guards.admits(current.owner("callback"), current.initializer("present")), undefined);
    assert.equal(current.budget.failure() !== undefined, true);
    assert.equal(current.guards.conjoin(undefined, current.initializer("present")), undefined);
    assert.equal(current.guards.admits(current.owner("callback"), current.initializer("present")), undefined);
  });
}

for (const [name, limits] of [
  ["work", { maximumSteps: 2 }], ["rows", { maximumTransportRows: 2 }],
]) {
  test(`constructing a new absence conjunction accounts for its ${name} before publication`, () => {
    const current = fixture(admissionFixture, limits);
    assert.equal(current.guards.conjoin(undefined, current.initializer("present")), undefined);
    assert.equal(current.budget.failure() !== undefined, true);
    assert.equal(current.guards.conjoin(undefined, current.initializer("present")), undefined);
  });
}
