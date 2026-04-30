/**
 * Unary and update operator expression emitters
 *
 * NEW NUMERIC SPEC:
 * - Literals use raw lexeme (no contextual widening)
 * - Integer casts only from IrCastExpression (not inferred from expectedType)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import { emitBooleanConditionAst } from "../../core/semantic/boolean-context.js";
import {
  identifierExpression,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import { emitWritableTargetAst } from "./write-targets.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";

/**
 * Emit a unary operator expression as CSharpExpressionAst (-, +, !, ~, typeof, void, delete)
 *
 * NEW NUMERIC SPEC: No contextual type propagation for numeric literals.
 * Explicit casts come from IrCastExpression nodes.
 *
 * @param expr - The unary expression
 * @param context - Emitter context
 * @param expectedType - Used for void IIFE return type
 */
export const emitUnary = (
  expr: Extract<IrExpression, { kind: "unary" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  // In TypeScript, `!x` applies JS ToBoolean semantics to *any* operand.
  // In C#, `!` only works on booleans, so we must coerce to a boolean condition.
  if (expr.operator === "!") {
    const [condAst, condCtx] = emitBooleanConditionAst(
      expr.expression,
      (e, ctx) => emitExpressionAst(e, ctx),
      context
    );
    return [
      {
        kind: "prefixUnaryExpression",
        operatorToken: "!",
        operand: condAst,
      },
      condCtx,
    ];
  }

  if (expr.operator === "delete") {
    throw new Error(
      "ICE: JavaScript delete operator reached emitter - validation missed TSN2001"
    );
  }

  const [operandAst, newContext] = emitExpressionAst(expr.expression, context);

  if (expr.operator === "typeof") {
    throw new Error(
      "ICE: Runtime typeof expression reached emitter - validation missed TSN2001"
    );
  }

  if (expr.operator === "void") {
    const operand = expr.expression;

    const isNoopOperand =
      (operand.kind === "literal" &&
        (operand.value === undefined || operand.value === null)) ||
      (operand.kind === "identifier" &&
        (operand.name === "undefined" || operand.name === "null"));

    let currentContext = newContext;

    const effectiveExpectedType =
      expectedType &&
      expectedType.kind !== "voidType" &&
      expectedType.kind !== "neverType"
        ? expectedType
        : undefined;

    let returnTypeAst: CSharpTypeAst = {
      kind: "nullableType",
      underlyingType: { kind: "predefinedType", keyword: "object" },
    };
    if (effectiveExpectedType) {
      try {
        const [typeAst, next] = emitTypeAst(
          effectiveExpectedType,
          currentContext
        );
        currentContext = next;
        returnTypeAst = typeAst;
      } catch {
        returnTypeAst = {
          kind: "nullableType",
          underlyingType: { kind: "predefinedType", keyword: "object" },
        };
      }
    }

    const defaultExpr: CSharpExpressionAst = {
      kind: "defaultExpression",
      type: effectiveExpectedType ? returnTypeAst : undefined,
    };

    const isStatementExpr =
      operand.kind === "call" ||
      operand.kind === "new" ||
      operand.kind === "assignment" ||
      operand.kind === "update" ||
      operand.kind === "await";

    const operandStatements: readonly CSharpStatementAst[] = isNoopOperand
      ? []
      : [
          {
            kind: "expressionStatement",
            expression: isStatementExpr
              ? operandAst
              : ({
                  kind: "assignmentExpression",
                  operatorToken: "=",
                  left: identifierExpression("_"),
                  right: operandAst,
                } as CSharpExpressionAst),
          },
        ];

    const buildIife = (
      isAsync: boolean,
      funcReturnTypeAst: CSharpTypeAst
    ): CSharpExpressionAst => {
      const body: CSharpStatementAst = {
        kind: "blockStatement",
        statements: [
          ...operandStatements,
          { kind: "returnStatement", expression: defaultExpr },
        ],
      };
      const funcTypeAst: CSharpTypeAst = identifierType("global::System.Func", [
        funcReturnTypeAst,
      ]);
      const lambdaAst: CSharpExpressionAst = {
        kind: "lambdaExpression",
        isAsync,
        parameters: [],
        body,
      };
      const castAst: CSharpExpressionAst = {
        kind: "castExpression",
        type: funcTypeAst,
        expression: {
          kind: "parenthesizedExpression",
          expression: lambdaAst,
        },
      };
      return {
        kind: "invocationExpression",
        expression: {
          kind: "parenthesizedExpression",
          expression: castAst,
        },
        arguments: [],
      };
    };

    if (operand.kind === "await") {
      if (!currentContext.isAsync) {
        throw new Error(
          "ICE: `void await <expr>` reached emitter in a non-async context."
        );
      }

      const taskTypeAst: CSharpTypeAst = identifierType(
        "global::System.Threading.Tasks.Task",
        [returnTypeAst]
      );
      const iifeAst = buildIife(true, taskTypeAst);
      return [{ kind: "awaitExpression", expression: iifeAst }, currentContext];
    }

    return [buildIife(false, returnTypeAst), currentContext];
  }

  // Standard prefix operator: -, +, ~
  return [
    {
      kind: "prefixUnaryExpression",
      operatorToken: expr.operator,
      operand: operandAst,
    },
    newContext,
  ];
};

/**
 * Emit an update operator expression as CSharpExpressionAst (++, --)
 */
export const emitUpdate = (
  expr: Extract<IrExpression, { kind: "update" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [operandAst, newContext] = emitWritableTargetAst(
    expr.expression,
    context
  );

  if (expr.prefix) {
    return [
      {
        kind: "prefixUnaryExpression",
        operatorToken: expr.operator,
        operand: operandAst,
      },
      newContext,
    ];
  }

  return [
    {
      kind: "postfixUnaryExpression",
      operatorToken: expr.operator,
      operand: operandAst,
    },
    newContext,
  ];
};
