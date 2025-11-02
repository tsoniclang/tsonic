/**
 * Block and simple statement emitters
 */

import { IrStatement, IrExpression } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitStatement } from "../statement-emitter.js";

/**
 * Emit a block statement
 */
export const emitBlockStatement = (
  stmt: Extract<IrStatement, { kind: "blockStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const statements: string[] = [];

  for (const s of stmt.statements) {
    const [code, newContext] = emitStatement(s, currentContext);
    statements.push(code);
    currentContext = newContext;
  }

  const bodyCode = statements.join("\n");
  return [`${ind}{\n${bodyCode}\n${ind}}`, currentContext];
};

/**
 * Emit a return statement
 */
export const emitReturnStatement = (
  stmt: Extract<IrStatement, { kind: "returnStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  if (stmt.expression) {
    const [exprFrag, newContext] = emitExpression(stmt.expression, context);
    return [`${ind}return ${exprFrag.text};`, newContext];
  }

  return [`${ind}return;`, context];
};

/**
 * Emit yield expression as C# yield return with exchange object pattern
 *
 * TypeScript: yield value
 * C#:
 *   exchange.Output = value;
 *   yield return exchange;
 *
 * TypeScript: yield* otherGenerator()
 * C#:
 *   foreach (var item in OtherGenerator())
 *     yield return item;
 */
export const emitYieldStatement = (
  expr: Extract<IrExpression, { kind: "yield" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  if (expr.delegate) {
    // yield* delegation
    if (expr.expression) {
      const [delegateFrag, newContext] = emitExpression(
        expr.expression,
        currentContext
      );
      currentContext = newContext;
      parts.push(`${ind}foreach (var item in ${delegateFrag.text})`);
      parts.push(`${ind}    yield return item;`);
    }
  } else {
    // Regular yield
    if (expr.expression) {
      const [valueFrag, newContext] = emitExpression(
        expr.expression,
        currentContext
      );
      currentContext = newContext;
      parts.push(`${ind}exchange.Output = ${valueFrag.text};`);
      parts.push(`${ind}yield return exchange;`);
    } else {
      // Bare yield (no value)
      parts.push(`${ind}yield return exchange;`);
    }
  }

  return [parts.join("\n"), currentContext];
};

/**
 * Emit an expression statement
 */
export const emitExpressionStatement = (
  stmt: Extract<IrStatement, { kind: "expressionStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  // Special handling for yield expressions in generators
  if (stmt.expression.kind === "yield") {
    return emitYieldStatement(stmt.expression, context);
  }

  const [exprFrag, newContext] = emitExpression(stmt.expression, context);
  return [`${ind}${exprFrag.text};`, newContext];
};
