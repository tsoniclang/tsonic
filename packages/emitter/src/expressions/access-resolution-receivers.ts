/**
 * Receiver type resolution, array wrapper element type emission,
 * reification, and storage-compatible narrowed member read helpers.
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import type { NarrowedBinding } from "../types.js";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  getArrayLikeElementType,
  getPropertyType,
  normalizeStructuralEmissionType,
  resolveArrayLikeReceiverType,
  resolveStructuralReferenceType,
} from "../core/semantic/type-resolution.js";
import {
  isSystemArrayStorageType,
  resolveBroadArrayReceiverAssertionStorageType,
} from "../core/semantic/broad-array-storage.js";
import {
  identifierExpression,
  identifierType,
} from "../core/format/backend-ast/builders.js";
import { stripNullableTypeAst } from "../core/format/backend-ast/utils.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import { buildRuntimeUnionLayout } from "../core/semantic/runtime-unions.js";
import { tryBuildRuntimeReificationPlan } from "../core/semantic/runtime-reification.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { normalizeRuntimeStorageType } from "../core/semantic/storage-types.js";
import { adaptStorageErasedValueAst } from "../core/semantic/storage-erased-adaptation.js";
import { unwrapTransparentExpression } from "../core/semantic/transparent-expressions.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import {
  isObjectTypeAst,
  isPlainObjectIrType,
} from "./access-resolution-types.js";

const looksLikeTypeParameterName = (name: string): boolean =>
  /^T($|[A-Z0-9_])/.test(name);

const resolveReceiverStorageAst = (
  sourceExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>,
  narrowed: NarrowedBinding | undefined,
  context: EmitterContext
): CSharpExpressionAst | undefined => {
  if (narrowed?.kind === "expr") {
    return narrowed.storageExprAst;
  }

  if (sourceExpr.kind !== "identifier") {
    return undefined;
  }

  return identifierExpression(
    context.localNameMap?.get(sourceExpr.name) ?? escapeCSharpIdentifier(sourceExpr.name)
  );
};

export const eraseOutOfScopeArrayWrapperTypeParameters = (
  typeAst: CSharpTypeAst,
  context: EmitterContext
): CSharpTypeAst => {
  switch (typeAst.kind) {
    case "identifierType": {
      if (
        !typeAst.name.includes(".") &&
        !typeAst.name.includes("::") &&
        (context.typeParameters?.has(typeAst.name) ?? false) === false &&
        looksLikeTypeParameterName(typeAst.name)
      ) {
        return identifierType("object");
      }

      if (!typeAst.typeArguments || typeAst.typeArguments.length === 0) {
        return typeAst;
      }

      return {
        ...typeAst,
        typeArguments: typeAst.typeArguments.map((arg) =>
          eraseOutOfScopeArrayWrapperTypeParameters(arg, context)
        ),
      };
    }

    case "arrayType":
      return {
        ...typeAst,
        elementType: eraseOutOfScopeArrayWrapperTypeParameters(
          typeAst.elementType,
          context
        ),
      };

    case "nullableType":
      return {
        ...typeAst,
        underlyingType: eraseOutOfScopeArrayWrapperTypeParameters(
          typeAst.underlyingType,
          context
        ),
      };

    default:
      return typeAst;
  }
};

export const emitArrayWrapperElementTypeAst = (
  receiverType: IrType | undefined,
  fallbackElementType: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const storageReceiverType = normalizeRuntimeStorageType(
    receiverType,
    context
  );
  const resolvedReceiverType = resolveArrayLikeReceiverType(
    storageReceiverType,
    context
  );

  if (resolvedReceiverType) {
    const [elementTypeAst, nextContext] = emitTypeAst(
      resolvedReceiverType.elementType,
      context
    );
    return [
      eraseOutOfScopeArrayWrapperTypeParameters(elementTypeAst, nextContext),
      nextContext,
    ];
  }

  const [elementTypeAst, nextContext] = emitTypeAst(
    fallbackElementType,
    context
  );
  return [
    eraseOutOfScopeArrayWrapperTypeParameters(elementTypeAst, nextContext),
    nextContext,
  ];
};

export const emitStorageCompatibleArrayWrapperElementTypeAst = (
  receiverExpr: IrExpression,
  receiverType: IrType | undefined,
  fallbackElementType: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const [storageReceiverTypeAst, storageContext] =
    resolveEmittedReceiverTypeAst(receiverExpr, context);
  const concreteStorageReceiverTypeAst = storageReceiverTypeAst
    ? stripNullableTypeAst(storageReceiverTypeAst)
    : undefined;

  if (concreteStorageReceiverTypeAst?.kind === "arrayType") {
    return [
      eraseOutOfScopeArrayWrapperTypeParameters(
        concreteStorageReceiverTypeAst.elementType,
        storageContext
      ),
      storageContext,
    ];
  }

  if (
    concreteStorageReceiverTypeAst?.kind === "identifierType" &&
    (concreteStorageReceiverTypeAst.name === "global::System.Array" ||
      concreteStorageReceiverTypeAst.name === "System.Array") &&
    concreteStorageReceiverTypeAst.typeArguments?.length === 1
  ) {
    const [elementTypeAst] = concreteStorageReceiverTypeAst.typeArguments;
    if (elementTypeAst) {
      return [
        eraseOutOfScopeArrayWrapperTypeParameters(
          elementTypeAst,
          storageContext
        ),
        storageContext,
      ];
    }
  }

  return emitArrayWrapperElementTypeAst(
    receiverType,
    fallbackElementType,
    storageContext
  );
};

export const maybeReifyErasedArrayElement = (
  accessAst: CSharpExpressionAst,
  receiverExpr: IrExpression,
  desiredType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const normalizedDesiredType =
    desiredType && desiredType.kind === "objectType"
      ? (resolveStructuralReferenceType(desiredType, context) ?? desiredType)
      : desiredType;

  if (
    !normalizedDesiredType ||
    isPlainObjectIrType(normalizedDesiredType, context)
  ) {
    return [accessAst, context];
  }

  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    receiverExpr,
    context
  );
  if (!receiverTypeAst) {
    return [accessAst, receiverTypeContext];
  }
  const concreteReceiverTypeAst = stripNullableTypeAst(receiverTypeAst);
  if (concreteReceiverTypeAst.kind !== "arrayType") {
    return [accessAst, receiverTypeContext];
  }
  const concreteElementTypeAst = stripNullableTypeAst(
    concreteReceiverTypeAst.elementType
  );
  if (!isObjectTypeAst(concreteElementTypeAst)) {
    return [accessAst, receiverTypeContext];
  }

  const plan = tryBuildRuntimeReificationPlan(
    accessAst,
    normalizedDesiredType,
    receiverTypeContext,
    emitTypeAst
  );
  if (!plan) {
    return [accessAst, receiverTypeContext];
  }

  return [plan.value, plan.context];
};

export const maybeReifyStorageErasedMemberRead = (
  accessAst: CSharpExpressionAst,
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType || expr.isComputed || typeof expr.property !== "string") {
    return [accessAst, context];
  }

  const semanticType = resolveEffectiveExpressionType(expr, context);
  const storageType =
    normalizeRuntimeStorageType(
      getPropertyType(
        resolveEffectiveExpressionType(expr.object, context),
        expr.property,
        context
      ) ?? expr.inferredType,
      context
    ) ?? expr.inferredType;

  const adapted = adaptStorageErasedValueAst({
    valueAst: accessAst,
    semanticType,
    storageType,
    expectedType,
    context,
    emitTypeAst,
  });
  return adapted ?? [accessAst, context];
};

export const tryEmitStorageCompatibleNarrowedMemberRead = (
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    !expectedType ||
    !narrowed.storageExprAst ||
    typeof expr.property !== "string"
  ) {
    return undefined;
  }

  const storageType =
    normalizeRuntimeStorageType(
      getPropertyType(
        resolveEffectiveExpressionType(expr.object, context),
        expr.property,
        context
      ) ?? expr.inferredType,
      context
    ) ?? expr.inferredType;

  if (
    !storageType ||
    !matchesExpectedEmissionType(storageType, expectedType, context)
  ) {
    return undefined;
  }

  return maybeReifyStorageErasedMemberRead(
    narrowed.storageExprAst,
    expr,
    context,
    expectedType
  );
};

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

const tryResolveEmittedRuntimeUnionMemberTypeAst = (
  baseType: IrType | undefined,
  exprAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] => {
  if (!baseType) return [undefined, context];

  const memberN = tryExtractRuntimeUnionMemberN(exprAst);
  if (!memberN) return [undefined, context];

  const [layout, layoutContext] = buildRuntimeUnionLayout(
    baseType,
    context,
    emitTypeAst
  );
  if (!layout) {
    return [undefined, context];
  }
  const members = layout.members;

  const memberIndex = memberN - 1;
  if (memberIndex < 0 || memberIndex >= members.length) {
    return [undefined, context];
  }

  const memberType = members[memberIndex];
  if (!memberType) {
    return [undefined, context];
  }

  const storageMemberType =
    normalizeRuntimeStorageType(memberType, layoutContext) ?? memberType;
  return emitTypeAst(
    normalizeStructuralEmissionType(storageMemberType, layoutContext),
    layoutContext
  );
};

export const resolveEffectiveReceiverType = (
  receiverExpr: IrExpression,
  context: EmitterContext
): IrType | undefined => resolveEffectiveExpressionType(receiverExpr, context);

const tryResolveBroadArrayAssertionReceiverTypeAst = (
  receiverExpr: IrExpression,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] | undefined => {
  const resolveSourceInfo = (
    sourceExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>
  ) => {
    const narrowKey =
      sourceExpr.kind === "identifier"
        ? sourceExpr.name
        : getMemberAccessNarrowKey(sourceExpr);
    const narrowed = narrowKey
      ? context.narrowedBindings?.get(narrowKey)
      : undefined;
    const sourceStorageType =
      narrowed?.kind === "expr"
        ? narrowed.storageType ?? narrowed.sourceType ?? narrowed.type
        : sourceExpr.kind === "identifier"
          ? context.localValueTypes?.get(sourceExpr.name)
          : undefined;
    const sourceStorageAst =
      resolveReceiverStorageAst(sourceExpr, narrowed, context);

    return { narrowed, sourceStorageType, sourceStorageAst };
  };

  const resolvePreservedStorageType = () => {
    if (receiverExpr.kind === "typeAssertion") {
      const sourceExpr = unwrapTransparentExpression(receiverExpr.expression);
      if (sourceExpr.kind !== "identifier" && sourceExpr.kind !== "memberAccess") {
        return undefined;
      }

      const { sourceStorageType } = resolveSourceInfo(sourceExpr);
      return resolveBroadArrayReceiverAssertionStorageType(
        receiverExpr.targetType,
        sourceStorageType,
        context
      );
    }

    if (receiverExpr.kind !== "identifier" && receiverExpr.kind !== "memberAccess") {
      return undefined;
    }

    const targetType =
      resolveEffectiveExpressionType(receiverExpr, context) ??
      receiverExpr.inferredType;
    const { sourceStorageType } = resolveSourceInfo(receiverExpr);
    return resolveBroadArrayReceiverAssertionStorageType(
      targetType,
      sourceStorageType,
      context
    );
  };

  const preservedStorageType = resolvePreservedStorageType();
  if (!preservedStorageType) {
    return undefined;
  }

  if (isSystemArrayStorageType(preservedStorageType, context)) {
    return [identifierType("global::System.Array"), context];
  }

  return emitTypeAst(preservedStorageType, context);
};

export const tryEmitBroadArrayAssertionReceiverStorageAst = (
  receiverExpr: IrExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const sourceExpr =
    receiverExpr.kind === "typeAssertion"
      ? unwrapTransparentExpression(receiverExpr.expression)
      : receiverExpr;
  if (sourceExpr.kind !== "identifier" && sourceExpr.kind !== "memberAccess") {
    return undefined;
  }

  const targetType =
    receiverExpr.kind === "typeAssertion"
      ? receiverExpr.targetType
      : resolveEffectiveExpressionType(receiverExpr, context) ??
        receiverExpr.inferredType;
  const narrowKey =
    sourceExpr.kind === "identifier"
      ? sourceExpr.name
      : getMemberAccessNarrowKey(sourceExpr);
  const narrowed = narrowKey
    ? context.narrowedBindings?.get(narrowKey)
    : undefined;
  const sourceStorageType =
    narrowed?.kind === "expr"
      ? narrowed.storageType ?? narrowed.sourceType ?? narrowed.type
      : sourceExpr.kind === "identifier"
        ? context.localValueTypes?.get(sourceExpr.name)
        : undefined;
  const preservedStorageType =
    resolveBroadArrayReceiverAssertionStorageType(
      targetType,
      sourceStorageType,
      context
    );
  if (!preservedStorageType) {
    return undefined;
  }

  const sourceStorageAst =
    resolveReceiverStorageAst(sourceExpr, narrowed, context);
  if (!sourceStorageAst) {
    return undefined;
  }

  const [typeAst, nextContext] = isSystemArrayStorageType(
    preservedStorageType,
    context
  )
    ? [identifierType("global::System.Array"), context]
    : emitTypeAst(preservedStorageType, context);
  return [
    {
      kind: "castExpression",
      type: typeAst,
      expression: sourceStorageAst,
    },
    nextContext,
  ];
};

export const resolveEmittedReceiverTypeAst = (
  receiverExpr: IrExpression,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] => {
  const preservedBroadArrayAssertion =
    tryResolveBroadArrayAssertionReceiverTypeAst(receiverExpr, context);
  if (preservedBroadArrayAssertion) {
    return preservedBroadArrayAssertion;
  }

  const baseType = receiverExpr.inferredType;
  if (context.narrowedBindings) {
    const narrowKey =
      receiverExpr.kind === "identifier"
        ? receiverExpr.name
        : receiverExpr.kind === "memberAccess"
          ? getMemberAccessNarrowKey(receiverExpr)
          : undefined;

    if (narrowKey) {
      const narrowed = context.narrowedBindings.get(narrowKey);
      if (narrowed?.kind === "expr") {
        if (narrowed.storageType) {
          const normalizedStorageType =
            normalizeStructuralEmissionType(narrowed.storageType, context);
          return emitTypeAst(normalizedStorageType, context);
        }

        const sourceType = narrowed.sourceType ?? baseType;
        const [memberTypeAst, memberContext] =
          tryResolveEmittedRuntimeUnionMemberTypeAst(
            sourceType,
            narrowed.exprAst,
            context
          );
        if (memberTypeAst) {
          return [memberTypeAst, memberContext];
        }

        if (narrowed.type) {
          const storageNarrowedType =
            normalizeRuntimeStorageType(narrowed.type, context) ??
            narrowed.type;
          return emitTypeAst(
            normalizeStructuralEmissionType(storageNarrowedType, context),
            context
          );
        }

      }
    }
  }

  const receiverType = resolveEffectiveReceiverType(receiverExpr, context);
  if (!receiverType) {
    return [undefined, context];
  }

  const normalizedReceiverType =
    normalizeRuntimeStorageType(receiverType, context) ?? receiverType;
  const arrayLikeElementType = getArrayLikeElementType(
    normalizedReceiverType,
    context
  );
  if (arrayLikeElementType) {
    const [elementTypeAst, elementContext] = emitTypeAst(
      normalizeStructuralEmissionType(arrayLikeElementType, context),
      context
    );
    const storageCompatibleElementTypeAst =
      eraseOutOfScopeArrayWrapperTypeParameters(elementTypeAst, elementContext);
    return [
      {
        kind: "arrayType",
        elementType: storageCompatibleElementTypeAst,
        rank: 1,
      },
      elementContext,
    ];
  }

  return emitTypeAst(
    normalizeStructuralEmissionType(normalizedReceiverType, context),
    context
  );
};
