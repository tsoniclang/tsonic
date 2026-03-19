/**
 * Member access expression emitters — orchestrator facade.
 *
 * Heavy-lifting helpers live in:
 *   - ./access-resolution.ts  (receiver resolution, reification, member names)
 *   - ./access-length.ts      (length/count property access helpers)
 *   - ./access-computed.ts    (computed indexing: dict[key], arr[i], str[i])
 *   - ./access-property.ts    (non-computed property access: dict.Keys, .length, etc.)
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
  getAllPropertySignatures,
} from "../core/semantic/type-resolution.js";
import { emitCSharpName } from "../naming-policy.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import {
  getCanonicalRuntimeUnionMembers,
  getRuntimeUnionReferenceMembers,
  isRuntimeUnionTypeName,
} from "../core/semantic/runtime-unions.js";
import { isSemanticUnion } from "../core/semantic/union-semantics.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  type MemberAccessUsage,
  maybeReifyStorageErasedMemberRead,
  tryEmitStorageCompatibleNarrowedMemberRead,
  hasPropertyFromBindingsRegistry,
  resolveEffectiveReceiverType,
  emitMemberName,
} from "./access-resolution.js";
import {
  isStringReceiverType,
  tryEmitJsSurfaceArrayLikeLengthAccess,
} from "./access-length.js";
import { tryEmitMemberBindingAccess } from "./access-binding.js";
import { emitComputedAccess } from "./access-computed.js";
import { emitPropertyAccess } from "./access-property.js";

/**
 * Emit a member access expression as CSharpExpressionAst
 */
export const emitMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  usage: MemberAccessUsage = "value",
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
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

  const objectType = resolveEffectiveReceiverType(expr.object, context);

  if (
    !expr.isComputed &&
    usage === "value" &&
    context.options.surface === "@tsonic/js" &&
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
        kind: "invocationExpression",
        expression: identifierExpression(
          "global::Tsonic.JSRuntime.String.length"
        ),
        arguments: [stringObjectAst],
      },
      stringContext,
    ];
  }

  // Property access that targets a CLR runtime union
  if (!expr.isComputed && !expr.isOptional) {
    const prop = expr.property as string;
    if (objectType && isSemanticUnion(objectType, context)) {
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

      const canonicalMembers =
        members.length >= 2 && members.length <= 8
          ? getCanonicalRuntimeUnionMembers(objectType, context)
          : undefined;
      const runtimeMembers = canonicalMembers ?? members;
      const arity = runtimeMembers.length;
      if (arity >= 2 && arity <= 8) {
        const memberHasProperty = runtimeMembers.map((m) => {
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
                  kind: "memberAccessExpression",
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
            return [
              {
                kind: "memberAccessExpression",
                expression: {
                  kind: "invocationExpression",
                  expression: {
                    kind: "memberAccessExpression",
                    expression: objectAst,
                    memberName: asMethod,
                  },
                  arguments: [],
                },
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

  const [objectAst, newContext] = emitExpressionAst(expr.object, context);

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
    return emitComputedAccess(expr, objectAst, newContext, expectedType);
  }

  return emitPropertyAccess(
    expr,
    objectAst,
    objectType,
    newContext,
    usage,
    expectedType
  );
};
