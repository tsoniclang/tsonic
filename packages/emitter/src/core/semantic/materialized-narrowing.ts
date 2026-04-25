import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import {
  getIdentifierTypeName,
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
import { getContextualTypeVisitKey } from "./deterministic-type-keys.js";
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
import { resolveAnonymousStructuralReferenceType } from "../../expressions/structural-anonymous-targets.js";
import { canPreferAnonymousStructuralTarget } from "../../expressions/structural-type-shapes.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import { isBroadObjectSlotType } from "./js-value-types.js";

const resolveAnonymousStructuralMaterializationTarget = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  const stripped = stripNullish(type);
  if (!canPreferAnonymousStructuralTarget(stripped)) {
    return undefined;
  }

  const anonymousTarget = resolveAnonymousStructuralReferenceType(
    stripped,
    context
  );
  if (!anonymousTarget) {
    return undefined;
  }

  return (splitRuntimeNullishUnionMembers(type)?.hasRuntimeNullish ?? false)
    ? {
        kind: "unionType",
        types: [anonymousTarget, { kind: "primitiveType", name: "undefined" }],
      }
    : anonymousTarget;
};

const normalizeEmittableMaterializationType = (
  type: IrType,
  context: EmitterContext,
  seen = new Set<IrType>()
): IrType => {
  if (seen.has(type)) {
    return type;
  }

  const anonymousTarget = resolveAnonymousStructuralMaterializationTarget(
    type,
    context
  );
  if (anonymousTarget) {
    return anonymousTarget;
  }

  seen.add(type);

  switch (type.kind) {
    case "referenceType": {
      const typeArguments = type.typeArguments?.map((typeArgument) =>
        normalizeEmittableMaterializationType(typeArgument, context, seen)
      );
      const hasChanged =
        !!typeArguments &&
        typeArguments.some(
          (typeArgument, index) => typeArgument !== type.typeArguments?.[index]
        );
      return hasChanged
        ? {
            ...type,
            typeArguments,
          }
        : type;
    }
    case "arrayType": {
      const elementType = normalizeEmittableMaterializationType(
        type.elementType,
        context,
        seen
      );
      const tuplePrefixElementTypes = type.tuplePrefixElementTypes?.map(
        (tuplePrefixElementType) =>
          normalizeEmittableMaterializationType(
            tuplePrefixElementType,
            context,
            seen
          )
      );
      const tupleRestElementType = type.tupleRestElementType
        ? normalizeEmittableMaterializationType(
            type.tupleRestElementType,
            context,
            seen
          )
        : undefined;
      const hasChanged =
        elementType !== type.elementType ||
        (!!tuplePrefixElementTypes &&
          tuplePrefixElementTypes.some(
            (tuplePrefixElementType, index) =>
              tuplePrefixElementType !== type.tuplePrefixElementTypes?.[index]
          )) ||
        tupleRestElementType !== type.tupleRestElementType;
      return hasChanged
        ? {
            ...type,
            elementType,
            ...(tuplePrefixElementTypes ? { tuplePrefixElementTypes } : {}),
            ...(tupleRestElementType ? { tupleRestElementType } : {}),
          }
        : type;
    }
    case "tupleType": {
      const elementTypes = type.elementTypes.map((elementType) =>
        normalizeEmittableMaterializationType(elementType, context, seen)
      );
      return elementTypes.some(
        (elementType, index) => elementType !== type.elementTypes[index]
      )
        ? { ...type, elementTypes }
        : type;
    }
    case "unionType":
    case "intersectionType": {
      const types = type.types.map((memberType) =>
        normalizeEmittableMaterializationType(memberType, context, seen)
      );
      return types.some((memberType, index) => memberType !== type.types[index])
        ? { ...type, types }
        : type;
    }
    default:
      return type;
  }
};

const resolveEmittableMaterializationType = (
  type: IrType,
  context: EmitterContext
): IrType =>
  normalizeEmittableMaterializationType(
    resolveRuntimeMaterializationTargetType(type, context),
    context
  );

