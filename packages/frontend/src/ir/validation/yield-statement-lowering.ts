/**
 * Yield Statement Lowering — Facade
 *
 * Wires sub-module statement handlers into a unified `processStatement` dispatcher.
 *
 * Sub-modules:
 * - yield-statement-simple: expression, variable, block, if, while statements
 * - yield-statement-loops: for, forOf, forIn, switch, try, return, throw statements
 */
import { IrStatement } from "../types.js";
import { type LoweringContext } from "./yield-lowering-helpers.js";
import { processNonGeneratorStatement } from "./yield-module-processing.js";
import {
  processExpressionStatement,
  processVariableDeclaration,
  processIfStatement,
  processWhileStatement,
} from "./yield-statement-simple.js";
import {
  processForStatement,
  processForOfStatement,
  processForInStatement,
  processSwitchStatement,
  processTryStatement,
  processReturnStatement,
  processThrowStatement,
} from "./yield-statement-loops.js";

/**
 * Process a statement in a generator function body.
 * Returns the transformed statement(s) - may return multiple statements
 * when a single statement is split.
 */
export const processStatement = (
  stmt: IrStatement,
  ctx: LoweringContext
): IrStatement | readonly IrStatement[] => {
  if (!ctx.inGenerator) {
    return processNonGeneratorStatement(stmt, ctx);
  }

  switch (stmt.kind) {
    case "expressionStatement":
      return processExpressionStatement(stmt, ctx);
    case "variableDeclaration":
      return processVariableDeclaration(stmt, ctx);
    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.flatMap((s) => {
          const result = processStatement(s, ctx);
          return Array.isArray(result) ? result : [result];
        }),
      };
    case "ifStatement":
      return processIfStatement(stmt, ctx, processStatement);
    case "whileStatement":
      return processWhileStatement(stmt, ctx, processStatement);
    case "forStatement":
      return processForStatement(stmt, ctx, processStatement);
    case "forOfStatement":
      return processForOfStatement(stmt, ctx, processStatement);
    case "forInStatement":
      return processForInStatement(stmt, ctx, processStatement);
    case "switchStatement":
      return processSwitchStatement(stmt, ctx, processStatement);
    case "tryStatement":
      return processTryStatement(stmt, ctx, processStatement);
    case "returnStatement":
      return processReturnStatement(stmt, ctx);
    case "throwStatement":
      return processThrowStatement(stmt, ctx);
    default:
      return stmt;
  }
};
