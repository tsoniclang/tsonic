/**
 * Binding-backed member access emission — handles member accesses that
 * have a resolved memberBinding (CLR type + member) from the bindings
 * registry, including array-like wrapper construction, extension methods,
 * static vs instance dispatch, and JS-surface length access.
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { resolveArrayLikeReceiverType } from "../core/semantic/type-resolution.js";
import { resolveTypeMemberKind } from "../core/semantic/member-surfaces.js";
import { unwrapTransparentExpression } from "../core/semantic/transparent-expressions.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
} from "../core/format/backend-ast/builders.js";
import {
  getIdentifierTypeName,
  normalizeClrQualifiedName,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  type MemberAccessUsage,
  stripClrGenericArity,
  emitStorageCompatibleArrayWrapperElementTypeAst,
  resolveEffectiveReceiverType,
  hasSourceDeclaredMember,
  resolveEmittedReceiverTypeAst,
  emitMemberName,
  isStaticTypeReference,
} from "./access-resolution.js";
import { buildNativeArrayInteropWrapAst } from "./array-interop.js";
import {
  isStringReceiverType,
  isLengthPropertyName,
  tryEmitJsSurfaceArrayLikeLengthAccess,
} from "./access-length.js";
import { materializeDirectNarrowingAst } from "../core/semantic/materialized-narrowing.js";
import { resolveDirectStorageIrType } from "../core/semantic/direct-storage-ir-types.js";

/**
 * Emit a member access that has a resolved memberBinding from the
 * bindings registry. Returns undefined if the expression has no
 * memberBinding, letting the caller fall through to generic dispatch.
 */
