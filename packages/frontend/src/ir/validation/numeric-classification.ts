/**
 * Numeric Classification - Expression classification and type helpers
 *
 * This sub-module provides:
 * - classifyNumericExpr: Classify an expression's numeric kind
 * - hasExplicitDoubleIntent: Check if an expression has explicit double intent
 * - getExpectedNumericKind: Get the expected numeric kind from a type
 * - tryGetObjectPropertyType: Extract expected type of a property from structural type
 * - tryGetTupleElementType: Extract expected type of a tuple element
 * - needsCoercion: Check if an expression needs coercion to match expected type
 * - describeExpression: Get human-readable description of an expression
 * - moduleLocation: Create a source location for a module
 *
 * Split from numeric-coercion-pass.ts for file-size management.
 */

import { SourceLocation, type Diagnostic } from "../../types/diagnostic.js";
import {
  IrExpression,
  IrType,
  IrInterfaceMember,
  getBinaryResultKind,
} from "../types.js";
import {
  NumericKind,
  isWideningConversion,
  TSONIC_TO_NUMERIC_KIND,
  literalFitsInKind,
} from "../types/numeric-kind.js";

/**
 * Maximum absolute value for a 32-bit float (Single).
 * Used for validating literal narrowing to float.
 */
const MAX_FLOAT_ABS = 3.4028235e38;

/**
 * Result of numeric expression classification.
 * - "Int32": Expression definitely produces an Int32 value
 * - "Double": Expression definitely produces a Double value
 * - "Unknown": Cannot determine at compile time (e.g., untyped identifier, complex call)
 */
export type NumericExprKind = "Int32" | "Double" | "Unknown";

/**
 * Arithmetic operators that produce numeric results.
 * Used to classify binary expression results.
 */
const ARITHMETIC_OPERATORS = new Set(["+", "-", "*", "/", "%"]);

/**
 * Classify an expression's numeric kind.
 *
 * This function propagates numeric kind through:
 * - Literals (via numericIntent)
 * - Identifiers with primitiveType(name="int") or primitiveType(name="number")
 * - Arithmetic operations (uses C# promotion rules)
 * - Unary +/- (preserves operand kind)
 * - Ternary (requires both branches to have same kind)
 * - Parentheses (pass through)
 * - numericNarrowing expressions (uses targetKind)
 *
 * Returns "Unknown" for expressions that cannot be classified.
 */
export const classifyNumericExpr = (expr: IrExpression): NumericExprKind => {
  switch (expr.kind) {
    case "literal": {
      // Check numericIntent on literal expressions
      if (typeof expr.value === "number" && expr.numericIntent) {
        return expr.numericIntent === "Int32" ? "Int32" : "Double";
      }
      // Non-numeric literals
      return "Unknown";
    }

    case "identifier": {
      // Check inferredType on identifiers
      if (expr.inferredType?.kind === "primitiveType") {
        if (expr.inferredType.name === "int") return "Int32";
        if (expr.inferredType.name === "number") return "Double";
      }
      // Also check for CLR numeric reference types
      if (expr.inferredType?.kind === "referenceType") {
        const name = expr.inferredType.name;
        if (name === "Int32" || name === "int") return "Int32";
        if (name === "Double" || name === "double") return "Double";
      }
      return "Unknown";
    }

    case "unary": {
      // Unary +/- preserves operand kind
      if (expr.operator === "+" || expr.operator === "-") {
        return classifyNumericExpr(expr.expression);
      }
      // Bitwise NOT (~) produces Int32
      if (expr.operator === "~") {
        return "Int32";
      }
      return "Unknown";
    }

    case "binary": {
      // Only classify arithmetic operators
      if (!ARITHMETIC_OPERATORS.has(expr.operator)) {
        return "Unknown";
      }
      const leftKind = classifyNumericExpr(expr.left);
      const rightKind = classifyNumericExpr(expr.right);

      // If either is Unknown, we can't classify
      if (leftKind === "Unknown" || rightKind === "Unknown") {
        return "Unknown";
      }

      // Use C# binary promotion rules
      // Note: getBinaryResultKind returns NumericKind, we map to our simplified type
      const resultKind = getBinaryResultKind(
        leftKind === "Int32" ? "Int32" : "Double",
        rightKind === "Int32" ? "Int32" : "Double"
      );

      // Map back to our simplified kind
      if (resultKind === "Double" || resultKind === "Single") return "Double";
      return "Int32"; // All integer promotions end up as at least Int32
    }

    case "conditional": {
      // Ternary: both branches must have same kind
      const trueKind = classifyNumericExpr(expr.whenTrue);
      const falseKind = classifyNumericExpr(expr.whenFalse);

      if (trueKind === falseKind) return trueKind;
      // Mismatched branches - use promotion
      if (trueKind === "Double" || falseKind === "Double") return "Double";
      return "Unknown";
    }

    case "numericNarrowing": {
      // numericNarrowing has explicit targetKind
      if (expr.targetKind === "Int32") return "Int32";
      if (expr.targetKind === "Double") return "Double";
      // Other numeric kinds (Byte, Int64, etc.) - treat as Unknown for this pass
      return "Unknown";
    }

    case "call": {
      // Check return type
      if (expr.inferredType?.kind === "primitiveType") {
        if (expr.inferredType.name === "int") return "Int32";
        if (expr.inferredType.name === "number") return "Double";
      }
      return "Unknown";
    }

    case "memberAccess": {
      // Check inferredType for member access results
      if (expr.inferredType?.kind === "primitiveType") {
        if (expr.inferredType.name === "int") return "Int32";
        if (expr.inferredType.name === "number") return "Double";
      }
      return "Unknown";
    }

    case "update": {
      // ++/-- on int produces int
      const operandKind = classifyNumericExpr(expr.expression);
      return operandKind;
    }

    default:
      return "Unknown";
  }
};

