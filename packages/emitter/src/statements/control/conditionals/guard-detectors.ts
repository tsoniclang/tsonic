/**
 * Guard detection and resolution functions for conditional statements.
 *
 * Contains the tryResolve* functions that detect specific guard patterns
 * in if-statement conditions and extract structured guard info for emission:
 * - tryResolveDiscriminantEqualityGuard (x.kind === "circle")
 * - tryResolvePropertyTruthinessGuard (x.prop / !x.prop)
 * - tryResolveInGuard ("prop" in x)
 * - tryResolvePredicateGuard (isUser(x))
 * - tryResolveInstanceofGuard (x instanceof Foo)
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitIdentifier } from "../../../expressions/identifiers.js";
import { emitTypeAst } from "../../../type-emitter.js";
import type { CSharpTypeAst } from "../../../core/format/backend-ast/types.js";
import { hasDeterministicPropertyMembership } from "../../../core/semantic/type-resolution.js";
import { matchesExpectedEmissionType } from "../../../core/semantic/expected-type-matching.js";
import {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
} from "../../../core/semantic/runtime-unions.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { emitRemappedLocalName } from "../../../core/format/local-names.js";
import {
  getMemberAccessNarrowKey,
  makeNarrowedLocalName,
} from "../../../core/semantic/narrowing-keys.js";
import { normalizeInstanceofTargetType } from "../../../core/semantic/instanceof-targets.js";
import { unwrapTransparentNarrowingTarget } from "../../../core/semantic/transparent-expressions.js";
import { tryGetLiteralSet } from "../../../core/semantic/guard-primitives.js";
import type {
  GuardInfo,
  InstanceofGuardInfo,
  InGuardInfo,
  DiscriminantEqualityGuardInfo,
  PropertyTruthinessGuardInfo,
} from "./guard-types.js";
import {
  getGuardPropertyType,
  extractTransparentIdentifierTarget,
  extractTransparentMemberAccessTarget,
  resolveRuntimeUnionFrame,
  stripGlobalPrefix,
  buildRenameNarrowedMap,
  withoutNarrowedBinding,
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

  const frame = resolveRuntimeUnionFrame(
    originalName,
    unionSourceType,
    context
  );
  if (!frame) return undefined;

  const { members, candidateMemberNs, runtimeUnionArity } = frame;
  const unionArity = members.length;
  if (unionArity < 2 || unionArity > 8) return undefined;

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

  const frame = resolveRuntimeUnionFrame(
    originalName,
    unionSourceType,
    context
  );
  if (!frame) return undefined;

  const { members, candidateMemberNs, runtimeUnionArity } = frame;
  const unionArity = members.length;
  if (unionArity < 2 || unionArity > 8) return undefined;

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

/**
 * Try to extract guard info from an `("prop" in x)` binary expression.
 */
export const tryResolveInGuard = (
  condition: IrExpression,
  context: EmitterContext
): InGuardInfo | undefined => {
  if (condition.kind !== "binary") return undefined;
  if (condition.operator !== "in") return undefined;

  // LHS must be a string literal
  if (condition.left.kind !== "literal") return undefined;
  if (typeof condition.left.value !== "string") return undefined;

  // RHS must be a bindable identifier, even if transparent assertion wrappers
  // were introduced around it during earlier contextual typing/narrowing passes.
  const target = extractTransparentIdentifierTarget(condition.right);
  if (!target) return undefined;

  const propertyName = condition.left.value;
  const originalName = target.name;

  const unionSourceType = target.inferredType ?? condition.right.inferredType;
  if (!unionSourceType) return undefined;

  const frame = resolveRuntimeUnionFrame(
    originalName,
    unionSourceType,
    context
  );
  if (!frame) return undefined;

  const { members, candidateMemberNs, runtimeUnionArity } = frame;
  const unionArity = members.length;
  if (unionArity < 2 || unionArity > 8) return undefined;

  // Find which union members contain the property.
  const matchingIndices: number[] = [];
  const matchingMemberNs: number[] = [];
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (!member || member.kind !== "referenceType") continue;
    if (
      hasDeterministicPropertyMembership(member, propertyName, context) === true
    ) {
      matchingIndices.push(i);
      matchingMemberNs.push(candidateMemberNs[i] ?? i + 1);
    }
  }

  // Only support the common "exactly one matching member" narrowing case.
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

/**
 * Try to extract guard info from a predicate call expression.
 * Returns GuardInfo if:
 * - call.narrowing is typePredicate
 * - predicate arg is identifier
 * - arg.inferredType resolves to unionType
 * - targetType exists in union
 */
