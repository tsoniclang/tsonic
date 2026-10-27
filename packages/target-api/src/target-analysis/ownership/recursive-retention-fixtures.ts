import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { createSourceStorageQuery } from "../source-storage/queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../source-storage/model/resource-budget.js";
import { createSourceOwnershipQuery } from "./query.js";
import type { SourceOwnershipPremises } from "./model.js";

export function fixture(reverse: boolean, recursive: "self" | "mutual", additional = "") {
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
    `async function plainProducer(): Promise<number> { await pending(); return 1; }`,
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
    ${additional}
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
    async function plainRoot() { const promise = plainProducer(); return await returned(promise); }
    class PromiseHolder {
      constructor(private readonly promise: Promise<number>) {}
      get value(): Promise<number> { return this.promise; }
    }
    async function ownedGetterAdoption() {
      const value: Lease = { value: 3 }; const holder = new PromiseHolder(produced(value));
      const stored = returned(holder.value); return stored;
    }
    async function borrowedGetterAdoption() {
      const owner = { value: 3 }; const value = borrow(owner); const holder = new PromiseHolder(produced(value));
      const stored = returned(holder.value); return stored;
    }
    async function ownedConditionalAdoption(flag: boolean) {
      const value: Lease = { value: 3 }; const promise = flag ? produced(value) : plainProducer();
      const stored = returned(promise); return stored;
    }
    async function borrowedConditionalAdoption(flag: boolean) {
      const owner = { value: 3 }; const value = borrow(owner); const promise = flag ? produced(value) : plainProducer();
      const stored = returned(promise); return stored;
    }
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
        ? { resultAllocation: node } : undefined;
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
    retentionFor(request: Parameters<SourceOwnershipPremises["retentionFor"]>[0]) {
      if (request.kind === "read-value") return undefined;
      const { value, bindings } = request;
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
