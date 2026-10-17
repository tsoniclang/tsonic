import assert from "node:assert/strict";
import test from "node:test";
import { jsSourceInvocationOnlyCallableParameters, jsSourceCallableParameterEffects } from "../../packages/js-source-profile/dist/index.js";

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

test("native execution facts distinguish deferred handlers from invocation-only lifetimes", () => {
  for (const [memberName, positions] of [["then", [0, 1]], ["catch", [0]], ["finally", [0]]]) {
    const effects = jsSourceCallableParameterEffects({ ownerName: "Promise", memberName });
    assert.equal(Object.isFrozen(effects), true, `${memberName}: frozen native facts`);
    assert.deepEqual(effects.map(effect => effect.parameterIndex), positions, `${memberName}: actual callback slots`);
    assert.equal(effects.every(effect => effect.timing === "deferred" && Object.isFrozen(effect)), true,
      `${memberName}: deferred is never invocation-only`);
    assert.deepEqual(jsSourceInvocationOnlyCallableParameters({ ownerName: "Promise", memberName }), []);
  }
  assert.deepEqual(jsSourceCallableParameterEffects({ ownerName: "PromiseLike", memberName: "then" })
    .map(effect => effect.parameterIndex), [0, 1]);
  for (const identity of [undefined, { ownerName: "ForeignArray", memberName: "forEach" },
    { ownerName: "Array", memberName: "__proto__" }, { ownerName: "Promise", memberName: "unknown" }]) {
    assert.equal(jsSourceCallableParameterEffects(identity) === undefined, true, "unclassified is not a proven empty execution row");
  }
});

test("native callback input components preserve their distinct actual roles", () => {
  for (const memberName of ["map", "filter", "some", "every", "find", "findLast", "findIndex", "findLastIndex", "forEach"]) {
    const row = jsSourceCallableParameterEffects({ ownerName: "Array", memberName });
    assert.deepEqual(row[0].inputs, [{ parameterIndex: 0, from: "receiver-element" }], memberName);
    assert.equal(Object.isFrozen(row[0].inputs) && row[0].inputs.every(Object.isFrozen), true, `${memberName}: frozen component facts`);
  }
  assert.deepEqual(jsSourceCallableParameterEffects({ ownerName: "Array", memberName: "reduce" })[0].inputs,
    [{ parameterIndex: 1, from: "receiver-element" }], "accumulator0 is not element1");
  assert.deepEqual(jsSourceCallableParameterEffects({ ownerName: "Array", memberName: "sort" })[0].inputs,
    [{ parameterIndex: 0, from: "receiver-element" }, { parameterIndex: 1, from: "receiver-element" }]);
  const from = jsSourceCallableParameterEffects({ ownerName: "ArrayConstructor", memberName: "from" })[0];
  assert.equal(from.parameterIndex, 1, "Array.from mapper is formal1");
  assert.deepEqual(from.inputs, [{ parameterIndex: 0, from: "argument-element", sourceParameterIndex: 0 }]);
  assert.equal(jsSourceCallableParameterEffects({ ownerName: "Map", memberName: "forEach" })[0].inputs === undefined,
    true, "no array element provenance invented for Map native payloads");
});

test("native constructor execution does not expand the invocation-only lifetime permission", () => {
  const identity = { ownerName: "PromiseConstructor", memberName: "constructor" };
  assert.deepEqual(jsSourceCallableParameterEffects(identity), [{ parameterIndex: 0, timing: "synchronous" }]);
  assert.equal(jsSourceInvocationOnlyCallableParameters(identity) === jsSourceInvocationOnlyCallableParameters(undefined), true,
    "the existing lifetime answer stays canonical empty, independent of known eager execution");
  assert.equal(jsSourceCallableParameterEffects({ ownerName: "ForeignPromiseConstructor", memberName: "constructor" }) === undefined,
    true, "no constructor behavior by spelling alone");
});
