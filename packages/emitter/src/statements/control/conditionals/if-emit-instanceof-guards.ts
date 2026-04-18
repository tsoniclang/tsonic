/**
 * Instanceof and nullable guard emission cases for if-statements.
 * Handles instanceof, negated-instanceof, and nullable guards.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitIdentifier } from "../../../expressions/identifiers.js";
import type { CSharpStatementAst } from "../../../core/format/backend-ast/types.js";
import { emitBooleanConditionAst } from "../../../core/semantic/boolean-context.js";
import { applyConditionBranchNarrowing } from "../../../core/semantic/condition-branch-narrowing.js";
import { resolveEffectiveExpressionType } from "../../../core/semantic/narrowed-expression-types.js";
import {
  tryResolveInstanceofGuard,
  tryResolveSimpleNullableGuard,
  tryResolveNullableGuard,
  isDefinitelyTerminating,
  resolveRuntimeUnionFrame,
} from "./guard-analysis.js";
import { narrowTypeByNotAssignableTarget } from "./guard-extraction.js";
import {
  buildProjectedExprBinding,
  buildIsNCondition,
  buildIsPatternCondition,
  buildUnionNarrowAst,
  buildCastLocalDecl,
  emitForcedBlockWithPreambleAst,
  mergeBranchExitContext,
  mergeBranchContextMeta,
  resetBranchFlowState,
  wrapInBlock,
  withComplementNarrowing,
  applyExprFallthroughNarrowing,
  emitExprAstCb,
  emitBranchScopedStatementAst,
} from "./branch-context.js";

type IfStatement = Extract<IrStatement, { kind: "ifStatement" }>;
type GuardResult = [readonly CSharpStatementAst[], EmitterContext] | undefined;

/**
 * Case A2: if (x instanceof Foo) { ... }
 * C# pattern var narrowing -> if (x is Foo x__is_k) { ... }
 */
