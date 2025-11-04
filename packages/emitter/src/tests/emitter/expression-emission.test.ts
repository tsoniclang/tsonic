/**
 * Tests for Expression Emission
 * Tests emission of literals, arrays, and template literals
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
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
                resolvedClrType: "Tsonic.Runtime.Math",
                resolvedAssembly: "Tsonic.Runtime",
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
    expect(result).to.include("Tsonic.Runtime.Math.sqrt");
    expect(result).to.include("using Tsonic.Runtime");
  });
});
