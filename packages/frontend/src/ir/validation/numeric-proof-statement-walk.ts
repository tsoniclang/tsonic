/**
 * Numeric Proof Walk — Statement processing, module processing, and proof pass entry
 *
 * This module handles:
 * - Processing all statements, tracking proven variables
 * - Running the proof pass on modules and aggregating diagnostics
 *
 * CRITICAL: If this pass emits ANY errors, the emitter MUST NOT run.
 */

import { Diagnostic } from "../../types/diagnostic.js";
import { IrModule, IrStatement } from "../types.js";
import {
  type ProofContext,
  cloneProofContext,
  withInt32ProofsFromTruthyCondition,
  getNumericKindFromType,
  inferNumericKind,
} from "./numeric-proof-analysis.js";
import { processExpression } from "./numeric-proof-expression-walk.js";
import type { IrParameter } from "../types.js";

/**
 * Result of numeric proof validation
 */
export type NumericProofResult = {
  readonly ok: boolean;
  readonly module: IrModule;
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Callback type for statement processing, used to break the mutual
 * recursion between expression and statement walkers.
 */
export type StatementProcessor = <T extends IrStatement>(
  stmt: T,
  ctx: ProofContext
) => T;

/**
 * Process a statement, proving numeric narrowings in expressions.
 */
const processStatement = <T extends IrStatement>(
  stmt: T,
  ctx: ProofContext
): T => {
  const processExpr = (
    expr: Parameters<typeof processExpression>[0],
    c: ProofContext
  ) => processExpression(expr, c, processStatement);

  const processParameters = (
    parameters: readonly IrParameter[]
  ): [readonly IrParameter[], ProofContext] => {
    const paramCtx: ProofContext = {
      ...ctx,
      provenParameters: new Map(ctx.provenParameters),
      provenVariables: new Map(ctx.provenVariables),
    };

    const processedParameters = parameters.map((param) => {
      const processedParam: IrParameter = {
        ...param,
        initializer: param.initializer
          ? processExpr(param.initializer, paramCtx)
          : undefined,
      };

      if (param.pattern.kind === "identifierPattern") {
        const numericKind = getNumericKindFromType(param.type);
        if (numericKind !== undefined) {
          paramCtx.provenParameters.set(param.pattern.name, numericKind);
        }
      }

      return processedParam;
    });

    return [processedParameters, paramCtx];
  };

  switch (stmt.kind) {
    case "variableDeclaration": {
      const processedDeclarations = stmt.declarations.map((d) => {
        const processedInit = d.initializer
          ? processExpr(d.initializer, ctx)
          : undefined;

        // Track proven variables from declarations with known numeric kind
        // This includes:
        // 0. Explicit type annotations (authoritative)
        // 1. numericNarrowing with proof (explicit `as int`)
        // 2. Binary/unary expressions that produce known numeric kinds
        // 3. Identifiers with known numeric types
        // We track both const and let (let can be reassigned, but at init we know the type)
        if (d.name.kind === "identifierPattern") {
          // If a variable has an explicit numeric type annotation, that type is authoritative.
          // We must not "re-prove" it from the initializer, or we'll incorrectly treat
          // `let x: long = 1;` as Int32 (because `1` is an Int32 literal by lexeme).
          const declaredKind = getNumericKindFromType(d.type);
          if (declaredKind !== undefined) {
            ctx.provenVariables.set(d.name.name, declaredKind);
          } else if (d.type === undefined && processedInit !== undefined) {
            // First check for explicit numericNarrowing
            if (
              processedInit.kind === "numericNarrowing" &&
              processedInit.proof !== undefined
            ) {
              ctx.provenVariables.set(d.name.name, processedInit.proof.kind);
            } else {
              // Otherwise, try to infer the numeric kind from the expression
              const inferredKind = inferNumericKind(processedInit, ctx);
              if (inferredKind !== undefined) {
                ctx.provenVariables.set(d.name.name, inferredKind);
              }
            }
          }
        }

        return {
          ...d,
          initializer: processedInit,
        };
      });
      return { ...stmt, declarations: processedDeclarations } as T;
    }

    case "functionDeclaration": {
      const [parameters, paramCtx] = processParameters(stmt.parameters);
      return {
        ...stmt,
        parameters,
        body: processStatement(stmt.body, paramCtx),
      } as T;
    }

    case "classDeclaration": {
      const processedMembers = stmt.members.map((m) => {
        if (m.kind === "methodDeclaration" && m.body) {
          const [parameters, methodCtx] = processParameters(m.parameters);
          return {
            ...m,
            parameters,
            body: processStatement(m.body, methodCtx),
          };
        }
        if (m.kind === "propertyDeclaration" && m.initializer) {
          return { ...m, initializer: processExpr(m.initializer, ctx) };
        }
        if (m.kind === "constructorDeclaration" && m.body) {
          const [parameters, ctorCtx] = processParameters(m.parameters);
          return {
            ...m,
            parameters,
            body: processStatement(m.body, ctorCtx),
          };
        }
        return m;
      });
      return { ...stmt, members: processedMembers } as T;
    }

    case "expressionStatement":
      return {
        ...stmt,
        expression: processExpr(stmt.expression, ctx),
      } as T;

    case "returnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? processExpr(stmt.expression, ctx)
          : undefined,
      } as T;

    case "ifStatement": {
      const processedCondition = processExpr(stmt.condition, ctx);
      const thenCtx = withInt32ProofsFromTruthyCondition(
        cloneProofContext(ctx),
        processedCondition
      );
      return {
        ...stmt,
        condition: processedCondition,
        thenStatement: processStatement(stmt.thenStatement, thenCtx),
        elseStatement: stmt.elseStatement
          ? processStatement(stmt.elseStatement, ctx)
          : undefined,
      } as T;
    }

    case "whileStatement":
      return {
        ...stmt,
        condition: processExpr(stmt.condition, ctx),
        body: processStatement(stmt.body, ctx),
      } as T;

    case "forStatement":
      return {
        ...stmt,
        initializer: stmt.initializer
          ? stmt.initializer.kind === "variableDeclaration"
            ? processStatement(stmt.initializer, ctx)
            : processExpr(stmt.initializer, ctx)
          : undefined,
        condition: stmt.condition
          ? processExpr(stmt.condition, ctx)
          : undefined,
        update: stmt.update ? processExpr(stmt.update, ctx) : undefined,
        body: processStatement(stmt.body, ctx),
      } as T;

    case "forOfStatement":
      return {
        ...stmt,
        expression: processExpr(stmt.expression, ctx),
        body: processStatement(stmt.body, ctx),
      } as T;

    case "forInStatement":
      return {
        ...stmt,
        expression: processExpr(stmt.expression, ctx),
        body: processStatement(stmt.body, ctx),
      } as T;

    case "switchStatement":
      return {
        ...stmt,
        expression: processExpr(stmt.expression, ctx),
        cases: stmt.cases.map((c) => ({
          ...c,
          test: c.test ? processExpr(c.test, ctx) : undefined,
          statements: c.statements.map((s) => processStatement(s, ctx)),
        })),
      } as T;

    case "throwStatement":
      return {
        ...stmt,
        expression: processExpr(stmt.expression, ctx),
      } as T;

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: processStatement(stmt.tryBlock, ctx),
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: processStatement(stmt.catchClause.body, ctx),
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? processStatement(stmt.finallyBlock, ctx)
          : undefined,
      } as T;

    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((s) => processStatement(s, ctx)),
      } as T;

    case "yieldStatement":
      return {
        ...stmt,
        output: stmt.output ? processExpr(stmt.output, ctx) : undefined,
      } as T;

    case "generatorReturnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? processExpr(stmt.expression, ctx)
          : undefined,
      } as T;

    default:
      return stmt;
  }
};

