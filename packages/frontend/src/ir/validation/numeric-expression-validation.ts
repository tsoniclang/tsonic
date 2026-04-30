/**
 * Numeric Expression Validation
 *
 * Expression-level coercion checks:
 * - emitCoercionError: Emit diagnostic for implicit narrowing
 * - validateExpression: Validate expression against expected type
 * - scanExpressionForCalls: Scan expression tree for call argument validation
 */

import { createDiagnostic } from "../../types/diagnostic.js";
import { IrExpression, IrParameter, IrType } from "../types.js";
import {
  classifyNumericExpr,
  getExpectedNumericKind,
  needsCoercion,
  describeExpression,
  tryGetObjectPropertyType,
  tryGetTupleElementType,
  moduleLocation,
  type CoercionContext,
} from "./numeric-classification.js";

/**
 * Emit an error diagnostic for implicit narrowing conversion.
 * Only called when a narrowing conversion is attempted without explicit intent.
 */
export const emitCoercionError = (
  expr: IrExpression,
  expectedType: IrType | undefined,
  ctx: CoercionContext,
  context: string
): void => {
  const location = expr.sourceSpan ?? moduleLocation(ctx);
  const description = describeExpression(expr);
  const actualKind = classifyNumericExpr(expr);
  const expectedKind = getExpectedNumericKind(expectedType);

  // Build descriptive type names
  const actualName = actualKind === "Int32" ? "int" : "double";
  const expectedName =
    expectedKind === "Double"
      ? "number"
      : expectedKind === "Int32"
        ? "int"
        : String(expectedKind).toLowerCase();

  ctx.diagnostics.push(
    createDiagnostic(
      "TSN5110",
      "error",
      `Implicit narrowing not allowed: ${description} (${actualName}) cannot be converted to '${expectedName}' ${context}`,
      location,
      `Add an explicit cast ('as ${expectedName}') to indicate intent.`
    )
  );
};

/**
 * Validate an expression in a context where a specific type is expected.
 * This is the core of the strict coercion check.
 */
export const validateExpression = (
  expr: IrExpression,
  expectedType: IrType | undefined,
  ctx: CoercionContext,
  context: string
): void => {
  // Check for narrowing conversion (widening is allowed)
  if (needsCoercion(expr, expectedType)) {
    emitCoercionError(expr, expectedType, ctx, context);
    return;
  }

  // Recursively check sub-expressions based on kind
  switch (expr.kind) {
    case "array": {
      // For tuple types, validate each element against its specific expected type
      if (expectedType?.kind === "tupleType") {
        expr.elements.forEach((el, i) => {
          if (el && el.kind !== "spread") {
            const tupleElementType = tryGetTupleElementType(expectedType, i);
            validateExpression(
              el,
              tupleElementType,
              ctx,
              `in tuple element ${i}`
            );
          }
        });
      } else {
        // For array types, check each element against the element type
        const elementType =
          expectedType?.kind === "arrayType"
            ? expectedType.elementType
            : undefined;
        expr.elements.forEach((el, i) => {
          if (el && el.kind !== "spread") {
            validateExpression(el, elementType, ctx, `in array element ${i}`);
          }
        });
      }
      break;
    }

    case "object": {
      // For object literals, check each property against expected property type
      // Uses contextual expectedType only - no guessing
      expr.properties.forEach((prop) => {
        if (prop.kind === "spread") {
          // For spreads, scan for nested call expressions
          scanExpressionForCalls(prop.expression, ctx);
        } else {
          // Only handle string keys (not computed expressions)
          if (typeof prop.key === "string") {
            // Get expected type for this property from contextual type
            const expectedPropType = tryGetObjectPropertyType(
              expectedType,
              prop.key
            );
            if (expectedPropType) {
              validateExpression(
                prop.value,
                expectedPropType,
                ctx,
                `in property '${prop.key}'`
              );
            } else {
              // Can't determine property type - scan for nested calls
              scanExpressionForCalls(prop.value, ctx);
            }
          } else {
            // Computed property key - can't resolve type, scan for calls
            scanExpressionForCalls(prop.value, ctx);
          }
        }
      });
      break;
    }

    case "conditional": {
      // Check both branches
      validateExpression(expr.whenTrue, expectedType, ctx, context);
      validateExpression(expr.whenFalse, expectedType, ctx, context);
      break;
    }

    case "logical": {
      // For ?? and ||, only the RHS (fallback value) needs coercion checking.
      // The LHS is already typed and doesn't need to match expectedType.
      // Example: `const x: int = maybeNull ?? 100`
      //   - maybeNull has type `int | null` - already correct, no coercion needed
      //   - 100 needs to be int (not double) - this is what we check
      if (expr.operator === "??" || expr.operator === "||") {
        // Scan LHS for nested calls (don't validate against expectedType)
        scanExpressionForCalls(expr.left, ctx);
        // Only validate RHS against expectedType (the fallback value)
        validateExpression(expr.right, expectedType, ctx, context);
      }
      break;
    }

    case "call": {
      // Check each argument against expected parameter type
      if (expr.parameterTypes) {
        expr.arguments.forEach((arg, i) => {
          if (arg.kind !== "spread" && expr.parameterTypes?.[i]) {
            validateExpression(
              arg,
              expr.parameterTypes[i],
              ctx,
              `in argument ${i + 1}`
            );
          }
        });
      }
      break;
    }

    case "stackalloc": {
      // stackalloc size must be Int32 (C# stackalloc array length uses int)
      validateExpression(
        expr.size,
        { kind: "primitiveType", name: "int" },
        ctx,
        "in stackalloc size"
      );
      break;
    }

    // Other expression kinds don't need recursive checking for this pass
  }
};

