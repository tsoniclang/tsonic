/**
 * Block statement converter
 */

import * as ts from "typescript";
import { IrStatement, IrBlockStatement } from "../../../types.js";
import { convertStatement } from "../../../statement-converter.js";

/**
 * Convert block statement
 */
export const convertBlockStatement = (
  node: ts.Block,
  checker: ts.TypeChecker
): IrBlockStatement => {
  return {
    kind: "blockStatement",
    statements: node.statements
      .map((s) => convertStatement(s, checker))
      .filter((s): s is IrStatement => s !== null),
  };
};
