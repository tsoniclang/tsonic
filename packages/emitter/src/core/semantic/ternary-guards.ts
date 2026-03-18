/**
 * Ternary (conditional expression) guard detection helpers.
 *
 * Pure detection module — extracts TernaryGuardInfo from condition expressions
 * for use by the conditional-emitter. Lives in core/semantic to avoid a module
 * cycle between expressions/ and statements/control/.
 *
 * The ternary guard path differs from the if-statement guard path in two ways:
 * - Uses `findRuntimeUnionMemberIndices` (semantic matching) instead of
 *   `findExactRuntimeUnionMemberIndices` (strict key matching).
 * - Uses `buildRuntimeUnionLayout` (not `resolveRuntimeUnionFrame`) for
 *   discriminant equality detection.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { getPropertyType } from "./type-resolution.js";
import { emitRemappedLocalName } from "../format/local-names.js";
import {
  buildRuntimeUnionFrame,
  buildRuntimeUnionLayout,
  findRuntimeUnionMemberIndices,
  type EmitTypeAstLike,
} from "./runtime-unions.js";
import { isSemanticUnion } from "./union-semantics.js";
import {
  resolveLocalTypesForReference,
  tryGetLiteralSet,
} from "./guard-primitives.js";

/**
 * Information extracted from a ternary condition guard.
 * Used to generate inline Union.IsN()/AsN() narrowing in conditional expressions.
 *
 * Unlike statement-level GuardInfo (which produces `var __narrowed = x.AsN()`),
 * TernaryGuardInfo uses inline narrowedBindings (`x → (x.AsN())`).
 */
export type TernaryGuardInfo = {
  readonly originalName: string;
  readonly memberN: number;
  readonly escapedOrig: string;
  readonly polarity: "positive" | "negative"; // positive = narrow whenTrue, negative = narrow whenFalse
};

/**
 * Try to extract ternary guard info from a type predicate call expression.
 *
 * Note: Uses `findRuntimeUnionMemberIndices` (semantic matching) rather than
 * `findExactRuntimeUnionMemberIndices` (strict key matching) used by the
 * if-statement predicate guard, because ternary inline narrowing needs the
 * looser matching semantics.
 */
const tryResolveTernaryPredicateGuard = (
  call: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): TernaryGuardInfo | undefined => {
  const narrowing = call.narrowing;
  if (!narrowing || narrowing.kind !== "typePredicate") return undefined;

  const arg = call.arguments[narrowing.argIndex];
  if (
    !arg ||
    ("kind" in arg && arg.kind === "spread") ||
    arg.kind !== "identifier"
  ) {
    return undefined;
  }

  const originalName = arg.name;
  const unionSourceType = arg.inferredType;
  if (!unionSourceType) return undefined;

  // Semantic gate: confirm this is a union before constructing runtime frame
  if (!isSemanticUnion(unionSourceType, context)) return undefined;

  const runtimeFrame = buildRuntimeUnionFrame(unionSourceType, context);
  if (!runtimeFrame) return undefined;

  const matchingIndices = findRuntimeUnionMemberIndices(
    runtimeFrame.members,
    narrowing.targetType,
    context
  );
  if (matchingIndices.length !== 1) return undefined;
  const idx = matchingIndices[0];
  if (idx === undefined) return undefined;

  return {
    originalName,
    memberN: idx + 1,
    escapedOrig: emitRemappedLocalName(originalName, context),
    polarity: "positive",
  };
};

/**
 * Try to extract ternary guard info from a discriminant literal equality check.
 *
 * Note: Uses `buildRuntimeUnionLayout` (not `resolveRuntimeUnionFrame`) and
 * does its own property type resolution, preserving the original ternary
 * emission strategy which differs from the if-statement path.
 *
 * Accepts `emitTypeAst` as a callback to avoid importing from the root
 * type-emitter module (which would create a layer violation).
 */
