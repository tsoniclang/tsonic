/**
 * Flow narrowing collection & application (frontend).
 *
 * Orchestrates truthy/falsy narrowing resolution, sequential narrowing
 * collection across && / || chains, and environment application helpers.
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import { normalizedUnionType } from "../types/type-ops.js";
import { narrowTypeByArrayShape } from "./array-type-guards.js";
import { narrowTypeByAssignableTarget } from "./reference-type-guards.js";
import {
  getAccessPathKey,
  getAccessPathTarget,
  getCurrentTypeForAccessPath,
  type AccessPathTarget,
} from "./access-paths.js";
import {
  type BoundDecl,
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

const tryResolveTruthyNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext
): TypeNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);

  const getCurrentType = (declId: BoundDecl): IrType =>
    ctx.typeEnv?.get(declId.id) ?? ctx.typeSystem.typeOfValueRead(declId);

  const getMemberTypeForNarrowing = (
    type: IrType,
    propertyName: string
  ): IrType | undefined => {
    if (type.kind === "objectType") {
      const member = type.members.find(
        (candidate) =>
          candidate.kind === "propertySignature" &&
          candidate.name === propertyName
      );
      return member && member.kind === "propertySignature"
        ? member.type
        : undefined;
    }

    if (
      type.kind === "referenceType" &&
      type.structuralMembers &&
      type.structuralMembers.length > 0
    ) {
      const member = type.structuralMembers.find(
        (candidate) =>
          candidate.kind === "propertySignature" &&
          candidate.name === propertyName
      );
      return member && member.kind === "propertySignature"
        ? member.type
        : undefined;
    }

    const memberType = ctx.typeSystem.typeOfMember(type, {
      kind: "byName",
      name: propertyName,
    });
    return memberType.kind === "unknownType" ? undefined : memberType;
  };

  const propertyTypeIsDefinitelyTruthy = (
    type: IrType | undefined
  ): boolean => {
    if (!type) return false;
    if (type.kind === "literalType") {
      return type.value === true;
    }
    return false;
  };

  const propertyTypeIsDefinitelyFalsy = (type: IrType | undefined): boolean => {
    if (!type) return false;
    if (type.kind === "literalType") {
      return type.value === false;
    }
    if (type.kind === "primitiveType") {
      return type.name === "undefined" || type.name === "null";
    }
    return false;
  };

  const collectPropertyNarrowingCandidates = (
    currentType: IrType
  ): readonly IrType[] => {
    const expanded = ctx.typeSystem.collectNarrowingCandidates(currentType);
    return expanded.length > 0 ? expanded : [currentType];
  };

  const narrowTypeByPropertyTruthiness = (
    currentType: IrType,
    propertyName: string,
    wantTruthy: boolean
  ): IrType | undefined => {
    const kept = collectPropertyNarrowingCandidates(currentType).filter(
      (member): member is IrType => {
        if (!member) return false;
        const memberType = getMemberTypeForNarrowing(member, propertyName);
        return wantTruthy
          ? propertyTypeIsDefinitelyTruthy(memberType)
          : propertyTypeIsDefinitelyFalsy(memberType);
      }
    );

    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  };

  const narrowTypeByPropertyPresence = (
    currentType: IrType,
    propertyName: string,
    wantPresent: boolean
  ): IrType | undefined => {
    const kept = collectPropertyNarrowingCandidates(currentType).filter(
      (member): member is IrType => {
        if (!member) return false;
        const hasMember =
          getMemberTypeForNarrowing(member, propertyName) !== undefined;
        return hasMember === wantPresent;
      }
    );

    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  };

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
    const currentType = getCurrentType(propertyAccess.declId);
    const targetType = narrowTypeByPropertyTruthiness(
      currentType,
      propertyAccess.propertyName,
      true
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
          getCurrentType(declId),
          propertyName,
          true
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
    ctx.typeSystem,
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

  const getCurrentType = (declId: BoundDecl): IrType =>
    ctx.typeEnv?.get(declId.id) ?? ctx.typeSystem.typeOfValueRead(declId);

  const getMemberTypeForNarrowing = (
    type: IrType,
    propertyName: string
  ): IrType | undefined => {
    if (type.kind === "objectType") {
      const member = type.members.find(
        (candidate) =>
          candidate.kind === "propertySignature" &&
          candidate.name === propertyName
      );
      return member && member.kind === "propertySignature"
        ? member.type
        : undefined;
    }

    if (
      type.kind === "referenceType" &&
      type.structuralMembers &&
      type.structuralMembers.length > 0
    ) {
      const member = type.structuralMembers.find(
        (candidate) =>
          candidate.kind === "propertySignature" &&
          candidate.name === propertyName
      );
      return member && member.kind === "propertySignature"
        ? member.type
        : undefined;
    }

    const memberType = ctx.typeSystem.typeOfMember(type, {
      kind: "byName",
      name: propertyName,
    });
    return memberType.kind === "unknownType" ? undefined : memberType;
  };

  const collectPropertyNarrowingCandidates = (
    currentType: IrType
  ): readonly IrType[] => {
    const expanded = ctx.typeSystem.collectNarrowingCandidates(currentType);
    return expanded.length > 0 ? expanded : [currentType];
  };

  const narrowTypeByPropertyTruthiness = (
    currentType: IrType,
    propertyName: string,
    wantTruthy: boolean
  ): IrType | undefined => {
    const kept = collectPropertyNarrowingCandidates(currentType).filter(
      (member): member is IrType => {
        if (!member) return false;
        const memberType = getMemberTypeForNarrowing(member, propertyName);
        if (!memberType || memberType.kind !== "literalType") return false;
        return wantTruthy
          ? memberType.value === true
          : memberType.value === false;
      }
    );

    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  };

  const narrowTypeByPropertyPresence = (
    currentType: IrType,
    propertyName: string,
    wantPresent: boolean
  ): IrType | undefined => {
    const kept = collectPropertyNarrowingCandidates(currentType).filter(
      (member): member is IrType => {
        if (!member) return false;
        const hasMember =
          getMemberTypeForNarrowing(member, propertyName) !== undefined;
        return hasMember === wantPresent;
      }
    );

    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  };

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
    const currentType = getCurrentType(propertyAccess.declId);
    const targetType = narrowTypeByPropertyTruthiness(
      currentType,
      propertyAccess.propertyName,
      false
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
          getCurrentType(declId),
          propertyName,
          false
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
      ctx.typeSystem,
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

export const withAppliedNarrowings = (
  ctx: ProgramContext,
  narrowings: readonly TypeNarrowing[]
): ProgramContext => {
  if (narrowings.length === 0) return ctx;

  let nextTypeEnv: Map<number, IrType> | undefined;
  let nextAccessEnv: Map<string, IrType> | undefined;
  for (const n of narrowings) {
    if (n.kind === "decl") {
      if (!nextTypeEnv)
        nextTypeEnv = new Map<number, IrType>(ctx.typeEnv ?? []);
      nextTypeEnv.set(n.declId, n.targetType);
      continue;
    }

    if (!nextAccessEnv) {
      nextAccessEnv = new Map<string, IrType>(ctx.accessEnv ?? []);
    }
    nextAccessEnv.set(n.key, n.targetType);
  }

  return {
    ...ctx,
    ...(nextTypeEnv ? { typeEnv: nextTypeEnv } : {}),
    ...(nextAccessEnv ? { accessEnv: nextAccessEnv } : {}),
  };
};

const isDescendantAccessPath = (
  target: AccessPathTarget,
  candidateKey: string
): boolean => {
  const candidate = JSON.parse(candidateKey) as
    | {
        readonly kind: "decl";
        readonly declId: number;
        readonly segments: readonly string[];
      }
    | {
        readonly kind: "this";
        readonly segments: readonly string[];
      };

  if (candidate.kind !== target.kind) {
    return false;
  }

  if (
    target.kind === "decl" &&
    candidate.kind === "decl" &&
    candidate.declId !== target.declId.id
  ) {
    return false;
  }

  if (candidate.segments.length < target.segments.length) {
    return false;
  }

  return target.segments.every(
    (segment, index) => candidate.segments[index] === segment
  );
};

const withoutAssignedTargetFlow = (
  ctx: ProgramContext,
  target: AccessPathTarget
): ProgramContext => {
  const nextTypeEnv = new Map(ctx.typeEnv ?? []);
  const nextAccessEnv = new Map(ctx.accessEnv ?? []);

  if (target.kind === "decl" && target.segments.length === 0) {
    nextTypeEnv.delete(target.declId.id);
  }

  for (const key of nextAccessEnv.keys()) {
    if (isDescendantAccessPath(target, key)) {
      nextAccessEnv.delete(key);
    }
  }

  return {
    ...ctx,
    typeEnv: nextTypeEnv,
    accessEnv: nextAccessEnv,
  };
};

export const withAssignedAccessPathType = (
  ctx: ProgramContext,
  target: AccessPathTarget,
  assignedType: IrType | undefined
): ProgramContext => {
  const cleared = withoutAssignedTargetFlow(ctx, target);
  if (!assignedType) {
    return cleared;
  }

  if (target.kind === "decl" && target.segments.length === 0) {
    const nextTypeEnv = new Map(cleared.typeEnv ?? []);
    nextTypeEnv.set(target.declId.id, assignedType);
    return {
      ...cleared,
      typeEnv: nextTypeEnv,
    };
  }

  const nextAccessEnv = new Map(cleared.accessEnv ?? []);
  nextAccessEnv.set(getAccessPathKey(target), assignedType);
  return {
    ...cleared,
    accessEnv: nextAccessEnv,
  };
};
