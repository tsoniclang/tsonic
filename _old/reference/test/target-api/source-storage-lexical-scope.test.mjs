import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageScopes } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-scopes.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { namedDeclaration, namedVariable } from "../fixtures/source-navigation.mjs";
import { createSourceStorageContextFootprints } from "../../packages/target-api/dist/target-analysis/source-storage/graph/context-footprints.js";
import { createSourceStorageContextInputs } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/context-inputs.js";
import { sourceStorageActivationOwner } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/activation-keys.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    export {};
    function outer(value: object) { function inner(next: object) { return value; } return inner; }
    function foreign(value: object) { return value; }
    const first = {}; const second = {};
    const selected = outer(first);
    const result = foreign(second);
    try { throw first; } catch (caught) { const alias = caught; }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 4096 });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const graph = createSourceStorageGraphQueries(budget);
  graph.seal();
  const outer = namedDeclaration(source.ast, file, "outer");
  const foreign = namedDeclaration(source.ast, file, "foreign");
  const inner = namedDeclaration(source.ast, file, "inner");
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const formal = subject(source.ast.parameters(outer)[0], "input");
  const invocationInputs = (origin, candidate) => ({
    subjects: new Set(origin.kind === "input" ? [subject(initializer(candidate === outer ? "first" : "second"))] : []),
    context: "caller",
    omitted: false,
  });
  const contextualInputs = createSourceStorageContextInputs(source, budget, { subject,
    subjectFor: node => subject(node, node !== undefined && source.ast.is.IsParameterDeclaration(node) ? "input" : "value"),
    sourceFileFor: origin => source.ast.getSourceFile(origin.node), incomingFor: () => new Set(), invocationInputs,
    isInvocation: () => false, implementationsFor: () => new Set(), argumentsFor: () => [],
    locationFor: () => undefined, ownerFor: () => undefined }, graph);
  const creation = { footprints: createSourceStorageContextFootprints(budget, contextualInputs, () => undefined),
    ownerFor: origin => sourceStorageActivationOwner(source, () => undefined, origin) };
  const scopes = createSourceStorageScopes(source, budget, subject, invocationInputs, graph, () => undefined, creation,
    () => assert.fail("The scalar lexical-scope fixture cannot request callable input slots."));
  const parent = scopes.frameFor(outer, initializer("selected"), scopes.empty, scopes.empty);
  const callee = scopes.frameFor(foreign, initializer("result"), parent, scopes.empty);
  const equation = { identity: 0, entry: foreign, component: new Set([foreign]), initial: callee };
  return { source, file, budget, subject, outer, foreign, inner, formal, initializer, scopes, parent, callee, equation };
}

test("a dynamic caller is not a callee's lexical binding or allocation owner", () => {
  const current = fixture();
  assert.equal(current.scopes.lookup(current.formal, current.callee) === undefined, true);
  assert.equal(current.scopes.owningScope(current.callee, current.outer) === undefined, true);
  assert.equal(current.callee.caller === current.parent, true, "actual caller remains explicit");
  assert.equal(current.scopes.activationKey(current.callee) !== current.scopes.activationKey(current.parent), true);
  assert.equal(current.budget.failure() === undefined, true);
});

test("an actual lexical capture retains its selected input rather than a dynamic caller input", () => {
  const current = fixture();
  const captured = current.scopes.frameFor(current.inner, current.initializer("result"), current.callee, current.parent);
  const result = current.scopes.lookup(current.formal, captured);
  assert.equal(result?.kind === "replace" && result.terms.length === 1 &&
    result.terms[0].subject === current.subject(current.initializer("first")), true);
  assert.equal(current.scopes.owningScope(captured, current.outer) === current.parent, true);
  assert.equal(current.budget.failure() === undefined, true);
});

test("recursive binding expansion requires the exact authored lexical owner", () => {
  const current = fixture();
  const unrelated = current.scopes.variable(current.equation, current.foreign);
  const related = current.scopes.variable(current.equation, current.inner);
  assert.equal(current.scopes.lookup(current.formal, unrelated) === undefined, true);
  assert.equal(current.scopes.lookup(current.formal, related)?.variable === related, true);
  assert.equal(current.budget.failure() === undefined, true);
});

test("a selected callee's captured environment cannot supply that callee's own formal input", () => {
  const current = fixture();
  const captured = current.scopes.variable(current.equation, current.outer, current.initializer("selected"));
  assert.equal(current.scopes.lookup(current.formal, captured) === undefined, true);
  const nested = current.scopes.variable(current.equation, current.inner, current.initializer("result"));
  assert.equal(current.scopes.lookup(current.formal, nested)?.variable === nested, true,
    "the enclosing function's actual formal remains an exact lexical capture");
  assert.equal(current.budget.failure() === undefined, true);
});

test("catch inputs do not acquire unrelated recursive invocation bindings", () => {
  const current = fixture();
  const caught = current.subject(namedVariable(current.source.ast, current.file, "caught"), "input");
  const recursive = current.scopes.variable(current.equation, current.foreign);
  assert.equal(current.scopes.lookup(caught, recursive) === undefined, true);
  assert.equal(current.budget.failure() === undefined, true);
});

test("caller-only variables remain exact substitution and activation dependencies", () => {
  const current = fixture();
  const caller = current.scopes.variable(current.equation, current.foreign);
  const callee = current.scopes.frameFor(current.inner, current.initializer("result"), caller, current.parent);
  assert.equal(current.scopes.variablesFor(callee)?.has(caller), true);
  assert.equal(current.scopes.family(callee) === current.equation, true);
  const selected = current.scopes.applyScope(callee, new Map([[caller, current.scopes.empty]]));
  assert.equal(selected !== undefined && selected !== callee, true);
  assert.equal(current.scopes.family(selected) === undefined, true);
  assert.equal(current.scopes.activationKey(selected) !== current.scopes.activationKey(callee), true);
  const captured = current.scopes.lookup(current.formal, selected);
  assert.equal(captured?.kind === "replace" && captured.terms.length === 1 &&
    captured.terms[0].subject === current.subject(current.initializer("first")), true);
  assert.equal(current.budget.failure() === undefined, true);
});
