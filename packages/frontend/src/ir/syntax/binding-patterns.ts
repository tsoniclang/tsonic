/**
 * Binding Pattern Converter — TypeScript patterns to IR patterns
 *
 * ALICE'S SPEC: This is SYNTAX → IR conversion, NOT type logic.
 * It must NOT depend on TypeSystem, TypeRegistry, or NominalEnv.
 *
 * Converts:
 * - Identifier patterns: `x`
 * - Array patterns: `[a, b, ...rest]`
 * - Object patterns: `{ x, y: z, ...rest }`
 */

import * as ts from "typescript";
import {
  IrPattern,
  IrObjectPatternProperty,
  IrArrayPatternElement,
} from "../types/helpers.js";
import { convertExpression } from "../expression-converter.js";
import type { Binding } from "../binding/index.js";

/**
 * Convert TypeScript binding name to IR pattern.
 * Optionally accepts a Binding for expression conversion (defaults, etc.)
 */
export const convertBindingName = (
  name: ts.BindingName,
  binding?: Binding
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
            elem.initializer && binding
              ? convertExpression(elem.initializer, binding, undefined)
              : undefined;

          return {
            pattern: convertBindingName(elem.name, binding),
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
          pattern: convertBindingName(elem.name, binding),
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
          elem.initializer && binding
            ? convertExpression(elem.initializer, binding, undefined)
            : undefined;

        properties.push({
          kind: "property",
          key,
          value: convertBindingName(elem.name, binding),
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
