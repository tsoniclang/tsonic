import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import {
  getIdentifierTypeName,
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../format/backend-ast/utils.js";
import type { EmitTypeAstFn } from "./runtime-reification.js";
import { buildRuntimeUnionLayout } from "./runtime-unions.js";
import {
  matchesExpectedEmissionType,
  matchesSemanticExpectedType,
  requiresValueTypeMaterialization,
} from "./expected-type-matching.js";
import { tryBuildRuntimeReificationPlan } from "./runtime-reification.js";
import {
  getArrayLikeElementType,
  isDefinitelyValueType,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "./type-resolution.js";
import { materializeDirectNarrowingAst } from "./materialized-narrowing.js";
import { referenceTypeHasClrIdentity } from "./clr-type-identity.js";

const requiresRuntimeUnionArrayElementMaterialization = (
  storageType: IrType,
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): [boolean, EmitterContext] => {
  const sourceElementType = getArrayLikeElementType(storageType, context);
  const targetElementType = getArrayLikeElementType(expectedType, context);
  if (!sourceElementType || !targetElementType) {
    return [false, context];
  }

  const [sourceLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    sourceElementType,
    context,
    emitTypeAst
  );
  if (!sourceLayout) {
    return [false, sourceLayoutContext];
  }

  const [sourceElementTypeAst, sourceTypeContext] = emitTypeAst(
    sourceElementType,
    sourceLayoutContext
  );
  const [targetElementTypeAst, targetTypeContext] = emitTypeAst(
    targetElementType,
    sourceTypeContext
  );

  return [
    !sameTypeAstSurface(sourceElementTypeAst, targetElementTypeAst),
    targetTypeContext,
  ];
};

const isObjectTypeAst = (
  typeAst: Parameters<typeof stripNullableTypeAst>[0]
): boolean => {
  const concreteTypeAst = stripNullableTypeAst(typeAst);
  if (concreteTypeAst.kind === "predefinedType") {
    return concreteTypeAst.keyword === "object";
  }

  const identifierName = getIdentifierTypeName(concreteTypeAst);
  return (
    identifierName === "System.Object" ||
    identifierName === "global::System.Object"
  );
};

const isBroadStorageType = (type: IrType, context: EmitterContext): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context, {
    preserveObjectTypeAliases: true,
  });
  return (
    resolved.kind === "unknownType" ||
    resolved.kind === "anyType" ||
    resolved.kind === "objectType" ||
    (resolved.kind === "referenceType" && resolved.name === "object")
  );
};

const NUMERIC_REFERENCE_TYPE_NAMES = new Set([
  "sbyte",
  "SByte",
  "byte",
  "Byte",
  "short",
  "Int16",
  "ushort",
  "UInt16",
  "int",
  "Int32",
  "uint",
  "UInt32",
  "long",
  "Int64",
  "ulong",
  "UInt64",
  "nint",
  "IntPtr",
  "nuint",
  "UIntPtr",
  "float",
  "Single",
  "double",
  "Double",
  "decimal",
  "Decimal",
  "half",
  "Half",
]);

const NUMERIC_CLR_TYPE_NAMES = new Set([
  "System.SByte",
  "global::System.SByte",
  "System.Byte",
  "global::System.Byte",
  "System.Int16",
  "global::System.Int16",
  "System.UInt16",
  "global::System.UInt16",
  "System.Int32",
  "global::System.Int32",
  "System.UInt32",
  "global::System.UInt32",
  "System.Int64",
  "global::System.Int64",
  "System.UInt64",
  "global::System.UInt64",
  "System.IntPtr",
  "global::System.IntPtr",
  "System.UIntPtr",
  "global::System.UIntPtr",
  "System.Single",
  "global::System.Single",
  "System.Double",
  "global::System.Double",
  "System.Decimal",
  "global::System.Decimal",
  "System.Half",
  "global::System.Half",
]);

