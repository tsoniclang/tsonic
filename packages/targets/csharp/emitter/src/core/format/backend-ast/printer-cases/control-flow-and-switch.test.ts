import {
  decimalIntegerLiteral,
  describe,
  expect,
  identifierType,
  it,
  printExpression,
  printPattern,
  printStatement,
  printType,
  stringLiteral,
} from "./helpers.js";
describe("backend-ast printer", () => {
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
});
