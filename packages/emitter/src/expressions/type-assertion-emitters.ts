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
  isTypeOnlyStructuralTarget,
} from "../core/semantic/type-resolution.js";
import { isSemanticUnion } from "../core/semantic/union-semantics.js";
import {
  buildRuntimeUnionLayout,
  emitRuntimeCarrierTypeAst,
} from "../core/semantic/runtime-unions.js";
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
import { stringLiteral } from "../core/format/backend-ast/builders.js";
import { adaptValueToExpectedTypeAst } from "./expected-type-adaptation.js";
import { isExactExpressionToType } from "./exact-comparison.js";

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

  const shouldEraseTypeAssertion = (target: IrType): boolean => {
    const resolved = resolveLocalTypeAliases(target);

    if (isTypeOnlyStructuralTarget(resolved, context)) {
      return true;
    }

    if (resolved.kind === "unknownType") {
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

    return false;
  };

  if (shouldEraseTypeAssertion(expr.targetType)) {
    return emitExpressionAst(expr.expression, context, expectedType);
  }

  if (isTransparentFlowAssertion) {
    return emitExpressionAst(expr.expression, context, expectedType);
  }

  const runtimeEmissionTarget = resolveRuntimeMaterializationTargetType(
    expr.targetType,
    context
  );
  const rawSourceContext =
    expr.expression.kind === "identifier" ||
    expr.expression.kind === "memberAccess"
      ? withoutNarrowedBinding(expr.expression, context)
      : context;
  const innerExpectedType =
    expr.expression.kind === "identifier" ||
    expr.expression.kind === "memberAccess"
      ? undefined
      : runtimeEmissionTarget;
  const [innerAst, ctx1] = emitExpressionAst(
    expr.expression,
    rawSourceContext,
    innerExpectedType
  );
  const runtimeTarget = resolveRuntimeMaterializationTargetType(
    expr.targetType,
    ctx1
  );
  const transparentSourceExpression = unwrapTransparentExpression(
    expr.expression
  );
  const sourceExpressionType =
    transparentSourceExpression.kind === "identifier"
      ? (ctx1.localSemanticTypes?.get(transparentSourceExpression.name) ??
        transparentSourceExpression.inferredType)
      : transparentSourceExpression.inferredType;
  const isSourceUnion = sourceExpressionType
    ? isSemanticUnion(sourceExpressionType, ctx1)
    : false;
  const [sourceRuntimeUnionLayout, sourceLayoutContext] =
    isSourceUnion && sourceExpressionType
      ? buildRuntimeUnionLayout(sourceExpressionType, ctx1, emitTypeAst)
      : [undefined, ctx1];
  const narrowedBinding = getNarrowedBindingForExpression(
    expr.expression,
    sourceLayoutContext
  );
  const actualExpressionType =
    sourceRuntimeUnionLayout && narrowedBinding?.kind === "runtimeSubset"
      ? sourceExpressionType
      : resolveEffectiveExpressionType(expr.expression, sourceLayoutContext);
  const [
    runtimeTargetTypeAst,
    runtimeTargetUnionLayout,
    runtimeTargetTypeContext,
  ] = emitRuntimeCarrierTypeAst(
    runtimeTarget,
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

  if (
    isExactExpressionToType(
      innerAst,
      stripNullableTypeAst(runtimeTargetTypeAst)
    )
  ) {
    return [innerAst, runtimeTargetTypeContext];
  }

  if (mustPreserveNominalCast || mustPreserveFlowStorageCast) {
    return [
      {
        kind: "castExpression",
        type: runtimeTargetTypeAst,
        expression: innerAst,
      },
      runtimeTargetTypeContext,
    ];
  }

  const adaptedUnionAst = adaptValueToExpectedTypeAst({
    valueAst: innerAst,
    actualType: actualExpressionType,
    context: sourceLayoutContext,
    expectedType: runtimeTarget,
  });
  if (adaptedUnionAst) {
    return adaptedUnionAst;
  }

  return [
    {
      kind: "castExpression",
      type: runtimeTargetTypeAst,
      expression: innerAst,
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
  const expected = expectedType ?? expr.targetType;
  return emitExpressionAst(expr.expression, context, expected);
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
  const [typeAst, ctx1] = emitTypeAst(expr.targetType, context);
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
