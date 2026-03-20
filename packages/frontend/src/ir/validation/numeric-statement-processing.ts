/**
 * Numeric Statement Processing
 *
 * Statement-level coercion processing and module-level pass orchestration:
 * - processStatement: Process statement for coercion checks
 * - processStatementWithReturnType: Process statement with return type context
 * - processModule: Run numeric coercion pass on a single module
 * - runNumericCoercionPass: Run numeric coercion validation on all modules
 */

import { Diagnostic } from "../../types/diagnostic.js";
import { IrModule, IrStatement, IrType } from "../types.js";
import { type CoercionContext } from "./numeric-classification.js";
import {
  validateExpression,
  scanExpressionForCalls,
} from "./numeric-expression-validation.js";

/**
 * Result of numeric coercion validation
 */
export type NumericCoercionResult = {
  readonly ok: boolean;
  readonly module: IrModule;
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Process a statement, checking for int→double coercion at intent sites.
 */
export const processStatement = (
  stmt: IrStatement,
  ctx: CoercionContext
): void => {
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
export const processStatementWithReturnType = (
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
