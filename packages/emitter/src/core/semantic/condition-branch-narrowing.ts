import { IrExpression, IrType, normalizedUnionType } from "@tsonic/frontend";
import type { EmitterContext, NarrowedBinding } from "../../types.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
  stringLiteral,
} from "../format/backend-ast/builders.js";
import { stableTypeKeyFromAst } from "../format/backend-ast/utils.js";
import { emitTypeAst } from "../../type-emitter.js";
import { nullLiteral } from "../format/backend-ast/builders.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import {
  matchesTypeofTag,
  narrowTypeByNotTypeofTag,
  narrowTypeByTypeofTag,
  splitRuntimeNullishUnionMembers,
  stripNullish,
  resolveTypeAlias,
  isDefinitelyValueType,
  unionMemberMatchesTarget,
} from "./type-resolution.js";
import { stableIrTypeKey } from "@tsonic/frontend";
import {
  buildRuntimeUnionLayout,
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
  findRuntimeUnionMemberIndex,
  buildRuntimeUnionTypeAst,
} from "./runtime-unions.js";
import {
  resolveNarrowedUnionMembers,
  type NarrowedUnionMembers,
} from "./narrowed-union-resolution.js";
import { normalizeInstanceofTargetType } from "./instanceof-targets.js";
import { materializeDirectNarrowingAst } from "./materialized-narrowing.js";
import {
  RuntimeMaterializationSourceFrame,
  tryBuildRuntimeMaterializationAst,
} from "./runtime-reification.js";
import { unwrapTransparentNarrowingTarget } from "./transparent-expressions.js";

type BranchTruthiness = "truthy" | "falsy";

type EmitExprAstFn = (
  expr: IrExpression,
  context: EmitterContext
) => [CSharpExpressionAst, EmitterContext];

type RuntimeUnionFrame = NarrowedUnionMembers;

const toReceiverAst = (
  receiver: string | CSharpExpressionAst
): CSharpExpressionAst =>
  typeof receiver === "string"
    ? { kind: "identifierExpression", identifier: receiver }
    : receiver;

const buildUnionNarrowAst = (
  receiver: string | CSharpExpressionAst,
  memberN: number
): CSharpExpressionAst => ({
  kind: "parenthesizedExpression",
  expression: {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: toReceiverAst(receiver),
      memberName: `As${memberN}`,
    },
    arguments: [],
  },
});

const buildSubsetUnionType = (
  members: readonly IrType[]
): IrType | undefined => {
  if (members.length === 0) return undefined;
  if (members.length === 1) return members[0];
  return normalizedUnionType(members);
};

const withoutNarrowedBinding = (
  context: EmitterContext,
  bindingKey: string
): EmitterContext => {
  if (!context.narrowedBindings?.has(bindingKey)) {
    return context;
  }

  const narrowedBindings = new Map(context.narrowedBindings);
  narrowedBindings.delete(bindingKey);

  return {
    ...context,
    narrowedBindings,
  };
};

const applyBinding = (
  bindingKey: string,
  binding: NarrowedBinding,
  context: EmitterContext
): EmitterContext => {
  const narrowedBindings = new Map(context.narrowedBindings ?? []);
  narrowedBindings.set(bindingKey, binding);
  return {
    ...context,
    narrowedBindings,
  };
};

const buildExprBinding = (
  exprAst: CSharpExpressionAst,
  type: IrType | undefined,
  sourceType: IrType | undefined,
  storageExprAst?: CSharpExpressionAst
): Extract<NarrowedBinding, { kind: "expr" }> => ({
  kind: "expr",
  exprAst,
  storageExprAst,
  type,
  sourceType,
});

const buildRuntimeSubsetExpressionAst = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const sourceType = narrowed.sourceType ?? expr.inferredType;
  const subsetType = narrowed.type;
  if (!sourceType || !subsetType) {
    return undefined;
  }

  const sourceFrame: RuntimeMaterializationSourceFrame | undefined =
    narrowed.sourceMembers &&
    narrowed.sourceCandidateMemberNs &&
    narrowed.sourceMembers.length === narrowed.sourceCandidateMemberNs.length
      ? {
          members: narrowed.sourceMembers,
          candidateMemberNs: narrowed.sourceCandidateMemberNs,
        }
      : undefined;

  return tryBuildRuntimeMaterializationAst(
    identifierExpression(escapeCSharpIdentifier(expr.name)),
    sourceType,
    subsetType,
    context,
    emitTypeAst,
    new Set(narrowed.runtimeMemberNs),
    sourceFrame
  );
};

