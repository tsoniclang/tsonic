/**
 * Conditional statement converters (if, switch)
 *
 * Uses ProgramContext for conditional conversion.
 */

import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
import {
  IrStatement,
  IrIfStatement,
  IrSwitchStatement,
  IrSwitchCase,
  IrType,
  IrVariableDeclaration,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import {
  convertStatementSingle,
  flattenStatementResult,
  convertStatement,
} from "../../../statement-converter.js";
import type { ProgramContext } from "../../../program-context.js";
import { withVariableTypeEnv } from "../../type-env.js";
import { createIfBranchPlans } from "./if-branch-plan.js";
import { definedTstsNodes } from "../helpers.js";
import { withBranchLoweringPlan } from "../../branch-flow-env.js";

/**
 * Convert if statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Passed through to nested statements for return expressions.
 */
export const convertIfStatement = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrIfStatement => {
  const ifStatement = TstsSyntax.AsIfStatement(node);
  if (!ifStatement?.Expression || !ifStatement.ThenStatement) {
    const condition = convertExpression(node, ctx, undefined);
    const branchPlans = createIfBranchPlans(condition, ctx, [], []);
    return {
      kind: "ifStatement",
      condition,
      thenStatement: { kind: "emptyStatement" },
      ...branchPlans,
    };
  }
  const condition = convertExpression(ifStatement.Expression, ctx, undefined);
  const branchPlans = createIfBranchPlans(condition, ctx);
  const thenStmt = convertStatementSingle(
    ifStatement.ThenStatement,
    withBranchLoweringPlan(ctx, branchPlans.thenPlan),
    expectedReturnType
  );
  const elseStmt = ifStatement.ElseStatement
    ? convertStatementSingle(
        ifStatement.ElseStatement,
        withBranchLoweringPlan(ctx, branchPlans.elsePlan),
        expectedReturnType
      )
    : undefined;

  return {
    kind: "ifStatement",
    condition,
    thenStatement: thenStmt ?? { kind: "emptyStatement" },
    elseStatement: elseStmt ?? undefined,
    ...branchPlans,
  };
};

/**
 * Convert switch statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertSwitchStatement = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrSwitchStatement => {
  const switchStatement = TstsSyntax.AsSwitchStatement(node);
  const caseBlock = switchStatement?.CaseBlock
    ? TstsSyntax.AsCaseBlock(switchStatement.CaseBlock)
    : undefined;
  return {
    kind: "switchStatement",
    expression: switchStatement?.Expression
      ? convertExpression(switchStatement.Expression, ctx, undefined)
      : convertExpression(node, ctx, undefined),
    cases: definedTstsNodes(caseBlock?.Clauses?.Nodes).map((clause) =>
      convertSwitchCase(clause, ctx, expectedReturnType)
    ),
  };
};

/**
 * Convert switch case
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertSwitchCase = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrSwitchCase => {
  let currentCtx = ctx;
  const statements: IrStatement[] = [];
  const clause = TstsSyntax.AsCaseOrDefaultClause(node);

  for (const s of definedTstsNodes(clause?.Statements?.Nodes)) {
    const converted = convertStatement(s, currentCtx, expectedReturnType);
    statements.push(...flattenStatementResult(converted));

    if (
      TstsSyntax.IsVariableStatement(s) &&
      converted !== null &&
      !Array.isArray(converted)
    ) {
      const single = converted as IrStatement;
      if (single.kind !== "variableDeclaration") continue;
      const declarationList = TstsSyntax.AsVariableStatement(s)?.DeclarationList;
      currentCtx = withVariableTypeEnv(
        currentCtx,
        definedTstsNodes(
          TstsSyntax.AsVariableDeclarationList(declarationList)?.Declarations
            ?.Nodes
        ),
        single as IrVariableDeclaration
      );
    }
  }

  return {
    kind: "switchCase",
    test: node.Kind === TstsSyntax.KindCaseClause && clause?.Expression
      ? convertExpression(clause.Expression, ctx, undefined)
      : undefined,
    statements,
  };
};
