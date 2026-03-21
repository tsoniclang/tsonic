import {
  describe,
  it,
  expect,
  narrowTypeByTypeofTag,
  type EmitterContext,
} from "./helpers.js";

describe("type-resolution", () => {
  describe("narrowTypeByTypeofTag", () => {
    const context: EmitterContext = {
      indentLevel: 0,
      options: {
        rootNamespace: "Test",
        indent: 4,
      },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
    };

    it("falls back to primitive string for unknown-like values", () => {
      expect(
        narrowTypeByTypeofTag(
          { kind: "referenceType", name: "unknown" },
          "string",
          context
        )
      ).to.deep.equal({ kind: "primitiveType", name: "string" });
    });

    it("falls back to primitive number when union members do not encode the typeof target", () => {
      expect(
        narrowTypeByTypeofTag(
          {
            kind: "unionType",
            types: [{ kind: "referenceType", name: "unknown" }],
          },
          "number",
          context
        )
      ).to.deep.equal({ kind: "primitiveType", name: "number" });
    });
  });
});
