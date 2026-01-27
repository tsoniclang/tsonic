/**
 * Exception handling emitters (try, throw)
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitBlockStatement } from "../blocks.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";

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
    const escapedParam = escapeCSharpIdentifier(param);

    const [catchBlock, catchContext] = emitBlockStatement(
      stmt.catchClause.body,
      currentContext
    );
    code += `\n${ind}catch (global::System.Exception ${escapedParam})\n${catchBlock}`;
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