const buildConditionalNullishGuardAst = (
  sourceAst: CSharpExpressionAst,
  whenNonNull: CSharpExpressionAst,
  targetType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [targetTypeAst, nextContext] = emitTypeAst(
    stripNullish(targetType),
    context
  );
  return [
    {
      kind: "conditionalExpression",
      condition: {
        kind: "binaryExpression",
        operatorToken: "==",
        left: {
          kind: "castExpression",
          type: { kind: "predefinedType", keyword: "object" },
          expression: sourceAst,
        },
        right: nullLiteral(),
      },
      whenTrue: {
        kind: "defaultExpression",
        type: targetTypeAst,
      },
      whenFalse: whenNonNull,
    },
    nextContext,
  ];
};

const tryStripConditionalNullishGuardAst = (
  exprAst: CSharpExpressionAst
): CSharpExpressionAst | undefined => {
  if (exprAst.kind !== "conditionalExpression") {
    return undefined;
  }

  const condition = exprAst.condition;
  if (
    condition.kind !== "binaryExpression" ||
    condition.operatorToken !== "=="
  ) {
    return undefined;
  }

  if (
    condition.left.kind !== "castExpression" ||
    condition.left.type.kind !== "predefinedType" ||
    condition.left.type.keyword !== "object"
  ) {
    return undefined;
  }

  if (condition.right.kind !== "nullLiteralExpression") {
    return undefined;
  }

  if (exprAst.whenTrue.kind !== "defaultExpression") {
    return undefined;
  }

  return exprAst.whenFalse;
};

const isArrayLikeNarrowingCandidate = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType" || resolved.kind === "tupleType") {
    return true;
  }
  if (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" ||
      resolved.name === "ReadonlyArray" ||
      resolved.name === "JSArray")
  ) {
    return true;
  }
  return false;
};

