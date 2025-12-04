/**
 * Operator expression emitters (binary, logical, unary, update, assignment, conditional)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, NarrowedBinding } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { getExpectedClrTypeForNumeric } from "./literals.js";
import {
  resolveTypeAlias,
  stripNullish,
  findUnionMemberIndex,
} from "../core/type-resolution.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";

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
 * Get the C# type name for an integer CLR type (for explicit casts).
 * Returns the type keyword or undefined if not an integer type.
 */
const getIntegerCastType = (irType: IrType | undefined): string | undefined => {
  const clrType = getExpectedClrTypeForNumeric(irType);
  if (!clrType) return undefined;

  // Map to C# type keywords for casts
  const typeMap: Record<string, string> = {
    int: "int",
    Int32: "int",
    "System.Int32": "int",
    long: "long",
    Int64: "long",
    "System.Int64": "long",
    short: "short",
    Int16: "short",
    "System.Int16": "short",
    byte: "byte",
    Byte: "byte",
    "System.Byte": "byte",
    sbyte: "sbyte",
    SByte: "sbyte",
    "System.SByte": "sbyte",
    uint: "uint",
    UInt32: "uint",
    "System.UInt32": "uint",
    ulong: "ulong",
    UInt64: "ulong",
    "System.UInt64": "ulong",
    ushort: "ushort",
    UInt16: "ushort",
    "System.UInt16": "ushort",
  };

  return typeMap[clrType];
};

/**
 * Emit a binary operator expression
 *
 * When the expression has an integer inferredType (from `as int` etc.),
 * or when expectedType requires an integer, we wrap the result with an
 * explicit cast to ensure correct C# semantics.
 * This handles cases like `(i + 1) as int` which must emit as `(int)(i + 1)`.
 *
 * @param expr - The binary expression
 * @param context - Emitter context
 * @param expectedType - Optional expected type from outer context (assignment, return, etc.)
 */
export const emitBinary = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  // Check if this binary expression should produce an integer result
  // Priority: expression's own inferredType > expectedType from context
  const integerCastType =
    getIntegerCastType(expr.inferredType) || getIntegerCastType(expectedType);

  // Pass expected type to children so literals emit correctly
  const [leftFrag, leftContext] = emitExpression(
    expr.left,
    context,
    integerCastType ? expr.inferredType : undefined
  );
  const [rightFrag, rightContext] = emitExpression(
    expr.right,
    leftContext,
    integerCastType ? expr.inferredType : undefined
  );

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

  let text = `${leftFrag.text} ${op} ${rightFrag.text}`;

  // Wrap with explicit cast if integer type is required
  // This ensures correctness even if child expressions have mixed types
  if (integerCastType) {
    text = `(${integerCastType})(${text})`;
  }

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
 *
 * When the expression has an integer inferredType (from `as int` etc.),
 * or when expectedType requires an integer, we wrap the result with an
 * explicit cast. This handles `-1 as int`.
 *
 * @param expr - The unary expression
 * @param context - Emitter context
 * @param expectedType - Optional expected type from outer context
 */
