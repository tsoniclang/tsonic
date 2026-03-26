/**
 * Guard extraction and typeof refinement helpers for if-statement emission.
 */

import {
  IrExpression,
  IrStatement,
  IrType,
  normalizedUnionType,
} from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitTypeAst } from "../../../type-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
  narrowTypeByTypeofTag,
  narrowTypeByNotTypeofTag,
  matchesTypeofTag,
} from "../../../core/semantic/type-resolution.js";
import { isAssignable } from "../../../core/semantic/index.js";
import { unwrapTransparentNarrowingTarget } from "../../../core/semantic/transparent-expressions.js";
import { getMemberAccessNarrowKey } from "../../../core/semantic/narrowing-keys.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { resolveRuntimeUnionFrame } from "./guard-analysis.js";
import {
  buildExprBinding,
  buildUnionNarrowAst,
  withoutNarrowedBinding,
} from "./branch-context.js";
import {
  buildRuntimeUnionComplementBinding,
  buildRuntimeUnionSubsetBinding,
  resolveRuntimeSubsetSourceInfo,
} from "../../../core/semantic/narrowing-builders.js";

export const isArrayLikeNarrowingCandidate = (
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

export const narrowTypeByArrayShape = (
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

  const isArrayLike = isArrayLikeNarrowingCandidate(resolved, context);
  if (wantArray) {
    return isArrayLike ? resolved : undefined;
  }
  return isArrayLike ? undefined : resolved;
};

export const narrowTypeByNotAssignableTarget = (
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
      const resolvedMember = resolveTypeAlias(stripNullish(member), context);
      return !isAssignable(resolvedMember, resolvedTarget);
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return isAssignable(resolvedCurrent, resolvedTarget)
    ? undefined
    : resolvedCurrent;
};

export const tryExtractArrayIsArrayGuard = (
  condition: Extract<IrStatement, { kind: "ifStatement" }>["condition"]
):
  | {
      readonly originalName: string;
      readonly targetExpr: Extract<
        IrExpression,
        { kind: "identifier" | "memberAccess" }
      >;
      readonly narrowsInThen: boolean;
    }
  | undefined => {
  const extractDirect = (
    expr: typeof condition
  ):
    | {
        readonly originalName: string;
        readonly targetExpr: Extract<
          IrExpression,
          { kind: "identifier" | "memberAccess" }
        >;
        readonly narrowsInThen: boolean;
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

    const originalName =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!originalName) return undefined;

    return {
      originalName,
      targetExpr: target,
      narrowsInThen: true,
    };
  };

  const direct = extractDirect(condition);
  if (direct) return direct;

  if (condition.kind === "unary" && condition.operator === "!") {
    const inner = extractDirect(condition.expression);
    if (inner) {
      return {
        ...inner,
        narrowsInThen: false,
      };
    }
  }

  return undefined;
};

export type TypeofGuardRefinement = {
  readonly bindingKey: string;
  readonly targetExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>;
  readonly tag: string;
  readonly matchTag: boolean;
};

