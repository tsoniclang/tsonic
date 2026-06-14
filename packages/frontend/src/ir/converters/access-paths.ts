import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
import { getTstsNodeNameText } from "@tsonic/tsts";
import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import type { DeclId } from "../type-system/index.js";

export type AccessPathTarget =
  | {
      readonly kind: "decl";
      readonly declId: DeclId;
      readonly segments: readonly string[];
      readonly anchor: TstsNode;
    }
  | {
      readonly kind: "this";
      readonly segments: readonly string[];
      readonly anchor: TstsNode;
    };

const unwrapExpr = (expr: TstsNode): TstsNode => {
  let current = expr;
  while (
    TstsSyntax.IsParenthesizedExpression(current) ||
    TstsSyntax.IsNonNullExpression(current)
  ) {
    const next = TstsSyntax.Node_Expression(current);
    if (!next) break;
    current = next;
  }
  return current;
};

const getStringLiteralText = (expr: TstsNode): string | undefined => {
  const unwrapped = unwrapExpr(expr);
  if (
    TstsSyntax.IsStringLiteral(unwrapped) ||
    TstsSyntax.IsNoSubstitutionTemplateLiteral(unwrapped)
  ) {
    return TstsSyntax.Node_Text(unwrapped);
  }
  return undefined;
};

const inferThisType = (node: TstsNode): IrType | undefined => {
  let current: TstsNode | undefined = node;

  while (current) {
    if (
      TstsSyntax.IsClassDeclaration(current) ||
      TstsSyntax.IsClassExpression(current)
    ) {
      const className = getTstsNodeNameText(current);
      if (!className) return undefined;

      const typeArguments = (
        TstsSyntax.Node_TypeParameters(current) ?? []
      ).flatMap((typeParameter): readonly IrType[] => {
        if (!typeParameter) return [];
        const name = getTstsNodeNameText(typeParameter);
        return name ? [{ kind: "typeParameterType", name }] : [];
      });

      return {
        kind: "referenceType",
        name: className,
        ...(typeArguments.length > 0 ? { typeArguments } : {}),
      };
    }

    current = current.Parent;
  }

  return undefined;
};

export const getAccessPathTarget = (
  expr: TstsNode,
  ctx: ProgramContext
): AccessPathTarget | undefined => {
  const candidate = unwrapExpr(expr);

  if (TstsSyntax.IsIdentifier(candidate)) {
    const declId = ctx.binding.resolveIdentifier(candidate);
    if (!declId) return undefined;
    return {
      kind: "decl",
      declId,
      segments: [],
      anchor: candidate,
    };
  }

  if (candidate.Kind === TstsSyntax.KindThisKeyword) {
    return {
      kind: "this",
      segments: [],
      anchor: candidate,
    };
  }

  if (
    TstsSyntax.IsPropertyAccessExpression(candidate)
  ) {
    const expression = TstsSyntax.Node_Expression(candidate);
    if (!expression) return undefined;
    const base = getAccessPathTarget(expression, ctx);
    const segment = getTstsNodeNameText(candidate);
    if (!segment) return undefined;
    if (!base) return undefined;
    return {
      ...base,
      segments: [...base.segments, segment],
      anchor: candidate,
    };
  }

  if (
    TstsSyntax.IsElementAccessExpression(candidate)
  ) {
    const expression = TstsSyntax.Node_Expression(candidate);
    if (!expression) return undefined;
    const base = getAccessPathTarget(expression, ctx);
    const argument = TstsSyntax.AsElementAccessExpression(candidate)
      ?.ArgumentExpression;
    if (!base || !argument) return undefined;
    const propertyName = getStringLiteralText(argument);
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
  expr: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  const target = getAccessPathTarget(expr, ctx);
  if (!target) return undefined;
  return getCurrentTypeForAccessPath(target, ctx);
};

export const hasAccessPathNarrowing = (
  expr: TstsNode,
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
