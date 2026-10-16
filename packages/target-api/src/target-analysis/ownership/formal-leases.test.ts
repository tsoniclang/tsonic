import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { createSourceStorageQuery } from "../source-storage/queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../source-storage/model/resource-budget.js";
import { sourceStorageFormalOwner } from "../source-storage/model/subjects.js";
import { createSourceOwnershipQuery } from "./query.js";
import { createSourceRetentionQuery } from "./retention.js";
import { sourceAsyncResultUseIsRejected } from "./result-decision.js";
import type { SourceOwnershipPremises, SourceRetentionPremise } from "./model.js";

function fixture(kind: "input-duration" | "type-argument",
  amend: (premise: SourceRetentionPremise) => SourceRetentionPremise = premise => premise) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    interface Lease<Value, Region> { readonly value: Value; readonly region: Region; }
    declare function pending(): Promise<void>;
    declare function read<Value, Region>(value: Lease<Value, Region>): Value;
    async function keep<Region>(value: Lease<number, Region>): Promise<number> {
      await pending(); return read(value);
    }
    async function immediate<Region>(value: Lease<number, Region>) { return await keep(value); }
    async function escaped<Region>(value: Lease<number, Region>) {
      keep(value); const stored = keep(value); return stored;
    }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined).slice(0, 4)).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles, defaultSourceStorageLimits, {
    call(node, selected) {
      const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      return declaration !== undefined && source.ast.is.IsFunctionDeclaration(declaration) && source.ast.body(declaration) === undefined
        ? { resultAllocation: node, preservedInputs: [] } : undefined;
    },
  });
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const declaration = (name: string): Node => {
    const selected = storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === name);
    assert.equal(selected !== undefined, true, name);
    return selected!;
  };
  const selectedDeclaration = (node: Node): Node | undefined => {
    const semantics = source.semantics.forNode(node);
    const selected = semantics.operations.call(node);
    return selected?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
  };
  const premises: SourceOwnershipPremises = {
    completionFor(call, selected) {
      const owner = selectedDeclaration(call);
      return owner !== undefined && source.ast.hasModifierKind(owner, "async")
        ? { kind: "async", resultPolicy: "observe-rejection", contractDeclaration: owner, checkedType: selected.sourceResultType }
        : { kind: "not-async" };
    },
    suspensionFor(value) {
      if (!source.ast.is.IsCallExpression(value.node)) return undefined;
      const owner = selectedDeclaration(value.node);
      if (owner !== declaration("pending") && owner !== declaration("read")) return undefined;
      const type = storage.typeFor(value);
      assert.equal(type.kind === "resolved", true, "native completion checked type");
      return type.kind === "unresolved" ? undefined : { kind: owner === declaration("pending") ? "may-suspend" : "never",
        value, contractDeclaration: owner, checkedType: type.type };
    },
    retentionFor(value) {
      const type = storage.typeFor(value);
      assert.equal(type.kind === "resolved", true, "retention checked type");
      if (type.kind === "unresolved") return { kind: "unresolved", at: value.node, reason: type.reason };
      const owner = sourceStorageFormalOwner(value, source.ast);
      if (value.kind !== "input" || owner === undefined) return { kind: "resolved", premises: [{ kind: "retained",
        value, reason: "owned-value", contractDeclaration: value.node, checkedType: type.type }] };
      const semantics = source.semantics.forNode(value.node);
      const regionDeclaration = source.ast.typeParameters(owner)[0];
      const binding = semantics.types.typeArgumentBindings(type.type)?.find(argument => {
        const symbol = semantics.declarations.typeSymbol(argument.argumentType);
        return symbol !== undefined && semantics.declarations.symbolDeclarations(symbol).includes(regionDeclaration!);
      });
      assert.equal(kind !== "type-argument" || binding !== undefined && regionDeclaration !== undefined, true,
        "exact native formal-region substitution");
      const premise: SourceRetentionPremise = { kind: "formal-borrowed", value, executionOwner: owner, mode: "shared",
        region: kind === "input-duration" ? { kind, parameter: value.node }
          : { kind, binding: binding!, declaration: regionDeclaration! },
        contractDeclaration: value.node, checkedType: type.type };
      return { kind: "resolved", premises: [amend(premise)] };
    },
  };
  const query = createSourceOwnershipQuery({ source, storage, budget, premises });
  const calls = storage.nodes.filter(node => source.ast.is.IsCallExpression(node) && selectedDeclaration(node) === declaration("keep"));
  assert.equal(calls.length, 3, "all actual result-use demands");
  return { source, storage, budget, premises, query, declaration, calls };
}

