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
import {
  tryBuildRuntimeMaterializationAst,
  tryBuildRuntimeReificationPlan,
} from "./runtime-reification.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
} from "./runtime-unions.js";
import { buildRuntimeUnionFactoryCallAst } from "./runtime-union-projection.js";
import { runtimeUnionAliasReferencesMatch } from "./runtime-union-alias-identity.js";
import {
  isDefinitelyValueType,
  resolveLocalTypeInfo,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "./type-resolution.js";
import { willCarryAsRuntimeUnion } from "./union-semantics.js";
import { resolveRuntimeMaterializationTargetType } from "./runtime-materialization-targets.js";
import { resolveTypeMemberKind } from "./member-surfaces.js";

const resolveMaterializationBroadnessType = (
  type: IrType,
  context: EmitterContext
): IrType =>
  resolveTypeAlias(
    stripNullish(resolveRuntimeMaterializationTargetType(type, context)),
    context,
    { preserveObjectTypeAliases: true }
  );

const isUnemittableStructuralReferenceTarget = (
  type: IrType,
  context: EmitterContext
): type is Extract<IrType, { kind: "referenceType" }> => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "referenceType") {
    return false;
  }

  if (!resolved.structuralMembers || resolved.structuralMembers.length === 0) {
    return false;
  }

  if (resolved.resolvedClrType || resolved.typeId) {
    return false;
  }

  return !resolveLocalTypeInfo(resolved, context);
};

const sourceAlreadyExposesStructuralTarget = (
  sourceType: IrType,
  targetType: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): boolean =>
  targetType.structuralMembers?.every(
    (member) =>
      resolveTypeMemberKind(sourceType, member.name, context) !== undefined
  ) ?? false;

const preferEmittableMaterializationTarget = (
  sourceType: IrType,
  narrowedType: IrType,
  context: EmitterContext
): IrType =>
  isUnemittableStructuralReferenceTarget(narrowedType, context) &&
  sourceAlreadyExposesStructuralTarget(sourceType, narrowedType, context)
    ? sourceType
    : narrowedType;

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

const isAlreadyMaterializedNullableValueRead = (
  ast: CSharpExpressionAst
): boolean =>
  (ast.kind === "memberAccessExpression" ||
    ast.kind === "conditionalMemberAccessExpression") &&
  ast.memberName === "Value";

