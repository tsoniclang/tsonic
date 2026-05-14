/**
 * Shared helpers for yield-lowering-pass tests.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { runYieldLoweringPass } from "../yield-lowering-pass.js";
import {
  IrModule,
  IrStatement,
  IrExpression,
  IrExpressionStatement,
  IrBlockStatement,
  IrYieldStatement,
} from "../../types.js";
import { createIfBranchPlans } from "../../converters/statements/control/if-branch-plan.js";

export { describe, it, expect, runYieldLoweringPass };
export type {
  IrModule,
  IrStatement,
  IrExpression,
  IrExpressionStatement,
  IrBlockStatement,
  IrYieldStatement,
};

/**
 * Assert value is not null/undefined and return it typed as non-null.
 */
export const assertDefined = <T>(
  value: T | null | undefined,
  msg?: string
): T => {
  if (value === null || value === undefined) {
    throw new Error(msg ?? "Expected value to be defined");
  }
  return value;
};

const normalizeTestBlock = (block: IrBlockStatement): IrBlockStatement => ({
  ...block,
  statements: block.statements.map(normalizeTestStatement),
});

const normalizeTestStatement = (statement: unknown): IrStatement => {
  const stmt = statement as IrStatement;

  switch (stmt.kind) {
    case "blockStatement":
      return normalizeTestBlock(stmt);
    case "ifStatement": {
      const branchPlans =
        stmt.thenPlan && stmt.elsePlan
          ? { thenPlan: stmt.thenPlan, elsePlan: stmt.elsePlan }
          : createIfBranchPlans(stmt.condition);
      return {
        ...stmt,
        thenStatement: normalizeTestStatement(stmt.thenStatement),
        ...(stmt.elseStatement
          ? { elseStatement: normalizeTestStatement(stmt.elseStatement) }
          : {}),
        ...branchPlans,
      };
    }
    case "whileStatement":
      return { ...stmt, body: normalizeTestStatement(stmt.body) };
    case "forStatement":
      return { ...stmt, body: normalizeTestStatement(stmt.body) };
    case "forOfStatement":
    case "forInStatement":
      return { ...stmt, body: normalizeTestStatement(stmt.body) };
    case "switchStatement":
      return {
        ...stmt,
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          statements: switchCase.statements.map(normalizeTestStatement),
        })),
      };
    case "tryStatement":
      return {
        ...stmt,
        tryBlock: normalizeTestStatement(stmt.tryBlock) as IrBlockStatement,
        ...(stmt.catchClause
          ? {
              catchClause: {
                ...stmt.catchClause,
                body: normalizeTestStatement(
                  stmt.catchClause.body
                ) as IrBlockStatement,
              },
            }
          : {}),
        ...(stmt.finallyBlock
          ? {
              finallyBlock: normalizeTestStatement(
                stmt.finallyBlock
              ) as IrBlockStatement,
            }
          : {}),
      };
    default:
      return stmt;
  }
};

/**
 * Helper to create a minimal generator function module
 */
export const createGeneratorModule = (
  body: readonly unknown[],
  options: {
    isGenerator?: boolean;
    returnType?: IrModule["body"][0] extends { returnType?: infer R }
      ? R
      : never;
  } = {}
): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "Test",
  className: "test",
  isStaticContainer: true,
  imports: [],
  body: [
    {
      kind: "functionDeclaration",
      name: "testGen",
      parameters: [],
      returnType: options.returnType ?? {
        kind: "referenceType",
        name: "Generator",
        typeArguments: [
          { kind: "primitiveType", name: "number" },
          { kind: "voidType" },
          { kind: "primitiveType", name: "number" },
        ],
      },
      body: {
        kind: "blockStatement",
        statements: body.map(normalizeTestStatement),
      },
      isAsync: false,
      isGenerator: options.isGenerator ?? true,
      isExported: true,
    },
  ],
  exports: [],
});

/**
 * Helper to create a yield expression
 */
export const createYield = (
  value?: IrExpression,
  delegate = false
): IrExpression => ({
  kind: "yield",
  expression: value,
  delegate,
});

/**
 * Helper to extract the function body from a module
 */
export const getGeneratorBody = (module: IrModule): readonly IrStatement[] => {
  const func = module.body[0];
  if (func?.kind === "functionDeclaration") {
    return func.body.statements;
  }
  return [];
};

export const getTempNameFromSingleDeclarator = (stmt: IrStatement): string => {
  expect(stmt.kind).to.equal("variableDeclaration");
  const decl = (stmt as Extract<IrStatement, { kind: "variableDeclaration" }>)
    .declarations[0];
  expect(decl?.name.kind).to.equal("identifierPattern");
  return (
    (decl?.name as { kind: "identifierPattern"; name: string }) ?? {
      name: "",
    }
  ).name;
};
