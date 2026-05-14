/**
 * If-statement emitter — main dispatch orchestrator.
 *
 * Routes if-statement guards to specialized sub-emitters for union-narrowing
 * and type-based guards, handles compound AND cases inline, and falls through
 * to standard condition-narrowing emission.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
} from "../../../core/format/backend-ast/types.js";
import {
  emitBooleanConditionAst,
  toBooleanConditionAst,
} from "../../../core/semantic/boolean-context.js";
import { applyConditionBranchNarrowing } from "../../../core/semantic/condition-branch-narrowing.js";
import {
  tryResolveInstanceofGuard,
  isDefinitelyTerminating,
} from "./guard-analysis.js";

// Import from split modules
import {
  emitExprAstCb,
  mergeBranchExitContext,
  mergeBranchContextMeta,
  resetBranchFlowState,
  wrapInBlock,
  buildIsPatternCondition,
  emitBranchScopedStatementAst,
} from "./branch-context.js";
import {
  tryEmitPropertyTruthinessGuard,
  tryEmitDiscriminantEqualityGuard,
} from "./if-emit-union-guards.js";
import {
  tryEmitInstanceofGuard,
  tryEmitArrayIsArrayGuard,
  tryEmitNegatedInstanceofGuard,
  tryEmitNullableGuard,
  tryEmitTypeofGuard,
} from "./if-emit-type-guards.js";
import { applyIrBranchNarrowings } from "./ir-branch-narrowings.js";

const tryEmitPlannedGuard = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] | undefined => {
  switch (stmt.thenPlan.guardShape.kind) {
    case "propertyTruthiness":
      return tryEmitPropertyTruthinessGuard(stmt, context);
    case "discriminantEquality":
      return tryEmitDiscriminantEqualityGuard(stmt, context);
    case "instanceofGuard":
      return stmt.thenPlan.guardShape.polarity === "falsy"
        ? tryEmitNegatedInstanceofGuard(stmt, context)
        : tryEmitInstanceofGuard(stmt, context);
    case "arrayIsArrayGuard":
      return tryEmitArrayIsArrayGuard(stmt, context);
    case "nullableGuard":
      return tryEmitNullableGuard(stmt, context);
    case "typeofGuard":
      return tryEmitTypeofGuard(stmt, context);
    case "compound":
    case "opaqueBoolean":
      return undefined;
  }
};

/**
 * Emit an if-statement with guard-based union/instanceof/nullable narrowing.
 */
