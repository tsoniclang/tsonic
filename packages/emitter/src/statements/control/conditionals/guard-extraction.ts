/**
 * Guard extraction and typeof refinement helpers for if-statement emission.
 */

import {
  IrExpression,
  IrStatement,
  IrType,
  normalizedUnionType,
} from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../../core/semantic/type-resolution.js";
import { isAssignable } from "../../../core/semantic/index.js";
import { unwrapTransparentNarrowingTarget } from "../../../core/semantic/transparent-expressions.js";
import { getMemberAccessNarrowKey } from "../../../core/semantic/narrowing-keys.js";

export const isArrayLikeNarrowingCandidate = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType" || resolved.kind === "tupleType") {
    return true;
  }
  if (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" || resolved.name === "ReadonlyArray")
  ) {
    return true;
  }
  return false;
};

export const narrowTypeByArrayShape = (
  currentType: IrType | undefined,
  wantArray: boolean,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(currentType), context);
  if (resolved.kind === "unionType") {
    const kept = resolved.types.filter((member): member is IrType => {
      if (!member) return false;
      const isArrayLike = isArrayLikeNarrowingCandidate(member, context);
      return wantArray ? isArrayLike : !isArrayLike;
    });
    const narrowed = kept;
    if (narrowed.length === 0) return undefined;
    if (narrowed.length === 1) return narrowed[0];
    return normalizedUnionType(narrowed);
  }

  const isArrayLike = isArrayLikeNarrowingCandidate(resolved, context);
  if (wantArray) {
    return isArrayLike ? resolved : undefined;
  }
  return isArrayLike ? undefined : resolved;
};

export const narrowTypeByNotAssignableTarget = (
  currentType: IrType | undefined,
  targetType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType || !targetType) return undefined;

  const resolvedCurrent = resolveTypeAlias(stripNullish(currentType), context);
  const resolvedTarget = resolveTypeAlias(stripNullish(targetType), context);

  if (resolvedCurrent.kind === "unionType") {
    const kept = resolvedCurrent.types.filter((member): member is IrType => {
      if (!member) return false;
      const resolvedMember = resolveTypeAlias(stripNullish(member), context);
      return !isAssignable(resolvedMember, resolvedTarget);
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return isAssignable(resolvedCurrent, resolvedTarget)
    ? undefined
    : resolvedCurrent;
};

export const tryExtractArrayIsArrayGuard = (
  condition: Extract<IrStatement, { kind: "ifStatement" }>["condition"]
):
  | {
      readonly originalName: string;
      readonly targetExpr: Extract<
        IrExpression,
        { kind: "identifier" | "memberAccess" }
      >;
      readonly narrowsInThen: boolean;
    }
  | undefined => {
  const extractDirect = (
    expr: typeof condition
  ):
    | {
        readonly originalName: string;
        readonly targetExpr: Extract<
          IrExpression,
          { kind: "identifier" | "memberAccess" }
        >;
        readonly narrowsInThen: boolean;
      }
    | undefined => {
    if (expr.kind !== "call") return undefined;
    if (expr.arguments.length !== 1) return undefined;
    if (expr.callee.kind !== "memberAccess" || expr.callee.isComputed) {
      return undefined;
    }
    if (expr.callee.property !== "isArray") return undefined;
    if (
      expr.callee.object.kind !== "identifier" ||
      expr.callee.object.name !== "Array"
    ) {
      return undefined;
    }

    const [rawTarget] = expr.arguments;
    if (!rawTarget) return undefined;
    const target = unwrapTransparentNarrowingTarget(rawTarget);
    if (!target) return undefined;

    const originalName =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!originalName) return undefined;

    return {
      originalName,
      targetExpr: target,
      narrowsInThen: true,
    };
  };

  const direct = extractDirect(condition);
  if (direct) return direct;

  if (condition.kind === "unary" && condition.operator === "!") {
    const inner = extractDirect(condition.expression);
    if (inner) {
      return {
        ...inner,
        narrowsInThen: false,
      };
    }
  }

  return undefined;
};

export const tryExtractDirectTypeofGuard = (
  expr: Extract<IrStatement, { kind: "ifStatement" }>["condition"]
):
  | {
      readonly bindingKey: string;
      readonly targetExpr: Extract<
        IrExpression,
        { kind: "identifier" | "memberAccess" }
      >;
      readonly tag: string;
      readonly matchesInTruthyBranch: boolean;
    }
  | undefined => {
  if (expr.kind !== "binary") return undefined;
  if (
    expr.operator !== "===" &&
    expr.operator !== "==" &&
    expr.operator !== "!==" &&
    expr.operator !== "!="
  ) {
    return undefined;
  }

  const extract = (
    left: typeof expr.left,
    right: typeof expr.right
  ):
    | {
        readonly bindingKey: string;
        readonly targetExpr: Extract<
          IrExpression,
          { kind: "identifier" | "memberAccess" }
        >;
        readonly tag: string;
      }
    | undefined => {
    if (left.kind !== "unary" || left.operator !== "typeof") return undefined;
    const target = unwrapTransparentNarrowingTarget(left.expression);
    if (!target) return undefined;
    if (right.kind !== "literal" || typeof right.value !== "string") {
      return undefined;
    }
    const bindingKey =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!bindingKey) return undefined;
    return {
      bindingKey,
      targetExpr: target,
      tag: right.value,
    };
  };

  const directGuard =
    extract(expr.left, expr.right) ?? extract(expr.right, expr.left);
  if (!directGuard) return undefined;

  return {
    ...directGuard,
    matchesInTruthyBranch: expr.operator === "===" || expr.operator === "==",
  };
};
