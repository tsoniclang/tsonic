import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import {
  booleanLiteral,
  identifierExpression,
  nullLiteral,
} from "../format/backend-ast/builders.js";
import {
  sameTypeAstSurface,
  stableConcreteTypeKeyFromAst,
  stripNullableTypeAst,
} from "../format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import {
  buildRuntimeUnionFrame,
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  emitRuntimeCarrierTypeAst,
  findRuntimeUnionMemberIndex,
  findRuntimeUnionMemberIndices,
} from "./runtime-unions.js";
import {
  buildRuntimeUnionFactoryCallAst,
  buildInvalidRuntimeUnionMaterializationExpression,
  buildRuntimeUnionMatchAst,
  tryBuildRuntimeUnionProjectionToLayoutAst,
} from "./runtime-union-projection.js";
import {
  resolveDirectRuntimeCarrierType,
  resolveDirectValueSurfaceType,
} from "./direct-value-surfaces.js";
import {
  getArrayLikeElementType,
  resolveTypeAlias,
  stripNullish,
} from "./type-resolution.js";
import { isBroadObjectSlotType } from "./broad-object-types.js";
import {
  boxValueAst,
  buildArrayShapeCondition,
  buildInvalidReificationExpression,
  getRuntimeUnionCastMemberTypeAsts,
  isRuntimeUnionTypeAst,
  maybeCastMaterializedValueAst,
  tryResolveRuntimeUnionCastSourceIndices,
} from "./runtime-reification-helpers.js";
import {
  getRuntimeUnionAliasReferenceKey,
  runtimeUnionAliasReferencesMatch,
} from "./runtime-union-alias-identity.js";
import { resolveRuntimeMaterializationTargetType } from "./runtime-materialization-targets.js";

export type EmitTypeAstFn = (
  type: IrType,
  context: EmitterContext
) => [CSharpTypeAst, EmitterContext];

export type RuntimeReificationPlan = {
  readonly condition: CSharpExpressionAst;
  readonly value: CSharpExpressionAst;
  readonly context: EmitterContext;
};

export type RuntimeMaterializationSourceFrame = {
  readonly members: readonly IrType[];
  readonly candidateMemberNs?: readonly number[];
  readonly runtimeUnionArity?: number;
};

const stripRuntimeCarrierFamilyForSubset = (type: IrType): IrType => {
  if (type.kind !== "unionType") {
    return type;
  }

  const stripped = {
    kind: "unionType",
    types: type.types.map(stripRuntimeCarrierFamilyForSubset),
  } as const satisfies Extract<IrType, { kind: "unionType" }>;

  return type.runtimeUnionLayout === "carrierSlotOrder"
    ? { ...stripped, runtimeUnionLayout: "carrierSlotOrder" }
    : stripped;
};

const isBroadObjectRuntimeMemberType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context, {
    preserveObjectTypeAliases: true,
  });
  return (
    (resolved.kind === "referenceType" && resolved.name === "object") ||
    isBroadObjectSlotType(resolved, context)
  );
};

const tryBuildBroadObjectCatchAllReificationPlan = (
  valueAst: CSharpExpressionAst,
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): RuntimeReificationPlan | undefined => {
  if (!isBroadObjectRuntimeMemberType(expectedType, context)) {
    return undefined;
  }

  const [expectedTypeAst, nextContext] = emitTypeAst(expectedType, context);
  return {
    condition: booleanLiteral(true),
    value: {
      kind: "castExpression",
      type: stripNullableTypeAst(expectedTypeAst),
      expression: valueAst,
    },
    context: nextContext,
  };
};

const tryBuildArrayElementMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const sourceElementType = getArrayLikeElementType(sourceType, context);
  const targetElementType = getArrayLikeElementType(expectedType, context);
  if (!sourceElementType || !targetElementType) {
    return undefined;
  }

  const [sourceElementTypeAst, sourceTypeContext] = emitTypeAst(
    sourceElementType,
    context
  );
  const [targetElementTypeAst, targetTypeContext] = emitTypeAst(
    targetElementType,
    sourceTypeContext
  );
  if (sameTypeAstSurface(sourceElementTypeAst, targetElementTypeAst)) {
    return undefined;
  }

  if (isBroadObjectSlotType(targetElementType, targetTypeContext)) {
    const itemName = "__tsonic_array_item";
    const itemExpr = identifierExpression(itemName);
    const materializedElement = tryBuildRuntimeMaterializationAst(
      itemExpr,
      sourceElementType,
      targetElementType,
      targetTypeContext,
      emitTypeAst
    );
    const materializedElementContext =
      materializedElement?.[1] ?? targetTypeContext;
    const selectAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: identifierExpression("global::System.Linq.Enumerable.Select"),
      typeArguments: [sourceElementTypeAst, targetElementTypeAst],
      arguments: [
        valueAst,
        {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: itemName }],
          body:
            materializedElement?.[0] ??
            maybeCastMaterializedValueAst(
              itemExpr,
              sourceElementTypeAst,
              targetElementTypeAst
            ),
        },
      ],
    };
    const toArrayAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: identifierExpression(
        "global::System.Linq.Enumerable.ToArray"
      ),
      typeArguments: [targetElementTypeAst],
      arguments: [selectAst],
    };
    const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
      expectedType,
      materializedElementContext
    );

    return [
      {
        kind: "castExpression",
        type: expectedTypeAst,
        expression: toArrayAst,
      },
      expectedTypeContext,
    ];
  }

  const [sourceElementLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    sourceElementType,
    targetTypeContext,
    emitTypeAst
  );
  const [targetElementLayout, targetLayoutContext] = buildRuntimeUnionLayout(
    targetElementType,
    sourceLayoutContext,
    emitTypeAst
  );

  if (!sourceElementLayout && targetElementLayout) {
    const targetMemberIndex = findRuntimeUnionMemberIndex(
      targetElementLayout.members,
      sourceElementType,
      targetLayoutContext
    );
    if (targetMemberIndex !== undefined) {
      const itemName = "__tsonic_array_item";
      const itemExpr = identifierExpression(itemName);
      const selectAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: identifierExpression(
          "global::System.Linq.Enumerable.Select"
        ),
        typeArguments: [sourceElementTypeAst, targetElementTypeAst],
        arguments: [
          valueAst,
          {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [{ name: itemName }],
            body: buildRuntimeUnionFactoryCallAst(
              buildRuntimeUnionTypeAst(targetElementLayout),
              targetMemberIndex + 1,
              itemExpr
            ),
          },
        ],
      };
      const toArrayAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: identifierExpression(
          "global::System.Linq.Enumerable.ToArray"
        ),
        typeArguments: [targetElementTypeAst],
        arguments: [selectAst],
      };
      const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
        expectedType,
        targetLayoutContext
      );

      return [
        {
          kind: "castExpression",
          type: expectedTypeAst,
          expression: toArrayAst,
        },
        expectedTypeContext,
      ];
    }
  }

  if (!sourceElementLayout) {
    return undefined;
  }

  const itemName = "__tsonic_array_item";
  const itemExpr = identifierExpression(itemName);
  const materializedElement = tryBuildRuntimeMaterializationAst(
    itemExpr,
    sourceElementType,
    targetElementType,
    targetTypeContext,
    emitTypeAst
  );
  if (!materializedElement) {
    return undefined;
  }

  const selectAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: identifierExpression("global::System.Linq.Enumerable.Select"),
    typeArguments: [sourceElementTypeAst, targetElementTypeAst],
    arguments: [
      valueAst,
      {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: itemName }],
        body: materializedElement[0],
      },
    ],
  };
  const toArrayAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: identifierExpression("global::System.Linq.Enumerable.ToArray"),
    typeArguments: [targetElementTypeAst],
    arguments: [selectAst],
  };
  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    materializedElement[1]
  );

  return [
    {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: toArrayAst,
    },
    expectedTypeContext,
  ];
};

