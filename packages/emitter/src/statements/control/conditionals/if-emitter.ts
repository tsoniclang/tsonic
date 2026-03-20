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
import { emitStatementAst } from "../../../statement-emitter.js";
import {
  emitBooleanConditionAst,
  toBooleanConditionAst,
} from "../../../core/semantic/boolean-context.js";
import { applyConditionBranchNarrowing } from "../../../core/semantic/condition-branch-narrowing.js";
import {
  tryResolvePredicateGuard,
  tryResolveInstanceofGuard,
  isDefinitelyTerminating,
} from "./guard-analysis.js";

// Import from split modules
import {
  emitExprAstCb,
  mergeBranchContextMeta,
  resetBranchFlowState,
  wrapInBlock,
  buildCastLocalDecl,
  buildIsNCondition,
  buildIsPatternCondition,
} from "./branch-context.js";
import {
  tryEmitPredicateGuard,
  tryEmitInGuard,
  tryEmitPropertyTruthinessGuard,
  tryEmitDiscriminantEqualityGuard,
  tryEmitNegatedPredicateGuard,
} from "./if-emit-union-guards.js";
import {
  tryEmitInstanceofGuard,
  tryEmitArrayIsArrayGuard,
  tryEmitNegatedInstanceofGuard,
  tryEmitNullableGuard,
  tryEmitTypeofGuard,
} from "./if-emit-type-guards.js";

/**
 * Emit an if-statement with guard-based union/instanceof/nullable narrowing.
 */
export const emitIfStatementAst = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  // Case A3: In guard ("error" in auth)
  {
    const result = tryEmitInGuard(stmt, context);
    if (result) return result;
  }

  // Case A3b: Property truthiness guard (result.success)
  {
    const result = tryEmitPropertyTruthinessGuard(stmt, context);
    if (result) return result;
  }

  // Case A4: Discriminant equality guard (shape.kind === "circle")
  {
    const result = tryEmitDiscriminantEqualityGuard(stmt, context);
    if (result) return result;
  }

  // Case A2: Instanceof guard (x instanceof Foo)
  {
    const result = tryEmitInstanceofGuard(stmt, context);
    if (result) return result;
  }

  // Case A5: Array.isArray guard
  {
    const result = tryEmitArrayIsArrayGuard(stmt, context);
    if (result) return result;
  }

  // Case A: Predicate guard (isUser(account))
  if (stmt.condition.kind === "call") {
    const result = tryEmitPredicateGuard(stmt, context);
    if (result) return result;
  }

  // Case B: Negated predicate guard (!isUser(account))
  {
    const result = tryEmitNegatedPredicateGuard(stmt, context);
    if (result) return result;
  }

  // Case B2: Negated instanceof guard (!(x instanceof Foo))
  {
    const result = tryEmitNegatedInstanceofGuard(stmt, context);
    if (result) return result;
  }

  // Case C: Logical AND with predicate guard (isUser(a) && a.foo)
  if (stmt.condition.kind === "logical" && stmt.condition.operator === "&&") {
    const left = stmt.condition.left;
    const right = stmt.condition.right;

    if (left.kind === "call") {
      const guard = tryResolvePredicateGuard(left, context);
      if (guard && guard.memberN !== undefined) {
        const { memberN, ctxWithId, receiverAst, escapedNarrow, narrowedMap } =
          guard;

        const outerCondAst = buildIsNCondition(receiverAst, memberN, false);
        const castStmt = buildCastLocalDecl(
          escapedNarrow,
          receiverAst,
          memberN
        );

        const outerThenCtx: EmitterContext = {
          ...ctxWithId,
          narrowedBindings: narrowedMap,
        };

        const [rhsAst, rhsCtxAfterEmit] = emitExpressionAst(
          right,
          outerThenCtx
        );
        const [rhsCondAst, rhsCtxAfterCond] = toBooleanConditionAst(
          right,
          rhsAst,
          rhsCtxAfterEmit
        );

        const [thenStmts, thenCtxAfter] = emitStatementAst(
          stmt.thenStatement,
          rhsCtxAfterCond
        );

        const clearNarrowing = (ctx: EmitterContext): EmitterContext => ({
          ...ctx,
          narrowedBindings: ctxWithId.narrowedBindings,
        });

        let innerElse: CSharpStatementAst | undefined;
        let currentCtx = thenCtxAfter;
        if (stmt.elseStatement) {
          const [innerElseStmts, innerElseCtx] = emitStatementAst(
            stmt.elseStatement,
            clearNarrowing(currentCtx)
          );
          innerElse = wrapInBlock(innerElseStmts);
          currentCtx = innerElseCtx;
        }

        const innerIf: CSharpStatementAst = {
          kind: "ifStatement",
          condition: rhsCondAst,
          thenStatement: wrapInBlock(thenStmts),
          elseStatement: innerElse,
        };

        const outerThenBlock: CSharpStatementAst = {
          kind: "blockStatement",
          statements: [castStmt, innerIf],
        };

        let outerElse: CSharpStatementAst | undefined;
        let finalContext = clearNarrowing(currentCtx);
        if (stmt.elseStatement) {
          const [outerElseStmts, outerElseCtx] = emitStatementAst(
            stmt.elseStatement,
            finalContext
          );
          outerElse = wrapInBlock(outerElseStmts);
          finalContext = outerElseCtx;
        }

        return [
          [
            {
              kind: "ifStatement",
              condition: outerCondAst,
              thenStatement: outerThenBlock,
              elseStatement: outerElse,
            },
          ],
          finalContext,
        ];
      }
    }

    // Case C2: Logical AND with instanceof (x instanceof Foo && x.foo)
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
        const [thenStmts, thenCtxAfter] = emitStatementAst(
          stmt.thenStatement,
          thenCtx
        );

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

  const thenCtx = applyConditionBranchNarrowing(
    stmt.condition,
    "truthy",
    condCtxAfterCond,
    emitExprAstCb
  );
  const [thenStmts, thenContext] = emitStatementAst(
    stmt.thenStatement,
    thenCtx
  );
  const thenTerminates = isDefinitelyTerminating(stmt.thenStatement);
  const basePostConditionContext = resetBranchFlowState(
    condCtxAfterCond,
    thenContext
  );
  let finalContext: EmitterContext = thenTerminates
    ? applyConditionBranchNarrowing(
        stmt.condition,
        "falsy",
        basePostConditionContext,
        emitExprAstCb
      )
    : basePostConditionContext;

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseEntryContext = applyConditionBranchNarrowing(
      stmt.condition,
      "falsy",
      {
        ...basePostConditionContext,
        narrowedBindings: condCtxAfterCond.narrowedBindings,
      },
      emitExprAstCb
    );
    const [elseStmts, elseContext] = emitStatementAst(
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
      finalContext = mergeBranchContextMeta(
        resetBranchFlowState(condCtxAfterCond, elseContext),
        thenContext
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
