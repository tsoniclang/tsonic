import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceDeclarationOwnershipBudget, createSourceDeclarationOwnershipValues,
  createSourceDeclarationOwnershipQuery, createSourceDeclarationSuspensionQuery,
  defaultSourceDeclarationOwnershipLimits } from "../../packages/target-api/dist/public/analysis.js";

const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
  class AsyncResource { async [Symbol.asyncDispose](): Promise<void> {} }
  class SyncResource { [Symbol.dispose](): void {} }
  async function cleanup(resource: AsyncResource | SyncResource) { await using active = resource; }
  async function fallback(resource: SyncResource) { await using settled = resource; }
  function synchronous(resource: SyncResource) { using sync = resource; }
  async function authored(resources: AsyncIterable<number>) { for await (const value of resources) {} }
` }, compilerOptions: { strict: true, target: "esnext", module: "esnext" } }).checkSource();
assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics).slice(0, 2048));
const source = createTargetSourceProgram(checked);
const file = checked.getSourceFile("/src/index.ts");
assert.equal(file !== undefined, true, "original checked resource file");
const nodes = [];
const visit = node => { nodes.push(node); source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); }); };
visit(file);
const named = name => nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
const active = named("active");
const settled = named("settled");
const sync = named("sync");
assert.equal(active !== undefined && settled !== undefined && sync !== undefined, true, "original resource declarations");
const resourceFor = declaration => source.semantics.forNode(declaration).operations.resourceManagement(declaration);
const resource = resourceFor(active);
assert.equal(resource?.disposal.kind, "selected", "checked disposal alternatives");
const budget = createSourceDeclarationOwnershipBudget(file, defaultSourceDeclarationOwnershipLimits);
const context = createSourceDeclarationOwnershipValues({ source, sourceNodes: nodes, nodes, budget, limits: {} });
const effects = new Map([[active, "may-suspend"], [settled, "never"]]);
const native = {
  completionFor() { throw new Error("This declaration-only fixture requests no native call completion."); },
  suspensionFor(value, use) {
    const kind = effects.get(value.node);
    return use !== "resource-cleanup" || kind === undefined ? undefined
      : { kind, value, contract: { kind: "declaration", declaration: value.node, component: value.component } };
  },
  retentionFor({ value }) {
    return value.node !== active ? undefined : { kind: "resolved", premises: [{ kind: "retained", reason: "owned-value", value,
      contract: { kind: "declaration", declaration: active, component: value.component } }] };
  },
};
const query = (premises = native, selectedBudget = budget) => createSourceDeclarationSuspensionQuery({
  source, values: context.values, budget: selectedBudget, premises });

test("implicit cleanup suspension retains its checked declaration and disposal facts without an operand", () => {
  const reader = query();
  const selected = reader.forResourceCleanup(resource);
  assert.equal(selected.kind, "resolved");
  assert.equal(selected.pending.kind, "resource-cleanup");
  assert.equal(selected.pending.operation === active && selected.pending.resource === resource, true,
    "the original checked acquisition and selected disposal facts are retained");
  assert.equal(resource.acquisition.kind, "initializer");
  assert.equal(resource.disposal.alternatives.some(alternative => alternative.kind === "async") &&
    resource.disposal.alternatives.some(alternative => alternative.kind === "sync"), true, "async and synchronous fallback facts stay distinct");
  assert.equal(Object.hasOwn(selected.pending, "expression"), false, "cleanup has no fabricated await operand");
  assert.equal(selected.pending.contracts[0].value.node === active &&
    selected.pending.contracts[0].contract.declaration === active, true, "native evidence describes the real retained resource");
  assert.equal(reader.forResourceCleanup(resource) === selected && reader.owns(selected.pending), true, "one immutable cached witness");
  assert.equal(query().owns(selected.pending), false, "witnesses stay query-owned");
  assert.equal(Object.isFrozen(selected.pending) && Object.isFrozen(selected.pending.contracts) &&
    selected.pending.contracts.every(Object.isFrozen), true, "pending contracts are frozen");
});

test("cleanup never replaces strict authored-await or for-await validation", () => {
  const reader = query();
  const loop = nodes.find(node => source.ast.is.IsForOfStatement(node));
  assert.equal(loop !== undefined, true, "original authored for-await statement");
  for (const node of [active, loop]) {
    const selected = reader.forAwait(node);
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /original checked operation and operand/u);
  }
  assert.equal(reader.forResourceCleanup(resourceFor(sync)).kind, "unresolved", "synchronous using is not an implicit await");
  assert.equal(reader.forResourceCleanup({ ...resource }).kind, "unresolved", "copied disposal facts remain foreign");
  assert.equal(reader.forResourceCleanup({ ...resource, declaration: loop }).kind, "unresolved", "another source kind cannot impersonate cleanup");
});

test("cleanup requires a completed native effect for the identical checked resource value", () => {
  const missing = query({ suspensionFor: () => undefined }).forResourceCleanup(resource);
  assert.equal(missing.kind, "unresolved");
  assert.match(missing.reason, /missing declaration body or native completion record/u);
  const foreign = query({ suspensionFor(value, use) {
    return { ...native.suspensionFor(value, use), value: { ...value } };
  } }).forResourceCleanup(resource);
  assert.equal(foreign.kind, "unresolved", "copied local descriptors never authorize cleanup");
  const unrelated = query({ suspensionFor(value, use) {
    const selected = native.suspensionFor(value, use);
    return { ...selected, contract: { ...selected.contract, declaration: settled } };
  } }).forResourceCleanup(resource);
  assert.equal(unrelated.kind, "unresolved", "a different resource cannot supply this cleanup contract");
});

test("completed native synchronous cleanup fallback is not guessed to suspend", () => {
  const selected = query().forResourceCleanup(resourceFor(settled));
  assert.equal(selected.kind, "never", "the fixture supplies a real completed synchronous disposal effect");
  assert.equal(query({ suspensionFor: () => undefined }).forResourceCleanup(resourceFor(settled)).kind, "unresolved",
    "the same source type does not manufacture a native never premise");
});

test("continuation flow retains the actual resource through its implicit pending cleanup", () => {
  const owner = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "cleanup");
  assert.equal(owner !== undefined, true, "original cleanup declaration");
  const graph = context.graphFor(owner);
  assert.equal(graph.kind, "resolved");
  const points = graph.graph.points.filter(point => point.operation.kind === "await");
  assert.equal(points.length > 0 && points.every(point => point.source === active &&
    point.operation.awaitKind === "resource-cleanup" && point.operation.resource === resource), true, "every cleanup route keeps checked facts");
  const ownership = createSourceDeclarationOwnershipQuery({ source, sourceNodes: nodes, nodes, budget, premises: native });
  const summary = ownership.continuationForDeclaration(owner);
  assert.equal(summary.kind, "resolved", summary.kind === "unresolved" ? summary.reason : "completed resource continuation");
  assert.equal(summary.maySuspend, true);
  assert.equal(summary.reads.some(read => read.reference === active && [...read.pending].some(pending =>
    pending.kind === "resource-cleanup" && pending.resource === resource)), true, "the held resource is not mistaken for a completion result");
});

test("implicit cleanup suspension preserves the finite ownership budget", () => {
  const limited = createSourceDeclarationOwnershipBudget(file, { ...defaultSourceDeclarationOwnershipLimits, maximumSteps: 1 });
  const selected = query(native, limited).forResourceCleanup(resource);
  assert.equal(selected.kind, "unresolved");
  assert.equal(selected.cause.kind, "resource-limit");
});
