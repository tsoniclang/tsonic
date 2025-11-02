/**
 * Conditional statement emitters (if, switch)
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent, dedent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitStatement } from "../../statement-emitter.js";

/**
 * Emit an if statement
 */
export const emitIfStatement = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [condFrag, condContext] = emitExpression(stmt.condition, context);

  const [thenCode, thenContext] = emitStatement(
    stmt.thenStatement,
    indent(condContext)
  );

  let code = `${ind}if (${condFrag.text})\n${thenCode}`;
  let finalContext = dedent(thenContext);

  if (stmt.elseStatement) {
    const [elseCode, elseContext] = emitStatement(
      stmt.elseStatement,
      indent(finalContext)
    );
    code += `\n${ind}else\n${elseCode}`;
    finalContext = dedent(elseContext);
  }

  return [code, finalContext];
};

/**
 * Emit a switch statement
 */
export const emitSwitchStatement = (
  stmt: Extract<IrStatement, { kind: "switchStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [exprFrag, exprContext] = emitExpression(stmt.expression, context);

  let currentContext = indent(exprContext);
  const caseInd = getIndent(currentContext);
  const cases: string[] = [];

  for (const switchCase of stmt.cases) {
    if (switchCase.test) {
      const [testFrag, testContext] = emitExpression(
        switchCase.test,
        currentContext
      );
      currentContext = testContext;
      cases.push(`${caseInd}case ${testFrag.text}:`);
    } else {
      cases.push(`${caseInd}default:`);
    }

    const stmtContext = indent(currentContext);
    for (const s of switchCase.statements) {
      const [code, newContext] = emitStatement(s, stmtContext);
      cases.push(code);
      currentContext = newContext;
    }

    // Add break if not already present
    const lastStmt = switchCase.statements[switchCase.statements.length - 1];
    if (
      !lastStmt ||
      (lastStmt.kind !== "breakStatement" &&
        lastStmt.kind !== "returnStatement")
    ) {
      cases.push(`${getIndent(stmtContext)}break;`);
    }
  }

  const code = `${ind}switch (${exprFrag.text})\n${ind}{\n${cases.join("\n")}\n${ind}}`;
  return [code, dedent(currentContext)];
};
