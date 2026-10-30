import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { analyzeSourceConstructorResults, createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import * as construction from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { sourceStorageClassLineages } from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { fixture, constructorResultFixture } from './source-storage-construction-fixtures.mjs';
import { namedDeclaration, namedVariable } from "../fixtures/source-navigation.mjs";

for (const [name, text] of [
  ["fresh object", "class Owner { value = 1; constructor() { return { value: 2 }; } } const owner = new Owner();"],
  ["conditional substitute", "class Owner { value = 1; constructor(flag: boolean) { return flag ? this : { value: 2 }; } } const owner = new Owner(true);"],
  ["reassigned alias", "class Owner { value = 1; constructor() { let self: Owner = this; self = { value: 2 }; return self; } } const owner = new Owner();"],
  ["cached instance", "const cached = { value: 2 }; class Owner { value = 1; constructor() { return cached; } } const owner = new Owner();"],
  ["substitute or checked never", "function fail(): never { throw 'stop'; } class Owner { value = 1; constructor(flag: boolean) { return flag ? { value: 2 } : fail(); } } const owner = new Owner(true);"],
  ["substitute asserted as never", "class Owner { value = 1; constructor() { return ({ value: 2 } as never); } } const owner = new Owner();"],
  ["aliased substitute asserted as never", "class Owner { value = 1; constructor() { const replacement = { value: 2 } as never; return replacement; } } const owner = new Owner();"],
]){
test(`constructor result admission rejects ${name} at its actual source expression`, () => {
    const current = constructorResultFixture(text);
    const issues = analyzeSourceConstructorResults(current.source);
    const returned = current.nodes.find(node => current.source.ast.is.IsReturnStatement(node));
    assert.equal(issues.length, 1, `${name}: exactly one shared source rejection.`);
    assert.equal(issues[0].code, "TSONIC_CONSTRUCTOR_RESULT_NOT_SUPPORTED", `${name}: this is a deliberate v1 exclusion, not a native impossibility.`);
    assert.equal(issues[0].message, "A constructor that returns an object other than its receiver is not supported.");
    assert.equal(issues[0].sourceNode === current.source.ast.as.AsReturnStatement(returned).Expression, true,
      `${name}: the original returned expression owns the diagnostic.`);
    assert.equal(issues[0].category, "error");
    assert.equal(issues[0].source, "tsonic", "Both targets consume the identical shared diagnostic.");
    assert.equal(Object.isFrozen(issues) && Object.isFrozen(issues[0]), true,
      `${name}: the local source rejection is immutable, not a storage-resource failure.`);
  });
}

test("constructor result admission preserves local opaque-return reasons", () => {
  const current = constructorResultFixture("declare function unknown(owner: Owner): Owner; class Owner { value = 1; constructor() { return unknown(this); } }");
  const issues = analyzeSourceConstructorResults(current.source);
  assert.equal(issues.length, 1, "An opaque result cannot prove the current receiver.");
  assert.equal(issues[0].code, "TSONIC_CONSTRUCTOR_RESULT_NOT_PROVEN", "Unresolved identity is not mislabelled as a proven substitute.");
  assert.equal(issues[0].message.startsWith("Constructor result receiver identity is not proven: "), true);
  const asserted = constructorResultFixture("declare function unknown(owner: Owner): Owner; class Owner { value = 1; constructor() { return unknown(this) as never; } }");
  const assertedIssues = analyzeSourceConstructorResults(asserted.source);
  assert.equal(assertedIssues.length, 1, "An outer never assertion does not close an actual opaque producer.");
  assert.equal(assertedIssues[0].code, "TSONIC_CONSTRUCTOR_RESULT_NOT_PROVEN", "Actual source-domain uncertainty survives the assertion.");
});

test("constructor result admission is independent of unrelated storage-resource failure", () => {
  const current = constructorResultFixture("class Owner { constructor() { return this; } }");
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const storage = createSourceStorageQuery(current.source, current.source.sourceFiles, { ...defaultSourceStorageLimits, ...limits });
    const reason = storage.failureReason();
    assert.equal(reason !== undefined, true, "The original storage owner records the actual resource refusal.");
    const issues = analyzeSourceConstructorResults(current.source);
    assert.equal(issues.length, 0, "An unrelated storage-resource refusal cannot reject this constructor.");
  }
  assert.equal(analyzeSourceConstructorResults.length, 1, "Only the source program belongs to the canonical admission API.");
});

