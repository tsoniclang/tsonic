import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { createSourceStorageQuery } from "../source-storage/queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../source-storage/model/resource-budget.js";
import type { SourceStorageBindings } from "../source-storage/model/types.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import { createSourceOwnershipQuery } from "./query.js";
import type { SourceOwnershipPremises } from "./model.js";

function fixture(reverse: boolean, recursive: "self" | "mutual") {
  const bodies = [
    `async function left(value: Lease, count: number): Promise<number> {
      if (count > 0) return await ${recursive === "self" ? "left" : "right"}(value, count - 1);
      await pending(); return read(value);
    }`,
    `async function right(value: Lease, count: number): Promise<number> {
      if (count > 0) return await left(value, count - 1);
      await pending(); return read(value);
    }`,
    `async function produced(value: Lease): Promise<number> { await pending(); return read(value); }`,
    `async function returned(pending: Promise<number>): Promise<number> { const alias = pending; return alias; }`,
    `async function awaited(pending: Promise<number>): Promise<number> { const alias = pending; return await alias; }`,
    `async function recursiveAdopt(pending: Promise<number>, count: number): Promise<number> {
      if (count > 0) return await recursiveAdopt(pending, count - 1);
      return pending;
    }`,
  ];
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    interface Lease { readonly value: number; }
    declare function pending(): Promise<void>;
    declare function read(value: Lease): number;
    declare function borrow(owner: { value: number }): Lease;
    ${(reverse ? [...bodies].reverse() : bodies).join("\n")}
    async function ownedRoot() {
      const value: Lease = { value: 3 }; const stored = left(value, 2); return stored;
    }
    async function borrowedRoot() {
      const owner = { value: 3 }; const value = borrow(owner); const stored = left(value, 2); return stored;
    }
    function allocate() { return { value: 3 }; }
    function allocations() { const first = allocate(); const second = allocate(); return [first, second]; }
    function capture<Value>(value: Value) { return () => value; }
    function captures() { const first = capture(1); const second = capture("second"); return [first, second]; }
    async function ownedAdoption() {
      const value: Lease = { value: 3 }; const promise = produced(value);
      const stored = returned(promise); return stored;
    }
    async function borrowedAdoption() {
      const owner = { value: 3 }; const value = borrow(owner); const promise = produced(value);
      const alias = promise; const stored = returned(alias); return stored;
    }
    async function ownedAwaitedAdoption() {
      const value: Lease = { value: 3 }; const holder = { promise: produced(value) };
      const stored = awaited(holder.promise); return stored;
    }
    async function borrowedAwaitedAdoption() {
      const owner = { value: 3 }; const value = borrow(owner); const holder = { promise: produced(value) };
      const stored = awaited(holder.promise); return stored;
    }
    async function ownedRecursiveAdoption() {
      const value: Lease = { value: 3 }; const promise = produced(value);
      const stored = recursiveAdopt(promise, 2); return stored;
    }
    async function borrowedRecursiveAdoption() {
      const owner = { value: 3 }; const value = borrow(owner); const promise = produced(value);
      const stored = recursiveAdopt(promise, 2); return stored;
    }
    async function formalAdoption(pending: Promise<number>) { return await returned(pending); }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined).slice(0, 4)).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const selectedDeclaration = (call: Node): Node | undefined => {
    const semantics = source.semantics.forNode(call);
    const selected = semantics.operations.call(call);
    return selected?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
  };
  const storage = createSourceStorageQuery(source, source.sourceFiles, defaultSourceStorageLimits, {
    call(node) {
      const declaration = selectedDeclaration(node);
      return declaration !== undefined && source.ast.is.IsFunctionDeclaration(declaration) && source.ast.body(declaration) === undefined
        ? { resultAllocation: node, preservedInputs: [] } : undefined;
    },
  });
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const declaration = (name: string): Node => {
    const selected = storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    assert.equal(selected !== undefined, true, name);
    return selected!;
  };
  const premises: SourceOwnershipPremises = {
    completionFor(call, selected) {
      const owner = selectedDeclaration(call);
      return owner !== undefined && source.ast.hasModifierKind(owner, "async")
        ? { kind: "async", resultPolicy: "observe-rejection", contractDeclaration: owner, checkedType: selected.sourceResultType }
        : { kind: "not-async" };
    },
    suspensionFor(value) {
      if (value.kind === "input" && value.node === source.ast.parameters(declaration("formalAdoption"))[0]) {
        const type = storage.typeFor(value);
        return type.kind === "resolved" ? { kind: "may-suspend", value,
          contractDeclaration: value.node, checkedType: type.type } : undefined;
      }
      if (!source.ast.is.IsCallExpression(value.node)) return undefined;
      const selected = selectedDeclaration(value.node);
      if (selected === undefined || source.ast.body(selected) !== undefined) return undefined;
      const type = storage.typeFor(value);
      assert.equal(type.kind === "resolved", true, "native pending contract");
      return type.kind === "unresolved" ? undefined : { kind: selected === declaration("pending") ? "may-suspend" : "never",
        value, contractDeclaration: selected, checkedType: type.type };
    },
    retentionFor(value: SourceStorageSubject, bindings: SourceStorageBindings) {
      const type = storage.typeFor(value);
      assert.equal(type.kind === "resolved", true, "exact retained origin type");
      if (type.kind === "unresolved") return { kind: "unresolved", at: value.node, reason: type.reason };
      if (source.ast.is.IsCallExpression(value.node) && selectedDeclaration(value.node) === declaration("borrow")) {
        const argument = source.ast.arguments(value.node)[0]!;
        const selected = storage.subjectFor(argument);
        assert.equal(selected.kind, "resolved", "concrete lease owner subject");
        const bound = selected.kind === "resolved" ? storage.boundOriginsFor(selected.subject, bindings) : selected;
        assert.equal(bound.kind === "resolved" && bound.subjects.length === 1, true, "one exact concrete owner");
        if (bound.kind === "unresolved") return { kind: "unresolved", at: value.node, reason: bound.reason };
        const region = storage.enclosingRegionFor(value.node);
        assert.equal(region !== undefined, true, "concrete source execution region");
        return { kind: "resolved", premises: [{ kind: "scoped-borrowed", value, owner: bound.subjects[0]!, region: region!,
          mode: "shared", contractDeclaration: declaration("borrow"), checkedType: type.type }] };
      }
      return { kind: "resolved", premises: [{ kind: "retained", value, reason: "owned-value",
        contractDeclaration: value.node, checkedType: type.type }] };
    },
  };
  const query = createSourceOwnershipQuery({ source, storage, budget, premises });
  const callIn = (name: string): Node => {
    const root = declaration(name);
    const selected = storage.nodes.find(node => source.ast.is.IsCallExpression(node) &&
      selectedDeclaration(node) === declaration("left") && source.ast.parent(source.ast.parent(node)) !== undefined &&
      storage.enclosingRegionFor(node) === source.ast.body(root));
    assert.equal(selected !== undefined, true, `actual recursive demand in ${name}`);
    return selected!;
  };
  return { source, storage, budget, premises, query, callIn, declaration, selectedDeclaration };
}

