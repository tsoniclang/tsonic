import {
  describe,
  expect,
  it,
  narrowTypeByTypeofTag,
  type EmitterContext,
  type EmitterOptions,
  type IrType,
} from "./helpers.js";

describe("type-resolution", () => {
  describe("narrowTypeByTypeofTag", () => {
    const defaultOptions: EmitterOptions = {
      rootNamespace: "Test",
      indent: 4,
    };

    const context: EmitterContext = {
      indentLevel: 0,
      options: defaultOptions,
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
    };

    it("treats System.Object carriers as broad typeof boundaries", () => {
      const objectCarrier: IrType = {
        kind: "referenceType",
        name: "object",
        resolvedClrType: "global::System.Object",
      };

      expect(
        narrowTypeByTypeofTag(objectCarrier, "string", context)
      ).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
      expect(
        narrowTypeByTypeofTag(objectCarrier, "boolean", context)
      ).to.deep.equal({
        kind: "primitiveType",
        name: "boolean",
      });
      expect(
        narrowTypeByTypeofTag(objectCarrier, "number", context)
      ).to.deep.equal({
        kind: "primitiveType",
        name: "number",
      });
    });
  });
});
