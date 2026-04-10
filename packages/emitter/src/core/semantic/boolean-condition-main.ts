/**
 * Main boolean-condition lowering (toBooleanConditionAst, emitBooleanConditionAst)
 *
 * In TypeScript, any value can be used in a boolean context (truthy/falsy).
 * In C#, only boolean expressions are valid conditions (if/while/for/?:/!).
 *
 * This module provides the main boolean-condition lowering functions
 * that dispatch to appropriate truthiness checks based on type.
 *
 * IMPORTANT:
 * - This operates on IR + emitted AST; it must not import emitExpressionAst to avoid cycles.
 * - Callers provide an emit function.
 */

import type { IrExpression } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { allocateLocalName } from "../format/local-names.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import {
  booleanLiteral,
  charLiteral,
  decimalIntegerLiteral,
} from "../format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import {
  coerceClrPrimitiveToPrimitiveType,
  emitRuntimeTruthinessConditionAst,
  isBooleanType,
  identifierExpr,
  isInherentlyBooleanExpression,
  predefinedType,
  resolveLocalTypeAlias,
  typeReferenceExpr,
  wrapForIs,
} from "./truthiness-evaluation.js";
import { applyLogicalOperandNarrowing } from "./condition-branch-narrowing.js";
import { emitUnionTruthinessConditionAst } from "./boolean-condition-union.js";
import { emitTypeAst } from "../../type-emitter.js";

export type EmitExprAstFn = (
  expr: IrExpression,
  context: EmitterContext
) => [CSharpExpressionAst, EmitterContext];

// ============================================================
// Main boolean-condition lowering (AST-native)
// ============================================================

/**
 * Convert an expression to a valid C# boolean condition, returning a typed AST node.
 *
 * Rules (deterministic):
 * - Booleans: use as-is
 * - Reference types (objects, arrays, dictionaries, unions, ...): runtime truthiness
 * - Strings: `!string.IsNullOrEmpty(expr)`
 * - Numbers: JS truthiness check: false iff 0 or NaN
 * - int: `expr != 0`
 * - char: `expr != '\0'`
 * - null/undefined literals: `false`
 */
