/**
 * Tests for extractTypeName binding resolution helper
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { extractTypeName } from "./helpers.js";

describe("Binding Resolution in IR", () => {
  describe("extractTypeName", () => {
    it("returns a stable binding name for unions whose constituents normalize to the same type", () => {
      const unionName = extractTypeName({
        kind: "unionType",
        types: [
          { kind: "referenceType", name: "Date" },
          { kind: "referenceType", name: "Date$instance" },
        ],
      });

      expect(unionName).to.equal("Date");
    });

    it("returns undefined for unions whose constituents normalize to different binding types", () => {
      const unionName = extractTypeName({
        kind: "unionType",
        types: [
          { kind: "referenceType", name: "Date" },
          { kind: "referenceType", name: "RegExp" },
        ],
      });

      expect(unionName).to.equal(undefined);
    });

    it("does not treat tuple types as Array bindings", () => {
      const typeName = extractTypeName({
        kind: "tupleType",
        elementTypes: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "string" },
        ],
      });

      expect(typeName).to.equal(undefined);
    });

    it("does not collapse unions of arrays and tuples to Array bindings", () => {
      const typeName = extractTypeName({
        kind: "unionType",
        types: [
          {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "string" },
          },
          {
            kind: "tupleType",
            elementTypes: [{ kind: "primitiveType", name: "string" }],
          },
        ],
      });

      expect(typeName).to.equal(undefined);
    });
  });
});
