import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageScopedTraversal } from "../../packages/target-api/dist/target-analysis/source-storage/scoped-traversal.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

const frame = (parents = [], caller) => Object.freeze({ kind: "frame", entries: new Map(), parents: Object.freeze(parents), caller });
const variable = initial => Object.freeze({ kind: "variable", equation: { initial }, owner: {} });
const view = (scope, replacements) => Object.freeze({ kind: "substitution", scope, substitutions: new Map(replacements) });

test("scoped traversal keeps lexical captures distinct from the actual caller chain", () => {
  const caller = frame(); const captured = frame(); const root = frame([captured, caller], caller);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const walk = createSourceStorageScopedTraversal(budget);
  const lexical = [...walk(root)].map(entry => entry.scope);
  const active = [...walk(root, "caller")].map(entry => entry.scope);
  assert.equal(lexical.length === 3 && lexical[0] === root && lexical[1] === captured && lexical[2] === caller, true);
  assert.equal(active.length === 2 && active[0] === root && active[1] === caller, true);
  assert.equal(budget.failure() === undefined, true);
});

test("scoped traversal applies simultaneous replacements in their exact inner-to-outer context", () => {
  const empty = frame(); const first = variable(empty); const second = variable(empty); const third = variable(empty);
  const input = frame([first]);
  const inner = view(input, [[first, second], [second, third]]);
  const outer = view(frame([inner]), [[second, empty]]);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const selected = [...createSourceStorageScopedTraversal(budget)(outer)];
  assert.equal(selected.length === 3 && selected[2].scope === empty, true,
    "the selected replacement does not recursively reapply the same simultaneous map");
  assert.equal(selected.some(entry => entry.scope === third), false);
  assert.equal(budget.failure() === undefined, true);
});

test("shared scopes under different replacement paths preserve both exact contextual alternatives", () => {
  const empty = frame(); const parameter = variable(empty); const first = frame(); const second = frame();
  const shared = frame([parameter]);
  const root = frame([view(shared, [[parameter, first]]), view(shared, [[parameter, second]])]);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const selected = [...createSourceStorageScopedTraversal(budget)(root)];
  assert.equal(selected.filter(entry => entry.scope === shared).length, 2, "scope identity alone cannot discard another binding path");
  assert.equal(selected.some(entry => entry.scope === first) && selected.some(entry => entry.scope === second), true);
  assert.equal(budget.failure() === undefined, true);
});

test("one substitution path shares one visited index across the entire exact caller chain", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 34 });
  let root = frame();
  const originals = [root];
  for (let index = 1; index < 32; index += 1) { root = frame([root], root); originals.push(root); }
  const selected = [...createSourceStorageScopedTraversal(budget)(root, "caller")];
  assert.equal(selected.length === 32 && selected.every((entry, index) => entry.scope === originals[31 - index]), true,
    "every original scope is visited without allocating a separate singleton path set for each one");
  assert.equal(budget.failure() === undefined, true, "the same finite bound protects the actual visited relation and live frontier");
});

test("scoped traversal reserves a broad pending frontier before visiting any child", () => {
  const children = Array.from({ length: 20 }, () => frame());
  const root = frame(children);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 5 });
  const selected = [...createSourceStorageScopedTraversal(budget)(root)];
  assert.equal(selected.length === 1 && selected[0].scope === root, true);
  assert.match(budget.failure(), /transport-row/u);
  const work = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 1 });
  assert.equal([...createSourceStorageScopedTraversal(work)(frame())].length, 0);
  assert.match(work.failure(), /analysis-work/u);
});

test("scoped traversal closes cycles and releases temporary rows on early return and throw", () => {
  const parents = [];
  const root = Object.freeze({ kind: "frame", entries: new Map(), parents });
  parents.push(root);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 3 });
  const walk = createSourceStorageScopedTraversal(budget);
  assert.equal([...walk(root)].length, 1, "a repeated exact context is visited once");
  const failure = new Error("exact consumer failure");
  for (let repeat = 0; repeat < 100; repeat += 1) {
    for (const entry of walk(root)) { assert.equal(entry.scope === root, true); break; }
    assert.throws(() => { for (const entry of walk(root)) { assert.equal(entry.scope === root, true); throw failure; } }, error => error === failure);
  }
  assert.equal(budget.failure() === undefined, true, "only live traversal rows remain charged");
});