export const emitUnary = (
  expr: Extract<IrExpression, { kind: "unary" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  // Check if this unary expression should produce an integer result
  // Priority: expression's own inferredType > expectedType from context
  const integerCastType =
    getIntegerCastType(expr.inferredType) || getIntegerCastType(expectedType);

  // Pass expected type to operand so literals emit correctly
  const [operandFrag, newContext] = emitExpression(
    expr.expression,
    context,
    integerCastType ? expr.inferredType : undefined
  );

  if (expr.operator === "typeof") {
    // typeof becomes global::Tsonic.Runtime.Operators.typeof()
    const text = `global::Tsonic.Runtime.Operators.@typeof(${operandFrag.text})`;
    return [{ text }, newContext];
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

  let text = `${expr.operator}${operandFrag.text}`;

  // Wrap with explicit cast if integer type is required
  // This handles cases like `-1 as int` emitting as `(int)(-1)`
  if (integerCastType && (expr.operator === "-" || expr.operator === "+")) {
    text = `(${integerCastType})(${text})`;
  }

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
 *
 * Passes the LHS type as expected type to RHS, enabling proper integer
 * literal emission for cases like `this.value = this.value + 1`.
 */
export const emitAssignment = (
  expr: Extract<IrExpression, { kind: "assignment" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Left side can be an expression or a pattern (for destructuring)
  let leftText: string;
  let leftContext: EmitterContext;
  let leftType: IrType | undefined;

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
      leftType = expr.left.type; // Patterns use `type`, not `inferredType`
    } else {
      leftText = "/* destructuring */";
      leftContext = context;
    }
  } else {
    const leftExpr = expr.left as IrExpression;
    const [leftFrag, ctx] = emitExpression(leftExpr, context);
    leftText = leftFrag.text;
    leftContext = ctx;
    leftType = leftExpr.inferredType;
  }

  // Pass LHS type as expected type to RHS for proper integer handling
  const [rightFrag, rightContext] = emitExpression(
    expr.right,
    leftContext,
    leftType
  );

  const text = `${leftText} ${expr.operator} ${rightFrag.text}`;
  return [{ text, precedence: 3 }, rightContext];
};

/**
 * Try to extract ternary guard info from a condition expression.
 * Handles both `isUser(x)` (positive) and `!isUser(x)` (negated).
 * Returns guard info with polarity indicating which branch to narrow.
 */
type TernaryGuardInfo = {
  readonly originalName: string;
  readonly memberN: number;
  readonly escapedOrig: string;
  readonly polarity: "positive" | "negative"; // positive = narrow whenTrue, negative = narrow whenFalse
};

const tryResolveTernaryGuard = (
  condition: IrExpression,
  context: EmitterContext
): TernaryGuardInfo | undefined => {
  // Check for direct call: isUser(x)
  const resolveFromCall = (
    call: Extract<IrExpression, { kind: "call" }>
  ): TernaryGuardInfo | undefined => {
    const narrowing = call.narrowing;
    if (!narrowing || narrowing.kind !== "typePredicate") return undefined;

    const arg = call.arguments[narrowing.argIndex];
    if (
      !arg ||
      ("kind" in arg && arg.kind === "spread") ||
      arg.kind !== "identifier"
    ) {
      return undefined;
    }

    const originalName = arg.name;
    const unionSourceType = arg.inferredType;
    if (!unionSourceType) return undefined;

    const resolved = resolveTypeAlias(stripNullish(unionSourceType), context);
    if (resolved.kind !== "unionType") return undefined;

    const idx = findUnionMemberIndex(resolved, narrowing.targetType, context);
    if (idx === undefined) return undefined;

    return {
      originalName,
      memberN: idx + 1,
      escapedOrig: escapeCSharpIdentifier(originalName),
      polarity: "positive",
    };
  };

  // Direct call: isUser(x) -> narrow whenTrue
  if (condition.kind === "call") {
    return resolveFromCall(condition);
  }

  // Negated call: !isUser(x) -> narrow whenFalse
  if (
    condition.kind === "unary" &&
    condition.operator === "!" &&
    condition.expression.kind === "call"
  ) {
    const guard = resolveFromCall(condition.expression);
    if (guard) {
      return { ...guard, polarity: "negative" };
    }
  }

  return undefined;
};

/**
 * Emit a conditional (ternary) expression
 *
 * Supports type predicate narrowing:
 * - `isUser(x) ? x.name : "anon"` → `x.Is1() ? (x.As1()).name : "anon"`
 * - `!isUser(x) ? "anon" : x.name` → `!x.Is1() ? "anon" : (x.As1()).name`
 *
 * @param expr - The conditional expression
 * @param context - Emitter context
 * @param expectedType - Optional expected type (for null → default in generic contexts)
 */
export const emitConditional = (
  expr: Extract<IrExpression, { kind: "conditional" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  // Try to detect type predicate guard in condition
  const guard = tryResolveTernaryGuard(expr.condition, context);

  if (guard) {
    const { originalName, memberN, escapedOrig, polarity } = guard;

    // Build condition text
    const condText =
      polarity === "positive"
        ? `${escapedOrig}.Is${memberN}()`
        : `!${escapedOrig}.Is${memberN}()`;

    // Create inline narrowing binding: x -> (x.AsN())
    const inlineExpr = `(${escapedOrig}.As${memberN}())`;
    const narrowedMap = new Map<string, NarrowedBinding>(
      context.narrowedBindings ?? []
    );
    narrowedMap.set(originalName, { kind: "expr", exprText: inlineExpr });

    const narrowedContext: EmitterContext = {
      ...context,
      narrowedBindings: narrowedMap,
    };

    // Apply narrowing to the appropriate branch
    const [trueFrag, trueContext] =
      polarity === "positive"
        ? emitExpression(expr.whenTrue, narrowedContext, expectedType)
        : emitExpression(expr.whenTrue, context, expectedType);

    const [falseFrag, falseContext] =
      polarity === "negative"
        ? emitExpression(expr.whenFalse, narrowedContext, expectedType)
        : emitExpression(expr.whenFalse, trueContext, expectedType);

    const text = `${condText} ? ${trueFrag.text} : ${falseFrag.text}`;

    // Return context WITHOUT narrowing (don't leak)
    const finalContext: EmitterContext = {
      ...falseContext,
      narrowedBindings: context.narrowedBindings,
    };
    return [{ text, precedence: 4 }, finalContext];
  }

  // Standard ternary emission (no narrowing)
  const [condFrag, condContext] = emitExpression(expr.condition, context);
  // Pass expectedType to both branches for null → default conversion
  const [trueFrag, trueContext] = emitExpression(
    expr.whenTrue,
    condContext,
    expectedType
  );
  const [falseFrag, falseContext] = emitExpression(
    expr.whenFalse,
    trueContext,
    expectedType
  );

  const text = `${condFrag.text} ? ${trueFrag.text} : ${falseFrag.text}`;
  return [{ text, precedence: 4 }, falseContext];
};