const canMaterializeArrayToBroadObjectArray = (
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext
): boolean => {
  const sourceElementType = getArrayLikeElementType(sourceType, context);
  const targetElementType = getArrayLikeElementType(targetType, context);
  return (
    !!sourceElementType &&
    !!targetElementType &&
    isBroadObjectSlotType(targetElementType, context)
  );
};

const tryBuildScalarToRuntimeUnionMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  targetLayout: NonNullable<ReturnType<typeof buildRuntimeUnionLayout>[0]>,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const matchingMemberIndices = findRuntimeUnionMemberIndices(
    targetLayout.members,
    sourceType,
    context
  );
  if (matchingMemberIndices.length !== 1) {
    return undefined;
  }

  const memberIndex = matchingMemberIndices[0];
  if (memberIndex === undefined) {
    return undefined;
  }

  const targetMemberTypeAst = targetLayout.memberTypeAsts[memberIndex];
  if (!targetMemberTypeAst) {
    return undefined;
  }

  const [sourceTypeAst, sourceTypeContext] = emitTypeAst(sourceType, context);
  return [
    buildRuntimeUnionFactoryCallAst(
      buildRuntimeUnionTypeAst(targetLayout),
      memberIndex + 1,
      maybeCastMaterializedValueAst(
        valueAst,
        sourceTypeAst,
        targetMemberTypeAst
      )
    ),
    sourceTypeContext,
  ];
};

