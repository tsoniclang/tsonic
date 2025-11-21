/**
 * Tests for nested types handling
 */

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import {
  parseNestedTypeName,
  isNestedType,
  tsCSharpNestedTypeName,
  clrToTsNestedTypeName,
  tsToCLRNestedTypeName,
  getNestedTypeLevels,
  getOutermostType,
  getInnermostType,
  isNestedInside,
  getParentType,
} from "./nested-types.js";

describe("Nested Types", () => {
  describe("isNestedType", () => {
    it("should detect nested type with $ separator", () => {
      assert.ok(isNestedType("List_1$Enumerator"));
    });

    it("should return false for non-nested type", () => {
      assert.ok(!isNestedType("List_1"));
    });
  });

  describe("parseNestedTypeName", () => {
    it("should parse simple nested type", () => {
      const info = parseNestedTypeName("List_1$Enumerator");

      assert.ok(info);
      assert.equal(info?.outerType, "List_1");
      assert.equal(info?.nestedType, "Enumerator");
      assert.equal(info?.depth, 1);
      assert.deepEqual(info?.fullPath, ["List_1", "Enumerator"]);
    });

    it("should parse multiple nesting levels", () => {
      const info = parseNestedTypeName("A$B$C");

      assert.ok(info);
      assert.equal(info?.outerType, "A");
      assert.equal(info?.nestedType, "C");
      assert.equal(info?.depth, 2);
      assert.deepEqual(info?.fullPath, ["A", "B", "C"]);
    });

    it("should return undefined for non-nested type", () => {
      const info = parseNestedTypeName("SimpleType");

      assert.equal(info, undefined);
    });
  });

  describe("tsCSharpNestedTypeName", () => {
    it("should convert $ to . separator", () => {
      const result = tsCSharpNestedTypeName("List_1$Enumerator");

      assert.equal(result, "List_1.Enumerator");
    });

    it("should handle multiple levels", () => {
      const result = tsCSharpNestedTypeName("A$B$C");

      assert.equal(result, "A.B.C");
    });

    it("should leave non-nested types unchanged", () => {
      const result = tsCSharpNestedTypeName("SimpleType");

      assert.equal(result, "SimpleType");
    });
  });

  describe("clrToTsNestedTypeName", () => {
    it("should convert CLR name to TypeScript", () => {
      const result = clrToTsNestedTypeName("List`1+Enumerator");

      assert.equal(result, "List_1$Enumerator");
    });

    it("should handle multiple levels", () => {
      const result = clrToTsNestedTypeName("A+B+C");

      assert.equal(result, "A$B$C");
    });

    it("should handle generic nested types", () => {
      const result = clrToTsNestedTypeName("Dictionary`2+KeyCollection`1");

      assert.equal(result, "Dictionary_2$KeyCollection_1");
    });
  });

  describe("tsToCLRNestedTypeName", () => {
    it("should convert TypeScript name to CLR", () => {
      const result = tsToCLRNestedTypeName("List_1$Enumerator");

      assert.equal(result, "List`1+Enumerator");
    });

    it("should handle multiple levels", () => {
      const result = tsToCLRNestedTypeName("A$B$C");

      assert.equal(result, "A+B+C");
    });
  });

  describe("getNestedTypeLevels", () => {
    it("should return all nesting levels", () => {
      const levels = getNestedTypeLevels("A$B$C");

      assert.deepEqual(levels, ["A", "A$B", "A$B$C"]);
    });

    it("should return single level for non-nested type", () => {
      const levels = getNestedTypeLevels("SimpleType");

      assert.deepEqual(levels, ["SimpleType"]);
    });
  });

  describe("getOutermostType", () => {
    it("should return outermost type", () => {
      const outermost = getOutermostType("List_1$Enumerator");

      assert.equal(outermost, "List_1");
    });

    it("should return same type for non-nested", () => {
      const outermost = getOutermostType("SimpleType");

      assert.equal(outermost, "SimpleType");
    });
  });

  describe("getInnermostType", () => {
    it("should return innermost type", () => {
      const innermost = getInnermostType("A$B$C");

      assert.equal(innermost, "C");
    });

    it("should return same type for non-nested", () => {
      const innermost = getInnermostType("SimpleType");

      assert.equal(innermost, "SimpleType");
    });
  });

  describe("isNestedInside", () => {
    it("should detect type nested inside another", () => {
      const result = isNestedInside("List_1$Enumerator", "List_1");

      assert.ok(result);
    });

    it("should return false for unrelated types", () => {
      const result = isNestedInside("Dictionary_2$KeyCollection", "List_1");

      assert.ok(!result);
    });

    it("should return false for non-nested type", () => {
      const result = isNestedInside("SimpleType", "List_1");

      assert.ok(!result);
    });
  });

  describe("getParentType", () => {
    it("should return parent type", () => {
      const parent = getParentType("A$B$C");

      assert.equal(parent, "A$B");
    });

    it("should return parent for single nesting", () => {
      const parent = getParentType("List_1$Enumerator");

      assert.equal(parent, "List_1");
    });

    it("should return undefined for non-nested type", () => {
      const parent = getParentType("SimpleType");

      assert.equal(parent, undefined);
    });
  });
});
