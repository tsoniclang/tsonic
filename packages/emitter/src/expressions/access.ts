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
import { contextSurfaceIncludesJs, EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  resolveTypeAlias,
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
  tryEmitMaterializedNarrowedMemberRead,
  tryEmitStorageCompatibleNarrowedMemberRead,
  hasPropertyFromBindingsRegistry,
  resolveEffectiveReceiverType,
  resolveEmittedReceiverTypeAst,
  emitMemberName,
} from "./access-resolution.js";
import {
  isStringReceiverType,
  tryEmitJsSurfaceArrayLikeLengthAccess,
} from "./access-length.js";
import { tryEmitMemberBindingAccess } from "./access-binding.js";
import { emitComputedAccess } from "./access-computed.js";
import { emitPropertyAccess } from "./access-property.js";
import { materializeDirectNarrowingAst } from "../core/semantic/materialized-narrowing.js";
import { resolveDirectStorageIrType } from "../core/semantic/direct-storage-ir-types.js";
import { tryStripConditionalNullishGuardAst } from "../core/semantic/narrowing-builders.js";

/**
 * Emit a member access expression as CSharpExpressionAst
 */
export const emitMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  usage: MemberAccessUsage = "value",
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const objectType = resolveEffectiveReceiverType(expr.object, context);
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

  if (
    !expr.isComputed &&
    usage === "value" &&
    contextSurfaceIncludesJs(context) &&
    isStringReceiverType(objectType, context) &&
    ((expr.property as string) === "length" ||
      (expr.property as string) === "Length")
  ) {
    const [stringObjectAst, stringContext] = emitExpressionAst(
      expr.object,
      context
    );
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: stringObjectAst,
        memberName: "Length",
      },
      stringContext,
    ];
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
      const receiverNarrowedType =
        receiverNarrowed?.kind === "expr" ? receiverNarrowed.type : undefined;
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
        const receiverStorageType = resolveDirectStorageIrType(
          expr.object,
          context
        );
        const receiverMaterializationSourceType =
          receiverNarrowed?.kind === "expr" && receiverNarrowed.type
            ? receiverNarrowed.type
            : receiverStorageType;
        const nonNullReceiverAst =
          tryStripConditionalNullishGuardAst(objectAst) ?? objectAst;
        const [materializedReceiverAst, materializedReceiverContext] =
          materializeDirectNarrowingAst(
            nonNullReceiverAst,
            receiverMaterializationSourceType,
            receiverNarrowedType,
            newContext
          );
        const escapedProp = emitMemberName(
          expr.object,
          receiverNarrowedType,
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

      const resolvedBase = resolveTypeAlias(stripNullish(objectType), context);
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

      const [runtimeLayout] =
        members.length >= 2
          ? buildRuntimeUnionLayout(objectType, context, emitTypeAst)
          : [undefined, context];
      const runtimeMembers = runtimeLayout?.members ?? members;
      const arity = runtimeMembers.length;
      if (arity >= 2) {
        const memberHasProperty = runtimeMembers.map((m) => {
          const deterministic = hasDeterministicPropertyMembership(
            m,
            prop,
            context
          );
          if (deterministic !== undefined) {
            return deterministic;
          }
          if (m.kind !== "referenceType") return false;
          const props = getAllPropertySignatures(m, context);
          if (props) return props.some((p) => p.name === prop);
          const fromBindings = hasPropertyFromBindingsRegistry(
            m,
            prop,
            context
          );
          return fromBindings ?? false;
        });
        const count = memberHasProperty.filter(Boolean).length;

        if (count === arity || count === 1) {
          const [objectAst, newContext] = emitExpressionAst(
            expr.object,
            context
          );
          const escapedProp = emitMemberName(
            expr.object,
            objectType,
            prop,
            context,
            usage
          );

          if (count === arity) {
            // All members have the property: use Match lambda
            const lambdaArgs = runtimeMembers.map(
              (_, i): CSharpExpressionAst => ({
                kind: "lambdaExpression",
                isAsync: false,
                parameters: [{ name: `__m${i + 1}` }],
                body: {
                  kind: "memberAccessExpression",
                  expression: {
                    kind: "identifierExpression",
                    identifier: `__m${i + 1}`,
                  },
                  memberName: escapedProp,
                },
              })
            );
            return [
              {
                kind: "invocationExpression",
                expression: {
                  kind: expr.isOptional
                    ? "conditionalMemberAccessExpression"
                    : "memberAccessExpression",
                  expression: objectAst,
                  memberName: "Match",
                },
                arguments: lambdaArgs,
              },
              newContext,
            ];
          }

          const armIndex = memberHasProperty.findIndex(Boolean);
          if (armIndex >= 0) {
            const asMethod = emitCSharpName(
              `As${armIndex + 1}`,
              "methods",
              context
            );
            // receiver.AsN().prop
            const projectedArmAst: CSharpExpressionAst = {
              kind: "invocationExpression",
              expression: {
                kind: expr.isOptional
                  ? "conditionalMemberAccessExpression"
                  : "memberAccessExpression",
                expression: objectAst,
                memberName: asMethod,
              },
              arguments: [],
            };
            return [
              {
                kind: expr.isOptional
                  ? "conditionalMemberAccessExpression"
                  : "memberAccessExpression",
                expression: projectedArmAst,
                memberName: escapedProp,
              },
              newContext,
            ];
          }
        }
      }
    }
  }

  const bindingResult = tryEmitMemberBindingAccess(expr, context, usage);
  if (bindingResult) {
    return bindingResult;
  }

  const [rawObjectAst, newContext] = emitExpressionAst(expr.object, context);
  const objectAst = expr.isOptional
    ? rawObjectAst
    : (tryStripConditionalNullishGuardAst(rawObjectAst) ?? rawObjectAst);

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
