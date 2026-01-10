/**
 * Operator expression converters (binary, unary, update, assignment)
 */

import * as ts from "typescript";
import {
  IrExpression,
  IrUnaryExpression,
  IrUpdateExpression,
  IrBinaryOperator,
  IrAssignmentOperator,
  IrType,
} from "../../types.js";
import {
  deriveIdentifierType,
  getSourceSpan,
  convertBinaryOperator,
  isAssignmentOperator,
} from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import {
  collectInstanceofNarrowingsInTruthyExpr,
  withAppliedNarrowings,
} from "../flow-narrowing.js";
import {
  NumericKind,
  getBinaryResultKind,
  NUMERIC_KIND_TO_CSHARP,
  TSONIC_TO_NUMERIC_KIND,
} from "../../types/numeric-kind.js";
import type { ProgramContext } from "../../program-context.js";

const getNumericKindFromIrType = (type: IrType | undefined): NumericKind | undefined => {
  if (!type) return undefined;

  if (type.kind === "primitiveType") {
    if (type.name === "int") return "Int32";
    if (type.name === "number") return "Double";
    return undefined;
  }

  if (type.kind === "referenceType") {
    // Numeric proof pass can annotate using CLR kind names (e.g., "Int64").
    if (
      type.name === "SByte" ||
      type.name === "Byte" ||
      type.name === "Int16" ||
      type.name === "UInt16" ||
      type.name === "Int32" ||
      type.name === "UInt32" ||
      type.name === "Int64" ||
      type.name === "UInt64" ||
      type.name === "Single" ||
      type.name === "Double"
    ) {
      return type.name;
    }

    return TSONIC_TO_NUMERIC_KIND.get(type.name);
  }

  return undefined;
};

const numericKindToIrType = (kind: NumericKind): IrType => {
  if (kind === "Int32") return { kind: "primitiveType", name: "int" };
  if (kind === "Double") return { kind: "primitiveType", name: "number" };

  // Use the canonical C# keyword spelling as the IR referenceType name
  // (e.g., Int64 -> "long", UInt16 -> "ushort").
  const alias = NUMERIC_KIND_TO_CSHARP.get(kind) ?? "double";
  return { kind: "referenceType", name: alias };
};

/**
 * Derive result type from binary operator and operand types.
 *
 * DETERMINISTIC TYPING:
 * - Arithmetic: both int → int, otherwise double
 * - Comparison: always boolean
 * - Bitwise: int
 * - Logical: derives from operands
 */
