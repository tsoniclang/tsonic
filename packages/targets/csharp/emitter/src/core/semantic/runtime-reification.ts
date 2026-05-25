import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import {
  booleanLiteral,
  identifierType,
  identifierExpression,
  nullLiteral,
  nullableType,
} from "../format/backend-ast/builders.js";
import {
  sameTypeAstSurface,
  stableConcreteTypeKeyFromAst,
  stripNullableTypeAst,
} from "../format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  emitRuntimeCarrierTypeAst,
  findRuntimeUnionMemberIndex,
  findRuntimeUnionMemberIndices,
} from "./runtime-unions.js";
import type { RuntimeUnionLayout } from "./runtime-unions.js";
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
import { semanticType } from "./type-domains.js";
import { isBroadObjectSlotType } from "./broad-object-types.js";
import {
  boxValueAst,
  buildArrayShapeCondition,
  buildInvalidReificationExpression,
  getRuntimeUnionCastMemberTypeAsts,
  maybeCastMaterializedValueAst,
  tryResolveRuntimeUnionCastSourceIndices,
} from "./runtime-reification-helpers.js";
import {
  getRuntimeUnionAliasReferenceKey,
  runtimeUnionAliasReferencesMatch,
} from "./runtime-union-alias-identity.js";
import { resolveRuntimeMaterializationTargetType } from "./runtime-materialization-targets.js";
import { matchesExpectedEmissionType } from "./expected-type-matching.js";

export type EmitTypeAstFn = (
  type: IrType,
  context: EmitterContext
) => [CSharpTypeAst, EmitterContext];

export type RuntimeReificationPlan = {
  readonly condition: CSharpExpressionAst;
  readonly value: CSharpExpressionAst;
  readonly context: EmitterContext;
};

type RecursiveRuntimeReificationHelper = {
  readonly expectedType: IrType;
  readonly name: string;
  readonly typeAst: CSharpTypeAst;
};

type RuntimeReificationOptions = {
  readonly typeAst?: CSharpTypeAst;
  readonly layout?: RuntimeUnionLayout;
  readonly layoutType?: IrType;
  readonly context?: EmitterContext;
  readonly recursiveHelper?: RecursiveRuntimeReificationHelper;
  readonly activeTypes?: ReadonlySet<IrType>;
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
  if (!isBroadObjectSlotType(expectedType, context)) {
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

const objectNullableTypeAst = (): CSharpTypeAst =>
  nullableType(identifierType("object"));

const dictionaryTypeAst = (valueTypeAst: CSharpTypeAst): CSharpTypeAst =>
  identifierType("global::System.Collections.Generic.Dictionary", [
    identifierType("string"),
    valueTypeAst,
  ]);

const runtimeReificationHelperName = (unionTypeAst: CSharpTypeAst): string => {
  const suffix = stableConcreteTypeKeyFromAst(unionTypeAst)
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-64);
  return `__tsonic_reify_${suffix || "runtime_union"}`;
};

const buildRuntimeReificationHelperCallAst = (
  helperName: string,
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: identifierExpression(helperName),
  arguments: [boxValueAst(valueAst)],
});

const typeMatchesRecursiveReificationTarget = (
  type: IrType,
  helper: RecursiveRuntimeReificationHelper | undefined,
  context: EmitterContext
): boolean => {
  if (!helper) {
    return false;
  }
  const stripped = stripNullish(type);
  const target = stripNullish(helper.expectedType);
  if (stripped === target) {
    return true;
  }
  const resolvedTarget = resolveTypeAlias(target, context, {
    preserveObjectTypeAliases: true,
  });
  const resolvedStripped = resolveTypeAlias(stripped, context, {
    preserveObjectTypeAliases: true,
  });
  if (
    stripped === resolvedTarget ||
    resolvedStripped === target ||
    resolvedStripped === resolvedTarget
  ) {
    return true;
  }
  const strippedAliasKey = getRuntimeUnionAliasReferenceKey(stripped, context);
  const targetAliasKey = getRuntimeUnionAliasReferenceKey(target, context);
  return (
    strippedAliasKey !== undefined &&
    targetAliasKey !== undefined &&
    strippedAliasKey === targetAliasKey
  );
};

const hasTopLevelRuntimeNullishMember = (type: IrType): boolean =>
  type.kind === "unionType" &&
  type.types.some(
    (member) =>
      member.kind === "voidType" ||
      (member.kind === "primitiveType" &&
        (member.name === "null" || member.name === "undefined"))
  );

const runtimeMemberCanRepresentSemanticArrayMember = (
  runtimeMember: IrType,
  semanticMember: IrType,
  context: EmitterContext
): boolean => {
  const runtimeElementType = getArrayLikeElementType(runtimeMember, context);
  const semanticElementType = getArrayLikeElementType(semanticMember, context);
  return (
    !!runtimeElementType &&
    !!semanticElementType &&
    ((runtimeElementType.kind === "referenceType" &&
      runtimeElementType.name === "object") ||
      isBroadObjectSlotType(runtimeElementType, context))
  );
};