/**
 * Run numeric proof pass on a module.
 */
const processModule = (module: IrModule): NumericProofResult => {
  const ctx: ProofContext = {
    filePath: module.filePath,
    diagnostics: [],
    provenVariables: new Map(),
    provenParameters: new Map(),
  };

  const processExpr = (
    expr: Parameters<typeof processExpression>[0],
    c: ProofContext
  ) => processExpression(expr, c, processStatement);

  const processedBody = module.body.map((stmt) => processStatement(stmt, ctx));

  const processedExports = module.exports.map((exp) => {
    if (exp.kind === "default") {
      return { ...exp, expression: processExpr(exp.expression, ctx) };
    }
    if (exp.kind === "declaration") {
      return { ...exp, declaration: processStatement(exp.declaration, ctx) };
    }
    return exp;
  });

  return {
    ok: ctx.diagnostics.length === 0,
    module: {
      ...module,
      body: processedBody,
      exports: processedExports,
    },
    diagnostics: ctx.diagnostics,
  };
};

/**
 * Run numeric proof validation on all modules.
 *
 * HARD GATE: If any diagnostics are returned, the emitter MUST NOT run.
 * This is not a warning system - unprovable narrowings are compilation errors.
 */
export const runNumericProofPass = (
  modules: readonly IrModule[]
): {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
} => {
  const processedModules: IrModule[] = [];
  const allDiagnostics: Diagnostic[] = [];

  for (const module of modules) {
    const result = processModule(module);
    processedModules.push(result.module);
    allDiagnostics.push(...result.diagnostics);
  }

  return {
    ok: allDiagnostics.length === 0,
    modules: processedModules,
    diagnostics: allDiagnostics,
  };
};
