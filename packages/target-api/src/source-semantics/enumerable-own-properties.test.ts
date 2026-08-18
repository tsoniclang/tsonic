import assert from "node:assert/strict";
import test from "node:test";
import { orderEnumerableOwnStringProperties } from "./enumerable-own-properties.js";

test("enumerable own string properties follow ECMAScript integer-index ordering", () => {
  const names = ["tail", "10", "2", "01", "0", "4294967294", "4294967295", "-0"];
  assert.deepEqual(
    orderEnumerableOwnStringProperties(names, (name) => name),
    ["0", "2", "10", "4294967294", "tail", "01", "4294967295", "-0"],
  );
});
