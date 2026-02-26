/**
 * Exception handling emitters (try, throw)
 * Returns CSharpStatementAst nodes.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitBlockStatementAst } from "../blocks.js";
import {
  allocateLocalName,
  registerLocalName,
} from "../../core/format/local-names.js";
import type {
  CSharpStatementAst,
  CSharpBlockStatementAst,
  CSharpCatchClauseAst,
} from "../../core/format/backend-ast/types.js";

/**
 * Emit a try statement as AST
 */
export const emitTryStatementAst = (
  stmt: Extract<IrStatement, { kind: "tryStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const [tryBody, tryContext] = emitBlockStatementAst(stmt.tryBlock, context);

  let currentContext = tryContext;
  const catches: CSharpCatchClauseAst[] = [];

  if (stmt.catchClause) {
    const param =
      stmt.catchClause.parameter?.kind === "identifierPattern"
        ? stmt.catchClause.parameter.name
        : "ex";
    const outerMap = currentContext.localNameMap;
    let catchScopeContext: EmitterContext = {
      ...currentContext,
      localNameMap: new Map(outerMap ?? []),
    };

    const alloc = allocateLocalName(param, catchScopeContext);
    catchScopeContext = registerLocalName(
      param,
      alloc.emittedName,
      alloc.context
    );

    const [catchBody, catchContext] = emitBlockStatementAst(
      stmt.catchClause.body,
      catchScopeContext
    );
    catches.push({
      type: {
        kind: "identifierType",
        name: "global::System.Exception",
      },
      identifier: alloc.emittedName,
      body: catchBody,
    });
    currentContext = { ...catchContext, localNameMap: outerMap };
  }

  const finallyResult: {
    finallyBody?: CSharpBlockStatementAst;
    context: EmitterContext;
  } = stmt.finallyBlock
    ? (() => {
        const [fb, fc] = emitBlockStatementAst(
          stmt.finallyBlock!,
          currentContext
        );
        return { finallyBody: fb, context: fc };
      })()
    : { context: currentContext };

  const tryStmt: CSharpStatementAst = {
    kind: "tryStatement",
    body: tryBody,
    catches,
    finallyBody: finallyResult.finallyBody,
  };

  return [[tryStmt], finallyResult.context];
};

/**
 * Emit a throw statement as AST
 */
export const emitThrowStatementAst = (
  stmt: Extract<IrStatement, { kind: "throwStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const [exprAst, newContext] = emitExpressionAst(stmt.expression, context);
  return [[{ kind: "throwStatement", expression: exprAst }], newContext];
};
