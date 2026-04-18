import {
  runtimeUnionCarrierFamilyKey,
  stableIrTypeKey,
  type IrExpression,
  type IrType,
} from "@tsonic/frontend";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import {
  getPropertyType,
  resolveTypeAlias,
  stripNullish,
} from "./type-resolution.js";
import type { EmitterContext } from "../../types.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import { getCanonicalRuntimeUnionMembers } from "./runtime-unions.js";
import { getRuntimeUnionReferenceMembers } from "./runtime-union-shared.js";
import { isAssignable } from "./type-compatibility.js";

const withOptionalUndefined = (type: IrType): IrType => {
  if (
    type.kind === "unionType" &&
    type.types.some(
      (member) => member.kind === "primitiveType" && member.name === "undefined"
    )
  ) {
    return type;
  }

  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

const maybeWrapOptionalMemberAccessType = (
  expr: IrExpression,
  type: IrType | undefined
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  if (expr.kind !== "memberAccess" || !expr.isOptional) {
    return type;
  }

  return withOptionalUndefined(type);
};

const unwrapProjectionAst = (
  exprAst: CSharpExpressionAst
): CSharpExpressionAst => {
  let target: CSharpExpressionAst = exprAst;
  while (
    target.kind === "parenthesizedExpression" ||
    target.kind === "castExpression"
  ) {
    target = target.expression;
  }
  return target;
};

const tryResolveIdentifierExpressionType = (
  identifier: string,
  context: EmitterContext
): IrType | undefined => {
  const direct =
    context.localSemanticTypes?.get(identifier) ??
    context.localValueTypes?.get(identifier);
  if (direct) {
    return direct;
  }

  for (const [sourceName, emittedName] of context.localNameMap ?? []) {
    if (emittedName === identifier) {
      return (
        context.localSemanticTypes?.get(sourceName) ??
        context.localValueTypes?.get(sourceName)
      );
    }
  }

  return undefined;
};

const runtimeCarrierFamilyForType = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return resolved.kind === "unionType"
    ? runtimeUnionCarrierFamilyKey(resolved)
    : undefined;
};

const projectionCarrierTypesMatch = (
  baseType: IrType,
  receiverType: IrType,
  context: EmitterContext
): boolean => {
  const baseFamily = runtimeCarrierFamilyForType(baseType, context);
  const receiverFamily = runtimeCarrierFamilyForType(receiverType, context);
  if (baseFamily || receiverFamily) {
    return baseFamily !== undefined && baseFamily === receiverFamily;
  }

  return (
    stableIrTypeKey(stripNullish(baseType)) ===
    stableIrTypeKey(stripNullish(receiverType))
  );
};

const tryResolveProjectionReceiverType = (
  receiverAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const receiver = unwrapProjectionAst(receiverAst);
  if (receiver.kind !== "identifierExpression") {
    return undefined;
  }

  return tryResolveIdentifierExpressionType(receiver.identifier, context);
};

const tryExtractRuntimeUnionProjection = (
  exprAst: CSharpExpressionAst
):
  | { readonly memberN: number; readonly receiverAst?: CSharpExpressionAst }
  | undefined => {
  const target = unwrapProjectionAst(exprAst);
  if (target.kind !== "invocationExpression") {
    return undefined;
  }
  if (target.expression.kind !== "memberAccessExpression") {
    return undefined;
  }

  if (target.arguments.length === 0) {
    const match = target.expression.memberName.match(/^As(\d+)$/);
    if (!match?.[1]) {
      return undefined;
    }

    return {
      memberN: Number.parseInt(match[1], 10),
      receiverAst: target.expression.expression,
    };
  }

  if (target.expression.memberName !== "Match") {
    return undefined;
  }

  let projectedMemberIndex: number | undefined;

  for (let index = 0; index < target.arguments.length; index += 1) {
    const lambda = target.arguments[index];
    if (!lambda || lambda.kind !== "lambdaExpression") {
      return undefined;
    }

    const parameterName = lambda.parameters[0]?.name;
    if (!parameterName) {
      return undefined;
    }

    let body = lambda.body;
    while (
      body.kind === "parenthesizedExpression" ||
      body.kind === "castExpression"
    ) {
      body = body.expression;
    }

    if (
      body.kind === "identifierExpression" &&
      body.identifier === parameterName
    ) {
      if (projectedMemberIndex !== undefined) {
        return undefined;
      }
      projectedMemberIndex = index + 1;
      continue;
    }

    if (body.kind === "throwExpression") {
      continue;
    }

    return undefined;
  }

  return projectedMemberIndex
    ? {
        memberN: projectedMemberIndex,
        receiverAst: target.expression.expression,
      }
    : undefined;
};

