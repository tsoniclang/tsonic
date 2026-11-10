import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceDeclarationOwnershipBudget, createSourceDeclarationOwnershipValues, defaultSourceDeclarationOwnershipLimits,
  createSourceStorageQuery, defaultSourceStorageLimits }
  from "../../packages/target-api/dist/public/analysis.js";

export const sourceText = `
  interface Lease<T> { readonly item: T; }
  class Owner<T> { constructor(public value: T) {} }
  declare function borrow<T>(owner: Owner<T>): Lease<T>;
  declare function pending(): Promise<void>;
  declare function anotherPending(): Promise<void>;
  declare function sharedGlobal(): Lease<number>;
  declare const flag: boolean;
  async function read<T>(view: Lease<T>) { await pending(); await anotherPending(); return view.item; }
  async function readImmediately<T>(view: Lease<T>) { return view.item; }
  async function scalarAwait<T>(view: Lease<T>) { await 1; return view.item; }
  function identity<T>(value: T) { return value; }
  function forwardPromise<T>(value: Promise<T>) { return value; }
  async function consumePromise<T>(value: Promise<T>) { return await value; }
  function storePromise<T>(value: Promise<T>) { const stored = value; }
  class Value { constructor(public value: number) {} async read() { return this.value; } }
  class Counter { constructor(public value: number) {} async verify() { await 1; return this.value; } }
  async function awaited() {
    const owner = new Owner(3); const view = borrow(owner);
    return await read(view);
  }
  async function discarded() {
    const owner = new Owner(3); const view = borrow(owner);
    read(view);
  }
  async function stored() {
    const owner = new Owner(3); const view = borrow(owner);
    const result = read(view); const alias = result; return await alias;
  }
  function returned() {
    const owner = new Owner(3); const view = borrow(owner);
    return read(view);
  }
  async function forwarded() {
    const owner = new Owner(3); const view = borrow(owner);
    return await forwardPromise(read(view));
  }
  async function forwardedAsserted() {
    const owner = new Owner(3); const view = borrow(owner);
    return await forwardPromise((read(view) satisfies Promise<number>)!);
  }
  async function passedToAsync() {
    const owner = new Owner(3); const view = borrow(owner);
    consumePromise(read(view));
  }
  async function passedToStorage() {
    const owner = new Owner(3); const view = borrow(owner);
    storePromise(read(view));
  }
  async function genericForward<Value>(view: Lease<Value>) {
    return await readImmediately(identity(view));
  }
  async function historicalScoped() {
    const local = new Value(3); await local.read();
    const counter = new Counter(3); await counter.verify();
    const owner = new Owner(3); return await genericForward(borrow(owner));
  }
  async function scalarValues() { const value = 2; await value; await 0; await false; await "text"; await null; }
  async function unknownPending(value: Promise<number>) { await value; }
  async function twoPending() { await pending(); await anotherPending(); }
  async function genericAwait<Value>(value: Value) { return await value; }
  async function actualAwaits() { await genericAwait(1); await genericAwait(pending()); }
  async function aliasedPending() { const task = pending(); const alias = task; await alias; await task; }
  async function joinedPending() { const task = flag ? pending() : anotherPending(); await task; }
  async function mixedPending(external: Promise<void>) { const task = flag ? pending() : external; await task; }
  async function alternatives() {
    const leftOwner = new Owner(1); const rightOwner = new Owner(2);
    const selected = flag ? borrow(leftOwner) : borrow(rightOwner);
    return await read(selected);
  }
  async function moduleStored() { const result = read(sharedGlobal()); return await result; }
`;

