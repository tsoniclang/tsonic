/** Property-truthiness, discriminant-equality, and negated-predicate union-narrowing guard emission. */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import type { CSharpStatementAst } from "../../../core/format/backend-ast/types.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { makeNarrowedLocalName } from "../../../core/semantic/narrowing-keys.js";
import {
  buildAnyIsNCondition,
  buildProjectedExprBinding,
  buildSubsetUnionType,
  toReceiverAst,
  buildUnionNarrowAst,
  withComplementNarrowing,
  withComplementNarrowingForMembers,
  wrapInBlock,
  emitForcedBlockWithPreambleAst,
  buildCastLocalDecl,
  buildIsNCondition,
  emitBranchScopedStatementAst,
} from "./branch-context.js";
import {
  tryResolvePredicateGuard,
  tryResolvePropertyTruthinessGuard,
  tryResolveDiscriminantEqualityGuard,
  isDefinitelyTerminating,
} from "./guard-analysis.js";

type IfStatement = Extract<IrStatement, { kind: "ifStatement" }>;
type GuardResult = [readonly CSharpStatementAst[], EmitterContext] | undefined;

/** Try to emit a property-truthiness guard for `if (result.success) { ... }`. */
export const tryEmitPropertyTruthinessGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const propertyTruthinessGuard = tryResolvePropertyTruthinessGuard(
    stmt.condition,
    context
  );
  if (!propertyTruthinessGuard) return undefined;

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
  } = propertyTruthinessGuard;

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

      const [elseStmts, elseCtxAfter] = emitBranchScopedStatementAst(
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

    const [elseStmts, elseCtx] = emitBranchScopedStatementAst(stmt.elseStatement, {
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

/**
 * Try to emit a discriminant-equality guard narrowing for
 * `if (shape.kind === "circle") { ... }`.
 * Returns undefined if the condition is not a matching discriminant-equality guard.
 */
export const tryEmitDiscriminantEqualityGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const eqGuard = tryResolveDiscriminantEqualityGuard(stmt.condition, context);
  if (!eqGuard) return undefined;

  const {
    originalName,
    operator,
    memberN,
    unionArity,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    ctxWithId,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
  } = eqGuard;

  const isInequality = operator === "!==" || operator === "!=";
  const condAst = buildIsNCondition(escapedOrig, memberN, isInequality);

  let finalContext: EmitterContext = ctxWithId;

  // Equality: narrow THEN to memberN. Inequality: narrow ELSE to memberN.
  if (!isInequality) {
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
    finalContext = thenBodyCtx;

    let elseStmt: CSharpStatementAst | undefined;
    if (stmt.elseStatement) {
      if (unionArity === 2) {
        const [elseStmts, elseCtxAfter] = emitBranchScopedStatementAst(
          stmt.elseStatement,
          withComplementNarrowing(
            originalName,
            escapedOrig,
            runtimeUnionArity,
            candidateMemberNs,
            candidateMembers,
            memberN,
            finalContext
          )
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

      const [elseStmts, elseCtx] = emitBranchScopedStatementAst(stmt.elseStatement, {
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
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenBlock,
          },
        ],
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
  }

  // Inequality: THEN is "not memberN", ELSE is memberN
  {
    let thenStmt: CSharpStatementAst;
    let thenCtx: EmitterContext;

    if (unionArity === 2) {
      const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(stmt.thenStatement, {
        ...withComplementNarrowing(
          originalName,
          escapedOrig,
          runtimeUnionArity,
          candidateMemberNs,
          candidateMembers,
          memberN,
          ctxWithId
        ),
      });
      thenStmt = wrapInBlock(thenStmts);
      thenCtx = thenCtxAfter;
    } else {
      const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(
        stmt.thenStatement,
        ctxWithId
      );
      thenStmt = wrapInBlock(thenStmts);
      thenCtx = thenCtxAfter;
    }

    finalContext = thenCtx;

    let elseStmt: CSharpStatementAst | undefined;
    if (stmt.elseStatement) {
      const castStmt = buildCastLocalDecl(escapedNarrow, escapedOrig, memberN);
      const [elseBlock, elseBodyCtx] = emitForcedBlockWithPreambleAst(
        [castStmt],
        stmt.elseStatement,
        { ...ctxWithId, narrowedBindings: narrowedMap }
      );
      elseStmt = elseBlock;
      finalContext = {
        ...elseBodyCtx,
        narrowedBindings: ctxWithId.narrowedBindings,
      };
      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenStmt,
            elseStatement: elseStmt,
          },
        ],
        finalContext,
      ];
    }

    // Post-if narrowing for early-exit patterns
    if (isDefinitelyTerminating(stmt.thenStatement)) {
      const narrowedBindings = new Map(finalContext.narrowedBindings ?? []);
      narrowedBindings.set(
        originalName,
        buildProjectedExprBinding(
          buildUnionNarrowAst(escapedOrig, memberN),
          candidateMembers[
            candidateMemberNs.findIndex(
              (runtimeMemberN) => runtimeMemberN === memberN
            )
          ],
          undefined,
          toReceiverAst(escapedOrig)
        )
      );
      finalContext = { ...finalContext, narrowedBindings };
      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenStmt,
          },
        ],
        finalContext,
      ];
    }

    finalContext = {
      ...finalContext,
      narrowedBindings: ctxWithId.narrowedBindings,
    };
    return [
      [{ kind: "ifStatement", condition: condAst, thenStatement: thenStmt }],
      finalContext,
    ];
  }
};