const narrowTypeByArrayShape = (
  currentType: IrType | undefined,
  wantArray: boolean,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(currentType), context);
  if (resolved.kind === "unionType") {
    const kept = resolved.types.filter((member): member is IrType => {
      if (!member) return false;
      const isArrayLike = isArrayLikeNarrowingCandidate(member, context);
      return wantArray ? isArrayLike : !isArrayLike;
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return isArrayLikeNarrowingCandidate(currentType, context) === wantArray
    ? currentType
    : undefined;
};

const narrowTypeByNotAssignableTarget = (
  currentType: IrType | undefined,
  targetType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType || !targetType) return undefined;

  const resolvedCurrent = resolveTypeAlias(stripNullish(currentType), context);
  const resolvedTarget = resolveTypeAlias(stripNullish(targetType), context);

  if (resolvedCurrent.kind === "unionType") {
    const kept = resolvedCurrent.types.filter((member): member is IrType => {
      if (!member) return false;
      return !unionMemberMatchesTarget(member, resolvedTarget, context);
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return unionMemberMatchesTarget(resolvedCurrent, resolvedTarget, context)
    ? undefined
    : resolvedCurrent;
};

const currentNarrowedType = (
  bindingKey: string,
  fallbackType: IrType | undefined,
  context: EmitterContext
): IrType | undefined =>
  context.narrowedBindings?.get(bindingKey)?.type ?? fallbackType;

const resolveRuntimeUnionFrame = resolveNarrowedUnionMembers;

const isNullOrUndefined = (expr: IrExpression): boolean => {
  if (
    expr.kind === "literal" &&
    (expr.value === null || expr.value === undefined)
  ) {
    return true;
  }

  return expr.kind === "identifier" && expr.name === "undefined";
};

const buildRuntimeUnionComplementBinding = (
  receiver: CSharpExpressionAst,
  runtimeUnionFrame: RuntimeUnionFrame,
  sourceType: IrType,
  narrowedType: IrType,
  selectedMemberN: number,
  context: EmitterContext
): NarrowedBinding | undefined => {
  const remainingPairs = runtimeUnionFrame.candidateMemberNs.flatMap(
    (runtimeMemberN, index) => {
      if (runtimeMemberN === selectedMemberN) {
        return [];
      }

      const memberType = runtimeUnionFrame.members[index];
      if (!memberType) {
        return [];
      }

      return [{ runtimeMemberN, memberType }];
    }
  );

  if (remainingPairs.length === 0) {
    return undefined;
  }

  const split = splitRuntimeNullishUnionMembers(narrowedType);
  const hasRuntimeNullish = split?.hasRuntimeNullish ?? false;

  if (remainingPairs.length === 1) {
    const remaining = remainingPairs[0];
    if (!remaining) return undefined;

    const narrowedExpr = buildUnionNarrowAst(
      receiver,
      remaining.runtimeMemberN
    );
    if (!hasRuntimeNullish) {
      return buildExprBinding(
        narrowedExpr,
        narrowedType,
        sourceType,
        toReceiverAst(receiver)
      );
    }

    const [nullAwareExpr] = buildConditionalNullishGuardAst(
      receiver,
      narrowedExpr,
      narrowedType,
      context
    );
    return buildExprBinding(
      nullAwareExpr,
      narrowedType,
      sourceType,
      toReceiverAst(receiver)
    );
  }

  if (hasRuntimeNullish) {
    return undefined;
  }

  return {
    kind: "runtimeSubset",
    runtimeMemberNs: remainingPairs.map((pair) => pair.runtimeMemberN),
    runtimeUnionArity: runtimeUnionFrame.runtimeUnionArity,
    sourceMembers: [...runtimeUnionFrame.members],
    sourceCandidateMemberNs: [...runtimeUnionFrame.candidateMemberNs],
    type: narrowedType,
    sourceType,
  };
};

const buildUnionFactoryCallAst = (
  unionTypeAst: CSharpTypeAst,
  memberIndex: number,
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: {
      kind: "typeReferenceExpression",
      type: unionTypeAst,
    },
    memberName: `From${memberIndex}`,
  },
  arguments: [valueAst],
});

const buildInvalidRuntimeUnionCastExpression = (
  actualType: IrType,
  expectedType: IrType
): CSharpExpressionAst => ({
  kind: "throwExpression",
  expression: {
    kind: "objectCreationExpression",
    type: identifierType("global::System.InvalidCastException"),
    arguments: [
      stringLiteral(
        `Cannot cast runtime union ${stableIrTypeKey(
          actualType
        )} to ${stableIrTypeKey(expectedType)}`
      ),
    ],
  },
});

const buildRuntimeUnionSubsetBinding = (
  receiverAst: CSharpExpressionAst,
  runtimeUnionFrame: RuntimeUnionFrame,
  sourceType: IrType,
  narrowedType: IrType,
  context: EmitterContext
): [NarrowedBinding, EmitterContext] | undefined => {
  const split = splitRuntimeNullishUnionMembers(narrowedType);
  const nonNullishTarget =
    split?.nonNullishMembers && split.nonNullishMembers.length > 0
      ? (buildSubsetUnionType(split.nonNullishMembers) ?? narrowedType)
      : narrowedType;

  const selectedPairs = runtimeUnionFrame.candidateMemberNs.flatMap(
    (runtimeMemberN, index) => {
      const memberType = runtimeUnionFrame.members[index];
      if (!memberType) {
        return [];
      }

      return unionMemberMatchesTarget(memberType, nonNullishTarget, context)
        ? [{ runtimeMemberN, memberType }]
        : [];
    }
  );

  if (selectedPairs.length === 0) {
    return undefined;
  }

  if (selectedPairs.length === 1 && !(split?.hasRuntimeNullish ?? false)) {
    const selected = selectedPairs[0];
    if (!selected) {
      return undefined;
    }
    return [
      buildExprBinding(
        buildUnionNarrowAst(receiverAst, selected.runtimeMemberN),
        narrowedType,
        sourceType,
        receiverAst
      ),
      context,
    ];
  }

  const [subsetLayout, subsetLayoutContext] = buildRuntimeUnionLayout(
    nonNullishTarget,
    context,
    emitTypeAst
  );
  if (!subsetLayout) {
    const [materializedExprAst, materializedContext] =
      materializeDirectNarrowingAst(
        receiverAst,
        sourceType,
        narrowedType,
        context
      );
    return [
      buildExprBinding(
        materializedExprAst,
        narrowedType,
        sourceType,
        receiverAst
      ),
      materializedContext,
    ];
  }

  const subsetTypeContext = subsetLayoutContext;
  const concreteSubsetTypeAst = buildRuntimeUnionTypeAst(subsetLayout);

  const expectedMemberIndexByAstKey = new Map<string, number>();
  for (let index = 0; index < subsetLayout.memberTypeAsts.length; index += 1) {
    const memberTypeAst = subsetLayout.memberTypeAsts[index];
    if (!memberTypeAst) continue;
    expectedMemberIndexByAstKey.set(stableTypeKeyFromAst(memberTypeAst), index);
  }

  const selectedRuntimeMembers = new Set(
    selectedPairs.map((pair) => pair.runtimeMemberN)
  );
  const lambdaArgs: CSharpExpressionAst[] = [];

  for (let index = 0; index < runtimeUnionFrame.members.length; index += 1) {
    const actualMember = runtimeUnionFrame.members[index];
    if (!actualMember) continue;

    const parameterName = `__tsonic_union_member_${index + 1}`;
    const parameterExpr: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: parameterName,
    };
    const runtimeMemberN =
      runtimeUnionFrame.candidateMemberNs[index] ?? index + 1;

    if (!selectedRuntimeMembers.has(runtimeMemberN)) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeUnionCastExpression(
          actualMember,
          narrowedType
        ),
      });
      continue;
    }

    const sourceMemberTypeAst = (() => {
      const [typeAst] = emitTypeAst(actualMember, subsetTypeContext);
      return typeAst;
    })();
    const expectedMemberIndex =
      expectedMemberIndexByAstKey.get(
        stableTypeKeyFromAst(sourceMemberTypeAst)
      ) ??
      findRuntimeUnionMemberIndex(
        subsetLayout.members,
        actualMember,
        subsetTypeContext
      );

    if (expectedMemberIndex === undefined) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeUnionCastExpression(
          actualMember,
          narrowedType
        ),
      });
      continue;
    }

    lambdaArgs.push({
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [{ name: parameterName }],
      body: buildUnionFactoryCallAst(
        concreteSubsetTypeAst,
        expectedMemberIndex + 1,
        parameterExpr
      ),
    });
  }

  const matchExpr: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: receiverAst,
      memberName: "Match",
    },
    arguments: lambdaArgs,
  };

  const exprAst = split?.hasRuntimeNullish
    ? buildConditionalNullishGuardAst(
        receiverAst,
        matchExpr,
        narrowedType,
        subsetTypeContext
      )[0]
    : matchExpr;

  return [
    buildExprBinding(exprAst, narrowedType, sourceType, receiverAst),
    subsetTypeContext,
  ];
};

