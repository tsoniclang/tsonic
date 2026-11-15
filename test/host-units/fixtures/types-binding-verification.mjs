import assert from "node:assert/strict";

export async function bindingVerificationCases(suite, types) {
  const flow = await import("../../../packages/host/dist/dataflow/index.js");
  const empty = () => ({ vector: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] },
    scope: { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] } });
  const own = { owner: "D[M[P[binding];main.ts];Own]", index: 0 };
  const other = { owner: "D[M[P[binding];main.ts];Other]", index: 0 };
  const rich = () => {
    const entry = empty();
    for (const [family, scope] of [["classBindings", "classParameters"], ["methodBindings", "methodParameters"], ["capturedBindings", "capturedParameters"]]) {
      entry.vector[family] = [{ kind: "bound", parameter: own, type: 0 }, { kind: "rigid", parameter: other }];
      entry.scope[scope] = [own, other];
    }
    entry.vector.selfBindings = [{ kind: "bound", owner: own.owner, type: 0 }, { kind: "rigid", owner: other.owner }];
    entry.scope.selfOwners = [own.owner, other.owner];
    return entry;
  };
  const run = (inputs, maximumWork = 100000, maximumResultEntries = 100000, account = flow.createAccount({ maximumWork, maximumResultEntries })) => ({
    account, result: types.verifyBindings(inputs, 1, (work, entries) =>
      flow.chargeWork(account, work) ?? flow.chargeResultEntries(account, entries)),
  });

  await suite.test("one binding-only owner checks actual four-family qualification without reading a TypeTable", () => {
    const value = rich();
    assert.deepEqual(run([value]).result, { kind: "complete", violations: [] });
    const malformed = rich();
    malformed.vector.classBindings[0].parameter = other;
    malformed.vector.methodBindings[0].type = -0;
    malformed.vector.capturedBindings = [undefined, { kind: "bound", parameter: other, type: 1 }, { kind: "rigid", parameter: own }];
    malformed.scope.methodParameters = [undefined, other];
    malformed.vector.selfBindings = [undefined, { kind: "bound", owner: own.owner, type: 1 }, { kind: "rigid", owner: own.owner }];
    const found = run([undefined, malformed]).result;
    assert.equal(found.kind, "complete");
    assert.deepEqual(found.violations.map(row => row.rule), ["binding-vector-complete", "binding-vector-complete", "binding-vector-complete",
      "type-reference", "binding-vector-complete", "binding-vector-complete", "type-reference",
      "binding-vector-complete", "binding-vector-complete", "self-binding-order", "type-reference", "self-owner"]);
    const unlisted = empty(); unlisted.vector.selfBindings = [{ kind: "rigid", owner: own.owner }];
    assert.deepEqual(run([unlisted]).result.violations.map(row => row.rule), ["binding-vector-complete", "self-owner"]);
    for (const count of [-1, -0, 0.5, NaN, Infinity, 9007199254740992])
      assert.throws(() => types.verifyBindings([], count, () => { throw new Error("no traversal before domain validation"); }), TypeError);
    assert.deepEqual(types.verifyBindings([], 0, () => null), { kind: "complete", violations: [] });
  });

  await suite.test("binding verification admits every cursor, scope row and finding on the same original account", () => {
    assert.equal(run([], 2, 2).result.kind, "complete", "initial cursor plus actual completion step");
    assert.equal(run([empty()], 12, 7).result.kind, "complete",
      "initial1 + five binding/family work rows5 + six cursor advances6; seven actual cursor/output slots");
    assert.equal(run([empty()], 11, 7).result.kind, "resource-stop");
    assert.equal(run([empty()], 12, 6).result.kind, "resource-stop");
    const shared = flow.createAccount({ maximumWork: 23, maximumResultEntries: 14 });
    assert.equal(run([empty()], 0, 0, shared).result.kind, "complete");
    assert.equal(run([empty()], 0, 0, shared).result.kind, "resource-stop");
    const original = flow.accountFailure(shared);
    assert.deepEqual(original, { kind: "resource-limit", dimension: "work", maximum: 23 });
    assert.equal(types.verifyBindings(null, 1, (work, entries) =>
      flow.chargeWork(shared, work) ?? flow.chargeResultEntries(shared, entries)).kind, "resource-stop");
    assert.equal(flow.accountFailure(shared), original);
    const untouched = { get length() { throw new Error("no input after original stop"); } };
    const stopped = types.verifyBindings(untouched, 1, () => original);
    assert.equal(stopped.kind, "resource-stop");
    assert.equal(stopped.stop, original);
    const caller = { kind: "caller-stop", cause: { original: true } };
    const callerResult = types.verifyBindings(untouched, 1, () => caller);
    assert.equal(callerResult.stop, caller);
    const actual = rich();
    const lengths = own.owner.length + other.owner.length;
    const work = 1 + 24 + 1 + 3 + 6 + 6 * lengths + 1 + 2 + lengths + 2 + 2 * lengths;
    for (const dimension of ["work", "result-entries"]) {
      const sufficient = dimension === "work" ? work : 25;
      let complete = false;
      for (let maximum = 0; maximum <= sufficient; maximum += 1) {
        const { account, result } = dimension === "work" ? run([actual], maximum) : run([actual], 100000, maximum);
        if (result.kind === "complete") complete = true;
        else {
          assert.equal(complete, false);
          assert.deepEqual(flow.accountFailure(account), { kind: "resource-limit", dimension, maximum });
          assert.equal(result.stop, flow.accountFailure(account));
        }
      }
      assert.equal(complete, true, "derived finite input has a complete bounded result");
    }
  });
}
