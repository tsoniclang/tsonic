import assert from "node:assert/strict";

import test from "node:test";

import { fixture } from "./absence-use.split-fixtures.js";

test("ordinary value comparisons, typeof and returned values do not become absence consumers", () => {
  for (const expression of ["value === other", "other !== value", "value == 1", "1 != value",
    "typeof value", "value"]) {
    assert.equal(fixture(expression), undefined, expression);
  }
});
