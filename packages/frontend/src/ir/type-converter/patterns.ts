/**
 * Binding pattern converter - TypeScript patterns to IR patterns
 */

import * as ts from "typescript";
import { IrPattern, IrObjectPatternProperty } from "../types.js";

/**
 * Convert TypeScript binding name to IR pattern
 */
export const convertBindingName = (name: ts.BindingName): IrPattern => {
  if (ts.isIdentifier(name)) {
    return {
      kind: "identifierPattern",
      name: name.text,
    };
  }

  if (ts.isArrayBindingPattern(name)) {
    return {
      kind: "arrayPattern",
      elements: name.elements.map((elem) => {
        if (ts.isOmittedExpression(elem)) {
          return undefined; // Hole in array pattern
        }
        if (ts.isBindingElement(elem)) {
          return convertBindingName(elem.name);
        }
        return undefined;
      }),
    };
  }

  if (ts.isObjectBindingPattern(name)) {
    const properties: IrObjectPatternProperty[] = [];

    name.elements.forEach((elem) => {
      if (elem.dotDotDotToken) {
        // Rest property
        properties.push({
          kind: "rest",
          pattern: convertBindingName(elem.name),
        });
      } else {
        const key = elem.propertyName
          ? ts.isIdentifier(elem.propertyName)
            ? elem.propertyName.text
            : elem.propertyName.getText()
          : ts.isIdentifier(elem.name)
            ? elem.name.text
            : "[computed]";

        properties.push({
          kind: "property",
          key,
          value: convertBindingName(elem.name),
          shorthand: !elem.propertyName,
        });
      }
    });

    return {
      kind: "objectPattern",
      properties,
    };
  }

  // Default to identifier pattern (should not reach here normally)
  return {
    kind: "identifierPattern",
    name: "_unknown",
  };
};
