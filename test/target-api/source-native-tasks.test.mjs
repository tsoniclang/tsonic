import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Expression } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery,
  defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { analyzeSourceDeclarationNativeTaskGraph, createSourceDeclarationOwnershipValues,
  createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits } from "../../packages/target-api/dist/public/analysis.js";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  const nodes = source.navigation.nodesForFiles([file]);
  const declarations = new Map(nodes.filter(node => source.ast.is.IsFunctionDeclaration(node)).map(node =>
    [source.ast.text(source.ast.name(node)), node]));
  const ownerUses = new Map([...declarations.values()].map(node => [node, { capture: false, parameter: true }]));
  for (const node of nodes) if (source.ast.is.IsGetAccessorDeclaration(node) || source.ast.is.IsSetAccessorDeclaration(node) ||
      source.ast.is.IsClassDeclaration(node) || source.ast.is.IsClassExpression(node) || source.ast.is.IsConstructorDeclaration(node))
    ownerUses.set(node, { capture: false, parameter: true });
  const callInputs = new Map(nodes.filter(node => source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)).map(node => [node, "parameter"]));
  for (const node of storage.accessorInvocations) callInputs.set(node, "parameter");
  const spawns = nodes.filter(node => source.ast.is.IsVoidExpression(node)).map(node => ({ node, operand: Node_Expression(source.ast, node) }));
  const select = (changes = {}) => {
    const budget = createSourceDeclarationOwnershipBudget(file, defaultSourceDeclarationOwnershipLimits);
    const context = createSourceDeclarationOwnershipValues({ source, nodes, budget, limits: {} });
    return analyzeSourceDeclarationNativeTaskGraph({ source, nodes, values: context.values, spawns,
      lifecycleOwner: Object.hasOwn(changes, "lifecycleOwner") ? changes.lifecycleOwner : file,
      publishedDeclarations: changes.publishedDeclarations ?? new Set(), budget,
      scopeFor(declaration) {
        const use = (changes.ownerUses ?? ownerUses).get(declaration);
        if (changes.callInputs !== undefined && changes.callInputs.size === 0)
          return { kind: "unresolved", at: declaration, reason: "The selected native scope contract is missing.",
            cause: { kind: "required-fact" } };
        if (use === undefined) return { kind: "unresolved", at: declaration,
          reason: "The selected declaration has no completed native scope requirement.", cause: { kind: "required-fact" } };
        const semantics = source.semantics.forNode(declaration);
        const selectedType = semantics.types.declarationSignatureInfo(declaration)?.returnType ??
          semantics.declarations.declaredValueType(declaration);
        assert.equal(selectedType !== undefined, true, "the native scope fact has its exact checked declaration component");
        return { kind: use.capture ? "capture" : use.parameter ? "parameter" : "none",
          contract: { kind: "declaration", declaration, component: { selectedType } } };
      },
    });
  };
  return { source, storage, file, nodes, declarations, ownerUses, callInputs, select };
}

function declaredTasks(current, required, changes = {}) {
  const { source, file } = current;
  const nodes = source.navigation.nodesForFiles([file]);
  const budget = createSourceDeclarationOwnershipBudget(file, defaultSourceDeclarationOwnershipLimits);
  const context = createSourceDeclarationOwnershipValues({ source, nodes, budget, limits: {} });
  return analyzeSourceDeclarationNativeTaskGraph({ source, nodes, values: context.values, budget,
    lifecycleOwner: file, publishedDeclarations: new Set(),
    spawns: nodes.filter(node => source.ast.is.IsVoidExpression(node))
      .map(node => ({ node, operand: Node_Expression(source.ast, node) })),
    scopeFor(declaration) {
      const semantics = source.semantics.forNode(declaration);
      const selectedType = semantics.types.declarationSignatureInfo(declaration)?.returnType ??
        semantics.declarations.declaredValueType(declaration);
      assert.equal(selectedType !== undefined, true, "the declared native scope uses a real checked component");
      return { kind: required.has(declaration) ? "parameter" : "none",
        contract: { kind: "declaration", declaration, component: { selectedType } } };
    }, ...changes });
}

