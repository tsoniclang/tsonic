import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Expression } from "../../packages/target-api/dist/public/source.js";
import { analyzeSourceNativeTaskGraph, createSourceStorageQuery, createSourceStorageBudget,
  defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  const nodes = storage.nodes;
  const declarations = new Map(nodes.filter(node => source.ast.is.IsFunctionDeclaration(node)).map(node =>
    [source.ast.text(source.ast.name(node)), node]));
  const ownerUses = new Map([...declarations.values()].map(node => [node, { capture: false, parameter: true, creations: [] }]));
  for (const node of nodes) if (source.ast.is.IsGetAccessorDeclaration(node) || source.ast.is.IsSetAccessorDeclaration(node) ||
      source.ast.is.IsClassDeclaration(node) || source.ast.is.IsClassExpression(node) || source.ast.is.IsConstructorDeclaration(node))
    ownerUses.set(node, { capture: false, parameter: true, creations: [] });
  const callInputs = new Map(nodes.filter(node => source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)).map(node => [node, "parameter"]));
  for (const node of storage.accessorInvocations) callInputs.set(node, "parameter");
  const spawns = nodes.filter(node => source.ast.is.IsVoidExpression(node)).map(node => ({ node, operand: Node_Expression(source.ast, node) }));
  const select = (changes = {}) => analyzeSourceNativeTaskGraph({ source, storage, nodes, ownerUses, callInputs,
    spawns, lifecycleOwner: file, publishedDeclarations: new Set(), budget: createSourceStorageBudget(defaultSourceStorageLimits), ...changes });
  return { source, storage, file, nodes, declarations, ownerUses, callInputs, select };
}

test("native task demand propagates from a source spawn through its original callers", () => {
  const current = fixture(`async function child(): Promise<void> {}
    function inner(): void { void child(); }
    function outer(): void { inner(); } outer();`);
  const selected = current.select();
  assert.equal(selected.kind === "resolved", true, "checked task graph is complete");
  assert.equal(selected.graph.spawns.length, 1, "one original discarded native task");
  assert.equal(selected.graph.owners.includes(current.declarations.get("inner")), true, "spawn owner needs scope");
  assert.equal(selected.graph.owners.includes(current.declarations.get("outer")), true, "native caller forwards scope");
  assert.equal(selected.graph.calls.length, 2, "only calls of demanded helpers forward scope");
  assert.equal(selected.graph.entries.length === 1 && selected.graph.entries[0] === current.file, true, "one checked root lifecycle");
});

test("one named callable can have a captured value and a native helper parameter", () => {
  const current = fixture(`async function child(): Promise<void> {}
    function work(): void { void child(); }
    const callback = work; work(); callback();`);
  const work = current.declarations.get("work");
  const references = current.source.navigation.declarationUses(work);
  const creation = references.find(use => use.role === "storage").reference;
  current.ownerUses.set(work, { capture: true, parameter: true, creations: [creation] });
  for (const node of current.callInputs.keys()) {
    if (current.source.ast.text(Node_Expression(current.source.ast, node)) === "callback") current.callInputs.set(node, "capture");
  }
  const selected = current.select();
  assert.equal(selected.kind === "resolved", true, "capture and helper facets are independent");
  assert.equal(selected.graph.capturedOwners.has(work), true, "the value creation retains its scope");
  assert.equal(selected.graph.parameterOwners.has(work), true, "the direct helper receives scope");
  assert.equal(selected.graph.calls.length, 1, "the value invocation does not receive a second caller scope");
  assert.equal(current.source.ast.text(Node_Expression(current.source.ast, selected.graph.calls[0].node)), "work",
    "the actual direct helper is the sole implicit call input");
});

test("an unknown demanded scope calling form is refused rather than assumed native", () => {
  const current = fixture(`async function child(): Promise<void> {}
    function work(): void { void child(); } work();`);
  const selected = current.select({ callInputs: new Map() });
  assert.equal(selected.kind, "unresolved", "native or capture call ownership must be selected before propagation");
  assert.equal(selected.issues.some(issue => issue.kind === "call-graph"), true, "the original invocation identifies the missing contract");
});

test("a public callable cannot silently gain a compiler-owned source ABI input", () => {
  const current = fixture(`async function child(): Promise<void> {}
    function work(): void { void child(); } work();`);
  const selected = current.select({ publishedDeclarations: new Set([current.declarations.get("work")]) });
  assert.equal(selected.kind, "unresolved", "the public ABI constraint is an explicit source refusal");
  assert.equal(selected.issues.some(issue => issue.kind === "public-scope"), true, "the demanded public declaration is named");
});

test("a task demand without a lifecycle is not admitted from an arbitrary module", () => {
  const current = fixture(`async function child(): Promise<void> {} void child();`);
  const selected = current.select({ lifecycleOwner: undefined });
  assert.equal(selected.kind, "unresolved", "no hidden executor is manufactured");
  assert.equal(selected.issues.some(issue => issue.kind === "lifecycle-owner"), true, "missing lifecycle is the precise cause");
});

test("a scope capture without original creation occurrences is not an ownership proof", () => {
  const current = fixture(`async function child(): Promise<void> {}
    function work(): void { void child(); } work();`);
  current.ownerUses.set(current.declarations.get("work"), { capture: true, parameter: true, creations: [] });
  const selected = current.select();
  assert.equal(selected.kind, "unresolved", "a callable declaration is not a value creation");
  assert.equal(selected.issues.some(issue => issue.kind === "scope-owner"), true, "the missing occurrence stays visible");
});

test("a root without native tasks has no task scope graph or call inputs", () => {
  const current = fixture(`function work(): number { return 1; } work();`);
  const selected = current.select({ lifecycleOwner: undefined });
  assert.equal(selected.kind === "resolved", true, "no-task compilation does not require an executor");
  assert.equal(selected.graph.lifecycleOwner, undefined, "no lifecycle scope is introduced");
  assert.equal(selected.graph.spawns.length + selected.graph.owners.length + selected.graph.calls.length + selected.graph.entries.length,
    0, "no task-related graph or ABI machinery");
});

test("an implicit getter invocation propagates its native task scope to the original caller", () => {
  const current = fixture(`async function child(): Promise<void> {}
    class Box { get value(): number { void child(); return 1; } }
    const box = new Box(); const result = box.value;`);
  const getter = current.nodes.find(node => current.source.ast.is.IsGetAccessorDeclaration(node));
  const selected = current.select();
  assert.equal(selected.kind === "resolved", true, "the existing checked accessor transport supplies the invocation");
  assert.equal(selected.graph.parameterOwners.has(getter), true, "the getter's real native helper is demanded");
  assert.equal(selected.graph.calls.some(call => call.targets.includes(getter)), true, "property access is an actual implicit call edge");
  assert.equal(selected.graph.entries.includes(current.file), true, "the source initializer owns the scope");
});

test("an implicit setter invocation propagates its native task scope without a fabricated value call", () => {
  const current = fixture(`async function child(): Promise<void> {}
    class Box { set value(input: number) { void child(); } }
    const box = new Box(); box.value = 1;`);
  const setter = current.nodes.find(node => current.source.ast.is.IsSetAccessorDeclaration(node));
  const selected = current.select();
  assert.equal(selected.kind === "resolved", true, "the selected write accessor is transported by the same checked graph");
  assert.equal(selected.graph.parameterOwners.has(setter), true, "the setter participates in the native ABI demand");
  assert.equal(selected.graph.calls.some(call => call.targets.includes(setter)), true, "the original assignment is the invoking occurrence");
  assert.equal(selected.graph.entries.includes(current.file), true, "the assignment's caller owns the scope");
});
