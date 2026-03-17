/**
 * Tests for Statement Emission
 * Tests emission of control flow statements (if, for-of)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule, type IrType } from "@tsonic/frontend";
import type { TypeMemberKind } from "../types.js";

describe("Statement Emission", () => {
  it("keeps nullable update targets writable when flow narrowing wraps the operand in assertions", () => {
    const intType: IrType = { kind: "referenceType", name: "int" };
    const nullableInt: IrType = {
      kind: "unionType",
      types: [intType, { kind: "primitiveType", name: "undefined" }],
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
          name: "bump",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "id" },
              type: nullableInt,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: intType,
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "!==",
                  left: {
                    kind: "identifier",
                    name: "id",
                    inferredType: nullableInt,
                  },
                  right: { kind: "identifier", name: "undefined" },
                  inferredType: { kind: "primitiveType", name: "boolean" },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "update",
                        operator: "++",
                        prefix: false,
                        expression: {
                          kind: "typeAssertion",
                          expression: {
                            kind: "identifier",
                            name: "id",
                            inferredType: nullableInt,
                          },
                          targetType: intType,
                          inferredType: intType,
                        },
                        inferredType: intType,
                      },
                    },
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "identifier",
                        name: "id",
                        inferredType: intType,
                      },
                    },
                  ],
                },
              },
              {
                kind: "returnStatement",
                expression: {
                  kind: "unary",
                  operator: "-",
                  expression: { kind: "literal", value: 1, raw: "1" },
                  inferredType: intType,
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
    expect(result).to.include("id++;");
    expect(result).not.to.include("id.Value++;");
  });

  it("should preserve explicit local array assertions as CLR casts with explicit local types", () => {
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
          name: "isItems",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: { kind: "referenceType", name: "object" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "boolean" },
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
                    name: { kind: "identifierPattern", name: "items" },
                    initializer: {
                      kind: "typeAssertion",
                      expression: {
                        kind: "identifier",
                        name: "value",
                        inferredType: { kind: "referenceType", name: "object" },
                      },
                      targetType: {
                        kind: "arrayType",
                        elementType: { kind: "unknownType" },
                      },
                      inferredType: {
                        kind: "arrayType",
                        elementType: { kind: "unknownType" },
                      },
                    },
                  },
                ],
              },
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: true },
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
    expect(result).to.include("object?[] items = (object?[])value;");
  });

  it("should drop method-group-only void statements without emitting discard assignments", () => {
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
          name: "main",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "unary",
                  operator: "void",
                  inferredType: { kind: "voidType" },
                  expression: {
                    kind: "memberAccess",
                    object: {
                      kind: "identifier",
                      name: "http",
                      resolvedClrType: "nodejs.Http.http",
                      resolvedAssembly: "nodejs",
                    },
                    property: "createServer",
                    isComputed: false,
                    isOptional: false,
                    inferredType: { kind: "anyType" },
                    memberBinding: {
                      kind: "method",
                      assembly: "nodejs",
                      type: "nodejs.Http.http",
                      member: "createServer",
                    },
                  },
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
    expect(result).not.to.include("_ = global::nodejs.Http.http.createServer;");
    expect(result).not.to.include("_ = global::nodejs.Http.http;");
    expect(result).not.to.include("createServer;");
  });

  it("should drop namespace-import method-group void statements without evaluating the namespace object", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "node:http",
          isLocal: false,
          isClr: false,
          resolvedClrType: "nodejs.Http.http",
          resolvedAssembly: "nodejs",
          specifiers: [{ kind: "namespace", localName: "http" }],
        },
      ],
      body: [
        {
          kind: "functionDeclaration",
          name: "main",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "unary",
                  operator: "void",
                  inferredType: { kind: "voidType" },
                  expression: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "http" },
                    property: "createServer",
                    isComputed: false,
                    isOptional: false,
                    inferredType: { kind: "anyType" },
                    memberBinding: {
                      kind: "method",
                      assembly: "nodejs",
                      type: "nodejs.Http.http",
                      member: "createServer",
                    },
                  },
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
    expect(result).not.to.include("_ = global::nodejs.Http.http;");
    expect(result).not.to.include("createServer;");
  });

  it("should preserve property reads in void statements via discard locals", () => {
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
          name: "main",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "unary",
                  operator: "void",
                  inferredType: { kind: "voidType" },
                  expression: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "process" },
                    property: "platform",
                    isComputed: false,
                    isOptional: false,
                    inferredType: { kind: "anyType" },
                    memberBinding: {
                      kind: "property",
                      assembly: "nodejs",
                      type: "nodejs.process",
                      member: "platform",
                    },
                  },
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
    expect(result).to.match(
      /var __tsonic_discard(?:__\d+)? = global::nodejs\.process\.platform;/
    );
  });

  it("should preserve identifier reads in void statements via discard locals", () => {
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
          name: "main",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "variableDeclaration",
                declarationKind: "let",
                isExported: false,
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "x" },
                    initializer: { kind: "literal", value: 1 },
                  },
                ],
              },
              {
                kind: "expressionStatement",
                expression: {
                  kind: "unary",
                  operator: "void",
                  inferredType: { kind: "voidType" },
                  expression: {
                    kind: "identifier",
                    name: "x",
                    inferredType: { kind: "primitiveType", name: "int" },
                  },
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
    expect(result).to.match(/var __tsonic_discard(?:__\d+)? = x;/);
  });

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

  it("should emit if statements", () => {
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
          name: "check",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "x" },
              type: { kind: "primitiveType", name: "number" },
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
                  kind: "binary",
                  operator: ">",
                  left: { kind: "identifier", name: "x" },
                  right: { kind: "literal", value: 0 },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "positive" },
                    },
                  ],
                },
                elseStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "literal",
                        value: "negative or zero",
                      },
                    },
                  ],
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

    // Binary comparison emits with truthiness check
    expect(result).to.include("if (x > 0");
    expect(result).to.include('return "positive"');
    expect(result).to.include("else");
    expect(result).to.include('return "negative or zero"');
  });

  it("should emit instanceof guards as declaration patterns, not synthetic text expressions", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "Widget",
          isExported: false,
          isStruct: false,
          typeParameters: [],
          implements: [],
          members: [],
        },
        {
          kind: "functionDeclaration",
          name: "isWidget",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: { kind: "referenceType", name: "object" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "boolean" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "instanceof",
                  left: {
                    kind: "identifier",
                    name: "value",
                    inferredType: { kind: "referenceType", name: "object" },
                  },
                  right: {
                    kind: "identifier",
                    name: "Widget",
                    inferredType: { kind: "referenceType", name: "Widget" },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: true },
                    },
                  ],
                },
                elseStatement: undefined,
              },
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: false },
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

    expect(result).to.include("if (value is Widget value__is_1)");
    expect(result).to.include("return true;");
    expect(result).to.include("return false;");
  });

  it("normalizes JS constructor reference types in instanceof guards to instance types", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "Uint8Array",
          isExported: false,
          isStruct: false,
          typeParameters: [],
          implements: [],
          members: [],
        },
        {
          kind: "functionDeclaration",
          name: "isBytes",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "referenceType", name: "Uint8Array" },
                ],
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "boolean" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "instanceof",
                  left: {
                    kind: "identifier",
                    name: "value",
                    inferredType: {
                      kind: "unionType",
                      types: [
                        { kind: "primitiveType", name: "string" },
                        { kind: "referenceType", name: "Uint8Array" },
                      ],
                    },
                  },
                  right: {
                    kind: "identifier",
                    name: "Uint8Array",
                    inferredType: {
                      kind: "referenceType",
                      name: "Uint8ArrayConstructor",
                      resolvedClrType: "Tsonic.JSRuntime.Uint8Array",
                    },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: true },
                    },
                  ],
                },
                elseStatement: undefined,
              },
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: false },
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

    expect(result).to.include("if (value.Is2())");
    expect(result).to.include(
      "Uint8Array value__is_1 = (Uint8Array)value.As2();"
    );
    expect(result).to.not.include("Uint8ArrayConstructor");
  });

  it("narrows discriminated unions on truthy/falsy property guards", () => {
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
                      kind: "identifier",
                      name: "result",
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
  });

  it("narrows `in`-guards for cross-module union members via the type member index", () => {
    const typeMemberIndex = new Map<string, Map<string, TypeMemberKind>>([
      [
        "MyApp.Models.OkEvents",
        new Map<string, TypeMemberKind>([["events", "property"]]),
      ],
      [
        "MyApp.Models.ErrEvents",
        new Map<string, TypeMemberKind>([["error", "property"]]),
      ],
    ]);

    const unionReference: IrType = {
      kind: "referenceType",
      name: "Union_2",
      resolvedClrType: "global::Tsonic.Runtime.Union_2",
      typeArguments: [
        { kind: "referenceType", name: "MyApp.Models.OkEvents" },
        { kind: "referenceType", name: "MyApp.Models.ErrEvents" },
      ],
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
          kind: "functionDeclaration",
          name: "handle",
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
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "in",
                  inferredType: { kind: "primitiveType", name: "boolean" },
                  left: { kind: "literal", value: "error" },
                  right: {
                    kind: "identifier",
                    name: "result",
                    inferredType: unionWrapper,
                  },
                },
                thenStatement: { kind: "blockStatement", statements: [] },
                elseStatement: undefined,
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

    const result = emitModule(module, { typeMemberIndex });

    expect(result).to.include("if (result.Is1())");
  });

  it("preserves renamed union narrowing through nullish property comparisons", () => {
    const okType: IrType = { kind: "referenceType", name: "OkEvents" };
    const errType: IrType = { kind: "referenceType", name: "ErrEvents" };
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
          name: "OkEvents",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "events",
              type: {
                kind: "arrayType",
                elementType: { kind: "primitiveType", name: "string" },
              },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "ErrEvents",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "error",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "code",
              type: { kind: "primitiveType", name: "string" },
              isOptional: true,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "readEvents",
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
                  kind: "binary",
                  operator: "in",
                  left: { kind: "literal", value: "error" },
                  right: {
                    kind: "identifier",
                    name: "result",
                    inferredType: unionWrapper,
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "conditional",
                        condition: {
                          kind: "binary",
                          operator: "===",
                          left: {
                            kind: "memberAccess",
                            object: {
                              kind: "identifier",
                              name: "result",
                              inferredType: errType,
                            },
                            property: "code",
                            isComputed: false,
                            isOptional: false,
                            inferredType: {
                              kind: "unionType",
                              types: [
                                { kind: "primitiveType", name: "string" },
                                { kind: "primitiveType", name: "undefined" },
                              ],
                            },
                          },
                          right: { kind: "identifier", name: "undefined" },
                        },
                        whenTrue: {
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
                        whenFalse: {
                          kind: "binary",
                          operator: "+",
                          left: {
                            kind: "binary",
                            operator: "+",
                            left: {
                              kind: "memberAccess",
                              object: {
                                kind: "identifier",
                                name: "result",
                                inferredType: errType,
                              },
                              property: "code",
                              isComputed: false,
                              isOptional: false,
                              inferredType: {
                                kind: "unionType",
                                types: [
                                  { kind: "primitiveType", name: "string" },
                                  { kind: "primitiveType", name: "undefined" },
                                ],
                              },
                            },
                            right: { kind: "literal", value: ":" },
                          },
                          right: {
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
                      },
                    },
                  ],
                },
              },
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: "" },
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

    expect(result).to.include("if (result.Is1())");
    expect(result).to.include(
      'return result__1_1.code == null ? result__1_1.error : result__1_1.code + ":" + result__1_1.error;'
    );
    expect(result).to.not.include("return result.code == null");
  });

  it("casts runtime unions to object for direct nullish comparisons", () => {
    const valueType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        {
          kind: "functionType",
          parameters: [],
          returnType: { kind: "voidType" },
        },
        { kind: "primitiveType", name: "undefined" },
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
          name: "check",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: valueType,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "boolean" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "binary",
                  operator: "==",
                  left: {
                    kind: "identifier",
                    name: "value",
                    inferredType: valueType,
                  },
                  right: { kind: "literal", value: undefined },
                  inferredType: { kind: "primitiveType", name: "boolean" },
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

    expect(result).to.include("((global::System.Object)(value)) == null");
    expect(result).to.not.include("value == null");
  });

  it("handles `in` guards after earlier narrowing collapses a union to one member", () => {
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
          members: [
            {
              kind: "propertySignature",
              name: "a",
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
          name: "Shape__1",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "b",
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__2",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "c",
              type: { kind: "primitiveType", name: "boolean" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "typeAliasDeclaration",
          name: "Shape",
          typeParameters: [],
          type: {
            kind: "unionType",
            types: [
              { kind: "referenceType", name: "Shape__0" },
              { kind: "referenceType", name: "Shape__1" },
              { kind: "referenceType", name: "Shape__2" },
            ],
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
                  kind: "binary",
                  operator: "in",
                  left: { kind: "literal", value: "a", raw: '"a"' },
                  right: {
                    kind: "identifier",
                    name: "s",
                    inferredType: { kind: "referenceType", name: "Shape" },
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
                  kind: "binary",
                  operator: "in",
                  left: { kind: "literal", value: "b", raw: '"b"' },
                  right: {
                    kind: "identifier",
                    name: "s",
                    inferredType: {
                      kind: "unionType",
                      types: [
                        { kind: "referenceType", name: "Shape__1" },
                        { kind: "referenceType", name: "Shape__2" },
                      ],
                    },
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
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "in",
                  left: { kind: "literal", value: "c", raw: '"c"' },
                  right: {
                    kind: "identifier",
                    name: "s",
                    inferredType: { kind: "referenceType", name: "Shape__2" },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "C" },
                    },
                  ],
                },
              },
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: "unreachable" },
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

    expect(result).to.include("if (s.Is1())");
    expect(result).to.include("if (s.Is2())");
    expect(result).to.include("if (true)");
  });

  it("maps discriminant guards to original runtime union members after earlier narrowing", () => {
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
          members: [
            {
              kind: "propertySignature",
              name: "kind",
              type: { kind: "literalType", value: "a" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__1",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "kind",
              type: { kind: "literalType", value: "b" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__2",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "kind",
              type: { kind: "literalType", value: "c" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "typeAliasDeclaration",
          name: "Shape",
          typeParameters: [],
          type: {
            kind: "unionType",
            types: [
              { kind: "referenceType", name: "Shape__0" },
              { kind: "referenceType", name: "Shape__1" },
              { kind: "referenceType", name: "Shape__2" },
            ],
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
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "memberAccess",
                    object: {
                      kind: "identifier",
                      name: "s",
                      inferredType: { kind: "referenceType", name: "Shape" },
                    },
                    property: "kind",
                    isComputed: false,
                    isOptional: false,
                  },
                  right: { kind: "literal", value: "a", raw: '"a"' },
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
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "memberAccess",
                    object: {
                      kind: "identifier",
                      name: "s",
                      inferredType: {
                        kind: "unionType",
                        types: [
                          { kind: "referenceType", name: "Shape__1" },
                          { kind: "referenceType", name: "Shape__2" },
                        ],
                      },
                    },
                    property: "kind",
                    isComputed: false,
                    isOptional: false,
                  },
                  right: { kind: "literal", value: "b", raw: '"b"' },
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
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "memberAccess",
                    object: {
                      kind: "identifier",
                      name: "s",
                      inferredType: { kind: "referenceType", name: "Shape__2" },
                    },
                    property: "kind",
                    isComputed: false,
                    isOptional: false,
                  },
                  right: { kind: "literal", value: "c", raw: '"c"' },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "C" },
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

    expect(result).to.include("if (s.Is1())");
    expect(result).to.include("if (s.Is2())");
    expect(result).to.include('if ((s.As3()).kind == "c")');
  });

  it("maps `in`-guards to original runtime union members after earlier narrowing through transparent assertions", () => {
    const shape0: IrType = { kind: "referenceType", name: "Shape__0" };
    const shape1: IrType = { kind: "referenceType", name: "Shape__1" };
    const shape2: IrType = { kind: "referenceType", name: "Shape__2" };

    const narrowed12: IrType = {
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
          members: [
            {
              kind: "propertySignature",
              name: "a",
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
          name: "Shape__1",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "b",
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__2",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "c",
              type: { kind: "primitiveType", name: "boolean" },
              isOptional: false,
              isReadonly: false,
            },
          ],
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
                  kind: "binary",
                  operator: "in",
                  left: { kind: "literal", value: "a", raw: '"a"' },
                  right: {
                    kind: "identifier",
                    name: "s",
                    inferredType: { kind: "referenceType", name: "Shape" },
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
                  kind: "binary",
                  operator: "in",
                  left: { kind: "literal", value: "b", raw: '"b"' },
                  right: {
                    kind: "typeAssertion",
                    expression: {
                      kind: "identifier",
                      name: "s",
                      inferredType: narrowed12,
                    },
                    targetType: narrowed12,
                    inferredType: narrowed12,
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
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "in",
                  left: { kind: "literal", value: "c", raw: '"c"' },
                  right: {
                    kind: "typeAssertion",
                    expression: {
                      kind: "identifier",
                      name: "s",
                      inferredType: { kind: "referenceType", name: "Shape__2" },
                    },
                    targetType: { kind: "referenceType", name: "Shape__2" },
                    inferredType: { kind: "referenceType", name: "Shape__2" },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "C" },
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

    expect(result).to.include("if (s.Is1())");
    expect(result).to.include("if (s.Is2())");
    expect(result).to.include("if (true)");
    expect(result).to.not.include("s.Match(");
  });

  it("maps discriminant guards through transparent assertion wrappers after earlier narrowing", () => {
    const shape0: IrType = { kind: "referenceType", name: "Shape__0" };
    const shape1: IrType = { kind: "referenceType", name: "Shape__1" };
    const shape2: IrType = { kind: "referenceType", name: "Shape__2" };

    const narrowed12: IrType = {
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
          members: [
            {
              kind: "propertySignature",
              name: "kind",
              type: { kind: "literalType", value: "a" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__1",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "kind",
              type: { kind: "literalType", value: "b" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__2",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "kind",
              type: { kind: "literalType", value: "c" },
              isOptional: false,
              isReadonly: false,
            },
          ],
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
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "memberAccess",
                    object: {
                      kind: "identifier",
                      name: "s",
                      inferredType: { kind: "referenceType", name: "Shape" },
                    },
                    property: "kind",
                    isComputed: false,
                    isOptional: false,
                  },
                  right: { kind: "literal", value: "a", raw: '"a"' },
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
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "memberAccess",
                    object: {
                      kind: "typeAssertion",
                      expression: {
                        kind: "identifier",
                        name: "s",
                        inferredType: narrowed12,
                      },
                      targetType: narrowed12,
                      inferredType: narrowed12,
                    },
                    property: "kind",
                    isComputed: false,
                    isOptional: false,
                  },
                  right: { kind: "literal", value: "b", raw: '"b"' },
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
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "memberAccess",
                    object: {
                      kind: "typeAssertion",
                      expression: {
                        kind: "identifier",
                        name: "s",
                        inferredType: {
                          kind: "referenceType",
                          name: "Shape__2",
                        },
                      },
                      targetType: { kind: "referenceType", name: "Shape__2" },
                      inferredType: { kind: "referenceType", name: "Shape__2" },
                    },
                    property: "kind",
                    isComputed: false,
                    isOptional: false,
                  },
                  right: { kind: "literal", value: "c", raw: '"c"' },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "C" },
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

    expect(result).to.include("if (s.Is1())");
    expect(result).to.include("if (s.Is2())");
    expect(result).to.include('if ((s.As3()).kind == "c")');
    expect(result).to.not.include("s.Match(");
  });

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

    expect(result).to.include("if (s.Is1())");
    expect(result).to.include("if (s.Is2())");
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
    expect(result).to.not.include("result.Match(");
  });

  it("should emit canonical for loops with int counter and no cast", () => {
    // Test: for (let i = 0; i < list.Count; i++) { list[i] }
    // Should emit: for (int i = 0; ...) { list[i] } - NO (int) cast
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
          name: "process",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "items" },
              type: {
                kind: "referenceType",
                name: "List",
                resolvedClrType: "global::System.Collections.Generic.List",
                typeArguments: [{ kind: "primitiveType", name: "number" }],
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
                kind: "forStatement",
                initializer: {
                  kind: "variableDeclaration",
                  declarationKind: "let",
                  declarations: [
                    {
                      kind: "variableDeclarator",
                      name: { kind: "identifierPattern", name: "i" },
                      initializer: { kind: "literal", value: 0 },
                    },
                  ],
                  isExported: false,
                },
                condition: {
                  kind: "binary",
                  operator: "<",
                  left: { kind: "identifier", name: "i" },
                  right: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "items" },
                    property: "Count",
                    isComputed: false,
                    isOptional: false,
                  },
                },
                update: {
                  kind: "update",
                  operator: "++",
                  prefix: false,
                  expression: { kind: "identifier", name: "i" },
                },
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "call",
                        callee: {
                          kind: "memberAccess",
                          object: { kind: "identifier", name: "console" },
                          property: "log",
                          isComputed: false,
                          isOptional: false,
                        },
                        arguments: [
                          {
                            kind: "memberAccess",
                            object: { kind: "identifier", name: "items" },
                            property: {
                              kind: "identifier",
                              name: "i",
                              // Proof marker: loop counter is int
                              inferredType: {
                                kind: "primitiveType",
                                name: "int",
                              },
                            },
                            isComputed: true,
                            isOptional: false,
                            accessKind: "clrIndexer",
                          },
                        ],
                        isOptional: false,
                      },
                    },
                  ],
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

    // Canonical loop: int i = 0 (not var i = 0.0)
    expect(result).to.include("for (int i = 0;");
    // CLR indexer without cast: items[i] (not items[(int)(i)])
    expect(result).to.include("items[i]");
    // Must NOT contain the redundant cast
    expect(result).to.not.include("[(int)");
  });

  it("should emit for loops", () => {
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
          name: "loop",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "forOfStatement",
                variable: { kind: "identifierPattern", name: "item" },
                expression: { kind: "identifier", name: "items" },
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "call",
                        callee: {
                          kind: "memberAccess",
                          object: {
                            kind: "identifier",
                            name: "Console",
                            resolvedClrType: "System.Console",
                          },
                          property: "WriteLine",
                          isComputed: false,
                          isOptional: false,
                        },
                        arguments: [{ kind: "identifier", name: "item" }],
                        isOptional: false,
                      },
                    },
                  ],
                },
                isAwait: false,
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

    expect(result).to.include("foreach (var item in items)");
    // Uses fully-qualified name with global:: prefix
    expect(result).to.include("global::System.Console.WriteLine(item)");
  });

  it("should emit 'await foreach' when isAwait=true", () => {
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
          name: "processAsync",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "items" },
              type: {
                kind: "referenceType",
                name: "IAsyncEnumerable",
                resolvedClrType: "System.Collections.Generic.IAsyncEnumerable",
                typeArguments: [{ kind: "primitiveType", name: "string" }],
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: {
            kind: "referenceType",
            name: "Task",
            resolvedClrType: "System.Threading.Tasks.Task",
            typeArguments: [],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "forOfStatement",
                variable: { kind: "identifierPattern", name: "item" },
                expression: { kind: "identifier", name: "items" },
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "call",
                        callee: {
                          kind: "memberAccess",
                          object: { kind: "identifier", name: "console" },
                          property: "log",
                          isComputed: false,
                          isOptional: false,
                        },
                        arguments: [{ kind: "identifier", name: "item" }],
                        isOptional: false,
                      },
                    },
                  ],
                },
                isAwait: true,
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

    // Should emit 'await foreach' for async iteration
    expect(result).to.include("await foreach (var item in items)");
    // Should NOT include regular 'foreach' (without await)
    expect(result).to.not.match(/[^t]\sforeach\s/);
  });

  it("should emit regular 'foreach' when isAwait=false", () => {
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
          name: "processSync",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "items" },
              type: {
                kind: "referenceType",
                name: "IEnumerable",
                resolvedClrType: "System.Collections.Generic.IEnumerable",
                typeArguments: [{ kind: "primitiveType", name: "string" }],
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
                kind: "forOfStatement",
                variable: { kind: "identifierPattern", name: "item" },
                expression: { kind: "identifier", name: "items" },
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "call",
                        callee: {
                          kind: "memberAccess",
                          object: { kind: "identifier", name: "console" },
                          property: "log",
                          isComputed: false,
                          isOptional: false,
                        },
                        arguments: [{ kind: "identifier", name: "item" }],
                        isOptional: false,
                      },
                    },
                  ],
                },
                isAwait: false,
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

    // Should emit regular 'foreach' for sync iteration
    expect(result).to.include("foreach (var item in items)");
    // Should NOT include 'await foreach'
    expect(result).to.not.include("await foreach");
  });

  it("does not leak outer localSemanticTypes/localValueTypes into inner block scope for shadowed variables", () => {
    // TS: function test() {
    //   const x: string | number = "hello";
    //   {
    //     const x: boolean = true;
    //     console.log(x);
    //   }
    //   console.log(x);
    // }
    //
    // The inner `x: boolean` must not inherit the outer `x: string | number`
    // in either semantic or storage channels.
    const stringOrNumber: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
      ],
    };
    const boolType: IrType = { kind: "primitiveType", name: "boolean" };
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
          name: "test",
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
                    name: { kind: "identifierPattern", name: "x" },
                    type: stringOrNumber,
                    initializer: {
                      kind: "literal",
                      value: "hello",
                      raw: '"hello"',
                      inferredType: { kind: "primitiveType", name: "string" },
                    },
                  },
                ],
              },
              {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "variableDeclaration",
                    declarationKind: "const",
                    isExported: false,
                    declarations: [
                      {
                        kind: "variableDeclarator",
                        name: { kind: "identifierPattern", name: "x" },
                        type: boolType,
                        initializer: {
                          kind: "literal",
                          value: true,
                          raw: "true",
                          inferredType: boolType,
                        },
                      },
                    ],
                  },
                ],
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
    // Inner block must declare a bool-typed x (shadowed, renamed to x__1)
    expect(result).to.include("bool");
    // Must also have the outer union-typed x — emitted output should have both declarations
    // The key invariant: the inner bool declaration must not be widened to the outer union type
    expect(result).not.to.match(/bool.*x__1.*object/);
  });
});
