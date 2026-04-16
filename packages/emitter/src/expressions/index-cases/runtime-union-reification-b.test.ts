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
import { identifierType } from "../../core/format/backend-ast/builders.js";
import {
  normalizeRuntimeUnionCarrierNames,
  printRuntimeUnionCarrierTypeForIrType,
} from "../../runtime-union-cases/helpers.js";

const jsValueType: IrType = {
  kind: "referenceType",
  name: "JsValue",
  resolvedClrType: "Tsonic.Runtime.JsValue",
};

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
    const broadObjectType: IrType = {
      kind: "referenceType",
      name: "object",
      resolvedClrType: "System.Object",
    };

    const targetType: IrType = {
      kind: "arrayType",
      elementType: broadObjectType,
      origin: "explicit",
    };

    const [result] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "value",
          inferredType: broadObjectType,
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
              sourceType: broadObjectType,
            },
          ],
        ]),
      }
    );

    expect(printExpression(result)).to.equal("(object[])value");
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
    expect(rendered).to.include(".Match");
    expect(rendered).to.not.equal("rest");
  });

  it("casts asserted JsValue array elements when targeting generic array element types", () => {
    const targetType: IrType = {
      kind: "arrayType",
      elementType: {
        kind: "typeParameterType",
        name: "TResult",
      },
      origin: "explicit",
    };

    const [result] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "flattened",
          inferredType: {
            kind: "arrayType",
            elementType: jsValueType,
            origin: "explicit",
          },
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
        typeParameters: new Set(["TResult"]),
      }
    );

    const rendered = printExpression(result);
    expect(rendered).to.include("global::System.Linq.Enumerable.Select");
    expect(rendered).to.include("(TResult)__item");
  });

  it("prefers throwable storage locals over non-throwable narrowed views", () => {
    const [result] = emitExpressionAst(
      {
        kind: "identifier",
        name: "e",
        inferredType: jsValueType,
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
              type: jsValueType,
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

  it("does not ICE when storage-surface reuse sees unresolved reference locals", () => {
    const unresolvedTypedArrayType: IrType = {
      kind: "referenceType",
      name: "Uint8Array",
    };

    const [result] = emitExpressionAst(
      {
        kind: "identifier",
        name: "bytes",
        inferredType: unresolvedTypedArrayType,
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
        localNameMap: new Map([["bytes", "bytes"]]),
        localValueTypes: new Map([["bytes", unresolvedTypedArrayType]]),
      }
    );

    expect(printExpression(result)).to.equal("bytes");
  });

  it("reifies broad object arrays into runtime-union element arrays during assertions", () => {
    const streamType: IrType = {
      kind: "referenceType",
      name: "Stream",
      resolvedClrType: "Test.Stream",
    };
    const unionElementType: IrType = {
      kind: "unionType",
      types: [{ kind: "primitiveType", name: "string" }, streamType],
    };
    const [result] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "args",
          inferredType: {
            kind: "arrayType",
            elementType: {
              kind: "referenceType",
              name: "object",
              resolvedClrType: "System.Object",
            },
            origin: "explicit",
          },
        },
        targetType: {
          kind: "arrayType",
          elementType: unionElementType,
          origin: "explicit",
        },
        inferredType: {
          kind: "arrayType",
          elementType: unionElementType,
          origin: "explicit",
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
        localNameMap: new Map([["args", "args"]]),
        localSemanticTypes: new Map([
          [
            "args",
            {
              kind: "arrayType",
              elementType: {
                kind: "referenceType",
                name: "object",
                resolvedClrType: "System.Object",
              },
              origin: "explicit",
            },
          ],
        ]),
        localValueTypes: new Map([
          [
            "args",
            {
              kind: "arrayType",
              elementType: {
                kind: "referenceType",
                name: "object",
                resolvedClrType: "System.Object",
              },
              origin: "explicit",
            },
          ],
        ]),
      }
    );

    const rendered = printExpression(result);
    expect(rendered).to.include("global::System.Linq.Enumerable.Select");
    expect(rendered).to.include("global::System.Linq.Enumerable.ToArray");
    expect(rendered).to.include(".From1(");
    expect(rendered).to.include(".From2(");
    expect(normalizeRuntimeUnionCarrierNames(rendered)).to.not.include(
      "(global::Tsonic.Internal.Union<string, global::Test.Stream>[])args"
    );
  });

  it("uses runtime-union carrier member checks for instanceof expressions", () => {
    const [result] = emitExpressionAst(
      {
        kind: "binary",
        operator: "instanceof",
        left: {
          kind: "identifier",
          name: "result",
          inferredType: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "string" },
              {
                kind: "referenceType",
                name: "Uint8Array",
                resolvedClrType: "global::js.Uint8Array",
              },
            ],
          },
        },
        right: {
          kind: "identifier",
          name: "Uint8Array",
          inferredType: {
            kind: "referenceType",
            name: "Uint8Array",
            resolvedClrType: "global::js.Uint8Array",
          },
        },
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
        localNameMap: new Map([["result", "result"]]),
        localSemanticTypes: new Map([
          [
            "result",
            {
              kind: "unionType",
              types: [
                { kind: "primitiveType", name: "string" },
                {
                  kind: "referenceType",
                  name: "Uint8Array",
                  resolvedClrType: "global::js.Uint8Array",
                },
              ],
            },
          ],
        ]),
        localValueTypes: new Map([
          [
            "result",
            {
              kind: "unionType",
              types: [
                { kind: "primitiveType", name: "string" },
                {
                  kind: "referenceType",
                  name: "Uint8Array",
                  resolvedClrType: "global::js.Uint8Array",
                },
              ],
            },
          ],
        ]),
      }
    );

    const rendered = printExpression(result);
    expect(rendered).to.include("result.Is2()");
    expect(rendered).to.include("!= null");
    expect(rendered).to.not.include(
      "result is global::js.Uint8Array"
    );
  });

  it("keeps runtime-union carrier checks when narrowed bindings expose a non-union surface", () => {
    const keyObjectType: IrType = {
      kind: "referenceType",
      name: "KeyObject",
      resolvedClrType: "global::Test.KeyObject",
    };
    const stringOrKeyObjectType: IrType = {
      kind: "unionType",
      types: [{ kind: "primitiveType", name: "string" }, keyObjectType],
    };

    const [result] = emitExpressionAst(
      {
        kind: "binary",
        operator: "instanceof",
        left: {
          kind: "identifier",
          name: "key",
          inferredType: keyObjectType,
        },
        right: {
          kind: "identifier",
          name: "KeyObject",
          inferredType: keyObjectType,
        },
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
        localNameMap: new Map([["key", "key"]]),
        localSemanticTypes: new Map([["key", keyObjectType]]),
        localValueTypes: new Map([["key", keyObjectType]]),
        narrowedBindings: new Map([
          [
            "key",
            {
              kind: "expr",
              exprAst: {
                kind: "castExpression",
                type: identifierType("global::Test.KeyObject"),
                expression: {
                  kind: "parenthesizedExpression",
                  expression: {
                    kind: "invocationExpression",
                    expression: {
                      kind: "memberAccessExpression",
                      expression: {
                        kind: "identifierExpression",
                        identifier: "key",
                      },
                      memberName: "As2",
                    },
                    arguments: [],
                  },
                },
              },
              storageExprAst: {
                kind: "identifierExpression",
                identifier: "key",
              },
              type: keyObjectType,
              sourceType: stringOrKeyObjectType,
            },
          ],
        ]),
      }
    );

    const rendered = printExpression(result);
    expect(rendered).to.include("key.Is2()");
    expect(rendered).to.not.include("key is global::Test.KeyObject");
  });

  it("prefers runtime-union carrier guards over narrowed semantic views for Array.isArray", () => {
    const pathSpecArrayType: IrType = {
      kind: "arrayType",
      elementType: jsValueType,
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

    expect(printExpression(result)).to.equal(
      "((global::System.Object)(pathSpec)) != null && pathSpec.Is1()"
    );
  });

  it("recovers identifier storage carriers for Array.isArray after narrowed expr bindings", () => {
    const pathSpecArrayType: IrType = {
      kind: "arrayType",
      elementType: jsValueType,
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

    expect(printExpression(result)).to.equal(
      "((global::System.Object)(pathSpec)) != null && pathSpec.Is1()"
    );
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
    const handlerCarrier = printRuntimeUnionCarrierTypeForIrType(middlewareLike, [
      {
        kind: "arrayType",
        rank: 1,
        elementType: identifierType("object"),
      },
      identifierType("global::System.Action"),
      identifierType("global::Test.Router"),
    ]);
    expect(text).to.include(`handler.As1()[index] is ${handlerCarrier}`);
    expect(text).to.include(`${handlerCarrier}.From1`);
    expect(text).to.include(`${handlerCarrier}.From2`);
    expect(text).to.include(`${handlerCarrier}.From3`);
    expect(text).to.include("is global::System.Array");
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
                returnType: jsValueType,
              },
            },
            arguments: [],
            isOptional: false,
            parameterTypes: [tupleRestType],
            inferredType: jsValueType,
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
