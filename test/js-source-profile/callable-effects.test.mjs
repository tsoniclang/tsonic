import assert from "node:assert/strict";
import test from "node:test";
import { jsSourceInvocationOnlyCallableParameters } from "../../packages/js-source-profile/dist/index.js";

const sharedArrayMethods = ["map", "filter", "some", "every", "find", "findLast", "findIndex", "findLastIndex", "forEach", "reduce"];

test("confirmed eager callback operations expose unique immutable source parameter slots", () => {
  for (const ownerName of ["Array", "ReadonlyArray"]) {
    for (const memberName of sharedArrayMethods) {
      const indexes = jsSourceInvocationOnlyCallableParameters({ ownerName, memberName });
      assert.deepEqual(indexes, [0]);
      assert.equal(Object.isFrozen(indexes), true);
      assert.equal(new Set(indexes).size, indexes.length);
      assert.equal(indexes.every(index => Number.isSafeInteger(index) && index >= 0), true);
    }
  }
  for (const ownerName of ["Map", "ReadonlyMap", "Set", "ReadonlySet"]) {
    assert.deepEqual(jsSourceInvocationOnlyCallableParameters({ ownerName, memberName: "forEach" }), [0]);
  }
  for (const ownerName of ["Array", "TypedArray"]) {
    assert.deepEqual(jsSourceInvocationOnlyCallableParameters({ ownerName, memberName: "sort" }), [0]);
  }
  assert.deepEqual(jsSourceInvocationOnlyCallableParameters({ ownerName: "ArrayConstructor", memberName: "from" }), [1]);
});

test("unknown, noncallback, deferred and unimplemented operations have no invented invocation-only semantics", () => {
  const identities = [undefined,
    { ownerName: "ForeignArray", memberName: "map" },
    { ownerName: "Array", memberName: "unknown" },
    { ownerName: "Array", memberName: "constructor" },
    { ownerName: "__proto__", memberName: "map" },
    { ownerName: "Array", memberName: "__proto__" },
    { ownerName: "Array", memberName: "push" },
    { ownerName: "Array", memberName: "pop" },
    { ownerName: "Array", memberName: "reduceRight" },
    { ownerName: "Array", memberName: "flatMap" },
    { ownerName: "Array", memberName: "toSorted" },
    { ownerName: "ReadonlyArray", memberName: "sort" },
    { ownerName: "Promise", memberName: "then" },
    { ownerName: "Promise", memberName: "catch" },
    { ownerName: "Promise", memberName: "finally" },
    { ownerName: "Map", memberName: "set" },
    { ownerName: "TypedArray", memberName: "set" },
  ];
  const empty = jsSourceInvocationOnlyCallableParameters(undefined);
  assert.equal(Object.isFrozen(empty), true);
  for (const identity of identities) {
    assert.equal(jsSourceInvocationOnlyCallableParameters(identity) === empty, true, "canonical empty effect");
  }
  const indexes = jsSourceInvocationOnlyCallableParameters({ ownerName: "Array", memberName: "map" });
  assert.throws(() => { indexes[0] = 1; }, TypeError);
  assert.throws(() => { indexes.push(1); }, TypeError);
  assert.deepEqual(jsSourceInvocationOnlyCallableParameters({ ownerName: "Array", memberName: "map" }), [0]);
});
