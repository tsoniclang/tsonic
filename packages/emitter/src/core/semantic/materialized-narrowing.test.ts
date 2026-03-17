import { describe, it } from "mocha";
import { expect } from "chai";
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
      types: [intType, { kind: "primitiveType" as const, name: "undefined" as const }],
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
});
