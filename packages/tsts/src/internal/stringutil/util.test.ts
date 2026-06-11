import { test } from "node:test";
import assert from "node:assert/strict";
import { EncodeURI } from "./util.js";

test("EncodeURI mirrors upstream escaping cases", () => {
  const cases: Array<{ name: string; input: string; expected: string }> = [
    {
      name: "encodes spaces as percent20",
      input: "a b",
      expected: "a%20b",
    },
    {
      name: "preserves reserved uri characters",
      input: ";/?:@&=+$,#",
      expected: ";/?:@&=+$,#",
    },
    {
      name: "encodes brackets and unicode using utf8 bytes",
      input: "①Ⅻㄨㄩ U1[abc]",
      expected: "%E2%91%A0%E2%85%AB%E3%84%A8%E3%84%A9%20U1%5Babc%5D",
    },
  ];

  for (const testCase of cases) {
    assert.equal(EncodeURI(testCase.input), testCase.expected, testCase.name);
  }
});
