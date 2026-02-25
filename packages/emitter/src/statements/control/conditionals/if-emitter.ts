/**
 * If-statement emitter with union/instanceof/nullable guard narrowing.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent, dedent } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitIdentifier } from "../../../expressions/identifiers.js";
import { printExpression } from "../../../core/format/backend-ast/printer.js";
import { emitStatement } from "../../../statement-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import {
  emitBooleanCondition,
  toBooleanCondition,
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

/**
 * Emit a forced block with a preamble line (e.g., var narrowed = x.AsN()).
 * If bodyStmt is already a block, emits its statements directly to avoid nesting.
 */
const emitForcedBlockWithPreamble = (
  preambleLine: string,
  bodyStmt: IrStatement,
  bodyCtx: EmitterContext,
  outerInd: string
): [string, EmitterContext] => {
  const parts: string[] = [preambleLine];

  const emitBodyStatements = (
    statements: readonly IrStatement[],
    ctx: EmitterContext
  ): EmitterContext => {
    let currentCtx = ctx;
    for (const s of statements) {
      const [code, next] = emitStatement(s, currentCtx);
      parts.push(code);
      currentCtx = next;
    }
    return currentCtx;
  };

  const finalCtx =
    bodyStmt.kind === "blockStatement"
      ? emitBodyStatements(bodyStmt.statements, bodyCtx)
      : (() => {
          const [code, next] = emitStatement(bodyStmt, bodyCtx);
          parts.push(code);
          return next;
        })();

  const blockBody = parts.join("\n");
  const code = `${outerInd}{\n${blockBody}\n${outerInd}}`;
  return [code, finalCtx];
};

/**
 * Emit an if statement
 */
