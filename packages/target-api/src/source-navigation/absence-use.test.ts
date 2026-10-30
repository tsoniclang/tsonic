import assert from "node:assert/strict";

import test from "node:test";

import { fixture } from "./absence-use.split-fixtures.js";

test("absence consumers select only the left coalescing operand through transparent syntax", () => {
  for (const operand of ["value", "(value)", "value satisfies number | undefined",
    "((value) satisfies number | undefined)"]) {
    assert.equal(fixture(`(${operand}) ?? other`), "coalesce", operand);
    assert.equal(fixture(`other ?? (${operand})`), undefined, operand);
  }
});
