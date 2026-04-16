/**
 * Discriminant equality and property truthiness guard detectors.
 * Handles tryResolveDiscriminantEqualityGuard and tryResolvePropertyTruthinessGuard.
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { emitRemappedLocalName } from "../../../core/format/local-names.js";
import { makeNarrowedLocalName } from "../../../core/semantic/narrowing-keys.js";
import { tryGetLiteralSet } from "../../../core/semantic/guard-primitives.js";
import type {
  DiscriminantEqualityGuardInfo,
  PropertyTruthinessGuardInfo,
} from "./guard-types.js";
import {
  getGuardPropertyType,
  extractTransparentMemberAccessTarget,
  resolveGuardRuntimeUnionFrame,
  stripGlobalPrefix,
  buildRenameNarrowedMap,
  isDefinitelyTruthyLiteral,
  isDefinitelyFalsyType,
  isDefinitelyTruthyType,
} from "./guard-types.js";

/**
 * Try to extract guard info from `x.prop === <literal>` or `x.prop !== <literal>`.
 *
 * This supports airplane-grade discriminated union narrowing without relying on
 * TypeScript flow analysis, by mapping the literal to exactly one union member.
 */
export const tryResolveDiscriminantEqualityGuard = (
  condition: IrExpression,
  context: EmitterContext
): DiscriminantEqualityGuardInfo | undefined => {
  // Normalize `!(x.prop === lit)` to `x.prop !== lit` (and vice versa).
  if (condition.kind === "unary" && condition.operator === "!") {
    const inner = tryResolveDiscriminantEqualityGuard(
      condition.expression,
      context
    );
    if (!inner) return undefined;

    const flipped =
      inner.operator === "==="
        ? "!=="
        : inner.operator === "!=="
          ? "==="
          : inner.operator === "=="
            ? "!="
            : inner.operator === "!="
              ? "=="
              : inner.operator;

    return { ...inner, operator: flipped as typeof inner.operator };
  }

  if (condition.kind !== "binary") return undefined;
  if (
    condition.operator !== "===" &&
    condition.operator !== "!==" &&
    condition.operator !== "==" &&
    condition.operator !== "!="
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
    const target = extractTransparentMemberAccessTarget(left);
    if (!target) return undefined;
    if (right.kind !== "literal") return undefined;
    if (
      typeof right.value !== "string" &&
      typeof right.value !== "number" &&
      typeof right.value !== "boolean"
    ) {
      return undefined;
    }

    return {
      receiver: target.receiver,
      propertyName: target.access.property,
      literal: right.value,
    };
  };

  const direct = extract(condition.left, condition.right);
  const swapped = direct ? undefined : extract(condition.right, condition.left);
  const match = direct ?? swapped;
  if (!match) return undefined;

  const { receiver, propertyName, literal } = match;
  const originalName = receiver.name;

  const unionSourceType = receiver.inferredType;
  if (!unionSourceType) return undefined;

  const frame = resolveGuardRuntimeUnionFrame(
    originalName,
    unionSourceType,
    receiver,
    context
  );
  if (!frame) return undefined;

  const { members, candidateMemberNs, runtimeUnionArity } = frame;
  const unionArity = members.length;
  if (unionArity < 2) return undefined;

  // Find which union members have a discriminant property type that includes the literal.
  const matchingIndices: number[] = [];
  const matchingMemberNs: number[] = [];

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (!member) continue;

    const propType = getGuardPropertyType(member, propertyName, context);
    if (!propType) continue;

    const literals = tryGetLiteralSet(propType, context);
    if (!literals) continue;

    if (literals.has(literal)) {
      matchingIndices.push(i);
      matchingMemberNs.push(candidateMemberNs[i] ?? i + 1);
    }
  }

  // Only support the common airplane-grade case: exactly one matching member.
  if (matchingMemberNs.length !== 1) return undefined;

  const memberN = matchingMemberNs[0];
  if (!memberN) return undefined;
  const matchingIndex = matchingIndices[0];
  if (matchingIndex === undefined) return undefined;

  const nextId = (context.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };

  const narrowedName = makeNarrowedLocalName(originalName, memberN, nextId);
  const escapedOrig = emitRemappedLocalName(originalName, context);
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);
  const memberType = members[matchingIndex];
  if (!memberType) return undefined;
  const narrowedMap = buildRenameNarrowedMap(
    originalName,
    narrowedName,
    memberType,
    unionSourceType,
    ctxWithId
  );

  return {
    originalName,
    propertyName,
    literal,
    operator: condition.operator,
    memberN,
    unionArity,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers: members,
    ctxWithId,
    narrowedName,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
  };
};

