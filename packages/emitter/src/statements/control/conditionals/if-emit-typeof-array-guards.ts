/**
 * Array.isArray and typeof guard emission cases for if-statements.
 * Handles Array.isArray guards and typeof guards.
 */

import { IrExpression, IrStatement, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitTypeAst } from "../../../type-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../../core/format/backend-ast/types.js";
import { emitBooleanConditionAst } from "../../../core/semantic/boolean-context.js";
import { applyConditionBranchNarrowing } from "../../../core/semantic/condition-branch-narrowing.js";
import { currentNarrowedType } from "../../../core/semantic/narrowing-builders.js";
import { willCarryAsRuntimeUnion } from "../../../core/semantic/union-semantics.js";
import {
  resolveRuntimeCarrierExpressionAst,
  resolveDirectStorageExpressionType,
  resolveIdentifierRuntimeCarrierType,
} from "../../../expressions/direct-storage-types.js";
import { resolveAlignedRuntimeUnionMembers } from "../../../core/semantic/narrowed-union-resolution.js";
import {
  isDefinitelyTerminating,
  resolveRuntimeUnionFrame,
} from "./guard-analysis.js";
import {
  tryExtractArrayIsArrayGuard,
  tryExtractDirectTypeofGuard,
  narrowTypeByArrayShape,
  isArrayLikeNarrowingCandidate,
} from "./guard-extraction.js";
import {
  buildExprBinding,
  buildAnyIsNCondition,
  buildIsNCondition,
  wrapInBlock,
  withComplementNarrowing,
  withRuntimeUnionMemberNarrowing,
  applyExprFallthroughNarrowing,
  emitExprAstCb,
  withoutNarrowedBinding,
  mergeBranchExitContext,
  mergeBranchContextMeta,
  resetBranchFlowState,
  emitBranchScopedStatementAst,
} from "./branch-context.js";
import {
  resolveRuntimeArrayMemberStorageType,
  SYSTEM_ARRAY_STORAGE_TYPE,
} from "../../../core/semantic/broad-array-storage.js";
import {
  matchesTypeofTag,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../../../core/semantic/type-resolution.js";
import { isBroadObjectSlotType } from "../../../core/semantic/broad-object-types.js";
import { resolveEffectiveExpressionType } from "../../../core/semantic/narrowed-expression-types.js";
import { buildRuntimeUnionLayout } from "../../../core/semantic/runtime-unions.js";
import {
  booleanLiteral,
  nullLiteral,
} from "../../../core/format/backend-ast/builders.js";
import { applyIrBranchNarrowings } from "./ir-branch-narrowings.js";

type IfStatement = Extract<IrStatement, { kind: "ifStatement" }>;
type GuardResult = [readonly CSharpStatementAst[], EmitterContext] | undefined;

const negateConditionAst = (
  expression: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "prefixUnaryExpression",
  operatorToken: "!",
  operand: {
    kind: "parenthesizedExpression",
    expression,
  },
});

const maybeNegateConditionAst = (
  expression: CSharpExpressionAst,
  negate: boolean
): CSharpExpressionAst =>
  negate ? negateConditionAst(expression) : expression;

const buildTypePatternCondition = (
  expression: CSharpExpressionAst,
  type: CSharpTypeAst
): CSharpExpressionAst => ({
  kind: "isExpression",
  expression,
  pattern: {
    kind: "typePattern",
    type,
  },
});

const buildOrCondition = (
  conditions: readonly CSharpExpressionAst[]
): CSharpExpressionAst =>
  conditions.reduce<CSharpExpressionAst | undefined>(
    (current, condition) =>
      current
        ? {
            kind: "parenthesizedExpression",
            expression: {
              kind: "binaryExpression",
              operatorToken: "||",
              left: current,
              right: condition,
            },
          }
        : condition,
    undefined
  ) ?? booleanLiteral(false);