const tryExtractDirectTypeofGuard = (
  expr: Extract<IrStatement, { kind: "ifStatement" }>["condition"]
):
  | {
      readonly bindingKey: string;
      readonly targetExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>;
      readonly tag: string;
      readonly matchesInTruthyBranch: boolean;
    }
  | undefined => {
  if (expr.kind !== "binary") return undefined;
  if (
    expr.operator !== "===" &&
    expr.operator !== "==" &&
    expr.operator !== "!==" &&
    expr.operator !== "!="
  ) {
    return undefined;
  }

  const extract = (
    left: typeof expr.left,
    right: typeof expr.right
  ):
    | {
        readonly bindingKey: string;
        readonly targetExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>;
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
    extract(expr.left, expr.right) ?? extract(expr.right, expr.left);
  if (!directGuard) return undefined;

  return {
    ...directGuard,
    matchesInTruthyBranch: expr.operator === "===" || expr.operator === "==",
  };
};

export const collectTypeofGuardRefinements = (
  condition: Extract<IrStatement, { kind: "ifStatement" }>["condition"],
  branch: "truthy" | "falsy"
): readonly TypeofGuardRefinement[] => {
  const direct = tryExtractDirectTypeofGuard(condition);
  if (direct) {
    return [
      {
        bindingKey: direct.bindingKey,
        targetExpr: direct.targetExpr,
        tag: direct.tag,
        matchTag:
          branch === "truthy"
            ? direct.matchesInTruthyBranch
            : !direct.matchesInTruthyBranch,
      },
    ];
  }

  if (condition.kind !== "logical") {
    return [];
  }

  if (branch === "truthy" && condition.operator === "&&") {
    return [
      ...collectTypeofGuardRefinements(condition.left, branch),
      ...collectTypeofGuardRefinements(condition.right, branch),
    ];
  }

  if (branch === "falsy" && condition.operator === "||") {
    return [
      ...collectTypeofGuardRefinements(condition.left, branch),
      ...collectTypeofGuardRefinements(condition.right, branch),
    ];
  }

  return [];
};

export const applyTypeofGuardRefinements = (
  baseContext: EmitterContext,
  refinements: readonly TypeofGuardRefinement[]
): EmitterContext => {
  let currentContext = baseContext;

  for (const refinement of refinements) {
    const currentType =
      currentContext.narrowedBindings?.get(refinement.bindingKey)?.type ??
      refinement.targetExpr.inferredType;
    const narrowedType = refinement.matchTag
      ? narrowTypeByTypeofTag(currentType, refinement.tag, currentContext)
      : narrowTypeByNotTypeofTag(currentType, refinement.tag, currentContext);
    if (!narrowedType) {
      continue;
    }

    const [rawTargetAst, rawTargetContext] = emitExpressionAst(
      refinement.targetExpr,
      withoutNarrowedBinding(currentContext, refinement.bindingKey)
    );

    const runtimeFrameContext = {
      ...rawTargetContext,
      narrowedBindings: currentContext.narrowedBindings,
    };
    const runtimeUnionFrame =
      currentType &&
      resolveRuntimeUnionFrame(
        refinement.bindingKey,
        currentType,
        runtimeFrameContext
      );
    const matchingRuntimeMemberIndex =
      runtimeUnionFrame?.members.findIndex((member) =>
        matchesTypeofTag(member, refinement.tag, rawTargetContext)
      ) ?? -1;

    const nextBindings = new Map(rawTargetContext.narrowedBindings ?? []);

    if (
      runtimeUnionFrame &&
      matchingRuntimeMemberIndex >= 0 &&
      runtimeUnionFrame.members.filter((member) =>
        matchesTypeofTag(member, refinement.tag, rawTargetContext)
      ).length === 1
    ) {
      const memberN =
        runtimeUnionFrame.candidateMemberNs[matchingRuntimeMemberIndex] ??
        matchingRuntimeMemberIndex + 1;
      const memberType =
        runtimeUnionFrame.members[matchingRuntimeMemberIndex] ?? narrowedType;

      if (refinement.matchTag) {
        const existingBinding = currentContext.narrowedBindings?.get(
          refinement.bindingKey
        );
        const subsetBinding = buildRuntimeUnionSubsetBinding(
          rawTargetAst,
          runtimeUnionFrame,
          existingBinding?.sourceType ??
            existingBinding?.type ??
            currentType ??
            narrowedType,
          narrowedType,
          rawTargetContext
        );
        if (subsetBinding) {
          const [binding, subsetContext] = subsetBinding;
          nextBindings.set(refinement.bindingKey, binding);
          currentContext = {
            ...subsetContext,
            narrowedBindings: nextBindings,
          };
          continue;
        }

        nextBindings.set(
          refinement.bindingKey,
          buildExprBinding(
            buildUnionNarrowAst(rawTargetAst, memberN),
            memberType,
            currentType,
            rawTargetAst
          )
        );
        currentContext = {
          ...rawTargetContext,
          narrowedBindings: nextBindings,
        };
        continue;
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
              refinement.bindingKey,
              currentType,
              runtimeUnionFrame,
              currentContext
            )
          : undefined
      );
      if (complementBinding) {
        nextBindings.set(refinement.bindingKey, complementBinding);
        currentContext = {
          ...rawTargetContext,
          narrowedBindings: nextBindings,
        };
        continue;
      }
    }

    const [narrowedTypeAst, nextContext] = emitTypeAst(
      narrowedType,
      rawTargetContext
    );
    nextBindings.set(
      refinement.bindingKey,
      buildExprBinding(
        {
          kind: "castExpression",
          type: narrowedTypeAst,
          expression: rawTargetAst,
        },
        narrowedType,
        currentType,
        rawTargetAst
      )
    );
    currentContext = {
      ...nextContext,
      narrowedBindings: nextBindings,
    };
  }

  return currentContext;
};