const applyDirectTypeNarrowing = (
  bindingKey: string,
  targetExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>,
  narrowedType: IrType,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext => {
  const existingBinding = context.narrowedBindings?.get(bindingKey);
  if (
    existingBinding?.type &&
    stableIrTypeKey(resolveTypeAlias(existingBinding.type, context)) ===
      stableIrTypeKey(resolveTypeAlias(narrowedType, context))
  ) {
    return context;
  }

  const currentType = currentNarrowedType(
    bindingKey,
    targetExpr.inferredType,
    context
  );
  const [rawTargetAst, rawTargetContext] = emitExprAst(
    targetExpr,
    withoutNarrowedBinding(context, bindingKey)
  );
  const [carrierAst, carrierContext] = (() => {
    if (!existingBinding) {
      return [rawTargetAst, rawTargetContext] as const;
    }

    if (existingBinding.kind === "rename") {
      return [
        identifierExpression(escapeCSharpIdentifier(existingBinding.name)),
        context,
      ] as const;
    }

    if (existingBinding.kind === "expr") {
      return [existingBinding.exprAst, context] as const;
    }

    if (
      existingBinding.kind === "runtimeSubset" &&
      targetExpr.kind === "identifier"
    ) {
      const subsetAst = buildRuntimeSubsetExpressionAst(
        targetExpr,
        existingBinding,
        context
      );
      if (subsetAst) {
        return subsetAst;
      }
    }

    return [rawTargetAst, rawTargetContext] as const;
  })();

  const runtimeUnionFrame = currentType
    ? resolveRuntimeUnionFrame(bindingKey, currentType, context)
    : undefined;

  if (runtimeUnionFrame && currentType) {
    const subsetBinding = buildRuntimeUnionSubsetBinding(
      carrierAst,
      runtimeUnionFrame,
      currentType,
      narrowedType,
      carrierContext
    );
    if (subsetBinding) {
      const [binding, subsetContext] = subsetBinding;
      return applyBinding(bindingKey, binding, subsetContext);
    }
  }

  const [materializedExprAst, materializedContext] =
    materializeDirectNarrowingAst(
      carrierAst,
      currentType,
      narrowedType,
      carrierContext
    );

  return applyBinding(
    bindingKey,
    buildExprBinding(
      materializedExprAst,
      narrowedType,
      currentType,
      carrierAst
    ),
    materializedContext
  );
};

const applySimpleNullableRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  const nullableGuard = (() => {
    if (condition.kind !== "binary") return undefined;

    const op = condition.operator;
    const isNotEqual = op === "!==" || op === "!=";
    const isEqual = op === "===" || op === "==";
    if (!isNotEqual && !isEqual) return undefined;

    let operand:
      | Extract<IrExpression, { kind: "identifier" | "memberAccess" }>
      | undefined;
    let key: string | undefined;

    if (isNullOrUndefined(condition.right)) {
      operand = unwrapTransparentNarrowingTarget(condition.left);
    } else if (isNullOrUndefined(condition.left)) {
      operand = unwrapTransparentNarrowingTarget(condition.right);
    }

    if (!operand) return undefined;

    key =
      operand.kind === "identifier"
        ? operand.name
        : getMemberAccessNarrowKey(operand);
    if (!key) return undefined;

    const idType = currentNarrowedType(key, operand.inferredType, context);
    if (!idType) return undefined;
    const stripped = stripNullish(idType);
    if (stableIrTypeKey(stripped) === stableIrTypeKey(idType)) {
      return undefined;
    }

    return {
      key,
      targetExpr: operand,
      strippedType: stripped,
      narrowsInThen: isNotEqual,
      isValueType: isDefinitelyValueType(stripped),
    };
  })();
  if (!nullableGuard) {
    return undefined;
  }

  const shouldNarrowToNonNull =
    branch === "truthy"
      ? nullableGuard.narrowsInThen
      : !nullableGuard.narrowsInThen;
  if (!shouldNarrowToNonNull) {
    return undefined;
  }

  const currentType = currentNarrowedType(
    nullableGuard.key,
    nullableGuard.targetExpr.inferredType,
    context
  );
  if (!currentType) {
    return undefined;
  }

  const strippedType = stripNullish(currentType);
  if (stableIrTypeKey(strippedType) === stableIrTypeKey(currentType)) {
    return undefined;
  }

  const [rawTargetAst, rawTargetContext] = emitExprAst(
    nullableGuard.targetExpr,
    context
  );

  const exprAst =
    nullableGuard.isValueType || isDefinitelyValueType(strippedType)
      ? {
          kind: "memberAccessExpression" as const,
          expression: rawTargetAst,
          memberName: "Value",
        }
      : (tryStripConditionalNullishGuardAst(rawTargetAst) ?? rawTargetAst);

  return applyBinding(
    nullableGuard.key,
    buildExprBinding(exprAst, strippedType, currentType, rawTargetAst),
    rawTargetContext
  );
};

const applyDirectTypeofRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  if (condition.kind !== "binary") return undefined;
  if (
    condition.operator !== "===" &&
    condition.operator !== "==" &&
    condition.operator !== "!==" &&
    condition.operator !== "!="
  ) {
    return undefined;
  }

  const extract = (
    left: IrExpression,
    right: IrExpression
  ):
    | {
        readonly bindingKey: string;
        readonly targetExpr: Extract<
          IrExpression,
          { kind: "identifier" | "memberAccess" }
        >;
        readonly tag: string;
      }
    | undefined => {
    if (left.kind !== "unary" || left.operator !== "typeof") return undefined;
    const target = unwrapTransparentNarrowingTarget(left.expression);
    if (!target) return undefined;
    if (right.kind !== "literal" || typeof right.value !== "string") {
      return undefined;
    }
    const bindingKey =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!bindingKey) return undefined;
    return {
      bindingKey,
      targetExpr: target,
      tag: right.value,
    };
  };

  const directGuard =
    extract(condition.left, condition.right) ??
    extract(condition.right, condition.left);
  if (!directGuard) return undefined;

  const matchesInTruthyBranch =
    condition.operator === "===" || condition.operator === "==";
  const matchTag =
    branch === "truthy" ? matchesInTruthyBranch : !matchesInTruthyBranch;

  const currentType = currentNarrowedType(
    directGuard.bindingKey,
    directGuard.targetExpr.inferredType,
    context
  );
  const narrowedType = matchTag
    ? narrowTypeByTypeofTag(currentType, directGuard.tag, context)
    : narrowTypeByNotTypeofTag(currentType, directGuard.tag, context);
  if (!narrowedType) {
    return undefined;
  }

  const [rawTargetAst, rawTargetContext] = emitExprAst(
    directGuard.targetExpr,
    withoutNarrowedBinding(context, directGuard.bindingKey)
  );

  const runtimeUnionFrame = currentType
    ? resolveRuntimeUnionFrame(
        directGuard.bindingKey,
        currentType,
        rawTargetContext
      )
    : undefined;
  const matchingRuntimeMemberIndex =
    runtimeUnionFrame?.members.findIndex((member) =>
      matchesTypeofTag(member, directGuard.tag, rawTargetContext)
    ) ?? -1;

  if (
    runtimeUnionFrame &&
    matchingRuntimeMemberIndex >= 0 &&
    runtimeUnionFrame.members.filter((member) =>
      matchesTypeofTag(member, directGuard.tag, rawTargetContext)
    ).length === 1
  ) {
    const memberN =
      runtimeUnionFrame.candidateMemberNs[matchingRuntimeMemberIndex] ??
      matchingRuntimeMemberIndex + 1;
    const memberType =
      runtimeUnionFrame.members[matchingRuntimeMemberIndex] ?? narrowedType;

    if (matchTag) {
      return applyBinding(
        directGuard.bindingKey,
        buildExprBinding(
          buildUnionNarrowAst(rawTargetAst, memberN),
          narrowedType,
          currentType,
          rawTargetAst
        ),
        rawTargetContext
      );
    }

    const complementBinding = buildRuntimeUnionComplementBinding(
      rawTargetAst,
      runtimeUnionFrame,
      currentType ?? narrowedType,
      narrowedType,
      memberN,
      rawTargetContext
    );
    if (complementBinding) {
      return applyBinding(
        directGuard.bindingKey,
        complementBinding,
        rawTargetContext
      );
    }

    void memberType;
  }

  return applyDirectTypeNarrowing(
    directGuard.bindingKey,
    directGuard.targetExpr,
    narrowedType,
    context,
    emitExprAst
  );
};

const applyArrayIsArrayRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  const extractDirect = (
    expr: IrExpression
  ):
    | {
        readonly bindingKey: string;
        readonly targetExpr: Extract<
          IrExpression,
          { kind: "identifier" | "memberAccess" }
        >;
        readonly narrowsInTruthyBranch: boolean;
      }
    | undefined => {
    if (expr.kind !== "call") return undefined;
    if (expr.arguments.length !== 1) return undefined;
    if (expr.callee.kind !== "memberAccess" || expr.callee.isComputed) {
      return undefined;
    }
    if (expr.callee.property !== "isArray") return undefined;
    if (
      expr.callee.object.kind !== "identifier" ||
      expr.callee.object.name !== "Array"
    ) {
      return undefined;
    }

    const [rawTarget] = expr.arguments;
    if (!rawTarget) return undefined;
    const target = unwrapTransparentNarrowingTarget(rawTarget);
    if (!target) return undefined;
    const bindingKey =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!bindingKey) return undefined;

    return {
      bindingKey,
      targetExpr: target,
      narrowsInTruthyBranch: true,
    };
  };

  const direct = extractDirect(condition);
  if (!direct) {
    return undefined;
  }

  const wantArray =
    branch === "truthy"
      ? direct.narrowsInTruthyBranch
      : !direct.narrowsInTruthyBranch;
  const currentType = currentNarrowedType(
    direct.bindingKey,
    direct.targetExpr.inferredType,
    context
  );
  const narrowedType = narrowTypeByArrayShape(currentType, wantArray, context);
  if (!narrowedType) {
    return undefined;
  }

  const [rawTargetAst, rawTargetContext] = emitExprAst(
    direct.targetExpr,
    withoutNarrowedBinding(context, direct.bindingKey)
  );
  const runtimeUnionFrame =
    currentType &&
    resolveRuntimeUnionFrame(direct.bindingKey, currentType, rawTargetContext);
  const runtimeArrayPairs =
    runtimeUnionFrame?.members.flatMap((member, index) => {
      if (!member || !isArrayLikeNarrowingCandidate(member, rawTargetContext)) {
        return [];
      }
      const runtimeMemberN = runtimeUnionFrame.candidateMemberNs[index];
      if (!runtimeMemberN) return [];
      return [{ memberType: member, runtimeMemberN }];
    }) ?? [];

  if (runtimeUnionFrame && runtimeArrayPairs.length === 1) {
    const runtimeArrayPair = runtimeArrayPairs[0];
    if (!runtimeArrayPair) {
      return undefined;
    }

    if (wantArray) {
      return applyBinding(
        direct.bindingKey,
        buildExprBinding(
          buildUnionNarrowAst(rawTargetAst, runtimeArrayPair.runtimeMemberN),
          narrowedType,
          currentType,
          rawTargetAst
        ),
        rawTargetContext
      );
    }

    const complementBinding = buildRuntimeUnionComplementBinding(
      rawTargetAst,
      runtimeUnionFrame,
      currentType,
      narrowedType,
      runtimeArrayPair.runtimeMemberN,
      rawTargetContext
    );
    if (complementBinding) {
      return applyBinding(
        direct.bindingKey,
        complementBinding,
        rawTargetContext
      );
    }
  }

  return applyDirectTypeNarrowing(
    direct.bindingKey,
    direct.targetExpr,
    narrowedType,
    context,
    emitExprAst
  );
};

const applyInstanceofRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  const guard = (() => {
    if (condition.kind !== "binary" || condition.operator !== "instanceof") {
      return undefined;
    }

    const target = unwrapTransparentNarrowingTarget(condition.left);
    if (!target) return undefined;

    const originalName =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!originalName) return undefined;

    const [lhsAst, ctxAfterLhs] = emitExprAst(
      target,
      withoutNarrowedBinding(context, originalName)
    );
    const inferredRhsType = normalizeInstanceofTargetType(
      condition.right.inferredType
    );
    if (!inferredRhsType) {
      return undefined;
    }

    const currentType = currentNarrowedType(
      originalName,
      target.inferredType ?? condition.left.inferredType,
      context
    );
    const runtimeUnionFrame =
      currentType &&
      resolveRuntimeUnionFrame(originalName, currentType, context);
    const runtimeMatchIndices =
      runtimeUnionFrame && inferredRhsType
        ? findRuntimeUnionInstanceofMemberIndices(
            runtimeUnionFrame.members,
            inferredRhsType,
            context
          )
        : undefined;
    const runtimeMatchIndex = runtimeMatchIndices?.[0];
    const memberN =
      runtimeUnionFrame && runtimeMatchIndex !== undefined
        ? (runtimeUnionFrame.candidateMemberNs[runtimeMatchIndex] ??
          runtimeMatchIndex + 1)
        : undefined;

    return {
      originalName,
      receiverAst: lhsAst,
      targetType: inferredRhsType,
      memberN,
      candidateMemberNs: runtimeUnionFrame?.candidateMemberNs,
      candidateMembers: runtimeUnionFrame?.members,
      currentType,
      contextAfter: ctxAfterLhs,
    };
  })();
  if (!guard) {
    return undefined;
  }

  if (branch === "falsy") {
    if (
      guard.memberN === undefined ||
      !guard.candidateMemberNs ||
      !guard.candidateMembers ||
      !guard.currentType
    ) {
      return undefined;
    }

    const complementBinding = buildRuntimeUnionComplementBinding(
      guard.receiverAst,
      {
        members: guard.candidateMembers,
        candidateMemberNs: guard.candidateMemberNs,
        runtimeUnionArity:
          guard.candidateMembers.length || guard.candidateMemberNs.length,
      },
      guard.currentType,
      buildSubsetUnionType(
        guard.candidateMembers.filter((_, index) => {
          const candidateMemberN =
            guard.candidateMemberNs?.[index] ?? index + 1;
          return candidateMemberN !== guard.memberN;
        })
      ) ?? { kind: "unknownType" },
      guard.memberN,
      guard.contextAfter
    );
    if (!complementBinding) {
      return undefined;
    }
    return applyBinding(
      guard.originalName,
      complementBinding,
      guard.contextAfter
    );
  }

  if (!guard.targetType) {
    return undefined;
  }

  let exprAst: CSharpExpressionAst;
  if (guard.memberN !== undefined) {
    exprAst = buildUnionNarrowAst(guard.receiverAst, guard.memberN);
  } else {
    const [targetTypeAst] = emitTypeAst(guard.targetType, guard.contextAfter);
    exprAst = {
      kind: "castExpression",
      type: targetTypeAst,
      expression: guard.receiverAst,
    };
  }

  if (guard.memberN !== undefined) {
    const [targetTypeAst] = emitTypeAst(guard.targetType, guard.contextAfter);
    exprAst = {
      kind: "castExpression",
      type: targetTypeAst,
      expression: exprAst,
    };
  }

  return applyBinding(
    guard.originalName,
    buildExprBinding(
      exprAst,
      guard.targetType,
      guard.currentType,
      guard.receiverAst
    ),
    guard.contextAfter
  );
};

const applyPredicateCallRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  if (condition.kind !== "call") {
    return undefined;
  }

  const narrowing = condition.narrowing;
  if (!narrowing || narrowing.kind !== "typePredicate") {
    return undefined;
  }

  const arg = condition.arguments[narrowing.argIndex];
  if (!arg || ("kind" in arg && arg.kind === "spread")) {
    return undefined;
  }

  const target = unwrapTransparentNarrowingTarget(arg);
  if (!target) {
    return undefined;
  }

  const bindingKey =
    target.kind === "identifier"
      ? target.name
      : getMemberAccessNarrowKey(target);
  if (!bindingKey) {
    return undefined;
  }

  const currentType = currentNarrowedType(
    bindingKey,
    target.inferredType ?? arg.inferredType,
    context
  );
  if (!currentType) {
    return undefined;
  }

  const narrowedType =
    branch === "truthy"
      ? narrowing.targetType
      : narrowTypeByNotAssignableTarget(
          currentType,
          narrowing.targetType,
          context
        );
  if (!narrowedType) {
    return undefined;
  }

  const [rawTargetAst, rawTargetContext] = emitExprAst(
    target,
    withoutNarrowedBinding(context, bindingKey)
  );
  const runtimeUnionFrame = resolveRuntimeUnionFrame(
    bindingKey,
    currentType,
    rawTargetContext
  );

  if (runtimeUnionFrame) {
    const matchingIndices = findExactRuntimeUnionMemberIndices(
      runtimeUnionFrame.members,
      narrowing.targetType,
      rawTargetContext
    );
    const singleMatchIndex =
      matchingIndices.length === 1 ? matchingIndices[0] : undefined;
    const selectedMemberN =
      singleMatchIndex !== undefined
        ? (runtimeUnionFrame.candidateMemberNs[singleMatchIndex] ??
          singleMatchIndex + 1)
        : undefined;

    if (selectedMemberN !== undefined) {
      if (branch === "truthy") {
        return applyDirectTypeNarrowing(
          bindingKey,
          target,
          narrowedType,
          context,
          emitExprAst
        );
      }

      const complementBinding = buildRuntimeUnionComplementBinding(
        rawTargetAst,
        runtimeUnionFrame,
        currentType,
        narrowedType,
        selectedMemberN,
        rawTargetContext
      );
      if (complementBinding) {
        return applyBinding(bindingKey, complementBinding, rawTargetContext);
      }
    }
  }

  return applyDirectTypeNarrowing(
    bindingKey,
    target,
    narrowedType,
    context,
    emitExprAst
  );
};

export const applyConditionBranchNarrowing = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext => {
  if (condition.kind === "unary" && condition.operator === "!") {
    return applyConditionBranchNarrowing(
      condition.expression,
      branch === "truthy" ? "falsy" : "truthy",
      context,
      emitExprAst
    );
  }

  if (condition.kind === "logical") {
    if (condition.operator === "&&") {
      if (branch === "truthy") {
        const leftTruthy = applyConditionBranchNarrowing(
          condition.left,
          "truthy",
          context,
          emitExprAst
        );
        return applyConditionBranchNarrowing(
          condition.right,
          "truthy",
          leftTruthy,
          emitExprAst
        );
      }
      return context;
    }

    if (condition.operator === "||") {
      if (branch === "falsy") {
        const leftFalsy = applyConditionBranchNarrowing(
          condition.left,
          "falsy",
          context,
          emitExprAst
        );
        return applyConditionBranchNarrowing(
          condition.right,
          "falsy",
          leftFalsy,
          emitExprAst
        );
      }
      return context;
    }
  }

  return (
    applyDirectTypeofRefinement(condition, branch, context, emitExprAst) ??
    applySimpleNullableRefinement(condition, branch, context, emitExprAst) ??
    applyPredicateCallRefinement(condition, branch, context, emitExprAst) ??
    applyArrayIsArrayRefinement(condition, branch, context, emitExprAst) ??
    applyInstanceofRefinement(condition, branch, context, emitExprAst) ??
    context
  );
};

export const applyLogicalOperandNarrowing = (
  left: IrExpression,
  operator: "&&" | "||",
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext =>
  applyConditionBranchNarrowing(
    left,
    operator === "&&" ? "truthy" : "falsy",
    context,
    emitExprAst
  );
