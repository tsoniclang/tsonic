/**
 * Predicate and in-operator union-narrowing guard emission for if-statements.
 * Handles predicate guards (`if (isUser(account)) { ... }`) and
 * in-operator guards (`if ("error" in auth) { ... }`).
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import type { CSharpStatementAst } from "../../../core/format/backend-ast/types.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import {
  buildAnyIsNCondition,
  buildIsNCondition,
  buildCastLocalDecl,
  buildSubsetUnionType,
  withComplementNarrowing,
  withComplementNarrowingForMembers,
  wrapInBlock,
  emitForcedBlockWithPreambleAst,
} from "./branch-context.js";
import {
  tryResolvePredicateGuard,
  tryResolveInGuard,
  isDefinitelyTerminating,
} from "./guard-analysis.js";

type IfStatement = Extract<IrStatement, { kind: "ifStatement" }>;
type GuardResult = [readonly CSharpStatementAst[], EmitterContext] | undefined;

/**
 * Try to emit a predicate guard narrowing for `if (isUser(account)) { ... }`.
 * Returns undefined if the condition is not a matching predicate call.
 */
export const tryEmitPredicateGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  if (stmt.condition.kind !== "call") return undefined;

  const guard = tryResolvePredicateGuard(stmt.condition, context);
  if (!guard) return undefined;

  const {
    originalName,
    receiverAst,
    memberN,
    memberNs,
    unionArity,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    ctxWithId,
    escapedNarrow,
    narrowedMap,
    targetType,
    sourceType,
    sourceMembers,
    sourceCandidateMemberNs,
  } = guard;

  const condAst = buildAnyIsNCondition(receiverAst, memberNs, false);

  const [thenBlock, thenBodyCtx] =
    memberN !== undefined
      ? emitForcedBlockWithPreambleAst(
          [buildCastLocalDecl(escapedNarrow, receiverAst, memberN)],
          stmt.thenStatement,
          {
            ...ctxWithId,
            narrowedBindings: narrowedMap,
          }
        )
      : (() => {
          const narrowedBindings = new Map(ctxWithId.narrowedBindings ?? []);
          narrowedBindings.set(originalName, {
            kind: "runtimeSubset",
            runtimeMemberNs: memberNs,
            runtimeUnionArity,
            storageExprAst: receiverAst,
            sourceMembers: sourceMembers ? [...sourceMembers] : undefined,
            sourceCandidateMemberNs: sourceCandidateMemberNs
              ? [...sourceCandidateMemberNs]
              : undefined,
            type: targetType,
            sourceType: sourceType ?? buildSubsetUnionType(candidateMembers),
          });
          const [thenStmts, nextThenCtx] = emitStatementAst(
            stmt.thenStatement,
            {
              ...ctxWithId,
              narrowedBindings,
            }
          );
          return [wrapInBlock(thenStmts), nextThenCtx] as const;
        })();

  let finalContext: EmitterContext = {
    ...thenBodyCtx,
    narrowedBindings: ctxWithId.narrowedBindings,
  };

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseCtxBase =
      memberNs.length === 1 && unionArity === 2 && memberN !== undefined
        ? withComplementNarrowing(
            originalName,
            receiverAst,
            runtimeUnionArity,
            candidateMemberNs,
            candidateMembers,
            memberN,
            finalContext
          )
        : withComplementNarrowingForMembers(
            originalName,
            receiverAst,
            runtimeUnionArity,
            candidateMemberNs,
            candidateMembers,
            memberNs,
            finalContext
          );
    const [elseStmts, elseCtx] = emitStatementAst(
      stmt.elseStatement,
      elseCtxBase
    );
    elseStmt = wrapInBlock(elseStmts);
    finalContext = {
      ...elseCtx,
      narrowedBindings: ctxWithId.narrowedBindings,
    };
    return [
      [
        {
          kind: "ifStatement",
          condition: condAst,
          thenStatement: thenBlock,
          elseStatement: elseStmt,
        },
      ],
      finalContext,
    ];
  }

  if (isDefinitelyTerminating(stmt.thenStatement)) {
    finalContext =
      memberNs.length === 1 && memberN !== undefined
        ? withComplementNarrowing(
            originalName,
            receiverAst,
            runtimeUnionArity,
            candidateMemberNs,
            candidateMembers,
            memberN,
            finalContext
          )
        : withComplementNarrowingForMembers(
            originalName,
            receiverAst,
            runtimeUnionArity,
            candidateMemberNs,
            candidateMembers,
            memberNs,
            finalContext
          );
  }

  const ifStmt: CSharpStatementAst = {
    kind: "ifStatement",
    condition: condAst,
    thenStatement: thenBlock,
    elseStatement: elseStmt,
  };

  return [[ifStmt], finalContext];
};

