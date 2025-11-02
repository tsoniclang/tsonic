/**
 * Function type conversion
 */

import * as ts from "typescript";
import { IrType, IrFunctionType } from "../types.js";
import { convertParameters as convertParametersFromStatement } from "../statement-converter.js";

/**
 * Convert TypeScript function type to IR function type
 */
export const convertFunctionType = (
  node: ts.FunctionTypeNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrFunctionType => {
  return {
    kind: "functionType",
    parameters: convertParametersFromStatement(node.parameters, checker),
    returnType: convertType(node.type, checker),
  };
};
