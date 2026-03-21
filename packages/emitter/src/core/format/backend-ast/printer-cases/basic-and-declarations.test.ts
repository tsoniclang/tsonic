import {
  describe,
  expect,
  identifierType,
  it,
  printExpression,
  printType,
  printTypeDeclaration,
} from "./helpers.js";
import type { CSharpExpressionAst, CSharpTypeAst } from "./helpers.js";
describe("backend-ast printer", () => {
  it("prints nested nullable types as a single nullable suffix", () => {
    const nestedNullable: CSharpTypeAst = {
      kind: "nullableType",
      underlyingType: {
        kind: "nullableType",
        underlyingType: identifierType("global::System.String"),
      },
    };

    expect(printType(nestedNullable)).to.equal("global::System.String?");
  });

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

  it("prints explicit interface members structurally", () => {
    const printed = printTypeDeclaration(
      {
        kind: "classDeclaration",
        attributes: [],
        modifiers: ["public"],
        name: "MemoryResponse",
        interfaces: [identifierType("global::Demo.TransportResponse")],
        members: [
          {
            kind: "propertyDeclaration",
            attributes: [],
            modifiers: [],
            type: { kind: "predefinedType", keyword: "int" },
            name: "statusCode",
            explicitInterface: identifierType("global::Demo.TransportResponse"),
            hasGetter: true,
            hasSetter: true,
            isAutoProperty: false,
            getterBody: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: {
                    kind: "memberAccessExpression",
                    expression: {
                      kind: "identifierExpression",
                      identifier: "this",
                    },
                    memberName: "statusCode",
                  },
                },
              ],
            },
            setterBody: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "expressionStatement",
                  expression: {
                    kind: "assignmentExpression",
                    operatorToken: "=",
                    left: {
                      kind: "memberAccessExpression",
                      expression: {
                        kind: "identifierExpression",
                        identifier: "this",
                      },
                      memberName: "statusCode",
                    },
                    right: {
                      kind: "identifierExpression",
                      identifier: "value",
                    },
                  },
                },
              ],
            },
          },
          {
            kind: "methodDeclaration",
            attributes: [],
            modifiers: [],
            returnType: identifierType("global::System.Threading.Tasks.Task"),
            name: "sendText",
            explicitInterface: identifierType("global::Demo.TransportResponse"),
            parameters: [
              {
                name: "text",
                type: { kind: "predefinedType", keyword: "string" },
              },
            ],
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: {
                    kind: "memberAccessExpression",
                    expression: {
                      kind: "qualifiedIdentifierExpression",
                      name: {
                        aliasQualifier: "global",
                        segments: ["System", "Threading", "Tasks", "Task"],
                      },
                    },
                    memberName: "CompletedTask",
                  },
                },
              ],
            },
          },
        ],
      },
      ""
    );

    expect(printed).to.include("int global::Demo.TransportResponse.statusCode");
    expect(printed).to.include(
      "global::System.Threading.Tasks.Task global::Demo.TransportResponse.sendText(string text)"
    );
  });
});
