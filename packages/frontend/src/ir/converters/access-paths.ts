import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import type { DeclId } from "../type-system/index.js";

export type AccessPathTarget =
  | {
      readonly kind: "decl";
      readonly declId: DeclId;
      readonly segments: readonly string[];
      readonly anchor: ts.Expression;
    }
  | {
      readonly kind: "this";
      readonly segments: readonly string[];
      readonly anchor: ts.Expression;
    };

const unwrapExpr = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
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

const inferThisType = (node: ts.Node): IrType | undefined => {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
      const className = current.name?.text;
      if (!className) return undefined;

      const typeArguments =
        current.typeParameters?.map(
          (tp): IrType => ({ kind: "typeParameterType", name: tp.name.text })
        ) ?? [];

      return {
        kind: "referenceType",
        name: className,
        ...(typeArguments.length > 0 ? { typeArguments } : {}),
      };
    }

    current = current.parent;
  }

  return undefined;
};

export const getAccessPathTarget = (
  expr: ts.Expression,
  ctx: ProgramContext
): AccessPathTarget | undefined => {
  const candidate = unwrapExpr(expr);

  if (ts.isIdentifier(candidate)) {
    const declId = ctx.binding.resolveIdentifier(candidate);
    if (!declId) return undefined;
    return {
      kind: "decl",
      declId,
      segments: [],
      anchor: candidate,
    };
  }

  if (candidate.kind === ts.SyntaxKind.ThisKeyword) {
    return {
      kind: "this",
      segments: [],
      anchor: candidate,
    };
  }

  if (
    ts.isPropertyAccessExpression(candidate) ||
    ts.isPropertyAccessChain(candidate)
  ) {
    const base = getAccessPathTarget(candidate.expression, ctx);
    if (!base) return undefined;
    return {
      ...base,
      segments: [...base.segments, candidate.name.text],
      anchor: candidate,
    };
  }

  if (
    ts.isElementAccessExpression(candidate) ||
    ts.isElementAccessChain(candidate)
  ) {
    const base = getAccessPathTarget(candidate.expression, ctx);
    if (!base || !candidate.argumentExpression) return undefined;
    const propertyName = getStringLiteralText(candidate.argumentExpression);
    if (!propertyName) return undefined;
    return {
      ...base,
      segments: [...base.segments, propertyName],
      anchor: candidate,
    };
  }

  return undefined;
};

export const getAccessPathKey = (target: AccessPathTarget): string => {
  if (target.kind === "decl") {
    return JSON.stringify({
      kind: "decl",
      declId: target.declId.id,
      segments: target.segments,
    });
  }

  return JSON.stringify({
    kind: "this",
    segments: target.segments,
  });
};

const getRootType = (
  target: AccessPathTarget,
  ctx: ProgramContext
): IrType | undefined => {
  if (target.kind === "decl") {
    return (
      ctx.typeEnv?.get(target.declId.id) ??
      ctx.typeSystem.typeOfValueRead(target.declId)
    );
  }

  return ctx.objectLiteralThisType ?? inferThisType(target.anchor);
};

export const getCurrentTypeForAccessPath = (
  target: AccessPathTarget,
  ctx: ProgramContext
): IrType | undefined => {
  let currentType = getRootType(target, ctx);
  const baseTarget =
    target.kind === "decl"
      ? { ...target, segments: [] as readonly string[] }
      : { ...target, segments: [] as readonly string[] };
  const baseKey = getAccessPathKey(baseTarget);
  const baseNarrowed = ctx.accessEnv?.get(baseKey);
  if (baseNarrowed) {
    currentType = baseNarrowed;
  }

  for (let index = 0; index < target.segments.length; index += 1) {
    const segment = target.segments[index];
    if (segment === undefined) {
      return undefined;
    }
    const pathKey = getAccessPathKey({
      ...target,
      segments: target.segments.slice(0, index + 1),
    });
    const narrowed = ctx.accessEnv?.get(pathKey);
    if (narrowed) {
      currentType = narrowed;
      continue;
    }

    if (!currentType) return undefined;
    const memberType = ctx.typeSystem.typeOfMember(currentType, {
      kind: "byName",
      name: segment,
    });
    if (memberType.kind === "unknownType" && memberType.explicit !== true) {
      return undefined;
    }
    currentType = memberType;
  }

  return currentType;
};

export const getCurrentTypeForAccessExpression = (
  expr: ts.Expression,
  ctx: ProgramContext
): IrType | undefined => {
  const target = getAccessPathTarget(expr, ctx);
  if (!target) return undefined;
  return getCurrentTypeForAccessPath(target, ctx);
};

export const hasAccessPathNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext
): boolean => {
  if (!ctx.accessEnv || ctx.accessEnv.size === 0) return false;

  const target = getAccessPathTarget(expr, ctx);
  if (!target) return false;

  for (let index = 0; index <= target.segments.length; index += 1) {
    const key = getAccessPathKey({
      ...target,
      segments: target.segments.slice(0, index),
    });
    if (ctx.accessEnv.has(key)) {
      return true;
    }
  }

  return false;
};
