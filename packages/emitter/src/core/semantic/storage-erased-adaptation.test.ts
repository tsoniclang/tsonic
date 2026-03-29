import { describe, it } from "mocha";
import { expect } from "chai";
import { createContext } from "../../emitter-types/context.js";
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
