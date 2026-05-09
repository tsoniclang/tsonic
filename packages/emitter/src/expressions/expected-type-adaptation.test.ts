/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
import {
  normalizedUnionType,
  stampRuntimeUnionAliasCarrier,
  type IrType,
} from "@tsonic/frontend";
import {
  normalizeRuntimeUnionCarrierNames,
  printRuntimeUnionCarrierTypeForIrType,
} from "../runtime-union-cases/helpers.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitIdentifier } from "./identifiers.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  adaptEmittedExpressionAst,
  adaptValueToExpectedTypeAst,
  tryEmitCarrierPreservingExpressionAst,
} from "./expected-type-adaptation.js";
import {
  maybeBoxJsNumberAsObjectAst,
  maybeCastNumericToExpectedIntegralAst,
  maybeUnwrapNullableValueTypeAst,
} from "./post-emission-adaptation.js";
import { createRuntimeUnionRegistry } from "../core/semantic/runtime-union-registry.js";

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
        "runtime-union:canonical:prim:string|ref:clr:js.RegExp::",
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
        raw: '"HELLO"',
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

  it("projects runtime-union values into unknown sinks through object match arms", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const actualType: IrType = normalizedUnionType([
      { kind: "primitiveType", name: "string" },
      {
        kind: "referenceType",
        name: "BufferLike",
        resolvedClrType: "Test.BufferLike",
      },
    ]);

    const result = adaptValueToExpectedTypeAst({
      valueAst: identifierExpression("result"),
      actualType,
      context,
      expectedType: { kind: "unknownType", explicit: true },
      allowUnionNarrowing: false,
    });

    expect(result).to.not.equal(undefined);
    expect(printExpression(result![0])).to.equal(
      "result.Match<object>(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => __tsonic_union_member_2)"
    );
  });

  it("projects runtime-union values into object sinks through object match arms", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const actualType: IrType = normalizedUnionType([
      { kind: "primitiveType", name: "string" },
      {
        kind: "referenceType",
        name: "BufferLike",
        resolvedClrType: "Test.BufferLike",
      },
    ]);

    const result = adaptValueToExpectedTypeAst({
      valueAst: identifierExpression("result"),
      actualType,
      context,
      expectedType: {
        kind: "referenceType",
        name: "object",
        resolvedClrType: "System.Object",
      },
      allowUnionNarrowing: false,
    });

    expect(result).to.not.equal(undefined);
    expect(printExpression(result![0])).to.equal(
      "result.Match<object>(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => __tsonic_union_member_2)"
    );
  });

  it("throws on nonmatching runtime-union member projections into concrete sinks", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const actualType: IrType = normalizedUnionType([
      { kind: "primitiveType", name: "string" },
      {
        kind: "referenceType",
        name: "Uint8Array",
        resolvedClrType: "js.Uint8Array",
      },
    ]);

    const result = adaptValueToExpectedTypeAst({
      valueAst: identifierExpression("result"),
      actualType,
      context,
      expectedType: { kind: "primitiveType", name: "string" },
      allowUnionNarrowing: false,
    });

    expect(result).to.not.equal(undefined);
    expect(printExpression(result![0])).to.include(
      "throw new global::System.InvalidCastException("
    );
    expect(printExpression(result![0])).to.not.equal(
      "result.Match<string>(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => __tsonic_union_member_2)"
    );
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

  it("keeps nominal class type assertions as casts instead of structural rematerialization", () => {
    const namesAttributeType: IrType = {
      kind: "referenceType",
      name: "NamesAttribute",
      resolvedClrType: "Test.NamesAttribute",
    };
    const stringArrayType: IrType = {
      kind: "arrayType",
      elementType: { kind: "primitiveType", name: "string" },
      origin: "explicit",
    };
    const context = {
      ...createContext({
        rootNamespace: "Test",
      }),
      localTypes: new Map([
        [
          "NamesAttribute",
          {
            kind: "class" as const,
            typeParameters: [],
            members: [
              {
                kind: "propertyDeclaration" as const,
                name: "Names",
                type: stringArrayType,
                isStatic: false,
                isReadonly: false,
                accessibility: "public" as const,
                isRequired: true,
                initializer: undefined,
                attributes: [],
              },
            ],
            superClass: undefined,
            implements: [],
          },
        ],
      ]),
    };

    const [adaptedAst] = adaptEmittedExpressionAst({
      expr: {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "attribute",
          inferredType: { kind: "referenceType", name: "object" },
        },
        targetType: namesAttributeType,
        inferredType: namesAttributeType,
      },
      valueAst: {
        kind: "castExpression",
        type: identifierType("NamesAttribute"),
        expression: identifierExpression("attribute"),
      },
      context,
      expectedType: namesAttributeType,
    });

    expect(printExpression(adaptedAst)).to.equal("(NamesAttribute)attribute");
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

  it("keeps broad object conditionals on their emitted storage surface", () => {
    const stringArrayType: IrType = {
      kind: "arrayType",
      elementType: { kind: "primitiveType", name: "string" },
      origin: "explicit",
    };
    const numberArrayType: IrType = {
      kind: "arrayType",
      elementType: { kind: "primitiveType", name: "number" },
    };
    const context = {
      ...createContext({
        rootNamespace: "Test",
        surface: "@tsonic/js",
      }),
      localNameMap: new Map<string, string>([["parsed", "parsed"]]),
      localValueTypes: new Map<string, IrType>([["parsed", stringArrayType]]),
      localSemanticTypes: new Map<string, IrType>([
        [
          "parsed",
          {
            kind: "unionType",
            types: [
              stringArrayType,
              { kind: "primitiveType", name: "undefined" },
            ],
          },
        ],
      ]),
    };

    const [adaptedAst] = adaptEmittedExpressionAst({
      expr: {
        kind: "conditional",
        condition: {
          kind: "identifier",
          name: "useJson",
          inferredType: { kind: "primitiveType", name: "boolean" },
        },
        whenTrue: {
          kind: "identifier",
          name: "parsed",
          inferredType: {
            kind: "unionType",
            types: [
              stringArrayType,
              { kind: "primitiveType", name: "undefined" },
            ],
          },
        },
        whenFalse: {
          kind: "array",
          elements: [],
          inferredType: stringArrayType,
        },
        inferredType: {
          kind: "unionType",
          types: [
            numberArrayType,
            stringArrayType,
            { kind: "primitiveType", name: "undefined" },
          ],
        },
      },
      valueAst: {
        kind: "conditionalExpression",
        condition: identifierExpression("useJson"),
        whenTrue: identifierExpression("parsed"),
        whenFalse: {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: identifierExpression("global::System.Array"),
            memberName: "Empty",
          },
          typeArguments: [{ kind: "predefinedType", keyword: "string" }],
          arguments: [],
        },
      },
      context,
      expectedType: jsValueType,
    });

    expect(printExpression(adaptedAst)).to.equal(
      "useJson ? parsed : global::System.Array.Empty<string>()"
    );
  });

  it("reuses storage-compatible identifiers when the function return type is the only context", () => {
    const resultType: IrType = {
      kind: "referenceType",
      name: "Result",
      typeArguments: [
        { kind: "primitiveType", name: "boolean" },
        { kind: "primitiveType", name: "string" },
      ],
      typeId: {
        stableId: "@jotster/core:Jotster.Core.types.Result",
        clrName: "Jotster.Core.types.Result",
        assemblyName: "@jotster/core",
        tsName: "Result",
      },
    };
    const context = {
      ...createContext({
        rootNamespace: "Test",
        surface: "@tsonic/js",
      }),
      localNameMap: new Map<string, string>([
        ["membershipResult", "membershipResult"],
      ]),
      localValueTypes: new Map<string, IrType>([
        ["membershipResult", resultType],
      ]),
      localSemanticTypes: new Map<string, IrType>([
        ["membershipResult", resultType],
      ]),
      returnType: resultType,
    };

    const [identifierAst] = emitIdentifier(
      {
        kind: "identifier",
        name: "membershipResult",
        inferredType: resultType,
      },
      context
    );

    expect(printExpression(identifierAst)).to.equal("membershipResult");
  });

  it("prefers semantic runtime-union aliases over storage-compatible raw carriers", () => {
    const runtimeUnionRegistry = createRuntimeUnionRegistry();
    const okType: IrType = {
      kind: "referenceType",
      name: "Ok",
      resolvedClrType: "Test.Ok",
    };
    const errType: IrType = {
      kind: "referenceType",
      name: "Err",
      resolvedClrType: "Test.Err",
    };
    const resultCarrier = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([okType, errType]),
      {
        aliasName: "ResultLike",
        fullyQualifiedName: "Test.ResultLike",
      }
    ) as Extract<IrType, { kind: "unionType" }>;
    const resultType: IrType = {
      kind: "referenceType",
      name: "ResultLike",
      resolvedClrType: "Test.ResultLike",
    };
    const rawCarrierType = normalizedUnionType([okType, errType]);
    const context = {
      ...createContext({
        rootNamespace: "Test",
        runtimeUnionRegistry,
      }),
      moduleNamespace: "Test",
      localTypes: new Map([
        [
          "ResultLike",
          {
            kind: "typeAlias" as const,
            isExported: true,
            typeParameters: [],
            type: resultCarrier,
          },
        ],
      ]),
      publicLocalTypes: new Set(["ResultLike"]),
      localNameMap: new Map<string, string>([
        ["membershipResult", "membershipResult"],
      ]),
      localValueTypes: new Map<string, IrType>([
        ["membershipResult", rawCarrierType],
      ]),
      localSemanticTypes: new Map<string, IrType>([
        ["membershipResult", resultType],
      ]),
      returnType: resultType,
    };

    const [identifierAst] = emitExpressionAst(
      {
        kind: "identifier",
        name: "membershipResult",
        inferredType: resultType,
      },
      context,
      resultType
    );

    expect(printExpression(identifierAst)).to.equal("membershipResult");
  });

  it("preserves top-level nullish when adapting nullable source-backed values into optional runtime unions", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/nodejs",
    });

    const actualType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "undefined" },
      ],
    };
    const expectedType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
        },
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    const result = adaptValueToExpectedTypeAst({
      valueAst: identifierExpression("header"),
      actualType,
      context,
      expectedType,
      allowUnionNarrowing: false,
    });

    expect(result).to.not.equal(undefined);
    expect(
      normalizeRuntimeUnionCarrierNames(printExpression(result![0]))
    ).to.equal(
      "header == null ? default(global::Tsonic.Internal.Union<string[], string>?) : global::Tsonic.Internal.Union<string[], string>.From2(header)"
    );
  });

  it("rewraps optional source-owned alias arguments through the alias carrier", () => {
    const runtimeUnionRegistry = createRuntimeUnionRegistry();
    const mkdirOptionsLike = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([
        { kind: "primitiveType", name: "boolean" },
        {
          kind: "referenceType",
          name: "MkdirOptions",
          resolvedClrType: "Test.MkdirOptions",
        },
      ]),
      {
        aliasName: "MkdirOptionsLike",
        fullyQualifiedName: "Test.MkdirOptionsLike",
      }
    ) as Extract<IrType, { kind: "unionType" }>;

    const context = {
      ...createContext({
        rootNamespace: "Test",
        runtimeUnionRegistry,
      }),
      moduleNamespace: "Test",
      localTypes: new Map([
        [
          "MkdirOptionsLike",
          {
            kind: "typeAlias" as const,
            isExported: true,
            typeParameters: [],
            type: mkdirOptionsLike,
          },
        ],
      ]),
      publicLocalTypes: new Set(["MkdirOptionsLike"]),
    };

    const expectedType = normalizedUnionType([
      {
        kind: "referenceType",
        name: "MkdirOptionsLike",
        resolvedClrType: "Test.MkdirOptionsLike",
      },
      { kind: "primitiveType", name: "undefined" },
    ]);

    const result = adaptValueToExpectedTypeAst({
      valueAst: identifierExpression("recursive"),
      actualType: { kind: "primitiveType", name: "boolean" },
      context,
      expectedType,
      allowUnionNarrowing: false,
    });

    expect(result).to.not.equal(undefined);
    expect(printExpression(result![0])).to.equal(
      "global::Test.MkdirOptionsLike.From1(recursive)"
    );
  });

  it("wraps subclass storage when contextual array semantics are already the union alias", () => {
    const runtimeUnionRegistry = createRuntimeUnionRegistry();
    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };
    const applicationType: IrType = {
      kind: "referenceType",
      name: "Application",
      resolvedClrType: "Test.Application",
    };
    const middlewareLikeCarrier = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([
        { kind: "primitiveType", name: "string" },
        routerType,
      ]),
      {
        aliasName: "MiddlewareLike",
        fullyQualifiedName: "Test.MiddlewareLike",
      }
    ) as Extract<IrType, { kind: "unionType" }>;
    const middlewareLikeType: IrType = {
      kind: "referenceType",
      name: "MiddlewareLike",
      resolvedClrType: "Test.MiddlewareLike",
    };
    const context = {
      ...createContext({
        rootNamespace: "Test",
        runtimeUnionRegistry,
      }),
      moduleNamespace: "Test",
      localTypes: new Map([
        [
          "Router",
          {
            kind: "class" as const,
            typeParameters: [],
            members: [],
            superClass: undefined,
            implements: [],
          },
        ],
        [
          "Application",
          {
            kind: "class" as const,
            typeParameters: [],
            members: [],
            superClass: routerType,
            implements: [],
          },
        ],
        [
          "MiddlewareLike",
          {
            kind: "typeAlias" as const,
            isExported: true,
            typeParameters: [],
            type: middlewareLikeCarrier,
          },
        ],
      ]),
      publicLocalTypes: new Set(["MiddlewareLike"]),
      localNameMap: new Map([["app", "app"]]),
      localValueTypes: new Map([["app", applicationType]]),
      localSemanticTypes: new Map([["app", middlewareLikeType]]),
    };

    const [arrayAst] = emitExpressionAst(
      {
        kind: "array",
        elements: [
          {
            kind: "identifier",
            name: "app",
            inferredType: middlewareLikeType,
          },
        ],
        inferredType: {
          kind: "arrayType",
          elementType: middlewareLikeType,
          origin: "explicit",
        },
      },
      context,
      {
        kind: "arrayType",
        elementType: middlewareLikeType,
        origin: "explicit",
      }
    );

    const rendered = printExpression(arrayAst);
    expect(rendered).to.match(
      /new global::Test\.MiddlewareLike\[\] \{ global::Test\.MiddlewareLike\.From\d+\((?:\(global::Test\.Router\))?app\) \}/
    );
    expect(rendered).to.not.equal("new global::Test.MiddlewareLike[] { app }");
  });

  it("rewraps numeric runtime-union alias arguments through the selected integral slot", () => {
    const runtimeUnionRegistry = createRuntimeUnionRegistry();
    const typedArrayConstructorInput = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([
        { kind: "primitiveType", name: "int" },
        {
          kind: "referenceType",
          name: "TypedArrayInput",
          resolvedClrType: "js.TypedArrayInput",
          typeArguments: [
            {
              kind: "referenceType",
              name: "byte",
              resolvedClrType: "System.Byte",
            },
          ],
        },
      ]),
      {
        aliasName: "TypedArrayConstructorInput",
        fullyQualifiedName: "js.TypedArrayConstructorInput",
      }
    ) as Extract<IrType, { kind: "unionType" }>;

    const context = {
      ...createContext({
        rootNamespace: "Test",
        runtimeUnionRegistry,
      }),
      moduleNamespace: "js",
      localTypes: new Map([
        [
          "TypedArrayConstructorInput",
          {
            kind: "typeAlias" as const,
            isExported: true,
            typeParameters: ["TElement"],
            type: typedArrayConstructorInput,
          },
        ],
      ]),
      publicLocalTypes: new Set(["TypedArrayConstructorInput"]),
    };

    const expectedType: IrType = {
      kind: "referenceType",
      name: "TypedArrayConstructorInput",
      resolvedClrType: "js.TypedArrayConstructorInput",
      typeArguments: [
        {
          kind: "referenceType",
          name: "byte",
          resolvedClrType: "System.Byte",
        },
      ],
    };

    const binaryResult = adaptValueToExpectedTypeAst({
      valueAst: {
        kind: "binaryExpression",
        operatorToken: "-",
        left: identifierExpression("end"),
        right: identifierExpression("start"),
      },
      actualType: { kind: "primitiveType", name: "int" },
      context,
      expectedType,
      allowUnionNarrowing: false,
    });

    expect(binaryResult).to.not.equal(undefined);
    expect(printExpression(binaryResult![0])).to.equal(
      "global::js.TypedArrayConstructorInput<byte>.From1(end - start)"
    );

    const assertedIntResult = adaptValueToExpectedTypeAst({
      valueAst: {
        kind: "castExpression",
        type: { kind: "predefinedType", keyword: "int" },
        expression: parseNumericLiteral("0"),
      },
      actualType: {
        kind: "referenceType",
        name: "int",
        resolvedClrType: "System.Int32",
      },
      context,
      expectedType,
      allowUnionNarrowing: false,
    });

    expect(assertedIntResult).to.not.equal(undefined);
    expect(printExpression(assertedIntResult![0])).to.equal(
      "global::js.TypedArrayConstructorInput<byte>.From1((int)0)"
    );

    const conditionalResult = adaptValueToExpectedTypeAst({
      valueAst: {
        kind: "conditionalExpression",
        condition: {
          kind: "binaryExpression",
          operatorToken: "==",
          left: identifierExpression("totalLength"),
          right: parseNumericLiteral("0"),
        },
        whenTrue: parseNumericLiteral("1"),
        whenFalse: identifierExpression("totalLength"),
      },
      actualType: { kind: "primitiveType", name: "int" },
      context,
      expectedType,
      allowUnionNarrowing: false,
    });

    expect(conditionalResult).to.not.equal(undefined);
    expect(printExpression(conditionalResult![0])).to.equal(
      "global::js.TypedArrayConstructorInput<byte>.From1(totalLength == 0 ? 1 : totalLength)"
    );
  });

  it("does not cast unproven JS numeric expressions into integral expected slots", () => {
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

    expect(printExpression(castAst)).to.equal("value");
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

  it("does not cast conditional exact-int expressions when actual and expected numeric families already match", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [castAst] = maybeCastNumericToExpectedIntegralAst(
      {
        kind: "conditionalExpression",
        condition: identifierExpression("flag"),
        whenTrue: parseNumericLiteral("1"),
        whenFalse: parseNumericLiteral("2"),
      },
      { kind: "referenceType", name: "int" },
      context,
      { kind: "primitiveType", name: "int" }
    );

    expect(printExpression(castAst)).to.equal("flag ? 1 : 2");
  });

  it("skips nullable exact-int casts for member-access slots when the emitted surface already matches", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const [castAst] = maybeCastNumericToExpectedIntegralAst(
      {
        kind: "memberAccessExpression",
        expression: identifierExpression("query"),
        memberName: "limit",
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

    expect(printExpression(castAst)).to.equal("query.limit");
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

  it("reuses the materialized carrier surface for broad-to-union predicate narrowings", () => {
    const runtimeUnionRegistry = createRuntimeUnionRegistry();
    const middlewareHandlerCarrier = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([
        {
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
          returnType: { kind: "voidType" },
        },
        {
          kind: "functionType",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "err" },
              type: {
                kind: "referenceType",
                name: "object",
                resolvedClrType: "System.Object",
              },
              initializer: undefined,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
        },
      ]),
      {
        aliasName: "MiddlewareHandler",
        fullyQualifiedName: "Test.MiddlewareHandler",
      }
    );
    const middlewareHandlerType: IrType = {
      kind: "referenceType",
      name: "MiddlewareHandler",
      resolvedClrType: "Test.MiddlewareHandler",
    };
    const broadObjectType: IrType = {
      kind: "referenceType",
      name: "object",
      resolvedClrType: "System.Object",
    };

    const context = {
      ...createContext({
        rootNamespace: "Test",
        runtimeUnionRegistry,
      }),
      moduleNamespace: "Test",
      localTypes: new Map([
        [
          "MiddlewareHandler",
          {
            kind: "typeAlias" as const,
            isExported: true,
            typeParameters: [],
            type: middlewareHandlerCarrier,
          },
        ],
      ]),
      publicLocalTypes: new Set(["MiddlewareHandler"]),
      localNameMap: new Map([["handler", "handler"]]),
      localValueTypes: new Map([["handler", broadObjectType]]),
      narrowedBindings: new Map([
        [
          "handler",
          {
            kind: "expr" as const,
            exprAst: {
              kind: "castExpression" as const,
              type: identifierType("MiddlewareHandler"),
              expression: identifierExpression("handler"),
            },
            storageExprAst: identifierExpression("handler"),
            storageType: broadObjectType,
            carrierExprAst: identifierExpression("handler"),
            carrierType: broadObjectType,
            type: middlewareHandlerType,
            sourceType: broadObjectType,
          },
        ],
      ]),
    };

    const result = tryEmitCarrierPreservingExpressionAst({
      expr: {
        kind: "identifier",
        name: "handler",
        inferredType: broadObjectType,
      },
      expectedType: middlewareHandlerType,
      context,
    });

    expect(result).to.not.equal(undefined);
    expect(printExpression(result!.ast)).to.equal("(MiddlewareHandler)handler");
  });
});
