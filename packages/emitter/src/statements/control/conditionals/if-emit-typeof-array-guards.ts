/**
 * Array.isArray and typeof guard emission cases for if-statements.
 * Handles Array.isArray guards and typeof guards.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitTypeAst } from "../../../type-emitter.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import type { CSharpStatementAst } from "../../../core/format/backend-ast/types.js";
import { emitBooleanConditionAst } from "../../../core/semantic/boolean-context.js";
import { applyConditionBranchNarrowing } from "../../../core/semantic/condition-branch-narrowing.js";
import { currentNarrowedType } from "../../../core/semantic/narrowing-builders.js";
import { willCarryAsRuntimeUnion } from "../../../core/semantic/union-semantics.js";
import {
  resolveDirectStorageExpressionAst,
  resolveDirectStorageExpressionType,
  resolveIdentifierCarrierStorageType,
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
} from "./branch-context.js";

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
  const directStorageType =
    arrayIsArrayGuard.targetExpr.kind === "identifier"
      ? (condCtxAfterCond.localValueTypes?.get(
          arrayIsArrayGuard.targetExpr.name
        ) ??
        resolveIdentifierCarrierStorageType(
          arrayIsArrayGuard.targetExpr,
          condCtxAfterCond
        ))
      : resolveDirectStorageExpressionType(
          arrayIsArrayGuard.targetExpr,
          emittedTargetAst,
          condCtxAfterCond
        );
  const runtimeCarrierAst =
    (directStorageType
      ? resolveDirectStorageExpressionAst(
          arrayIsArrayGuard.targetExpr,
          condCtxAfterCond
        )
      : undefined) ?? emittedTargetAst;
  const runtimeCarrierType = directStorageType
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
      condCtxAfterCondAst
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
      emittedTargetAst
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
        emittedTargetAst,
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

  const thenCtx =
    truthyTypeofRefinements.length > 0
      ? applyConditionBranchNarrowing(
          stmt.condition,
          "truthy",
          condCtxAfterCond,
          emitExprAstCb
        )
      : condCtxAfterCond;
  const [thenStmts, thenCtxAfter] = emitStatementAst(
    stmt.thenStatement,
    thenCtx
  );

  let finalContext: EmitterContext = {
    ...thenCtxAfter,
    narrowedBindings: preservedNarrowedBindings,
  };

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseBaseContext: EmitterContext = {
      ...finalContext,
      narrowedBindings: preservedNarrowedBindings,
    };
    const elseCtx =
      falsyTypeofRefinements.length > 0
        ? applyConditionBranchNarrowing(
            stmt.condition,
            "falsy",
            elseBaseContext,
            emitExprAstCb
          )
        : elseBaseContext;
    const [elseStmts, elseCtxAfter] = emitStatementAst(
      stmt.elseStatement,
      elseCtx
    );
    elseStmt = wrapInBlock(elseStmts);
    finalContext = {
      ...elseCtxAfter,
      narrowedBindings: preservedNarrowedBindings,
    };
  }

  if (
    !stmt.elseStatement &&
    isDefinitelyTerminating(stmt.thenStatement) &&
    falsyTypeofRefinements.length > 0
  ) {
    finalContext = applyConditionBranchNarrowing(
      stmt.condition,
      "falsy",
      {
        ...finalContext,
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
