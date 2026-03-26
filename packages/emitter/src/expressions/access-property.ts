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
import { stripNullableTypeAst } from "../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  type MemberAccessUsage,
  createStringLiteralExpression,
  maybeReifyStorageErasedMemberRead,
  resolveEmittedReceiverTypeAst,
  emitMemberName,
} from "./access-resolution.js";
import { buildJsSafeDictionaryReadAst } from "./dictionary-safe-access.js";
import {
  tryEmitErasedLengthAccess,
  tryEmitConcreteReceiverLengthAccess,
} from "./access-length.js";

/**
 * Emit a non-computed property member access expression as CSharpExpressionAst.
 *
 * Called by the main emitMemberAccess when expr.isComputed is false.
 */
export const emitPropertyAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  context: EmitterContext,
  usage: MemberAccessUsage = "value",
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const prop = expr.property as string;
  const resolvedObjectType = objectType
    ? resolveTypeAlias(stripNullish(objectType), context)
    : undefined;

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
        context
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
          expression: objectAst,
          memberName: "Count",
        },
        context,
      ];
    }

    const keyAst = createStringLiteralExpression(prop);
    if (context.options.surface === "@tsonic/js" && usage !== "write") {
      const fallbackType =
        expectedType ?? expr.inferredType ?? resolvedObjectType.valueType;
      const [resultTypeAst, typeContext] = emitTypeAst(fallbackType, context);
      return [
        buildJsSafeDictionaryReadAst(
          objectAst,
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
          expression: objectAst,
          arguments: [keyAst],
        },
        context,
      ];
    }

    return [
      {
        kind: "elementAccessExpression",
        expression: objectAst,
        arguments: [keyAst],
      },
      context,
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
          context,
        ];
      }
    }
  }

  const concreteReceiverLengthAccess = tryEmitConcreteReceiverLengthAccess(
    expr,
    objectAst,
    context
  );
  if (concreteReceiverLengthAccess) {
    return concreteReceiverLengthAccess;
  }

  const erasedLengthAccess = tryEmitErasedLengthAccess(
    expr,
    objectAst,
    objectType,
    context
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
      context,
    ];
  }

  return maybeReifyStorageErasedMemberRead(
    {
      kind: "memberAccessExpression",
      expression: objectAst,
      memberName,
    },
    expr,
    context,
    expectedType
  );
};
