/**
 * Property member conversion
 */

import * as ts from "typescript";
import { IrClassMember } from "../../../../types.js";
import { convertExpression } from "../../../../expression-converter.js";
import { convertType, resolveClrType } from "../../../../type-converter.js";
import {
  hasStaticModifier,
  hasReadonlyModifier,
  getAccessibility,
} from "../../helpers.js";
import { detectOverride } from "./override-detection.js";

/**
 * Convert property declaration to IR
 */
export const convertProperty = (
  node: ts.PropertyDeclaration,
  checker: ts.TypeChecker,
  superClass: ts.ExpressionWithTypeArguments | undefined
): IrClassMember => {
  const memberName = ts.isIdentifier(node.name) ? node.name.text : "[computed]";

  const overrideInfo = detectOverride(
    memberName,
    "property",
    superClass,
    checker
  );

  return {
    kind: "propertyDeclaration",
    name: memberName,
    type: node.type ? convertType(node.type, checker) : undefined,
    initializer: node.initializer
      ? convertExpression(node.initializer, checker)
      : undefined,
    isStatic: hasStaticModifier(node),
    isReadonly: hasReadonlyModifier(node),
    accessibility: getAccessibility(node),
    isOverride: overrideInfo.isOverride ? true : undefined,
    isShadow: overrideInfo.isShadow ? true : undefined,
    // Resolve CLR type for class fields - C# doesn't allow 'var' for fields
    resolvedClrType: resolveClrType(node, checker),
  };
};
