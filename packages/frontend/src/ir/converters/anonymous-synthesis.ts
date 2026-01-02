/**
 * Anonymous Object Literal Synthesis (TSN7403)
 *
 * When an object literal has no contextual nominal type, we synthesize a
 * nominal type from the AST structure. This enables:
 * - Object literals without explicit type annotations
 * - Spread expressions in object literals
 * - Function-valued properties (as delegates)
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * This module uses only AST-based synthesis. Property types come from the
 * converted expression's inferredType, not from TS computed types.
 *
 * Eligibility:
 * ✅ Allowed: identifier keys, string literal keys, spreads with typed sources, arrow functions
 * ❌ Rejected: computed keys, symbol keys, method shorthand, getters/setters
 */

import * as ts from "typescript";
import {
  IrType,
  IrInterfaceDeclaration,
  IrInterfaceMember,
  IrTypeParameter,
} from "../types.js";
import type { Binding } from "../binding/index.js";
import { getTypeSystem } from "./statements/declarations/registry.js";

// ============================================================================
// Shape Signature Computation
// ============================================================================

/**
 * Property info for shape signature (AST-based, no TS type computation)
 */
export type PropertyInfo = {
  readonly name: string;
  readonly type: IrType;
  readonly optional: boolean;
  readonly readonly: boolean;
};

/**
 * Serialize an IrType to a stable string for shape signature
 */
const serializeType = (type: IrType): string => {
  switch (type.kind) {
    case "primitiveType":
      return type.name;
    case "literalType":
      return `lit:${typeof type.value}:${String(type.value)}`;
    case "referenceType":
      if (type.typeArguments && type.typeArguments.length > 0) {
        return `ref:${type.name}<${type.typeArguments.map(serializeType).join(",")}>`;
      }
      return `ref:${type.name}`;
    case "arrayType":
      return `arr:${serializeType(type.elementType)}`;
    case "tupleType":
      return `tup:[${type.elementTypes.map(serializeType).join(",")}]`;
    case "functionType": {
      const params = type.parameters
        .map((p) => (p.type ? serializeType(p.type) : "any"))
        .join(",");
      return `fn:(${params})=>${serializeType(type.returnType)}`;
    }
    case "unionType":
      return `union:[${type.types.map(serializeType).join("|")}]`;
    case "typeParameterType":
      return `tp:${type.name}`;
    case "voidType":
      return "void";
    case "anyType":
      return "any";
    case "unknownType":
      return "unknown";
    case "neverType":
      return "never";
    case "objectType": {
      // Nested object types - serialize members (only property signatures)
      const members = type.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature"
        )
        .map(
          (m) => `${m.name}${m.isOptional ? "?" : ""}:${serializeType(m.type)}`
        )
        .sort()
        .join(";");
      return `obj:{${members}}`;
    }
    case "dictionaryType":
      return `dict:[${serializeType(type.keyType)}]:${serializeType(type.valueType)}`;
    case "intersectionType":
      return `intersection:[${type.types.map(serializeType).join("&")}]`;
    default:
      return "unknown";
  }
};

/**
 * Compute a stable shape signature from property info (AST-based)
 *
 * DETERMINISTIC: Takes pre-computed PropertyInfo array, no TS type computation.
 *
 * Format: sorted properties with their types, optionality, and readonly flags
 * Example: "count:number;name?:string;readonly:id:string"
 */
export const computeShapeSignature = (props: readonly PropertyInfo[]): string =>
  [...props]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const prefix = p.readonly ? "ro:" : "";
      const suffix = p.optional ? "?" : "";
      return `${prefix}${p.name}${suffix}:${serializeType(p.type)}`;
    })
    .join(";");

// ============================================================================
// Synthetic Type Registry
// ============================================================================

/**
 * Registry entry for a synthetic type
 */
type SyntheticTypeEntry = {
  readonly name: string;
  readonly declaration: IrInterfaceDeclaration;
  readonly typeParameters: readonly IrTypeParameter[];
};

/**
 * Mutable registry for synthetic types (module-scoped)
 * Key: shape signature, Value: synthetic type entry
 */
const syntheticTypeRegistry = new Map<string, SyntheticTypeEntry>();

/**
 * Reset the registry (call at the start of each file/module compilation)
 */
export const resetSyntheticRegistry = (): void => {
  syntheticTypeRegistry.clear();
};

/**
 * Generate a synthetic type name from location
 *
 * Format: __Anon_<FileStem>_<Line>_<Col>
 */
export const generateSyntheticName = (
  fileStem: string,
  line: number,
  col: number
): string => {
  // Sanitize file stem (remove special chars)
  const safeStem = fileStem.replace(/[^a-zA-Z0-9_]/g, "_");
  return `__Anon_${safeStem}_${line}_${col}`;
};

/**
 * Get or create a synthetic type for a shape
 *
 * DETERMINISTIC: Takes pre-computed PropertyInfo array, no TS type computation.
 * Returns existing type if shape was seen before (deduplication).
 */
export const getOrCreateSyntheticType = (
  shapeSignature: string,
  name: string,
  props: readonly PropertyInfo[],
  capturedTypeParams: readonly IrTypeParameter[]
): SyntheticTypeEntry => {
  // Check if we already have a synthetic for this shape
  const existing = syntheticTypeRegistry.get(shapeSignature);
  if (existing) {
    return existing;
  }

  // Create new synthetic interface declaration from pre-computed props
  const members: IrInterfaceMember[] = props.map((p) => ({
    kind: "propertySignature" as const,
    name: p.name,
    type: p.type,
    isOptional: p.optional,
    isReadonly: p.readonly,
  }));

  const declaration: IrInterfaceDeclaration = {
    kind: "interfaceDeclaration",
    name,
    typeParameters:
      capturedTypeParams.length > 0 ? capturedTypeParams : undefined,
    extends: [],
    members,
    isExported: true, // Synthetic types are always exported for accessibility
    isStruct: false,
  };

  const entry: SyntheticTypeEntry = {
    name,
    declaration,
    typeParameters: capturedTypeParams,
  };

  syntheticTypeRegistry.set(shapeSignature, entry);
  return entry;
};

