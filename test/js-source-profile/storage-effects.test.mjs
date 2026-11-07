// JS profile storage effects over the Host call selection (SourceCallSelection, R-B4-13). An untyped callee never has a
// selection (Host refusal TSONIC_SOURCE_CALL_UNTYPED), so the effect needs no resolved-signature check of its own.
import assert from "node:assert/strict";
import test from "node:test";
import { jsSourceCallStorageEffect } from "../../packages/js-source-profile/dist/identities/storage-effects.js";
import { selectJsSourceCallStorageEffect } from "../../packages/js-source-profile/dist/index.js";

function selectedCall() {
  return {
    use: Object.freeze({}),
    kind: "call",
    arguments: [
      { argument: Object.freeze({}), argumentIndex: 1, effectiveIndex: 0, parameterIndex: 0, mode: "positional", form: "value" },
    ],
  };
}

test("owned native Error construction publishes one exact fresh result without aliasing or input preservation", () => {
  const call = selectedCall();
  for (const ownerName of ["ErrorConstructor", "RangeErrorConstructor", "TypeErrorConstructor", "URIErrorConstructor"]) {
    for (const memberName of ["constructor", "call"]) {
      const effect = jsSourceCallStorageEffect({ ownerName, memberName }, call);
      assert.equal(effect?.resultAllocation === call.use, true, `${ownerName}.${memberName}`);
      assert.equal(effect.resultAlias === undefined, true);
      assert.equal(Object.hasOwn(effect, "preservedInputs"), false, "allocation is not a native preservation assertion");
      assert.equal(Object.isFrozen(effect), true);
    }
  }
  for (const identity of [undefined, { ownerName: "OtherConstructor", memberName: "constructor" },
    { ownerName: "ErrorConstructor", memberName: "captureStackTrace" },
    { ownerName: "Global", memberName: "Error" }]) {
    assert.equal(jsSourceCallStorageEffect(identity, call) === undefined, true);
  }
});

test("owned freeze alias does not assert native input preservation", () => {
  const call = selectedCall();
  const argument = call.arguments[0].argument;
  const freeze = jsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "freeze" }, call);
  const inspect = jsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "isFrozen" }, call);
  assert.equal(freeze.resultAlias === argument, true);
  assert.equal(Object.hasOwn(freeze, "preservedInputs"), false, "a source identity is not compiler-native mutability evidence");
  assert.equal(inspect === undefined, true, "isFrozen has no storage alias or allocation effect");
  assert.equal(Object.isFrozen(freeze), true);
  for (const identity of [undefined, { ownerName: "Object", memberName: "freeze" },
    { ownerName: "Other", memberName: "freeze" }, { ownerName: "ObjectConstructor", memberName: "replace" }]) {
    assert.equal(jsSourceCallStorageEffect(identity, call) === undefined, true);
  }
});

test("source effects require one positional value argument for their actual parameter", () => {
  const call = selectedCall();
  const binding = call.arguments[0];
  for (const [label, selection] of [
    ["missing", { ...call, arguments: [] }],
    ["duplicate", { ...call, arguments: [binding, { ...binding, effectiveIndex: 1 }] }],
    ["other parameter", { ...call, arguments: [{ ...binding, parameterIndex: 1 }] }],
    ["spread sequence", { ...call, arguments: [{ ...binding, mode: "spread", form: "spread-sequence" }] }],
    ["spread element", { ...call, arguments: [{ ...binding, form: "spread-element", spreadElement: 0 }] }],
    ["rest", { ...call, arguments: [{ ...binding, mode: "rest-element" }] }],
  ]) {
    assert.equal(jsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "freeze" }, selection) === undefined, true, label);
  }
});

test("generator resume effects need the selected receiver", () => {
  const call = selectedCall();
  const resumed = jsSourceCallStorageEffect({ ownerName: "Generator", memberName: "next" }, { ...call, receiver: Object.freeze({}) });
  assert.equal(resumed?.resumeReceiver, true);
  assert.equal(jsSourceCallStorageEffect({ ownerName: "Generator", memberName: "next" }, call), undefined,
    "no receiver, no resumed receiver");
});

test("public catalogue selection retains semantic declaration and global identity without program navigation", () => {
  const call = selectedCall();
  const declaration = Object.freeze({});
  const selected = selectJsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "freeze", declaration }, call);
  assert.equal(selected.declaration === declaration, true);
  assert.equal(selected.form, "member");
  assert.equal(selected.binding.name, "Object");
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.binding), true);
  assert.equal(selected.effect.resultAlias === call.arguments[0].argument, true);
  for (const ownerName of ["ErrorConstructor", "RangeErrorConstructor", "TypeErrorConstructor", "URIErrorConstructor"]) {
    const constructor = selectJsSourceCallStorageEffect({ ownerName, memberName: "constructor", declaration }, call);
    assert.equal(constructor.form, "value");
    assert.equal(constructor.effect.resultAllocation === call.use, true);
  }
  assert.equal(selectJsSourceCallStorageEffect({ ownerName: "ExternalConstructor", memberName: "freeze", declaration }, call) === undefined, true);
});
