import {
  describe,
  it,
  expect,
  emitExpressionAst,
  printExpression,
  type IrType,
} from "./helpers.js";

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
      returnType: { kind: "unknownType" },
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
          elementType: { kind: "unknownType" },
          origin: "explicit",
        },
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "global::Tsonic.JSRuntime.RegExp",
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
    expect(rendered).to.include("first.Match(");
    expect(rendered).to.include("From1(__tsonic_union_member_1)");
    expect(rendered).to.include("From2(__tsonic_union_member_3)");
    expect(rendered).to.include("From3(__tsonic_union_member_4)");
    expect(rendered).to.include("new global::System.InvalidCastException(");
    expect(rendered).to.not.include(
      "(global::Tsonic.Runtime.Union<object?[], string, global::Tsonic.JSRuntime.RegExp>)first"
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
      returnType: { kind: "unknownType" },
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
          elementType: { kind: "unknownType" },
          origin: "explicit",
        },
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "global::Tsonic.JSRuntime.RegExp",
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
    expect(rendered).to.include("first.Match(");
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
      returnType: { kind: "unknownType" },
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
          elementType: { kind: "unknownType" },
          origin: "explicit",
        },
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "global::Tsonic.JSRuntime.RegExp",
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
    const matchCount = rendered.match(/\.Match\(/g)?.length ?? 0;
    expect(matchCount).to.equal(1);
    expect(rendered).to.not.include(")).Match(");
  });

});