const alignSemanticRuntimeUnionMembers = (
  runtimeMembers: readonly IrType[],
  semanticMembers: readonly IrType[],
  context: EmitterContext
): readonly IrType[] => {
  if (semanticMembers.length === 0) {
    return runtimeMembers;
  }

  const claimedSemanticIndices = new Set<number>();
  return runtimeMembers.map((runtimeMember) => {
    const candidates = semanticMembers.flatMap((semanticMember, index) => {
      if (claimedSemanticIndices.has(index)) {
        return [];
      }
      const matches =
        findRuntimeUnionMemberIndices([runtimeMember], semanticMember, context)
          .length === 1 ||
        runtimeMemberCanRepresentSemanticArrayMember(
          runtimeMember,
          semanticMember,
          context
        );
      return matches ? [{ index, semanticMember }] : [];
    });

    if (candidates.length !== 1) {
      return runtimeMember;
    }

    const candidate = candidates[0];
    if (!candidate) {
      return runtimeMember;
    }
    claimedSemanticIndices.add(candidate.index);
    return candidate.semanticMember;
  });
};

const typeContainsRecursiveReificationTarget = (
  type: IrType,
  targetType: IrType,
  context: EmitterContext,
  seenKeys: ReadonlySet<string> = new Set(),
  seenTypes: ReadonlySet<IrType> = new Set()
): boolean => {
  const stripped = stripNullish(type);
  const strippedTarget = stripNullish(targetType);
  if (stripped === strippedTarget) {
    return true;
  }
  const resolvedTarget = resolveTypeAlias(strippedTarget, context, {
    preserveObjectTypeAliases: true,
  });
  const resolvedStripped = resolveTypeAlias(stripped, context, {
    preserveObjectTypeAliases: true,
  });
  if (
    stripped === resolvedTarget ||
    resolvedStripped === strippedTarget ||
    resolvedStripped === resolvedTarget
  ) {
    return true;
  }
  if (seenTypes.has(stripped)) {
    return false;
  }
  const nextSeenTypes = new Set([...seenTypes, stripped]);

  const strippedAliasKey = getRuntimeUnionAliasReferenceKey(stripped, context);
  const targetAliasKey = getRuntimeUnionAliasReferenceKey(
    strippedTarget,
    context
  );
  if (
    strippedAliasKey !== undefined &&
    targetAliasKey !== undefined &&
    strippedAliasKey === targetAliasKey
  ) {
    return true;
  }

  if (strippedAliasKey && seenKeys.has(strippedAliasKey)) {
    return false;
  }
  const nextSeenKeys = strippedAliasKey
    ? new Set([...seenKeys, strippedAliasKey])
    : seenKeys;

  const resolved = resolveTypeAlias(stripped, context, {
    preserveObjectTypeAliases: true,
  });
  switch (resolved.kind) {
    case "arrayType":
      return typeContainsRecursiveReificationTarget(
        resolved.elementType,
        targetType,
        context,
        nextSeenKeys,
        nextSeenTypes
      );
    case "dictionaryType":
      return typeContainsRecursiveReificationTarget(
        resolved.valueType,
        targetType,
        context,
        nextSeenKeys,
        nextSeenTypes
      );
    case "tupleType":
      return resolved.elementTypes.some((elementType) =>
        typeContainsRecursiveReificationTarget(
          elementType,
          targetType,
          context,
          nextSeenKeys,
          nextSeenTypes
        )
      );
    case "unionType":
      return resolved.types.some((member) =>
        typeContainsRecursiveReificationTarget(
          member,
          targetType,
          context,
          nextSeenKeys,
          nextSeenTypes
        )
      );
    default:
      return false;
  }
};

const precomputedRuntimeLayoutAppliesTo = (
  expectedType: IrType,
  options: RuntimeReificationOptions,
  context: EmitterContext
): boolean => {
  if (!options.layout || !options.typeAst || !options.layoutType) {
    return false;
  }

  const expected = stripNullish(expectedType);
  const layoutType = stripNullish(options.layoutType);
  return (
    expected === layoutType ||
    runtimeUnionAliasReferencesMatch(expected, layoutType, context)
  );
};

const buildZeroArgLambdaInvocationAst = (
  returnType: CSharpTypeAst,
  statements: readonly CSharpStatementAst[]
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "parenthesizedExpression",
    expression: {
      kind: "castExpression",
      type: identifierType("global::System.Func", [returnType]),
      expression: {
        kind: "parenthesizedExpression",
        expression: {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [],
          body: {
            kind: "blockStatement",
            statements,
          },
        },
      },
    },
  },
  arguments: [],
});

const buildInvalidCastThrowStatement = (
  message: string
): CSharpStatementAst => ({
  kind: "throwStatement",
  expression: {
    kind: "objectCreationExpression",
    type: identifierType("global::System.InvalidCastException"),
    arguments: [
      {
        kind: "stringLiteralExpression",
        value: message,
      },
    ],
  },
});

const getStringKeyDictionaryValueType = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context, {
    preserveObjectTypeAliases: true,
  });
  if (resolved.kind !== "dictionaryType") {
    return undefined;
  }

  const keyType = resolveTypeAlias(stripNullish(resolved.keyType), context);
  return keyType.kind === "primitiveType" && keyType.name === "string"
    ? resolved.valueType
    : undefined;
};