const buildNonUnionTypeofCondition = (
  expression: CSharpExpressionAst,
  tag: string,
  currentType: IrType | undefined,
  context: EmitterContext
): CSharpExpressionAst => {
  if (
    currentType &&
    currentType.kind !== "unionType" &&
    currentType.kind !== "unknownType" &&
    currentType.kind !== "anyType" &&
    currentType.kind !== "objectType" &&
    currentType.kind !== "typeParameterType"
  ) {
    return booleanLiteral(matchesTypeofTag(currentType, tag, context));
  }

  switch (tag) {
    case "string":
      return buildTypePatternCondition(expression, {
        kind: "predefinedType",
        keyword: "string",
      });
    case "boolean":
      return buildTypePatternCondition(expression, {
        kind: "predefinedType",
        keyword: "bool",
      });
    case "number":
      return buildOrCondition([
        buildTypePatternCondition(expression, {
          kind: "predefinedType",
          keyword: "double",
        }),
        buildTypePatternCondition(expression, {
          kind: "predefinedType",
          keyword: "int",
        }),
      ]);
    case "undefined":
      return {
        kind: "binaryExpression",
        operatorToken: "==",
        left: expression,
        right: nullLiteral(),
      };
    case "object":
      return {
        kind: "binaryExpression",
        operatorToken: "!=",
        left: expression,
        right: nullLiteral(),
      };
    default:
      return booleanLiteral(false);
  }
};

const tryEmitDirectTypeofConditionAst = (
  condition: IrExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const guard = tryExtractDirectTypeofGuard(condition);
  if (!guard) {
    return undefined;
  }

  const [targetAst, targetContext] = emitExpressionAst(
    guard.targetExpr,
    withoutNarrowedBinding(context, guard.bindingKey)
  );
  const runtimeFrameContext: EmitterContext = {
    ...targetContext,
    narrowedBindings: context.narrowedBindings,
  };
  const effectiveTargetType =
    resolveEffectiveExpressionType(guard.targetExpr, runtimeFrameContext) ??
    guard.targetExpr.inferredType;
  const currentType =
    context.narrowedBindings?.get(guard.bindingKey)?.type ??
    effectiveTargetType;
  const resolvedCurrentType = currentType
    ? resolveTypeAlias(stripNullish(currentType), runtimeFrameContext)
    : undefined;
  const directStorageType = resolveDirectStorageExpressionType(
    guard.targetExpr,
    targetAst,
    targetContext
  );
  const identifierStorageType =
    guard.targetExpr.kind === "identifier"
      ? targetContext.localValueTypes?.get(guard.targetExpr.name)
      : undefined;
  const storageTypeofCandidate = identifierStorageType ?? directStorageType;
  const storageCanUseRuntimeUnionCarrier =
    !storageTypeofCandidate ||
    willCarryAsRuntimeUnion(storageTypeofCandidate, targetContext);
  const runtimeCarrierType =
    (guard.targetExpr.kind === "identifier"
      ? resolveIdentifierRuntimeCarrierType(guard.targetExpr, targetContext)
      : undefined) ?? directStorageType;
  const directStorageIsBroad =
    storageTypeofCandidate !== undefined &&
    !storageCanUseRuntimeUnionCarrier &&
    isBroadObjectSlotType(storageTypeofCandidate, targetContext);
  const alignedRuntimeMembers =
    !directStorageIsBroad &&
    guard.bindingKey !== undefined &&
    currentType !== undefined
      ? resolveAlignedRuntimeUnionMembers(
          guard.bindingKey,
          currentType,
          runtimeCarrierType,
          runtimeFrameContext
        )
      : undefined;
  const runtimeUnionFrame =
    !directStorageIsBroad &&
    storageCanUseRuntimeUnionCarrier &&
    alignedRuntimeMembers === undefined &&
    currentType !== undefined
      ? resolveRuntimeUnionFrame(
          guard.bindingKey,
          currentType,
          runtimeFrameContext
        )
      : undefined;

  const matchingRuntimeMemberNs =
    alignedRuntimeMembers?.members.flatMap((member, index) => {
      if (
        !member ||
        !matchesTypeofTag(member, guard.tag, runtimeFrameContext)
      ) {
        return [];
      }
      const runtimeMemberN = alignedRuntimeMembers.candidateMemberNs[index];
      return runtimeMemberN ? [runtimeMemberN] : [];
    }) ??
    runtimeUnionFrame?.members.flatMap((member, index) => {
      if (
        !member ||
        !matchesTypeofTag(member, guard.tag, runtimeFrameContext)
      ) {
        return [];
      }
      const runtimeMemberN = runtimeUnionFrame.candidateMemberNs[index];
      return runtimeMemberN ? [runtimeMemberN] : [];
    }) ??
    [];
  const guardRuntimeNullish =
    (runtimeUnionFrame !== undefined || alignedRuntimeMembers !== undefined) &&
    (currentType
      ? (splitRuntimeNullishUnionMembers(currentType)?.hasRuntimeNullish ??
        false)
      : false);

  const positiveCondition =
    (runtimeUnionFrame ?? alignedRuntimeMembers) &&
    matchingRuntimeMemberNs.length > 0
      ? buildAnyIsNCondition(
          resolveRuntimeCarrierExpressionAst(
            guard.targetExpr,
            runtimeFrameContext
          ) ?? targetAst,
          matchingRuntimeMemberNs,
          false,
          guardRuntimeNullish
        )
      : buildNonUnionTypeofCondition(
          targetAst,
          guard.tag,
          directStorageIsBroad
            ? undefined
            : (resolvedCurrentType ?? currentType),
          targetContext
        );

  return [
    maybeNegateConditionAst(positiveCondition, !guard.matchesInTruthyBranch),
    targetContext,
  ];
};

