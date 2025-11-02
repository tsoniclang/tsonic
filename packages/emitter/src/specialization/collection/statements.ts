/**
 * Specialization collection from statements
 */

import { IrModule, IrStatement } from "@tsonic/frontend";
import { SpecializationRequest } from "../types.js";
import { collectFromExpression } from "./expressions.js";

/**
 * Collect specializations from a statement
 */
export const collectFromStatement = (
  stmt: IrStatement,
  requests: SpecializationRequest[],
  seen: Set<string>,
  module: IrModule
): void => {
  switch (stmt.kind) {
    case "expressionStatement":
      collectFromExpression(stmt.expression, requests, seen, module);
      break;

    case "variableDeclaration":
      for (const decl of stmt.declarations) {
        if (decl.initializer) {
          collectFromExpression(decl.initializer, requests, seen, module);
        }
      }
      break;

    case "returnStatement":
      if (stmt.expression) {
        collectFromExpression(stmt.expression, requests, seen, module);
      }
      break;

    case "ifStatement":
      collectFromExpression(stmt.condition, requests, seen, module);
      collectFromStatement(stmt.thenStatement, requests, seen, module);
      if (stmt.elseStatement) {
        collectFromStatement(stmt.elseStatement, requests, seen, module);
      }
      break;

    case "blockStatement":
      for (const s of stmt.statements) {
        collectFromStatement(s, requests, seen, module);
      }
      break;

    case "whileStatement":
      collectFromExpression(stmt.condition, requests, seen, module);
      collectFromStatement(stmt.body, requests, seen, module);
      break;

    case "forStatement":
      if (stmt.initializer) {
        if (stmt.initializer.kind === "variableDeclaration") {
          collectFromStatement(stmt.initializer, requests, seen, module);
        } else {
          collectFromExpression(stmt.initializer, requests, seen, module);
        }
      }
      if (stmt.condition) {
        collectFromExpression(stmt.condition, requests, seen, module);
      }
      if (stmt.update) {
        collectFromExpression(stmt.update, requests, seen, module);
      }
      collectFromStatement(stmt.body, requests, seen, module);
      break;

    case "functionDeclaration":
      if (stmt.body) {
        collectFromStatement(stmt.body, requests, seen, module);
      }
      break;

    case "classDeclaration":
      for (const member of stmt.members) {
        if (member.kind === "methodDeclaration" && member.body) {
          collectFromStatement(member.body, requests, seen, module);
        }
      }
      break;

    // Other statement types don't contain expressions
    default:
      break;
  }
};