export const tryEmitMemberBindingAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  usage: MemberAccessUsage
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!expr.memberBinding) {
    return undefined;
  }

  const { type, member } = expr.memberBinding;
  const escapedMember = escapeCSharpIdentifier(member);
  const bindingTypeLeaf = stripClrGenericArity(type).split(".").pop();
  const normalizedBindingType = normalizeClrQualifiedName(type, true);
  const normalizedBindingTypeWithoutArity = normalizeClrQualifiedName(
    stripClrGenericArity(type),
    true
  );

  const receiverType = resolveEffectiveReceiverType(expr.object, context);
  const declaredReceiverType =
    expr.object.kind === "identifier"
      ? (context.localSemanticTypes?.get(expr.object.name) ??
        context.localValueTypes?.get(expr.object.name))
      : undefined;
  const sourcePropertyName =
    typeof expr.property === "string" ? expr.property : member;
  const arrayLikeReceiver = resolveArrayLikeReceiverType(receiverType, context);
  const hasArrayLikeBindingHint =
    bindingTypeLeaf === "Array" ||
    bindingTypeLeaf === "ReadonlyArray" ||
    type.includes("System.Array");
  const hasSourceDeclaredReceiverMember = hasSourceDeclaredMember(
    declaredReceiverType ?? receiverType,
    sourcePropertyName,
    usage,
    context
  );
  const receiverHasDeterministicMember =
    !!receiverType &&
    resolveTypeMemberKind(receiverType, sourcePropertyName, context) !==
      undefined;
  const bindingTargetsStringLength =
    usage === "value" &&
    typeof expr.property === "string" &&
    isLengthPropertyName(expr.property) &&
    (bindingTypeLeaf === "String" ||
      normalizedBindingTypeWithoutArity === "global::js.String" ||
      normalizedBindingTypeWithoutArity === "js.String");
  const targetsLengthLikeProperty =
    usage === "value" &&
    typeof expr.property === "string" &&
    isLengthPropertyName(expr.property);
  const [emittedReceiverTypeAst] = targetsLengthLikeProperty
    ? resolveEmittedReceiverTypeAst(expr.object, context)
    : [undefined, context];
  const emittedReceiverTypeName = emittedReceiverTypeAst
    ? getIdentifierTypeName(stripNullableTypeAst(emittedReceiverTypeAst))
    : undefined;
  const emittedReceiverLeafName = emittedReceiverTypeAst
    ? getIdentifierTypeName(stripNullableTypeAst(emittedReceiverTypeAst))
        ?.split(".")
        .pop()
    : undefined;
  const emittedReceiverIsConcreteNonString =
    !!emittedReceiverTypeName &&
    emittedReceiverTypeName !== "global::System.String" &&
    emittedReceiverTypeName !== "System.String" &&
    emittedReceiverTypeName !== "global::js.String" &&
    emittedReceiverTypeName !== "js.String";
  const emittedReceiverPrefersDirectLength =
    !!emittedReceiverTypeName &&
    emittedReceiverTypeName !== "global::System.Array" &&
    emittedReceiverTypeName !== "System.Array" &&
    emittedReceiverTypeName !== "global::js.Array" &&
    emittedReceiverTypeName !== "js.Array" &&
    emittedReceiverLeafName !== "Array" &&
    emittedReceiverLeafName !== "ICollection" &&
    emittedReceiverLeafName !== "IReadOnlyCollection" &&
    emittedReceiverIsConcreteNonString;
  if (
    bindingTargetsStringLength &&
    ((receiverHasDeterministicMember &&
      !isStringReceiverType(receiverType, context)) ||
      emittedReceiverIsConcreteNonString)
  ) {
    return undefined;
  }
  if (
    usage === "value" &&
    typeof expr.property === "string" &&
    isLengthPropertyName(expr.property) &&
    (hasSourceDeclaredReceiverMember ||
      receiverHasDeterministicMember ||
      emittedReceiverPrefersDirectLength)
  ) {
    return undefined;
  }
  if (
    usage === "value" &&
    typeof expr.property === "string" &&
    isLengthPropertyName(expr.property) &&
    context.options.surface === "@tsonic/js" &&
    !expr.memberBinding.isExtensionMethod &&
    !hasSourceDeclaredReceiverMember &&
    (arrayLikeReceiver || hasArrayLikeBindingHint)
  ) {
    const [objectAst, withObject] = emitExpressionAst(expr.object, context);
    const jsSurfaceArrayLengthAccess = tryEmitJsSurfaceArrayLikeLengthAccess(
      expr,
      objectAst,
      receiverType,
      withObject
    );
    if (jsSurfaceArrayLengthAccess) {
      return jsSurfaceArrayLengthAccess;
    }

    let elementContext = withObject;

    if (arrayLikeReceiver) {
      [, elementContext] = emitStorageCompatibleArrayWrapperElementTypeAst(
        expr.object,
        receiverType,
        arrayLikeReceiver.elementType,
        withObject
      );
    } else {
      const [, receiverTypeContext] = resolveEmittedReceiverTypeAst(
        expr.object,
        withObject
      );
      elementContext = receiverTypeContext;
    }

    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: buildNativeArrayInteropWrapAst(objectAst),
        memberName: "length",
      },
      elementContext,
    ];
  }
  if (
    usage === "value" &&
    arrayLikeReceiver &&
    !expr.memberBinding.isExtensionMethod &&
    !(
      type === "System.Array" ||
      type === "global::System.Array" ||
      type.startsWith("System.Array`") ||
      type.startsWith("global::System.Array`")
    )
  ) {
    const arityText = type.match(/`(\d+)$/)?.[1];
    const genericArity = arityText ? Number.parseInt(arityText, 10) : 0;
    if (genericArity <= 1) {
      const [objectAst, withObject] = emitExpressionAst(expr.object, context);
      let currentContext = withObject;

      let wrapperTypeArguments: readonly CSharpTypeAst[] | undefined;
      if (genericArity === 1) {
        const [elementTypeAst, withElementType] =
          emitStorageCompatibleArrayWrapperElementTypeAst(
            expr.object,
            receiverType,
            arrayLikeReceiver.elementType,
            currentContext
          );
        currentContext = withElementType;
        wrapperTypeArguments = [elementTypeAst];
      }

      const wrapperAst: CSharpExpressionAst =
        normalizedBindingTypeWithoutArity === "global::js.Array" ||
        normalizedBindingTypeWithoutArity === "js.Array" ||
        normalizedBindingTypeWithoutArity === "global::js.ReadonlyArray" ||
        normalizedBindingTypeWithoutArity === "js.ReadonlyArray"
          ? buildNativeArrayInteropWrapAst(objectAst)
          : {
              kind: "objectCreationExpression",
              type: identifierType(
                normalizedBindingTypeWithoutArity,
                wrapperTypeArguments
              ),
              arguments: [objectAst],
            };

      if (expr.isOptional) {
        return [
          {
            kind: "conditionalMemberAccessExpression",
            expression: wrapperAst,
            memberName: escapedMember,
          },
          currentContext,
        ];
      }

      return [
        {
          kind: "memberAccessExpression",
          expression: wrapperAst,
          memberName: escapedMember,
        },
        currentContext,
      ];
    }
  }

  if (usage === "value" && expr.memberBinding.isExtensionMethod) {
    const [objectAst, newContext] = emitExpressionAst(expr.object, context);
    const extensionCallAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: identifierExpression(
        `${normalizedBindingType}.${escapedMember}`
      ),
      arguments: [objectAst],
    };

    if (!expr.isOptional) {
      return [extensionCallAst, newContext];
    }

    return [
      {
        kind: "conditionalExpression",
        condition: {
          kind: "binaryExpression",
          operatorToken: "==",
          left: objectAst,
          right: nullLiteral(),
        },
        whenTrue: { kind: "defaultExpression" },
        whenFalse: extensionCallAst,
      },
      newContext,
    ];
  }

  const isGlobalSimpleBindingAccess = (() => {
    if (expr.object.kind !== "identifier") return false;
    const isLocal = context.localNameMap?.has(expr.object.name) ?? false;
    if (isLocal) return false;
    if (
      expr.object.resolvedClrType !== undefined ||
      (expr.object.csharpName !== undefined &&
        expr.object.resolvedAssembly !== undefined)
    ) {
      return true;
    }
    if (!bindingTypeLeaf) return false;
    return bindingTypeLeaf === expr.object.name;
  })();

  const importedStaticReceiverName = (() => {
    if (expr.object.kind !== "identifier") {
      return undefined;
    }
    const importBinding = context.importBindings?.get(expr.object.name);
    if (importBinding?.kind !== "type") {
      return undefined;
    }
    return getIdentifierTypeName(importBinding.typeAst);
  })();

  if (isStaticTypeReference(expr, context) || isGlobalSimpleBindingAccess) {
    const staticReceiverName =
      importedStaticReceiverName ?? normalizedBindingType;
    const staticMemberName = importedStaticReceiverName
      ? emitMemberName(
          expr.object,
          receiverType,
          sourcePropertyName,
          context,
          usage
        )
      : escapedMember;
    // Static access: emit full CLR type and member with global:: prefix
    return [
      identifierExpression(`${staticReceiverName}.${staticMemberName}`),
      context,
    ];
  } else {
    // Instance access: emit object.ClrMemberName
    const transparentReceiver =
      expr.object.kind === "typeAssertion" ||
      expr.object.kind === "asinterface" ||
      expr.object.kind === "trycast"
        ? unwrapTransparentExpression(expr.object.expression)
        : undefined;
    const transparentReceiverType =
      transparentReceiver !== undefined
        ? (resolveEffectiveReceiverType(transparentReceiver, context) ??
          transparentReceiver.inferredType)
        : undefined;
    const transparentReceiverAlreadyExposesMember =
      transparentReceiverType !== undefined &&
      resolveTypeMemberKind(
        transparentReceiverType,
        sourcePropertyName,
        context
      ) !== undefined;
    const [objectAst, newContext] =
      transparentReceiverAlreadyExposesMember && transparentReceiver
        ? emitExpressionAst(transparentReceiver, context)
        : emitExpressionAst(expr.object, context);
    const receiverSourceExpr =
      transparentReceiverAlreadyExposesMember && transparentReceiver
        ? transparentReceiver
        : expr.object;
    const receiverStorageType = resolveDirectStorageIrType(
      receiverSourceExpr,
      context
    );
    const [materializedReceiverAst, materializedReceiverContext] =
      materializeDirectNarrowingAst(
        objectAst,
        receiverStorageType,
        receiverType,
        newContext
      );
    const receiverAst = materializedReceiverAst;
    const receiverContext = materializedReceiverContext;
    const emittedSourceMemberName = emitMemberName(
      expr.object,
      receiverType,
      sourcePropertyName,
      context,
      usage
    );
    const emittedMemberName = hasSourceDeclaredReceiverMember
      ? emittedSourceMemberName
      : escapedMember;
    if (expr.isOptional) {
      return [
        {
          kind: "conditionalMemberAccessExpression",
          expression: receiverAst,
          memberName: emittedMemberName,
        },
        receiverContext,
      ];
    }
    return [
      {
        kind: "memberAccessExpression",
        expression: receiverAst,
        memberName: emittedMemberName,
      },
      receiverContext,
    ];
  }
};