const emitTypeofAwareBooleanConditionAst = (
  condition: IrExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const direct = tryEmitDirectTypeofConditionAst(condition, context);
  if (direct) {
    return direct;
  }

  if (condition.kind === "unary" && condition.operator === "!") {
    const [innerAst, innerContext] = emitTypeofAwareBooleanConditionAst(
      condition.expression,
      context
    );
    return [negateConditionAst(innerAst), innerContext];
  }

  if (
    condition.kind === "logical" &&
    (condition.operator === "&&" || condition.operator === "||")
  ) {
    const [leftAst, leftContext] = emitTypeofAwareBooleanConditionAst(
      condition.left,
      context
    );
    const rightBaseContext = applyConditionBranchNarrowing(
      condition.left,
      condition.operator === "&&" ? "truthy" : "falsy",
      leftContext,
      emitExprAstCb
    );
    const [rightAst, rightContext] = emitTypeofAwareBooleanConditionAst(
      condition.right,
      rightBaseContext
    );
    return [
      {
        kind: "binaryExpression",
        operatorToken: condition.operator,
        left: leftAst,
        right: rightAst,
      },
      {
        ...rightContext,
        localNameMap: context.localNameMap,
        conditionAliases: context.conditionAliases,
        localSemanticTypes: context.localSemanticTypes,
        localValueTypes: context.localValueTypes,
        tempVarId: Math.max(
          context.tempVarId ?? 0,
          leftContext.tempVarId ?? 0,
          rightContext.tempVarId ?? 0
        ),
        usings: new Set([
          ...(context.usings ?? []),
          ...(leftContext.usings ?? []),
          ...(rightContext.usings ?? []),
        ]),
        usedLocalNames: new Set([
          ...(context.usedLocalNames ?? []),
          ...(leftContext.usedLocalNames ?? []),
          ...(rightContext.usedLocalNames ?? []),
        ]),
        narrowedBindings: leftContext.narrowedBindings,
      },
    ];
  }

  return emitBooleanConditionAst(condition, emitExprAstCb, context);
};

const hasTypeofGuardCondition = (condition: IrExpression): boolean => {
  if (tryExtractDirectTypeofGuard(condition)) {
    return true;
  }

  if (condition.kind === "unary" && condition.operator === "!") {
    return hasTypeofGuardCondition(condition.expression);
  }

  if (
    condition.kind === "logical" &&
    (condition.operator === "&&" || condition.operator === "||")
  ) {
    return (
      hasTypeofGuardCondition(condition.left) ||
      hasTypeofGuardCondition(condition.right)
    );
  }

  return false;
};