export const tryBuildRuntimeMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  selectedSourceMemberNs?: ReadonlySet<number>,
  sourceFrame?: RuntimeMaterializationSourceFrame
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const materializationTargetType =
    selectedSourceMemberNs && selectedSourceMemberNs.size > 0
      ? stripRuntimeCarrierFamilyForSubset(targetType)
      : targetType;

  if (
    !selectedSourceMemberNs &&
    runtimeUnionAliasReferencesMatch(
      sourceType,
      materializationTargetType,
      context
    )
  ) {
    return [valueAst, context];
  }

  const effectiveSourceFrame =
    sourceFrame ??
    (() => {
      const [sourceLayout] = buildRuntimeUnionLayout(
        sourceType,
        context,
        emitTypeAst
      );
      if (!sourceLayout) {
        return undefined;
      }
      const restrictedIndices = tryResolveRuntimeUnionCastSourceIndices(
        valueAst,
        sourceLayout.memberTypeAsts
      );
      if (!restrictedIndices) {
        return undefined;
      }
      return {
        members: restrictedIndices.flatMap((index) => {
          const member = sourceLayout.members[index];
          return member ? [member] : [];
        }),
        candidateMemberNs: restrictedIndices.map((index) => index + 1),
        runtimeUnionArity: sourceLayout.runtimeUnionArity,
      };
    })();
  const [sourceLayout, sourceLayoutContext] = (() => {
    if (!effectiveSourceFrame) {
      return buildRuntimeUnionLayout(sourceType, context, emitTypeAst);
    }

    const members = effectiveSourceFrame.members;
    if (members.length < 2) {
      return [undefined, context] as const;
    }

    let currentContext = context;
    const memberTypeAsts: CSharpTypeAst[] = [];
    for (const member of members) {
      const [typeAst, nextContext] = emitTypeAst(member, currentContext);
      memberTypeAsts.push(typeAst);
      currentContext = nextContext;
    }

    const [fullSourceLayout] = buildRuntimeUnionLayout(
      resolveDirectRuntimeCarrierType(valueAst, currentContext) ?? sourceType,
      currentContext,
      emitTypeAst
    );
    const candidateArity =
      effectiveSourceFrame.candidateMemberNs &&
      effectiveSourceFrame.candidateMemberNs.length > 0
        ? Math.max(...effectiveSourceFrame.candidateMemberNs)
        : members.length;
    const runtimeUnionArity = Math.max(
      effectiveSourceFrame.runtimeUnionArity ?? 0,
      fullSourceLayout?.runtimeUnionArity ?? 0,
      candidateArity,
      members.length
    );

    return [
      {
        members,
        memberTypeAsts,
        carrierTypeArgumentAsts: memberTypeAsts,
        runtimeUnionArity,
      },
      currentContext,
    ] as const;
  })();

  const [targetLayout, targetLayoutContext] = buildRuntimeUnionLayout(
    materializationTargetType,
    sourceLayoutContext,
    emitTypeAst
  );
  const scalarSourceFrameType =
    effectiveSourceFrame?.members.length === 1
      ? effectiveSourceFrame.members[0]
      : undefined;
  const scalarSourceType = scalarSourceFrameType ?? sourceType;

  if (targetLayout) {
    const directRuntimeCarrierType =
      resolveDirectRuntimeCarrierType(valueAst, targetLayoutContext) ??
      resolveDirectValueSurfaceType(valueAst, targetLayoutContext);
    if (
      directRuntimeCarrierType &&
      runtimeUnionAliasReferencesMatch(
        directRuntimeCarrierType,
        materializationTargetType,
        targetLayoutContext
      )
    ) {
      return [valueAst, targetLayoutContext];
    }

    const sourceAliasMemberIndices = targetLayout.members.flatMap(
      (member, index) =>
        member &&
        runtimeUnionAliasReferencesMatch(
          member,
          scalarSourceType,
          targetLayoutContext
        )
          ? [index]
          : []
    );
    if (sourceAliasMemberIndices.length === 1) {
      const [sourceAliasMemberIndex] = sourceAliasMemberIndices;
      if (sourceAliasMemberIndex !== undefined) {
        return [
          buildRuntimeUnionFactoryCallAst(
            buildRuntimeUnionTypeAst(targetLayout),
            sourceAliasMemberIndex + 1,
            valueAst
          ),
          targetLayoutContext,
        ];
      }
    }
  }

  if (!sourceLayout) {
    return targetLayout
      ? tryBuildScalarToRuntimeUnionMaterializationAst(
          valueAst,
          scalarSourceType,
          targetLayout,
          targetLayoutContext,
          emitTypeAst
        )
      : undefined;
  }

  if (targetLayout) {
    if (
      getRuntimeUnionAliasReferenceKey(
        materializationTargetType,
        targetLayoutContext
      )
    ) {
      const targetUnionTypeAst = buildRuntimeUnionTypeAst(targetLayout);
      const lambdaArgs: CSharpExpressionAst[] = [];
      let sawReachableMatch = false;
      let currentContext = targetLayoutContext;
      const sourceMemberIndexBySlot = new Map<number, number>();
      for (let index = 0; index < sourceLayout.members.length; index += 1) {
        sourceMemberIndexBySlot.set(
          effectiveSourceFrame?.candidateMemberNs?.[index] ?? index + 1,
          index
        );
      }

      for (
        let slotIndex = 0;
        slotIndex < sourceLayout.runtimeUnionArity;
        slotIndex += 1
      ) {
        const sourceMemberN = slotIndex + 1;
        const index = sourceMemberIndexBySlot.get(sourceMemberN);
        const actualMember =
          index !== undefined ? sourceLayout.members[index] : undefined;
        const actualMemberTypeAst =
          index !== undefined ? sourceLayout.memberTypeAsts[index] : undefined;

        const parameterName = `__tsonic_union_member_${sourceMemberN}`;
        const parameterExpr: CSharpExpressionAst = {
          kind: "identifierExpression",
          identifier: parameterName,
        };

        let body: CSharpExpressionAst;
        if (!actualMember || !actualMemberTypeAst) {
          body = buildInvalidRuntimeUnionMaterializationExpression(
            { kind: "unknownType" },
            materializationTargetType
          );
        } else if (
          selectedSourceMemberNs &&
          !selectedSourceMemberNs.has(sourceMemberN)
        ) {
          body = buildInvalidRuntimeUnionMaterializationExpression(
            actualMember,
            materializationTargetType
          );
        } else if (
          runtimeUnionAliasReferencesMatch(
            actualMember,
            materializationTargetType,
            currentContext
          )
        ) {
          body = parameterExpr;
          sawReachableMatch = true;
        } else {
          const targetMemberIndex = findRuntimeUnionMemberIndex(
            targetLayout.members,
            actualMember,
            currentContext
          );
          const targetMember =
            targetMemberIndex !== undefined
              ? targetLayout.members[targetMemberIndex]
              : undefined;
          const targetMemberTypeAst =
            targetMemberIndex !== undefined
              ? targetLayout.memberTypeAsts[targetMemberIndex]
              : undefined;
          if (
            targetMemberIndex === undefined ||
            !targetMember ||
            !targetMemberTypeAst
          ) {
            body = buildInvalidRuntimeUnionMaterializationExpression(
              actualMember,
              materializationTargetType
            );
          } else {
            const nestedMaterialization = tryBuildRuntimeMaterializationAst(
              parameterExpr,
              actualMember,
              targetMember,
              currentContext,
              emitTypeAst
            );
            body = buildRuntimeUnionFactoryCallAst(
              targetUnionTypeAst,
              targetMemberIndex + 1,
              nestedMaterialization?.[0] ??
                maybeCastMaterializedValueAst(
                  parameterExpr,
                  actualMemberTypeAst,
                  targetMemberTypeAst
                )
            );
            currentContext = nestedMaterialization?.[1] ?? currentContext;
            sawReachableMatch = true;
          }
        }

        lambdaArgs.push({
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: parameterName }],
          body,
        });
      }

      return sawReachableMatch
        ? [
            buildRuntimeUnionMatchAst(valueAst, lambdaArgs, [
              targetUnionTypeAst,
            ]),
            currentContext,
          ]
        : undefined;
    }

    return tryBuildRuntimeUnionProjectionToLayoutAst({
      valueAst,
      sourceLayout,
      targetLayout,
      context: targetLayoutContext,
      candidateMemberNs: effectiveSourceFrame?.candidateMemberNs,
      selectedSourceMemberNs,
      buildMappedMemberValue: ({
        actualMember,
        actualMemberTypeAst,
        parameterExpr,
        targetMember,
        targetMemberTypeAst,
        context: nextContext,
      }) => {
        const nestedMaterialization = tryBuildRuntimeMaterializationAst(
          parameterExpr,
          actualMember,
          targetMember,
          nextContext,
          emitTypeAst
        );
        return [
          nestedMaterialization?.[0] ??
            maybeCastMaterializedValueAst(
              parameterExpr,
              actualMemberTypeAst,
              targetMemberTypeAst
            ),
          nestedMaterialization?.[1] ?? nextContext,
        ];
      },
      buildExcludedMemberBody: ({ actualMember }) =>
        buildInvalidRuntimeUnionMaterializationExpression(
          actualMember,
          materializationTargetType
        ),
      buildUnmappedMemberBody: ({
        actualMember,
        parameterExpr,
        context: nextContext,
      }) =>
        tryBuildRuntimeMaterializationAst(
          parameterExpr,
          actualMember,
          materializationTargetType,
          nextContext,
          emitTypeAst
        ) ??
        buildInvalidRuntimeUnionMaterializationExpression(
          actualMember,
          materializationTargetType
        ),
    });
  }

  const [targetTypeAst, nextContext] = emitTypeAst(
    materializationTargetType,
    targetLayoutContext
  );
  const directRuntimeCarrierType = resolveDirectRuntimeCarrierType(
    valueAst,
    targetLayoutContext
  );
  if (directRuntimeCarrierType) {
    const [directCarrierTypeAst, directCarrierContext] = emitTypeAst(
      directRuntimeCarrierType,
      nextContext
    );
    if (sameTypeAstSurface(directCarrierTypeAst, targetTypeAst)) {
      return [valueAst, directCarrierContext];
    }
  }
  const directValueSurfaceType = resolveDirectValueSurfaceType(
    valueAst,
    targetLayoutContext
  );
  if (directValueSurfaceType) {
    const [directTypeAst, directTypeContext] = emitTypeAst(
      directValueSurfaceType,
      nextContext
    );
    if (sameTypeAstSurface(directTypeAst, targetTypeAst)) {
      return [valueAst, directTypeContext];
    }
  }
  const concreteTargetTypeAst = stripNullableTypeAst(targetTypeAst);
  const concreteTargetTypeKey = stableConcreteTypeKeyFromAst(
    concreteTargetTypeAst
  );
  const isBroadObjectTarget = isBroadObjectSlotType(
    materializationTargetType,
    nextContext
  );
  const sourceSurfaceMemberTypeAsts =
    getRuntimeUnionCastMemberTypeAsts(valueAst);
  const matchingSourceIndices = sourceLayout.members.flatMap((member, index) =>
    member &&
    (!selectedSourceMemberNs ||
      selectedSourceMemberNs.has(
        effectiveSourceFrame?.candidateMemberNs?.[index] ?? index + 1
      )) &&
    (isBroadObjectTarget ||
      canMaterializeArrayToBroadObjectArray(
        member,
        materializationTargetType,
        nextContext
      ) ||
      (() => {
        const sourceMemberTypeAst =
          sourceSurfaceMemberTypeAsts?.[index] ??
          sourceLayout.memberTypeAsts[index];
        if (!sourceMemberTypeAst) {
          return false;
        }
        return (
          stableConcreteTypeKeyFromAst(sourceMemberTypeAst) ===
          concreteTargetTypeKey
        );
      })() ||
      findRuntimeUnionMemberIndex(
        [member],
        materializationTargetType,
        nextContext
      ) === 0)
      ? [index]
      : []
  );

  if (matchingSourceIndices.length === 0) {
    return undefined;
  }

  const lambdaArgs: CSharpExpressionAst[] = [];
  let matchContext = nextContext;
  const sourceMemberIndexBySlot = new Map<number, number>();
  for (let index = 0; index < sourceLayout.members.length; index += 1) {
    sourceMemberIndexBySlot.set(
      effectiveSourceFrame?.candidateMemberNs?.[index] ?? index + 1,
      index
    );
  }

  for (
    let slotIndex = 0;
    slotIndex < sourceLayout.runtimeUnionArity;
    slotIndex += 1
  ) {
    const sourceMemberN = slotIndex + 1;
    const index = sourceMemberIndexBySlot.get(sourceMemberN);
    const actualMember =
      index !== undefined ? sourceLayout.members[index] : undefined;

    const parameterName = `__tsonic_union_member_${sourceMemberN}`;
    const parameterExpr: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: parameterName,
    };

    if (!actualMember || index === undefined) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeUnionMaterializationExpression(
          { kind: "unknownType" },
          materializationTargetType
        ),
      });
      continue;
    }

    if (selectedSourceMemberNs && !selectedSourceMemberNs.has(sourceMemberN)) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeUnionMaterializationExpression(
          actualMember,
          materializationTargetType
        ),
      });
      continue;
    }

    if (!matchingSourceIndices.includes(index)) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeUnionMaterializationExpression(
          actualMember,
          materializationTargetType
        ),
      });
      continue;
    }

    const arrayElementMaterialization = tryBuildArrayElementMaterializationAst(
      parameterExpr,
      actualMember,
      materializationTargetType,
      matchContext,
      emitTypeAst
    );
    if (arrayElementMaterialization) {
      matchContext = arrayElementMaterialization[1];
    }

    lambdaArgs.push({
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [{ name: parameterName }],
      body:
        arrayElementMaterialization?.[0] ??
        maybeCastMaterializedValueAst(
          parameterExpr,
          sourceSurfaceMemberTypeAsts?.[index] ??
            sourceLayout.memberTypeAsts[index],
          concreteTargetTypeAst
        ),
    });
  }

  return [
    buildRuntimeUnionMatchAst(valueAst, lambdaArgs, [concreteTargetTypeAst]),
    matchContext,
  ];
};

