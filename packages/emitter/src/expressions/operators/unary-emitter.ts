/**
 * Unary and update operator expression emitters
 *
 * NEW NUMERIC SPEC:
 * - Literals use raw lexeme (no contextual widening)
 * - Integer casts only from IrCastExpression (not inferred from expectedType)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitType } from "../../type-emitter.js";
import { emitBooleanCondition } from "../../core/semantic/boolean-context.js";

/**
 * Emit a unary operator expression (-, +, !, ~, typeof, void, delete)
 *
 * NEW NUMERIC SPEC: No contextual type propagation for numeric literals.
 * Explicit casts come from IrCastExpression nodes.
 *
 * @param expr - The unary expression
 * @param context - Emitter context
 * @param _expectedType - Unused under new spec (kept for API compatibility)
 */
export const emitUnary = (
  expr: Extract<IrExpression, { kind: "unary" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  // In TypeScript, `!x` applies JS ToBoolean semantics to *any* operand.
  // In C#, `!` only works on booleans, so we must coerce to a boolean condition.
  if (expr.operator === "!") {
    const [condText, condCtx] = emitBooleanCondition(
      expr.expression,
      (e, ctx) => emitExpression(e, ctx),
      context
    );
    const text = `!(${condText})`;
    return [{ text, precedence: 15 }, condCtx];
  }

  if (expr.operator === "delete") {
    // JavaScript `delete obj[key]` maps to dictionary key removal in CLR:
    //   delete dict[key]  -> dict.Remove(key)
    // For unsupported targets we keep the existing no-op emission for now.
    const target = expr.expression;
    if (
      target.kind === "memberAccess" &&
      target.isComputed &&
      typeof target.property !== "string" &&
      (target.accessKind === "dictionary" ||
        target.object.inferredType?.kind === "dictionaryType")
    ) {
      const [objectFrag, objectContext] = emitExpression(
        target.object,
        context
      );
      const [keyFrag, keyContext] = emitExpression(
        target.property,
        objectContext
      );
      const text = `${objectFrag.text}.Remove(${keyFrag.text})`;
      return [{ text }, keyContext];
    }

    const [targetFrag, newContext] = emitExpression(target, context);
    const text = `/* delete ${targetFrag.text} */`;
    return [{ text }, newContext];
  }

  const [operandFrag, newContext] = emitExpression(expr.expression, context);

  if (expr.operator === "typeof") {
    // typeof becomes global::Tsonic.Runtime.Operators.typeof()
    const text = `global::Tsonic.Runtime.Operators.@typeof(${operandFrag.text})`;
    return [{ text }, newContext];
  }

  if (expr.operator === "void") {
    // `void expr` evaluates `expr` and yields `undefined`.
    //
    // In expression position we must produce a value, so use an IIFE:
    //   (() => { <eval expr>; return default(<T>); })()
    //
    // In statement position, emitExpressionStatement handles this separately
    // (so we don't pay this cost for the common `void x;` marker).
    const operand = expr.expression;

    // If the operand is a literal null/undefined, evaluation is a no-op and can be skipped.
    // This avoids generating invalid discard assignments like `_ = default;`.
    const isNoopOperand =
      (operand.kind === "literal" &&
        (operand.value === undefined || operand.value === null)) ||
      (operand.kind === "identifier" &&
        (operand.name === "undefined" || operand.name === "null"));

    let currentContext = newContext;

    const effectiveExpectedType =
      expectedType &&
      expectedType.kind !== "voidType" &&
      expectedType.kind !== "neverType"
        ? expectedType
        : undefined;

    let returnTypeText = "object?";
    let defaultText = "default";
    if (effectiveExpectedType) {
      try {
        const [typeText, next] = emitType(
          effectiveExpectedType,
          currentContext
        );
        currentContext = next;
        returnTypeText = typeText;
        defaultText = `default(${typeText})`;
      } catch {
        // Fall back to object? + default literal.
      }
    }

    const operandStatement = (() => {
      if (isNoopOperand) return "";

      // If the operand is already a valid statement-expression (call/new/assignment/
      // update/await), emit it directly. Otherwise, use a discard assignment.
      if (
        operand.kind === "call" ||
        operand.kind === "new" ||
        operand.kind === "assignment" ||
        operand.kind === "update" ||
        operand.kind === "await"
      ) {
        return `${operandFrag.text}; `;
      }

      return `_ = ${operandFrag.text}; `;
    })();

    if (operand.kind === "await") {
      if (!currentContext.isAsync) {
        throw new Error(
          "ICE: `void await <expr>` reached emitter in a non-async context."
        );
      }

      const taskReturnType = `global::System.Threading.Tasks.Task<${returnTypeText}>`;
      const text = `await ((global::System.Func<${taskReturnType}>)(async () => { ${operandStatement}return ${defaultText}; }))()`;
      return [{ text }, currentContext];
    }

    const text = `((global::System.Func<${returnTypeText}>)(() => { ${operandStatement}return ${defaultText}; }))()`;
    return [{ text }, currentContext];
  }

  const text = `${expr.operator}${operandFrag.text}`;

  return [{ text, precedence: 15 }, newContext];
};

/**
 * Emit an update operator expression (++, --)
 */
export const emitUpdate = (
  expr: Extract<IrExpression, { kind: "update" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Narrowing maps (instanceof / nullable / union) apply to *reads*, not writes.
  // For update operators, the operand is written, so we must not rewrite the target
  // identifier to a narrowed binding (e.g., C# pattern var).
  const operandCtx: EmitterContext =
    expr.expression.kind === "identifier" &&
    context.narrowedBindings?.has(expr.expression.name)
      ? (() => {
          const next = new Map(context.narrowedBindings);
          next.delete(expr.expression.name);
          return { ...context, narrowedBindings: next };
        })()
      : context;

  const [operandFrag, ctx] = emitExpression(expr.expression, operandCtx);
  const newContext: EmitterContext =
    operandCtx !== context
      ? { ...ctx, narrowedBindings: context.narrowedBindings }
      : ctx;

  const text = expr.prefix
    ? `${expr.operator}${operandFrag.text}`
    : `${operandFrag.text}${expr.operator}`;

  return [{ text, precedence: 15 }, newContext];
};
