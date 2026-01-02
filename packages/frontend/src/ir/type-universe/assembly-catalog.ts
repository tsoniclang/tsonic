/**
 * Assembly Type Catalog Loader
 *
 * Loads CLR type metadata from bindings.json and metadata.json files
 * into a queryable catalog structure.
 *
 * INVARIANT INV-CLR: All assembly types loaded here become part of the
 * unified type catalog. No parallel lookup paths allowed.
 *
 * The loader:
 * 1. Scans node_modules/@tsonic/* packages for metadata files
 * 2. Parses metadata.json for type definitions, members, signatures
 * 3. Parses bindings.json for TS ↔ CLR name mappings
 * 4. Converts to NominalEntry structures with proper IrType members
 */

import * as fs from "fs";
import * as path from "path";
import type { IrType } from "../types/index.js";
import type {
  AssemblyTypeCatalog,
  TypeId,
  NominalEntry,
  NominalKind,
  MemberEntry,
  MemberKind,
  MethodSignatureEntry,
  ParameterEntry,
  ParameterMode,
  TypeParameterEntry,
  HeritageEdge,
  RawMetadataFile,
  RawMetadataType,
  RawMetadataMethod,
} from "./types.js";
import { makeTypeId, parseStableId } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// CLR TYPE STRING PARSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a CLR type string from normalized signature into IrType.
 *
 * Examples:
 * - "System.String" → { kind: "primitiveType", name: "string" }
 * - "System.Int32" → { kind: "primitiveType", name: "int" }
 * - "System.Double" → { kind: "primitiveType", name: "number" }
 * - "System.Boolean" → { kind: "primitiveType", name: "boolean" }
 * - "System.Char" → { kind: "primitiveType", name: "char" }
 * - "System.Void" → { kind: "voidType" }
 * - "System.Object" → { kind: "referenceType", name: "object" }
 * - "T" → { kind: "typeParameterType", name: "T" }
 * - "System.Collections.Generic.List`1[[T]]" → array type or reference
 * - "T[]" → { kind: "arrayType", elementType: ... }
 */
