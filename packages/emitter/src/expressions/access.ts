/**
 * Member access expression emitters — orchestrator facade.
 *
 * Heavy-lifting helpers live in:
 *   - ./access-resolution.ts  (receiver resolution, reification, member names)
 *   - ./access-length.ts      (length/count property access helpers)
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  isExplicitViewProperty,
  extractInterfaceNameFromView,
} from "@tsonic/frontend/types/explicit-views.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
  getAllPropertySignatures,
  resolveArrayLikeReceiverType,
} from "../core/semantic/type-resolution.js";
import { emitCSharpName } from "../naming-policy.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import {
  identifierExpression,
  identifierType,
} from "../core/format/backend-ast/builders.js";
import {
  extractCalleeNameFromAst,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import {
  getCanonicalRuntimeUnionMembers,
  getRuntimeUnionReferenceMembers,
  isRuntimeUnionTypeName,
} from "../core/semantic/runtime-unions.js";
import { isSemanticUnion } from "../core/semantic/union-semantics.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  hasInt32Proof,
  type MemberAccessUsage,
  createStringLiteralExpression,
  emitArrayWrapperElementTypeAst,
  maybeReifyErasedArrayElement,
  maybeReifyStorageErasedMemberRead,
  tryEmitStorageCompatibleNarrowedMemberRead,
  hasPropertyFromBindingsRegistry,
  resolveEffectiveReceiverType,
  resolveEmittedReceiverTypeAst,
  emitMemberName,
} from "./access-resolution.js";
import {
  isStringReceiverType,
  tryEmitErasedLengthAccess,
  tryEmitConcreteReceiverLengthAccess,
  tryEmitJsSurfaceArrayLikeLengthAccess,
} from "./access-length.js";
import { tryEmitMemberBindingAccess } from "./access-binding.js";

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
    const accessKind = expr.accessKind;
    if (accessKind === undefined || accessKind === "unknown") {
      throw new Error(
        `Internal Compiler Error: Computed accessKind was not classified during IR build ` +
          `(accessKind=${accessKind ?? "undefined"}).`
      );
    }

    const indexContext = { ...newContext, isArrayIndex: true };
    const [propAst, contextWithIndex] = emitExpressionAst(
      expr.property as IrExpression,
      indexContext
    );
    const finalContext = { ...contextWithIndex, isArrayIndex: false };

    if (accessKind === "dictionary") {
      if (expr.isOptional) {
        return [
          {
            kind: "conditionalElementAccessExpression",
            expression: objectAst,
            arguments: [propAst],
          },
          finalContext,
        ];
      }
      return [
        {
          kind: "elementAccessExpression",
          expression: objectAst,
          arguments: [propAst],
        },
        finalContext,
      ];
    }

    // HARD GATE: clrIndexer + stringChar require Int32 proof
    const indexExpr = expr.property as IrExpression;
    if (!hasInt32Proof(indexExpr)) {
      const propText = extractCalleeNameFromAst(propAst);
      throw new Error(
        `Internal Compiler Error: CLR indexer requires Int32 index (accessKind=${accessKind}). ` +
          `Expression '${propText}' has no Int32 proof. ` +
          `This should have been caught by the numeric proof pass (TSN5107).`
      );
    }

    if (accessKind === "stringChar") {
      const elementAccess: CSharpExpressionAst = expr.isOptional
        ? {
            kind: "conditionalElementAccessExpression",
            expression: objectAst,
            arguments: [propAst],
          }
        : {
            kind: "elementAccessExpression",
            expression: objectAst,
            arguments: [propAst],
          };

      const narrowedExpectedType = expectedType
        ? stripNullish(expectedType)
        : undefined;
      const resolvedExpectedType = narrowedExpectedType
        ? resolveTypeAlias(narrowedExpectedType, context)
        : undefined;
      const expectsChar =
        (resolvedExpectedType?.kind === "primitiveType" &&
          resolvedExpectedType.name === "char") ||
        (resolvedExpectedType?.kind === "referenceType" &&
          resolvedExpectedType.name === "char");

      if (expectsChar) {
        return [elementAccess, finalContext];
      }

      // str[i] returns char in C#, but JS/TS surface semantics expect a string
      // in non-char contexts. Convert char → string at the emission boundary.
      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: elementAccess,
            memberName: "ToString",
          },
          arguments: [],
        },
        finalContext,
      ];
    }

    if (expr.isOptional) {
      return [
        {
          kind: "conditionalElementAccessExpression",
          expression: objectAst,
          arguments: [propAst],
        },
        finalContext,
      ];
    }
    const accessAst: CSharpExpressionAst = {
      kind: "elementAccessExpression",
      expression: objectAst,
      arguments: [propAst],
    };
    return maybeReifyErasedArrayElement(
      accessAst,
      expr.object,
      expectedType ?? expr.inferredType,
      finalContext
    );
  }

  // Property access
  const prop = expr.property as string;
  const resolvedObjectType = objectType
    ? resolveTypeAlias(stripNullish(objectType), context)
    : undefined;

  if (
    usage === "value" &&
    (prop === "length" || prop === "Length" || prop === "Count")
  ) {
    const [storageReceiverTypeAst, storageContext] =
      resolveEmittedReceiverTypeAst(expr.object, newContext);
    const concreteStorageReceiverTypeAst = storageReceiverTypeAst
      ? stripNullableTypeAst(storageReceiverTypeAst)
      : undefined;
    if (concreteStorageReceiverTypeAst?.kind === "arrayType") {
      return [
        {
          kind: expr.isOptional
            ? "conditionalMemberAccessExpression"
            : "memberAccessExpression",
          expression: objectAst,
          memberName: "Length",
        },
        storageContext,
      ];
    }
  }

  // Handle explicit interface view properties (As_IInterface)
  if (isExplicitViewProperty(prop)) {
    const interfaceName = extractInterfaceNameFromView(prop);
    if (interfaceName) {
      // Emit as C# interface cast: ((IInterface)obj)
      const interfaceType: IrType = {
        kind: "referenceType",
        name: interfaceName,
      };
      const [interfaceTypeAst, ctxAfterType] = emitTypeAst(
        interfaceType,
        newContext
      );
      return [
        {
          kind: "castExpression",
          type: interfaceTypeAst,
          expression: objectAst,
        },
        ctxAfterType,
      ];
    }
  }

  // Dictionary pseudo-members:
  // - dict.Keys   -> new List<TKey>(dict.Keys).ToArray()
  // - dict.Values -> new List<TValue>(dict.Values).ToArray()
  //
  // We expose these as array-typed on the frontend, so emit array materialization
  // here to keep C# behavior aligned with inferred IR types.
  if (resolvedObjectType?.kind === "dictionaryType") {
    if (prop === "Keys" || prop === "Values") {
      const collectionMemberName = emitCSharpName(prop, "properties", context);
      const sourceCollectionAst: CSharpExpressionAst = {
        kind: "memberAccessExpression",
        expression: objectAst,
        memberName: collectionMemberName,
      };

      const elementType =
        prop === "Keys"
          ? resolvedObjectType.keyType
          : resolvedObjectType.valueType;
      const [elementTypeAst, ctxAfterType] = emitTypeAst(
        elementType,
        newContext
      );

      const listTypeAst = identifierType(
        "global::System.Collections.Generic.List",
        [elementTypeAst]
      );

      const listExprAst: CSharpExpressionAst = {
        kind: "objectCreationExpression",
        type: listTypeAst,
        arguments: [sourceCollectionAst],
      };

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: listExprAst,
            memberName: "ToArray",
          },
          arguments: [],
        },
        ctxAfterType,
      ];
    }

    if (prop === "Count" || prop === "Length") {
      return [
        {
          kind: expr.isOptional
            ? "conditionalMemberAccessExpression"
            : "memberAccessExpression",
          expression: objectAst,
          memberName: "Count",
        },
        newContext,
      ];
    }

    const keyAst = createStringLiteralExpression(prop);
    if (expr.isOptional) {
      return [
        {
          kind: "conditionalElementAccessExpression",
          expression: objectAst,
          arguments: [keyAst],
        },
        newContext,
      ];
    }

    return [
      {
        kind: "elementAccessExpression",
        expression: objectAst,
        arguments: [keyAst],
      },
      newContext,
    ];
  }

  // Regular property access
  const memberName = emitMemberName(
    expr.object,
    objectType,
    prop,
    context,
    usage
  );

  if (
    context.options.surface === "@tsonic/js" &&
    !expr.memberBinding &&
    usage === "call"
  ) {
    const arrayLikeReceiver = resolveArrayLikeReceiverType(objectType, context);
    if (arrayLikeReceiver) {
      const [elementTypeAst, typeCtx] = emitArrayWrapperElementTypeAst(
        objectType,
        arrayLikeReceiver.elementType,
        newContext
      );
      return [
        {
          kind: "memberAccessExpression",
          expression: {
            kind: "objectCreationExpression",
            type: identifierType("global::Tsonic.JSRuntime.JSArray", [
              elementTypeAst,
            ]),
            arguments: [objectAst],
          },
          memberName: emitCSharpName(prop, "methods", typeCtx),
        },
        typeCtx,
      ];
    }
  }

  if (usage === "value") {
    if (
      resolvedObjectType?.kind === "arrayType" ||
      resolvedObjectType?.kind === "tupleType"
    ) {
      if (prop === "length" || prop === "Length" || prop === "Count") {
        return [
          {
            kind: expr.isOptional
              ? "conditionalMemberAccessExpression"
              : "memberAccessExpression",
            expression: objectAst,
            memberName: "Length",
          },
          newContext,
        ];
      }
    }
  }

  const concreteReceiverLengthAccess = tryEmitConcreteReceiverLengthAccess(
    expr,
    objectAst,
    newContext
  );
  if (concreteReceiverLengthAccess) {
    return concreteReceiverLengthAccess;
  }

  const erasedLengthAccess = tryEmitErasedLengthAccess(
    expr,
    objectAst,
    objectType,
    newContext
  );
  if (erasedLengthAccess) {
    return erasedLengthAccess;
  }

  if (expr.isOptional) {
    return [
      {
        kind: "conditionalMemberAccessExpression",
        expression: objectAst,
        memberName,
      },
      newContext,
    ];
  }

  return maybeReifyStorageErasedMemberRead(
    {
      kind: "memberAccessExpression",
      expression: objectAst,
      memberName,
    },
    expr,
    newContext,
    expectedType
  );
};
