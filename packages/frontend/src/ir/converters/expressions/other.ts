/**
 * Miscellaneous expression converters (conditional, template literals)
 */

import { getTstsNodeText, TstsSyntax, type TstsNode } from "@tsonic/tsts";
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

const isEmptyArrayLiteral = (node: TstsNode): boolean =>
  node.Kind === TstsSyntax.KindArrayLiteralExpression &&
  (TstsSyntax.Node_Elements(node) ?? []).length === 0;

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
  node: TstsNode,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): IrConditionalExpression => {
  const conditional = TstsSyntax.AsConditionalExpression(node);
  const conditionNode = conditional?.Condition;
  const whenTrueNode = conditional?.WhenTrue;
  const whenFalseNode = conditional?.WhenFalse;
  if (!conditionNode || !whenTrueNode || !whenFalseNode) {
    throw new Error("ICE: malformed conditional expression reached IR conversion");
  }
  const condition = convertExpression(conditionNode, ctx, undefined);

  let whenTrue = convertExpression(whenTrueNode, ctx, expectedType);
  let whenFalse = convertExpression(whenFalseNode, ctx, expectedType);

  if (isEmptyArrayLiteral(whenTrueNode) && whenFalse.inferredType) {
    const siblingArrayType = normalizeExpectedArrayType(
      whenFalse.inferredType,
      ctx
    );
    if (siblingArrayType) {
      whenTrue = convertExpression(whenTrueNode, ctx, siblingArrayType);
    }
  }

  if (isEmptyArrayLiteral(whenFalseNode) && whenTrue.inferredType) {
    const siblingArrayType = normalizeExpectedArrayType(
      whenTrue.inferredType,
      ctx
    );
    if (siblingArrayType) {
      whenFalse = convertExpression(whenFalseNode, ctx, siblingArrayType);
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
  node: TstsNode,
  ctx: ProgramContext
): IrTemplateLiteralExpression => {
  // DETERMINISTIC: Template literals always produce string
  const stringType = {
    kind: "primitiveType" as const,
    name: "string" as const,
  };

  if (node.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral) {
    return {
      kind: "templateLiteral",
      quasis: [getTstsNodeText(node) ?? ""],
      expressions: [],
      inferredType: stringType,
      sourceSpan: getSourceSpan(node),
    };
  }

  const template = TstsSyntax.AsTemplateExpression(node);
  const quasis: string[] = [getTstsNodeText(template?.Head) ?? ""];
  const expressions: IrExpression[] = [];

  for (const spanNode of template?.TemplateSpans?.Nodes ?? []) {
    const span = spanNode ? TstsSyntax.AsTemplateSpan(spanNode) : undefined;
    if (!span?.Expression) continue;
    expressions.push(convertExpression(span.Expression, ctx, undefined));
    quasis.push(getTstsNodeText(span.Literal) ?? "");
  }

  return {
    kind: "templateLiteral",
    quasis,
    expressions,
    inferredType: stringType,
    sourceSpan: getSourceSpan(node),
  };
};