for (const [name, expression, declaration] of [
  ["explicit undefined", "undefined", ""],
  ["effectful void", "log()", "let calls = 0; function log(): void { calls++; }"],
]){
test(`constructor result admission checked absence boundary: ${name}`, context => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
      ${declaration}
      class Owner { value = 1; constructor() { return ${expression}; } }
      const owner = new Owner();
    ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    const diagnostics = formatDiagnostics(checked.diagnostics, "/src");
    context.diagnostic(JSON.stringify({ control: name, diagnostics }));
    assert.deepEqual(checked.diagnostics.map(diagnostic => diagnostic.code), [2322, 2409],
      `${name}: strict source checking rejects the non-instance constructor return before native admission.`);
    assert.equal(diagnostics.includes(`Type '${name === "explicit undefined" ? "undefined" : "void"}' is not assignable to type 'Owner'.`), true,
      `${name}: preserve the actual checked value-type incompatibility.`);
    assert.equal(diagnostics.includes("Return type of constructor signature must be assignable to the instance type of the class."), true,
      `${name}: this is a source-checker refusal, not a manufactured substitute-object diagnosis.`);
  });
}

test("constructor receiver admission preserves an actual effect before return this", () => {
  const current = constructorResultFixture(`
    let calls = 0; function log(): void { calls++; }
    class Owner { value = 1; constructor() { log(); return this; } }
    const owner = new Owner();
  `);
  const { source, nodes } = current;
  const invocation = nodes.find(node => source.ast.is.IsCallExpression(node) &&
    source.ast.text(source.ast.as.AsCallExpression(node).Expression) === "log");
  assert.equal(invocation !== undefined, true, "The original checked effect precedes the receiver return.");
  const before = source.semantics.forNode(invocation).operations.call(invocation);
  assert.equal(before !== undefined, true, "The actual invocation has its exact selected call contract.");
  assert.equal(analyzeSourceConstructorResults(source).length, 0,
    "A valid effectful constructor that returns its actual receiver stays admitted.");
  const after = source.semantics.forNode(invocation).operations.call(invocation);
  assert.equal(after !== undefined && after.selectedSignature === before.selectedSignature && nodes.includes(invocation), true,
    "Admission does not remove or replace the original effect and its native lowering evidence.");
});

test("construction storage rejects foreign, missing, formal, non-construction and budget-exhausted identities", () => {
  const current = fixture();
  const foreign = fixture();
  assert.equal(current.storage.constructionFor(foreign.invocation("copied")).kind, "unresolved", "Foreign checked identity.");
  assert.equal(current.storage.constructionFor(current.invocation("missing")).kind, "unresolved", "No actual initializer is invented.");
  const dynamic = current.storage.invocations.find(node => current.source.ast.is.IsNewExpression(node) &&
    current.source.ast.text(current.source.ast.as.AsNewExpression(node).Expression) === "Factory");
  assert.equal(current.storage.constructionFor(dynamic).kind, "unresolved", "A formal constructor's result type is not its actual class identity.");
  const nonConstruction = current.storage.nodes.find(node => current.source.ast.is.IsClassDeclaration(node));
  assert.equal(current.storage.constructionFor(nonConstruction).kind, "unresolved", "A non-invocation cannot supply construction evidence.");
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const bounded = fixture({ ...defaultSourceStorageLimits, ...limits });
    assert.equal(bounded.storage.failureReason() !== undefined, true, "The original finite guard owns the failure.");
    assert.equal(bounded.storage.constructionFor(current.invocation("copied")).kind, "unresolved", "No partial class inventory escapes.");
  }
});

test("public mutable constructor aliases remain opaque while immutable publication keeps exact identity", () => {
  const current = fixture();
  assert.equal(current.storage.constructionFor(current.invocation("changing")).kind, "unresolved",
    "External assignments remain possible without a recorded project write.");
  const published = current.storage.constructionFor(current.invocation("published"));
  assert.equal(published.kind === "resolved" && published.alternatives.length === 1, true,
    "Publishing an immutable binding does not make its actual class identity mutable.");
});

