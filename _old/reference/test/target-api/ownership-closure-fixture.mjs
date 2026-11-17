import assert from "node:assert/strict";
import { ownershipFixture, sourceText } from "./ownership-fixture.mjs";
import { createSourceStorageQuery, defaultSourceStorageLimits, createSourceDeclarationOwnershipQuery }
  from "../../packages/target-api/dist/public/analysis.js";
import { sourceLexicalCaptures } from "../../packages/target-api/dist/public/source.js";

export const closureText = `
  declare function nativeFuture<T>(view: Lease<T>): Promise<T>;
  declare function settledFuture<T>(view: Lease<T>): Promise<T>;
  declare function nativeScalar(value: number): number;
  declare function opaque(value: Lease<number>): Promise<number>;
  async function after(view: Lease<number>) { await pending(); return view.item; }
  async function beforeOnly(view: Lease<number>) { const read = view.item; await pending(); return read; }
  async function scalarOnly(view: Lease<number>) { await 1; return view.item; }
  async function conditionalRead(view: Lease<number>) { if (flag) await pending(); return view.item; }
  async function oppositeRead(view: Lease<number>) { if (flag) await pending(); else return view.item; }
  async function loopRead(view: Lease<number>) { while (flag) { const read = view.item; await pending(); } }
  async function nestedRead(view: Lease<number>) { function inner() { return view.item; } await pending(); return inner(); }
  async function unusedRead(view: Lease<number>) { async function unused() { await pending(); return view.item; } return 1; }
  async function nestedAsync(view: Lease<number>) { return await after(view); }
  async function nativeOnly(view: Lease<number>) { await nativeFuture(view); }
  async function settledOnly(view: Lease<number>) { await settledFuture(view); }
  async function nativeReturned(view: Lease<number>) { return nativeFuture(view); }
  async function adoptedPending() { return pending(); }
  async function afterAdoption(view: Lease<number>) { await adoptedPending(); return view.item; }
  async function nativeAlias(view: Lease<number>) { const task = nativeFuture(view); const alias = task; await alias; }
  async function aliasRead(view: Lease<number>) { const alias = view; await pending(); return alias.item; }
  async function conditionalAlias(view: Lease<number>) { const alias = flag ? view : sharedGlobal(); await pending(); return alias.item; }
  async function unawaitedNative(view: Lease<number>) { pending(); return view.item; }
  async function returnedPayload(view: Lease<number>) { return view; }
  async function defaultRead(view: Lease<number>, callback = () => view.item) { await pending(); return callback(); }
  async function handlers(view: Lease<number>) { try { await pending(); } catch { return view.item; } finally { const read = view.item; } }
  async function unknownRead(view: Lease<number>) { await opaque(view); return view.item; }
  async function recurse(view: Lease<number>): Promise<number> { if (flag) return recurse(view); await pending(); return view.item; }
  async function runClosed() {
    const owner = new Owner(3); const view = borrow(owner);
    await after(view); await beforeOnly(view); await scalarOnly(view); await conditionalRead(view); await oppositeRead(view);
    await loopRead(view); await nestedRead(view); await unusedRead(view); await nestedAsync(view); await nativeOnly(view);
    await settledOnly(view); await nativeReturned(view); await handlers(view); await unknownRead(view); await recurse(view);
    await afterAdoption(view); await nativeAlias(view); await aliasRead(view); await conditionalAlias(view); await unawaitedNative(view);
    await returnedPayload(view); await defaultRead(view); await defaultRead(view, () => 0);
  }
  async function storedClosed() { const owner = new Owner(1); const view = borrow(owner); const value = nativeOnly(view); }
  async function discardedClosed() { const owner = new Owner(1); const view = borrow(owner); nativeOnly(view); }
  function returnedClosed() { const owner = new Owner(1); const view = borrow(owner); return nativeOnly(view); }
`;

