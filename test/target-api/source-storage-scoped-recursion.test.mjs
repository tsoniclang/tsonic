import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageScopedRecursion } from "../../packages/target-api/dist/target-analysis/source-storage/scoped-recursion.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

function fixture() {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 128, maximumSteps: 4096 });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const first = { parameters: [] }; const second = { parameters: [] };
  first.body = { parent: first }; second.body = { parent: second };
  const firstInput = { parent: first }; const secondInput = { parent: second };
  first.parameters.push(firstInput); second.parameters.push(secondInput);
  const firstCall = { region: first.body }; const secondCall = { region: second.body };
  const source = { ast: { parent: node => node.parent, body: node => node.body,
    parameters: node => node.parameters, is: { IsClassDeclaration: () => false, IsClassExpression: () => false } } };
  let calls = 0; let inspect = () => {}; let context = "caller";
  const recursion = createSourceStorageScopedRecursion(source, budget, {
    subject, invocations: new Set([firstCall, secondCall]), accessorTargets: new Map(),
    regions: { enclosing: node => node.region }, invocationImplementations: node => {
      calls += 1; inspect(node);
      return new Set([node === firstCall ? second : first]);
    },
  }, (_formal, _candidate, invocation) => ({ context,
    subjects: new Set([subject(invocation === firstCall ? firstInput : secondInput, "input")]) }));
  return { budget, subject, recursion, first, second, firstInput, secondInput, firstCall, secondCall,
    calls: () => calls, inspect: callback => { inspect = callback; }, context: value => { context = value; } };
}

test("recursive call graph publishes one exact complete SCC only after every original edge is checked", () => {
  const current = fixture();
  const selected = current.recursion.componentFor(current.first);
  assert.equal(selected?.size === 2 && selected.has(current.first) && selected.has(current.second), true);
  assert.equal(current.recursion.componentFor(current.second) === selected, true, "one component identity is shared");
  assert.equal(current.recursion.edgesFor(current.first)[0].invocation === current.firstCall &&
    current.recursion.edgesFor(current.first)[0].candidate === current.second, true, "exact checked edge identities survive");
  assert.equal(current.calls() === 2 && current.budget.failure() === undefined, true, "a complete immutable index is reused");
});

test("a throwing recursive index releases unpublished rows and retries the entire graph instead of a partial component", () => {
  const current = fixture();
  const failure = new Error("original checked call failure");
  current.inspect(node => { if (node === current.secondCall) throw failure; });
  assert.throws(() => current.recursion.componentFor(current.first), error => error === failure);
  current.inspect(() => {});
  const selected = current.recursion.componentFor(current.first);
  assert.equal(selected?.has(current.first) && selected.has(current.second) && current.calls() === 4, true);
  assert.equal(current.budget.failure() === undefined, true, "an exception neither publishes partial proof nor corrupts the resource owner");
});

test("exceptional recursive graph unwind preserves independently owned rows and no unpublished graph history", () => {
  const current = fixture();
  const independent = current.budget.createRows();
  assert.equal(independent.add(3), true);
  const failure = new Error("original checked call failure");
  current.inspect(node => { if (node === current.secondCall) throw failure; });
  assert.throws(() => current.recursion.componentFor(current.first), error => error === failure);
  let remaining = 0;
  while (current.budget.row()) remaining += 1;
  assert.equal(remaining === 125, true, "only the three unrelated live rows survive the failed initialization");
});

test("reentrant graph discovery cannot observe or certify an unfinished recursive index", () => {
  const current = fixture();
  current.inspect(() => assert.equal(current.recursion.componentFor(current.first) === undefined, true));
  assert.equal(current.recursion.componentFor(current.first) === undefined, true);
  assert.match(current.budget.failure(), /unfinished call graph/u);
  assert.equal(current.recursion.componentFor(current.second) === undefined, true, "failure remains sticky");
});

test("invariant recursive ports preserve exact entry and projection identity but never infer a callee capture", () => {
  const current = fixture();
  const component = current.recursion.componentFor(current.first);
  const equation = { identity: 0, component, entry: current.first };
  const formal = current.subject(current.secondInput, "input", [{ kind: "array-element" }]);
  assert.equal(formal !== undefined, true, "the fixture uses a supported exact array projection");
  const variable = { kind: "variable", equation, owner: current.second };
  const selected = current.recursion.entryInputFor(formal, variable);
  assert.equal(selected === current.subject(current.firstInput, "input", formal.projection), true,
    "every checked predecessor forwards the identical entry port and projection");
  assert.equal(current.recursion.entryInputFor(formal, { ...variable, capture: current.firstCall }) === undefined, true,
    "a selected callee's lexical capture is not a caller-entry invariant");
  assert.equal(current.budget.failure() === undefined, true);
});

test("callee-scoped defaults cannot masquerade as invariant forwarded caller ports", () => {
  const current = fixture();
  current.context("callee");
  const component = current.recursion.componentFor(current.first);
  const equation = { identity: 0, component, entry: current.first };
  assert.equal(current.recursion.entryInputFor(current.subject(current.secondInput, "input"),
    { kind: "variable", equation, owner: current.second }) === undefined, true);
  assert.equal(current.budget.failure() === undefined, true, "unsupported invariance is absence of proof, not weakened checking");
});
