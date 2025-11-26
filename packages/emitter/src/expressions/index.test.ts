/**
 * Tests for Expression Emission
 * Tests emission of literals, arrays, and template literals
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule } from "@tsonic/frontend";

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
    expect(result).to.include("42"); // C# handles implicit conversion
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

    expect(result).to.include("new List<");
    expect(result).to.include("1, 2, 3"); // C# handles implicit conversion
    expect(result).to.include("using System.Collections.Generic");
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

  it("should use csharpName for identifiers when provided", () => {
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
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "console",
                resolvedClrType: "System.Console",
                resolvedAssembly: "System",
                csharpName: "Console", // Custom C# name
              },
              property: "log",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: "Hello with csharpName" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should use "Console" (from csharpName) not "System.Console" (from resolvedClrType)
    expect(result).to.include("Console.log");
    expect(result).not.to.include("System.Console.log");
    expect(result).to.include("using System");
  });

  it("should use resolvedClrType when csharpName is not provided", () => {
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
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "Math",
                resolvedClrType: "Tsonic.JSRuntime.Math",
                resolvedAssembly: "Tsonic.JSRuntime",
                // No csharpName specified
              },
              property: "sqrt",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: 16 }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should use full type name when no csharpName
    expect(result).to.include("Tsonic.JSRuntime.Math.sqrt");
    expect(result).to.include("using Tsonic.JSRuntime");
  });

  it("should emit hierarchical member bindings correctly", () => {
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
              kind: "memberAccess",
              object: {
                kind: "memberAccess",
                object: { kind: "identifier", name: "systemLinq" },
                property: "enumerable",
                isComputed: false,
                isOptional: false,
              },
              property: "selectMany",
              isComputed: false,
              isOptional: false,
              // Hierarchical member binding from manifest
              memberBinding: {
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "SelectMany",
              },
            },
            arguments: [
              { kind: "array", elements: [{ kind: "literal", value: 1 }] },
            ],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should emit full CLR type and member from binding
    expect(result).to.include("System.Linq.Enumerable.SelectMany");
    expect(result).to.include("using System.Linq");
  });

  it("should emit hierarchical member bindings without emitting intermediate objects", () => {
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
              name: { kind: "identifierPattern", name: "result" },
              initializer: {
                kind: "call",
                callee: {
                  kind: "memberAccess",
                  object: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "myLib" },
                    property: "math",
                    isComputed: false,
                    isOptional: false,
                  },
                  property: "add",
                  isComputed: false,
                  isOptional: false,
                  memberBinding: {
                    assembly: "MyLib",
                    type: "MyLib.Math",
                    member: "Add",
                  },
                },
                arguments: [
                  { kind: "literal", value: 1 },
                  { kind: "literal", value: 2 },
                ],
                isOptional: false,
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should emit MyLib.Math.Add directly
    expect(result).to.include("MyLib.Math.Add");
    // Should NOT include myLib.math (intermediate objects shouldn't appear)
    expect(result).not.to.include("myLib.math");
    expect(result).to.include("using MyLib");
  });

  it("should handle member access without binding (regular property access)", () => {
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
            kind: "memberAccess",
            object: { kind: "identifier", name: "obj" },
            property: "property",
            isComputed: false,
            isOptional: false,
            // No memberBinding - regular property access
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should emit regular property access
    expect(result).to.include("obj.property");
  });
});
