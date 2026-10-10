import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageContextInputs } from "../../packages/target-api/dist/target-analysis/source-storage/context-inputs.js";
import { createSourceStorageContextPorts } from "../../packages/target-api/dist/target-analysis/source-storage/context-ports.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const inputs = new Map();
  const properties = new Map();
  const source = { ast: { is: { IsPropertyAccessExpression: () => false, IsElementAccessExpression: () => false,
    IsObjectLiteralExpression: node => properties.has(node), IsArrayLiteralExpression: () => false,
    IsClassDeclaration: () => false, IsClassExpression: () => false },
    body: () => undefined, properties: node => properties.get(node) }, navigation: {}, semantics: {} };
  const contexts = createSourceStorageContextInputs(source, budget, {
    subject, incomingFor: selected => inputs.get(selected) ?? new Set(), subjectFor: node => subject(node),
    sourceFileFor: () => undefined, isInvocation: () => false, implementationsFor: () => new Set(),
    invocationOrigins: () => new Set(), argumentsFor: () => [],
  });
  return { budget, subject, inputs, properties, contexts };
}

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
  const ports = createSourceStorageContextPorts(budget, transport.contextualInputs);
  const parameter = transport.visitedNodes.find(node => source.ast.is.IsParameterDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "token");
  const input = transport.subject(parameter, "input");
  for (const predicate of [source.ast.is.IsObjectLiteralExpression, source.ast.is.IsArrayLiteralExpression, source.ast.is.IsArrowFunction]) {
    const node = transport.visitedNodes.find(predicate);
    const footprint = ports.firstPorts(transport.subject(node));
    assert.equal(footprint !== undefined && footprint.size === 1 && footprint.has(input), true,
      "the same canonical context owner preserves the actual member/component/capture input");
  }
  assert.equal(budget.failure() === undefined, true);
});
