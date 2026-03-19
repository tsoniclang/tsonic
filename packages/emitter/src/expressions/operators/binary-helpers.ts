/**
 * Binary operator helper functions — narrowing targets, comparison type
 * resolution, and nullish comparison context building.
 *
 * Extracted from binary-emitter.ts — contains the helper functions used
 * by the main emitBinary dispatcher.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import {
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import {
  willCarryAsRuntimeUnion,
} from "../../core/semantic/union-semantics.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { isIntegerType } from "../../core/semantic/index.js";
import {
  unwrapTransparentExpression,
  unwrapTransparentNarrowingTarget,
} from "../../core/semantic/transparent-expressions.js";
import {
  isCharType,
} from "./helpers.js";

export const getNarrowingTargetKey = (expr: IrExpression): string | undefined => {
  const target = unwrapTransparentExpression(expr);
  switch (target.kind) {
    case "identifier":
      return target.name;

    case "memberAccess": {
      if (target.isComputed || typeof target.property !== "string") {
        return undefined;
      }
      const parentKey = getNarrowingTargetKey(target.object);
      return parentKey ? `${parentKey}.${target.property}` : undefined;
    }

    default:
      return undefined;
  }
};

export const getTransparentComparisonTarget = (expr: IrExpression): IrExpression =>
  unwrapTransparentNarrowingTarget(expr) ?? unwrapTransparentExpression(expr);

export const resolveComparisonOperandType = (
  expr: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  const target = getTransparentComparisonTarget(expr);
  if (target.kind === "identifier") {
    const storageType = context.localValueTypes?.get(target.name);
    if (storageType) {
      return storageType;
    }
  }
  return resolveEffectiveExpressionType(target, context) ?? target.inferredType;
};

export const isNumericOperandType = (type: IrType | undefined): boolean => {
  if (!type) {
    return false;
  }

  const widened = widenLiteralComparisonType(type);
  if (widened?.kind === "primitiveType" && widened.name === "number") {
    return true;
  }

  return isIntegerType(widened);
};

export const widenLiteralComparisonType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type || type.kind !== "literalType") {
    return type;
  }

  switch (typeof type.value) {
    case "boolean":
      return { kind: "primitiveType", name: "boolean" };
    case "string":
      return { kind: "primitiveType", name: "string" };
    case "number":
      return { kind: "primitiveType", name: "number" };
    default:
      return type;
  }
};

const hasRuntimeUnionCarrier = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }
  return willCarryAsRuntimeUnion(stripNullish(type), context);
};

export const chooseComparisonExpectedType = (
  ownType: IrType | undefined,
  otherType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (
    isCharType(ownType) &&
    otherType?.kind === "literalType" &&
    typeof otherType.value === "string" &&
    otherType.value.length === 1
  ) {
    return undefined;
  }

  const widenedOtherType = widenLiteralComparisonType(otherType);
  if (
    isCharType(ownType) &&
    widenedOtherType?.kind === "primitiveType" &&
    widenedOtherType.name === "string"
  ) {
    return undefined;
  }

  const ownHasRuntimeUnionCarrier = hasRuntimeUnionCarrier(ownType, context);
  const otherHasRuntimeUnionCarrier = hasRuntimeUnionCarrier(
    widenedOtherType,
    context
  );

  if (!ownHasRuntimeUnionCarrier && otherHasRuntimeUnionCarrier) {
    return undefined;
  }

  if (ownHasRuntimeUnionCarrier && !otherHasRuntimeUnionCarrier) {
    return widenedOtherType;
  }

  return widenedOtherType;
};

export const buildNullishComparisonContext = (
  expr: IrExpression,
  context: EmitterContext
): EmitterContext => {
  const targetKey = getNarrowingTargetKey(expr);
  if (!targetKey) return context;

  const narrowed = context.narrowedBindings?.get(targetKey);
  if (!narrowed || narrowed.kind !== "expr") {
    return context;
  }

  const next = new Map(context.narrowedBindings);
  next.delete(targetKey);
  return {
    ...context,
    narrowedBindings: next,
  };
};