export const tryResolvePredicateGuard = (
  call: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): GuardInfo | undefined => {
  const narrowing = call.narrowing;
  if (!narrowing || narrowing.kind !== "typePredicate") return undefined;

  const arg = call.arguments[narrowing.argIndex];
  if (!arg || ("kind" in arg && arg.kind === "spread")) {
    return undefined;
  }

  const target = unwrapTransparentNarrowingTarget(arg);
  if (!target) return undefined;

  const originalName =
    target.kind === "identifier"
      ? target.name
      : getMemberAccessNarrowKey(target);
  if (!originalName) return undefined;
  const unionSourceType = target.inferredType ?? arg.inferredType;
  if (!unionSourceType) return undefined;

  const frame = resolveRuntimeUnionFrame(
    originalName,
    unionSourceType,
    context
  );
  if (!frame) return undefined;

  const matchingIndices = findExactRuntimeUnionMemberIndices(
    frame.members,
    narrowing.targetType,
    context
  );
  if (matchingIndices.length !== 1) return undefined;
  const idx = matchingIndices[0];
  if (idx === undefined) return undefined;

  const memberN = frame.candidateMemberNs[idx] ?? idx + 1;
  const unionArity = frame.members.length;

  const nextId = (context.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };

  const narrowedName = makeNarrowedLocalName(originalName, memberN, nextId);
  const currentSubsetBinding = context.narrowedBindings?.get(originalName);
  const rawContext = currentSubsetBinding
    ? withoutNarrowedBinding(context, originalName)
    : context;
  const rawReceiverType =
    target.kind === "identifier"
      ? (rawContext.localSemanticTypes?.get(target.name) ??
        target.inferredType ??
        arg.inferredType)
      : (target.inferredType ?? arg.inferredType);
  const rawReceiverExpectedType =
    currentSubsetBinding?.sourceType ??
    (currentSubsetBinding?.kind === "runtimeSubset"
      ? (currentSubsetBinding.type ?? unionSourceType)
      : undefined) ??
    unionSourceType;
  const useRawReceiverAst =
    currentSubsetBinding?.kind === "runtimeSubset" &&
    !!rawReceiverType &&
    matchesExpectedEmissionType(
      rawReceiverType,
      rawReceiverExpectedType,
      rawContext
    );
  const [argAst] = useRawReceiverAst
    ? target.kind === "identifier"
      ? emitIdentifier(target, rawContext)
      : emitExpressionAst(target, rawContext)
    : emitExpressionAst(arg, context);
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);
  const narrowedMap = buildRenameNarrowedMap(
    originalName,
    narrowedName,
    narrowing.targetType,
    ctxWithId
  );

  return {
    originalName,
    receiverAst: argAst,
    targetType: narrowing.targetType,
    memberN,
    unionArity,
    runtimeUnionArity: frame.runtimeUnionArity,
    candidateMemberNs: frame.candidateMemberNs,
    candidateMembers: frame.members,
    ctxWithId,
    narrowedName,
    escapedNarrow,
    narrowedMap,
  };
};

/**
 * Try to extract guard info from an `instanceof` binary expression.
 * Returns guard info if:
 * - condition is `binary` with operator `instanceof`
 * - lhs is identifier
 *
 * Note: rhs is emitted as a type name (C# pattern).
 */
export const tryResolveInstanceofGuard = (
  condition: IrExpression,
  context: EmitterContext
): InstanceofGuardInfo | undefined => {
  if (condition.kind !== "binary") return undefined;
  if (condition.operator !== "instanceof") return undefined;

  const target = unwrapTransparentNarrowingTarget(condition.left);
  if (!target) return undefined;

  const originalName =
    target.kind === "identifier"
      ? target.name
      : getMemberAccessNarrowKey(target);
  if (!originalName) return undefined;

  const [lhsAst, ctxAfterLhs] =
    target.kind === "identifier"
      ? emitIdentifier(target, context)
      : emitExpressionAst(target, context);
  const escapedOrig =
    target.kind === "identifier"
      ? emitRemappedLocalName(originalName, context)
      : originalName;

  const nextId = (ctxAfterLhs.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...ctxAfterLhs, tempVarId: nextId };

  const [rhsAst, rhsCtxAfterExpr] = emitExpressionAst(
    condition.right,
    ctxWithId
  );

  const inferredRhsType = normalizeInstanceofTargetType(
    condition.right.inferredType
  );
  let rhsTypeAst: CSharpTypeAst | undefined;
  let ctxAfterRhs = rhsCtxAfterExpr;

  if (rhsAst.kind === "typeReferenceExpression") {
    rhsTypeAst = rhsAst.type;
  } else if (inferredRhsType) {
    const [emittedTypeAst, nextCtx] = emitTypeAst(
      inferredRhsType,
      rhsCtxAfterExpr
    );
    rhsTypeAst = emittedTypeAst;
    ctxAfterRhs = nextCtx;
  }

  if (!rhsTypeAst) {
    return undefined;
  }

  // Pattern variable name for the narrowed value.
  const narrowedName = makeNarrowedLocalName(originalName, "is", nextId);
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);

  const narrowedMap = new Map(ctxAfterRhs.narrowedBindings ?? []);
  narrowedMap.set(originalName, {
    kind: "rename",
    name: narrowedName,
    type: inferredRhsType ?? undefined,
  });

  const unionSourceType = target.inferredType ?? condition.left.inferredType;
  const currentType =
    context.narrowedBindings?.get(originalName)?.type ?? unionSourceType;
  const runtimeUnionFrame =
    currentType && inferredRhsType
      ? resolveRuntimeUnionFrame(originalName, currentType, context)
      : undefined;
  const runtimeMatchIndices =
    runtimeUnionFrame && inferredRhsType
      ? findRuntimeUnionInstanceofMemberIndices(
          runtimeUnionFrame.members,
          inferredRhsType,
          context
        )
      : undefined;
  const runtimeMatchIndex = runtimeMatchIndices?.[0];
  const memberN =
    runtimeUnionFrame && runtimeMatchIndex !== undefined
      ? (runtimeUnionFrame.candidateMemberNs[runtimeMatchIndex] ??
        runtimeMatchIndex + 1)
      : undefined;
  const receiverAst =
    runtimeUnionFrame && target.kind === "identifier"
      ? {
          kind: "identifierExpression" as const,
          identifier: escapedOrig,
        }
      : lhsAst;

  return {
    originalName,
    receiverAst,
    rhsTypeAst,
    ctxWithId,
    ctxAfterRhs,
    narrowedName,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
    targetType: inferredRhsType ?? undefined,
    memberN,
    runtimeUnionArity: runtimeUnionFrame?.runtimeUnionArity,
    candidateMemberNs: runtimeUnionFrame?.candidateMemberNs,
    candidateMembers: runtimeUnionFrame?.members,
  };
};
