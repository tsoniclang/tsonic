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
import { resolveIteratorResultReferenceType } from "./structural-resolution.js";
import {
  getCanonicalRuntimeUnionMembers,
  findRuntimeUnionMemberIndices,
  type EmitTypeAstLike,
} from "./runtime-unions.js";
import {
  getSemanticUnionMembers,
  findSemanticUnionMemberIndex,
} from "./semantic-union-members.js";
import { resolveNarrowedUnionMembers } from "./narrowed-union-resolution.js";
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
  readonly narrowedType: IrType;
  readonly sourceType: IrType;
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

  // Two-phase guard detection:
  // 1. Semantic gate — use alias-preserving member discovery to confirm
  //    this is a union and find which semantic member the predicate targets.
  //    This works regardless of whether moduleMap/typeAliasIndex expands aliases.
  const semanticMembers = getSemanticUnionMembers(unionSourceType, context);
  if (!semanticMembers) return undefined;

  const semanticIdx = findSemanticUnionMemberIndex(
    semanticMembers,
    narrowing.targetType,
    context
  );
  if (semanticIdx === undefined) return undefined;

  // 2. Runtime member index — the emitted code uses .IsN()/.AsN() which
  //    reference runtime carrier slot numbers. The runtime carrier may have
  //    different member numbering if aliases are expanded. Use the runtime
  //    member list to find the correct slot index for the matched semantic member.
  const runtimeMembers = getCanonicalRuntimeUnionMembers(
    unionSourceType,
    context
  );
  if (!runtimeMembers) return undefined;

  const runtimeIndices = findRuntimeUnionMemberIndices(
    runtimeMembers,
    narrowing.targetType,
    context
  );
  if (runtimeIndices.length !== 1) return undefined;
  const runtimeIdx = runtimeIndices[0];
  if (runtimeIdx === undefined) return undefined;
  const narrowedType = runtimeMembers[runtimeIdx];
  if (!narrowedType) return undefined;

  return {
    originalName,
    memberN: runtimeIdx + 1,
    narrowedType,
    sourceType: unionSourceType,
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
  _emitTypeAst: EmitTypeAstLike
): TernaryGuardInfo | undefined => {
  // Normalize `!(x.prop === lit)` to `x.prop !== lit` (and vice versa) by flipping polarity.
  if (expr.kind === "unary" && expr.operator === "!") {
    const inner = tryResolveTernaryDiscriminantEqualityGuard(
      expr.expression,
      context,
      _emitTypeAst
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

  if (resolveIteratorResultReferenceType(unionSourceType, context)) {
    return undefined;
  }

  const narrowedMembers = resolveNarrowedUnionMembers(
    originalName,
    unionSourceType,
    context,
  );
  if (!narrowedMembers) return undefined;

  const { members, candidateMemberNs } = narrowedMembers;
  const unionArity = members.length;
  if (unionArity < 2) return undefined;

  const matchingMembers: { readonly memberN: number; readonly type: IrType }[] =
    [];

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
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
      matchingMembers.push({
        memberN: candidateMemberNs[i] ?? i + 1,
        type: member,
      });
    }
  }

  if (matchingMembers.length !== 1) return undefined;
  const narrowedMatch = matchingMembers[0];
  if (!narrowedMatch) return undefined;

  const isInequality = expr.operator === "!==" || expr.operator === "!=";

  return {
    originalName,
    memberN: narrowedMatch.memberN,
    narrowedType: narrowedMatch.type,
    sourceType: unionSourceType,
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
