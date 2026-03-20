/**
 * Char Validation — Expression, statement, and pattern validation walkers.
 *
 * Contains validateExpression, validateStatement, validateBlock,
 * validatePattern, validateCharExpected, and validateClassMember.
 */

import {
  IrStatement,
  IrExpression,
  IrType,
  IrBlockStatement,
  IrClassMember,
  IrPattern,
} from "../types.js";
import type { CharValidationContext } from "./char-validation-types.js";
import {
  moduleLocation,
  stripNullish,
  resolveTypeAliases,
  isCharType,
  isCharTypedExpression,
  isStringCharAccessExpression,
  addCharDiagnostic,
  getPropertyExpectedType,
} from "./char-validation-types.js";

const validateCharExpected = (
  expr: IrExpression,
  expectedType: IrType | undefined,
  ctx: CharValidationContext
): void => {
  if (!isCharType(expectedType, ctx)) return;

  const location = expr.sourceSpan ?? moduleLocation(ctx);

  // Special case: allow single-character string literals in char positions.
  if (expr.kind === "literal" && typeof expr.value === "string") {
    if (expr.value.length !== 1) {
      addCharDiagnostic(
        ctx,
        `Invalid char literal: expected a single-character string, got length ${expr.value.length}.`,
        location,
        `Use a single character like "A" for char, or call System.Char.Parse(...) for dynamic strings.`
      );
    }
    return;
  }

  // Conditional expressions are validated by validating each branch in the same expectedType.
  if (expr.kind === "conditional") {
    return;
  }

  if (isStringCharAccessExpression(expr)) {
    return;
  }

  // Otherwise, the expression itself must already be typed as char.
  if (!isCharTypedExpression(expr, ctx)) {
    addCharDiagnostic(
      ctx,
      "Invalid char value: expected a single-character string literal or a value typed as char.",
      location,
      `Use "A" in a char-typed position, or assign a char-typed expression (e.g., from a method returning char).`
    );
  }
};

export const validatePattern = (
  pattern: IrPattern,
  ctx: CharValidationContext
): void => {
  switch (pattern.kind) {
    case "identifierPattern":
      return;

    case "arrayPattern":
      for (const elem of pattern.elements) {
        if (!elem) continue;
        validatePattern(elem.pattern, ctx);
        if (elem.defaultExpr) {
          validateExpression(elem.defaultExpr, ctx);
        }
      }
      return;

    case "objectPattern":
      for (const prop of pattern.properties) {
        if (prop.kind === "property") {
          validatePattern(prop.value, ctx);
          if (prop.defaultExpr) {
            validateExpression(prop.defaultExpr, ctx);
          }
        } else {
          validatePattern(prop.pattern, ctx);
        }
      }
      return;

    default:
      return;
  }
};

