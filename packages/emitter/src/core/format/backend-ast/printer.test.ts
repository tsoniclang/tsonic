import { describe, it } from "mocha";
import { expect } from "chai";
import type { CSharpExpressionAst } from "./types.js";
import {
  decimalIntegerLiteral,
  identifierType,
  stringLiteral,
} from "./builders.js";
import {
  printCompilationUnit,
  printExpression,
  printPattern,
  printStatement,
  printType,
} from "./printer.js";

describe("backend-ast printer", () => {
  it("prints the full typed literal set without raw text escape hatches", () => {
    const cases: readonly [CSharpExpressionAst, string][] = [
      [{ kind: "nullLiteralExpression" }, "null"],
      [{ kind: "booleanLiteralExpression", value: true }, "true"],
      [{ kind: "booleanLiteralExpression", value: false }, "false"],
      [
        { kind: "stringLiteralExpression", value: "hello\nworld" },
        '"hello\\nworld"',
      ],
      [
        {
          kind: "stringLiteralExpression",
          value: '"\\\r\t',
        },
        '"\\"\\\\\\r\\t"',
      ],
      [{ kind: "charLiteralExpression", value: "\0" }, "'\\0'"],
      [{ kind: "charLiteralExpression", value: "'" }, "'\\''"],
      [{ kind: "charLiteralExpression", value: "\\" }, "'\\\\'"],
      [{ kind: "charLiteralExpression", value: "\n" }, "'\\n'"],
      [{ kind: "charLiteralExpression", value: "\r" }, "'\\r'"],
      [{ kind: "charLiteralExpression", value: "\t" }, "'\\t'"],
      [
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "42",
        },
        "42",
      ],
      [
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "0",
          suffix: "d",
        },
        "0d",
      ],
      [
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "1",
          suffix: "m",
        },
        "1m",
      ],
      [
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "0",
          suffix: "U",
        },
        "0U",
      ],
      [
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "0",
          suffix: "UL",
        },
        "0UL",
      ],
      [
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "1",
          fractionalPart: "5",
          suffix: "f",
        },
        "1.5f",
      ],
      [
        {
          kind: "numericLiteralExpression",
          base: "decimal",
          wholePart: "6",
          fractionalPart: "02",
          exponentSign: "+",
          exponentDigits: "23",
          suffix: "d",
        },
        "6.02e+23d",
      ],
      [
        {
          kind: "numericLiteralExpression",
          base: "hexadecimal",
          wholePart: "FF",
        },
        "0xFF",
      ],
      [
        {
          kind: "numericLiteralExpression",
          base: "binary",
          wholePart: "1010",
        },
        "0b1010",
      ],
    ];

    for (const [ast, expected] of cases) {
      expect(printExpression(ast)).to.equal(expected);
    }
  });

  it("prints implicit element access expressions for collection initializers", () => {
    expect(
      printExpression({
        kind: "implicitElementAccessExpression",
        arguments: [{ kind: "stringLiteralExpression", value: "count" }],
      })
    ).to.equal('["count"]');
  });

  it("prints type reference expressions structurally", () => {
    expect(
      printExpression({
        kind: "typeReferenceExpression",
        type: identifierType("global::System.Collections.Generic.Dictionary", [
          { kind: "predefinedType", keyword: "string" },
          { kind: "predefinedType", keyword: "int" },
        ]),
      })
    ).to.equal("global::System.Collections.Generic.Dictionary<string, int>");
  });

  it("prints all supported predefined type keywords", () => {
    const keywords = [
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
      "float",
      "double",
      "decimal",
      "char",
      "string",
      "object",
      "void",
    ] as const;

    for (const keyword of keywords) {
      expect(printType({ kind: "predefinedType", keyword })).to.equal(keyword);
    }
  });

  it("prints exact BCL numeric value types as identifier types, not imaginary keywords", () => {
    expect(printType(identifierType("global::System.Int128"))).to.equal(
      "global::System.Int128"
    );

    expect(printType(identifierType("global::System.UInt128"))).to.equal(
      "global::System.UInt128"
    );

    expect(printType(identifierType("global::System.Half"))).to.equal(
      "global::System.Half"
    );
  });

  it("rejects illegally qualified simple identifier nodes", () => {
    expect(() =>
      printType({
        kind: "identifierType",
        name: "global::System.String",
      })
    ).to.throw(
      "ICE: Simple identifierType 'global::System.String' contains qualification. Use qualifiedIdentifierType AST instead."
    );

    expect(() =>
      printExpression({
        kind: "identifierExpression",
        identifier: "global::System.String",
      })
    ).to.throw(
      "ICE: Simple identifierExpression 'global::System.String' contains qualification. Use qualifiedIdentifierExpression AST instead."
    );
  });

  it("prints compilation-unit leading trivia structurally", () => {
    expect(
      printCompilationUnit({
        kind: "compilationUnit",
        leadingTrivia: [
          { kind: "singleLineCommentTrivia", text: "<auto-generated/>" },
          { kind: "singleLineCommentTrivia", text: "Generated by Tsonic" },
          { kind: "blankLineTrivia" },
        ],
        usings: [],
        members: [],
      })
    ).to.equal("// <auto-generated/>\n// Generated by Tsonic\n");
  });

  it("uses structural unary analysis instead of operand text lookups", () => {
    expect(
      printExpression({
        kind: "prefixUnaryExpression",
        operatorToken: "-",
        operand: {
          kind: "prefixUnaryExpression",
          operatorToken: "-",
          operand: { kind: "identifierExpression", identifier: "value" },
        },
      })
    ).to.equal("- -value");

    expect(
      printExpression({
        kind: "prefixUnaryExpression",
        operatorToken: "+",
        operand: {
          kind: "prefixUnaryExpression",
          operatorToken: "+",
          operand: { kind: "identifierExpression", identifier: "count" },
        },
      })
    ).to.equal("+ +count");
  });

  it("parenthesizes interpolations structurally when the AST can print colons", () => {
    expect(
      printExpression({
        kind: "interpolatedStringExpression",
        parts: [
          {
            kind: "interpolation",
            expression: {
              kind: "conditionalExpression",
              condition: { kind: "identifierExpression", identifier: "flag" },
              whenTrue: { kind: "identifierExpression", identifier: "left" },
              whenFalse: { kind: "identifierExpression", identifier: "right" },
            },
          },
        ],
      })
    ).to.equal('$"{(flag ? left : right)}"');

    expect(
      printExpression({
        kind: "interpolatedStringExpression",
        parts: [
          {
            kind: "interpolation",
            expression: {
              kind: "memberAccessExpression",
              expression: {
                kind: "typeReferenceExpression",
                type: identifierType("global::System.String"),
              },
              memberName: "Empty",
            },
          },
        ],
      })
    ).to.equal('$"{(global::System.String.Empty)}"');
  });

  it("prints block-bodied lambdas from printer indentation context, not emitter string hints", () => {
    expect(
      printExpression(
        {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [],
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "stringLiteralExpression",
                  value: "ok",
                },
              },
            ],
          },
        },
        "        "
      )
    ).to.equal('() =>\n            {\n            return "ok";\n            }');
  });

  it("prints block-bodied lambdas consistently inside nested expression contexts", () => {
    expect(
      printExpression(
        {
          kind: "invocationExpression",
          expression: {
            kind: "parenthesizedExpression",
            expression: {
              kind: "castExpression",
              type: identifierType("global::System.Func", [
                { kind: "predefinedType", keyword: "object" },
              ]),
              expression: {
                kind: "lambdaExpression",
                isAsync: false,
                parameters: [],
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "invocationExpression",
                        expression: {
                          kind: "identifierExpression",
                          identifier: "sideEffect",
                        },
                        arguments: [],
                      },
                    },
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "defaultExpression",
                        type: {
                          kind: "nullableType",
                          underlyingType: {
                            kind: "predefinedType",
                            keyword: "object",
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          arguments: [],
        },
        "            "
      )
    ).to.equal(
      "((global::System.Func<object>)(() =>\n" +
        "                {\n" +
        "                sideEffect();\n" +
        "                return default(object?);\n" +
        "                }))()"
    );
  });

  it("prints interpolated string text and format clauses structurally", () => {
    expect(
      printExpression({
        kind: "interpolatedStringExpression",
        parts: [
          { kind: "text", text: "count = " },
          {
            kind: "interpolation",
            expression: { kind: "identifierExpression", identifier: "value" },
            formatClause: "D4",
          },
          { kind: "text", text: ", raw = " },
          {
            kind: "interpolation",
            expression: {
              kind: "numericLiteralExpression",
              base: "hexadecimal",
              wholePart: "FF",
            },
          },
        ],
      })
    ).to.equal('$"count = {value:D4}, raw = {0xFF}"');
  });

  it("prints compound structured types without falling back to textual reconstruction", () => {
    expect(
      printType({
        kind: "nullableType",
        underlyingType: {
          kind: "arrayType",
          elementType: {
            kind: "tupleType",
            elements: [
              {
                type: { kind: "predefinedType", keyword: "int" },
                name: "count",
              },
              {
                type: identifierType(
                  "global::System.Collections.Generic.List",
                  [{ kind: "predefinedType", keyword: "string" }]
                ),
                name: "values",
              },
            ],
          },
          rank: 1,
        },
      })
    ).to.equal(
      "(int count, global::System.Collections.Generic.List<string> values)[]?"
    );
  });

  it("prints structured control-flow statements without text fallbacks", () => {
    expect(
      printStatement(
        {
          kind: "ifStatement",
          condition: { kind: "identifierExpression", identifier: "ready" },
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "numericLiteralExpression",
                  base: "decimal",
                  wholePart: "1",
                },
              },
            ],
          },
          elseStatement: {
            kind: "ifStatement",
            condition: { kind: "identifierExpression", identifier: "retry" },
            thenStatement: {
              kind: "blockStatement",
              statements: [{ kind: "continueStatement" }],
            },
            elseStatement: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "throwStatement",
                  expression: {
                    kind: "identifierExpression",
                    identifier: "ex",
                  },
                },
              ],
            },
          },
        },
        ""
      )
    ).to.equal(
      "if (ready)\n" +
        "{\n" +
        "    return 1;\n" +
        "}\n" +
        "else if (retry)\n" +
        "{\n" +
        "    continue;\n" +
        "}\n" +
        "else\n" +
        "{\n" +
        "    throw ex;\n" +
        "}"
    );

    expect(
      printStatement(
        {
          kind: "forStatement",
          declaration: {
            kind: "localDeclarationStatement",
            modifiers: [],
            type: { kind: "predefinedType", keyword: "int" },
            declarators: [
              {
                name: "i",
                initializer: {
                  kind: "numericLiteralExpression",
                  base: "decimal",
                  wholePart: "0",
                },
              },
            ],
          },
          condition: {
            kind: "binaryExpression",
            operatorToken: "<",
            left: { kind: "identifierExpression", identifier: "i" },
            right: {
              kind: "numericLiteralExpression",
              base: "decimal",
              wholePart: "10",
            },
          },
          incrementors: [
            {
              kind: "postfixUnaryExpression",
              operatorToken: "++",
              operand: { kind: "identifierExpression", identifier: "i" },
            },
          ],
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "invocationExpression",
                  expression: {
                    kind: "identifierExpression",
                    identifier: "tick",
                  },
                  arguments: [
                    { kind: "identifierExpression", identifier: "i" },
                  ],
                },
              },
            ],
          },
        },
        ""
      )
    ).to.equal(
      "for (int i = 0; i < 10; i++)\n" + "{\n" + "    tick(i);\n" + "}"
    );

    expect(
      printStatement(
        {
          kind: "foreachStatement",
          isAwait: true,
          type: { kind: "predefinedType", keyword: "string" },
          identifier: "item",
          expression: { kind: "identifierExpression", identifier: "items" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "yieldStatement",
                isBreak: false,
                expression: {
                  kind: "identifierExpression",
                  identifier: "item",
                },
              },
            ],
          },
        },
        ""
      )
    ).to.equal(
      "await foreach (string item in items)\n" +
        "{\n" +
        "    yield return item;\n" +
        "}"
    );

    expect(
      printStatement(
        {
          kind: "tryStatement",
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "invocationExpression",
                  expression: {
                    kind: "identifierExpression",
                    identifier: "work",
                  },
                  arguments: [],
                },
              },
            ],
          },
          catches: [
            {
              type: identifierType("global::System.Exception"),
              identifier: "ex",
              filter: {
                kind: "identifierExpression",
                identifier: "shouldHandle",
              },
              body: {
                kind: "blockStatement",
                statements: [{ kind: "throwStatement" }],
              },
            },
          ],
          finallyBody: {
            kind: "blockStatement",
            statements: [{ kind: "yieldStatement", isBreak: true }],
          },
        },
        ""
      )
    ).to.equal(
      "try\n" +
        "{\n" +
        "    work();\n" +
        "}\n" +
        "catch (global::System.Exception ex) when (shouldHandle)\n" +
        "{\n" +
        "    throw;\n" +
        "}\n" +
        "finally\n" +
        "{\n" +
        "    yield break;\n" +
        "}"
    );
  });

  it("prints structured switch expressions, patterns, and switch statements", () => {
    expect(
      printPattern({
        kind: "declarationPattern",
        type: identifierType("global::System.Exception"),
        designation: "ex",
      })
    ).to.equal("global::System.Exception ex");

    expect(
      printExpression({
        kind: "switchExpression",
        governingExpression: {
          kind: "identifierExpression",
          identifier: "value",
        },
        arms: [
          {
            pattern: {
              kind: "constantPattern",
              expression: decimalIntegerLiteral(0),
            },
            expression: stringLiteral("zero"),
          },
          {
            pattern: {
              kind: "declarationPattern",
              type: identifierType("global::System.Exception"),
              designation: "ex",
            },
            whenClause: { kind: "identifierExpression", identifier: "flag" },
            expression: {
              kind: "memberAccessExpression",
              expression: { kind: "identifierExpression", identifier: "ex" },
              memberName: "Message",
            },
          },
          {
            pattern: { kind: "discardPattern" },
            expression: stringLiteral("other"),
          },
        ],
      })
    ).to.equal(
      'value switch { 0 => "zero", global::System.Exception ex when flag => ex.Message, _ => "other" }'
    );

    expect(
      printStatement(
        {
          kind: "switchStatement",
          expression: { kind: "identifierExpression", identifier: "value" },
          sections: [
            {
              labels: [
                {
                  kind: "caseSwitchLabel",
                  value: decimalIntegerLiteral(0),
                },
              ],
              statements: [
                {
                  kind: "returnStatement",
                  expression: stringLiteral("zero"),
                },
              ],
            },
            {
              labels: [
                {
                  kind: "casePatternSwitchLabel",
                  pattern: {
                    kind: "declarationPattern",
                    type: identifierType("global::System.Exception"),
                    designation: "ex",
                  },
                  whenClause: {
                    kind: "identifierExpression",
                    identifier: "flag",
                  },
                },
              ],
              statements: [{ kind: "breakStatement" }],
            },
            {
              labels: [{ kind: "defaultSwitchLabel" }],
              statements: [{ kind: "returnStatement" }],
            },
          ],
        },
        ""
      )
    ).to.equal(
      "switch (value)\n" +
        "{\n" +
        "    case 0:\n" +
        '        return "zero";\n' +
        "    case global::System.Exception ex when flag:\n" +
        "        break;\n" +
        "    default:\n" +
        "        return;\n" +
        "}"
    );
  });

  it("prints remaining expression and statement node kinds structurally", () => {
    const expressionCases: readonly [CSharpExpressionAst, string][] = [
      [
        {
          kind: "conditionalMemberAccessExpression",
          expression: { kind: "identifierExpression", identifier: "value" },
          memberName: "Length",
        },
        "value?.Length",
      ],
      [
        {
          kind: "conditionalElementAccessExpression",
          expression: { kind: "identifierExpression", identifier: "value" },
          arguments: [decimalIntegerLiteral(0)],
        },
        "value?[0]",
      ],
      [
        {
          kind: "arrayCreationExpression",
          elementType: { kind: "predefinedType", keyword: "int" },
          sizeExpression: decimalIntegerLiteral(3),
          initializer: [decimalIntegerLiteral(1), decimalIntegerLiteral(2)],
        },
        "new int[3] { 1, 2 }",
      ],
      [
        {
          kind: "stackAllocArrayCreationExpression",
          elementType: { kind: "predefinedType", keyword: "byte" },
          sizeExpression: decimalIntegerLiteral(16),
        },
        "stackalloc byte[16]",
      ],
      [
        {
          kind: "castExpression",
          type: { kind: "predefinedType", keyword: "int" },
          expression: {
            kind: "binaryExpression",
            operatorToken: "+",
            left: { kind: "identifierExpression", identifier: "left" },
            right: { kind: "identifierExpression", identifier: "right" },
          },
        },
        "(int)(left + right)",
      ],
      [
        {
          kind: "asExpression",
          expression: { kind: "identifierExpression", identifier: "value" },
          type: identifierType("global::System.IDisposable"),
        },
        "value as global::System.IDisposable",
      ],
      [
        {
          kind: "isExpression",
          expression: { kind: "identifierExpression", identifier: "value" },
          pattern: { kind: "varPattern", designation: "captured" },
        },
        "value is var captured",
      ],
      [
        {
          kind: "defaultExpression",
          type: {
            kind: "nullableType",
            underlyingType: { kind: "predefinedType", keyword: "int" },
          },
        },
        "default(int?)",
      ],
      [
        {
          kind: "sizeOfExpression",
          type: { kind: "predefinedType", keyword: "decimal" },
        },
        "sizeof(decimal)",
      ],
      [
        {
          kind: "awaitExpression",
          expression: { kind: "identifierExpression", identifier: "task" },
        },
        "await task",
      ],
      [
        {
          kind: "suppressNullableWarningExpression",
          expression: { kind: "identifierExpression", identifier: "maybe" },
        },
        "maybe!",
      ],
      [
        {
          kind: "typeofExpression",
          type: identifierType("global::System.IntPtr"),
        },
        "typeof(global::System.IntPtr)",
      ],
      [
        {
          kind: "argumentModifierExpression",
          modifier: "ref",
          expression: { kind: "identifierExpression", identifier: "value" },
        },
        "ref value",
      ],
      [
        {
          kind: "tupleExpression",
          elements: [
            decimalIntegerLiteral(1),
            { kind: "identifierExpression", identifier: "name" },
          ],
        },
        "(1, name)",
      ],
      [
        {
          kind: "throwExpression",
          expression: { kind: "identifierExpression", identifier: "ex" },
        },
        "throw ex",
      ],
    ];

    for (const [ast, expected] of expressionCases) {
      expect(printExpression(ast)).to.equal(expected);
    }

    expect(
      printPattern({
        kind: "typePattern",
        type: identifierType("global::System.Exception"),
      })
    ).to.equal("global::System.Exception");
    expect(
      printPattern({
        kind: "varPattern",
        designation: "captured",
      })
    ).to.equal("var captured");
    expect(
      printPattern({
        kind: "negatedPattern",
        pattern: { kind: "discardPattern" },
      })
    ).to.equal("not _");

    expect(
      printStatement(
        {
          kind: "whileStatement",
          condition: { kind: "identifierExpression", identifier: "keepGoing" },
          body: {
            kind: "blockStatement",
            statements: [{ kind: "emptyStatement" }],
          },
        },
        ""
      )
    ).to.equal("while (keepGoing)\n{\n    ;\n}");

    expect(
      printStatement(
        {
          kind: "localFunctionStatement",
          modifiers: ["static"],
          returnType: { kind: "predefinedType", keyword: "void" },
          name: "consume",
          parameters: [
            {
              name: "item",
              type: { kind: "predefinedType", keyword: "string" },
            },
          ],
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "invocationExpression",
                  expression: {
                    kind: "identifierExpression",
                    identifier: "sink",
                  },
                  arguments: [
                    { kind: "identifierExpression", identifier: "item" },
                  ],
                },
              },
            ],
          },
        },
        ""
      )
    ).to.equal("static void consume(string item)\n{\n    sink(item);\n}");
  });
});
