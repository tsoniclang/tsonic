import {
  describe,
  it,
  expect,
  emitExpressionAst,
  printExpression,
  type IrType,
} from "./helpers.js";

const jsValueType: IrType = {
  kind: "referenceType",
  name: "JsValue",
  resolvedClrType: "Tsonic.Runtime.JsValue",
};

describe("Expression Emission", () => {
  it("reifies explicit runtime union narrowing casts through Match instead of raw CLR casts", () => {
    const requestHandlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "req" },
          type: {
            kind: "referenceType",
            name: "Request",
            resolvedClrType: "Test.Request",
          },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: jsValueType,
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const pathSpecType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: jsValueType,
          origin: "explicit",
        },
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "global::js.RegExp",
        },
      ],
    };

    const broadType: IrType = {
      kind: "unionType",
      types: [...pathSpecType.types, routerType, requestHandlerType],
    };

    const [result] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "first",
          inferredType: broadType,
        },
        targetType: pathSpecType,
        inferredType: pathSpecType,
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
      }
    );

    const rendered = printExpression(result);
    expect(rendered).to.include("first.Match");
    expect(rendered).to.include("From1(__tsonic_union_member_1)");
    expect(rendered).to.include("From2(__tsonic_union_member_3)");
    expect(rendered).to.include("From3(__tsonic_union_member_4)");
    expect(rendered).to.include("new global::System.InvalidCastException(");
    expect(rendered).to.not.include(
      "(global::Tsonic.Runtime.Union<object?[], string, global::js.RegExp>)first"
    );
  });

  it("narrows runtime-subset identifiers through the full runtime-union arity", () => {
    const requestHandlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "req" },
          type: {
            kind: "referenceType",
            name: "Request",
            resolvedClrType: "Test.Request",
          },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: jsValueType,
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const pathSpecType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: jsValueType,
          origin: "explicit",
        },
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "global::js.RegExp",
        },
      ],
    };

    const broadType: IrType = {
      kind: "unionType",
      types: [...pathSpecType.types, routerType, requestHandlerType],
    };

    const [result] = emitExpressionAst(
      {
        kind: "identifier",
        name: "first",
        inferredType: broadType,
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
            "first",
            {
              kind: "runtimeSubset",
              runtimeMemberNs: [1, 3, 4],
              runtimeUnionArity: 5,
              type: pathSpecType,
            },
          ],
        ]),
      },
      pathSpecType
    );

    const rendered = printExpression(result);
    expect(rendered).to.include("first.Match");
    expect(rendered).to.include("__tsonic_union_member_5");
    expect(rendered).to.include("new global::System.InvalidCastException(");
  });

  it("does not re-wrap runtime-union assertions that already materialize the target union", () => {
    const requestHandlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "req" },
          type: {
            kind: "referenceType",
            name: "Request",
            resolvedClrType: "Test.Request",
          },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: jsValueType,
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const pathSpecType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: jsValueType,
          origin: "explicit",
        },
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "global::js.RegExp",
        },
      ],
    };

    const broadType: IrType = {
      kind: "unionType",
      types: [...pathSpecType.types, routerType, requestHandlerType],
    };

    const [result] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "first",
          inferredType: broadType,
        },
        targetType: pathSpecType,
        inferredType: pathSpecType,
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
      },
      pathSpecType
    );

    const rendered = printExpression(result);
    const matchCount = rendered.match(/\.Match(?:<|\()/g)?.length ?? 0;
    expect(matchCount).to.equal(1);
    expect(rendered).to.not.include(")).Match");
  });

  it("preserves source carrier storage when expr-narrowed assertions emit the original identifier", () => {
    const callbackType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const bindOptionsType: IrType = {
      kind: "referenceType",
      name: "BindOptions",
      resolvedClrType: "Test.BindOptions",
    };

    const broadType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "int" },
        callbackType,
        bindOptionsType,
      ],
    };

    const narrowedType: IrType = {
      kind: "unionType",
      types: [{ kind: "primitiveType", name: "int" }, bindOptionsType],
    };

    const optionalIntType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "int" },
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    const [result] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "value",
          inferredType: narrowedType,
        },
        targetType: optionalIntType,
        inferredType: optionalIntType,
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
        localNameMap: new Map([["value", "value"]]),
        narrowedBindings: new Map([
          [
            "value",
            {
              kind: "expr",
              exprAst: {
                kind: "identifierExpression",
                identifier: "value",
              },
              storageExprAst: {
                kind: "identifierExpression",
                identifier: "value",
              },
              type: narrowedType,
              sourceType: broadType,
            },
          ],
        ]),
      }
    );

    const rendered = printExpression(result);
    expect(rendered).to.include("value.Match");
    expect(rendered).to.not.include(
      "((global::Tsonic.Runtime.Union<int, Test.BindOptions>?)value).Match"
    );
  });

  it("reprojects nested runtime-subset assertions from the source carrier instead of raw subset casts", () => {
    const callbackType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const bindOptionsType: IrType = {
      kind: "referenceType",
      name: "BindOptions",
      resolvedClrType: "Test.BindOptions",
    };

    const broadType: IrType = {
      kind: "unionType",
      types: [
        callbackType,
        { kind: "primitiveType", name: "int" },
        bindOptionsType,
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    const bindLikeType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "int" },
        bindOptionsType,
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    const optionalIntType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "int" },
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    const [result] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "typeAssertion",
          expression: {
            kind: "identifier",
            name: "value",
            inferredType: broadType,
          },
          targetType: bindLikeType,
          inferredType: bindLikeType,
        },
        targetType: optionalIntType,
        inferredType: optionalIntType,
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
              kind: "runtimeSubset",
              runtimeMemberNs: [2, 3, 4],
              runtimeUnionArity: 4,
              sourceMembers: [...broadType.types],
              sourceCandidateMemberNs: [1, 2, 3, 4],
              type: bindLikeType,
              sourceType: broadType,
            },
          ],
        ]),
      }
    );

    const rendered = printExpression(result);
    expect(rendered).to.include("value.Match");
    expect(rendered).to.not.include(
      "((global::Tsonic.Runtime.Union<int, Test.BindOptions>?)value).Match"
    );
  });
});
