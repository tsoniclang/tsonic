import { describe, it } from "mocha";
import { expect } from "chai";
import { createContext } from "../emitter-types/context.js";
import {
  identifierExpression,
  identifierType,
  parseNumericLiteral,
} from "../core/format/backend-ast/builders.js";
import {
  printExpression,
  printType,
} from "../core/format/backend-ast/printer.js";
import type { IrType } from "@tsonic/frontend";
import { printRuntimeUnionCarrierTypeForIrType } from "../runtime-union-cases/helpers.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  adaptEmittedExpressionAst,
  adaptValueToExpectedTypeAst,
} from "./expected-type-adaptation.js";
import {
  maybeBoxJsNumberAsObjectAst,
  maybeCastNumericToExpectedIntegralAst,
  maybeUnwrapNullableValueTypeAst,
} from "./post-emission-adaptation.js";

const jsValueType: IrType = {
  kind: "referenceType",
  name: "JsValue",
  resolvedClrType: "Tsonic.Runtime.JsValue",
};

describe("expected-type-adaptation", () => {
  it("keeps contextual literal runtime-union materialization on the expected carrier family", () => {
    const regexpType: IrType = {
      kind: "referenceType",
      name: "RegExp",
      resolvedClrType: "js.RegExp",
      typeId: {
        stableId: "@tsonic/js:js.RegExp",
        clrName: "js.RegExp",
        assemblyName: "@tsonic/js",
        tsName: "RegExp",
      },
    };
    const expectedUnion: Extract<IrType, { kind: "unionType" }> = {
      kind: "unionType",
      types: [{ kind: "primitiveType", name: "string" }, regexpType],
      runtimeCarrierFamilyKey:
        "runtime-union:canonical:prim:string|ref#0:clr:js.RegExp::",
    };
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });
    const [expectedTypeAst] = emitTypeAst(expectedUnion, context);
    const [valueAst] = emitExpressionAst(
      {
        kind: "literal",
        value: "HELLO",
        raw: "\"HELLO\"",
        inferredType: { kind: "primitiveType", name: "string" },
      },
      context,
      expectedUnion
    );

    expect(printExpression(valueAst)).to.equal(
      `${printType(expectedTypeAst)}.From1("HELLO")`
    );
  });

  it("uses the shared planner for runtime-union narrowing", () => {
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

    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const result = adaptValueToExpectedTypeAst({
      valueAst: identifierExpression("first"),
      actualType: broadType,
      context,
      expectedType: pathSpecType,
    });

    expect(result).to.not.equal(undefined);
    expect(printExpression(result![0])).to.include("first.Match");
  });

  it("boxes JS numbers as doubles when adapting into JsValue/object slots", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [boxedAst] = maybeBoxJsNumberAsObjectAst(
      parseNumericLiteral("42"),
      {
        kind: "literal",
        value: 42,
        inferredType: { kind: "primitiveType", name: "number" },
      },
      { kind: "primitiveType", name: "number" },
      context,
      jsValueType
    );

    expect(printExpression(boxedAst)).to.equal("(object)(double)42");
  });

  it("boxes JS numbers when expected type is JsValue | undefined", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [boxedAst] = maybeBoxJsNumberAsObjectAst(
      parseNumericLiteral("42"),
      {
        kind: "literal",
        value: 42,
        inferredType: { kind: "primitiveType", name: "number" },
      },
      { kind: "primitiveType", name: "number" },
      context,
      {
        kind: "unionType",
        types: [jsValueType, { kind: "primitiveType", name: "undefined" }],
      }
    );

    expect(printExpression(boxedAst)).to.equal("(object)(double)42");
  });

  it("does not bypass JS-number boxing when emitting numeric values into JsValue slots", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [adaptedAst] = adaptEmittedExpressionAst({
      expr: {
        kind: "literal",
        value: 42,
        inferredType: { kind: "primitiveType", name: "number" },
      },
      valueAst: parseNumericLiteral("42"),
      context,
      expectedType: jsValueType,
    });

    expect(printExpression(adaptedAst)).to.equal("(object)(double)42");
  });

  it("preserves null when boxing nullable JS numbers into object slots", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [boxedAst] = maybeBoxJsNumberAsObjectAst(
      identifierExpression("statusCode"),
      {
        kind: "identifier",
        name: "statusCode",
        inferredType: {
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "number" },
            { kind: "primitiveType", name: "undefined" },
          ],
        },
      },
      {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "undefined" },
        ],
      },
      context,
      jsValueType
    );

    const rendered = printExpression(boxedAst);
    expect(rendered).to.include("(object)statusCode == null");
    expect(rendered).to.include("(object)(double)statusCode");
    expect(rendered).to.not.include(".Value");
  });

  it("does not append .Value when boxing nullable JS numbers that already emit as concrete casts", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [boxedAst] = maybeBoxJsNumberAsObjectAst(
      {
        kind: "castExpression",
        type: { kind: "predefinedType", keyword: "double" },
        expression: {
          kind: "castExpression",
          type: { kind: "predefinedType", keyword: "object" },
          expression: identifierExpression('map.get("value")'),
        },
      },
      {
        kind: "memberAccess",
        object: {
          kind: "identifier",
          name: "map",
          inferredType: jsValueType,
        },
        property: "get",
        isComputed: false,
        isOptional: false,
        inferredType: {
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "number" },
            { kind: "primitiveType", name: "undefined" },
          ],
        },
      },
      {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "undefined" },
        ],
      },
      context,
      jsValueType
    );

    const rendered = printExpression(boxedAst);
    expect(rendered).to.include('(object)(double)(object)map.get("value")');
    expect(rendered).to.not.include(".Value");
  });

  it("materializes runtime-union values when broad object slots are expected", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };
    const valueType: IrType = {
      kind: "unionType",
      types: [handlerType, routerType],
    };

    const result = adaptValueToExpectedTypeAst({
      valueAst: identifierExpression("handler"),
      actualType: valueType,
      context,
      expectedType: jsValueType,
      allowUnionNarrowing: false,
    });

    expect(result).to.not.equal(undefined);
    expect(printExpression(result![0])).to.include("handler.Match");
  });

  it("selects the exact runtime-union array arm for generic call returns", () => {
    const context = {
      ...createContext({
        rootNamespace: "Test",
        surface: "@tsonic/js",
      }),
      typeParameters: new Set<string>(["T", "TResult"]),
    };

    const exactArrayReturnType: IrType = {
      kind: "arrayType",
      elementType: {
        kind: "typeParameterType",
        name: "T",
      },
      origin: "explicit",
    };
    const expectedUnionType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: {
            kind: "primitiveType",
            name: "string",
          },
          origin: "explicit",
        },
        exactArrayReturnType,
        {
          kind: "arrayType",
          elementType: {
            kind: "typeParameterType",
            name: "TResult",
          },
          origin: "explicit",
        },
      ],
    };

    const [adaptedAst] = adaptEmittedExpressionAst({
      expr: {
        kind: "call",
        callee: {
          kind: "identifier",
          name: "mapIterable",
          inferredType: {
            kind: "functionType",
            typeParameters: [
              {
                kind: "typeParameter",
                name: "T",
                isStructuralConstraint: false,
              },
            ],
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "source" },
                type: {
                  kind: "referenceType",
                  name: "Iterable",
                  typeArguments: [
                    {
                      kind: "typeParameterType",
                      name: "T",
                    },
                  ],
                },
                initializer: undefined,
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: exactArrayReturnType,
          },
        },
        arguments: [
          {
            kind: "typeAssertion",
            expression: {
              kind: "identifier",
              name: "source",
              inferredType: {
                kind: "referenceType",
                name: "Iterable",
                typeArguments: [
                  {
                    kind: "typeParameterType",
                    name: "T",
                  },
                ],
              },
            },
            targetType: {
              kind: "referenceType",
              name: "Iterable",
              typeArguments: [
                {
                  kind: "typeParameterType",
                  name: "T",
                },
              ],
            },
            inferredType: {
              kind: "referenceType",
              name: "Iterable",
              typeArguments: [
                {
                  kind: "typeParameterType",
                  name: "T",
                },
              ],
            },
          },
        ],
        isOptional: false,
        inferredType: exactArrayReturnType,
        allowUnknownInferredType: true,
      },
      valueAst: {
        kind: "invocationExpression",
        expression: identifierExpression("mapIterable"),
        arguments: [
          {
            kind: "invocationExpression",
            expression: {
              kind: "memberAccessExpression",
              expression: identifierExpression("source"),
              memberName: "As1",
            },
            arguments: [],
          },
        ],
      },
      context,
      expectedType: expectedUnionType,
    });

    const unionType = printRuntimeUnionCarrierTypeForIrType(expectedUnionType, [
      {
        kind: "arrayType",
        rank: 1,
        elementType: { kind: "predefinedType", keyword: "string" },
      },
      {
        kind: "arrayType",
        rank: 1,
        elementType: identifierType("T"),
      },
      {
        kind: "arrayType",
        rank: 1,
        elementType: identifierType("TResult"),
      },
    ]);

    expect(printExpression(adaptedAst)).to.equal(
      `${unionType}.From2(mapIterable(source.As1()))`
    );
  });

  it("does not re-project asserted arrays when the emitted cast already matches the expected surface", () => {
    const context = {
      ...createContext({
        rootNamespace: "Test",
        surface: "@tsonic/js",
      }),
      localValueTypes: new Map<string, IrType>([
        [
          "args",
          {
            kind: "arrayType",
            elementType: jsValueType,
            origin: "explicit",
          },
        ],
      ]),
    };

    const callbackType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "error" },
          type: {
            kind: "unionType",
            types: [
              {
                kind: "referenceType",
                name: "Error",
                resolvedClrType: "global::js.Error",
              },
              { kind: "primitiveType", name: "undefined" },
            ],
          },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "voidType" },
    };
    const streamType: IrType = {
      kind: "referenceType",
      name: "Stream",
      resolvedClrType: "Test.Stream",
    };

    const assertedRestArrayType: IrType = {
      kind: "arrayType",
      elementType: {
        kind: "unionType",
        types: [streamType, callbackType],
      },
      tuplePrefixElementTypes: [streamType],
      tupleRestElementType: {
        kind: "unionType",
        types: [streamType, callbackType],
      },
      origin: "explicit",
    };

    const expectedArrayType: IrType = {
      kind: "arrayType",
      elementType: jsValueType,
      origin: "explicit",
    };

    const [adaptedAst] = adaptEmittedExpressionAst({
      expr: {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "args",
          inferredType: expectedArrayType,
        },
        targetType: assertedRestArrayType,
        inferredType: assertedRestArrayType,
      },
      valueAst: {
        kind: "castExpression",
        type: {
          kind: "arrayType",
          elementType: {
            kind: "nullableType",
            underlyingType: { kind: "predefinedType", keyword: "object" },
          },
          rank: 1,
        },
        expression: {
          kind: "castExpression",
          type: { kind: "predefinedType", keyword: "object" },
          expression: identifierExpression("args"),
        },
      },
      context,
      expectedType: expectedArrayType,
    });

    expect(printExpression(adaptedAst)).to.equal("(object?[])(object)args");
  });

  it("keeps locally declared Array<T> classes nominal during expected-type adaptation", () => {
    const localArrayType: IrType = {
      kind: "referenceType",
      name: "Array",
      typeArguments: [{ kind: "typeParameterType", name: "TResult" }],
    };

    const context = {
      ...createContext({
        rootNamespace: "Test",
        surface: "@tsonic/js",
      }),
      typeParameters: new Set<string>(["TResult"]),
      localNameMap: new Map<string, string>([["array", "array"]]),
      localSemanticTypes: new Map<string, IrType>([["array", localArrayType]]),
      localValueTypes: new Map<string, IrType>([["array", localArrayType]]),
      localTypes: new Map([
        [
          "Array",
          {
            kind: "class" as const,
            typeParameters: ["TResult"],
            members: [],
            superClass: undefined,
            implements: [],
          },
        ],
      ]),
    };

    const [adaptedAst] = adaptEmittedExpressionAst({
      expr: {
        kind: "identifier",
        name: "array",
        inferredType: localArrayType,
      },
      valueAst: identifierExpression("array"),
      context,
      expectedType: localArrayType,
    });

    expect(printExpression(adaptedAst)).to.equal("array");
  });

  it("does not rematerialize nullable array-return calls when source and target emit the same surface", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const listenerType: IrType = {
      kind: "referenceType",
      name: "ListenerRegistration",
      resolvedClrType: "Test.ListenerRegistration__Alias",
    };
    const actualType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "referenceType",
          name: "Array",
          typeArguments: [listenerType],
        },
        { kind: "primitiveType", name: "undefined" },
      ],
    };
    const expectedType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: listenerType,
          origin: "explicit",
        },
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    const result = adaptValueToExpectedTypeAst({
      valueAst: {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression("listenersByEvent"),
          memberName: "get",
        },
        arguments: [identifierExpression("eventName")],
      },
      actualType,
      context,
      expectedType,
      allowUnionNarrowing: false,
    });

    expect(result).to.not.equal(undefined);
    expect(printExpression(result![0])).to.equal(
      "listenersByEvent.get(eventName)"
    );
  });

  it("casts JS numeric expressions into integral expected slots", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [castAst] = maybeCastNumericToExpectedIntegralAst(
      identifierExpression("value"),
      { kind: "primitiveType", name: "number" },
      context,
      { kind: "primitiveType", name: "int" }
    );

    expect(printExpression(castAst)).to.equal("(int)value");
  });

  it("does not cast representable integral literals into byte expected slots", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [castAst] = maybeCastNumericToExpectedIntegralAst(
      parseNumericLiteral("255"),
      { kind: "primitiveType", name: "number" },
      context,
      {
        kind: "referenceType",
        name: "byte",
        typeId: {
          stableId: "System.Private.CoreLib:System.Byte",
          clrName: "System.Byte",
          assemblyName: "System.Private.CoreLib",
          tsName: "Byte",
        },
      }
    );

    expect(printExpression(castAst)).to.equal("255");
  });

  it("does not cast representable negative integral literals into exact int slots", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [castAst] = maybeCastNumericToExpectedIntegralAst(
      {
        kind: "prefixUnaryExpression",
        operatorToken: "-",
        operand: parseNumericLiteral("1"),
      },
      { kind: "primitiveType", name: "number" },
      context,
      { kind: "primitiveType", name: "int" }
    );

    expect(printExpression(castAst)).to.equal("-1");
  });

  it("does not layer an identical nullable exact-int cast twice", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [castAst] = maybeCastNumericToExpectedIntegralAst(
      {
        kind: "castExpression",
        type: {
          kind: "nullableType",
          underlyingType: { kind: "predefinedType", keyword: "int" },
        },
        expression: identifierExpression("query.limit"),
      },
      {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "undefined" },
        ],
      },
      context,
      {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "undefined" },
        ],
      }
    );

    expect(printExpression(castAst)).to.equal("(int?)query.limit");
  });

  it("does not append .Value when the emitted AST already casts to a concrete value type", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [unwrappedAst] = maybeUnwrapNullableValueTypeAst(
      {
        kind: "memberAccess",
        object: {
          kind: "identifier",
          name: "options",
          inferredType: { kind: "referenceType", name: "MarkOptions" },
        },
        property: "startTime",
        isComputed: false,
        isOptional: false,
        inferredType: {
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "number" },
            { kind: "primitiveType", name: "null" },
          ],
        },
      },
      {
        kind: "castExpression",
        type: { kind: "predefinedType", keyword: "double" },
        expression: {
          kind: "castExpression",
          type: { kind: "predefinedType", keyword: "object" },
          expression: identifierExpression("options.startTime"),
        },
      },
      context,
      { kind: "primitiveType", name: "number" }
    );

    expect(printExpression(unwrappedAst)).to.equal(
      "(double)(object)options.startTime"
    );
  });
});
