import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import * as construction from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { sourceStorageClassLineages } from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function fixture(limits = defaultSourceStorageLimits) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    class Ready { ready = 1; }
    class Child extends Ready {}
    const Copy = Ready; const Parenthesized = (Copy); export const Published = Ready;
    export let Changing: typeof Ready = Ready;
    declare const Missing: typeof Ready;
    function dynamic(Factory: typeof Ready) { return new Factory(); }
    const copied = new Copy(); const parenthesized = new Parenthesized();
    const published = new Published(); const changing = new Changing(); const missing = new Missing();
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "The controls are actual checked source, not synthetic result-type identities.");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles, limits);
  const variable = name => storage.nodes.find(node => source.ast.is.IsVariableDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === name);
  const invocation = name => source.ast.as.AsVariableDeclaration(variable(name)).Initializer;
  return { source, storage, invocation };
}

test("construction storage follows exact immutable and parenthesized copies through its canonical finite domain", () => {
  const current = fixture();
  const original = current.storage.nodes.find(node => current.source.ast.is.IsClassDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "Ready");
  for (const name of ["copied", "parenthesized", "published"]) {
    const selected = current.storage.constructionFor(current.invocation(name));
    assert.equal(selected.kind === "resolved" && selected.alternatives.length === 1 &&
      selected.alternatives[0].root === original, true, name);
  }
  assert.equal("sourceStorageConstructedClass" in construction, false, "The superseded syntax alias selector is removed.");
  assert.equal("sourceStorageClassValue" in construction, false, "No competing singular class-value selector remains.");
  assert.equal("sourceStorageInvokedClass" in construction, false, "Every constructor consumer uses finite actual source values.");
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
    { subjectFor, valuesFor: () => values, nativeConstructorsFor: () => undefined });
  assert.equal(cyclic !== undefined && cyclic.length === 1 && cyclic[0].complete === false, true,
    "A repeated exact class/scope pair is unresolved, not a complete empty initializer inventory.");
  const missing = sourceStorageClassLineages(current.source, createSourceStorageBudget(defaultSourceStorageLimits), values,
    { subjectFor, valuesFor: () => undefined, nativeConstructorsFor: () => undefined });
  assert.equal(missing === undefined, true, "Missing required heritage evidence cannot be treated as no base.");
  const foreign = fixture();
  const foreignClass = foreign.storage.nodes.find(node => foreign.source.ast.is.IsClassDeclaration(node));
  const foreignSubject = foreign.storage.subjectFor(foreignClass);
  assert.equal(foreignSubject.kind, "resolved");
  const rejected = sourceStorageClassLineages(current.source, createSourceStorageBudget(defaultSourceStorageLimits),
    new Set([{ subject: foreignSubject.subject, bindings: foreign.storage.emptyBindings }]),
    { subjectFor, valuesFor: () => values, nativeConstructorsFor: () => undefined });
  assert.equal(rejected !== undefined && rejected.length === 1 && rejected[0].complete === false, true,
    "A foreign class value never supplies a native or source-construction guarantee.");
});

