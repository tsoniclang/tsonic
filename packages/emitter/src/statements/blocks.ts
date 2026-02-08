/**
 * Block and simple statement emitters
 */

import { IrStatement, IrExpression } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitStatement } from "../statement-emitter.js";
import { lowerPattern } from "../patterns.js";
import { allocateLocalName } from "../core/local-names.js";

/**
 * Emit a block statement
 */
export const emitBlockStatement = (
  stmt: Extract<IrStatement, { kind: "blockStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const outerNameMap = context.localNameMap;
  // New lexical scope for locals (prevents C# CS0136 shadowing errors).
  let currentContext: EmitterContext = {
    ...context,
    localNameMap: new Map(outerNameMap ?? []),
  };
  const statements: string[] = [];

  for (const s of stmt.statements) {
    const [code, newContext] = emitStatement(s, currentContext);
    statements.push(code);
    currentContext = newContext;
  }

  const bodyCode = statements.join("\n");
  return [
    `${ind}{\n${bodyCode}\n${ind}}`,
    { ...currentContext, localNameMap: outerNameMap },
  ];
};

/**
 * Emit a return statement
 * Uses context.returnType to pass expectedType for null → default conversion in generic contexts.
 */
export const emitReturnStatement = (
  stmt: Extract<IrStatement, { kind: "returnStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  if (stmt.expression) {
    // Pass returnType as expectedType for null → default conversion in generic contexts
    const [exprFrag, newContext] = emitExpression(
      stmt.expression,
      context,
      context.returnType
    );
    return [`${ind}return ${exprFrag.text};`, newContext];
  }

  return [`${ind}return;`, context];
};

/**
 * Emit yield expression as C# yield return with exchange object pattern
 * (Legacy handler for IrYieldExpression - used for unidirectional generators)
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
export const emitYieldExpression = (
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
      // Use await foreach for async generators, foreach for sync
      const foreachKeyword = currentContext.isAsync
        ? "await foreach"
        : "foreach";
      const itemAlloc = allocateLocalName("item", currentContext);
      currentContext = itemAlloc.context;
      parts.push(
        `${ind}${foreachKeyword} (var ${itemAlloc.emittedName} in ${delegateFrag.text})`
      );
      parts.push(`${ind}    yield return ${itemAlloc.emittedName};`);
    }
  } else {
    // Regular yield
    if (expr.expression) {
      const [valueFrag, newContext] = emitExpression(
        expr.expression,
        currentContext
      );
      currentContext = newContext;
      const exchangeVar = currentContext.generatorExchangeVar ?? "exchange";
      parts.push(`${ind}${exchangeVar}.Output = ${valueFrag.text};`);
      parts.push(`${ind}yield return ${exchangeVar};`);
    } else {
      // Bare yield (no value)
      const exchangeVar = currentContext.generatorExchangeVar ?? "exchange";
      parts.push(`${ind}yield return ${exchangeVar};`);
    }
  }

  return [parts.join("\n"), currentContext];
};

/**
 * Emit IrYieldStatement (lowered form from yield-lowering pass)
 * Handles bidirectional communication: const x = yield value;
 *
 * TypeScript: const x = yield value;
 * C#:
 *   exchange.Output = value;
 *   yield return exchange;
 *   var x = exchange.Input;  // or pattern destructuring
 *
 * TypeScript: yield value;  (no receiveTarget)
 * C#:
 *   exchange.Output = value;
 *   yield return exchange;
 */
export const emitYieldStatement = (
  stmt: Extract<IrStatement, { kind: "yieldStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  if (stmt.delegate) {
    // yield* delegation - emit foreach pattern
    if (stmt.output) {
      const [delegateFrag, newContext] = emitExpression(
        stmt.output,
        currentContext
      );
      currentContext = newContext;
      // Use await foreach for async generators, foreach for sync
      const foreachKeyword = currentContext.isAsync
        ? "await foreach"
        : "foreach";
      const itemAlloc = allocateLocalName("item", currentContext);
      currentContext = itemAlloc.context;
      parts.push(
        `${ind}${foreachKeyword} (var ${itemAlloc.emittedName} in ${delegateFrag.text})`
      );
      parts.push(`${ind}    yield return ${itemAlloc.emittedName};`);
    }
  } else {
    // Regular yield with optional bidirectional support
    if (stmt.output) {
      const [valueFrag, newContext] = emitExpression(
        stmt.output,
        currentContext
      );
      currentContext = newContext;
      const exchangeVar = currentContext.generatorExchangeVar ?? "exchange";
      parts.push(`${ind}${exchangeVar}.Output = ${valueFrag.text};`);
    }
    const exchangeVar = currentContext.generatorExchangeVar ?? "exchange";
    parts.push(`${ind}yield return ${exchangeVar};`);

    // Handle receiveTarget for bidirectional communication
    if (stmt.receiveTarget) {
      const lowered = lowerPattern(
        stmt.receiveTarget,
        `(${exchangeVar}.Input ?? default!)`,
        stmt.receivedType,
        ind,
        currentContext
      );
      parts.push(...lowered.statements);
      currentContext = lowered.context;
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
  // Note: After yield-lowering pass, generators will have IrYieldStatement nodes instead
  // This is kept for backward compatibility with unprocessed IR
  if (stmt.expression.kind === "yield") {
    return emitYieldExpression(stmt.expression, context);
  }

  const [exprFrag, newContext] = emitExpression(stmt.expression, context);
  return [`${ind}${exprFrag.text};`, newContext];
};

/**
 * Emit IrGeneratorReturnStatement (lowered form from yield-lowering pass)
 * Handles return statements in generators with TReturn.
 *
 * TypeScript: return "done";
 * C#:
 *   __returnValue = "done";
 *   yield break;
 *
 * TypeScript: return;  (no expression)
 * C#:
 *   yield break;
 *
 * The __returnValue variable is declared in the enclosing function emission.
 * The wrapper's _getReturnValue closure captures this value when iteration completes.
 */
export const emitGeneratorReturnStatement = (
  stmt: Extract<IrStatement, { kind: "generatorReturnStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const returnVar = currentContext.generatorReturnValueVar ?? "__returnValue";
  const parts: string[] = [];

  if (stmt.expression) {
    // Capture the return value in __returnValue before terminating
    const [valueFrag, newContext] = emitExpression(
      stmt.expression,
      currentContext
    );
    currentContext = newContext;
    parts.push(`${ind}${returnVar} = ${valueFrag.text};`);
  }

  // Terminate the iterator
  parts.push(`${ind}yield break;`);

  return [parts.join("\n"), currentContext];
};
