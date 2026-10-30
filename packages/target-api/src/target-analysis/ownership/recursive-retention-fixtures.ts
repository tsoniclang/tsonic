import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { createSourceStorageQuery } from "../source-storage/queries.js";
import { defaultSourceStorageLimits } from "../source-storage/model/resource-budget.js";
import { createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits } from "./contracts.js";
import { createSourceDeclarationOwnershipValues } from "./flow.js";
import { createSourceDeclarationOwnershipQuery } from "./query.js";
import { createSourceDeclarationContinuationClosureQuery } from "./closure.js";
import { createSourceDeclarationRetentionQuery } from "./retention.js";
import { createSourceDeclarationSuspensionQuery } from "./suspension.js";
import { createSourceDeclarationContinuationDependencyQuery } from "./dependencies.js";
import { Node_Expression } from "../../source-navigation/index.js";
import type { SourceDeclarationOwnershipBudget } from "./model.js";
import type { SourceDeclarationOwnershipPremises } from "./model.js";

export interface NativeFixtureLifetimeContract {
  readonly scope: string;
  readonly getter?: string;
  readonly owner: string;
  readonly bindings?: readonly string[];
  readonly results?: readonly string[];
  readonly fields?: readonly { readonly receiver: string; readonly member: string }[];
}

export function fixture(reverse: boolean, recursive: "self" | "mutual", additional = "",
  nativeLifetimes: readonly NativeFixtureLifetimeContract[] = []) {
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
  const nodes = source.navigation.nodes;
  const budget = createSourceDeclarationOwnershipBudget(nodes[0]!, defaultSourceDeclarationOwnershipLimits);
  const context = createSourceDeclarationOwnershipValues({ source, nodes, budget, limits: {} });
  const declaration = (name: string): Node => {
    const selected = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    assert.equal(selected !== undefined, true, name);
    return selected!;
  };
  const leaseDeclaration = nodes.find(node => source.ast.is.IsInterfaceDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "Lease");
  assert.equal(leaseDeclaration !== undefined, true, "the original checked native lease declaration is required");
  const isLeaseParameter = (parameter: Node): boolean => {
    const semantics = source.semantics.forNode(parameter);
    const type = semantics.declarations.declaredValueType(parameter);
    const symbol = type === undefined ? undefined : semantics.declarations.typeSymbol(type);
    return symbol !== undefined && semantics.declarations.symbolDeclarations(symbol).includes(leaseDeclaration!);
  };
  const nativeLoans = new Map<Node, { readonly owner: Node; readonly region: Node }>();
  const nativeContracts: readonly NativeFixtureLifetimeContract[] = [
    { scope: "borrowedRoot", owner: "owner", bindings: ["value", "stored"], results: ["left"] },
    { scope: "borrowedAdoption", owner: "owner", bindings: ["value", "promise", "alias", "stored"], results: ["produced", "returned"] },
    { scope: "borrowedAwaitedAdoption", owner: "owner", bindings: ["value", "stored"], results: ["produced", "awaited"],
      fields: [{ receiver: "holder", member: "promise" }] },
    { scope: "borrowedRecursiveAdoption", owner: "owner", bindings: ["value", "promise", "stored"], results: ["produced", "recursiveAdopt"] },
    { scope: "borrowedGetterAdoption", owner: "owner", bindings: ["value", "stored"], results: ["produced", "returned"],
      fields: [{ receiver: "holder", member: "value" }] },
    { scope: "borrowedConditionalAdoption", owner: "owner", bindings: ["value", "promise", "stored"], results: ["produced", "returned"] },
    ...nativeLifetimes,
  ];
  for (const contract of nativeContracts) {
    const scopes = contract.getter === undefined ? [declaration(contract.scope)] : nodes.filter(node => {
      if (!source.ast.is.IsGetAccessorDeclaration(node) || source.ast.text(source.ast.name(node)) !== contract.getter)
        return false;
      const owner = source.ast.parent(node);
      return owner !== undefined && source.ast.is.IsClassDeclaration(owner) &&
        source.ast.text(source.ast.name(owner)) === contract.scope;
    });
    assert.equal(scopes.length, 1, "a native fixture lifetime names one original checked function or getter");
    const scope = scopes[0]!;
    const region = source.ast.body(scope);
    assert.equal(region !== undefined, true, "native fixture lifetimes require their original declared body");
    const localNodes = nodes.filter(node => context.declarationFor(node) === scope);
    const binding = (name: string) => localNodes.find(node =>
      (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsParameterDeclaration(node)) &&
      source.ast.text(source.ast.name(node)) === name);
    const owner = source.ast.name(binding(contract.owner));
    assert.equal(owner !== undefined, true, "native fixture lifetime records keep the original checked owner binding");
    const bindings = new Set((contract.bindings ?? []).map(name => {
      const selected = binding(name);
      assert.equal(selected !== undefined, true, name);
      return selected!;
    }));
    const results = new Set((contract.results ?? []).map(declaration));
    const fields = (contract.fields ?? []).map(field => {
      const receiver = binding(field.receiver);
      assert.equal(receiver !== undefined, true, field.receiver);
      return { receiver: receiver!, member: field.member };
    });
    const loan = Object.freeze({ owner: owner!, region: region! });
    for (const node of localNodes) {
      const reference = source.navigation.sourceReferenceFor(node)?.declaration;
      const expression = source.ast.is.IsPropertyAccessExpression(node) ? Node_Expression(source.ast, node) : undefined;
      const receiver = expression === undefined ? undefined : source.navigation.sourceReferenceFor(expression)?.declaration;
      if (bindings.has(node) || reference !== undefined && bindings.has(reference) ||
        source.ast.is.IsCallExpression(node) && results.has(selectedDeclaration(node)!) ||
        fields.some(field => field.receiver === receiver && source.ast.text(source.ast.name(node)) === field.member))
        nativeLoans.set(node, loan);
    }
  }
  const premises: SourceDeclarationOwnershipPremises = {
    completionFor(call, selected) {
      const owner = selectedDeclaration(call);
      return owner !== undefined && source.ast.hasModifierKind(owner, "async")
        ? { kind: "async", resultPolicy: "observe-rejection",
            contract: { kind: "declaration", declaration: owner,
              component: { selectedType: selected.sourceResultType, contextualCall: selected } } }
        : { kind: "not-async" };
    },
    suspensionFor(value) {
      const selected = source.ast.is.IsCallExpression(value.node) ? selectedDeclaration(value.node) : undefined;
      const reference = source.navigation.sourceReferenceFor(value.node)?.declaration;
      const formal = source.ast.is.IsParameterDeclaration(value.node) ? value.node : reference;
      const contract = { kind: "expression" as const, expression: value.node, component: value.component };
      if (formal === source.ast.parameters(declaration("formalAdoption"))[0])
        return { kind: "may-suspend", value, contract };
      if (selected === undefined) {
        const semantics = source.semantics.forNode(value.node);
        const awaited = semantics.types.awaitedType(value.component.selectedType);
        return awaited === undefined ? undefined : { kind: semantics.types.isIdentical(awaited, value.component.selectedType)
          ? "never" : "may-suspend", value, contract };
      }
      if (source.ast.body(selected) !== undefined)
        return { kind: source.ast.hasModifierKind(selected, "async") ? "may-suspend" : "never", value, contract };
      if (selected !== declaration("pending") && selected !== declaration("read") && selected !== declaration("borrow"))
        return undefined;
      return { kind: selected === declaration("pending") ? "may-suspend" : "never", value, contract };
    },
    retentionFor({ value, valueFor }) {
      const contract = { kind: "expression" as const, expression: value.node, component: value.component };
      const recorded = nativeLoans.get(value.node);
      if (recorded !== undefined) {
        const owner = valueFor(recorded.owner);
        if ("kind" in owner) return owner;
        return { kind: "resolved", premises: [{ kind: "scoped-borrowed", value, owner,
          region: recorded.region, mode: "shared", contract }] };
      }
      if (source.ast.is.IsCallExpression(value.node) && selectedDeclaration(value.node) === declaration("borrow")) {
        const argument = source.ast.arguments(value.node)[0]!;
        const owner = valueFor(argument);
        if ("kind" in owner) return owner;
        return { kind: "resolved", premises: [{ kind: "scoped-borrowed", value, owner,
          region: value.region.root, mode: "shared", contract }] };
      }
      const semantics = source.semantics.forNode(value.node);
      const reference = source.navigation.sourceReferenceFor(value.node)?.declaration;
      const formal = source.ast.is.IsParameterDeclaration(value.node) ? value.node
        : reference !== undefined && source.ast.is.IsParameterDeclaration(reference) ? reference : undefined;
      if (formal !== undefined && isLeaseParameter(formal))
        return { kind: "resolved", premises: [{ kind: "formal-borrowed", value,
          executionOwner: source.ast.parent(formal)!, region: { kind: "input-duration", parameter: formal },
          mode: "shared", contract }] };
      if (source.ast.is.IsCallExpression(value.node)) {
        const call = semantics.operations.call(value.node);
        const owner = selectedDeclaration(value.node);
        const parameter = owner === undefined ? undefined : source.ast.parameters(owner)[0];
        if (call?.sourceSelectedSignatureKind === "resolved" && owner !== undefined && parameter !== undefined &&
          source.ast.hasModifierKind(owner, "async") && isLeaseParameter(parameter)) {
          const selectedParameter = call.sourceSelectedSignatureParameters.find(selected => selected.parameterDeclaration === parameter);
          const inputs = selectedParameter === undefined ? [] : call.sourceArgumentBindings.filter(input =>
            input.sourceParameterIndex === selectedParameter.parameterIndex && input.sourceForm === "value");
          assert.equal(inputs.length, 1, "the native result has one exact selected input-duration slot");
          const argument = source.ast.arguments(value.node)[inputs[0]!.sourceArgumentIndex]!;
          const input = source.navigation.sourceReferenceFor(argument)?.declaration;
          if (input !== undefined && source.ast.is.IsParameterDeclaration(input) && isLeaseParameter(input))
            return { kind: "resolved", premises: [{ kind: "formal-borrowed", value, executionOwner: owner,
              region: { kind: "input-duration", parameter }, mode: "shared", contract }] };
          const loan = nativeLoans.get(argument);
          if (loan !== undefined) {
            const nativeOwner = valueFor(loan.owner);
            if ("kind" in nativeOwner) return nativeOwner;
            return { kind: "resolved", premises: [{ kind: "scoped-borrowed", value, owner: nativeOwner,
              region: loan.region, mode: "shared", contract }] };
          }
        }
      }
      return { kind: "resolved", premises: [{ kind: "retained", value, reason: "owned-value", contract }] };
    },
  };
  const query = createSourceDeclarationOwnershipQuery({ source, nodes, budget, premises });
  const callIn = (name: string): Node => {
    const root = declaration(name);
    const selected = nodes.find(node => source.ast.is.IsCallExpression(node) &&
      selectedDeclaration(node) === declaration("left") && context.declarationFor(node) === root);
    assert.equal(selected !== undefined, true, `actual recursive demand in ${name}`);
    return selected!;
  };
  const continuation = (premises: SourceDeclarationOwnershipPremises, budget: SourceDeclarationOwnershipBudget) => {
    const context = createSourceDeclarationOwnershipValues({ source, nodes, budget, limits: {} });
    const retention = createSourceDeclarationRetentionQuery({ source, values: context.values, premises, budget });
    const suspensions = createSourceDeclarationSuspensionQuery({ source, values: context.values, premises, budget });
    const dependencies = createSourceDeclarationContinuationDependencyQuery({ source, budget, retention, suspensions });
    const closure = createSourceDeclarationContinuationClosureQuery({ source, context, budget, retention, suspensions,
      dependencies, limits: {} });
    return { context, closure };
  };
  return { source, nodes, storage, budget, context, values: context.values, premises, query, callIn, declaration,
    selectedDeclaration, continuation };
}