test("declaration-native task scope uses own-body and declared callee requirements, not invocation families", () => {
  const current = fixture(`async function child(): Promise<void> {}
    function inner(): void { void child(); }
    function outer(): void { inner(); } outer();`);
  const inner = current.declarations.get("inner");
  const outer = current.declarations.get("outer");
  const selected = declaredTasks(current, new Set([inner, outer]));
  assert.equal(selected.kind === "resolved", true, "the declared native scope graph completes");
  assert.equal(selected.graph.owners.length === 2 && selected.graph.owners.includes(inner) &&
    selected.graph.owners.includes(outer), true, "only the own-body scope and its declared caller need input");
  assert.equal(selected.graph.calls.length === 2 && selected.graph.spawns.length === 1, true, "actual source operations remain distinct");
  assert.equal(selected.graph.entries.length === 1 && selected.graph.entries[0] === current.file, true, "the original lifecycle owner is retained");
});

test("declaration-native getter and setter scopes retain their distinct selected operation slots", () => {
  const current = fixture(`async function child(): Promise<void> {}
    class Holder { get value(): number { void child(); return 1; } set value(input: number) { void child(); } }
    function work(holder: Holder): void { holder.value; holder.value = 2; } work(new Holder());`);
  const getter = current.nodes.find(node => current.source.ast.is.IsGetAccessorDeclaration(node));
  const setter = current.nodes.find(node => current.source.ast.is.IsSetAccessorDeclaration(node));
  assert.equal(getter !== undefined && setter !== undefined && getter !== setter, true, "distinct original accessors");
  const selected = declaredTasks(current, new Set([getter, setter, current.declarations.get("work")]));
  assert.equal(selected.kind === "resolved", true, "both declared native access roles complete");
  for (const declaration of [getter, setter]) {
    const calls = selected.graph.calls.filter(call => call.targets.includes(declaration));
    assert.equal(calls.length === 1 && current.source.ast.is.IsPropertyAccessExpression(calls[0].node), true,
      "each accessor is consumed by its actual property operation, never a fabricated call");
  }
});

test("declaration-native zero-task code has no scope state or speculative native contract lookup", () => {
  const current = fixture("function work(): number { return 1; } work();");
  const selected = declaredTasks(current, new Set(), { scopeFor: () => assert.fail("no task means no scope contract demand") });
  assert.equal(selected.kind === "resolved", true, "the no-task graph is complete");
  assert.equal(selected.graph.owners.length === 0 && selected.graph.calls.length === 0 &&
    selected.graph.spawns.length === 0 && selected.graph.lifecycleOwner === undefined, true, "no hidden native scope ABI or lifecycle state");
});

for (const scope of ["capture", "none"]) {
  test(`declaration-native task demand cannot invent a parameter from a ${scope} contract`, () => {
    const current = fixture("declare function child(): Promise<void>; function work(): void { void child(); } work();");
    const selected = declaredTasks(current, new Set(), { scopeFor(declaration) {
      const semantics = current.source.semantics.forNode(declaration);
      const selectedType = semantics.types.declarationSignatureInfo(declaration)?.returnType;
      assert.equal(selectedType !== undefined, true, "the real selected native declaration result");
      return { kind: scope, contract: { kind: "declaration", declaration, component: { selectedType } } };
    } });
    assert.equal(selected.kind === "unresolved" && selected.issues.some(issue => issue.kind === "scope-owner"), true,
      "missing declared scope ownership cannot become a hidden signature parameter");
    assert.equal("graph" in selected, false, "a rejected scope contract publishes no partial task graph");
  });
}

test("declaration-native task scope rejects an unrelated checked component", () => {
  const current = fixture("declare function child(): Promise<void>; function work(): void { void child(); } work(); const unrelated = true;");
  const literal = current.nodes.find(node => current.source.ast.kindName(node) === "KindTrueKeyword");
  assert.equal(literal !== undefined, true, "the wrong component has a real checked source");
  const selectedType = current.source.semantics.forNode(literal).types.expressionType(literal);
  assert.equal(selectedType !== undefined, true, "the wrong native scope component is checked but unrelated");
  const selected = declaredTasks(current, new Set(), { scopeFor: declaration => ({ kind: "parameter",
    contract: { kind: "declaration", declaration, component: { selectedType } } }) });
  assert.equal(selected.kind === "unresolved" && selected.cause?.kind === "required-fact", true,
    "matching declaration spelling cannot replace its actual checked return component");
  assert.equal("graph" in selected, false, "incompatible component evidence is not a partial success");
});