for (const reverse of [false, true]) {
  for (const [kind, owner, callee] of [
    ["returned-alias", "Adoption", "returned"],
    ["awaited-member", "AwaitedAdoption", "awaited"],
    ["recursive-return", "RecursiveAdoption", "recursiveAdopt"],
  ]) {
    test(`${kind} prepares its caller-owned Promise producer before the SCC, reverse=${reverse}`, () => {
      for (const borrowed of [false, true]) {
        for (const producerFirst of [false, true]) {
          const current = fixture(reverse, "self");
          const root = current.declaration(`${borrowed ? "borrowed" : "owned"}${owner}`);
          const call = (name: string) => current.storage.nodes.find(node =>
            current.source.ast.is.IsCallExpression(node) &&
            current.selectedDeclaration(node) === current.declaration(name) &&
            current.storage.enclosingRegionFor(node) === current.source.ast.body(root));
          const adopted = call(callee!);
          const produced = call("produced");
          assert.equal(adopted !== undefined && produced !== undefined, true, "the actual adopter and separate caller factory");
          if (producerFirst) {
            const first = current.query.forCall(produced!);
            assert.equal(first.kind, "resolved", "prewarming is a control, not a required execution order");
          }
          const selected = current.query.forCall(adopted!);
          assert.equal(selected.kind === "resolved" && selected.decision === (borrowed ? "rejected" : "admitted"), true,
            selected.kind === "unresolved" ? selected.reason : "an isolated demand owns every return/await producer edge");
          if (selected.kind === "resolved" && borrowed) {
            assert.equal(selected.decision === "rejected" && selected.diagnostic.at === adopted &&
              selected.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES", true,
            "the caller factory's actual loan survives aliases, member projections and recursive adoption");
          }
          assert.equal(current.budget.failure() === undefined, true, "the actual finite graph closes within its unchanged budget");
        }
      }
    });
  }
  test(`a formal Promise adopter remains independent of unrelated caller factories, reverse=${reverse}`, () => {
    const current = fixture(reverse, "self");
    const root = current.declaration("formalAdoption");
    const call = current.storage.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
      current.selectedDeclaration(node) === current.declaration("returned") &&
      current.storage.enclosingRegionFor(node) === current.source.ast.body(root));
    assert.equal(call !== undefined, true, "the exact formal-to-formal result demand");
    const selected = current.query.forCall(call!);
    assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true,
      selected.kind === "unresolved" ? selected.reason : "the native formal contract retains its real bound input");
  });
}