export const emitIfStatementAst = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const plannedGuard = tryEmitPlannedGuard(stmt, context);
  if (plannedGuard) {
    return plannedGuard;
  }

  // Case C: Logical AND with instanceof (x instanceof Foo && x.foo)
  if (stmt.condition.kind === "logical" && stmt.condition.operator === "&&") {
    const left = stmt.condition.left;
    const right = stmt.condition.right;
    if (left.kind === "binary" && left.operator === "instanceof") {
      const guard = tryResolveInstanceofGuard(left, context);
      if (guard) {
        const {
          ctxAfterRhs,
          receiverAst,
          escapedNarrow,
          rhsTypeAst,
          narrowedMap,
        } = guard;

        const rhsCtx: EmitterContext = {
          ...ctxAfterRhs,
          narrowedBindings: narrowedMap,
        };

        const [rhsAst, rhsCtxAfterEmit] = emitExpressionAst(right, rhsCtx);
        const [rhsCondAst, rhsCtxAfterCond] = toBooleanConditionAst(
          right,
          rhsAst,
          rhsCtxAfterEmit
        );

        const isPatternAst = buildIsPatternCondition(
          receiverAst,
          rhsTypeAst,
          escapedNarrow
        );
        const combinedCondAst: CSharpExpressionAst = {
          kind: "parenthesizedExpression",
          expression: {
            kind: "binaryExpression",
            operatorToken: "&&",
            left: isPatternAst,
            right: rhsCondAst,
          },
        };

        const thenCtx: EmitterContext = {
          ...rhsCtxAfterCond,
          narrowedBindings: narrowedMap,
        };
        const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(
          stmt.thenStatement,
          thenCtx
        );

        let finalContext: EmitterContext = {
          ...thenCtxAfter,
          narrowedBindings: ctxAfterRhs.narrowedBindings,
        };

        let elseStmt: CSharpStatementAst | undefined;
        if (stmt.elseStatement) {
          const [elseStmts, elseCtx] = emitBranchScopedStatementAst(
            stmt.elseStatement,
            finalContext
          );
          elseStmt = wrapInBlock(elseStmts);
          finalContext = elseCtx;
        }

        return [
          [
            {
              kind: "ifStatement",
              condition: combinedCondAst,
              thenStatement: wrapInBlock(thenStmts),
              elseStatement: elseStmt,
            },
          ],
          finalContext,
        ];
      }
    }
  }

  // Case D: Nullable guard (id !== null)
  {
    const result = tryEmitNullableGuard(stmt, context);
    if (result) return result;
  }

  // Case E: Typeof guard (typeof x === "string")
  {
    const result = tryEmitTypeofGuard(stmt, context);
    if (result) return result;
  }

  // Standard if-statement emission (no guard narrowing)
  const [condAst, condCtxAfterCond] = emitBooleanConditionAst(
    stmt.condition,
    emitExprAstCb,
    context
  );
  const semanticCondContext: EmitterContext = {
    ...condCtxAfterCond,
    narrowedBindings: context.narrowedBindings,
  };

  const thenCtx = applyIrBranchNarrowings(
    applyConditionBranchNarrowing(
      stmt.condition,
      "truthy",
      semanticCondContext,
      emitExprAstCb
    ),
    stmt.thenPlan.narrowedBindings,
    emitExprAstCb
  );
  const [thenStmts, thenContext] = emitBranchScopedStatementAst(
    stmt.thenStatement,
    thenCtx
  );
  const thenTerminates = isDefinitelyTerminating(stmt.thenStatement);
  const basePostConditionContext = resetBranchFlowState(
    semanticCondContext,
    thenContext
  );
  const falsyPostConditionContext = applyIrBranchNarrowings(
    applyConditionBranchNarrowing(
      stmt.condition,
      "falsy",
      {
        ...basePostConditionContext,
        narrowedBindings: semanticCondContext.narrowedBindings,
      },
      emitExprAstCb
    ) ?? {
      ...basePostConditionContext,
      narrowedBindings: semanticCondContext.narrowedBindings,
    },
    stmt.elsePlan.narrowedBindings,
    emitExprAstCb
  );
  let finalContext: EmitterContext = thenTerminates
    ? falsyPostConditionContext
    : mergeBranchExitContext(
        semanticCondContext,
        thenContext,
        falsyPostConditionContext
      );

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseEntryContext = applyIrBranchNarrowings(
      applyConditionBranchNarrowing(
        stmt.condition,
        "falsy",
        {
          ...semanticCondContext,
          tempVarId: basePostConditionContext.tempVarId,
          usings: basePostConditionContext.usings,
          usedLocalNames: basePostConditionContext.usedLocalNames,
        },
        emitExprAstCb
      ),
      stmt.elsePlan.narrowedBindings,
      emitExprAstCb
    );
    const [elseStmts, elseContext] = emitBranchScopedStatementAst(
      stmt.elseStatement,
      elseEntryContext
    );
    elseStmt = wrapInBlock(elseStmts);
    const elseTerminates = isDefinitelyTerminating(stmt.elseStatement);

    if (thenTerminates && !elseTerminates) {
      finalContext = mergeBranchContextMeta(elseContext, thenContext);
    } else if (!thenTerminates && elseTerminates) {
      finalContext = mergeBranchContextMeta(thenContext, elseContext);
    } else {
      finalContext = mergeBranchExitContext(
        semanticCondContext,
        thenContext,
        elseContext
      );
    }
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
