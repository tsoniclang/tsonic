import {
  describe,
  it,
  expect,
  findUnionMemberIndex,
  type EmitterContext,
  type EmitterOptions,
  type IrType,
  type LocalTypeInfo,
} from "./helpers.js";

describe("type-resolution", () => {
  describe("findUnionMemberIndex", () => {
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

    it("matches recursive union aliases without stack overflow", () => {
      const middlewareLikeRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareLike",
      };
      const middlewareHandlerType: IrType = {
        kind: "functionType",
        parameters: [],
        returnType: { kind: "voidType" },
      };
      const context = createContext(
        new Map([
          [
            "MiddlewareLike",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  middlewareHandlerType,
                  { kind: "referenceType", name: "Router" },
                  {
                    kind: "arrayType",
                    elementType: middlewareLikeRef,
                  },
                ],
              },
            },
          ],
        ])
      );

      const result = findUnionMemberIndex(
        {
          kind: "unionType",
          types: [middlewareLikeRef, { kind: "primitiveType", name: "string" }],
        },
        middlewareLikeRef,
        context
      );

      expect(result).to.equal(1);
    });
  });
});
