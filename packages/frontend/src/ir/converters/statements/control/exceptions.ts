/**
 * Exception handling converters (try, catch)
 */

import * as ts from "typescript";
import { IrTryStatement, IrCatchClause, IrType } from "../../../types.js";
import { convertBindingName } from "../../../type-converter.js";
import { convertBlockStatement } from "./blocks.js";
import type { Binding } from "../../../binding/index.js";

/**
 * Convert try statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertTryStatement = (
  node: ts.TryStatement,
  binding: Binding,
  expectedReturnType?: IrType
): IrTryStatement => {
  return {
    kind: "tryStatement",
    tryBlock: convertBlockStatement(node.tryBlock, binding, expectedReturnType),
    catchClause: node.catchClause
      ? convertCatchClause(node.catchClause, binding, expectedReturnType)
      : undefined,
    finallyBlock: node.finallyBlock
      ? convertBlockStatement(node.finallyBlock, binding, expectedReturnType)
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
  binding: Binding,
  expectedReturnType?: IrType
): IrCatchClause => {
  return {
    kind: "catchClause",
    parameter: node.variableDeclaration
      ? convertBindingName(node.variableDeclaration.name)
      : undefined,
    body: convertBlockStatement(node.block, binding, expectedReturnType),
  };
};