const canMaterializeStringKeyDictionary = (
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext
): boolean =>
  getStringKeyDictionaryValueType(sourceType, context) !== undefined &&
  getStringKeyDictionaryValueType(targetType, context) !== undefined;

const withScopedSemanticType = (
  context: EmitterContext,
  name: string,
  type: IrType
): EmitterContext => ({
  ...context,
  localSemanticTypes: new Map([
    ...(context.localSemanticTypes ?? []),
    [name, semanticType(type)],
  ]),
});

const tryBuildDictionaryMemberMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  valueName?: string
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!canMaterializeStringKeyDictionary(sourceType, targetType, context)) {
    return undefined;
  }

  const resolvedTarget = resolveTypeAlias(stripNullish(targetType), context, {
    preserveObjectTypeAliases: true,
  });
  if (resolvedTarget.kind !== "dictionaryType") {
    return undefined;
  }

  const materializationContext = valueName
    ? withScopedSemanticType(context, valueName, sourceType)
    : context;
  const plan = buildRuntimeDictionaryReificationPlan(
    valueAst,
    targetType,
    resolvedTarget,
    materializationContext,
    emitTypeAst
  );
  return plan ? [plan.value, plan.context] : undefined;
};

const buildRuntimeDictionaryReificationPlan = (
  valueAst: CSharpExpressionAst,
  expectedType: IrType,
  resolvedExpected: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  options: RuntimeReificationOptions = {}
): RuntimeReificationPlan | undefined => {
  if (resolvedExpected.kind !== "dictionaryType") {
    return undefined;
  }

  const resolvedKey = resolveTypeAlias(stripNullish(resolvedExpected.keyType), context);
  if (
    resolvedKey.kind !== "primitiveType" ||
    resolvedKey.name !== "string"
  ) {
    return undefined;
  }

  const directSourceRuntimeCarrierType = resolveDirectRuntimeCarrierType(
    valueAst,
    context
  );
  if (directSourceRuntimeCarrierType) {
    const materializedSource = tryBuildRuntimeMaterializationAst(
      valueAst,
      directSourceRuntimeCarrierType,
      expectedType,
      context,
      emitTypeAst
    );
    if (materializedSource) {
      return {
        condition: booleanLiteral(true),
        value: materializedSource[0],
        context: materializedSource[1],
      };
    }
  }

  const recursiveHelper = options.recursiveHelper;
  const valueMatchesRecursiveHelperByAlias =
    !!recursiveHelper &&
    typeMatchesRecursiveReificationTarget(
      resolvedExpected.valueType,
      recursiveHelper,
      context
    );
  const [targetDictionaryAst, targetDictionaryContext] =
    recursiveHelper && valueMatchesRecursiveHelperByAlias
      ? [dictionaryTypeAst(recursiveHelper.typeAst), context]
      : emitTypeAst(expectedType, context);
  const [targetValueAst, targetValueContext] =
    recursiveHelper && valueMatchesRecursiveHelperByAlias
      ? [recursiveHelper.typeAst, targetDictionaryContext]
      : emitTypeAst(resolvedExpected.valueType, targetDictionaryContext);
  const concreteTargetDictionaryAst = stripNullableTypeAst(targetDictionaryAst);
  const sourceDictionaryAst = dictionaryTypeAst(objectNullableTypeAst());
  const directSourceDictionaryType =
    resolveDirectValueSurfaceType(valueAst, context) ??
    resolveDirectRuntimeCarrierType(valueAst, context);
  const directSourceDictionaryValueType = directSourceDictionaryType
    ? getStringKeyDictionaryValueType(directSourceDictionaryType, context)
    : undefined;
  const [directSourceDictionaryAst, directSourceDictionaryContext] =
    directSourceDictionaryValueType
      ? emitTypeAst(directSourceDictionaryType!, targetValueContext)
      : [undefined, targetValueContext];
  const concreteDirectSourceDictionaryAst =
    directSourceDictionaryAst &&
    !sameTypeAstSurface(
      stripNullableTypeAst(directSourceDictionaryAst),
      concreteTargetDictionaryAst
    ) &&
    !sameTypeAstSurface(
      stripNullableTypeAst(directSourceDictionaryAst),
      sourceDictionaryAst
    )
      ? stripNullableTypeAst(directSourceDictionaryAst)
      : undefined;
  const boxedValue = boxValueAst(valueAst);
  const valueLocal = "__tsonic_reify_value";
  const typedLocal = "__tsonic_reify_typed_dict";
  const rawLocal = "__tsonic_reify_raw_dict";
  const sourceTypedLocal = "__tsonic_reify_source_dict";
  const entryLocal = "__tsonic_reify_entry";
  const entryValueAst: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: identifierExpression(entryLocal),
    memberName: "Value",
  };
  const entryValueMatchesRecursiveHelper =
    valueMatchesRecursiveHelperByAlias ||
    (!!recursiveHelper &&
      sameTypeAstSurface(
        stripNullableTypeAst(targetValueAst),
        stripNullableTypeAst(recursiveHelper.typeAst)
      ));
  const materializedEntryValue =
    recursiveHelper && entryValueMatchesRecursiveHelper
      ? buildRuntimeReificationHelperCallAst(
          recursiveHelper.name,
          entryValueAst
        )
      : (tryBuildRuntimeReificationPlan(
          entryValueAst,
          resolvedExpected.valueType,
          targetValueContext,
          emitTypeAst,
          options
        )?.value ?? {
          kind: "castExpression",
          type: targetValueAst,
          expression: entryValueAst,
        });

  const buildToDictionaryAst = (
    sourceAst: CSharpExpressionAst,
    keyBody: CSharpExpressionAst
  ): CSharpExpressionAst => ({
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: identifierExpression("global::System.Linq.Enumerable"),
      memberName: "ToDictionary",
    },
    arguments: [
      sourceAst,
      {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: entryLocal }],
        body: keyBody,
      },
      {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: entryLocal }],
        body: materializedEntryValue,
      },
    ],
  });
  const entryKeyAst: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: identifierExpression(entryLocal),
    memberName: "Key",
  };
  const toDictionaryAst = buildToDictionaryAst(
    identifierExpression(rawLocal),
    entryKeyAst
  );
  const toDictionaryFromSourceAst = buildToDictionaryAst(
    identifierExpression(sourceTypedLocal),
    entryKeyAst
  );

  const typedDictionaryCondition: CSharpExpressionAst = {
    kind: "isExpression",
    expression: boxedValue,
    pattern: {
      kind: "typePattern",
      type: concreteTargetDictionaryAst,
    },
  };
  const rawDictionaryCondition: CSharpExpressionAst = {
    kind: "isExpression",
    expression: boxedValue,
    pattern: {
      kind: "typePattern",
      type: sourceDictionaryAst,
    },
  };
  const condition: CSharpExpressionAst = concreteDirectSourceDictionaryAst
    ? {
        kind: "binaryExpression",
        operatorToken: "||",
        left: {
          kind: "binaryExpression",
          operatorToken: "||",
          left: typedDictionaryCondition,
          right: rawDictionaryCondition,
        },
        right: {
          kind: "isExpression",
          expression: boxedValue,
          pattern: {
            kind: "typePattern",
            type: concreteDirectSourceDictionaryAst,
          },
        },
      }
    : {
        kind: "binaryExpression",
        operatorToken: "||",
        left: typedDictionaryCondition,
        right: rawDictionaryCondition,
      };

  return {
    condition,
    value: buildZeroArgLambdaInvocationAst(concreteTargetDictionaryAst, [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: objectNullableTypeAst(),
        declarators: [{ name: valueLocal, initializer: boxedValue }],
      },
      {
        kind: "ifStatement",
        condition: {
          kind: "isExpression",
          expression: identifierExpression(valueLocal),
          pattern: {
            kind: "declarationPattern",
            type: concreteTargetDictionaryAst,
            designation: typedLocal,
          },
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: identifierExpression(typedLocal),
            },
          ],
        },
      },
      {
        kind: "ifStatement",
        condition: {
          kind: "isExpression",
          expression: identifierExpression(valueLocal),
          pattern: {
            kind: "declarationPattern",
            type: sourceDictionaryAst,
            designation: rawLocal,
          },
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: toDictionaryAst,
            },
          ],
        },
      },
      ...(concreteDirectSourceDictionaryAst
        ? [
            {
              kind: "ifStatement" as const,
              condition: {
                kind: "isExpression" as const,
                expression: identifierExpression(valueLocal),
                pattern: {
                  kind: "declarationPattern" as const,
                  type: concreteDirectSourceDictionaryAst,
                  designation: sourceTypedLocal,
                },
              },
              thenStatement: {
                kind: "blockStatement" as const,
                statements: [
                  {
                    kind: "returnStatement" as const,
                    expression: toDictionaryFromSourceAst,
                  },
                ],
              },
            },
          ]
        : []),
      buildInvalidCastThrowStatement("Unreachable dictionary reification path"),
    ]),
    context: directSourceDictionaryContext,
  };
};

