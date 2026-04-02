/**
 * Miscellaneous expression emitters (template literals, spread, await)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  identifierExpression,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpInterpolatedStringPart,
} from "../core/format/backend-ast/types.js";
import { emitNormalizedAwaitTaskAst } from "./await-normalization.js";
import { buildExactGlobalBindingReference } from "./exact-global-bindings.js";

const typeMayBeNullish = (type: IrType | undefined): boolean => {
  if (!type) return false;
  if (
    type.kind === "primitiveType" &&
    (type.name === "null" || type.name === "undefined")
  ) {
    return true;
  }
  if (type.kind === "unionType") {
    return type.types.some(
      (t) =>
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
    );
  }
  return false;
};

const isDefinitelyJsPrimitiveStringifiable = (
  type: IrType | undefined
): boolean => {
  if (!type) return false;
  if (type.kind === "literalType") return true;
  if (type.kind === "primitiveType") {
    return type.name !== "null" && type.name !== "undefined";
  }
  if (type.kind === "unionType") {
    return type.types.every(
      (member) =>
        member.kind === "literalType" ||
        (member.kind === "primitiveType" &&
          member.name !== "null" &&
          member.name !== "undefined")
    );
  }
  return false;
};

/**
 * Escape a string for use in a C# interpolated string literal.
 * Handles backslashes, quotes, newlines, carriage returns, tabs,
 * and curly braces (which are interpolation delimiters in C#).
 */
const escapeForInterpolatedString = (str: string): string =>
  str
    .replace(/\\/g, "\\\\") // Backslash first to avoid double-escaping
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\{/g, "{{") // Escape { for C# interpolated strings
    .replace(/\}/g, "}}"); // Escape } for C# interpolated strings

/**
 * Build a nullish-safe interpolation expression.
 *
 * JavaScript template literal holes use ToString conversion:
 * `${undefined}` -> "undefined". C# interpolated strings render null as "".
 * For nullish unions, force a string conversion with an explicit fallback:
 *   global::System.Convert.ToString(expr) ?? "undefined"
 */
const buildNullishSafeExpr = (
  exprAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "binaryExpression",
  operatorToken: "??",
  left: {
    kind: "invocationExpression",
    expression: {
      ...identifierExpression("global::System.Convert.ToString"),
    },
    arguments: [exprAst],
  },
  right: stringLiteral("undefined"),
});

const buildJsStringCoercionExpr = (
  exprAst: CSharpExpressionAst,
  context: EmitterContext
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: buildExactGlobalBindingReference("String", context),
  arguments: [exprAst],
});

/**
 * Emit a template literal as CSharpExpressionAst (interpolatedStringExpression)
 *
 * Literal curly braces in template strings are escaped as {{ and }}
 * since they are interpolation delimiters in C#.
 *
 * The printer handles wrapping interpolation expressions in parens when they
 * contain ':' to prevent format specifier ambiguity.
 */
export const emitTemplateLiteral = (
  expr: Extract<IrExpression, { kind: "templateLiteral" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;
  const parts: CSharpInterpolatedStringPart[] = [];

  for (let i = 0; i < expr.quasis.length; i++) {
    const quasi = expr.quasis[i];
    if (quasi !== undefined && quasi !== null && quasi.length > 0) {
      parts.push({
        kind: "text",
        text: escapeForInterpolatedString(quasi),
      });
    }

    const exprAtIndex = expr.expressions[i];
    if (i < expr.expressions.length && exprAtIndex) {
      const [exprAst, newContext] = emitExpressionAst(
        exprAtIndex,
        currentContext
      );
      currentContext = newContext;

      const interpolationExpr =
        currentContext.options.surface === "@tsonic/js"
          ? isDefinitelyJsPrimitiveStringifiable(exprAtIndex.inferredType)
            ? exprAst
            : buildJsStringCoercionExpr(exprAst, currentContext)
          : typeMayBeNullish(exprAtIndex.inferredType)
            ? buildNullishSafeExpr(exprAst)
            : exprAst;

      parts.push({ kind: "interpolation", expression: interpolationExpr });
    }
  }

  return [{ kind: "interpolatedStringExpression", parts }, currentContext];
};

/**
 * Emit a spread expression as CSharpExpressionAst
 *
 * Note: Spread is not a standalone C# expression. This is a fallback
 * that preserves the current behavior. Array/call contexts handle spread
 * specially via their own emitters.
 */
export const emitSpread = (
  expr: Extract<IrExpression, { kind: "spread" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [exprAst, newContext] = emitExpressionAst(expr.expression, context);
  // Use prefixUnaryExpression as a fallback for the ...expr pattern
  return [
    { kind: "prefixUnaryExpression", operatorToken: "...", operand: exprAst },
    newContext,
  ];
};

/**
 * Emit an await expression as CSharpExpressionAst
 */
export const emitAwait = (
  expr: Extract<IrExpression, { kind: "await" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [exprAst, newContext] = emitExpressionAst(expr.expression, context);
  const resultType = expr.inferredType ?? expr.expression.inferredType;
  const [taskAst, taskContext] = emitNormalizedAwaitTaskAst(
    exprAst,
    expr.expression.inferredType,
    resultType,
    newContext
  );

  return [
    {
      kind: "awaitExpression",
      expression: taskAst,
    },
    taskContext,
  ];
};
