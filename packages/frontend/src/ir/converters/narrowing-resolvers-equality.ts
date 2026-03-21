/**
 * Equality-literal and instanceof narrowing resolvers.
 *
 * Handles equality comparisons against literals (null, undefined, booleans,
 * strings, numbers), instanceof checks, and equality literal target resolution.
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import {
  getAccessPathTarget,
  getCurrentTypeForAccessPath,
} from "./access-paths.js";
import {
  unwrapExpr,
  isEqualityOperator,
  isInequalityOperator,
  makeTypeNarrowing,
  filterTypeByResolvedCandidates,
  type TypeNarrowing,
} from "./narrowing-resolvers-typeof.js";

export type EqualityLiteralTarget =
  | {
      readonly kind: "exact";
      readonly type: IrType;
    }
  | {
      readonly kind: "nullish";
    };

export const tryResolveEqualityLiteralTarget = (
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

export const candidateMatchesEqualityLiteral = (
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

export const narrowTypeByEqualityLiteral = (
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

export const tryResolveEqualityLiteralNarrowing = (
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

export const resolveInstanceofTargetType = (
  expr: ts.Expression,
  ctx: ProgramContext
): IrType | undefined => {
  const bindingBackedTargetType = (
    typeName: string
  ): Extract<IrType, { kind: "referenceType" }> | undefined => {
    const bindingType = ctx.bindings.getType(typeName);
    if (!bindingType) return undefined;
    return {
      kind: "referenceType",
      name: bindingType.alias,
      resolvedClrType: bindingType.name,
    };
  };

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
      if (type.kind !== "unknownType" && type.kind !== "objectType") {
        return normalize(type);
      }
    }

    return bindingBackedTargetType(unwrapped.text);
  }

  const accessTarget = getAccessPathTarget(unwrapped, ctx);
  if (!accessTarget) return undefined;

  const type = getCurrentTypeForAccessPath(accessTarget, ctx);
  if (!type || type.kind === "unknownType") return undefined;
  return normalize(type);
};
