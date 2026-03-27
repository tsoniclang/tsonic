import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import {
  sameConcreteTypeAstSurface,
  stripNullableTypeAst,
} from "../format/backend-ast/utils.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  matchesExpectedEmissionType,
  requiresValueTypeMaterialization,
} from "./expected-type-matching.js";
import { unwrapParameterModifierType } from "./parameter-modifier-types.js";
import { tryBuildRuntimeMaterializationAst } from "./runtime-reification.js";
import {
  isDefinitelyValueType,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "./type-resolution.js";

const isExactExpressionToType = (
  ast: CSharpExpressionAst,
  typeAst: CSharpTypeAst
): boolean => {
  const concreteTarget =
    typeAst.kind === "nullableType" ? typeAst.underlyingType : typeAst;

  switch (ast.kind) {
    case "castExpression": {
      const castType =
        ast.type.kind === "nullableType" ? ast.type.underlyingType : ast.type;
      return sameConcreteTypeAstSurface(castType, concreteTarget);
    }
    case "defaultExpression":
      return (
        ast.type !== undefined &&
        sameConcreteTypeAstSurface(ast.type, concreteTarget)
      );
    case "objectCreationExpression":
      return sameConcreteTypeAstSurface(ast.type, concreteTarget);
    case "conditionalExpression":
      return (
        isExactExpressionToType(ast.whenTrue, concreteTarget) &&
        isExactExpressionToType(ast.whenFalse, concreteTarget)
      );
    default:
      return false;
  }
};

export const materializeDirectNarrowingAst = (
  sourceAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  narrowedType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (!sourceType || !narrowedType) {
    return [sourceAst, context];
  }

  const comparableSourceType =
    unwrapParameterModifierType(sourceType) ?? sourceType;
  const comparableNarrowedType =
    unwrapParameterModifierType(narrowedType) ?? narrowedType;

  const [sourceTypeAst, sourceTypeContext] = emitTypeAst(
    comparableSourceType,
    context
  );
  const [targetTypeAst, nextContext] = emitTypeAst(
    comparableNarrowedType,
    sourceTypeContext
  );
  const concreteSourceTypeAst = stripNullableTypeAst(sourceTypeAst);
  const concreteTargetTypeAst = stripNullableTypeAst(targetTypeAst);

  if (
    !requiresValueTypeMaterialization(
      comparableSourceType,
      comparableNarrowedType,
      context
    ) &&
    sameConcreteTypeAstSurface(concreteSourceTypeAst, concreteTargetTypeAst)
  ) {
    return [sourceAst, nextContext];
  }

  const runtimeMaterialized = tryBuildRuntimeMaterializationAst(
    sourceAst,
    sourceType,
    narrowedType,
    context,
    emitTypeAst
  );
  if (runtimeMaterialized) {
    return runtimeMaterialized;
  }

  const resolvedSource = resolveTypeAlias(
    stripNullish(comparableSourceType),
    context
  );
  const canReuseAssignableSurface =
    resolvedSource.kind !== "unknownType" &&
    resolvedSource.kind !== "anyType" &&
    resolvedSource.kind !== "objectType" &&
    !(
      resolvedSource.kind === "referenceType" &&
      resolvedSource.name === "object"
    ) &&
    matchesExpectedEmissionType(
      comparableSourceType,
      comparableNarrowedType,
      context
    );
  if (canReuseAssignableSurface) {
    return [sourceAst, nextContext];
  }

  if (isExactExpressionToType(sourceAst, concreteTargetTypeAst)) {
    return [sourceAst, nextContext];
  }

  const splitSource = splitRuntimeNullishUnionMembers(comparableSourceType);
  const resolvedTarget = resolveTypeAlias(
    stripNullish(comparableNarrowedType),
    context
  );
  if (
    splitSource?.hasRuntimeNullish &&
    splitSource.nonNullishMembers.length === 1 &&
    isDefinitelyValueType(resolvedTarget)
  ) {
    const [baseMember] = splitSource.nonNullishMembers;
    if (
      baseMember &&
      stableIrTypeKey(resolveTypeAlias(stripNullish(baseMember), context)) ===
        stableIrTypeKey(resolvedTarget)
    ) {
      return [
        {
          kind: "memberAccessExpression",
          expression: sourceAst,
          memberName: "Value",
        },
        nextContext,
      ];
    }
  }

  return [
    {
      kind: "castExpression",
      type: targetTypeAst,
      expression: sourceAst,
    },
    nextContext,
  ];
};