const canDeterministicallyMaterializeSourceType = (
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext,
  seen = new Set<string>()
): boolean => {
  const comparableSourceType =
    unwrapParameterModifierType(sourceType) ?? sourceType;
  const comparableTargetType =
    unwrapParameterModifierType(targetType) ?? targetType;
  const pairKey = `${stableIrTypeKey(comparableSourceType)}=>${stableIrTypeKey(
    comparableTargetType
  )}`;
  if (seen.has(pairKey)) {
    return false;
  }
  seen.add(pairKey);

  if (
    runtimeUnionAliasReferencesMatch(
      comparableSourceType,
      comparableTargetType,
      context
    )
  ) {
    return true;
  }

  const resolvedSource = resolveTypeAlias(
    stripNullish(
      resolveRuntimeMaterializationTargetType(comparableSourceType, context)
    ),
    context,
    { preserveObjectTypeAliases: true }
  );
  if (
    resolvedSource.kind !== "unknownType" &&
    resolvedSource.kind !== "anyType" &&
    resolvedSource.kind !== "objectType" &&
    !(
      resolvedSource.kind === "referenceType" &&
      resolvedSource.name === "object"
    ) &&
    !willCarryAsRuntimeUnion(comparableTargetType, context) &&
    !(
      splitRuntimeNullishUnionMembers(comparableTargetType)
        ?.hasRuntimeNullish ?? false
    ) &&
    matchesExpectedEmissionType(
      comparableSourceType,
      comparableTargetType,
      context
    )
  ) {
    return true;
  }

  const [targetRuntimeLayout, targetRuntimeLayoutContext] =
    buildRuntimeUnionLayout(comparableTargetType, context, emitTypeAst);
  if (
    !targetRuntimeLayout ||
    willCarryAsRuntimeUnion(comparableSourceType, context)
  ) {
    return false;
  }

  const directlyMatchingMembers = targetRuntimeLayout.members.flatMap(
    (member, index) =>
      member &&
      matchesExpectedEmissionType(
        comparableSourceType,
        member,
        targetRuntimeLayoutContext
      )
        ? [index]
        : []
  );
  if (directlyMatchingMembers.length === 1) {
    return true;
  }

  const recursivelyMaterializableMembers = targetRuntimeLayout.members.flatMap(
    (member, index) =>
      member &&
      canDeterministicallyMaterializeSourceType(
        comparableSourceType,
        member,
        targetRuntimeLayoutContext,
        new Set(seen)
      )
        ? [index]
        : []
  );
  return recursivelyMaterializableMembers.length === 1;
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
  const comparableEmissionTargetType = preferEmittableMaterializationTarget(
    comparableSourceType,
    comparableNarrowedType,
    context
  );
  const materializationSourceType = resolveRuntimeMaterializationTargetType(
    comparableSourceType,
    context
  );
  const materializationNarrowedType = resolveRuntimeMaterializationTargetType(
    comparableEmissionTargetType,
    context
  );
  const sourceWasParameterModifierWrapped = comparableSourceType !== sourceType;

  if (
    runtimeUnionAliasReferencesMatch(
      comparableSourceType,
      comparableNarrowedType,
      context
    )
  ) {
    return [sourceAst, context];
  }
  if (
    runtimeUnionAliasReferencesMatch(
      comparableSourceType,
      comparableEmissionTargetType,
      context
    )
  ) {
    return [sourceAst, context];
  }

  const resolvedSource = resolveMaterializationBroadnessType(
    comparableSourceType,
    context
  );
  const resolvedTarget = resolveMaterializationBroadnessType(
    comparableEmissionTargetType,
    context
  );
  const isBroadTarget =
    resolvedTarget.kind === "unknownType" ||
    resolvedTarget.kind === "anyType" ||
    resolvedTarget.kind === "objectType" ||
    (resolvedTarget.kind === "referenceType" &&
      resolvedTarget.name === "object");
  if (isBroadTarget) {
    return [sourceAst, context];
  }
  const shouldReifyBroadSourceToRuntimeUnion =
    (resolvedSource.kind === "unknownType" ||
      resolvedSource.kind === "anyType" ||
      resolvedSource.kind === "objectType" ||
      (resolvedSource.kind === "referenceType" &&
        resolvedSource.name === "object")) &&
    willCarryAsRuntimeUnion(comparableEmissionTargetType, context);
  if (shouldReifyBroadSourceToRuntimeUnion) {
    const reificationPlan = tryBuildRuntimeReificationPlan(
      sourceAst,
      materializationNarrowedType,
      context,
      emitTypeAst
    );
    if (reificationPlan) {
      return [reificationPlan.value, reificationPlan.context];
    }
  }

  const isBroadSource =
    resolvedSource.kind === "unknownType" ||
    resolvedSource.kind === "anyType" ||
    resolvedSource.kind === "objectType" ||
    (resolvedSource.kind === "referenceType" &&
      resolvedSource.name === "object");
  if (isBroadSource) {
    const [targetTypeAst, nextContext] = emitTypeAst(
      materializationNarrowedType,
      context
    );
    const concreteTargetTypeAst = stripNullableTypeAst(targetTypeAst);
    return isExactExpressionToType(sourceAst, concreteTargetTypeAst)
      ? [sourceAst, nextContext]
      : [
          {
            kind: "castExpression",
            type: targetTypeAst,
            expression: sourceAst,
          },
          nextContext,
        ];
  }

  const [sourceTypeAst, sourceTypeContext] = emitTypeAst(
    materializationSourceType,
    context
  );
  const [targetTypeAst, nextContext] = emitTypeAst(
    materializationNarrowedType,
    sourceTypeContext
  );
  const concreteSourceTypeAst = stripNullableTypeAst(sourceTypeAst);
  const concreteTargetTypeAst = stripNullableTypeAst(targetTypeAst);

  if (
    !requiresValueTypeMaterialization(
      comparableSourceType,
      materializationNarrowedType,
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

  const [targetRuntimeLayout, targetRuntimeLayoutContext] =
    buildRuntimeUnionLayout(comparableEmissionTargetType, context, emitTypeAst);
  if (
    targetRuntimeLayout &&
    !willCarryAsRuntimeUnion(comparableSourceType, context)
  ) {
    const matchingTargetMemberIndices = targetRuntimeLayout.members.flatMap(
      (member, index) =>
        matchesExpectedEmissionType(
          comparableSourceType,
          member,
          targetRuntimeLayoutContext
        )
          ? [index]
          : []
    );
    if (matchingTargetMemberIndices.length === 1) {
      const [targetMemberIndex] = matchingTargetMemberIndices;
      if (targetMemberIndex !== undefined) {
        return [
          buildRuntimeUnionFactoryCallAst(
            buildRuntimeUnionTypeAst(targetRuntimeLayout),
            targetMemberIndex + 1,
            sourceAst
          ),
          targetRuntimeLayoutContext,
        ];
      }
    }

    const recursivelyMaterializedMembers = targetRuntimeLayout.members.flatMap(
      (member, index) => {
        if (
          !member ||
          !canDeterministicallyMaterializeSourceType(
            comparableSourceType,
            member,
            targetRuntimeLayoutContext
          )
        ) {
          return [];
        }

        const materialized = materializeDirectNarrowingAst(
          sourceAst,
          comparableSourceType,
          member,
          targetRuntimeLayoutContext
        );
        return materialized
          ? [
              {
                index,
                valueAst: materialized[0],
                context: materialized[1],
              },
            ]
          : [];
      }
    );
    if (recursivelyMaterializedMembers.length === 1) {
      const [materializedMember] = recursivelyMaterializedMembers;
      if (materializedMember) {
        return [
          buildRuntimeUnionFactoryCallAst(
            buildRuntimeUnionTypeAst(targetRuntimeLayout),
            materializedMember.index + 1,
            materializedMember.valueAst
          ),
          materializedMember.context,
        ];
      }
    }
  }
  const canReuseAssignableSurface =
    !sourceWasParameterModifierWrapped &&
    !isBroadSource &&
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
      if (isAlreadyMaterializedNullableValueRead(sourceAst)) {
        return [sourceAst, nextContext];
      }

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
