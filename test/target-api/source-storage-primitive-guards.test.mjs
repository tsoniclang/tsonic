import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body, files = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    files: { "/src/index.ts": `export {}; ${body}`, ...files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, {
    ...defaultSourceStorageLimits, maximumSteps: 65_536,
  });
  const variable = name => namedVariable(source.ast, file, name);
  const initializer = name => Node_Initializer(source.ast, variable(name));
  const result = () => {
    const subject = storage.subjectFor(variable("result"));
    assert.equal(subject.kind === "resolved", true, "exact checked result subject");
    return storage.closedOriginsFor(subject.subject);
  };
  return { source, storage, result, initializer };
}

for (const expression of ["undefined", "null", "3", "true", '"text"', "4n", "Symbol()"])
  test(`a native nominal guard excludes the known primitive carrier ${expression}`, () => {
    const current = fixture(`
      class Box { constructor(readonly value: object) {} }
      const fallback = {};
      function select(value: unknown): object {
        if (value instanceof Box) return value.value;
        return fallback;
      }
      const result = select(${expression});
    `);
    const selected = current.result();
    assert.equal(selected.kind === (expression === "Symbol()" ? "open" : "complete"), true,
      `${expression}: ${selected.kind}; ${current.storage.failureReason() ?? "no resource failure"}`);
    assert.equal(selected.origins.length === 1 && selected.origins[0].subject.node === current.initializer("fallback"), true,
      "an impossible nominal member read cannot invent or reject a primitive's field");
    if (expression === "Symbol()") assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-result"), true,
      "a known primitive return carrier does not erase the independent imported-call boundary");
    assert.equal(current.storage.failureReason() === undefined, true);
  });

for (const condition of ["value instanceof Box", "!(value instanceof Box) === false",
  "value instanceof Box && enabled", "value instanceof Box || value instanceof Derived"])
  test(`actual native class alternatives remain admitted by ${condition}`, () => {
    const current = fixture(`
      declare const enabled: boolean;
      class Box { constructor(readonly value: object) {} }
      class Derived extends Box {}
      const own = {}; const fallback = {};
      function select(value: unknown): object {
        if (${condition}) return value.value;
        return fallback;
      }
      const result = select(new Derived(own));
    `);
    const selected = current.result();
    assert.equal(selected.kind === "complete", true, `${selected.kind}; ${current.storage.failureReason() ?? "no failure"}`);
    assert.equal(selected.origins.length === 2 && ["own", "fallback"].every(name =>
      selected.origins.some(origin => origin.subject.node === current.initializer(name))), true,
    "primitive exclusion does not replace class inheritance or over-prune an independently possible return");
    assert.equal(current.storage.failureReason() === undefined, true);
  });

test("cross-file checked primitive aliases retain their source owner through nominal guards", () => {
  const current = fixture(`
    import { Box, select } from "./select.js";
    const fallback = {};
    const result = select(17, fallback);
  `, { "/src/select.ts": `
    export class Box { constructor(readonly value: object) {} }
    export function select<Value>(input: Value, fallback: object): object {
      const value: unknown = input;
      if (value instanceof Box) return value.value;
      return fallback;
    }
  ` });
  const selected = current.result();
  assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
    selected.origins[0].subject.node === current.initializer("fallback"), true,
  `exact cross-file generic substitution: ${selected.kind}; ${current.storage.failureReason() ?? "no failure"}`);
});

test("an unknown object is not fabricated into a nominal class by primitive exclusion", () => {
  const current = fixture(`
    class Box { constructor(readonly value: object) {} }
    declare const external: unknown;
    const fallback = {};
    function select(value: unknown): object {
      if (value instanceof Box) return value.value;
      return fallback;
    }
    const result = select(external);
  `);
  assert.equal(current.result().kind === "unresolved", true, "a missing actual class relationship remains unproven");
  assert.equal(current.storage.failureReason() === "Source storage members require exact checked correspondence.", true);
});

test("a primitive-valued binding replaced after its guard keeps the new native producer", () => {
  const current = fixture(`
    class Box { constructor(readonly value: object) {} }
    const own = {}; const fallback = {};
    function select(value: unknown): object {
      if (!(value instanceof Box)) {
        value = new Box(own);
        if (value instanceof Box) return value.value;
      }
      return fallback;
    }
    const result = select(3);
  `);
  const selected = current.result();
  assert.equal(selected.kind === "complete" && selected.origins.length === 2 && ["own", "fallback"].every(name =>
    selected.origins.some(origin => origin.subject.node === current.initializer(name))), true,
  `the old primitive fact cannot narrow a later write: ${selected.kind}; ${current.storage.failureReason() ?? "no failure"}`);
});
