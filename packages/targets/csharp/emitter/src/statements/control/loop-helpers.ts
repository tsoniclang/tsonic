import { IrExpression, IrStatement } from "@tsonic/frontend";
import { emitExpressionAst } from "../../expression-emitter.js";
import type { CSharpStatementAst } from "../../core/format/backend-ast/types.js";
import { type EmitExprAstFn } from "../../core/semantic/boolean-context.js";

export type CanonicalIntLoop = {
  readonly varName: string;
  readonly initialValue: number;
};

const isIntegerIncrement = (expr: IrExpression, varName: string): boolean => {
  if (expr.kind === "update") {
    if (expr.operator !== "++") {
      return false;
    }
    if (expr.expression.kind !== "identifier") {
      return false;
    }
    return expr.expression.name === varName;
  }

  if (expr.kind === "assignment") {
    if (expr.left.kind !== "identifier" || expr.left.name !== varName) {
      return false;
    }

    if (expr.operator === "+=") {
      if (expr.right.kind !== "literal") {
        return false;
      }
      return expr.right.value === 1;
    }

    if (expr.operator === "=") {
      if (expr.right.kind !== "binary" || expr.right.operator !== "+") {
        return false;
      }
      const binExpr = expr.right;
      const isVarPlusOne =
        binExpr.left.kind === "identifier" &&
        binExpr.left.name === varName &&
        binExpr.right.kind === "literal" &&
        binExpr.right.value === 1;
      const isOnePlusVar =
        binExpr.left.kind === "literal" &&
        binExpr.left.value === 1 &&
        binExpr.right.kind === "identifier" &&
        binExpr.right.name === varName;
      return isVarPlusOne || isOnePlusVar;
    }
  }

  return false;
};

export const detectCanonicalIntLoop = (
  stmt: Extract<IrStatement, { kind: "forStatement" }>
): CanonicalIntLoop | undefined => {
  const { initializer, update } = stmt;

  if (!initializer || initializer.kind !== "variableDeclaration") {
    return undefined;
  }

  if (initializer.declarationKind !== "let") {
    return undefined;
  }

  if (initializer.declarations.length !== 1) {
    return undefined;
  }

  const decl = initializer.declarations[0];
  if (!decl || decl.name.kind !== "identifierPattern") {
    return undefined;
  }

  const varName = decl.name.name;
  const declInit = decl.initializer;
  if (!declInit || declInit.kind !== "literal") {
    return undefined;
  }

  const initValue = declInit.value;
  if (typeof initValue !== "number" || !Number.isInteger(initValue)) {
    return undefined;
  }

  if (!update || !isIntegerIncrement(update, varName)) {
    return undefined;
  }

  return { varName, initialValue: initValue };
};

export const wrapInBlock = (
  stmts: readonly CSharpStatementAst[]
): CSharpStatementAst => {
  if (stmts.length === 1 && stmts[0]) return stmts[0];
  return { kind: "blockStatement", statements: [...stmts] };
};

export const emitExprAstCb: EmitExprAstFn = (e, ctx) =>
  emitExpressionAst(e, ctx);
