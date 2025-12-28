/**
 * Binding pattern converter - TypeScript patterns to IR patterns
 */

import * as ts from "typescript";
import {
  IrPattern,
  IrObjectPatternProperty,
  IrArrayPatternElement,
} from "../types/helpers.js";
import { convertExpression } from "../expression-converter.js";

/**
 * Convert TypeScript binding name to IR pattern.
 * Optionally accepts a TypeChecker for expression conversion (defaults, etc.)
 */
export const convertBindingName = (
  name: ts.BindingName,
  checker?: ts.TypeChecker
): IrPattern => {
  if (ts.isIdentifier(name)) {
    return {
      kind: "identifierPattern",
      name: name.text,
    };
  }

  if (ts.isArrayBindingPattern(name)) {
    return {
      kind: "arrayPattern",
      elements: name.elements.map((elem): IrArrayPatternElement | undefined => {
        if (ts.isOmittedExpression(elem)) {
          return undefined; // Hole in array pattern
        }
        if (ts.isBindingElement(elem)) {
          const isRest = !!elem.dotDotDotToken;
          const defaultExpr =
            elem.initializer && checker
              ? convertExpression(elem.initializer, checker)
              : undefined;

          return {
            pattern: convertBindingName(elem.name, checker),
            defaultExpr,
            isRest: isRest || undefined,
          };
        }
        return undefined;
      }),
    };
  }

  if (ts.isObjectBindingPattern(name)) {
    const properties: IrObjectPatternProperty[] = [];

    name.elements.forEach((elem) => {
      if (elem.dotDotDotToken) {
        // Rest property: { ...rest }
        // Note: restShapeMembers and restSynthTypeName are computed later
        // during rest type synthesis pass
        properties.push({
          kind: "rest",
          pattern: convertBindingName(elem.name, checker),
        });
      } else {
        const key = elem.propertyName
          ? ts.isIdentifier(elem.propertyName)
            ? elem.propertyName.text
            : elem.propertyName.getText()
          : ts.isIdentifier(elem.name)
            ? elem.name.text
            : "[computed]";

        const defaultExpr =
          elem.initializer && checker
            ? convertExpression(elem.initializer, checker)
            : undefined;

        properties.push({
          kind: "property",
          key,
          value: convertBindingName(elem.name, checker),
          shorthand: !elem.propertyName,
          defaultExpr,
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