export const tryResolveRuntimeUnionMemberType = (
  baseType: IrType | undefined,
  exprAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  if (!baseType) return undefined;

  const projection = tryExtractRuntimeUnionProjection(exprAst);
  if (!projection) return undefined;

  const receiverType = projection.receiverAst
    ? tryResolveProjectionReceiverType(projection.receiverAst, context)
    : undefined;
  if (
    receiverType &&
    !projectionCarrierTypesMatch(baseType, receiverType, context)
  ) {
    return undefined;
  }

  const { memberN } = projection;

  const canonicalRuntimeMembers = getCanonicalRuntimeUnionMembers(
    baseType,
    context
  );
  if (
    canonicalRuntimeMembers &&
    memberN >= 1 &&
    memberN <= canonicalRuntimeMembers.length
  ) {
    return canonicalRuntimeMembers[memberN - 1];
  }

  const resolvedBase = resolveTypeAlias(stripNullish(baseType), context);
  if (resolvedBase.kind === "unionType") {
    return resolvedBase.types[memberN - 1];
  }

  if (resolvedBase.kind === "referenceType") {
    const runtimeMembers = getRuntimeUnionReferenceMembers(resolvedBase);
    if (runtimeMembers && memberN <= runtimeMembers.length) {
      return runtimeMembers[memberN - 1];
    }
  }

  return undefined;
};

export const resolveEffectiveExpressionType = (
  expr: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind === "typeAssertion" || expr.kind === "asinterface") {
    return expr.targetType;
  }

  if (expr.kind === "trycast") {
    return expr.targetType;
  }

  if (expr.kind === "defaultof") {
    return expr.targetType;
  }

  if (expr.kind === "logical" && expr.operator === "??") {
    const leftType =
      resolveEffectiveExpressionType(expr.left, context) ??
      expr.left.inferredType;
    const rightType =
      resolveEffectiveExpressionType(expr.right, context) ??
      expr.right.inferredType;

    if (!leftType) {
      return rightType;
    }

    const nonNullishLeft = stripNullish(leftType) ?? leftType;
    if (!rightType) {
      return nonNullishLeft;
    }

    if (stableIrTypeKey(nonNullishLeft) === stableIrTypeKey(rightType)) {
      return nonNullishLeft;
    }

    if (isAssignable(rightType, nonNullishLeft)) {
      return nonNullishLeft;
    }

    if (isAssignable(nonNullishLeft, rightType)) {
      return rightType;
    }
  }

  const baseType = expr.inferredType;
  const registeredSemanticType =
    expr.kind === "identifier"
      ? context.localSemanticTypes?.get(expr.name)
      : undefined;
  if (!context.narrowedBindings) {
    if (
      expr.kind === "memberAccess" &&
      !expr.isComputed &&
      typeof expr.property === "string"
    ) {
      const narrowedReceiverType = resolveEffectiveExpressionType(
        expr.object,
        context
      );
      const narrowedPropertyType = getPropertyType(
        narrowedReceiverType,
        expr.property,
        context
      );
      if (narrowedPropertyType) {
        return maybeWrapOptionalMemberAccessType(expr, narrowedPropertyType);
      }
    }
    return maybeWrapOptionalMemberAccessType(
      expr,
      registeredSemanticType ?? baseType
    );
  }

  const narrowKey =
    expr.kind === "identifier"
      ? expr.name
      : expr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(expr)
        : undefined;

  if (!narrowKey) {
    if (
      expr.kind === "memberAccess" &&
      !expr.isComputed &&
      typeof expr.property === "string"
    ) {
      const narrowedReceiverType = resolveEffectiveExpressionType(
        expr.object,
        context
      );
      const narrowedPropertyType = getPropertyType(
        narrowedReceiverType,
        expr.property,
        context
      );
      if (narrowedPropertyType) {
        return maybeWrapOptionalMemberAccessType(expr, narrowedPropertyType);
      }
    }
    return maybeWrapOptionalMemberAccessType(
      expr,
      registeredSemanticType ?? baseType
    );
  }

  const narrowed = context.narrowedBindings.get(narrowKey);
  if (!narrowed) {
    if (
      expr.kind === "memberAccess" &&
      !expr.isComputed &&
      typeof expr.property === "string"
    ) {
      const narrowedReceiverType = resolveEffectiveExpressionType(
        expr.object,
        context
      );
      const narrowedPropertyType = getPropertyType(
        narrowedReceiverType,
        expr.property,
        context
      );
      if (narrowedPropertyType) {
        return maybeWrapOptionalMemberAccessType(expr, narrowedPropertyType);
      }
    }
    return maybeWrapOptionalMemberAccessType(
      expr,
      registeredSemanticType ?? baseType
    );
  }

  if (
    narrowed.kind === "rename" ||
    narrowed.kind === "expr" ||
    narrowed.kind === "runtimeSubset"
  ) {
    const sourceType =
      narrowed.sourceType ?? registeredSemanticType ?? baseType;
    const resolvedSource =
      narrowed.kind === "expr"
        ? tryResolveRuntimeUnionMemberType(
            sourceType,
            narrowed.exprAst,
            context
          )
        : undefined;

    if (narrowed.type) {
      return maybeWrapOptionalMemberAccessType(expr, narrowed.type);
    }

    if (resolvedSource) {
      return maybeWrapOptionalMemberAccessType(expr, resolvedSource);
    }
  }

  if (
    expr.kind === "memberAccess" &&
    !expr.isComputed &&
    typeof expr.property === "string"
  ) {
    const narrowedReceiverType = resolveEffectiveExpressionType(
      expr.object,
      context
    );
    const narrowedPropertyType = getPropertyType(
      narrowedReceiverType,
      expr.property,
      context
    );
    if (narrowedPropertyType) {
      return maybeWrapOptionalMemberAccessType(expr, narrowedPropertyType);
    }
  }

  return maybeWrapOptionalMemberAccessType(
    expr,
    registeredSemanticType ?? baseType
  );
};