/**
 * Check if an expression has explicit double intent.
 * This is true when:
 * - It's a numericNarrowing with targetKind "Double" (i.e., `42 as number`)
 * - It's a literal with numericIntent "Double" (i.e., `42.0`)
 *
 * Used to exempt explicit casts from TSN5110 errors.
 */
export const hasExplicitDoubleIntent = (expr: IrExpression): boolean => {
  // Case 1: numericNarrowing targeting Double (e.g., `42 as number`, `42 as double`)
  if (expr.kind === "numericNarrowing" && expr.targetKind === "Double") {
    return true;
  }

  // Case 2: Literal with double lexeme (e.g., `42.0`)
  if (
    expr.kind === "literal" &&
    typeof expr.value === "number" &&
    expr.numericIntent === "Double"
  ) {
    return true;
  }

  return false;
};

/**
 * Context for tracking coercion validation
 */
export type CoercionContext = {
  readonly filePath: string;
  readonly diagnostics: Diagnostic[];
};

/**
 * Create a source location for a module
 */
export const moduleLocation = (ctx: CoercionContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

/**
 * Get the expected numeric kind from a type.
 * Returns undefined if the type is not a numeric type.
 *
 * Maps:
 * - primitiveType("number") → "Double"
 * - primitiveType("int") → "Int32"
 * - referenceType with name in TSONIC_TO_NUMERIC_KIND → corresponding kind
 */
export const getExpectedNumericKind = (
  type: IrType | undefined
): NumericKind | undefined => {
  if (!type) return undefined;

  // Strip nullish wrapper if present (T | null | undefined → T)
  const baseType =
    type.kind === "unionType"
      ? type.types.find(
          (t) =>
            !(
              t.kind === "primitiveType" &&
              (t.name === "null" || t.name === "undefined")
            )
        )
      : type;

  if (!baseType) return undefined;

  // primitiveType mapping
  if (baseType.kind === "primitiveType") {
    if (baseType.name === "number") return "Double";
    if (baseType.name === "int") return "Int32";
    // Check if it's a known numeric type alias
    const kind = TSONIC_TO_NUMERIC_KIND.get(baseType.name);
    if (kind) return kind;
  }

  // referenceType mapping (CLR types like Int32, Double, etc.)
  if (baseType.kind === "referenceType") {
    const name = baseType.name;
    // Direct CLR type names
    if (name === "Int32" || name === "int") return "Int32";
    if (name === "Double" || name === "double") return "Double";
    if (name === "Int64" || name === "long") return "Int64";
    if (name === "Single" || name === "float") return "Single";
    // Check the mapping table
    const kind = TSONIC_TO_NUMERIC_KIND.get(name.toLowerCase());
    if (kind) return kind;
  }

  return undefined;
};

/**
 * Extract the expected type of a property from a structural type.
 *
 * Used for validating object literal properties against their expected types.
 * Returns undefined if the property type cannot be determined (conservative).
 *
 * Handles:
 * - objectType: inline object types like `{ x: number }`
 * - referenceType with structuralMembers: interfaces and type aliases
 */
export const tryGetObjectPropertyType = (
  expectedType: IrType | undefined,
  propName: string
): IrType | undefined => {
  if (!expectedType) return undefined;

  // Structural object type: objectType has members directly
  if (expectedType.kind === "objectType") {
    const member = expectedType.members.find(
      (m): m is IrInterfaceMember & { kind: "propertySignature" } =>
        m.kind === "propertySignature" && m.name === propName
    );
    return member?.type;
  }

  // Reference type with structural members (interfaces, type aliases)
  if (expectedType.kind === "referenceType" && expectedType.structuralMembers) {
    const member = expectedType.structuralMembers.find(
      (m): m is IrInterfaceMember & { kind: "propertySignature" } =>
        m.kind === "propertySignature" && m.name === propName
    );
    return member?.type;
  }

  return undefined;
};

/**
 * Extract the expected type of a tuple element at a given index.
 *
 * Used for validating tuple literal elements against their expected types.
 * Returns undefined if the element type cannot be determined.
 */
export const tryGetTupleElementType = (
  expectedType: IrType | undefined,
  index: number
): IrType | undefined => {
  if (!expectedType) return undefined;

  if (expectedType.kind === "tupleType") {
    return expectedType.elementTypes[index];
  }

  return undefined;
};

/**
 * Check if an expression needs coercion to match an expected numeric type.
 *
 * Returns true (error) only for NARROWING conversions.
 * Widening conversions (e.g., Int32 → Double) are implicitly allowed.
 *
 * Rules:
 * - Same kind → OK
 * - Widening (isWideningConversion returns true) → OK
 * - Narrowing → requires explicit intent (numericNarrowing node)
 */
export const needsCoercion = (
  expr: IrExpression,
  expectedType: IrType | undefined
): boolean => {
  // Get numeric kinds
  const expectedKind = getExpectedNumericKind(expectedType);
  const actualKind = classifyNumericExpr(expr);

  // If either is not a numeric type, no coercion check needed
  if (expectedKind === undefined || actualKind === "Unknown") {
    return false;
  }

  // Map actualKind to NumericKind (classifyNumericExpr returns "Int32" | "Double" | "Unknown")
  const actualNumericKind: NumericKind =
    actualKind === "Int32" ? "Int32" : "Double";

  // Same kind → OK
  if (actualNumericKind === expectedKind) {
    return false;
  }

  // Widening conversion → OK (e.g., Int32 → Double)
  if (isWideningConversion(actualNumericKind, expectedKind)) {
    return false;
  }

  // Narrowing conversion → check for explicit intent
  // numericNarrowing expressions represent explicit user intent (e.g., `x as int`)
  if (expr.kind === "numericNarrowing") {
    return false;
  }

  // Allow constant-literal narrowing when the literal fits the target type.
  // This mirrors C#'s constant expression conversion rules and is ONLY allowed for literals.
  const allowConstantLiteralNarrowing = (v: number): boolean => {
    // Integer target kinds: require safe integer, integral value, and in-range.
    if (
      expectedKind === "SByte" ||
      expectedKind === "Byte" ||
      expectedKind === "Int16" ||
      expectedKind === "UInt16" ||
      expectedKind === "UInt32" ||
      expectedKind === "UInt64" ||
      expectedKind === "Int64"
    ) {
      if (
        Number.isSafeInteger(v) &&
        Number.isInteger(v) &&
        literalFitsInKind(v, expectedKind)
      ) {
        return true;
      }
    }

    // Float target kind: allow finite values in float range.
    if (expectedKind === "Single") {
      if (Number.isFinite(v) && Math.abs(v) <= MAX_FLOAT_ABS) {
        return true;
      }
    }

    return false;
  };

  if (expr.kind === "literal" && typeof expr.value === "number") {
    if (allowConstantLiteralNarrowing(expr.value)) {
      return false;
    }
  }

  if (
    expr.kind === "unary" &&
    (expr.operator === "+" || expr.operator === "-") &&
    expr.expression.kind === "literal" &&
    typeof expr.expression.value === "number"
  ) {
    const signedValue =
      expr.operator === "-" ? -expr.expression.value : expr.expression.value;
    if (allowConstantLiteralNarrowing(signedValue)) {
      return false;
    }
  }

  // Narrowing without explicit intent → error
  return true;
};

/**
 * Get a human-readable description of an expression for error messages.
 */
export const describeExpression = (expr: IrExpression): string => {
  switch (expr.kind) {
    case "literal":
      return `literal '${expr.raw ?? String(expr.value)}'`;
    case "identifier":
      return `identifier '${expr.name}'`;
    case "binary":
      return `arithmetic expression`;
    case "unary":
      return `unary expression`;
    case "conditional":
      return `ternary expression`;
    case "call":
      return `call result`;
    case "memberAccess":
      return typeof expr.property === "string"
        ? `property '${expr.property}'`
        : `computed property`;
    default:
      return `expression`;
  }
};
