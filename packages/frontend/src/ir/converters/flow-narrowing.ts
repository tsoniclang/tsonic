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

  if (
    ts.isPropertyAccessExpression(candidate) ||
    ts.isPropertyAccessChain(candidate)
  ) {
    const object = unwrapExpr(candidate.expression);
    if (!ts.isIdentifier(object)) return undefined;
    const declId = ctx.binding.resolveIdentifier(object);
    if (!declId) return undefined;
    return { declId, propertyName: candidate.name.text };
  }

  if (
    ts.isElementAccessExpression(candidate) ||
    ts.isElementAccessChain(candidate)
  ) {
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
    case "object":
      return { kind: "referenceType", name: "object" };
    default:
      return undefined;
  }
};

const matchesResolvedTypeofTag = (type: IrType, tag: string): boolean => {
  if (type.kind === "literalType") {
    switch (tag) {
      case "string":
        return typeof type.value === "string";
      case "number":
        return typeof type.value === "number";
      case "boolean":
        return typeof type.value === "boolean";
      case "object":
        return type.value === null;
      default:
        return false;
    }
  }

  if (type.kind === "functionType") {
    return tag === "function";
  }

  if (type.kind === "arrayType" || type.kind === "tupleType") {
    return tag === "object";
  }

  if (type.kind === "objectType" || type.kind === "dictionaryType") {
    return tag === "object";
  }

  if (type.kind === "referenceType") {
    if (tag === "function") {
      return false;
    }

    if (tag === "object") {
      return type.name !== "Function";
    }

    return false;
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
  tag: string,
  ctx: ProgramContext
): IrType | undefined => {
  if (!currentType) return genericTypeofTarget(tag);

  const filtered = filterTypeByResolvedCandidates(
    currentType,
    (candidate) => matchesResolvedTypeofTag(candidate, tag),
    ctx
  );
  return filtered ?? genericTypeofTarget(tag);
};

const narrowTypeByNotTypeofTag = (
  currentType: IrType | undefined,
  tag: string,
  ctx: ProgramContext
): IrType | undefined => {
  if (!currentType) return undefined;

  return filterTypeByResolvedCandidates(
    currentType,
    (candidate) => !matchesResolvedTypeofTag(candidate, tag),
    ctx
  );
};

const filterTypeByResolvedCandidates = (
  currentType: IrType,
  predicate: (candidate: IrType) => boolean,
  ctx: ProgramContext
): IrType | undefined => {
  if (currentType.kind === "unionType") {
    const kept = currentType.types
      .map((member) =>
        member
          ? filterTypeByResolvedCandidates(member, predicate, ctx)
          : undefined
      )
      .filter((member): member is IrType => !!member);
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return ctx.typeSystem
    .collectNarrowingCandidates(currentType)
    .some((candidate) => predicate(candidate))
    ? currentType
    : undefined;
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
    ? narrowTypeByTypeofTag(currentType, tag, ctx)
    : narrowTypeByNotTypeofTag(currentType, tag, ctx);
  if (!targetType) return undefined;

  return makeTypeNarrowing(narrowedTarget, targetType);
};

type EqualityLiteralTarget =
  | {
      readonly kind: "exact";
      readonly type: IrType;
    }
  | {
      readonly kind: "nullish";
    };

const tryResolveEqualityLiteralTarget = (
  expr: ts.Expression
): EqualityLiteralTarget | undefined => {
  const current = unwrapExpr(expr);

  if (current.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "exact", type: { kind: "primitiveType", name: "null" } };
  }

  if (
    current.kind === ts.SyntaxKind.Identifier &&
    (current as ts.Identifier).text === "undefined"
  ) {
    return {
      kind: "exact",
      type: { kind: "primitiveType", name: "undefined" },
    };
  }

  if (
    current.kind === ts.SyntaxKind.TrueKeyword ||
    current.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return {
      kind: "exact",
      type: {
        kind: "literalType",
        value: current.kind === ts.SyntaxKind.TrueKeyword,
      },
    };
  }

  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current)
  ) {
    return {
      kind: "exact",
      type: { kind: "literalType", value: current.text },
    };
  }

  if (ts.isNumericLiteral(current)) {
    return {
      kind: "exact",
      type: { kind: "literalType", value: Number(current.text) },
    };
  }

  return undefined;
};

const candidateMatchesEqualityLiteral = (
  candidate: IrType,
  literal: EqualityLiteralTarget
): boolean => {
  if (literal.kind === "nullish") {
    return (
      (candidate.kind === "primitiveType" && candidate.name === "null") ||
      (candidate.kind === "primitiveType" && candidate.name === "undefined") ||
      (candidate.kind === "literalType" && candidate.value === null)
    );
  }

  const target = literal.type;
  if (target.kind === "primitiveType") {
    return candidate.kind === "primitiveType" && candidate.name === target.name;
  }

  if (target.kind === "literalType") {
    return candidate.kind === "literalType" && candidate.value === target.value;
  }

  return false;
};

const narrowTypeByEqualityLiteral = (
  currentType: IrType | undefined,
  literal: EqualityLiteralTarget,
  wantEqual: boolean,
  ctx: ProgramContext
): IrType | undefined => {
  if (!currentType) return undefined;

  return filterTypeByResolvedCandidates(
    currentType,
    (candidate) =>
      candidateMatchesEqualityLiteral(candidate, literal) === wantEqual,
    ctx
  );
};

const tryResolveEqualityLiteralNarrowing = (
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

  const leftTarget = getAccessPathTarget(unwrapped.left, ctx);
  const rightTarget = getAccessPathTarget(unwrapped.right, ctx);
  const leftLiteral = tryResolveEqualityLiteralTarget(unwrapped.left);
  const rightLiteral = tryResolveEqualityLiteralTarget(unwrapped.right);

  const literal =
    leftTarget && rightLiteral
      ? rightLiteral
      : rightTarget && leftLiteral
        ? leftLiteral
        : undefined;
  const narrowedTarget = leftTarget ?? rightTarget;
  if (!literal || !narrowedTarget) return undefined;

  const useNullishPair =
    literal.kind === "exact" &&
    literal.type.kind === "primitiveType" &&
    (literal.type.name === "null" || literal.type.name === "undefined") &&
    (operator === ts.SyntaxKind.EqualsEqualsToken ||
      operator === ts.SyntaxKind.ExclamationEqualsToken);
  const effectiveLiteral: EqualityLiteralTarget = useNullishPair
    ? { kind: "nullish" }
    : literal;
  const wantEqual = whenTruthy ? isEquality : isInequality;
  const currentType = getCurrentTypeForAccessPath(narrowedTarget, ctx);
  const targetType = narrowTypeByEqualityLiteral(
    currentType,
    effectiveLiteral,
    wantEqual,
    ctx
  );
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
type BoundDecl = DeclId;
