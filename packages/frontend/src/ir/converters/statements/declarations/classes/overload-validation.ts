/**
 * Overload validation helpers
 *
 * Checks that specialized IR trees are free of residual istype<T>() calls
 * and do not reference parameters absent from the current overload signature.
 */

import { IrExpression, IrPattern, IrStatement } from "../../../../types.js";

export const assertNoIsTypeCalls = (stmt: IrStatement): boolean => {
  const isPatternLike = (
    target: IrExpression | IrPattern
  ): target is IrPattern =>
    target.kind === "identifierPattern" ||
    target.kind === "arrayPattern" ||
    target.kind === "objectPattern";

  const visitPattern = (pattern: IrPattern): boolean => {
    switch (pattern.kind) {
      case "identifierPattern":
        return true;
      case "arrayPattern":
        return pattern.elements.every((element) =>
          element ? visitPattern(element.pattern) : true
        );
      case "objectPattern":
        return pattern.properties.every((property) =>
          property.kind === "rest"
            ? visitPattern(property.pattern)
            : visitPattern(property.value)
        );
      default:
        return true;
    }
  };

  const visitExpr = (expr: IrExpression): boolean => {
    switch (expr.kind) {
      case "literal":
      case "identifier":
      case "this":
        return true;
      case "spread":
        return visitExpr(expr.expression);
      case "memberAccess":
        return (
          visitExpr(expr.object) &&
          (typeof expr.property === "string" ? true : visitExpr(expr.property))
        );
      case "call":
        return (
          !(
            expr.callee.kind === "identifier" && expr.callee.name === "istype"
          ) &&
          visitExpr(expr.callee) &&
          expr.arguments.every((a) =>
            a.kind === "spread" ? visitExpr(a.expression) : visitExpr(a)
          )
        );
      case "new":
        return (
          visitExpr(expr.callee) &&
          expr.arguments.every((a) =>
            a.kind === "spread" ? visitExpr(a.expression) : visitExpr(a)
          )
        );
      case "functionExpression":
        return expr.body.statements.every(visitStmt);
      case "arrowFunction":
        return expr.body.kind === "blockStatement"
          ? expr.body.statements.every(visitStmt)
          : visitExpr(expr.body);
      case "update":
      case "unary":
        return visitExpr(expr.expression);
      case "binary":
      case "logical":
        return visitExpr(expr.left) && visitExpr(expr.right);
      case "conditional":
        return (
          visitExpr(expr.condition) &&
          visitExpr(expr.whenTrue) &&
          visitExpr(expr.whenFalse)
        );
      case "assignment":
        return (
          (isPatternLike(expr.left)
            ? visitPattern(expr.left)
            : visitExpr(expr.left)) && visitExpr(expr.right)
        );
      case "templateLiteral":
        return expr.expressions.every(visitExpr);
      case "array":
        return expr.elements.every((e) => {
          if (!e) return true;
          return e.kind === "spread" ? visitExpr(e.expression) : visitExpr(e);
        });
      case "object":
        return expr.properties.every((p) => {
          if (p.kind === "spread") return visitExpr(p.expression);
          const keyOk = typeof p.key === "string" ? true : visitExpr(p.key);
          return keyOk && visitExpr(p.value);
        });
      case "await":
        return visitExpr(expr.expression);
      case "yield":
        return expr.expression ? visitExpr(expr.expression) : true;
      case "numericNarrowing":
        return visitExpr(expr.expression);
      case "typeAssertion":
        return visitExpr(expr.expression);
      case "trycast":
        return visitExpr(expr.expression);
      case "stackalloc":
        return visitExpr(expr.size);
      default:
        return true;
    }
  };

  const visitStmt = (s: IrStatement): boolean => {
    switch (s.kind) {
      case "blockStatement":
        return s.statements.every(visitStmt);
      case "ifStatement":
        return (
          visitExpr(s.condition) &&
          visitStmt(s.thenStatement) &&
          (s.elseStatement ? visitStmt(s.elseStatement) : true)
        );
      case "expressionStatement":
        return visitExpr(s.expression);
      case "returnStatement":
        return s.expression ? visitExpr(s.expression) : true;
      case "variableDeclaration":
        return s.declarations.every((d) =>
          d.initializer ? visitExpr(d.initializer) : true
        );
      case "whileStatement":
        return visitExpr(s.condition) && visitStmt(s.body);
      case "forStatement":
        return (
          (s.initializer
            ? s.initializer.kind === "variableDeclaration"
              ? visitStmt(s.initializer)
              : visitExpr(s.initializer)
            : true) &&
          (s.condition ? visitExpr(s.condition) : true) &&
          (s.update ? visitExpr(s.update) : true) &&
          visitStmt(s.body)
        );
      case "forOfStatement":
      case "forInStatement":
        return visitExpr(s.expression) && visitStmt(s.body);
      case "switchStatement":
        return (
          visitExpr(s.expression) &&
          s.cases.every(
            (c) =>
              (c.test ? visitExpr(c.test) : true) &&
              c.statements.every(visitStmt)
          )
        );
      case "tryStatement":
        return (
          visitStmt(s.tryBlock) &&
          (s.catchClause ? visitStmt(s.catchClause.body) : true) &&
          (s.finallyBlock ? visitStmt(s.finallyBlock) : true)
        );
      case "throwStatement":
        return visitExpr(s.expression);
      case "yieldStatement":
        return s.output ? visitExpr(s.output) : true;
      case "generatorReturnStatement":
        return s.expression ? visitExpr(s.expression) : true;
      default:
        return true;
    }
  };

  return visitStmt(stmt);
};

