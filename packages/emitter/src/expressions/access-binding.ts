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
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
} from "../core/format/backend-ast/builders.js";
import { stripNullableTypeAst } from "../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  type MemberAccessUsage,
  stripClrGenericArity,
  eraseOutOfScopeArrayWrapperTypeParameters,
  emitStorageCompatibleArrayWrapperElementTypeAst,
  resolveEffectiveReceiverType,
  hasSourceDeclaredMember,
  resolveEmittedReceiverTypeAst,
  emitMemberName,
  isStaticTypeReference,
} from "./access-resolution.js";
import {
  isLengthPropertyName,
  tryEmitJsSurfaceArrayLikeLengthAccess,
} from "./access-length.js";

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

  const receiverType = resolveEffectiveReceiverType(expr.object, context);
  const arrayLikeReceiver = resolveArrayLikeReceiverType(receiverType, context);
  const hasArrayLikeBindingHint =
    bindingTypeLeaf === "JSArray" ||
    bindingTypeLeaf === "Array" ||
    bindingTypeLeaf === "ReadonlyArray" ||
    type.includes("JSArray") ||
    type.includes("System.Array");
  if (
    usage === "value" &&
    typeof expr.property === "string" &&
    isLengthPropertyName(expr.property) &&
    context.options.surface === "@tsonic/js" &&
    !expr.memberBinding.isExtensionMethod &&
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

    let elementTypeAst: CSharpTypeAst = {
      kind: "predefinedType",
      keyword: "object",
    };
    let elementContext = withObject;

    if (arrayLikeReceiver) {
      [elementTypeAst, elementContext] =
        emitStorageCompatibleArrayWrapperElementTypeAst(
          expr.object,
          receiverType,
          arrayLikeReceiver.elementType,
          withObject
        );
    } else {
      const [receiverTypeAst, receiverTypeContext] =
        resolveEmittedReceiverTypeAst(expr.object, withObject);
      elementContext = receiverTypeContext;
      const concreteReceiverTypeAst = receiverTypeAst
        ? stripNullableTypeAst(receiverTypeAst)
        : undefined;
      if (concreteReceiverTypeAst?.kind === "arrayType") {
        elementTypeAst = eraseOutOfScopeArrayWrapperTypeParameters(
          concreteReceiverTypeAst.elementType,
          receiverTypeContext
        );
      }
    }

    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: {
          kind: "objectCreationExpression",
          type: identifierType("global::Tsonic.JSRuntime.JSArray", [
            elementTypeAst,
          ]),
          arguments: [objectAst],
        },
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

      const wrapperAst: CSharpExpressionAst = {
        kind: "objectCreationExpression",
        type: identifierType(
          `global::${stripClrGenericArity(type)}`,
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
      expression: identifierExpression(`global::${type}.${escapedMember}`),
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

  if (isStaticTypeReference(expr, context) || isGlobalSimpleBindingAccess) {
    // Static access: emit full CLR type and member with global:: prefix
    return [identifierExpression(`global::${type}.${escapedMember}`), context];
  } else {
    // Instance access: emit object.ClrMemberName
    const [objectAst, newContext] = emitExpressionAst(expr.object, context);
    const sourcePropertyName =
      typeof expr.property === "string" ? expr.property : member;
    const emittedSourceMemberName = emitMemberName(
      expr.object,
      receiverType,
      sourcePropertyName,
      context,
      usage
    );
    const emittedMemberName = hasSourceDeclaredMember(
      receiverType,
      sourcePropertyName,
      usage,
      context
    )
      ? emittedSourceMemberName
      : escapedMember;
    if (expr.isOptional) {
      return [
        {
          kind: "conditionalMemberAccessExpression",
          expression: objectAst,
          memberName: emittedMemberName,
        },
        newContext,
      ];
    }
    return [
      {
        kind: "memberAccessExpression",
        expression: objectAst,
        memberName: emittedMemberName,
      },
      newContext,
    ];
  }
};
