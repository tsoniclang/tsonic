import {
  createIfBranchPlans,
  type IrBlockStatement,
  type IrClassMember,
  type IrModule as FrontendIrModule,
  type IrStatement,
} from "@tsonic/frontend";
import { emitModule as emitStrictModule } from "./emitter.js";
import type { EmitterOptions } from "./types.js";

export type TestIrModule = Omit<FrontendIrModule, "body"> & {
  readonly body: readonly unknown[];
};

const normalizeBlock = (block: IrBlockStatement): IrBlockStatement => ({
  ...block,
  statements: block.statements.map(normalizeTestIrStatement),
});

const normalizeClassMember = (member: IrClassMember): IrClassMember => {
  switch (member.kind) {
    case "methodDeclaration":
    case "constructorDeclaration":
      return member.body
        ? { ...member, body: normalizeBlock(member.body) }
        : member;
    case "propertyDeclaration":
      return member;
  }
};

export const normalizeTestIrStatement = (statement: unknown): IrStatement => {
  const stmt = statement as IrStatement;

  switch (stmt.kind) {
    case "blockStatement":
      return normalizeBlock(stmt);
    case "functionDeclaration":
      return { ...stmt, body: normalizeBlock(stmt.body) };
    case "classDeclaration":
      return { ...stmt, members: stmt.members.map(normalizeClassMember) };
    case "ifStatement": {
      const branchPlans =
        stmt.thenPlan && stmt.elsePlan
          ? { thenPlan: stmt.thenPlan, elsePlan: stmt.elsePlan }
          : createIfBranchPlans(stmt.condition);
      return {
        ...stmt,
        thenStatement: normalizeTestIrStatement(stmt.thenStatement),
        ...(stmt.elseStatement
          ? { elseStatement: normalizeTestIrStatement(stmt.elseStatement) }
          : {}),
        ...branchPlans,
      };
    }
    case "whileStatement":
      return { ...stmt, body: normalizeTestIrStatement(stmt.body) };
    case "forStatement":
      return { ...stmt, body: normalizeTestIrStatement(stmt.body) };
    case "forOfStatement":
    case "forInStatement":
      return { ...stmt, body: normalizeTestIrStatement(stmt.body) };
    case "switchStatement":
      return {
        ...stmt,
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          statements: switchCase.statements.map(normalizeTestIrStatement),
        })),
      };
    case "tryStatement":
      return {
        ...stmt,
        tryBlock: normalizeTestIrStatement(stmt.tryBlock) as IrBlockStatement,
        ...(stmt.catchClause
          ? {
              catchClause: {
                ...stmt.catchClause,
                body: normalizeTestIrStatement(
                  stmt.catchClause.body
                ) as IrBlockStatement,
              },
            }
          : {}),
        ...(stmt.finallyBlock
          ? {
              finallyBlock: normalizeTestIrStatement(
                stmt.finallyBlock
              ) as IrBlockStatement,
            }
          : {}),
      };
    default:
      return stmt;
  }
};

export const normalizeTestIrModule = (
  module: TestIrModule
): FrontendIrModule => ({
  ...module,
  body: module.body.map(normalizeTestIrStatement),
});

export const emitModule = (
  module: TestIrModule,
  options: Partial<EmitterOptions> = {}
): string => emitStrictModule(normalizeTestIrModule(module), options);
