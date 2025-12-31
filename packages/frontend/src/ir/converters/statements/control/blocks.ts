/**
 * Block statement converter
 */

import * as ts from "typescript";
import { IrStatement, IrBlockStatement, IrType } from "../../../types.js";
import { convertStatement } from "../../../statement-converter.js";

/**
 * Convert block statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Pass `undefined` explicitly when not inside a function.
 */
export const convertBlockStatement = (
  node: ts.Block,
  checker: ts.TypeChecker,
  expectedReturnType: IrType | undefined
): IrBlockStatement => {
  return {
    kind: "blockStatement",
    statements: node.statements
      .map((s) => convertStatement(s, checker, expectedReturnType))
      .filter((s): s is IrStatement => s !== null),
  };
};
