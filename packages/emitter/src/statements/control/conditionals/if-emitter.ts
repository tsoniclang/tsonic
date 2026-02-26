/**
 * If-statement emitter with union/instanceof/nullable guard narrowing.
 * Returns CSharpStatementAst nodes.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitIdentifier } from "../../../expressions/identifiers.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpBlockStatementAst,
} from "../../../core/format/backend-ast/types.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import {
  emitBooleanConditionAst,
  toBooleanConditionAst,
  type EmitExprAstFn,
} from "../../../core/semantic/boolean-context.js";
import {
  tryResolvePredicateGuard,
  tryResolveInstanceofGuard,
  tryResolveInGuard,
  tryResolveDiscriminantEqualityGuard,
  tryResolveSimpleNullableGuard,
  tryResolveNullableGuard,
  isDefinitelyTerminating,
} from "./guard-analysis.js";

/** Standard emitExpressionAst adapter for emitBooleanConditionAst callback. */
const emitExprAstCb: EmitExprAstFn = (e, ctx) => emitExpressionAst(e, ctx);

/**
 * Build AST for a union narrowing expression: (escapedOrig.AsN())
 */
const buildUnionNarrowAst = (
  escapedOrig: string,
  memberN: number
): CSharpExpressionAst => ({
  kind: "parenthesizedExpression",
  expression: {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: { kind: "identifierExpression", identifier: escapedOrig },
      memberName: `As${memberN}`,
    },
    arguments: [],
  },
});

/** Wrap an array of statements in a single statement (block if >1). */
const wrapInBlock = (
  stmts: readonly CSharpStatementAst[]
): CSharpStatementAst => {
  if (stmts.length === 1 && stmts[0]) return stmts[0];
  return { kind: "blockStatement", statements: [...stmts] };
};

/**
 * Emit a forced block with a preamble line as AST.
 * Builds a blockStatement with preamble statements + body statements.
 *
 * If bodyStmt is already a block, its statements are inlined to avoid nesting.
 */
const emitForcedBlockWithPreambleAst = (
  preambleStmts: readonly CSharpStatementAst[],
  bodyStmt: IrStatement,
  bodyCtx: EmitterContext
): [CSharpBlockStatementAst, EmitterContext] => {
  const allStatements: CSharpStatementAst[] = [...preambleStmts];

  const emitBodyStatements = (
    statements: readonly IrStatement[],
    ctx: EmitterContext
  ): EmitterContext => {
    let currentCtx = ctx;
    for (const s of statements) {
      const [stmts, next] = emitStatementAst(s, currentCtx);
      allStatements.push(...stmts);
      currentCtx = next;
    }
    return currentCtx;
  };

  const finalCtx =
    bodyStmt.kind === "blockStatement"
      ? emitBodyStatements(bodyStmt.statements, bodyCtx)
      : (() => {
          const [stmts, next] = emitStatementAst(bodyStmt, bodyCtx);
          allStatements.push(...stmts);
          return next;
        })();

  return [{ kind: "blockStatement", statements: allStatements }, finalCtx];
};

/**
 * Build a `var name = expr.AsN();` statement as AST.
 */
const buildCastLocalDecl = (
  varName: string,
  receiverName: string,
  memberN: number
): CSharpStatementAst => ({
  kind: "localDeclarationStatement",
  modifiers: [],
  type: { kind: "varType" },
  declarators: [
    {
      name: varName,
      initializer: {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: {
            kind: "identifierExpression",
            identifier: receiverName,
          },
          memberName: `As${memberN}`,
        },
        arguments: [],
      },
    },
  ],
});

/**
 * Build the condition expression `orig.IsN()` or `!orig.IsN()`.
 */
const buildIsNCondition = (
  escapedOrig: string,
  memberN: number,
  negate: boolean
): CSharpExpressionAst => {
  const isCall: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: { kind: "identifierExpression", identifier: escapedOrig },
      memberName: `Is${memberN}`,
    },
    arguments: [],
  };
  return negate
    ? { kind: "prefixUnaryExpression", operatorToken: "!", operand: isCall }
    : isCall;
};

/**
 * Build the condition expression `orig is TypeName varName`.
 */
const buildIsPatternCondition = (
  escapedOrig: string,
  rhsTypeText: string,
  escapedNarrow: string
): CSharpExpressionAst => ({
  kind: "identifierExpression",
  identifier: `${escapedOrig} is ${rhsTypeText} ${escapedNarrow}`,
});

