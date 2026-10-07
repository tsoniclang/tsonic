import assert from "node:assert/strict";
import test from "node:test";
import { jsSourceCallStorageEffect } from "../../packages/js-source-profile/dist/identities/storage-effects.js";
import { selectJsSourceCallStorageEffect } from "../../packages/js-source-profile/dist/index.js";

test("owned native Error construction publishes one exact fresh result without aliasing or input preservation", () => {
  const invocation = Object.freeze({});
  const call = { call: invocation, sourceSelectedSignatureKind: "resolved" };
  for (const ownerName of ["ErrorConstructor", "RangeErrorConstructor", "TypeErrorConstructor", "URIErrorConstructor"]) {
    for (const memberName of ["constructor", "call"]) {
      const effect = jsSourceCallStorageEffect({ ownerName, memberName }, call);
      assert.equal(effect?.resultAllocation === invocation, true, `${ownerName}.${memberName}`);
      assert.equal(effect.resultAlias === undefined, true);
      assert.equal(effect.preservedInputs.length, 0);
      assert.equal(Object.isFrozen(effect) && Object.isFrozen(effect.preservedInputs), true);
      assert.equal(jsSourceCallStorageEffect({ ownerName, memberName }, { ...call, sourceSelectedSignatureKind: "untyped" }) === undefined, true);
    }
  }
  for (const identity of [undefined, { ownerName: "OtherConstructor", memberName: "constructor" },
    { ownerName: "ErrorConstructor", memberName: "captureStackTrace" },
    { ownerName: "Global", memberName: "Error" }]) {
    assert.equal(jsSourceCallStorageEffect(identity, call) === undefined, true);
  }
});

function selectedCall() {
  return {
    sourceSelectedSignatureKind: "resolved",
    sourceArguments: [{ expression: Object.freeze({}) }, { expression: Object.freeze({}) }],
    sourceArgumentBindings: [{ sourceParameterIndex: 0, sourceArgumentIndex: 1,
      sourceForm: "value", sourceParameterForm: "parameter" }],
  };
}

test("owned freeze alias and input preservation are distinct immutable source effects", () => {
  const call = selectedCall();
  const argument = call.sourceArguments[1].expression;
  const freeze = jsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "freeze" }, call);
  const inspect = jsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "isFrozen" }, call);
  assert.equal(freeze.resultAlias === argument, true);
  assert.equal(freeze.preservedInputs.length, 1);
  assert.equal(freeze.preservedInputs[0] === argument, true);
  assert.equal(inspect.resultAlias, undefined);
  assert.equal(inspect.preservedInputs.length, 1);
  assert.equal(inspect.preservedInputs[0] === argument, true);
  assert.equal(Object.isFrozen(freeze) && Object.isFrozen(inspect), true);
  assert.equal(Object.isFrozen(freeze.preservedInputs) && Object.isFrozen(inspect.preservedInputs), true);
  for (const identity of [undefined, { ownerName: "Object", memberName: "freeze" },
    { ownerName: "Other", memberName: "freeze" }, { ownerName: "ObjectConstructor", memberName: "replace" }]) {
    assert.equal(jsSourceCallStorageEffect(identity, call) === undefined, true);
  }
});

test("source effects require one selected scalar argument for their actual parameter", () => {
  const call = selectedCall();
  const binding = call.sourceArgumentBindings[0];
  for (const [label, selection] of [
    ["unresolved", { ...call, sourceSelectedSignatureKind: "unresolved" }],
    ["missing", { ...call, sourceArgumentBindings: [] }],
    ["duplicate", { ...call, sourceArgumentBindings: [binding, binding] }],
    ["other parameter", { ...call, sourceArgumentBindings: [{ ...binding, sourceParameterIndex: 1 }] }],
    ["spread", { ...call, sourceArgumentBindings: [{ ...binding, sourceForm: "spread" }] }],
    ["rest", { ...call, sourceArgumentBindings: [{ ...binding, sourceParameterForm: "rest" }] }],
    ["absent argument", { ...call, sourceArguments: [] }],
    ["negative index", { ...call, sourceArgumentBindings: [{ ...binding, sourceArgumentIndex: -1 }] }],
    ["fractional index", { ...call, sourceArgumentBindings: [{ ...binding, sourceArgumentIndex: 0.5 }] }],
    ["nonfinite index", { ...call, sourceArgumentBindings: [{ ...binding, sourceArgumentIndex: Infinity }] }],
  ]) {
    assert.equal(jsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "freeze" }, selection) === undefined, true, label);
  }
});

test("effect selection snapshots containers while retaining exact checked operands", () => {
  const call = selectedCall();
  const argument = call.sourceArguments[1].expression;
  const effect = jsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "freeze" }, call);
  call.sourceArguments[1].expression = Object.freeze({});
  call.sourceArgumentBindings.length = 0;
  assert.equal(effect.resultAlias === argument, true);
  assert.equal(effect.preservedInputs[0] === argument, true);
});

test("public catalogue selection retains semantic declaration and global identity without program navigation", () => {
  const call = selectedCall();
  const declaration = Object.freeze({});
  const selected = selectJsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "freeze", declaration }, call);
  assert.equal(selected.declaration === declaration, true);
  assert.equal(selected.form, "member");
  assert.equal(selected.binding.name, "Object");
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.binding), true);
  assert.equal(selected.effect.resultAlias === call.sourceArguments[1].expression, true);
  for (const ownerName of ["ErrorConstructor", "RangeErrorConstructor", "TypeErrorConstructor", "URIErrorConstructor"]) {
    const constructor = selectJsSourceCallStorageEffect({ ownerName, memberName: "constructor", declaration }, call);
    assert.equal(constructor.form, "value");
    assert.equal(constructor.effect.resultAllocation === call.call, true);
  }
  assert.equal(selectJsSourceCallStorageEffect({ ownerName: "ExternalConstructor", memberName: "freeze", declaration }, call) === undefined, true);
});
