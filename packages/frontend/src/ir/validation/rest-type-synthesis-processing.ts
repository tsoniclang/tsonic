/**
 * Rest Type Synthesis — Statement & Module Processing
 *
 * Statement processing, parameter processing, module processing, and the
 * main runRestTypeSynthesisPass entry point. Split from
 * rest-type-synthesis-pass.ts for file-size compliance.
 */

import {
  IrModule,
  IrStatement,
  IrParameter,
  IrBlockStatement,
  IrVariableDeclaration,
  IrVariableDeclarator,
} from "../types.js";

import type { RestTypeSynthesisResult, SynthesisContext } from "./rest-type-synthesis-helpers.js";
import {
  createContext,
  extractMembers,
  synthesizePattern,
  deriveObjectTypeFromObjectExpression,
  extractElementType,
} from "./rest-type-synthesis-helpers.js";

/**
 * Process a variable declarator to synthesize rest types
 */
const processDeclarator = (
  decl: IrVariableDeclarator,
  ctx: SynthesisContext
): IrVariableDeclarator => {
  if (decl.name.kind === "identifierPattern") {
    // Simple variable, no destructuring
    return decl;
  }

  // Get the RHS type - either from annotation or inferred
  const rhsTypeRaw = decl.type ?? decl.initializer?.inferredType;
  const rhsType =
    rhsTypeRaw && extractMembers(rhsTypeRaw)
      ? rhsTypeRaw
      : decl.initializer && decl.initializer.kind === "object"
        ? (deriveObjectTypeFromObjectExpression(decl.initializer) ?? rhsTypeRaw)
        : rhsTypeRaw;

  const synthesizedPattern = synthesizePattern(decl.name, rhsType, ctx);
  if (synthesizedPattern === decl.name) {
    return decl;
  }

  return {
    ...decl,
    name: synthesizedPattern,
  };
};

/**
 * Process a statement to synthesize rest types
 */