/**
 * Try to extract guard info from `x.prop` / `!x.prop` where the property acts as a
 * boolean-style discriminant over a runtime union.
 */
export const tryResolvePropertyTruthinessGuard = (
  condition: IrExpression,
  context: EmitterContext
): PropertyTruthinessGuardInfo | undefined => {
  const extract = (
    expr: IrExpression
  ):
    | {
        readonly receiver: Extract<IrExpression, { kind: "identifier" }>;
        readonly propertyName: string;
        readonly wantTruthy: boolean;
        readonly bindingType: string | undefined;
        readonly bindingValueTruthiness: boolean | undefined;
      }
    | undefined => {
    if (expr.kind === "unary" && expr.operator === "!") {
      const inner = extract(expr.expression);
      return inner ? { ...inner, wantTruthy: !inner.wantTruthy } : undefined;
    }

    const target = extractTransparentMemberAccessTarget(expr);
    if (!target) return undefined;

    return {
      receiver: target.receiver,
      propertyName: target.access.property,
      wantTruthy: true,
      bindingType: target.access.memberBinding?.type,
      bindingValueTruthiness:
        target.access.inferredType?.kind === "literalType"
          ? isDefinitelyTruthyLiteral(target.access.inferredType.value)
          : target.access.inferredType?.kind === "primitiveType" &&
              (target.access.inferredType.name === "undefined" ||
                target.access.inferredType.name === "null")
            ? false
            : undefined,
    };
  };

  const match = extract(condition);
  if (!match) return undefined;

  const {
    receiver,
    propertyName,
    wantTruthy,
    bindingType,
    bindingValueTruthiness,
  } = match;
  const originalName = receiver.name;

  const unionSourceType = receiver.inferredType;
  if (!unionSourceType) return undefined;

  const frame = resolveGuardRuntimeUnionFrame(
    originalName,
    unionSourceType,
    receiver,
    context
  );
  if (!frame) return undefined;

  const { members, candidateMemberNs, runtimeUnionArity } = frame;
  const unionArity = members.length;
  if (unionArity < 2) return undefined;

  const matchingIndices: number[] = [];
  const matchingMemberNs: number[] = [];

  if (bindingType && bindingValueTruthiness !== undefined) {
    const bindingTypeName = stripGlobalPrefix(bindingType);
    const boundMemberIndex = members.findIndex((member) => {
      if (member?.kind !== "referenceType") return false;
      const candidateClr = member.resolvedClrType
        ? stripGlobalPrefix(member.resolvedClrType)
        : undefined;
      return (
        candidateClr === bindingTypeName || member.name === bindingTypeName
      );
    });

    if (boundMemberIndex >= 0) {
      if (wantTruthy === bindingValueTruthiness) {
        matchingIndices.push(boundMemberIndex);
        matchingMemberNs.push(
          candidateMemberNs[boundMemberIndex] ?? boundMemberIndex + 1
        );
      } else if (unionArity === 2) {
        const otherIndex = boundMemberIndex === 0 ? 1 : 0;
        matchingIndices.push(otherIndex);
        matchingMemberNs.push(candidateMemberNs[otherIndex] ?? otherIndex + 1);
      }
    }
  }

  if (matchingMemberNs.length === 0) {
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (!member) continue;

      const propType = getGuardPropertyType(member, propertyName, context);
      if (!propType) continue;

      const matches = wantTruthy
        ? isDefinitelyTruthyType(propType, context)
        : isDefinitelyFalsyType(propType, context);
      if (matches) {
        matchingIndices.push(i);
        matchingMemberNs.push(candidateMemberNs[i] ?? i + 1);
      }
    }
  }

  if (matchingMemberNs.length !== 1) return undefined;

  const memberN = matchingMemberNs[0];
  if (!memberN) return undefined;
  const matchingIndex = matchingIndices[0];
  if (matchingIndex === undefined) return undefined;

  const nextId = (context.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
  const narrowedName = makeNarrowedLocalName(originalName, memberN, nextId);
  const escapedOrig = emitRemappedLocalName(originalName, context);
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);
  const memberType = members[matchingIndex];
  if (!memberType) return undefined;
  const narrowedMap = buildRenameNarrowedMap(
    originalName,
    narrowedName,
    memberType,
    unionSourceType,
    ctxWithId
  );

  return {
    originalName,
    propertyName,
    memberN,
    unionArity,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers: members,
    ctxWithId,
    narrowedName,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
  };
};
