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
import { printRuntimeUnionCarrierTypeForIrType } from "../../runtime-union-cases/helpers.js";

const jsValueType: IrType = {
  kind: "referenceType",
  name: "JsValue",
  resolvedClrType: "Tsonic.Runtime.JsValue",
};

describe("Expression Emission", () => {
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
                returnType: jsValueType,
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
            inferredType: jsValueType,
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
    const middlewareCarrier = printRuntimeUnionCarrierTypeForIrType(middlewareLike, [
      {
        kind: "arrayType",
        rank: 1,
        elementType: { kind: "predefinedType", keyword: "string" },
      },
      { kind: "predefinedType", keyword: "string" },
    ]);
    expect(result).to.include(
      `${middlewareCarrier}.From1(new string[] { "ok" })`
    );
    expect(result).not.to.include(".Match<string[]>");
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
      returnType: jsValueType,
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
        {
          kind: "referenceType",
          name: "Router",
          resolvedClrType: "Test.Router",
        },
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

    const middlewareCarrier = printRuntimeUnionCarrierTypeForIrType(middlewareLike, [
      {
        kind: "arrayType",
        rank: 1,
        elementType: identifierType("object"),
      },
      identifierType("global::System.Func", [
        { kind: "predefinedType", keyword: "string" },
        {
          kind: "nullableType",
          underlyingType: { kind: "predefinedType", keyword: "object" },
        },
      ]),
      identifierType("global::Test.Router"),
    ]);
    expect(printExpression(result)).to.equal(
      `${middlewareCarrier}.From2(handler)`
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
              returnType: jsValueType,
            },
            {
              kind: "arrayType",
              elementType: { kind: "referenceType", name: "object" },
              origin: "explicit",
            },
          ],
        },
        {
          kind: "referenceType",
          name: "Router",
          resolvedClrType: "Test.Router",
        },
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
              returnType: jsValueType,
            },
          },
        ],
        inferredType: {
          kind: "arrayType",
          elementType: {
            kind: "functionType",
            parameters: [],
            returnType: jsValueType,
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

    const middlewareCarrier = printRuntimeUnionCarrierTypeForIrType(middlewareLike, [
      {
        kind: "arrayType",
        rank: 1,
        elementType: identifierType("object"),
      },
      identifierType("global::System.Func", [
        {
          kind: "nullableType",
          underlyingType: { kind: "predefinedType", keyword: "object" },
        },
      ]),
      identifierType("global::Test.Router"),
    ]);
    expect(printExpression(result)).to.equal(
      `${middlewareCarrier}.From1(new object[] { handler })`
    );
  });

  it("keeps exact storage-erased recursive array literal arms when wrapping recursive alias unions", () => {
    const handlerType: IrType = {
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
      returnType: { kind: "voidType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const middlewareParamRef: IrType = {
      kind: "referenceType",
      name: "MiddlewareParam",
    };
    const middlewareLikeRef: IrType = {
      kind: "referenceType",
      name: "MiddlewareLike",
    };
    const middlewareParamUnion: IrType = {
      kind: "unionType",
      types: [
        handlerType,
        {
          kind: "arrayType",
          elementType: middlewareParamRef,
          origin: "explicit",
        },
      ],
    };
    const middlewareLikeUnion: IrType = {
      kind: "unionType",
      types: [
        middlewareParamRef,
        routerType,
        {
          kind: "arrayType",
          elementType: middlewareLikeRef,
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
            inferredType: handlerType,
          },
        ],
        inferredType: {
          kind: "arrayType",
          elementType: middlewareLikeRef,
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
        localTypes: new Map([
          [
            "MiddlewareParam",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: middlewareParamUnion,
            },
          ],
          [
            "MiddlewareLike",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: middlewareLikeUnion,
            },
          ],
        ]),
      },
      middlewareLikeRef
    );

    const middlewareCarrier = printRuntimeUnionCarrierTypeForIrType(middlewareLikeUnion, [
      {
        kind: "arrayType",
        rank: 1,
        elementType: identifierType("object"),
      },
      identifierType("global::System.Action", [
        { kind: "predefinedType", keyword: "string" },
      ]),
      identifierType("global::Test.Router"),
    ]);
    expect(printExpression(result)).to.equal(
      `${middlewareCarrier}.From1(new object[] { ${middlewareCarrier}.From2(handler) })`
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

    middlewareLike.types.push(handlerType, routerType, {
      kind: "arrayType",
      elementType: middlewareLike,
      origin: "explicit",
    });

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
      identifierType("global::System.Action", [
        { kind: "predefinedType", keyword: "string" },
      ]),
      identifierType("global::Test.Router"),
    ]);
    expect(text).to.include(`handler.As1()[index] is ${handlerCarrier}`);
    expect(text).to.include(`${handlerCarrier}.From1`);
    expect(text).to.include(`${handlerCarrier}.From2`);
    expect(text).to.include(`${handlerCarrier}.From3`);
    expect(text).to.include("is global::System.Array");
    expect(text).to.not.equal("(handler.As1())[index]");
  });
});
