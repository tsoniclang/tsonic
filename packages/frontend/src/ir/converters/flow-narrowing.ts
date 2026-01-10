/**
 * Flow narrowing helpers (frontend).
 *
 * Airplane-grade requirement:
 * - Deterministic (TS-free) narrowing logic
 * - Correct lexical scoping (key by DeclId.id, not by identifier text)
 *
 * Currently supports:
 * - `x instanceof T` in boolean (truthy) contexts
 * - Conjunction: `(x instanceof T) && ...` (collects narrowings from both sides)
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";

export type InstanceofNarrowing = {
  readonly declId: number;
  readonly targetType: IrType;
};

const unwrapExpr = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

const tryResolveInstanceofNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext
): InstanceofNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);
  if (!ts.isBinaryExpression(unwrapped)) return undefined;
  if (unwrapped.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword) return undefined;

  const left = unwrapExpr(unwrapped.left);
  const right = unwrapExpr(unwrapped.right);

  if (!ts.isIdentifier(left)) return undefined;
  if (!ts.isIdentifier(right)) return undefined;

  const targetDeclId = ctx.binding.resolveIdentifier(right);
  if (!targetDeclId) return undefined;

  const targetType = ctx.typeSystem.typeOfDecl(targetDeclId);
  if (targetType.kind === "unknownType") return undefined;

  const narrowedDeclId = ctx.binding.resolveIdentifier(left);
  if (!narrowedDeclId) return undefined;

  return { declId: narrowedDeclId.id, targetType };
};

/**
 * Collect `instanceof` narrowings that are guaranteed to hold when `expr` is truthy.
 *
 * We only collect from conjunctions (&&) because truthiness of `A && B` implies both
 * `A` and `B` are truthy; for `A || B` it does not guarantee either side.
 */
export const collectInstanceofNarrowingsInTruthyExpr = (
  expr: ts.Expression,
  ctx: ProgramContext
): readonly InstanceofNarrowing[] => {
  const unwrapped = unwrapExpr(expr);

  const direct = tryResolveInstanceofNarrowing(unwrapped, ctx);
  if (direct) return [direct];

  if (ts.isBinaryExpression(unwrapped)) {
    if (unwrapped.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return [
        ...collectInstanceofNarrowingsInTruthyExpr(unwrapped.left, ctx),
        ...collectInstanceofNarrowingsInTruthyExpr(unwrapped.right, ctx),
      ];
    }
  }

  return [];
};

export const withAppliedNarrowings = (
  ctx: ProgramContext,
  narrowings: readonly InstanceofNarrowing[]
): ProgramContext => {
  if (narrowings.length === 0) return ctx;

  const next = new Map<number, IrType>(ctx.typeEnv ?? []);
  for (const n of narrowings) {
    next.set(n.declId, n.targetType);
  }
  return { ...ctx, typeEnv: next };
};

