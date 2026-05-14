/**
 * Miscellaneous expression converters (conditional, template literals)
 */

import * as ts from "typescript";
import {
  IrConditionalExpression,
  IrTemplateLiteralExpression,
  IrExpression,
  IrType,
} from "../../types.js";
import { irTypesEqual, normalizedUnionType } from "../../types/type-ops.js";
import { getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import type { ProgramContext } from "../../program-context.js";
import { normalizeExpectedArrayType } from "./array-literals.js";
import {
  collectTypeNarrowingsInFalsyExpr,
  collectTypeNarrowingsInTruthyExpr,
  withAppliedNarrowings,
} from "../flow-narrowing.js";

const isEmptyArrayLiteral = (node: ts.Expression): boolean =>
  ts.isArrayLiteralExpression(node) && node.elements.length === 0;

/**
 * Convert conditional (ternary) expression
 *
 * DETERMINISTIC TYPING:
 * - Threads expectedType to both branches for consistent typing
 * - Result type stays as precise as the branches prove, even in contextual positions
 * Example: `new Uint8Array(flag ? 1 : size)` keeps the conditional as `int`,
 *   not `TypedArrayConstructorInput<byte>`, so later runtime-carrier selection
 *   still sees the numeric slot deterministically
 */
export const convertConditionalExpression = (
  node: ts.ConditionalExpression,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): IrConditionalExpression => {
  const condition = convertExpression(node.condition, ctx, undefined);
  const truthyCtx = withAppliedNarrowings(
    ctx,
    collectTypeNarrowingsInTruthyExpr(node.condition, ctx)
  );
  const falsyCtx = withAppliedNarrowings(
    ctx,
    collectTypeNarrowingsInFalsyExpr(node.condition, ctx)
  );

  let whenTrue = convertExpression(node.whenTrue, truthyCtx, expectedType);
  let whenFalse = convertExpression(node.whenFalse, falsyCtx, expectedType);

  if (isEmptyArrayLiteral(node.whenTrue) && whenFalse.inferredType) {
    const siblingArrayType = normalizeExpectedArrayType(
      whenFalse.inferredType,
      ctx
    );
    if (siblingArrayType) {
      whenTrue = convertExpression(node.whenTrue, truthyCtx, siblingArrayType);
    }
  }

  if (isEmptyArrayLiteral(node.whenFalse) && whenTrue.inferredType) {
    const siblingArrayType = normalizeExpectedArrayType(
      whenTrue.inferredType,
      ctx
    );
    if (siblingArrayType) {
      whenFalse = convertExpression(node.whenFalse, falsyCtx, siblingArrayType);
    }
  }

  // DETERMINISTIC:
  // - expectedType is a contextual contract for branch conversion, not a mandate
  //   to widen the conditional's own inferred type
  // - infer from both branches, then only fall back to expectedType when the
  //   branches genuinely need that broader/common surface
  const inferredType = (() => {
    const t = whenTrue.inferredType;
    const f = whenFalse.inferredType;

    if (!t) return f;
    if (!f) return t;

    if (irTypesEqual(t, f)) return t;
    if (
      ctx.typeSystem.isAssignableTo(t, f) &&
      ctx.typeSystem.isAssignableTo(f, t)
    ) {
      return t;
    }

    if (ctx.typeSystem.isAssignableTo(t, f)) {
      return f;
    }

    if (ctx.typeSystem.isAssignableTo(f, t)) {
      return t;
    }

    const branchUnion = normalizedUnionType([t, f]);
    if (!expectedType) {
      return branchUnion;
    }

    if (
      ctx.typeSystem.isAssignableTo(branchUnion, expectedType) &&
      !ctx.typeSystem.isAssignableTo(expectedType, branchUnion)
    ) {
      return expectedType;
    }

    return branchUnion;
  })();

  return {
    kind: "conditional",
    condition,
    whenTrue,
    whenFalse,
    inferredType,
    sourceSpan: getSourceSpan(node),
  };
};

/**
 * Convert template literal expression
 *
 * DETERMINISTIC TYPING: Template literals always produce string type.
 */
export const convertTemplateLiteral = (
  node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral,
  ctx: ProgramContext
): IrTemplateLiteralExpression => {
  // DETERMINISTIC: Template literals always produce string
  const stringType = {
    kind: "primitiveType" as const,
    name: "string" as const,
  };

  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return {
      kind: "templateLiteral",
      quasis: [node.text],
      expressions: [],
      inferredType: stringType,
      sourceSpan: getSourceSpan(node),
    };
  }

  const quasis: string[] = [node.head.text];
  const expressions: IrExpression[] = [];

  node.templateSpans.forEach((span) => {
    expressions.push(convertExpression(span.expression, ctx, undefined));
    quasis.push(span.literal.text);
  });

  return {
    kind: "templateLiteral",
    quasis,
    expressions,
    inferredType: stringType,
    sourceSpan: getSourceSpan(node),
  };
};
