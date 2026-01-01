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
  IrType,
  IrExpression,
} from "../../types.js";
import { getSourceSpan, getContextualType } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { getTypeSystem } from "../statements/declarations/registry.js";
import {
  computeShapeSignature,
  generateSyntheticName,
  getOrCreateSyntheticType,
  checkSynthesisEligibility,
  PropertyInfo,
} from "../anonymous-synthesis.js";
import { NumericKind } from "../../types/numeric-kind.js";
import type { Binding } from "../../binding/index.js";

/**
 * Compute the element type for an array literal from its elements' types.
 *
 * Rules:
 * 1. All numeric literals with same intent → use that intent (int, long, double)
 * 2. Mixed Int32/Int64 → Int64
 * 3. Any Double present → double
 * 4. String literals → string
 * 5. Boolean literals → boolean
 * 6. Mixed or complex → fall back to TS inference
 */
const computeArrayElementType = (
  elements: readonly (IrExpression | undefined)[],
  fallbackType: IrType | undefined
): IrType | undefined => {
  // Filter out holes and spreads for type analysis
  const regularElements = elements.filter(
    (e): e is IrExpression => e !== undefined && e.kind !== "spread"
  );

  if (regularElements.length === 0) {
    // Empty array - use fallback
    return fallbackType;
  }

  // Check if all elements are numeric literals
  const numericIntents: NumericKind[] = [];
  let allNumericLiterals = true;
  let allStringLiterals = true;
  let allBooleanLiterals = true;

  for (const elem of regularElements) {
    if (elem.kind === "literal") {
      if (typeof elem.value === "number" && elem.numericIntent) {
        numericIntents.push(elem.numericIntent);
        allStringLiterals = false;
        allBooleanLiterals = false;
      } else if (typeof elem.value === "string") {
        allNumericLiterals = false;
        allBooleanLiterals = false;
      } else if (typeof elem.value === "boolean") {
        allNumericLiterals = false;
        allStringLiterals = false;
      } else {
        // null or other literal
        allNumericLiterals = false;
        allStringLiterals = false;
        allBooleanLiterals = false;
      }
    } else {
      // Non-literal element - can't determine type deterministically from literals
      allNumericLiterals = false;
      allStringLiterals = false;
      allBooleanLiterals = false;
    }
  }

  // All numeric literals - determine widest type
  if (allNumericLiterals && numericIntents.length > 0) {
    // Any Double → number (emits as "double" in C#)
    if (
      numericIntents.includes("Double") ||
      numericIntents.includes("Single")
    ) {
      return { kind: "primitiveType", name: "number" };
    }
    // Any Int64/UInt64 → fall back to TS inference (no primitive for long)
    if (numericIntents.includes("Int64") || numericIntents.includes("UInt64")) {
      return fallbackType;
    }
    // All Int32 or smaller → int
    return { kind: "primitiveType", name: "int" };
  }

  // All string literals
  if (allStringLiterals) {
    return { kind: "primitiveType", name: "string" };
  }

  // All boolean literals
  if (allBooleanLiterals) {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Mixed or complex - fall back to TS inference
  return fallbackType;
};

/**
 * Convert array literal expression
 *
 * DETERMINISTIC TYPING:
 * - If expectedType is provided (from LHS annotation), use it
 * - Otherwise, derive from element types using literal form analysis
 * - Default to number[] (double[]) for ergonomics when type cannot be determined
 *
 * @param node - The TypeScript array literal expression
 * @param binding - The Binding layer for symbol resolution
 * @param expectedType - Expected type from context (e.g., `const a: number[] = [1,2,3]`).
 *                       Pass `undefined` explicitly when no contextual type exists.
 */
export const convertArrayLiteral = (
  node: ts.ArrayLiteralExpression,
  binding: Binding,
  expectedType: IrType | undefined
): IrArrayExpression => {
  // Determine element expected type from array expected type
  const expectedElementType =
    expectedType?.kind === "arrayType" ? expectedType.elementType : undefined;

  // Convert all elements, passing expected element type for contextual typing
  const elements = node.elements.map((elem) => {
    if (ts.isOmittedExpression(elem)) {
      return undefined; // Hole in sparse array
    }
    if (ts.isSpreadElement(elem)) {
      // Spread element - convert and derive type from expression
      const spreadExpr = convertExpression(
        elem.expression,
        binding,
        expectedType
      );
      return {
        kind: "spread" as const,
        expression: spreadExpr,
        inferredType: spreadExpr.inferredType,
        sourceSpan: getSourceSpan(elem),
      };
    }
    return convertExpression(elem, binding, expectedElementType);
  });

  // DETERMINISTIC TYPING: Determine inferredType using priority:
  // 1. Expected type from context (e.g., LHS annotation, parameter type)
  // 2. Literal-form inference (derive from element types)
  // 3. Default: number[] (double[]) for ergonomics
  const inferredType: IrType | undefined =
    expectedType?.kind === "arrayType"
      ? expectedType
      : (() => {
          // No expected type - derive from element types
          const elementType = computeArrayElementType(elements, undefined);
          if (elementType) {
            return { kind: "arrayType" as const, elementType };
          }
          // Default to number[] (double[]) for ergonomics
          // This matches Alice's guidance: untyped arrays default to double[]
          return {
            kind: "arrayType" as const,
            elementType: {
              kind: "primitiveType" as const,
              name: "number" as const,
            },
          };
        })();

  return {
    kind: "array",
    elements,
    inferredType,
    sourceSpan: getSourceSpan(node),
  };
};

/**
 * Get the expected type for an object property from the parent expected type.
 *
 * If expectedType is an objectType, looks up the property member directly.
 * If expectedType is a referenceType, we can't resolve it here (would need symbol table).
 */
const getPropertyExpectedType = (
  propName: string,
  expectedType: IrType | undefined
): IrType | undefined => {
  if (!expectedType) return undefined;

  if (expectedType.kind === "objectType") {
    // Direct member lookup - only check property signatures (not methods)
    const member = expectedType.members.find(
      (m) => m.kind === "propertySignature" && m.name === propName
    );
    return member?.kind === "propertySignature" ? member.type : undefined;
  }

  // For referenceType, we'd need to resolve the interface/class
  // This is complex and deferred for now - let TS inference handle it
  return undefined;
};

/**
 * Convert object literal expression
 *
 * If no contextual nominal type exists and the literal is eligible for synthesis,
 * a synthetic type is generated and used as the contextual type.
 *
 * Threads expectedType to property values when the expected type is an objectType.
 */
export const convertObjectLiteral = (
  node: ts.ObjectLiteralExpression,
  binding: Binding,
  expectedType?: IrType
): IrObjectExpression => {
  const properties: IrObjectProperty[] = [];

  // Track if we have any spreads (needed for emitter IIFE lowering)
  let hasSpreads = false;

  node.properties.forEach((prop) => {
    if (ts.isPropertyAssignment(prop)) {
      const keyName = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : undefined;

      const key = ts.isComputedPropertyName(prop.name)
        ? convertExpression(prop.name.expression, binding, undefined)
        : ts.isIdentifier(prop.name)
          ? prop.name.text
          : String(prop.name.text);

      // Look up property expected type from parent expected type
      const propExpectedType = keyName
        ? getPropertyExpectedType(keyName, expectedType)
        : undefined;

      properties.push({
        kind: "property",
        key,
        value: convertExpression(prop.initializer, binding, propExpectedType),
        shorthand: false,
      });
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      // DETERMINISTIC: Derive identifier type from the VALUE being assigned, not the property
      // For { value }, we need to get the type of the variable `value`, not the property `value`
      // ALICE'S SPEC: Use TypeSystem.typeOfDecl() to get the variable's type
      const declId = binding.resolveShorthandAssignment(prop);
      let inferredType: IrType | undefined;

      if (declId) {
        const typeSystem = getTypeSystem();
        if (typeSystem) {
          const declType = typeSystem.typeOfDecl(declId);
          // If TypeSystem returns unknownType, treat as not found
          if (declType.kind !== "unknownType") {
            inferredType = declType;
          }
        }
      }

      properties.push({
        kind: "property",
        key: prop.name.text,
        value: {
          kind: "identifier",
          name: prop.name.text,
          inferredType,
          sourceSpan: getSourceSpan(prop.name),
          declId,
        },
        shorthand: true,
      });
    } else if (ts.isSpreadAssignment(prop)) {
      hasSpreads = true;
      properties.push({
        kind: "spread",
        expression: convertExpression(prop.expression, binding, undefined),
      });
    }
    // Skip getters/setters/methods for now (can add later if needed)
  });

  // Try to get contextual type first
  let contextualType = getContextualType(node, binding);

  // If no contextual type, check if eligible for synthesis
  // DETERMINISTIC IR TYPING (INV-0 compliant): Uses AST-based synthesis
  if (!contextualType) {
    const eligibility = checkSynthesisEligibility(node, binding);
    if (eligibility.eligible) {
      // Extract property info from already-converted properties (AST-based)
      const propInfos: PropertyInfo[] = [];
      let canSynthesize = true;

      for (const prop of properties) {
        if (prop.kind === "property") {
          // Get property name (must be a string for synthesis)
          const keyName = typeof prop.key === "string" ? prop.key : undefined;
          if (!keyName) {
            canSynthesize = false;
            break;
          }

          // Get type from converted expression's inferredType
          const propType = prop.value.inferredType;
          if (
            !propType ||
            propType.kind === "unknownType" ||
            propType.kind === "anyType"
          ) {
            // Cannot synthesize if property type is unknown/any
            canSynthesize = false;
            break;
          }

          propInfos.push({
            name: keyName,
            type: propType,
            optional: false,
            readonly: false,
          });
        } else if (prop.kind === "spread") {
          // For spreads, merge properties from the spread source's objectType
          const spreadType = prop.expression.inferredType;
          if (spreadType?.kind === "objectType") {
            for (const member of spreadType.members) {
              if (member.kind === "propertySignature") {
                propInfos.push({
                  name: member.name,
                  type: member.type,
                  optional: member.isOptional,
                  readonly: member.isReadonly,
                });
              }
            }
          } else if (spreadType?.kind === "referenceType") {
            // Reference type spread - can still synthesize, the reference is kept
            // The spread's type will be resolved at emit time
            canSynthesize = false; // For now, require object type spreads
            break;
          } else {
            canSynthesize = false;
            break;
          }
        }
      }

      if (canSynthesize && propInfos.length > 0) {
        // Compute shape signature for deduplication (AST-based)
        const shapeSignature = computeShapeSignature(propInfos);

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
        // DETERMINISTIC: Takes pre-computed PropertyInfo array
        const syntheticEntry = getOrCreateSyntheticType(
          shapeSignature,
          syntheticName,
          propInfos,
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
  }

  // DETERMINISTIC TYPING: Object's inferredType comes from contextualType
  // (which may be from LHS annotation or synthesized type).
  // We don't derive from properties because that would require TS inference.
  return {
    kind: "object",
    properties,
    inferredType: contextualType, // Use contextual type if available
    sourceSpan: getSourceSpan(node),
    contextualType,
    hasSpreads, // Add flag for emitter to know about spreads
  };
};
