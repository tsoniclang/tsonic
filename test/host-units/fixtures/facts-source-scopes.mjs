import assert from "node:assert/strict";
import { accountFailure, createAccount, refuseAccount } from "../../../packages/host/dist/dataflow/index.js";
import { verifyFactBindings } from "../../../packages/host/dist/ir-facts/verify-bindings.js";
import { encodeBodyId, encodeDefId, encodeModuleId, encodePackageId } from "../../../packages/host/dist/ids/index.js";
import { verificationStops } from "./facts-verification.mjs";

const module = encodeModuleId({ package: encodePackageId("source-scopes"), path: "main.ts" });
const definition = name => encodeDefId({ module, segments: [{ name, ordinal: 0 }] });
const owner = definition("owner");
const body = encodeBodyId({ owner, role: "function", ordinal: 0 });
const instance = { body, bindings: { kind: "parametric" } };
const empty = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
const scope = () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
const parameter = { owner: definition("generic"), index: 0 };
const genericScope = () => ({ ...scope(), classParameters: [parameter] });
const genericVector = () => ({ ...empty(), classBindings: [{ kind: "bound", parameter, type: 0 }] });
const target = provided => ({ kind: "body", execution: { instance, provided } });
const root = { kind: "execution", execution: { instance, provided: 0 } };
const entry = (definition, vector = empty()) => ({ definition, vector, site: root });
const account = () => createAccount({ maximumWork: 100000, maximumResultEntries: 100000 });
const refusal = { kind: "refused", diagnostics: [] };

function* visits(rows) {
  yield null;
  yield* rows;
}

function context(sourceBindingScopesOf, bindingScopeOf = () => scope()) {
  return { types: { terms: [{ kind: "primitive", primitive: "int64" }], signatures: [] },
    sourceBindingScopesOf, bindingScopeOf };
}

const check = (rows, ready, meter = account(), selected = target(0)) =>
  verifyFactBindings(visits(rows), selected, root, ready, meter);

export async function sourceScopeCases(suite) {
  await suite.test("definition-bearing vectors resolve their actual scope once without a source-scope inventory", () => {
    let lookups = 0;
    const ready = context(() => { assert.fail("Known declarations never consult an anonymous source inventory."); }, selected => {
      assert.equal(selected, owner);
      lookups += 1;
      return scope();
    });
    assert.deepEqual(check([entry(owner), entry(owner)], ready), { kind: "complete", violations: [] });
    assert.equal(lookups, 2);
  });

  await suite.test("source scope order counts only actual definition-null occurrences among known vectors", () => {
    const rows = [entry(owner), entry(null), entry(owner), entry(null, genericVector())];
    let sourceReads = 0;
    const ready = context(selected => {
      assert.equal(selected.execution.provided, 0);
      sourceReads += 1;
      return [scope(), genericScope()];
    });
    assert.deepEqual(check(rows, ready), { kind: "complete", violations: [] });
    assert.equal(sourceReads, 1);
    const wrong = check(rows, context(() => [genericScope(), scope()]));
    assert.equal(wrong.kind, "complete");
    assert.equal(wrong.violations.some(value => value.rule === "bindings-complete"), true);
  });

  await suite.test("missing, sparse and extra anonymous scopes remain actual findings rather than inferred empty scopes", () => {
    for (const scopes of [null, [], Array(1), [scope(), scope()]]) {
      const result = check([entry(null)], context(() => scopes));
      assert.equal(result.kind, "complete");
      assert.equal(result.violations.some(value => value.rule === "bindings-complete"), true);
      verificationStops(meter => check([entry(null)], context(() => scopes), meter));
    }
    const missing = check([entry(owner)], context(() => { assert.fail("No source fallback for a missing declaration scope."); }, () => null));
    assert.equal(missing.kind, "complete");
    assert.equal(missing.violations.some(value => value.rule === "bindings-complete"), true);
  });

  await suite.test("the same body instance retains distinct source-scope inventories for its actual provided entries", () => {
    const ready = context(selected => selected.execution.provided === 0 ? [scope(), genericScope()] : [genericScope()]);
    assert.deepEqual(check([entry(null), entry(null, genericVector())], ready, account(), target(0)), { kind: "complete", violations: [] });
    assert.deepEqual(check([entry(null, genericVector())], ready, account(), target(1)), { kind: "complete", violations: [] });
  });

  await suite.test("an original refusal installed by the lazy source reader precedes every returned-array read", () => {
    const meter = account();
    const unread = new Proxy([], { get() { assert.fail("No source-scope row or length read after the original refusal."); } });
    const ready = context(() => { refuseAccount(meter, refusal); return unread; });
    assert.equal(check([entry(null)], ready, meter), refusal);
    assert.equal(accountFailure(meter), refusal);
    const entries = { next() { assert.fail("No binding traversal after the original refusal."); } };
    assert.equal(verifyFactBindings(entries, target(0), root, ready, meter), refusal);
  });

  await suite.test("known and source binding verification retain both shared bounds and original first stops", () => {
    const rows = [entry(owner), entry(null), entry(null, genericVector())];
    verificationStops(meter => check(rows, context(() => [scope(), genericScope()]), meter));
    verificationStops(meter => check([entry(owner)], context(() => null, () => null), meter));
  });
}
