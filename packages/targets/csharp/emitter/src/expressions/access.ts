/**
 * Member access expression emitters — orchestrator facade.
 *
 * Heavy-lifting helpers live in:
 *   - ./access-resolution.ts  (receiver resolution, reification, member names)
 *   - ./access-length.ts      (JS-surface .length interop)
 *   - ./access-computed.ts    (computed indexing: dict[key], arr[i], str[i])
 *   - ./access-property.ts    (non-computed declared property access)
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  resolveTypeAlias,
  resolveArrayLikeReceiverType,
  stripNullish,
  getAllPropertySignatures,
  hasDeterministicPropertyMembership,
} from "../core/semantic/type-resolution.js";
import { emitCSharpName } from "../naming-policy.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import {
  getIdentifierTypeName,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import {
  buildRuntimeUnionLayout,
  getRuntimeUnionReferenceMembers,
  isRuntimeUnionTypeName,
} from "../core/semantic/runtime-unions.js";
import {
  isSemanticUnion,
  willCarryAsRuntimeUnion,
} from "../core/semantic/union-semantics.js";
import { resolveIteratorResultReferenceType } from "../core/semantic/structural-resolution.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  type MemberAccessUsage,
  maybeReifyStorageErasedMemberRead,
  tryReifyStorageErasedMemberRead,
  tryEmitMaterializedNarrowedMemberRead,
  tryEmitStorageCompatibleNarrowedMemberRead,
  hasPropertyFromBindingsRegistry,
  resolveEffectiveReceiverType,
  resolveEmittedReceiverTypeAst,
  emitMemberName,
} from "./access-resolution.js";
import { tryEmitJsSurfaceArrayLikeLengthAccess } from "./access-length.js";
import { tryEmitFunctionLengthAccess } from "./access-function-length.js";
import { tryEmitMemberBindingAccess } from "./access-binding.js";
import { emitComputedAccess } from "./access-computed.js";
import { emitPropertyAccess } from "./access-property.js";
import { materializeDirectNarrowingAst } from "../core/semantic/materialized-narrowing.js";
import { resolveDirectStorageIrType } from "../core/semantic/direct-storage-ir-types.js";
import { tryStripConditionalNullishGuardAst } from "../core/semantic/narrowing-builders.js";
import { resolveDirectValueSurfaceType } from "../core/semantic/direct-value-surfaces.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";

const isNativeArrayLengthProjection = (
  memberType: IrType | undefined,
  prop: string,
  context: EmitterContext
): boolean => {
  if (prop !== "length" || !memberType) {
    return false;
  }

  return (
    resolveArrayLikeReceiverType(memberType, context) !== undefined &&
    resolveTypeAlias(stripNullish(memberType), context).kind === "arrayType"
  );
};

const emitProjectedRuntimeUnionPropertyRead = (
  receiverExpr: IrExpression,
  projectedArmAst: CSharpExpressionAst,
  memberType: IrType | undefined,
  prop: string,
  context: EmitterContext,
  usage: MemberAccessUsage,
  isOptional: boolean
): CSharpExpressionAst => ({
  kind: isOptional ? "conditionalMemberAccessExpression" : "memberAccessExpression",
  expression: projectedArmAst,
  memberName: isNativeArrayLengthProjection(memberType, prop, context)
    ? "Length"
    : emitMemberName(receiverExpr, memberType, prop, context, usage),
	  });

const tryEmitRuntimeUnionPropertyProjection = (
  receiverExpr: IrExpression,
  receiverAst: CSharpExpressionAst,
  receiverType: IrType,
  prop: string,
  context: EmitterContext,
  usage: MemberAccessUsage,
  isOptional: boolean
): CSharpExpressionAst | undefined => {
  const resolvedBase = resolveTypeAlias(stripNullish(receiverType), context);
  const resolved =
    resolvedBase.kind === "intersectionType"
      ? (resolvedBase.types.find(
          (t): t is Extract<IrType, { kind: "referenceType" }> =>
            t.kind === "referenceType" && isRuntimeUnionTypeName(t.name)
        ) ?? resolvedBase)
      : resolvedBase;
  const runtimeReferenceMembers =
    resolved.kind === "referenceType"
      ? getRuntimeUnionReferenceMembers(resolved)
      : undefined;
  const members: readonly IrType[] =
    resolved.kind === "unionType"
      ? resolved.types
      : runtimeReferenceMembers
        ? runtimeReferenceMembers
        : [];

  const [runtimeLayout] = buildRuntimeUnionLayout(
    receiverType,
    context,
    emitTypeAst
  );
  const runtimeMembers = runtimeLayout?.members ?? members;
  const arity = runtimeMembers.length;
  if (arity < 2) {
    return undefined;
  }

  const memberHasProperty = runtimeMembers.map((m) => {
    if (isNativeArrayLengthProjection(m, prop, context)) {
      return true;
    }
    const deterministic = hasDeterministicPropertyMembership(m, prop, context);
    if (deterministic !== undefined) {
      return deterministic;
    }
    if (m.kind !== "referenceType") return false;
    const props = getAllPropertySignatures(m, context);
    if (props) return props.some((p) => p.name === prop);
    const fromBindings = hasPropertyFromBindingsRegistry(m, prop, context);
    return fromBindings ?? false;
  });
  const count = memberHasProperty.filter(Boolean).length;

  if (count !== arity && count !== 1) {
    return undefined;
  }

  if (count === arity) {
    const lambdaArgs = runtimeMembers.map(
      (runtimeMember, i): CSharpExpressionAst => ({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: `__m${i + 1}` }],
        body: emitProjectedRuntimeUnionPropertyRead(
          receiverExpr,
          {
            kind: "identifierExpression",
            identifier: `__m${i + 1}`,
          },
          runtimeMember,
          prop,
          context,
          usage,
          false
        ),
      })
    );
    return {
      kind: "invocationExpression",
      expression: {
        kind: isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: receiverAst,
        memberName: "Match",
      },
      arguments: lambdaArgs,
    };
  }

  const armIndex = memberHasProperty.findIndex(Boolean);
  if (armIndex < 0) {
    return undefined;
  }

  const runtimeMember = runtimeMembers[armIndex];
  const asMethod = emitCSharpName(`As${armIndex + 1}`, "methods", context);
  const projectedArmAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: isOptional
        ? "conditionalMemberAccessExpression"
        : "memberAccessExpression",
      expression: receiverAst,
      memberName: asMethod,
    },
    arguments: [],
  };
  return emitProjectedRuntimeUnionPropertyRead(
    receiverExpr,
    projectedArmAst,
    runtimeMember,
    prop,
    context,
    usage,
    isOptional
  );
};

/**
 * Emit a member access expression as CSharpExpressionAst
 */
