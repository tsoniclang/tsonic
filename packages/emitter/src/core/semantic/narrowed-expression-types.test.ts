import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrExpression, IrType } from "@tsonic/frontend";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
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
});
