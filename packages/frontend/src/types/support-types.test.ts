/**
 * Tests for support types recognition using real TypeScript types.
 */

import { describe, it, before, after } from "mocha";
import { strict as assert } from "assert";
import { checkUnsupportedSupportType } from "./support-types.js";
import {
  createTestHarness,
  getSupportTypes,
  type TestHarness,
} from "./test-harness.js";

describe("Support Types", () => {
  let harness: TestHarness;
  let types: ReturnType<typeof getSupportTypes>;

  before(() => {
    // Create test harness with real TypeScript program
    harness = createTestHarness();
    types = getSupportTypes(harness);
  });

  after(() => {
    // Clean up temporary files
    harness.cleanup();
  });

  describe("checkUnsupportedSupportType", () => {
    it("should detect TSUnsafePointer as unsupported", () => {
      const error = checkUnsupportedSupportType(
        types.unsafePointer,
        harness.checker
      );

      assert.ok(error);
      assert.match(error!, /unsafe pointer/i);
    });

    it("should detect TSFixed as unsupported", () => {
      const error = checkUnsupportedSupportType(types.fixed, harness.checker);

      assert.ok(error);
      assert.match(error!, /fixed-size buffer/i);
    });

    it("should detect TSStackAlloc as unsupported", () => {
      const error = checkUnsupportedSupportType(
        types.stackAlloc,
        harness.checker
      );

      assert.ok(error);
      assert.match(error!, /stackalloc/i);
    });

    it("should allow TSByRef (supported)", () => {
      const error = checkUnsupportedSupportType(types.byRef, harness.checker);

      assert.equal(error, undefined);
    });

    it("should allow TSNullable (supported)", () => {
      const error = checkUnsupportedSupportType(
        types.nullable,
        harness.checker
      );

      assert.equal(error, undefined);
    });

    it("should allow TSDelegate (supported)", () => {
      const error = checkUnsupportedSupportType(
        types.delegate,
        harness.checker
      );

      assert.equal(error, undefined);
    });
  });
});