export const emitIfStatement = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  // Case A: if (isUser(account)) { ... }
  // Predicate narrowing rewrite → if (account.IsN()) { var account__N_k = account.AsN(); ... }
  if (stmt.condition.kind === "call") {
    const guard = tryResolvePredicateGuard(stmt.condition, context);
    if (guard) {
      const { memberN, ctxWithId, escapedOrig, escapedNarrow, narrowedMap } =
        guard;
      const condText = `${escapedOrig}.Is${memberN}()`;

      const thenCtx: EmitterContext = {
        ...indent(ctxWithId),
        narrowedBindings: narrowedMap,
      };

      const thenInd = getIndent(thenCtx);
      const castLine = `${thenInd}var ${escapedNarrow} = ${escapedOrig}.As${memberN}();`;

      const [thenCode, thenBodyCtx] = emitForcedBlockWithPreamble(
        castLine,
        stmt.thenStatement,
        thenCtx,
        ind
      );

      let finalContext = dedent(thenBodyCtx);
      finalContext = {
        ...finalContext,
        narrowedBindings: ctxWithId.narrowedBindings,
      };

      let code = `${ind}if (${condText})\n${thenCode}`;

      if (stmt.elseStatement) {
        const [elseCode, elseCtx] = emitStatement(
          stmt.elseStatement,
          indent(finalContext)
        );
        code += `\n${ind}else\n${elseCode}`;
        finalContext = dedent(elseCtx);
      }

      return [code, finalContext];
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

    const condText = `${escapedOrig}.Is${memberN}()`;

    const thenCtx: EmitterContext = {
      ...indent(ctxWithId),
      narrowedBindings: narrowedMap,
    };

    const thenInd = getIndent(thenCtx);
    const castLine = `${thenInd}var ${escapedNarrow} = ${escapedOrig}.As${memberN}();`;

    const [thenCode, thenBodyCtx] = emitForcedBlockWithPreamble(
      castLine,
      stmt.thenStatement,
      thenCtx,
      ind
    );

    let finalContext = dedent(thenBodyCtx);

    let code = `${ind}if (${condText})\n${thenCode}`;

    // Optional else branch narrowing (2-member unions only)
    if (stmt.elseStatement) {
      if (unionArity === 2) {
        const otherMemberN = memberN === 1 ? 2 : 1;
        const inlineExpr = `(${escapedOrig}.As${otherMemberN}())`;
        const elseNarrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
        elseNarrowedMap.set(originalName, {
          kind: "expr",
          exprText: inlineExpr,
        });

        const elseCtx: EmitterContext = {
          ...indent({ ...finalContext, narrowedBindings: elseNarrowedMap }),
        };

        const [elseCode, elseCtxAfter] = emitStatement(
          stmt.elseStatement,
          elseCtx
        );
        code += `\n${ind}else\n${elseCode}`;
        finalContext = dedent(elseCtxAfter);
        finalContext = {
          ...finalContext,
          narrowedBindings: ctxWithId.narrowedBindings,
        };
        return [code, finalContext];
      }

      // If we can't narrow ELSE safely, emit it without narrowing.
      const [elseCode, elseCtx] = emitStatement(
        stmt.elseStatement,
        indent({
          ...finalContext,
          narrowedBindings: ctxWithId.narrowedBindings,
        })
      );
      code += `\n${ind}else\n${elseCode}`;
      finalContext = dedent(elseCtx);
      finalContext = {
        ...finalContext,
        narrowedBindings: ctxWithId.narrowedBindings,
      };
      return [code, finalContext];
    }

    // Post-if narrowing for early-exit patterns (2-member unions only):
    // if (auth.Is2()) return ...;
    // // auth is now member 1 in the remainder
    if (unionArity === 2 && isDefinitelyTerminating(stmt.thenStatement)) {
      const otherMemberN = memberN === 1 ? 2 : 1;
      const inlineExpr = `(${escapedOrig}.As${otherMemberN}())`;
      const postMap = new Map(ctxWithId.narrowedBindings ?? []);
      postMap.set(originalName, { kind: "expr", exprText: inlineExpr });
      finalContext = { ...finalContext, narrowedBindings: postMap };
      return [code, finalContext];
    }

    // Restore narrowedBindings to the incoming scope.
    finalContext = {
      ...finalContext,
      narrowedBindings: ctxWithId.narrowedBindings,
    };
    return [code, finalContext];
  }

  // Case A4: if (shape.kind === "circle") { ... }
  // Discriminant literal equality narrowing → if (shape.IsN()) / if (!shape.IsN())
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
    const condText = isInequality
      ? `!${escapedOrig}.Is${memberN}()`
      : `${escapedOrig}.Is${memberN}()`;

    let code = `${ind}if (${condText})`;
    let finalContext: EmitterContext = ctxWithId;

    // Equality: narrow THEN to memberN. Inequality: narrow ELSE to memberN.
    if (!isInequality) {
      const thenCtx: EmitterContext = {
        ...indent(ctxWithId),
        narrowedBindings: narrowedMap,
      };
      const thenInd = getIndent(thenCtx);
      const castLine = `${thenInd}var ${escapedNarrow} = ${escapedOrig}.As${memberN}();`;
      const [thenCode, thenBodyCtx] = emitForcedBlockWithPreamble(
        castLine,
        stmt.thenStatement,
        thenCtx,
        ind
      );
      code += `\n${thenCode}`;
      finalContext = dedent(thenBodyCtx);

      if (stmt.elseStatement) {
        // Else-branch narrowing only for 2-member unions.
        if (unionArity === 2) {
          const otherMemberN = memberN === 1 ? 2 : 1;
          const inlineExpr = `(${escapedOrig}.As${otherMemberN}())`;
          const elseNarrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
          elseNarrowedMap.set(originalName, {
            kind: "expr",
            exprText: inlineExpr,
          });

          const elseCtx: EmitterContext = {
            ...indent({ ...finalContext, narrowedBindings: elseNarrowedMap }),
          };

          const [elseCode, elseCtxAfter] = emitStatement(
            stmt.elseStatement,
            elseCtx
          );
          code += `\n${ind}else\n${elseCode}`;
          finalContext = dedent(elseCtxAfter);
          finalContext = {
            ...finalContext,
            narrowedBindings: ctxWithId.narrowedBindings,
          };
          return [code, finalContext];
        }

        const [elseCode, elseCtx] = emitStatement(
          stmt.elseStatement,
          indent({
            ...finalContext,
            narrowedBindings: ctxWithId.narrowedBindings,
          })
        );
        code += `\n${ind}else\n${elseCode}`;
        finalContext = dedent(elseCtx);
        finalContext = {
          ...finalContext,
          narrowedBindings: ctxWithId.narrowedBindings,
        };
        return [code, finalContext];
      }

      // Post-if narrowing for early-exit patterns (2-member unions only).
      if (unionArity === 2 && isDefinitelyTerminating(stmt.thenStatement)) {
        const otherMemberN = memberN === 1 ? 2 : 1;
        const inlineExpr = `(${escapedOrig}.As${otherMemberN}())`;
        const postMap = new Map(ctxWithId.narrowedBindings ?? []);
        postMap.set(originalName, { kind: "expr", exprText: inlineExpr });
        finalContext = { ...finalContext, narrowedBindings: postMap };
        return [code, finalContext];
      }

      finalContext = {
        ...finalContext,
        narrowedBindings: ctxWithId.narrowedBindings,
      };
      return [code, finalContext];
    }

    // Inequality: THEN is "not memberN" (no narrowing unless arity==2), ELSE is memberN.
    {
      // Emit THEN (optionally narrowed to other member when arity==2).
      const [thenCode, thenCtxAfter] = (() => {
        if (unionArity === 2) {
          const otherMemberN = memberN === 1 ? 2 : 1;
          const inlineExpr = `(${escapedOrig}.As${otherMemberN}())`;
          const thenNarrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
          thenNarrowedMap.set(originalName, {
            kind: "expr",
            exprText: inlineExpr,
          });
          const thenCtx: EmitterContext = {
            ...indent({ ...ctxWithId, narrowedBindings: thenNarrowedMap }),
          };
          return emitStatement(stmt.thenStatement, thenCtx);
        }
        return emitStatement(
          stmt.thenStatement,
          indent({ ...ctxWithId, narrowedBindings: ctxWithId.narrowedBindings })
        );
      })();

      code += `\n${thenCode}`;
      finalContext = dedent(thenCtxAfter);

      if (stmt.elseStatement) {
        const elseCtx: EmitterContext = {
          ...indent(ctxWithId),
          narrowedBindings: narrowedMap,
        };
        const elseInd = getIndent(elseCtx);
        const castLine = `${elseInd}var ${escapedNarrow} = ${escapedOrig}.As${memberN}();`;
        const [elseCode, elseBodyCtx] = emitForcedBlockWithPreamble(
          castLine,
          stmt.elseStatement,
          elseCtx,
          ind
        );
        code += `\n${ind}else\n${elseCode}`;
        finalContext = dedent(elseBodyCtx);
        finalContext = {
          ...finalContext,
          narrowedBindings: ctxWithId.narrowedBindings,
        };
        return [code, finalContext];
      }

      // Post-if narrowing for early-exit patterns (2-member unions only):
      // if (!x.IsN()) return ...;
      // // x is now member N
      if (unionArity === 2 && isDefinitelyTerminating(stmt.thenStatement)) {
        const inlineExpr = `(${escapedOrig}.As${memberN}())`;
        const postMap = new Map(ctxWithId.narrowedBindings ?? []);
        postMap.set(originalName, { kind: "expr", exprText: inlineExpr });
        finalContext = { ...finalContext, narrowedBindings: postMap };
        return [code, finalContext];
      }

      finalContext = {
        ...finalContext,
        narrowedBindings: ctxWithId.narrowedBindings,
      };
      return [code, finalContext];
    }
  }

  // Case A2: if (x instanceof Foo) { ... }
  // C# pattern var narrowing → if (x is Foo x__is_k) { ... } (then-branch sees narrowed x)
  const instanceofGuard = tryResolveInstanceofGuard(stmt.condition, context);
  if (instanceofGuard) {
    const {
      ctxAfterRhs,
      escapedOrig,
      escapedNarrow,
      rhsTypeText,
      narrowedMap,
    } = instanceofGuard;

    const condText = `${escapedOrig} is ${rhsTypeText} ${escapedNarrow}`;

    const thenCtx: EmitterContext = {
      ...indent(ctxAfterRhs),
      narrowedBindings: narrowedMap,
    };
    const [thenCode, thenCtxAfter] = emitStatement(stmt.thenStatement, thenCtx);

    let code = `${ind}if (${condText})\n${thenCode}`;
    let finalContext = dedent(thenCtxAfter);
    finalContext = {
      ...finalContext,
      narrowedBindings: ctxAfterRhs.narrowedBindings,
    };

    if (stmt.elseStatement) {
      const [elseCode, elseCtx] = emitStatement(
        stmt.elseStatement,
        indent(finalContext)
      );
      code += `\n${ind}else\n${elseCode}`;
      finalContext = dedent(elseCtx);
    }

    return [code, finalContext];
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

      const condText = `!${escapedOrig}.Is${memberN}()`;

      // For 2-member unions: narrow THEN branch to the OTHER member
      // For N>2 unions: can't narrow THEN to a single type (it could be any of N-1 members)
      let thenCode: string;
      let thenCtx: EmitterContext;

      if (unionArity === 2) {
        // Calculate the other member index (if memberN is 1, other is 2; if memberN is 2, other is 1)
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

        const thenCtxNarrowed: EmitterContext = {
          ...indent(thenCtxWithId),
          narrowedBindings: thenNarrowedMap,
        };
        const thenInd = getIndent(thenCtxNarrowed);
        const thenCastLine = `${thenInd}var ${escapedThenNarrow} = ${escapedOrig}.As${otherMemberN}();`;

        [thenCode, thenCtx] = emitForcedBlockWithPreamble(
          thenCastLine,
          stmt.thenStatement,
          thenCtxNarrowed,
          ind
        );
      } else {
        // N>2 unions: can't narrow THEN branch to a single type
        [thenCode, thenCtx] = emitStatement(
          stmt.thenStatement,
          indent(context)
        );
      }

      // else branch: narrowing applies (to guard's target type)
      const elseCtxNarrowed: EmitterContext = {
        ...indent(ctxWithId),
        narrowedBindings: narrowedMap,
      };
      const elseInd = getIndent(elseCtxNarrowed);
      const castLine = `${elseInd}var ${escapedNarrow} = ${escapedOrig}.As${memberN}();`;

      const [elseBlock, _elseBodyCtx] = emitForcedBlockWithPreamble(
        castLine,
        stmt.elseStatement,
        elseCtxNarrowed,
        ind
      );

      // Note: narrow bindings should not leak from if-else branches
      // We return thenCtx to preserve original semantics
      const code = `${ind}if (${condText})\n${thenCode}\n${ind}else\n${elseBlock}`;
      return [code, dedent(thenCtx)];
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

      const condText = `${escapedOrig} is ${rhsTypeText} ${escapedNarrow}`;

      // THEN branch is the original ELSE (narrowed)
      const thenCtx: EmitterContext = {
        ...indent(ctxAfterRhs),
        narrowedBindings: narrowedMap,
      };
      const [thenCode, thenCtxAfter] = emitStatement(
        stmt.elseStatement,
        thenCtx
      );

      // ELSE branch is the original THEN (not narrowed)
      const [elseCode, elseCtxAfter] = emitStatement(
        stmt.thenStatement,
        indent({
          ...dedent(thenCtxAfter),
          narrowedBindings: ctxAfterRhs.narrowedBindings,
        })
      );

      const code = `${ind}if (${condText})\n${thenCode}\n${ind}else\n${elseCode}`;
      return [code, dedent(elseCtxAfter)];
    }
  }

  // Case C: if (isUser(account) && account.foo) { ... }
  // Logical AND with predicate guard on left → nested-if lowering (preserves short-circuit)
  if (stmt.condition.kind === "logical" && stmt.condition.operator === "&&") {
    const left = stmt.condition.left;
    const right = stmt.condition.right;

    if (left.kind === "call") {
      const guard = tryResolvePredicateGuard(left, context);
      if (guard) {
        const { memberN, ctxWithId, escapedOrig, escapedNarrow, narrowedMap } =
          guard;

        // Outer: if (x.IsN())
        const outerCond = `${escapedOrig}.Is${memberN}()`;

        // Outer-then creates narrowed var
        const outerThenCtx: EmitterContext = {
          ...indent(ctxWithId),
          narrowedBindings: narrowedMap,
        };
        const outerThenInd = getIndent(outerThenCtx);
        const castLine = `${outerThenInd}var ${escapedNarrow} = ${escapedOrig}.As${memberN}();`;

        // Emit RHS condition under narrowed context (TS semantics: rhs sees narrowed x)
        const [rhsAst, rhsCtxAfterEmit] = emitExpressionAst(
          right,
          outerThenCtx
        );
        const [rhsCondText, rhsCtxAfterCond] = toBooleanCondition(
          right,
          printExpression(rhsAst),
          rhsCtxAfterEmit
        );

        // When RHS true: emit original THEN under narrowed context
        const [thenCode, thenCtxAfter] = emitStatement(
          stmt.thenStatement,
          indent(rhsCtxAfterCond)
        );

        // Helper to clear narrowing from context
        const clearNarrowing = (ctx: EmitterContext): EmitterContext => ({
          ...ctx,
          narrowedBindings: ctxWithId.narrowedBindings,
        });

        let inner = `${outerThenInd}if (${rhsCondText})\n${thenCode}`;
        let currentCtx = dedent(thenCtxAfter);

        if (stmt.elseStatement) {
          const [elseCode, elseCtx] = emitStatement(
            stmt.elseStatement,
            indent(clearNarrowing(currentCtx))
          );
          inner += `\n${outerThenInd}else\n${elseCode}`;
          currentCtx = dedent(elseCtx);
        }

        const outerThenBlock = `${ind}{\n${castLine}\n${inner}\n${ind}}`;

        // Outer else: emit ELSE as-is (no narrowing)
        let code = `${ind}if (${outerCond})\n${outerThenBlock}`;
        let finalContext = clearNarrowing(currentCtx);

        if (stmt.elseStatement) {
          const [outerElseCode, outerElseCtx] = emitStatement(
            stmt.elseStatement,
            indent(finalContext)
          );
          code += `\n${ind}else\n${outerElseCode}`;
          finalContext = dedent(outerElseCtx);
        }

        return [code, finalContext];
      }
    }

    // Case C2: if (x instanceof Foo && x.foo) { ... }
    // Preserve short-circuit and expose narrowed x in RHS and THEN.
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
        const [rhsCondText, rhsCtxAfterCond] = toBooleanCondition(
          right,
          printExpression(rhsAst),
          rhsCtxAfterEmit
        );

        const condText = `(${escapedOrig} is ${rhsTypeText} ${escapedNarrow} && ${rhsCondText})`;

        const thenCtx: EmitterContext = {
          ...indent(rhsCtxAfterCond),
          narrowedBindings: narrowedMap,
        };
        const [thenCode, thenCtxAfter] = emitStatement(
          stmt.thenStatement,
          thenCtx
        );

        let code = `${ind}if (${condText})\n${thenCode}`;
        let finalContext = dedent(thenCtxAfter);
        finalContext = {
          ...finalContext,
          narrowedBindings: ctxAfterRhs.narrowedBindings,
        };

        if (stmt.elseStatement) {
          const [elseCode, elseCtx] = emitStatement(
            stmt.elseStatement,
            indent(finalContext)
          );
          code += `\n${ind}else\n${elseCode}`;
          finalContext = dedent(elseCtx);
        }

        return [code, finalContext];
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

    // IMPORTANT: Avoid stacking `.Value` when:
    // - we are emitting an else-if chain, and
    // - an outer nullable guard already narrowed the identifier in the else-branch.
    //
    // Example (TS):
    //   if (x === undefined) { ... } else if (x !== undefined) { use(x) }
    //
    // In C#, we might narrow `x` in the outer ELSE (x.Value). If we build a new
    // narrowed binding by reading `x` via emitIdentifier (which consults narrowedBindings),
    // we'd accidentally create `x.Value.Value`.
    //
    // So: build the `.Value` access from the *raw* identifier (respecting CS0136 remaps),
    // but ignoring existing narrowedBindings.
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
      exprText: `${printExpression(idAst)}.Value`,
      type: strippedType,
    });

    // Soundness: In compound conditions (A && B), we must NOT apply "else" narrowing.
    // `!(A && (id == null))` does not imply `id != null` unless A is provably true.
    //
    // Therefore:
    // - For simple guards: allow both THEN (id != null) and ELSE (id == null) narrowing.
    // - For &&-nested guards: only allow THEN narrowing when the guard is `!= null`.
    const isAndCondition =
      stmt.condition.kind === "logical" && stmt.condition.operator === "&&";
    if (isAndCondition && !simpleNullableGuard && !narrowsInThen) {
      // `id == null` inside `&&` - narrowing would only be valid in the THEN branch
      // (and even then it's "id is null", not `.Value`-usable). Skip nullable rewrite.
      // Fall through to standard if emission.
    } else {
      // Emit condition (boolean context)
      const [condText, condCtxAfterCond] = emitBooleanCondition(
        stmt.condition,
        (e, ctx) => {
          const [ast, c] = emitExpressionAst(e, ctx);
          return [{ text: printExpression(ast) }, c];
        },
        context
      );

      // Apply narrowing to appropriate branch
      const thenCtx: EmitterContext = {
        ...indent(condCtxAfterCond),
        narrowedBindings: narrowsInThen
          ? narrowedMap
          : condCtxAfterCond.narrowedBindings,
      };

      const [thenCode, thenCtxAfter] = emitStatement(
        stmt.thenStatement,
        thenCtx
      );

      let code = `${ind}if (${condText})\n${thenCode}`;
      let finalContext = dedent(thenCtxAfter);

      // Clear narrowing after branch
      finalContext = {
        ...finalContext,
        narrowedBindings: context.narrowedBindings,
      };

      if (stmt.elseStatement) {
        const elseCtx: EmitterContext = {
          ...indent(finalContext),
          narrowedBindings: !narrowsInThen
            ? simpleNullableGuard
              ? narrowedMap
              : context.narrowedBindings
            : context.narrowedBindings,
        };
        const [elseCode, elseCtxAfter] = emitStatement(
          stmt.elseStatement,
          elseCtx
        );
        code += `\n${ind}else\n${elseCode}`;
        finalContext = dedent(elseCtxAfter);
        finalContext = {
          ...finalContext,
          narrowedBindings: context.narrowedBindings,
        };
      }

      return [code, finalContext];
    }
  }

  // Standard if-statement emission (no narrowing)
  const [condText, condCtxAfterCond] = emitBooleanCondition(
    stmt.condition,
    (e, ctx) => {
      const [ast, c] = emitExpressionAst(e, ctx);
      return [{ text: printExpression(ast) }, c];
    },
    context
  );

  const [thenCode, thenContext] = emitStatement(
    stmt.thenStatement,
    indent(condCtxAfterCond)
  );

  let code = `${ind}if (${condText})\n${thenCode}`;
  let finalContext = dedent(thenContext);

  if (stmt.elseStatement) {
    const [elseCode, elseContext] = emitStatement(
      stmt.elseStatement,
      indent(finalContext)
    );
    code += `\n${ind}else\n${elseCode}`;
    finalContext = dedent(elseContext);
  }

  return [code, finalContext];
};
