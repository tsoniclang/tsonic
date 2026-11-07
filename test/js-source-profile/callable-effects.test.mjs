// JS API callback rows (api/table.ts) and their publication through facts.profile (D18): `invocationOnlyParameters`
// is the baseline invocation-only table (keel-baseline-20261107-1648 jsSourceInvocationOnlyCallableParameters), `[]`
// for every other declaration; `callbackEffects` is the callback facet of the same table entry.
import assert from "node:assert/strict";
import test from "node:test";
import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import { createJsSourceApiFacts, jsSourceSemanticsIdentity } from "../../packages/js-source-profile/dist/index.js";
import { jsSourceApiEntry } from "../../packages/js-source-profile/dist/api/table.js";

/** A JS profile over provider declarations only: `declaration(exportName, memberName)` is a JS provider member. */
function providerProfile() {
  const facts = new Map();
  const declarations = new Map();
  const declaration = (exportName, memberName, extra = {}) => {
    const key = `${exportName}.${memberName}.${JSON.stringify(extra)}`;
    const known = declarations.get(key);
    if (known !== undefined) return known;
    const node = Object.freeze({ key });
    declarations.set(key, node);
    facts.set(node, Object.freeze({ providerId: jsSourceSemanticsIdentity.providerId, providerVersion: "1",
      providerModuleId: "test.js", moduleSpecifier: "@test/js", artifactFileName: "/src/js.d.ts", exportName, memberName,
      ...(memberName === undefined ? {} : { memberKey: Object.freeze({ kind: "property-key", name: memberName }) }), ...extra }));
    return node;
  };
  const profile = createJsSourceApiFacts({
    ast: { kindName: () => "KindMethodSignature", getSourceFile: () => undefined },
    sourceFacts: { getFact: (subject, key) => key === providerVirtualDeclarationFactKey ? facts.get(subject) : undefined,
      getFacts: () => [], getVirtualDeclarationDocument: () => undefined },
    wellKnownSymbol: () => undefined,
    presentArms: type => [type],
    typeofCategory: () => undefined,
  });
  return { profile, declaration };
}

const sharedArrayMethods = ["map", "filter", "some", "every", "find", "findLast", "findIndex", "findLastIndex", "forEach", "reduce"];

test("invocation-only parameters are the baseline table, published through facts.profile", () => {
  const { profile, declaration } = providerProfile();
  const invocationOnly = (ownerName, memberName) => profile.invocationOnlyParameters(declaration(ownerName, memberName));
  for (const ownerName of ["Array", "ReadonlyArray"]) {
    for (const memberName of sharedArrayMethods) {
      const indexes = invocationOnly(ownerName, memberName);
      assert.deepEqual(indexes, [0], `${ownerName}.${memberName}`);
      assert.equal(Object.isFrozen(indexes), true);
      assert.deepEqual(jsSourceApiEntry(ownerName, memberName)?.callables?.invocationOnly, [0], "the one table row");
    }
  }
  for (const ownerName of ["Map", "ReadonlyMap", "Set", "ReadonlySet"]) {
    assert.deepEqual(invocationOnly(ownerName, "forEach"), [0], `${ownerName}.forEach`);
  }
  for (const ownerName of ["Array", "TypedArray"]) assert.deepEqual(invocationOnly(ownerName, "sort"), [0], `${ownerName}.sort`);
  assert.deepEqual(invocationOnly("ArrayConstructor", "from"), [1], "the Array.from mapper is parameter 1");
});

test("unknown, noncallback, deferred and unimplemented operations have no invocation-only parameters", () => {
  const { profile, declaration } = providerProfile();
  const identities = [
    ["ForeignArray", "map"], ["Array", "unknown"], ["Array", "constructor"], ["__proto__", "map"], ["Array", "__proto__"],
    ["Array", "push"], ["Array", "pop"], ["Array", "reduceRight"], ["Array", "flatMap"], ["Array", "toSorted"],
    ["ReadonlyArray", "sort"], ["Promise", "then"], ["Promise", "catch"], ["Promise", "finally"], ["Map", "set"],
    ["TypedArray", "set"], ["String", "replace"], ["String", "replaceAll"], ["JSON", "parse"], ["JSON", "stringify"],
    ["Global", "queueMicrotask"],
  ];
  for (const [ownerName, memberName] of identities) {
    const indexes = profile.invocationOnlyParameters(declaration(ownerName, memberName));
    assert.deepEqual(indexes, [], `${ownerName}.${memberName}`);
    assert.equal(Object.isFrozen(indexes), true);
  }
  assert.deepEqual(profile.invocationOnlyParameters(Object.freeze({})), [], "a declaration outside every source profile");
  assert.deepEqual(profile.invocationOnlyParameters(declaration("Array", undefined, { signatureId: "call" })), [],
    "a call signature is not a member operation");
  const indexes = profile.invocationOnlyParameters(declaration("Array", "map"));
  assert.throws(() => { indexes[0] = 1; }, TypeError);
  assert.throws(() => { indexes.push(1); }, TypeError);
  assert.deepEqual(profile.invocationOnlyParameters(declaration("Array", "map")), [0]);
});

