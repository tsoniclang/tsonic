import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageContextInputs } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/context-inputs.js";
import { createSourceStorageContextFootprints } from "../../packages/target-api/dist/target-analysis/source-storage/graph/context-footprints.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject, () => []);
  const inputs = new Map();
  const properties = new Map();
  const accesses = new Map();
  const source = { ast: { is: { IsPropertyAccessExpression: node => accesses.has(node), IsElementAccessExpression: () => false,
    IsObjectLiteralExpression: node => properties.has(node), IsArrayLiteralExpression: () => false,
    IsClassDeclaration: () => false, IsClassExpression: () => false, IsBindingElement: () => false },
    body: () => undefined, properties: node => properties.get(node) }, navigation: {},
    semantics: { forNode: node => ({ operations: { propertyAccess: () => accesses.get(node) } }) } };
  const contexts = createSourceStorageContextInputs(source, budget, {
    subject, incomingFor: selected => inputs.get(selected) ?? new Set(), subjectFor: node => subject(node),
    sourceFileFor: () => undefined, isInvocation: () => false, implementationsFor: () => new Set(),
    invocationInputs: () => ({ subjects: new Set(), context: "caller" }), locationFor: () => undefined, argumentsFor: () => [],
    ownerFor: () => undefined,
  }, createSourceStorageGraphQueries(budget));
  return { budget, subject, inputs, properties, accesses, contexts };
}

test("unavailable checked member context is never cached as an empty or globally joined result", () => {
  const current = fixture({ maximumTransportRows: 8 });
  const access = current.subject({});
  const receiver = current.subject({});
  const foreign = current.subject({}, "input");
  current.inputs.set(access, new Set([foreign]));
  current.accesses.set(access.node, undefined);
  assert.equal(current.contexts(access) === undefined, true, "the member requires its exact checked receiver");
  current.accesses.set(access.node, { receiver: { expression: undefined } });
  assert.equal(current.contexts(access) === undefined, true, "a checked access without its owned receiver subject is unavailable");
  current.accesses.set(access.node, { receiver: { expression: receiver.node } });
  const selected = current.contexts(access);
  assert.equal(selected !== undefined && selected.size === 1 && selected.has(receiver), true,
    "only the completed checked receiver relation supplies this read's environment");
  assert.equal(selected.has(foreign), false, "a different writer's input is not an actual binding of the reader");
  assert.equal(current.contexts(access) === selected, true, "only a complete selection retains cached identity");
  const remaining = current.budget.createRows();
  assert.equal(remaining.add(6), true, "failed selection retained nothing; successful selection owns exactly two rows");
  remaining.release();
  assert.equal(current.budget.failure() === undefined, true);
});

test("context input caching charges every retained incoming relationship and returns one complete selection", () => {
  const current = fixture({ maximumTransportRows: 5 });
  const root = current.subject({}, "input");
  const inputs = new Set([current.subject({}), current.subject({}), current.subject({})]);
  current.inputs.set(root, inputs);
  const selected = current.contexts(root);
  assert.equal(selected !== undefined && selected.size === 3, true);
  for (const input of inputs) assert.equal(selected.has(input), true, "the exact original relationship survives");
  assert.equal(current.contexts(root) === selected, true, "only one complete cached row family exists");
  assert.equal(current.budget.row(), true, "the three inputs and one cache row leave exactly one row");
  assert.equal(current.budget.row(), false, "copying incoming relationships cannot evade retained accounting");
  assert.match(current.budget.failure(), /transport-row/u);
  assert.equal(current.contexts(root) === undefined, true, "a failed owner cannot return an earlier cached certificate");
});

test("context input reservation failure remains sticky and cannot expose a partially copied family", () => {
  const current = fixture({ maximumTransportRows: 4 });
  const root = current.subject({}, "input");
  current.inputs.set(root, new Set([current.subject({}), current.subject({}), current.subject({})]));
  assert.equal(current.budget.row(), true, "an independent live row prevents the complete cache reservation");
  assert.equal(current.contexts(root) === undefined, true);
  assert.match(current.budget.failure(), /transport-row/u);
  assert.equal(current.contexts(root) === undefined, true);
});

test("throwing contextual discovery releases only its unpublished rows and retains prior complete evidence", () => {
  const current = fixture({ maximumTransportRows: 8 });
  const retained = current.subject({}, "input");
  current.inputs.set(retained, new Set([current.subject({})]));
  const certificate = current.contexts(retained);
  const root = current.subject({});
  const failure = new Error("exact contextual traversal failure");
  current.properties.set(root.node, { [Symbol.iterator]() { throw failure; } });
  assert.throws(() => current.contexts(root), error => error === failure);
  assert.equal(current.contexts(retained) === certificate, true, "unwind cannot discard an independent completed row family");
  let remaining = 0;
  while (current.budget.row()) remaining += 1;
  assert.equal(remaining === 6, true, "only the prior cache row and its single input remain retained");
});

test("canonical context footprints include checked object members, array components and closure captures", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {};
      function make(token: object) {
        const values = [token];
        return { value: token, values, read: () => token };
      }
      const original = {}; const selected = make(original);
    ` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "the authored source checks without target annotations");
  const source = createTargetSourceProgram(checked);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget);
  const ports = createSourceStorageContextFootprints(budget, transport.contextualInputs, () => undefined, transport.contextualInputs.applicationFor);
  const parameter = transport.visitedNodes.find(node => source.ast.is.IsParameterDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "token");
  const input = transport.subject(parameter, "input");
  for (const predicate of [source.ast.is.IsObjectLiteralExpression, source.ast.is.IsArrayLiteralExpression, source.ast.is.IsArrowFunction]) {
    const node = transport.visitedNodes.find(predicate);
    const footprint = ports.select(transport.subject(node))?.ports;
    assert.equal(footprint !== undefined && footprint.size === 1 && footprint.has(input), true,
      "the same canonical context owner preserves the actual member/component/capture input");
  }
  assert.equal(budget.failure() === undefined, true);
});
