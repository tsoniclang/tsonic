import {
  describe,
  it,
  expect,
  emitExpressionAst,
  printExpression,
  type IrExpression,
  type IrType,
} from "./helpers.js";

describe("Expression Emission", () => {
  it("uses storage-erased element types for JS array wrappers on recursive union call results", () => {
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
        kind: "call",
        callee: {
          kind: "identifier",
          name: "flatten",
          inferredType: {
            kind: "functionType",
            parameters: [],
            returnType: {
              kind: "arrayType",
              elementType: middlewareLike,
              origin: "explicit",
            },
          },
        },
        arguments: [],
        isOptional: false,
        inferredType: {
          kind: "arrayType",
          elementType: middlewareLike,
          origin: "explicit",
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
      inferredType: { kind: "primitiveType", name: "int" },
      memberBinding: {
        kind: "property",
        assembly: "js",
        type: "js.Array`1",
        member: "length",
      },
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
    });

    const text = printExpression(result);
    expect(text).to.equal("flatten().Length");
  });

  it("uses storage-erased element types for JS array wrappers on asserted recursive union arrays", () => {
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
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "handlerArray",
          inferredType: middlewareLike,
        },
        targetType: {
          kind: "arrayType",
          elementType: {
            kind: "referenceType",
            name: "object",
            resolvedClrType: "System.Object",
          },
          origin: "explicit",
        },
        inferredType: {
          kind: "arrayType",
          elementType: middlewareLike,
          origin: "explicit",
        },
      },
      property: "length",
      isComputed: false,
      isOptional: false,
      inferredType: { kind: "primitiveType", name: "int" },
      memberBinding: {
        kind: "property",
        assembly: "js",
        type: "js.Array`1",
        member: "length",
      },
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
    });

    const text = printExpression(result);
    expect(text).to.include("handlerArray.Match(");
    expect(text).to.include(".Length");
    expect(text).to.not.include("new global::js.Array<");
  });

  it("uses storage-erased wrapper element types for narrowed recursive union arrays", () => {
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
      property: "length",
      isComputed: false,
      isOptional: false,
      inferredType: { kind: "primitiveType", name: "int" },
      memberBinding: {
        kind: "property",
        assembly: "js",
        type: "js.Array`1",
        member: "length",
      },
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
            sourceType: middlewareLike,
          },
        ],
      ]),
    });

    const text = printExpression(result);
    expect(text).to.equal("handler.As1().Length");
  });
});
