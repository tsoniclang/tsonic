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

  it("uses storage-erased element types for JS array wrapper property access on recursive union arrays", () => {
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
        name: "entries",
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
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.JSArray`1",
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
      localValueTypes: new Map([
        [
          "entries",
          {
            kind: "arrayType",
            elementType: {
              kind: "referenceType",
              name: "object",
              resolvedClrType: "System.Object",
            },
            origin: "explicit",
          } satisfies IrType,
        ],
      ]),
    });

    const text = printExpression(result);
    expect(text).to.include(
      "new global::Tsonic.JSRuntime.JSArray<global::System.Object>(entries).length"
    );
    expect(text).to.not.include(
      "new global::Tsonic.JSRuntime.JSArray<global::Tsonic.Runtime.Union"
    );
  });

  it("uses storage-erased element types for JS array mutation wrappers on recursive union arrays", () => {
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
      kind: "call",
      callee: {
        kind: "memberAccess",
        object: {
          kind: "identifier",
          name: "result",
          inferredType: {
            kind: "arrayType",
            elementType: middlewareLike,
            origin: "explicit",
          },
        },
        property: "push",
        isComputed: false,
        isOptional: false,
        memberBinding: {
          kind: "method",
          assembly: "Tsonic.JSRuntime",
          type: "Tsonic.JSRuntime.JSArray`1",
          member: "push",
        },
      },
      arguments: [
        {
          kind: "identifier",
          name: "router",
          inferredType: routerType,
        },
      ],
      isOptional: false,
      inferredType: { kind: "primitiveType", name: "int" },
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
      localValueTypes: new Map([
        [
          "result",
          {
            kind: "arrayType",
            elementType: {
              kind: "referenceType",
              name: "object",
              resolvedClrType: "System.Object",
            },
            origin: "explicit",
          } satisfies IrType,
        ],
      ]),
    });

    const text = printExpression(result);
    expect(text).to.include(
      "new global::Tsonic.JSRuntime.JSArray<global::System.Object>(result)"
    );
    expect(text).to.not.include(
      "new global::Tsonic.JSRuntime.JSArray<global::Tsonic.Runtime.Union"
    );
  });
});