export const toBooleanConditionAst = (
  expr: IrExpression,
  emittedAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const inferredType = resolveEffectiveExpressionType(expr, context);
  const resolved = inferredType
    ? resolveLocalTypeAlias(
        coerceClrPrimitiveToPrimitiveType(inferredType) ?? inferredType,
        context
      )
    : undefined;
  const type = resolved;

  // Literal truthiness can be fully resolved without re-evaluating anything.
  if (expr.kind === "literal") {
    if (expr.value === null || expr.value === undefined) {
      return [booleanLiteral(false), context];
    }
    if (typeof expr.value === "boolean") {
      return [booleanLiteral(expr.value), context];
    }
    if (typeof expr.value === "number") {
      return [booleanLiteral(expr.value !== 0), context];
    }
    if (typeof expr.value === "string") {
      return [booleanLiteral(expr.value.length !== 0), context];
    }
  }

  // If already boolean, use as-is
  if (isBooleanType(type)) {
    return [emittedAst, context];
  }

  // If we can prove from syntax alone that this is a boolean expression, use as-is.
  if (isInherentlyBooleanExpression(expr)) {
    return [emittedAst, context];
  }

  // Unknown/any/missing type: use a safe runtime truthiness check instead of `!= null`,
  // which can silently miscompile boxed value types (e.g., bool).
  if (!type || type.kind === "unknownType" || type.kind === "anyType") {
    return emitRuntimeTruthinessConditionAst(emittedAst, context);
  }

  if (type.kind === "unionType") {
    return emitUnionTruthinessConditionAst(
      expr,
      emittedAst,
      type,
      context,
      toBooleanConditionAst,
      emitTypeAst
    );
  }

  // Non-primitive types in TS can still map to CLR value types (e.g. `long`, `System.Boolean` wrappers).
  // Never emit `x != null` here: it can silently miscompile boxed value types (always true).
  // Use canonical runtime truthiness instead.
  if (type.kind !== "primitiveType") {
    return emitRuntimeTruthinessConditionAst(emittedAst, context);
  }

  // For primitives that are not boolean
  if (type.kind === "primitiveType") {
    switch (type.name) {
      case "null":
      case "undefined":
        return [booleanLiteral(false), context];

      case "string":
        // !string.IsNullOrEmpty(expr)
        return [
          {
            kind: "parenthesizedExpression",
            expression: {
              kind: "prefixUnaryExpression",
              operatorToken: "!",
              operand: {
                kind: "invocationExpression",
                expression: {
                  kind: "memberAccessExpression",
                  expression: typeReferenceExpr(predefinedType("string")),
                  memberName: "IsNullOrEmpty",
                },
                arguments: [emittedAst],
              },
            },
          },
          context,
        ];

      case "int":
        // expr != 0
        return [
          {
            kind: "parenthesizedExpression",
            expression: {
              kind: "binaryExpression",
              operatorToken: "!=",
              left: emittedAst,
              right: decimalIntegerLiteral(0),
            },
          },
          context,
        ];

      case "char":
        // expr != '\0'
        return [
          {
            kind: "parenthesizedExpression",
            expression: {
              kind: "binaryExpression",
              operatorToken: "!=",
              left: emittedAst,
              right: charLiteral("\0"),
            },
          },
          context,
        ];

      case "number": {
        // JS truthiness for numbers: falsy iff 0 or NaN.
        // Use a pattern var to avoid evaluating the expression twice.
        // Build: (operand is double __tmp && __tmp != 0 && !double.IsNaN(__tmp))
        const nextId = (context.tempVarId ?? 0) + 1;
        const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
        const numAlloc = allocateLocalName(
          `__tsonic_truthy_num_${nextId}`,
          ctxWithId
        );
        const tmp = numAlloc.emittedName;
        return [
          {
            kind: "parenthesizedExpression",
            expression: {
              kind: "binaryExpression",
              operatorToken: "&&",
              left: {
                kind: "isExpression",
                expression: wrapForIs(emittedAst),
                pattern: {
                  kind: "declarationPattern",
                  type: { kind: "predefinedType", keyword: "double" },
                  designation: tmp,
                },
              },
              right: {
                kind: "binaryExpression",
                operatorToken: "&&",
                left: {
                  kind: "binaryExpression",
                  operatorToken: "!=",
                  left: identifierExpr(tmp),
                  right: decimalIntegerLiteral(0),
                },
                right: {
                  kind: "prefixUnaryExpression",
                  operatorToken: "!",
                  operand: {
                    kind: "invocationExpression",
                    expression: {
                      kind: "memberAccessExpression",
                      expression: typeReferenceExpr(predefinedType("double")),
                      memberName: "IsNaN",
                    },
                    arguments: [identifierExpr(tmp)],
                  },
                },
              },
            },
          },
          numAlloc.context,
        ];
      }

      case "boolean":
        return [emittedAst, context];
    }
  }

  return [emittedAst, context];
};

/**
 * Emit a boolean-context expression as a typed AST node.
 *
 * Special-cases logical &&/|| into proper binaryExpression AST nodes
 * with printer-handled parenthesization.
 */
export const emitBooleanConditionAst = (
  expr: IrExpression,
  emitExprAst: EmitExprAstFn,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (
    expr.kind === "logical" &&
    (expr.operator === "&&" || expr.operator === "||")
  ) {
    const [leftAst, leftCtx] = emitBooleanConditionAst(
      expr.left,
      emitExprAst,
      context
    );
    const rightBaseContext = applyLogicalOperandNarrowing(
      expr.left,
      expr.operator,
      leftCtx,
      emitExprAst
    );
    const [rightAst, rightCtx] = emitBooleanConditionAst(
      expr.right,
      emitExprAst,
      rightBaseContext
    );
    const finalContext: EmitterContext = {
      ...rightCtx,
      localNameMap: context.localNameMap,
      conditionAliases: context.conditionAliases,
      localSemanticTypes: context.localSemanticTypes,
      localValueTypes: context.localValueTypes,
      tempVarId: Math.max(
        context.tempVarId ?? 0,
        leftCtx.tempVarId ?? 0,
        rightCtx.tempVarId ?? 0
      ),
      usings: new Set([
        ...(context.usings ?? []),
        ...(leftCtx.usings ?? []),
        ...(rightCtx.usings ?? []),
      ]),
      usedLocalNames: new Set([
        ...(context.usedLocalNames ?? []),
        ...(leftCtx.usedLocalNames ?? []),
        ...(rightCtx.usedLocalNames ?? []),
      ]),
      narrowedBindings: leftCtx.narrowedBindings,
    };

    return [
      {
        kind: "binaryExpression",
        operatorToken: expr.operator,
        left: leftAst,
        right: rightAst,
      },
      finalContext,
    ];
  }

  const [exprAst, exprCtx] = emitExprAst(expr, context);
  return toBooleanConditionAst(expr, exprAst, exprCtx);
};
