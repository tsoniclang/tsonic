import {
  describe,
  it,
  expect,
  emitModule,
  emitExpressionAst,
  printExpression,
  createJsSurfaceBindingRegistry,
  storageCarrierMap,
  type IrExpression,
  type IrModule,
  type IrType,
} from "./helpers.js";
import { normalizeRuntimeUnionCarrierNames } from "../../runtime-union-cases/helpers.js";

const jsSurfaceBindingRegistry = createJsSurfaceBindingRegistry();

describe("Expression Emission", () => {
  it("should lower JS-surface array length to native CLR Length", () => {
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
              assembly: "js",
              type: "js.Array",
              member: "length",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      surface: "@tsonic/js",
      bindingRegistry: jsSurfaceBindingRegistry,
    });
    expect(result).to.include("nums.Length");
  });

  it("should lower nullable JS-surface array length to native CLR Length", () => {
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
              assembly: "js",
              type: "js.Array",
              member: "length",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      surface: "@tsonic/js",
      bindingRegistry: jsSurfaceBindingRegistry,
    });
    expect(result).to.include("maybeNums.Length");
  });

  it("should preserve resolved CLR identity while lowering array length natively", () => {
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
              assembly: "js",
              type: "js.Array",
              member: "length",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      surface: "@tsonic/js",
      bindingRegistry: jsSurfaceBindingRegistry,
    });
    expect(result).to.include("attachments.Length");
  });

  it("should lower ReadonlyArray length to native CLR Length", () => {
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
              assembly: "js",
              type: "js.ReadonlyArray",
              member: "length",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      surface: "@tsonic/js",
      bindingRegistry: jsSurfaceBindingRegistry,
    });
    expect(result).to.include("nums.Length");
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
        assembly: "js",
        type: "js.Array",
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
      bindingRegistry: jsSurfaceBindingRegistry,
      localValueTypes: storageCarrierMap([
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
    expect(text).to.equal("entries.Length");
    expect(text).to.not.include("new global::js.Array");
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
          assembly: "js",
          type: "js.Array",
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
      bindingRegistry: jsSurfaceBindingRegistry,
      localValueTypes: storageCarrierMap([
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

    const text = normalizeRuntimeUnionCarrierNames(printExpression(result));
    expect(text).to.include(
      "global::Tsonic.Internal.ArrayInterop.WrapArray(result)"
    );
    expect(text).to.not.include(
      "new global::js.Array<global::Tsonic.Internal.Union"
    );
  });
});