const deriveBinaryResultType = (
  operator: string,
  leftType: IrType | undefined,
  rightType: IrType | undefined
): IrType | undefined => {
  // Comparison operators always return boolean
  if (["==", "!=", "===", "!==", "<", ">", "<=", ">="].includes(operator)) {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Bitwise operators return int
  if (["&", "|", "^", "<<", ">>", ">>>"].includes(operator)) {
    return { kind: "primitiveType", name: "int" };
  }

  // instanceof returns boolean
  if (operator === "instanceof") {
    return { kind: "primitiveType", name: "boolean" };
  }

  // in operator returns boolean
  if (operator === "in") {
    return { kind: "primitiveType", name: "boolean" };
  }

  // String concatenation: if either is string, result is string
  if (operator === "+") {
    if (
      (leftType?.kind === "primitiveType" && leftType.name === "string") ||
      (rightType?.kind === "primitiveType" && rightType.name === "string")
    ) {
      return { kind: "primitiveType", name: "string" };
    }
  }

  // Arithmetic operators: both int → int, otherwise double
  if (["+", "-", "*", "/", "%", "**"].includes(operator)) {
    const leftKind = getNumericKindFromIrType(leftType);
    const rightKind = getNumericKindFromIrType(rightType);

    if (leftKind !== undefined && rightKind !== undefined) {
      const resultKind = getBinaryResultKind(leftKind, rightKind);
      return numericKindToIrType(resultKind);
    }
  }

  // Logical operators: result type is one of the operand types
  // For &&, ||, ?? the result depends on which branch is taken
  if (["&&", "||", "??"].includes(operator)) {
    return leftType ?? rightType;
  }

  return undefined;
};

/**
 * Derive result type from unary operator and operand type.
 */
const deriveUnaryResultType = (
  operator: string,
  operandType: IrType | undefined
): IrType | undefined => {
  // Logical not always returns boolean
  if (operator === "!") {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Bitwise not returns int
  if (operator === "~") {
    return { kind: "primitiveType", name: "int" };
  }

  // Numeric + and - return same type as operand
  if (operator === "+" || operator === "-") {
    return operandType;
  }

  // typeof always returns string
  if (operator === "typeof") {
    return { kind: "primitiveType", name: "string" };
  }

  // void always returns undefined (void type)
  if (operator === "void") {
    return { kind: "voidType" };
  }

  // delete returns boolean
  if (operator === "delete") {
    return { kind: "primitiveType", name: "boolean" };
  }

  // ++/-- return same type as operand
  if (operator === "++" || operator === "--") {
    return operandType;
  }

  return operandType;
};

/**
 * Convert binary expression (including logical and assignment)
 *
 * Threads expectedType through:
 * - Assignment RHS: gets LHS type
 * - Nullish coalescing (??): RHS gets expectedType (fallback value)
 * - Logical OR (||): RHS gets expectedType (fallback value)
 */
export const convertBinaryExpression = (
  node: ts.BinaryExpression,
  ctx: ProgramContext,
  expectedType?: IrType
): IrExpression => {
  const operator = convertBinaryOperator(node.operatorToken);
  const sourceSpan = getSourceSpan(node);

  // Handle assignment separately
  // Thread LHS type to RHS for deterministic typing (e.g., x = 10 where x: int)
  if (isAssignmentOperator(node.operatorToken)) {
    // DETERMINISTIC: Derive LHS type from declaration (for identifiers)
    const leftExpr = ts.isIdentifier(node.left)
      ? {
          kind: "identifier" as const,
          name: node.left.text,
          inferredType: deriveIdentifierType(node.left, ctx),
          sourceSpan: getSourceSpan(node.left),
        }
      : convertExpression(node.left, ctx, undefined);

    const lhsType = leftExpr.inferredType;
    const rightExpr = convertExpression(node.right, ctx, lhsType);

    return {
      kind: "assignment",
      operator: operator as IrAssignmentOperator,
      left: leftExpr,
      right: rightExpr,
      inferredType: lhsType, // Assignment result is LHS type
      sourceSpan,
    };
  }

  // Handle logical operators
  // For ?? and ||, the RHS is the fallback value, so it gets expectedType
  // For &&, the RHS is only reached if LHS is truthy, no type coercion needed
  if (operator === "&&" || operator === "||" || operator === "??") {
    const rhsExpectedType =
      operator === "??" || operator === "||" ? expectedType : undefined;
    const leftExpr = convertExpression(node.left, ctx, undefined);
    const rhsCtx =
      operator === "&&"
        ? withAppliedNarrowings(
            ctx,
            collectInstanceofNarrowingsInTruthyExpr(node.left, ctx)
          )
        : ctx;
    const rightExpr = convertExpression(node.right, rhsCtx, rhsExpectedType);

    return {
      kind: "logical",
      operator,
      left: leftExpr,
      right: rightExpr,
      inferredType: deriveBinaryResultType(
        operator,
        leftExpr.inferredType,
        rightExpr.inferredType
      ),
      sourceSpan,
    };
  }

  // Regular binary expression
  const leftExpr = convertExpression(node.left, ctx, undefined);
  const rightExpr = convertExpression(node.right, ctx, undefined);

  return {
    kind: "binary",
    operator: operator as IrBinaryOperator,
    left: leftExpr,
    right: rightExpr,
    inferredType: deriveBinaryResultType(
      operator,
      leftExpr.inferredType,
      rightExpr.inferredType
    ),
    sourceSpan,
  };
};

/**
 * Convert prefix unary expression
 */
export const convertUnaryExpression = (
  node: ts.PrefixUnaryExpression,
  ctx: ProgramContext
): IrUnaryExpression | IrUpdateExpression => {
  const sourceSpan = getSourceSpan(node);
  const operandExpr = convertExpression(node.operand, ctx, undefined);

  // Check if it's an increment/decrement (++ or --)
  if (
    node.operator === ts.SyntaxKind.PlusPlusToken ||
    node.operator === ts.SyntaxKind.MinusMinusToken
  ) {
    const updateOperator =
      node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--";
    return {
      kind: "update",
      operator: updateOperator,
      prefix: true,
      expression: operandExpr,
      inferredType: deriveUnaryResultType(
        updateOperator,
        operandExpr.inferredType
      ),
      sourceSpan,
    };
  }

  // Handle regular unary operators
  let operator: IrUnaryExpression["operator"] = "+";

  switch (node.operator) {
    case ts.SyntaxKind.PlusToken:
      operator = "+";
      break;
    case ts.SyntaxKind.MinusToken:
      operator = "-";
      break;
    case ts.SyntaxKind.ExclamationToken:
      operator = "!";
      break;
    case ts.SyntaxKind.TildeToken:
      operator = "~";
      break;
  }

  return {
    kind: "unary",
    operator,
    expression: operandExpr,
    inferredType: deriveUnaryResultType(operator, operandExpr.inferredType),
    sourceSpan,
  };
};

/**
 * Convert postfix unary expression (++ or --)
 *
 * DETERMINISTIC TYPING: Result type derived from operand type.
 * ++/-- return same type as operand (int → int, number → number)
 */
export const convertUpdateExpression = (
  node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression,
  ctx: ProgramContext
): IrUpdateExpression => {
  const sourceSpan = getSourceSpan(node);

  if (ts.isPrefixUnaryExpression(node)) {
    // Check if it's an increment or decrement
    if (
      node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken
    ) {
      const operandExpr = convertExpression(node.operand, ctx, undefined);
      const updateOperator =
        node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--";
      return {
        kind: "update",
        operator: updateOperator,
        prefix: true,
        expression: operandExpr,
        inferredType: deriveUnaryResultType(
          updateOperator,
          operandExpr.inferredType
        ),
        sourceSpan,
      };
    }
  }

  // Handle postfix unary expression
  const postfix = node as ts.PostfixUnaryExpression;
  const operandExpr = convertExpression(postfix.operand, ctx, undefined);
  const updateOperator =
    postfix.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--";
  return {
    kind: "update",
    operator: updateOperator,
    prefix: false,
    expression: operandExpr,
    inferredType: deriveUnaryResultType(
      updateOperator,
      operandExpr.inferredType
    ),
    sourceSpan,
  };
};
