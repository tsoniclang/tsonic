import { IrExpression, IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { allocateLocalName } from "../../core/format/local-names.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import { applyAssignmentStatementNarrowing } from "../../core/semantic/assignment-flow.js";
import type { CSharpStatementAst } from "../../core/format/backend-ast/types.js";
import { emitYieldExpressionAst } from "./yield-statements.js";

const isNoopVoidOperand = (
  expr: IrExpression,
  state: EmitterContext
): boolean => {
  if (
    expr.kind === "literal" &&
    (expr.value === undefined || expr.value === null)
  ) {
    return true;
  }

  if (expr.kind !== "identifier") {
    return false;
  }

  if (expr.resolvedClrType !== undefined) {
    return true;
  }

  const importBinding = state.importBindings?.get(expr.name);
  if (importBinding?.kind === "namespace" || importBinding?.kind === "type") {
    return true;
  }

  return false;
};

const isMethodGroupAccess = (
  expr: IrExpression
): expr is Extract<IrExpression, { kind: "memberAccess" }> => {
  if (expr.kind !== "memberAccess") return false;
  return expr.memberBinding?.kind === "method";
};

const emitVoidOperandAst = (
  expr: IrExpression,
  state: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  if (isMethodGroupAccess(expr)) {
    return emitVoidOperandAst(expr.object, state);
  }

  if (isNoopVoidOperand(expr, state)) {
    return [[], state];
  }

  const [exprAst, newContext] = emitExpressionAst(expr, state);

  if (
    expr.kind === "call" ||
    expr.kind === "new" ||
    expr.kind === "assignment" ||
    expr.kind === "update" ||
    expr.kind === "await"
  ) {
    return [[{ kind: "expressionStatement", expression: exprAst }], newContext];
  }

  const discardLocal = allocateLocalName("__tsonic_discard", newContext);
  return [
    [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: identifierType("var"),
        declarators: [
          {
            name: discardLocal.emittedName,
            initializer: exprAst,
          },
        ],
      },
    ],
    discardLocal.context,
  ];
};

export const emitExpressionStatementAst = (
  stmt: Extract<IrStatement, { kind: "expressionStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  if (stmt.expression.kind === "yield") {
    return emitYieldExpressionAst(stmt.expression, context);
  }

  if (stmt.expression.kind === "unary" && stmt.expression.operator === "void") {
    return emitVoidOperandAst(stmt.expression.expression, context);
  }

  const [exprAst, newContext] = emitExpressionAst(stmt.expression, context);
  const flowContext = applyAssignmentStatementNarrowing(
    stmt.expression,
    newContext,
    emitExpressionAst
  );
  return [[{ kind: "expressionStatement", expression: exprAst }], flowContext];
};
