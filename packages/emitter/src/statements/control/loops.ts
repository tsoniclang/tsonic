/**
 * Loop statement emitters (while, for, for-of, for-in)
 */

import { IrStatement, IrExpression } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent, dedent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitStatement } from "../../statement-emitter.js";
import { lowerPattern } from "../../patterns.js";
import { resolveTypeAlias, stripNullish } from "../../core/type-resolution.js";
import { emitBooleanCondition } from "../../core/boolean-context.js";
import {
  allocateLocalName,
  registerLocalName,
} from "../../core/local-names.js";

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
  const [condText, condContext] = emitBooleanCondition(
    stmt.condition,
    (e, ctx) => emitExpression(e, ctx),
    context
  );

  const [bodyCode, bodyContext] = emitStatement(stmt.body, indent(condContext));

  const code = `${ind}while (${condText})\n${bodyCode}`;
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
  const outerNameMap = context.localNameMap;
  let currentContext: EmitterContext = {
    ...context,
    localNameMap: new Map(outerNameMap ?? []),
  };

  // Check for canonical integer loop pattern
  const canonicalLoop = detectCanonicalIntLoop(stmt);

  // Initializer
  let init = "";
  if (stmt.initializer) {
    if (canonicalLoop) {
      // Canonical integer loop: emit `int varName = value` directly
      const alloc = allocateLocalName(canonicalLoop.varName, currentContext);
      currentContext = registerLocalName(
        canonicalLoop.varName,
        alloc.emittedName,
        alloc.context
      );
      init = `int ${alloc.emittedName} = ${canonicalLoop.initialValue}`;
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
    const [condText, newContext] = emitBooleanCondition(
      stmt.condition,
      (e, ctx) => emitExpression(e, ctx),
      currentContext
    );
    currentContext = newContext;
    cond = condText;
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
    const emittedName =
      currentContext.localNameMap?.get(canonicalLoop.varName) ??
      canonicalLoop.varName;
    const newIntVars = new Set([...existingIntVars, emittedName]);
    const contextWithIntVar = {
      ...indent(currentContext),
      intLoopVars: newIntVars,
    };
    const [code, ctx] = emitStatement(stmt.body, contextWithIntVar);
    // Remove the var from intLoopVars after body (restore previous scope)
    bodyContext = { ...ctx, intLoopVars: existingIntVars };
    const finalCode = `${ind}for (${init}; ${cond}; ${update})\n${code}`;
    const finalContext = dedent(bodyContext);
    return [finalCode, { ...finalContext, localNameMap: outerNameMap }];
  }

  const [bodyCode, ctx] = emitStatement(stmt.body, indent(currentContext));
  bodyContext = ctx;

  const code = `${ind}for (${init}; ${cond}; ${update})\n${bodyCode}`;
  const finalContext = dedent(bodyContext);
  return [code, { ...finalContext, localNameMap: outerNameMap }];
};

/**
 * Emit a for-of statement
 *
 * TypeScript: for (const x of items) { ... }
 * C#: foreach (var x in items) { ... }
 *
 * TypeScript: for await (const x of asyncItems) { ... }
 * C#: await foreach (var x in asyncItems) { ... }
 */
export const emitForOfStatement = (
  stmt: Extract<IrStatement, { kind: "forOfStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [exprFrag, exprContext] = emitExpression(stmt.expression, context);
  const outerNameMap = exprContext.localNameMap;
  let loopContext: EmitterContext = {
    ...exprContext,
    localNameMap: new Map(outerNameMap ?? []),
  };

  // Use foreach in C#, with await prefix for async iteration
  const foreachKeyword = stmt.isAwait ? "await foreach" : "foreach";

  if (stmt.variable.kind === "identifierPattern") {
    // Simple identifier: for (const x of items) -> foreach (var x in items)
    const originalName = stmt.variable.name;
    const alloc = allocateLocalName(originalName, loopContext);
    loopContext = registerLocalName(
      originalName,
      alloc.emittedName,
      alloc.context
    );
    const varName = alloc.emittedName;
    const [bodyCode, bodyContext] = emitStatement(
      stmt.body,
      indent(loopContext)
    );
    const code = `${ind}${foreachKeyword} (var ${varName} in ${exprFrag.text})\n${bodyCode}`;
    const finalContext = dedent(bodyContext);
    return [code, { ...finalContext, localNameMap: outerNameMap }];
  }

  // Complex pattern: for (const [a, b] of items) or for (const {x, y} of items)
  // Generate: foreach (var __item in items) { var a = __item[0]; var b = __item[1]; ...body... }
  const tempAlloc = allocateLocalName("__item", loopContext);
  const tempVar = tempAlloc.emittedName;
  loopContext = tempAlloc.context;
  const bodyIndent = getIndent(indent(loopContext));

  // Get element type from the expression's inferred type
  const elementType =
    stmt.expression.inferredType?.kind === "arrayType"
      ? stmt.expression.inferredType.elementType
      : undefined;

  // Lower the pattern to destructuring statements
  const lowerResult = lowerPattern(
    stmt.variable,
    tempVar,
    elementType,
    bodyIndent,
    loopContext
  );

  // Emit the original loop body
  const [bodyCode, bodyContext] = emitStatement(
    stmt.body,
    indent(lowerResult.context)
  );

  // Combine: pattern lowering + original body
  const combinedBody =
    lowerResult.statements.length > 0
      ? `${ind}{\n${lowerResult.statements.join("\n")}\n${bodyCode}\n${ind}}`
      : bodyCode;

  const code = `${ind}${foreachKeyword} (var ${tempVar} in ${exprFrag.text})\n${combinedBody}`;
  const finalContext = dedent(bodyContext);
  return [code, { ...finalContext, localNameMap: outerNameMap }];
};

/**
 * Emit a for-in statement
 *
 * TypeScript: for (const k in dict) { ... }
 * C#: foreach (var k in dict.Keys) { ... }
 *
 * Note: We currently support for-in only for `Record<string, T>` / dictionaryType receivers.
 */
export const emitForInStatement = (
  stmt: Extract<IrStatement, { kind: "forInStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [exprFrag, exprContext] = emitExpression(stmt.expression, context);
  const outerNameMap = exprContext.localNameMap;
  let loopContext: EmitterContext = {
    ...exprContext,
    localNameMap: new Map(outerNameMap ?? []),
  };

  if (stmt.variable.kind !== "identifierPattern") {
    throw new Error(`for...in requires an identifier binding pattern`);
  }

  const receiverType = stmt.expression.inferredType
    ? resolveTypeAlias(stripNullish(stmt.expression.inferredType), context)
    : undefined;

  if (
    receiverType?.kind !== "dictionaryType" ||
    receiverType.keyType.kind !== "primitiveType" ||
    receiverType.keyType.name !== "string"
  ) {
    throw new Error(
      `for...in is only supported for Record<string, T> dictionaries (got ${receiverType?.kind ?? "unknown"}).`
    );
  }

  const originalName = stmt.variable.name;
  const alloc = allocateLocalName(originalName, loopContext);
  loopContext = registerLocalName(
    originalName,
    alloc.emittedName,
    alloc.context
  );
  const varName = alloc.emittedName;
  const iterExpr = `(${exprFrag.text}).Keys`;

  const [bodyCode, bodyContext] = emitStatement(stmt.body, indent(loopContext));
  const code = `${ind}foreach (var ${varName} in ${iterExpr})\n${bodyCode}`;
  const finalContext = dedent(bodyContext);
  return [code, { ...finalContext, localNameMap: outerNameMap }];
};