const processStatement = (
  stmt: IrStatement,
  ctx: SynthesisContext
): IrStatement => {
  switch (stmt.kind) {
    case "variableDeclaration": {
      const updatedDecls = stmt.declarations.map((d) =>
        processDeclarator(d, ctx)
      );
      const hasChanges = updatedDecls.some(
        (d, i) => d !== stmt.declarations[i]
      );
      if (!hasChanges) {
        return stmt;
      }
      return {
        ...stmt,
        declarations: updatedDecls,
      };
    }

    case "functionDeclaration": {
      // Process function body and parameters
      const bodyStmts = stmt.body.statements.map((s) =>
        processStatement(s, ctx)
      );
      const hasBodyChanges = bodyStmts.some(
        (s, i) => s !== stmt.body.statements[i]
      );

      // Process parameters for destructuring patterns
      const params = stmt.parameters.map((p) => processParameter(p, ctx));
      const hasParamChanges = params.some((p, i) => p !== stmt.parameters[i]);

      if (!hasBodyChanges && !hasParamChanges) {
        return stmt;
      }

      return {
        ...stmt,
        parameters: hasParamChanges ? params : stmt.parameters,
        body: hasBodyChanges
          ? { ...stmt.body, statements: bodyStmts }
          : stmt.body,
      };
    }

    case "classDeclaration": {
      // Process class methods
      const members = stmt.members.map((m) => {
        if (m.kind === "methodDeclaration" && m.body) {
          const bodyStmts = m.body.statements.map((s) =>
            processStatement(s, ctx)
          );
          const hasChanges = bodyStmts.some(
            (s, i) => s !== m.body?.statements[i]
          );
          if (!hasChanges) {
            return m;
          }
          return {
            ...m,
            body: { ...m.body, statements: bodyStmts } as IrBlockStatement,
          };
        }
        if (m.kind === "constructorDeclaration" && m.body) {
          const bodyStmts = m.body.statements.map((s) =>
            processStatement(s, ctx)
          );
          const hasChanges = bodyStmts.some(
            (s, i) => s !== m.body?.statements[i]
          );
          if (!hasChanges) {
            return m;
          }
          return {
            ...m,
            body: { ...m.body, statements: bodyStmts } as IrBlockStatement,
          };
        }
        return m;
      });
      const hasChanges = members.some((m, i) => m !== stmt.members[i]);
      if (!hasChanges) {
        return stmt;
      }
      return { ...stmt, members };
    }

    case "ifStatement": {
      const thenStatement = processStatement(stmt.thenStatement, ctx);
      const elseStatement = stmt.elseStatement
        ? processStatement(stmt.elseStatement, ctx)
        : undefined;
      if (
        thenStatement === stmt.thenStatement &&
        elseStatement === stmt.elseStatement
      ) {
        return stmt;
      }
      return { ...stmt, thenStatement, elseStatement };
    }

    case "whileStatement": {
      const body = processStatement(stmt.body, ctx);
      if (body === stmt.body) {
        return stmt;
      }
      return { ...stmt, body };
    }

    case "forStatement": {
      let initializer = stmt.initializer;
      if (initializer?.kind === "variableDeclaration") {
        initializer = processStatement(
          initializer,
          ctx
        ) as IrVariableDeclaration;
      }
      const body = processStatement(stmt.body, ctx);
      if (initializer === stmt.initializer && body === stmt.body) {
        return stmt;
      }
      return { ...stmt, initializer, body };
    }

    case "forOfStatement": {
      // Process the variable pattern for rest types
      const variable = synthesizePattern(
        stmt.variable,
        stmt.expression.inferredType
          ? extractElementType(stmt.expression.inferredType)
          : undefined,
        ctx
      );
      const body = processStatement(stmt.body, ctx);
      if (variable === stmt.variable && body === stmt.body) {
        return stmt;
      }
      return { ...stmt, variable, body };
    }

    case "blockStatement": {
      const statements = stmt.statements.map((s) => processStatement(s, ctx));
      const hasChanges = statements.some((s, i) => s !== stmt.statements[i]);
      if (!hasChanges) {
        return stmt;
      }
      return { ...stmt, statements };
    }

    case "tryStatement": {
      const tryBlock: IrBlockStatement = {
        ...stmt.tryBlock,
        statements: stmt.tryBlock.statements.map((s) =>
          processStatement(s, ctx)
        ),
      };
      const catchClause = stmt.catchClause
        ? {
            ...stmt.catchClause,
            body: {
              ...stmt.catchClause.body,
              statements: stmt.catchClause.body.statements.map((s) =>
                processStatement(s, ctx)
              ),
            },
          }
        : undefined;
      const finallyBlock = stmt.finallyBlock
        ? {
            ...stmt.finallyBlock,
            statements: stmt.finallyBlock.statements.map((s) =>
              processStatement(s, ctx)
            ),
          }
        : undefined;
      return { ...stmt, tryBlock, catchClause, finallyBlock };
    }

    default:
      return stmt;
  }
};

/**
 * Process a parameter for destructuring patterns
 */
const processParameter = (
  param: IrParameter,
  ctx: SynthesisContext
): IrParameter => {
  if (param.pattern.kind === "identifierPattern") {
    return param;
  }

  const synthesizedPattern = synthesizePattern(param.pattern, param.type, ctx);
  if (synthesizedPattern === param.pattern) {
    return param;
  }

  return {
    ...param,
    pattern: synthesizedPattern,
  };
};

/**
 * Process a module to synthesize rest types
 */
const processModule = (module: IrModule): IrModule => {
  const ctx = createContext(module.filePath);

  const body = module.body.map((s) => processStatement(s, ctx));
  const hasChanges = body.some((s, i) => s !== module.body[i]);

  if (!hasChanges && ctx.generatedDeclarations.length === 0) {
    return module;
  }

  // Prepend generated declarations to the module
  const allStatements = [
    ...ctx.generatedDeclarations,
    ...(hasChanges ? body : module.body),
  ];

  return {
    ...module,
    body: allStatements,
  };
};

/**
 * Run the rest type synthesis pass on a set of modules
 */
export const runRestTypeSynthesisPass = (
  modules: readonly IrModule[]
): RestTypeSynthesisResult => {
  const processedModules = modules.map(processModule);
  return {
    ok: true,
    modules: processedModules,
  };
};
