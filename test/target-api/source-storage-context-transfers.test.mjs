import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageContextApplications } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/context-applications.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function fixture(limits = {}, callee = false) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 65_536, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const graph = createSourceStorageGraphQueries(budget);
  graph.seal();
  const count = 64;
  const parameters = Array.from({ length: count }, () => ({}));
  const candidate = {};
  const semantics = {
    operations: {
      generator: declaration => {
        assert.equal(declaration === candidate, true, "the fixture's exact synchronous callable");
        return undefined;
      },
    },
  };
  const ports = parameters.map(node => subject(node, "input"));
  const nodes = Array.from({ length: count }, () => subject({}));
  const result = subject(candidate, "return");
  const calls = [subject({}), subject({})];
  const inputs = new Map([[result, new Set([nodes[0]])], ...nodes.map((node, index) =>
    [node, new Set([ports[index], nodes[(index + 1) % count]])])]);
  const actuals = calls.map(() => ports.map(() => subject({}, "input")));
  const wrappers = calls.map((_, callIndex) => ports.map((port, index) => {
    const wrapped = subject({});
    inputs.set(wrapped, new Set([actuals[callIndex][index]]));
    return wrapped;
  }));
  let instantiations = 0;
  const selections = createSourceStorageContextApplications({ ast: {
    hasModifierKind: () => false,
    is: { IsClassDeclaration: () => false, IsClassExpression: () => false, IsNewExpression: () => false },
    parameters: node => node === candidate ? parameters : [],
  }, semantics: { forNode: () => semantics } }, budget, {
    subject,
    invocationInputs: (port, owner, invocation) => {
      assert.equal(owner === candidate, true, "exact selected candidate");
      const index = ports.indexOf(port);
      const callIndex = calls.findIndex(call => call.node === invocation);
      assert.equal(index >= 0 && callIndex >= 0, true, "exact checked input and invocation");
      instantiations += 1;
      return { subjects: new Set([(callee ? wrappers : actuals)[callIndex][index]]), context: callee ? "callee" : "caller" };
    },
    inputsFor: input => inputs.get(input) ?? new Set(),
    incomingFor: () => new Set(),
    argumentsFor: () => [],
    subjectFor: node => subject(node),
    implementationsFor: node => calls.some(call => call.node === node) ? new Set([candidate]) : new Set(),
    isInvocation: node => calls.some(call => call.node === node),
    locationFor: () => undefined,
    ownerFor: () => undefined,
  }, graph);
  return { budget, calls, actuals, select: index => selections(calls[index]), count, instantiations: () => instantiations };
}

for (const callee of [false, true]) for (const reverse of [false, true]) {
  test(`context application maps each recursive result once with exact ${callee ? "callee" : "caller"} scope (${reverse})`, () => {
    const current = fixture({}, callee);
    for (const index of reverse ? [1, 0] : [0, 1]) {
      const selected = current.select(index);
      assert.equal(selected !== undefined && selected.ports.size === current.count && selected.locations.size === 0, true,
        current.budget.failure() ?? "exact completed caller footprint");
      assert.equal(current.actuals[index].every(value => selected.ports.has(value)), true);
      assert.equal(current.actuals[1 - index].some(value => selected.ports.has(value)), false);
      assert.equal(current.select(index) === selected, true, "one completed selection identity");
    }
    assert.equal(current.instantiations(), current.count * 2, "no replay of an already mapped prefix");
    assert.equal(current.budget.failure() === undefined, true);
  });
}

for (const limits of [{ maximumSteps: 64 }, { maximumTransportRows: 32 }]) {
  test(`context result transfers retain independent finite rejection ${JSON.stringify(limits)}`, () => {
    const current = fixture(limits);
    assert.equal(current.select(0) === undefined, true);
    assert.match(current.budget.failure(), limits.maximumSteps === undefined ? /transport-row/u : /analysis-work/u);
    assert.equal(current.select(0) === undefined && current.select(1) === undefined, true);
  });
}
