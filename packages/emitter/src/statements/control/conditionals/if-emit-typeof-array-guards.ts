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
import {
  isDefinitelyTerminating,
  resolveRuntimeUnionFrame,
} from "./guard-analysis.js";
import {
  tryExtractArrayIsArrayGuard,
  collectTypeofGuardRefinements,
  applyTypeofGuardRefinements,
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
