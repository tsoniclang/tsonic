import {
  describe,
  it,
  expect,
  emitModule,
  emitExpressionAst,
  emitMemberAccess,
  printExpression,
  jsSurfaceCapabilities,
  type EmitterContext,
  type IrModule,
} from "./helpers.js";

describe("Expression Emission", () => {
  it("should not synthesize JS string length when narrowed receivers only look string-like", () => {
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
              providerQualifiedName: "System.String",
            },
            {
              kind: "referenceType" as const,
              name: "Uint8Array",
              providerQualifiedName: "js.Uint8Array",
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
              providerQualifiedName: "System.String",
            },
          },
        ],
      ]),
    };

    const [result] = emitMemberAccess(expr, context);
    expect(printExpression(result)).to.equal("(value.As1()).length");
  });

  it("should preserve source spelling when narrowed runtime-union bindings omit the narrowed type", () => {
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
              providerQualifiedName: "js.Uint8Array",
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
    expect(printExpression(result)).to.equal("(value.As1()).length");
  });

  it("should use frontend member-binding access for narrowed strings", () => {
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
              providerQualifiedName: "js.Uint8Array",
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

  it("should use narrowed direct storage for runtime-union array length projections", () => {
    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "buffer",
        inferredType: {
          kind: "unionType" as const,
          types: [
            {
              kind: "referenceType" as const,
              name: "Buffer",
              providerQualifiedName: "nodejs.Buffer",
            },
            {
              kind: "arrayType" as const,
              elementType: { kind: "referenceType" as const, name: "byte" },
            },
          ],
          runtimeUnionLayout: "carrierSlotOrder" as const,
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
      memberBinding: {
        kind: "property" as const,
        assembly: "js",
        type: "js.Array",
        member: "length",
      },
    };

    const context: EmitterContext = {
      indentLevel: 0,
      options: {
        rootNamespace: "MyApp",
        surface: "@tsonic/js",
        indent: 4,
        surfaceCapabilities: jsSurfaceCapabilities,
      },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      narrowedBindings: new Map([
        [
          "buffer",
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
                    identifier: "buffer",
                  },
                  memberName: "As1",
                },
                arguments: [],
              },
            },
            storageType: {
              kind: "arrayType" as const,
              elementType: { kind: "referenceType" as const, name: "byte" },
            },
          },
        ],
      ]),
    };

    const [result] = emitMemberAccess(expr, context);
    expect(printExpression(result)).to.equal("(buffer.As1()).Length");
  });

  it("should use runtime-subset source storage for array length projections", () => {
    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "buffer",
        inferredType: {
          kind: "unionType" as const,
          types: [
            {
              kind: "arrayType" as const,
              elementType: { kind: "referenceType" as const, name: "byte" },
            },
            {
              kind: "referenceType" as const,
              name: "Buffer",
              providerQualifiedName: "nodejs.Buffer",
            },
          ],
          runtimeUnionLayout: "carrierSlotOrder" as const,
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
      memberBinding: {
        kind: "property" as const,
        assembly: "js",
        type: "js.Array",
        member: "length",
      },
    };

    const context: EmitterContext = {
      indentLevel: 0,
      options: {
        rootNamespace: "MyApp",
        surface: "@tsonic/js",
        indent: 4,
        surfaceCapabilities: jsSurfaceCapabilities,
      },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      narrowedBindings: new Map([
        [
          "buffer",
          {
            kind: "runtimeSubset" as const,
            runtimeMemberNs: [1],
            runtimeUnionArity: 2,
            sourceType: {
              kind: "arrayType" as const,
              elementType: { kind: "referenceType" as const, name: "byte" },
            },
          },
        ],
      ]),
    };

    const [result] = emitMemberAccess(expr, context);
    expect(printExpression(result)).to.equal("buffer.As1().Length");
  });

  it("should emit native array Length for runtime-union projections without binding metadata", () => {
    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "buffer",
        inferredType: {
          kind: "unionType" as const,
          types: [
            {
              kind: "arrayType" as const,
              elementType: { kind: "referenceType" as const, name: "byte" },
            },
            {
              kind: "referenceType" as const,
              name: "Buffer",
              providerQualifiedName: "nodejs.Buffer",
            },
          ],
          runtimeUnionLayout: "carrierSlotOrder" as const,
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
    };

    const context: EmitterContext = {
      indentLevel: 0,
      options: {
        rootNamespace: "MyApp",
        surface: "@tsonic/js",
        indent: 4,
        surfaceCapabilities: jsSurfaceCapabilities,
      },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
    };

    const [result] = emitMemberAccess(expr, context);
    expect(printExpression(result)).to.equal("buffer.As1().Length");
  });

  it("should emit native array Length for narrowed subset receivers without binding metadata", () => {
    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "buffer",
        inferredType: {
          kind: "unionType" as const,
          types: [
            {
              kind: "arrayType" as const,
              elementType: { kind: "referenceType" as const, name: "byte" },
            },
            {
              kind: "referenceType" as const,
              name: "Buffer",
              providerQualifiedName: "nodejs.Buffer",
            },
          ],
          runtimeUnionLayout: "carrierSlotOrder" as const,
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
    };

    const context: EmitterContext = {
      indentLevel: 0,
      options: {
        rootNamespace: "MyApp",
        surface: "@tsonic/js",
        indent: 4,
        surfaceCapabilities: jsSurfaceCapabilities,
      },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      narrowedBindings: new Map([
        [
          "buffer",
          {
            kind: "runtimeSubset" as const,
            runtimeMemberNs: [1],
            runtimeUnionArity: 2,
            type: {
              kind: "arrayType" as const,
              elementType: { kind: "referenceType" as const, name: "byte" },
            },
            sourceType: {
              kind: "unionType" as const,
              types: [
                {
                  kind: "arrayType" as const,
                  elementType: {
                    kind: "referenceType" as const,
                    name: "byte",
                  },
                },
                {
                  kind: "referenceType" as const,
                  name: "Buffer",
                  providerQualifiedName: "nodejs.Buffer",
                },
              ],
              runtimeUnionLayout: "carrierSlotOrder" as const,
            },
          },
        ],
      ]),
    };

    const [result] = emitMemberAccess(expr, context);
    expect(printExpression(result)).to.equal("buffer.As1().Length");
  });

  it("should not synthesize JS array wrapper calls when member binding is missing", () => {
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
    expect(result).to.include('items.includes("x")');
    expect(result).not.to.include("new global::js.Array<");
  });

  it("should cast computed setter assignment IIFEs to Func<T>", () => {
    const expr = {
      kind: "assignment" as const,
      operator: "=" as const,
      left: {
        kind: "memberAccess" as const,
        object: {
          kind: "identifier" as const,
          name: "buffer",
          inferredType: {
            kind: "referenceType" as const,
            name: "Uint8Array",
          },
        },
        property: {
          kind: "literal" as const,
          value: 0,
          inferredType: {
            kind: "primitiveType" as const,
            name: "int" as const,
          },
        },
        isComputed: true,
        isOptional: false,
        inferredType: {
          kind: "referenceType" as const,
          name: "byte" as const,
          typeId: {
            stableId: "System.Private.CoreLib:System.Byte",
            providerName: "System.Byte",
            ownerIdentity: "System.Private.CoreLib",
            sourceName: "Byte",
          },
        },
        accessKind: "numericIndexer" as const,
        accessProtocol: {
          getterMember: "at",
          setterMember: "set",
        },
      },
      right: {
        kind: "identifier" as const,
        name: "value",
        inferredType: {
          kind: "referenceType" as const,
          name: "byte" as const,
          typeId: {
            stableId: "System.Private.CoreLib:System.Byte",
            providerName: "System.Byte",
            ownerIdentity: "System.Private.CoreLib",
            sourceName: "Byte",
          },
        },
      },
      inferredType: {
        kind: "referenceType" as const,
        name: "byte" as const,
        typeId: {
          stableId: "System.Private.CoreLib:System.Byte",
          providerName: "System.Byte",
          ownerIdentity: "System.Private.CoreLib",
          sourceName: "Byte",
        },
      },
    } as const;

    const context: EmitterContext = {
      indentLevel: 0,
      options: { rootNamespace: "MyApp", surface: "@tsonic/js", indent: 4 },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
    };

    const [result] = emitExpressionAst(expr, context);
    const printed = printExpression(result);
    expect(printed).to.include("((global::System.Func<byte>)(() =>");
    expect(printed).to.include("buffer.set(0, value)");
  });

  it("should preserve nested receiver narrowing for computed write targets", () => {
    const expr = {
      kind: "assignment" as const,
      operator: "=" as const,
      left: {
        kind: "memberAccess" as const,
        object: {
          kind: "identifier" as const,
          name: "target",
          inferredType: {
            kind: "unionType" as const,
            types: [
              {
                kind: "referenceType" as const,
                name: "Buffer",
                providerQualifiedName: "nodejs.Buffer",
              },
              {
                kind: "arrayType" as const,
                elementType: { kind: "referenceType" as const, name: "byte" },
              },
            ],
            runtimeUnionLayout: "carrierSlotOrder" as const,
          },
        },
        property: {
          kind: "identifier" as const,
          name: "index",
          inferredType: { kind: "primitiveType" as const, name: "int" as const },
        },
        isComputed: true,
        isOptional: false,
        inferredType: {
          kind: "referenceType" as const,
          name: "byte" as const,
        },
        accessKind: "numericIndexer" as const,
      },
      right: {
        kind: "identifier" as const,
        name: "value",
        inferredType: {
          kind: "referenceType" as const,
          name: "byte" as const,
        },
      },
      inferredType: {
        kind: "referenceType" as const,
        name: "byte" as const,
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
          "target",
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
                    identifier: "target",
                  },
                  memberName: "As1",
                },
                arguments: [],
              },
            },
            storageType: {
              kind: "arrayType" as const,
              elementType: { kind: "referenceType" as const, name: "byte" },
            },
          },
        ],
      ]),
    };

    const [result] = emitExpressionAst(expr, context);
    expect(printExpression(result)).to.equal("(target.As1())[index] = value");
  });

  it("should route computed getter access through explicit at protocols", () => {
    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "buffer",
        inferredType: {
          kind: "referenceType" as const,
          name: "Uint8Array",
        },
      },
      property: {
        kind: "literal" as const,
        value: 0,
        inferredType: {
          kind: "primitiveType" as const,
          name: "int" as const,
        },
      },
      isComputed: true,
      isOptional: false,
      inferredType: {
        kind: "referenceType" as const,
        name: "byte" as const,
        typeId: {
          stableId: "System.Private.CoreLib:System.Byte",
          providerName: "System.Byte",
          ownerIdentity: "System.Private.CoreLib",
          sourceName: "Byte",
        },
      },
      accessKind: "numericIndexer" as const,
      accessProtocol: {
        getterMember: "at",
      },
    } as const;

    const context: EmitterContext = {
      indentLevel: 0,
      options: { rootNamespace: "MyApp", surface: "@tsonic/js", indent: 4 },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
    };

    const [result] = emitExpressionAst(expr, context);
    const printed = printExpression(result);
    expect(printed).to.equal("buffer.at(0)");
  });
});
