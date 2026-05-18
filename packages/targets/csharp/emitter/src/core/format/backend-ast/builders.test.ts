import { describe, it } from "mocha";
import { expect } from "chai";
import {
  booleanLiteral,
  charLiteral,
  decimalIntegerLiteral,
  identifierExpression,
  identifierType,
  nullLiteral,
  numericLiteral,
  parseNumericLiteral,
  qualifiedName,
  stringLiteral,
  withTypeArguments,
} from "./builders.js";

describe("backend-ast builders", () => {
  it("builds the typed literal family structurally", () => {
    expect(nullLiteral()).to.deep.equal({ kind: "nullLiteralExpression" });
    expect(booleanLiteral(true)).to.deep.equal({
      kind: "booleanLiteralExpression",
      value: true,
    });
    expect(stringLiteral("hello")).to.deep.equal({
      kind: "stringLiteralExpression",
      value: "hello",
    });
    expect(charLiteral("x")).to.deep.equal({
      kind: "charLiteralExpression",
      value: "x",
    });
    expect(decimalIntegerLiteral(42)).to.deep.equal({
      kind: "numericLiteralExpression",
      base: "decimal",
      wholePart: "42",
    });
    expect(
      numericLiteral({
        base: "decimal",
        wholePart: "1",
        fractionalPart: "5",
        suffix: "m",
      })
    ).to.deep.equal({
      kind: "numericLiteralExpression",
      base: "decimal",
      wholePart: "1",
      fractionalPart: "5",
      suffix: "m",
    });
  });

  it("builds qualified names and identifier expressions structurally", () => {
    expect(qualifiedName("System.Collections.Generic.List")).to.deep.equal({
      segments: ["System", "Collections", "Generic", "List"],
    });
    expect(qualifiedName("global::System.String")).to.deep.equal({
      aliasQualifier: "global",
      segments: ["System", "String"],
    });

    expect(identifierExpression("value")).to.deep.equal({
      kind: "identifierExpression",
      identifier: "value",
    });
    expect(identifierExpression("global::System.String")).to.deep.equal({
      kind: "qualifiedIdentifierExpression",
      name: {
        aliasQualifier: "global",
        segments: ["System", "String"],
      },
    });
    expect(identifierExpression("TsonicJson.Options")).to.deep.equal({
      kind: "qualifiedIdentifierExpression",
      name: {
        segments: ["TsonicJson", "Options"],
      },
    });
  });

  it("builds all supported predefined type keywords and qualified type nodes", () => {
    const keywordCases = [
      "bool",
      "byte",
      "sbyte",
      "short",
      "ushort",
      "int",
      "uint",
      "long",
      "ulong",
      "nint",
      "nuint",
      "char",
      "float",
      "double",
      "decimal",
      "string",
      "object",
      "void",
    ] as const;

    for (const keyword of keywordCases) {
      expect(identifierType(keyword)).to.deep.equal({
        kind: "predefinedType",
        keyword,
      });
    }

    expect(identifierType("var")).to.deep.equal({ kind: "varType" });
    expect(identifierType("MyType")).to.deep.equal({
      kind: "identifierType",
      name: "MyType",
    });
    expect(identifierType("global::System.Int128")).to.deep.equal({
      kind: "qualifiedIdentifierType",
      name: {
        aliasQualifier: "global",
        segments: ["System", "Int128"],
      },
    });
    expect(
      identifierType("global::System.Collections.Generic.List", [
        { kind: "predefinedType", keyword: "string" },
      ])
    ).to.deep.equal({
      kind: "qualifiedIdentifierType",
      name: {
        aliasQualifier: "global",
        segments: ["System", "Collections", "Generic", "List"],
      },
      typeArguments: [{ kind: "predefinedType", keyword: "string" }],
    });
  });

  it("attaches type arguments only to identifier-like type nodes", () => {
    const simple = identifierType("Task");
    expect(
      withTypeArguments(simple, [{ kind: "predefinedType", keyword: "int" }])
    ).to.deep.equal({
      kind: "identifierType",
      name: "Task",
      typeArguments: [{ kind: "predefinedType", keyword: "int" }],
    });

    const qualified = identifierType("global::System.Func");
    expect(
      withTypeArguments(qualified, [
        { kind: "predefinedType", keyword: "string" },
        { kind: "predefinedType", keyword: "bool" },
      ])
    ).to.deep.equal({
      kind: "qualifiedIdentifierType",
      name: {
        aliasQualifier: "global",
        segments: ["System", "Func"],
      },
      typeArguments: [
        { kind: "predefinedType", keyword: "string" },
        { kind: "predefinedType", keyword: "bool" },
      ],
    });

    expect(() =>
      withTypeArguments({ kind: "predefinedType", keyword: "int" }, [
        { kind: "predefinedType", keyword: "string" },
      ])
    ).to.throw(
      "ICE: Cannot attach generic type arguments to non-identifier type 'predefinedType'."
    );

    expect(() =>
      withTypeArguments(
        {
          kind: "nullableType",
          underlyingType: { kind: "predefinedType", keyword: "int" },
        },
        [{ kind: "predefinedType", keyword: "string" }]
      )
    ).to.throw(
      "ICE: Cannot attach generic type arguments to non-identifier type 'nullableType'."
    );
  });

  it("parses numeric literal lexemes structurally across bases, suffixes, and exponents", () => {
    const cases = [
      [
        "123",
        { kind: "numericLiteralExpression", base: "decimal", wholePart: "123" },
      ],
      [
        "1_024",
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "1024",
        },
      ],
      [
        "0xFF",
        {
          kind: "numericLiteralExpression",
          base: "hexadecimal",
          wholePart: "FF",
        },
      ],
      [
        "0b1010",
        { kind: "numericLiteralExpression", base: "binary", wholePart: "1010" },
      ],
      [
        "0o77",
        { kind: "numericLiteralExpression", base: "decimal", wholePart: "63" },
      ],
      [
        "1.5",
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "1",
          fractionalPart: "5",
        },
      ],
      [
        "10.",
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "10",
          fractionalPart: "0",
        },
      ],
      [
        "6.02e23",
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "6",
          fractionalPart: "02",
          exponentDigits: "23",
        },
      ],
      [
        "1e-9",
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "1",
          exponentSign: "-",
          exponentDigits: "9",
        },
      ],
    ] as const;

    for (const [lexeme, expected] of cases) {
      expect(parseNumericLiteral(lexeme)).to.deep.equal(expected);
    }

    expect(parseNumericLiteral("1", "L")).to.deep.equal({
      kind: "numericLiteralExpression",
      base: "decimal",
      wholePart: "1",
      suffix: "L",
    });
    expect(parseNumericLiteral("1", "U")).to.deep.equal({
      kind: "numericLiteralExpression",
      base: "decimal",
      wholePart: "1",
      suffix: "U",
    });
    expect(parseNumericLiteral("1", "UL")).to.deep.equal({
      kind: "numericLiteralExpression",
      base: "decimal",
      wholePart: "1",
      suffix: "UL",
    });
    expect(parseNumericLiteral("1.0", "f")).to.deep.equal({
      kind: "numericLiteralExpression",
      base: "decimal",
      wholePart: "1",
      fractionalPart: "0",
      suffix: "f",
    });
    expect(parseNumericLiteral("1", "d")).to.deep.equal({
      kind: "numericLiteralExpression",
      base: "decimal",
      wholePart: "1",
      suffix: "d",
    });
    expect(parseNumericLiteral("1.0", "m")).to.deep.equal({
      kind: "numericLiteralExpression",
      base: "decimal",
      wholePart: "1",
      fractionalPart: "0",
      suffix: "m",
    });
  });

  it("rejects negative numeric literal lexemes because sign is structural", () => {
    expect(() => parseNumericLiteral("-1")).to.throw(
      "ICE: Negative numeric literal '-1' should be represented as a prefix unary expression."
    );
  });
});
