import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import { stripNullableTypeAst } from "../../core/format/backend-ast/utils.js";
import { requiresValueTypeMaterialization } from "../../core/semantic/expected-type-matching.js";
import { resolveStructuralReferenceType } from "../../core/semantic/structural-shape-matching.js";
import { stripNullish } from "../../core/semantic/type-resolution.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import {
  getArrayElementType,
  getDictionaryValueType,
  isSameNominalType,
} from "../structural-type-shapes.js";
import { isExactExpressionToType } from "../exact-comparison.js";

export const getStorageIdentifierAst = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): CSharpExpressionAst | undefined => {
  const remappedLocal = context.localNameMap?.get(expr.name);
  if (remappedLocal) {
    return identifierExpression(remappedLocal);
  }

  if (context.localValueTypes?.has(expr.name)) {
    return identifierExpression(escapeCSharpIdentifier(expr.name));
  }

  return undefined;
};

export const needsStructuralCollectionMaterialization = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!actualType || !expectedType) {
    return false;
  }

  const actualArrayElement = getArrayElementType(actualType, context);
  const expectedArrayElement = getArrayElementType(expectedType, context);
  if (actualArrayElement && expectedArrayElement) {
    const actualStructuralElement =
      resolveStructuralReferenceType(actualArrayElement, context) ??
      stripNullish(actualArrayElement);
    const expectedStructuralElement =
      resolveStructuralReferenceType(expectedArrayElement, context) ??
      stripNullish(expectedArrayElement);

    if (
      (actualStructuralElement.kind === "objectType" ||
        expectedStructuralElement.kind === "objectType") &&
      !isSameNominalType(actualArrayElement, expectedArrayElement, context)
    ) {
      return true;
    }
  }

  const actualDictionaryValue = getDictionaryValueType(actualType, context);
  const expectedDictionaryValue = getDictionaryValueType(expectedType, context);
  if (actualDictionaryValue && expectedDictionaryValue) {
    const actualStructuralValue =
      resolveStructuralReferenceType(actualDictionaryValue, context) ??
      stripNullish(actualDictionaryValue);
    const expectedStructuralValue =
      resolveStructuralReferenceType(expectedDictionaryValue, context) ??
      stripNullish(expectedDictionaryValue);

    if (
      (actualStructuralValue.kind === "objectType" ||
        expectedStructuralValue.kind === "objectType") &&
      !isSameNominalType(
        actualDictionaryValue,
        expectedDictionaryValue,
        context
      )
    ) {
      return true;
    }
  }

  return false;
};

export const wrapMaterializedTargetAst = (
  valueAst: CSharpExpressionAst,
  targetType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [targetTypeAst, nextContext] = emitTypeAst(targetType, context);
  if (isExactExpressionToType(valueAst, stripNullableTypeAst(targetTypeAst))) {
    return [valueAst, nextContext];
  }

  if (
    valueAst.kind === "castExpression" ||
    (valueAst.kind === "memberAccessExpression" &&
      valueAst.memberName === "Value")
  ) {
    return [valueAst, context];
  }

  return [
    {
      kind: "castExpression",
      type: targetTypeAst,
      expression: valueAst,
    },
    nextContext,
  ];
};

export const preservesMaterializedValueTypeNarrowing = (
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext
): boolean => {
  const sourceType =
    narrowed.sourceType ?? narrowed.storageType ?? narrowed.carrierType;
  return (
    !!sourceType &&
    !!narrowed.type &&
    requiresValueTypeMaterialization(sourceType, narrowed.type, context)
  );
};
