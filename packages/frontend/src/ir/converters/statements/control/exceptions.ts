/**
 * Exception handling converters (try, catch)
 */

import * as ts from "typescript";
import { IrTryStatement, IrCatchClause } from "../../../types.js";
import { convertBindingName } from "../../../type-converter.js";
import { convertBlockStatement } from "./blocks.js";

/**
 * Convert try statement
 */
export const convertTryStatement = (
  node: ts.TryStatement,
  checker: ts.TypeChecker
): IrTryStatement => {
  return {
    kind: "tryStatement",
    tryBlock: convertBlockStatement(node.tryBlock, checker, undefined),
    catchClause: node.catchClause
      ? convertCatchClause(node.catchClause, checker)
      : undefined,
    finallyBlock: node.finallyBlock
      ? convertBlockStatement(node.finallyBlock, checker, undefined)
      : undefined,
  };
};

/**
 * Convert catch clause
 */
export const convertCatchClause = (
  node: ts.CatchClause,
  checker: ts.TypeChecker
): IrCatchClause => {
  return {
    kind: "catchClause",
    parameter: node.variableDeclaration
      ? convertBindingName(node.variableDeclaration.name)
      : undefined,
    body: convertBlockStatement(node.block, checker, undefined),
  };
};
