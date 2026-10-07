import assert from "node:assert/strict";
import test from "node:test";
import { jsSourceCallStorageEffect } from "../../packages/js-source-profile/dist/index.js";

test("owned freeze alias and input preservation are distinct immutable source effects", () => {
  const freeze = jsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "freeze" });
  const inspect = jsSourceCallStorageEffect({ ownerName: "ObjectConstructor", memberName: "isFrozen" });
  assert.equal(freeze.resultAliasesParameter, 0);
  assert.deepEqual(freeze.preservedParameters, [0]);
  assert.equal(inspect.resultAliasesParameter, undefined);
  assert.deepEqual(inspect.preservedParameters, [0]);
  assert.equal(Object.isFrozen(freeze) && Object.isFrozen(inspect), true);
  assert.equal(Object.isFrozen(freeze.preservedParameters) && Object.isFrozen(inspect.preservedParameters), true);
  for (const identity of [undefined, { ownerName: "Object", memberName: "freeze" },
    { ownerName: "Other", memberName: "freeze" }, { ownerName: "ObjectConstructor", memberName: "replace" }]) {
    assert.equal(jsSourceCallStorageEffect(identity) === undefined, true);
  }
});