/**
 * Scan an expression tree for call expressions and validate their arguments.
 * This is used for expressions without an explicit type context.
 */
export const scanExpressionForCalls = (
  expr: IrExpression,
  ctx: CoercionContext
): void => {
  const scanParameterInitializers = (
    parameters: readonly IrParameter[]
  ): void => {
    parameters.forEach((param) => {
      if (param.initializer) {
        scanExpressionForCalls(param.initializer, ctx);
      }
    });
  };

  switch (expr.kind) {
    case "call": {
      // Validate call arguments against parameter types
      if (expr.parameterTypes) {
        expr.arguments.forEach((arg, i) => {
          if (arg.kind !== "spread" && expr.parameterTypes?.[i]) {
            validateExpression(
              arg,
              expr.parameterTypes[i],
              ctx,
              `in argument ${i + 1}`
            );
          }
        });
      }
      // Also scan the callee for nested calls
      scanExpressionForCalls(expr.callee, ctx);
      // Scan arguments for nested calls
      expr.arguments.forEach((arg) => {
        if (arg.kind !== "spread") {
          scanExpressionForCalls(arg, ctx);
        }
      });
      break;
    }

    case "stackalloc": {
      validateExpression(
        expr.size,
        { kind: "primitiveType", name: "int" },
        ctx,
        "in stackalloc size"
      );
      scanExpressionForCalls(expr.size, ctx);
      break;
    }

    case "array": {
      expr.elements.forEach((el) => {
        if (el && el.kind !== "spread") {
          scanExpressionForCalls(el, ctx);
        }
      });
      break;
    }

    case "object": {
      expr.properties.forEach((prop) => {
        if (prop.kind !== "spread") {
          scanExpressionForCalls(prop.value, ctx);
        }
      });
      break;
    }

    case "binary":
      scanExpressionForCalls(expr.left, ctx);
      scanExpressionForCalls(expr.right, ctx);
      break;

    case "unary":
      scanExpressionForCalls(expr.expression, ctx);
      break;

    case "update":
      scanExpressionForCalls(expr.expression, ctx);
      break;

    case "conditional":
      scanExpressionForCalls(expr.condition, ctx);
      scanExpressionForCalls(expr.whenTrue, ctx);
      scanExpressionForCalls(expr.whenFalse, ctx);
      break;

    case "logical":
      scanExpressionForCalls(expr.left, ctx);
      scanExpressionForCalls(expr.right, ctx);
      break;

    case "memberAccess":
      scanExpressionForCalls(expr.object, ctx);
      // For computed access, property is an expression
      if (expr.isComputed && typeof expr.property !== "string") {
        scanExpressionForCalls(expr.property, ctx);
      }
      break;

    case "arrowFunction":
      scanParameterInitializers(expr.parameters);
      // Arrow function body can be expression or block
      if ("kind" in expr.body && expr.body.kind !== "blockStatement") {
        scanExpressionForCalls(expr.body as IrExpression, ctx);
      }
      break;

    case "functionExpression":
      scanParameterInitializers(expr.parameters);
      break;

    case "new":
      expr.arguments.forEach((arg) => {
        if (arg.kind !== "spread") {
          scanExpressionForCalls(arg, ctx);
        }
      });
      break;

    case "await":
      scanExpressionForCalls(expr.expression, ctx);
      break;

    case "assignment":
      scanExpressionForCalls(expr.right, ctx);
      break;

    case "numericNarrowing":
      scanExpressionForCalls(expr.expression, ctx);
      break;

    case "yield":
      if (expr.expression) {
        scanExpressionForCalls(expr.expression, ctx);
      }
      break;

    // Leaf expressions: literal, identifier, this - no nested calls
    default:
      break;
  }
};