test("the canonical class lineage refuses cyclic, foreign and missing actual heritage inputs", () => {
  const current = fixture();
  const child = current.storage.nodes.find(node => current.source.ast.is.IsClassDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "Child");
  const selected = current.storage.subjectFor(child);
  assert.equal(selected.kind, "resolved", "The negative starts with a real checked source class.");
  const value = { subject: selected.subject, bindings: current.storage.emptyBindings };
  const values = new Set([value]);
  const subjectFor = node => {
    const selected = current.storage.subjectFor(node);
    return selected.kind === "resolved" ? selected.subject : undefined;
  };
  const cyclic = sourceStorageClassLineages(current.source, createSourceStorageBudget(defaultSourceStorageLimits), values,
    { subjectFor, nativeConstructorsFor: () => undefined, valuesFor: () => values });
  assert.equal(cyclic !== undefined && cyclic.length === 1 && cyclic[0].complete === false, true,
    "A repeated exact class/scope pair is unresolved, not a complete empty initializer inventory.");
  const missing = sourceStorageClassLineages(current.source, createSourceStorageBudget(defaultSourceStorageLimits), values,
    { subjectFor, nativeConstructorsFor: () => undefined, valuesFor: () => undefined });
  assert.equal(missing === undefined, true, "Missing required heritage evidence cannot be treated as no base.");
  const foreign = fixture();
  const foreignClass = foreign.storage.nodes.find(node => foreign.source.ast.is.IsClassDeclaration(node));
  const foreignSubject = foreign.storage.subjectFor(foreignClass);
  assert.equal(foreignSubject.kind, "resolved");
  const rejected = sourceStorageClassLineages(current.source, createSourceStorageBudget(defaultSourceStorageLimits),
    new Set([{ subject: foreignSubject.subject, bindings: foreign.storage.emptyBindings }]), { subjectFor, nativeConstructorsFor: () => undefined, valuesFor: () => values });
  assert.equal(rejected !== undefined && rejected.length === 1 && rejected[0].complete === false, true,
    "A foreign class value never supplies a native or source-construction guarantee.");
});

for (const reverse of [false, true]){
test(`contextual constructor closure preserves native, unknown, open and mixed alternatives, reverse=${reverse}`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
      interface Holder { readonly value: number; }
      type Factory = new (value: number) => Holder;
      class Ready { constructor(readonly value: number) {} }
      declare class Native { readonly value: number; constructor(value: number); }
      declare const Missing: Factory;
      export let Changing: Factory = Ready;
      function derived(Parent: Factory) { return class Derived extends Parent { extra = 1; }; }
      function root(Unknown: Factory, flag: boolean) {
        const Source = derived(Ready); const NativeOnly = derived(Native);
        const Mixed = derived(flag ? Ready : Native); const Open = derived(Changing);
        const Absent = derived(Missing); const Formal = derived(Unknown);
        const source = new Source(1); const native = new NativeOnly(1);
        const mixed = new Mixed(1); const open = new Open(1);
        const absent = new Absent(1); const formal = new Formal(1);
        return [source, native, mixed, open, absent, formal];
      }
    ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, "The negative controls are real checked construction programs.");
    const source = createTargetSourceProgram(checked);
    const storage = createSourceStorageQuery(source, source.sourceFiles);
    const invocations = ["Source", "NativeOnly", "Mixed", "Open", "Absent", "Formal"];
    for (const name of reverse ? [...invocations].reverse() : invocations) {
      const invocation = storage.invocations.find(node => source.ast.is.IsNewExpression(node) &&
        source.ast.text(source.ast.as.AsNewExpression(node).Expression) === name);
      assert.equal(invocation !== undefined, true, `${name}: the original checked construction exists.`);
      const caller = storage.bindingsForLexicalOwner(invocation);
      assert.equal(caller.kind, "resolved", `${name}: its actual caller declaration context is explicit.`);
      if (caller.kind !== "resolved") return;
      const selected = storage.constructionFor(invocation, caller.bindings);
      assert.equal(selected.kind, name === "Source" ? "resolved" : "unresolved",
        `${name}: only the wholly source-owned, closed actual alternative permits contextual closure.`);
    }
    assert.equal(storage.failureReason() === undefined, true, "Unknown alternatives do not poison a later actual source query.");
  });
}