export const tryEmitInstanceofGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const instanceofGuard = tryResolveInstanceofGuard(stmt.condition, context);
  if (!instanceofGuard) return undefined;

  const {
    ctxAfterRhs,
    escapedOrig,
    escapedNarrow,
    rhsTypeAst,
    narrowedMap,
    memberN,
    memberNeedsPatternCheck,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    receiverAst,
  } = instanceofGuard;

  const condAst =
    memberN && runtimeUnionArity && candidateMemberNs && candidateMembers
      ? memberNeedsPatternCheck
        ? buildIsPatternCondition(
            buildUnionNarrowAst(receiverAst, memberN),
            rhsTypeAst,
            escapedNarrow
          )
        : buildIsNCondition(receiverAst, memberN, false)
      : buildIsPatternCondition(receiverAst, rhsTypeAst, escapedNarrow);

  let thenStatementAst: CSharpStatementAst;
  let thenCtxAfter: EmitterContext;
  if (
    memberN &&
    runtimeUnionArity &&
    candidateMemberNs &&
    candidateMembers &&
    !memberNeedsPatternCheck
  ) {
    const [thenBlock, thenBlockCtx] = emitForcedBlockWithPreambleAst(
      [buildCastLocalDecl(escapedNarrow, receiverAst, memberN, rhsTypeAst)],
      stmt.thenStatement,
      {
        ...ctxAfterRhs,
        narrowedBindings: narrowedMap,
      }
    );
    thenStatementAst = thenBlock;
    thenCtxAfter = thenBlockCtx;
  } else {
    const [thenStmts, nextCtx] = emitBranchScopedStatementAst(
      stmt.thenStatement,
      {
        ...ctxAfterRhs,
        narrowedBindings: narrowedMap,
      }
    );
    thenStatementAst = wrapInBlock(thenStmts);
    thenCtxAfter = nextCtx;
  }

  const thenTerminates = isDefinitelyTerminating(stmt.thenStatement);
  const basePostConditionContext = resetBranchFlowState(
    ctxAfterRhs,
    thenCtxAfter
  );
  const fallthroughBaseContext: EmitterContext = {
    ...basePostConditionContext,
    narrowedBindings: ctxAfterRhs.narrowedBindings,
  };
  const falsyFallthroughContext =
    applyConditionBranchNarrowing(
      stmt.condition,
      "falsy",
      fallthroughBaseContext,
      emitExprAstCb
    ) ?? fallthroughBaseContext;
  let finalContext: EmitterContext = thenTerminates
    ? falsyFallthroughContext
    : mergeBranchExitContext(
        ctxAfterRhs,
        thenCtxAfter,
        falsyFallthroughContext
      );

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseEntryContext = falsyFallthroughContext;
    const [elseStmts, elseCtx] = emitBranchScopedStatementAst(
      stmt.elseStatement,
      elseEntryContext
    );
    elseStmt = wrapInBlock(elseStmts);
    const elseTerminates = isDefinitelyTerminating(stmt.elseStatement);

    if (thenTerminates && !elseTerminates) {
      finalContext = mergeBranchContextMeta(elseCtx, thenCtxAfter);
    } else if (!thenTerminates && elseTerminates) {
      finalContext = mergeBranchContextMeta(thenCtxAfter, elseCtx);
    } else {
      finalContext = mergeBranchExitContext(ctxAfterRhs, thenCtxAfter, elseCtx);
    }
  }

  if (!stmt.elseStatement && thenTerminates) {
    const fallthroughContext = applyConditionBranchNarrowing(
      stmt.condition,
      "falsy",
      fallthroughBaseContext,
      emitExprAstCb
    );
    if (fallthroughContext) {
      finalContext = fallthroughContext;
    } else {
      const instanceofSourceType =
        stmt.condition.kind === "binary"
          ? stmt.condition.left.inferredType
          : undefined;
      const fallthroughSourceType =
        fallthroughBaseContext.narrowedBindings?.get(
          instanceofGuard.originalName
        )?.sourceType ??
        fallthroughBaseContext.narrowedBindings?.get(
          instanceofGuard.originalName
        )?.type ??
        instanceofSourceType;
      const fallthroughRuntimeFrame =
        fallthroughSourceType &&
        resolveRuntimeUnionFrame(
          instanceofGuard.originalName,
          fallthroughSourceType,
          fallthroughBaseContext
        );
      if (
        memberN !== undefined &&
        !memberNeedsPatternCheck &&
        fallthroughRuntimeFrame &&
        fallthroughRuntimeFrame.candidateMemberNs.includes(memberN)
      ) {
        finalContext = withComplementNarrowing(
          instanceofGuard.originalName,
          receiverAst,
          fallthroughRuntimeFrame.runtimeUnionArity,
          fallthroughRuntimeFrame.candidateMemberNs,
          fallthroughRuntimeFrame.members,
          memberN,
          fallthroughBaseContext
        );
      } else {
        const complementType = narrowTypeByNotAssignableTarget(
          stmt.condition.kind === "binary"
            ? stmt.condition.left.inferredType
            : undefined,
          instanceofGuard.targetType,
          ctxAfterRhs
        );
        if (complementType) {
          finalContext = applyExprFallthroughNarrowing(
            instanceofGuard.originalName,
            { kind: "identifierExpression", identifier: escapedOrig },
            complementType,
            ctxAfterRhs,
            finalContext
          );
        }
      }
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
 * Case B2: if (!(x instanceof Foo)) { ... } else { ... }
 * Swap branches so ELSE runs under the narrowed pattern var.
 */
export const tryEmitNegatedInstanceofGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  if (
    stmt.condition.kind !== "unary" ||
    stmt.condition.operator !== "!" ||
    !stmt.elseStatement
  ) {
    return undefined;
  }

  const inner = stmt.condition.expression;
  const guard = tryResolveInstanceofGuard(inner, context);
  if (!guard) return undefined;

  const {
    ctxAfterRhs,
    escapedNarrow,
    rhsTypeAst,
    narrowedMap,
    memberN,
    memberNeedsPatternCheck,
    receiverAst,
  } = guard;

  const condAst =
    memberN !== undefined
      ? memberNeedsPatternCheck
        ? buildIsPatternCondition(
            buildUnionNarrowAst(receiverAst, memberN),
            rhsTypeAst,
            escapedNarrow
          )
        : buildIsNCondition(receiverAst, memberN, false)
      : buildIsPatternCondition(receiverAst, rhsTypeAst, escapedNarrow);

  let thenStatementAst: CSharpStatementAst;
  let thenCtxAfter: EmitterContext;
  if (memberN !== undefined && !memberNeedsPatternCheck) {
    const [thenBlock, thenBlockCtx] = emitForcedBlockWithPreambleAst(
      [buildCastLocalDecl(escapedNarrow, receiverAst, memberN, rhsTypeAst)],
      stmt.elseStatement,
      {
        ...ctxAfterRhs,
        narrowedBindings: narrowedMap,
      }
    );
    thenStatementAst = thenBlock;
    thenCtxAfter = thenBlockCtx;
  } else {
    const [thenStmts, nextCtx] = emitBranchScopedStatementAst(
      stmt.elseStatement,
      {
        ...ctxAfterRhs,
        narrowedBindings: narrowedMap,
      }
    );
    thenStatementAst = wrapInBlock(thenStmts);
    thenCtxAfter = nextCtx;
  }

  // ELSE branch is the original THEN (not narrowed)
  const elseEntryContext =
    applyConditionBranchNarrowing(
      inner,
      "falsy",
      {
        ...resetBranchFlowState(ctxAfterRhs, thenCtxAfter),
        narrowedBindings: ctxAfterRhs.narrowedBindings,
      },
      emitExprAstCb
    ) ??
    ({
      ...resetBranchFlowState(ctxAfterRhs, thenCtxAfter),
      narrowedBindings: ctxAfterRhs.narrowedBindings,
    } satisfies EmitterContext);
  const [elseStmts, elseCtxAfter] = emitBranchScopedStatementAst(
    stmt.thenStatement,
    elseEntryContext
  );

  return [
    [
      {
        kind: "ifStatement",
        condition: condAst,
        thenStatement: thenStatementAst,
        elseStatement: wrapInBlock(elseStmts),
      },
    ],
    elseCtxAfter,
  ];
};

/**
 * Case D: Nullable value type narrowing.
 * if (id !== null) { ... } -> id becomes id.Value in then-branch.
 */
export const tryEmitNullableGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const simpleNullableGuard = tryResolveSimpleNullableGuard(
    stmt.condition,
    context
  );
  const nullableGuard =
    simpleNullableGuard ?? tryResolveNullableGuard(stmt.condition, context);
  if (!nullableGuard || !nullableGuard.isValueType) return undefined;

  const { key, targetExpr, narrowsInThen, strippedType } = nullableGuard;
  const effectiveTargetType =
    resolveEffectiveExpressionType(targetExpr, context) ??
    targetExpr.inferredType;

  // Avoid stacking `.Value` (see detailed comment in original text emitter)
  const [idAst] =
    targetExpr.kind === "identifier"
      ? emitIdentifier(targetExpr, {
          ...context,
          narrowedBindings: undefined,
        })
      : emitExpressionAst(targetExpr, {
          ...context,
          narrowedBindings: undefined,
        });

  // Create narrowed binding: id -> id.Value
  const narrowedMap = new Map(context.narrowedBindings ?? []);
  narrowedMap.set(
    key,
    buildProjectedExprBinding(
      {
        kind: "memberAccessExpression",
        expression: idAst,
        memberName: "Value",
      },
      strippedType,
      effectiveTargetType,
      idAst
    )
  );

  // Soundness: In compound conditions (A && B), we must NOT apply "else" narrowing.
  const isAndCondition =
    stmt.condition.kind === "logical" && stmt.condition.operator === "&&";
  if (isAndCondition && !simpleNullableGuard && !narrowsInThen) {
    // `id == null` inside `&&` - skip nullable rewrite, fall through to standard.
    return undefined;
  }

  // Emit condition
  const [condAst, condCtxAfterCond] = emitBooleanConditionAst(
    stmt.condition,
    emitExprAstCb,
    context
  );

  // Apply narrowing to appropriate branch
  const thenCtx: EmitterContext = {
    ...condCtxAfterCond,
    narrowedBindings: narrowsInThen
      ? narrowedMap
      : condCtxAfterCond.narrowedBindings,
  };

  const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(
    stmt.thenStatement,
    thenCtx
  );

  let finalContext: EmitterContext = {
    ...thenCtxAfter,
    narrowedBindings: context.narrowedBindings,
  };

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseCtx: EmitterContext = {
      ...finalContext,
      narrowedBindings: !narrowsInThen
        ? simpleNullableGuard
          ? narrowedMap
          : context.narrowedBindings
        : context.narrowedBindings,
    };
    const [elseStmts, elseCtxAfter] = emitBranchScopedStatementAst(
      stmt.elseStatement,
      elseCtx
    );
    elseStmt = wrapInBlock(elseStmts);
    finalContext = {
      ...elseCtxAfter,
      narrowedBindings: context.narrowedBindings,
    };
  } else if (!narrowsInThen && isDefinitelyTerminating(stmt.thenStatement)) {
    finalContext = {
      ...finalContext,
      narrowedBindings: narrowedMap,
    };
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
