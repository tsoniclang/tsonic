import { describe, it } from "mocha";
import { expect } from "chai";
import { createContext } from "../../emitter-types/context.js";
import type { EmitterContext } from "../../emitter-types/core.js";
import { emitTypeAst } from "../../type-emitter.js";
import { identifierExpression } from "../format/backend-ast/builders.js";
import { matchesSemanticExpectedType } from "./expected-type-matching.js";
import { adaptStorageErasedValueAst } from "./storage-erased-adaptation.js";

describe("storage-erased-adaptation", () => {
  it("matches semantic expected types after stripping nullish wrappers", () => {
    const context = createContext({ rootNamespace: "Test" });

    expect(
      matchesSemanticExpectedType(
        {
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "string" },
            { kind: "primitiveType", name: "undefined" },
          ],
        },
        { kind: "primitiveType", name: "string" },
        context
      )
    ).to.equal(true);
  });

  it("does not treat generic reference types with different type arguments as assignment-compatible", () => {
    const context = createContext({ rootNamespace: "Test" });

    expect(
      matchesSemanticExpectedType(
        {
          kind: "referenceType",
          name: "Iterable",
          typeArguments: [{ kind: "unknownType" }],
        },
        {
          kind: "referenceType",
          name: "Iterable",
          typeArguments: [{ kind: "typeParameterType", name: "T" }],
        },
        context
      )
    ).to.equal(false);
  });

  it("does not structurally match conflicting TypeId references", () => {
    const context = createContext({ rootNamespace: "Test" });
    const idMember = {
      kind: "propertySignature" as const,
      name: "id",
      type: { kind: "primitiveType" as const, name: "number" as const },
      isOptional: false,
      isReadonly: false,
    };

    expect(
      matchesSemanticExpectedType(
        {
          kind: "arrayType",
          elementType: {
            kind: "referenceType",
            name: "Item",
            resolvedClrType: "Fixture.Channels.domain.Item",
            typeId: {
              stableId: "@fixture/channels:Fixture.Channels.domain.Item",
              clrName: "Fixture.Channels.domain.Item",
              assemblyName: "@fixture/channels",
              tsName: "Item",
            },
            structuralMembers: [idMember],
          },
        },
        {
          kind: "arrayType",
          elementType: {
            kind: "referenceType",
            name: "Item",
            resolvedClrType: "Fixture.Channels.repo.Item",
            typeId: {
              stableId: "@fixture/channels:Fixture.Channels.repo.Item",
              clrName: "Fixture.Channels.repo.Item",
              assemblyName: "@fixture/channels",
              tsName: "Item",
            },
            structuralMembers: [idMember],
          },
        },
        context
      )
    ).to.equal(false);
  });

  it("matches named structural union aliases against equivalent anonymous union views", () => {
    const context: EmitterContext = {
      ...createContext({ rootNamespace: "Test" }),
      localTypes: new Map([
        [
          "Ok",
          {
            kind: "typeAlias" as const,
            typeParameters: ["T"],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "success",
                  type: { kind: "literalType", value: true },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "payload",
                  type: { kind: "typeParameterType", name: "T" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          },
        ],
        [
          "Err",
          {
            kind: "typeAlias" as const,
            typeParameters: ["E"],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "success",
                  type: { kind: "literalType", value: false },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "error",
                  type: { kind: "typeParameterType", name: "E" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          },
        ],
        [
          "Result",
          {
            kind: "typeAlias" as const,
            typeParameters: ["T", "E"],
            type: {
              kind: "unionType",
              types: [
                {
                  kind: "referenceType",
                  name: "Err",
                  typeArguments: [{ kind: "typeParameterType", name: "E" }],
                },
                {
                  kind: "referenceType",
                  name: "Ok",
                  typeArguments: [{ kind: "typeParameterType", name: "T" }],
                },
              ],
            },
          },
        ],
      ]),
    };

    expect(
      matchesSemanticExpectedType(
        {
          kind: "unionType",
          types: [
            {
              kind: "referenceType",
              name: "__Anon_Ok",
              structuralMembers: [
                {
                  kind: "propertySignature",
                  name: "success",
                  type: { kind: "literalType", value: true },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "payload",
                  type: { kind: "primitiveType", name: "boolean" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
            {
              kind: "referenceType",
              name: "__Anon_Err",
              structuralMembers: [
                {
                  kind: "propertySignature",
                  name: "success",
                  type: { kind: "literalType", value: false },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "error",
                  type: { kind: "primitiveType", name: "string" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          ],
        },
        {
          kind: "referenceType",
          name: "Result",
          typeArguments: [
            { kind: "primitiveType", name: "boolean" },
            { kind: "primitiveType", name: "string" },
          ],
        },
        context
      )
    ).to.equal(true);
  });

  it("reuses the original value when storage already matches the expected type", () => {
    const context = createContext({ rootNamespace: "Test" });
    const valueAst = identifierExpression("value");

    const result = adaptStorageErasedValueAst({
      valueAst,
      semanticType: { kind: "primitiveType", name: "string" },
      storageType: { kind: "primitiveType", name: "string" },
      expectedType: { kind: "primitiveType", name: "string" },
      context,
      emitTypeAst,
    });

    expect(result?.[0]).to.equal(valueAst);
  });

  it("reifies storage-erased values when semantic meaning matches the expected type", () => {
    const context = createContext({ rootNamespace: "Test" });

    const result = adaptStorageErasedValueAst({
      valueAst: identifierExpression("value"),
      semanticType: { kind: "primitiveType", name: "string" },
      storageType: { kind: "referenceType", name: "object" },
      expectedType: { kind: "primitiveType", name: "string" },
      context,
      emitTypeAst,
    });

    expect(result?.[0]).to.deep.equal({
      kind: "castExpression",
      type: { kind: "predefinedType", keyword: "string" },
      expression: {
        kind: "castExpression",
        type: { kind: "predefinedType", keyword: "object" },
        expression: identifierExpression("value"),
      },
    });
  });

  it("materializes nullable exact numeric storage before exact-value assignments", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const result = adaptStorageErasedValueAst({
      valueAst: identifierExpression("value"),
      semanticType: { kind: "primitiveType", name: "int" },
      storageType: {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "undefined" },
        ],
      },
      expectedType: { kind: "primitiveType", name: "int" },
      context,
      emitTypeAst,
    });

    expect(result?.[0]).to.deep.equal({
      kind: "memberAccessExpression",
      expression: identifierExpression("value"),
      memberName: "Value",
    });
  });

  it("returns undefined when semantic meaning does not match the expected type", () => {
    const context = createContext({ rootNamespace: "Test" });

    const result = adaptStorageErasedValueAst({
      valueAst: identifierExpression("value"),
      semanticType: { kind: "primitiveType", name: "number" },
      storageType: { kind: "referenceType", name: "object" },
      expectedType: { kind: "primitiveType", name: "string" },
      context,
      emitTypeAst,
    });

    expect(result).to.equal(undefined);
  });
});
