import assert from "node:assert/strict";
import test from "node:test";

import { GoAppend } from "./compat.js";

test("GoAppend appends to an undefined slice like Go append(nil, ...)", () => {
  assert.deepEqual(GoAppend<string>(undefined, "a", "b"), ["a", "b"]);
});

test("GoAppend returns an extended slice without mutating the input slice", () => {
  const source = ["a"];
  const result = GoAppend(source, "b");

  assert.deepEqual(source, ["a"]);
  assert.deepEqual(result, ["a", "b"]);
});
