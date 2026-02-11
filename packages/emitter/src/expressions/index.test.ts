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

    // Native array syntax with explicit type
    expect(result).to.include("new int[] { 1, 2, 3 }");
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
                name: "Debug",
                resolvedClrType: "System.Diagnostics.Debug",
                resolvedAssembly: "System",
                // No csharpName specified
              },
              property: "WriteLine",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: "test" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should use global:: prefixed full type name when no csharpName
    // resolvedClrType already contains full type name, just add global::
    expect(result).to.include("global::System.Diagnostics.Debug.WriteLine");
    // No using statements
    expect(result).not.to.include("using System");
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

  it("should lower extension method calls to explicit static invocation", () => {
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
                name: "path",
                inferredType: { kind: "primitiveType", name: "string" },
              },
              property: "split",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.String",
                member: "split",
                isExtensionMethod: true,
              },
            },
            arguments: [{ kind: "literal", value: "/" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include(
      "global::Tsonic.JSRuntime.String.split(path, \"/\")"
    );
    expect(result).not.to.include("path.split");
  });

  it("should emit fluent LINQ extension method calls (required for EF query precompilation)", () => {
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
                name: "q",
                inferredType: { kind: "primitiveType", name: "boolean" }, // doesn't matter; only needs to be instance-style
              },
              property: "Count",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                assembly: "System.Linq",
                type: "System.Linq.Queryable",
                member: "Count",
                isExtensionMethod: true,
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Fluent invocation + namespace using.
    expect(result).to.include("using System.Linq;");
    expect(result).to.include("q.Count()");

    // Must not emit nested/static Queryable.* calls (EF query precompiler flags them as "dynamic").
    expect(result).not.to.include("System.Linq.Queryable.Count");
  });

  it("should emit fluent Queryable extension methods broadly (Where/Select/FirstOrDefault/etc.)", () => {
    const methods: ReadonlyArray<{ readonly member: string; readonly args: any[] }> = [
      { member: "Where", args: [{ kind: "identifier", name: "pred" }] },
      { member: "Select", args: [{ kind: "identifier", name: "sel" }] },
      { member: "FirstOrDefault", args: [] },
      { member: "Count", args: [] },
    ];

    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: methods.map((m) => ({
        kind: "expressionStatement",
        expression: {
          kind: "call",
          callee: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "q",
              inferredType: { kind: "primitiveType", name: "boolean" }, // doesn't matter; only needs to be instance-style
            },
            property: m.member,
            isComputed: false,
            isOptional: false,
            memberBinding: {
              assembly: "System.Linq",
              type: "System.Linq.Queryable",
              member: m.member,
              isExtensionMethod: true,
            },
          },
          arguments: m.args,
          isOptional: false,
        },
      })),
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("using System.Linq;");
    for (const m of methods) {
      expect(result).to.include(`q.${m.member}(`);
      expect(result).not.to.include(`System.Linq.Queryable.${m.member}`);
    }
  });

  it("should emit fluent Enumerable terminal ops (ToList/ToArray) but keep other Enumerable methods static by default", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        // Enumerable terminal ops should be fluent + require using System.Linq;
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "xs",
                inferredType: { kind: "primitiveType", name: "boolean" }, // doesn't matter; instance-style is enough
              },
              property: "ToArray",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "ToArray",
                isExtensionMethod: true,
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "xs",
                inferredType: { kind: "primitiveType", name: "boolean" },
              },
              property: "ToList",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "ToList",
                isExtensionMethod: true,
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
        // Enumerable query operators remain static invocation by default.
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "xs",
                inferredType: { kind: "primitiveType", name: "boolean" },
              },
              property: "Where",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "Where",
                isExtensionMethod: true,
              },
            },
            arguments: [{ kind: "identifier", name: "pred" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("using System.Linq;");
    expect(result).to.include("xs.ToArray()");
    expect(result).to.include("xs.ToList()");
    expect(result).not.to.include("System.Linq.Enumerable.ToArray");
    expect(result).not.to.include("System.Linq.Enumerable.ToList");

    expect(result).to.include("global::System.Linq.Enumerable.Where(xs, pred)");
    expect(result).not.to.include("xs.Where");
  });

  it("should emit fluent EF Core query operators (e.g. AsNoTracking) with a namespace using", () => {
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
                name: "q",
                inferredType: { kind: "primitiveType", name: "boolean" },
              },
              property: "AsNoTracking",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                assembly: "Microsoft.EntityFrameworkCore",
                type: "Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions",
                member: "AsNoTracking",
                isExtensionMethod: true,
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("using Microsoft.EntityFrameworkCore;");
    expect(result).to.include("q.AsNoTracking()");
    expect(result).not.to.include("EntityFrameworkQueryableExtensions.AsNoTracking");
  });

  it("should canonicalize Enumerable.ToList().ToArray() to Enumerable.ToArray() for EF query precompilation", () => {
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
                kind: "call",
                callee: {
                  kind: "memberAccess",
                  object: {
                    kind: "identifier",
                    name: "xs",
                    inferredType: { kind: "primitiveType", name: "boolean" }, // doesn't matter; instance-style is enough
                  },
                  property: "ToList",
                  isComputed: false,
                  isOptional: false,
                  memberBinding: {
                    assembly: "System.Linq",
                    type: "System.Linq.Enumerable",
                    member: "ToList",
                    isExtensionMethod: true,
                  },
                },
                arguments: [],
                isOptional: false,
              },
              property: "ToArray",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "ToArray",
                isExtensionMethod: true,
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // The canonical form must be `xs.ToArray()` (not `xs.ToList().ToArray()`).
    expect(result).to.include("using System.Linq;");
    expect(result).to.include("xs.ToArray()");
    expect(result).not.to.include(".ToList().ToArray()");
  });

  it("should preserve logical operator grouping with parentheses", () => {
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
            kind: "logical",
            operator: "&&",
            left: {
              kind: "identifier",
              name: "a",
              inferredType: { kind: "primitiveType", name: "boolean" },
            },
            right: {
              kind: "logical",
              operator: "||",
              left: {
                kind: "identifier",
                name: "b",
                inferredType: { kind: "primitiveType", name: "boolean" },
              },
              right: {
                kind: "identifier",
                name: "c",
                inferredType: { kind: "primitiveType", name: "boolean" },
              },
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Without parentheses this becomes a && b || c, which changes meaning.
    expect(result).to.include("a && (b || c)");
  });

  it("should unwrap nullable value types when a non-nullable value is expected", () => {
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
            callee: { kind: "identifier", name: "useLong" },
            arguments: [
              {
                kind: "identifier",
                name: "id",
                inferredType: {
                  kind: "unionType",
                  types: [
                    { kind: "referenceType", name: "long" },
                    { kind: "primitiveType", name: "null" },
                  ],
                },
              },
            ],
            isOptional: false,
            parameterTypes: [{ kind: "referenceType", name: "long" }],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("useLong(id.Value)");
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
});
