/**
 * Array.isArray and typeof guard emission cases for if-statements.
 * Handles Array.isArray guards and typeof guards.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitTypeAst } from "../../../type-emitter.js";
import type { CSharpStatementAst } from "../../../core/format/backend-ast/types.js";
import { emitBooleanConditionAst } from "../../../core/semantic/boolean-context.js";
import { applyConditionBranchNarrowing } from "../../../core/semantic/condition-branch-narrowing.js";
import { currentNarrowedType } from "../../../core/semantic/narrowing-builders.js";
import { willCarryAsRuntimeUnion } from "../../../core/semantic/union-semantics.js";
import {
  resolveRuntimeCarrierExpressionAst,
  resolveDirectStorageExpressionType,
  resolveIdentifierRuntimeCarrierType,
} from "../../../expressions/direct-storage-types.js";
import {
  isDefinitelyTerminating,
  resolveRuntimeUnionFrame,
} from "./guard-analysis.js";
import {
  tryExtractArrayIsArrayGuard,
  collectTypeofGuardRefinements,
  narrowTypeByArrayShape,
  isArrayLikeNarrowingCandidate,
} from "./guard-extraction.js";
import {
  buildExprBinding,
  buildIsNCondition,
  wrapInBlock,
  withComplementNarrowing,
  withRuntimeUnionMemberNarrowing,
  applyExprFallthroughNarrowing,
  emitExprAstCb,
  mergeBranchExitContext,
  mergeBranchContextMeta,
  resetBranchFlowState,
  emitBranchScopedStatementAst,
} from "./branch-context.js";
import {
  resolveRuntimeArrayMemberStorageType,
  SYSTEM_ARRAY_STORAGE_TYPE,
} from "../../../core/semantic/broad-array-storage.js";
import { registerLocalSymbolTypes } from "../../../core/format/local-names.js";

type IfStatement = Extract<IrStatement, { kind: "ifStatement" }>;
type GuardResult = [readonly CSharpStatementAst[], EmitterContext] | undefined;

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
    ((identifierCarrierStorageType &&
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
      : undefined)) ?? emittedTargetAst;
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
  const runtimeUnionFrame =
    runtimeCarrierType &&
    resolveRuntimeUnionFrame(
      arrayIsArrayGuard.originalName,
      runtimeCarrierType,
      condCtxAfterCond
    );
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
  const thenCtx = arrayIsArrayGuard.narrowsInThen
    ? registerLocalSymbolTypes(
        arrayIsArrayGuard.originalName,
        narrowedType,
        SYSTEM_ARRAY_STORAGE_TYPE,
        thenBaseCtx
      )
    : thenBaseCtx;
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
  const fallthroughContext = !arrayIsArrayGuard.narrowsInThen
    ? registerLocalSymbolTypes(
        arrayIsArrayGuard.originalName,
        narrowedType,
        SYSTEM_ARRAY_STORAGE_TYPE,
        elseBaseCtx
      )
    : elseBaseCtx;

  let finalContext: EmitterContext = thenTerminates
    ? fallthroughContext
    : mergeBranchExitContext(condCtxAfterCond, thenCtxAfter, fallthroughContext);

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseCtx = !arrayIsArrayGuard.narrowsInThen
      ? registerLocalSymbolTypes(
          arrayIsArrayGuard.originalName,
          narrowedType,
          SYSTEM_ARRAY_STORAGE_TYPE,
          elseBaseCtx
        )
      : elseBaseCtx;
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
      finalContext = registerLocalSymbolTypes(
        arrayIsArrayGuard.originalName,
        complementType,
        SYSTEM_ARRAY_STORAGE_TYPE,
        finalContext
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
  const truthyTypeofRefinements = collectTypeofGuardRefinements(
    stmt.condition,
    "truthy"
  );
  const falsyTypeofRefinements = collectTypeofGuardRefinements(
    stmt.condition,
    "falsy"
  );
  if (
    truthyTypeofRefinements.length === 0 &&
    falsyTypeofRefinements.length === 0
  ) {
    return undefined;
  }

  const [condAst, condCtxAfterCond] = emitBooleanConditionAst(
    stmt.condition,
    emitExprAstCb,
    context
  );
  const preservedNarrowedBindings = context.narrowedBindings;
  const semanticCondContext: EmitterContext = {
    ...condCtxAfterCond,
    narrowedBindings: preservedNarrowedBindings,
  };

  const thenCtx =
    truthyTypeofRefinements.length > 0
      ? applyConditionBranchNarrowing(
          stmt.condition,
          "truthy",
          semanticCondContext,
          emitExprAstCb
        )
      : semanticCondContext;
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
  const falsyFallthroughContext =
    falsyTypeofRefinements.length > 0
      ? applyConditionBranchNarrowing(
          stmt.condition,
          "falsy",
          elseBaseContext,
          emitExprAstCb
        ) ?? elseBaseContext
      : elseBaseContext;
  let finalContext: EmitterContext = thenTerminates
    ? falsyFallthroughContext
    : mergeBranchExitContext(
        semanticCondContext,
        thenCtxAfter,
        falsyFallthroughContext
      );

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseCtx =
      falsyTypeofRefinements.length > 0
        ? applyConditionBranchNarrowing(
            stmt.condition,
            "falsy",
            elseBaseContext,
            emitExprAstCb
          )
        : elseBaseContext;
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

  if (!stmt.elseStatement && thenTerminates && falsyTypeofRefinements.length > 0) {
    finalContext = applyConditionBranchNarrowing(
      stmt.condition,
      "falsy",
      {
        ...semanticCondContext,
        tempVarId: finalContext.tempVarId,
        usings: finalContext.usings,
        usedLocalNames: finalContext.usedLocalNames,
        narrowedBindings: preservedNarrowedBindings,
      },
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
