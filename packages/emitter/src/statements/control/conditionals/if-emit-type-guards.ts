/**
 * Type-based guard emission cases for if-statements.
 * Handles instanceof, Array.isArray, nullable, typeof, and negated-instanceof guards.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitIdentifier } from "../../../expressions/identifiers.js";
import { emitTypeAst } from "../../../type-emitter.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import type { CSharpStatementAst } from "../../../core/format/backend-ast/types.js";
import { emitBooleanConditionAst } from "../../../core/semantic/boolean-context.js";
import { applyConditionBranchNarrowing } from "../../../core/semantic/condition-branch-narrowing.js";
import {
  tryResolveInstanceofGuard,
  tryResolveSimpleNullableGuard,
  tryResolveNullableGuard,
  isDefinitelyTerminating,
  resolveRuntimeUnionFrame,
} from "./guard-analysis.js";
import {
  tryExtractArrayIsArrayGuard,
  collectTypeofGuardRefinements,
  applyTypeofGuardRefinements,
  narrowTypeByArrayShape,
  narrowTypeByNotAssignableTarget,
  isArrayLikeNarrowingCandidate,
} from "./guard-extraction.js";
import {
  buildExprBinding,
  buildIsNCondition,
  buildIsPatternCondition,
  buildCastLocalDecl,
  emitForcedBlockWithPreambleAst,
  wrapInBlock,
  withComplementNarrowing,
  withRuntimeUnionMemberNarrowing,
  applyExprFallthroughNarrowing,
  emitExprAstCb,
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
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    receiverAst,
  } = instanceofGuard;

  const condAst =
    memberN && runtimeUnionArity && candidateMemberNs && candidateMembers
      ? buildIsNCondition(receiverAst, memberN, false)
      : buildIsPatternCondition(receiverAst, rhsTypeAst, escapedNarrow);

  let thenStatementAst: CSharpStatementAst;
  let thenCtxAfter: EmitterContext;
  if (memberN && runtimeUnionArity && candidateMemberNs && candidateMembers) {
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
    const [thenStmts, nextCtx] = emitStatementAst(stmt.thenStatement, {
      ...ctxAfterRhs,
      narrowedBindings: narrowedMap,
    });
    thenStatementAst = wrapInBlock(thenStmts);
    thenCtxAfter = nextCtx;
  }

  let finalContext: EmitterContext = {
    ...thenCtxAfter,
    narrowedBindings: ctxAfterRhs.narrowedBindings,
  };

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const [elseStmts, elseCtx] = emitStatementAst(
      stmt.elseStatement,
      finalContext
    );
    elseStmt = wrapInBlock(elseStmts);
    finalContext = elseCtx;
  }

  if (!stmt.elseStatement && isDefinitelyTerminating(stmt.thenStatement)) {
    const fallthroughBaseContext: EmitterContext = {
      ...finalContext,
      narrowedBindings: ctxAfterRhs.narrowedBindings,
    };
    const instanceofSourceType =
      stmt.condition.kind === "binary"
        ? stmt.condition.left.inferredType
        : undefined;
    const fallthroughSourceType =
      fallthroughBaseContext.narrowedBindings?.get(instanceofGuard.originalName)
        ?.sourceType ??
      fallthroughBaseContext.narrowedBindings?.get(instanceofGuard.originalName)
        ?.type ??
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
      const fallthroughContext = applyConditionBranchNarrowing(
        stmt.condition,
        "falsy",
        fallthroughBaseContext,
        emitExprAstCb
      );
      if (fallthroughContext) {
        finalContext = fallthroughContext;
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
 * Array.isArray guard emission.
 * Handles `if (Array.isArray(x)) { ... }` and `if (!Array.isArray(x)) { ... }`.
 */
export const tryEmitArrayIsArrayGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const arrayIsArrayGuard = tryExtractArrayIsArrayGuard(stmt.condition);
  if (!arrayIsArrayGuard) return undefined;

  const [rawTargetAst, condCtxAfterCond] = emitExpressionAst(
    arrayIsArrayGuard.targetExpr,
    context
  );
  const runtimeUnionFrame =
    arrayIsArrayGuard.targetExpr.inferredType &&
    resolveRuntimeUnionFrame(
      arrayIsArrayGuard.originalName,
      arrayIsArrayGuard.targetExpr.inferredType,
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
      rawTargetAst,
      runtimeArrayPair.runtimeMemberN,
      runtimeArrayPair.memberType,
      arrayIsArrayGuard.targetExpr.inferredType,
      condCtxAfterCondAst
    );
    const nonArrayBranchContext = withComplementNarrowing(
      arrayIsArrayGuard.originalName,
      rawTargetAst,
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
    const [thenStmts, thenCtxAfter] = emitStatementAst(
      stmt.thenStatement,
      thenCtx
    );
    const thenStatementAst = wrapInBlock(thenStmts);

    let finalContext: EmitterContext = {
      ...thenCtxAfter,
      narrowedBindings: condCtxAfterCond.narrowedBindings,
    };

    let elseStmt: CSharpStatementAst | undefined;
    if (stmt.elseStatement) {
      const elseCtx = arrayIsArrayGuard.narrowsInThen
        ? nonArrayBranchContext
        : arrayBranchContext;
      const [elseStmts, elseCtxAfter] = emitStatementAst(
        stmt.elseStatement,
        elseCtx
      );
      elseStmt = wrapInBlock(elseStmts);
      finalContext = {
        ...elseCtxAfter,
        narrowedBindings: condCtxAfterCond.narrowedBindings,
      };
    }

    if (!stmt.elseStatement && isDefinitelyTerminating(stmt.thenStatement)) {
      finalContext = arrayIsArrayGuard.narrowsInThen
        ? nonArrayBranchContext
        : arrayBranchContext;
    }

    const runtimeCondAst = buildIsNCondition(
      rawTargetAst,
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
        expression: rawTargetAst,
      },
      narrowedType,
      undefined,
      rawTargetAst
    )
  );

  const [condAst, condCtxAfterCondAst] = emitBooleanConditionAst(
    stmt.condition,
    emitExprAstCb,
    condCtxAfterCond
  );

  const thenCtx: EmitterContext = {
    ...narrowedTypeCtx,
    ...condCtxAfterCondAst,
    narrowedBindings: arrayIsArrayGuard.narrowsInThen
      ? narrowedMap
      : condCtxAfterCond.narrowedBindings,
  };
  const [thenStmts, thenCtxAfter] = emitStatementAst(
    stmt.thenStatement,
    thenCtx
  );
  const thenStatementAst = wrapInBlock(thenStmts);

  let finalContext: EmitterContext = {
    ...thenCtxAfter,
    narrowedBindings: condCtxAfterCond.narrowedBindings,
  };

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseCtx: EmitterContext = {
      ...finalContext,
      narrowedBindings: arrayIsArrayGuard.narrowsInThen
        ? condCtxAfterCond.narrowedBindings
        : narrowedMap,
    };
    const [elseStmts, elseCtxAfter] = emitStatementAst(
      stmt.elseStatement,
      elseCtx
    );
    elseStmt = wrapInBlock(elseStmts);
    finalContext = {
      ...elseCtxAfter,
      narrowedBindings: condCtxAfterCond.narrowedBindings,
    };
  }

  if (!stmt.elseStatement && isDefinitelyTerminating(stmt.thenStatement)) {
    const complementType = narrowTypeByArrayShape(
      arrayIsArrayGuard.targetExpr.inferredType,
      !arrayIsArrayGuard.narrowsInThen,
      condCtxAfterCond
    );
    if (complementType) {
      finalContext = applyExprFallthroughNarrowing(
        arrayIsArrayGuard.originalName,
        rawTargetAst,
        complementType,
        condCtxAfterCond,
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
    receiverAst,
  } = guard;

  const condAst =
    memberN !== undefined
      ? buildIsNCondition(receiverAst, memberN, false)
      : buildIsPatternCondition(receiverAst, rhsTypeAst, escapedNarrow);

  let thenStatementAst: CSharpStatementAst;
  let thenCtxAfter: EmitterContext;
  if (memberN !== undefined) {
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
    const [thenStmts, nextCtx] = emitStatementAst(stmt.elseStatement, {
      ...ctxAfterRhs,
      narrowedBindings: narrowedMap,
    });
    thenStatementAst = wrapInBlock(thenStmts);
    thenCtxAfter = nextCtx;
  }

  // ELSE branch is the original THEN (not narrowed)
  const [elseStmts, elseCtxAfter] = emitStatementAst(stmt.thenStatement, {
    ...thenCtxAfter,
    narrowedBindings: ctxAfterRhs.narrowedBindings,
  });

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
  const simpleNullableGuard = tryResolveSimpleNullableGuard(stmt.condition);
  const nullableGuard =
    simpleNullableGuard ?? tryResolveNullableGuard(stmt.condition, context);
  if (!nullableGuard || !nullableGuard.isValueType) return undefined;

  const { key, targetExpr, narrowsInThen, strippedType } = nullableGuard;

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
    buildExprBinding(
      {
        kind: "memberAccessExpression",
        expression: idAst,
        memberName: "Value",
      },
      strippedType,
      undefined,
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

  const [thenStmts, thenCtxAfter] = emitStatementAst(
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
    const [elseStmts, elseCtxAfter] = emitStatementAst(
      stmt.elseStatement,
      elseCtx
    );
    elseStmt = wrapInBlock(elseStmts);
    finalContext = {
      ...elseCtxAfter,
      narrowedBindings: context.narrowedBindings,
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

  const thenCtx =
    truthyTypeofRefinements.length > 0
      ? applyTypeofGuardRefinements(condCtxAfterCond, truthyTypeofRefinements)
      : condCtxAfterCond;
  const [thenStmts, thenCtxAfter] = emitStatementAst(
    stmt.thenStatement,
    thenCtx
  );

  let finalContext: EmitterContext = {
    ...thenCtxAfter,
    narrowedBindings: condCtxAfterCond.narrowedBindings,
  };

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseBaseContext: EmitterContext = {
      ...finalContext,
      narrowedBindings: condCtxAfterCond.narrowedBindings,
    };
    const elseCtx =
      falsyTypeofRefinements.length > 0
        ? applyTypeofGuardRefinements(elseBaseContext, falsyTypeofRefinements)
        : elseBaseContext;
    const [elseStmts, elseCtxAfter] = emitStatementAst(
      stmt.elseStatement,
      elseCtx
    );
    elseStmt = wrapInBlock(elseStmts);
    finalContext = {
      ...elseCtxAfter,
      narrowedBindings: condCtxAfterCond.narrowedBindings,
    };
  }

  if (
    !stmt.elseStatement &&
    isDefinitelyTerminating(stmt.thenStatement) &&
    falsyTypeofRefinements.length > 0
  ) {
    finalContext = applyTypeofGuardRefinements(
      {
        ...finalContext,
        narrowedBindings: condCtxAfterCond.narrowedBindings,
      },
      falsyTypeofRefinements
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