const isConcreteNumericStorageType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  if (splitRuntimeNullishUnionMembers(type)?.hasRuntimeNullish ?? false) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "literalType") {
    return typeof resolved.value === "number";
  }
  if (resolved.kind === "primitiveType") {
    return resolved.name === "number" || resolved.name === "int";
  }
  return (
    resolved.kind === "referenceType" &&
    (NUMERIC_REFERENCE_TYPE_NAMES.has(resolved.name) ||
      referenceTypeHasClrIdentity(resolved, NUMERIC_CLR_TYPE_NAMES))
  );
};

const tryCastConcreteNumericStorageAst = (
  valueAst: CSharpExpressionAst,
  storageType: IrType,
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    !isConcreteNumericStorageType(storageType, context) ||
    !isConcreteNumericStorageType(expectedType, context)
  ) {
    return undefined;
  }

  const [storageTypeAst, storageTypeContext] = emitTypeAst(
    storageType,
    context
  );
  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    storageTypeContext
  );
  if (
    sameTypeAstSurface(
      stripNullableTypeAst(storageTypeAst),
      stripNullableTypeAst(expectedTypeAst)
    )
  ) {
    return [valueAst, expectedTypeContext];
  }

  return [
    {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: stripObjectBoxForConcreteStorageMaterialization(
        valueAst,
        storageType,
        expectedType,
        expectedTypeContext
      ),
    },
    expectedTypeContext,
  ];
};

const stripObjectBoxForConcreteStorageMaterialization = (
  valueAst: CSharpExpressionAst,
  storageType: IrType,
  expectedType: IrType,
  context: EmitterContext
): CSharpExpressionAst => {
  if (
    valueAst.kind !== "castExpression" ||
    !isObjectTypeAst(valueAst.type) ||
    !isDefinitelyValueType(expectedType) ||
    isBroadStorageType(storageType, context)
  ) {
    return valueAst;
  }

  return valueAst.expression;
};

export const adaptStorageErasedValueAst = (opts: {
  readonly valueAst: CSharpExpressionAst;
  readonly semanticType: IrType | undefined;
  readonly storageType: IrType | undefined;
  readonly expectedType: IrType | undefined;
  readonly context: EmitterContext;
  readonly emitTypeAst: EmitTypeAstFn;
  readonly allowCastFallback?: boolean;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const {
    valueAst,
    semanticType,
    storageType,
    expectedType,
    context,
    emitTypeAst,
    allowCastFallback = true,
  } = opts;

  if (!expectedType || !semanticType || !storageType) {
    return undefined;
  }
  const [needsArrayElementMaterialization, needsPlanContext] =
    requiresRuntimeUnionArrayElementMaterialization(
      storageType,
      expectedType,
      context,
      emitTypeAst
    );
  if (
    !matchesSemanticExpectedType(
      semanticType,
      expectedType,
      needsPlanContext
    ) &&
    !needsArrayElementMaterialization
  ) {
    return undefined;
  }

  if (
    matchesExpectedEmissionType(storageType, expectedType, needsPlanContext) &&
    !needsArrayElementMaterialization
  ) {
    return [valueAst, needsPlanContext];
  }

  if (
    requiresValueTypeMaterialization(
      storageType,
      expectedType,
      needsPlanContext
    )
  ) {
    const materialized = materializeDirectNarrowingAst(
      valueAst,
      storageType,
      expectedType,
      needsPlanContext
    );
    if (materialized[0] !== valueAst) {
      return materialized;
    }
  }

  const numericMaterialized = tryCastConcreteNumericStorageAst(
    valueAst,
    storageType,
    expectedType,
    needsPlanContext,
    emitTypeAst
  );
  if (numericMaterialized) {
    return numericMaterialized;
  }

  const plan = tryBuildRuntimeReificationPlan(
    valueAst,
    expectedType,
    needsPlanContext,
    emitTypeAst
  );
  if (plan) {
    return [plan.value, plan.context];
  }

  if (!allowCastFallback) {
    return undefined;
  }

  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    context
  );
  if (
    valueAst.kind === "castExpression" &&
    sameTypeAstSurface(valueAst.type, expectedTypeAst)
  ) {
    return [valueAst, expectedTypeContext];
  }

  return [
    {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: stripObjectBoxForConcreteStorageMaterialization(
        valueAst,
        storageType,
        expectedType,
        expectedTypeContext
      ),
    },
    expectedTypeContext,
  ];
};
