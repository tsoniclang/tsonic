/**
 * Overload specialization — Statement rewriting
 *
 * Rewrites IR statement trees by specializing expressions and folding
 * away dead branches. Split from overload-specialization.ts for
 * file-size compliance.
 */

import { IrBlockStatement, IrStatement, IrType } from "../../../../types.js";
import { specializeExpression } from "./overload-specialization-expressions.js";

export const specializeStatement = (
  stmt: IrStatement,
  paramTypesByDeclId: ReadonlyMap<number, IrType>,
  preserveMissingDeclIds: ReadonlySet<number> = new Set()
): IrStatement => {
  const statementAlwaysTerminates = (s: IrStatement): boolean => {
    switch (s.kind) {
      case "returnStatement":
      case "throwStatement":
      case "generatorReturnStatement":
        return true;
      case "blockStatement": {
        for (const inner of s.statements) {
          if (statementAlwaysTerminates(inner)) return true;
        }
        return false;
      }
      case "ifStatement":
        return s.elseStatement
          ? statementAlwaysTerminates(s.thenStatement) &&
              statementAlwaysTerminates(s.elseStatement)
          : false;
      case "tryStatement": {
        const tryOk = statementAlwaysTerminates(s.tryBlock);
        const catchOk = s.catchClause
          ? statementAlwaysTerminates(s.catchClause.body)
          : true;
        const finallyOk = s.finallyBlock
          ? statementAlwaysTerminates(s.finallyBlock)
          : true;
        return tryOk && catchOk && finallyOk;
      }
      default:
        return false;
    }
  };

  switch (stmt.kind) {
    case "blockStatement": {
      const statements: IrStatement[] = [];
      for (const s of stmt.statements) {
        const specialized = specializeStatement(
          s,
          paramTypesByDeclId,
          preserveMissingDeclIds
        );
        statements.push(specialized);
        if (statementAlwaysTerminates(specialized)) {
          break;
        }
      }
      return {
        ...stmt,
        statements,
      };
    }

    case "ifStatement": {
      const condition = specializeExpression(
        stmt.condition,
        paramTypesByDeclId,
        preserveMissingDeclIds
      );
      const thenStatement = specializeStatement(
        stmt.thenStatement,
        paramTypesByDeclId,
        preserveMissingDeclIds
      );
      const elseStatement = stmt.elseStatement
        ? specializeStatement(
            stmt.elseStatement,
            paramTypesByDeclId,
            preserveMissingDeclIds
          )
        : undefined;

      if (
        condition.kind === "literal" &&
        typeof condition.value === "boolean"
      ) {
        return condition.value
          ? thenStatement
          : (elseStatement ?? { kind: "emptyStatement" });
      }

      return { ...stmt, condition, thenStatement, elseStatement };
    }

    case "expressionStatement":
      return {
        ...stmt,
        expression: specializeExpression(
          stmt.expression,
          paramTypesByDeclId,
          preserveMissingDeclIds
        ),
      };
    case "returnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? specializeExpression(
              stmt.expression,
              paramTypesByDeclId,
              preserveMissingDeclIds
            )
          : undefined,
      };

    case "variableDeclaration":
      return {
        ...stmt,
        declarations: stmt.declarations.map((d) => ({
          ...d,
          initializer: d.initializer
            ? specializeExpression(
                d.initializer,
                paramTypesByDeclId,
                preserveMissingDeclIds
              )
            : undefined,
        })),
      };

    case "whileStatement":
      return {
        ...stmt,
        condition: specializeExpression(
          stmt.condition,
          paramTypesByDeclId,
          preserveMissingDeclIds
        ),
        body: specializeStatement(
          stmt.body,
          paramTypesByDeclId,
          preserveMissingDeclIds
        ),
      };

    case "forStatement": {
      const initializer = (() => {
        if (!stmt.initializer) return undefined;
        if (stmt.initializer.kind === "variableDeclaration") {
          const specialized = specializeStatement(
            stmt.initializer,
            paramTypesByDeclId,
            preserveMissingDeclIds
          );
          if (specialized.kind !== "variableDeclaration") {
            throw new Error(
              "ICE: forStatement initializer specialization changed kind"
            );
          }
          return specialized;
        }
        return specializeExpression(
          stmt.initializer,
          paramTypesByDeclId,
          preserveMissingDeclIds
        );
      })();

      return {
        ...stmt,
        initializer,
        condition: stmt.condition
          ? specializeExpression(
              stmt.condition,
              paramTypesByDeclId,
              preserveMissingDeclIds
            )
          : undefined,
        update: stmt.update
          ? specializeExpression(
              stmt.update,
              paramTypesByDeclId,
              preserveMissingDeclIds
            )
          : undefined,
        body: specializeStatement(
          stmt.body,
          paramTypesByDeclId,
          preserveMissingDeclIds
        ),
      };
    }

    case "forOfStatement":
    case "forInStatement":
      return {
        ...stmt,
        expression: specializeExpression(
          stmt.expression,
          paramTypesByDeclId,
          preserveMissingDeclIds
        ),
        body: specializeStatement(
          stmt.body,
          paramTypesByDeclId,
          preserveMissingDeclIds
        ),
      };

    case "switchStatement":
      return {
        ...stmt,
        expression: specializeExpression(
          stmt.expression,
          paramTypesByDeclId,
          preserveMissingDeclIds
        ),
        cases: stmt.cases.map((c) => ({
          ...c,
          test: c.test
            ? specializeExpression(
                c.test,
                paramTypesByDeclId,
                preserveMissingDeclIds
              )
            : undefined,
          statements: c.statements.map((s) =>
            specializeStatement(s, paramTypesByDeclId, preserveMissingDeclIds)
          ),
        })),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: specializeStatement(
          stmt.tryBlock,
          paramTypesByDeclId,
          preserveMissingDeclIds
        ) as IrBlockStatement,
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: specializeStatement(
                stmt.catchClause.body,
                paramTypesByDeclId,
                preserveMissingDeclIds
              ) as IrBlockStatement,
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? (specializeStatement(
              stmt.finallyBlock,
              paramTypesByDeclId,
              preserveMissingDeclIds
            ) as IrBlockStatement)
          : undefined,
      };

    case "throwStatement":
      return {
        ...stmt,
        expression: specializeExpression(
          stmt.expression,
          paramTypesByDeclId,
          preserveMissingDeclIds
        ),
      };

    default:
      return stmt;
  }
};
