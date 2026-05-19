import {
  describe,
  it,
  expect,
  emitExpressionAst,
  printExpression,
  storageCarrierMap,
  type IrType,
} from "./helpers.js";
import { normalizeRuntimeUnionCarrierNames } from "../../runtime-union-cases/helpers.js";

const jsValueType: IrType = {
  kind: "referenceType",
  name: "JsValue",
  providerQualifiedName: "Tsonic.Runtime.JsValue",
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
            providerQualifiedName: "Test.Request",
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
      providerQualifiedName: "Test.Router",
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
          providerQualifiedName: "global::js.RegExp",
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

    const rendered = normalizeRuntimeUnionCarrierNames(printExpression(result));
    expect(rendered).to.include("first.Match");
    expect(rendered).to.include("From1(__tsonic_union_member_1)");
    expect(rendered).to.include("From2(__tsonic_union_member_3)");
    expect(rendered).to.include("From3(__tsonic_union_member_4)");
    expect(rendered).to.include("new global::System.InvalidCastException(");
    expect(rendered).to.not.include(
      "(global::Tsonic.Internal.Union<object?[], string, global::js.RegExp>)first"
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
            providerQualifiedName: "Test.Request",
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
      providerQualifiedName: "Test.Router",
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
          providerQualifiedName: "global::js.RegExp",
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

    const rendered = normalizeRuntimeUnionCarrierNames(printExpression(result));
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
            providerQualifiedName: "Test.Request",
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
      providerQualifiedName: "Test.Router",
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
          providerQualifiedName: "global::js.RegExp",
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
      providerQualifiedName: "Test.BindOptions",
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
      "((global::Tsonic.Internal.Union<int, Test.BindOptions>?)value).Match"
    );
  });

  it("reuses the original expr-narrowed carrier when the expected surface is the full union", () => {
    const bytesType: IrType = {
      kind: "referenceType",
      name: "Bytes",
      providerQualifiedName: "Test.Bytes",
    };

    const broadType: IrType = {
      kind: "unionType",
      types: [bytesType, { kind: "primitiveType", name: "string" }],
    };

    const [result] = emitExpressionAst(
      {
        kind: "identifier",
        name: "key",
        inferredType: { kind: "primitiveType", name: "string" },
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
        localValueTypes: storageCarrierMap([["key", broadType]]),
        narrowedBindings: new Map([
          [
            "key",
            {
              kind: "expr",
              exprAst: {
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
              storageExprAst: {
                kind: "identifierExpression",
                identifier: "key",
              },
              carrierExprAst: {
                kind: "identifierExpression",
                identifier: "key",
              },
              type: { kind: "primitiveType", name: "string" },
              sourceType: broadType,
            },
          ],
        ]),
      },
      broadType
    );

    const rendered = printExpression(result);
    expect(rendered).to.equal("key");
  });

  it("reuses the original runtime-subset carrier when the expected surface is the full union", () => {
    const bytesType: IrType = {
      kind: "referenceType",
      name: "Bytes",
      providerQualifiedName: "Test.Bytes",
    };

    const broadType: IrType = {
      kind: "unionType",
      types: [{ kind: "primitiveType", name: "string" }, bytesType],
    };

    const [result] = emitExpressionAst(
      {
        kind: "identifier",
        name: "key",
        inferredType: { kind: "primitiveType", name: "string" },
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
        localValueTypes: storageCarrierMap([["key", broadType]]),
        narrowedBindings: new Map([
          [
            "key",
            {
              kind: "runtimeSubset",
              runtimeMemberNs: [2],
              runtimeUnionArity: 2,
              type: { kind: "primitiveType", name: "string" },
              sourceType: broadType,
            },
          ],
        ]),
      },
      broadType
    );

    const rendered = printExpression(result);
    expect(rendered).to.equal("key");
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
      providerQualifiedName: "Test.BindOptions",
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

    const rendered = normalizeRuntimeUnionCarrierNames(printExpression(result));
    expect(rendered).to.include("value.Match");
    expect(rendered).to.not.include(
      "((global::Tsonic.Internal.Union<int, Test.BindOptions>?)value).Match"
    );
  });

  it("passes the original alias carrier into broad predicate parameters after complement narrowing", () => {
    const rsaType: IrType = {
      kind: "referenceType",
      name: "RSA",
      providerQualifiedName: "Test.RSA",
    };
    const dsaType: IrType = {
      kind: "referenceType",
      name: "DSA",
      providerQualifiedName: "Test.DSA",
    };
    const ecDsaType: IrType = {
      kind: "referenceType",
      name: "ECDsa",
      providerQualifiedName: "Test.ECDsa",
    };
    const nullType: IrType = { kind: "primitiveType", name: "null" };
    const nativeKeyType: IrType = {
      kind: "unionType",
      types: [rsaType, dsaType, ecDsaType, nullType],
      runtimeUnionLayout: "carrierSlotOrder",
      runtimeCarrierFamilyKey: "runtime-union:alias:Test.NativeAsymmetricKey",
      runtimeCarrierName: "NativeAsymmetricKey",
      runtimeCarrierNamespace: "Test",
      runtimeCarrierTypeParameters: [],
    };
    const nativeKeyRef: IrType = {
      kind: "referenceType",
      name: "NativeAsymmetricKey",
      providerQualifiedName: "Test.NativeAsymmetricKey",
    };
    const remainingKeyTypes: IrType = {
      kind: "unionType",
      types: [dsaType, ecDsaType],
      runtimeUnionLayout: "carrierSlotOrder",
      runtimeCarrierFamilyKey: "runtime-union:anonymous:remaining-key-types",
      runtimeCarrierName: "Union2_RemainingKeyTypes",
      runtimeCarrierNamespace: "Tsonic.Internal",
    };
    const narrowedPredicateArgumentType: IrType = {
      kind: "unionType",
      types: [nullType, ecDsaType],
    };
    const predicateType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "value" },
          type: nativeKeyRef,
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "primitiveType", name: "boolean" },
    };

    const [result] = emitExpressionAst(
      {
        kind: "call",
        callee: {
          kind: "identifier",
          name: "isEcDsaKey",
          inferredType: predicateType,
        },
        arguments: [
          {
            kind: "typeAssertion",
            expression: {
              kind: "identifier",
              name: "nativeKeyData",
              inferredType: narrowedPredicateArgumentType,
            },
            targetType: narrowedPredicateArgumentType,
            inferredType: narrowedPredicateArgumentType,
          },
        ],
        isOptional: false,
        inferredType: { kind: "primitiveType", name: "boolean" },
        parameterTypes: [nativeKeyType],
        surfaceParameterTypes: [nativeKeyRef],
        narrowing: {
          kind: "typePredicate",
          argIndex: 0,
          targetType: ecDsaType,
        },
      },
      {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          surface: "@tsonic/js",
          indent: 4,
          moduleMap: new Map([
            [
              "src/key-object.ts",
              {
                namespace: "Test",
                className: "KeyObject",
                filePath: "src/key-object.ts",
                hasRuntimeContainer: true,
                hasTypeCollision: false,
                exportedValueKinds: undefined,
                localTypes: new Map([
                  [
                    "NativeAsymmetricKey",
                    {
                      kind: "typeAlias",
                      typeParameters: [],
                      type: nativeKeyType,
                    },
                  ],
                ]),
              },
            ],
          ]),
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
        localValueTypes: storageCarrierMap([["nativeKeyData", nativeKeyType]]),
        valueSymbols: new Map([
          [
            "isEcDsaKey",
            {
              kind: "function",
              csharpName: "isEcDsaKey",
              type: predicateType,
            },
          ],
        ]),
        narrowedBindings: new Map([
          [
            "nativeKeyData",
            {
              kind: "runtimeSubset",
              runtimeMemberNs: [2, 3],
              runtimeUnionArity: 4,
              sourceMembers: [rsaType, dsaType, ecDsaType, nullType],
              sourceCandidateMemberNs: [1, 2, 3, 4],
              type: remainingKeyTypes,
              sourceType: nativeKeyType,
            },
          ],
        ]),
      }
    );

    const rendered = printExpression(result);
    expect(rendered).to.equal("isEcDsaKey(nativeKeyData)");
  });
});
