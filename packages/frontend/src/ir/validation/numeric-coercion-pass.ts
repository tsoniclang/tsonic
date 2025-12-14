/**
 * Numeric Coercion Pass - STRICT CONTRACT enforcement
 *
 * This pass detects cases where an integer literal is used where a double is expected,
 * and requires explicit user intent for the conversion.
 *
 * STRICT RULE: int → double requires explicit user intent
 *
 * Intent sites (where widening is checked):
 * 1. Variable initialization with explicit type: `const x: number = 42` → ERROR
 * 2. Parameter passing: `foo(42)` where foo expects `number` → ERROR
 * 3. Return statements: `return 42` where function returns `number` → ERROR
 * 4. Array elements: `[1, 2, 3]` in `number[]` context → ERROR (each element)
 *
 * How to satisfy the contract:
 * - Use double literal: `const x: number = 42.0` ✓
 * - Use explicit cast: `const x: number = 42 as number` ✓
 *
 * This pass runs AFTER the IR is built, BEFORE emission.
 * It is a HARD GATE - any errors prevent emission.
 */

import {
  Diagnostic,
  createDiagnostic,
  SourceLocation,
} from "../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrExpression,
  IrType,
  IrLiteralExpression,
} from "../types.js";

/**
 * Result of numeric coercion validation
 */
export type NumericCoercionResult = {
  readonly ok: boolean;
  readonly module: IrModule;
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Context for tracking coercion validation
 */
type CoercionContext = {
  readonly filePath: string;
  readonly diagnostics: Diagnostic[];
};

/**
 * Create a source location for a module
 */
const moduleLocation = (ctx: CoercionContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

/**
 * Check if a type is "number" (which means double semantically)
 */
const isNumberType = (type: IrType | undefined): boolean => {
  if (!type) return false;
  if (type.kind === "primitiveType" && type.name === "number") {
    // If numericIntent is set (from explicit annotation like `: int`), it's NOT double
    return type.numericIntent === undefined;
  }
  return false;
};

/**
 * Check if an expression is an integer literal (numericIntent: Int32)
 */
const isIntegerLiteral = (
  expr: IrExpression
): expr is IrLiteralExpression & { numericIntent: "Int32" } => {
  return (
    expr.kind === "literal" &&
    typeof expr.value === "number" &&
    expr.numericIntent === "Int32"
  );
};

/**
 * Check if an expression needs coercion to match an expected double type.
 * Returns true if the expression is an integer literal being assigned to a double context.
 */
const needsCoercion = (
  expr: IrExpression,
  expectedType: IrType | undefined
): boolean => {
  // Only check if expected type is unadorned "number" (meaning double)
  if (!isNumberType(expectedType)) {
    return false;
  }

  // Check if the expression is an integer literal
  return isIntegerLiteral(expr);
};

/**
 * Emit an error diagnostic for int→double coercion
 */
const emitCoercionError = (
  expr: IrExpression,
  ctx: CoercionContext,
  context: string
): void => {
  const location = expr.sourceSpan ?? moduleLocation(ctx);
  const raw = expr.kind === "literal" ? (expr.raw ?? String(expr.value)) : "?";

  ctx.diagnostics.push(
    createDiagnostic(
      "TSN5110",
      "error",
      `Integer literal '${raw}' cannot be implicitly converted to 'number' (double) ${context}`,
      location,
      `Use a double literal (e.g., '${raw}.0') or explicit cast ('${raw} as number').`
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
  // Check for direct int→double coercion
  if (needsCoercion(expr, expectedType)) {
    emitCoercionError(expr, ctx, context);
    return;
  }

  // Recursively check sub-expressions based on kind
  switch (expr.kind) {
    case "array": {
      // For array literals, check each element against expected element type
      const elementType =
        expectedType?.kind === "arrayType"
          ? expectedType.elementType
          : undefined;
      expr.elements.forEach((el, i) => {
        if (el && el.kind !== "spread") {
          validateExpression(el, elementType, ctx, `in array element ${i}`);
        }
      });
      break;
    }

    case "object": {
      // For object literals, we'd need to check each property against expected property type
      // This is more complex and may require type resolution - skip for now
      break;
    }

    case "conditional": {
      // Check both branches
      validateExpression(expr.whenTrue, expectedType, ctx, context);
      validateExpression(expr.whenFalse, expectedType, ctx, context);
      break;
    }

    case "logical": {
      // For ?? and ||, the result could be either operand
      if (expr.operator === "??" || expr.operator === "||") {
        validateExpression(expr.left, expectedType, ctx, context);
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
      // We'd need function context to know expected return type
      // For now, skip - this requires threading function return type through
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
      // Process function body with return type context
      processStatementWithReturnType(stmt.body, stmt.returnType, ctx);
      break;
    }

    case "classDeclaration": {
      for (const member of stmt.members) {
        if (member.kind === "methodDeclaration" && member.body) {
          processStatementWithReturnType(member.body, member.returnType, ctx);
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
      if (stmt.expression && returnType) {
        validateExpression(
          stmt.expression,
          returnType,
          ctx,
          "in return statement"
        );
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
