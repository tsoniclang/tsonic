/**
 * Assignment operator expression emitter
 */

import { IrExpression, IrType, IrPattern } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitRemappedLocalName } from "../../core/local-names.js";
import { lowerAssignmentPattern } from "../../patterns.js";
import { hasInt32Proof } from "./helpers.js";

/**
 * Emit an assignment expression (=, +=, -=, etc.)
 *
 * Passes the LHS type as expected type to RHS, enabling proper integer
 * literal emission for cases like `this.value = this.value + 1`.
 */
export const emitAssignment = (
  expr: Extract<IrExpression, { kind: "assignment" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Array element assignment uses native CLR indexer
  // HARD GATE: Index must be proven Int32 (validated by proof pass)
  if (
    expr.operator === "=" &&
    "kind" in expr.left &&
    expr.left.kind === "memberAccess" &&
    expr.left.isComputed &&
    expr.left.object.inferredType?.kind === "arrayType"
  ) {
    const leftExpr = expr.left as Extract<
      IrExpression,
      { kind: "memberAccess" }
    >;
    const indexExpr = leftExpr.property as IrExpression;

    if (!hasInt32Proof(indexExpr)) {
      // ICE: Unproven index should have been caught by proof pass (TSN5107)
      throw new Error(
        `Internal Compiler Error: Array index must be proven Int32. ` +
          `This should have been caught by the numeric proof pass (TSN5107).`
      );
    }

    const [objectFrag, objectContext] = emitExpression(
      leftExpr.object,
      context
    );
    const [indexFrag, indexContext] = emitExpression(indexExpr, objectContext);
    const [rightFrag, rightContext] = emitExpression(expr.right, indexContext);

    // Use native CLR indexer
    const text = `${objectFrag.text}[${indexFrag.text}] = ${rightFrag.text}`;
    return [{ text, precedence: 2 }, rightContext];
  }

  // Left side can be an expression or a pattern (for destructuring)
  const isPattern =
    "kind" in expr.left &&
    (expr.left.kind === "identifierPattern" ||
      expr.left.kind === "arrayPattern" ||
      expr.left.kind === "objectPattern");

  // Handle destructuring assignment patterns
  if (isPattern && expr.operator === "=") {
    const pattern = expr.left as IrPattern;

    // Emit the RHS first
    const [rightFrag, rightContext] = emitExpression(expr.right, context);

    // Use lowerAssignmentPattern to generate the destructuring expression
    const result = lowerAssignmentPattern(
      pattern,
      rightFrag.text,
      expr.right.inferredType,
      rightContext
    );

    return [{ text: result.expression, precedence: 2 }, result.context];
  }

  // Standard assignment (expression on left side)
  let leftText: string;
  let leftContext: EmitterContext;
  let leftType: IrType | undefined;

  if (isPattern) {
    // Identifier pattern with compound assignment (+=, etc.)
    const pattern = expr.left as IrPattern;
    if (pattern.kind === "identifierPattern") {
      leftText = emitRemappedLocalName(pattern.name, context);
      leftContext = context;
      leftType = pattern.type;
    } else {
      // Compound assignment to array/object pattern - not valid in JS
      leftText = "/* invalid compound destructuring */";
      leftContext = context;
    }
  } else {
    const leftExpr = expr.left as IrExpression;
    // Narrowing maps (instanceof / nullable / union) apply to *reads*, not writes.
    // For assignment, the LHS is written, so we must not rewrite identifier targets
    // to narrowed bindings (e.g., C# pattern vars).
    const leftCtx: EmitterContext =
      leftExpr.kind === "identifier" &&
      context.narrowedBindings?.has(leftExpr.name)
        ? (() => {
            const next = new Map(context.narrowedBindings);
            next.delete(leftExpr.name);
            return { ...context, narrowedBindings: next };
          })()
        : context;

    const [leftFrag, ctx] = emitExpression(leftExpr, leftCtx);
    leftText = leftFrag.text;
    // Restore narrowing for RHS emission (reads) when we suppressed it for the LHS.
    leftContext =
      leftCtx !== context
        ? { ...ctx, narrowedBindings: context.narrowedBindings }
        : ctx;
    leftType = leftExpr.inferredType;
  }

  // Pass LHS type as expected type to RHS for proper integer handling
  const [rightFrag, rightContext] = emitExpression(
    expr.right,
    leftContext,
    leftType
  );

  const text = `${leftText} ${expr.operator} ${rightFrag.text}`;
  return [{ text, precedence: 2 }, rightContext];
};