export const validateExpression = (
  expr: IrExpression,
  ctx: CharValidationContext,
  expectedType?: IrType
): void => {
  // Hard gate for char expected positions (prevents emitter ICE).
  validateCharExpected(expr, expectedType, ctx);

  switch (expr.kind) {
    case "literal":
    case "identifier":
    case "this":
      return;

    case "array": {
      const resolvedExpected = stripNullish(
        resolveTypeAliases(expectedType, ctx)
      );
      const elementExpectedType =
        resolvedExpected?.kind === "arrayType"
          ? resolvedExpected.elementType
          : undefined;
      for (const elem of expr.elements) {
        if (!elem) continue;
        if (elem.kind === "spread") {
          validateExpression(elem.expression, ctx);
        } else {
          validateExpression(elem, ctx, elementExpectedType);
        }
      }
      return;
    }

    case "object": {
      const effectiveType = expectedType ?? expr.contextualType;
      for (const prop of expr.properties) {
        if (prop.kind === "spread") {
          validateExpression(prop.expression, ctx);
          continue;
        }
        if (typeof prop.key === "string") {
          const propExpectedType = getPropertyExpectedType(
            effectiveType,
            prop.key,
            ctx
          );
          validateExpression(prop.value, ctx, propExpectedType);
        } else {
          validateExpression(prop.key, ctx);
          validateExpression(prop.value, ctx);
        }
      }
      return;
    }

    case "memberAccess": {
      validateExpression(expr.object, ctx);
      if (expr.isComputed && typeof expr.property !== "string") {
        validateExpression(expr.property, ctx);
      }
      return;
    }

    case "call": {
      validateExpression(expr.callee, ctx);
      const paramTypes = expr.parameterTypes ?? [];
      for (let i = 0; i < expr.arguments.length; i++) {
        const arg = expr.arguments[i];
        if (!arg) continue;
        const expected = paramTypes[i];
        if (arg.kind === "spread") {
          validateExpression(arg.expression, ctx);
        } else {
          validateExpression(arg, ctx, expected);
        }
      }
      if (expr.dynamicImportNamespace) {
        validateExpression(expr.dynamicImportNamespace, ctx);
      }
      return;
    }

    case "new": {
      validateExpression(expr.callee, ctx);
      const paramTypes = expr.parameterTypes ?? [];
      for (let i = 0; i < expr.arguments.length; i++) {
        const arg = expr.arguments[i];
        if (!arg) continue;
        const expected = paramTypes[i];
        if (arg.kind === "spread") {
          validateExpression(arg.expression, ctx);
        } else {
          validateExpression(arg, ctx, expected);
        }
      }
      return;
    }

    case "binary":
      validateExpression(expr.left, ctx);
      validateExpression(expr.right, ctx);
      return;

    case "logical":
      validateExpression(expr.left, ctx);
      validateExpression(expr.right, ctx);
      return;

    case "unary":
      validateExpression(expr.expression, ctx, expectedType);
      return;

    case "update":
      validateExpression(expr.expression, ctx);
      return;

    case "assignment": {
      const leftIsPattern =
        "kind" in expr.left &&
        (expr.left.kind === "identifierPattern" ||
          expr.left.kind === "arrayPattern" ||
          expr.left.kind === "objectPattern");

      if (leftIsPattern) {
        validatePattern(expr.left as IrPattern, ctx);
        validateExpression(expr.right, ctx);
        return;
      }

      const leftExpr = expr.left as IrExpression;
      validateExpression(leftExpr, ctx);
      validateExpression(expr.right, ctx, leftExpr.inferredType);
      return;
    }

    case "conditional":
      validateExpression(expr.condition, ctx);
      validateExpression(expr.whenTrue, ctx, expectedType);
      validateExpression(expr.whenFalse, ctx, expectedType);
      return;

    case "functionExpression":
      validateBlock(expr.body, ctx, expr.returnType);
      return;

    case "arrowFunction":
      if (expr.body.kind === "blockStatement") {
        validateBlock(expr.body, ctx, expr.returnType);
      } else {
        validateExpression(expr.body, ctx, expr.returnType);
      }
      return;

    case "templateLiteral":
      for (const subExpr of expr.expressions) {
        validateExpression(subExpr, ctx);
      }
      return;

    case "spread":
      validateExpression(expr.expression, ctx);
      return;

    case "await":
      validateExpression(expr.expression, ctx);
      return;

    case "numericNarrowing":
      validateExpression(expr.expression, ctx);
      return;

    case "typeAssertion":
      // Validate the operand in the asserted type context (this is where char literals matter).
      validateExpression(expr.expression, ctx, expr.targetType);
      return;

    case "trycast":
      validateExpression(expr.expression, ctx);
      return;

    case "stackalloc":
      validateExpression(expr.size, ctx);
      return;

    default:
      return;
  }
};

export const validateBlock = (
  block: IrBlockStatement | undefined,
  ctx: CharValidationContext,
  currentReturnType: IrType | undefined
): void => {
  if (!block) return;
  for (const stmt of block.statements) {
    validateStatement(stmt, ctx, currentReturnType);
  }
};

