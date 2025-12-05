/**
 * Collection expression converters (arrays and objects)
 */

import * as ts from "typescript";
import * as path from "path";
import {
  IrArrayExpression,
  IrObjectExpression,
  IrObjectProperty,
  IrReferenceType,
} from "../../types.js";
import { getInferredType, getContextualType } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import {
  computeShapeSignature,
  generateSyntheticName,
  getOrCreateSyntheticType,
  checkSynthesisEligibility,
} from "../anonymous-synthesis.js";

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
 *
 * If no contextual nominal type exists and the literal is eligible for synthesis,
 * a synthetic type is generated and used as the contextual type.
 */
export const convertObjectLiteral = (
  node: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker
): IrObjectExpression => {
  const properties: IrObjectProperty[] = [];

  // Track if we have any spreads (needed for emitter IIFE lowering)
  let hasSpreads = false;

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
      hasSpreads = true;
      properties.push({
        kind: "spread",
        expression: convertExpression(prop.expression, checker),
      });
    }
    // Skip getters/setters/methods for now (can add later if needed)
  });

  // Try to get contextual type first
  let contextualType = getContextualType(node, checker);

  // If no contextual type, check if eligible for synthesis
  if (!contextualType) {
    const eligibility = checkSynthesisEligibility(node, checker);
    if (eligibility.eligible) {
      // Get the inferred type from TypeScript
      const tsType = checker.getTypeAtLocation(node);

      // Compute shape signature for deduplication
      const shapeSignature = computeShapeSignature(tsType, checker);

      // Get source file info for synthetic name
      const sourceFile = node.getSourceFile();
      const fileStem = path.basename(
        sourceFile.fileName,
        path.extname(sourceFile.fileName)
      );
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart()
      );

      // Generate synthetic name
      const syntheticName = generateSyntheticName(
        fileStem,
        line + 1,
        character + 1
      );

      // Get or create synthetic type (handles deduplication)
      // TODO: Handle generic type parameter capture
      const syntheticEntry = getOrCreateSyntheticType(
        shapeSignature,
        syntheticName,
        tsType,
        checker,
        [] // No captured type params for now
      );

      // Create reference to synthetic type
      const syntheticRef: IrReferenceType = {
        kind: "referenceType",
        name: syntheticEntry.name,
        typeArguments: undefined, // TODO: Add type args if capturing generic params
      };

      contextualType = syntheticRef;
    }
  }

  return {
    kind: "object",
    properties,
    inferredType: getInferredType(node, checker),
    contextualType,
    hasSpreads, // Add flag for emitter to know about spreads
  };
};
