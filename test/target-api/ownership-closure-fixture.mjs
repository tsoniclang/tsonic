import assert from "node:assert/strict";
import { ownershipFixture, sourceText } from "./ownership-fixture.mjs";
import { createSourceStorageQuery, defaultSourceStorageLimits, createSourceOwnershipQuery }
  from "../../packages/target-api/dist/public/analysis.js";

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
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, defaultSourceStorageLimits, {
    call(node) { return nativeDeclarations.has(selectedDeclaration(node)) ? { resultAllocation: node } : undefined; },
  });
  const subject = node => {
    const result = storage.subjectFor(node);
    assert.equal(result.kind === "resolved", true, "checked subject");
    return result.subject;
  };
  const typeFor = value => {
    const result = storage.typeFor(value);
    assert.equal(result.kind === "resolved", true, "checked actual type");
    return result.type;
  };
  const actuals = (node, bindings) => {
    const selected = storage.boundOriginsFor(subject(node), bindings);
    assert.equal(selected.kind === "resolved", true, "checked actual origins");
    return selected.subjects;
  };
  const native = {
    completionFor(call, selected) {
      const current = selectedDeclaration(call);
      return current !== undefined && (source.ast.hasModifierKind(current, "async") || pendingDeclarations.has(current) ||
        current === declaration("settledFuture")) ? { kind: "async", resultPolicy: options.resultPolicy ?? "observe-rejection",
        contractDeclaration: current, checkedType: selected.sourceResultType } : { kind: "not-async" };
    },
    suspensionFor(value) {
      if (!source.ast.is.IsCallExpression(value.node)) return undefined;
      const current = selectedDeclaration(value.node);
      if (!nativeDeclarations.has(current)) return undefined;
      return { kind: pendingDeclarations.has(current) ? "may-suspend" : "never", value,
        contractDeclaration: current, checkedType: typeFor(value) };
    },
    retentionFor(request) {
      if (request.kind === "read-value") return undefined;
      const { value, bindings } = request;
      const current = source.ast.is.IsCallExpression(value.node) ? selectedDeclaration(value.node) : undefined;
      const checkedType = typeFor(value);
      if (current === declaration("borrow")) {
        const owner = actuals(source.ast.arguments(value.node)[0], bindings);
        assert.equal(owner.length, 1, "one checked lease owner");
        return { kind: "resolved", premises: [{ kind: "scoped-borrowed", value, owner: owner[0], mode: options.mode ?? "shared",
          region: storage.enclosingRegionFor(value.node), contractDeclaration: current, checkedType }] };
      }
      if (current === declaration("nativeFuture") || current === declaration("settledFuture")) {
        const premises = actuals(source.ast.arguments(value.node)[0], bindings).flatMap(actual =>
          native.retentionFor({ kind: "origin", value: actual, bindings }).premises)
          .map(premise => ({ ...premise, value, contractDeclaration: current, checkedType }));
        return { kind: "resolved", premises };
      }
      return { kind: "resolved", premises: [{ kind: "retained", value,
        reason: current === declaration("sharedGlobal") ? "module-owner" : "owned-value",
        contractDeclaration: current ?? value.node, checkedType }] };
    },
  };
  const query = createSourceOwnershipQuery({ source, storage, budget: base.budget, premises: options.premises?.(native) ?? native,
    flowLimits: options.flowLimits });
  const call = (name, owner = "runClosed") => {
    const selected = base.calls(declaration(owner)).find(value => selectedDeclaration(value) === declaration(name));
    assert.equal(selected !== undefined, true, `checked call ${owner} → ${name}`);
    return selected;
  };
  return { ...base, storage, native, subject, typeFor, actuals, query, call };
}

export function borrowed(selection, label) {
  assert.equal(selection.kind === "resolved", true, selection.kind === "unresolved" ? `${label}: ${selection.reason}` : label);
  return selection.dependencies.filter(dependency => dependency.retention.kind === "scoped-borrowed");
}
