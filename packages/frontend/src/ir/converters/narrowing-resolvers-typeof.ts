/**
 * Flow narrowing resolver utilities.
 *
 * Shared utilities for equality, predicate-call, and property-access narrowing.
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import type { DeclId } from "../type-system/index.js";
import { normalizedUnionType } from "../types/type-ops.js";
import { narrowTypeByAssignableTarget } from "./reference-type-guards.js";
import { collectNarrowingCandidateLeaves } from "./narrowing-candidates.js";
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
      readonly bindingKey?: string;
      readonly targetNode?: ts.Expression;
      readonly targetType: IrType;
    }
  | {
      readonly kind: "accessPath";
      readonly key: string;
      readonly bindingKey?: string;
      readonly targetNode?: ts.Expression;
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

const getAccessPathRootName = (expr: ts.Expression): string | undefined => {
  const candidate = unwrapExpr(expr);
  if (ts.isIdentifier(candidate)) {
    return candidate.text;
  }

  if (candidate.kind === ts.SyntaxKind.ThisKeyword) {
    return "this";
  }

  if (
    ts.isPropertyAccessExpression(candidate) ||
    ts.isPropertyAccessChain(candidate) ||
    ts.isElementAccessExpression(candidate) ||
    ts.isElementAccessChain(candidate)
  ) {
    return getAccessPathRootName(candidate.expression);
  }

  return undefined;
};

const getEmitterNarrowingBindingKey = (
  target: AccessPathTarget
): string | undefined => {
  const rootName =
    target.kind === "this" ? "this" : getAccessPathRootName(target.anchor);
  if (!rootName) {
    return undefined;
  }

  return target.segments.length === 0
    ? rootName
    : `${rootName}.${target.segments.join(".")}`;
};

export const makeTypeNarrowing = (
  target: AccessPathTarget,
  targetType: IrType
): TypeNarrowing => {
  const bindingKey = getEmitterNarrowingBindingKey(target);
  const targetNode = target.anchor;
  return target.kind === "decl" && target.segments.length === 0
    ? {
        kind: "decl",
        declId: target.declId.id,
        bindingKey,
        targetNode,
        targetType,
      }
    : {
        kind: "accessPath",
        key: getAccessPathKey(target),
        bindingKey,
        targetNode,
        targetType,
      };
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

export const filterTypeByResolvedCandidates = (
  currentType: IrType,
  predicate: (candidate: IrType) => boolean,
  ctx: ProgramContext
): IrType | undefined => {
  const kept = collectNarrowingCandidateLeaves(
    ctx.typeSystem,
    currentType
  ).filter(
    (candidate): candidate is IrType => !!candidate && predicate(candidate)
  );

  if (kept.length === 0) return undefined;
  if (kept.length === 1) return kept[0];
  return normalizedUnionType(kept);
};