for (const reverse of [false, true]) {
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

for (const [name, declarations, result] of [
  ["anonymous", "", "{ value(): number }"],
  ["alias", "type Shape = { value(): number };", "Shape"],
  ["interface", "interface Shape { value(): number }", "Shape"],
  ["object-value", "const shape = { value(): number { return 0; } };", "typeof shape"],
]) {
  test(`constructed native methods retain exact ${name} structural correspondence`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
      ${declarations}
      class Counter { value(): number { return 1; } }
      export function make(): ${result} { return new Counter(); }
      export function read(): number { return make().value(); }
    ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, `${name}: the actual source contract is valid.`);
    const source = createTargetSourceProgram(checked);
    const storage = createSourceStorageQuery(source, source.sourceFiles);
    const implementation = storage.nodes.find(node => source.ast.is.IsMethodDeclaration(node) &&
      source.ast.is.IsClassDeclaration(source.ast.parent(node)));
    const call = storage.invocations.find(node => source.ast.is.IsCallExpression(node) &&
      source.ast.is.IsPropertyAccessExpression(source.ast.as.AsCallExpression(node).Expression));
    assert.equal(implementation !== undefined && call !== undefined, true, `${name}: original checked method and call.`);
    const callee = storage.subjectFor(source.ast.as.AsCallExpression(call).Expression);
    const caller = storage.bindingsForLexicalOwner(call);
    assert.equal(callee.kind === "resolved" && caller.kind === "resolved", true, `${name}: the exact operand and source activation.`);
    if (callee.kind !== "resolved" || caller.kind !== "resolved") return;
    const selected = storage.storageProducersFor(callee.subject, caller.bindings);
    assert.equal(selected.kind === "complete" && selected.producers.length === 1 &&
      selected.producers[0].subject.node === implementation, true,
    `${name}: the actual class method, not a structural signature or invented fallback.`);
    const activation = storage.bindingsForInvocation(implementation, call, caller.bindings, selected.producers[0]);
    assert.equal(activation.kind === "resolved", true, `${name}: the selected source method owns its exact execution activation.`);
    for (const bindings of [undefined, caller.bindings]) {
      const implementations = storage.invocationImplementationsFor(call, bindings);
      assert.equal(implementations.kind === "resolved" && implementations.exact && implementations.nodes.length === 1 &&
        implementations.nodes[0] === implementation, true,
      `${name}: ${bindings === undefined ? "whole-program" : "activation"} discovery consumes that same actual producer.`);
    }
    assert.equal(storage.failureReason() === undefined, true, `${name}: source storage remains complete.`);
  });
}

test("scoped callable implementations retain actual caller alternatives instead of merging equal signatures", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    function left(): number { return 1; }
    function right(): number { return 2; }
    function invoke(callback: () => number): number { return callback(); }
    const first = invoke(left); const second = invoke(right);
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "Both actual native callback activations are checked.");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const named = name => storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
  const variable = name => storage.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
  const callback = storage.invocations.find(node => source.ast.is.IsCallExpression(node) &&
    source.ast.text(source.ast.as.AsCallExpression(node).Expression) === "callback");
  const all = storage.invocationImplementationsFor(callback);
  assert.equal(all.kind === "resolved" && all.exact && all.nodes.length === 2 &&
    all.nodes.includes(named("left")) && all.nodes.includes(named("right")), true,
  "Whole-program discovery keeps every actual caller without an arbitrary first candidate.");
  for (const [variableName, implementationName] of [["first", "left"], ["second", "right"]]) {
    const outer = source.ast.as.AsVariableDeclaration(variable(variableName)).Initializer;
    const activation = storage.bindingsForInvocation(named("invoke"), outer);
    assert.equal(activation.kind === "resolved", true, `${variableName}: exact actual callback activation.`);
    if (activation.kind !== "resolved") return;
    const selected = storage.invocationImplementationsFor(callback, activation.bindings);
    assert.equal(selected.kind === "resolved" && selected.exact && selected.nodes.length === 1 &&
      selected.nodes[0] === named(implementationName), true, `${variableName}: only its own original implementation.`);
    const other = named(implementationName === "left" ? "right" : "left");
    const rejected = storage.bindingsForInvocation(other, callback, activation.bindings);
    assert.equal(rejected.kind === "unresolved" &&
      rejected.reason === "Invocation substitution has no exact completed implementation and capture activation.", true,
    `${variableName}: an absent actual candidate is not falsely reported as budget exhaustion.`);
  }
});

