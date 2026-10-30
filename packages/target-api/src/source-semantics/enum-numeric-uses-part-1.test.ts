import assert from "node:assert/strict";

import test from "node:test";

import { checked, numericUses } from "./enum-numeric-uses-fixtures.js";

for (const [label, body] of numericUses){
test(`enum numeric admission refuses ${label} once before target analysis`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, 1, `${label} has one owning use, not one diagnostic per operand`);
    assert.equal(issues[0]!.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", `${label} has the shared scope diagnostic`);
    assert.equal(issues[0]!.message, "Enum value 'Value' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.",
      `${label} uses the same target-neutral text`);
    assert.equal(Object.isFrozen(issues) && Object.isFrozen(issues[0]), true, `${label} publishes frozen issue data`);
  });
}
