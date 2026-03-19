/**
 * Numeric Validation - Statement and expression validation
 *
 * This sub-module provides:
 * - emitCoercionError: Emit diagnostic for implicit narrowing
 * - validateExpression: Validate expression against expected type
 * - scanExpressionForCalls: Scan expression tree for call argument validation
 * - processStatement: Process statement for coercion checks
 * - processStatementWithReturnType: Process statement with return type context
 * - processModule: Run numeric coercion pass on a single module
 * - runNumericCoercionPass: Run numeric coercion validation on all modules
 *
 * Split from numeric-coercion-pass.ts for file-size management.
 */

import { Diagnostic, createDiagnostic } from "../../types/diagnostic.js";
import { IrModule, IrStatement, IrExpression, IrType } from "../types.js";
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
 * Result of numeric coercion validation
 */
export type NumericCoercionResult = {
  readonly ok: boolean;
  readonly module: IrModule;
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Emit an error diagnostic for implicit narrowing conversion.
 * Only called when a narrowing conversion is attempted without explicit intent.
 */
const emitCoercionError = (
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
const validateExpression = (
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
      if (expr.dynamicImportNamespace) {
        scanExpressionForCalls(expr.dynamicImportNamespace, ctx);
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
const scanExpressionForCalls = (
  expr: IrExpression,
  ctx: CoercionContext
): void => {
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
      if (expr.dynamicImportNamespace) {
        scanExpressionForCalls(expr.dynamicImportNamespace, ctx);
      }
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
      // Arrow function body can be expression or block
      if ("kind" in expr.body && expr.body.kind !== "blockStatement") {
        scanExpressionForCalls(expr.body as IrExpression, ctx);
      }
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

/**
 * Process a statement, checking for int→double coercion at intent sites.
 */
const processStatement = (stmt: IrStatement, ctx: CoercionContext): void => {
  switch (stmt.kind) {
    case "variableDeclaration": {
      for (const decl of stmt.declarations) {
        if (decl.initializer) {
          // Check if there's an explicit type annotation
          if (decl.type) {
            validateExpression(
              decl.initializer,
              decl.type,
              ctx,
              "in variable initialization"
            );
          } else {
            // Even without explicit type, scan for call expressions
            // to check their arguments
            scanExpressionForCalls(decl.initializer, ctx);
          }
        }
      }
      break;
    }

    case "returnStatement": {
      // Even without return type context, still scan return expressions for
      // call-site coercion checks (argument validation).
      if (stmt.expression) {
        scanExpressionForCalls(stmt.expression, ctx);
      }
      break;
    }

    case "expressionStatement": {
      // Check call expressions for parameter coercion
      if (stmt.expression.kind === "call") {
        const call = stmt.expression;
        // Check each argument against expected parameter type
        if (call.parameterTypes) {
          call.arguments.forEach((arg, i) => {
            if (arg.kind !== "spread" && call.parameterTypes?.[i]) {
              validateExpression(
                arg,
                call.parameterTypes[i],
                ctx,
                `in argument ${i + 1}`
              );
            }
          });
        }
      }
      break;
    }

    case "functionDeclaration": {
      // Check default parameters for int→double coercion
      for (const param of stmt.parameters) {
        if (param.initializer && param.type) {
          validateExpression(
            param.initializer,
            param.type,
            ctx,
            "in default parameter"
          );
        }
      }
      // Process function body with return type context
      processStatementWithReturnType(stmt.body, stmt.returnType, ctx);
      break;
    }

    case "classDeclaration": {
      for (const member of stmt.members) {
        if (member.kind === "methodDeclaration") {
          // Check default parameters for int→double coercion
          for (const param of member.parameters) {
            if (param.initializer && param.type) {
              validateExpression(
                param.initializer,
                param.type,
                ctx,
                "in default parameter"
              );
            }
          }
          if (member.body) {
            processStatementWithReturnType(member.body, member.returnType, ctx);
          }
        }
        if (member.kind === "propertyDeclaration" && member.initializer) {
          validateExpression(
            member.initializer,
            member.type,
            ctx,
            "in property initialization"
          );
        }
      }
      break;
    }

    case "blockStatement": {
      for (const s of stmt.statements) {
        processStatement(s, ctx);
      }
      break;
    }

    case "ifStatement": {
      processStatement(stmt.thenStatement, ctx);
      if (stmt.elseStatement) {
        processStatement(stmt.elseStatement, ctx);
      }
      break;
    }

    case "whileStatement":
    case "forStatement":
    case "forOfStatement": {
      processStatement(stmt.body, ctx);
      break;
    }

    case "tryStatement": {
      processStatement(stmt.tryBlock, ctx);
      if (stmt.catchClause) {
        processStatement(stmt.catchClause.body, ctx);
      }
      if (stmt.finallyBlock) {
        processStatement(stmt.finallyBlock, ctx);
      }
      break;
    }

    case "switchStatement": {
      for (const caseClause of stmt.cases) {
        for (const s of caseClause.statements) {
          processStatement(s, ctx);
        }
      }
      break;
    }
  }
};

/**
 * Process a statement with return type context for checking return statements
 */
const processStatementWithReturnType = (
  stmt: IrStatement,
  returnType: IrType | undefined,
  ctx: CoercionContext
): void => {
  switch (stmt.kind) {
    case "returnStatement": {
      if (!stmt.expression) break;

      if (returnType) {
        validateExpression(
          stmt.expression,
          returnType,
          ctx,
          "in return statement"
        );
      } else {
        // Even when the return type is unknown, we still need to validate any
        // call-site coercions inside the returned expression (argument validation).
        scanExpressionForCalls(stmt.expression, ctx);
      }
      break;
    }

    case "blockStatement": {
      for (const s of stmt.statements) {
        processStatementWithReturnType(s, returnType, ctx);
      }
      break;
    }

    case "ifStatement": {
      processStatementWithReturnType(stmt.thenStatement, returnType, ctx);
      if (stmt.elseStatement) {
        processStatementWithReturnType(stmt.elseStatement, returnType, ctx);
      }
      break;
    }

    case "tryStatement": {
      processStatementWithReturnType(stmt.tryBlock, returnType, ctx);
      if (stmt.catchClause) {
        processStatementWithReturnType(stmt.catchClause.body, returnType, ctx);
      }
      if (stmt.finallyBlock) {
        processStatementWithReturnType(stmt.finallyBlock, returnType, ctx);
      }
      break;
    }

    case "switchStatement": {
      for (const caseClause of stmt.cases) {
        for (const s of caseClause.statements) {
          processStatementWithReturnType(s, returnType, ctx);
        }
      }
      break;
    }

    default:
      // For other statements, use regular processing
      processStatement(stmt, ctx);
  }
};

/**
 * Run numeric coercion pass on a module.
 */
const processModule = (module: IrModule): NumericCoercionResult => {
  const ctx: CoercionContext = {
    filePath: module.filePath,
    diagnostics: [],
  };

  // Process module body
  for (const stmt of module.body) {
    processStatement(stmt, ctx);
  }

  // Process exports
  for (const exp of module.exports) {
    if (exp.kind === "declaration") {
      processStatement(exp.declaration, ctx);
    }
  }

  return {
    ok: ctx.diagnostics.length === 0,
    module,
    diagnostics: ctx.diagnostics,
  };
};

/**
 * Run numeric coercion validation on all modules.
 *
 * HARD GATE: If any diagnostics are returned, the emitter MUST NOT run.
 */
export const runNumericCoercionPass = (
  modules: readonly IrModule[]
): {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
} => {
  const allDiagnostics: Diagnostic[] = [];

  for (const module of modules) {
    const result = processModule(module);
    allDiagnostics.push(...result.diagnostics);
  }

  return {
    ok: allDiagnostics.length === 0,
    modules, // Pass through unchanged - this pass only validates, doesn't transform
    diagnostics: allDiagnostics,
  };
};
