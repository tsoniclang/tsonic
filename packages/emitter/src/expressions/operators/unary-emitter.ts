/**
 * Unary and update operator expression emitters
 *
 * NEW NUMERIC SPEC:
 * - Literals use raw lexeme (no contextual widening)
 * - Integer casts only from IrCastExpression (not inferred from expectedType)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitType } from "../../type-emitter.js";
import { emitBooleanConditionAst } from "../../core/semantic/boolean-context.js";
import { printExpression } from "../../core/format/backend-ast/printer.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";

/**
 * Emit a unary operator expression as CSharpExpressionAst (-, +, !, ~, typeof, void, delete)
 *
 * NEW NUMERIC SPEC: No contextual type propagation for numeric literals.
 * Explicit casts come from IrCastExpression nodes.
 *
 * @param expr - The unary expression
 * @param context - Emitter context
 * @param expectedType - Used for void IIFE return type
 */
export const emitUnary = (
  expr: Extract<IrExpression, { kind: "unary" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  // In TypeScript, `!x` applies JS ToBoolean semantics to *any* operand.
  // In C#, `!` only works on booleans, so we must coerce to a boolean condition.
  if (expr.operator === "!") {
    const [condAst, condCtx] = emitBooleanConditionAst(
      expr.expression,
      (e, ctx) => emitExpressionAst(e, ctx),
      context
    );
    return [
      {
        kind: "prefixUnaryExpression",
        operatorToken: "!",
        operand: condAst,
      },
      condCtx,
    ];
  }

  if (expr.operator === "delete") {
    // JavaScript `delete obj[key]` maps to dictionary key removal in CLR:
    //   delete dict[key]  -> dict.Remove(key)
    const target = expr.expression;
    if (
      target.kind === "memberAccess" &&
      target.isComputed &&
      typeof target.property !== "string" &&
      (target.accessKind === "dictionary" ||
        target.object.inferredType?.kind === "dictionaryType")
    ) {
      const [objectAst, objectContext] = emitExpressionAst(
        target.object,
        context
      );
      const [keyAst, keyContext] = emitExpressionAst(
        target.property,
        objectContext
      );
      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: objectAst,
            memberName: "Remove",
          },
          arguments: [keyAst],
        },
        keyContext,
      ];
    }

    const [targetAst, newContext] = emitExpressionAst(target, context);
    const targetText = printExpression(targetAst);
    return [
      {
        kind: "identifierExpression",
        identifier: `/* delete ${targetText} */`,
      },
      newContext,
    ];
  }

  const [operandAst, newContext] = emitExpressionAst(expr.expression, context);

  if (expr.operator === "typeof") {
    // typeof becomes global::Tsonic.Runtime.Operators.typeof()
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "identifierExpression",
          identifier: "global::Tsonic.Runtime.Operators.@typeof",
        },
        arguments: [operandAst],
      },
      newContext,
    ];
  }

  if (expr.operator === "void") {
    // `void expr` evaluates `expr` and yields `undefined`.
    //
    // In expression position we must produce a value, so use an IIFE:
    //   (() => { <eval expr>; return default(<T>); })()
    //
    // In statement position, emitExpressionStatement handles this separately.
    // Complex IIFE pattern - bridge via identifierExpression.
    const operand = expr.expression;
    const operandText = printExpression(operandAst);

    // If the operand is a literal null/undefined, evaluation is a no-op.
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

      // If the operand is already a valid statement-expression, emit it directly.
      if (
        operand.kind === "call" ||
        operand.kind === "new" ||
        operand.kind === "assignment" ||
        operand.kind === "update" ||
        operand.kind === "await"
      ) {
        return `${operandText}; `;
      }

      return `_ = ${operandText}; `;
    })();

    if (operand.kind === "await") {
      if (!currentContext.isAsync) {
        throw new Error(
          "ICE: `void await <expr>` reached emitter in a non-async context."
        );
      }

      const taskReturnType = `global::System.Threading.Tasks.Task<${returnTypeText}>`;
      const text = `await ((global::System.Func<${taskReturnType}>)(async () => { ${operandStatement}return ${defaultText}; }))()`;
      return [
        { kind: "identifierExpression", identifier: text },
        currentContext,
      ];
    }

    const text = `((global::System.Func<${returnTypeText}>)(() => { ${operandStatement}return ${defaultText}; }))()`;
    return [{ kind: "identifierExpression", identifier: text }, currentContext];
  }

  // Standard prefix operator: -, +, ~
  return [
    {
      kind: "prefixUnaryExpression",
      operatorToken: expr.operator,
      operand: operandAst,
    },
    newContext,
  ];
};

/**
 * Emit an update operator expression as CSharpExpressionAst (++, --)
 */
export const emitUpdate = (
  expr: Extract<IrExpression, { kind: "update" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  // Narrowing maps apply to *reads*, not writes.
  // For update operators, suppress narrowed bindings for the target.
  const operandCtx: EmitterContext =
    expr.expression.kind === "identifier" &&
    context.narrowedBindings?.has(expr.expression.name)
      ? (() => {
          const next = new Map(context.narrowedBindings);
          next.delete(expr.expression.name);
          return { ...context, narrowedBindings: next };
        })()
      : context;

  const [operandAst, ctx] = emitExpressionAst(expr.expression, operandCtx);
  const newContext: EmitterContext =
    operandCtx !== context
      ? { ...ctx, narrowedBindings: context.narrowedBindings }
      : ctx;

  if (expr.prefix) {
    return [
      {
        kind: "prefixUnaryExpression",
        operatorToken: expr.operator,
        operand: operandAst,
      },
      newContext,
    ];
  }

  return [
    {
      kind: "postfixUnaryExpression",
      operatorToken: expr.operator,
      operand: operandAst,
    },
    newContext,
  ];
};
