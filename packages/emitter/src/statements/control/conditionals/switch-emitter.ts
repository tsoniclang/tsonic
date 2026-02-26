/**
 * Switch statement emitter.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent, dedent } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { printExpression } from "../../../core/format/backend-ast/printer.js";
import { emitStatement } from "../../../statement-emitter.js";

/**
 * Emit a switch statement
 */
export const emitSwitchStatement = (
  stmt: Extract<IrStatement, { kind: "switchStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [exprAst, exprContext] = emitExpressionAst(stmt.expression, context);
  const exprText = printExpression(exprAst);

  let currentContext = indent(exprContext);
  const caseInd = getIndent(currentContext);
  const cases: string[] = [];

  for (const switchCase of stmt.cases) {
    if (switchCase.test) {
      const [testAst, testContext] = emitExpressionAst(
        switchCase.test,
        currentContext
      );
      currentContext = testContext;
      cases.push(`${caseInd}case ${printExpression(testAst)}:`);
    } else {
      cases.push(`${caseInd}default:`);
    }

    const stmtContext = indent(currentContext);
    for (const s of switchCase.statements) {
      const [code, newContext] = emitStatement(s, stmtContext);
      cases.push(code);
      currentContext = newContext;
    }

    // Emit break only when case has non-empty body that doesn't terminate.
    // Empty bodies represent intentional fall-through labels (TypeScript semantics).
    const hasBody = switchCase.statements.length > 0;
    if (hasBody) {
      const lastStmt = switchCase.statements[switchCase.statements.length - 1];
      const terminates =
        lastStmt?.kind === "breakStatement" ||
        lastStmt?.kind === "returnStatement" ||
        lastStmt?.kind === "throwStatement";
      if (!terminates) {
        cases.push(`${getIndent(stmtContext)}break;`);
      }
    }
  }

  const code = `${ind}switch (${exprText})\n${ind}{\n${cases.join("\n")}\n${ind}}`;
  return [code, dedent(currentContext)];
};
