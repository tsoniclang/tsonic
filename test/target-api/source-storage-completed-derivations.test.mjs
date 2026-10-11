import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(limits = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {};
    declare const stop: boolean;
    class Item { constructor(readonly value: object) {} }
    function descend(item: Item): Item { return stop ? item : descend(new Item(item.value)); }
    function pipeline(value: object): object { return descend(new Item(value)).value; }
    const left = {}; const right = {};
    const first = pipeline(left); const second = pipeline(right);
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const transport = createSourceStorageTransport(source, [file], budget);
  const subject = name => transport.subjectFor(Node_Initializer(source.ast, namedVariable(source.ast, file, name)));
  const walk = (name, stopAt) => transport.substitutions.walk(subject(name), transport.substitutions.empty, stopAt);
  const expect = (name, original, stopAt) => {
    const result = walk(name, stopAt);
    assert.equal(result !== undefined && result.origins.size === 1 && result.origins.has(subject(original)), true,
      `${name}: exact ${original} origin; ${budget.failure() ?? "no failure"}`);
    return result;
  };
  return { budget, transport, subject, walk, expect };
}

test("completed recursive derivations are reused within the original finite query owner", () => {
  const current = fixture({ maximumSteps: 16_384 });
  for (let repeat = 0; repeat < 32; repeat += 1) current.expect("first", "left");
  assert.equal(current.budget.failure() === undefined, true);
});

for (const reverse of [false, true]) {
  test(`completed dependencies never cache a walk's boundary predicate (${reverse})`, () => {
    const current = fixture();
    const first = current.subject("first");
    const checks = [() => current.expect("first", "first", entry => entry.subject === first),
      () => current.expect("first", "left")];
    for (let repeat = 0; repeat < 3; repeat += 1)
      for (const check of reverse ? [...checks].reverse() : checks) check();
    current.expect("second", "right");
    assert.equal(current.budget.failure() === undefined, true);
  });

  test(`completed dependencies keep recursive caller and contribution identities (${reverse})`, () => {
    const current = fixture();
    const entries = [["first", "left", "right"], ["second", "right", "left"]];
    for (const [name, own, foreign] of reverse ? entries.reverse() : entries) {
      const original = current.expect(name, own);
      const repeated = current.expect(name, own);
      assert.equal(repeated.origins.has(current.subject(foreign)), false);
      assert.equal(original.subjects.length === repeated.subjects.length && original.subjects.every(input =>
        repeated.subjects.some(value => value.subject === input.subject && value.bindings === input.bindings &&
          value.contributes === input.contributes)), true, "each exact original scoped contribution survives");
    }
    assert.equal(current.budget.failure() === undefined, true);
  });
}

test("a throwing boundary cannot poison a completed relation or cache its stopping decision", () => {
  const current = fixture();
  current.expect("first", "left");
  const failure = new Error("boundary unavailable");
  assert.throws(() => current.walk("first", () => { throw failure; }), error => error === failure);
  current.expect("first", "left");
  current.expect("second", "right");
  assert.equal(current.budget.failure() === undefined, true);
});

for (const resource of ["step", "row"]) {
  test(`completed dependencies never bypass exhausted ${resource} evidence`, () => {
    const current = fixture({ maximumSteps: 8192, maximumTransportRows: 4096 });
    current.expect("first", "left");
    while (current.budget[resource]()) {}
    assert.equal(current.walk("first") === undefined, true);
    assert.equal(current.walk("first", () => true) === undefined, true);
    assert.match(current.budget.failure(), resource === "step" ? /analysis-work/u : /transport-row/u);
  });
}
