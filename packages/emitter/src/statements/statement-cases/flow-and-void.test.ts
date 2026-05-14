import {
  describe,
  it,
  expect,
  emitModule,
  testIfStatement,
} from "./helpers.js";
import type { IrModule, IrType } from "./helpers.js";
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
              testIfStatement({
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
              }),
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
                        elementType: {
                          kind: "referenceType",
                          name: "object",
                          resolvedClrType: "System.Object",
                        },
                      },
                      inferredType: {
                        kind: "arrayType",
                        elementType: {
                          kind: "referenceType",
                          name: "object",
                          resolvedClrType: "System.Object",
                        },
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
    expect(result).to.include("object[] items = (object[])value;");
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
});
