import { describe, it, expect, emitModule, type IrModule } from "./helpers.js";

describe("Expression Emission", () => {
  it("should infer arrow function return type from inferredType", () => {
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
              name: { kind: "identifierPattern", name: "add" },
              // No explicit type annotation
              initializer: {
                kind: "arrowFunction",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: { kind: "identifierPattern", name: "a" },
                    type: { kind: "primitiveType", name: "number" },
                    isOptional: false,
                    isRest: false,
                    passing: "value",
                  },
                  {
                    kind: "parameter",
                    pattern: { kind: "identifierPattern", name: "b" },
                    type: { kind: "primitiveType", name: "number" },
                    isOptional: false,
                    isRest: false,
                    passing: "value",
                  },
                ],
                // No explicit returnType
                body: {
                  kind: "binary",
                  operator: "+",
                  left: { kind: "identifier", name: "a" },
                  right: { kind: "identifier", name: "b" },
                },
                isAsync: false,
                // TypeScript inferred type
                inferredType: {
                  kind: "functionType",
                  parameters: [
                    {
                      kind: "parameter",
                      pattern: { kind: "identifierPattern", name: "a" },
                      type: { kind: "primitiveType", name: "number" },
                      isOptional: false,
                      isRest: false,
                      passing: "value",
                    },
                    {
                      kind: "parameter",
                      pattern: { kind: "identifierPattern", name: "b" },
                      type: { kind: "primitiveType", name: "number" },
                      isOptional: false,
                      isRest: false,
                      passing: "value",
                    },
                  ],
                  returnType: { kind: "primitiveType", name: "number" },
                },
              },
            },
          ],
        },
      ],
      exports: [
        {
          kind: "named",
          name: "add",
          localName: "add",
        },
      ],
    };

    const result = emitModule(module);

    // Should infer Func<double, double, double> from inferredType with global:: prefix
    expect(result).to.include("global::System.Func<double, double, double>");
    expect(result).to.include("public static");
  });

  it("should emit default(object) for undefined arguments with undefined/type-parameter call context", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "ok" },
            arguments: [{ kind: "identifier", name: "undefined" }],
            isOptional: false,
            parameterTypes: [{ kind: "primitiveType", name: "undefined" }],
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 1,
              column: 1,
              length: 19,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("ok(default(object))");
  });

  it("should emit default(T) for undefined identifiers in generic type-parameter contexts", () => {
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
          name: "wrap",
          typeParameters: [
            {
              kind: "typeParameter",
              name: "T",
            },
          ],
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: {
                kind: "unionType",
                types: [
                  { kind: "typeParameterType", name: "T" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: {
            kind: "unionType",
            types: [
              { kind: "typeParameterType", name: "T" },
              { kind: "primitiveType", name: "undefined" },
            ],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: { kind: "identifier", name: "value" },
              },
            ],
          },
          isAsync: false,
          isGenerator: false,
          isExported: false,
        },
        {
          kind: "functionDeclaration",
          name: "test",
          typeParameters: [
            {
              kind: "typeParameter",
              name: "T",
            },
          ],
          parameters: [],
          returnType: {
            kind: "unionType",
            types: [
              { kind: "typeParameterType", name: "T" },
              { kind: "primitiveType", name: "undefined" },
            ],
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
                    name: "wrap",
                  },
                  arguments: [{ kind: "identifier", name: "undefined" }],
                  typeArguments: [{ kind: "typeParameterType", name: "T" }],
                  parameterTypes: [
                    {
                      kind: "unionType",
                      types: [
                        { kind: "typeParameterType", name: "T" },
                        { kind: "primitiveType", name: "undefined" },
                      ],
                    },
                  ],
                  isOptional: false,
                  inferredType: {
                    kind: "unionType",
                    types: [
                      { kind: "typeParameterType", name: "T" },
                      { kind: "primitiveType", name: "undefined" },
                    ],
                  },
                },
              },
            ],
          },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("wrap<T>(default(T))");
    expect(result).not.to.include("wrap<T>(default(object))");
  });

  it("should emit typed defaults for undefined arguments in nullable and reference contexts", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "acceptString" },
            arguments: [{ kind: "identifier", name: "undefined" }],
            isOptional: false,
            parameterTypes: [
              {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
            ],
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 1,
              column: 1,
              length: 19,
            },
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "acceptNumber" },
            arguments: [{ kind: "literal", value: undefined }],
            isOptional: false,
            parameterTypes: [
              {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "number" },
                  { kind: "primitiveType", name: "null" },
                ],
              },
            ],
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 2,
              column: 1,
              length: 19,
            },
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "acceptBool" },
            arguments: [{ kind: "literal", value: undefined }],
            isOptional: false,
            parameterTypes: [
              {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "boolean" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
            ],
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 3,
              column: 1,
              length: 19,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("acceptString(default(string))");
    expect(result).to.include("acceptNumber(default(double?))");
    expect(result).to.include("acceptBool(default(bool?))");
  });

  it("should fall back to local function signature parameter types for undefined arguments", () => {
    const stringOptionalType = {
      kind: "unionType" as const,
      types: [
        { kind: "primitiveType" as const, name: "string" as const },
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "identifier",
              name: "acceptString",
              inferredType: {
                kind: "functionType",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: {
                      kind: "identifierPattern",
                      name: "value",
                    },
                    type: stringOptionalType,
                    isOptional: false,
                    isRest: false,
                    passing: "value",
                  },
                ],
                returnType: { kind: "voidType" },
              },
            },
            arguments: [{ kind: "identifier", name: "undefined" }],
            isOptional: false,
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 1,
              column: 1,
              length: 19,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("acceptString(default(string))");
  });

  it("should use local function declaration signatures when parameterTypes are absent", () => {
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
          name: "acceptString",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isAsync: false,
          isGenerator: false,
          isExported: false,
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "acceptString" },
            arguments: [{ kind: "identifier", name: "undefined" }],
            isOptional: false,
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 2,
              column: 1,
              length: 19,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("acceptString(default(string))");
  });

  it("keeps alias-backed optional function-value arguments on the concrete nullable slot", () => {
    const nextControlType = {
      kind: "unionType" as const,
      types: [
        { kind: "primitiveType" as const, name: "string" as const },
        { kind: "primitiveType" as const, name: "null" as const },
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };
    const nextControlReference = {
      kind: "referenceType" as const,
      name: "NextControl",
    };
    const nextParameterType = {
      kind: "unionType" as const,
      types: [
        nextControlReference,
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "typeAliasDeclaration",
          name: "NextControl",
          typeParameters: [],
          type: nextControlType,
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "handler",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "next" },
              type: {
                kind: "functionType",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: { kind: "identifierPattern", name: "value" },
                    type: nextParameterType,
                    isOptional: true,
                    isRest: false,
                    passing: "value",
                  },
                ],
                returnType: { kind: "voidType" },
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "next" },
                  arguments: [{ kind: "identifier", name: "undefined" }],
                  isOptional: false,
                  parameterTypes: [nextParameterType],
                  surfaceParameterTypes: [nextParameterType],
                  inferredType: { kind: "voidType" },
                  sourceSpan: {
                    file: "/src/test.ts",
                    line: 2,
                    column: 1,
                    length: 19,
                  },
                },
              },
            ],
          },
          isAsync: false,
          isGenerator: false,
          isExported: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("next(default(string?))");
    expect(result).not.to.include("next(default(object))");
  });

  it("should strip optional exact-numeric nullish wrappers for concrete arguments", () => {
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
          name: "acceptOffset",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: { kind: "primitiveType", name: "int" },
              isOptional: true,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isAsync: false,
          isGenerator: false,
          isExported: false,
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "acceptOffset" },
            arguments: [{ kind: "literal", value: 5 }],
            isOptional: false,
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 2,
              column: 1,
              length: 16,
            },
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "acceptOffset" },
            arguments: [{ kind: "identifier", name: "undefined" }],
            isOptional: false,
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 3,
              column: 1,
              length: 24,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("acceptOffset(5)");
    expect(result).to.include("acceptOffset(default(int))");
    expect(result).not.to.include(".Value");
  });

  it("preserves nullable numeric arguments when calling optional numeric parameters", () => {
    const optionalNumberType = {
      kind: "unionType" as const,
      types: [
        { kind: "primitiveType" as const, name: "number" as const },
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };

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
          name: "acceptLevel",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "level" },
              type: { kind: "primitiveType", name: "number" },
              isOptional: true,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isAsync: false,
          isGenerator: false,
          isExported: false,
        },
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "level" },
              type: optionalNumberType,
              initializer: { kind: "identifier", name: "undefined" },
            },
          ],
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "acceptLevel" },
            arguments: [
              {
                kind: "typeAssertion",
                expression: {
                  kind: "identifier",
                  name: "level",
                  inferredType: optionalNumberType,
                },
                targetType: optionalNumberType,
                inferredType: optionalNumberType,
              },
            ],
            parameterTypes: [{ kind: "primitiveType", name: "number" }],
            surfaceParameterTypes: [optionalNumberType],
            isOptional: false,
            inferredType: { kind: "voidType" },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("acceptLevel(level)");
    expect(result).not.to.include("acceptLevel((double)(object)level)");
  });

  it("preserves optional numeric property reads when forwarding into optional numeric parameters", () => {
    const optionalNumberType = {
      kind: "unionType" as const,
      types: [
        { kind: "primitiveType" as const, name: "number" as const },
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };

    const optionsType = {
      kind: "referenceType" as const,
      name: "Options",
      resolvedClrType: "MyApp.Options",
      structuralMembers: [
        {
          kind: "propertySignature" as const,
          name: "maxFileCount",
          type: optionalNumberType,
          isOptional: true,
          isReadonly: true,
        },
      ],
    };

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
          name: "acceptLevel",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "level" },
              type: { kind: "primitiveType", name: "number" },
              isOptional: true,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isAsync: false,
          isGenerator: false,
          isExported: false,
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "acceptLevel" },
            arguments: [
              {
                kind: "memberAccess",
                object: {
                  kind: "identifier",
                  name: "options",
                  inferredType: optionsType,
                },
                property: "maxFileCount",
                isComputed: false,
                isOptional: false,
                inferredType: optionalNumberType,
              },
            ],
            parameterTypes: [{ kind: "primitiveType", name: "number" }],
            surfaceParameterTypes: [optionalNumberType],
            isOptional: false,
            inferredType: { kind: "voidType" },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("acceptLevel(options.maxFileCount)");
    expect(result).not.to.include(
      "acceptLevel((double)(object)options.maxFileCount)"
    );
  });

  it("preserves optional numeric property reads inside null-guarded ternary locals", () => {
    const optionalNumberType = {
      kind: "unionType" as const,
      types: [
        { kind: "primitiveType" as const, name: "number" as const },
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };

    const optionsType = {
      kind: "referenceType" as const,
      name: "Options",
      resolvedClrType: "MyApp.Options",
      structuralMembers: [
        {
          kind: "propertySignature" as const,
          name: "level",
          type: optionalNumberType,
          isOptional: true,
          isReadonly: true,
        },
      ],
    };

    const optionalOptionsType = {
      kind: "unionType" as const,
      types: [
        optionsType,
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };

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
          name: "acceptLevel",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "level" },
              type: { kind: "primitiveType", name: "number" },
              isOptional: true,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isAsync: false,
          isGenerator: false,
          isExported: false,
        },
        {
          kind: "functionDeclaration",
          name: "main",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "variableDeclaration",
                declarationKind: "const",
                isExported: false,
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "level" },
                    initializer: {
                      kind: "conditional",
                      condition: {
                        kind: "binary",
                        operator: "!==",
                        left: {
                          kind: "identifier",
                          name: "options",
                          inferredType: optionalOptionsType,
                        },
                        right: {
                          kind: "identifier",
                          name: "undefined",
                          inferredType: {
                            kind: "primitiveType",
                            name: "undefined",
                          },
                        },
                        inferredType: { kind: "primitiveType", name: "boolean" },
                      },
                      whenTrue: {
                        kind: "memberAccess",
                        object: {
                          kind: "identifier",
                          name: "options",
                          inferredType: optionalOptionsType,
                        },
                        property: "level",
                        isComputed: false,
                        isOptional: false,
                        inferredType: optionalNumberType,
                      },
                      whenFalse: {
                        kind: "identifier",
                        name: "undefined",
                        inferredType: { kind: "primitiveType", name: "undefined" },
                      },
                      inferredType: optionalNumberType,
                    },
                  },
                ],
              },
              {
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "acceptLevel" },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "level",
                      inferredType: optionalNumberType,
                    },
                  ],
                  parameterTypes: [{ kind: "primitiveType", name: "number" }],
                  surfaceParameterTypes: [optionalNumberType],
                  isOptional: false,
                  inferredType: { kind: "voidType" },
                },
              },
            ],
          },
          isAsync: false,
          isGenerator: false,
          isExported: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "double? level = options != null ? options.level : default(double?);"
    );
    expect(result).to.include("acceptLevel(level)");
    expect(result).not.to.include(".Value.Value");
    expect(result).not.to.include("options.level.Value");
  });

  it("should emit char literals for single-character string assertions to char", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "binary",
            operator: "===",
            left: {
              kind: "typeAssertion",
              expression: { kind: "literal", value: "Q" },
              targetType: { kind: "primitiveType", name: "char" },
              inferredType: { kind: "primitiveType", name: "char" },
            },
            right: {
              kind: "literal",
              value: "Q",
              inferredType: { kind: "primitiveType", name: "char" },
            },
            inferredType: { kind: "primitiveType", name: "boolean" },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("'Q' == 'Q'");
    expect(result).not.to.include('(char)"Q"');
  });
});
