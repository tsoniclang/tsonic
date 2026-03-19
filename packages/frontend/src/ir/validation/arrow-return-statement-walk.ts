/**
 * Arrow Return Finalization — Statement & Block Walkers
 *
 * Recursive statement and block walkers for the arrow return finalization pass.
 * Processes module bodies, class members, and all statement kinds.
 */

import {
  IrModule,
  IrStatement,
  IrExpression,
  IrBlockStatement,
  IrClassMember,
} from "../types.js";

import { processExpression } from "./arrow-return-expression-walk.js";

/**
 * Result of arrow return finalization pass
 */
export type ArrowReturnFinalizationResult = {
  readonly ok: true;
  readonly modules: readonly IrModule[];
};

/**
 * Run arrow return finalization pass on modules
 */
export const runArrowReturnFinalizationPass = (
  modules: readonly IrModule[]
): ArrowReturnFinalizationResult => {
  const processedModules = modules.map(processModule);
  return { ok: true, modules: processedModules };
};

/**
 * Process a single module
 */
const processModule = (module: IrModule): IrModule => ({
  ...module,
  body: module.body.map(processStatement),
  exports: module.exports.map((exp) => {
    switch (exp.kind) {
      case "declaration":
        return {
          ...exp,
          declaration: processStatement(exp.declaration),
        };
      case "default":
        return {
          ...exp,
          expression: processExpression(exp.expression),
        };
      case "named":
      case "reexport":
        return exp;
      default:
        return exp;
    }
  }),
});

/**
 * Process a statement, recursively handling nested expressions
 */
export const processStatement = (stmt: IrStatement): IrStatement => {
  switch (stmt.kind) {
    case "variableDeclaration":
      return {
        ...stmt,
        declarations: stmt.declarations.map((decl) => ({
          ...decl,
          initializer: decl.initializer
            ? processExpression(decl.initializer)
            : undefined,
        })),
      };

    case "functionDeclaration":
      return {
        ...stmt,
        body: processBlockStatement(stmt.body),
      };

    case "classDeclaration":
      return {
        ...stmt,
        members: stmt.members.map(processClassMember),
      };

    case "interfaceDeclaration":
      return stmt;

    case "typeAliasDeclaration":
      return stmt;

    case "expressionStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression),
      };

    case "returnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? processExpression(stmt.expression)
          : undefined,
      };

    case "ifStatement":
      return {
        ...stmt,
        condition: processExpression(stmt.condition),
        thenStatement: processStatement(stmt.thenStatement),
        elseStatement: stmt.elseStatement
          ? processStatement(stmt.elseStatement)
          : undefined,
      };

    case "blockStatement":
      return processBlockStatement(stmt);

    case "forStatement":
      return {
        ...stmt,
        initializer: stmt.initializer
          ? "kind" in stmt.initializer &&
            stmt.initializer.kind === "variableDeclaration"
            ? (processStatement(stmt.initializer) as typeof stmt.initializer)
            : processExpression(stmt.initializer as IrExpression)
          : undefined,
        condition: stmt.condition
          ? processExpression(stmt.condition)
          : undefined,
        update: stmt.update ? processExpression(stmt.update) : undefined,
        body: processStatement(stmt.body),
      };

    case "forOfStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression),
        body: processStatement(stmt.body),
      };

    case "whileStatement":
      return {
        ...stmt,
        condition: processExpression(stmt.condition),
        body: processStatement(stmt.body),
      };

    case "switchStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression),
        cases: stmt.cases.map((c) => ({
          ...c,
          test: c.test ? processExpression(c.test) : undefined,
          statements: c.statements.map(processStatement),
        })),
      };

    case "throwStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: processBlockStatement(stmt.tryBlock),
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: processBlockStatement(stmt.catchClause.body),
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? processBlockStatement(stmt.finallyBlock)
          : undefined,
      };

    case "yieldStatement":
      return {
        ...stmt,
        output: stmt.output ? processExpression(stmt.output) : undefined,
      };

    case "generatorReturnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? processExpression(stmt.expression)
          : undefined,
      };

    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      return stmt;

    default:
      return stmt;
  }
};

/**
 * Process a block statement
 */
export const processBlockStatement = (block: IrBlockStatement): IrBlockStatement => ({
  ...block,
  statements: block.statements.map(processStatement),
});

/**
 * Process a class member
 */
const processClassMember = (member: IrClassMember): IrClassMember => {
  switch (member.kind) {
    case "methodDeclaration":
      return member.body
        ? {
            ...member,
            body: processBlockStatement(member.body),
          }
        : member;

    case "constructorDeclaration":
      return member.body
        ? {
            ...member,
            body: processBlockStatement(member.body),
          }
        : member;

    case "propertyDeclaration":
      return member.initializer
        ? {
            ...member,
            initializer: processExpression(member.initializer),
          }
        : member;

    default:
      return member;
  }
};