/**
 * Array.isArray guard emission.
 * Handles `if (Array.isArray(x)) { ... }` and `if (!Array.isArray(x)) { ... }`.
 */
export const tryEmitArrayIsArrayGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const arrayIsArrayGuard = tryExtractArrayIsArrayGuard(stmt.condition);
  if (!arrayIsArrayGuard) return undefined;

  const [emittedTargetAst, condCtxAfterCond] = emitExpressionAst(
    arrayIsArrayGuard.targetExpr,
    context
  );
  const effectiveTargetType = currentNarrowedType(
    arrayIsArrayGuard.originalName,
    arrayIsArrayGuard.targetExpr.inferredType,
    condCtxAfterCond
  );
  const identifierCarrierStorageType =
    arrayIsArrayGuard.targetExpr.kind === "identifier"
      ? resolveIdentifierRuntimeCarrierType(
          arrayIsArrayGuard.targetExpr,
          condCtxAfterCond
        )
      : undefined;
  const directStorageType =
    arrayIsArrayGuard.targetExpr.kind === "identifier"
      ? (condCtxAfterCond.localValueTypes?.get(
          arrayIsArrayGuard.targetExpr.name
        ) ?? identifierCarrierStorageType)
      : resolveDirectStorageExpressionType(
          arrayIsArrayGuard.targetExpr,
          emittedTargetAst,
          condCtxAfterCond
        );
  const runtimeCarrierAst =
    (identifierCarrierStorageType &&
    willCarryAsRuntimeUnion(identifierCarrierStorageType, condCtxAfterCond)
      ? resolveRuntimeCarrierExpressionAst(
          arrayIsArrayGuard.targetExpr,
          condCtxAfterCond
        )
      : undefined) ??
    (directStorageType
      ? resolveRuntimeCarrierExpressionAst(
          arrayIsArrayGuard.targetExpr,
          condCtxAfterCond
        )
      : undefined) ??
    emittedTargetAst;
  const runtimeCarrierType =
    identifierCarrierStorageType &&
    willCarryAsRuntimeUnion(identifierCarrierStorageType, condCtxAfterCond)
      ? identifierCarrierStorageType
      : directStorageType
        ? willCarryAsRuntimeUnion(directStorageType, condCtxAfterCond)
          ? directStorageType
          : undefined
        : effectiveTargetType &&
            willCarryAsRuntimeUnion(effectiveTargetType, condCtxAfterCond)
          ? effectiveTargetType
          : undefined;
  const semanticRuntimeUnionFrame =
    runtimeCarrierType &&
    resolveRuntimeUnionFrame(
      arrayIsArrayGuard.originalName,
      runtimeCarrierType,
      condCtxAfterCond
    );
  const [runtimeCarrierLayout] = runtimeCarrierType
    ? buildRuntimeUnionLayout(runtimeCarrierType, condCtxAfterCond, emitTypeAst)
    : [undefined, condCtxAfterCond];
  const runtimeUnionFrame =
    semanticRuntimeUnionFrame && runtimeCarrierLayout
      ? (() => {
          const exactMembers: IrType[] = [];
          const exactMemberNs: number[] = [];
          for (const memberN of semanticRuntimeUnionFrame.candidateMemberNs) {
            const member = runtimeCarrierLayout.members[memberN - 1];
            if (!member) {
              return undefined;
            }
            exactMembers.push(member);
            exactMemberNs.push(memberN);
          }
          return {
            members: exactMembers,
            candidateMemberNs: exactMemberNs,
            runtimeUnionArity: runtimeCarrierLayout.runtimeUnionArity,
          };
        })()
      : semanticRuntimeUnionFrame;
  const runtimeArrayPairs =
    runtimeUnionFrame?.members.flatMap((member, index) => {
      if (!member || !isArrayLikeNarrowingCandidate(member, condCtxAfterCond)) {
        return [];
      }
      const runtimeMemberN = runtimeUnionFrame.candidateMemberNs[index];
      if (!runtimeMemberN) {
        return [];
      }
      return [{ memberType: member, runtimeMemberN }];
    }) ?? [];
  const narrowedType = narrowTypeByArrayShape(
    arrayIsArrayGuard.targetExpr.inferredType,
    arrayIsArrayGuard.narrowsInThen,
    condCtxAfterCond
  );

  if (!narrowedType) return undefined;

  const runtimeArrayPair =
    runtimeArrayPairs.length === 1 ? runtimeArrayPairs[0] : undefined;

  if (
    runtimeUnionFrame &&
    runtimeArrayPair &&
    runtimeUnionFrame.runtimeUnionArity >= 2
  ) {
    const [, condCtxAfterCondAst] = emitBooleanConditionAst(
      stmt.condition,
      emitExprAstCb,
      condCtxAfterCond
    );

    const arrayBranchContext = withRuntimeUnionMemberNarrowing(
      arrayIsArrayGuard.originalName,
      runtimeCarrierAst,
      runtimeArrayPair.runtimeMemberN,
      runtimeArrayPair.memberType,
      runtimeCarrierType,
      condCtxAfterCondAst,
      resolveRuntimeArrayMemberStorageType(
        runtimeArrayPair.memberType,
        condCtxAfterCondAst
      )
    );
    const nonArrayBranchContext = withComplementNarrowing(
      arrayIsArrayGuard.originalName,
      runtimeCarrierAst,
      runtimeUnionFrame.runtimeUnionArity,
      runtimeUnionFrame.candidateMemberNs,
      runtimeUnionFrame.members,
      runtimeArrayPair.runtimeMemberN,
      condCtxAfterCondAst
    );

    const thenCtx =
      arrayIsArrayGuard.narrowsInThen &&
      runtimeUnionFrame.runtimeUnionArity >= 2
        ? arrayBranchContext
        : nonArrayBranchContext;
    const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(
      stmt.thenStatement,
      thenCtx
    );
    const thenStatementAst = wrapInBlock(thenStmts);
    const thenTerminates = isDefinitelyTerminating(stmt.thenStatement);
    const basePostConditionContext = resetBranchFlowState(
      condCtxAfterCondAst,
      thenCtxAfter
    );
    const fallthroughContext: EmitterContext = arrayIsArrayGuard.narrowsInThen
      ? nonArrayBranchContext
      : arrayBranchContext;
    let finalContext: EmitterContext = thenTerminates
      ? mergeBranchContextMeta(fallthroughContext, thenCtxAfter)
      : mergeBranchExitContext(
          condCtxAfterCondAst,
          thenCtxAfter,
          fallthroughContext
        );

    let elseStmt: CSharpStatementAst | undefined;
    if (stmt.elseStatement) {
      const elseCtx: EmitterContext = {
        ...(arrayIsArrayGuard.narrowsInThen
          ? nonArrayBranchContext
          : arrayBranchContext),
        tempVarId: basePostConditionContext.tempVarId,
        usings: basePostConditionContext.usings,
        usedLocalNames: basePostConditionContext.usedLocalNames,
      };
      const [elseStmts, elseCtxAfter] = emitBranchScopedStatementAst(
        stmt.elseStatement,
        elseCtx
      );
      elseStmt = wrapInBlock(elseStmts);
      const elseTerminates = isDefinitelyTerminating(stmt.elseStatement);

      if (thenTerminates && !elseTerminates) {
        finalContext = mergeBranchContextMeta(elseCtxAfter, thenCtxAfter);
      } else if (!thenTerminates && elseTerminates) {
        finalContext = mergeBranchContextMeta(thenCtxAfter, elseCtxAfter);
      } else {
        finalContext = mergeBranchExitContext(
          condCtxAfterCondAst,
          thenCtxAfter,
          elseCtxAfter
        );
      }
    }

    const runtimeCondAst = buildIsNCondition(
      runtimeCarrierAst,
      runtimeArrayPair.runtimeMemberN,
      !arrayIsArrayGuard.narrowsInThen
    );
    return [
      [
        {
          kind: "ifStatement",
          condition: runtimeCondAst,
          thenStatement: thenStatementAst,
          elseStatement: elseStmt,
        },
      ],
      finalContext,
    ];
  }

  const narrowedMap = new Map(condCtxAfterCond.narrowedBindings ?? []);
  const [narrowedTypeAst, narrowedTypeCtx] = emitTypeAst(
    narrowedType,
    condCtxAfterCond
  );
  narrowedMap.set(
    arrayIsArrayGuard.originalName,
    buildExprBinding(
      {
        kind: "castExpression",
        type: narrowedTypeAst,
        expression: emittedTargetAst,
      },
      narrowedType,
      undefined,
      emittedTargetAst,
      SYSTEM_ARRAY_STORAGE_TYPE
    )
  );

  const [condAst, condCtxAfterCondAst] = emitBooleanConditionAst(
    stmt.condition,
    emitExprAstCb,
    condCtxAfterCond
  );

  const thenBaseCtx: EmitterContext = {
    ...narrowedTypeCtx,
    ...condCtxAfterCondAst,
    narrowedBindings: arrayIsArrayGuard.narrowsInThen
      ? narrowedMap
      : condCtxAfterCond.narrowedBindings,
  };
  const thenCtx = thenBaseCtx;
  const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(
    stmt.thenStatement,
    thenCtx
  );
  const thenStatementAst = wrapInBlock(thenStmts);
  const thenTerminates = isDefinitelyTerminating(stmt.thenStatement);
  const basePostConditionContext = resetBranchFlowState(
    condCtxAfterCond,
    thenCtxAfter
  );
  const elseBaseCtx: EmitterContext = {
    ...basePostConditionContext,
    narrowedBindings: arrayIsArrayGuard.narrowsInThen
      ? condCtxAfterCond.narrowedBindings
      : narrowedMap,
  };
  const fallthroughContext = elseBaseCtx;

  let finalContext: EmitterContext = thenTerminates
    ? fallthroughContext
    : mergeBranchExitContext(
        condCtxAfterCond,
        thenCtxAfter,
        fallthroughContext
      );

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseCtx = elseBaseCtx;
    const [elseStmts, elseCtxAfter] = emitBranchScopedStatementAst(
      stmt.elseStatement,
      elseCtx
    );
    elseStmt = wrapInBlock(elseStmts);
    const elseTerminates = isDefinitelyTerminating(stmt.elseStatement);

    if (thenTerminates && !elseTerminates) {
      finalContext = mergeBranchContextMeta(elseCtxAfter, thenCtxAfter);
    } else if (!thenTerminates && elseTerminates) {
      finalContext = mergeBranchContextMeta(thenCtxAfter, elseCtxAfter);
    } else {
      finalContext = mergeBranchExitContext(
        condCtxAfterCond,
        thenCtxAfter,
        elseCtxAfter
      );
    }
  }

  if (!stmt.elseStatement && thenTerminates) {
    const complementType = narrowTypeByArrayShape(
      arrayIsArrayGuard.targetExpr.inferredType,
      !arrayIsArrayGuard.narrowsInThen,
      condCtxAfterCond
    );
    if (complementType) {
      finalContext = applyExprFallthroughNarrowing(
        arrayIsArrayGuard.originalName,
        emittedTargetAst,
        complementType,
        condCtxAfterCond,
        finalContext,
        SYSTEM_ARRAY_STORAGE_TYPE
      );
    }
  }

  return [
    [
      {
        kind: "ifStatement",
        condition: condAst,
        thenStatement: thenStatementAst,
        elseStatement: elseStmt,
      },
    ],
    finalContext,
  ];
};