export function closureFixture(options = {}) {
  const base = ownershipFixture({ text: sourceText + closureText + (options.text ?? ""), limits: options.limits });
  const { source, selectedDeclaration, declaration } = base;
  const nativeDeclarations = new Set(["borrow", "pending", "anotherPending", "sharedGlobal", "nativeFuture", "settledFuture", "nativeScalar"]
    .map(name => declaration(name)));
  const pendingDeclarations = new Set(["pending", "anotherPending", "nativeFuture"].map(name => declaration(name)));
  const unprovenNativeCalls = new Set(base.nodes.filter(node => source.ast.is.IsFunctionDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "openAlternative").flatMap(owner => base.calls(owner)));
  const nativeOwners = new Map();
  const nodeDomain = new Set(base.nodes);
  for (const node of base.nodes) {
    if (source.ast.is.IsVariableDeclaration(node)) {
      const initializer = source.ast.as.AsVariableDeclaration(node)?.Initializer;
      if (initializer !== undefined && source.ast.is.IsCallExpression(initializer) &&
        selectedDeclaration(initializer) === declaration("borrow")) {
        const owner = source.ast.arguments(initializer)[0];
        if (owner !== undefined) nativeOwners.set(node, owner);
      }
    }
    if (!source.ast.is.IsArrowFunction(node) && !source.ast.is.IsFunctionExpression(node) &&
      !source.ast.is.IsFunctionDeclaration(node)) continue;
    const body = source.ast.body(node);
    if (body === undefined) continue;
    const captures = sourceLexicalCaptures(node, [body], source.ast, source.navigation, nodeDomain).captures;
    const parameters = captures.map(capture => capture.declaration).filter(capture =>
      source.ast.is.IsParameterDeclaration(capture) && source.ast.text(source.ast.name(capture)) === "view");
    if (parameters.length === 1) nativeOwners.set(node, parameters[0]);
  }
  for (const [name, locals] of [["aliasRead", ["alias"]], ["conditionalAlias", ["alias"]],
    ["nativeAlias", ["task", "alias"]]]) {
    const owner = declaration(name);
    const parameter = source.ast.parameters(owner)[0];
    for (const local of locals) nativeOwners.set(base.named(owner, local), parameter);
  }
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, defaultSourceStorageLimits, {
    call(node) { return nativeDeclarations.has(selectedDeclaration(node)) ? { resultAllocation: node } : undefined; },
  });
  const subject = node => {
    const result = storage.subjectFor(node);
    assert.equal(result.kind === "resolved", true, "checked subject");
    return result.subject;
  };
  const typeFor = value => {
    if (value.component !== undefined) return value.component.selectedType;
    const result = storage.typeFor(value);
    assert.equal(result.kind === "resolved", true, "checked actual type");
    return result.type;
  };
  const native = {
    completionFor(call, selected) {
      const current = selectedDeclaration(call);
      return current !== undefined && (source.ast.hasModifierKind(current, "async") || pendingDeclarations.has(current) ||
        current === declaration("settledFuture")) ? { kind: "async", resultPolicy: options.resultPolicy ?? "observe-rejection",
        contract: { kind: "declaration", declaration: current,
          component: { selectedType: selected.sourceResultType, contextualCall: selected } } } : { kind: "not-async" };
    },
    suspensionFor(value, use) {
      if (unprovenNativeCalls.has(value.node)) return undefined;
      const current = source.ast.is.IsCallExpression(value.node) ? selectedDeclaration(value.node) : undefined;
      const semantics = source.semantics.forNode(value.node);
      const awaited = semantics.types.awaitedType(value.component.selectedType);
      if (current !== undefined && !nativeDeclarations.has(current) && source.ast.body(current) === undefined) return undefined;
      const kind = current === declaration("settledFuture") ? "never"
        : pendingDeclarations.has(current) || current !== undefined && source.ast.hasModifierKind(current, "async") ||
          use === "value" && current === undefined && awaited !== undefined &&
            !semantics.types.isIdentical(awaited, value.component.selectedType) ? "may-suspend"
          : awaited !== undefined && semantics.types.isIdentical(awaited, value.component.selectedType) ? "never" : undefined;
      return kind === undefined ? undefined : { kind, value,
        contract: { kind: "expression", expression: value.node, component: value.component } };
    },
    retentionFor(request) {
      const { value } = request;
      const declared = source.navigation.sourceReferenceFor(value.node)?.declaration;
      const nativeOwner = nativeOwners.get(declared ?? value.node);
      if (nativeOwner !== undefined) {
        const owner = request.valueFor(nativeOwner);
        if ("kind" in owner) return owner;
        return { kind: "resolved", premises: [{ kind: "scoped-borrowed", value, owner,
          region: owner.region.owner, mode: options.mode ?? "shared",
          contract: { kind: "expression", expression: value.node, component: value.component } }] };
      }
      const current = source.ast.is.IsCallExpression(value.node) ? selectedDeclaration(value.node) : undefined;
      if (current === declaration("nativeFuture") || current === declaration("settledFuture")) {
        const parameter = source.ast.parameters(current)[0];
        return { kind: "resolved", premises: [{ kind: "formal-borrowed", value, executionOwner: current,
          region: { kind: "input-duration", parameter }, mode: options.mode ?? "shared",
          contract: { kind: "declaration", declaration: current, component: value.component } }] };
      }
      const selected = base.native.retentionFor(request);
      return selected?.kind !== "resolved" ? selected : { ...selected,
        premises: selected.premises.map(premise => premise.kind === "scoped-borrowed" || premise.kind === "formal-borrowed"
          ? { ...premise, mode: options.mode ?? "shared" } : premise) };
    },
  };
  const query = createSourceDeclarationOwnershipQuery({ source, sourceNodes: base.sourceNodes, nodes: base.nodes, budget: base.budget,
    premises: options.premises?.(native) ?? native, flowLimits: options.flowLimits });
  const call = (name, owner = "runClosed") => {
    const selected = base.calls(declaration(owner)).find(value => selectedDeclaration(value) === declaration(name));
    assert.equal(selected !== undefined, true, `checked call ${owner} → ${name}`);
    return selected;
  };
  return { ...base, storage, native, subject, typeFor, query, call };
}

