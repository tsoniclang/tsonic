import { describe, it, expect, emitModule } from "./helpers.js";
import type { IrModule, IrType } from "./helpers.js";
describe("Statement Emission", () => {
  it("maps predicate guards to original runtime union members after earlier narrowing", () => {
    const shape0: IrType = { kind: "referenceType", name: "Shape__0" };
    const shape1: IrType = { kind: "referenceType", name: "Shape__1" };
    const shape2: IrType = { kind: "referenceType", name: "Shape__2" };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "interfaceDeclaration",
          name: "Shape__0",
          typeParameters: [],
          extends: [],
          members: [],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__1",
          typeParameters: [],
          extends: [],
          members: [],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__2",
          typeParameters: [],
          extends: [],
          members: [],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "typeAliasDeclaration",
          name: "Shape",
          typeParameters: [],
          type: {
            kind: "unionType",
            types: [shape0, shape1, shape2],
          },
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "fmt",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "s" },
              type: { kind: "referenceType", name: "Shape" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "string" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "ifStatement",
                condition: {
                  kind: "call",
                  callee: { kind: "identifier", name: "isA" },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "s",
                      inferredType: { kind: "referenceType", name: "Shape" },
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "boolean" },
                  narrowing: {
                    kind: "typePredicate",
                    argIndex: 0,
                    targetType: shape0,
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "A" },
                    },
                  ],
                },
              },
              {
                kind: "ifStatement",
                condition: {
                  kind: "call",
                  callee: { kind: "identifier", name: "isB" },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "s",
                      inferredType: {
                        kind: "unionType",
                        types: [shape1, shape2],
                      },
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "boolean" },
                  narrowing: {
                    kind: "typePredicate",
                    argIndex: 0,
                    targetType: shape1,
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "B" },
                    },
                  ],
                },
              },
            ],
          },
          isExported: false,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("if (isA(s))");
    expect(result).to.include("if (isB(s.Match");
    expect(result).to.not.include("if (s.Is1())");
    expect(result).to.not.include("if (s.Is2())");
  });

  it("uses the raw carrier for predicate guards wrapped in transparent subset assertions", () => {
    const shape0: IrType = { kind: "referenceType", name: "Shape__0" };
    const shape1: IrType = { kind: "referenceType", name: "Shape__1" };
    const shape2: IrType = { kind: "referenceType", name: "Shape__2" };
    const fullUnion: IrType = {
      kind: "unionType",
      types: [shape0, shape1, shape2],
    };
    const narrowedUnion: IrType = {
      kind: "unionType",
      types: [shape1, shape2],
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
          kind: "interfaceDeclaration",
          name: "Shape__0",
          typeParameters: [],
          extends: [],
          members: [],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__1",
          typeParameters: [],
          extends: [],
          members: [],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__2",
          typeParameters: [],
          extends: [],
          members: [],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "fmt",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "s" },
              type: fullUnion,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "string" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "ifStatement",
                condition: {
                  kind: "call",
                  callee: { kind: "identifier", name: "isA" },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "s",
                      inferredType: fullUnion,
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "boolean" },
                  narrowing: {
                    kind: "typePredicate",
                    argIndex: 0,
                    targetType: shape0,
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "A" },
                    },
                  ],
                },
              },
              {
                kind: "ifStatement",
                condition: {
                  kind: "call",
                  callee: { kind: "identifier", name: "isB" },
                  arguments: [
                    {
                      kind: "typeAssertion",
                      expression: {
                        kind: "identifier",
                        name: "s",
                        inferredType: fullUnion,
                      },
                      targetType: narrowedUnion,
                      inferredType: narrowedUnion,
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "boolean" },
                  narrowing: {
                    kind: "typePredicate",
                    argIndex: 0,
                    targetType: shape1,
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "B" },
                    },
                  ],
                },
              },
            ],
          },
          isExported: false,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("if (isB(s.Match");
    expect(result).to.not.include("if (s.Is2())");
    expect(result).to.not.include("As2()).Is2()");
  });

  it("reuses the original carrier slots when a later predicate narrows an earlier subset to one member", () => {
    const shape0: IrType = { kind: "referenceType", name: "Shape__0" };
    const shape1: IrType = { kind: "referenceType", name: "Shape__1" };
    const shape2: IrType = { kind: "referenceType", name: "Shape__2" };
    const fullUnion: IrType = {
      kind: "unionType",
      types: [shape0, shape1, shape2],
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
          kind: "interfaceDeclaration",
          name: "Shape__0",
          typeParameters: [],
          extends: [],
          members: [],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__1",
          typeParameters: [],
          extends: [],
          members: [],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__2",
          typeParameters: [],
          extends: [],
          members: [],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "takeC",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: shape2,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "string" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: "C" },
              },
            ],
          },
          isExported: false,
          isAsync: false,
          isGenerator: false,
        },
        {
          kind: "functionDeclaration",
          name: "fmt",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "s" },
              type: fullUnion,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "string" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "ifStatement",
                condition: {
                  kind: "call",
                  callee: { kind: "identifier", name: "isA" },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "s",
                      inferredType: fullUnion,
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "boolean" },
                  narrowing: {
                    kind: "typePredicate",
                    argIndex: 0,
                    targetType: shape0,
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "A" },
                    },
                  ],
                },
              },
              {
                kind: "ifStatement",
                condition: {
                  kind: "call",
                  callee: { kind: "identifier", name: "isB" },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "s",
                      inferredType: {
                        kind: "unionType",
                        types: [shape1, shape2],
                      },
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "boolean" },
                  narrowing: {
                    kind: "typePredicate",
                    argIndex: 0,
                    targetType: shape1,
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "B" },
                    },
                  ],
                },
              },
              {
                kind: "returnStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "takeC" },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "s",
                      inferredType: shape2,
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "string" },
                },
              },
            ],
          },
          isExported: false,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("return takeC((Shape__2)(s.As3()));");
    expect(result).to.not.include("return takeC((Shape__2)(s.Match");
  });

  it("narrows truthy/falsy property guards through transparent assertion wrappers", () => {
    const okType: IrType = { kind: "referenceType", name: "Ok" };
    const errType: IrType = { kind: "referenceType", name: "Err" };
    const unionReference: IrType = {
      kind: "referenceType",
      name: "Union_2",
      resolvedClrType: "global::Tsonic.Runtime.Union_2",
      typeArguments: [okType, errType],
    };
    const unionWrapper: IrType = {
      kind: "intersectionType",
      types: [unionReference, { kind: "referenceType", name: "__Union$views" }],
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
          kind: "interfaceDeclaration",
          name: "Ok",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "success",
              type: { kind: "literalType", value: true },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "data",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Err",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "success",
              type: { kind: "literalType", value: false },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "error",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "readResult",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "result" },
              type: unionWrapper,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "string" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "ifStatement",
                condition: {
                  kind: "unary",
                  operator: "!",
                  expression: {
                    kind: "memberAccess",
                    object: {
                      kind: "typeAssertion",
                      expression: {
                        kind: "identifier",
                        name: "result",
                        inferredType: unionWrapper,
                      },
                      targetType: unionWrapper,
                      inferredType: unionWrapper,
                    },
                    property: "success",
                    isComputed: false,
                    isOptional: false,
                    inferredType: { kind: "literalType", value: true },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "memberAccess",
                        object: {
                          kind: "identifier",
                          name: "result",
                          inferredType: errType,
                        },
                        property: "error",
                        isComputed: false,
                        isOptional: false,
                      },
                    },
                  ],
                },
              },
              {
                kind: "returnStatement",
                expression: {
                  kind: "memberAccess",
                  object: {
                    kind: "identifier",
                    name: "result",
                    inferredType: okType,
                  },
                  property: "data",
                  isComputed: false,
                  isOptional: false,
                },
              },
            ],
          },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("if (result.Is2())");
    expect(result).to.include("return result__2_1.error;");
    expect(result).to.include("return (result.As1()).data;");
    expect(result).to.not.include("result.Match");
  });
});