test("native execution facts distinguish deferred handlers from invocation-only lifetimes", () => {
  const { profile, declaration } = providerProfile();
  for (const [memberName, positions] of [["then", [0, 1]], ["catch", [0]], ["finally", [0]]]) {
    const effects = jsSourceApiEntry("Promise", memberName)?.callables?.entries;
    assert.equal(Object.isFrozen(effects), true, `${memberName}: frozen native facts`);
    assert.deepEqual(effects.map(effect => effect.parameterIndex), positions, `${memberName}: actual callback slots`);
    assert.equal(effects.every(effect => effect.timing === "deferred" && Object.isFrozen(effect)), true,
      `${memberName}: deferred is never invocation-only`);
    assert.equal(profile.callbackEffects({ signature: declaration("Promise", memberName) }) === effects, true,
      `${memberName}: facts.profile publishes the table row`);
    assert.deepEqual(profile.invocationOnlyParameters(declaration("Promise", memberName)), []);
  }
  assert.deepEqual(jsSourceApiEntry("PromiseLike", "then")?.callables?.entries.map(effect => effect.parameterIndex), [0, 1]);
  for (const [ownerName, memberName] of [["ForeignArray", "forEach"], ["Array", "__proto__"], ["Promise", "unknown"]]) {
    assert.equal(jsSourceApiEntry(ownerName, memberName)?.callables, undefined, "unclassified is not a proven empty execution row");
    assert.equal(profile.callbackEffects({ signature: declaration(ownerName, memberName) }), undefined);
  }
});

test("native callback input components preserve their distinct actual roles", () => {
  const entries = (ownerName, memberName) => jsSourceApiEntry(ownerName, memberName)?.callables?.entries;
  for (const memberName of ["map", "filter", "some", "every", "find", "findLast", "findIndex", "findLastIndex", "forEach"]) {
    const row = entries("Array", memberName);
    assert.deepEqual(row[0].inputs, [{ parameterIndex: 0, from: "receiver-element" }], memberName);
    assert.equal(Object.isFrozen(row[0].inputs) && row[0].inputs.every(Object.isFrozen), true, `${memberName}: frozen component facts`);
  }
  assert.deepEqual(entries("Array", "reduce")[0].inputs, [{ parameterIndex: 1, from: "receiver-element" }], "accumulator0 is not element1");
  assert.deepEqual(entries("Array", "sort")[0].inputs,
    [{ parameterIndex: 0, from: "receiver-element" }, { parameterIndex: 1, from: "receiver-element" }]);
  const from = entries("ArrayConstructor", "from")[0];
  assert.equal(from.parameterIndex, 1, "Array.from mapper is formal1");
  assert.deepEqual(from.inputs, [{ parameterIndex: 0, from: "argument-element", sourceParameterIndex: 0 }]);
  assert.equal(entries("Map", "forEach")[0].inputs === undefined, true, "no array element provenance invented for Map native payloads");
});

test("native constructor execution does not expand the invocation-only lifetime permission", () => {
  const constructor = jsSourceApiEntry("PromiseConstructor", "constructor")?.callables;
  assert.deepEqual(constructor?.entries, [{ parameterIndex: 0, timing: "synchronous", rejection: 1 }]);
  assert.deepEqual(constructor?.invocationOnly, [], "known eager execution is not an invocation-only lifetime");
  assert.equal(constructor?.native, true, "the executor row holds in every source profile that declares Promise");
  assert.equal(jsSourceApiEntry("ForeignPromiseConstructor", "constructor"), undefined, "no constructor behavior by spelling alone");
});
