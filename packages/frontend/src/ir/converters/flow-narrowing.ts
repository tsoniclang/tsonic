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
 * - `istype<T>(x)` in boolean (truthy) contexts (compiler-only type guard)
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import type { DeclId } from "../type-system/index.js";
import { normalizedUnionType } from "../types/type-ops.js";
import { narrowTypeByArrayShape } from "./array-type-guards.js";
import { narrowTypeByAssignableTarget } from "./reference-type-guards.js";
import {
  getAccessPathKey,
  getAccessPathTarget,
  getCurrentTypeForAccessPath,
  type AccessPathTarget,
} from "./access-paths.js";

export type TypeNarrowing =
  | {
      readonly kind: "decl";
      readonly declId: number;
      readonly targetType: IrType;
    }
  | {
      readonly kind: "accessPath";
      readonly key: string;
      readonly targetType: IrType;
    };

const unwrapExpr = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

const getStringLiteralText = (expr: ts.Expression): string | undefined => {
  const unwrapped = unwrapExpr(expr);
  if (
    ts.isStringLiteral(unwrapped) ||
    ts.isNoSubstitutionTemplateLiteral(unwrapped)
  ) {
    return unwrapped.text;
  }
  return undefined;
};

const isEqualityOperator = (kind: ts.SyntaxKind): boolean =>
  kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
  kind === ts.SyntaxKind.EqualsEqualsToken;

const isInequalityOperator = (kind: ts.SyntaxKind): boolean =>
  kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
  kind === ts.SyntaxKind.ExclamationEqualsToken;

const isArrayNamespaceExpression = (expr: ts.Expression): boolean => {
  const unwrapped = unwrapExpr(expr);
  if (ts.isIdentifier(unwrapped)) {
    return unwrapped.text === "Array";
  }

  if (ts.isPropertyAccessExpression(unwrapped)) {
    return (
      ts.isIdentifier(unwrapped.expression) &&
      unwrapped.expression.text === "globalThis" &&
      unwrapped.name.text === "Array"
    );
  }

  return false;
};

const makeTypeNarrowing = (
  target: AccessPathTarget,
  targetType: IrType
): TypeNarrowing =>
  target.kind === "decl" && target.segments.length === 0
    ? { kind: "decl", declId: target.declId.id, targetType }
    : { kind: "accessPath", key: getAccessPathKey(target), targetType };

const extractArrayIsArrayTarget = (
  expr: ts.Expression,
  ctx: ProgramContext
): AccessPathTarget | undefined => {
  const unwrapped = unwrapExpr(expr);
  if (!ts.isCallExpression(unwrapped) || unwrapped.arguments.length !== 1) {
    return undefined;
  }

  const callee = unwrapExpr(unwrapped.expression);
  if (
    !ts.isPropertyAccessExpression(callee) ||
    callee.name.text !== "isArray" ||
    !isArrayNamespaceExpression(callee.expression)
  ) {
    return undefined;
  }

  const [rawValue] = unwrapped.arguments;
  if (!rawValue) return undefined;
  return getAccessPathTarget(rawValue, ctx);
};

const tryResolveCallPredicateNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext,
  whenTruthy: boolean
): TypeNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);
  if (!ts.isCallExpression(unwrapped)) {
    return undefined;
  }

  const sigId = ctx.binding.resolveCallSignature(unwrapped);
  if (!sigId) {
    return undefined;
  }

  const predicate = ctx.binding.getTypePredicateOfSignature(sigId);
  if (!predicate || predicate.kind !== "typePredicate") {
    return undefined;
  }

  const rawArg = unwrapped.arguments[predicate.parameterIndex];
  if (!rawArg) {
    return undefined;
  }

  const narrowedTarget = getAccessPathTarget(rawArg, ctx);
  if (!narrowedTarget) {
    return undefined;
  }

  const targetType = predicate.typeNode
    ? ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(predicate.typeNode)
      )
    : undefined;
  if (!targetType) {
    return undefined;
  }

  if (whenTruthy) {
    return makeTypeNarrowing(narrowedTarget, targetType);
  }

  const currentType = getCurrentTypeForAccessPath(narrowedTarget, ctx);
  const narrowedType = narrowTypeByAssignableTarget(
    ctx.typeSystem,
    currentType,
    targetType,
    false
  );
  if (!narrowedType) {
    return undefined;
  }

  return makeTypeNarrowing(narrowedTarget, narrowedType);
};

const extractIdentifierPropertyAccess = (
  value: ts.Expression,
  ctx: ProgramContext
): { declId: BoundDecl; propertyName: string } | undefined => {
  const candidate = unwrapExpr(value);

  if (ts.isPropertyAccessExpression(candidate)) {
    const object = unwrapExpr(candidate.expression);
    if (!ts.isIdentifier(object)) return undefined;
    const declId = ctx.binding.resolveIdentifier(object);
    if (!declId) return undefined;
    return { declId, propertyName: candidate.name.text };
  }

  if (ts.isElementAccessExpression(candidate)) {
    const object = unwrapExpr(candidate.expression);
    const argument = candidate.argumentExpression
      ? unwrapExpr(candidate.argumentExpression)
      : undefined;
    if (!ts.isIdentifier(object) || !argument) return undefined;
    const propertyName = getStringLiteralText(argument);
    if (!propertyName) return undefined;
    const declId = ctx.binding.resolveIdentifier(object);
    if (!declId) return undefined;
    return { declId, propertyName };
  }

  return undefined;
};