const buildRuntimeArrayReificationPlan = (
  valueAst: CSharpExpressionAst,
  expectedType: IrType,
  resolvedExpected: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  options: RuntimeReificationOptions = {}
): RuntimeReificationPlan | undefined => {
  const elementType = getArrayLikeElementType(resolvedExpected, context);
  if (!elementType) {
    return undefined;
  }
  const materializedElementType =
    resolvedExpected.kind === "arrayType" &&
    resolvedExpected.storageErasedElementType
      ? resolvedExpected.storageErasedElementType
      : elementType;

  const recursiveHelper = options.recursiveHelper;
  const resolvedMaterializedElementType = resolveTypeAlias(
    stripNullish(materializedElementType),
    context,
    { preserveObjectTypeAliases: true }
  );
  const resolvedRecursiveHelperExpectedType = recursiveHelper
    ? resolveTypeAlias(stripNullish(recursiveHelper.expectedType), context, {
        preserveObjectTypeAliases: true,
      })
    : undefined;
  const elementRuntimeCarrierMatchesRecursiveHelper =
    recursiveHelper !== undefined
      ? (() => {
          const [elementRuntimeTypeAst, elementRuntimeLayout] =
            emitRuntimeCarrierTypeAst(
              materializedElementType,
              context,
              emitTypeAst
            );
          return (
            !!elementRuntimeLayout &&
            sameTypeAstSurface(
              stripNullableTypeAst(elementRuntimeTypeAst),
              stripNullableTypeAst(recursiveHelper.typeAst)
            )
          );
        })()
      : false;
  const elementMatchesRecursiveHelperByAlias =
    !!recursiveHelper &&
    (typeMatchesRecursiveReificationTarget(
        materializedElementType,
        recursiveHelper,
        context
      ) ||
      resolvedMaterializedElementType === resolvedRecursiveHelperExpectedType ||
      elementRuntimeCarrierMatchesRecursiveHelper ||
      typeContainsRecursiveReificationTarget(
        materializedElementType,
        recursiveHelper.expectedType,
        context
      ));
  const [targetArrayAst, targetArrayContext] =
    recursiveHelper && elementMatchesRecursiveHelperByAlias
      ? [
          {
            kind: "arrayType" as const,
            elementType: recursiveHelper.typeAst,
            rank: 1,
          },
          context,
        ]
      : emitTypeAst(expectedType, context);
  const [targetElementAst, targetElementContext] =
    recursiveHelper && elementMatchesRecursiveHelperByAlias
      ? [recursiveHelper.typeAst, targetArrayContext]
      : emitTypeAst(materializedElementType, targetArrayContext);
  const concreteTargetArrayAst = stripNullableTypeAst(targetArrayAst);
  const sourceArrayAst: CSharpTypeAst = {
    kind: "arrayType",
    elementType: objectNullableTypeAst(),
    rank: 1,
  };
  const boxedValue = boxValueAst(valueAst);
  const valueLocal = "__tsonic_reify_value";
  const typedLocal = "__tsonic_reify_typed_array";
  const rawLocal = "__tsonic_reify_raw_array";
  const itemLocal = "__item";
  const itemAst = identifierExpression(itemLocal);
  const itemMatchesRecursiveHelper =
    elementMatchesRecursiveHelperByAlias ||
    (!!recursiveHelper &&
      sameTypeAstSurface(
        stripNullableTypeAst(targetElementAst),
        stripNullableTypeAst(recursiveHelper.typeAst)
      ));
  const fallbackMaterializedItem: CSharpExpressionAst = {
    kind: "castExpression",
    type: targetElementAst,
    expression: itemAst,
  };
  const materializedItem =
    recursiveHelper && itemMatchesRecursiveHelper
      ? buildRuntimeReificationHelperCallAst(recursiveHelper.name, itemAst)
      : materializedElementType.kind === "typeParameterType"
        ? fallbackMaterializedItem
      : (tryBuildRuntimeReificationPlan(
          itemAst,
          materializedElementType,
          targetElementContext,
          emitTypeAst,
          options
        )?.value ?? fallbackMaterializedItem);
  const selectAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: identifierExpression("global::System.Linq.Enumerable.Select"),
    typeArguments: [objectNullableTypeAst(), targetElementAst],
    arguments: [
      identifierExpression(rawLocal),
      {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: itemLocal }],
        body: materializedItem,
      },
    ],
  };
  const toArrayAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: identifierExpression("global::System.Linq.Enumerable.ToArray"),
    typeArguments: [targetElementAst],
    arguments: [selectAst],
  };

  return {
    condition: buildArrayShapeCondition(valueAst),
    value: buildZeroArgLambdaInvocationAst(concreteTargetArrayAst, [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: objectNullableTypeAst(),
        declarators: [{ name: valueLocal, initializer: boxedValue }],
      },
      {
        kind: "ifStatement",
        condition: {
          kind: "isExpression",
          expression: identifierExpression(valueLocal),
          pattern: {
            kind: "declarationPattern",
            type: concreteTargetArrayAst,
            designation: typedLocal,
          },
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: identifierExpression(typedLocal),
            },
          ],
        },
      },
      {
        kind: "ifStatement",
        condition: {
          kind: "isExpression",
          expression: identifierExpression(valueLocal),
          pattern: {
            kind: "declarationPattern",
            type: sourceArrayAst,
            designation: rawLocal,
          },
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: toArrayAst,
            },
          ],
        },
      },
      buildInvalidCastThrowStatement("Unreachable array reification path"),
    ]),
    context: targetElementContext,
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

  if (
    isBroadObjectSlotType(targetElementType, targetTypeContext) ||
    isObjectTypeAst(targetElementTypeAst)
  ) {
    const itemName = "__tsonic_array_item";
    const itemExpr = identifierExpression(itemName);
    const materializedElement =
      sourceElementLayout && !isBroadObjectRuntimeMemberType(sourceElementType, targetTypeContext)
        ? ([
            buildRuntimeUnionMatchAst(
              itemExpr,
              sourceElementLayout.memberTypeAsts.map((memberTypeAst, index) => ({
                kind: "lambdaExpression" as const,
                isAsync: false,
                parameters: [{ name: `__tsonic_union_member_${index + 1}` }],
                body: maybeCastMaterializedValueAst(
                  identifierExpression(`__tsonic_union_member_${index + 1}`),
                  memberTypeAst,
                  targetElementTypeAst
                ),
              })),
              [targetElementTypeAst]
            ),
            sourceLayoutContext,
          ] as [CSharpExpressionAst, EmitterContext])
        : tryBuildRuntimeMaterializationAst(
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

  if (
    !sourceElementLayout &&
    targetElementLayout &&
    !isBroadObjectSlotType(sourceElementType, targetLayoutContext) &&
    !isObjectTypeAst(sourceElementTypeAst)
  ) {
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

const isObjectTypeAst = (type: CSharpTypeAst): boolean => {
  const concrete = stripNullableTypeAst(type);
  if (concrete.kind === "predefinedType") {
    return concrete.keyword === "object";
  }
  if (concrete.kind === "identifierType") {
    return concrete.name === "object" || concrete.name === "Object";
  }
  if (concrete.kind === "qualifiedIdentifierType") {
    return concrete.name.segments.join(".") === "System.Object";
  }
  return false;
};

const isNamedReferenceTypeAst = (type: CSharpTypeAst): boolean => {
  const concrete = stripNullableTypeAst(type);
  return (
    concrete.kind === "identifierType" ||
    concrete.kind === "qualifiedIdentifierType"
  );
};

const canUseScalarRuntimeUnionFallbackCast = (
  sourceType: IrType,
  targetType: IrType,
  sourceTypeAst: CSharpTypeAst,
  targetTypeAst: CSharpTypeAst,
  context: EmitterContext
): boolean => {
  if (sameTypeAstSurface(sourceTypeAst, targetTypeAst)) {
    return true;
  }

  if (
    isBroadObjectSlotType(sourceType, context) ||
    isBroadObjectSlotType(targetType, context) ||
    isObjectTypeAst(sourceTypeAst) ||
    isObjectTypeAst(targetTypeAst)
  ) {
    return true;
  }

  return !(
    isNamedReferenceTypeAst(sourceTypeAst) && isNamedReferenceTypeAst(targetTypeAst)
  );
};

const canMaterializeArrayToObjectArrayAst = (
  sourceType: IrType,
  targetTypeAst: CSharpTypeAst,
  context: EmitterContext
): boolean => {
  const sourceElementType = getArrayLikeElementType(sourceType, context);
  return (
    !!sourceElementType &&
    targetTypeAst.kind === "arrayType" &&
    isObjectTypeAst(targetTypeAst.elementType)
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

  const targetMember = targetLayout.members[memberIndex];
  const targetMemberTypeAst = targetLayout.memberTypeAsts[memberIndex];
  if (!targetMember || !targetMemberTypeAst) {
    return undefined;
  }

  const [sourceTypeAst, sourceTypeContext] = emitTypeAst(sourceType, context);
  const nestedMaterialization = tryBuildRuntimeMaterializationAst(
    valueAst,
    sourceType,
    targetMember,
    sourceTypeContext,
    emitTypeAst
  );
  const fallbackCast = canUseScalarRuntimeUnionFallbackCast(
    sourceType,
    targetMember,
    sourceTypeAst,
    targetMemberTypeAst,
    sourceTypeContext
  )
    ? maybeCastMaterializedValueAst(
        valueAst,
        sourceTypeAst,
        targetMemberTypeAst
      )
    : undefined;
  if (!nestedMaterialization && !fallbackCast) {
    return undefined;
  }

  const materializedValueAst = nestedMaterialization?.[0] ?? fallbackCast;
  if (!materializedValueAst) {
    return undefined;
  }

  return [
    buildRuntimeUnionFactoryCallAst(
      buildRuntimeUnionTypeAst(targetLayout),
      memberIndex + 1,
      materializedValueAst
    ),
    nestedMaterialization?.[1] ?? sourceTypeContext,
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
  const selectedScalarSourceMemberNs =
    selectedSourceMemberNs && selectedSourceMemberNs.size > 0
      ? selectedSourceMemberNs
      : !targetLayout && sourceLayout && materializationTargetType.kind !== "unionType"
        ? new Set(
            findRuntimeUnionMemberIndices(
              sourceLayout.members,
              materializationTargetType,
              targetLayoutContext
            ).map((index) => index + 1)
          )
        : undefined;

  if (
    !targetLayout &&
    sourceLayout &&
    selectedScalarSourceMemberNs?.size === 1 &&
    materializationTargetType.kind !== "unionType"
  ) {
    const [selectedMemberN] = selectedScalarSourceMemberNs;
    const selectedIndex = selectedMemberN ? selectedMemberN - 1 : undefined;
    const selectedMember =
      selectedIndex !== undefined ? sourceLayout.members[selectedIndex] : undefined;
    if (
      selectedMemberN !== undefined &&
      selectedMember &&
      matchesExpectedEmissionType(
        selectedMember,
        materializationTargetType,
        targetLayoutContext
      )
    ) {
      return [
        {
          kind: "parenthesizedExpression",
          expression: {
            kind: "invocationExpression",
            expression: {
              kind: "memberAccessExpression",
              expression: valueAst,
              memberName: `As${selectedMemberN}`,
            },
            arguments: [],
          },
        },
        targetLayoutContext,
      ];
    }
  }

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
      canMaterializeArrayToObjectArrayAst(
        member,
        concreteTargetTypeAst,
        nextContext
      ) ||
      canMaterializeArrayToBroadObjectArray(
        member,
        materializationTargetType,
        nextContext
      ) ||
      canMaterializeStringKeyDictionary(
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

  if (matchingSourceIndices.length === 1) {
    const [matchingSourceIndex] = matchingSourceIndices;
    if (matchingSourceIndex !== undefined) {
      const matchingSourceMemberN =
        effectiveSourceFrame?.candidateMemberNs?.[matchingSourceIndex] ??
        matchingSourceIndex + 1;
      return [
        {
          kind: "parenthesizedExpression",
          expression: {
            kind: "invocationExpression",
            expression: {
              kind: "memberAccessExpression",
              expression: valueAst,
              memberName: `As${matchingSourceMemberN}`,
            },
            arguments: [],
          },
        },
        nextContext,
      ];
    }
  }

  const lambdaArgs: CSharpExpressionAst[] = [];
  let matchContext = nextContext;
  let directProjectionMemberN: number | undefined;
  let directProjectionCount = 0;
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
    const dictionaryMemberMaterialization =
      arrayElementMaterialization === undefined
        ? tryBuildDictionaryMemberMaterializationAst(
            parameterExpr,
            actualMember,
            materializationTargetType,
            matchContext,
            emitTypeAst,
            parameterName
          )
        : undefined;
    if (dictionaryMemberMaterialization) {
      matchContext = dictionaryMemberMaterialization[1];
    }
    const sourceMemberTypeAst =
      sourceSurfaceMemberTypeAsts?.[index] ?? sourceLayout.memberTypeAsts[index];
    const castMaterializedValue = sourceMemberTypeAst
      ? maybeCastMaterializedValueAst(
          parameterExpr,
          sourceMemberTypeAst,
          concreteTargetTypeAst
        )
      : undefined;
    const memberBody =
      arrayElementMaterialization?.[0] ??
      dictionaryMemberMaterialization?.[0] ??
      castMaterializedValue ??
      buildInvalidRuntimeUnionMaterializationExpression(
        actualMember,
        materializationTargetType
      );
    if (
      memberBody.kind === "identifierExpression" &&
      memberBody.identifier === parameterName
    ) {
      directProjectionMemberN = sourceMemberN;
      directProjectionCount += 1;
    }

    lambdaArgs.push({
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [{ name: parameterName }],
      body: memberBody,
    });
  }

  if (directProjectionCount === 1 && directProjectionMemberN !== undefined) {
    return [
      {
        kind: "parenthesizedExpression",
        expression: {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: valueAst,
            memberName: `As${directProjectionMemberN}`,
          },
          arguments: [],
        },
      },
      matchContext,
    ];
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
  emitTypeAst: EmitTypeAstFn,
  options: RuntimeReificationOptions = {}
): RuntimeReificationPlan | undefined => {
  const directExpectedType = stripNullish(expectedType);
  if (options.activeTypes?.has(directExpectedType)) {
    return undefined;
  }
  options = {
    ...options,
    activeTypes: new Set([...(options.activeTypes ?? []), directExpectedType]),
  };
  if (options.recursiveHelper) {
    if (directExpectedType.kind === "arrayType") {
      const directArrayReification = buildRuntimeArrayReificationPlan(
        valueAst,
        expectedType,
        directExpectedType,
        context,
        emitTypeAst,
        options
      );
      if (directArrayReification) {
        return directArrayReification;
      }
    }

    if (directExpectedType.kind === "dictionaryType") {
      const directDictionaryReification = buildRuntimeDictionaryReificationPlan(
        valueAst,
        expectedType,
        directExpectedType,
        context,
        emitTypeAst,
        options
      );
      if (directDictionaryReification) {
        return directDictionaryReification;
      }
    }
  }

  const materializationExpectedType = resolveRuntimeMaterializationTargetType(
    expectedType,
    context
  );
  const resolvedMaterializationExpected = resolveTypeAlias(
    materializationExpectedType,
    context,
    { preserveObjectTypeAliases: true }
  );
  const expectedAllowsRuntimeNullish = hasTopLevelRuntimeNullishMember(
    resolvedMaterializationExpected
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

  let [unionTypeAst, runtimeLayout, unionTypeContext] =
    precomputedRuntimeLayoutAppliesTo(expectedType, options, context)
      ? [
          options.typeAst!,
          options.layout!,
          options.context ?? context,
        ]
      : emitRuntimeCarrierTypeAst(expectedType, context, emitTypeAst);
  let concreteUnionTypeAst = stripNullableTypeAst(unionTypeAst);
  if (!runtimeLayout && resolvedExpected.kind === "unionType") {
    const [resolvedLayout, resolvedLayoutContext] = buildRuntimeUnionLayout(
      resolvedExpected,
      context,
      emitTypeAst
    );
    if (resolvedLayout) {
      runtimeLayout = resolvedLayout;
      unionTypeContext = resolvedLayoutContext;
      unionTypeAst = buildRuntimeUnionTypeAst(resolvedLayout);
      concreteUnionTypeAst = stripNullableTypeAst(unionTypeAst);
    }
  }

  if (
    resolvedExpected.kind === "unionType" ||
    !!runtimeLayout
  ) {
    if (
      directRuntimeCarrierType &&
      !isBroadObjectRuntimeMemberType(directRuntimeCarrierType, context)
    ) {
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
    if (
      directValueSurfaceType &&
      !isBroadObjectRuntimeMemberType(directValueSurfaceType, context)
    ) {
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

    if (!runtimeLayout) {
      return undefined;
    }

    const members = runtimeLayout.members;
    const semanticMembers =
      resolvedExpected.kind === "unionType" ? resolvedExpected.types : members;
    const memberPlanTypes = alignSemanticRuntimeUnionMembers(
      members,
      semanticMembers,
      unionTypeContext
    );

    if (
      !options.recursiveHelper &&
      semanticMembers.some((member) =>
        typeContainsRecursiveReificationTarget(
          member,
          expectedType,
          unionTypeContext
        )
      )
    ) {
      const helperName = runtimeReificationHelperName(concreteUnionTypeAst);
      const helperParameterName = "__tsonic_reify_input";
      const recursiveHelper: RecursiveRuntimeReificationHelper = {
        expectedType,
        name: helperName,
        typeAst: concreteUnionTypeAst,
      };
      const helperOptions: RuntimeReificationOptions = {
        typeAst: unionTypeAst,
        layout: runtimeLayout,
        layoutType: expectedType,
        context: unionTypeContext,
        recursiveHelper,
      };
      const helperInputAst = identifierExpression(helperParameterName);
      const helperPlan = tryBuildRuntimeReificationPlan(
        helperInputAst,
        expectedType,
        unionTypeContext,
        emitTypeAst,
        helperOptions
      );
      const conditionPlan = tryBuildRuntimeReificationPlan(
        valueAst,
        expectedType,
        unionTypeContext,
        emitTypeAst,
        helperOptions
      );
      if (helperPlan && conditionPlan) {
        return {
          condition: conditionPlan.condition,
          value: buildZeroArgLambdaInvocationAst(concreteUnionTypeAst, [
            {
              kind: "localFunctionStatement",
              modifiers: [],
              returnType: concreteUnionTypeAst,
              name: helperName,
              parameters: [
                {
                  name: helperParameterName,
                  type: objectNullableTypeAst(),
                },
              ],
              body: {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "returnStatement",
                    expression: helperPlan.value,
                  },
                ],
              },
            },
            {
              kind: "returnStatement",
              expression: buildRuntimeReificationHelperCallAst(
                helperName,
                valueAst
              ),
            },
          ]),
          context: helperPlan.context,
        };
      }
    }

    const cases: RuntimeReificationPlan[] = [];
    if (expectedAllowsRuntimeNullish) {
      cases.push({
        condition: {
          kind: "binaryExpression",
          operatorToken: "==",
          left: boxValueAst(valueAst),
          right: nullLiteral(),
        },
        value: { kind: "defaultExpression" },
        context: unionTypeContext,
      });
    }
    cases.push({
        condition: {
          kind: "isExpression",
          expression: boxValueAst(valueAst),
          pattern: {
            kind: "typePattern",
            type: concreteUnionTypeAst,
          },
        },
        value: {
          kind: "castExpression",
          type: concreteUnionTypeAst,
          expression: boxValueAst(valueAst),
        },
        context: unionTypeContext,
      });

    let currentContext = unionTypeContext;
    let catchAllCase: RuntimeReificationPlan | undefined;
    for (let index = 0; index < members.length; index += 1) {
      const runtimeMember = members[index];
      const member = memberPlanTypes[index] ?? runtimeMember;
      if (!runtimeMember || !member) continue;
      if (
        typeMatchesRecursiveReificationTarget(
          member,
          options.recursiveHelper,
          currentContext
        )
      ) {
        continue;
      }
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
          emitTypeAst,
          options
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

  if (
    resolvedExpected.kind === "arrayType" ||
    resolvedExpected.kind === "tupleType" ||
    (resolvedExpected.kind === "referenceType" &&
      (resolvedExpected.name === "Array" ||
        resolvedExpected.name === "ReadonlyArray"))
  ) {
    const directArrayElementMaterialization =
      directValueSurfaceType &&
      tryBuildArrayElementMaterializationAst(
        valueAst,
        directValueSurfaceType,
        expectedType,
        context,
        emitTypeAst
      );
    if (directArrayElementMaterialization) {
      return {
        condition: buildArrayShapeCondition(valueAst),
        value: directArrayElementMaterialization[0],
        context: directArrayElementMaterialization[1],
      };
    }
  }

  const dictionaryReification = buildRuntimeDictionaryReificationPlan(
    valueAst,
    expectedType,
    resolvedExpected,
    context,
    emitTypeAst,
    options
  );
  if (dictionaryReification) {
    return dictionaryReification;
  }

  const arrayReification = buildRuntimeArrayReificationPlan(
    valueAst,
    expectedType,
    resolvedExpected,
    context,
    emitTypeAst,
    options
  );
  if (arrayReification) {
    return arrayReification;
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
