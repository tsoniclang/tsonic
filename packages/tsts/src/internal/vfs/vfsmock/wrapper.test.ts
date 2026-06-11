import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "@tsonic/core/types.js";
import { FromMap } from "../vfstest/vfstest.js";
import { Wrap } from "./wrapper.js";

test("Wrap initializes every exported mock function, call list, and lock", () => {
  const wrapper = Wrap(FromMap(new Map<string, string>(), true as bool))!;

  for (const [key, value] of Object.entries(wrapper)) {
    assert.notEqual(value, undefined, `field ${key} should not be undefined; update Wrap`);
    if (key.endsWith("Func")) {
      assert.equal(typeof value, "function", `field ${key} should be a function`);
    }
    if (key.startsWith("lock")) {
      assert.equal(typeof value, "object", `field ${key} should be a lock`);
    }
  }
});
