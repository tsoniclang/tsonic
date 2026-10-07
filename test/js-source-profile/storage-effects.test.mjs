import assert from "node:assert/strict";
import test from "node:test";
import { jsSourceCallStorageEffect } from "../../packages/js-source-profile/dist/index.js";

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
