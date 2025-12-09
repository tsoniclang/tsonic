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

    expect(result).to.include("new global::System.Collections.Generic.List<");
    expect(result).to.include("1.0, 2.0, 3.0"); // TypeScript number maps to C# double
    // No using statements - uses global:: FQN
    expect(result).not.to.include("using System.Collections.Generic");
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

    // Should use global:: prefixed assembly + csharpName
    expect(result).to.include("global::System.Console.log");
    // No using statements
    expect(result).not.to.include("using System");
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

    // Should use global:: prefixed full type name when no csharpName
    // resolvedClrType already contains full type name, just add global::
    expect(result).to.include("global::Tsonic.JSRuntime.Math.sqrt");
    // No using statements
    expect(result).not.to.include("using Tsonic.JSRuntime");
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

    // Should emit full CLR type and member from binding with global:: prefix
    expect(result).to.include("global::System.Linq.Enumerable.SelectMany");
    // No using statements
    expect(result).not.to.include("using System.Linq");
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

    // Should emit global::MyLib.Math.Add directly
    expect(result).to.include("global::MyLib.Math.Add");
    // Should NOT include myLib.math (intermediate objects shouldn't appear)
    expect(result).not.to.include("myLib.math");
    // No using statements
    expect(result).not.to.include("using MyLib");
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

  it("should escape special characters in dictionary keys", () => {
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
              name: { kind: "identifierPattern", name: "dict" },
              type: {
                kind: "dictionaryType",
                keyType: { kind: "primitiveType", name: "string" },
                valueType: { kind: "primitiveType", name: "number" },
              },
              initializer: {
                kind: "object",
                properties: [
                  {
                    kind: "property",
                    key: 'key"with"quotes',
                    value: { kind: "literal", value: 1 },
                    shorthand: false,
                  },
                  {
                    kind: "property",
                    key: "key\\with\\backslashes",
                    value: { kind: "literal", value: 2 },
                    shorthand: false,
                  },
                  {
                    kind: "property",
                    key: "key\nwith\nnewlines",
                    value: { kind: "literal", value: 3 },
                    shorthand: false,
                  },
                ],
                contextualType: {
                  kind: "dictionaryType",
                  keyType: { kind: "primitiveType", name: "string" },
                  valueType: { kind: "primitiveType", name: "number" },
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should escape quotes
    expect(result).to.include('["key\\"with\\"quotes"]');
    // Should escape backslashes
    expect(result).to.include('["key\\\\with\\\\backslashes"]');
    // Should escape newlines
    expect(result).to.include('["key\\nwith\\nnewlines"]');
    // Should be a Dictionary with global:: prefix
    expect(result).to.include(
      "new global::System.Collections.Generic.Dictionary<string, double>"
    );
  });

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

  it("should emit Map constructor with JSRuntime prefix in js mode", () => {
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
              name: { kind: "identifierPattern", name: "myMap" },
              initializer: {
                kind: "new",
                callee: { kind: "identifier", name: "Map" },
                arguments: [],
                typeArguments: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "number" },
                ],
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { runtime: "js" });

    // Should use global::Tsonic.JSRuntime.Map
    expect(result).to.include(
      "new global::Tsonic.JSRuntime.Map<string, double>()"
    );
  });

  it("should emit Set constructor with JSRuntime prefix in js mode", () => {
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
              name: { kind: "identifierPattern", name: "mySet" },
              initializer: {
                kind: "new",
                callee: { kind: "identifier", name: "Set" },
                arguments: [],
                typeArguments: [{ kind: "primitiveType", name: "string" }],
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { runtime: "js" });

    // Should use global::Tsonic.JSRuntime.Set
    expect(result).to.include("new global::Tsonic.JSRuntime.Set<string>()");
  });

  it("should emit setTimeout with JSRuntime.Timers prefix in js mode", () => {
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
            callee: { kind: "identifier", name: "setTimeout" },
            arguments: [
              {
                kind: "arrowFunction",
                parameters: [],
                body: { kind: "literal", value: null },
                isAsync: false,
              },
              { kind: "literal", value: 1000 },
            ],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { runtime: "js" });

    // Should use global::Tsonic.JSRuntime.Timers.setTimeout
    expect(result).to.include("global::Tsonic.JSRuntime.Timers.setTimeout");
  });

  it("should emit clearTimeout with JSRuntime.Timers prefix in js mode", () => {
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
            callee: { kind: "identifier", name: "clearTimeout" },
            arguments: [{ kind: "identifier", name: "timerId" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { runtime: "js" });

    // Should use global::Tsonic.JSRuntime.Timers.clearTimeout
    expect(result).to.include(
      "global::Tsonic.JSRuntime.Timers.clearTimeout(timerId)"
    );
  });

  it("should emit setInterval with JSRuntime.Timers prefix in js mode", () => {
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
            callee: { kind: "identifier", name: "setInterval" },
            arguments: [
              {
                kind: "arrowFunction",
                parameters: [],
                body: { kind: "literal", value: null },
                isAsync: false,
              },
              { kind: "literal", value: 500 },
            ],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { runtime: "js" });

    // Should use global::Tsonic.JSRuntime.Timers.setInterval
    expect(result).to.include("global::Tsonic.JSRuntime.Timers.setInterval");
  });

  it("should emit clearInterval with JSRuntime.Timers prefix in js mode", () => {
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
            callee: { kind: "identifier", name: "clearInterval" },
            arguments: [{ kind: "identifier", name: "intervalId" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { runtime: "js" });

    // Should use global::Tsonic.JSRuntime.Timers.clearInterval
    expect(result).to.include(
      "global::Tsonic.JSRuntime.Timers.clearInterval(intervalId)"
    );
  });
});