/**
 * Try to emit a negated predicate guard narrowing for
 * `if (!isUser(account)) { ... }`.
 * Returns undefined if the condition is not a matching negated predicate call.
 */
export const tryEmitNegatedPredicateGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const thenStatement = stmt.thenStatement;
  if (!thenStatement) {
    return undefined;
  }

  if (
    stmt.condition.kind !== "unary" ||
    stmt.condition.operator !== "!" ||
    stmt.condition.expression.kind !== "call"
  ) {
    return undefined;
  }

  const innerCall = stmt.condition.expression;
  const guard = tryResolvePredicateGuard(innerCall, context);
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

  const condAst = buildAnyIsNCondition(receiverAst, memberNs, true);

  // THEN branch: for 2-member unions narrow to OTHER member
  let thenStmt: CSharpStatementAst;
  let thenCtx: EmitterContext;

  if (memberNs.length === 1 && unionArity === 2 && memberN !== undefined) {
    const otherIndex = candidateMemberNs.findIndex(
      (runtimeMemberN) => runtimeMemberN !== memberN
    );
    const otherMemberN =
      otherIndex >= 0 ? candidateMemberNs[otherIndex] : undefined;
    const otherMemberType =
      otherIndex >= 0 ? candidateMembers[otherIndex] : undefined;
    if (!otherMemberN || !otherMemberType) {
      throw new Error(
        "ICE: Failed to resolve complement runtime union member for negated predicate guard."
      );
    }
    const nextId = (ctxWithId.tempVarId ?? 0) + 1;
    const thenCtxWithId: EmitterContext = {
      ...ctxWithId,
      tempVarId: nextId,
    };

    const thenNarrowedName = makeNarrowedLocalName(
      originalName,
      otherMemberN,
      nextId
    );
    const escapedThenNarrow = escapeCSharpIdentifier(thenNarrowedName);

    const thenNarrowedMap = new Map(thenCtxWithId.narrowedBindings ?? []);
    thenNarrowedMap.set(originalName, {
      kind: "rename",
      name: thenNarrowedName,
      type: otherMemberType,
    });

    const thenCastStmt = buildCastLocalDecl(
      escapedThenNarrow,
      receiverAst,
      otherMemberN
    );

    const [thenBlock, thenBlockCtx] = emitForcedBlockWithPreambleAst(
      [thenCastStmt],
      thenStatement,
      { ...thenCtxWithId, narrowedBindings: thenNarrowedMap }
    );
    thenStmt = thenBlock;
    thenCtx = thenBlockCtx;
  } else {
    const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(
      thenStatement,
      withComplementNarrowingForMembers(
        originalName,
        receiverAst,
        runtimeUnionArity,
        candidateMemberNs,
        candidateMembers,
        memberNs,
        context
      )
    );
    thenStmt = wrapInBlock(thenStmts);
    thenCtx = thenCtxAfter;
  }

  if (stmt.elseStatement) {
    const [elseBlock, _elseBodyCtx] =
      memberN !== undefined
        ? emitForcedBlockWithPreambleAst(
            [buildCastLocalDecl(escapedNarrow, receiverAst, memberN)],
            stmt.elseStatement,
            { ...ctxWithId, narrowedBindings: narrowedMap }
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
            const [elseStmts, nextElseCtx] = emitBranchScopedStatementAst(
              stmt.elseStatement,
              {
                ...ctxWithId,
                narrowedBindings,
              }
            );
            return [wrapInBlock(elseStmts), nextElseCtx] as const;
          })();

    return [
      [
        {
          kind: "ifStatement",
          condition: condAst,
          thenStatement: thenStmt,
          elseStatement: elseBlock,
        },
      ],
      thenCtx,
    ];
  }

  let finalContext = thenCtx;
  if (isDefinitelyTerminating(thenStatement)) {
    const narrowedBindings = new Map(finalContext.narrowedBindings ?? []);
    if (memberN !== undefined) {
      const selectedIndex = candidateMemberNs.findIndex(
        (runtimeMemberN) => runtimeMemberN === memberN
      );
      const selectedMemberType =
        selectedIndex >= 0 ? candidateMembers[selectedIndex] : undefined;
      if (!selectedMemberType) {
        throw new Error(
          "ICE: Failed to resolve predicate target runtime union member for negated predicate fallthrough."
        );
      }

      narrowedBindings.set(
        originalName,
        buildProjectedExprBinding(
          buildUnionNarrowAst(receiverAst, memberN),
          selectedMemberType,
          sourceType,
          toReceiverAst(receiverAst)
        )
      );
    } else {
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
    }

    finalContext = { ...finalContext, narrowedBindings };
    return [
      [{ kind: "ifStatement", condition: condAst, thenStatement: thenStmt }],
      finalContext,
    ];
  }

  finalContext = {
    ...finalContext,
    narrowedBindings: ctxWithId.narrowedBindings,
  };
  return [
    [{ kind: "ifStatement", condition: condAst, thenStatement: thenStmt }],
    finalContext,
  ];
};
