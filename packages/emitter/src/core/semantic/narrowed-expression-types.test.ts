import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrExpression, IrType } from "@tsonic/frontend";
import {
  resolveEffectiveExpressionType,
  tryResolveRuntimeUnionMemberType,
} from "./narrowed-expression-types.js";
import type { EmitterContext, LocalTypeInfo } from "../../types.js";

describe("narrowed-expression-types", () => {
  const createContext = (
    localTypes: ReadonlyMap<string, LocalTypeInfo>,
    narrowedType: IrType
  ): EmitterContext => ({
    indentLevel: 0,
    options: {
      rootNamespace: "Test",
      indent: 4,
    },
    isStatic: false,
    isAsync: false,
    localTypes,
    usings: new Set<string>(),
    narrowedBindings: new Map([
      [
        "value",
        {
          kind: "rename" as const,
          name: "value__is_1",
          type: narrowedType,
        },
      ],
    ]),
  });

  it("recomputes member types from narrowed class receivers", () => {
    const localTypes = new Map<string, LocalTypeInfo>([
      [
        "BoolValue",
        {
          kind: "class",
          typeParameters: [],
          superClass: undefined,
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "value",
              type: { kind: "primitiveType", name: "boolean" },
              isReadonly: true,
              initializer: undefined,
              accessibility: "public",
              isStatic: false,
            },
          ],
        },
      ],
    ]);

    const expr: IrExpression = {
      kind: "memberAccess",
      object: {
        kind: "identifier",
        name: "value",
        inferredType: { kind: "referenceType", name: "TemplateValue" },
      },
      property: "value",
      isComputed: false,
      isOptional: false,
      inferredType: { kind: "primitiveType", name: "string" },
    };

    const result = resolveEffectiveExpressionType(
      expr,
      createContext(localTypes, { kind: "referenceType", name: "BoolValue" })
    );

    expect(result).to.deep.equal({ kind: "primitiveType", name: "boolean" });
  });

  it("recomputes collection member types from narrowed class receivers", () => {
    const localTypes = new Map<string, LocalTypeInfo>([
      [
        "AnyArrayValue",
        {
          kind: "class",
          typeParameters: [],
          superClass: undefined,
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "value",
              type: {
                kind: "arrayType",
                elementType: { kind: "primitiveType", name: "string" },
              },
              isReadonly: true,
              initializer: undefined,
              accessibility: "public",
              isStatic: false,
            },
          ],
        },
      ],
    ]);

    const expr: IrExpression = {
      kind: "memberAccess",
      object: {
        kind: "identifier",
        name: "value",
        inferredType: { kind: "referenceType", name: "TemplateValue" },
      },
      property: "value",
      isComputed: false,
      isOptional: false,
      inferredType: { kind: "referenceType", name: "ICollection" },
    };

    const result = resolveEffectiveExpressionType(
      expr,
      createContext(localTypes, {
        kind: "referenceType",
        name: "AnyArrayValue",
      })
    );

    expect(result).to.deep.equal({
      kind: "arrayType",
      elementType: { kind: "primitiveType", name: "string" },
    });
  });

  it("uses assertion target types for explicit type assertions", () => {
    const expr: IrExpression = {
      kind: "typeAssertion",
      expression: {
        kind: "identifier",
        name: "value",
        inferredType: {
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "string" },
            { kind: "primitiveType", name: "number" },
          ],
        },
      },
      targetType: { kind: "primitiveType", name: "string" },
      inferredType: {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" },
        ],
      },
    };

    const result = resolveEffectiveExpressionType(expr, {
      indentLevel: 0,
      options: {
        rootNamespace: "Test",
        indent: 4,
      },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
    });

    expect(result).to.deep.equal({ kind: "primitiveType", name: "string" });
  });

  it("uses target types for explicit interface and default expressions", () => {
    const context: EmitterContext = {
      indentLevel: 0,
      options: {
        rootNamespace: "Test",
        indent: 4,
      },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
    };

    expect(
      resolveEffectiveExpressionType(
        {
          kind: "asinterface",
          expression: {
            kind: "identifier",
            name: "value",
            inferredType: { kind: "referenceType", name: "Impl" },
          },
          targetType: { kind: "referenceType", name: "Contract" },
          inferredType: { kind: "referenceType", name: "Impl" },
        },
        context
      )
    ).to.deep.equal({ kind: "referenceType", name: "Contract" });

    expect(
      resolveEffectiveExpressionType(
        {
          kind: "defaultof",
          targetType: { kind: "primitiveType", name: "int" },
          inferredType: { kind: "primitiveType", name: "undefined" },
        },
        context
      )
    ).to.deep.equal({ kind: "primitiveType", name: "int" });
  });

  it("maps runtime union AsN members using canonical runtime layout order", () => {
    const requestHandlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: {
            kind: "identifierPattern",
            name: "value",
          },
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "voidType" },
    };
    const routerType: IrType = { kind: "referenceType", name: "Router" };
    const recursiveArrayType: IrType = {
      kind: "arrayType",
      elementType: { kind: "unknownType" },
    };
    const middlewareLikeType: IrType = {
      kind: "unionType",
      types: [requestHandlerType, routerType, recursiveArrayType],
    };
    const context: EmitterContext = {
      indentLevel: 0,
      options: {
        rootNamespace: "Test",
        indent: 4,
      },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
    };

    expect(
      tryResolveRuntimeUnionMemberType(
        middlewareLikeType,
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: {
              kind: "identifierExpression",
              identifier: "handler",
            },
            memberName: "As2",
          },
          arguments: [],
        },
        context
      )
    ).to.deep.equal(requestHandlerType);

    expect(
      tryResolveRuntimeUnionMemberType(
        middlewareLikeType,
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: {
              kind: "identifierExpression",
              identifier: "handler",
            },
            memberName: "As3",
          },
          arguments: [],
        },
        context
      )
    ).to.deep.equal(routerType);
  });
});
