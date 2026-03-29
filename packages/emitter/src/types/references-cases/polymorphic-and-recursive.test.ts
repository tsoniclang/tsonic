import {
  baseContext,
  describe,
  emitReferenceType,
  emitTypeAst,
  expect,
  it,
  printType,
} from "./helpers.js";
import type { EmitterContext, IrType } from "./helpers.js";
describe("Reference Type Emission", () => {
  describe("Polymorphic This", () => {
    it("emits polymorphic this markers as the declaring type", () => {
      const [typeAst] = emitTypeAst(
        {
          kind: "typeParameterType",
          name: "__tsonic_polymorphic_this",
        },
        {
          ...baseContext,
          declaringTypeName: "Router",
        }
      );

      expect(printType(typeAst)).to.equal("Router");
    });

    it("emits polymorphic this markers with declaring generic arguments", () => {
      const [typeAst] = emitTypeAst(
        {
          kind: "typeParameterType",
          name: "__tsonic_polymorphic_this",
        },
        {
          ...baseContext,
          className: "Map",
          declaringTypeName: "Map",
          declaringTypeParameterNames: ["K", "V"],
          declaringTypeParameterNameMap: new Map([
            ["K", "TK"],
            ["V", "TV"],
          ]),
        }
      );

      expect(printType(typeAst)).to.equal("Map<TK, TV>");
    });
  });

  describe("Recursive Type Aliases", () => {
    it("emits recursive union aliases without infinite expansion", () => {
      const pathSpecRef: IrType = {
        kind: "referenceType",
        name: "PathSpec",
      };

      const [typeAst] = emitReferenceType(pathSpecRef, {
        ...baseContext,
        localTypes: new Map([
          [
            "PathSpec",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  {
                    kind: "referenceType",
                    name: "RegExp",
                    resolvedClrType: "System.Text.RegularExpressions.Regex",
                  },
                  {
                    kind: "arrayType",
                    elementType: pathSpecRef,
                    origin: "explicit",
                  },
                  { kind: "primitiveType", name: "null" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
            },
          ],
        ]),
      });

      const printed = printType(typeAst);
      expect(printed).to.equal(
        "global::Tsonic.Runtime.Union<object?[], string, global::System.Text.RegularExpressions.Regex>?"
      );
    });

    it("emits recursive middleware aliases without stack overflow", () => {
      const middlewareParamRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareParam",
      };

      const [typeAst] = emitReferenceType(middlewareParamRef, {
        ...baseContext,
        localTypes: new Map([
          [
            "MiddlewareParam",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  {
                    kind: "referenceType",
                    name: "MiddlewareHandler",
                    resolvedClrType: "System.Delegate",
                  },
                  {
                    kind: "arrayType",
                    elementType: middlewareParamRef,
                    origin: "explicit",
                  },
                ],
              },
            },
          ],
        ]),
      });

      const printed = printType(typeAst);
      expect(printed).to.equal(
        "global::Tsonic.Runtime.Union<object?[], global::System.Delegate>"
      );
    });

    it("does not leak recursive alias resolution state into later emissions", () => {
      const middlewareParamRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareParam",
      };
      const middlewareLikeRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareLike",
      };

      const recursiveContext: EmitterContext = {
        ...baseContext,
        localTypes: new Map([
          [
            "MiddlewareParam",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  {
                    kind: "referenceType",
                    name: "MiddlewareHandler",
                    resolvedClrType: "System.Delegate",
                  },
                  {
                    kind: "arrayType",
                    elementType: middlewareParamRef,
                    origin: "explicit",
                  },
                ],
              },
            },
          ],
          [
            "MiddlewareLike",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  middlewareParamRef,
                  {
                    kind: "referenceType",
                    name: "Router",
                    resolvedClrType: "Test.Router",
                  },
                  {
                    kind: "arrayType",
                    elementType: middlewareLikeRef,
                    origin: "explicit",
                  },
                ],
              },
            },
          ],
        ]),
      };

      const [firstTypeAst, nextContext] = emitTypeAst(
        middlewareLikeRef,
        recursiveContext
      );
      const [secondTypeAst] = emitTypeAst(middlewareLikeRef, nextContext);

      expect(nextContext.resolvingTypeAliases).to.equal(
        recursiveContext.resolvingTypeAliases
      );
      expect(printType(firstTypeAst)).to.equal(printType(secondTypeAst));
      expect(printType(secondTypeAst)).to.equal(
        "global::Tsonic.Runtime.Union<object?[], global::System.Delegate, global::Test.Router>"
      );
    });

    it("preserves recursive array alias members when emitting outer array containers", () => {
      const middlewareParamRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareParam",
      };
      const middlewareLikeRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareLike",
      };

      const recursiveContext: EmitterContext = {
        ...baseContext,
        localTypes: new Map([
          [
            "MiddlewareParam",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  {
                    kind: "referenceType",
                    name: "MiddlewareHandler",
                    resolvedClrType: "System.Delegate",
                  },
                  {
                    kind: "arrayType",
                    elementType: middlewareParamRef,
                    origin: "explicit",
                  },
                ],
              },
            },
          ],
          [
            "MiddlewareLike",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  middlewareParamRef,
                  {
                    kind: "referenceType",
                    name: "Router",
                    resolvedClrType: "Test.Router",
                  },
                  {
                    kind: "arrayType",
                    elementType: middlewareLikeRef,
                    origin: "explicit",
                  },
                ],
              },
            },
          ],
        ]),
      };

      const [typeAst] = emitTypeAst(
        {
          kind: "arrayType",
          elementType: middlewareLikeRef,
          origin: "explicit",
        },
        recursiveContext
      );

      expect(printType(typeAst)).to.equal("object[]");
    });

    it("does not leak cross-module recursive alias resolution state into later emissions", () => {
      const pathSpecRef: IrType = {
        kind: "referenceType",
        name: "PathSpec",
      };

      const crossModuleContext: EmitterContext = {
        ...baseContext,
        moduleNamespace: "Test.Router",
        options: {
          ...baseContext.options,
          moduleMap: new Map([
            [
              "/src/types.ts",
              {
                namespace: "Test.Types",
                className: "types",
                filePath: "/src/types.ts",
                hasRuntimeContainer: true,
                hasTypeCollision: false,
                localTypes: new Map([
                  [
                    "PathSpec",
                    {
                      kind: "typeAlias",
                      typeParameters: [],
                      type: {
                        kind: "unionType",
                        types: [
                          { kind: "primitiveType", name: "string" },
                          {
                            kind: "referenceType",
                            name: "RegExp",
                            resolvedClrType:
                              "System.Text.RegularExpressions.Regex",
                          },
                          {
                            kind: "arrayType",
                            elementType: pathSpecRef,
                            origin: "explicit",
                          },
                          { kind: "primitiveType", name: "null" },
                          { kind: "primitiveType", name: "undefined" },
                        ],
                      },
                    },
                  ],
                ]),
              },
            ],
          ]),
        },
      };

      const [firstTypeAst, nextContext] = emitTypeAst(
        pathSpecRef,
        crossModuleContext
      );
      const [secondTypeAst] = emitTypeAst(pathSpecRef, nextContext);

      expect(nextContext.resolvingTypeAliases).to.equal(
        crossModuleContext.resolvingTypeAliases
      );
      expect(printType(firstTypeAst)).to.equal(printType(secondTypeAst));
      expect(printType(secondTypeAst)).to.equal(
        "global::Tsonic.Runtime.Union<object?[], string, global::System.Text.RegularExpressions.Regex>?"
      );
    });

    it("does not leak cross-module non-recursive alias resolution state into later array emissions", () => {
      const labelRef: IrType = {
        kind: "referenceType",
        name: "Label",
      };

      const crossModuleContext: EmitterContext = {
        ...baseContext,
        moduleNamespace: "Test.Router",
        options: {
          ...baseContext.options,
          moduleMap: new Map([
            [
              "/src/types.ts",
              {
                namespace: "Test.Types",
                className: "types",
                filePath: "/src/types.ts",
                hasRuntimeContainer: true,
                hasTypeCollision: false,
                localTypes: new Map([
                  [
                    "Label",
                    {
                      kind: "typeAlias",
                      typeParameters: [],
                      type: { kind: "primitiveType", name: "string" },
                    },
                  ],
                ]),
              },
            ],
          ]),
        },
      };

      const [firstTypeAst, nextContext] = emitTypeAst(
        labelRef,
        crossModuleContext
      );
      const [arrayTypeAst] = emitTypeAst(
        {
          kind: "arrayType",
          elementType: labelRef,
          origin: "explicit",
        },
        nextContext
      );

      expect(nextContext.resolvingTypeAliases).to.equal(
        crossModuleContext.resolvingTypeAliases
      );
      expect(printType(firstTypeAst)).to.equal("string");
      expect(printType(arrayTypeAst)).to.equal("string[]");
    });
  });
});
