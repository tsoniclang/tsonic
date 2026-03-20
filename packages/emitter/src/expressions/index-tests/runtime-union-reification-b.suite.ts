import {
  describe,
  it,
  expect,
  emitModule,
  emitExpressionAst,
  printExpression,
  type IrExpression,
  type IrModule,
  type IrType,
} from "./helpers.js";

describe("Expression Emission", () => {
  it("unwraps parameter-passing modifier wrappers before expected-type adaptation", () => {
    for (const wrapperName of ["out", "ref", "In", "inref"] as const) {
      const [result] = emitExpressionAst(
        {
          kind: "identifier",
          name: "value",
          inferredType: {
            kind: "typeParameterType",
            name: "T",
          },
        },
        {
          indentLevel: 0,
          options: {
            rootNamespace: "Test",
            surface: "@tsonic/js",
            indent: 4,
          },
          isStatic: false,
          isAsync: false,
          usings: new Set<string>(),
          typeParameters: new Set(["T"]),
        },
        {
          kind: "referenceType",
          name: wrapperName,
          typeArguments: [{ kind: "typeParameterType", name: "T" }],
        }
      );

      expect(printExpression(result)).to.equal("value");
    }
  });

  it("preserves explicit array assertions when flow narrowing only changes the semantic type", () => {
    const targetType: IrType = {
      kind: "arrayType",
      elementType: { kind: "unknownType" },
      origin: "explicit",
    };

    const [result] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "value",
          inferredType: { kind: "unknownType" },
        },
        targetType,
        inferredType: targetType,
      },
      {
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
            "value",
            {
              kind: "expr",
              exprAst: {
                kind: "identifierExpression",
                identifier: "value",
              },
              type: targetType,
              sourceType: { kind: "unknownType" },
            },
          ],
        ]),
      }
    );

    expect(printExpression(result)).to.equal("(object?[])value");
  });

  it("materializes runtime-union array locals when broad object arrays are expected", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };
    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };
    const middlewareEntryType: IrType = {
      kind: "unionType",
      types: [handlerType, routerType],
    };
    const middlewareEntryArrayType: IrType = {
      kind: "arrayType",
      elementType: middlewareEntryType,
      origin: "explicit",
    };

    const [result] = emitExpressionAst(
      {
        kind: "identifier",
        name: "rest",
        inferredType: middlewareEntryArrayType,
      },
      {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          surface: "@tsonic/js",
          indent: 4,
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
        localNameMap: new Map([["rest", "rest"]]),
        localSemanticTypes: new Map([["rest", middlewareEntryArrayType]]),
        localValueTypes: new Map([["rest", middlewareEntryArrayType]]),
      },
      {
        kind: "arrayType",
        elementType: {
          kind: "referenceType",
          name: "object",
          resolvedClrType: "System.Object",
        },
        origin: "explicit",
      }
    );

    const rendered = printExpression(result);
    expect(rendered).to.include("global::System.Linq.Enumerable.Select");
    expect(rendered).to.include("global::System.Linq.Enumerable.ToArray");
    expect(rendered).to.include("rest");
    expect(rendered).to.include(".Match(");
    expect(rendered).to.not.equal("rest");
  });

  it("prefers throwable storage locals over non-throwable narrowed views", () => {
    const [result] = emitExpressionAst(
      {
        kind: "identifier",
        name: "e",
        inferredType: { kind: "unknownType" },
      },
      {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          surface: "@tsonic/js",
          indent: 4,
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
        localNameMap: new Map([["e", "e"]]),
        localValueTypes: new Map([
          [
            "e",
            {
              kind: "referenceType",
              name: "System.Exception",
              resolvedClrType: "global::System.Exception",
            },
          ],
        ]),
        narrowedBindings: new Map([
          [
            "e",
            {
              kind: "expr",
              exprAst: {
                kind: "castExpression",
                type: {
                  kind: "nullableType",
                  underlyingType: {
                    kind: "predefinedType",
                    keyword: "object",
                  },
                },
                expression: {
                  kind: "identifierExpression",
                  identifier: "e",
                },
              },
              type: { kind: "unknownType" },
            },
          ],
        ]),
      },
      {
        kind: "referenceType",
        name: "System.Exception",
        resolvedClrType: "global::System.Exception",
      }
    );

    expect(printExpression(result)).to.equal("e");
  });

  it("prefers runtime-union carrier guards over narrowed semantic views for Array.isArray", () => {
    const pathSpecArrayType: IrType = {
      kind: "arrayType",
      elementType: { kind: "unknownType" },
      origin: "explicit",
    };
    const pathSpecCarrierType: IrType = {
      kind: "unionType",
      types: [
        pathSpecArrayType,
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "null" },
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    const [result] = emitExpressionAst(
      {
        kind: "call",
        callee: {
          kind: "memberAccess",
          object: { kind: "identifier", name: "Array" },
          property: "isArray",
          isComputed: false,
          isOptional: false,
        },
        arguments: [
          {
            kind: "identifier",
            name: "pathSpec",
            inferredType: pathSpecCarrierType,
          },
        ],
        isOptional: false,
        inferredType: { kind: "primitiveType", name: "boolean" },
      },
      {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          surface: "@tsonic/js",
          indent: 4,
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
        localNameMap: new Map([["pathSpec", "pathSpec"]]),
        localValueTypes: new Map([["pathSpec", pathSpecCarrierType]]),
        narrowedBindings: new Map([
          [
            "pathSpec",
            {
              kind: "expr",
              exprAst: {
                kind: "identifierExpression",
                identifier: "pathSpec",
              },
              storageExprAst: {
                kind: "identifierExpression",
                identifier: "pathSpec",
              },
              type: pathSpecArrayType,
              sourceType: pathSpecCarrierType,
            },
          ],
        ]),
      }
    );

    expect(printExpression(result)).to.equal("pathSpec.Is1()");
  });

  it("recovers identifier storage carriers for Array.isArray after narrowed expr bindings", () => {
    const pathSpecArrayType: IrType = {
      kind: "arrayType",
      elementType: { kind: "unknownType" },
      origin: "explicit",
    };
    const pathSpecCarrierType: IrType = {
      kind: "unionType",
      types: [
        pathSpecArrayType,
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "Test.RegExp",
        },
      ],
    };

    const [result] = emitExpressionAst(
      {
        kind: "call",
        callee: {
          kind: "memberAccess",
          object: { kind: "identifier", name: "Array" },
          property: "isArray",
          isComputed: false,
          isOptional: false,
        },
        arguments: [
          {
            kind: "identifier",
            name: "pathSpec",
            inferredType: pathSpecCarrierType,
          },
        ],
        isOptional: false,
        inferredType: { kind: "primitiveType", name: "boolean" },
      },
      {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          surface: "@tsonic/js",
          indent: 4,
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
        localNameMap: new Map([["pathSpec", "pathSpec"]]),
        localValueTypes: new Map([["pathSpec", pathSpecCarrierType]]),
        narrowedBindings: new Map([
          [
            "pathSpec",
            {
              kind: "expr",
              exprAst: {
                kind: "parenthesizedExpression",
                expression: {
                  kind: "invocationExpression",
                  expression: {
                    kind: "memberAccessExpression",
                    expression: {
                      kind: "identifierExpression",
                      identifier: "pathSpec",
                    },
                    memberName: "As1",
                  },
                  arguments: [],
                },
              },
              storageExprAst: {
                kind: "identifierExpression",
                identifier: "pathSpec",
              },
              type: pathSpecArrayType,
              sourceType: pathSpecCarrierType,
            },
          ],
        ]),
      }
    );

    expect(printExpression(result)).to.equal("pathSpec.Is1()");
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
                memberName: "As1",
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
    expect(text).to.include(
      "handler.As1()[index] is global::Tsonic.Runtime.Union<object?[], global::System.Action, global::Test.Router>"
    );
    expect(text).to.include(
      "global::Tsonic.Runtime.Union<object?[], global::System.Action, global::Test.Router>.From1"
    );
    expect(text).to.include(
      "global::Tsonic.Runtime.Union<object?[], global::System.Action, global::Test.Router>.From2"
    );
    expect(text).to.include(
      "global::Tsonic.Runtime.Union<object?[], global::System.Action, global::Test.Router>.From3"
    );
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
