/**
 * Property member access expression emitters.
 *
 * Handles non-computed property access:
 * - Explicit interface view properties (As_IInterface)
 * - Dictionary pseudo-members (Keys, Values, Count)
 * - Array/tuple length access
 * - Regular property access with member name resolution
 */

import { type IrType } from "@tsonic/frontend";
import { IrExpression } from "@tsonic/frontend";
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
} from "../core/semantic/type-resolution.js";
import { emitCSharpName } from "../naming-policy.js";
import { identifierType } from "../core/format/backend-ast/builders.js";
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
import {
  tryEmitErasedLengthAccess,
  tryEmitConcreteReceiverLengthAccess,
} from "./access-length.js";
import { isExactExpressionToType } from "./exact-comparison.js";

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
    const transparentReceiver = unwrapTransparentExpression(expr.object.expression);
    const transparentReceiverType =
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

  if (
    usage === "value" &&
    (prop === "length" || prop === "Length" || prop === "Count")
  ) {
    const [storageReceiverTypeAst, storageContext] =
      resolveEmittedReceiverTypeAst(expr.object, context);
    const concreteStorageReceiverTypeAst = storageReceiverTypeAst
      ? stripNullableTypeAst(storageReceiverTypeAst)
      : undefined;
    if (concreteStorageReceiverTypeAst?.kind === "arrayType") {
      return [
        {
          kind: expr.isOptional
            ? "conditionalMemberAccessExpression"
            : "memberAccessExpression",
          expression: receiverAst,
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
        expression: receiverAst,
        memberName: collectionMemberName,
      };

      const elementType =
        prop === "Keys"
          ? resolvedObjectType.keyType
          : resolvedObjectType.valueType;
      const [elementTypeAst, ctxAfterType] = emitTypeAst(elementType, context);

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
          expression: receiverAst,
          memberName: "Count",
        },
        receiverContext,
      ];
    }

    const keyAst = createStringLiteralExpression(prop);
    if (context.options.surface === "@tsonic/js" && usage !== "write") {
      const fallbackType =
        expectedType ?? expr.inferredType ?? resolvedObjectType.valueType;
      const [resultTypeAst, typeContext] = emitTypeAst(fallbackType, context);
      return [
        buildJsSafeDictionaryReadAst(
          receiverAst,
          keyAst,
          expr.isOptional,
          resultTypeAst
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
  const receiverResolutionContext =
    expr.object.kind === "typeAssertion" ||
    expr.object.kind === "asinterface" ||
    expr.object.kind === "trycast"
      ? context
      : receiverContext;

  if (usage === "value") {
    const concreteReceiverLengthAccess = tryEmitConcreteReceiverLengthAccess(
      expr,
      receiverAst,
      receiverResolutionContext
    );
    if (concreteReceiverLengthAccess) {
      return concreteReceiverLengthAccess;
    }

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
            expression: receiverAst,
            memberName: "Length",
          },
          receiverContext,
        ];
      }
    }
  }

  const erasedLengthAccess = tryEmitErasedLengthAccess(
    expr,
    receiverAst,
    objectType,
    receiverResolutionContext
  );
  if (erasedLengthAccess) {
    return erasedLengthAccess;
  }

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
