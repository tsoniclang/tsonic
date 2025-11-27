/**
 * Loop statement emitters (while, for, for-of)
 */

import { IrStatement, IrExpression } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent, dedent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitStatement } from "../../statement-emitter.js";

/**
 * Information about a canonical integer loop counter.
 * Canonical form: `for (let i = 0; i < n; i++)`
 */
type CanonicalIntLoop = {
  readonly varName: string;
  readonly initialValue: number;
};

/**
 * Detect if a for-loop has a canonical integer loop counter pattern.
 *
 * Canonical patterns:
 * - Initializer: `let i = 0` (or any integer literal)
 * - Update: `i++`, `++i`, `i += 1`, `i = i + 1`
 *
 * Returns the variable name and initial value if canonical, undefined otherwise.
 */
const detectCanonicalIntLoop = (
  stmt: Extract<IrStatement, { kind: "forStatement" }>
): CanonicalIntLoop | undefined => {
  const { initializer, update } = stmt;

  // Check initializer: must be `let varName = <integer literal>`
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

  // Check initializer value: must be an integer literal
  const declInit = decl.initializer;
  if (!declInit || declInit.kind !== "literal") {
    return undefined;
  }

  const initValue = declInit.value;
  if (typeof initValue !== "number" || !Number.isInteger(initValue)) {
    return undefined;
  }

  // Check update: must be i++, ++i, i += 1, or i = i + 1
  if (!update) {
    return undefined;
  }

  if (!isIntegerIncrement(update, varName)) {
    return undefined;
  }

  return { varName, initialValue: initValue };
};

/**
 * Check if an expression is an integer increment of a variable.
 * Matches: i++, ++i, i += 1, i = i + 1
 */
const isIntegerIncrement = (expr: IrExpression, varName: string): boolean => {
  // i++ or ++i
  if (expr.kind === "update") {
    if (expr.operator !== "++") {
      return false;
    }
    if (expr.expression.kind !== "identifier") {
      return false;
    }
    return expr.expression.name === varName;
  }

  // i += 1 or i = i + 1
  if (expr.kind === "assignment") {
    if (expr.left.kind !== "identifier" || expr.left.name !== varName) {
      return false;
    }

    // i += 1
    if (expr.operator === "+=") {
      if (expr.right.kind !== "literal") {
        return false;
      }
      return expr.right.value === 1;
    }

    // i = i + 1
    if (expr.operator === "=") {
      if (expr.right.kind !== "binary" || expr.right.operator !== "+") {
        return false;
      }
      const binExpr = expr.right;
      // Check i + 1 or 1 + i
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
 *
 * Special handling for canonical integer loop counters:
 * `for (let i = 0; i < n; i++)` emits as `for (int i = 0; ...)` in C#.
 * This avoids the double→int conversion cost when using loop variables
 * as CLR indexers (e.g., list[i]).
 */
export const emitForStatement = (
  stmt: Extract<IrStatement, { kind: "forStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;

  // Check for canonical integer loop pattern
  const canonicalLoop = detectCanonicalIntLoop(stmt);

  // Initializer
  let init = "";
  if (stmt.initializer) {
    if (canonicalLoop) {
      // Canonical integer loop: emit `int varName = value` directly
      init = `int ${canonicalLoop.varName} = ${canonicalLoop.initialValue}`;
    } else if (stmt.initializer.kind === "variableDeclaration") {
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

  // Body - if canonical loop, add the var to intLoopVars so indexers don't cast
  let bodyContext: EmitterContext;
  if (canonicalLoop) {
    const existingIntVars = currentContext.intLoopVars ?? new Set<string>();
    const newIntVars = new Set([...existingIntVars, canonicalLoop.varName]);
    const contextWithIntVar = {
      ...indent(currentContext),
      intLoopVars: newIntVars,
    };
    const [code, ctx] = emitStatement(stmt.body, contextWithIntVar);
    // Remove the var from intLoopVars after body (restore previous scope)
    bodyContext = { ...ctx, intLoopVars: existingIntVars };
    const finalCode = `${ind}for (${init}; ${cond}; ${update})\n${code}`;
    return [finalCode, dedent(bodyContext)];
  }

  const [bodyCode, ctx] = emitStatement(stmt.body, indent(currentContext));
  bodyContext = ctx;

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
