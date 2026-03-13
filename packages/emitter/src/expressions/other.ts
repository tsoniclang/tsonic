/**
 * Miscellaneous expression emitters (template literals, spread, await)
 */

import { getAwaitedIrType, IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitTypeAst } from "../types/emitter.js";
import type {
  CSharpExpressionAst,
  CSharpInterpolatedStringPart,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

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
      kind: "identifierExpression",
      identifier: "global::System.Convert.ToString",
    },
    arguments: [exprAst],
  },
  right: { kind: "literalExpression", text: '"undefined"' },
});

const classifyAwaitability = (
  type: IrType | undefined
): "awaitable" | "nonAwaitable" | "mixed" => {
  if (!type) return "awaitable";
  if (getAwaitedIrType(type)) return "awaitable";
  if (type.kind !== "unionType") return "nonAwaitable";

  const memberKinds = new Set(
    type.types.map((member) => classifyAwaitability(member))
  );
  if (memberKinds.size === 1) {
    const [onlyKind] = [...memberKinds];
    return onlyKind ?? "nonAwaitable";
  }
  return "mixed";
};

const buildTaskFromResultExpression = (
  exprAst: CSharpExpressionAst,
  resultTypeAst?: CSharpTypeAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: {
      kind: "identifierExpression",
      identifier: "global::System.Threading.Tasks.Task",
    },
    memberName: "FromResult",
  },
  typeArguments: resultTypeAst ? [resultTypeAst] : undefined,
  arguments: [exprAst],
});

const requiresExplicitTaskFromResultType = (
  exprAst: CSharpExpressionAst
): boolean => {
  if (exprAst.kind !== "literalExpression") return false;
  const text = exprAst.text.trim();
  return (
    text === "null" ||
    text === "default" ||
    text.startsWith("default(")
  );
};

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

      // For nullish types, wrap in Convert.ToString(...) ?? "undefined"
      const interpolationExpr = typeMayBeNullish(exprAtIndex.inferredType)
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
  const awaitability = classifyAwaitability(expr.expression.inferredType);

  if (awaitability === "awaitable") {
    return [{ kind: "awaitExpression", expression: exprAst }, newContext];
  }

  if (awaitability === "mixed") {
    throw new Error(
      "ICE: Mixed awaitable/non-awaitable union types in `await` are not yet supported deterministically."
    );
  }

  const resultType = expr.inferredType ?? expr.expression.inferredType;
  if (!resultType || resultType.kind === "voidType") {
    throw new Error(
      "ICE: Non-awaitable `await` requires a value result type for deterministic lowering."
    );
  }

  const needsExplicitResultType = requiresExplicitTaskFromResultType(exprAst);
  const [resultTypeAst, resultTypeContext] = needsExplicitResultType
    ? emitTypeAst(resultType, newContext)
    : [undefined, newContext];
  return [
    {
      kind: "awaitExpression",
      expression: buildTaskFromResultExpression(exprAst, resultTypeAst),
    },
    resultTypeContext,
  ];
};
