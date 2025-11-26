/**
 * Collection expression converters (arrays and objects)
 */

import * as ts from "typescript";
import {
  IrArrayExpression,
  IrObjectExpression,
  IrObjectProperty,
} from "../../types.js";
import { getInferredType, getContextualTypeName } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";

/**
 * Convert array literal expression
 */
export const convertArrayLiteral = (
  node: ts.ArrayLiteralExpression,
  checker: ts.TypeChecker
): IrArrayExpression => {
  return {
    kind: "array",
    elements: node.elements.map((elem) => {
      if (ts.isOmittedExpression(elem)) {
        return undefined; // Hole in sparse array
      }
      if (ts.isSpreadElement(elem)) {
        return {
          kind: "spread" as const,
          expression: convertExpression(elem.expression, checker),
        };
      }
      return convertExpression(elem, checker);
    }),
    inferredType: getInferredType(node, checker),
  };
};

/**
 * Convert object literal expression
 */
export const convertObjectLiteral = (
  node: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker
): IrObjectExpression => {
  const properties: IrObjectProperty[] = [];

  node.properties.forEach((prop) => {
    if (ts.isPropertyAssignment(prop)) {
      const key = ts.isComputedPropertyName(prop.name)
        ? convertExpression(prop.name.expression, checker)
        : ts.isIdentifier(prop.name)
          ? prop.name.text
          : String(prop.name.text);

      properties.push({
        kind: "property",
        key,
        value: convertExpression(prop.initializer, checker),
        shorthand: false,
      });
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      properties.push({
        kind: "property",
        key: prop.name.text,
        value: { kind: "identifier", name: prop.name.text },
        shorthand: true,
      });
    } else if (ts.isSpreadAssignment(prop)) {
      properties.push({
        kind: "spread",
        expression: convertExpression(prop.expression, checker),
      });
    }
    // Skip getters/setters/methods for now (can add later if needed)
  });

  return {
    kind: "object",
    properties,
    inferredType: getInferredType(node, checker),
    contextualClrType: getContextualTypeName(node, checker),
  };
};
