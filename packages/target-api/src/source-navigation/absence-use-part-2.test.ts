import assert from "node:assert/strict";

import test from "node:test";

import { fixture } from "./absence-use-fixtures.js";

test("absence comparisons use checked nullish and void types on both sides of every equality operator", () => {
  for (const operator of ["==", "!=", "===", "!=="]) {
    for (const absence of ["null", "undefined", "void effect()"]) {
      for (const operand of ["value", "((value) satisfies number | undefined)"]) {
        assert.equal(fixture(`(${operand}) ${operator} (${absence})`), "comparison",
          `${operand} ${operator} ${absence}`);
        assert.equal(fixture(`(${absence}) ${operator} (${operand})`), "comparison",
          `${absence} ${operator} ${operand}`);
      }
    }
  }
});
