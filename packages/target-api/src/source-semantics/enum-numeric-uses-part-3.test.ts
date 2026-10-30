import assert from "node:assert/strict";

import test from "node:test";

import { checked, closedUseTwins } from "./enum-numeric-uses-fixtures.js";

test("checked enum aliases do not require value replay at any binding length", () => {
  const aliases = Array.from({ length: 24 }, (_, index) =>
    `const alias${index} = ${index === 0 ? "value" : `alias${index - 1}`};`).join("\n");
  const source = checked(`enum Value { First = 1, Second = 2 }
export function use(value: Value): Value { ${aliases} return alias23; }`);
  assert.equal(source.semantics.enumConstants.issues.length, 0,
    "every alias uses its actual checked enum contract, not a source binding-count restriction");
});

for (const [label, body, expected] of [
  ["initializer", "const first = ~value; return first;", 1],
  ["one alias", "const first = ~value; const second = first; return second;", 1],
  ["longer erased chain", "const first = ~value; const second = first; const third = second; return third;", 0],
  ["previously visited initializer", "const first = ~value; const second = first; const third = second; const fourth = third; return fourth;", 0],
] as const){
test(`enum domain recovery uses only fixed steps for ${label}`, () => {
    const source = checked(`enum Value { First = 1, Second = 2 }
export function use(value: Value): number { ${body} }`);
    assert.equal(source.semantics.enumConstants.issues.length, expected,
      "only checked/current-expression and permitted initializer/one-alias evidence decides this Host predicate");
  });
}

for (const [label, body] of closedUseTwins){
test(`closed enum use preserves ${label} from actual checked destination evidence`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 0, `${label}: no projection inferred from operator, callee or declaration spelling`);
  });
}
