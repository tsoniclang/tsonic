/**
 * Type-assertion and cast-family expression emitters: typeAssertion (as T),
 * trycast, asinterface, numericNarrowing, stackalloc, defaultof, nameof, sizeof.
 */

import {
  IrExpression,
  IrType,
  IrNumericNarrowingExpression,
  IrTypeAssertionExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
  IrDefaultOfExpression,
  IrNameOfExpression,
  IrSizeOfExpression,
} from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  substituteTypeArgs,
  isCompilerGeneratedStructuralReferenceType,
  isTypeOnlyStructuralTarget,
  resolveStructuralReferenceType,
} from "../core/semantic/type-resolution.js";
import {
  isSemanticUnion,
  willCarryAsRuntimeUnion,
} from "../core/semantic/union-semantics.js";
import {
  buildRuntimeUnionLayout,
  emitRuntimeCarrierTypeAst,
} from "../core/semantic/runtime-unions.js";
import { getOrRegisterRuntimeUnionCarrier } from "../core/semantic/runtime-union-registry.js";
import {
  buildRuntimeUnionFactoryCallAst,
  buildRuntimeUnionMatchAst,
} from "../core/semantic/runtime-union-projection.js";
import { resolveIdentifierValueSurfaceType } from "../core/semantic/direct-value-surfaces.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { unwrapTransparentExpression } from "../core/semantic/transparent-expressions.js";
import { resolveRuntimeMaterializationTargetType } from "../core/semantic/runtime-materialization-targets.js";
import { areIrTypesEquivalent } from "../core/semantic/type-equivalence.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  stripNullableTypeAst,
  getIdentifierTypeName,
} from "../core/format/backend-ast/utils.js";
import {
  identifierType,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { resolveComparableType } from "../core/semantic/comparable-types.js";
import { matchesEmittedStorageSurface } from "./identifier-storage.js";
import { adaptValueToExpectedTypeAst } from "./expected-type-adaptation.js";
import { isExactExpressionToType } from "./exact-comparison.js";
import { isExactArrayCreationToType } from "./exact-comparison.js";
import { tryAdaptStructuralCollectionExpressionAst } from "./structural-collection-adaptation.js";
import {
  resolveBroadArrayAssertionStorageType,
} from "../core/semantic/broad-array-storage.js";

// ---------------------------------------------------------------------------
// Polymorphic-this helpers (used by orchestrator and emitTypeAssertion)
// ---------------------------------------------------------------------------

export const POLYMORPHIC_THIS_MARKER = "__tsonic_polymorphic_this";

export const isPolymorphicThisType = (type: IrType | undefined): boolean =>
  !!type &&
  ((type.kind === "typeParameterType" &&
    type.name === POLYMORPHIC_THIS_MARKER) ||
    (type.kind === "referenceType" && type.name === POLYMORPHIC_THIS_MARKER));

export const isSuperMemberCallExpression = (expr: IrExpression): boolean =>
  expr.kind === "call" &&
  expr.callee.kind === "memberAccess" &&
  expr.callee.object.kind === "identifier" &&
  expr.callee.object.name === "super";

// ---------------------------------------------------------------------------
// Narrowed-binding helpers
// ---------------------------------------------------------------------------

export const getNarrowedBindingForExpression = (
  expr: IrExpression,
  context: EmitterContext
) => {
  if (!context.narrowedBindings) {
    return undefined;
  }

  const narrowKey =
    expr.kind === "identifier"
      ? expr.name
      : expr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(expr)
        : undefined;

  return narrowKey ? context.narrowedBindings.get(narrowKey) : undefined;
};

export const withoutNarrowedBinding = (
  expr: IrExpression,
  context: EmitterContext
): EmitterContext => {
  if (!context.narrowedBindings) {
    return context;
  }

  const narrowKey =
    expr.kind === "identifier"
      ? expr.name
      : expr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(expr)
        : undefined;
  if (!narrowKey || !context.narrowedBindings.has(narrowKey)) {
    return context;
  }

  const narrowedBindings = new Map(context.narrowedBindings);
  narrowedBindings.delete(narrowKey);
  return {
    ...context,
    narrowedBindings,
  };
};

// ---------------------------------------------------------------------------
// Numeric narrowing
// ---------------------------------------------------------------------------

/**
 * Emit a numeric narrowing expression as CSharpExpressionAst.
 */
export const emitNumericNarrowing = (
  expr: IrNumericNarrowingExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (expr.proof !== undefined) {
    if (expr.proof.source.type === "literal") {
      const [innerAst, newContext] = emitExpressionAst(
        expr.expression,
        context,
        expr.inferredType
      );
      return [innerAst, newContext];
    }

    const [innerAst, ctx1] = emitExpressionAst(expr.expression, context);
    const [typeAst, ctx2] = emitTypeAst(expr.inferredType, ctx1);
    return [
      {
        kind: "castExpression",
        type: typeAst,
        expression: innerAst,
      },
      ctx2,
    ];
  }

  throw new Error(
    `Internal error: numericNarrowing without proof reached emitter. ` +
      `Target: ${expr.targetKind}, Expression kind: ${expr.expression.kind}. ` +
      `This indicates a bug in the numeric proof pass - it should have ` +
      `emitted a diagnostic and aborted compilation.`
  );
};

// ---------------------------------------------------------------------------
// Type assertion (as T)
// ---------------------------------------------------------------------------

/**
 * Emit a type assertion expression as CSharpExpressionAst.
 *
 * TypeScript `x as T` becomes C# `(T)x` (throwing cast).
 */
export const emitTypeAssertion = (
  expr: IrTypeAssertionExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const isDegenerateDuplicateUnion = (
    type: IrType | undefined
  ): type is Extract<IrType, { kind: "unionType" }> => {
    if (!type || type.kind !== "unionType" || type.types.length < 2) {
      return false;
    }

    const [first, ...rest] = type.types;
    if (!first) {
      return false;
    }

    return rest.every((member) =>
      areIrTypesEquivalent(member, first, context)
    );
  };

  const maybeAdaptDegenerateDuplicateUnion = (
    valueAst: CSharpExpressionAst,
    actualType: IrType | undefined,
    targetType: IrType
  ): [CSharpExpressionAst, EmitterContext] | undefined => {
    if (
      isDegenerateDuplicateUnion(actualType) &&
      actualType.types.every((member) =>
        areIrTypesEquivalent(member, targetType, context)
      )
    ) {
      const lambdaArgs = actualType.types.map((_, index) => {
        const parameterName = `__tsonic_union_member_${index + 1}`;
        return {
          kind: "lambdaExpression" as const,
          isAsync: false,
          parameters: [{ name: parameterName }],
          body: {
            kind: "identifierExpression" as const,
            identifier: parameterName,
          },
        };
      });

      return [buildRuntimeUnionMatchAst(valueAst, lambdaArgs), context];
    }

    if (
      isDegenerateDuplicateUnion(targetType) &&
      targetType.types.every((member) =>
        actualType ? areIrTypesEquivalent(member, actualType, context) : false
      )
    ) {
      const memberTypeAsts = [];
      let nextContext = context;
      for (const member of targetType.types) {
        const [memberTypeAst, memberContext] = emitTypeAst(member, nextContext);
        memberTypeAsts.push(memberTypeAst);
        nextContext = memberContext;
      }

      const carrier = getOrRegisterRuntimeUnionCarrier(
        memberTypeAsts,
        nextContext.options.runtimeUnionRegistry,
        targetType.runtimeCarrierFamilyKey
          ? {
              familyKey: targetType.runtimeCarrierFamilyKey,
              name: targetType.runtimeCarrierName,
              namespaceName: targetType.runtimeCarrierNamespace,
            }
          : undefined
      );
      const unionTypeAst = identifierType(
        `global::${carrier.fullName}`,
        memberTypeAsts
      );

      return [
        buildRuntimeUnionFactoryCallAst(unionTypeAst, 1, valueAst),
        nextContext,
      ];
    }

    return undefined;
  };

  const transparentSourceExpression = unwrapTransparentExpression(
    expr.expression
  );
  const sourceExpressionTypeAtEntry =
    transparentSourceExpression.kind === "identifier"
      ? (context.localSemanticTypes?.get(transparentSourceExpression.name) ??
        transparentSourceExpression.inferredType)
      : transparentSourceExpression.inferredType;
  const isTransparentFlowAssertion = (() => {
    const inner = expr.expression;
    if (inner.kind !== "identifier" && inner.kind !== "memberAccess") {
      return false;
    }
    if (!expr.sourceSpan || !inner.sourceSpan) {
      return false;
    }
    return (
      expr.sourceSpan.file === inner.sourceSpan.file &&
      expr.sourceSpan.line === inner.sourceSpan.line &&
      expr.sourceSpan.column === inner.sourceSpan.column &&
      expr.sourceSpan.length === inner.sourceSpan.length
    );
  })();

  const resolveLocalTypeAliases = (target: IrType): IrType => {
    if (target.kind === "referenceType" && context.localTypes) {
      const typeInfo = context.localTypes.get(target.name);
      if (typeInfo?.kind === "typeAlias") {
        const substituted =
          target.typeArguments && target.typeArguments.length > 0
            ? substituteTypeArgs(
                typeInfo.type,
                typeInfo.typeParameters,
                target.typeArguments
              )
            : typeInfo.type;
        return resolveLocalTypeAliases(substituted);
      }
    }
    return target;
  };

  const hasConcreteRuntimeCastTarget = (target: IrType): boolean => {
    const structuralReferenceTarget =
      target.kind === "referenceType"
        ? target
        : resolveStructuralReferenceType(target, context);
    if (
      structuralReferenceTarget?.kind === "referenceType" &&
      isCompilerGeneratedStructuralReferenceType(structuralReferenceTarget)
    ) {
      return false;
    }

    try {
      const [targetAst] = emitTypeAst(target, context);
      const concreteTargetAst = stripNullableTypeAst(targetAst);

      switch (concreteTargetAst.kind) {
        case "identifierType":
        case "qualifiedIdentifierType":
        case "arrayType":
        case "pointerType":
        case "tupleType":
          return true;
        case "predefinedType":
          return (
            concreteTargetAst.keyword !== "object" &&
            concreteTargetAst.keyword !== "void"
          );
        default:
          return false;
      }
    } catch {
      return false;
    }
  };

  const shouldEraseTypeAssertion = (resolved: IrType): boolean => {
    if (resolved.kind === "unknownType") {
      return true;
    }

    if (resolved.kind === "neverType" || resolved.kind === "voidType") {
      return true;
    }

    if (resolved.kind === "referenceType" && resolved.typeArguments?.length) {
      const importBinding = context.importBindings?.get(resolved.name);
      const clrName =
        importBinding?.kind === "type"
          ? (getIdentifierTypeName(importBinding.typeAst) ?? "")
          : "";
      if (clrName.endsWith(".ExtensionMethods")) {
        return true;
      }
    }

    if (resolved.kind === "intersectionType") {
      return resolved.types.some(
        (t) => t.kind === "referenceType" && t.name.startsWith("__Ext_")
      );
    }

    if (isTypeOnlyStructuralTarget(resolved, context)) {
      return !hasConcreteRuntimeCastTarget(resolved);
    }

    return false;
  };

  const resolvedAssertionTarget = resolveLocalTypeAliases(expr.targetType);
  const runtimeAssertionTarget = resolveRuntimeMaterializationTargetType(
    resolvedAssertionTarget,
    context
  );
  const involvesDegenerateDuplicateUnion =
    isDegenerateDuplicateUnion(resolvedAssertionTarget) ||
    isDegenerateDuplicateUnion(runtimeAssertionTarget) ||
    isDegenerateDuplicateUnion(sourceExpressionTypeAtEntry) ||
    isDegenerateDuplicateUnion(expectedType);
  const currentTransparentSourceType =
    resolveEffectiveExpressionType(transparentSourceExpression, context) ??
    sourceExpressionTypeAtEntry;
  const sourceNarrowedBinding =
    transparentSourceExpression.kind === "identifier" ||
    transparentSourceExpression.kind === "memberAccess"
      ? getNarrowedBindingForExpression(transparentSourceExpression, context)
      : undefined;
  const narrowedSourceAlreadyMatches =
    !!sourceNarrowedBinding &&
    !!currentTransparentSourceType &&
    (areIrTypesEquivalent(
      currentTransparentSourceType,
      runtimeAssertionTarget,
      context
    ) ||
      matchesExpectedEmissionType(
        currentTransparentSourceType,
        runtimeAssertionTarget,
        context
      ));
  const narrowedArrayCarrierAssertion =
    narrowedSourceAlreadyMatches &&
    sourceNarrowedBinding?.kind === "expr" &&
    runtimeAssertionTarget.kind === "arrayType";
  const transparentPreservesStorageSurface =
    !!currentTransparentSourceType &&
    matchesEmittedStorageSurface(
      currentTransparentSourceType,
      runtimeAssertionTarget,
      context
    )[0];
  const mustPreserveExplicitRuntimeAssertion =
    !!currentTransparentSourceType &&
    willCarryAsRuntimeUnion(currentTransparentSourceType, context) &&
    !willCarryAsRuntimeUnion(runtimeAssertionTarget, context);
  const sourceStorageTypeAtEntry =
    (sourceNarrowedBinding?.kind === "expr"
      ? sourceNarrowedBinding.storageType
      : undefined) ??
    sourceNarrowedBinding?.sourceType ??
    (transparentSourceExpression.kind === "identifier"
      ? resolveIdentifierValueSurfaceType(transparentSourceExpression, context)
      : undefined);
  const preservesStorageSurfaceAtEntry =
    !sourceStorageTypeAtEntry ||
    areIrTypesEquivalent(
      sourceStorageTypeAtEntry,
      runtimeAssertionTarget,
      context
    ) ||
    matchesEmittedStorageSurface(
      sourceStorageTypeAtEntry,
      runtimeAssertionTarget,
      context
    )[0];
  const canPreserveNarrowedProjectionAtEntry =
    !!sourceNarrowedBinding &&
    !preservesStorageSurfaceAtEntry &&
    runtimeAssertionTarget.kind !== "arrayType" &&
    runtimeAssertionTarget.kind !== "dictionaryType" &&
    !willCarryAsRuntimeUnion(runtimeAssertionTarget, context);
  const preservedBroadArrayStorageAtEntry = resolveBroadArrayAssertionStorageType(
    resolvedAssertionTarget,
    sourceStorageTypeAtEntry,
    context,
    sourceNarrowedBinding?.kind === "expr"
      ? sourceNarrowedBinding.type
      : undefined
  );

  if (
    (resolvedAssertionTarget.kind === "primitiveType" &&
      resolvedAssertionTarget.name === "char") ||
    (resolvedAssertionTarget.kind === "referenceType" &&
      resolvedAssertionTarget.name === "char")
  ) {
    return emitExpressionAst(expr.expression, context, resolvedAssertionTarget);
  }

  if (
    narrowedArrayCarrierAssertion &&
    preservesStorageSurfaceAtEntry &&
    !involvesDegenerateDuplicateUnion
  ) {
    return emitExpressionAst(
      transparentSourceExpression,
      context,
      expectedType
    );
  }

  if (
    narrowedSourceAlreadyMatches &&
    (preservesStorageSurfaceAtEntry ||
      canPreserveNarrowedProjectionAtEntry) &&
    !mustPreserveExplicitRuntimeAssertion &&
    !involvesDegenerateDuplicateUnion
  ) {
    return emitExpressionAst(
      transparentSourceExpression,
      context,
      expectedType
    );
  }

  if (
    currentTransparentSourceType &&
    transparentPreservesStorageSurface &&
    preservesStorageSurfaceAtEntry &&
    !mustPreserveExplicitRuntimeAssertion &&
    !involvesDegenerateDuplicateUnion &&
    (areIrTypesEquivalent(
      currentTransparentSourceType,
      runtimeAssertionTarget,
      context
    ) ||
      matchesExpectedEmissionType(
        currentTransparentSourceType,
        runtimeAssertionTarget,
        context
      ))
  ) {
    return emitExpressionAst(
      transparentSourceExpression,
      context,
      expectedType
    );
  }

  if (shouldEraseTypeAssertion(resolvedAssertionTarget)) {
    const erasedSourceExpression = transparentSourceExpression;
    const sourceExpressionType =
      erasedSourceExpression.kind === "identifier"
        ? (context.localSemanticTypes?.get(erasedSourceExpression.name) ??
          erasedSourceExpression.inferredType)
        : erasedSourceExpression.inferredType;
    const effectiveExpressionType = resolveEffectiveExpressionType(
      erasedSourceExpression,
      context
    );
    const preserveNarrowedRuntimeMember =
      (resolvedAssertionTarget.kind === "unknownType" ||
        resolvedAssertionTarget.kind === "anyType" ||
        resolvedAssertionTarget.kind === "objectType" ||
        (resolvedAssertionTarget.kind === "referenceType" &&
          resolvedAssertionTarget.name === "object")) &&
      !!sourceExpressionType &&
      !!effectiveExpressionType &&
      willCarryAsRuntimeUnion(sourceExpressionType, context) &&
      !willCarryAsRuntimeUnion(effectiveExpressionType, context);

    return emitExpressionAst(
      erasedSourceExpression,
      context,
      preserveNarrowedRuntimeMember ? effectiveExpressionType : expectedType
    );
  }

  if (isTransparentFlowAssertion) {
    const transparentSourceType =
      resolveEffectiveExpressionType(expr.expression, context) ??
      sourceExpressionTypeAtEntry;
    const transparentAlreadyMatches =
      !!transparentSourceType &&
      (areIrTypesEquivalent(
        transparentSourceType,
        runtimeAssertionTarget,
        context
      ) ||
        matchesExpectedEmissionType(
          transparentSourceType,
          runtimeAssertionTarget,
          context
        ));

    if (
      transparentAlreadyMatches &&
      preservesStorageSurfaceAtEntry &&
      !mustPreserveExplicitRuntimeAssertion &&
      !involvesDegenerateDuplicateUnion
    ) {
      return emitExpressionAst(expr.expression, context, expectedType);
    }
  }

  const expectedPreservesStorageSurface =
    !!expectedType &&
    !!sourceExpressionTypeAtEntry &&
    matchesEmittedStorageSurface(
      sourceExpressionTypeAtEntry,
      expectedType,
      context
    )[0];

  if (
    expectedType &&
    sourceExpressionTypeAtEntry &&
    expectedPreservesStorageSurface &&
    !mustPreserveExplicitRuntimeAssertion &&
    preservesStorageSurfaceAtEntry &&
    !involvesDegenerateDuplicateUnion &&
    (areIrTypesEquivalent(sourceExpressionTypeAtEntry, expectedType, context) ||
      matchesExpectedEmissionType(
        sourceExpressionTypeAtEntry,
        expectedType,
        context
      ))
  ) {
    return emitExpressionAst(expr.expression, context, expectedType);
  }

  const runtimeEmissionTarget = resolveRuntimeMaterializationTargetType(
    expr.targetType,
    context
  );
  const preserveTransparentFlowNarrowing =
    !!sourceNarrowedBinding && isTransparentFlowAssertion;
  const preserveNarrowedSourceStorage =
    preserveTransparentFlowNarrowing ||
    (!!sourceNarrowedBinding &&
      sourceNarrowedBinding.kind === "expr" &&
      !!sourceNarrowedBinding.storageExprAst &&
      runtimeEmissionTarget.kind === "arrayType") ||
    !!preservedBroadArrayStorageAtEntry ||
    (!!sourceNarrowedBinding &&
      sourceNarrowedBinding.kind !== "runtimeSubset" &&
      willCarryAsRuntimeUnion(runtimeEmissionTarget, context));
  const rawSourceContext =
    transparentSourceExpression.kind === "identifier" ||
    transparentSourceExpression.kind === "memberAccess"
      ? preserveNarrowedSourceStorage
        ? context
        : withoutNarrowedBinding(transparentSourceExpression, context)
      : context;
  const innerExpectedType =
    expr.expression.kind === "array" ||
    expr.expression.kind === "object" ||
    expr.expression.kind === "call" ||
    expr.expression.kind === "functionExpression" ||
    expr.expression.kind === "arrowFunction"
      ? runtimeEmissionTarget
      : undefined;
  const [innerAst, ctx1] = emitExpressionAst(
    expr.expression,
    rawSourceContext,
    innerExpectedType
  );
  const runtimeTarget = resolveRuntimeMaterializationTargetType(
    expr.targetType,
    ctx1
  );
  const sourceCarrierTypeAtEntry =
    sourceStorageTypeAtEntry ?? sourceExpressionTypeAtEntry;
  const sourceCarriesRuntimeUnionAtEntry =
    !!sourceCarrierTypeAtEntry &&
    willCarryAsRuntimeUnion(sourceCarrierTypeAtEntry, ctx1);
  const targetNeedsStructuredReification =
    runtimeTarget.kind === "arrayType" ||
    runtimeTarget.kind === "dictionaryType";
  const mustPreserveDirectStorageCast =
    !preservesStorageSurfaceAtEntry &&
    !willCarryAsRuntimeUnion(runtimeTarget, ctx1) &&
    !sourceCarriesRuntimeUnionAtEntry &&
    !targetNeedsStructuredReification;
  const sourceExpressionType =
    transparentSourceExpression.kind === "identifier"
      ? (ctx1.localSemanticTypes?.get(transparentSourceExpression.name) ??
        (rawSourceContext !== context &&
        !preservesStorageSurfaceAtEntry &&
        sourceStorageTypeAtEntry
          ? sourceStorageTypeAtEntry
          : transparentSourceExpression.inferredType))
      : transparentSourceExpression.inferredType;
  const isSourceUnion = sourceExpressionType
    ? isSemanticUnion(sourceExpressionType, ctx1)
    : false;
  const [sourceRuntimeUnionLayout, sourceLayoutContext] =
    isSourceUnion && sourceExpressionType
      ? buildRuntimeUnionLayout(sourceExpressionType, ctx1, emitTypeAst)
      : [undefined, ctx1];
  const activeNarrowedBinding = getNarrowedBindingForExpression(
    transparentSourceExpression,
    sourceLayoutContext
  );
  const strippedSourceNarrowing =
    rawSourceContext !== context &&
    !!sourceNarrowedBinding?.sourceType &&
    !!sourceRuntimeUnionLayout;
  const actualExpressionType =
    sourceRuntimeUnionLayout &&
    (activeNarrowedBinding?.kind === "runtimeSubset" || strippedSourceNarrowing)
      ? (sourceNarrowedBinding?.sourceType ?? sourceExpressionType)
      : resolveEffectiveExpressionType(
          transparentSourceExpression,
          sourceLayoutContext
        );
  const preservedBroadArrayStorageType = resolveBroadArrayAssertionStorageType(
    resolvedAssertionTarget,
    sourceStorageTypeAtEntry,
    sourceLayoutContext,
    sourceNarrowedBinding?.kind === "expr"
      ? sourceNarrowedBinding.type
      : undefined
  );
  const runtimeCastTarget =
    preservedBroadArrayStorageType ?? runtimeTarget;
  const [
    runtimeTargetTypeAst,
    runtimeTargetUnionLayout,
    runtimeTargetTypeContext,
  ] = emitRuntimeCarrierTypeAst(
    runtimeCastTarget,
    sourceLayoutContext,
    emitTypeAst
  );
  const mustPreserveNominalCast =
    isSuperMemberCallExpression(expr.expression) ||
    isPolymorphicThisType(runtimeTarget);
  const mustPreserveFlowStorageCast =
    !!sourceExpressionType &&
    !sourceRuntimeUnionLayout &&
    !runtimeTargetUnionLayout &&
    !areIrTypesEquivalent(sourceExpressionType, runtimeTarget, ctx1);
  const castSourceAst =
    preservedBroadArrayStorageType &&
    sourceNarrowedBinding?.kind === "expr" &&
    sourceNarrowedBinding.storageExprAst
      ? sourceNarrowedBinding.storageExprAst
      : innerAst;

  if (
    isExactExpressionToType(
      castSourceAst,
      stripNullableTypeAst(runtimeTargetTypeAst)
    ) ||
    isExactArrayCreationToType(
      castSourceAst,
      stripNullableTypeAst(runtimeTargetTypeAst)
    )
  ) {
    return [castSourceAst, runtimeTargetTypeContext];
  }

  if (mustPreserveNominalCast) {
    return [
      {
        kind: "castExpression",
        type: runtimeTargetTypeAst,
        expression: castSourceAst,
      },
      runtimeTargetTypeContext,
    ];
  }

  if (preservedBroadArrayStorageType) {
    return [
      {
        kind: "castExpression",
        type: runtimeTargetTypeAst,
        expression: castSourceAst,
      },
      runtimeTargetTypeContext,
    ];
  }

  const degenerateDuplicateUnionAst = maybeAdaptDegenerateDuplicateUnion(
    castSourceAst,
    actualExpressionType,
    resolvedAssertionTarget
  );
  if (degenerateDuplicateUnionAst) {
    return degenerateDuplicateUnionAst;
  }

  const adaptedUnionAst = mustPreserveDirectStorageCast
    ? undefined
    : adaptValueToExpectedTypeAst({
        valueAst: castSourceAst,
        actualType: actualExpressionType,
        context: sourceLayoutContext,
        expectedType: runtimeTarget,
        selectedSourceMemberNs: expr.selectedRuntimeUnionMembers
          ? new Set(expr.selectedRuntimeUnionMembers)
          : undefined,
      });
  if (adaptedUnionAst) {
    return adaptedUnionAst;
  }

  const assertedCollectionAdaptation =
    actualExpressionType && runtimeTarget.kind === "arrayType"
      ? tryAdaptStructuralCollectionExpressionAst(
          castSourceAst,
          actualExpressionType,
          sourceLayoutContext,
          runtimeTarget,
          (_ast, actualType, adaptationContext, expectedType) => {
            if (!actualType || !expectedType) {
              return undefined;
            }

            const comparableActual = resolveComparableType(
              actualType,
              adaptationContext
            );
            const comparableExpected = resolveComparableType(
              expectedType,
              adaptationContext
            );
            if (
              comparableActual.kind === comparableExpected.kind &&
              areIrTypesEquivalent(actualType, expectedType, adaptationContext)
            ) {
              return [_ast, adaptationContext];
            }

            const [expectedTypeAst, nextContext] = emitTypeAst(
              expectedType,
              adaptationContext
            );
            return [
              {
                kind: "castExpression",
                type: expectedTypeAst,
                expression: _ast,
              },
              nextContext,
            ];
          }
        )
      : undefined;
  if (assertedCollectionAdaptation) {
    return assertedCollectionAdaptation;
  }

  if (mustPreserveFlowStorageCast) {
    return [
      {
        kind: "castExpression",
        type: runtimeTargetTypeAst,
        expression: castSourceAst,
      },
      runtimeTargetTypeContext,
    ];
  }

  return [
    {
      kind: "castExpression",
      type: runtimeTargetTypeAst,
      expression: castSourceAst,
    },
    runtimeTargetTypeContext,
  ];
};

// ---------------------------------------------------------------------------
// asinterface
// ---------------------------------------------------------------------------

/**
 * Emit an asinterface expression as CSharpExpressionAst.
 */
export const emitAsInterface = (
  expr: IrAsInterfaceExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  void expectedType;
  return emitExpressionAst(expr.expression, context);
};

// ---------------------------------------------------------------------------
// trycast
// ---------------------------------------------------------------------------

/**
 * Emit a trycast expression as CSharpExpressionAst.
 *
 * TypeScript `trycast<T>(x)` becomes C# `x as T` (safe cast).
 */
export const emitTryCast = (
  expr: IrTryCastExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [innerAst, ctx1] = emitExpressionAst(expr.expression, context);
  const [typeAst, ctx2] = emitTypeAst(expr.targetType, ctx1);
  return [
    {
      kind: "asExpression",
      expression: innerAst,
      type: typeAst,
    },
    ctx2,
  ];
};

// ---------------------------------------------------------------------------
// stackalloc
// ---------------------------------------------------------------------------

/**
 * Emit a stackalloc expression as CSharpExpressionAst.
 */
export const emitStackAlloc = (
  expr: IrStackAllocExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [elementTypeAst, ctx1] = emitTypeAst(expr.elementType, context);
  const [sizeAst, ctx2] = emitExpressionAst(expr.size, ctx1, {
    kind: "primitiveType",
    name: "int",
  });
  return [
    {
      kind: "stackAllocArrayCreationExpression",
      elementType: elementTypeAst,
      sizeExpression: sizeAst,
    },
    ctx2,
  ];
};

// ---------------------------------------------------------------------------
// defaultof
// ---------------------------------------------------------------------------

/**
 * Emit a defaultof expression as CSharpExpressionAst.
 */
export const emitDefaultOf = (
  expr: IrDefaultOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const runtimeTarget = resolveRuntimeMaterializationTargetType(
    expr.targetType,
    context
  );
  const [typeAst, ctx1] = emitTypeAst(runtimeTarget, context);
  return [
    {
      kind: "defaultExpression",
      type: typeAst,
    },
    ctx1,
  ];
};

// ---------------------------------------------------------------------------
// nameof
// ---------------------------------------------------------------------------

/**
 * Emit a nameof expression as a compile-time string literal using the authored TS name.
 */
export const emitNameOf = (
  expr: IrNameOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => [stringLiteral(expr.name), context];

// ---------------------------------------------------------------------------
// sizeof
// ---------------------------------------------------------------------------

/**
 * Emit a sizeof expression as C# sizeof(T).
 */
export const emitSizeOf = (
  expr: IrSizeOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [typeAst, ctx1] = emitTypeAst(expr.targetType, context);
  return [
    {
      kind: "sizeOfExpression",
      type: typeAst,
    },
    ctx1,
  ];
};
