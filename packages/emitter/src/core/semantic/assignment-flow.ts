import { IrExpression } from "@tsonic/frontend";
import type { EmitterContext, NarrowedBinding } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import { materializeDirectNarrowingAst } from "./materialized-narrowing.js";
import { unwrapParameterModifierType } from "./parameter-modifier-types.js";
import { unwrapTransparentExpression } from "./transparent-expressions.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";
import { isAssignable } from "./index.js";

export type EmitExprAstFn = (
  expr: IrExpression,
  context: EmitterContext
) => [CSharpExpressionAst, EmitterContext];

const isConcreteStorageType = (
  type: IrExpression["inferredType"],
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  switch (resolved.kind) {
    case "unknownType":
    case "anyType":
    case "objectType":
    case "unionType":
    case "intersectionType":
    case "functionType":
    case "typeParameterType":
      return false;
    case "referenceType":
      return resolved.name !== "object";
    default:
      return true;
  }
};

const shouldPreserveConcreteStorageSurface = (
  sourceAst: CSharpExpressionAst,
  materializedAst: CSharpExpressionAst,
  currentType: IrExpression["inferredType"],
  context: EmitterContext
): boolean =>
  isConcreteStorageType(currentType, context) &&
  materializedAst.kind === "castExpression" &&
  materializedAst.expression === sourceAst;

const withoutNarrowedBinding = (
  context: EmitterContext,
  bindingKey: string
): EmitterContext => {
  if (!context.narrowedBindings?.has(bindingKey)) {
    return context;
  }

  const narrowedBindings = new Map(context.narrowedBindings);
  narrowedBindings.delete(bindingKey);
  return {
    ...context,
    narrowedBindings,
  };
};

const tryResolveAssignmentBindingTarget = (
  expr: IrExpression
):
  | {
      readonly bindingKey: string;
      readonly targetExpr: Extract<
        IrExpression,
        { kind: "identifier" | "memberAccess" }
      >;
    }
  | undefined => {
  const target = unwrapTransparentExpression(expr);
  if (target.kind === "identifier") {
    return {
      bindingKey: target.name,
      targetExpr: target,
    };
  }

  if (
    target.kind === "memberAccess" &&
    !target.isComputed &&
    !target.isOptional
  ) {
    const bindingKey = getMemberAccessNarrowKey(target);
    if (!bindingKey) {
      return undefined;
    }

    return {
      bindingKey,
      targetExpr: target,
    };
  }

  return undefined;
};

const resolveAssignmentStorageType = (
  targetExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>,
  context: EmitterContext
): IrExpression["inferredType"] => {
  if (targetExpr.kind === "identifier") {
    return (
      context.localValueTypes?.get(targetExpr.name) ?? targetExpr.inferredType
    );
  }

  return targetExpr.inferredType;
};

export const applyAssignmentStatementNarrowing = (
  expr: IrExpression,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext => {
  if (expr.kind !== "assignment" || expr.operator !== "=") {
    return context;
  }

  if (
    expr.left.kind === "identifierPattern" ||
    expr.left.kind === "arrayPattern" ||
    expr.left.kind === "objectPattern"
  ) {
    return context;
  }

  const bindingTarget = tryResolveAssignmentBindingTarget(expr.left);
  if (!bindingTarget) {
    return context;
  }

  const assignedType =
    resolveEffectiveExpressionType(expr.right, context) ??
    expr.right.inferredType;
  if (!assignedType) {
    return context;
  }

  const currentType =
    resolveEffectiveExpressionType(bindingTarget.targetExpr, context) ??
    bindingTarget.targetExpr.inferredType;
  const storageType =
    resolveAssignmentStorageType(bindingTarget.targetExpr, context) ??
    currentType;

  const comparableAssignedType =
    unwrapParameterModifierType(assignedType) ?? assignedType;
  const comparableStorageType =
    unwrapParameterModifierType(storageType) ?? storageType;

  const [targetExprAst, targetContext] = emitExprAst(
    bindingTarget.targetExpr,
    withoutNarrowedBinding(context, bindingTarget.bindingKey)
  );

  const [materializedExprAst, materializedContext] =
    materializeDirectNarrowingAst(
      targetExprAst,
      comparableStorageType,
      comparableAssignedType,
      targetContext
    );

  const preserveConcreteStorageSurface = shouldPreserveConcreteStorageSurface(
    targetExprAst,
    materializedExprAst,
    comparableStorageType,
    materializedContext
  );
  const preserveReadableMemberSurface =
    bindingTarget.targetExpr.kind === "memberAccess" &&
    isConcreteStorageType(comparableStorageType, materializedContext) &&
    !isAssignable(comparableAssignedType, comparableStorageType);

  const narrowedBindings = new Map(materializedContext.narrowedBindings ?? []);
  const nextBinding: NarrowedBinding = {
    kind: "expr",
    exprAst:
      preserveConcreteStorageSurface || preserveReadableMemberSurface
        ? targetExprAst
        : materializedExprAst,
    storageExprAst: targetExprAst,
    type:
      preserveConcreteStorageSurface || preserveReadableMemberSurface
        ? comparableStorageType
        : comparableAssignedType,
    sourceType: comparableStorageType,
  };
  narrowedBindings.set(bindingTarget.bindingKey, nextBinding);

  return {
    ...materializedContext,
    narrowedBindings,
  };
};