/**
 * Get all synthetic type declarations (call after processing a file)
 */
export const getSyntheticDeclarations =
  (): readonly IrInterfaceDeclaration[] => {
    return Array.from(syntheticTypeRegistry.values()).map((e) => e.declaration);
  };

// ============================================================================
// Eligibility Check
// ============================================================================

/**
 * Result of eligibility check
 */
export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Check if an object literal expression is eligible for synthesis
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses symbol-based checks, not getTypeAtLocation.
 *
 * Eligible:
 * - All property keys are identifiers or string literals
 * - Spread expressions have typed sources (identifiers with type annotations)
 * - No method shorthand (arrow functions are ok)
 * - No getters/setters
 * - No computed keys with non-literal expressions
 */
export const checkSynthesisEligibility = (
  node: ts.ObjectLiteralExpression,
  binding: Binding
): EligibilityResult => {
  for (const prop of node.properties) {
    // Property assignment: check key type
    if (ts.isPropertyAssignment(prop)) {
      if (ts.isComputedPropertyName(prop.name)) {
        // Computed key - check if it's a string literal
        const expr = prop.name.expression;
        if (!ts.isStringLiteral(expr)) {
          return {
            eligible: false,
            reason: `Computed property key is not a string literal`,
          };
        }
      }
      // Check for symbol keys
      if (ts.isPrivateIdentifier(prop.name)) {
        return {
          eligible: false,
          reason: `Private identifier (symbol) keys are not supported`,
        };
      }
    }

    // Shorthand property: always ok (identifier key)
    if (ts.isShorthandPropertyAssignment(prop)) {
      continue;
    }

    // Spread: check that the spread source is a typed identifier (symbol-based, no getTypeAtLocation)
    if (ts.isSpreadAssignment(prop)) {
      // Only allow spread of identifiers with declarations we can resolve
      if (!ts.isIdentifier(prop.expression)) {
        return {
          eligible: false,
          reason: `Spread source must be a simple identifier (TSN5215)`,
        };
      }

      // Use Binding to resolve the spread source
      const declId = binding.resolveIdentifier(prop.expression);
      if (!declId) {
        return {
          eligible: false,
          reason: `Spread source '${prop.expression.text}' could not be resolved`,
        };
      }

      // ALICE'S SPEC: Use TypeSystem.getDeclInfo() to check for type annotation
      const typeSystem = getTypeSystem();
      if (!typeSystem) {
        return {
          eligible: false,
          reason: `Spread source '${prop.expression.text}' has no type system`,
        };
      }
      const declInfo = typeSystem.getDeclInfo(declId);
      if (!declInfo) {
        return {
          eligible: false,
          reason: `Spread source '${prop.expression.text}' has no declaration`,
        };
      }

      // Check if declaration has a type annotation (deterministic typing requirement)
      // DeclInfo.typeNode is set when the declaration has an explicit type annotation
      const hasType = declInfo.typeNode !== undefined;

      if (!hasType) {
        return {
          eligible: false,
          reason: `Spread source '${prop.expression.text}' requires type annotation (TSN5215)`,
        };
      }

      continue;
    }

    // Method declaration: reject (use arrow functions instead)
    if (ts.isMethodDeclaration(prop)) {
      return {
        eligible: false,
        reason: `Method shorthand is not supported. Use arrow function syntax: 'name: () => ...'`,
      };
    }

    // Getter/setter: reject
    if (
      ts.isGetAccessorDeclaration(prop) ||
      ts.isSetAccessorDeclaration(prop)
    ) {
      return {
        eligible: false,
        reason: `Getters and setters are not supported in synthesized types`,
      };
    }
  }

  return { eligible: true };
};

// ============================================================================
// Type Parameter Capture
// ============================================================================

/**
 * Find type parameters used in a type
 */
export const findUsedTypeParameters = (
  type: IrType,
  inScopeParams: ReadonlySet<string>
): Set<string> => {
  const used = new Set<string>();

  const visit = (t: IrType): void => {
    switch (t.kind) {
      case "typeParameterType":
        if (inScopeParams.has(t.name)) {
          used.add(t.name);
        }
        break;
      case "referenceType":
        t.typeArguments?.forEach(visit);
        break;
      case "arrayType":
        visit(t.elementType);
        break;
      case "tupleType":
        t.elementTypes.forEach(visit);
        break;
      case "functionType":
        t.parameters.forEach((p) => {
          if (p.type) visit(p.type);
        });
        visit(t.returnType);
        break;
      case "unionType":
        t.types.forEach(visit);
        break;
      case "objectType":
        t.members.forEach((m) => {
          if (m.kind === "propertySignature") {
            visit(m.type);
          } else if (m.kind === "methodSignature") {
            m.parameters.forEach((p) => {
              if (p.type) visit(p.type);
            });
            if (m.returnType) visit(m.returnType);
          }
        });
        break;
      case "dictionaryType":
        visit(t.keyType);
        visit(t.valueType);
        break;
    }
  };

  visit(type);
  return used;
};