const parseClrTypeString = (clrType: string): IrType => {
  // Handle void
  if (clrType === "System.Void" || clrType === "void") {
    return { kind: "voidType" };
  }

  // Handle primitive mappings
  const primitiveMap: Record<string, IrType> = {
    "System.String": { kind: "primitiveType", name: "string" },
    string: { kind: "primitiveType", name: "string" },
    "System.Int32": { kind: "primitiveType", name: "int" },
    int: { kind: "primitiveType", name: "int" },
    "System.Int64": { kind: "primitiveType", name: "int" }, // TODO: bigint?
    long: { kind: "primitiveType", name: "int" },
    "System.Int16": { kind: "primitiveType", name: "int" },
    short: { kind: "primitiveType", name: "int" },
    "System.Byte": { kind: "primitiveType", name: "int" },
    byte: { kind: "primitiveType", name: "int" },
    "System.SByte": { kind: "primitiveType", name: "int" },
    sbyte: { kind: "primitiveType", name: "int" },
    "System.UInt32": { kind: "primitiveType", name: "int" },
    uint: { kind: "primitiveType", name: "int" },
    "System.UInt64": { kind: "primitiveType", name: "int" },
    ulong: { kind: "primitiveType", name: "int" },
    "System.UInt16": { kind: "primitiveType", name: "int" },
    ushort: { kind: "primitiveType", name: "int" },
    "System.Double": { kind: "primitiveType", name: "number" },
    double: { kind: "primitiveType", name: "number" },
    "System.Single": { kind: "primitiveType", name: "number" },
    float: { kind: "primitiveType", name: "number" },
    "System.Decimal": { kind: "primitiveType", name: "number" },
    decimal: { kind: "primitiveType", name: "number" },
    "System.Boolean": { kind: "primitiveType", name: "boolean" },
    bool: { kind: "primitiveType", name: "boolean" },
    "System.Char": { kind: "primitiveType", name: "char" },
    char: { kind: "primitiveType", name: "char" },
    "System.Object": { kind: "anyType" }, // object → any in TS
    object: { kind: "anyType" },
  };

  const primitive = primitiveMap[clrType];
  if (primitive) return primitive;

  // Handle array types: T[] or System.Array`1[[T]]
  if (clrType.endsWith("[]")) {
    const elementType = clrType.slice(0, -2);
    return {
      kind: "arrayType",
      elementType: parseClrTypeString(elementType),
    };
  }

  // Handle pointer types (convert to ref semantics - just use the base type)
  if (clrType.endsWith("*")) {
    return parseClrTypeString(clrType.slice(0, -1));
  }

  // Handle nullable: Nullable<T> or T?
  if (clrType.startsWith("System.Nullable`1")) {
    // Extract inner type
    const innerMatch = clrType.match(/System\.Nullable`1\[\[([^\]]+)\]\]/);
    if (innerMatch && innerMatch[1]) {
      const innerType = parseClrTypeString(innerMatch[1]);
      return {
        kind: "unionType",
        types: [innerType, { kind: "primitiveType", name: "undefined" }],
      };
    }
  }

  // Handle type parameters (single uppercase letter or common patterns)
  if (/^T\d*$/.test(clrType) || /^T[A-Z][a-zA-Z]*$/.test(clrType)) {
    return { kind: "typeParameterType", name: clrType };
  }

  // Handle generic types: Name`N[[TypeArgs]]
  const genericMatch = clrType.match(/^(.+)`(\d+)(?:\[\[(.+)\]\])?$/);
  if (genericMatch && genericMatch[1] && genericMatch[2]) {
    const baseName = genericMatch[1];
    const arity = parseInt(genericMatch[2], 10);
    const typeArgsStr = genericMatch[3]; // May be undefined

    // Extract type arguments if present
    const typeArguments: IrType[] = [];
    if (typeArgsStr) {
      // Parse comma-separated type args (this is simplified, may need proper parsing)
      const args = splitTypeArguments(typeArgsStr);
      for (const arg of args) {
        typeArguments.push(parseClrTypeString(arg.trim()));
      }
    } else {
      // Generate placeholder type parameters
      for (let i = 0; i < arity; i++) {
        typeArguments.push({
          kind: "typeParameterType",
          name: i === 0 ? "T" : `T${i + 1}`,
        });
      }
    }

    return {
      kind: "referenceType",
      name: baseName,
      typeArguments: typeArguments.length > 0 ? typeArguments : undefined,
      resolvedClrType: clrType,
    };
  }

  // Default: treat as reference type
  return {
    kind: "referenceType",
    name: clrType,
    resolvedClrType: clrType,
  };
};

/**
 * Split type arguments handling nested brackets.
 */
const splitTypeArguments = (str: string): string[] => {
  const result: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of str) {
    if (char === "[") {
      depth++;
      current += char;
    } else if (char === "]") {
      depth--;
      current += char;
    } else if (char === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
};

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZED SIGNATURE PARSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse type from normalized signature for properties.
 *
 * Format for regular properties: "Name|:ReturnType|static=bool|accessor=get"
 * Example: "Length|:System.Int32|static=false|accessor=get"
 *
 * Format for indexer properties: "Name|[IndexType]:ReturnType|static=bool|accessor=get"
 * Example: "Chars|[System.Int32]:System.Char|static=false|accessor=get"
 */
const parsePropertyType = (normalizedSig: string): IrType => {
  // Try indexer format first: Chars|[System.Int32]:System.Char|...
  const indexerMatch = normalizedSig.match(/\|\[[^\]]*\]:([^|]+)\|/);
  if (indexerMatch && indexerMatch[1]) {
    return parseClrTypeString(indexerMatch[1]);
  }

  // Try regular property format: Length|:System.Int32|...
  const colonMatch = normalizedSig.match(/\|:([^|]+)\|/);
  if (colonMatch && colonMatch[1]) {
    return parseClrTypeString(colonMatch[1]);
  }
  return { kind: "unknownType" };
};

/**
 * Parse type from normalized signature for fields.
 *
 * Format: "Name|Type|static=bool|const=bool"
 * Example: "Empty|System.String|static=true|const=false"
 */
const parseFieldType = (normalizedSig: string): IrType => {
  const parts = normalizedSig.split("|");
  if (parts.length >= 2 && parts[1]) {
    return parseClrTypeString(parts[1]);
  }
  return { kind: "unknownType" };
};

/**
 * Parse method signature from normalized signature.
 *
 * Format: "Name|(ParamTypes):ReturnType|static=bool"
 * Example: "Substring|(System.Int32,System.Int32):System.String|static=false"
 */
const parseMethodSignature = (
  normalizedSig: string,
  method: RawMetadataMethod
): MethodSignatureEntry => {
  // Parse return type
  const returnMatch = normalizedSig.match(/\):([^|]+)\|/);
  const returnType =
    returnMatch && returnMatch[1]
      ? parseClrTypeString(returnMatch[1])
      : { kind: "voidType" as const };

  // Parse parameter types
  const paramsMatch = normalizedSig.match(/\|\(([^)]*)\):/);
  const parameters: ParameterEntry[] = [];

  if (paramsMatch && paramsMatch[1]) {
    const paramTypes = splitTypeArguments(paramsMatch[1]);
    for (let i = 0; i < paramTypes.length; i++) {
      const rawParamType = paramTypes[i];
      if (!rawParamType) continue;
      let paramType = rawParamType.trim();
      let mode: ParameterMode = "value";

      // Handle ref/out/in modifiers
      if (paramType.endsWith("&")) {
        mode = "ref"; // or could be out/in, need more info
        paramType = paramType.slice(0, -1);
      }

      parameters.push({
        name: `p${i}`, // We don't have parameter names in normalized signature
        type: parseClrTypeString(paramType),
        mode,
        isOptional: false,
        isRest: false,
      });
    }
  }

  return {
    stableId: method.stableId,
    parameters,
    returnType,
    typeParameters: [], // TODO: parse from arity
    parameterCount: method.parameterCount,
    isStatic: method.isStatic,
    isExtensionMethod: method.isExtensionMethod,
    sourceInterface: method.sourceInterface,
    normalizedSignature: normalizedSig,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// RAW TYPE → NOMINAL ENTRY CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert raw metadata type to NominalEntry.
 */
const convertRawType = (
  rawType: RawMetadataType,
  _namespace: string
): NominalEntry => {
  // Parse stableId
  const parsed = parseStableId(rawType.stableId);
  if (!parsed) {
    throw new Error(`Invalid stableId: ${rawType.stableId}`);
  }

  const typeId = makeTypeId(
    rawType.stableId,
    rawType.clrName,
    parsed.assemblyName,
    rawType.tsEmitName
  );

  // Convert kind
  const kindMap: Record<string, NominalKind> = {
    Class: "class",
    Interface: "interface",
    Struct: "struct",
    Enum: "enum",
    Delegate: "delegate",
  };
  const kind = kindMap[rawType.kind] ?? "class";

  // Convert properties to members
  const members = new Map<string, MemberEntry>();

  for (const prop of rawType.properties) {
    const memberEntry: MemberEntry = {
      tsName: prop.tsEmitName,
      clrName: prop.clrName,
      memberKind: "property" as MemberKind,
      type: parsePropertyType(prop.normalizedSignature),
      isStatic: prop.isStatic,
      isReadonly: !prop.hasSetter,
      isAbstract: prop.isAbstract,
      isVirtual: prop.isVirtual,
      isOverride: prop.isOverride,
      isIndexer: prop.isIndexer,
      hasGetter: prop.hasGetter,
      hasSetter: prop.hasSetter,
      stableId: prop.stableId,
    };
    members.set(prop.tsEmitName, memberEntry);
  }

  // Convert fields to members
  for (const field of rawType.fields) {
    const memberEntry: MemberEntry = {
      tsName: field.tsEmitName,
      clrName: field.clrName,
      memberKind: "field" as MemberKind,
      type: parseFieldType(field.normalizedSignature),
      isStatic: field.isStatic,
      isReadonly: field.isReadOnly || field.isLiteral,
      isAbstract: false,
      isVirtual: false,
      isOverride: false,
      isIndexer: false,
      hasGetter: true,
      hasSetter: !field.isReadOnly && !field.isLiteral,
      stableId: field.stableId,
    };
    members.set(field.tsEmitName, memberEntry);
  }

  // Convert methods to members (grouped by name for overloads)
  const methodsByName = new Map<string, RawMetadataMethod[]>();
  for (const method of rawType.methods) {
    const existing = methodsByName.get(method.tsEmitName) ?? [];
    existing.push(method);
    methodsByName.set(method.tsEmitName, existing);
  }

  for (const [methodName, overloads] of methodsByName) {
    const signatures = overloads.map((m) =>
      parseMethodSignature(m.normalizedSignature, m)
    );
    const first = overloads[0];
    if (!first) continue; // Should never happen since we only add non-empty arrays

    const memberEntry: MemberEntry = {
      tsName: methodName,
      clrName: first.clrName,
      memberKind: "method" as MemberKind,
      signatures,
      isStatic: first.isStatic,
      isReadonly: true, // methods are readonly
      isAbstract: first.isAbstract,
      isVirtual: first.isVirtual,
      isOverride: first.isOverride,
      isIndexer: false,
      hasGetter: false,
      hasSetter: false,
      stableId: first.stableId,
    };
    members.set(methodName, memberEntry);
  }

  // Parse type parameters from arity
  const typeParameters: TypeParameterEntry[] = [];
  for (let i = 0; i < rawType.arity; i++) {
    typeParameters.push({
      name: i === 0 ? "T" : `T${i + 1}`,
    });
  }

  // Parse heritage (base type and interfaces)
  const heritage: HeritageEdge[] = [];
  // Note: baseType and interfaces are not in the raw type shown,
  // but we'd parse them if present

  // Convert accessibility
  const accessibilityMap: Record<
    string,
    "public" | "internal" | "private" | "protected"
  > = {
    Public: "public",
    Internal: "internal",
    Private: "private",
    Protected: "protected",
  };
  const accessibility = accessibilityMap[rawType.accessibility] ?? "public";

  return {
    typeId,
    kind,
    typeParameters,
    heritage,
    members,
    origin: "assembly",
    accessibility,
    isAbstract: rawType.isAbstract,
    isSealed: rawType.isSealed,
    isStatic: rawType.isStatic,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// FILE DISCOVERY AND LOADING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find all @tsonic packages in node_modules.
 */
const findTsonicPackages = (nodeModulesPath: string): string[] => {
  const tsonicDir = path.join(nodeModulesPath, "@tsonic");
  if (!fs.existsSync(tsonicDir)) {
    return [];
  }

  const packages: string[] = [];
  for (const entry of fs.readdirSync(tsonicDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      packages.push(path.join(tsonicDir, entry.name));
    }
  }
  return packages;
};

/**
 * Find all metadata.json files in a package.
 */
const findMetadataFiles = (packagePath: string): string[] => {
  const metadataFiles: string[] = [];

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === "metadata.json") {
        metadataFiles.push(fullPath);
      }
    }
  };

  walk(packagePath);
  return metadataFiles;
};

// TODO: findBindingsFile will be used for loading parameter modifier info and TS name overrides
// const findBindingsFile = (namespaceDir: string): string | undefined => {
//   const bindingsPath = path.join(namespaceDir, "bindings.json");
//   return fs.existsSync(bindingsPath) ? bindingsPath : undefined;
// };

// ═══════════════════════════════════════════════════════════════════════════
// MAIN LOADER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load all assembly types from node_modules/@tsonic packages.
 *
 * @param nodeModulesPath - Path to node_modules directory
 * @returns AssemblyTypeCatalog with all loaded types
 */
export const loadAssemblyTypeCatalog = (
  nodeModulesPath: string
): AssemblyTypeCatalog => {
  const entries = new Map<string, NominalEntry>();
  const tsNameToTypeId = new Map<string, TypeId>();
  const clrNameToTypeId = new Map<string, TypeId>();
  const namespaceToTypeIds = new Map<string, TypeId[]>();

  // Find all @tsonic packages
  const packages = findTsonicPackages(nodeModulesPath);

  for (const packagePath of packages) {
    // Find all metadata.json files
    const metadataFiles = findMetadataFiles(packagePath);

    for (const metadataPath of metadataFiles) {
      try {
        const content = fs.readFileSync(metadataPath, "utf-8");
        const metadata: RawMetadataFile = JSON.parse(content);

        for (const rawType of metadata.types) {
          const entry = convertRawType(rawType, metadata.namespace);

          // Add to entries map
          entries.set(entry.typeId.stableId, entry);

          // Add to name lookup maps
          tsNameToTypeId.set(entry.typeId.tsName, entry.typeId);
          clrNameToTypeId.set(entry.typeId.clrName, entry.typeId);

          // Add to namespace map
          const nsTypes = namespaceToTypeIds.get(metadata.namespace) ?? [];
          nsTypes.push(entry.typeId);
          namespaceToTypeIds.set(metadata.namespace, nsTypes);
        }
      } catch (e) {
        // Log but continue - don't fail on malformed files
        console.warn(`Failed to load metadata from ${metadataPath}:`, e);
      }
    }
  }

  return {
    entries,
    tsNameToTypeId,
    clrNameToTypeId,
    namespaceToTypeIds,
  };
};

/**
 * Load assembly catalog from a specific package (for testing).
 */
export const loadSinglePackageMetadata = (
  metadataPath: string
): AssemblyTypeCatalog => {
  const entries = new Map<string, NominalEntry>();
  const tsNameToTypeId = new Map<string, TypeId>();
  const clrNameToTypeId = new Map<string, TypeId>();
  const namespaceToTypeIds = new Map<string, TypeId[]>();

  const content = fs.readFileSync(metadataPath, "utf-8");
  const metadata: RawMetadataFile = JSON.parse(content);

  for (const rawType of metadata.types) {
    const entry = convertRawType(rawType, metadata.namespace);

    entries.set(entry.typeId.stableId, entry);
    tsNameToTypeId.set(entry.typeId.tsName, entry.typeId);
    clrNameToTypeId.set(entry.typeId.clrName, entry.typeId);

    const nsTypes = namespaceToTypeIds.get(metadata.namespace) ?? [];
    nsTypes.push(entry.typeId);
    namespaceToTypeIds.set(metadata.namespace, nsTypes);
  }

  return {
    entries,
    tsNameToTypeId,
    clrNameToTypeId,
    namespaceToTypeIds,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// CATALOG QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a type entry by stableId.
 */
export const getTypeByStableId = (
  catalog: AssemblyTypeCatalog,
  stableId: string
): NominalEntry | undefined => {
  return catalog.entries.get(stableId);
};

/**
 * Get a type entry by TS name.
 */
export const getTypeByTsName = (
  catalog: AssemblyTypeCatalog,
  tsName: string
): NominalEntry | undefined => {
  const typeId = catalog.tsNameToTypeId.get(tsName);
  return typeId ? catalog.entries.get(typeId.stableId) : undefined;
};

/**
 * Get a type entry by CLR name.
 */
export const getTypeByClrName = (
  catalog: AssemblyTypeCatalog,
  clrName: string
): NominalEntry | undefined => {
  const typeId = catalog.clrNameToTypeId.get(clrName);
  return typeId ? catalog.entries.get(typeId.stableId) : undefined;
};

/**
 * Get a member from a type by TS name.
 */
export const getMemberByTsName = (
  catalog: AssemblyTypeCatalog,
  typeStableId: string,
  memberTsName: string
): MemberEntry | undefined => {
  const entry = catalog.entries.get(typeStableId);
  return entry?.members.get(memberTsName);
};