/**
 * Case E: typeof narrowing on plain locals/parameters, including
 * compound `&&` truthy branches and `||` fallthrough/else branches.
 */
export const tryEmitTypeofGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  if (!hasTypeofGuardCondition(stmt.condition)) {
    return undefined;
  }

  const [condAst, condCtxAfterCond] = emitTypeofAwareBooleanConditionAst(
    stmt.condition,
    context
  );
  const preservedNarrowedBindings = context.narrowedBindings;
  const semanticCondContext: EmitterContext = {
    ...condCtxAfterCond,
    narrowedBindings: preservedNarrowedBindings,
  };

  const thenSemanticContext = applyConditionBranchNarrowing(
    stmt.condition,
    "truthy",
    semanticCondContext,
    emitExprAstCb
  );
  const thenCtx = applyIrBranchNarrowings(
    thenSemanticContext,
    stmt.thenPlan.narrowedBindings,
    emitExprAstCb
  );
  const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(
    stmt.thenStatement,
    thenCtx
  );
  const thenTerminates = isDefinitelyTerminating(stmt.thenStatement);
  const basePostConditionContext = resetBranchFlowState(
    semanticCondContext,
    thenCtxAfter
  );
  const elseBaseContext: EmitterContext = {
    ...semanticCondContext,
    tempVarId: basePostConditionContext.tempVarId,
    usings: basePostConditionContext.usings,
    usedLocalNames: basePostConditionContext.usedLocalNames,
    narrowedBindings: preservedNarrowedBindings,
  };
  const falsySemanticContext = applyConditionBranchNarrowing(
    stmt.condition,
    "falsy",
    elseBaseContext,
    emitExprAstCb
  );
  const falsyFallthroughContext = applyIrBranchNarrowings(
    falsySemanticContext,
    stmt.elsePlan.narrowedBindings,
    emitExprAstCb
  );
  let finalContext: EmitterContext = thenTerminates
    ? falsyFallthroughContext
    : mergeBranchExitContext(
        semanticCondContext,
        thenCtxAfter,
        falsyFallthroughContext
      );

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseSemanticContext = applyConditionBranchNarrowing(
      stmt.condition,
      "falsy",
      elseBaseContext,
      emitExprAstCb
    );
    const elseCtx = applyIrBranchNarrowings(
      elseSemanticContext,
      stmt.elsePlan.narrowedBindings,
      emitExprAstCb
    );
    const [elseStmts, elseCtxAfter] = emitBranchScopedStatementAst(
      stmt.elseStatement,
      elseCtx
    );
    elseStmt = wrapInBlock(elseStmts);
    const elseTerminates = isDefinitelyTerminating(stmt.elseStatement);

    if (thenTerminates && !elseTerminates) {
      finalContext = mergeBranchContextMeta(elseCtxAfter, thenCtxAfter);
    } else if (!thenTerminates && elseTerminates) {
      finalContext = mergeBranchContextMeta(thenCtxAfter, elseCtxAfter);
    } else {
      finalContext = mergeBranchExitContext(
        semanticCondContext,
        thenCtxAfter,
        elseCtxAfter
      );
    }
  }

  if (
    !stmt.elseStatement &&
    thenTerminates &&
    stmt.elsePlan.narrowedBindings.length > 0
  ) {
    const postElseBaseContext: EmitterContext = {
      ...semanticCondContext,
      tempVarId: finalContext.tempVarId,
      usings: finalContext.usings,
      usedLocalNames: finalContext.usedLocalNames,
      narrowedBindings: preservedNarrowedBindings,
    };
    const postElseSemanticContext = applyConditionBranchNarrowing(
      stmt.condition,
      "falsy",
      postElseBaseContext,
      emitExprAstCb
    );
    finalContext = applyIrBranchNarrowings(
      postElseSemanticContext,
      stmt.elsePlan.narrowedBindings,
      emitExprAstCb
    );
  }

  return [
    [
      {
        kind: "ifStatement",
        condition: condAst,
        thenStatement: wrapInBlock(thenStmts),
        elseStatement: elseStmt,
      },
    ],
    finalContext,
  ];
};
