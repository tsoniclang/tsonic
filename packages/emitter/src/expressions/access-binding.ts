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
import { tryEmitJsSurfaceArrayLikeLengthAccess } from "./access-length.js";
import { materializeDirectNarrowingAst } from "../core/semantic/materialized-narrowing.js";
import { resolveDirectStorageIrType } from "../core/semantic/direct-storage-ir-types.js";
import { getClrIdentityKey } from "../core/semantic/clr-type-identity.js";
import {
  getSurfaceEmittedMemberName,
  surfaceMemberEmitsAsInstanceMember,
  surfaceMemberReadsArrayLength,
} from "../core/semantic/surface-member-semantics.js";

const clrBindingTypeHasIdentity = (
  bindingTypeName: string,
  expectedClrName: string
): boolean =>
  getClrIdentityKey(bindingTypeName) === getClrIdentityKey(expectedClrName);

const isSystemArrayBindingType = (bindingTypeName: string): boolean =>
  clrBindingTypeHasIdentity(bindingTypeName, "System.Array");

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
  const surfaceEmittedMemberName = getSurfaceEmittedMemberName(
    expr.memberBinding,
    context
  );
  const emitsAsInstanceMember = surfaceMemberEmitsAsInstanceMember(
    expr.memberBinding,
    context
  );
  const escapedMember = escapeCSharpIdentifier(
    surfaceEmittedMemberName ?? member
  );
  const bindingTypeLeaf = stripClrGenericArity(type).split(".").pop();
  const normalizedBindingType = normalizeClrQualifiedName(type, true);
  const normalizedBindingTypeWithoutArity = normalizeClrQualifiedName(
    stripClrGenericArity(type),
    true
  );

  const receiverType = resolveEffectiveReceiverType(expr.object, context);
  const declaredReceiverType =
    expr.object.kind === "identifier"
      ? context.localSemanticTypes?.get(expr.object.name)
      : undefined;
  const sourcePropertyName =
    typeof expr.property === "string" ? expr.property : member;
  const arrayLikeReceiver = resolveArrayLikeReceiverType(receiverType, context);
  const readsArrayLength = surfaceMemberReadsArrayLength(
    expr.memberBinding,
    context
  );
  const directReceiverStorageType =
    usage === "value" && readsArrayLength
      ? resolveDirectStorageIrType(expr.object, context)
      : undefined;
  const directArrayLikeReceiver = resolveArrayLikeReceiverType(
    directReceiverStorageType,
    context
  );
  const hasArrayLikeBindingHint =
    bindingTypeLeaf === "Array" ||
    bindingTypeLeaf === "ReadonlyArray" ||
    isSystemArrayBindingType(type);
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
  if (usage === "value" && readsArrayLength && directArrayLikeReceiver) {
    const [objectAst, withObject] = emitExpressionAst(expr.object, context);
    return tryEmitJsSurfaceArrayLikeLengthAccess(
      expr,
      objectAst,
      directReceiverStorageType,
      withObject
    );
  }
  if (
    usage === "value" &&
    readsArrayLength &&
    (hasSourceDeclaredReceiverMember || receiverHasDeterministicMember)
  ) {
    return undefined;
  }
  if (
    usage === "value" &&
    readsArrayLength &&
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
    !isSystemArrayBindingType(type)
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

  if (
    usage === "value" &&
    expr.memberBinding.isExtensionMethod &&
    !emitsAsInstanceMember
  ) {
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
    const erasedAsInterfaceReceiver =
      expr.object.kind === "asinterface" ? transparentReceiver : undefined;
    const receiverForEmission =
      erasedAsInterfaceReceiver ??
      (transparentReceiverAlreadyExposesMember
        ? transparentReceiver
        : undefined);
    const [objectAst, newContext] =
      receiverForEmission !== undefined
        ? emitExpressionAst(receiverForEmission, context)
        : emitExpressionAst(expr.object, context);
    const receiverSourceExpr =
      receiverForEmission !== undefined ? receiverForEmission : expr.object;
    const receiverMaterializationType =
      erasedAsInterfaceReceiver !== undefined
        ? transparentReceiverType
        : receiverType;
    const receiverStorageType = resolveDirectStorageIrType(
      receiverSourceExpr,
      context
    );
    const [materializedReceiverAst, materializedReceiverContext] =
      materializeDirectNarrowingAst(
        objectAst,
        receiverStorageType,
        receiverMaterializationType,
        newContext
      );
    const receiverAst = materializedReceiverAst;
    const receiverContext = materializedReceiverContext;
    const emittedSourceMemberName = emitMemberName(
      receiverSourceExpr,
      receiverMaterializationType ?? receiverType,
      sourcePropertyName,
      context,
      usage
    );
    const emittedMemberName =
      surfaceEmittedMemberName !== undefined
        ? escapedMember
        : hasSourceDeclaredReceiverMember
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
