/**
 * Property member access expression emitters.
 *
 * Handles non-computed property access:
 * - Explicit interface view properties (As_IInterface)
 * - JS-surface dictionary property reads
 * - Regular property access with member name resolution
 */

import { type IrType } from "@tsonic/frontend";
import { IrExpression } from "@tsonic/frontend";
import { contextSurfaceIncludesJs, EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  isExplicitViewProperty,
  extractInterfaceNameFromView,
} from "@tsonic/frontend/types/explicit-views.js";
import { emitTypeAst } from "../type-emitter.js";
import { resolveTypeAlias, stripNullish } from "../core/semantic/type-resolution.js";
import { nullableType } from "../core/format/backend-ast/builders.js";
import { emitCSharpName } from "../naming-policy.js";
import {
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  type MemberAccessUsage,
  createStringLiteralExpression,
  maybeReifyStorageErasedMemberRead,
  resolveEmittedReceiverTypeAst,
  emitMemberName,
  tryEmitBroadArrayAssertionReceiverStorageAst,
} from "./access-resolution.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { resolveTypeMemberKind } from "../core/semantic/member-surfaces.js";
import { unwrapTransparentExpression } from "../core/semantic/transparent-expressions.js";
import { buildJsSafeDictionaryReadAst } from "./dictionary-safe-access.js";
import { isExactExpressionToType } from "./exact-comparison.js";
import { materializeDirectNarrowingAst } from "../core/semantic/materialized-narrowing.js";
import { resolveDirectStorageIrType } from "../core/semantic/direct-storage-ir-types.js";

/**
 * Emit a non-computed property member access expression as CSharpExpressionAst.
 *
 * Called by the main emitMemberAccess when expr.isComputed is false.
 */
