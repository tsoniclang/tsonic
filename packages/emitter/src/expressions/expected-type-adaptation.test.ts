import { describe, it } from "mocha";
import { expect } from "chai";
import { createContext } from "../emitter-types/context.js";
import {
  identifierExpression,
  parseNumericLiteral,
} from "../core/format/backend-ast/builders.js";
import { printExpression } from "../core/format/backend-ast/printer.js";
import type { IrType } from "@tsonic/frontend";
import {
  adaptEmittedExpressionAst,
  adaptValueToExpectedTypeAst,
} from "./expected-type-adaptation.js";
import {
  maybeBoxJsNumberAsObjectAst,
  maybeCastNumericToExpectedIntegralAst,
  maybeUnwrapNullableValueTypeAst,
} from "./post-emission-adaptation.js";

describe("expected-type-adaptation", () => {
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
    expect(printExpression(result![0])).to.include("first.Match(");
  });

  it("boxes JS numbers as doubles when adapting into unknown/object slots", () => {
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
      { kind: "unknownType" }
    );

    expect(printExpression(boxedAst)).to.equal("(object)(double)42");
  });

  it("boxes JS numbers when expected type is unknown | undefined", () => {
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
        types: [
          { kind: "unknownType" },
          { kind: "primitiveType", name: "undefined" },
        ],
      }
    );

    expect(printExpression(boxedAst)).to.equal("(object)(double)42");
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
      { kind: "unknownType" }
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
          inferredType: { kind: "unknownType" },
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
      { kind: "unknownType" }
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
      expectedType: { kind: "unknownType" },
      allowUnionNarrowing: false,
    });

    expect(result).to.not.equal(undefined);
    expect(printExpression(result![0])).to.include("handler.Match(");
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
            elementType: { kind: "unknownType" },
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
      elementType: { kind: "unknownType" },
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

  it("casts JS numeric expressions into byte expected slots", () => {
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

    expect(printExpression(castAst)).to.equal("(byte)255");
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
