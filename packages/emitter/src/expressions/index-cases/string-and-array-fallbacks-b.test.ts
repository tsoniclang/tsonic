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
    expect(printExpression(result)).to.equal("(value.As1()).Length");
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
          },
        ],
      ]),
    };

    const [result] = emitMemberAccess(expr, context);
    expect(printExpression(result)).to.equal("(value.As1()).Length");
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
              resolvedClrType: "js.Uint8Array",
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
    expect(printExpression(result)).to.equal("(value.As1()).Length");
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
      'new global::Tsonic.Runtime.JSArray<string>(items).includes("x")'
    );
  });
});
