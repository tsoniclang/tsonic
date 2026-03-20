/**
 * Nullable and typeof narrowing refinements.
 * Handles applySimpleNullableRefinement, applyDirectTypeofRefinement,
 * and applyArrayIsArrayRefinement.
 */

import { IrExpression } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { stableIrTypeKey } from "@tsonic/frontend";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import {
  matchesTypeofTag,
  narrowTypeByTypeofTag,
  narrowTypeByNotTypeofTag,
  stripNullish,
  isDefinitelyValueType,
} from "./type-resolution.js";
import { unwrapTransparentNarrowingTarget } from "./transparent-expressions.js";
import {
  type BranchTruthiness,
  type EmitExprAstFn,
  buildUnionNarrowAst,
  withoutNarrowedBinding,
  applyBinding,
  buildExprBinding,
  tryStripConditionalNullishGuardAst,
  narrowTypeByArrayShape,
  isArrayLikeNarrowingCandidate,
  currentNarrowedType,
  resolveRuntimeUnionFrame,
  resolveRuntimeSubsetSourceInfo,
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
      rawTargetContext,
      currentType
        ? resolveRuntimeSubsetSourceInfo(
            directGuard.bindingKey,
            currentType,
            runtimeUnionFrame,
            context
          )
        : undefined
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
      rawTargetContext,
      resolveRuntimeSubsetSourceInfo(
        direct.bindingKey,
        currentType,
        runtimeUnionFrame,
        context
      )
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
