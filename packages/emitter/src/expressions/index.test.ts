/**
 * Tests for Expression Emission
 * Tests emission of literals, arrays, and template literals
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitMemberAccess } from "./access.js";
import { IrExpression, IrModule, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../types.js";
import { printExpression } from "../core/format/backend-ast/printer.js";

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

    const result = emitModule(module, { surface: "@tsonic/js" });

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

    const result = emitModule(module, { surface: "@tsonic/js" });

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

  it("should emit global function calls using csharpName on identifier callees", () => {
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
              name: "clearInterval",
              resolvedClrType: "Tsonic.JSRuntime.Timers",
              resolvedAssembly: "Tsonic.JSRuntime",
              csharpName: "Timers.clearInterval",
            },
            arguments: [{ kind: "literal", value: 1 }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include(
      "global::Tsonic.JSRuntime.Timers.clearInterval(1)"
    );
  });

  it("should preserve char-typed string indexing while string contexts still use ToString()", () => {
    const stringIndexExpr: Extract<IrExpression, { kind: "memberAccess" }> = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "source",
        inferredType: { kind: "primitiveType" as const, name: "string" },
      },
      property: {
        kind: "literal" as const,
        value: 0,
        inferredType: { kind: "primitiveType" as const, name: "int" },
      },
      isComputed: true,
      isOptional: false,
      inferredType: { kind: "primitiveType" as const, name: "string" },
      accessKind: "stringChar" as const,
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
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "source" },
              type: { kind: "primitiveType", name: "string" },
              initializer: { kind: "literal", value: "abc" },
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "letter" },
              type: { kind: "primitiveType", name: "char" },
              initializer: stringIndexExpr,
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "text" },
              type: { kind: "primitiveType", name: "string" },
              initializer: stringIndexExpr,
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include('string source = "abc";');
    expect(result).to.include("char letter = source[0];");
    expect(result).to.include("string text = source[0].ToString();");
  });

  it("should convert char identifiers to string when a call argument expects string", () => {
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
              name: { kind: "identifierPattern", name: "ch" },
              type: { kind: "primitiveType", name: "char" },
              initializer: { kind: "literal", value: "x" },
            },
          ],
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "regex",
                resolvedClrType: "System.Text.RegularExpressions.Regex",
                resolvedAssembly: "System.Text.RegularExpressions",
                inferredType: { kind: "referenceType", name: "RegExp" },
              },
              property: "test",
              isComputed: false,
              isOptional: false,
              inferredType: {
                kind: "functionType",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: {
                      kind: "identifierPattern",
                      name: "text",
                    },
                    type: { kind: "primitiveType", name: "string" },
                    isOptional: false,
                    isRest: false,
                    passing: "value",
                  },
                ],
                returnType: { kind: "primitiveType", name: "boolean" },
              },
              memberBinding: {
                kind: "method",
                assembly: "System.Text.RegularExpressions",
                type: "System.Text.RegularExpressions.Regex",
                member: "test",
              },
            },
            arguments: [
              {
                kind: "identifier",
                name: "ch",
                inferredType: { kind: "primitiveType", name: "char" },
              },
            ],
            parameterTypes: [{ kind: "primitiveType", name: "string" }],
            inferredType: { kind: "primitiveType", name: "boolean" },
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("char ch = 'x';");
    expect(result).to.include("test(ch.ToString())");
  });

  it("should emit spread arguments without an invalid params call-site modifier", () => {
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
              name: { kind: "identifierPattern", name: "parts" },
              type: {
                kind: "arrayType",
                elementType: { kind: "primitiveType", name: "string" },
              },
              initializer: {
                kind: "array",
                elements: [
                  { kind: "literal", value: "a" },
                  { kind: "literal", value: "b" },
                ],
              },
            },
          ],
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "identifier",
              name: "joinPath",
              resolvedClrType: "nodejs.path",
              resolvedAssembly: "nodejs",
              csharpName: "path.join",
            },
            arguments: [
              { kind: "literal", value: "root" },
              {
                kind: "spread",
                expression: {
                  kind: "identifier",
                  name: "parts",
                  inferredType: {
                    kind: "arrayType",
                    elementType: { kind: "primitiveType", name: "string" },
                  },
                },
              },
            ],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include('global::nodejs.path.join("root", parts)');
    expect(result).not.to.include("params ");
  });

  it("should emit mixed array spreads through deterministic concat chains", () => {
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
              name: { kind: "identifierPattern", name: "values" },
              type: {
                kind: "arrayType",
                elementType: { kind: "primitiveType", name: "int" },
              },
              initializer: {
                kind: "array",
                elements: [
                  {
                    kind: "literal",
                    value: 1,
                    numericIntent: "Int32",
                    inferredType: { kind: "primitiveType", name: "int" },
                  },
                  {
                    kind: "literal",
                    value: 2,
                    numericIntent: "Int32",
                    inferredType: { kind: "primitiveType", name: "int" },
                  },
                ],
              },
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "copy" },
              type: {
                kind: "arrayType",
                elementType: { kind: "primitiveType", name: "int" },
              },
              initializer: {
                kind: "array",
                elements: [
                  {
                    kind: "literal",
                    value: 0,
                    numericIntent: "Int32",
                    inferredType: { kind: "primitiveType", name: "int" },
                  },
                  {
                    kind: "spread",
                    expression: {
                      kind: "identifier",
                      name: "values",
                      inferredType: {
                        kind: "arrayType",
                        elementType: { kind: "primitiveType", name: "int" },
                      },
                    },
                  },
                  {
                    kind: "literal",
                    value: 3,
                    numericIntent: "Int32",
                    inferredType: { kind: "primitiveType", name: "int" },
                  },
                ],
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("global::System.Linq.Enumerable.ToArray");
    expect(result).to.include("global::System.Linq.Enumerable.Concat");
    expect(result).to.include("new int[] { 0 }");
    expect(result).to.include("new int[] { 3 }");
    expect(result).not.to.include("/* ...spread */");
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
                kind: "method",
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

  it("should emit global static calls through member binding type for surface globals", () => {
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
                name: "Array",
                inferredType: {
                  kind: "referenceType",
                  name: "ArrayConstructor",
                },
                resolvedClrType: "Tsonic.JSRuntime.JSArray`1",
                resolvedAssembly: "Tsonic.JSRuntime",
                csharpName: "JSArray",
              },
              property: "from",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.JSArrayStatics",
                member: "from",
                isExtensionMethod: false,
              },
            },
            arguments: [{ kind: "literal", value: "abc" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include(
      'global::Tsonic.JSRuntime.JSArrayStatics.from("abc")'
    );
    expect(result).not.to.include("global::Tsonic.JSRuntime.JSArray.from");
  });

  it("should escape C# keywords in hierarchical member bindings", () => {
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
                object: { kind: "identifier", name: "express" },
                property: "express",
                isComputed: false,
                isOptional: false,
              },
              property: "static",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "express",
                type: "Express.Express",
                member: "static",
              },
            },
            arguments: [{ kind: "literal", value: "./public" }],
            isOptional: false,
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "req",
                inferredType: {
                  kind: "referenceType",
                  name: "Express.Request",
                },
              },
              property: "params",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "property",
                assembly: "express",
                type: "Express.Request",
                member: "params",
              },
            },
            property: { kind: "literal", value: "id" },
            isComputed: true,
            isOptional: false,
            accessKind: "dictionary",
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("global::Express.Express.@static");
    expect(result).to.include('req.@params["id"]');
  });

  it("should emit JS runtime string receiver helpers as fluent calls", () => {
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
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.String",
                member: "split",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
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

    expect(result).to.include('path.split("/")');
    expect(result).not.to.include(
      'global::Tsonic.JSRuntime.String.split(path, "/")'
    );
  });

  it("should emit JS runtime numeric receiver helpers as fluent calls", () => {
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
                name: "value",
                inferredType: { kind: "primitiveType", name: "number" },
              },
              property: "toString",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.Number",
                member: "toString",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
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

    expect(result).to.include("value.toString()");
    expect(result).not.to.include(
      "global::Tsonic.JSRuntime.Number.toString(value)"
    );
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
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Queryable",
                member: "Count",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
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
    const methods: ReadonlyArray<{
      readonly member: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readonly args: any[];
    }> = [
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
              kind: "method",
              assembly: "System.Linq",
              type: "System.Linq.Queryable",
              member: m.member,
              isExtensionMethod: true,
              emitSemantics: {
                callStyle: "receiver",
              },
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
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "ToArray",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
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
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "ToList",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
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
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "Where",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "static",
                },
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
                kind: "method",
                assembly: "Microsoft.EntityFrameworkCore",
                type: "Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions",
                member: "AsNoTracking",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
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
    expect(result).not.to.include(
      "EntityFrameworkQueryableExtensions.AsNoTracking"
    );
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
                    kind: "method",
                    assembly: "System.Linq",
                    type: "System.Linq.Enumerable",
                    member: "ToList",
                    isExtensionMethod: true,
                    emitSemantics: {
                      callStyle: "receiver",
                    },
                  },
                },
                arguments: [],
                isOptional: false,
              },
              property: "ToArray",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "ToArray",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
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

  it("should not double-unwrap member-access nullable guards (no .Value.Value)", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "ifStatement",
          condition: {
            kind: "binary",
            operator: "!==",
            left: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "updates" },
              property: "active",
              isComputed: false,
              isOptional: false,
              inferredType: {
                kind: "unionType",
                types: [
                  { kind: "referenceType", name: "int" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
            },
            right: { kind: "identifier", name: "undefined" },
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "useInt" },
                  arguments: [
                    {
                      kind: "memberAccess",
                      object: { kind: "identifier", name: "updates" },
                      property: "active",
                      isComputed: false,
                      isOptional: false,
                      inferredType: {
                        kind: "unionType",
                        types: [
                          { kind: "referenceType", name: "int" },
                          { kind: "primitiveType", name: "undefined" },
                        ],
                      },
                    },
                  ],
                  isOptional: false,
                  parameterTypes: [{ kind: "referenceType", name: "int" }],
                },
              },
            ],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("useInt(updates.active.Value)");
    expect(result).to.not.include("updates.active.Value.Value");
  });

  it("should not fold value-type undefined guards to constants", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "ifStatement",
          condition: {
            kind: "binary",
            operator: "!==",
            left: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "updates",
              },
              property: "count",
              isComputed: false,
              isOptional: false,
              inferredType: {
                kind: "primitiveType",
                name: "int",
              },
            },
            right: {
              kind: "identifier",
              name: "undefined",
            },
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "touch" },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "updates",
                    },
                  ],
                  isOptional: false,
                },
              },
            ],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "if (((global::System.Object)(updates.count)) != null)"
    );
    expect(result).to.not.include("if (true)");
  });

  it("should lower string relational comparisons via CompareOrdinal", () => {
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
            operator: ">",
            left: {
              kind: "identifier",
              name: "a",
              inferredType: { kind: "primitiveType", name: "string" },
            },
            right: {
              kind: "identifier",
              name: "b",
              inferredType: { kind: "primitiveType", name: "string" },
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::System.String.CompareOrdinal(a, b) > 0");
    expect(result).to.not.include("a > b");
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
                    kind: "method",
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

  it("should emit member-binding CLR name exactly (no surface rewrite)", () => {
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
            object: {
              kind: "identifier",
              name: "value",
              inferredType: { kind: "primitiveType", name: "string" },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "System.Private.CoreLib",
              type: "System.String",
              member: "Length",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("value.Length");
    expect(result).not.to.include("value.length");
  });

  it("should emit global simple-binding member access as static CLR access", () => {
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
            object: {
              kind: "identifier",
              name: "console",
              inferredType: { kind: "referenceType", name: "Console" },
            },
            property: "log",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "method",
              assembly: "Tsonic.JSRuntime",
              type: "Tsonic.JSRuntime.console",
              member: "log",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::Tsonic.JSRuntime.console.log");
  });

  it("should keep local member access when identifier case differs from CLR type leaf", () => {
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
            object: {
              kind: "identifier",
              name: "entity",
              inferredType: {
                kind: "referenceType",
                name: "Entity",
                resolvedClrType: "Acme.Core.Entity",
              },
            },
            property: "Maybe",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "Acme.Core",
              type: "Acme.Core.Entity",
              member: "Maybe",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("entity.Maybe");
    expect(result).not.to.include("global::Acme.Core.Entity.Maybe");
  });

  it("should emit extension member value access as static invocation", () => {
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
            object: {
              kind: "identifier",
              name: "value",
              inferredType: { kind: "primitiveType", name: "string" },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "method",
              assembly: "Tsonic.JSRuntime",
              type: "Tsonic.JSRuntime.String",
              member: "length",
              isExtensionMethod: true,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::Tsonic.JSRuntime.String.length(value)");
    expect(result).not.to.include("value.length");
  });

  it("should emit array wrapper call for non-System.Array member bindings", () => {
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
                name: "nums",
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "int" },
                },
              },
              property: "map",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.JSArray`1",
                member: "map",
              },
            },
            arguments: [{ kind: "identifier", name: "project" }],
            isOptional: false,
            inferredType: {
              kind: "arrayType",
              elementType: { kind: "primitiveType", name: "int" },
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "new global::Tsonic.JSRuntime.JSArray<int>(nums).map(project).toArray()"
    );
  });

  it("normalizes JS array wrapper call results back to native arrays for all array-like inferred return types", () => {
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
                name: "items",
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "string" },
                },
              },
              property: "filter",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.JSArray`1",
                member: "filter",
              },
            },
            arguments: [{ kind: "identifier", name: "predicate" }],
            isOptional: false,
            inferredType: {
              kind: "referenceType",
              name: "Array",
              typeArguments: [{ kind: "primitiveType", name: "string" }],
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { surface: "@tsonic/js" });
    expect(result).to.include(
      "new global::Tsonic.JSRuntime.JSArray<string>(items).filter(predicate).toArray()"
    );
  });

  it("normalizes unbound JS array wrapper member calls back to native arrays when the receiver is a native array", () => {
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
                name: "items",
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "string" },
                },
              },
              property: "filter",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "identifier", name: "predicate" }],
            isOptional: false,
            inferredType: {
              kind: "arrayType",
              elementType: { kind: "primitiveType", name: "string" },
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { surface: "@tsonic/js" });
    expect(result).to.include(
      "new global::Tsonic.JSRuntime.JSArray<string>(items).filter(predicate).toArray()"
    );
  });

  it("normalizes fluent JS extension calls back to native arrays when the logical return type is array-like", () => {
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
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.String",
                member: "split",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            },
            arguments: [{ kind: "literal", value: "/" }],
            isOptional: false,
            inferredType: {
              kind: "referenceType",
              name: "ReadonlyArray",
              typeArguments: [{ kind: "primitiveType", name: "string" }],
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      'global::System.Linq.Enumerable.ToArray(path.split("/"))'
    );
  });

  it("should emit array wrapper property access for non-System.Array member bindings", () => {
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
            object: {
              kind: "identifier",
              name: "nums",
              inferredType: {
                kind: "arrayType",
                elementType: { kind: "primitiveType", name: "int" },
              },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "Tsonic.JSRuntime",
              type: "Tsonic.JSRuntime.JSArray`1",
              member: "length",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "new global::Tsonic.JSRuntime.JSArray<int>(nums).length"
    );
  });

  it("should emit array wrapper property access for nullable array receivers", () => {
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
            object: {
              kind: "identifier",
              name: "maybeNums",
              inferredType: {
                kind: "unionType",
                types: [
                  {
                    kind: "arrayType",
                    elementType: { kind: "primitiveType", name: "int" },
                  },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "Tsonic.JSRuntime",
              type: "Tsonic.JSRuntime.JSArray`1",
              member: "length",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "new global::Tsonic.JSRuntime.JSArray<int>(maybeNums).length"
    );
  });

  it("should preserve resolved CLR identity for source-bound array element types", () => {
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
            object: {
              kind: "identifier",
              name: "attachments",
              inferredType: {
                kind: "arrayType",
                elementType: {
                  kind: "referenceType",
                  name: "Acme.Core.Attachment",
                  resolvedClrType: "Acme.Core.Attachment",
                },
              },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "Tsonic.JSRuntime",
              type: "Tsonic.JSRuntime.JSArray`1",
              member: "length",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "new global::Tsonic.JSRuntime.JSArray<global::Acme.Core.Attachment>(attachments).length"
    );
  });

  it("should emit array wrapper property access for ReadonlyArray receivers", () => {
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
            object: {
              kind: "identifier",
              name: "nums",
              inferredType: {
                kind: "referenceType",
                name: "ReadonlyArray",
                typeArguments: [{ kind: "primitiveType", name: "int" }],
              },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "Tsonic.JSRuntime",
              type: "Tsonic.JSRuntime.JSArray`1",
              member: "length",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "new global::Tsonic.JSRuntime.JSArray<int>(nums).length"
    );
  });

  it("should preserve source member name when no CLR member binding exists", () => {
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
            object: {
              kind: "identifier",
              name: "value",
              inferredType: { kind: "primitiveType", name: "string" },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::Tsonic.JSRuntime.String.length(value)");
    expect(result).not.to.include("value.length");
  });

  it("should emit CLR Length for structural array length without member binding", () => {
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
            object: {
              kind: "identifier",
              name: "channels",
              inferredType: {
                kind: "arrayType",
                elementType: {
                  kind: "referenceType",
                  name: "Acme.Core.Channel",
                  resolvedClrType: "Acme.Core.Channel",
                },
              },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("channels.Length");
    expect(result).to.not.include("channels.length");
  });

  it("should recover JS string length fallback under JS surface when narrowing lost the original binding", () => {
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
            object: {
              kind: "identifier",
              name: "value",
              inferredType: { kind: "primitiveType", name: "string" },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { surface: "@tsonic/js" });
    expect(result).to.include("global::Tsonic.JSRuntime.String.length(value)");
    expect(result).not.to.include("value.length");
  });

  it("should recover JS string length fallback for narrowed union receivers", () => {
    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "value",
        inferredType: {
          kind: "unionType" as const,
          types: [
            { kind: "primitiveType" as const, name: "string" as const },
            {
              kind: "referenceType" as const,
              name: "Uint8Array",
              resolvedClrType: "Tsonic.JSRuntime.Uint8Array",
            },
          ],
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
    };

    const context: EmitterContext = {
      indentLevel: 0,
      options: { rootNamespace: "MyApp", surface: "@tsonic/js", indent: 4 },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      narrowedBindings: new Map([
        [
          "value",
          {
            kind: "expr" as const,
            exprAst: {
              kind: "parenthesizedExpression" as const,
              expression: {
                kind: "invocationExpression" as const,
                expression: {
                  kind: "memberAccessExpression" as const,
                  expression: {
                    kind: "identifierExpression" as const,
                    identifier: "value",
                  },
                  memberName: "As1",
                },
                arguments: [],
              },
            },
            type: { kind: "primitiveType" as const, name: "string" as const },
          },
        ],
      ]),
    };

    const [result] = emitMemberAccess(expr, context);
    const printed = printExpression(result);
    expect(printed).to.equal(
      "global::Tsonic.JSRuntime.String.length((value.As1()))"
    );
  });

  it("should recover JS string length fallback when narrowed receivers use string reference types", () => {
    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "value",
        inferredType: {
          kind: "unionType" as const,
          types: [
            { kind: "referenceType" as const, name: "string" as const },
            {
              kind: "referenceType" as const,
              name: "Uint8Array",
              resolvedClrType: "Tsonic.JSRuntime.Uint8Array",
            },
          ],
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
    };

    const context: EmitterContext = {
      indentLevel: 0,
      options: { rootNamespace: "MyApp", surface: "@tsonic/js", indent: 4 },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      narrowedBindings: new Map([
        [
          "value",
          {
            kind: "expr" as const,
            exprAst: {
              kind: "parenthesizedExpression" as const,
              expression: {
                kind: "invocationExpression" as const,
                expression: {
                  kind: "memberAccessExpression" as const,
                  expression: {
                    kind: "identifierExpression" as const,
                    identifier: "value",
                  },
                  memberName: "As1",
                },
                arguments: [],
              },
            },
            type: { kind: "referenceType" as const, name: "string" as const },
          },
        ],
      ]),
    };

    const [result] = emitMemberAccess(expr, context);
    expect(printExpression(result)).to.equal(
      "global::Tsonic.JSRuntime.String.length((value.As1()))"
    );
  });

  it("should recover JS string length fallback when narrowed receivers use CLR-backed string references", () => {
    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "value",
        inferredType: {
          kind: "unionType" as const,
          types: [
            {
              kind: "referenceType" as const,
              name: "String" as const,
              resolvedClrType: "System.String",
            },
            {
              kind: "referenceType" as const,
              name: "Uint8Array",
              resolvedClrType: "Tsonic.JSRuntime.Uint8Array",
            },
          ],
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
    };

    const context: EmitterContext = {
      indentLevel: 0,
      options: { rootNamespace: "MyApp", surface: "@tsonic/js", indent: 4 },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      narrowedBindings: new Map([
        [
          "value",
          {
            kind: "expr" as const,
            exprAst: {
              kind: "parenthesizedExpression" as const,
              expression: {
                kind: "invocationExpression" as const,
                expression: {
                  kind: "memberAccessExpression" as const,
                  expression: {
                    kind: "identifierExpression" as const,
                    identifier: "value",
                  },
                  memberName: "As1",
                },
                arguments: [],
              },
            },
            type: {
              kind: "referenceType" as const,
              name: "String" as const,
              resolvedClrType: "System.String",
            },
          },
        ],
      ]),
    };

    const [result] = emitMemberAccess(expr, context);
    expect(printExpression(result)).to.equal(
      "global::Tsonic.JSRuntime.String.length((value.As1()))"
    );
  });

  it("should recover JS string length fallback when narrowed runtime-union bindings omit the narrowed type", () => {
    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "value",
        inferredType: {
          kind: "unionType" as const,
          types: [
            { kind: "primitiveType" as const, name: "string" as const },
            {
              kind: "referenceType" as const,
              name: "Uint8Array",
              resolvedClrType: "Tsonic.JSRuntime.Uint8Array",
            },
          ],
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
    };

    const context: EmitterContext = {
      indentLevel: 0,
      options: { rootNamespace: "MyApp", surface: "@tsonic/js", indent: 4 },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      narrowedBindings: new Map([
        [
          "value",
          {
            kind: "expr" as const,
            exprAst: {
              kind: "parenthesizedExpression" as const,
              expression: {
                kind: "invocationExpression" as const,
                expression: {
                  kind: "memberAccessExpression" as const,
                  expression: {
                    kind: "identifierExpression" as const,
                    identifier: "value",
                  },
                  memberName: "As1",
                },
                arguments: [],
              },
            },
          },
        ],
      ]),
    };

    const [result] = emitMemberAccess(expr, context);
    expect(printExpression(result)).to.equal(
      "global::Tsonic.JSRuntime.String.length((value.As1()))"
    );
  });

  it("should recover JS string length fallback before CLR member-binding access on narrowed strings", () => {
    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "value",
        inferredType: {
          kind: "unionType" as const,
          types: [
            { kind: "primitiveType" as const, name: "string" as const },
            {
              kind: "referenceType" as const,
              name: "Uint8Array",
              resolvedClrType: "Tsonic.JSRuntime.Uint8Array",
            },
          ],
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
      memberBinding: {
        kind: "property" as const,
        assembly: "System.Runtime",
        type: "System.String",
        member: "Length",
      },
    };

    const context: EmitterContext = {
      indentLevel: 0,
      options: { rootNamespace: "MyApp", surface: "@tsonic/js", indent: 4 },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      narrowedBindings: new Map([
        [
          "value",
          {
            kind: "expr" as const,
            exprAst: {
              kind: "parenthesizedExpression" as const,
              expression: {
                kind: "invocationExpression" as const,
                expression: {
                  kind: "memberAccessExpression" as const,
                  expression: {
                    kind: "identifierExpression" as const,
                    identifier: "value",
                  },
                  memberName: "As1",
                },
                arguments: [],
              },
            },
            type: { kind: "primitiveType" as const, name: "string" as const },
          },
        ],
      ]),
    };

    const [result] = emitMemberAccess(expr, context);
    expect(printExpression(result)).to.equal(
      "global::Tsonic.JSRuntime.String.length((value.As1()))"
    );
  });

  it("should recover JS array method fallback under JS surface when member binding is missing", () => {
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
                name: "items",
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "string" },
                },
              },
              property: "includes",
              isComputed: false,
              isOptional: false,
              inferredType: {
                kind: "functionType",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: { kind: "identifierPattern", name: "value" },
                    type: { kind: "primitiveType", name: "string" },
                    isOptional: false,
                    isRest: false,
                    passing: "value",
                  },
                ],
                returnType: { kind: "primitiveType", name: "boolean" },
              },
            },
            arguments: [{ kind: "literal", value: "x" }],
            isOptional: false,
            parameterTypes: [{ kind: "primitiveType", name: "string" }],
            inferredType: { kind: "primitiveType", name: "boolean" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 1,
              column: 1,
              length: 17,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { surface: "@tsonic/js" });
    expect(result).to.include(
      'new global::Tsonic.JSRuntime.JSArray<string>(items).includes("x")'
    );
  });

  it("should emit CLR Count for structural dictionary count without member binding", () => {
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
            object: {
              kind: "identifier",
              name: "items",
              inferredType: {
                kind: "dictionaryType",
                keyType: { kind: "primitiveType", name: "string" },
                valueType: {
                  kind: "referenceType",
                  name: "Acme.Core.Channel",
                  resolvedClrType: "Acme.Core.Channel",
                },
              },
            },
            property: "Length",
            isComputed: false,
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("items.Count");
    expect(result).to.not.include("items.Length");
  });

  it("should project CLR Union_n member access deterministically", () => {
    const unionReference: IrType = {
      kind: "referenceType",
      name: "Union",
      typeArguments: [
        { kind: "referenceType", name: "Ok" },
        { kind: "referenceType", name: "Err" },
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
          kind: "expressionStatement",
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
            memberBinding: {
              kind: "property",
              assembly: "MyApp",
              type: "MyApp.Ok",
              member: "success",
            },
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "result",
              inferredType: unionWrapper,
            },
            property: "error",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "MyApp",
              type: "MyApp.Err",
              member: "error",
            },
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "result",
              inferredType: unionWrapper,
            },
            property: "data",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "MyApp",
              type: "MyApp.Ok",
              member: "data",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "result.Match(__m1 => __m1.success, __m2 => __m2.success)"
    );
    expect(result).to.include("result.As2().error");
    expect(result).to.include("result.As1().data");
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

  it("should emit computed string-literal keys for nominal object initializers", () => {
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
          name: "Box",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "foo",
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "box" },
              type: { kind: "referenceType", name: "Box" },
              initializer: {
                kind: "object",
                properties: [
                  {
                    kind: "property",
                    key: { kind: "literal", value: "foo" },
                    value: { kind: "literal", value: 1 },
                    shorthand: false,
                  },
                ],
                contextualType: { kind: "referenceType", name: "Box" },
                inferredType: { kind: "referenceType", name: "Box" },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).not.to.include("/* computed */");
    expect(result).to.include("foo = 1");
  });

  it("should lower dictionary[key] !== undefined to ContainsKey", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "string" },
      valueType: { kind: "primitiveType", name: "number" },
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
          kind: "ifStatement",
          condition: {
            kind: "binary",
            operator: "!==",
            left: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "dict",
                inferredType: dictType,
              },
              property: { kind: "literal", value: "x" },
              isComputed: true,
              isOptional: false,
              accessKind: "dictionary",
              inferredType: { kind: "primitiveType", name: "number" },
            },
            right: { kind: "identifier", name: "undefined" },
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include('(dict).ContainsKey("x")');
    expect(result).to.not.include('dict["x"] != null');
  });

  it("should lower dictionary.Keys to a materialized key array", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "string" },
      valueType: { kind: "primitiveType", name: "number" },
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
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "keys" },
              initializer: {
                kind: "memberAccess",
                object: {
                  kind: "identifier",
                  name: "dict",
                  inferredType: dictType,
                },
                property: "Keys",
                isComputed: false,
                isOptional: false,
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "string" },
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "new global::System.Collections.Generic.List<string>(dict.Keys).ToArray()"
    );
  });

  it("should lower dictionary.Values to a materialized value array", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "string" },
      valueType: { kind: "referenceType", name: "long" },
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
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "values" },
              initializer: {
                kind: "memberAccess",
                object: {
                  kind: "identifier",
                  name: "dict",
                  inferredType: dictType,
                },
                property: "Values",
                isComputed: false,
                isOptional: false,
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "referenceType", name: "long" },
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "new global::System.Collections.Generic.List<long>(dict.Values).ToArray()"
    );
  });

  it("should upcast dictionary values into union wrappers for expected dictionary union types", () => {
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
              name: { kind: "identifierPattern", name: "widened" },
              type: {
                kind: "dictionaryType",
                keyType: { kind: "primitiveType", name: "string" },
                valueType: {
                  kind: "unionType",
                  types: [
                    { kind: "referenceType", name: "int" },
                    { kind: "primitiveType", name: "string" },
                  ],
                },
              },
              initializer: {
                kind: "identifier",
                name: "raw",
                inferredType: {
                  kind: "dictionaryType",
                  keyType: { kind: "primitiveType", name: "string" },
                  valueType: { kind: "referenceType", name: "int" },
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::System.Linq.Enumerable.ToDictionary");
    expect(result).to.include(
      "global::Tsonic.Runtime.Union<int, string>.From1"
    );
  });

  it("should not upcast when dictionary value type already matches union runtime type", () => {
    const unionType: IrType = {
      kind: "unionType",
      types: [
        { kind: "referenceType", name: "int" },
        { kind: "primitiveType", name: "string" },
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
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "alreadyWide" },
              type: {
                kind: "dictionaryType",
                keyType: { kind: "primitiveType", name: "string" },
                valueType: unionType,
              },
              initializer: {
                kind: "identifier",
                name: "input",
                inferredType: {
                  kind: "dictionaryType",
                  keyType: { kind: "primitiveType", name: "string" },
                  valueType: unionType,
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).not.to.include(
      "global::System.Linq.Enumerable.ToDictionary"
    );
  });

  it("should lower symbol-key dictionary undefined checks to ContainsKey", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "referenceType", name: "object" },
      valueType: { kind: "primitiveType", name: "number" },
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
          kind: "ifStatement",
          condition: {
            kind: "binary",
            operator: "===",
            left: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "dict",
                inferredType: dictType,
              },
              property: { kind: "identifier", name: "key" },
              isComputed: true,
              isOptional: false,
              accessKind: "dictionary",
              inferredType: { kind: "primitiveType", name: "number" },
            },
            right: { kind: "identifier", name: "undefined" },
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("!(dict).ContainsKey(key)");
    expect(result).to.not.include("dict[key] == null");
  });

  it("should lower delete on symbol-key dictionary access to Remove", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "referenceType", name: "object" },
      valueType: { kind: "primitiveType", name: "number" },
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
            kind: "unary",
            operator: "delete",
            expression: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "dict",
                inferredType: dictType,
              },
              property: { kind: "identifier", name: "key" },
              isComputed: true,
              isOptional: false,
              accessKind: "dictionary",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("dict.Remove(key);");
  });

  it("should hard-fail unsupported delete targets instead of emitting comment placeholders", () => {
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
            kind: "unary",
            operator: "delete",
            expression: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "obj",
                inferredType: { kind: "referenceType", name: "Thing" },
              },
              property: "value",
              isComputed: false,
              isOptional: false,
            },
          },
        },
      ],
      exports: [],
    };

    expect(() => emitModule(module)).to.throw(
      "ICE: Unsupported delete target reached emitter"
    );
  });

  it("should hard-fail compound destructuring assignments instead of emitting fake identifiers", () => {
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
            kind: "assignment",
            operator: "+=",
            left: {
              kind: "arrayPattern",
              elements: [
                {
                  pattern: {
                    kind: "identifierPattern",
                    name: "x",
                  },
                },
              ],
            },
            right: { kind: "literal", value: 1 },
          },
        },
      ],
      exports: [],
    };

    expect(() => emitModule(module)).to.throw(
      "ICE: Compound assignment to array/object destructuring pattern reached emitter"
    );
  });

  it("should hard-fail object spreads that reach emission without inferred source types", () => {
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
          name: "Target",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "count",
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "value" },
              type: { kind: "referenceType", name: "Target" },
              initializer: {
                kind: "object",
                hasSpreads: true,
                inferredType: { kind: "referenceType", name: "Target" },
                properties: [
                  {
                    kind: "spread",
                    expression: {
                      kind: "identifier",
                      name: "source",
                    },
                  },
                  {
                    kind: "property",
                    key: "count",
                    value: { kind: "literal", value: 1 },
                    shorthand: false,
                  },
                ],
              },
            },
          ],
        },
      ],
      exports: [],
    };

    expect(() => emitModule(module)).to.throw("ICE: Object spread source");
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

  it("should lower tuple-rest function value calls as positional arguments", () => {
    const tupleRestType = {
      kind: "unionType" as const,
      types: [
        { kind: "tupleType" as const, elementTypes: [] },
        {
          kind: "tupleType" as const,
          elementTypes: [
            { kind: "primitiveType" as const, name: "number" as const },
          ],
        },
      ],
    } as const;

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
              name: "next",
              inferredType: {
                kind: "functionType",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: { kind: "identifierPattern", name: "args" },
                    type: tupleRestType,
                    isOptional: false,
                    isRest: true,
                    passing: "value",
                  },
                ],
                returnType: { kind: "unknownType" },
              },
            },
            arguments: [{ kind: "literal", value: 5, numericIntent: "Int32" }],
            isOptional: false,
            parameterTypes: [tupleRestType],
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 1,
              column: 1,
              length: 7,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("next(5)");
    expect(result).to.not.include("new object[] { 5 }");
  });

  it("should lower union-rest function value calls with contextual array members", () => {
    const middlewareLike: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        {
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
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
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "identifier",
              name: "next",
              inferredType: {
                kind: "functionType",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: { kind: "identifierPattern", name: "handlers" },
                    type: middlewareLike,
                    isOptional: false,
                    isRest: true,
                    passing: "value",
                  },
                ],
                returnType: { kind: "unknownType" },
              },
            },
            arguments: [
              {
                kind: "array",
                elements: [{ kind: "literal", value: "ok" }],
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "string" },
                  origin: "explicit",
                },
              },
            ],
            isOptional: false,
            parameterTypes: [middlewareLike],
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 1,
              column: 1,
              length: 7,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "new global::Tsonic.Runtime.Union<string, string[]>[]"
    );
    expect(result).to.include('new string[] { "ok" }');
    expect(result).to.not.include("new object[] { new object[]");
  });

  it("should wrap nested union handler values through explicit outer and inner union factories", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "next" },
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "unknownType" },
    };

    const middlewareParam: IrType = {
      kind: "unionType",
      types: [
        handlerType,
        {
          kind: "arrayType",
          elementType: { kind: "referenceType", name: "object" },
          origin: "explicit",
        },
      ],
    };
    const middlewareLike: IrType = {
      kind: "unionType",
      types: [
        middlewareParam,
        { kind: "referenceType", name: "Router", resolvedClrType: "Test.Router" },
        {
          kind: "arrayType",
          elementType: { kind: "referenceType", name: "object" },
          origin: "explicit",
        },
      ],
    };

    const [result] = emitExpressionAst(
      {
        kind: "identifier",
        name: "handler",
        inferredType: handlerType,
      },
      {
        indentLevel: 0,
        options: {
          rootNamespace: "MyApp",
          surface: "@tsonic/js",
          indent: 4,
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
      },
      middlewareLike
    );

    expect(printExpression(result)).to.equal(
      "global::Tsonic.Runtime.Union<global::Tsonic.Runtime.Union<global::System.Func<string, object?>, object[]>, global::Test.Router, object[]>.From1(global::Tsonic.Runtime.Union<global::System.Func<string, object?>, object[]>.From1(handler))"
    );
  });

  it("should wrap recursive array-like union arguments through explicit array-arm factories", () => {
    const middlewareLike: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "unionType",
          types: [
            {
              kind: "functionType",
              parameters: [],
              returnType: { kind: "unknownType" },
            },
            {
              kind: "arrayType",
              elementType: { kind: "referenceType", name: "object" },
              origin: "explicit",
            },
          ],
        },
        { kind: "referenceType", name: "Router", resolvedClrType: "Test.Router" },
        {
          kind: "arrayType",
          elementType: { kind: "referenceType", name: "object" },
          origin: "explicit",
        },
      ],
    };

    const [result] = emitExpressionAst(
      {
        kind: "array",
        elements: [
          {
            kind: "identifier",
            name: "handler",
            inferredType: {
              kind: "functionType",
              parameters: [],
              returnType: { kind: "unknownType" },
            },
          },
        ],
        inferredType: {
          kind: "arrayType",
          elementType: {
            kind: "functionType",
            parameters: [],
            returnType: { kind: "unknownType" },
          },
          origin: "explicit",
        },
      },
      {
        indentLevel: 0,
        options: {
          rootNamespace: "MyApp",
          surface: "@tsonic/js",
          indent: 4,
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
      },
      middlewareLike
    );

    expect(printExpression(result)).to.equal(
      "global::Tsonic.Runtime.Union<global::Tsonic.Runtime.Union<global::System.Func<object?>, object[]>, global::Test.Router, object[]>.From1(global::Tsonic.Runtime.Union<global::System.Func<object?>, object[]>.From2(global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Select(new object[] { handler }, __item => __item))))"
    );
  });

  it("reifies erased recursive union array elements back into runtime unions", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "value" },
          type: { kind: "primitiveType", name: "string" },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "voidType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareLike.types.push(
      handlerType,
      routerType,
      {
        kind: "arrayType",
        elementType: middlewareLike,
        origin: "explicit",
      }
    );

    const expr: IrExpression = {
      kind: "memberAccess",
      object: {
        kind: "identifier",
        name: "handler",
        inferredType: middlewareLike,
      },
      property: {
        kind: "identifier",
        name: "index",
        inferredType: { kind: "primitiveType", name: "int" },
      },
      isComputed: true,
      isOptional: false,
      inferredType: middlewareLike,
      accessKind: "clrIndexer",
    };

    const [result] = emitExpressionAst(expr, {
      indentLevel: 0,
      options: {
        rootNamespace: "Test",
        surface: "@tsonic/js",
        indent: 4,
      },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      narrowedBindings: new Map([
        [
          "handler",
          {
            kind: "expr",
            exprAst: {
              kind: "invocationExpression",
              expression: {
                kind: "memberAccessExpression",
                expression: {
                  kind: "identifierExpression",
                  identifier: "handler",
                },
                memberName: "As3",
              },
              arguments: [],
            },
            type: {
              kind: "arrayType",
              elementType: middlewareLike,
              origin: "explicit",
            },
          },
        ],
      ]),
    });

    const text = printExpression(result);
    expect(text).to.include("global::Tsonic.Runtime.Union<global::System.Action<string>, global::Test.Router, object[]>.From1");
    expect(text).to.include("global::Tsonic.Runtime.Union<global::System.Action<string>, global::Test.Router, object[]>.From2");
    expect(text).to.include("global::Tsonic.Runtime.Union<global::System.Action<string>, global::Test.Router, object[]>.From3");
    expect(text).to.include("global::Tsonic.JSRuntime.JSArrayStatics.isArray");
    expect(text).to.not.equal("(handler.As3())[index]");
  });

  it("reifies erased recursive nested-union array elements through outer union arms", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const middlewareParam = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareParam.types.push(handlerType, {
      kind: "arrayType",
      elementType: middlewareParam,
      origin: "explicit",
    });

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareLike.types.push(
      middlewareParam,
      {
        kind: "referenceType",
        name: "Router",
        resolvedClrType: "Test.Router",
      },
      {
        kind: "arrayType",
        elementType: middlewareLike,
        origin: "explicit",
      }
    );

    const expr: IrExpression = {
      kind: "memberAccess",
      object: {
        kind: "identifier",
        name: "handler",
        inferredType: middlewareLike,
      },
      property: {
        kind: "identifier",
        name: "index",
        inferredType: { kind: "primitiveType", name: "int" },
      },
      isComputed: true,
      isOptional: false,
      inferredType: middlewareLike,
      accessKind: "clrIndexer",
    };

    const [result] = emitExpressionAst(expr, {
      indentLevel: 0,
      options: {
        rootNamespace: "Test",
        surface: "@tsonic/js",
        indent: 4,
      },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      narrowedBindings: new Map([
        [
          "handler",
          {
            kind: "expr",
            exprAst: {
              kind: "invocationExpression",
              expression: {
                kind: "memberAccessExpression",
                expression: {
                  kind: "identifierExpression",
                  identifier: "handler",
                },
                memberName: "As3",
              },
              arguments: [],
            },
            type: {
              kind: "arrayType",
              elementType: middlewareLike,
              origin: "explicit",
            },
          },
        ],
      ]),
    });

    const text = printExpression(result);
    expect(text).to.include("global::Tsonic.Runtime.Union<global::Tsonic.Runtime.Union<global::System.Action, object[]>, global::Test.Router, object[]>.From1");
    expect(text).to.include("global::Tsonic.Runtime.Union<global::System.Action, object[]>.From1");
    expect(text).to.include("global::Tsonic.Runtime.Union<global::System.Action, object[]>.From2");
    expect(text).to.include("global::Tsonic.JSRuntime.JSArrayStatics.isArray");
  });

  it("should lower zero-arg tuple-rest function value calls without synthetic arrays", () => {
    const tupleRestType = {
      kind: "unionType" as const,
      types: [
        { kind: "tupleType" as const, elementTypes: [] },
        {
          kind: "tupleType" as const,
          elementTypes: [
            { kind: "primitiveType" as const, name: "number" as const },
          ],
        },
      ],
    } as const;

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
              name: "next",
              inferredType: {
                kind: "functionType",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: { kind: "identifierPattern", name: "args" },
                    type: tupleRestType,
                    isOptional: false,
                    isRest: true,
                    passing: "value",
                  },
                ],
                returnType: { kind: "unknownType" },
              },
            },
            arguments: [],
            isOptional: false,
            parameterTypes: [tupleRestType],
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 1,
              column: 1,
              length: 6,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("next()");
    expect(result).to.not.include("new object[0]");
  });
});
