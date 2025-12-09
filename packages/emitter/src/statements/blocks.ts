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
      const foreachKeyword = currentContext.isAsync ? "await foreach" : "foreach";
      parts.push(`${ind}${foreachKeyword} (var item in ${delegateFrag.text})`);
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
      const foreachKeyword = currentContext.isAsync ? "await foreach" : "foreach";
      parts.push(`${ind}${foreachKeyword} (var item in ${delegateFrag.text})`);
      parts.push(`${ind}    yield return item;`);
    }
  } else {
    // Regular yield with optional bidirectional support
    if (stmt.output) {
      const [valueFrag, newContext] = emitExpression(
        stmt.output,
        currentContext
      );
      currentContext = newContext;
      parts.push(`${ind}exchange.Output = ${valueFrag.text};`);
    }
    parts.push(`${ind}yield return exchange;`);

    // Handle receiveTarget for bidirectional communication
    if (stmt.receiveTarget) {
      const targetCode = emitPattern(stmt.receiveTarget, "exchange.Input", ind);
      parts.push(targetCode);
    }
  }

  return [parts.join("\n"), currentContext];
};

/**
 * Emit pattern for receiving yield input
 * Handles identifier, array, and object patterns
 * Note: Input is nullable (?), so we use null-coalescing for value types
 */
const emitPattern = (
  pattern: Extract<
    IrStatement,
    { kind: "yieldStatement" }
  >["receiveTarget"] extends infer P
    ? P
    : never,
  inputExpr: string,
  indent: string
): string => {
  if (!pattern) return "";

  switch (pattern.kind) {
    case "identifierPattern":
      // Use null-coalescing to handle nullable Input
      // For value types (like double), use .Value or ?? default
      return `${indent}var ${pattern.name} = ${inputExpr} ?? default!;`;

    case "arrayPattern": {
      // Array destructuring: const [a, b] = yield expr;
      const parts: string[] = [];
      parts.push(`${indent}var __input = ${inputExpr};`);
      pattern.elements.forEach((elem, i) => {
        if (elem && elem.kind === "identifierPattern") {
          parts.push(`${indent}var ${elem.name} = __input[${i}];`);
        }
        // TODO: Handle nested patterns
      });
      return parts.join("\n");
    }

    case "objectPattern": {
      // Object destructuring: const {a, b} = yield expr;
      const parts: string[] = [];
      parts.push(`${indent}var __input = ${inputExpr};`);
      for (const prop of pattern.properties) {
        if (
          prop.kind === "property" &&
          prop.value.kind === "identifierPattern"
        ) {
          const key =
            typeof prop.key === "string" ? prop.key : prop.value.name;
          parts.push(`${indent}var ${prop.value.name} = __input.${key};`);
        }
        // TODO: Handle shorthand and rest patterns
      }
      return parts.join("\n");
    }
  }
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
