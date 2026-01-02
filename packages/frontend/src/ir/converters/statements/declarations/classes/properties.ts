/**
 * Property member conversion
 *
 * DETERMINISTIC TYPING: Property types are derived from initializers when
 * no explicit annotation is present, not from TypeScript inference.
 */

import * as ts from "typescript";
import { IrClassMember, IrExpression, IrType } from "../../../../types.js";
import { convertExpression } from "../../../../expression-converter.js";
import {
  hasStaticModifier,
  hasReadonlyModifier,
  getAccessibility,
} from "../../helpers.js";
import { detectOverride } from "./override-detection.js";
import { getTypeSystem } from "../registry.js";
import type { Binding } from "../../../../binding/index.js";

/**
 * Derive type from a converted IR expression (deterministic).
 * NO TYPESCRIPT FALLBACK - types must be derivable from IR or undefined.
 */
const deriveTypeFromExpression = (expr: IrExpression): IrType | undefined => {
  // For literals, the inferredType is already set deterministically
  if (expr.kind === "literal") {
    return expr.inferredType;
  }

  // For arrays, derive from first element's type or array's inferredType
  if (expr.kind === "array") {
    if (expr.inferredType) {
      return expr.inferredType;
    }
    // Try to derive from first element
    if (expr.elements.length > 0) {
      const firstElement = expr.elements[0];
      if (firstElement) {
        const elementType = deriveTypeFromExpression(firstElement);
        if (elementType) {
          return { kind: "arrayType", elementType };
        }
      }
    }
    return undefined;
  }

  // For all other expressions, use their inferredType if available
  if ("inferredType" in expr && expr.inferredType) {
    return expr.inferredType;
  }

  // Cannot determine type - return undefined (no TypeScript fallback)
  return undefined;
};

/**
 * Convert property declaration to IR
 *
 * DETERMINISTIC TYPING: For properties without explicit annotations,
 * the type is derived from the converted initializer expression.
 */
export const convertProperty = (
  node: ts.PropertyDeclaration,
  binding: Binding,
  superClass: ts.ExpressionWithTypeArguments | undefined
): IrClassMember => {
  const memberName = ts.isIdentifier(node.name) ? node.name.text : "[computed]";

  const overrideInfo = detectOverride(
    memberName,
    "property",
    superClass,
    binding
  );

  // Get explicit type annotation (if present) for contextual typing
  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const typeSystem = getTypeSystem();
  const explicitType =
    node.type && typeSystem
      ? typeSystem.typeFromSyntax(binding.captureTypeSyntax(node.type))
      : undefined;

  // Convert initializer FIRST (with explicit type as expectedType if present)
  const convertedInitializer = node.initializer
    ? convertExpression(node.initializer, binding, explicitType)
    : undefined;

  // Derive property type:
  // 1. Use explicit annotation if present
  // 2. Otherwise derive from converted initializer (NO TypeScript fallback)
  // 3. If no initializer and no annotation, undefined (error at emit time)
  const propertyType = explicitType
    ? explicitType
    : convertedInitializer
      ? deriveTypeFromExpression(convertedInitializer)
      : undefined;

  return {
    kind: "propertyDeclaration",
    name: memberName,
    type: propertyType,
    initializer: convertedInitializer,
    isStatic: hasStaticModifier(node),
    isReadonly: hasReadonlyModifier(node),
    accessibility: getAccessibility(node),
    isOverride: overrideInfo.isOverride ? true : undefined,
    isShadow: overrideInfo.isShadow ? true : undefined,
  };
};
