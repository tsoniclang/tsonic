import type { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  isRuntimeNullishType,
  resolveArrayLikeReceiverType,
  resolveArrayOverlayCarrierType,
  resolveArrayOverlayPropertyType,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import {
  identifierType,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";

export type ArrayOverlayProperty = {
  readonly type: IrType;
  readonly isOptional: boolean;
};

const hasRuntimeNullish = (type: IrType): boolean =>
  type.kind === "unionType" && type.types.some(isRuntimeNullishType);

const helperTypeExpression = (): CSharpExpressionAst => ({
  kind: "typeReferenceExpression",
  type: identifierType("global::Tsonic.Internal.IntersectionStorage"),
});

const helperCall = (
  methodName: string,
  valueType: IrType,
  receiverAst: CSharpExpressionAst,
  propertyName: string,
  context: EmitterContext,
  additionalArguments: readonly CSharpExpressionAst[] = []
): [CSharpExpressionAst, EmitterContext] => {
  const [valueTypeAst, typeContext] = emitTypeAst(
    stripNullish(valueType),
    context
  );
  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: helperTypeExpression(),
        memberName: methodName,
      },
      typeArguments: [valueTypeAst],
      arguments: [
        receiverAst,
        stringLiteral(propertyName),
        ...additionalArguments,
      ],
    },
    typeContext,
  ];
};

export const tryResolveArrayOverlayProperty = (
  memberType: IrType | undefined,
  carrierType: IrType | undefined,
  propertyName: string,
  context: EmitterContext
): ArrayOverlayProperty | undefined => {
  const propertyType = resolveArrayOverlayPropertyType(
    memberType,
    propertyName,
    context
  );
  if (!propertyType) {
    return undefined;
  }

  const memberHasArrayCarrier = !!resolveArrayOverlayCarrierType(
    memberType,
    context
  );
  const carrierHasArrayStorage =
    !!resolveArrayOverlayCarrierType(carrierType, context) ||
    !!resolveArrayLikeReceiverType(carrierType, context);
  if (!memberHasArrayCarrier && !carrierHasArrayStorage) {
    return undefined;
  }

  return {
    type: propertyType,
    isOptional: hasRuntimeNullish(propertyType),
  };
};

export const emitArrayOverlayPropertyRead = (
  receiverAst: CSharpExpressionAst,
  propertyName: string,
  property: ArrayOverlayProperty,
  context: EmitterContext,
  forceOptional = false
): [CSharpExpressionAst, EmitterContext] =>
  helperCall(
    property.isOptional || forceOptional ? "GetOptional" : "GetRequired",
    property.type,
    receiverAst,
    propertyName,
    context
  );

export const emitArrayOverlayPropertyWrite = (
  receiverAst: CSharpExpressionAst,
  propertyName: string,
  property: ArrayOverlayProperty,
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] =>
  helperCall("Set", property.type, receiverAst, propertyName, context, [
    valueAst,
  ]);
