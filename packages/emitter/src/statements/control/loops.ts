/**
 * Loop statement emitters (while, for, for-of)
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent, dedent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitStatement } from "../../statement-emitter.js";

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