export const tryBuildRuntimeReificationPlan = (
  valueAst: CSharpExpressionAst,
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): RuntimeReificationPlan | undefined => {
  const materializationExpectedType = resolveRuntimeMaterializationTargetType(
    expectedType,
    context
  );
  const resolvedExpected = resolveTypeAlias(
    stripNullish(materializationExpectedType),
    context,
    { preserveObjectTypeAliases: true }
  );
  const directRuntimeCarrierType = resolveDirectRuntimeCarrierType(
    valueAst,
    context
  );
  const directValueSurfaceType = resolveDirectValueSurfaceType(
    valueAst,
    context
  );

  if (
    resolvedExpected.kind === "unknownType" ||
    resolvedExpected.kind === "anyType" ||
    resolvedExpected.kind === "neverType" ||
    resolvedExpected.kind === "voidType" ||
    resolvedExpected.kind === "objectType" ||
    (resolvedExpected.kind === "referenceType" &&
      resolvedExpected.name === "object")
  ) {
    return undefined;
  }

  if (
    resolvedExpected.kind === "primitiveType" &&
    (resolvedExpected.name === "null" || resolvedExpected.name === "undefined")
  ) {
    const boxedValue = boxValueAst(valueAst);
    return {
      condition: {
        kind: "binaryExpression",
        operatorToken: "==",
        left: boxedValue,
        right: nullLiteral(),
      },
      value: { kind: "defaultExpression" },
      context,
    };
  }

  if (resolvedExpected.kind === "unionType") {
    if (directRuntimeCarrierType) {
      const materialized = tryBuildRuntimeMaterializationAst(
        valueAst,
        directRuntimeCarrierType,
        materializationExpectedType,
        context,
        emitTypeAst
      );
      if (materialized) {
        const [unionTypeAst, materializedContext] = emitTypeAst(
          materializationExpectedType,
          materialized[1]
        );
        return {
          condition: {
            kind: "isExpression",
            expression: boxValueAst(valueAst),
            pattern: {
              kind: "typePattern",
              type: stripNullableTypeAst(unionTypeAst),
            },
          },
          value: materialized[0],
          context: materializedContext,
        };
      }
    }
    if (directValueSurfaceType) {
      const materialized = tryBuildRuntimeMaterializationAst(
        valueAst,
        directValueSurfaceType,
        materializationExpectedType,
        context,
        emitTypeAst
      );
      if (materialized) {
        const [unionTypeAst, materializedContext] = emitTypeAst(
          materializationExpectedType,
          materialized[1]
        );
        return {
          condition: {
            kind: "isExpression",
            expression: boxValueAst(valueAst),
            pattern: {
              kind: "typePattern",
              type: stripNullableTypeAst(unionTypeAst),
            },
          },
          value: materialized[0],
          context: materializedContext,
        };
      }
    }

    const [unionTypeAst, runtimeLayout, unionTypeContext] =
      emitRuntimeCarrierTypeAst(expectedType, context, emitTypeAst);
    const concreteUnionTypeAst = stripNullableTypeAst(unionTypeAst);
    if (!runtimeLayout || !isRuntimeUnionTypeAst(concreteUnionTypeAst)) {
      return undefined;
    }

    const runtimeFrame = buildRuntimeUnionFrame(expectedType, unionTypeContext);
    const members = runtimeFrame?.members ?? runtimeLayout.members;

    const canDirectlyCarryExpectedUnion = (() => {
      const directCarryType =
        directRuntimeCarrierType ?? directValueSurfaceType;
      if (!directCarryType) {
        return true;
      }

      if (
        directCarryType.kind === "anyType" ||
        directCarryType.kind === "unknownType" ||
        isBroadObjectSlotType(directCarryType, unionTypeContext) ||
        runtimeUnionAliasReferencesMatch(
          directCarryType,
          expectedType,
          unionTypeContext
        )
      ) {
        return true;
      }

      const [directTypeAst] = emitTypeAst(directCarryType, unionTypeContext);
      return sameTypeAstSurface(
        stripNullableTypeAst(directTypeAst),
        concreteUnionTypeAst
      );
    })();

    const cases: RuntimeReificationPlan[] = canDirectlyCarryExpectedUnion
      ? [
          {
            condition: {
              kind: "isExpression",
              expression: valueAst,
              pattern: {
                kind: "typePattern",
                type: concreteUnionTypeAst,
              },
            },
            value: {
              kind: "castExpression",
              type: concreteUnionTypeAst,
              expression: valueAst,
            },
            context: unionTypeContext,
          },
        ]
      : [];

    let currentContext = unionTypeContext;
    let catchAllCase: RuntimeReificationPlan | undefined;
    for (let index = 0; index < members.length; index += 1) {
      const member = members[index];
      if (!member) continue;
      const objectCatchAllPlan = tryBuildBroadObjectCatchAllReificationPlan(
        valueAst,
        member,
        currentContext,
        emitTypeAst
      );
      const memberPlan =
        objectCatchAllPlan ??
        tryBuildRuntimeReificationPlan(
          valueAst,
          member,
          currentContext,
          emitTypeAst
        );
      if (!memberPlan) continue;
      currentContext = memberPlan.context;
      const casePlan = {
        condition: memberPlan.condition,
        value: buildRuntimeUnionFactoryCallAst(
          concreteUnionTypeAst,
          index + 1,
          memberPlan.value
        ),
        context: currentContext,
      };
      if (objectCatchAllPlan) {
        catchAllCase = casePlan;
      } else {
        cases.push(casePlan);
      }
    }

    if (cases.length === 0 && !catchAllCase) {
      return undefined;
    }

    const firstCase = cases[0] ?? catchAllCase;
    const lastCase = catchAllCase ?? cases[cases.length - 1];
    if (!firstCase || !lastCase) {
      return undefined;
    }

    let conditionAst = catchAllCase
      ? booleanLiteral(true)
      : firstCase.condition;
    let valueExpression =
      catchAllCase?.value ??
      buildInvalidReificationExpression(
        "Unreachable runtime union reification path"
      );
    let finalContext = lastCase.context;

    if (!catchAllCase) {
      for (let index = 1; index < cases.length; index += 1) {
        const currentCase = cases[index];
        if (!currentCase) {
          continue;
        }
        conditionAst = {
          kind: "binaryExpression",
          operatorToken: "||",
          left: conditionAst,
          right: currentCase.condition,
        };
      }
    }

    for (let index = cases.length - 1; index >= 0; index -= 1) {
      const currentCase = cases[index];
      if (!currentCase) {
        continue;
      }
      valueExpression = {
        kind: "conditionalExpression",
        condition: currentCase.condition,
        whenTrue: currentCase.value,
        whenFalse: valueExpression,
      };
      finalContext = currentCase.context;
    }

    return {
      condition: conditionAst,
      value: valueExpression,
      context: finalContext,
    };
  }

  const [typeAst, typeContext] = emitTypeAst(expectedType, context);
  const concreteTypeAst = stripNullableTypeAst(typeAst);
  const boxedValue = boxValueAst(valueAst);

  if (
    resolvedExpected.kind === "arrayType" ||
    resolvedExpected.kind === "tupleType" ||
    (resolvedExpected.kind === "referenceType" &&
      (resolvedExpected.name === "Array" ||
        resolvedExpected.name === "ReadonlyArray"))
  ) {
    if (directValueSurfaceType) {
      const elementMaterialization = tryBuildArrayElementMaterializationAst(
        valueAst,
        directValueSurfaceType,
        expectedType,
        typeContext,
        emitTypeAst
      );
      if (elementMaterialization) {
        return {
          condition: buildArrayShapeCondition(valueAst),
          value: elementMaterialization[0],
          context: elementMaterialization[1],
        };
      }
    }

    return {
      condition: buildArrayShapeCondition(valueAst),
      value: {
        kind: "castExpression",
        type: concreteTypeAst,
        expression: boxedValue,
      },
      context: typeContext,
    };
  }

  return {
    condition: {
      kind: "isExpression",
      expression: boxedValue,
      pattern: {
        kind: "typePattern",
        type: concreteTypeAst,
      },
    },
    value: {
      kind: "castExpression",
      type: concreteTypeAst,
      expression: boxedValue,
    },
    context: typeContext,
  };
};
