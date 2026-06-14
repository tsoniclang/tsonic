/**
 * Binding Pattern Converter — TypeScript patterns to IR patterns
 *
 * This is syntax-to-IR conversion, not type logic.
 * It must not depend on TypeSystem, TypeRegistry, or NominalEnv.
 *
 * Converts:
 * - Identifier patterns: `x`
 * - Array patterns: `[a, b, ...rest]`
 * - Object patterns: `{ x, y: z, ...rest }`
 *
 * Uses ProgramContext for expression conversion.
 */

import {
  getTstsInitializerNode,
  getTstsNodeText,
  getTstsPropertyNameText,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
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
  name: TstsNode,
  ctx?: ProgramContext
): IrPattern => {
  if (name.Kind === TstsSyntax.KindIdentifier) {
    return {
      kind: "identifierPattern",
      name: getTstsNodeText(name) ?? "_unknown",
    };
  }

  if (name.Kind === TstsSyntax.KindArrayBindingPattern) {
    return {
      kind: "arrayPattern",
      elements: (TstsSyntax.Node_Elements(name) ?? []).map(
        (elem): IrArrayPatternElement | undefined => {
          if (!elem || elem.Kind === TstsSyntax.KindOmittedExpression) {
          return undefined; // Hole in array pattern
        }
          if (elem.Kind === TstsSyntax.KindBindingElement) {
            const bindingElement = TstsSyntax.AsBindingElement(elem);
            const bindingName = TstsSyntax.Node_Name(elem);
            if (!bindingElement || !bindingName) {
              return undefined;
            }
            const isRest = bindingElement.DotDotDotToken !== undefined;
            const initializer = getTstsInitializerNode(elem);
          const defaultExpr =
              initializer && ctx
                ? convertExpression(initializer, ctx, undefined)
              : undefined;

          return {
              pattern: convertBindingName(bindingName, ctx),
            defaultExpr,
            isRest: isRest || undefined,
          };
        }
        return undefined;
        }
      ),
    };
  }

  if (name.Kind === TstsSyntax.KindObjectBindingPattern) {
    const properties: IrObjectPatternProperty[] = [];

    for (const elem of TstsSyntax.Node_Elements(name) ?? []) {
      if (!elem || elem.Kind !== TstsSyntax.KindBindingElement) {
        continue;
      }

      const bindingElement = TstsSyntax.AsBindingElement(elem);
      const bindingName = TstsSyntax.Node_Name(elem);
      if (!bindingElement || !bindingName) {
        continue;
      }

      if (bindingElement.DotDotDotToken !== undefined) {
        // Rest property: { ...rest }
        // Note: restShapeMembers and restSynthTypeName are computed later
        // during rest type synthesis pass
        properties.push({
          kind: "rest",
          pattern: convertBindingName(bindingName, ctx),
        });
      } else {
        const key = bindingElement.PropertyName
          ? (getTstsPropertyNameText(elem) ??
            getTstsNodeText(bindingElement.PropertyName) ??
            "[computed]")
          : bindingName.Kind === TstsSyntax.KindIdentifier
            ? (getTstsNodeText(bindingName) ?? "[computed]")
            : "[computed]";

        const initializer = getTstsInitializerNode(elem);
        const defaultExpr =
          initializer && ctx
            ? convertExpression(initializer, ctx, undefined)
            : undefined;

        properties.push({
          kind: "property",
          key,
          value: convertBindingName(bindingName, ctx),
          shorthand: bindingElement.PropertyName === undefined,
          defaultExpr,
        });
      }
    }

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
