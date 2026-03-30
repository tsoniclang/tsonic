/**
 * Truthy/falsy narrowing resolution and sequential narrowing collection.
 *
 * Contains tryResolveTruthyNarrowing, tryResolveFalsyNarrowing,
 * collectTypeNarrowingsInTruthyExpr, collectTypeNarrowingsInFalsyExpr,
 * and collectSequentialNarrowings.
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import { narrowTypeByArrayShape } from "./array-type-guards.js";
import { narrowTypeByAssignableTarget } from "./reference-type-guards.js";
import {
  getAccessPathTarget,
  getCurrentTypeForAccessPath,
  type AccessPathTarget,
} from "./access-paths.js";
import {
  type TypeNarrowing,
  unwrapExpr,
  getStringLiteralText,
  makeTypeNarrowing,
  extractArrayIsArrayTarget,
  tryResolveCallPredicateNarrowing,
  extractIdentifierPropertyAccess,
  narrowTypeByTypeofTag,
  tryResolveTypeofNarrowing,
  tryResolveEqualityLiteralNarrowing,
  resolveInstanceofTargetType,
} from "./narrowing-resolvers.js";
import { withAppliedNarrowings } from "./narrowing-environment.js";
import {
  getCurrentTypeForDecl,
  narrowTypeByPropertyPresence,
  narrowTypeByPropertyTruthiness,
} from "./narrowing-property-helpers.js";

const tryResolveTruthyNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext
): TypeNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);
  const arrayTarget = extractArrayIsArrayTarget(unwrapped, ctx);
  if (arrayTarget) {
    const targetType = narrowTypeByArrayShape(
      ctx.typeSystem,
      getCurrentTypeForAccessPath(arrayTarget, ctx),
      true
    );
    if (targetType) {
      return makeTypeNarrowing(arrayTarget, targetType);
    }
  }

  const propertyAccess = extractIdentifierPropertyAccess(unwrapped, ctx);
  if (propertyAccess) {
    const currentType = getCurrentTypeForDecl(propertyAccess.declId, ctx);
    const targetType = narrowTypeByPropertyTruthiness(
      currentType,
      propertyAccess.propertyName,
      true,
      ctx
    );
    if (targetType) {
      return {
        kind: "decl",
        declId: propertyAccess.declId.id,
        targetType,
      };
    }
  }

  if (
    ts.isBinaryExpression(unwrapped) &&
    unwrapped.operatorToken.kind === ts.SyntaxKind.InKeyword
  ) {
    const propertyName = getStringLiteralText(unwrapped.left);
    const object = unwrapExpr(unwrapped.right);
    if (propertyName && ts.isIdentifier(object)) {
      const declId = ctx.binding.resolveIdentifier(object);
      if (declId) {
        const targetType = narrowTypeByPropertyPresence(
          getCurrentTypeForDecl(declId, ctx),
          propertyName,
          true,
          ctx
        );
        if (targetType) {
          return { kind: "decl", declId: declId.id, targetType };
        }
      }
    }
  }

  // istype<T>(x)
  if (
    ts.isCallExpression(unwrapped) &&
    ts.isIdentifier(unwrapped.expression) &&
    unwrapped.expression.text === "istype" &&
    unwrapped.typeArguments &&
    unwrapped.typeArguments.length === 1 &&
    unwrapped.arguments.length === 1
  ) {
    const typeArg = unwrapped.typeArguments[0];
    const rawArg = unwrapped.arguments[0];
    if (!typeArg || !rawArg) return undefined;
    const valueArg = unwrapExpr(rawArg);
    if (!ts.isIdentifier(valueArg)) return undefined;

    const targetType = ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(typeArg)
    );
    if (targetType.kind === "unknownType") return undefined;

    const narrowedDeclId = ctx.binding.resolveIdentifier(valueArg);
    if (!narrowedDeclId) return undefined;

    return { kind: "decl", declId: narrowedDeclId.id, targetType };
  }

  // typeof x === "string" / "number" / "boolean" / "undefined"
  if (
    ts.isBinaryExpression(unwrapped) &&
    (unwrapped.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      unwrapped.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken)
  ) {
    const left = unwrapExpr(unwrapped.left);
    const right = unwrapExpr(unwrapped.right);
    const leftLiteral = getStringLiteralText(left);
    const rightLiteral = getStringLiteralText(right);

    const extractTypeofTarget = (
      expr: ts.Expression
    ): AccessPathTarget | undefined => {
      if (!ts.isTypeOfExpression(expr)) return undefined;
      return getAccessPathTarget(expr.expression, ctx);
    };

    const leftTypeofTarget = extractTypeofTarget(left);
    const rightTypeofTarget = extractTypeofTarget(right);

    const tag =
      leftTypeofTarget && rightLiteral
        ? rightLiteral
        : rightTypeofTarget && leftLiteral
          ? leftLiteral
          : undefined;
    const narrowedTarget = leftTypeofTarget ?? rightTypeofTarget;
    if (!tag || !narrowedTarget) return undefined;

    const currentType = getCurrentTypeForAccessPath(narrowedTarget, ctx);
    const targetType = narrowTypeByTypeofTag(currentType, tag, ctx);
    if (!targetType) return undefined;

    return makeTypeNarrowing(narrowedTarget, targetType);
  }

  // x instanceof T
  if (!ts.isBinaryExpression(unwrapped)) return undefined;
  if (unwrapped.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword)
    return undefined;

  const narrowedTarget = getAccessPathTarget(unwrapped.left, ctx);
  if (!narrowedTarget) return undefined;

  const targetType = resolveInstanceofTargetType(unwrapped.right, ctx);
  if (!targetType) return undefined;

  const narrowedType = narrowTypeByAssignableTarget(
    {
      collectNarrowingCandidates: (type) =>
        ctx.typeSystem.collectNarrowingCandidates(type),
      isAssignableTo: (source, target) =>
        ctx.typeSystem.matchesInstanceofTarget(source, target),
    },
    getCurrentTypeForAccessPath(narrowedTarget, ctx),
    targetType,
    true
  );
  if (!narrowedType) return undefined;

  return makeTypeNarrowing(narrowedTarget, narrowedType);
};

/**
 * Collect `instanceof` narrowings that are guaranteed to hold when `expr` is truthy.
 *
 * We only collect from conjunctions (&&) because truthiness of `A && B` implies both
 * `A` and `B` are truthy; for `A || B` it does not guarantee either side.
 */
