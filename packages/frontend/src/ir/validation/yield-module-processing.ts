/**
 * Yield Module Processing
 *
 * Non-generator statement recursion, class member processing, and
 * top-level module processing for the yield lowering pass.
 */

import { Diagnostic } from "../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrBlockStatement,
  IrClassMember,
} from "../types.js";

import {
  type LoweringContext,
  flattenStatement,
  addResidualYieldDiagnostics,
} from "./yield-lowering-helpers.js";

import { processStatement } from "./yield-statement-lowering.js";

/**
 * Process statements in non-generator functions (just recurse into nested generators).
 */
export const processNonGeneratorStatement = (
  stmt: IrStatement,
  ctx: LoweringContext
): IrStatement => {
  switch (stmt.kind) {
    case "functionDeclaration":
      if (stmt.isGenerator) {
        const generatorCtx: LoweringContext = {
          ...ctx,
          inGenerator: true,
        };
        const loweredBody = flattenStatement(
          processStatement(stmt.body, generatorCtx)
        ) as IrBlockStatement;
        addResidualYieldDiagnostics(generatorCtx, loweredBody);
        return {
          ...stmt,
          body: loweredBody,
        };
      }
      return {
        ...stmt,
        body: flattenStatement(
          processStatement(stmt.body, ctx)
        ) as IrBlockStatement,
      };

    case "classDeclaration":
      return {
        ...stmt,
        members: stmt.members.map((m) => processClassMember(m, ctx)),
      };

    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((s) =>
          processNonGeneratorStatement(s, ctx)
        ),
      };

    case "ifStatement":
      return {
        ...stmt,
        thenStatement: processNonGeneratorStatement(stmt.thenStatement, ctx),
        elseStatement: stmt.elseStatement
          ? processNonGeneratorStatement(stmt.elseStatement, ctx)
          : undefined,
      };

    case "whileStatement":
      return {
        ...stmt,
        body: processNonGeneratorStatement(stmt.body, ctx),
      };

    case "forStatement":
      // Only process the body - initializer can't contain nested generator functions
      return {
        ...stmt,
        body: processNonGeneratorStatement(stmt.body, ctx),
      };

    case "forOfStatement":
      return {
        ...stmt,
        body: processNonGeneratorStatement(stmt.body, ctx),
      };

    case "switchStatement":
      return {
        ...stmt,
        cases: stmt.cases.map((c) => ({
          ...c,
          statements: c.statements.map((s) =>
            processNonGeneratorStatement(s, ctx)
          ),
        })),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: processNonGeneratorStatement(
          stmt.tryBlock,
          ctx
        ) as IrBlockStatement,
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: processNonGeneratorStatement(
                stmt.catchClause.body,
                ctx
              ) as IrBlockStatement,
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? (processNonGeneratorStatement(
              stmt.finallyBlock,
              ctx
            ) as IrBlockStatement)
          : undefined,
      };

    default:
      return stmt;
  }
};

/**
 * Process class members, looking for generator methods.
 */
export const processClassMember = (
  member: IrClassMember,
  ctx: LoweringContext
): IrClassMember => {
  if (member.kind === "methodDeclaration" && member.body) {
    if (member.isGenerator) {
      const generatorCtx: LoweringContext = {
        ...ctx,
        inGenerator: true,
      };
      const loweredBody = flattenStatement(
        processStatement(member.body, generatorCtx)
      ) as IrBlockStatement;
      addResidualYieldDiagnostics(generatorCtx, loweredBody);
      return {
        ...member,
        body: loweredBody,
      };
    }
    return {
      ...member,
      body: flattenStatement(
        processStatement(member.body, ctx)
      ) as IrBlockStatement,
    };
  }
  if (member.kind === "constructorDeclaration" && member.body) {
    return {
      ...member,
      body: flattenStatement(
        processStatement(member.body, ctx)
      ) as IrBlockStatement,
    };
  }
  return member;
};

/**
 * Process a module, transforming yield expressions in generators.
 */
export const processModule = (
  module: IrModule
): { module: IrModule; diagnostics: readonly Diagnostic[] } => {
  const ctx: LoweringContext = {
    filePath: module.filePath,
    diagnostics: [],
    inGenerator: false,
    yieldTempCounter: 0,
  };

  const processedBody = module.body.map((stmt) => {
    if (stmt.kind === "functionDeclaration" && stmt.isGenerator) {
      const generatorCtx: LoweringContext = {
        ...ctx,
        inGenerator: true,
      };
      const loweredBody = flattenStatement(
        processStatement(stmt.body, generatorCtx)
      ) as IrBlockStatement;
      addResidualYieldDiagnostics(generatorCtx, loweredBody);
      return {
        ...stmt,
        body: loweredBody,
      };
    }
    return processNonGeneratorStatement(stmt, ctx);
  });

  const processedExports = module.exports.map((exp) => {
    if (exp.kind === "declaration") {
      if (
        exp.declaration.kind === "functionDeclaration" &&
        exp.declaration.isGenerator
      ) {
        const generatorCtx: LoweringContext = {
          ...ctx,
          inGenerator: true,
        };
        const loweredBody = flattenStatement(
          processStatement(exp.declaration.body, generatorCtx)
        ) as IrBlockStatement;
        addResidualYieldDiagnostics(generatorCtx, loweredBody);
        return {
          ...exp,
          declaration: {
            ...exp.declaration,
            body: loweredBody,
          },
        };
      }
      return {
        ...exp,
        declaration: processNonGeneratorStatement(exp.declaration, ctx),
      };
    }
    return exp;
  });

  return {
    module: {
      ...module,
      body: processedBody,
      exports: processedExports,
    },
    diagnostics: ctx.diagnostics,
  };
};
