/**
 * Exception handling converters (try, catch)
 *
 * Uses ProgramContext for exception conversion.
 */

import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
import { IrTryStatement, IrCatchClause, IrType } from "../../../types.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import { convertBlockStatement } from "./blocks.js";
import type { ProgramContext } from "../../../program-context.js";

/**
 * Convert try statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertTryStatement = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrTryStatement => {
  const tryStatement = TstsSyntax.AsTryStatement(node);
  return {
    kind: "tryStatement",
    tryBlock: tryStatement?.TryBlock
      ? convertBlockStatement(tryStatement.TryBlock, ctx, expectedReturnType)
      : { kind: "blockStatement", statements: [] },
    catchClause: tryStatement?.CatchClause
      ? convertCatchClause(tryStatement.CatchClause, ctx, expectedReturnType)
      : undefined,
    finallyBlock: tryStatement?.FinallyBlock
      ? convertBlockStatement(tryStatement.FinallyBlock, ctx, expectedReturnType)
      : undefined,
  };
};

/**
 * Convert catch clause
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertCatchClause = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrCatchClause => {
  const catchClause = TstsSyntax.AsCatchClause(node);
  return {
    kind: "catchClause",
    parameter: catchClause?.VariableDeclaration
      ? convertBindingName(
          TstsSyntax.Node_Name(catchClause.VariableDeclaration) ??
            catchClause.VariableDeclaration,
          ctx
        )
      : undefined,
    body: catchClause?.Block
      ? convertBlockStatement(catchClause.Block, ctx, expectedReturnType)
      : { kind: "blockStatement", statements: [] },
  };
};
