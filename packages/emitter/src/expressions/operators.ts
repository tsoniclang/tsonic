/**
 * Operator expression emitters (binary, logical, unary, update, assignment, conditional)
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, addUsing } from "../types.js";
import { emitExpression } from "../expression-emitter.js";

/**
 * Get operator precedence for proper parenthesization
 */
const getPrecedence = (operator: string): number => {
  const precedences: Record<string, number> = {
    "||": 5,
    "??": 5,
    "&&": 6,
    "|": 7,
    "^": 8,
    "&": 9,
    "==": 10,
    "!=": 10,
    "===": 10,
    "!==": 10,
    "<": 11,
    ">": 11,
    "<=": 11,
    ">=": 11,
    instanceof: 11,
    in: 11,
    "<<": 12,
    ">>": 12,
    ">>>": 12,
    "+": 13,
    "-": 13,
    "*": 14,
    "/": 14,
    "%": 14,
    "**": 15,
  };

  return precedences[operator] ?? 16;
};

/**
 * Emit a binary operator expression
 */
export const emitBinary = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [leftFrag, leftContext] = emitExpression(expr.left, context);
  const [rightFrag, rightContext] = emitExpression(expr.right, leftContext);

  // Map JavaScript operators to C# operators
  const operatorMap: Record<string, string> = {
    "===": "==",
    "!==": "!=",
    "==": "==", // Loose equality - needs special handling
    "!=": "!=", // Loose inequality - needs special handling
    instanceof: "is",
    in: "/* in */", // Needs special handling
  };

  const op = operatorMap[expr.operator] ?? expr.operator;

  // Handle typeof operator specially
  if (expr.operator === "instanceof") {
    const text = `${leftFrag.text} is ${rightFrag.text}`;
    return [{ text, precedence: 7 }, rightContext];
  }

  const text = `${leftFrag.text} ${op} ${rightFrag.text}`;
  return [{ text, precedence: getPrecedence(expr.operator) }, rightContext];
};

/**
 * Check if an IR type is boolean
 */
const isBooleanType = (type: IrExpression["inferredType"]): boolean => {
  if (!type) return false;
  return type.kind === "primitiveType" && type.name === "boolean";
};

/**
 * Emit a logical operator expression (&&, ||, ??)
 *
 * In TypeScript, || is used both for:
 * 1. Boolean OR (when operands are booleans)
 * 2. Nullish coalescing fallback (when left operand is nullable)
 *
 * In C#:
 * - || only works with booleans
 * - ?? is used for nullish coalescing
 *
 * We check if || is used with non-boolean operands and emit ?? instead.
 */
export const emitLogical = (
  expr: Extract<IrExpression, { kind: "logical" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [leftFrag, leftContext] = emitExpression(expr.left, context);
  const [rightFrag, rightContext] = emitExpression(expr.right, leftContext);

  // If || is used with non-boolean left operand, use ?? instead for nullish coalescing
  const operator =
    expr.operator === "||" && !isBooleanType(expr.left.inferredType)
      ? "??"
      : expr.operator;

  const text = `${leftFrag.text} ${operator} ${rightFrag.text}`;
  return [{ text, precedence: getPrecedence(expr.operator) }, rightContext];
};

/**
 * Emit a unary operator expression (-, +, !, ~, typeof, void, delete)
 */
export const emitUnary = (
  expr: Extract<IrExpression, { kind: "unary" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [operandFrag, newContext] = emitExpression(expr.expression, context);

  if (expr.operator === "typeof") {
    // typeof becomes Tsonic.Runtime.Operators.typeof()
    const updatedContext = addUsing(newContext, "Tsonic.Runtime");
    const text = `Tsonic.Runtime.Operators.@typeof(${operandFrag.text})`;
    return [{ text }, updatedContext];
  }

  if (expr.operator === "void") {
    // void expression - evaluate and discard
    const text = `(${operandFrag.text}, default)`;
    return [{ text }, newContext];
  }

  if (expr.operator === "delete") {
    // delete needs special handling
    const text = `/* delete ${operandFrag.text} */`;
    return [{ text }, newContext];
  }

  const text = `${expr.operator}${operandFrag.text}`;
  return [{ text, precedence: 15 }, newContext];
};

/**
 * Emit an update operator expression (++, --)
 */
export const emitUpdate = (
  expr: Extract<IrExpression, { kind: "update" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [operandFrag, newContext] = emitExpression(expr.expression, context);

  const text = expr.prefix
    ? `${expr.operator}${operandFrag.text}`
    : `${operandFrag.text}${expr.operator}`;

  return [{ text, precedence: 15 }, newContext];
};

/**
 * Emit an assignment expression (=, +=, -=, etc.)
 */
export const emitAssignment = (
  expr: Extract<IrExpression, { kind: "assignment" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Left side can be an expression or a pattern (for destructuring)
  let leftText: string;
  let leftContext: EmitterContext;

  if (
    "kind" in expr.left &&
    (expr.left.kind === "identifierPattern" ||
      expr.left.kind === "arrayPattern" ||
      expr.left.kind === "objectPattern")
  ) {
    // It's a pattern - for now emit a comment for destructuring
    if (expr.left.kind === "identifierPattern") {
      leftText = expr.left.name;
      leftContext = context;
    } else {
      leftText = "/* destructuring */";
      leftContext = context;
    }
  } else {
    const [leftFrag, ctx] = emitExpression(expr.left as IrExpression, context);
    leftText = leftFrag.text;
    leftContext = ctx;
  }

  const [rightFrag, rightContext] = emitExpression(expr.right, leftContext);

  const text = `${leftText} ${expr.operator} ${rightFrag.text}`;
  return [{ text, precedence: 3 }, rightContext];
};

/**
 * Emit a conditional (ternary) expression
 */
export const emitConditional = (
  expr: Extract<IrExpression, { kind: "conditional" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [condFrag, condContext] = emitExpression(expr.condition, context);
  const [trueFrag, trueContext] = emitExpression(expr.whenTrue, condContext);
  const [falseFrag, falseContext] = emitExpression(expr.whenFalse, trueContext);

  const text = `${condFrag.text} ? ${trueFrag.text} : ${falseFrag.text}`;
  return [{ text, precedence: 4 }, falseContext];
};
