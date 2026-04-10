import {
  describe,
  it,
  expect,
  narrowTypeByTypeofTag,
  narrowTypeByNotTypeofTag,
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

    it("narrows source-owned union aliases to matching typeof leaves", () => {
      const aliasContext: EmitterContext = {
        ...context,
        localTypes: new Map([
          [
            "MkdirOptionsLike",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "boolean" },
                  { kind: "referenceType", name: "MkdirOptions" },
                ],
                runtimeCarrierFamilyKey:
                  "runtime-union:alias:Test.MkdirOptionsLike",
                runtimeCarrierName: "MkdirOptionsLike",
                runtimeCarrierNamespace: "Test",
              },
            },
          ],
        ]),
      };
      const currentType = {
        kind: "unionType" as const,
        types: [
          { kind: "primitiveType" as const, name: "undefined" as const },
          { kind: "referenceType" as const, name: "MkdirOptionsLike" },
        ],
      };

      expect(
        narrowTypeByTypeofTag(currentType, "boolean", aliasContext)
      ).to.deep.equal({ kind: "primitiveType", name: "boolean" });

      expect(
        narrowTypeByNotTypeofTag(currentType, "boolean", aliasContext)
      ).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "undefined" },
          { kind: "referenceType", name: "MkdirOptions" },
        ],
      });
    });

    it("keeps structural object aliases nominal while testing typeof object", () => {
      const aliasContext: EmitterContext = {
        ...context,
        localTypes: new Map([
          [
            "BindOptions",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "objectType",
                members: [
                  {
                    kind: "propertySignature",
                    name: "port",
                    type: { kind: "primitiveType", name: "int" },
                    isOptional: true,
                    isReadonly: true,
                  },
                ],
              },
            },
          ],
        ]),
      };
      const currentType = {
        kind: "unionType" as const,
        types: [
          { kind: "primitiveType" as const, name: "int" as const },
          { kind: "referenceType" as const, name: "BindOptions" },
        ],
      };

      expect(
        narrowTypeByTypeofTag(currentType, "object", aliasContext)
      ).to.deep.equal({ kind: "referenceType", name: "BindOptions" });
    });
  });
});
