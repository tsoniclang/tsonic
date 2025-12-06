/**
 * Anonymous Object Literal Synthesis (TSN7403)
 *
 * When an object literal has no contextual nominal type, we synthesize a
 * nominal type from the TypeScript-inferred type. This enables:
 * - Object literals without explicit type annotations
 * - Spread expressions in object literals
 * - Function-valued properties (as delegates)
 *
 * Eligibility:
 * ✅ Allowed: identifier keys, string literal keys, spreads, arrow functions
 * ❌ Rejected: computed keys, symbol keys, method shorthand, getters/setters
 */

import * as ts from "typescript";
import {
  IrType,
  IrInterfaceDeclaration,
  IrInterfaceMember,
  IrTypeParameter,
} from "../types.js";
import { convertType } from "../type-converter.js";

// ============================================================================
// Shape Signature Computation
// ============================================================================

/**
 * Property info extracted from TypeScript type for shape signature
 */
type PropertyInfo = {
  readonly name: string;
  readonly type: IrType;
  readonly optional: boolean;
  readonly readonly: boolean;
};

/**
 * Extract property info from a TypeScript object type
 */
const extractPropertyInfo = (
  type: ts.Type,
  checker: ts.TypeChecker
): readonly PropertyInfo[] => {
  const properties = type.getProperties();
  const result: PropertyInfo[] = [];

  for (const prop of properties) {
    const propType = checker.getTypeOfSymbolAtLocation(
      prop,
      prop.valueDeclaration ?? prop.declarations?.[0] ?? ({} as ts.Node)
    );

    const flags = prop.flags;
    const optional = (flags & ts.SymbolFlags.Optional) !== 0;

    // Check readonly via declaration modifiers
    const decl = prop.valueDeclaration;
    const readonly =
      decl !== undefined &&
      ts.isPropertySignature(decl) &&
      decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ===
        true;

    const typeNode = checker.typeToTypeNode(propType, undefined, undefined);
    if (typeNode) {
      result.push({
        name: prop.name,
        type: convertType(typeNode, checker),
        optional,
        readonly,
      });
    }
  }

  // Sort by name for stable signature
  return result.sort((a, b) => a.name.localeCompare(b.name));
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
 * Compute a stable shape signature from property info
 *
 * Format: sorted properties with their types, optionality, and readonly flags
 * Example: "count:number;name?:string;readonly:id:string"
 */
export const computeShapeSignature = (
  type: ts.Type,
  checker: ts.TypeChecker
): string => {
  const props = extractPropertyInfo(type, checker);
  return props
    .map((p) => {
      const prefix = p.readonly ? "ro:" : "";
      const suffix = p.optional ? "?" : "";
      return `${prefix}${p.name}${suffix}:${serializeType(p.type)}`;
    })
    .join(";");
};

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
 * Returns existing type if shape was seen before (deduplication)
 */
export const getOrCreateSyntheticType = (
  shapeSignature: string,
  name: string,
  type: ts.Type,
  checker: ts.TypeChecker,
  capturedTypeParams: readonly IrTypeParameter[]
): SyntheticTypeEntry => {
  // Check if we already have a synthetic for this shape
  const existing = syntheticTypeRegistry.get(shapeSignature);
  if (existing) {
    return existing;
  }

  // Create new synthetic interface declaration
  const props = extractPropertyInfo(type, checker);
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
 * Eligible:
 * - All property keys are identifiers or string literals
 * - Spread expressions have resolvable object types
 * - No method shorthand (arrow functions are ok)
 * - No getters/setters
 * - No computed keys with non-literal expressions
 */
export const checkSynthesisEligibility = (
  node: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker
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

    // Spread: check that the spread expression has a resolvable type
    if (ts.isSpreadAssignment(prop)) {
      const spreadType = checker.getTypeAtLocation(prop.expression);
      if (spreadType.flags & ts.TypeFlags.Any) {
        return {
          eligible: false,
          reason: `Spread expression has type 'any' which cannot be synthesized`,
        };
      }
      if (spreadType.flags & ts.TypeFlags.Unknown) {
        return {
          eligible: false,
          reason: `Spread expression has type 'unknown' which cannot be synthesized`,
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