test("scoped callable implementations keep native, abstract, mutable and foreign domains open", () => {
  const current = () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
      function body(): number { return 1; }
      export let changing: () => number = body;
      declare function native(): number;
      function abstract(callback: () => number): number { return callback(); }
      const mutable = changing(); const external = native();
    ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, "The open callable contracts are checked native-valid source.");
    const source = createTargetSourceProgram(checked);
    return { source, storage: createSourceStorageQuery(source, source.sourceFiles) };
  };
  const { source, storage } = current();
  const calls = storage.invocations.filter(node => source.ast.is.IsCallExpression(node));
  for (const call of calls) {
    const bindings = storage.bindingsForLexicalOwner(call);
    assert.equal(bindings.kind === "resolved", true, "Every actual call has its checked lexical activation.");
    if (bindings.kind !== "resolved") return;
    for (const caller of [undefined, bindings.bindings]) {
      const selected = storage.invocationImplementationsFor(call, caller);
      assert.equal(selected.kind === "unresolved" || !selected.exact, true,
        `${source.ast.text(source.ast.as.AsCallExpression(call).Expression)}: ${caller === undefined ? "whole-program" : "activation"} open/native domain is not an exact source body.`);
    }
  }
  const foreign = current();
  assert.equal(storage.invocationImplementationsFor(foreign.storage.invocations[0], storage.emptyBindings).kind,
    "unresolved", "A foreign checked call cannot supply an implementation.");
  assert.equal(storage.invocationImplementationsFor(calls[0], foreign.storage.emptyBindings).kind,
    "unresolved", "Foreign binding views never become actual native/source contracts.");
});

test("optional calls retain an explicitly open source implementation domain", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    function body(): number { return 1; }
    function invoke(callback: (() => number) | undefined): number | undefined { return callback?.(); }
    const present = invoke(body); const absent = invoke(undefined);
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "Both present and absent optional source calls are checked.");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const invocation = storage.invocations.find(node => source.ast.is.IsCallExpression(node) &&
    source.ast.text(source.ast.as.AsCallExpression(node).Expression) === "callback");
  assert.equal(invocation !== undefined, true, "The original optional invocation is retained.");
  const lexical = storage.bindingsForLexicalOwner(invocation);
  assert.equal(lexical.kind, "resolved", "The optional call has its checked lexical source activation.");
  for (const bindings of [undefined, lexical.bindings]) {
    const selected = storage.invocationImplementationsFor(invocation, bindings);
    assert.equal(selected.kind === "unresolved" || !selected.exact, true,
      "An optional source call is not silently treated as a proven always-present body.");
  }
  assert.equal(storage.failureReason() === undefined, true, "The open optional domain is not budget exhaustion.");
});

test("formal interface calls distinguish whole-program producers from an unbound lexical activation", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    interface Value { read(): number; }
    class Left implements Value { read(): number { return 1; } }
    class Right implements Value { read(): number { return 2; } }
    function invoke(value: Value): number { return value.read(); }
    const left = invoke(new Left()); const right = invoke(new Right());
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "Both actual interface implementations are checked.");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const invocation = storage.invocations.find(node => source.ast.is.IsCallExpression(node) &&
    source.ast.is.IsPropertyAccessExpression(source.ast.as.AsCallExpression(node).Expression));
  const methods = storage.nodes.filter(node => source.ast.is.IsMethodDeclaration(node));
  assert.equal(invocation !== undefined && methods.length === 2, true, "Only the two actual method bodies are selected.");
  const global = storage.invocationImplementationsFor(invocation);
  assert.equal(global.kind === "resolved" && global.exact && global.nodes.length === 2 &&
    methods.every(method => global.nodes.includes(method)), true,
  "The whole-program query retains both actual native method producers.");
  const lexical = storage.bindingsForLexicalOwner(invocation);
  assert.equal(lexical.kind, "resolved", "The formal's declaration activation is explicit.");
  const abstract = storage.invocationImplementationsFor(invocation, lexical.bindings);
  assert.equal(abstract.kind === "resolved" && !abstract.exact && abstract.nodes.length === 0, true,
    "An unbound formal does not invent either nominal implementation as its actual receiver.");
  assert.equal(storage.failureReason() === undefined, true, "Open formal correspondence is not budget exhaustion.");
});

