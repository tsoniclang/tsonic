/**
 * Property member conversion
 */

import * as ts from "typescript";
import { IrClassMember } from "../../../../types.js";
import { convertExpression } from "../../../../expression-converter.js";
import { convertType, inferType } from "../../../../type-converter.js";
import {
  hasStaticModifier,
  hasReadonlyModifier,
  getAccessibility,
} from "../../helpers.js";
import { detectOverride } from "./override-detection.js";

/**
 * Get the IR type for a property declaration.
 * Uses explicit annotation if present, otherwise infers from TypeChecker.
 * C# requires explicit types for class fields (no 'var').
 */
const getPropertyType = (
  node: ts.PropertyDeclaration,
  checker: ts.TypeChecker
) => {
  // If there's an explicit type annotation, use it
  if (node.type) {
    return convertType(node.type, checker);
  }
  // Infer type from checker (always needed for class fields)
  return inferType(node, checker);
};

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

  // Get property type for contextual typing of initializer
  const propertyType = getPropertyType(node, checker);

  return {
    kind: "propertyDeclaration",
    name: memberName,
    type: propertyType,
    // Pass property type for contextual typing of initializer
    initializer: node.initializer
      ? convertExpression(node.initializer, checker, propertyType)
      : undefined,
    isStatic: hasStaticModifier(node),
    isReadonly: hasReadonlyModifier(node),
    accessibility: getAccessibility(node),
    isOverride: overrideInfo.isOverride ? true : undefined,
    isShadow: overrideInfo.isShadow ? true : undefined,
  };
};
