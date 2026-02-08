/**
 * Boolean-context emission (truthiness / ToBoolean)
 *
 * In TypeScript, any value can be used in a boolean context (truthy/falsy).
 * In C#, only boolean expressions are valid conditions (if/while/for/?:/!).
 *
 * This module provides a shared, deterministic lowering for boolean contexts.
 *
 * IMPORTANT:
 * - This operates on IR + emitted text; it must not import emitExpression to avoid cycles.
 * - Callers provide an emitExpression-like function.
 */

import type { IrExpression, IrType } from "@tsonic/frontend";
import type { CSharpFragment, EmitterContext } from "../types.js";
import { allocateLocalName } from "./local-names.js";

export type EmitExprFn = (
  expr: IrExpression,
  context: EmitterContext
) => [CSharpFragment, EmitterContext];

/**
 * Check if an expression's inferred type is boolean.
 */
const isBooleanCondition = (expr: IrExpression): boolean => {
  const type = expr.inferredType;
  if (!type) return false;
  return type.kind === "primitiveType" && type.name === "boolean";
};

/**
 * Expressions that are always boolean in JS/TS, even if the IR is missing inferredType.
 *
 * This makes boolean-context emission robust: comparisons and `!expr` are already valid
 * C# conditions and should not be rewritten to `!= null` fallbacks.
 */
const isInherentlyBooleanExpression = (expr: IrExpression): boolean => {
  if (expr.kind === "binary") {
    return (
      expr.operator === "==" ||
      expr.operator === "!=" ||
      expr.operator === "===" ||
      expr.operator === "!==" ||
      expr.operator === "<" ||
      expr.operator === ">" ||
      expr.operator === "<=" ||
      expr.operator === ">=" ||
      expr.operator === "instanceof" ||
      expr.operator === "in"
    );
  }

  if (expr.kind === "unary") {
    return expr.operator === "!";
  }

  return false;
};

const isSimpleOperandExpression = (expr: IrExpression): boolean => {
  // These IR kinds emit C# primary/postfix expressions that don't need parentheses
  // before appending a comparison like `!= null` / `!= 0`.
  switch (expr.kind) {
    case "identifier":
    case "memberAccess":
    case "call":
    case "new":
    case "this":
    case "literal":
      return true;
    default:
      return false;
  }
};

/**
 * Convert an expression to a valid C# boolean condition.
 *
 * Rules (deterministic):
 * - Booleans: use as-is
 * - Reference types (objects, arrays, dictionaries, unions, ...): `expr != null`
 * - Strings: `!string.IsNullOrEmpty(expr)`
 * - Numbers: JS truthiness check: false iff 0 or NaN
 * - int: `expr != 0`
 * - char: `expr != '\\0'`
 * - null/undefined literals: `false`
 */
export const toBooleanCondition = (
  expr: IrExpression,
  emittedText: string,
  context: EmitterContext
): [string, EmitterContext] => {
  // Literal truthiness can be fully resolved without re-evaluating anything.
  if (expr.kind === "literal") {
    if (expr.value === null || expr.value === undefined) {
      return ["false", context];
    }
    if (typeof expr.value === "boolean") {
      return [expr.value ? "true" : "false", context];
    }
    if (typeof expr.value === "number") {
      return [expr.value === 0 ? "false" : "true", context];
    }
    if (typeof expr.value === "string") {
      return [expr.value.length === 0 ? "false" : "true", context];
    }
  }

  // If already boolean, use as-is
  if (isBooleanCondition(expr)) {
    return [emittedText, context];
  }

  // If we can prove from syntax alone that this is a boolean expression, use as-is.
  if (isInherentlyBooleanExpression(expr)) {
    return [emittedText, context];
  }

  // For reference types (non-primitive), add != null check
  const type = expr.inferredType;
  if (type && type.kind !== "primitiveType") {
    // Special-case literalType (which behaves like its primitive base) to avoid `0 != null` etc.
    if (type.kind === "literalType") {
      if (typeof type.value === "boolean") {
        return [type.value ? "true" : "false", context];
      }
      if (typeof type.value === "number") {
        return [type.value === 0 ? "false" : "true", context];
      }
      if (typeof type.value === "string") {
        return [type.value.length === 0 ? "false" : "true", context];
      }
    }
    const operand = isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`;
    return [`${operand} != null`, context];
  }

  // Default: assume it's a reference type and add null check
  // This handles cases where type inference didn't work
  if (!type) {
    const operand = isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`;
    return [`${operand} != null`, context];
  }

  // For primitives that are not boolean
  if (type.kind === "primitiveType") {
    switch (type.name) {
      case "null":
      case "undefined":
        return ["false", context];

      case "string":
        return [`!string.IsNullOrEmpty(${emittedText})`, context];

      case "int":
        return [
          `${isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`} != 0`,
          context,
        ];

      case "char":
        return [
          `${isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`} != '\\0'`,
          context,
        ];

      case "number": {
        // JS truthiness for numbers: falsy iff 0 or NaN.
        // Use a pattern var to avoid evaluating the expression twice.
        const nextId = (context.tempVarId ?? 0) + 1;
        let ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
        const alloc = allocateLocalName(`__tsonic_truthy_num_${nextId}`, ctxWithId);
        ctxWithId = alloc.context;
        const tmp = alloc.emittedName;
        return [
          `(${emittedText} is double ${tmp} && ${tmp} != 0 && !double.IsNaN(${tmp}))`,
          ctxWithId,
        ];
      }

      case "boolean":
        return [emittedText, context];
    }
  }

  return [emittedText, context];
};

/**
 * Emit a boolean-context expression.
 *
 * Special-cases logical &&/|| so that `ToBoolean(a && b)` is emitted as
 * `ToBoolean(a) && ToBoolean(b)` (and similarly for `||`), matching JS.
 */
export const emitBooleanCondition = (
  expr: IrExpression,
  emitExpr: EmitExprFn,
  context: EmitterContext
): [string, EmitterContext] => {
  const getLogicalPrecedence = (op: "&&" | "||"): number => (op === "&&" ? 6 : 5);

  const maybeParenthesizeLogicalOperand = (
    operandExpr: IrExpression,
    operandText: string,
    parentOp: "&&" | "||"
  ): string => {
    if (operandExpr.kind !== "logical") return operandText;
    if (operandExpr.operator !== "&&" && operandExpr.operator !== "||") return operandText;

    const parentPrec = getLogicalPrecedence(parentOp);
    const childPrec = getLogicalPrecedence(operandExpr.operator);
    return childPrec < parentPrec ? `(${operandText})` : operandText;
  };

  if (expr.kind === "logical" && (expr.operator === "&&" || expr.operator === "||")) {
    const [lhsText, lhsCtx] = emitBooleanCondition(expr.left, emitExpr, context);
    const [rhsText, rhsCtx] = emitBooleanCondition(expr.right, emitExpr, lhsCtx);

    const lhsWrapped = maybeParenthesizeLogicalOperand(expr.left, lhsText, expr.operator);
    const rhsWrapped = maybeParenthesizeLogicalOperand(expr.right, rhsText, expr.operator);
    return [`${lhsWrapped} ${expr.operator} ${rhsWrapped}`, rhsCtx];
  }

  const [frag, next] = emitExpr(expr, context);
  return toBooleanCondition(expr, frag.text, next);
};

/**
 * Whether a type is boolean.
 *
 * Used by callers that need a fast check (e.g., logical operator selection).
 */
export const isBooleanType = (type: IrType | undefined): boolean => {
  return !!type && type.kind === "primitiveType" && type.name === "boolean";
};