/**
 * Emit an if statement as AST
 */
export const emitIfStatementAst = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  // Case A: if (isUser(account)) { ... }
  // Predicate narrowing rewrite → if (account.IsN()) { var account__N_k = account.AsN(); ... }
  if (stmt.condition.kind === "call") {
    const guard = tryResolvePredicateGuard(stmt.condition, context);
    if (guard) {
      const { memberN, ctxWithId, escapedOrig, escapedNarrow, narrowedMap } =
        guard;

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

      let finalContext: EmitterContext = {
        ...thenBodyCtx,
        narrowedBindings: ctxWithId.narrowedBindings,
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

      const ifStmt: CSharpStatementAst = {
        kind: "ifStatement",
        condition: condAst,
        thenStatement: thenBlock,
        elseStatement: elseStmt,
      };

      return [[ifStmt], finalContext];
    }
  }

  // Case A3: if ("error" in auth) { ... }
  // Union 'in' narrowing rewrite → if (auth.IsN()) { var auth__N_k = auth.AsN(); ... }
  const inGuard = tryResolveInGuard(stmt.condition, context);
  if (inGuard) {
    const {
      originalName,
      memberN,
      unionArity,
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
        const otherMemberN = memberN === 1 ? 2 : 1;
        const exprAst = buildUnionNarrowAst(escapedOrig, otherMemberN);
        const elseNarrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
        elseNarrowedMap.set(originalName, { kind: "expr", exprAst });

        const elseCtx: EmitterContext = {
          ...finalContext,
          narrowedBindings: elseNarrowedMap,
        };

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
    if (unionArity === 2 && isDefinitelyTerminating(stmt.thenStatement)) {
      const otherMemberN = memberN === 1 ? 2 : 1;
      const exprAst = buildUnionNarrowAst(escapedOrig, otherMemberN);
      const postMap = new Map(ctxWithId.narrowedBindings ?? []);
      postMap.set(originalName, { kind: "expr", exprAst });
      finalContext = { ...finalContext, narrowedBindings: postMap };
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
  }

  // Case A4: if (shape.kind === "circle") { ... }
  // Discriminant literal equality narrowing
  const eqGuard = tryResolveDiscriminantEqualityGuard(stmt.condition, context);
  if (eqGuard) {
    const {
      originalName,
      operator,
      memberN,
      unionArity,
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
          const otherMemberN = memberN === 1 ? 2 : 1;
          const exprAst = buildUnionNarrowAst(escapedOrig, otherMemberN);
          const elseNarrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
          elseNarrowedMap.set(originalName, { kind: "expr", exprAst });

          const [elseStmts, elseCtxAfter] = emitStatementAst(
            stmt.elseStatement,
            { ...finalContext, narrowedBindings: elseNarrowedMap }
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
      if (unionArity === 2 && isDefinitelyTerminating(stmt.thenStatement)) {
        const otherMemberN = memberN === 1 ? 2 : 1;
        const exprAst = buildUnionNarrowAst(escapedOrig, otherMemberN);
        const postMap = new Map(ctxWithId.narrowedBindings ?? []);
        postMap.set(originalName, { kind: "expr", exprAst });
        finalContext = { ...finalContext, narrowedBindings: postMap };
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
        const otherMemberN = memberN === 1 ? 2 : 1;
        const exprAst = buildUnionNarrowAst(escapedOrig, otherMemberN);
        const thenNarrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
        thenNarrowedMap.set(originalName, { kind: "expr", exprAst });

        const [thenStmts, thenCtxAfter] = emitStatementAst(stmt.thenStatement, {
          ...ctxWithId,
          narrowedBindings: thenNarrowedMap,
        });
        thenStmt = wrapInBlock(thenStmts);
        thenCtx = thenCtxAfter;
      } else {
        const [thenStmts, thenCtxAfter] = emitStatementAst(
          stmt.thenStatement,
          ctxWithId
        );
        thenStmt = wrapInBlock(thenStmts);
        thenCtx = thenCtxAfter;
      }

      finalContext = thenCtx;

      let elseStmt: CSharpStatementAst | undefined;
      if (stmt.elseStatement) {
        const castStmt = buildCastLocalDecl(
          escapedNarrow,
          escapedOrig,
          memberN
        );
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
      if (unionArity === 2 && isDefinitelyTerminating(stmt.thenStatement)) {
        const exprAst = buildUnionNarrowAst(escapedOrig, memberN);
        const postMap = new Map(ctxWithId.narrowedBindings ?? []);
        postMap.set(originalName, { kind: "expr", exprAst });
        finalContext = { ...finalContext, narrowedBindings: postMap };
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
  }

  // Case A2: if (x instanceof Foo) { ... }
  // C# pattern var narrowing → if (x is Foo x__is_k) { ... }
  const instanceofGuard = tryResolveInstanceofGuard(stmt.condition, context);
  if (instanceofGuard) {
    const {
      ctxAfterRhs,
      escapedOrig,
      escapedNarrow,
      rhsTypeText,
      narrowedMap,
    } = instanceofGuard;

    const condAst = buildIsPatternCondition(
      escapedOrig,
      rhsTypeText,
      escapedNarrow
    );

    const thenCtx: EmitterContext = {
      ...ctxAfterRhs,
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
          condition: condAst,
          thenStatement: wrapInBlock(thenStmts),
          elseStatement: elseStmt,
        },
      ],
      finalContext,
    ];
  }

  // Case B: if (!isUser(account)) { ... } else { ... }
  // Negated guard → for 2-member unions, narrow THEN to OTHER member, ELSE to guard's target
  if (
    stmt.condition.kind === "unary" &&
    stmt.condition.operator === "!" &&
    stmt.condition.expression.kind === "call" &&
    stmt.elseStatement
  ) {
    const innerCall = stmt.condition.expression;
    const guard = tryResolvePredicateGuard(innerCall, context);
    if (guard) {
      const {
        originalName,
        memberN,
        unionArity,
        ctxWithId,
        escapedOrig,
        escapedNarrow,
        narrowedMap,
      } = guard;

      const condAst = buildIsNCondition(escapedOrig, memberN, true);

      // THEN branch: for 2-member unions narrow to OTHER member
      let thenStmt: CSharpStatementAst;
      let thenCtx: EmitterContext;

      if (unionArity === 2) {
        const otherMemberN = memberN === 1 ? 2 : 1;
        const nextId = (ctxWithId.tempVarId ?? 0) + 1;
        const thenCtxWithId: EmitterContext = {
          ...ctxWithId,
          tempVarId: nextId,
        };

        const thenNarrowedName = `${originalName}__${otherMemberN}_${nextId}`;
        const escapedThenNarrow = escapeCSharpIdentifier(thenNarrowedName);

        const thenNarrowedMap = new Map(thenCtxWithId.narrowedBindings ?? []);
        thenNarrowedMap.set(originalName, {
          kind: "rename",
          name: thenNarrowedName,
        });

        const thenCastStmt = buildCastLocalDecl(
          escapedThenNarrow,
          escapedOrig,
          otherMemberN
        );

        const [thenBlock, thenBlockCtx] = emitForcedBlockWithPreambleAst(
          [thenCastStmt],
          stmt.thenStatement,
          { ...thenCtxWithId, narrowedBindings: thenNarrowedMap }
        );
        thenStmt = thenBlock;
        thenCtx = thenBlockCtx;
      } else {
        const [thenStmts, thenCtxAfter] = emitStatementAst(
          stmt.thenStatement,
          context
        );
        thenStmt = wrapInBlock(thenStmts);
        thenCtx = thenCtxAfter;
      }

      // ELSE branch: narrowing applies (to guard's target type)
      const elseCastStmt = buildCastLocalDecl(
        escapedNarrow,
        escapedOrig,
        memberN
      );
      const [elseBlock, _elseBodyCtx] = emitForcedBlockWithPreambleAst(
        [elseCastStmt],
        stmt.elseStatement,
        { ...ctxWithId, narrowedBindings: narrowedMap }
      );

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
  }

  // Case B2: if (!(x instanceof Foo)) { ... } else { ... }
  // Swap branches so ELSE runs under the narrowed pattern var.
  if (
    stmt.condition.kind === "unary" &&
    stmt.condition.operator === "!" &&
    stmt.elseStatement
  ) {
    const inner = stmt.condition.expression;
    const guard = tryResolveInstanceofGuard(inner, context);
    if (guard) {
      const {
        ctxAfterRhs,
        escapedOrig,
        escapedNarrow,
        rhsTypeText,
        narrowedMap,
      } = guard;

      const condAst = buildIsPatternCondition(
        escapedOrig,
        rhsTypeText,
        escapedNarrow
      );

      // THEN branch is the original ELSE (narrowed)
      const thenCtx: EmitterContext = {
        ...ctxAfterRhs,
        narrowedBindings: narrowedMap,
      };
      const [thenStmts, thenCtxAfter] = emitStatementAst(
        stmt.elseStatement,
        thenCtx
      );

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
            thenStatement: wrapInBlock(thenStmts),
            elseStatement: wrapInBlock(elseStmts),
          },
        ],
        elseCtxAfter,
      ];
    }
  }

  // Case C: if (isUser(account) && account.foo) { ... }
  // Logical AND with predicate guard on left → nested-if lowering
  if (stmt.condition.kind === "logical" && stmt.condition.operator === "&&") {
    const left = stmt.condition.left;
    const right = stmt.condition.right;

    if (left.kind === "call") {
      const guard = tryResolvePredicateGuard(left, context);
      if (guard) {
        const { memberN, ctxWithId, escapedOrig, escapedNarrow, narrowedMap } =
          guard;

        const outerCondAst = buildIsNCondition(escapedOrig, memberN, false);
        const castStmt = buildCastLocalDecl(
          escapedNarrow,
          escapedOrig,
          memberN
        );

        // Emit RHS condition under narrowed context
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

        // When RHS true: emit original THEN under narrowed context
        const [thenStmts, thenCtxAfter] = emitStatementAst(
          stmt.thenStatement,
          rhsCtxAfterCond
        );

        const clearNarrowing = (ctx: EmitterContext): EmitterContext => ({
          ...ctx,
          narrowedBindings: ctxWithId.narrowedBindings,
        });

        // Build inner if
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

        // Build outer then block: { cast; innerIf }
        const outerThenBlock: CSharpBlockStatementAst = {
          kind: "blockStatement",
          statements: [castStmt, innerIf],
        };

        // Outer else: emit ELSE as-is (no narrowing)
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

    // Case C2: if (x instanceof Foo && x.foo) { ... }
    if (left.kind === "binary" && left.operator === "instanceof") {
      const guard = tryResolveInstanceofGuard(left, context);
      if (guard) {
        const {
          ctxAfterRhs,
          escapedOrig,
          escapedNarrow,
          rhsTypeText,
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

        // Combined condition: (orig is TypeName narrow && rhsCond)
        const isPatternAst = buildIsPatternCondition(
          escapedOrig,
          rhsTypeText,
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

  // Case D: Nullable value type narrowing
  // if (id !== null) { ... } → id becomes id.Value in then-branch
  const simpleNullableGuard = tryResolveSimpleNullableGuard(stmt.condition);
  const nullableGuard =
    simpleNullableGuard ?? tryResolveNullableGuard(stmt.condition, context);
  if (nullableGuard && nullableGuard.isValueType) {
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

    // Create narrowed binding: id → id.Value
    const narrowedMap = new Map(context.narrowedBindings ?? []);
    narrowedMap.set(key, {
      kind: "expr",
      exprAst: {
        kind: "memberAccessExpression",
        expression: idAst,
        memberName: "Value",
      },
      type: strippedType,
    });

    // Soundness: In compound conditions (A && B), we must NOT apply "else" narrowing.
    const isAndCondition =
      stmt.condition.kind === "logical" && stmt.condition.operator === "&&";
    if (isAndCondition && !simpleNullableGuard && !narrowsInThen) {
      // `id == null` inside `&&` - skip nullable rewrite, fall through to standard.
    } else {
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
    }
  }

  // Standard if-statement emission (no narrowing)
  const [condAst, condCtxAfterCond] = emitBooleanConditionAst(
    stmt.condition,
    emitExprAstCb,
    context
  );

  const [thenStmts, thenContext] = emitStatementAst(
    stmt.thenStatement,
    condCtxAfterCond
  );

  let finalContext = thenContext;

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const [elseStmts, elseContext] = emitStatementAst(
      stmt.elseStatement,
      finalContext
    );
    elseStmt = wrapInBlock(elseStmts);
    finalContext = elseContext;
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