for (const kind of ["input-duration", "type-argument"] as const) {
  test(`a checked ${kind} formal lease admits the actual immediate await and rejects both escaping calls`, () => {
    const current = fixture(kind);
    const decisions = current.calls.map(call => current.query.forCall(call));
    assert.equal(decisions[0]?.kind === "resolved" && decisions[0].decision === "admitted", true,
      decisions[0]?.kind === "unresolved" ? decisions[0].reason : "immediate await keeps the exact formal execution");
    for (const [index, call] of current.calls.entries()) {
      if (index === 0) continue;
      const selected = decisions[index];
      assert.equal(selected?.kind === "resolved" && selected.decision === "rejected" &&
        selected.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES" && selected.diagnostic.at === call,
      true, selected?.kind === "unresolved" ? selected.reason : `escaping actual demand ${index}`);
    }
  });
}

test("formal-region admission rejects foreign owners, parameters and region declarations", () => {
  for (const wrong of ["owner", "parameter", "region"] as const) {
    let foreign: ReturnType<typeof fixture>;
    const current = fixture("type-argument", premise => {
      if (premise.kind !== "formal-borrowed") return premise;
      if (wrong === "owner") return { ...premise, executionOwner: foreign.declaration("keep") };
      if (wrong === "parameter") return { ...premise, region: { kind: "input-duration",
        parameter: foreign.source.ast.parameters(foreign.declaration("keep"))[0]! } };
      return { ...premise, region: premise.region.kind === "type-argument"
        ? { ...premise.region, declaration: foreign.source.ast.typeParameters(foreign.declaration("keep"))[0]! }
        : premise.region };
    });
    foreign = fixture("type-argument");
    const selected = current.query.forCall(current.calls[1]!);
    assert.equal(selected.kind, "unresolved", `${wrong}: no copied or foreign formal evidence`);
  }
});

test("formal lease admission keeps the actual origin and does not accept a copied subject", () => {
  const current = fixture("input-duration", premise => ({ ...premise, value: { ...premise.value } }));
  const owner = current.declaration("keep");
  const bindings = current.storage.bindingsForLexicalOwner(owner);
  assert.equal(bindings.kind, "resolved", "checked declaration-local bindings");
  const reference = current.storage.nodes.find(node => current.source.ast.is.IsIdentifier(node) &&
    current.source.ast.text(node) === "value" && current.source.ast.is.IsCallExpression(current.source.ast.parent(node)));
  assert.equal(reference !== undefined, true, "the actual formal read");
  const retention = createSourceRetentionQuery(current);
  const selected = bindings.kind === "resolved" ? retention.forReference(reference!, bindings.bindings) : bindings;
  assert.equal(selected.kind, "unresolved", "copied subjects are not canonical native evidence");
});

for (const kind of ["input-duration", "type-argument"] as const) {
  test(`unresolved async admission requires a validated ${kind} lease, never an unknown or exhausted continuation alone`, () => {
    const current = fixture(kind);
    const call = current.calls[1]!;
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 1 });
    const unresolved = createSourceOwnershipQuery({ ...current, budget }).forCall(call);
    assert.equal(unresolved.kind === "unresolved" && budget.failure() !== undefined, true, "the actual continuation budget is exhausted");
    const unknown = { kind: "unresolved" as const, at: call, reason: "The native projection has no completed lease premise." };
    assert.equal(sourceAsyncResultUseIsRejected(unresolved, unknown), false, "unresolved native evidence never means an owned/static value or a source rejection");
    assert.equal(sourceAsyncResultUseIsRejected(unresolved, { kind: "resolved", premises: [] }), false,
      "an empty possible-lease set is not a fabricated retention proof");
    const reference = current.storage.nodes.find(node => current.source.ast.is.IsIdentifier(node) &&
      current.source.ast.text(node) === "value" && current.source.ast.is.IsCallExpression(current.source.ast.parent(node)));
    assert.equal(reference !== undefined, true, "the real formal read");
    const bindings = current.storage.bindingsForLexicalOwner(current.declaration("keep"));
    assert.equal(bindings.kind, "resolved", "the actual native formal execution");
    if (bindings.kind !== "resolved") return;
    const retention = createSourceRetentionQuery(current).forReference(reference!, bindings.bindings);
    assert.equal(retention.kind === "resolved" && retention.premises.some(premise => premise.kind === "formal-borrowed"), true,
      "the possible lease was admitted by the canonical retention validator");
    assert.equal(sourceAsyncResultUseIsRejected(unresolved, retention), true,
      "the unresolved continuation is refused only with the real validated formal lease");
    const rejected = current.query.forCall(call);
    assert.equal(sourceAsyncResultUseIsRejected(rejected, unknown), true,
      "a resolved source rejection does not depend on inventing another premise");
    const admitted = current.query.forCall(current.calls[0]!);
    assert.equal(sourceAsyncResultUseIsRejected(admitted, retention), false,
      "a real formal lease remains valid for its proven immediate await");
  });
}
