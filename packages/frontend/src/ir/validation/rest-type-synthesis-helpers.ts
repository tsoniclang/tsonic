/**
 * Rest Type Synthesis — Helpers & Pattern Synthesis
 *
 * Types, context management, hash generation, member extraction/computation,
 * and pattern synthesis for rest type lowering. Split from
 * rest-type-synthesis-pass.ts for file-size compliance.
 */

import { createHash } from "crypto";
import {
  IrType,
  IrPattern,
  IrExpression,
  IrObjectExpression,
  IrObjectPattern,
  IrInterfaceMember,
  IrPropertySignature,
  IrClassDeclaration,
  IrClassMember,
  IrPropertyDeclaration,
  IrObjectPatternProperty,
} from "../types.js";

/**
 * Result of rest type synthesis pass
 */
export type RestTypeSynthesisResult = {
  readonly ok: boolean;
  readonly modules: readonly import("../types.js").IrModule[];
};

/**
 * Context for tracking state during synthesis
 */
export type SynthesisContext = {
  /** Generated class declarations for rest types */
  readonly generatedDeclarations: IrClassDeclaration[];
  /** Map from shape signature to generated type name for deduplication */
  readonly shapeToName: Map<string, string>;
  /** Module file path for unique naming */
  readonly moduleFilePath: string;
};

/**
 * Create a fresh synthesis context for a module
 */
export const createContext = (moduleFilePath: string): SynthesisContext => ({
  generatedDeclarations: [],
  shapeToName: new Map(),
  moduleFilePath,
});

/**
 * Generate a short hash from module path
 */
const generateModuleHash = (filePath: string): string => {
  return createHash("md5").update(filePath).digest("hex").slice(0, 4);
};

/**
 * Compute shape signature for rest members
 */
const computeRestSignature = (
  members: readonly IrInterfaceMember[]
): string => {
  const sorted = [...members]
    .map((m) => {
      if (m.kind === "propertySignature") {
        return `${m.name}:${m.type.kind}`;
      }
      return `method:${m.name}`;
    })
    .sort()
    .join(";");
  return `rest:{${sorted}}`;
};

/**
 * Generate a short hash from shape signature
 */
const generateShapeHash = (signature: string): string => {
  return createHash("md5").update(signature).digest("hex").slice(0, 8);
};

/**
 * Convert interface members to class property declarations
 */
const membersToClassMembers = (
  members: readonly IrInterfaceMember[]
): readonly IrClassMember[] => {
  return members
    .filter((m): m is IrPropertySignature => m.kind === "propertySignature")
    .map(
      (m): IrPropertyDeclaration => ({
        kind: "propertyDeclaration",
        name: m.name,
        type: m.type,
        initializer: undefined,
        isStatic: false,
        isReadonly: m.isReadonly ?? false,
        accessibility: "public",
        isRequired: !m.isOptional,
      })
    );
};

/**
 * Get or create a generated type name for rest members
 */
const getOrCreateRestTypeName = (
  members: readonly IrInterfaceMember[],
  ctx: SynthesisContext
): string => {
  const signature = computeRestSignature(members);
  const existing = ctx.shapeToName.get(signature);
  if (existing) {
    return existing;
  }

  const moduleHash = generateModuleHash(ctx.moduleFilePath);
  const shapeHash = generateShapeHash(signature);
  const name = `__Rest_${moduleHash}_${shapeHash}`;
  ctx.shapeToName.set(signature, name);

  // Create a class declaration for the rest type
  const declaration: IrClassDeclaration = {
    kind: "classDeclaration",
    name,
    typeParameters: undefined,
    superClass: undefined,
    implements: [],
    members: membersToClassMembers(members),
    isExported: true,
    isStruct: false,
  };

  ctx.generatedDeclarations.push(declaration);
  return name;
};

/**
 * Extract property signatures from a type
 * Works for object types, reference types (resolved to interface), etc.
 */
export const extractMembers = (
  type: IrType
): readonly IrInterfaceMember[] | undefined => {
  switch (type.kind) {
    case "objectType":
      return type.members;
    case "referenceType":
      // For reference types, we'd need to resolve to the actual interface
      // For now, check if structuralMembers is available
      return type.structuralMembers;
    default:
      return undefined;
  }
};

/**
 * Compute rest members by removing picked keys from source members
 */
const computeRestMembers = (
  sourceMembers: readonly IrInterfaceMember[],
  pickedKeys: readonly string[]
): readonly IrInterfaceMember[] => {
  const pickedSet = new Set(pickedKeys);
  return sourceMembers.filter((m) => {
    if (m.kind === "propertySignature") {
      return !pickedSet.has(m.name);
    }
    if (m.kind === "methodSignature") {
      return !pickedSet.has(m.name);
    }
    return true;
  });
};

