/**
 * Function declaration converter
 */

import * as ts from "typescript";
import { IrFunctionDeclaration } from "../../../types.js";
import { convertType } from "../../../type-converter.js";
import { convertBlockStatement } from "../control.js";
import {
  hasExportModifier,
  convertTypeParameters,
  convertParameters,
} from "../helpers.js";

/**
 * Convert function declaration
 */
export const convertFunctionDeclaration = (
  node: ts.FunctionDeclaration,
  checker: ts.TypeChecker
): IrFunctionDeclaration | null => {
  if (!node.name) return null;

  // Get return type from declared annotation for contextual typing
  const returnType = node.type ? convertType(node.type, checker) : undefined;

  return {
    kind: "functionDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    parameters: convertParameters(node.parameters, checker),
    returnType,
    // Pass return type to body for contextual typing of return statements
    body: node.body
      ? convertBlockStatement(node.body, checker, returnType)
      : { kind: "blockStatement", statements: [] },
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    isExported: hasExportModifier(node),
  };
};