for (const recursive of ["self", "mutual"] as const) {
  for (const reverse of [false, true]) {
    test(`${recursive} continuation components retain owned and concrete borrowed facts, reverse=${reverse}`, () => {
      const current = fixture(reverse, recursive);
      const owned = current.query.forCall(current.callIn("ownedRoot"));
      assert.equal(owned.kind === "resolved" && owned.decision === "admitted", true,
        owned.kind === "unresolved" ? owned.reason : "owned recursion closes without empty fallback");
      const call = current.callIn("borrowedRoot");
      const borrowed = current.query.forCall(call);
      assert.equal(borrowed.kind === "resolved" && borrowed.decision === "rejected" &&
        borrowed.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES" && borrowed.diagnostic.at === call,
      true, borrowed.kind === "unresolved" ? borrowed.reason : "recursive lease remains tied to the actual escaping call");
      assert.equal(current.budget.failure(), undefined, "canonical finite contexts converge under the unchanged budget");
    });
  }
}

test("a recursive component never publishes its private bottom after budget exhaustion", () => {
  const current = fixture(false, "mutual");
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
    const selected = createSourceOwnershipQuery({ ...current, budget }).continuationFor(current.callIn("borrowedRoot"));
    assert.equal(selected.kind, "unresolved", "exhaustion precedes all publication");
    assert.equal(Object.prototype.hasOwnProperty.call(selected, "dependencies"), false, "no provisional owned/empty summary escapes");
    assert.equal(budget.failure() !== undefined, true, "one canonical budget owns the failure");
  }
});

