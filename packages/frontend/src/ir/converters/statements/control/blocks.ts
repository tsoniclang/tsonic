/**
 * Block statement converter
 *
 * Phase 5 Step 4: Uses ProgramContext instead of Binding.
 */

import * as ts from "typescript";
import { IrStatement, IrBlockStatement, IrType } from "../../../types.js";
import { convertStatement } from "../../../statement-converter.js";
import type { ProgramContext } from "../../../program-context.js";

/**
 * Convert block statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Pass `undefined` explicitly when not inside a function.
 */
export const convertBlockStatement = (
  node: ts.Block,
  ctx: ProgramContext,
  expectedReturnType: IrType | undefined
): IrBlockStatement => {
  return {
    kind: "blockStatement",
    statements: node.statements
      .map((s) => convertStatement(s, ctx, expectedReturnType))
      .filter((s): s is IrStatement => s !== null),
  };
};