export function borrowed(selection, label) {
  assert.equal(selection.kind === "resolved", true, selection.kind === "unresolved" ? `${label}: ${selection.reason}` : label);
  return selection.dependencies.filter(dependency => dependency.retention.kind === "scoped-borrowed" || dependency.retention.kind === "formal-borrowed");
}

export function nativeLeaseWitness(fixture, dependency) {
  const { source, nodes } = fixture;
  const { actual, retention, reference } = dependency;
  const { owner, root, role } = actual.region;
  if (actual !== retention.value || !nodes.includes(reference) || !nodes.includes(actual.node) ||
    !nodes.includes(owner) || !nodes.includes(root) || "selection" in actual.region ||
    !["body", "parameter-initializer", "instance-initializer", "module", "static-initializer"].includes(role) ||
    retention.contract.component !== actual.component) return false;
  if (retention.kind === "formal-borrowed") {
    return retention.region.kind === "input-duration" &&
      source.ast.is.IsParameterDeclaration(retention.region.parameter) &&
      source.ast.parent(retention.region.parameter) === retention.executionOwner &&
      source.ast.parameters(retention.executionOwner).includes(retention.region.parameter);
  }
  if (retention.kind !== "scoped-borrowed" || !nodes.includes(retention.owner.node) ||
    retention.region !== retention.owner.region.owner && retention.region !== retention.owner.region.root) return false;
  for (let current = actual.node; current !== undefined; current = source.ast.parent(current)) {
    if (current === retention.region) return true;
  }
  return false;
}
