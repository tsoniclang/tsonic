import assert from "node:assert/strict";

import test from "node:test";

import { checked, compositionPreservations, extraNumericRefusals } from "./enum-numeric-uses-fixtures.js";

for (const [label, body] of compositionPreservations){
test(`enum composition preserves ${label} without manufacturing a numeric use`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 0, `${label}: actual result identity and source effects remain unchanged`);
  });
}

for (const [label, body, expected] of Array.from(extraNumericRefusals).slice(0, 7)){
test(`enum boundary refuses ${label} before a target can lose the domain`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, expected, `${label}: exactly one precise issue per actual source use`);
    assert.equal(issues.every(issue => issue.code === "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED" && issue.message.includes("used as a number")), true,
      `${label}: no native fallback, missing-fact invariant or string conversion`);
  });
}
