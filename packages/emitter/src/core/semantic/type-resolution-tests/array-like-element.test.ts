import {
  describe,
  it,
  expect,
  getArrayLikeElementType,
  type EmitterContext,
  type EmitterOptions,
  type LocalTypeInfo,
} from "./helpers.js";

describe("type-resolution", () => {
  describe("getArrayLikeElementType", () => {
    const defaultOptions: EmitterOptions = {
      rootNamespace: "Test",
      indent: 4,
    };

    const createContext = (
      localTypes: ReadonlyMap<string, LocalTypeInfo>
    ): EmitterContext => ({
      indentLevel: 0,
      options: defaultOptions,
      isStatic: false,
      isAsync: false,
      localTypes,
      usings: new Set<string>(),
    });

    it("resolves array element types through local aliases", () => {
      const context = createContext(
        new Map([
          [
            "MiddlewareArgs",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "arrayType",
                elementType: { kind: "referenceType", name: "MiddlewareLike" },
              },
            },
          ],
        ])
      );

      const result = getArrayLikeElementType(
        { kind: "referenceType", name: "MiddlewareArgs" },
        context
      );

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "MiddlewareLike",
      });
    });

    it("resolves ReadonlyArray element types through generic references", () => {
      const context = createContext(new Map());

      const result = getArrayLikeElementType(
        {
          kind: "referenceType",
          name: "ReadonlyArray",
          typeArguments: [{ kind: "primitiveType", name: "string" }],
        },
        context
      );

      expect(result).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("resolves ArrayLike element types through generic references", () => {
      const context = createContext(new Map());

      const result = getArrayLikeElementType(
        {
          kind: "referenceType",
          name: "ArrayLike",
          typeArguments: [{ kind: "primitiveType", name: "number" }],
        },
        context
      );

      expect(result).to.deep.equal({
        kind: "primitiveType",
        name: "number",
      });
    });
  });

});
