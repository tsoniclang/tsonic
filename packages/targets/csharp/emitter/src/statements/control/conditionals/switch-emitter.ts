/**
 * Switch statement emitter - returns CSharpStatementAst nodes.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import type {
  CSharpStatementAst,
  CSharpSwitchLabelAst,
  CSharpSwitchSectionAst,
} from "../../../core/format/backend-ast/types.js";

/**
 * Emit a switch statement as AST
 */
export const emitSwitchStatementAst = (
  stmt: Extract<IrStatement, { kind: "switchStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const [exprAst, exprContext] = emitExpressionAst(stmt.expression, context);

  let currentContext = exprContext;
  const sections: CSharpSwitchSectionAst[] = [];
  let pendingLabels: CSharpSwitchLabelAst[] = [];

  for (const switchCase of stmt.cases) {
    // Build label for this case
    const label: CSharpSwitchLabelAst = switchCase.test
      ? (() => {
          const [testAst, testContext] = emitExpressionAst(
            switchCase.test,
            currentContext
          );
          currentContext = testContext;
          return { kind: "caseSwitchLabel" as const, value: testAst };
        })()
      : { kind: "defaultSwitchLabel" as const };

    pendingLabels = [...pendingLabels, label];

    // Empty bodies represent intentional fall-through labels (TypeScript semantics).
    if (switchCase.statements.length === 0) {
      continue;
    }

    // Emit body statements
    const bodyStatements: CSharpStatementAst[] = [];
    for (const s of switchCase.statements) {
      const [stmts, newContext] = emitStatementAst(s, currentContext);
      bodyStatements.push(...stmts);
      currentContext = newContext;
    }

    // Emit break only when case has non-empty body that doesn't terminate.
    const lastStmt = switchCase.statements[switchCase.statements.length - 1];
    const terminates =
      lastStmt?.kind === "breakStatement" ||
      lastStmt?.kind === "returnStatement" ||
      lastStmt?.kind === "throwStatement";
    if (!terminates) {
      bodyStatements.push({ kind: "breakStatement" });
    }

    sections.push({ labels: pendingLabels, statements: bodyStatements });
    pendingLabels = [];
  }

  // Flush any trailing fall-through labels (edge case: empty default at end)
  if (pendingLabels.length > 0) {
    sections.push({
      labels: pendingLabels,
      statements: [{ kind: "breakStatement" }],
    });
  }

  const switchStmt: CSharpStatementAst = {
    kind: "switchStatement",
    expression: exprAst,
    sections,
  };

  return [[switchStmt], currentContext];
};
