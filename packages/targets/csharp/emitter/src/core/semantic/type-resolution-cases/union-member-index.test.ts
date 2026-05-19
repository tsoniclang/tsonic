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

    it("matches function union members when signatures include unknown slots", () => {
      const requestType: IrType = {
        kind: "referenceType",
        name: "Request",
      };
      const responseType: IrType = {
        kind: "referenceType",
        name: "Response",
      };
      const nextType: IrType = {
        kind: "functionType",
        parameters: [],
        returnType: { kind: "voidType" },
      };
      const requestHandlerType: IrType = {
        kind: "functionType",
        parameters: [
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "request" },
            type: requestType,
            isOptional: false,
            isRest: false,
            passing: "value",
          },
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "response" },
            type: responseType,
            isOptional: false,
            isRest: false,
            passing: "value",
          },
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "next" },
            type: nextType,
            isOptional: false,
            isRest: false,
            passing: "value",
          },
        ],
        returnType: { kind: "unknownType" },
      };
      const errorHandlerType: IrType = {
        kind: "functionType",
        parameters: [
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "error" },
            type: { kind: "unknownType" },
            isOptional: false,
            isRest: false,
            passing: "value",
          },
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "request" },
            type: requestType,
            isOptional: false,
            isRest: false,
            passing: "value",
          },
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "response" },
            type: responseType,
            isOptional: false,
            isRest: false,
            passing: "value",
          },
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "next" },
            type: nextType,
            isOptional: false,
            isRest: false,
            passing: "value",
          },
        ],
        returnType: { kind: "unknownType" },
      };

      const result = findUnionMemberIndex(
        {
          kind: "unionType",
          types: [requestHandlerType, errorHandlerType],
        },
        errorHandlerType,
        createContext(new Map())
      );

      expect(result).to.equal(1);
    });
  });
});
