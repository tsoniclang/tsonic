import assert from "node:assert/strict";

import test from "node:test";

import { fixture } from "./absence-use-fixtures.js";

test("absence consumers select only the left coalescing operand through transparent syntax", () => {
  for (const operand of ["value", "(value)", "value satisfies number | undefined",
    "((value) satisfies number | undefined)"]) {
    assert.equal(fixture(`(${operand}) ?? other`), "coalesce", operand);
    assert.equal(fixture(`other ?? (${operand})`), undefined, operand);
  }
});

test("ordinary value comparisons, typeof and returned values do not become absence consumers", () => {
  for (const expression of ["value === other", "other !== value", "value == 1", "1 != value",
    "typeof value", "value"]) {
    assert.equal(fixture(expression), undefined, expression);
  }
});
