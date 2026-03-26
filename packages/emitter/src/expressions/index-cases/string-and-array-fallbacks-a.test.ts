import {
  describe,
  it,
  expect,
  emitModule,
  emitMemberAccess,
  printExpression,
  type EmitterContext,
  type IrModule,
} from "./helpers.js";

describe("Expression Emission", () => {
  it("should preserve the source member access when no CLR member binding exists", () => {
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
    expect(result).to.include("value.length");
    expect(result).not.to.include(
      "global::js.String.length(value)"
    );
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

  it("should emit CLR Length when imported array references lower to native arrays", () => {
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
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "process",
                inferredType: {
                  kind: "referenceType",
                  name: "Demo.ProcessModule",
                  resolvedClrType: "Demo.ProcessModule",
                },
              },
              property: "argv",
              isComputed: false,
              isOptional: false,
              inferredType: {
                kind: "referenceType",
                name: "Array",
                typeArguments: [{ kind: "primitiveType", name: "string" }],
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
    expect(result).to.include("process.argv.Length");
    expect(result).to.not.include("process.argv.length");
  });

  it("should emit JSArray length for imported array references on the JS surface", () => {
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
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "process",
                inferredType: {
                  kind: "referenceType",
                  name: "Demo.ProcessModule",
                  resolvedClrType: "Demo.ProcessModule",
                },
              },
              property: "argv",
              isComputed: false,
              isOptional: false,
              inferredType: {
                kind: "referenceType",
                name: "Array",
                typeArguments: [{ kind: "primitiveType", name: "string" }],
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

    const result = emitModule(module, { surface: "@tsonic/js" });
    expect(result).to.include("process.argv.Length");
    expect(result).to.not.include("new global::Tsonic.Runtime.JSArray<");
  });

  it("should lower js-surface string length to CLR Length when narrowing lost the original binding", () => {
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
    expect(result).to.include("value.Length");
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
              resolvedClrType: "js.Uint8Array",
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
    expect(printed).to.equal("(value.As1()).Length");
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
              resolvedClrType: "js.Uint8Array",
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
    expect(printExpression(result)).to.equal("(value.As1()).Length");
  });
});