test("canonical context keys preserve actual activations, substitutions and foreign-query rejection", () => {
  const current = fixture(false, "self");
  const { source, storage, declaration, selectedDeclaration } = current;
  const owner = declaration("allocate");
  const calls = storage.nodes.filter(node => source.ast.is.IsCallExpression(node) && selectedDeclaration(node) === owner);
  assert.equal(calls.length, 2, "two genuine invocations of the same allocator body");
  const allocation = storage.nodes.find(node => source.ast.is.IsObjectLiteralExpression(node) &&
    storage.enclosingRegionFor(node) === source.ast.body(owner));
  assert.equal(allocation !== undefined, true, "one exact source allocation site");
  const subject = storage.subjectFor(allocation!);
  assert.equal(subject.kind, "resolved", "canonical allocation subject");
  const selections = calls.map(call => {
    const caller = storage.bindingsForLexicalOwner(call);
    assert.equal(caller.kind, "resolved", "owned allocator caller context");
    const bindings = caller.kind === "resolved" ? storage.bindingsForInvocation(owner, call, caller.bindings) : caller;
    assert.equal(bindings.kind, "resolved", "owned allocator invocation context");
    return bindings.bindings;
  });
  const keys = selections.map(selection => storage.contextKeyFor([subject.subject], selection));
  assert.equal(keys[0]?.kind === "resolved" && keys[1]?.kind === "resolved" && keys[0].key !== keys[1].key, true,
    "the same allocation source site has distinct actual invocation identities");
  const empty = storage.contextKeyFor([], storage.emptyBindings);
  const copied = storage.contextKeyFor([subject.subject], { ...storage.emptyBindings });
  const foreign = fixture(false, "self");
  const foreignSubject = foreign.storage.subjectFor(foreign.storage.nodes.find(node => foreign.source.ast.is.IsObjectLiteralExpression(node))!);
  assert.equal(foreignSubject.kind, "resolved", "foreign canonical subject control");
  assert.equal(empty.kind, "resolved", "an explicitly empty native context has its canonical key");
  assert.equal(copied.kind, "unresolved", "a copied bindings view is not an owned substitution context");
  if (foreignSubject.kind === "resolved") assert.equal(storage.contextKeyFor([foreignSubject.subject], storage.emptyBindings).kind,
    "unresolved", "foreign subjects cannot alias an owned native context");
  const formal = source.ast.parameters(declaration("left"))[0]!;
  const subject_ = storage.subject(formal, "input");
  assert.equal(subject_.kind, "resolved", "the exact recursive formal input");
  const contexts = [current.callIn("ownedRoot"), current.callIn("borrowedRoot")].map(call => {
    const caller = storage.bindingsForLexicalOwner(call);
    return caller.kind === "resolved" ? storage.bindingsForInvocation(declaration("left"), call, caller.bindings) : caller;
  });
  if (subject_.kind === "resolved") {
    const selected = contexts.map(context => context.kind === "resolved"
      ? storage.contextKeyFor([subject_.subject], context.bindings) : context);
    assert.equal(selected[0]?.kind === "resolved" && selected[1]?.kind === "resolved" && selected[0].key !== selected[1].key, true,
      "different actual owned/borrowed substitutions remain different continuation contexts");
  }
});

test("canonical contexts keep actual closure captures and generic input substitutions distinct", () => {
  const current = fixture(false, "mutual");
  const { source, storage, declaration, selectedDeclaration } = current;
  const calls = storage.nodes.filter(node => source.ast.is.IsCallExpression(node) &&
    selectedDeclaration(node) === declaration("capture"));
  assert.equal(calls.length, 2, "two checked generic calls construct different captured values");
  const keys = calls.map(call => {
    const subject = storage.subjectFor(call);
    const bindings = storage.bindingsForLexicalOwner(call);
    assert.equal(subject.kind === "resolved" && bindings.kind === "resolved", true, "the exact generic caller inputs");
    if (subject.kind === "unresolved" || bindings.kind === "unresolved") return undefined;
    const origins = storage.storageProducersFor(subject.subject, bindings.bindings);
    assert.equal(origins.kind === "complete" && origins.producers.length === 1, true,
      "one actual closure body and its original captured context");
    if (origins.kind !== "complete" || origins.producers.length !== 1) return undefined;
    const origin = origins.producers[0]!;
    const selected = storage.contextKeyFor([origin.subject], origin.bindings);
    assert.equal(selected.kind === "resolved", true, "the existing canonical footprint encodes every real capture");
    return selected.kind === "resolved" ? selected.key : undefined;
  });
  assert.equal(keys[0] !== undefined && keys[1] !== undefined && keys[0] !== keys[1], true,
    "same source closure does not merge distinct actual captured generic values");
});
