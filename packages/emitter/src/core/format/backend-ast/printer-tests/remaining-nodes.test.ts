import {
  decimalIntegerLiteral,
  describe,
  expect,
  identifierType,
  it,
  printExpression,
  printPattern,
  printStatement,
} from "./helpers.js";
import type { CSharpExpressionAst } from "./helpers.js";
describe("backend-ast printer", () => {
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