export const assertNoMissingParamRefs = (
  stmt: IrStatement,
  missingDeclIds: ReadonlySet<number>
): boolean => {
  const isPatternLike = (
    target: IrExpression | IrPattern
  ): target is IrPattern =>
    target.kind === "identifierPattern" ||
    target.kind === "arrayPattern" ||
    target.kind === "objectPattern";

  const visitPattern = (pattern: IrPattern): boolean => {
    switch (pattern.kind) {
      case "identifierPattern":
        return true;
      case "arrayPattern":
        return pattern.elements.every((element) =>
          element ? visitPattern(element.pattern) : true
        );
      case "objectPattern":
        return pattern.properties.every((property) =>
          property.kind === "rest"
            ? visitPattern(property.pattern)
            : visitPattern(property.value)
        );
      default:
        return true;
    }
  };

  const visitExpr = (expr: IrExpression): boolean => {
    switch (expr.kind) {
      case "literal":
      case "this":
        return true;
      case "identifier":
        return expr.declId ? !missingDeclIds.has(expr.declId.id) : true;
      case "spread":
        return visitExpr(expr.expression);
      case "memberAccess":
        return (
          visitExpr(expr.object) &&
          (typeof expr.property === "string" ? true : visitExpr(expr.property))
        );
      case "call":
        return (
          visitExpr(expr.callee) &&
          expr.arguments.every((a) =>
            a.kind === "spread" ? visitExpr(a.expression) : visitExpr(a)
          )
        );
      case "new":
        return (
          visitExpr(expr.callee) &&
          expr.arguments.every((a) =>
            a.kind === "spread" ? visitExpr(a.expression) : visitExpr(a)
          )
        );
      case "functionExpression":
        return expr.body.statements.every(visitStmt);
      case "arrowFunction":
        return expr.body.kind === "blockStatement"
          ? expr.body.statements.every(visitStmt)
          : visitExpr(expr.body);
      case "update":
      case "unary":
        return visitExpr(expr.expression);
      case "binary":
      case "logical":
        return visitExpr(expr.left) && visitExpr(expr.right);
      case "conditional":
        return (
          visitExpr(expr.condition) &&
          visitExpr(expr.whenTrue) &&
          visitExpr(expr.whenFalse)
        );
      case "assignment":
        return (
          (isPatternLike(expr.left)
            ? visitPattern(expr.left)
            : visitExpr(expr.left)) && visitExpr(expr.right)
        );
      case "templateLiteral":
        return expr.expressions.every(visitExpr);
      case "array":
        return expr.elements.every((e) => {
          if (!e) return true;
          return e.kind === "spread" ? visitExpr(e.expression) : visitExpr(e);
        });
      case "object":
        return expr.properties.every((p) => {
          if (p.kind === "spread") return visitExpr(p.expression);
          const keyOk = typeof p.key === "string" ? true : visitExpr(p.key);
          return keyOk && visitExpr(p.value);
        });
      case "await":
        return visitExpr(expr.expression);
      case "yield":
        return expr.expression ? visitExpr(expr.expression) : true;
      case "numericNarrowing":
        return visitExpr(expr.expression);
      case "typeAssertion":
        return visitExpr(expr.expression);
      case "trycast":
        return visitExpr(expr.expression);
      case "stackalloc":
        return visitExpr(expr.size);
      default:
        return true;
    }
  };

  const visitStmt = (s: IrStatement): boolean => {
    switch (s.kind) {
      case "blockStatement":
        return s.statements.every(visitStmt);
      case "ifStatement":
        return (
          visitExpr(s.condition) &&
          visitStmt(s.thenStatement) &&
          (s.elseStatement ? visitStmt(s.elseStatement) : true)
        );
      case "expressionStatement":
        return visitExpr(s.expression);
      case "returnStatement":
        return s.expression ? visitExpr(s.expression) : true;
      case "variableDeclaration":
        return s.declarations.every((d) =>
          d.initializer ? visitExpr(d.initializer) : true
        );
      case "whileStatement":
        return visitExpr(s.condition) && visitStmt(s.body);
      case "forStatement":
        return (
          (s.initializer
            ? s.initializer.kind === "variableDeclaration"
              ? visitStmt(s.initializer)
              : visitExpr(s.initializer)
            : true) &&
          (s.condition ? visitExpr(s.condition) : true) &&
          (s.update ? visitExpr(s.update) : true) &&
          visitStmt(s.body)
        );
      case "forOfStatement":
      case "forInStatement":
        return visitExpr(s.expression) && visitStmt(s.body);
      case "switchStatement":
        return (
          visitExpr(s.expression) &&
          s.cases.every(
            (c) =>
              (c.test ? visitExpr(c.test) : true) &&
              c.statements.every(visitStmt)
          )
        );
      case "tryStatement":
        return (
          visitStmt(s.tryBlock) &&
          (s.catchClause ? visitStmt(s.catchClause.body) : true) &&
          (s.finallyBlock ? visitStmt(s.finallyBlock) : true)
        );
      case "throwStatement":
        return visitExpr(s.expression);
      case "yieldStatement":
        return s.output ? visitExpr(s.output) : true;
      case "generatorReturnStatement":
        return s.expression ? visitExpr(s.expression) : true;
      default:
        return true;
    }
  };

  return visitStmt(stmt);
};
