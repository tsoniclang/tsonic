import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageGuardedValues } from "../../packages/target-api/dist/target-analysis/source-storage/graph/guarded-values.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function checked(body) {
  const program = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(program.diagnostics.length === 0, true, formatDiagnostics(program.diagnostics));
  const source = createTargetSourceProgram(program);
  const file = program.getSourceFile("/src/index.ts");
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  return { source, file, initializer };
}

function fixture(limits = {}) {
  const current = checked(`
    class Base { readonly tag = 0; }
    class Left extends Base {}
    class Right extends Base {}
    class Child extends Left {}
    declare function external(): Base;
    const left = new Left(); const right = new Right(); const child = new Child();
    const unknown = external(); const scalar = 1;
    function select(value: Base) {
      if (value instanceof Left) { const selected = value; return selected; }
      if (!(value instanceof Left)) { const rejected = value; return rejected; }
      return value;
    }
  `);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 16_384, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const classValues = createSourceStorageTransport(current.source, current.source.navigation.sourceFiles,
    createSourceStorageBudget(defaultSourceStorageLimits)).classLineagesFor;
  const guards = createSourceStorageGuardedValues(current.source, budget, classValues);
  return { ...current, budget, subject, guards, owner: name => subject(current.initializer(name)),
    reference: current.initializer("selected"), opposite: current.initializer("rejected") };
}

test("nominal admission distinguishes proven true, proven false and genuinely unknown physical owners", () => {
  const current = fixture();
  for (const [name, result] of [["left", true], ["right", false], ["child", true], ["scalar", false], ["unknown", undefined]]) {
    assert.equal(current.guards.admits(current.owner(name), current.reference), result, name);
  }
  assert.equal(current.budget.failure() === undefined, true);
});

test("immutable admission reuse never merges a different checked guard, subject or projection", () => {
  const current = fixture();
  const left = current.owner("left");
  const projected = current.subject(left.node, left.kind, [{ kind: "array-element" }]);
  for (let repeat = 0; repeat < 32; repeat += 1) {
    assert.equal(current.guards.admits(left, current.reference), true);
    assert.equal(current.guards.admits(left, current.opposite), false);
    assert.equal(current.guards.admits(current.owner("right"), current.reference), false);
    assert.equal(current.guards.admits(projected, current.reference), undefined);
  }
  assert.equal(current.budget.failure() === undefined, true);
});

test("admission history retains only its exact immutable relations and preserves finite repeat work", () => {
  const remaining = repeats => {
    const current = fixture({ maximumTransportRows: 128 });
    const owner = current.owner("unknown");
    for (let repeat = 0; repeat < repeats; repeat += 1) assert.equal(current.guards.admits(owner, current.reference), undefined);
    assert.equal(current.budget.failure() === undefined, true);
    let rows = 0;
    while (current.budget.row()) rows += 1;
    return rows;
  };
  assert.equal(remaining(1), remaining(128), "unknown is a complete immutable result, not an absent cache entry");
  const current = fixture({ maximumSteps: 64 });
  const owner = current.owner("left");
  assert.equal(current.guards.admits(owner, current.reference), true);
  for (let repeat = 0; repeat < 64; repeat += 1) current.guards.admits(owner, current.reference);
  assert.match(current.budget.failure(), /analysis-work/u);
  assert.equal(current.guards.admits(owner, current.reference), undefined);
});

test("an unknown admitted owner still carries its exact contradictory guard restrictions", () => {
  const current = fixture();
  assert.equal(current.guards.admits(current.owner("unknown"), current.reference), undefined);
  const selected = current.guards.conjoin(undefined, current.reference);
  assert.equal(selected !== undefined && selected !== null, true);
  assert.equal(current.guards.conjoin(selected, current.opposite), null);
  assert.equal(current.budget.failure() === undefined, true);
});

test("failed admission row reservations publish no partial true answer", () => {
  const current = fixture({ maximumTransportRows: 2 });
  assert.equal(current.budget.row(), true);
  const owner = current.owner("left");
  assert.equal(current.guards.admits(owner, current.reference), undefined);
  assert.match(current.budget.failure(), /transport-row/u);
  assert.equal(current.guards.admits(owner, current.reference), undefined);
});

for (const reverse of [false, true]) {
  test(`terminal nominal filters retain recursive caller identity without equations for discarded leaves (${reverse})`, () => {
    const count = 32;
    const current = checked(`
      declare const stop: boolean;
      class Value { readonly tag = 0; }
      ${Array.from({ length: count }, (_, index) => `class Variant${index} extends Value {
        constructor(readonly token: object) { super(); }
        read(): object { return this.token; }
      }`).join("\n")}
      function transform(value: Value): Value {
        ${Array.from({ length: count }, (_, index) => `if (value instanceof Variant${index})
          return new Variant${(index + 1) % count}(value.read());`).join("\n")}
        return value;
      }
      function recur(value: Value): Value { return stop ? value : recur(transform(value)); }
      function resolve(token: object): object {
        const value = recur(new Variant0(token));
        ${Array.from({ length: count }, (_, index) => `if (value instanceof Variant${index}) return value.read();`).join("\n")}
        return token;
      }
      const left = {}; const right = {};
      const first = resolve(left); const second = resolve(right);
    `);
    // Step bound measured 2026-10-23 (round-1 shared lane): 32 variants need 2_719_744 steps in either order (4: 125_952,
    // 8: 299_008, 16: 835_584); the growth over the earlier bound comes from the per-activation closed-call proofs added in
    // e7e76d954, not from unshared relations. 4_194_304 keeps that measured work plus 54% headroom.
    const storage = createSourceStorageQuery(current.source, [current.file], { ...defaultSourceStorageLimits, maximumSteps: 4_194_304 });
    const selections = [["first", "left"], ["second", "right"]];
    for (const [name, original] of reverse ? selections.reverse() : selections) {
      const subject = storage.subjectFor(current.initializer(name));
      assert.equal(subject.kind === "resolved", true);
      const result = storage.closedOriginsFor(subject.subject);
      assert.equal(result.kind === "complete", true, `${name}: ${storage.failureReason() ?? result.kind}`);
      assert.equal(result.origins.length === 1 && result.origins[0].subject.node === current.initializer(original), true,
        `${name}: only its exact input producer; no cross-caller union`);
    }
    assert.equal(storage.failureReason() === undefined, true);
  });
}