export const emitPropertyAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  receiverSourceContext: EmitterContext,
  context: EmitterContext,
  usage: MemberAccessUsage = "value",
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const prop = expr.property as string;
  let receiverAst = objectAst;
  let receiverContext = context;
  const isErasedAsInterfaceReceiver = expr.object.kind === "asinterface";
  const resolvedObjectType = objectType
    ? resolveTypeAlias(stripNullish(objectType), context)
    : undefined;

  if (
    expr.object.kind === "typeAssertion" ||
    expr.object.kind === "asinterface" ||
    expr.object.kind === "trycast"
  ) {
    const preservedBroadArrayReceiver =
      expr.object.kind === "typeAssertion"
        ? tryEmitBroadArrayAssertionReceiverStorageAst(
            expr.object,
            receiverSourceContext
          )
        : undefined;
    const transparentReceiver = unwrapTransparentExpression(
      expr.object.expression
    );
    const transparentReceiverType =
      resolveEffectiveExpressionType(
        transparentReceiver,
        receiverSourceContext
      ) ?? transparentReceiver.inferredType;
    const transparentMemberResolutionType =
      expr.isOptional && transparentReceiverType
        ? stripNullish(transparentReceiverType)
        : transparentReceiverType;
    const receiverAlreadyExposesMember =
      !!transparentMemberResolutionType &&
      resolveTypeMemberKind(transparentMemberResolutionType, prop, context) !==
        undefined;
    const [emittedReceiverTypeAst, emittedReceiverContext] =
      resolveEmittedReceiverTypeAst(expr.object, context);
    const [transparentReceiverTypeAst] = resolveEmittedReceiverTypeAst(
      transparentReceiver,
      receiverSourceContext
    );
    const transparentReceiverSurface = transparentReceiverTypeAst
      ? stripNullableTypeAst(transparentReceiverTypeAst)
      : undefined;
    const emittedReceiverSurface = emittedReceiverTypeAst
      ? stripNullableTypeAst(emittedReceiverTypeAst)
      : undefined;
    if (preservedBroadArrayReceiver) {
      receiverAst = preservedBroadArrayReceiver[0];
      receiverContext = preservedBroadArrayReceiver[1];
    } else if (expr.object.kind === "asinterface") {
      const [transparentReceiverAst, transparentReceiverContext] =
        emitExpressionAst(transparentReceiver, receiverSourceContext);
      receiverAst = transparentReceiverAst;
      receiverContext = transparentReceiverContext;
    } else if (
      receiverAlreadyExposesMember &&
      transparentReceiverSurface &&
      emittedReceiverSurface &&
      !sameTypeAstSurface(emittedReceiverSurface, transparentReceiverSurface)
    ) {
      const [transparentReceiverAst, transparentReceiverContext] =
        emitExpressionAst(transparentReceiver, receiverSourceContext);
      receiverAst = transparentReceiverAst;
      receiverContext = transparentReceiverContext;
    } else if (
      !receiverAlreadyExposesMember &&
      emittedReceiverTypeAst &&
      !(
        transparentReceiverSurface &&
        emittedReceiverSurface &&
        sameTypeAstSurface(emittedReceiverSurface, transparentReceiverSurface)
      ) &&
      !isExactExpressionToType(
        receiverAst,
        emittedReceiverSurface ?? stripNullableTypeAst(emittedReceiverTypeAst)
      )
    ) {
      receiverAst = {
        kind: "castExpression",
        type: emittedReceiverTypeAst,
        expression: receiverAst,
      };
      receiverContext = emittedReceiverContext;
    }
  }

  const memberResolutionType =
    expr.isOptional && objectType ? stripNullish(objectType) : objectType;
  const receiverStorageType = resolveDirectStorageIrType(
    expr.object,
    receiverSourceContext
  );
  if (
    !isErasedAsInterfaceReceiver &&
    memberResolutionType &&
    resolveTypeMemberKind(memberResolutionType, prop, context) !== undefined
  ) {
    if (receiverStorageType) {
      const [materializedReceiverAst, materializedReceiverContext] =
        materializeDirectNarrowingAst(
          receiverAst,
          receiverStorageType,
          memberResolutionType,
          receiverContext
        );
      receiverAst = materializedReceiverAst;
      receiverContext = materializedReceiverContext;
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
        context
      );
      return [
        {
          kind: "castExpression",
          type: interfaceTypeAst,
          expression: receiverAst,
        },
        ctxAfterType,
      ];
    }
  }

  if (resolvedObjectType?.kind === "dictionaryType") {
    if (
      expr.accessKind !== "dictionary" &&
      (prop === "Count" || prop === "Keys" || prop === "Values")
    ) {
      return [
        {
          kind: expr.isOptional
            ? "conditionalMemberAccessExpression"
            : "memberAccessExpression",
          expression: receiverAst,
          memberName: emitCSharpName(prop, "properties", context),
        },
        receiverContext,
      ];
    }

    const keyAst = createStringLiteralExpression(prop);
    if (usage !== "write" && contextSurfaceIncludesJs(context)) {
      const fallbackType =
        expectedType ?? expr.inferredType ?? resolvedObjectType.valueType;
      const [resultTypeAst, typeContext] =
        fallbackType.kind === "unknownType"
          ? [
              nullableType({ kind: "predefinedType", keyword: "object" }),
              context,
            ]
          : emitTypeAst(fallbackType, context);
      return [
        buildJsSafeDictionaryReadAst(
          receiverAst,
          keyAst,
          expr.isOptional,
          resultTypeAst,
          typeContext
        ),
        typeContext,
      ];
    }

    if (expr.isOptional) {
      return [
        {
          kind: "conditionalElementAccessExpression",
          expression: receiverAst,
          arguments: [keyAst],
        },
        receiverContext,
      ];
    }

    return [
      {
        kind: "elementAccessExpression",
        expression: receiverAst,
        arguments: [keyAst],
      },
      receiverContext,
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

  if (expr.isOptional) {
    return [
      {
        kind: "conditionalMemberAccessExpression",
        expression: receiverAst,
        memberName,
      },
      receiverContext,
    ];
  }

  return maybeReifyStorageErasedMemberRead(
    {
      kind: "memberAccessExpression",
      expression: receiverAst,
      memberName,
    },
    expr,
    receiverContext,
    expectedType
  );
};