const resolveMaterializationBroadnessType = (
  type: IrType,
  context: EmitterContext
): IrType =>
  resolveTypeAlias(
    stripNullish(resolveEmittableMaterializationType(type, context)),
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
): IrType => {
  const emittableNarrowedType =
    resolveAnonymousStructuralMaterializationTarget(narrowedType, context) ??
    narrowedType;

  return isUnemittableStructuralReferenceTarget(
    emittableNarrowedType,
    context
  ) &&
    sourceAlreadyExposesStructuralTarget(
      sourceType,
      emittableNarrowedType,
      context
    )
    ? sourceType
    : emittableNarrowedType;
};

const isExactExpressionToType = (
  ast: CSharpExpressionAst,
  typeAst: CSharpTypeAst
): boolean => {
  const isRuntimeUnionMemberProjectionAst = (
    candidate: CSharpExpressionAst
  ): boolean => {
    let current = candidate;
    while (
      current.kind === "parenthesizedExpression" ||
      current.kind === "castExpression"
    ) {
      current = current.expression;
    }

    return (
      current.kind === "invocationExpression" &&
      current.arguments.length === 0 &&
      current.expression.kind === "memberAccessExpression" &&
      /^As[1-9][0-9]*$/.test(current.expression.memberName)
    );
  };

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
    case "invocationExpression":
      return isRuntimeUnionMemberProjectionAst(ast);
    default:
      return isRuntimeUnionMemberProjectionAst(ast);
  }
};

const isAlreadyMaterializedNullableValueRead = (
  ast: CSharpExpressionAst
): boolean =>
  (ast.kind === "memberAccessExpression" ||
    ast.kind === "conditionalMemberAccessExpression") &&
  ast.memberName === "Value";

const isObjectTypeAst = (typeAst: CSharpTypeAst): boolean => {
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

const stripObjectBoxForConcreteMaterializationAst = (
  ast: CSharpExpressionAst,
  targetType: IrType
): CSharpExpressionAst => {
  const shouldStripObjectBox =
    ast.kind === "castExpression" &&
    isObjectTypeAst(ast.type) &&
    isDefinitelyValueType(targetType);
  return shouldStripObjectBox ? ast.expression : ast;
};

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
  const pairKey = `${getContextualTypeVisitKey(
    comparableSourceType,
    context
  )}=>${getContextualTypeVisitKey(comparableTargetType, context)}`;
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
  const materializationSourceType = resolveEmittableMaterializationType(
    comparableSourceType,
    context
  );
  const materializationNarrowedType = resolveEmittableMaterializationType(
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
  const sourceIsBroadObjectSlot =
    isBroadObjectSlotType(comparableSourceType, context) ||
    isBroadObjectSlotType(resolvedSource, context);
  const targetIsBroadObjectSlot =
    isBroadObjectSlotType(comparableEmissionTargetType, context) ||
    isBroadObjectSlotType(resolvedTarget, context);
  const isBroadTarget =
    resolvedTarget.kind === "unknownType" ||
    resolvedTarget.kind === "anyType" ||
    resolvedTarget.kind === "objectType" ||
    (resolvedTarget.kind === "referenceType" &&
      resolvedTarget.name === "object") ||
    targetIsBroadObjectSlot;
  if (isBroadTarget) {
    return [sourceAst, context];
  }
  const shouldReifyBroadSourceToRuntimeUnion =
    (resolvedSource.kind === "unknownType" ||
      resolvedSource.kind === "anyType" ||
      resolvedSource.kind === "objectType" ||
      (resolvedSource.kind === "referenceType" &&
        resolvedSource.name === "object") ||
      sourceIsBroadObjectSlot) &&
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
      resolvedSource.name === "object") ||
    sourceIsBroadObjectSlot;
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
            expression: stripObjectBoxForConcreteMaterializationAst(
              sourceAst,
              resolvedTarget
            ),
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
      areIrTypesEquivalent(
        resolveTypeAlias(stripNullish(baseMember), context),
        resolvedTarget,
        context
      )
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
      expression: stripObjectBoxForConcreteMaterializationAst(
        sourceAst,
        resolvedTarget
      ),
    },
    nextContext,
  ];
};
