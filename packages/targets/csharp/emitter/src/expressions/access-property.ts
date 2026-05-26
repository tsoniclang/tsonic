/**
 * Property member access expression emitters.
 *
 * Handles non-computed property access:
 * - Explicit interface view properties (As_IInterface)
 * - Declared dictionary CLR members and explicit dictionary-key IR
 * - Regular property access with member name resolution
 */

import { type IrType } from "@tsonic/frontend";
import { IrExpression } from "@tsonic/frontend";
import { contextSurfaceIncludesJs, EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  isExplicitViewProperty,
  extractInterfaceNameFromView,
} from "../core/semantic/explicit-views.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  getPropertyType,
  resolveTypeAlias,
  stripNullish,
} from "../core/semantic/type-resolution.js";
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
import {
  resolveEffectiveExpressionType,
  tryResolveRuntimeUnionMemberType,
} from "../core/semantic/narrowed-expression-types.js";
import { resolveTypeMemberKind } from "../core/semantic/member-surfaces.js";
import { unwrapTransparentExpression } from "../core/semantic/transparent-expressions.js";
import { buildJsSafeDictionaryReadAst } from "./dictionary-safe-access.js";
import { isExactExpressionToType } from "./exact-comparison.js";
import { materializeDirectNarrowingAst } from "../core/semantic/materialized-narrowing.js";
import { resolveDirectStorageIrType } from "../core/semantic/direct-storage-ir-types.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import { tryAdaptStructuralExpressionAst } from "./structural-adaptation.js";

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
  let receiverExpressionForMember: IrExpression = expr.object;
  let receiverTypeForMember = objectType;
  let erasedAsInterfaceSourceMemberType: IrType | undefined;
  let erasedAsInterfaceTargetMemberType: IrType | undefined;
  const isErasedAsInterfaceReceiver = expr.object.kind === "asinterface";

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
      (transparentReceiver.kind === "identifier"
        ? (receiverSourceContext.localSemanticTypes?.get(
            transparentReceiver.name
          ) ??
          receiverSourceContext.localValueTypes?.get(transparentReceiver.name))
        : undefined) ??
      resolveEffectiveExpressionType(
        transparentReceiver,
        receiverSourceContext
      ) ??
      transparentReceiver.inferredType;
    const transparentMemberResolutionType =
      expr.isOptional && transparentReceiverType
        ? stripNullish(transparentReceiverType)
        : transparentReceiverType;
    const receiverAlreadyExposesMember =
      !!transparentMemberResolutionType &&
      resolveTypeMemberKind(
        transparentMemberResolutionType,
        prop,
        receiverSourceContext
      ) !== undefined;
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
      receiverExpressionForMember = transparentReceiver;
      receiverTypeForMember = transparentReceiverType;
      erasedAsInterfaceSourceMemberType = getPropertyType(
        transparentMemberResolutionType,
        prop,
        receiverSourceContext
      );
      erasedAsInterfaceTargetMemberType =
        getPropertyType(expr.object.targetType, prop, context) ??
        expr.inferredType;
    } else if (receiverAlreadyExposesMember) {
      const [transparentReceiverAst, transparentReceiverContext] =
        emitExpressionAst(transparentReceiver, receiverSourceContext);
      receiverAst = transparentReceiverAst;
      receiverContext = transparentReceiverContext;
      receiverExpressionForMember = transparentReceiver;
      receiverTypeForMember = transparentReceiverType;
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

  const resolvedObjectType = receiverTypeForMember
    ? resolveTypeAlias(stripNullish(receiverTypeForMember), context)
    : undefined;
  const memberResolutionType =
    expr.isOptional && receiverTypeForMember
      ? stripNullish(receiverTypeForMember)
      : receiverTypeForMember;
  const receiverNarrowKey =
    receiverExpressionForMember.kind === "identifier"
      ? receiverExpressionForMember.name
      : receiverExpressionForMember.kind === "memberAccess"
        ? getMemberAccessNarrowKey(receiverExpressionForMember)
        : undefined;
  const receiverNarrowed = receiverNarrowKey
    ? receiverSourceContext.narrowedBindings?.get(receiverNarrowKey)
    : undefined;
  const receiverBindingCarrierType =
    receiverNarrowed?.kind === "expr"
      ? (receiverNarrowed.sourceType ?? receiverNarrowed.carrierType)
      : receiverNarrowed?.kind === "runtimeSubset" ||
          receiverNarrowed?.kind === "rename"
        ? receiverNarrowed.sourceType
        : undefined;
  const receiverStorageType =
    receiverBindingCarrierType ??
    resolveDirectStorageIrType(receiverExpressionForMember, receiverSourceContext);
  if (
    !isErasedAsInterfaceReceiver &&
    memberResolutionType &&
    resolveTypeMemberKind(memberResolutionType, prop, context) !== undefined
  ) {
    if (receiverStorageType) {
      const alreadyMaterializedReceiverType = tryResolveRuntimeUnionMemberType(
        receiverStorageType,
        receiverAst,
        receiverContext,
        { verifyReceiver: false }
      );
      const receiverAlreadyMaterialized =
        receiverNarrowed?.kind === "rename" ||
        (alreadyMaterializedReceiverType &&
          resolveTypeMemberKind(
            alreadyMaterializedReceiverType,
            prop,
            context
          ) !== undefined);
      const [materializedReceiverAst, materializedReceiverContext] =
        receiverAlreadyMaterialized
          ? [receiverAst, receiverContext]
          : materializeDirectNarrowingAst(
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

    if (expr.accessKind !== "dictionary") {
      const sourceInfo = expr.sourceSpan
        ? ` at ${expr.sourceSpan.file}:${String(expr.sourceSpan.line)}:${String(expr.sourceSpan.column)}`
        : "";
      throw new Error(
        `Internal Compiler Error: Non-computed dictionary member '${prop}' reached emitter without a declared CLR member${sourceInfo}. Use computed access for dictionary keys.`
      );
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

  const memberAccessAst: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: receiverAst,
    memberName,
  };
  const erasedAsInterfaceAdapted =
    isErasedAsInterfaceReceiver &&
    erasedAsInterfaceSourceMemberType &&
    erasedAsInterfaceTargetMemberType
      ? tryAdaptStructuralExpressionAst(
          memberAccessAst,
          erasedAsInterfaceSourceMemberType,
          receiverContext,
          erasedAsInterfaceTargetMemberType
        )
      : undefined;
  if (erasedAsInterfaceAdapted) {
    return erasedAsInterfaceAdapted;
  }

  return maybeReifyStorageErasedMemberRead(
    memberAccessAst,
    expr,
    receiverContext,
    expectedType ?? erasedAsInterfaceTargetMemberType
  );
};
