/**
 * CLR Raw Converter
 *
 * Conversion pipeline from raw bindings.json types to NominalEntry structures
 * and normalized signature parsing for properties, fields, and methods.
 *
 * This module handles:
 * - Parsing normalized signatures for properties, fields, and methods
 * - Converting RawBindingsType → NominalEntry
 */

import type { IrType } from "../../../types/index.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import type {
  NominalEntry,
  NominalKind,
  MemberEntry,
  MemberKind,
  MethodSignatureEntry,
  ParameterEntry,
  ParameterMode,
  TypeParameterEntry,
  HeritageEdge,
  RawBindingsMethod,
  RawBindingsType,
} from "./types.js";
import { makeTypeId, parseStableId, resolveRawTypeStableId } from "./types.js";
import { parseClrTypeString, splitTypeArguments } from "./clr-type-parser.js";
import { compareHeritageEdges, heritageEdgeKey } from "./heritage-edge-key.js";

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
export const parsePropertyType = (normalizedSig: string): IrType => {
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

const addUndefinedToSemanticType = (type: IrType): IrType => {
  if (
    type.kind === "unionType" &&
    type.types.some(
      (candidate) =>
        candidate.kind === "primitiveType" && candidate.name === "undefined"
    )
  ) {
    return type;
  }

  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

/**
 * Parse type from normalized signature for fields.
 *
 * Format: "Name|Type|static=bool|const=bool"
 * Example: "Empty|System.String|static=true|const=false"
 */
export const parseFieldType = (normalizedSig: string): IrType => {
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
export const parseMethodSignature = (
  normalizedSig: string,
  method: RawBindingsMethod
): MethodSignatureEntry => {
  if (method.semanticSignature) {
    return {
      stableId: method.stableId,
      parameters: method.semanticSignature.parameters.map(
        (parameter, index) => ({
          name:
            parameter.pattern.kind === "identifierPattern"
              ? parameter.pattern.name
              : `p${index}`,
          type: parameter.type ?? { kind: "unknownType" },
          mode: parameter.passing,
          isOptional: parameter.isOptional,
          isRest: parameter.isRest,
        })
      ),
      returnType: method.semanticSignature.returnType ?? {
        kind: "voidType" as const,
      },
      typeParameters:
        method.semanticSignature.typeParameters?.map((name) => ({ name })) ??
        [],
      parameterCount: method.parameterCount,
      isStatic: method.isStatic,
      isExtensionMethod: method.isExtensionMethod,
      sourceInterface: method.sourceInterface,
      normalizedSignature: normalizedSig,
    };
  }

  // Parse return type
  const returnMatch = normalizedSig.match(/\):([^|]+)\|/);
  const returnType =
    returnMatch && returnMatch[1]
      ? parseClrTypeString(returnMatch[1])
      : { kind: "voidType" as const };

  // Parse parameter types
  const paramsMatch = normalizedSig.match(/\|\(([^)]*)\):/);
  const parameters: ParameterEntry[] = [];
  const modifierByIndex = new Map<number, ParameterMode>();
  for (const m of method.parameterModifiers ?? []) {
    if (m.modifier === "ref" || m.modifier === "out" || m.modifier === "in") {
      modifierByIndex.set(m.index, m.modifier);
    }
  }

  if (paramsMatch && paramsMatch[1]) {
    const paramTypes = splitTypeArguments(paramsMatch[1]);
    for (let i = 0; i < paramTypes.length; i++) {
      const rawParamType = paramTypes[i];
      if (!rawParamType) continue;
      let paramType = rawParamType.trim();
      let mode: ParameterMode = modifierByIndex.get(i) ?? "value";

      // Handle ref/out/in modifiers
      if (paramType.endsWith("&")) {
        // tsbindgen normalized signatures mark byref with '&'. Use the more
        // precise modifier metadata when available.
        mode = modifierByIndex.get(i) ?? "ref";
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

  const collectReferencedTypeParameterNames = (
    type: IrType | undefined,
    names: string[]
  ): void => {
    if (!type) {
      return;
    }

    switch (type.kind) {
      case "typeParameterType":
        if (!names.includes(type.name)) {
          names.push(type.name);
        }
        return;
      case "arrayType":
        collectReferencedTypeParameterNames(type.elementType, names);
        return;
      case "tupleType":
        type.elementTypes.forEach((elementType) => {
          if (elementType) {
            collectReferencedTypeParameterNames(elementType, names);
          }
        });
        return;
      case "unionType":
      case "intersectionType":
        type.types.forEach((memberType) =>
          collectReferencedTypeParameterNames(memberType, names)
        );
        return;
      case "dictionaryType":
        collectReferencedTypeParameterNames(type.keyType, names);
        collectReferencedTypeParameterNames(type.valueType, names);
        return;
      case "referenceType":
        type.typeArguments?.forEach((typeArgument) =>
          collectReferencedTypeParameterNames(typeArgument, names)
        );
        type.structuralMembers?.forEach((member) => {
          if (member.kind === "propertySignature") {
            collectReferencedTypeParameterNames(member.type, names);
            return;
          }
          member.parameters.forEach((parameter) =>
            collectReferencedTypeParameterNames(parameter.type, names)
          );
          collectReferencedTypeParameterNames(member.returnType, names);
        });
        return;
      case "functionType":
        type.parameters.forEach((parameter) =>
          collectReferencedTypeParameterNames(parameter.type, names)
        );
        collectReferencedTypeParameterNames(type.returnType, names);
        return;
      default:
        return;
    }
  };

  const referencedTypeParameterNames: string[] = [];
  parameters.forEach((parameter) =>
    collectReferencedTypeParameterNames(
      parameter.type,
      referencedTypeParameterNames
    )
  );
  collectReferencedTypeParameterNames(returnType, referencedTypeParameterNames);
  const typeParameters =
    method.arity > 0
      ? Array.from({ length: method.arity }, (_, i) => ({
          name:
            referencedTypeParameterNames[i] ?? (i === 0 ? "T" : `T${i + 1}`),
        }))
      : [];

  return {
    stableId: method.stableId,
    parameters,
    returnType,
    typeParameters,
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
export const convertRawType = (
  rawType: RawBindingsType,
  _namespace: string
): NominalEntry => {
  // Parse stableId
  const stableId = resolveRawTypeStableId(rawType);
  if (!stableId) {
    throw new Error(
      `Missing canonical CLR identity for type: ${rawType.clrName}`
    );
  }

  const parsed = parseStableId(stableId);
  if (!parsed) {
    throw new Error(`Invalid stableId: ${stableId}`);
  }

  const typeId = makeTypeId(
    stableId,
    rawType.clrName,
    parsed.assemblyName,
    tsbindgenClrTypeNameToTsTypeName(rawType.clrName)
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
    const propTsName = prop.clrName;
    const memberEntry: MemberEntry = {
      tsName: propTsName,
      clrName: prop.clrName,
      memberKind: "property" as MemberKind,
      type:
        prop.semanticType !== undefined
          ? prop.semanticOptional === true
            ? addUndefinedToSemanticType(prop.semanticType)
            : prop.semanticType
          : parsePropertyType(prop.normalizedSignature),
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
    members.set(propTsName, memberEntry);
  }

  // Convert fields to members
  for (const field of rawType.fields) {
    const fieldTsName = field.clrName;
    const memberEntry: MemberEntry = {
      tsName: fieldTsName,
      clrName: field.clrName,
      memberKind: "field" as MemberKind,
      type:
        field.semanticType !== undefined
          ? field.semanticOptional === true
            ? addUndefinedToSemanticType(field.semanticType)
            : field.semanticType
          : parseFieldType(field.normalizedSignature),
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
    members.set(fieldTsName, memberEntry);
  }

  // Convert methods to members (grouped by name for overloads)
  const methodsByName = new Map<string, RawBindingsMethod[]>();
  for (const method of rawType.methods) {
    const existing = methodsByName.get(method.clrName) ?? [];
    existing.push(method);
    methodsByName.set(method.clrName, existing);
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

  const typeParameters: TypeParameterEntry[] =
    rawType.typeParameters && rawType.typeParameters.length === rawType.arity
      ? rawType.typeParameters.map((name) => ({ name }))
      : Array.from({ length: rawType.arity }, (_, i) => ({
          name: i === 0 ? "T" : `T${i + 1}`,
        }));

  const heritage: HeritageEdge[] = [];

  if (rawType.baseType) {
    heritage.push({
      kind: "extends",
      targetStableId: rawType.baseType.stableId,
      typeArguments: (rawType.baseType.typeArguments ?? []).map(
        parseClrTypeString
      ),
    });
  }

  for (const iface of rawType.interfaces ?? []) {
    heritage.push({
      kind: "implements",
      targetStableId: iface.stableId,
      typeArguments: (iface.typeArguments ?? []).map(parseClrTypeString),
    });
  }

  const heritageSeen = new Set<string>();
  const heritageDeduped: HeritageEdge[] = [];
  for (const edge of heritage) {
    const key = heritageEdgeKey(edge);
    if (heritageSeen.has(key)) continue;
    heritageSeen.add(key);
    heritageDeduped.push(edge);
  }
  heritageDeduped.sort(compareHeritageEdges);

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
    heritage: heritageDeduped,
    members,
    origin: "assembly",
    accessibility,
    isAbstract: rawType.isAbstract,
    isSealed: rawType.isSealed,
    isStatic: rawType.isStatic,
  };
};