test("an ungrounded constructor-field cycle cannot disappear beside an owned result branch", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    interface Lease { readonly value: number; }
    class Cycle { readonly value: Lease; constructor() { this.value = new Cycle().value; } }
    class Mixed {
      readonly value: Lease;
      constructor(flag: boolean) { this.value = flag ? new Cycle().value : { value: 1 }; }
    }
    export function inspect(flag: boolean): Lease { const instance = new Mixed(flag); return instance.value; }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "The actual recursive field and owned sibling are checked source.");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const inspect = storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "inspect");
  const access = storage.nodes.find(node => source.ast.is.IsPropertyAccessExpression(node) &&
    storage.enclosingRegionFor(node) === source.ast.body(inspect));
  const subject = storage.subjectFor(access);
  const activation = storage.bindingsForLexicalOwner(access);
  assert.equal(subject.kind === "resolved" && activation.kind === "resolved", true,
    "The query uses the original field expression and actual checked activation.");
  const selected = storage.storageProducersFor(subject.subject, activation.bindings);
  assert.equal(selected.kind, "unresolved", "An ownerless live branch never becomes an absent contribution.");
  assert.equal(selected.reason, "A demanded source storage relation has no completed correlated producer or absence proof.");
  assert.equal(storage.failureReason() === undefined, true, "An ungrounded relation is not a budget failure.");
  const owned = storage.nodes.find(node => source.ast.is.IsObjectLiteralExpression(node));
  const ownedSubject = storage.subjectFor(owned);
  assert.equal(ownedSubject.kind, "resolved", "The independent owned sibling remains a checked value.");
  const independent = storage.storageProducersFor(ownedSubject.subject, activation.bindings);
  assert.equal(independent.kind === "complete" && independent.producers.length === 1 && independent.producers[0].subject.node === owned, true,
    "An unresolved source relation does not poison a separately proved owner query.");
});

test("an explicitly empty source collection keeps its proved empty origin relation", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    interface Lease { readonly value: number; }
    const values: Lease[] = [];
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "The empty native collection is valid checked source.");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const array = storage.nodes.find(node => source.ast.is.IsArrayLiteralExpression(node));
  const subject = storage.subject(array, "value", [{ kind: "array-element" }]);
  assert.equal(subject.kind, "resolved", "The exact checked array-element projection is admitted.");
  const selected = storage.boundOriginsFor(subject.subject, storage.emptyBindings);
  assert.equal(selected.kind === "resolved" && selected.subjects.length === 0, true,
    "Proved emptiness stays distinct from a provisional unproductive cycle.");
  assert.equal(storage.failureReason() === undefined, true, "Known emptiness consumes no missing-owner fallback.");
});

for (const reverse of [false, true]) {
  test(`constructor-owned writes and helper mutations retain distinct actual allocations, reverse=${reverse}`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
      interface Lease { readonly value: number; }
      class Box { value: Lease; constructor(value: Lease) { this.value = value; } }
      function allocate(value: Lease): Box { return new Box(value); }
      function replace(box: Box, value: Lease): void { box.value = value; }
      const initialLeft: Lease = { value: 1 }; const initialRight: Lease = { value: 2 };
      const replacement: Lease = { value: 3 };
      const left = allocate(initialLeft); const right = allocate(initialRight);
      replace(right, replacement);
      const leftRead = left.value; const rightRead = right.value;
    ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, "Both allocations and the helper's actual receiver are checked.");
    const source = createTargetSourceProgram(checked);
    const storage = createSourceStorageQuery(source, source.sourceFiles);
    const initializer = name => {
      const declaration = storage.nodes.find(node => source.ast.is.IsVariableDeclaration(node) &&
        source.ast.text(source.ast.name(node)) === name);
      return source.ast.as.AsVariableDeclaration(declaration).Initializer;
    };
    for (const name of reverse ? ["right", "left"] : ["left", "right"]) {
      const subject = storage.subjectFor(initializer(`${name}Read`));
      assert.equal(subject.kind, "resolved", `${name}: the exact instance field read.`);
      const selected = storage.boundOriginsFor(subject.subject, storage.emptyBindings);
      assert.equal(selected.kind, "resolved", `${name}: constructor and general mutations share one completed relation.`);
      const expected = name === "left" ? [initializer("initialLeft")] : [initializer("initialRight"), initializer("replacement")];
      assert.equal(selected.subjects.length === expected.length && expected.every(node => selected.subjects.some(subject => subject.node === node)), true,
        `${name}: only its own allocation's initial and helper-written values are retained.`);
    }
    assert.equal(storage.failureReason() === undefined, true, "No same-AST allocation, helper or query-order fallback is used.");
  });
}
