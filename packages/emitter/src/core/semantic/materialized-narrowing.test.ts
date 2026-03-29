import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { materializeDirectNarrowingAst } from "./materialized-narrowing.js";
import type { EmitterContext } from "../../emitter-types/core.js";

const context: EmitterContext = {
  indentLevel: 0,
  options: { rootNamespace: "Test", surface: "@tsonic/js", indent: 2 },
  isStatic: false,
  isAsync: false,
  usings: new Set<string>(),
};

describe("materialized narrowing", () => {
  it("unwraps nullable exact numerics when narrowing to required value types", () => {
    const intType = { kind: "primitiveType", name: "int" } as const;
    const nullableIntType = {
      kind: "unionType" as const,
      types: [
        intType,
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };

    const [ast] = materializeDirectNarrowingAst(
      { kind: "identifierExpression", identifier: "id" },
      nullableIntType,
      intType,
      context
    );

    expect(ast).to.deep.equal({
      kind: "memberAccessExpression",
      expression: { kind: "identifierExpression", identifier: "id" },
      memberName: "Value",
    });
  });

  it("unwraps nullable booleans when narrowing to required booleans", () => {
    const boolType = { kind: "primitiveType", name: "boolean" } as const;
    const nullableBoolType = {
      kind: "unionType" as const,
      types: [
        boolType,
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };

    const [ast] = materializeDirectNarrowingAst(
      { kind: "identifierExpression", identifier: "flag" },
      nullableBoolType,
      boolType,
      context
    );

    expect(ast).to.deep.equal({
      kind: "memberAccessExpression",
      expression: { kind: "identifierExpression", identifier: "flag" },
      memberName: "Value",
    });
  });

  it("produces .Value unwrap for ref-wrapped nullable value types", () => {
    const numberType: IrType = { kind: "primitiveType", name: "number" };
    const undefinedType: IrType = {
      kind: "primitiveType",
      name: "undefined",
    };
    const sourceAst = {
      kind: "identifierExpression" as const,
      identifier: "val",
    };

    // ref<number | undefined> — parameter modifier wrapping a nullable union
    const refWrappedNullable: IrType = {
      kind: "referenceType",
      name: "ref",
      typeArguments: [
        { kind: "unionType", types: [numberType, undefinedType] },
      ],
    };

    const [ast] = materializeDirectNarrowingAst(
      sourceAst,
      refWrappedNullable,
      numberType,
      context
    );

    // Emission-time comparison unwraps ref → sees number | undefined → number.
    // The nullable value-type .Value path fires, same as a bare number | undefined source.
    expect(ast).to.deep.equal({
      kind: "memberAccessExpression",
      expression: sourceAst,
      memberName: "Value",
    });
  });

  it("does not append .Value when the source AST already casts to the concrete value type", () => {
    const intType = { kind: "primitiveType", name: "int" } as const;
    const nullableIntType = {
      kind: "unionType" as const,
      types: [
        intType,
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };

    const castAst = {
      kind: "castExpression" as const,
      type: { kind: "predefinedType" as const, keyword: "int" as const },
      expression: {
        kind: "identifierExpression" as const,
        identifier: "value",
      },
    };

    const [ast] = materializeDirectNarrowingAst(
      castAst,
      nullableIntType,
      intType,
      context
    );

    expect(ast).to.deep.equal(castAst);
  });

  it("does not build union Match when source is ref-wrapped (boundary enforcement)", () => {
    const stringType: IrType = { kind: "primitiveType", name: "string" };
    const numberType: IrType = { kind: "primitiveType", name: "number" };
    const sourceAst = {
      kind: "identifierExpression" as const,
      identifier: "val",
    };

    // ref<string | number> — ref-wrapped multi-member union
    const refWrappedUnion: IrType = {
      kind: "referenceType",
      name: "ref",
      typeArguments: [{ kind: "unionType", types: [stringType, numberType] }],
    };

    const [ast] = materializeDirectNarrowingAst(
      sourceAst,
      refWrappedUnion,
      stringType,
      context
    );

    // With boundary enforcement, tryBuildRuntimeMaterializationAst receives
    // the raw ref-wrapped type (not the unwrapped string | number union),
    // so it cannot build a union layout and returns undefined.
    // The fallback cast path fires instead.
    //
    // If the premature-unwrapping regression reappears (passing the unwrapped
    // union to tryBuildRuntimeMaterializationAst), this would produce an
    // invocationExpression (.Match()) instead of a castExpression.
    expect(ast.kind).to.equal("castExpression");
    expect(ast).to.not.equal(sourceAst);
  });
});
