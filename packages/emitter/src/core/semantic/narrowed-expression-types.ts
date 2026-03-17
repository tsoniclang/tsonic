import type { IrExpression, IrType } from "@tsonic/frontend";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import {
  getPropertyType,
  resolveTypeAlias,
  stripNullish,
} from "./type-resolution.js";
import type { EmitterContext } from "../../types.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";

const tryExtractRuntimeUnionMemberN = (
  exprAst: CSharpExpressionAst
): number | undefined => {
  const target =
    exprAst.kind === "parenthesizedExpression" ? exprAst.expression : exprAst;
  if (target.kind !== "invocationExpression" || target.arguments.length !== 0) {
    return undefined;
  }
  if (target.expression.kind !== "memberAccessExpression") {
    return undefined;
  }

  const match = target.expression.memberName.match(/^As(\d+)$/);
  if (!match?.[1]) {
    return undefined;
  }

  return Number.parseInt(match[1], 10);
};

const getRuntimeUnionReferenceMembers = (
  type: Extract<IrType, { kind: "referenceType" }>
): readonly IrType[] | undefined => {
  if (/^Union[2-8]$/.test(type.name) && type.typeArguments) {
    return type.typeArguments;
  }
  return undefined;
};

export const tryResolveRuntimeUnionMemberType = (
  baseType: IrType | undefined,
  exprAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  if (!baseType) return undefined;

  const memberN = tryExtractRuntimeUnionMemberN(exprAst);
  if (!memberN) return undefined;

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
        return narrowedPropertyType;
      }
    }
    return baseType ?? registeredSemanticType;
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
        return narrowedPropertyType;
      }
    }
    return baseType ?? registeredSemanticType;
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
        return narrowedPropertyType;
      }
    }
    return baseType ?? registeredSemanticType;
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
      return narrowed.type;
    }

    if (resolvedSource) {
      return resolvedSource;
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
      return narrowedPropertyType;
    }
  }

  return baseType ?? registeredSemanticType;
};
