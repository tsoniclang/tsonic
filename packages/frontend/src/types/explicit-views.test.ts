/**
 * Tests for explicit interface views handling
 */

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import {
  isExplicitViewProperty,
  extractInterfaceNameFromView,
  buildViewPropertyName,
  generateInterfaceCast,
  generateGenericInterfaceCast,
} from "./explicit-views.js";

describe("Explicit Interface Views", () => {
  describe("isExplicitViewProperty", () => {
    it("should detect As_IInterface pattern", () => {
      assert.ok(isExplicitViewProperty("As_ICollection"));
      assert.ok(isExplicitViewProperty("As_IEnumerable"));
    });

    it("should return false for non-view properties", () => {
      assert.ok(!isExplicitViewProperty("Length"));
      assert.ok(!isExplicitViewProperty("Count"));
    });
  });

  describe("extractInterfaceNameFromView", () => {
    it("should extract interface name from As_ prefix", () => {
      const name = extractInterfaceNameFromView("As_ICollection");

      assert.equal(name, "ICollection");
    });

    it("should handle generic interface names", () => {
      const name = extractInterfaceNameFromView("As_IEnumerable_1");

      assert.equal(name, "IEnumerable_1");
    });

    it("should return undefined for invalid pattern", () => {
      const name = extractInterfaceNameFromView("InvalidProperty");

      assert.equal(name, undefined);
    });
  });

  describe("buildViewPropertyName", () => {
    it("should build As_ property name from interface", () => {
      const name = buildViewPropertyName("ICollection");

      assert.equal(name, "As_ICollection");
    });

    it("should handle generic interfaces", () => {
      const name = buildViewPropertyName("IEnumerable_1");

      assert.equal(name, "As_IEnumerable_1");
    });
  });

  describe("generateInterfaceCast", () => {
    it("should generate C# cast expression", () => {
      const cast = generateInterfaceCast(
        "list",
        "System.Collections.ICollection"
      );

      assert.equal(cast, "((ICollection)list)");
    });

    it("should extract short name from qualified name", () => {
      const cast = generateInterfaceCast(
        "obj",
        "System.Collections.Generic.IEnumerable"
      );

      assert.equal(cast, "((IEnumerable)obj)");
    });
  });

  describe("generateGenericInterfaceCast", () => {
    it("should generate generic cast with type arguments", () => {
      const cast = generateGenericInterfaceCast(
        "list",
        "System.Collections.Generic.ICollection`1",
        ["string"]
      );

      assert.equal(cast, "((ICollection<string>)list)");
    });

    it("should handle multiple type arguments", () => {
      const cast = generateGenericInterfaceCast(
        "dict",
        "System.Collections.Generic.IDictionary`2",
        ["string", "int"]
      );

      assert.equal(cast, "((IDictionary<string, int>)dict)");
    });

    it("should handle empty type arguments", () => {
      const cast = generateGenericInterfaceCast(
        "obj",
        "System.Collections.ICollection",
        []
      );

      assert.equal(cast, "((ICollection)obj)");
    });
  });
});
