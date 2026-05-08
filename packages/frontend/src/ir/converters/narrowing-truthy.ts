/**
 * Truthy/falsy narrowing resolution and sequential narrowing collection.
 *
 * Contains tryResolveTruthyNarrowing, tryResolveFalsyNarrowing,
 * collectTypeNarrowingsInTruthyExpr, collectTypeNarrowingsInFalsyExpr,
 * and collectSequentialNarrowings.
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import { normalizedUnionType } from "../types/type-ops.js";
import type { IrType } from "../types.js";
import { narrowTypeByAssignableTarget } from "./reference-type-guards.js";
import {
  getAccessPathTarget,
  getCurrentTypeForAccessPath,
  type AccessPathTarget,
} from "./access-paths.js";
import { collectNarrowingCandidateLeaves } from "./narrowing-candidates.js";
import {
  type TypeNarrowing,
  unwrapExpr,
  makeTypeNarrowing,
  tryResolveCallPredicateNarrowing,
  extractIdentifierPropertyAccess,
  tryResolveEqualityLiteralNarrowing,
  resolveInstanceofTargetType,
  filterTypeByResolvedCandidates,
} from "./narrowing-resolvers.js";
import { withAppliedNarrowings } from "./narrowing-environment.js";
import {
  getCurrentTypeForDecl,
  narrowTypeByPropertyTruthiness,
} from "./narrowing-property-helpers.js";

const KNOWN_VALUE_LIKE_REFERENCE_NAMES = new Set([
  "sbyte",
  "byte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "nint",
  "nuint",
  "half",
  "float",
  "double",
  "decimal",
  "bool",
  "boolean",
  "char",
  "Int128",
  "UInt128",
  "SByte",
  "Byte",
  "Int16",
  "UInt16",
  "Int32",
  "UInt32",
  "Int64",
  "UInt64",
  "Half",
  "Single",
  "Double",
  "Decimal",
  "Boolean",
  "Char",
]);

const isNullishCandidate = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const isDeterministicallyTruthyCandidate = (type: IrType): boolean => {
  switch (type.kind) {
    case "objectType":
    case "arrayType":
    case "tupleType":
    case "dictionaryType":
    case "functionType":
      return true;
    case "referenceType":
      return !KNOWN_VALUE_LIKE_REFERENCE_NAMES.has(type.name);
    case "literalType":
      if (typeof type.value === "string") {
        return type.value.length > 0;
      }
      if (typeof type.value === "boolean") {
        return type.value;
      }
      if (typeof type.value === "number") {
        return type.value !== 0 && !Number.isNaN(type.value);
      }
      return false;
    default:
      return false;
  }
};

const buildCandidateUnion = (
  candidates: readonly IrType[]
): IrType | undefined => {
  if (candidates.length === 0) {
    return undefined;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  return normalizedUnionType(candidates);
};

const TYPEOF_NUMBER_PRIMITIVES = new Set([
  "number",
  "int",
  "byte",
  "sbyte",
  "short",
  "ushort",
  "uint",
  "long",
  "ulong",
  "float",
  "double",
  "decimal",
]);

const typeofGenericTarget = (tag: string): IrType | undefined => {
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
      return {
        kind: "referenceType",
        name: "object",
        resolvedClrType: "global::System.Object",
      };
    case "function":
      return {
        kind: "functionType",
        parameters: [],
        returnType: { kind: "unknownType", explicit: true },
      };
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
      case "object":
        return type.value === null;
      default:
        return false;
    }
  }

  switch (type.kind) {
    case "functionType":
      return tag === "function";
    case "arrayType":
    case "tupleType":
    case "objectType":
    case "dictionaryType":
      return tag === "object";
    case "referenceType":
      return tag === "object" && type.name !== "Function";
    case "primitiveType":
      switch (tag) {
        case "string":
          return type.name === "string";
        case "number":
          return TYPEOF_NUMBER_PRIMITIVES.has(type.name);
        case "boolean":
          return type.name === "boolean";
        case "undefined":
          return type.name === "undefined";
        case "object":
          return type.name === "null";
        default:
          return false;
      }
    default:
      return false;
  }
};

const tryReadTypeofTag = (expr: ts.Expression): string | undefined => {
  const unwrapped = unwrapExpr(expr);
  return ts.isStringLiteral(unwrapped) ||
    ts.isNoSubstitutionTemplateLiteral(unwrapped)
    ? unwrapped.text
    : undefined;
};

const tryReadTypeofTarget = (
  expr: ts.Expression,
  ctx: ProgramContext
): AccessPathTarget | undefined => {
  const unwrapped = unwrapExpr(expr);
  return ts.isTypeOfExpression(unwrapped)
    ? getAccessPathTarget(unwrapped.expression, ctx)
    : undefined;
};

const tryResolveTypeofNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext,
  whenTruthy: boolean
): TypeNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);
  if (!ts.isBinaryExpression(unwrapped)) {
    return undefined;
  }

  const operator = unwrapped.operatorToken.kind;
  const equality =
    operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    operator === ts.SyntaxKind.EqualsEqualsToken;
  const inequality =
    operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    operator === ts.SyntaxKind.ExclamationEqualsToken;
  if (!equality && !inequality) {
    return undefined;
  }

  const leftTarget = tryReadTypeofTarget(unwrapped.left, ctx);
  const rightTarget = tryReadTypeofTarget(unwrapped.right, ctx);
  const leftTag = tryReadTypeofTag(unwrapped.left);
  const rightTag = tryReadTypeofTag(unwrapped.right);
  const target = leftTarget ?? rightTarget;
  const tag = leftTarget ? rightTag : rightTarget ? leftTag : undefined;
  if (!target || !tag) {
    return undefined;
  }

  const wantMatch = whenTruthy ? equality : inequality;
  const currentType = getCurrentTypeForAccessPath(target, ctx);
  if (!currentType) {
    return undefined;
  }

  if (currentType.kind === "unknownType") {
    const genericTarget = typeofGenericTarget(tag);
    return wantMatch && currentType.explicit === true && genericTarget
      ? makeTypeNarrowing(target, genericTarget)
      : undefined;
  }

  if (currentType.kind === "anyType") {
    return undefined;
  }

  const narrowed = filterTypeByResolvedCandidates(
    currentType,
    (candidate) => matchesTypeofTag(candidate, tag) === wantMatch,
    ctx
  );
  return narrowed ? makeTypeNarrowing(target, narrowed) : undefined;
};

const isArrayLikeCandidate = (type: IrType): boolean => {
  if (type.kind === "arrayType" || type.kind === "tupleType") {
    return true;
  }

  if (type.kind !== "referenceType") {
    return false;
  }

  const simpleName = type.name.split(".").pop() ?? type.name;
  const clrSimpleName = type.resolvedClrType?.split(".").pop();
  return (
    simpleName === "Array" ||
    simpleName === "ReadonlyArray" ||
    clrSimpleName === "Array" ||
    clrSimpleName === "ReadonlyArray"
  );
};

const tryGetArrayIsArrayTarget = (
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
    callee.name.text !== "isArray"
  ) {
    return undefined;
  }

  const receiver = unwrapExpr(callee.expression);
  if (!ts.isIdentifier(receiver) || receiver.text !== "Array") {
    return undefined;
  }

  const argument = unwrapped.arguments[0];
  return argument ? getAccessPathTarget(argument, ctx) : undefined;
};

const narrowTypeByArrayIsArray = (
  currentType: IrType | undefined,
  wantArray: boolean,
  ctx: ProgramContext
): IrType | undefined => {
  if (!currentType) {
    return undefined;
  }

  if (currentType.kind === "unknownType") {
    return undefined;
  }

  if (currentType.kind === "anyType") {
    return undefined;
  }

  return filterTypeByResolvedCandidates(
    currentType,
    (candidate) => isArrayLikeCandidate(candidate) === wantArray,
    ctx
  );
};

const narrowTypeByDirectTruthiness = (
  currentType: IrType | undefined,
  wantTruthy: boolean,
  ctx: ProgramContext
): IrType | undefined => {
  if (!currentType) {
    return undefined;
  }

  const candidates = collectNarrowingCandidateLeaves(
    ctx.typeSystem,
    currentType
  ).filter((candidate): candidate is IrType => candidate !== undefined);
  if (candidates.length === 0) {
    return undefined;
  }

  const nullishCandidates = candidates.filter((candidate: IrType) =>
    isNullishCandidate(candidate)
  );
  if (nullishCandidates.length === 0) {
    return undefined;
  }

  const nonNullishCandidates = candidates.filter(
    (candidate: IrType) => !isNullishCandidate(candidate)
  );
  if (
    nonNullishCandidates.length === 0 ||
    nonNullishCandidates.some(
      (candidate: IrType) => !isDeterministicallyTruthyCandidate(candidate)
    )
  ) {
    return undefined;
  }

  return wantTruthy
    ? buildCandidateUnion(nonNullishCandidates)
    : buildCandidateUnion(nullishCandidates);
};

const tryResolveTruthyNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext
): TypeNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);
  const arrayIsArrayTarget = tryGetArrayIsArrayTarget(unwrapped, ctx);
  if (arrayIsArrayTarget) {
    const targetType = narrowTypeByArrayIsArray(
      getCurrentTypeForAccessPath(arrayIsArrayTarget, ctx),
      true,
      ctx
    );
    if (targetType) {
      return makeTypeNarrowing(arrayIsArrayTarget, targetType);
    }
  }

  const directTarget = getAccessPathTarget(unwrapped, ctx);
  if (directTarget) {
    const targetType = narrowTypeByDirectTruthiness(
      getCurrentTypeForAccessPath(directTarget, ctx),
      true,
      ctx
    );
    if (targetType) {
      return makeTypeNarrowing(directTarget, targetType);
    }
  }

  const propertyAccess = extractIdentifierPropertyAccess(unwrapped, ctx);
  if (propertyAccess) {
    const currentType = getCurrentTypeForDecl(propertyAccess.declId, ctx);
    const targetType = narrowTypeByPropertyTruthiness(
      currentType,
      propertyAccess.propertyName,
      true,
      ctx
    );
    if (targetType) {
      return {
        kind: "decl",
        declId: propertyAccess.declId.id,
        targetType,
      };
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

  // x instanceof T
  if (!ts.isBinaryExpression(unwrapped)) return undefined;
  if (unwrapped.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword)
    return undefined;

  const narrowedTarget = getAccessPathTarget(unwrapped.left, ctx);
  if (!narrowedTarget) return undefined;

  const targetType = resolveInstanceofTargetType(unwrapped.right, ctx);
  if (!targetType) return undefined;

  const narrowedType = narrowTypeByAssignableTarget(
    {
      collectNarrowingCandidates: (type) =>
        ctx.typeSystem.collectNarrowingCandidates(type),
      isAssignableTo: (source, target) =>
        ctx.typeSystem.matchesInstanceofTarget(source, target),
    },
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

  const typeofNarrowing = tryResolveTypeofNarrowing(unwrapped, ctx, true);
  if (typeofNarrowing) return [typeofNarrowing];

  const predicateNarrowing = tryResolveCallPredicateNarrowing(
    unwrapped,
    ctx,
    true
  );
  if (predicateNarrowing) return [predicateNarrowing];

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
  const arrayIsArrayTarget = tryGetArrayIsArrayTarget(unwrapped, ctx);
  if (arrayIsArrayTarget) {
    const targetType = narrowTypeByArrayIsArray(
      getCurrentTypeForAccessPath(arrayIsArrayTarget, ctx),
      false,
      ctx
    );
    if (targetType) {
      return makeTypeNarrowing(arrayIsArrayTarget, targetType);
    }
  }

  const directTarget = getAccessPathTarget(unwrapped, ctx);
  if (directTarget) {
    const targetType = narrowTypeByDirectTruthiness(
      getCurrentTypeForAccessPath(directTarget, ctx),
      false,
      ctx
    );
    if (targetType) {
      return makeTypeNarrowing(directTarget, targetType);
    }
  }

  const propertyAccess = extractIdentifierPropertyAccess(unwrapped, ctx);
  if (propertyAccess) {
    const currentType = getCurrentTypeForDecl(propertyAccess.declId, ctx);
    const targetType = narrowTypeByPropertyTruthiness(
      currentType,
      propertyAccess.propertyName,
      false,
      ctx
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
    unwrapped.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword
  ) {
    const narrowedTarget = getAccessPathTarget(unwrapped.left, ctx);
    if (!narrowedTarget) return undefined;

    const targetType = resolveInstanceofTargetType(unwrapped.right, ctx);
    if (!targetType) return undefined;

    const narrowedType = narrowTypeByAssignableTarget(
      {
        collectNarrowingCandidates: (type) =>
          ctx.typeSystem.collectNarrowingCandidates(type),
        isAssignableTo: (source, target) =>
          ctx.typeSystem.matchesInstanceofTarget(source, target),
      },
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

  const typeofNarrowing = tryResolveTypeofNarrowing(unwrapped, ctx, false);
  if (typeofNarrowing) return [typeofNarrowing];

  const predicateNarrowing = tryResolveCallPredicateNarrowing(
    unwrapped,
    ctx,
    false
  );
  if (predicateNarrowing) return [predicateNarrowing];

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
