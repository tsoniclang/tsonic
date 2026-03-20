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
  eraseOutOfScopeArrayWrapperTypeParameters,
  emitStorageCompatibleArrayWrapperElementTypeAst,
  resolveEmittedReceiverTypeAst,
} from "./access-resolution.js";

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
        resolved.resolvedClrType === "System.String" ||
        resolved.resolvedClrType === "global::System.String"))
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
            kind: "invocationExpression",
            expression: identifierExpression(
              "global::Tsonic.JSRuntime.String.length"
            ),
            arguments: [identifierExpression("__tsonic_string")],
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

  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    context
  );
  const concreteReceiverTypeAst = receiverTypeAst
    ? stripNullableTypeAst(receiverTypeAst)
    : undefined;

  if (!concreteReceiverTypeAst) {
    return undefined;
  }

  if (concreteReceiverTypeAst.kind === "arrayType") {
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: objectAst,
        memberName: "Length",
      },
      receiverTypeContext,
    ];
  }

  const receiverTypeName = getIdentifierTypeName(concreteReceiverTypeAst);
  const receiverLeafName = getIdentifierTypeLeafName(concreteReceiverTypeAst);
  if (
    receiverTypeName === "global::System.Array" ||
    receiverTypeName === "System.Array" ||
    receiverLeafName === "Array"
  ) {
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: objectAst,
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
        expression: objectAst,
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

  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    context
  );
  const concreteReceiverTypeAst = receiverTypeAst
    ? stripNullableTypeAst(receiverTypeAst)
    : undefined;

  if (concreteReceiverTypeAst?.kind === "arrayType") {
    const elementTypeAst = eraseOutOfScopeArrayWrapperTypeParameters(
      concreteReceiverTypeAst.elementType,
      receiverTypeContext
    );
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
      receiverTypeContext,
    ];
  }

  const arrayLikeReceiver = resolveArrayLikeReceiverType(objectType, context);
  if (!arrayLikeReceiver) {
    return undefined;
  }
  const [elementTypeAst, typeContext] =
    emitStorageCompatibleArrayWrapperElementTypeAst(
      expr.object,
      objectType,
      arrayLikeReceiver.elementType,
      context
    );

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
    typeContext,
  ];
};