const genericTypeofTarget = (tag: string): IrType | undefined => {
  switch (tag) {
    case "string":
      return { kind: "primitiveType", name: "string" };
    case "number":
      return { kind: "primitiveType", name: "number" };
    case "boolean":
      return { kind: "primitiveType", name: "boolean" };
    case "undefined":
      return { kind: "primitiveType", name: "undefined" };
    default:
      return undefined;
  }
};

const matchesTypeofTag = (type: IrType, tag: string): boolean => {
  if (type.kind === "literalType") {
    switch (tag) {
      case "string":
        return typeof type.value === "string";
      case "number":
        return typeof type.value === "number";
      case "boolean":
        return typeof type.value === "boolean";
      default:
        return false;
    }
  }

  if (type.kind !== "primitiveType") return false;

  switch (tag) {
    case "string":
      return type.name === "string";
    case "number":
      return type.name === "number" || type.name === "int";
    case "boolean":
      return type.name === "boolean";
    case "undefined":
      return type.name === "undefined";
    default:
      return false;
  }
};

const narrowTypeByTypeofTag = (
  currentType: IrType | undefined,
  tag: string
): IrType | undefined => {
  if (!currentType) return genericTypeofTarget(tag);

  if (currentType.kind === "unionType") {
    const kept = currentType.types.filter(
      (member): member is IrType => !!member && matchesTypeofTag(member, tag)
    );
    if (kept.length === 1) return kept[0];
    if (kept.length > 1) {
      return normalizedUnionType(kept);
    }
    return genericTypeofTarget(tag);
  }

  return matchesTypeofTag(currentType, tag)
    ? currentType
    : genericTypeofTarget(tag);
};

const narrowTypeByNotTypeofTag = (
  currentType: IrType | undefined,
  tag: string
): IrType | undefined => {
  if (!currentType) return undefined;

  if (currentType.kind === "unionType") {
    const kept = currentType.types.filter(
      (member): member is IrType => !!member && !matchesTypeofTag(member, tag)
    );
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return matchesTypeofTag(currentType, tag) ? undefined : currentType;
};

const tryResolveTypeofNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext,
  whenTruthy: boolean
): TypeNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);
  if (!ts.isBinaryExpression(unwrapped)) return undefined;

  const operator = unwrapped.operatorToken.kind;
  const isEquality = isEqualityOperator(operator);
  const isInequality = isInequalityOperator(operator);
  if (!isEquality && !isInequality) return undefined;

  const left = unwrapExpr(unwrapped.left);
  const right = unwrapExpr(unwrapped.right);
  const leftLiteral = getStringLiteralText(left);
  const rightLiteral = getStringLiteralText(right);

  const extractTypeofTarget = (
    candidate: ts.Expression
  ): AccessPathTarget | undefined => {
    if (!ts.isTypeOfExpression(candidate)) return undefined;
    return getAccessPathTarget(candidate.expression, ctx);
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

  const wantTypeofTag = whenTruthy ? isEquality : isInequality;
  const currentType = getCurrentTypeForAccessPath(narrowedTarget, ctx);
  const targetType = wantTypeofTag
    ? narrowTypeByTypeofTag(currentType, tag)
    : narrowTypeByNotTypeofTag(currentType, tag);
  if (!targetType) return undefined;

  return makeTypeNarrowing(narrowedTarget, targetType);
};

const resolveInstanceofTargetType = (
  expr: ts.Expression,
  ctx: ProgramContext
): IrType | undefined => {
  const normalize = (type: IrType): IrType =>
    type.kind === "referenceType" &&
    !type.typeId &&
    !type.resolvedClrType &&
    type.name.endsWith("Constructor")
      ? {
          kind: "referenceType",
          name: type.name.slice(0, -"Constructor".length),
        }
      : type;

  const unwrapped = unwrapExpr(expr);

  if (ts.isIdentifier(unwrapped)) {
    const declId = ctx.binding.resolveIdentifier(unwrapped);
    if (declId) {
      const type = ctx.typeSystem.typeOfDecl(declId);
      if (type.kind !== "unknownType") {
        return normalize(type);
      }
    }
  }

  const accessTarget = getAccessPathTarget(unwrapped, ctx);
  if (!accessTarget) return undefined;

  const type = getCurrentTypeForAccessPath(accessTarget, ctx);
  if (!type || type.kind === "unknownType") return undefined;
  return normalize(type);
};

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
    const targetType = narrowTypeByTypeofTag(currentType, tag);
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

  if (ts.isBinaryExpression(unwrapped)) {
    if (
      unwrapped.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return [
        ...collectTypeNarrowingsInTruthyExpr(unwrapped.left, ctx),
        ...collectTypeNarrowingsInTruthyExpr(unwrapped.right, ctx),
      ];
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
    return [
      ...collectTypeNarrowingsInFalsyExpr(unwrapped.left, ctx),
      ...collectTypeNarrowingsInFalsyExpr(unwrapped.right, ctx),
    ];
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

  return [];
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
      if (!nextTypeEnv) nextTypeEnv = new Map<number, IrType>(ctx.typeEnv ?? []);
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
type BoundDecl = DeclId;
