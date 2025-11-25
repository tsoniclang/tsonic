/**
 * Conditional statement emitters (if, switch)
 */

import { IrExpression, IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent, dedent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitStatement } from "../../statement-emitter.js";

/**
 * Check if an expression's inferred type is boolean
 */
const isBooleanCondition = (expr: IrExpression): boolean => {
  const type = expr.inferredType;
  if (!type) return false;
  return type.kind === "primitiveType" && type.name === "boolean";
};

/**
 * Convert an expression to a valid C# boolean condition.
 * In TypeScript, any value can be used in a boolean context (truthy/falsy).
 * In C#, only boolean expressions are valid conditions.
 *
 * For non-boolean expressions:
 * - Reference types (objects, arrays): emit `expr != null`
 * - Numbers: could emit `expr != 0` (not implemented yet)
 * - Strings: could emit `!string.IsNullOrEmpty(expr)` (not implemented yet)
 */
const toBooleanCondition = (
  expr: IrExpression,
  emittedText: string
): string => {
  // If already boolean, use as-is
  if (isBooleanCondition(expr)) {
    return emittedText;
  }

  // For reference types (non-primitive), add != null check
  const type = expr.inferredType;
  if (type && type.kind !== "primitiveType") {
    return `${emittedText} != null`;
  }

  // Default: assume it's a reference type and add null check
  // This handles cases where type inference didn't work
  if (!type) {
    return `${emittedText} != null`;
  }

  // For primitives that are not boolean, just use as-is for now
  // TODO: Handle number truthiness (x != 0) and string truthiness
  return emittedText;
};

/**
 * Emit an if statement
 */
export const emitIfStatement = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [condFrag, condContext] = emitExpression(stmt.condition, context);

  // Convert to boolean condition if needed
  const condText = toBooleanCondition(stmt.condition, condFrag.text);

  const [thenCode, thenContext] = emitStatement(
    stmt.thenStatement,
    indent(condContext)
  );

  let code = `${ind}if (${condText})\n${thenCode}`;
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
