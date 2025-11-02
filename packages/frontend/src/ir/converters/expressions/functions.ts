/**
 * Function expression converters (function expressions and arrow functions)
 */

import * as ts from "typescript";
import {
  IrFunctionExpression,
  IrArrowFunctionExpression,
} from "../../types.js";
import { getInferredType } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import {
  convertParameters,
  convertBlockStatement,
} from "../../statement-converter.js";
import { convertType } from "../../type-converter.js";

/**
 * Convert function expression
 */
export const convertFunctionExpression = (
  node: ts.FunctionExpression,
  checker: ts.TypeChecker
): IrFunctionExpression => {
  return {
    kind: "functionExpression",
    name: node.name?.text,
    parameters: convertParameters(node.parameters, checker),
    returnType: node.type ? convertType(node.type, checker) : undefined,
    body: node.body
      ? convertBlockStatement(node.body, checker)
      : { kind: "blockStatement", statements: [] },
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    inferredType: getInferredType(node, checker),
  };
};

/**
 * Convert arrow function expression
 */
export const convertArrowFunction = (
  node: ts.ArrowFunction,
  checker: ts.TypeChecker
): IrArrowFunctionExpression => {
  const body = ts.isBlock(node.body)
    ? convertBlockStatement(node.body, checker)
    : convertExpression(node.body, checker);

  return {
    kind: "arrowFunction",
    parameters: convertParameters(node.parameters, checker),
    returnType: node.type ? convertType(node.type, checker) : undefined,
    body,
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    inferredType: getInferredType(node, checker),
  };
};