export const collectTypeNarrowingsInTruthyExpr = (
  expr: ts.Expression,
  ctx: ProgramContext
): readonly TypeNarrowing[] => {
  const unwrapped = unwrapExpr(expr);

  if (
    ts.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.operator === ts.SyntaxKind.ExclamationToken
  ) {
    return collectTypeNarrowingsInFalsyExpr(unwrapped.operand, ctx);
  }

  const direct = tryResolveTruthyNarrowing(unwrapped, ctx);
  if (direct) return [direct];

  const predicateNarrowing = tryResolveCallPredicateNarrowing(
    unwrapped,
    ctx,
    true
  );
  if (predicateNarrowing) return [predicateNarrowing];

  const typeofNarrowing = tryResolveTypeofNarrowing(unwrapped, ctx, true);
  if (typeofNarrowing) return [typeofNarrowing];

  const equalityNarrowing = tryResolveEqualityLiteralNarrowing(
    unwrapped,
    ctx,
    true
  );
  if (equalityNarrowing) return [equalityNarrowing];

  if (ts.isBinaryExpression(unwrapped)) {
    if (
      unwrapped.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return collectSequentialNarrowings(ctx, [
        (phaseCtx) =>
          collectTypeNarrowingsInTruthyExpr(unwrapped.left, phaseCtx),
        (phaseCtx) =>
          collectTypeNarrowingsInTruthyExpr(unwrapped.right, phaseCtx),
      ]);
    }
  }

  return [];
};

const tryResolveFalsyNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext
): TypeNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);
  const arrayTarget = extractArrayIsArrayTarget(unwrapped, ctx);
  if (arrayTarget) {
    const targetType = narrowTypeByArrayShape(
      ctx.typeSystem,
      getCurrentTypeForAccessPath(arrayTarget, ctx),
      false
    );
    if (targetType) {
      return makeTypeNarrowing(arrayTarget, targetType);
    }
  }

  const propertyAccess = extractIdentifierPropertyAccess(unwrapped, ctx);
  if (propertyAccess) {
    const currentType = getCurrentTypeForDecl(propertyAccess.declId, ctx);
    const targetType = narrowTypeByPropertyTruthiness(
      currentType,
      propertyAccess.propertyName,
      false,
      ctx
    );
    if (targetType) {
      return {
        kind: "decl",
        declId: propertyAccess.declId.id,
        targetType,
      };
    }
  }

  if (
    ts.isBinaryExpression(unwrapped) &&
    unwrapped.operatorToken.kind === ts.SyntaxKind.InKeyword
  ) {
    const propertyName = getStringLiteralText(unwrapped.left);
    const object = unwrapExpr(unwrapped.right);
    if (propertyName && ts.isIdentifier(object)) {
      const declId = ctx.binding.resolveIdentifier(object);
      if (declId) {
        const targetType = narrowTypeByPropertyPresence(
          getCurrentTypeForDecl(declId, ctx),
          propertyName,
          false,
          ctx
        );
        if (targetType) {
          return { kind: "decl", declId: declId.id, targetType };
        }
      }
    }
  }

  if (
    ts.isBinaryExpression(unwrapped) &&
    unwrapped.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword
  ) {
    const narrowedTarget = getAccessPathTarget(unwrapped.left, ctx);
    if (!narrowedTarget) return undefined;

    const targetType = resolveInstanceofTargetType(unwrapped.right, ctx);
    if (!targetType) return undefined;

    const narrowedType = narrowTypeByAssignableTarget(
      {
        collectNarrowingCandidates: (type) =>
          ctx.typeSystem.collectNarrowingCandidates(type),
        isAssignableTo: (source, target) =>
          ctx.typeSystem.matchesInstanceofTarget(source, target),
      },
      getCurrentTypeForAccessPath(narrowedTarget, ctx),
      targetType,
      false
    );
    if (!narrowedType) return undefined;

    return makeTypeNarrowing(narrowedTarget, narrowedType);
  }

  return undefined;
};

export const collectTypeNarrowingsInFalsyExpr = (
  expr: ts.Expression,
  ctx: ProgramContext
): readonly TypeNarrowing[] => {
  const unwrapped = unwrapExpr(expr);

  if (
    ts.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.operator === ts.SyntaxKind.ExclamationToken
  ) {
    return collectTypeNarrowingsInTruthyExpr(unwrapped.operand, ctx);
  }

  if (
    ts.isBinaryExpression(unwrapped) &&
    unwrapped.operatorToken.kind === ts.SyntaxKind.BarBarToken
  ) {
    return collectSequentialNarrowings(ctx, [
      (phaseCtx) => collectTypeNarrowingsInFalsyExpr(unwrapped.left, phaseCtx),
      (phaseCtx) => collectTypeNarrowingsInFalsyExpr(unwrapped.right, phaseCtx),
    ]);
  }

  const direct = tryResolveFalsyNarrowing(unwrapped, ctx);
  if (direct) return [direct];

  const predicateNarrowing = tryResolveCallPredicateNarrowing(
    unwrapped,
    ctx,
    false
  );
  if (predicateNarrowing) return [predicateNarrowing];

  const typeofNarrowing = tryResolveTypeofNarrowing(unwrapped, ctx, false);
  if (typeofNarrowing) return [typeofNarrowing];

  const equalityNarrowing = tryResolveEqualityLiteralNarrowing(
    unwrapped,
    ctx,
    false
  );
  if (equalityNarrowing) return [equalityNarrowing];

  return [];
};

const collectSequentialNarrowings = (
  ctx: ProgramContext,
  phases: readonly ((ctx: ProgramContext) => readonly TypeNarrowing[])[]
): readonly TypeNarrowing[] => {
  const combined: TypeNarrowing[] = [];
  let currentCtx = ctx;

  for (const collect of phases) {
    const next = collect(currentCtx);
    if (next.length === 0) {
      continue;
    }
    combined.push(...next);
    currentCtx = withAppliedNarrowings(currentCtx, next);
  }

  return combined;
};