export function ownershipFixture(options = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": options.text ?? sourceText },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(item => item !== undefined)).slice(0, 2048));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "checked fixture file");
  const nodes = [];
  const visit = node => { nodes.push(node); source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); }); };
  visit(file);
  const declaration = name => required(nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === name), `function ${name}`);
  const within = (node, owner) => {
    for (let current = node; current !== undefined; current = source.ast.parent(current)) if (current === owner) return true;
    return false;
  };
  const named = (owner, name) => required(nodes.find(node => within(node, owner) &&
    source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name), `binding ${name}`);
  const calls = owner => nodes.filter(node => within(node, owner) && source.ast.is.IsCallExpression(node));
  const selectedDeclaration = call => {
    const semantics = source.semantics.forNode(call);
    const selected = semantics.operations.call(call);
    return selected?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
  };
  const readCall = owner => required(calls(owner).find(call => selectedDeclaration(call) === declaration("read")), "exact read call");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, defaultSourceStorageLimits, {
    call(node, selected) {
      const current = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      return current !== undefined && ["borrow", "pending", "anotherPending", "sharedGlobal"].some(name => current === declaration(name))
        ? { resultAllocation: node } : undefined;
    },
  });
  const budget = createSourceDeclarationOwnershipBudget(file, { ...defaultSourceDeclarationOwnershipLimits, ...options.limits });
  const context = createSourceDeclarationOwnershipValues({ source, sourceNodes: nodes, nodes, budget, limits: {} });
  const transferBudget = { step: () => budget.step(file), createRows: () => budget.createRows(file),
    failure: () => budget.failure()?.reason };
  const subject = node => {
    const result = storage.subjectFor(node);
    assert.equal(result.kind === "resolved", true, "exact checked value subject");
    return result.subject;
  };
  const typeFor = value => {
    if (value.component !== undefined) return value.component.selectedType;
    const semantics = source.semantics.forNode(value.node);
    const type = semantics.declarations.declaredValueType(value.node) ?? semantics.types.expressionType(value.node);
    assert.equal(type !== undefined, true, "the original checked type is required even for foreign-value controls");
    return type;
  };
  const nativeReads = new Map();
  for (const [ownerName, ownerNames] of [
    ["awaited", ["owner"]], ["discarded", ["owner"]], ["stored", ["owner"]], ["returned", ["owner"]],
    ["forwarded", ["owner"]], ["forwardedAsserted", ["owner"]], ["passedToAsync", ["owner"]],
    ["passedToStorage", ["owner"]], ["alternatives", ["leftOwner", "rightOwner"]], ["moduleStored", []],
  ]) {
    const owner = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === ownerName);
    if (owner === undefined) continue;
    const call = calls(owner).find(node => source.ast.text(source.ast.name(selectedDeclaration(node))) === "read");
    if (call === undefined) continue;
    const nativeOwners = ownerNames.map(name => source.ast.as.AsVariableDeclaration(named(owner, name)).Initializer);
    const metadata = Object.freeze({ owner, nativeOwners: Object.freeze(nativeOwners), programDuration: ownerName === "moduleStored" });
    nativeReads.set(call, metadata);
    const argument = source.ast.arguments(call)[0];
    if (argument !== undefined) nativeReads.set(argument, metadata);
  }
  const native = {
    completionFor(call, _selected) { return completion(call); },
    retentionFor({ value, valueFor }) {
      const current = source.ast.is.IsCallExpression(value.node) ? selectedDeclaration(value.node) : undefined;
      const contract = { kind: "expression", expression: value.node, component: value.component };
      const metadata = nativeReads.get(value.node);
      if (metadata !== undefined) {
        if (metadata.programDuration) return { kind: "resolved", premises: [{ kind: "retained", reason: "module-owner", value,
          contract: { kind: "declaration", declaration: source.ast.is.IsCallExpression(value.node)
            ? selectedDeclaration(value.node) : source.navigation.sourceReferenceFor(value.node)?.declaration,
            component: value.component } }] };
        const premises = [];
        for (const node of metadata.nativeOwners) {
          const owner = valueFor(node);
          if ("kind" in owner) return owner;
          premises.push({ kind: "scoped-borrowed", value, owner, region: source.ast.body(metadata.owner),
            mode: "shared", contract });
        }
        return { kind: "resolved", premises };
      }
      if (current === declaration("sharedGlobal"))
        return { kind: "resolved", premises: [{ kind: "retained", reason: "module-owner", value,
          contract: { kind: "declaration", declaration: current, component: value.component } }] };
      if (current === declaration("borrow")) {
        const owner = valueFor(source.ast.arguments(value.node)[0]);
        if ("kind" in owner) return owner;
        return { kind: "resolved", premises: [{ kind: "scoped-borrowed", value, owner,
          region: value.region.root, mode: "shared", contract }] };
      }
      const reference = source.navigation.sourceReferenceFor(value.node)?.declaration;
      const parameter = source.ast.is.IsParameterDeclaration(value.node) ? value.node
        : reference !== undefined && source.ast.is.IsParameterDeclaration(reference) ? reference
        : current === declaration("read") ? source.ast.parameters(current)[0] : undefined;
      if (parameter !== undefined && source.ast.text(source.ast.name(parameter)) === "view")
        return { kind: "resolved", premises: [{ kind: "formal-borrowed", value,
          executionOwner: source.ast.parent(parameter), region: { kind: "input-duration", parameter },
          mode: "shared", contract }] };
      return { kind: "resolved", premises: [{ kind: "retained", value, reason: "owned-value", contract }] };
    },
    suspensionFor(value) {
      const expression = value.node;
      const current = source.ast.is.IsCallExpression(expression) ? selectedDeclaration(expression) : undefined;
      const types = source.semantics.forNode(expression).types;
      const awaited = types.awaitedType(value.component.selectedType);
      const knownFuture = ["aliasedPending", "joinedPending"].some(name => {
        const owner = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
        return owner !== undefined && within(expression, owner);
      });
      const kind = current === declaration("pending") || current === declaration("anotherPending") || knownFuture ? "may-suspend"
        : awaited !== undefined && types.isIdentical(awaited, value.component.selectedType) ? "never" : undefined;
      return kind === undefined ? undefined : { kind, value,
        contract: { kind: "expression", expression, component: value.component } };
    },
  };
  function completion(call, resultPolicy = "observe-rejection") {
    const semantics = source.semantics.forNode(call);
    const selected = semantics.operations.call(call);
    assert.equal(selected?.sourceSelectedSignatureKind, "resolved");
    return { kind: "async", resultPolicy, contract: { kind: "declaration", declaration: selectedDeclaration(call),
      component: { selectedType: selected.sourceResultType, contextualCall: selected } } };
  }
  const awaitNode = owner => required(nodes.find(node => within(node, owner) && source.ast.is.IsAwaitExpression(node)), "await");
  const readReference = () => required(nodes.find(node => within(node, declaration("read")) &&
    source.ast.is.IsIdentifier(node) && source.ast.text(node) === "view" &&
    source.ast.is.IsPropertyAccessExpression(source.ast.parent(node))), "actual view read");
  return { source, sourceNodes: nodes, storage, file, budget, context, values: context.values, transferBudget, nativeReads, native, nodes, declaration, named, calls, readCall, awaitNode,
    readReference, selectedDeclaration, subject, typeFor, completion, within };
}

function required(value, name) {
  assert.equal(value !== undefined, true, name);
  return value;
}
