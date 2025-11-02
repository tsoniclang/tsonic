/**
 * Collect specialization requests from IR
 */

import {
  IrModule,
  IrStatement,
  IrExpression,
  IrFunctionDeclaration,
  IrClassDeclaration,
} from "@tsonic/frontend";
import { SpecializationRequest } from "./types.js";
import { createSpecializationKey } from "./helpers.js";

/**
 * Collect all specialization requests from a module
 * Walks the IR tree looking for calls/news with requiresSpecialization flag
 */
export const collectSpecializations = (
  module: IrModule
): readonly SpecializationRequest[] => {
  const requests: SpecializationRequest[] = [];
  const seen = new Set<string>(); // Avoid duplicates

  // Walk through all statements and expressions to find specialization needs
  for (const stmt of module.body) {
    collectFromStatement(stmt, requests, seen, module);
  }

  return requests;
};

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

/**
 * Collect specializations from an expression
 */
export const collectFromExpression = (
  expr: IrExpression,
  requests: SpecializationRequest[],
  seen: Set<string>,
  module: IrModule
): void => {
  switch (expr.kind) {
    case "call":
      // Check if this call requires specialization
      if (
        expr.requiresSpecialization &&
        expr.typeArguments &&
        expr.typeArguments.length > 0
      ) {
        // Get function name from callee
        if (expr.callee.kind === "identifier") {
          const funcName = expr.callee.name;
          const key = createSpecializationKey(funcName, expr.typeArguments);

          if (!seen.has(key)) {
            seen.add(key);

            // Find the function declaration in the module
            const funcDecl = module.body.find(
              (stmt) =>
                stmt.kind === "functionDeclaration" && stmt.name === funcName
            ) as IrFunctionDeclaration | undefined;

            if (funcDecl) {
              requests.push({
                kind: "function",
                name: funcName,
                typeArguments: expr.typeArguments,
                declaration: funcDecl,
              });
            }
          }
        }
      }

      // Recurse into callee and arguments
      collectFromExpression(expr.callee, requests, seen, module);
      for (const arg of expr.arguments) {
        if (arg.kind !== "spread") {
          collectFromExpression(arg, requests, seen, module);
        }
      }
      break;

    case "new":
      // Check if this constructor call requires specialization
      if (
        expr.requiresSpecialization &&
        expr.typeArguments &&
        expr.typeArguments.length > 0
      ) {
        if (expr.callee.kind === "identifier") {
          const className = expr.callee.name;
          const key = createSpecializationKey(className, expr.typeArguments);

          if (!seen.has(key)) {
            seen.add(key);

            // Find the class declaration in the module
            const classDecl = module.body.find(
              (stmt) =>
                stmt.kind === "classDeclaration" && stmt.name === className
            ) as IrClassDeclaration | undefined;

            if (classDecl) {
              requests.push({
                kind: "class",
                name: className,
                typeArguments: expr.typeArguments,
                declaration: classDecl,
              });
            }
          }
        }
      }

      // Recurse into callee and arguments
      collectFromExpression(expr.callee, requests, seen, module);
      for (const arg of expr.arguments) {
        if (arg.kind !== "spread") {
          collectFromExpression(arg, requests, seen, module);
        }
      }
      break;

    case "binary":
    case "logical":
      collectFromExpression(expr.left, requests, seen, module);
      collectFromExpression(expr.right, requests, seen, module);
      break;

    case "unary":
    case "update":
    case "await":
      collectFromExpression(expr.expression, requests, seen, module);
      break;

    case "assignment":
      if ("kind" in expr.left) {
        collectFromExpression(
          expr.left as IrExpression,
          requests,
          seen,
          module
        );
      }
      collectFromExpression(expr.right, requests, seen, module);
      break;

    case "conditional":
      collectFromExpression(expr.condition, requests, seen, module);
      collectFromExpression(expr.whenTrue, requests, seen, module);
      collectFromExpression(expr.whenFalse, requests, seen, module);
      break;

    case "memberAccess":
      collectFromExpression(expr.object, requests, seen, module);
      if (typeof expr.property !== "string") {
        collectFromExpression(expr.property, requests, seen, module);
      }
      break;

    case "array":
      for (const elem of expr.elements) {
        if (elem === undefined) continue;
        if ("kind" in elem && elem.kind === "spread") {
          collectFromExpression(elem.expression, requests, seen, module);
        } else {
          collectFromExpression(elem, requests, seen, module);
        }
      }
      break;

    case "object":
      for (const prop of expr.properties) {
        if (prop.kind === "property") {
          if (typeof prop.key !== "string") {
            collectFromExpression(prop.key, requests, seen, module);
          }
          collectFromExpression(prop.value, requests, seen, module);
        } else if (prop.kind === "spread") {
          collectFromExpression(prop.expression, requests, seen, module);
        }
      }
      break;

    case "arrowFunction":
    case "functionExpression":
      if (typeof expr.body === "object" && "kind" in expr.body) {
        if (expr.body.kind === "blockStatement") {
          collectFromStatement(expr.body, requests, seen, module);
        } else {
          collectFromExpression(expr.body, requests, seen, module);
        }
      }
      break;

    // Literals, identifiers, etc. don't contain expressions
    default:
      break;
  }
};
