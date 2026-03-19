import { IrExpression } from "@tsonic/frontend";
import type { EmitterContext, NarrowedBinding } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import {
  matchesTypeofTag,
  narrowTypeByNotTypeofTag,
  narrowTypeByTypeofTag,
  stripNullish,
  isDefinitelyValueType,
} from "./type-resolution.js";
import { stableIrTypeKey } from "@tsonic/frontend";
import {
  findRuntimeUnionInstanceofMemberIndices,
  findRuntimeUnionMemberIndices,
} from "./runtime-unions.js";
import { normalizeInstanceofTargetType } from "./instanceof-targets.js";
import { unwrapTransparentNarrowingTarget } from "./transparent-expressions.js";
import {
  type BranchTruthiness,
  type EmitExprAstFn,
  buildUnionNarrowAst,
  buildSubsetUnionType,
  withoutNarrowedBinding,
  applyBinding,
  buildExprBinding,
  tryStripConditionalNullishGuardAst,
  narrowTypeByArrayShape,
  isArrayLikeNarrowingCandidate,
  narrowTypeByNotAssignableTarget,
  currentNarrowedType,
  resolveRuntimeUnionFrame,
  isNullOrUndefined,
  buildRuntimeUnionComplementBinding,
  applyDirectTypeNarrowing,
} from "./narrowing-builders.js";

export const applySimpleNullableRefinement = (
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

export const applyDirectTypeofRefinement = (
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

export const applyArrayIsArrayRefinement = (
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

export const applyInstanceofRefinement = (
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

export const applyPredicateCallRefinement = (
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
    const matchingIndices = findRuntimeUnionMemberIndices(
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

    // Multi-slot predicate targets: a semantic alias (e.g., PathSpec)
    // may map to multiple runtime carrier slots after alias expansion.
    // Build runtimeSubset bindings so that both branches carry correct
    // runtime-slot knowledge.
    if (matchingIndices.length > 1) {
      const matchedMemberNs = matchingIndices
        .map((index) => runtimeUnionFrame.candidateMemberNs[index] ?? index + 1)
        .filter((n): n is number => n !== undefined);
      const complementMemberNs = runtimeUnionFrame.candidateMemberNs.filter(
        (memberN) => !matchedMemberNs.includes(memberN)
      );

      if (branch === "truthy" && matchedMemberNs.length > 0) {
        const subsetBinding: NarrowedBinding = {
          kind: "runtimeSubset",
          runtimeMemberNs: matchedMemberNs,
          runtimeUnionArity: runtimeUnionFrame.runtimeUnionArity,
          sourceMembers: [...runtimeUnionFrame.members],
          sourceCandidateMemberNs: [...runtimeUnionFrame.candidateMemberNs],
          type: narrowedType,
          sourceType: currentType,
        };
        return applyBinding(bindingKey, subsetBinding, rawTargetContext);
      }

      if (branch === "falsy" && complementMemberNs.length > 0) {
        const complementBinding: NarrowedBinding = {
          kind: "runtimeSubset",
          runtimeMemberNs: complementMemberNs,
          runtimeUnionArity: runtimeUnionFrame.runtimeUnionArity,
          sourceMembers: [...runtimeUnionFrame.members],
          sourceCandidateMemberNs: [...runtimeUnionFrame.candidateMemberNs],
          type: narrowedType,
          sourceType: currentType,
        };
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
