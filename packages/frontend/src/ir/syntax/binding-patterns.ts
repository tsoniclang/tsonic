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
 *
 * Phase 5 Step 4: Uses ProgramContext for expression conversion.
 */

import * as ts from "typescript";
import {
  IrPattern,
  IrObjectPatternProperty,
  IrArrayPatternElement,
} from "../types/helpers.js";
import { convertExpression } from "../expression-converter.js";
import type { ProgramContext } from "../program-context.js";

/**
 * Convert TypeScript binding name to IR pattern.
 * Optionally accepts a ProgramContext for expression conversion (defaults, etc.)
 */
export const convertBindingName = (
  name: ts.BindingName,
  ctx?: ProgramContext
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
            elem.initializer && ctx
              ? convertExpression(elem.initializer, ctx, undefined)
              : undefined;

          return {
            pattern: convertBindingName(elem.name, ctx),
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
          pattern: convertBindingName(elem.name, ctx),
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
          elem.initializer && ctx
            ? convertExpression(elem.initializer, ctx, undefined)
            : undefined;

        properties.push({
          kind: "property",
          key,
          value: convertBindingName(elem.name, ctx),
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