/**
 * Get picked keys from object pattern properties (non-rest properties)
 */
const getPickedKeys = (
  properties: readonly IrObjectPatternProperty[]
): readonly string[] => {
  return properties
    .filter(
      (p): p is Extract<typeof p, { kind: "property" }> => p.kind === "property"
    )
    .map((p) => p.key);
};

/**
 * Synthesize rest type info for an object pattern
 */
const synthesizeObjectPattern = (
  pattern: IrObjectPattern,
  rhsType: IrType | undefined,
  ctx: SynthesisContext
): IrObjectPattern => {
  const rhsMembers = rhsType ? extractMembers(rhsType) : undefined;

  const drillPropertyType = (key: string): IrType | undefined => {
    if (!rhsMembers) return undefined;
    const prop = rhsMembers.find(
      (m): m is IrPropertySignature =>
        m.kind === "propertySignature" && m.name === key
    );
    return prop?.type;
  };

  // Always process nested object patterns (including nested rest).
  const processedProperties = pattern.properties.map((p) => {
    if (p.kind !== "property") return p;
    if (p.value.kind !== "objectPattern") return p;

    return {
      ...p,
      value: synthesizeObjectPattern(p.value, drillPropertyType(p.key), ctx),
    };
  });

  // Find if there's a rest property
  const restProp = processedProperties.find((p) => p.kind === "rest");
  if (!restProp) {
    return { ...pattern, properties: processedProperties };
  }

  // We have a rest property, compute its type
  if (!rhsType || !rhsMembers) {
    // No type info available, can't synthesize
    return { ...pattern, properties: processedProperties };
  }

  if (rhsMembers.length === 0) {
    // Can't determine source members
    return { ...pattern, properties: processedProperties };
  }

  const pickedKeys = getPickedKeys(processedProperties);
  const restMembers = computeRestMembers(rhsMembers, pickedKeys);

  if (restMembers.length === 0) {
    // Rest is empty - could use empty object
    return { ...pattern, properties: processedProperties };
  }

  // Generate or reuse a type name for the rest shape
  const restTypeName = getOrCreateRestTypeName(restMembers, ctx);

  // Update the rest property with shape info
  const updatedProperties = processedProperties.map((p) => {
    if (p.kind === "rest") {
      return {
        ...p,
        restShapeMembers: restMembers,
        restSynthTypeName: restTypeName,
      };
    }
    return p;
  });

  return {
    ...pattern,
    properties: updatedProperties,
  };
};

/**
 * Synthesize rest types in a pattern, given the RHS type
 */
export const synthesizePattern = (
  pattern: IrPattern,
  rhsType: IrType | undefined,
  ctx: SynthesisContext
): IrPattern => {
  switch (pattern.kind) {
    case "identifierPattern":
      return pattern;
    case "objectPattern":
      return synthesizeObjectPattern(pattern, rhsType, ctx);
    case "arrayPattern":
      // Array patterns don't need rest type synthesis
      // (rest is just slicing the array, no new type needed)
      return pattern;
    default:
      return pattern;
  }
};

/**
 * Derive a structural object type from an object-literal expression.
 *
 * This is a fallback for cases where the IR has already lowered the expression
 * to a synthesized anonymous type reference (e.g. __Anon_*), which erases member
 * information from inferredType. Rest synthesis requires member shapes.
 */
export const deriveObjectTypeFromObjectExpression = (
  expr: IrObjectExpression
): IrType | undefined => {
  const members: IrInterfaceMember[] = [];

  for (const prop of expr.properties) {
    if (prop.kind !== "property") {
      // Spreads/computed keys are not deterministically representable here.
      return undefined;
    }
    if (typeof prop.key !== "string") {
      return undefined;
    }

    const valueType = deriveTypeFromExpressionForShape(prop.value);
    if (!valueType) return undefined;

    members.push({
      kind: "propertySignature",
      name: prop.key,
      type: valueType,
      isOptional: false,
      isReadonly: false,
    });
  }

  return { kind: "objectType", members };
};

const deriveTypeFromExpressionForShape = (
  expr: IrExpression
): IrType | undefined => {
  if (expr.kind === "object") {
    return deriveObjectTypeFromObjectExpression(expr);
  }
  return expr.inferredType;
};

/**
 * Extract element type from array/iterable type
 */
export const extractElementType = (type: IrType): IrType | undefined => {
  if (type.kind === "arrayType") {
    return type.elementType;
  }
  // Could handle other iterables here
  return undefined;
};
