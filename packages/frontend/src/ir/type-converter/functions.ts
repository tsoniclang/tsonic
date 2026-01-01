/**
 * Function type conversion
 */

import * as ts from "typescript";
import { IrType, IrFunctionType } from "../types.js";
import { convertParameters as convertParametersFromStatement } from "../statement-converter.js";
import type { Binding } from "../binding/index.js";

/**
 * Convert TypeScript function type to IR function type
 */
export const convertFunctionType = (
  node: ts.FunctionTypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrFunctionType => {
  return {
    kind: "functionType",
    parameters: convertParametersFromStatement(node.parameters, binding),
    returnType: convertType(node.type, binding),
  };
};
