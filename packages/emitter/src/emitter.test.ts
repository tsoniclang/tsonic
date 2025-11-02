/**
 * Tests for C# Emitter
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("C# Emitter", () => {
  describe("Module Generation", () => {
    it("should emit a static container class", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/math.ts",
        namespace: "MyApp",
        className: "math",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "PI" },
                initializer: { kind: "literal", value: 3.14159 },
              },
            ],
            isExported: true,
          },
          {
            kind: "functionDeclaration",
            name: "add",
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "a" },
                type: { kind: "primitiveType", name: "number" },
                isOptional: false,
                isRest: false,
              },
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "b" },
                type: { kind: "primitiveType", name: "number" },
                isOptional: false,
                isRest: false,
              },
            ],
            returnType: { kind: "primitiveType", name: "number" },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: {
                    kind: "binary",
                    operator: "+",
                    left: { kind: "identifier", name: "a" },
                    right: { kind: "identifier", name: "b" },
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

      expect(result).to.include("public static class math");
      expect(result).to.include("var PI = 3.14159");
      expect(result).to.include("public static double add(double a, double b)");
      expect(result).to.include("return a + b");
      expect(result).to.include("namespace MyApp");
    });

    it("should emit a regular class", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/User.ts",
        namespace: "MyApp",
        className: "User",
        isStaticContainer: false,
        imports: [],
        body: [
          {
            kind: "classDeclaration",
            name: "User",
            members: [
              {
                kind: "propertyDeclaration",
                name: "name",
                type: { kind: "primitiveType", name: "string" },
                accessibility: "public",
                isStatic: false,
                isReadonly: false,
              },
              {
                kind: "methodDeclaration",
                name: "greet",
                parameters: [],
                returnType: { kind: "primitiveType", name: "string" },
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "templateLiteral",
                        quasis: ["Hello, I'm ", ""],
                        expressions: [
                          {
                            kind: "memberAccess",
                            object: { kind: "this" },
                            property: "name",
                            isComputed: false,
                            isOptional: false,
                          },
                        ],
                      },
                    },
                  ],
                },
                accessibility: "public",
                isStatic: false,
                isAsync: false,
                isGenerator: false,
              },
            ],
            isExported: true,
            implements: [],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("public class User");
      expect(result).to.include("public string name;");
      expect(result).to.include("public string greet()");
      expect(result).to.include('$"Hello, I\'m {this.name}"');
    });
  });

  describe("Expression Emission", () => {
    it("should emit literals correctly", () => {
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
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "str" },
                initializer: { kind: "literal", value: "hello" },
              },
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "num" },
                initializer: { kind: "literal", value: 42 },
              },
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "bool" },
                initializer: { kind: "literal", value: true },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include('"hello"');
      expect(result).to.include("42.0");
      expect(result).to.include("true");
    });

    it("should emit array expressions", () => {
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
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "arr" },
                initializer: {
                  kind: "array",
                  elements: [
                    { kind: "literal", value: 1 },
                    { kind: "literal", value: 2 },
                    { kind: "literal", value: 3 },
                  ],
                },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("new Tsonic.Runtime.Array");
      expect(result).to.include("1.0, 2.0, 3.0");
      expect(result).to.include("using Tsonic.Runtime");
    });

    it("should emit template literals", () => {
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
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "greeting" },
                initializer: {
                  kind: "templateLiteral",
                  quasis: ["Hello ", "!"],
                  expressions: [{ kind: "identifier", name: "name" }],
                },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include('$"Hello {name}!"');
    });
  });

  describe("Statement Emission", () => {
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

      expect(result).to.include("if (x > 0.0)");
      expect(result).to.include('return "positive"');
      expect(result).to.include("else");
      expect(result).to.include('return "negative or zero"');
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
      expect(result).to.include("Tsonic.Runtime.console.log(item)");
      expect(result).to.include("using Tsonic.Runtime");
    });
  });

  describe("Type Emission", () => {
    it("should emit primitive types correctly", () => {
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
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "a" },
                type: { kind: "primitiveType", name: "string" },
                isOptional: false,
                isRest: false,
              },
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "b" },
                type: { kind: "primitiveType", name: "number" },
                isOptional: false,
                isRest: false,
              },
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "c" },
                type: { kind: "primitiveType", name: "boolean" },
                isOptional: false,
                isRest: false,
              },
            ],
            returnType: { kind: "voidType" },
            body: { kind: "blockStatement", statements: [] },
            isExported: true,
            isAsync: false,
            isGenerator: false,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("string a");
      expect(result).to.include("double b");
      expect(result).to.include("bool c");
    });

    it("should emit async functions with Task types", () => {
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
            name: "fetchData",
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
                    kind: "await",
                    expression: {
                      kind: "call",
                      callee: { kind: "identifier", name: "getData" },
                      arguments: [],
                      isOptional: false,
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

      expect(result).to.include("public static async Task<string> fetchData()");
      expect(result).to.include("await getData()");
      expect(result).to.include("using System.Threading.Tasks");
    });
  });

  describe("Import Handling", () => {
    it("should handle .NET imports", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "MyApp",
        className: "test",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "System.IO",
            isLocal: false,
            isDotNet: true,
            specifiers: [],
            resolvedNamespace: "System.IO",
          },
          {
            kind: "import",
            source: "System.Text.Json",
            isLocal: false,
            isDotNet: true,
            specifiers: [],
            resolvedNamespace: "System.Text.Json",
          },
        ],
        body: [],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("using System.IO");
      expect(result).to.include("using System.Text.Json");
    });

    it("should handle local imports", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/services/api.ts",
        namespace: "MyApp.services",
        className: "api",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "./auth.ts",
            isLocal: true,
            isDotNet: false,
            specifiers: [],
          },
          {
            kind: "import",
            source: "../models/User.ts",
            isLocal: true,
            isDotNet: false,
            specifiers: [],
          },
        ],
        body: [],
        exports: [],
      };

      const result = emitModule(module, { rootNamespace: "MyApp" });

      expect(result).to.include("using MyApp.services");
      expect(result).to.include("using MyApp.models");
    });
  });
});
