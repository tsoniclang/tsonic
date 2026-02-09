/**
 * Exception handling converters (try, catch)
 *
 * Phase 5 Step 4: Uses ProgramContext instead of Binding.
 */

import * as ts from "typescript";
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
  node: ts.TryStatement,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrTryStatement => {
  return {
    kind: "tryStatement",
    tryBlock: convertBlockStatement(node.tryBlock, ctx, expectedReturnType),
    catchClause: node.catchClause
      ? convertCatchClause(node.catchClause, ctx, expectedReturnType)
      : undefined,
    finallyBlock: node.finallyBlock
      ? convertBlockStatement(node.finallyBlock, ctx, expectedReturnType)
      : undefined,
  };
};

/**
 * Convert catch clause
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertCatchClause = (
  node: ts.CatchClause,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrCatchClause => {
  return {
    kind: "catchClause",
    parameter: node.variableDeclaration
      ? convertBindingName(node.variableDeclaration.name, ctx)
      : undefined,
    body: convertBlockStatement(node.block, ctx, expectedReturnType),
  };
};
