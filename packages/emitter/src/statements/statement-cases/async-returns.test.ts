import { describe, it, expect, emitModule } from "./helpers.js";
import type { IrModule } from "./helpers.js";
describe("Statement Emission", () => {
  it("should auto-await async wrapper calls in async return statements", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "inner",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "Promise",
            typeArguments: [{ kind: "primitiveType", name: "string" }],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: "ok" },
              },
            ],
          },
          isExported: false,
          isAsync: true,
          isGenerator: false,
        },
        {
          kind: "functionDeclaration",
          name: "outer",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "Promise",
            typeArguments: [{ kind: "primitiveType", name: "string" }],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "inner" },
                  arguments: [],
                  isOptional: false,
                  inferredType: {
                    kind: "referenceType",
                    name: "Promise",
                    typeArguments: [{ kind: "primitiveType", name: "string" }],
                  },
                },
              },
            ],
          },
          isExported: true,
          isAsync: true,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("return await inner();");
  });

  it("should auto-await async calls when wrapper type exists on callee only", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "outer",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "Promise",
            typeArguments: [{ kind: "primitiveType", name: "string" }],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "call",
                  callee: {
                    kind: "identifier",
                    name: "fromModule",
                    inferredType: {
                      kind: "functionType",
                      parameters: [],
                      returnType: {
                        kind: "referenceType",
                        name: "Promise",
                        typeArguments: [
                          { kind: "primitiveType", name: "string" },
                        ],
                      },
                    },
                  },
                  arguments: [],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "string" },
                },
              },
            ],
          },
          isExported: true,
          isAsync: true,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("return await fromModule();");
  });

  it("unwraps fully-qualified Task<T> body return type for async methods", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "outer",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "System.Threading.Tasks.Task",
            resolvedClrType: "global::System.Threading.Tasks.Task",
            typeArguments: [{ kind: "primitiveType", name: "string" }],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "fromModule" },
                  arguments: [],
                  isOptional: false,
                  inferredType: {
                    kind: "referenceType",
                    name: "System.Threading.Tasks.Task",
                    resolvedClrType: "global::System.Threading.Tasks.Task",
                    typeArguments: [{ kind: "primitiveType", name: "string" }],
                  },
                },
              },
            ],
          },
          isExported: true,
          isAsync: true,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("return await fromModule();");
  });

  it("propagates async context into exported async arrow-field impl methods", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: true,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "outer" },
              type: {
                kind: "functionType",
                parameters: [],
                returnType: {
                  kind: "referenceType",
                  name: "Promise",
                  typeArguments: [{ kind: "primitiveType", name: "string" }],
                },
              },
              initializer: {
                kind: "arrowFunction",
                parameters: [],
                returnType: {
                  kind: "referenceType",
                  name: "Promise",
                  typeArguments: [{ kind: "primitiveType", name: "string" }],
                },
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "call",
                        callee: { kind: "identifier", name: "fromModule" },
                        arguments: [],
                        isOptional: false,
                        inferredType: {
                          kind: "referenceType",
                          name: "Promise",
                          typeArguments: [
                            { kind: "primitiveType", name: "string" },
                          ],
                        },
                      },
                    },
                  ],
                },
                isAsync: true,
                inferredType: {
                  kind: "functionType",
                  parameters: [],
                  returnType: {
                    kind: "referenceType",
                    name: "Promise",
                    typeArguments: [{ kind: "primitiveType", name: "string" }],
                  },
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("return await fromModule();");
  });

  it("does not auto-await non-awaitable async return expressions", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "makeMap",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "Promise",
            typeArguments: [
              {
                kind: "dictionaryType",
                keyType: { kind: "primitiveType", name: "string" },
                valueType: { kind: "referenceType", name: "int" },
              },
            ],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "object",
                  properties: [],
                  inferredType: {
                    kind: "dictionaryType",
                    keyType: { kind: "primitiveType", name: "string" },
                    valueType: { kind: "referenceType", name: "int" },
                  },
                  contextualType: {
                    kind: "dictionaryType",
                    keyType: { kind: "primitiveType", name: "string" },
                    valueType: { kind: "referenceType", name: "int" },
                  },
                },
              },
            ],
          },
          isExported: true,
          isAsync: true,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "return new global::System.Collections.Generic.Dictionary<string, int>();"
    );
    expect(result).not.to.include("return await new");
  });
});
