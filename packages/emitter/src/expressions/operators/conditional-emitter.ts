/**
 * Conditional (ternary) expression emitter with type predicate narrowing support
 */

import { IrExpression, IrType, stableIrTypeKey } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { stripNullish } from "../../core/semantic/type-resolution.js";
import { isAssignable } from "../../core/semantic/index.js";
import { emitBooleanConditionAst } from "../../core/semantic/boolean-context.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { applyConditionBranchNarrowing } from "../../core/semantic/condition-branch-narrowing.js";
import { tryResolveTernaryGuard } from "../../core/semantic/ternary-guards.js";
import { emitTypeAst } from "../../type-emitter.js";

/**
 * Emit a conditional (ternary) expression as CSharpExpressionAst
 *
 * Supports type predicate narrowing:
 * - `isUser(x) ? x.name : "anon"` → `x.Is1() ? (x.As1()).name : "anon"`
 * - `!isUser(x) ? "anon" : x.name` → `!x.Is1() ? "anon" : (x.As1()).name`
 */
export const emitConditional = (
  expr: Extract<IrExpression, { kind: "conditional" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const resolveBranchType = (
    branchExpr: IrExpression,
    branchContext: EmitterContext
  ): IrType | undefined => {
    const candidate =
      resolveEffectiveBranchType(branchExpr, branchContext) ??
      branchExpr.inferredType;
    // Strip nullish but preserve alias identity. resolveTypeAlias would
    // erase authored aliases (PathSpec → string | RegExp | ...) which
    // changes the semantic branch meaning under full-module context.
    return candidate ? stripNullish(candidate) : undefined;
  };

  const deriveBranchExpectedType = (
    whenTrueContext: EmitterContext,
    whenFalseContext: EmitterContext
  ): IrType | undefined => {
    const trueType = resolveBranchType(expr.whenTrue, whenTrueContext);
    const falseType = resolveBranchType(expr.whenFalse, whenFalseContext);
    let commonBranchType: IrType | undefined;

    if (
      trueType &&
      falseType &&
      stableIrTypeKey(trueType) === stableIrTypeKey(falseType)
    ) {
      commonBranchType = trueType;
    } else if (trueType && falseType) {
      if (isAssignable(trueType, falseType)) {
        commonBranchType = falseType;
      } else if (isAssignable(falseType, trueType)) {
        commonBranchType = trueType;
      }
    }

    if (expectedType) {
      if (
        commonBranchType &&
        stableIrTypeKey(commonBranchType) !== stableIrTypeKey(expectedType) &&
        isAssignable(commonBranchType, expectedType)
      ) {
        return commonBranchType;
      }

      return expectedType;
    }

    return commonBranchType ?? expr.inferredType;
  };

  // Try to detect type predicate guard in condition
  const guard = tryResolveTernaryGuard(expr.condition, context, emitTypeAst);

  if (guard) {
    const {
      originalName,
      memberN,
      narrowedType,
      sourceType,
      escapedOrig,
      polarity,
    } = guard;

    // Build condition AST: escapedOrig.IsN() or !escapedOrig.IsN()
    const isCallAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: {
          kind: "identifierExpression",
          identifier: escapedOrig,
        },
        memberName: `Is${memberN}`,
      },
      arguments: [],
    };
    const condAst: CSharpExpressionAst =
      polarity === "positive"
        ? isCallAst
        : {
            kind: "prefixUnaryExpression",
            operatorToken: "!",
            operand: isCallAst,
          };

    // Create inline narrowing binding: x -> (x.AsN())
    const exprAst: CSharpExpressionAst = {
      kind: "parenthesizedExpression",
      expression: {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: {
            kind: "identifierExpression",
            identifier: escapedOrig,
          },
          memberName: `As${memberN}`,
        },
        arguments: [],
      },
    };
    const narrowedMap = new Map<string, NarrowedBinding>(
      context.narrowedBindings ?? []
    );
    narrowedMap.set(originalName, {
      kind: "expr",
      exprAst,
      type: narrowedType,
      sourceType,
    });

    const narrowedContext: EmitterContext = {
      ...context,
      narrowedBindings: narrowedMap,
    };
    const branchExpectedType = deriveBranchExpectedType(
      polarity === "positive" ? narrowedContext : context,
      polarity === "negative" ? narrowedContext : context
    );

    // Apply guard narrowing to the matching branch, and condition-based
    // complement narrowing to the opposite branch so that the complement
    // type is visible (e.g., first: PathSpec | MiddlewareLike in the
    // false branch becomes first: MiddlewareLike).
    const complementContext = applyConditionBranchNarrowing(
      expr.condition,
      polarity === "positive" ? "falsy" : "truthy",
      context,
      (e, ctx) => emitExpressionAst(e, ctx)
    );

    const [trueAst] =
      polarity === "positive"
        ? emitExpressionAst(expr.whenTrue, narrowedContext, branchExpectedType)
        : emitExpressionAst(
            expr.whenTrue,
            complementContext,
            branchExpectedType
          );

    const [falseAst, falseContext] =
      polarity === "negative"
        ? emitExpressionAst(expr.whenFalse, narrowedContext, branchExpectedType)
        : emitExpressionAst(
            expr.whenFalse,
            complementContext,
            branchExpectedType
          );

    // Return context WITHOUT narrowing (don't leak)
    const finalContext: EmitterContext = {
      ...falseContext,
      narrowedBindings: context.narrowedBindings,
    };

    return [
      {
        kind: "conditionalExpression",
        condition: condAst,
        whenTrue: trueAst,
        whenFalse: falseAst,
      },
      finalContext,
    ];
  }

  // Standard ternary emission (no narrowing)
  const [condAst, condContext] = emitBooleanConditionAst(
    expr.condition,
    (e, ctx) => emitExpressionAst(e, ctx),
    context
  );

  const truthyBranchContext = applyConditionBranchNarrowing(
    expr.condition,
    "truthy",
    condContext,
    (e, ctx) => emitExpressionAst(e, ctx)
  );
  const falsyBranchContext = applyConditionBranchNarrowing(
    expr.condition,
    "falsy",
    condContext,
    (e, ctx) => emitExpressionAst(e, ctx)
  );
  const branchExpectedType = deriveBranchExpectedType(
    truthyBranchContext,
    falsyBranchContext
  );

  // Pass expectedType (or inferred type) to both branches for null/undefined → default conversion
  const [trueAst, trueContext] = emitExpressionAst(
    expr.whenTrue,
    truthyBranchContext,
    branchExpectedType
  );
  const [falseAst, falseContext] = emitExpressionAst(
    expr.whenFalse,
    falsyBranchContext,
    branchExpectedType
  );

  const finalContext: EmitterContext = {
    ...falseContext,
    tempVarId: Math.max(
      trueContext.tempVarId ?? 0,
      falseContext.tempVarId ?? 0
    ),
    usings: new Set([
      ...(trueContext.usings ?? []),
      ...(falseContext.usings ?? []),
    ]),
    narrowedBindings: condContext.narrowedBindings,
  };

  return [
    {
      kind: "conditionalExpression",
      condition: condAst,
      whenTrue: trueAst,
      whenFalse: falseAst,
    },
    finalContext,
  ];
};

const resolveEffectiveBranchType = (
  expr: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind === "identifier") {
    return context.narrowedBindings?.get(expr.name)?.type ?? expr.inferredType;
  }

  if (expr.kind === "memberAccess" && !expr.isComputed) {
    const key =
      typeof expr.property === "string" && expr.object.kind === "identifier"
        ? `${expr.object.name}.${expr.property}`
        : undefined;
    return key
      ? (context.narrowedBindings?.get(key)?.type ?? expr.inferredType)
      : expr.inferredType;
  }

  return expr.inferredType;
};
