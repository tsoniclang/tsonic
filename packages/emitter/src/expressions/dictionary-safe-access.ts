import {
  identifierExpression,
  identifierType,
  nullLiteral,
} from "../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

const DICTIONARY_LOCAL = "__tsonic_dict";
const KEY_LOCAL = "__tsonic_key";

export const buildJsSafeDictionaryReadAst = (
  objectAst: CSharpExpressionAst,
  keyAst: CSharpExpressionAst,
  isOptionalReceiver: boolean,
  resultTypeAst: CSharpTypeAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "castExpression",
    type: identifierType("global::System.Func", [resultTypeAst]),
    expression: {
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [],
      body: {
        kind: "blockStatement",
        statements: [
          {
            kind: "localDeclarationStatement",
            modifiers: [],
            type: identifierType("var"),
            declarators: [
              {
                name: DICTIONARY_LOCAL,
                initializer: objectAst,
              },
            ],
          },
          ...(isOptionalReceiver
            ? [
                {
                  kind: "ifStatement" as const,
                  condition: {
                    kind: "binaryExpression" as const,
                    operatorToken: "==",
                    left: identifierExpression(DICTIONARY_LOCAL),
                    right: nullLiteral(),
                  },
                  thenStatement: {
                    kind: "blockStatement" as const,
                    statements: [
                      {
                        kind: "returnStatement" as const,
                        expression: {
                          kind: "defaultExpression" as const,
                        },
                      },
                    ],
                  },
                },
              ]
            : []),
          {
            kind: "localDeclarationStatement",
            modifiers: [],
            type: identifierType("var"),
            declarators: [
              {
                name: KEY_LOCAL,
                initializer: keyAst,
              },
            ],
          },
          {
            kind: "returnStatement",
            expression: {
              kind: "conditionalExpression",
              condition: {
                kind: "invocationExpression",
                expression: {
                  kind: "memberAccessExpression",
                  expression: identifierExpression(DICTIONARY_LOCAL),
                  memberName: "ContainsKey",
                },
                arguments: [identifierExpression(KEY_LOCAL)],
              },
              whenTrue: {
                kind: "elementAccessExpression",
                expression: identifierExpression(DICTIONARY_LOCAL),
                arguments: [identifierExpression(KEY_LOCAL)],
              },
              whenFalse: {
                kind: "defaultExpression",
              },
            },
          },
        ],
      },
    },
  },
  arguments: [],
});
