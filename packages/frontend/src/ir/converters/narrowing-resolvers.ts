/**
 * Flow narrowing resolvers (frontend).
 *
 * Type-level narrowing helpers: typeof, equality-literal, instanceof,
 * call-predicate, Array.isArray, and shared utility functions.
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import type { DeclId } from "../type-system/index.js";
import { normalizedUnionType } from "../types/type-ops.js";
import { narrowTypeByAssignableTarget } from "./reference-type-guards.js";
import {
  getAccessPathKey,
  getAccessPathTarget,
  getCurrentTypeForAccessPath,
  type AccessPathTarget,
} from "./access-paths.js";

export type BoundDecl = DeclId;

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

export const unwrapExpr = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

export const getStringLiteralText = (
  expr: ts.Expression
): string | undefined => {
  const unwrapped = unwrapExpr(expr);
  if (
    ts.isStringLiteral(unwrapped) ||
    ts.isNoSubstitutionTemplateLiteral(unwrapped)
  ) {
    return unwrapped.text;
  }
  return undefined;
};

export const isEqualityOperator = (kind: ts.SyntaxKind): boolean =>
  kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
  kind === ts.SyntaxKind.EqualsEqualsToken;

export const isInequalityOperator = (kind: ts.SyntaxKind): boolean =>
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

export const makeTypeNarrowing = (
  target: AccessPathTarget,
  targetType: IrType
): TypeNarrowing =>
  target.kind === "decl" && target.segments.length === 0
    ? { kind: "decl", declId: target.declId.id, targetType }
    : { kind: "accessPath", key: getAccessPathKey(target), targetType };

export const extractArrayIsArrayTarget = (
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

export const tryResolveCallPredicateNarrowing = (
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

export const extractIdentifierPropertyAccess = (
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

export const genericTypeofTarget = (tag: string): IrType | undefined => {
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

export const matchesResolvedTypeofTag = (
  type: IrType,
  tag: string
): boolean => {
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

export const filterTypeByResolvedCandidates = (
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

export const narrowTypeByTypeofTag = (
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

export const narrowTypeByNotTypeofTag = (
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

export const tryResolveTypeofNarrowing = (
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
