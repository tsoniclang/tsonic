import { test } from "node:test";
import assert from "node:assert/strict";
import { ComputeECMALineStarts } from "./core.js";

test("ComputeECMALineStarts returns TS-Go byte offsets for ECMAScript line breaks", () => {
  const cases: Array<{ name: string; text: string; expected: number[] }> = [
    { name: "line feed", text: "a\nb", expected: [0, 2] },
    { name: "carriage-return line-feed pair", text: "a\r\nb", expected: [0, 3] },
    { name: "non-ascii BMP before line feed", text: "é\nx", expected: [0, 3] },
    { name: "line separator", text: "a\u2028b", expected: [0, 4] },
    { name: "surrogate pair before line feed", text: "😀\n", expected: [0, 5] },
    { name: "unpaired surrogate before line feed", text: "\ud800\n", expected: [0, 4] },
  ];

  for (const testCase of cases) {
    assert.deepEqual([...ComputeECMALineStarts(testCase.text)], testCase.expected, testCase.name);
  }
});