test("declaration-native task demand cannot add an executor slot to an exported container method", () => {
  const current = fixture("declare function child(): Promise<void>; export class Holder { work(): void { void child(); } } new Holder().work();");
  const container = current.nodes.find(node => current.source.ast.is.IsClassDeclaration(node));
  const method = current.nodes.find(node => current.source.ast.is.IsMethodDeclaration(node));
  assert.equal(container !== undefined && method !== undefined, true, "the actual public class and its declared method exist");
  const selected = declaredTasks(current, new Set([method]), { publishedDeclarations: new Set([container]) });
  assert.equal(selected.kind === "unresolved" && selected.issues.some(issue => issue.kind === "public-scope" && issue.node === method),
    true, "publication of the container preserves its method's source-native ABI");
  assert.equal("graph" in selected, false, "an exported signature mismatch publishes no partial native graph");
});

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

test("a demanded retained callable capture is refused even when a direct helper contract exists", () => {
  const current = fixture(`async function child(): Promise<void> {}
    function work(): void { void child(); }
    const callback = work; work(); callback();`);
  const work = current.declarations.get("work");
  current.ownerUses.set(work, { capture: true, parameter: true });
  for (const node of current.callInputs.keys()) {
    if (current.source.ast.text(Node_Expression(current.source.ast, node)) === "callback") current.callInputs.set(node, "capture");
  }
  const selected = current.select();
  assert.equal(selected.kind, "unresolved", "v1 has no hidden scope capture staging");
  assert.equal(selected.issues.length, 1, "the unsupported owner has one refusal");
  assert.equal(selected.issues[0].node === work, true, "the original retaining callable is the subject");
  assert.equal(selected.issues[0].kind, "scope-owner", "capture is rejected before target ABI publication");
  assert.equal(selected.issues[0].reason, "A demanded native task declaration requires its exact declared scope input, not a captured or invented parameter.",
    "a direct helper facet cannot mask an unsupported captured facet");
});

test("an unknown demanded scope calling form is refused rather than assumed native", () => {
  const current = fixture(`async function child(): Promise<void> {}
    function work(): void { void child(); } work();`);
  const selected = current.select({ callInputs: new Map() });
  assert.equal(selected.kind, "unresolved", "native or capture call ownership must be selected before propagation");
  assert.equal(selected.cause.kind === "required-fact" && selected.at === current.declarations.get("work"), true,
    "the original demanded declaration identifies the missing native scope contract");
  assert.equal("graph" in selected, false, "missing evidence cannot publish a partial native graph");
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

test("a capture-only demanded owner cannot manufacture an implicit helper parameter", () => {
  const current = fixture(`async function child(): Promise<void> {}
    function work(): void { void child(); } work();`);
  current.ownerUses.set(current.declarations.get("work"), { capture: true, parameter: false });
  const selected = current.select();
  assert.equal(selected.kind, "unresolved", "a captured activation is outside the direct native helper capability");
  assert.equal(selected.issues.some(issue => issue.kind === "scope-owner" && issue.reason.includes("captured or invented parameter")), true,
    "the unsupported capture remains the precise refusal");
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

for (const [label, sourceText] of [
  ["instance initializer", `async function child(): Promise<void> {} function start(): number { void child(); return 1; }
    class Box { value = start(); } function make(): Box { return new Box(); } const box = make();`],
  ["static initializer", `async function child(): Promise<void> {} function start(): number { void child(); return 1; }
    class Box { static value = start(); }`],
  ["static block", `async function child(): Promise<void> {} function start(): void { void child(); }
    class Box { static { start(); } }`],
  ["generator activation", `async function child(): Promise<void> {} function* work(): Generator<number, void, unknown> {
    void child(); yield 1; } const values = work(); values.next();`],
]) {
  test(`native task demand refuses an unsupported ${label} at its original source owner`, () => {
    const current = fixture(sourceText);
    const selected = current.select();
    assert.equal(selected.kind, "unresolved", "no constructor or captured scope machinery is synthesized");
    assert.equal(selected.issues.some(issue => issue.kind === "scope-owner" &&
      (issue.reason.includes("initializer") || issue.reason.includes("generator"))), true,
    "the checked unsupported execution owner supplies the precise refusal");
    assert.equal(selected.issues.every(issue => current.nodes.includes(issue.node)), true,
      "every diagnostic subject is an original checked source node");
  });
}
