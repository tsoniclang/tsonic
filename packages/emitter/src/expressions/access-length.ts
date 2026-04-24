/**
 * Member access helpers for length/count property access emission,
 * including erased-receiver length dispatch, concrete-receiver length
 * mapping, and JS-surface array-like length wrapping.
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  getPropertyType,
  resolveTypeAlias,
  stripNullish,
  resolveArrayLikeReceiverType,
} from "../core/semantic/type-resolution.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  nullableType,
} from "../core/format/backend-ast/builders.js";
import {
  getIdentifierTypeName,
  getIdentifierTypeLeafName,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  isPlainObjectIrType,
  isObjectTypeAst,
  emitStorageCompatibleArrayWrapperElementTypeAst,
  resolveEmittedReceiverTypeAst,
  tryEmitBroadArrayAssertionReceiverStorageAst,
} from "./access-resolution.js";
import { buildNativeArrayInteropWrapAst } from "./array-interop.js";
import { hasSourceDeclaredMember } from "./access-resolution-types.js";
import { referenceTypeHasClrIdentity } from "../core/semantic/clr-type-identity.js";

const SYSTEM_STRING_CLR_NAMES = new Set([
  "System.String",
  "global::System.String",
]);

const isRuntimeUnionMemberProjectionAst = (
  exprAst: CSharpExpressionAst
): boolean => {
  let target = exprAst;
  while (
    target.kind === "parenthesizedExpression" ||
    target.kind === "castExpression"
  ) {
    target = target.expression;
  }

  return (
    target.kind === "invocationExpression" &&
    target.arguments.length === 0 &&
    target.expression.kind === "memberAccessExpression" &&
    /^As\d+$/.test(target.expression.memberName)
  );
};

export const isStringReceiverType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "string") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "string" ||
        resolved.name === "String" ||
        referenceTypeHasClrIdentity(resolved, SYSTEM_STRING_CLR_NAMES)))
  );
};

export const isLengthPropertyName = (propertyName: string): boolean =>
  propertyName === "length" ||
  propertyName === "Length" ||
  propertyName === "Count";

export const tryEmitErasedLengthAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    expr.isComputed ||
    expr.isOptional ||
    typeof expr.property !== "string" ||
    !isLengthPropertyName(expr.property)
  ) {
    return undefined;
  }

  const propertyType =
    getPropertyType(objectType, expr.property, context) ?? expr.inferredType;
  if (!propertyType) {
    return undefined;
  }

  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    context
  );
  const storageReceiverType =
    expr.object.kind === "identifier"
      ? context.localValueTypes?.get(expr.object.name)
      : undefined;
  const concreteReceiverTypeAst = receiverTypeAst
    ? stripNullableTypeAst(receiverTypeAst)
    : undefined;
  const storageIsObject =
    storageReceiverType !== undefined &&
    isPlainObjectIrType(storageReceiverType, context);
  if (
    !storageIsObject &&
    (!concreteReceiverTypeAst || !isObjectTypeAst(concreteReceiverTypeAst))
  ) {
    return undefined;
  }

  const [propertyTypeAst, propertyTypeContext] = emitTypeAst(
    propertyType,
    receiverTypeContext
  );

  const castLengthValue = (
    value: CSharpExpressionAst
  ): CSharpExpressionAst => ({
    kind: "castExpression",
    type: propertyTypeAst,
    expression: value,
  });

  return [
    {
      kind: "switchExpression",
      governingExpression: objectAst,
      arms: [
        {
          pattern: {
            kind: "declarationPattern",
            type: identifierType("global::System.String"),
            designation: "__tsonic_string",
          },
          expression: castLengthValue({
            kind: "memberAccessExpression",
            expression: identifierExpression("__tsonic_string"),
            memberName: "Length",
          }),
        },
        {
          pattern: {
            kind: "declarationPattern",
            type: identifierType("global::System.Array"),
            designation: "__tsonic_array",
          },
          expression: castLengthValue({
            kind: "memberAccessExpression",
            expression: identifierExpression("__tsonic_array"),
            memberName: "Length",
          }),
        },
        {
          pattern: {
            kind: "declarationPattern",
            type: identifierType("global::System.Collections.ICollection"),
            designation: "__tsonic_collection",
          },
          expression: castLengthValue({
            kind: "memberAccessExpression",
            expression: identifierExpression("__tsonic_collection"),
            memberName: "Count",
          }),
        },
        {
          pattern: { kind: "discardPattern" },
          expression: {
            kind: "defaultExpression",
            type: propertyTypeAst,
          },
        },
      ],
    },
    propertyTypeContext,
  ];
};

export const tryEmitConcreteReceiverLengthAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    expr.isComputed ||
    typeof expr.property !== "string" ||
    !isLengthPropertyName(expr.property)
  ) {
    return undefined;
  }

  const preservedReceiver = tryEmitBroadArrayAssertionReceiverStorageAst(
    expr.object,
    context
  );
  const effectiveObjectAst = preservedReceiver?.[0] ?? objectAst;
  const effectiveObjectContext = preservedReceiver?.[1] ?? context;
  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    effectiveObjectContext
  );
  const concreteReceiverTypeAst = receiverTypeAst
    ? stripNullableTypeAst(receiverTypeAst)
    : undefined;
  const declaredReceiverType =
    expr.object.kind === "identifier"
      ? (context.localSemanticTypes?.get(expr.object.name) ??
        context.localValueTypes?.get(expr.object.name))
      : undefined;

  if (!concreteReceiverTypeAst) {
    return undefined;
  }

  if (
    typeof expr.property === "string" &&
    hasSourceDeclaredMember(
      declaredReceiverType ?? expr.object.inferredType,
      expr.property,
      "value",
      effectiveObjectContext
    )
  ) {
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: effectiveObjectAst,
        memberName: expr.property,
      },
      receiverTypeContext,
    ];
  }

  if (concreteReceiverTypeAst.kind === "arrayType") {
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: effectiveObjectAst,
        memberName: "Length",
      },
      receiverTypeContext,
    ];
  }

  const receiverTypeName = getIdentifierTypeName(concreteReceiverTypeAst);
  const receiverLeafName = getIdentifierTypeLeafName(concreteReceiverTypeAst);
  if (
    receiverTypeName?.startsWith("global::js.") ||
    receiverTypeName?.startsWith("js.")
  ) {
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: effectiveObjectAst,
        memberName: expr.property,
      },
      receiverTypeContext,
    ];
  }
  if (
    receiverTypeName === "global::System.Array" ||
    receiverTypeName === "System.Array"
  ) {
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: effectiveObjectAst,
        memberName: "Length",
      },
      receiverTypeContext,
    ];
  }

  if (
    receiverLeafName === "ICollection" ||
    receiverLeafName === "IReadOnlyCollection"
  ) {
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: effectiveObjectAst,
        memberName: "Count",
      },
      receiverTypeContext,
    ];
  }

  return undefined;
};

export const tryEmitJsSurfaceArrayLikeLengthAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    context.options.surface !== "@tsonic/js" ||
    expr.isComputed ||
    typeof expr.property !== "string" ||
    !isLengthPropertyName(expr.property)
  ) {
    return undefined;
  }

  const arrayLikeReceiver = resolveArrayLikeReceiverType(objectType, context);
  if (arrayLikeReceiver && isRuntimeUnionMemberProjectionAst(objectAst)) {
    return [
      expr.isOptional
        ? {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: objectAst,
              right: nullLiteral(),
            },
            whenTrue: {
              kind: "defaultExpression",
              type: nullableType({ kind: "predefinedType", keyword: "int" }),
            },
            whenFalse: {
              kind: "memberAccessExpression",
              expression: objectAst,
              memberName: "Length",
            },
          }
        : {
            kind: "memberAccessExpression",
            expression: objectAst,
            memberName: "Length",
          },
      context,
    ];
  }

  const preservedReceiver = tryEmitBroadArrayAssertionReceiverStorageAst(
    expr.object,
    context
  );
  const effectiveObjectAst = preservedReceiver?.[0] ?? objectAst;
  const effectiveObjectContext = preservedReceiver?.[1] ?? context;
  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    effectiveObjectContext
  );
  const concreteReceiverTypeAst = receiverTypeAst
    ? stripNullableTypeAst(receiverTypeAst)
    : undefined;
  const declaredReceiverType =
    expr.object.kind === "identifier"
      ? (context.localSemanticTypes?.get(expr.object.name) ??
        context.localValueTypes?.get(expr.object.name))
      : undefined;

  if (
    typeof expr.property === "string" &&
    hasSourceDeclaredMember(
      declaredReceiverType ?? objectType,
      expr.property,
      "value",
      effectiveObjectContext
    )
  ) {
    return [
      expr.isOptional
        ? {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: effectiveObjectAst,
              right: nullLiteral(),
            },
            whenTrue: {
              kind: "defaultExpression",
              type: nullableType({ kind: "predefinedType", keyword: "int" }),
            },
            whenFalse: {
              kind: "memberAccessExpression",
              expression: effectiveObjectAst,
              memberName: expr.property,
            },
          }
        : {
            kind: "memberAccessExpression",
            expression: effectiveObjectAst,
            memberName: expr.property,
          },
      receiverTypeContext,
    ];
  }

  const buildOptionalArrayWrapperLengthAccess = (
    nextContext: EmitterContext
  ): [CSharpExpressionAst, EmitterContext] => [
    expr.isOptional
      ? {
          kind: "conditionalExpression",
          condition: {
            kind: "binaryExpression",
            operatorToken: "==",
            left: objectAst,
            right: nullLiteral(),
          },
          whenTrue: {
            kind: "defaultExpression",
            type: nullableType({ kind: "predefinedType", keyword: "int" }),
          },
          whenFalse: {
            kind: "memberAccessExpression",
            expression: buildNativeArrayInteropWrapAst(objectAst),
            memberName: "length",
          },
        }
      : {
          kind: "memberAccessExpression",
          expression: buildNativeArrayInteropWrapAst(objectAst),
          memberName: "length",
        },
    nextContext,
  ];

  if (concreteReceiverTypeAst?.kind === "arrayType") {
    return [
      expr.isOptional
        ? {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: effectiveObjectAst,
              right: nullLiteral(),
            },
            whenTrue: {
              kind: "defaultExpression",
              type: nullableType({ kind: "predefinedType", keyword: "int" }),
            },
            whenFalse: {
              kind: "memberAccessExpression",
              expression: effectiveObjectAst,
              memberName: "Length",
            },
          }
        : {
            kind: "memberAccessExpression",
            expression: effectiveObjectAst,
            memberName: "Length",
          },
      receiverTypeContext,
    ];
  }

  const receiverTypeName = concreteReceiverTypeAst
    ? getIdentifierTypeName(concreteReceiverTypeAst)
    : undefined;
  const receiverLeafName = concreteReceiverTypeAst
    ? getIdentifierTypeLeafName(concreteReceiverTypeAst)
    : undefined;
  if (
    receiverTypeName === "global::System.Array" ||
    receiverTypeName === "System.Array" ||
    receiverLeafName === "Array"
  ) {
    return [
      expr.isOptional
        ? {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: objectAst,
              right: nullLiteral(),
            },
            whenTrue: {
              kind: "defaultExpression",
              type: nullableType({ kind: "predefinedType", keyword: "int" }),
            },
            whenFalse: {
              kind: "memberAccessExpression",
              expression: effectiveObjectAst,
              memberName: "Length",
            },
          }
        : {
            kind: "memberAccessExpression",
            expression: effectiveObjectAst,
            memberName: "Length",
          },
      receiverTypeContext,
    ];
  }

  if (hasSourceDeclaredMember(objectType, expr.property, "value", context)) {
    return [
      expr.isOptional
        ? {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: effectiveObjectAst,
              right: nullLiteral(),
            },
            whenTrue: {
              kind: "defaultExpression",
              type: nullableType({ kind: "predefinedType", keyword: "int" }),
            },
            whenFalse: {
              kind: "memberAccessExpression",
              expression: effectiveObjectAst,
              memberName: expr.property,
            },
          }
        : {
            kind: "memberAccessExpression",
            expression: effectiveObjectAst,
            memberName: expr.property,
          },
      receiverTypeContext,
    ];
  }

  if (!arrayLikeReceiver) {
    return undefined;
  }
  const [, typeContext] = emitStorageCompatibleArrayWrapperElementTypeAst(
    expr.object,
    objectType,
    arrayLikeReceiver.elementType,
    context
  );

  return buildOptionalArrayWrapperLengthAccess(typeContext);
};