const tryResolveTernaryDiscriminantEqualityGuard = (
  expr: IrExpression,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): TernaryGuardInfo | undefined => {
  // Normalize `!(x.prop === lit)` to `x.prop !== lit` (and vice versa) by flipping polarity.
  if (expr.kind === "unary" && expr.operator === "!") {
    const inner = tryResolveTernaryDiscriminantEqualityGuard(
      expr.expression,
      context,
      emitTypeAst
    );
    if (!inner) return undefined;
    return {
      ...inner,
      polarity: inner.polarity === "positive" ? "negative" : "positive",
    };
  }

  if (expr.kind !== "binary") return undefined;
  if (
    expr.operator !== "===" &&
    expr.operator !== "!==" &&
    expr.operator !== "==" &&
    expr.operator !== "!="
  ) {
    return undefined;
  }

  const extract = (
    left: IrExpression,
    right: IrExpression
  ):
    | {
        readonly receiver: Extract<IrExpression, { kind: "identifier" }>;
        readonly propertyName: string;
        readonly literal: string | number | boolean;
      }
    | undefined => {
    if (left.kind !== "memberAccess") return undefined;
    if (left.isOptional) return undefined;
    if (left.isComputed) return undefined;
    if (left.object.kind !== "identifier") return undefined;
    if (typeof left.property !== "string") return undefined;
    if (right.kind !== "literal") return undefined;
    if (
      typeof right.value !== "string" &&
      typeof right.value !== "number" &&
      typeof right.value !== "boolean"
    ) {
      return undefined;
    }
    return {
      receiver: left.object,
      propertyName: left.property,
      literal: right.value,
    };
  };

  const direct = extract(expr.left, expr.right);
  const swapped = direct ? undefined : extract(expr.right, expr.left);
  const match = direct ?? swapped;
  if (!match) return undefined;

  const { receiver, propertyName, literal } = match;
  const originalName = receiver.name;

  if (context.narrowedBindings?.has(originalName)) return undefined;

  const unionSourceType = receiver.inferredType;
  if (!unionSourceType) return undefined;

  // Semantic gate: confirm this is a union before constructing runtime layout
  if (!isSemanticUnion(unionSourceType, context)) return undefined;

  const [runtimeLayout] = buildRuntimeUnionLayout(
    unionSourceType,
    context,
    emitTypeAst
  );
  if (!runtimeLayout) return undefined;

  const unionArity = runtimeLayout.members.length;
  if (unionArity < 2 || unionArity > 8) return undefined;

  const matchingMembers: number[] = [];

  for (let i = 0; i < runtimeLayout.members.length; i++) {
    const member = runtimeLayout.members[i];
    if (!member) continue;

    let propType: IrType | undefined;

    if (member.kind === "objectType") {
      const prop = member.members.find(
        (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
          m.kind === "propertySignature" && m.name === propertyName
      );
      propType = prop?.type;
    } else if (member.kind === "referenceType") {
      const localTypes = resolveLocalTypesForReference(member, context);
      if (!localTypes) continue;

      const lookupName = member.name.includes(".")
        ? (member.name.split(".").pop() ?? member.name)
        : member.name;

      propType = getPropertyType(
        { ...member, name: lookupName },
        propertyName,
        { ...context, localTypes }
      );
    } else {
      continue;
    }

    if (!propType) continue;

    const literals = tryGetLiteralSet(propType, context);
    if (!literals) continue;
    if (literals.has(literal)) {
      matchingMembers.push(i + 1);
    }
  }

  if (matchingMembers.length !== 1) return undefined;
  const memberN = matchingMembers[0];
  if (!memberN) return undefined;

  const isInequality = expr.operator === "!==" || expr.operator === "!=";

  return {
    originalName,
    memberN,
    escapedOrig: emitRemappedLocalName(originalName, context),
    polarity: isInequality ? "negative" : "positive",
  };
};

/**
 * Try to extract ternary guard info from a condition expression.
 * Handles type predicate calls (`isUser(x)`), negated calls (`!isUser(x)`),
 * and discriminant literal equality (`x.kind === "circle"`).
 * Returns guard info with polarity indicating which branch to narrow.
 *
 * Accepts `emitTypeAst` as a callback (threaded to discriminant equality
 * detection via `buildRuntimeUnionLayout`) to keep this module free of
 * upward imports into the root emitter layer.
 */
export const tryResolveTernaryGuard = (
  condition: IrExpression,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): TernaryGuardInfo | undefined => {
  // Direct call: isUser(x) -> narrow whenTrue
  if (condition.kind === "call") {
    return tryResolveTernaryPredicateGuard(condition, context);
  }

  // Discriminant literal equality: x.kind === "circle"
  const discr = tryResolveTernaryDiscriminantEqualityGuard(
    condition,
    context,
    emitTypeAst
  );
  if (discr) return discr;

  // Negated call: !isUser(x) -> narrow whenFalse
  if (
    condition.kind === "unary" &&
    condition.operator === "!" &&
    condition.expression.kind === "call"
  ) {
    const guard = tryResolveTernaryPredicateGuard(
      condition.expression,
      context
    );
    if (guard) {
      return { ...guard, polarity: "negative" };
    }
  }

  return undefined;
};