const validateClassMember = (
  member: IrClassMember,
  ctx: CharValidationContext
): void => {
  switch (member.kind) {
    case "propertyDeclaration":
      if (member.initializer) {
        validateExpression(member.initializer, ctx, member.type);
      }
      if (member.getterBody) {
        validateBlock(member.getterBody, ctx, member.type);
      }
      if (member.setterBody) {
        validateBlock(member.setterBody, ctx, undefined);
      }
      return;
    case "methodDeclaration":
      validateBlock(member.body, ctx, member.returnType);
      return;
    case "constructorDeclaration":
      validateBlock(member.body, ctx, undefined);
      return;
    default:
      return;
  }
};

export const validateStatement = (
  stmt: IrStatement,
  ctx: CharValidationContext,
  currentReturnType: IrType | undefined
): void => {
  switch (stmt.kind) {
    case "variableDeclaration":
      for (const decl of stmt.declarations) {
        if (decl.initializer) {
          validateExpression(decl.initializer, ctx, decl.type);
        }
      }
      return;

    case "functionDeclaration":
      validateBlock(stmt.body, ctx, stmt.returnType);
      return;

    case "classDeclaration":
      for (const member of stmt.members) {
        validateClassMember(member, ctx);
      }
      return;

    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
      return;

    case "expressionStatement":
      validateExpression(stmt.expression, ctx);
      return;

    case "returnStatement":
      if (stmt.expression) {
        validateExpression(stmt.expression, ctx, currentReturnType);
      }
      return;

    case "ifStatement":
      validateExpression(stmt.condition, ctx);
      validateStatement(stmt.thenStatement, ctx, currentReturnType);
      if (stmt.elseStatement) {
        validateStatement(stmt.elseStatement, ctx, currentReturnType);
      }
      return;

    case "blockStatement":
      validateBlock(stmt, ctx, currentReturnType);
      return;

    case "forStatement":
      if (stmt.initializer) {
        if (
          "kind" in stmt.initializer &&
          stmt.initializer.kind === "variableDeclaration"
        ) {
          validateStatement(
            stmt.initializer as IrStatement,
            ctx,
            currentReturnType
          );
        } else {
          validateExpression(stmt.initializer as IrExpression, ctx);
        }
      }
      if (stmt.condition) validateExpression(stmt.condition, ctx);
      if (stmt.update) validateExpression(stmt.update, ctx);
      validateStatement(stmt.body, ctx, currentReturnType);
      return;

    case "forOfStatement":
      validatePattern(stmt.variable, ctx);
      validateExpression(stmt.expression, ctx);
      validateStatement(stmt.body, ctx, currentReturnType);
      return;

    case "whileStatement":
      validateExpression(stmt.condition, ctx);
      validateStatement(stmt.body, ctx, currentReturnType);
      return;

    case "switchStatement":
      validateExpression(stmt.expression, ctx);
      for (const c of stmt.cases) {
        if (c.test) validateExpression(c.test, ctx);
        for (const s of c.statements) {
          validateStatement(s, ctx, currentReturnType);
        }
      }
      return;

    case "throwStatement":
      validateExpression(stmt.expression, ctx);
      return;

    case "tryStatement":
      validateBlock(stmt.tryBlock, ctx, currentReturnType);
      if (stmt.catchClause) {
        if (stmt.catchClause.parameter) {
          validatePattern(stmt.catchClause.parameter, ctx);
        }
        validateBlock(stmt.catchClause.body, ctx, currentReturnType);
      }
      if (stmt.finallyBlock) {
        validateBlock(stmt.finallyBlock, ctx, currentReturnType);
      }
      return;

    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      return;

    case "yieldStatement":
      if (stmt.output) {
        validateExpression(stmt.output, ctx);
      }
      if (stmt.receiveTarget) {
        validatePattern(stmt.receiveTarget, ctx);
      }
      return;

    case "generatorReturnStatement":
      if (stmt.expression) {
        validateExpression(stmt.expression, ctx);
      }
      return;

    default:
      return;
  }
};
