/**
 * Method member conversion
 */

import * as ts from "typescript";
import { IrClassMember } from "../../../../types.js";
import { convertType } from "../../../../type-converter.js";
import { convertBlockStatement } from "../../control.js";
import {
  hasStaticModifier,
  getAccessibility,
  convertTypeParameters,
  convertParameters,
} from "../../helpers.js";
import { detectOverride } from "./override-detection.js";

/**
 * Convert method declaration to IR
 */
export const convertMethod = (
  node: ts.MethodDeclaration,
  checker: ts.TypeChecker,
  superClass: ts.ExpressionWithTypeArguments | undefined
): IrClassMember => {
  const memberName = ts.isIdentifier(node.name) ? node.name.text : "[computed]";

  // Extract parameter types for method signature
  const parameterTypes = node.parameters.map((param) => {
    if (param.type) {
      // Get type string representation
      const type = checker.getTypeAtLocation(param.type);
      return checker.typeToString(type);
    }
    return "any";
  });

  const overrideInfo = detectOverride(
    memberName,
    "method",
    superClass,
    checker,
    parameterTypes
  );

  return {
    kind: "methodDeclaration",
    name: memberName,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    parameters: convertParameters(node.parameters, checker),
    returnType: node.type ? convertType(node.type, checker) : undefined,
    body: node.body ? convertBlockStatement(node.body, checker) : undefined,
    isStatic: hasStaticModifier(node),
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    accessibility: getAccessibility(node),
    isOverride: overrideInfo.isOverride ? true : undefined,
    isShadow: overrideInfo.isShadow ? true : undefined,
  };
};
