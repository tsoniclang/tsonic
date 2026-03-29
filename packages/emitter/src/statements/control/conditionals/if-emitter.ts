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
  tryResolveInstanceofGuard,
  isDefinitelyTerminating,
} from "./guard-analysis.js";

// Import from split modules
import {
  emitExprAstCb,
  mergeBranchContextMeta,
  resetBranchFlowState,
  wrapInBlock,
  buildIsPatternCondition,
} from "./branch-context.js";
import {
  tryEmitInGuard,
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

  // Case B2: Negated instanceof guard (!(x instanceof Foo))
  {
    const result = tryEmitNegatedInstanceofGuard(stmt, context);
    if (result) return result;
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
  const semanticCondContext: EmitterContext = {
    ...condCtxAfterCond,
    narrowedBindings: context.narrowedBindings,
  };

  const thenCtx = applyConditionBranchNarrowing(
    stmt.condition,
    "truthy",
    semanticCondContext,
    emitExprAstCb
  );
  const [thenStmts, thenContext] = emitStatementAst(
    stmt.thenStatement,
    thenCtx
  );
  const thenTerminates = isDefinitelyTerminating(stmt.thenStatement);
  const basePostConditionContext = resetBranchFlowState(
    semanticCondContext,
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
        ...semanticCondContext,
        tempVarId: basePostConditionContext.tempVarId,
        usings: basePostConditionContext.usings,
        usedLocalNames: basePostConditionContext.usedLocalNames,
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
        resetBranchFlowState(semanticCondContext, elseContext),
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