export const emitMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  usage: MemberAccessUsage = "value",
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const objectType =
    resolveEffectiveReceiverType(expr.object, context) ??
    expr.object.inferredType;
  const propertyName =
    typeof expr.property === "string" ? expr.property : undefined;

  // Nullable guard narrowing for member-access expressions.
  const narrowKey = context.narrowedBindings
    ? getMemberAccessNarrowKey(expr)
    : undefined;
  if (narrowKey && context.narrowedBindings) {
    const narrowed = context.narrowedBindings.get(narrowKey);
    if (narrowed) {
      if (narrowed.kind === "rename") {
        return [
          identifierExpression(escapeCSharpIdentifier(narrowed.name)),
          context,
        ];
      }
      if (narrowed.kind === "expr") {
        const storageReified = tryReifyStorageErasedMemberRead(
          narrowed.exprAst,
          expr,
          context,
          expectedType
        );
        if (storageReified) {
          return storageReified;
        }
        const materializedNarrowed = tryEmitMaterializedNarrowedMemberRead(
          narrowed,
          context,
          expectedType
        );
        if (materializedNarrowed) {
          return materializedNarrowed;
        }
        const storageCompatible = tryEmitStorageCompatibleNarrowedMemberRead(
          narrowed,
          expr,
          context,
          expectedType
        );
        if (storageCompatible) {
          return storageCompatible;
        }
        return maybeReifyStorageErasedMemberRead(
          narrowed.exprAst,
          expr,
          context,
          expectedType
        );
      }
    }
  }

  if (
    !expr.isComputed &&
    usage === "value" &&
    !expr.isOptional &&
    (propertyName === "done" || propertyName === "value")
  ) {
    if (
      (objectType?.kind === "referenceType" &&
        objectType.name === "IteratorResult") ||
      (objectType &&
        resolveIteratorResultReferenceType(objectType, context) !== undefined)
    ) {
      const [objectAst, newContext] = emitExpressionAst(expr.object, context);
      return [
        {
          kind: "memberAccessExpression",
          expression: objectAst,
          memberName: propertyName,
        },
        newContext,
      ];
    }

    const [receiverTypeAst] = resolveEmittedReceiverTypeAst(
      expr.object,
      context
    );
    const receiverTypeName = receiverTypeAst
      ? getIdentifierTypeName(stripNullableTypeAst(receiverTypeAst))
      : undefined;
    if (receiverTypeName === "global::Tsonic.Runtime.IteratorResult") {
      const [objectAst, newContext] = emitExpressionAst(expr.object, context);
      return [
        {
          kind: "memberAccessExpression",
          expression: objectAst,
          memberName: propertyName,
        },
        newContext,
      ];
    }
  }

  if (!expr.isComputed && usage === "value" && propertyName === "length") {
    const functionLengthAccess = tryEmitFunctionLengthAccess(
      expr,
      objectType,
      context
    );
    if (functionLengthAccess) {
      return functionLengthAccess;
    }
  }

  // Property access that targets a CLR runtime union
  if (!expr.isComputed) {
    const prop = expr.property as string;
    if (
      objectType &&
      (isSemanticUnion(objectType, context) ||
        willCarryAsRuntimeUnion(objectType, context))
    ) {
      const receiverNarrowKey =
        expr.object.kind === "identifier"
          ? expr.object.name
          : expr.object.kind === "memberAccess"
            ? getMemberAccessNarrowKey(expr.object)
            : undefined;
      const receiverNarrowed = receiverNarrowKey
        ? context.narrowedBindings?.get(receiverNarrowKey)
        : undefined;
      const receiverNarrowedType = receiverNarrowed?.type;
      if (
        usage === "value" &&
        receiverNarrowedType &&
        !willCarryAsRuntimeUnion(receiverNarrowedType, context) &&
        hasDeterministicPropertyMembership(
          receiverNarrowedType,
          prop,
          context
        ) === true
      ) {
        const [objectAst, newContext] = emitExpressionAst(expr.object, context);
        const receiverBindingCarrierType =
          receiverNarrowed?.kind === "expr"
            ? (receiverNarrowed.sourceType ?? receiverNarrowed.carrierType)
            : receiverNarrowed?.kind === "runtimeSubset" ||
                receiverNarrowed?.kind === "rename"
              ? receiverNarrowed.sourceType
              : undefined;
        const receiverStorageType =
          receiverBindingCarrierType ??
          resolveDirectStorageIrType(expr.object, context);
        const nonNullReceiverAst =
          tryStripConditionalNullishGuardAst(objectAst) ?? objectAst;
        const alreadyMaterializedReceiverType =
          tryResolveRuntimeUnionMemberType(
            receiverStorageType ?? objectType,
            nonNullReceiverAst,
            newContext,
            { verifyReceiver: false }
          );
        const [materializedReceiverAst, materializedReceiverContext] =
          alreadyMaterializedReceiverType &&
          !willCarryAsRuntimeUnion(alreadyMaterializedReceiverType, context) &&
          hasDeterministicPropertyMembership(
            alreadyMaterializedReceiverType,
            prop,
            context
          ) === true
            ? [nonNullReceiverAst, newContext]
            : materializeDirectNarrowingAst(
                nonNullReceiverAst,
                receiverStorageType ?? objectType,
                receiverNarrowedType,
                newContext
              );
        const materializedReceiverType =
          alreadyMaterializedReceiverType ?? receiverNarrowedType;
        const escapedProp = emitMemberName(
          expr.object,
          materializedReceiverType,
          prop,
          context,
          usage
        );
        return [
          {
            kind: expr.isOptional
              ? "conditionalMemberAccessExpression"
              : "memberAccessExpression",
            expression: materializedReceiverAst,
            memberName: escapedProp,
          },
          materializedReceiverContext,
        ];
      }

      const [objectAst, newContext] = emitExpressionAst(expr.object, context);
      const projected = tryEmitRuntimeUnionPropertyProjection(
        expr.object,
        objectAst,
        objectType,
        prop,
        newContext,
        usage,
        expr.isOptional
      );
      if (projected) {
        return [projected, newContext];
      }
    }
  }

  const bindingResult = tryEmitMemberBindingAccess(expr, context, usage);
  if (bindingResult) {
    if (usage === "value" && expectedType && expr.inferredType) {
      return maybeReifyStorageErasedMemberRead(
        bindingResult[0],
        expr,
        bindingResult[1],
        expectedType,
      );
    }
    return bindingResult;
  }

  const [rawObjectAst, newContext] = emitExpressionAst(expr.object, context);
  const objectAst = expr.isOptional
    ? rawObjectAst
    : (tryStripConditionalNullishGuardAst(rawObjectAst) ?? rawObjectAst);

  if (!expr.isComputed && propertyName) {
    const surfaceObjectType =
      objectType ?? resolveDirectValueSurfaceType(objectAst, newContext);
    if (
      surfaceObjectType
    ) {
      const projected = tryEmitRuntimeUnionPropertyProjection(
        expr.object,
        objectAst,
        surfaceObjectType,
        propertyName,
        newContext,
        usage,
        expr.isOptional
      );
      if (projected) {
        return [projected, newContext];
      }
    }
  }

  if (usage === "value") {
    const jsSurfaceArrayLengthAccess = tryEmitJsSurfaceArrayLikeLengthAccess(
      expr,
      objectAst,
      objectType,
      newContext
    );
    if (jsSurfaceArrayLengthAccess) {
      return jsSurfaceArrayLengthAccess;
    }
  }

  if (expr.isComputed) {
    return emitComputedAccess(
      expr,
      objectAst,
      objectType,
      context,
      newContext,
      usage,
      expectedType
    );
  }

  return emitPropertyAccess(
    expr,
    objectAst,
    objectType,
    context,
    newContext,
    usage,
    expectedType
  );
};