/**
 * Try to emit an `in`-operator guard narrowing for `if ("error" in auth) { ... }`.
 * Returns undefined if the condition is not a matching in-guard.
 */
export const tryEmitInGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const inGuard = tryResolveInGuard(stmt.condition, context);
  if (!inGuard) return undefined;

  const {
    originalName,
    memberN,
    unionArity,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    ctxWithId,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
  } = inGuard;

  const condAst = buildIsNCondition(escapedOrig, memberN, false);
  const castStmt = buildCastLocalDecl(escapedNarrow, escapedOrig, memberN);

  const thenCtx: EmitterContext = {
    ...ctxWithId,
    narrowedBindings: narrowedMap,
  };

  const [thenBlock, thenBodyCtx] = emitForcedBlockWithPreambleAst(
    [castStmt],
    stmt.thenStatement,
    thenCtx
  );

  let finalContext: EmitterContext = thenBodyCtx;

  let elseStmt: CSharpStatementAst | undefined;

  if (stmt.elseStatement) {
    if (unionArity === 2) {
      const elseCtx = withComplementNarrowing(
        originalName,
        escapedOrig,
        runtimeUnionArity,
        candidateMemberNs,
        candidateMembers,
        memberN,
        finalContext
      );

      const [elseStmts, elseCtxAfter] = emitStatementAst(
        stmt.elseStatement,
        elseCtx
      );
      elseStmt = wrapInBlock(elseStmts);
      finalContext = {
        ...elseCtxAfter,
        narrowedBindings: ctxWithId.narrowedBindings,
      };

      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenBlock,
            elseStatement: elseStmt,
          },
        ],
        finalContext,
      ];
    }

    // Can't narrow ELSE safely, emit without narrowing.
    const [elseStmts, elseCtx] = emitStatementAst(stmt.elseStatement, {
      ...finalContext,
      narrowedBindings: ctxWithId.narrowedBindings,
    });
    elseStmt = wrapInBlock(elseStmts);
    finalContext = {
      ...elseCtx,
      narrowedBindings: ctxWithId.narrowedBindings,
    };

    return [
      [
        {
          kind: "ifStatement",
          condition: condAst,
          thenStatement: thenBlock,
          elseStatement: elseStmt,
        },
      ],
      finalContext,
    ];
  }

  // Post-if narrowing for early-exit patterns (2-member unions only)
  if (isDefinitelyTerminating(stmt.thenStatement)) {
    finalContext = withComplementNarrowing(
      originalName,
      escapedOrig,
      runtimeUnionArity,
      candidateMemberNs,
      candidateMembers,
      memberN,
      finalContext
    );
    return [
      [{ kind: "ifStatement", condition: condAst, thenStatement: thenBlock }],
      finalContext,
    ];
  }

  finalContext = {
    ...finalContext,
    narrowedBindings: ctxWithId.narrowedBindings,
  };
  return [
    [{ kind: "ifStatement", condition: condAst, thenStatement: thenBlock }],
    finalContext,
  ];
};
