/**
 * Control flow statement emitters (if, while, for, switch, try, throw)
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent, dedent } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitBlockStatement } from "./blocks.js";
import { emitStatement } from "../statement-emitter.js";

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
 * Emit a while statement
 */
export const emitWhileStatement = (
  stmt: Extract<IrStatement, { kind: "whileStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [condFrag, condContext] = emitExpression(stmt.condition, context);

  const [bodyCode, bodyContext] = emitStatement(stmt.body, indent(condContext));

  const code = `${ind}while (${condFrag.text})\n${bodyCode}`;
  return [code, dedent(bodyContext)];
};

/**
 * Emit a for statement
 */
export const emitForStatement = (
  stmt: Extract<IrStatement, { kind: "forStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;

  // Initializer
  let init = "";
  if (stmt.initializer) {
    if (stmt.initializer.kind === "variableDeclaration") {
      const [initCode, newContext] = emitStatement(
        stmt.initializer,
        currentContext
      );
      currentContext = newContext;
      // Strip trailing semicolon from variable declaration
      init = initCode.trim().replace(/;$/, "");
    } else {
      const [initFrag, newContext] = emitExpression(
        stmt.initializer,
        currentContext
      );
      currentContext = newContext;
      init = initFrag.text;
    }
  }

  // Condition
  let cond = "";
  if (stmt.condition) {
    const [condFrag, newContext] = emitExpression(
      stmt.condition,
      currentContext
    );
    currentContext = newContext;
    cond = condFrag.text;
  }

  // Update
  let update = "";
  if (stmt.update) {
    const [updateFrag, newContext] = emitExpression(
      stmt.update,
      currentContext
    );
    currentContext = newContext;
    update = updateFrag.text;
  }

  // Body
  const [bodyCode, bodyContext] = emitStatement(
    stmt.body,
    indent(currentContext)
  );

  const code = `${ind}for (${init}; ${cond}; ${update})\n${bodyCode}`;
  return [code, dedent(bodyContext)];
};

/**
 * Emit a for-of statement
 */
export const emitForOfStatement = (
  stmt: Extract<IrStatement, { kind: "forOfStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [exprFrag, exprContext] = emitExpression(stmt.expression, context);

  const [bodyCode, bodyContext] = emitStatement(stmt.body, indent(exprContext));

  // Use foreach in C#
  const varName =
    stmt.variable.kind === "identifierPattern" ? stmt.variable.name : "item";
  const code = `${ind}foreach (var ${varName} in ${exprFrag.text})\n${bodyCode}`;
  return [code, dedent(bodyContext)];
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

/**
 * Emit a try statement
 */
export const emitTryStatement = (
  stmt: Extract<IrStatement, { kind: "tryStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [tryBlock, tryContext] = emitBlockStatement(stmt.tryBlock, context);

  let code = `${ind}try\n${tryBlock}`;
  let currentContext = tryContext;

  if (stmt.catchClause) {
    const param =
      stmt.catchClause.parameter?.kind === "identifierPattern"
        ? stmt.catchClause.parameter.name
        : "ex";

    const [catchBlock, catchContext] = emitBlockStatement(
      stmt.catchClause.body,
      currentContext
    );
    code += `\n${ind}catch (Exception ${param})\n${catchBlock}`;
    currentContext = catchContext;
  }

  if (stmt.finallyBlock) {
    const [finallyBlock, finallyContext] = emitBlockStatement(
      stmt.finallyBlock,
      currentContext
    );
    code += `\n${ind}finally\n${finallyBlock}`;
    currentContext = finallyContext;
  }

  return [code, currentContext];
};

/**
 * Emit a throw statement
 */
export const emitThrowStatement = (
  stmt: Extract<IrStatement, { kind: "throwStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [exprFrag, newContext] = emitExpression(stmt.expression, context);
  return [`${ind}throw ${exprFrag.text};`, newContext];
};
