/**
 * Switch statement emitter - returns CSharpStatementAst nodes.
 */

import type { IrStatement, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { stringLiteral } from "../../../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../../../core/format/backend-ast/types.js";
import { resolveTypeAlias } from "../../../core/semantic/type-resolution.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import type {
  CSharpStatementAst,
  CSharpSwitchLabelAst,
  CSharpSwitchSectionAst,
} from "../../../core/format/backend-ast/types.js";

const exhaustiveSwitchFailureExpression = (): CSharpExpressionAst => ({
  kind: "objectCreationExpression",
  type: {
    kind: "qualifiedIdentifierType",
    name: {
      aliasQualifier: "global",
      segments: ["System", "InvalidOperationException"],
    },
  },
  arguments: [stringLiteral("Unreachable exhaustive switch case.")],
});

const literalKey = (value: string | number | boolean): string =>
  `${typeof value}:${String(value)}`;

const collectFiniteLiteralUnionKeys = (
  type: IrType | undefined,
  context: EmitterContext
): ReadonlySet<string> | undefined => {
  if (!type) {
    return undefined;
  }

  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "literalType") {
    return new Set([literalKey(resolved.value)]);
  }

  if (resolved.kind !== "unionType") {
    return undefined;
  }

  const keys = new Set<string>();
  for (const member of resolved.types) {
    const resolvedMember = resolveTypeAlias(member, context);
    if (resolvedMember.kind !== "literalType") {
      return undefined;
    }
    keys.add(literalKey(resolvedMember.value));
  }

  return keys.size > 0 ? keys : undefined;
};

const getLiteralCaseKey = (
  test: Extract<IrStatement, { kind: "switchStatement" }>["cases"][number]["test"]
): string | undefined => {
  if (!test || test.kind !== "literal") {
    return undefined;
  }
  if (
    typeof test.value !== "string" &&
    typeof test.value !== "number" &&
    typeof test.value !== "boolean"
  ) {
    return undefined;
  }
  return literalKey(test.value);
};

const isExhaustiveLiteralSwitch = (
  stmt: Extract<IrStatement, { kind: "switchStatement" }>,
  context: EmitterContext
): boolean => {
  if (stmt.cases.some((switchCase) => switchCase.test === undefined)) {
    return false;
  }

  const expectedKeys = collectFiniteLiteralUnionKeys(
    stmt.expression.inferredType,
    context
  );
  if (!expectedKeys) {
    return false;
  }

  const handledKeys = new Set<string>();
  for (const switchCase of stmt.cases) {
    const key = getLiteralCaseKey(switchCase.test);
    if (!key) {
      return false;
    }
    handledKeys.add(key);
  }

  for (const key of expectedKeys) {
    if (!handledKeys.has(key)) {
      return false;
    }
  }

  return true;
};

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

  if (isExhaustiveLiteralSwitch(stmt, currentContext)) {
    sections.push({
      labels: [{ kind: "defaultSwitchLabel" }],
      statements: [
        {
          kind: "throwStatement",
          expression: exhaustiveSwitchFailureExpression(),
        },
      ],
    });
  }

  const switchStmt: CSharpStatementAst = {
    kind: "switchStatement",
    expression: exprAst,
    sections,
  };

  return [[switchStmt], currentContext];
};
