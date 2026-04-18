/**
 * Dictionary literal expression emitters.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { allocateLocalName } from "../core/format/local-names.js";
import {
  identifierType,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import { buildInvokedLambdaExpressionAst } from "./invoked-lambda.js";
import {
  emitObjectMemberName,
  isDictionaryLikeSpreadType,
  createStringLiteralExpression,
  createDictionaryElementAccess,
  getObjectTypePropertyNames,
} from "./object-helpers.js";

/**
 * Emit dictionary key type as AST.
 */
const emitDictKeyTypeAst = (keyType: IrType): CSharpTypeAst => {
  if (keyType.kind === "primitiveType") {
    switch (keyType.name) {
      case "string":
        return { kind: "predefinedType", keyword: "string" };
      case "number":
        return { kind: "predefinedType", keyword: "double" };
    }
  }

  if (keyType.kind === "referenceType" && keyType.name === "object") {
    return { kind: "predefinedType", keyword: "object" };
  }

  throw new Error(
    `ICE: Unsupported dictionary key type reached emitter - validation missed TSN7413. Got: ${JSON.stringify(keyType)}`
  );
};

/**
 * Emit a dictionary literal as CSharpExpressionAst
 */
export const emitDictionaryLiteral = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  dictType: Extract<IrType, { kind: "dictionaryType" }>
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const keyTypeAst = emitDictKeyTypeAst(dictType.keyType);
  const [valueTypeAst, ctx2] = emitTypeAst(dictType.valueType, currentContext);
  currentContext = ctx2;

  const dictTypeAst: CSharpTypeAst = identifierType(
    "global::System.Collections.Generic.Dictionary",
    [keyTypeAst, valueTypeAst]
  );

  const initializerAsts: CSharpExpressionAst[] = [];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      throw new Error("ICE: Spread in dictionary literal not supported");
    } else {
      if (typeof prop.key !== "string") {
        throw new Error(
          "ICE: Computed property key in dictionary literal - validation gap"
        );
      }

      const [valueAst, newContext] = emitExpressionAst(
        prop.value,
        currentContext,
        dictType.valueType
      );
      initializerAsts.push({
        kind: "assignmentExpression",
        operatorToken: "=",
        left: {
          kind: "implicitElementAccessExpression",
          arguments: [stringLiteral(prop.key)],
        },
        right: valueAst,
      });
      currentContext = newContext;
    }
  }

  return [
    {
      kind: "objectCreationExpression",
      type: dictTypeAst,
      arguments: [],
      initializer: initializerAsts.length > 0 ? initializerAsts : undefined,
    },
    currentContext,
  ];
};

export const emitDictionaryLiteralWithSpreads = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  dictType: Extract<IrType, { kind: "dictionaryType" }>
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const keyTypeAst = emitDictKeyTypeAst(dictType.keyType);
  const [valueTypeAst, ctx2] = emitTypeAst(dictType.valueType, currentContext);
  currentContext = ctx2;

  const dictTypeAst: CSharpTypeAst = identifierType(
    "global::System.Collections.Generic.Dictionary",
    [keyTypeAst, valueTypeAst]
  );

  const bodyStatements: CSharpStatementAst[] = [
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [
        {
          name: "__tmp",
          initializer: {
            kind: "objectCreationExpression",
            type: dictTypeAst,
            arguments: [],
          },
        },
      ],
    },
  ];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      const [spreadStatements, nextContext] =
        emitDictionarySpreadCopyStatements(
          "__tmp",
          prop.expression,
          currentContext
        );
      bodyStatements.push(...spreadStatements);
      currentContext = nextContext;
      continue;
    }

    if (typeof prop.key !== "string") {
      throw new Error(
        "ICE: Computed property key in dictionary literal - validation gap"
      );
    }

    const [valueAst, nextContext] = emitExpressionAst(
      prop.value,
      currentContext,
      dictType.valueType
    );
    currentContext = nextContext;
    bodyStatements.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: createDictionaryElementAccess(
          "__tmp",
          createStringLiteralExpression(prop.key)
        ),
        right: valueAst,
      },
    });
  }

  bodyStatements.push({
    kind: "returnStatement",
    expression: { kind: "identifierExpression", identifier: "__tmp" },
  });

  return [
    buildInvokedLambdaExpressionAst({
      parameters: [],
      parameterTypes: [],
      body: { kind: "blockStatement", statements: bodyStatements },
      arguments: [],
      returnType: dictTypeAst,
      context: currentContext,
    }),
    currentContext,
  ];
};

const emitDictionarySpreadCopyStatements = (
  targetIdentifier: string,
  spreadExpr: IrExpression,
  context: EmitterContext
): [CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];
  const spreadType = spreadExpr.inferredType;

  if (!spreadType) {
    throw new Error(
      "ICE: Spread in dictionary literal reached emitter without inferred type"
    );
  }

  const [sourceAst, sourceContext] = emitExpressionAst(
    spreadExpr,
    currentContext
  );
  currentContext = sourceContext;

  const sourceTemp = allocateLocalName("__spread", currentContext);
  currentContext = sourceTemp.context;
  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [
      {
        name: sourceTemp.emittedName,
        initializer: sourceAst,
      },
    ],
  });

  const sourceRef: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: sourceTemp.emittedName,
  };

  if (isDictionaryLikeSpreadType(spreadType, currentContext)) {
    const entryTemp = allocateLocalName("__entry", currentContext);
    currentContext = entryTemp.context;
    statements.push({
      kind: "foreachStatement",
      isAwait: false,
      type: { kind: "varType" },
      identifier: entryTemp.emittedName,
      expression: sourceRef,
      body: {
        kind: "blockStatement",
        statements: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "assignmentExpression",
              operatorToken: "=",
              left: createDictionaryElementAccess(targetIdentifier, {
                kind: "memberAccessExpression",
                expression: {
                  kind: "identifierExpression",
                  identifier: entryTemp.emittedName,
                },
                memberName: "Key",
              }),
              right: {
                kind: "memberAccessExpression",
                expression: {
                  kind: "identifierExpression",
                  identifier: entryTemp.emittedName,
                },
                memberName: "Value",
              },
            },
          },
        ],
      },
    });

    return [statements, currentContext];
  }

  const propertyNames = getObjectTypePropertyNames(spreadType, currentContext);
  for (const propName of propertyNames) {
    const sourceMember = emitObjectMemberName(
      spreadType,
      propName,
      currentContext
    );
    statements.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: createDictionaryElementAccess(
          targetIdentifier,
          createStringLiteralExpression(propName)
        ),
        right: {
          kind: "memberAccessExpression",
          expression: sourceRef,
          memberName: sourceMember,
        },
      },
    });
  }

  return [statements, currentContext];
};
